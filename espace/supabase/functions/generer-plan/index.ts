// Edge Function : generer-plan
// Applique le moteur de règles aux réponses du bilan, enregistre le plan de route
// et demande à Claude une restitution personnalisée (texte seulement : l'IA ne décide pas des priorités).
// Entrée : POST { bilan_id: string }  (Authorization: Bearer <jeton opaque MPB, transmis par le serveur de l'outil>)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { authentifierMembre, lireCorps } from "./mpb_auth.ts";
import {
  calculerEtats, construirePlan, estApplicable, lireContexte, NOMS_PARCOURS, VERSION_REGLES,
  type Mission, type Option, type Question, type Reponse,
} from "../_shared/regles.ts";

// Pas de CORS : les navigateurs n'appellent plus les fonctions, seul le serveur de l'outil le fait.
const CORS = { "Cache-Control": "no-store" };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  // Session Pro vérifiée AVANT tout traitement ; le membre vient de la correspondance privée, jamais du corps
  const mpb = await authentifierMembre(req, "analysis");
  if (mpb instanceof Response) return mpb;
  const user = { id: mpb.memberId };
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const corps = await lireCorps(req, 1_000_000);
  if (corps instanceof Response) return corps;
  const bilan_id = typeof corps.bilan_id === "string" ? corps.bilan_id : "";
  const { data: bilan } = await admin.from("bilan_bilans").select("*").eq("id", bilan_id).single();
  if (!bilan || bilan.member_id !== user.id) return json({ error: "Bilan introuvable" }, 404);
  // Quota : 30 générations de plan par membre sur 30 jours (appel coûteux, ouvert à tous les comptes)
  const depuisQuota = new Date(Date.now() - 30 * 864e5).toISOString();
  const { count: nbPlans } = await admin.from("bilan_agent_appels").select("id", { count: "exact", head: true }).eq("member_id", user.id).eq("agent", "plan").gte("created_at", depuisQuota);
  if ((nbPlans || 0) >= 30) return json({ error: "Vous avez atteint la limite de 30 analyses rédigées ce mois-ci." }, 429);
  await admin.from("bilan_agent_appels").insert({ member_id: user.id, agent: "plan" });

  const [{ data: qs }, { data: opts }, { data: ms }, { data: reps }, { data: constats }] = await Promise.all([
    admin.from("bilan_questions").select("id, kind, parcours, texte, dimension, condition").eq("active", true),
    admin.from("bilan_question_options").select("question_id, code, libelle, points, mission_id, condition, gravite"),
    admin.from("bilan_missions").select("id, question_id, parcours, titre, duree_min, methode, critere_fin, prerequis, declenche_sur"),
    admin.from("bilan_reponses").select("question_id, valeur, texte_libre, source").eq("bilan_id", bilan.id),
    admin.from("bilan_constats").select("question_id, proposition, constat, preuve, source_url, statut, created_at").eq("bilan_id", bilan.id).order("created_at", { ascending: false }),
  ]);
  const { data: analyses } = await admin.from("bilan_analyses").select("url, statut, erreur, pages, created_at").eq("bilan_id", bilan.id).order("created_at", { ascending: false });
  const questions = (qs || []) as Question[];
  const options = (opts || []) as Option[];
  const missions = (ms || []) as (Mission & { methode: string; critere_fin: string })[];
  const rep = new Map<string, Reponse>((reps || []).map((r: any) => [r.question_id, r]));

  // Les constats de l'analyse valent réponse tant que le photographe n'a pas répondu lui-même
  const vus = new Set<string>();
  const derniersConstats = (constats || []).filter((c: any) => !vus.has(c.question_id) && vus.add(c.question_id));
  for (const c of derniersConstats) {
    const r = rep.get(c.question_id);
    if (!r || r.valeur[0] === "SKIP") rep.set(c.question_id, { question_id: c.question_id, valeur: [c.proposition] });
  }

  const ctx = lireContexte(rep);
  const etats = calculerEtats(questions, options, ctx, rep);
  const plan = construirePlan(questions, missions, ctx, rep, options);

  const qById = new Map(questions.map((q) => [q.id, q]));
  const libelle = (qid: string) => {
    const code = rep.get(qid)?.valeur[0];
    if (code === "U") return "Je ne sais pas";
    return options.find((o) => o.question_id === qid && o.code === code)?.libelle || code || "";
  };
  const mById = new Map(missions.map((m) => [m.id, m]));
  const top = plan.slice(0, 3).map((p) => ({
    mission: mById.get(p.mission_id)!.titre, duree: p.duree, niveau: p.niveau, verification: p.verification,
    raisons: p.raisons.map((r) => `${qById.get(r)?.texte} -> « ${libelle(r)} »`),
  }));

  // Analyse détaillée rédigée par notre studio de création (si la clé est disponible) : synthèse + forces et pistes par parcours
  const declare = new Map((reps || []).filter((r: any) => r.valeur?.[0] && r.valeur[0] !== "SKIP").map((r: any) => [r.question_id, r]));
  const constatPar = new Map(derniersConstats.map((c: any) => [c.question_id, c]));
  const NIV: Record<string, string> = { A: "en place", B: "partiel", C: "absent", U: "non vérifiable ou inconnu" };
  const criteresTxt = ["F", "G", "S", "R", "N"].map((p) => {
    const l = questions.filter((q) => q.parcours === p && q.kind !== "contexte" && estApplicable(q, ctx, rep) && rep.has(q.id)).map((q) => {
      const code = rep.get(q.id)!.valeur[0]; const c: any = constatPar.get(q.id);
      // Le constat du studio de création est toujours transmis quand il existe : c'est ce qui rend l'analyse précise
      const detail = c
        ? `constat de l'analyse : ${c.constat}${c.preuve ? ` (extrait : « ${c.preuve} »)` : ""}${declare.has(q.id) ? ` ; réponse retenue : « ${libelle(q.id)} »` : ""}`
        : `réponse : « ${libelle(q.id)} »`;
      if (q.kind === "info") return `- [information] ${q.texte} -> « ${libelle(q.id)} »`;
      return `- [${NIV[code] || code}] ${q.texte} -> ${detail}`;
    });
    return l.length ? `### ${NOMS_PARCOURS[p]} (${p}) : ${etats.find((e) => e.parcours === p)?.niveau || ""}\n${l.join("\n")}` : "";
  }).filter(Boolean).join("\n\n");

  const NOMS_SUPPORTS: Record<string, string> = { instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", pinterest: "Pinterest", linkedin: "LinkedIn", google: "Google (fiche Maps)", site: "Référencement du site", mpb: "Mon Photographe Bébé", bao: "Bouche-à-oreille" };
  const p09 = (rep.get("P09")?.texte_libre || {}) as Record<string, unknown>;
  const autoEval = Object.entries(NOMS_SUPPORTS).filter(([k]) => p09[k] !== undefined).map(([k, n]) => `${n} : ${p09[k] === "absent" ? "absente" : p09[k] + "/10"}`).join(" ; ");

  const p10v = rep.get("P10")?.valeur || []; const p10x = (rep.get("P10")?.texte_libre || {}) as Record<string, string>;
  const NOMS_PUB: Record<string, string> = { "google-ads": "Google Ads", meta: "publicité Meta (Facebook, Instagram)", autre: `autre (${p10x.autre || "non précisée"})` };
  const MESURE: Record<string, string> = { oui: "elle sait ce que la publicité lui rapporte", approx: "elle le sait à peu près", non: "elle ne mesure pas ce qu'elle lui rapporte" };
  const pubTxt = !p10v.length ? "non renseignée" : p10v.includes("aucune") ? "aucune publicité payante"
    : `${p10v.map((c) => NOMS_PUB[c] || c).join(", ")} ; budget mensuel : ${(p10x.budget || "non précisé").replace("<", "moins de ").replace(">", "plus de ")} € ; ${MESURE[p10x.mesure] || "mesure non précisée"}`;

  // Pages réellement lues par notre studio de création (dernière analyse réussie de chaque adresse)
  const vuesUrl = new Set<string>();
  const lectures = (analyses || []).filter((a: any) => !vuesUrl.has(a.url) && vuesUrl.add(a.url));
  const pagesTxt = lectures.map((a: any) => a.statut === "termine"
    ? `- ${a.url} : ${(a.pages || []).length} pages lues${(a.pages || []).length ? "\n" + (a.pages || []).map((pg: any) => `  · ${pg.titre || "(sans titre)"} (${pg.url})`).join("\n") : ""}`
    : `- ${a.url} : non lue (${a.erreur || a.statut})`).join("\n");

  let restitution: string | null = null;
  let analyseDetaillee: any = null;
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (apiKey && criteresTxt) {
    const prompt = `Vous êtes l'outil d'analyse de Mon Photographe Bébé. Rédigez l'analyse complète du bilan visibilité d'une photographe qui accompagne les familles de la grossesse aux 3 ans de l'enfant (grossesse, naissance, bébé, enfant, famille), à partir de TOUS les critères ci-dessous : ses réponses et ce que l'analyse de son site et de sa fiche a constaté.

Contraintes :
- Écriture neutre : on ne sait pas si la personne photographe est une femme ou un homme. Vouvoiement sans aucun accord au féminin ni au masculin qui la concerne (reformulez : « tout est prêt » plutôt que « vous êtes prête ») ; parlez des parents ou des familles, pas seulement des mères ; pas de point médian.
- Vouvoiement, ton chaleureux, direct et professionnel. Jamais de tiret long : utilisez une virgule ou deux-points.
- Pour parler de la clientèle de la photographe, écrivez « clients » et non « clientes ». Ne supposez pas qu'elle vend en visionnage : elle peut aussi livrer en galerie en ligne.
- Public : les photographes accompagnent les familles de la grossesse jusqu'aux 3 ans de l'enfant (grossesse, naissance, bébé, enfant, famille). Parlez des « parents », des « futurs parents » ou des « familles », pas seulement d'« une maman », et ne prenez pas toujours l'exemple du nouveau-né : choisissez l'exemple qui correspond aux spécialités de la photographe.
- Appuyez-vous UNIQUEMENT sur les critères listés. N'inventez rien, ne promettez aucun résultat chiffré.
- synthese : 180 à 260 mots, 3 courts paragraphes séparés par une ligne vide, sans titre ni liste. 1) Ce qui est solide, avec des détails concrets. 2) Les 2 ou 3 leviers prioritaires, dans l'ordre des priorités fournies, et pourquoi ils comptent pour les parents qui cherchent une photographe. 3) Comment avancer avec le temps disponible (${ctx.temps === "variable" ? "temps variable, une étape de 15 minutes à la fois" : ctx.temps + " minutes par semaine"}).
- parcours : un élément par parcours listé. bilan = 2 phrases qui situent ce parcours. forces = 1 à 4 points forts réels (critères en place), formulés concrètement. pistes = les améliorations, de la plus importante à la moins importante (3 au maximum), chacune avec un titre court, le pourquoi (l'effet pour les parents ou pour Google) et le comment (une action concrète et précise, adaptée à ce qui a été constaté). Un critère non vérifiable devient une piste « à vérifier ».
- Les questions F concernent la fiche du photographe sur l'annuaire Mon Photographe Bébé ; les questions S et G concernent son propre site.
- Site : pour les parcours S et G, appuyez-vous d'abord sur les constats de l'analyse et sur les pages lues. Citez des éléments précis observés (titres de pages, contenus, pages manquantes) plutôt que de reformuler les réponses. Le bilan du parcours S commence par dire combien de pages ont été lues. Si un constat et une réponse se contredisent, signalez-le.
- Parcours G « Être trouvé sur Google et dans les IA » : il couvre deux terrains, à nommer clairement tous les deux dans son bilan. 1) Être trouvé sur le moteur de recherche Google : résultats classiques, fiche Google et carte, avis, pages du site. 2) Être cité dans les réponses des IA (ChatGPT, Gemini, Perplexity, mode IA de Google) : mentions sur d'autres sites, informations identiques partout, contenus qui répondent aux questions des parents. Si un des deux terrains n'a pas de critère, dites-le simplement sans rien inventer.
- Fiche : si la fiche n'a pas pu être lue, dites-le simplement dans le bilan du parcours F et basez-vous sur les réponses.
- Quand l'auto-évaluation de la photographe diffère nettement de ce que montrent les critères (par exemple 8/10 sur Google alors que sa fiche est incomplète, ou 3/10 alors que l'essentiel est en place), dites-le avec tact dans le bilan du parcours concerné.
- Publicité payante : si la photographe en fait sans mesurer ce qu'elle rapporte, ou si sa fiche et son site ne sont pas prêts à transformer ce trafic (contact, tarifs, avis), dites-le avec tact et indiquez quoi corriger avant d'augmenter le budget. N'en recommandez jamais sans que les bases soient en place.

Objectif choisi : ${ctx.objectif}
Auto-évaluation de la photographe, sur 10 : ${autoEval || "non renseignée"}
Publicité payante : ${pubTxt}
Priorités du plan (décidées par les règles, à respecter) :
${top.map((t, i) => `${i + 1}. ${t.mission} (${t.duree} min)${t.niveau === 4 ? " [mission « aller plus loin » : la base est déjà en place]" : ""} - parce que : ${t.raisons.join(" / ")}`).join("\n")}

=== PAGES LUES PAR L'OUTIL D'ANALYSE ===
${pagesTxt || "(aucune lecture)"}

=== CRITÈRES PAR PARCOURS ===
${criteresTxt}

Enregistrez l'analyse avec l'outil enregistrer_analyse.`;
    const schema = {
      type: "object",
      properties: {
        synthese: { type: "string" },
        parcours: { type: "array", items: { type: "object", properties: {
          parcours: { type: "string", enum: ["F", "G", "S", "R", "N"] },
          bilan: { type: "string" },
          forces: { type: "array", items: { type: "string" } },
          pistes: { type: "array", items: { type: "object", properties: { titre: { type: "string" }, pourquoi: { type: "string" }, comment: { type: "string" } }, required: ["titre", "pourquoi", "comment"] } },
        }, required: ["parcours", "bilan", "forces", "pistes"] } },
      },
      required: ["synthese", "parcours"],
    };
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({
          model: Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-5-5", max_tokens: 12000,
          tools: [{ name: "enregistrer_analyse", description: "Enregistre l'analyse détaillée du bilan.", input_schema: schema }],
          tool_choice: { type: "auto" },
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const out = await res.json();
      if (res.ok) {
        let a: any = (out.content || []).find((c: any) => c.type === "tool_use")?.input ?? null;
        if (!a) { const raw = (out.content || []).map((c: any) => c.text || "").join(""); const m = raw.match(/\{[\s\S]*\}/); try { a = m ? JSON.parse(m[0]) : null; } catch { a = null; } }
        if (a) {
          a = JSON.parse(JSON.stringify(a).replace(/\u2014/g, "-"));
          restitution = String(a.synthese || "").trim() || null;
          analyseDetaillee = Array.isArray(a.parcours) ? a.parcours : null;
        }
      }
    } catch (_e) { /* l'analyse rédigée est facultative : le plan reste valide */ }
  }

  const { data: saved, error } = await admin.from("bilan_plans").insert({
    bilan_id: bilan.id, version_regles: VERSION_REGLES, etats, restitution, analyse_detaillee: analyseDetaillee, temps_hebdo: ctx.temps,
  }).select("id").single();
  if (error) return json({ error: error.message }, 500);
  if (plan.length) {
    await admin.from("bilan_plan_missions").insert(plan.map((p, i) => ({
      plan_id: saved.id, mission_id: p.mission_id, ordre: i + 1, niveau: p.niveau, raisons: p.raisons,
    })));
  }
  const restant = questions.filter((q) => q.kind !== "contexte" && estApplicable(q, ctx, rep) && !rep.has(q.id)).length;
  await admin.from("bilan_bilans").update({ statut: restant ? "en_cours" : "termine", updated_at: new Date().toISOString() }).eq("id", bilan.id);

  return json({
    plan_id: saved.id, etats, restitution, analyse_detaillee: analyseDetaillee,
    criteres: derniersConstats.map((c: any) => ({
      question_id: c.question_id, parcours: qById.get(c.question_id)?.parcours, question: qById.get(c.question_id)?.texte,
      proposition: c.proposition, constat: c.constat, preuve: c.preuve, source_url: c.source_url,
      reponse_membre: (reps || []).find((r: any) => r.question_id === c.question_id && r.valeur[0] !== "SKIP")?.valeur[0] || null,
    })),
    restant,
    missions: plan.map((p, i) => {
      const m = mById.get(p.mission_id)!;
      return { ordre: i + 1, id: m.id, parcours: m.parcours, titre: m.titre, duree_min: p.duree, niveau: p.niveau, verification: p.verification, methode: m.methode, critere_fin: m.critere_fin, raisons: p.raisons.map((r) => ({ question: qById.get(r)?.texte, reponse: libelle(r) })) };
    }),
  });
});
