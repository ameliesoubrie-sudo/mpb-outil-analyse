// Routes métier bornées. Chaque requête porte le member_id résolu côté serveur depuis la session Pro vérifiée :
// aucun member_id, droit ou formule venant du navigateur n'est lu. Les champs modifiables sont listés explicitement.
// Une ligne d'un autre membre répond comme une ligne inexistante (404), sans révéler son existence.
import { estUuid, estIdCatalogue } from "./outils.js";

export class ErreurMetier extends Error {
  constructor(statut, code, message) { super(message); this.statut = statut; this.code = code; }
}
const introuvable = () => new ErreurMetier(404, "introuvable", "Élément introuvable.");
const invalide = (m) => new ErreurMetier(400, "invalide", m || "Requête invalide.");

// Droit requis pour chaque niveau d'accès du catalogue (bilan_ressources.acces, bilan_evenements.acces)
export const DROIT_ACCES = { tous: null, audit: "training", complete: "studios" };
export const aLeDroit = (droits, d) => d === null || droits[d] === true;
// Niveau inconnu : traité comme le plus restrictif
export const droitPour = (acces) => (Object.prototype.hasOwnProperty.call(DROIT_ACCES, acces) ? DROIT_ACCES[acces] : "studios");

// Matrice des fonctions : nom -> droit exigé (vérifié ici ET dans la fonction elle-même)
export const FONCTIONS = {
  "analyse-site": "analysis",
  "generer-plan": "analysis",
  "agent-identite": "studios",
  "studio-instagram": "studios",
  "redacteur-pages": "studios",
  "messages-clients": "studios",
  "stratege-marque": "studios",
  "assistant-partenaires": "studios",
  "studio-contenu": "studios",
  "calculateur": "studios",
};

// ---------- Validateurs ----------
const tailleJson = (v) => Buffer.byteLength(JSON.stringify(v ?? null));
function objetJson(v, max, nom) {
  if (v === null) return null;
  if (typeof v !== "object" || Array.isArray(v)) throw invalide(`${nom} : objet attendu`);
  if (tailleJson(v) > max) throw invalide(`${nom} : trop volumineux`);
  return v;
}
function texteCourt(v, max, nom) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v !== "string" || v.length > max) throw invalide(`${nom} invalide`);
  return v;
}
function dateIso(v, nom) {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string" || Number.isNaN(Date.parse(v)) || v.length > 40) throw invalide(`${nom} invalide`);
  return v;
}
function parmi(v, liste, nom) { if (!liste.includes(v)) throw invalide(`${nom} invalide`); return v; }

async function bilanDuMembre(db, memberId, bilanId) {
  if (!estUuid(bilanId)) throw introuvable();
  const { rows } = await db.query(`select * from public.bilan_bilans where id = $1 and member_id = $2`, [bilanId, memberId]);
  if (!rows[0]) throw introuvable();
  return rows[0];
}

// ---------- Routes ----------
// Chaque route : [méthode, motif, droit exigé, gestionnaire(ctx, params, corps, requete)]
export function routesMetier({ pool }) {
  const q = (texte, params) => pool.query(texte, params);
  return [
    ["GET", /^\/api\/catalogue$/, "analysis", async (ctx) => {
      // Le contenu des missions (méthode, étapes, fiches, « pourquoi ») fait partie du programme payant :
      // sans le droit training, seuls l'identifiant, le titre et les données utiles à l'analyse sont envoyés.
      const colonnes = ctx.profil.droits.training ? "*" : "id, question_id, parcours, titre, duree_min, prerequis, declenche_sur";
      const [qs, os, ms] = await Promise.all([
        q(`select * from public.bilan_questions where active order by ordre`),
        q(`select * from public.bilan_question_options order by ordre`),
        q(`select ${colonnes} from public.bilan_missions`),
      ]);
      return { questions: qs.rows, options: os.rows, missions: ms.rows };
    }],

    ["GET", /^\/api\/bilan$/, "analysis", async (ctx) => {
      const { rows: [bilan] } = await q(`select * from public.bilan_bilans where member_id = $1 order by created_at desc limit 1`, [ctx.memberId]);
      if (!bilan) return { bilan: null, reponses: [], constats: [], a_un_plan: false };
      // Adresse de la fiche publique Pro : pré-remplie sans jamais écraser une réponse enregistrée
      if (ctx.profil.liens.fichePublique) {
        await q(`update public.bilan_reponses set texte_libre = coalesce(texte_libre, '{}'::jsonb) || jsonb_build_object('fiche_url', $3::text)
                 where bilan_id = $1 and question_id = 'P04' and coalesce(texte_libre->>'fiche_url', '') = ''
                 and exists (select 1 from public.bilan_bilans b where b.id = $1 and b.member_id = $2)`,
          [bilan.id, ctx.memberId, ctx.profil.liens.fichePublique]);
      }
      const [reps, cs, pl] = await Promise.all([
        q(`select * from public.bilan_reponses where bilan_id = $1`, [bilan.id]),
        q(`select * from public.bilan_constats where bilan_id = $1 order by created_at desc`, [bilan.id]),
        q(`select 1 from public.bilan_plans where bilan_id = $1 limit 1`, [bilan.id]),
      ]);
      return { bilan, reponses: reps.rows, constats: cs.rows, a_un_plan: pl.rowCount > 0 };
    }],

    ["POST", /^\/api\/bilans$/, "analysis", async (ctx) => {
      const { rows: [{ n }] } = await q(`select count(*)::int as n from public.bilan_bilans where member_id = $1 and created_at > now() - interval '30 days'`, [ctx.memberId]);
      if (n >= 10) throw new ErreurMetier(429, "limite", "Vous avez déjà commencé 10 bilans ce mois-ci.");
      const { rows: [b] } = await q(`insert into public.bilan_bilans (member_id) values ($1) returning *`, [ctx.memberId]);
      return { bilan: b };
    }],

    ["PATCH", /^\/api\/bilans\/([^/]+)$/, "analysis", async (ctx, [id], corps) => {
      await bilanDuMembre(pool, ctx.memberId, id);
      const site = texteCourt(corps?.site_url, 500, "site_url");
      if (site && !/^https?:\/\//i.test(site) && !/^[a-z0-9.-]+\.[a-z]{2,}/i.test(site)) throw invalide("Adresse de site invalide.");
      const { rows: [b] } = await q(`update public.bilan_bilans set site_url = $3, updated_at = now() where id = $1 and member_id = $2 returning *`, [id, ctx.memberId, site]);
      return { bilan: b };
    }],

    ["PUT", /^\/api\/bilans\/([^/]+)\/reponses\/([^/]+)$/, "analysis", async (ctx, [id, qid], corps) => {
      await bilanDuMembre(pool, ctx.memberId, id);
      if (!estIdCatalogue(qid)) throw invalide();
      const { rowCount } = await q(`select 1 from public.bilan_questions where id = $1 and active`, [qid]);
      if (!rowCount) throw invalide("Question inconnue.");
      const valeur = corps?.valeur;
      if (!Array.isArray(valeur) || valeur.length > 60 || !valeur.every((v) => typeof v === "string" && v.length <= 500)) throw invalide("valeur invalide");
      const texte = corps?.texte_libre === undefined ? null : objetJson(corps.texte_libre, 32_000, "texte_libre");
      const source = parmi(corps?.source ?? "declare", ["declare", "analyse_confirmee", "analyse_corrigee"], "source");
      const { rows: [r] } = await q(
        `insert into public.bilan_reponses (bilan_id, question_id, valeur, texte_libre, source, answered_at) values ($1, $2, $3, $4, $5, now())
         on conflict (bilan_id, question_id) do update set valeur = excluded.valeur, texte_libre = excluded.texte_libre, source = excluded.source, answered_at = now()
         returning *`, [id, qid, valeur, texte, source]);
      return { reponse: r };
    }],

    ["POST", /^\/api\/bilans\/([^/]+)\/constats\/([^/]+)\/corriger$/, "analysis", async (ctx, [id, qid]) => {
      await bilanDuMembre(pool, ctx.memberId, id);
      if (!estIdCatalogue(qid)) throw invalide();
      await q(`update public.bilan_constats set statut = 'corrige' where bilan_id = $1 and question_id = $2`, [id, qid]);
      return { ok: true };
    }],

    ["GET", /^\/api\/bilans\/([^/]+)\/plan$/, "analysis", async (ctx, [id]) => {
      await bilanDuMembre(pool, ctx.memberId, id);
      const { rows: [plan] } = await q(`select id, created_at, etats, restitution, analyse_detaillee from public.bilan_plans where bilan_id = $1 order by created_at desc limit 1`, [id]);
      const [pm, su, an] = await Promise.all([
        plan ? q(`select * from public.bilan_plan_missions where plan_id = $1 order by ordre`, [plan.id]) : { rows: [] },
        q(`select * from public.bilan_mission_suivi where bilan_id = $1`, [id]),
        q(`select url, statut, erreur, pages, audit, created_at from public.bilan_analyses where bilan_id = $1 order by created_at desc`, [id]),
      ]);
      return { plan: plan || null, plan_missions: pm.rows, suivi: su.rows, analyses: an.rows };
    }],

    // Suivi des missions : le programme personnalisé fait partie des offres payantes (droit training)
    ["PUT", /^\/api\/bilans\/([^/]+)\/suivi\/([^/]+)$/, "training", async (ctx, [id, mid], corps) => {
      await bilanDuMembre(pool, ctx.memberId, id);
      if (!estIdCatalogue(mid)) throw invalide();
      const { rowCount } = await q(`select 1 from public.bilan_missions where id = $1`, [mid]);
      if (!rowCount) throw invalide("Mission inconnue.");
      const statut = parmi(corps?.statut ?? "en_cours", ["en_cours", "termine", "reporte"], "statut");
      const etapes = corps?.etapes_faites ?? [];
      if (!Array.isArray(etapes) || etapes.length > 50 || !etapes.every((n) => Number.isInteger(n) && n >= 0 && n < 100)) throw invalide("etapes_faites invalide");
      const note = texteCourt(corps?.note, 4000, "note");
      const reporte = corps?.reporte_jusqu ? (/^\d{4}-\d{2}-\d{2}$/.test(corps.reporte_jusqu) ? corps.reporte_jusqu : (() => { throw invalide("reporte_jusqu invalide"); })()) : null;
      const termine = dateIso(corps?.termine_at, "termine_at");
      const { rows: [r] } = await q(
        `insert into public.bilan_mission_suivi (bilan_id, mission_id, statut, etapes_faites, note, reporte_jusqu, termine_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, now())
         on conflict (bilan_id, mission_id) do update set statut = excluded.statut, etapes_faites = excluded.etapes_faites, note = excluded.note,
           reporte_jusqu = excluded.reporte_jusqu, termine_at = excluded.termine_at, updated_at = now()
         returning *`, [id, mid, statut, etapes, note, reporte, termine]);
      return { suivi: r };
    }],

    ["GET", /^\/api\/contenus$/, "studios", async (ctx, _p, _c, url) => {
      const mission = url.searchParams.get("mission_id"), agent = url.searchParams.get("agent");
      if (!estIdCatalogue(mission || "")) throw invalide();
      if (agent !== null && !/^[a-z-]{1,40}$/.test(agent)) throw invalide();
      const { rows } = await q(
        `select id, created_at, format, persona_prenom, resultat, brief from public.bilan_contenus
         where member_id = $1 and mission_id = $2 and ($3::text is null or agent = $3) order by created_at desc limit 10`,
        [ctx.memberId, mission, agent]);
      return { contenus: rows };
    }],

    ["GET", /^\/api\/identite$/, "studios", async (ctx) => {
      const [qs, ligne] = await Promise.all([
        q(`select * from public.bilan_identite_questions where active order by ordre`),
        q(`select * from public.bilan_identite where member_id = $1`, [ctx.memberId]),
      ]);
      return { questions: qs.rows, identite: ligne.rows[0] || null };
    }],

    ["PUT", /^\/api\/identite$/, "studios", async (ctx, _p, corps) => {
      const reponses = objetJson(corps?.reponses ?? {}, 400_000, "reponses") || {};
      const majCarte = Object.prototype.hasOwnProperty.call(corps || {}, "carte");
      const carte = majCarte ? objetJson(corps.carte, 400_000, "carte") : undefined;
      const valider = corps?.statut === "validee";
      if (corps?.statut !== undefined && !valider) throw invalide("statut invalide");
      const { rows: [r] } = await q(
        `insert into public.bilan_identite (member_id, reponses, carte, statut, valide_at, updated_at)
         values ($1, $2, $3, case when $5 then 'validee' else 'en_cours' end, case when $5 then now() end, now())
         on conflict (member_id) do update set reponses = excluded.reponses,
           carte = case when $4 then excluded.carte else bilan_identite.carte end,
           statut = case when $5 then 'validee' else bilan_identite.statut end,
           valide_at = case when $5 then now() else bilan_identite.valide_at end,
           updated_at = now()
         returning *`, [ctx.memberId, reponses, majCarte ? carte : null, majCarte, valider]);
      return { identite: r };
    }],

    ["GET", /^\/api\/ressources$/, null, async (ctx) => {
      const depuis = new Date(Date.now() - 3 * 3600e3).toISOString();
      const [res, ev, ins] = await Promise.all([
        q(`select id, type, theme, titre, description, format, pages, acces, missions, ordre, date_publication, url as url_brute from public.bilan_ressources where actif order by ordre`),
        q(`select id, titre, theme, description, intervenante, debut, duree_min, zoom_url, replay_ressource_id, acces from public.bilan_evenements where actif and debut >= $1 order by debut limit 3`, [depuis]),
        ctx.memberId ? q(`select evenement_id from public.bilan_inscriptions where member_id = $1`, [ctx.memberId]) : { rows: [] },
      ]);
      const accessible = (acces) => aLeDroit(ctx.profil.droits, droitPour(acces));
      return {
        // Le fichier passe par /api/ressources/:id/fichier, qui contrôle le droit avant de rediriger
        ressources: res.rows.map((r) => {
          const ok = accessible(r.acces);
          // Vidéos et podcasts hébergés ailleurs (YouTube, Vimeo…) : l'adresse est donnée si le membre y a droit, pour l'intégration du lecteur.
          // Fichiers du stockage : toujours via /fichier, qui contrôle le droit.
          const externe = ok && typeof r.url_brute === "string" && /^https:\/\//.test(r.url_brute) && !r.url_brute.includes(".supabase.co/storage/");
          const { url_brute, ...reste } = r;
          return { ...reste, url: externe ? url_brute : `/api/ressources/${encodeURIComponent(r.id)}/fichier`, accessible: ok };
        }),
        evenements: ev.rows.map((e) => ({ ...e, zoom_url: accessible(e.acces) ? e.zoom_url : null, accessible: accessible(e.acces) })),
        inscriptions: ins.rows.map((x) => x.evenement_id),
      };
    }],

    ["POST", /^\/api\/inscriptions\/([^/]+)$/, null, async (ctx, [eid]) => {
      if (!ctx.memberId) throw new ErreurMetier(403, "rattachement_necessaire", "Votre compte doit d'abord être rattaché.");
      if (!estUuid(eid)) throw introuvable();
      const { rows: [e] } = await q(`select acces from public.bilan_evenements where id = $1 and actif`, [eid]);
      if (!e) throw introuvable();
      if (!aLeDroit(ctx.profil.droits, droitPour(e.acces))) throw new ErreurMetier(403, "droit_insuffisant", "Cet événement n'est pas inclus dans votre formule.");
      await q(`insert into public.bilan_inscriptions (evenement_id, member_id) values ($1, $2) on conflict do nothing`, [eid, ctx.memberId]);
      return { ok: true };
    }],

    ["DELETE", /^\/api\/inscriptions\/([^/]+)$/, null, async (ctx, [eid]) => {
      if (!ctx.memberId || !estUuid(eid)) throw introuvable();
      await q(`delete from public.bilan_inscriptions where evenement_id = $1 and member_id = $2`, [eid, ctx.memberId]);
      return { ok: true };
    }],
  ];
}

// Fichier d'une ressource : droit vérifié côté serveur, puis redirection vers le fichier.
// Tant que le bucket « ressources » est public, ce contrôle n'empêche pas l'accès direct à l'URL publique
// (voir docs/ressources-privees.md pour la migration vers un stockage privé et des URL signées).
export async function fichierRessource({ pool }, ctx, id) {
  if (!estIdCatalogue(id)) throw introuvable();
  const { rows: [r] } = await pool.query(`select url, acces from public.bilan_ressources where id = $1 and actif`, [id]);
  if (!r) throw introuvable();
  if (!aLeDroit(ctx.profil.droits, droitPour(r.acces))) throw new ErreurMetier(403, "droit_insuffisant", "Cette ressource n'est pas incluse dans votre formule.");
  let u;
  try { u = new URL(r.url); } catch { throw introuvable(); }
  if (u.protocol !== "https:") throw introuvable();
  return u.toString();
}
