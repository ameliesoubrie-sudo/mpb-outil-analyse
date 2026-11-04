// Remplit une base de recette avec le catalogue réel (export du 20 octobre) et un bilan complet pour un membre.
import { readFileSync, existsSync } from "node:fs";

const SIM = process.env.MPB_SIM || "/tmp/claude-0/-home-claude/67a605ce-11e8-5da2-8479-13d1aad72ebc/scratchpad/sim/";
const lit = (n, d) => (existsSync(SIM + n) ? JSON.parse(readFileSync(SIM + n, "utf8")) : d);

async function inserer(pool, table, lignes, completer = (x) => x) {
  if (!lignes.length) return;
  const { rows } = await pool.query(`select column_name, data_type from information_schema.columns where table_schema = 'public' and table_name = $1`, [table]);
  const types = Object.fromEntries(rows.map((r) => [r.column_name, r.data_type]));
  for (const brut of lignes) {
    const l = completer({ ...brut });
    const cols = Object.keys(l).filter((k) => k in types && l[k] !== undefined);
    const vals = cols.map((k) => (types[k] === "jsonb" ? JSON.stringify(l[k]) : l[k]));
    await pool.query(`insert into public.${table} (${cols.join(",")}) values (${cols.map((_, i) => "$" + (i + 1)).join(",")}) on conflict do nothing`, vals);
  }
}

export async function semerCatalogue(pool) {
  await pool.query(`delete from public.bilan_question_options; delete from public.bilan_inscriptions; delete from public.bilan_evenements;`);
  await inserer(pool, "bilan_parcours", [
    { code: "F", titre: "Ma fiche Mon Photographe Bébé", ordre: 1 }, { code: "G", titre: "Être trouvé sur Google et dans les IA", ordre: 2 },
    { code: "S", titre: "Faire réserver depuis son site", ordre: 3 }, { code: "R", titre: "Communiquer sur les réseaux sociaux", ordre: 4 },
    { code: "N", titre: "Réseau et recommandations", ordre: 5 }]);
  const qs = lit("questions.json", []);
  // Les missions référencent des questions et inversement : missions sans question d'abord, puis questions, puis lien
  const ms = lit("missions.json", []);
  await inserer(pool, "bilan_missions", ms, (m) => ({ ...m, question_id: null }));
  await inserer(pool, "bilan_questions", qs);
  for (const m of ms) if (m.question_id) await pool.query(`update public.bilan_missions set question_id = $2 where id = $1 and exists (select 1 from public.bilan_questions where id = $2)`, [m.id, m.question_id]);
  await inserer(pool, "bilan_question_options", lit("options.json", []));
  await inserer(pool, "bilan_ressources", lit("ressources.json", []), (r) => ({ ...r, url: r.url || `https://htyvaqxdfptgswvwqplq.supabase.co/storage/v1/object/public/ressources/${r.id}.pdf` }));
  await inserer(pool, "bilan_evenements", lit("evenements.json", []).map((e) => ({ ...e, debut: new Date(Date.now() + 6 * 864e5).toISOString() })));
  await inserer(pool, "bilan_identite_questions", lit("identite_questions.json", []));
}

export async function semerBilanComplet(pool, memberId) {
  const { rows: [b] } = await pool.query(`insert into public.bilan_bilans (member_id, site_url) values ($1, 'https://www.exemple-photographe.fr') returning id`, [memberId]);
  await inserer(pool, "bilan_reponses", lit("reponses.json", []).map((r) => ({ ...r, bilan_id: b.id, source: "declare" })));
  const { rows: [a] } = await pool.query(`insert into public.bilan_analyses (bilan_id, url, statut) values ($1, 'https://www.exemple-photographe.fr', 'termine') returning id`, [b.id]);
  await inserer(pool, "bilan_constats", lit("constats.json", []).map((c) => ({ ...c, bilan_id: b.id, analyse_id: a.id, constat: c.constat || "Constat de l'analyse" })));
  const plan = lit("plan.json", {});
  const { rows: [p] } = await pool.query(`insert into public.bilan_plans (bilan_id, version_regles, etats, restitution, analyse_detaillee) values ($1, '2026-10-v1', $2, $3, $4) returning id`,
    [b.id, JSON.stringify(plan.etats || {}), plan.restitution || null, plan.analyse_detaillee ? JSON.stringify(plan.analyse_detaillee) : null]);
  const lignes = readFileSync(SIM + "plan.txt", "utf8").split("\n").slice(1).map((l) => l.split("\t")).filter((c) => c.length >= 8);
  for (const c of lignes) {
    await pool.query(`insert into public.bilan_plan_missions (plan_id, mission_id, ordre, niveau, raisons) select $1, $2, $3, $4, $5 where exists (select 1 from public.bilan_missions where id = $2) on conflict do nothing`,
      [p.id, c[1], Number(c[0]), Number(c[3]) || 1, c[7] ? c[7].split(",") : []]);
  }
  const ident = lit("identite.json", {});
  await pool.query(`insert into public.bilan_identite (member_id, reponses, carte, portrait, statut) values ($1, $2, $3, $4, $5) on conflict (member_id) do nothing`,
    [memberId, JSON.stringify(ident.reponses || {}), ident.carte ? JSON.stringify(ident.carte) : null, ident.portrait ? JSON.stringify(ident.portrait) : null, ident.statut || "en_cours"]);
  return b.id;
}
