// Moteur de règles du bilan visibilité - version "2026-10-v3" (cases à cocher reliées à leurs missions dans la base)
// Traduit fidèlement le document « Questionnaire et plan de route visibilité » (16/10/2026).
// Aucune IA ici : tout est déterministe, testable et explicable.

export const VERSION_REGLES = "2026-10-v3";

/** Missions « Aller plus loin » : identifiant en ME, proposées quand la pratique est déjà en place */
export const estExperte = (id: string) => id.startsWith("ME");

export type Question = { id: string; kind: string; parcours: string | null; texte: string; dimension: string | null; condition: string | null };
/** Une case d'une liste à cocher peut porter sa mission : proposée quand la case n'est pas cochée.
 *  condition (même syntaxe que bilan_questions.condition) et gravite (C avant B) sont facultatives. */
export type Option = { question_id: string; code: string; libelle: string; points: number | null; mission_id?: string | null; condition?: string | null; gravite?: string | null };
export type Mission = { id: string; question_id: string | null; parcours: string | null; titre: string; duree_min: number; prerequis: string[]; declenche_sur: string[] };
export type Reponse = { question_id: string; valeur: string[]; texte_libre?: Record<string, unknown> | null };

export type Contexte = {
  specialites: string[]; hasFiche: boolean; hasSite: boolean; hasSocial: boolean; hasGoogleDeclared: boolean; hasClients: boolean;
  sources: string[]; objectif: string; temps: string; p08: Record<string, string>;
};

const PARCOURS = ["F", "G", "S", "R", "N"] as const;
const SUIVI_GROUP = ["S12", "R12", "N11", "N12", "NW2"];
/** Missions proposées en plus de la mission principale d'une question pratique (réponse B ou C) */
const MISSIONS_SOEURS: Record<string, string[]> = { N09: ["MN17"] };
/** R13 : habitude cochée -> mission proposée quand elle manque */
export const R13_MISSIONS: Record<string, string> = { c1: "MR13", c2: "MR14", c3: "MR15", c4: "MR16", c5: "MR17", c6: "MR18" };
/** G22 : visibilité dans les assistants IA, pratique cochée -> mission proposée quand elle manque (c4 seulement avec un site) */
export const G22_MISSIONS: Record<string, string> = { c1: "MG21", c2: "MG22", c3: "MG22", c4: "MG23" };
/** Liens case -> mission historiques, utilisés seulement si la base ne les porte pas (bilan_question_options.mission_id). */
const LIENS_HISTORIQUES: Record<string, Option[]> = {
  R13: Object.entries(R13_MISSIONS).map(([code, mission_id]) => ({ question_id: "R13", code, libelle: "", points: null, mission_id, gravite: "B" })),
  G22: Object.entries(G22_MISSIONS).map(([code, mission_id]) => ({ question_id: "G22", code, libelle: "", points: null, mission_id, gravite: code === "c1" ? "C" : "B", condition: code === "c4" ? "site" : null })),
};

export function lireContexte(rep: Map<string, Reponse>): Contexte {
  const v = (id: string) => rep.get(id)?.valeur || [];
  const extra = (id: string) => (rep.get(id)?.texte_libre || {}) as Record<string, unknown>;
  return {
    specialites: v("P01"),
    hasFiche: !!(extra("P04").fiche_url),
    hasSite: v("P04").includes("site"),
    hasSocial: v("P04").includes("social"),
    hasGoogleDeclared: v("P04").includes("google"),
    hasClients: extra("P03").a_des_clients !== false,
    sources: v("P05"),
    objectif: v("P06")[0] || "plus-demandes",
    temps: v("P07")[0] || "30",
    p08: (extra("P08") as Record<string, string>) || {},
  };
}

/** La question est-elle présentée à ce membre ? */
export function estApplicable(q: Question, ctx: Contexte, rep: Map<string, Reponse>): boolean {
  if (q.kind === "contexte") return true;
  if (q.kind === "branche") {
    if (q.id === "SW1") return !ctx.hasSite;
    if (q.id === "SW2") return !ctx.hasSite && !["plus-tard", "pas-strategie"].includes(ctx.p08.site || "");
    if (q.id.startsWith("RW")) return !ctx.hasSocial && ctx.p08.social !== "pas-strategie";
    if (q.id.startsWith("NW")) return !ctx.hasClients;
    return false;
  }
  return conditionRemplie(q.condition, ctx, rep);
}

/** Condition texte (« site », « G01 et clients », « site et wordpress »...) remplie pour ce membre ? */
export function conditionRemplie(condition: string | null | undefined, ctx: Contexte, rep: Map<string, Reponse>): boolean {
  const g01v = rep.get("G01")?.valeur || [];
  const ficheGoogle = g01v.some((x) => /^c[1-9]$/.test(x)) || (["A", "B"].includes(g01v[0]) && !g01v.includes("c0"));
  const cond = (condition || "aucun").toLowerCase();
  if (cond.includes("fiche") && !ctx.hasFiche) return false;
  if (cond.includes("site") && !ctx.hasSite) return false;
  if (cond.includes("social") && !ctx.hasSocial) return false;
  if (cond.includes("clients") && !ctx.hasClients) return false;
  if (cond.includes("plusieurs prestations") && ctx.specialites.length < 2) return false;
  if (/\bg01\b/.test(cond) && !ficheGoogle) return false;
  if (cond.includes("wordpress") && !(rep.get("G19")?.valeur || []).includes("wordpress")) return false;
  return true;
}

export type EtatParcours = {
  parcours: string; niveau: string; score: number | null; connues: number; applicables: number;
  appuis: string[]; pistes: string[]; verifications: string[];
};

// Variantes d'une réponse « en place » (A2, A3...) : même valeur que A pour les règles, libellé propre à l'affichage.
export function normaliserReponses(rep: Map<string, Reponse>): Map<string, Reponse> {
  let change = false;
  const n = new Map<string, Reponse>();
  for (const [k, r] of rep) {
    const v = r?.valeur?.[0];
    if (v && /^A\d+$/.test(v)) { change = true; n.set(k, { ...r, valeur: ["A", ...r.valeur.slice(1)] }); } else n.set(k, r);
  }
  return change ? n : rep;
}

export function calculerEtats(questions: Question[], options: Option[], ctx: Contexte, rep: Map<string, Reponse>): EtatParcours[] {
  rep = normaliserReponses(rep);
  const pts = new Map(options.filter((o) => o.points !== null).map((o) => [`${o.question_id}:${o.code}`, o.points!]));
  return PARCOURS.map((p) => {
    const outilAbsent = (p === "S" && !ctx.hasSite) || (p === "R" && !ctx.hasSocial);
    const app = questions.filter((q) => q.kind === "pratique" && q.parcours === p && estApplicable(q, ctx, rep));
    const conn = app.filter((q) => ["A", "B", "C"].includes(rep.get(q.id)?.valeur[0] || ""));
    const appuis = conn.filter((q) => rep.get(q.id)!.valeur[0] === "A").map((q) => q.id);
    const pistes = conn.filter((q) => rep.get(q.id)!.valeur[0] !== "A").map((q) => q.id);
    const verifications = app.filter((q) => rep.get(q.id)?.valeur[0] === "U").map((q) => q.id);
    if (outilAbsent) {
      const outil = p === "S" ? ctx.p08.site : ctx.p08.social;
      return { parcours: p, niveau: outil === "maintenant" ? "À construire" : "Non prioritaire dans votre stratégie", score: null, connues: 0, applicables: 0, appuis, pistes, verifications };
    }
    if (app.length < 3) return { parcours: p, niveau: "Point de départ", score: null, connues: conn.length, applicables: app.length, appuis, pistes, verifications };
    const score = conn.length ? Math.round((100 * conn.reduce((s, q) => s + (pts.get(`${q.id}:${rep.get(q.id)!.valeur[0]}`) ?? 0), 0)) / (2 * conn.length)) : null;
    let niveau = "À préciser";
    if (conn.length >= 3 && conn.length / app.length >= 0.6 && score !== null) {
      niveau = score < 40 ? "À construire" : score < 75 ? "À compléter" : "Bien en place";
    }
    return { parcours: p, niveau, score, connues: conn.length, applicables: app.length, appuis, pistes, verifications };
  });
}

export type MissionPlan = { mission_id: string; niveau: number; raisons: string[]; gravite: number; duree: number; verification: boolean };

const OBJECTIF_QUESTIONS: Record<string, string[]> = {
  "lancement": ["S01", "S02", "S10", "S11", "R01", "R02", "R03", "SW1", "SW2", "RW1", "RW2", "N01", "N02"],
  "plus-reservations": ["S03", "S04", "S07", "S10", "S11", "R09", "S12", "R12", "N11"],
  "specialite": ["S03", "S05", "R06", "G08"],
  "nouvelle-zone": ["S02", "R02", "G02", "N01"],
};
const SOURCE_PARCOURS: Record<string, string> = { google: "G", reseaux: "R", recommandations: "N", partenaires: "N" };

export function construirePlan(questions: Question[], missions: Mission[], ctx: Contexte, rep: Map<string, Reponse>, options: Option[] = []): MissionPlan[] {
  rep = normaliserReponses(rep);
  const liens = new Map<string, Option[]>();
  for (const o of options) if (o.mission_id) liens.set(o.question_id, [...(liens.get(o.question_id) || []), o]);
  const mById = new Map(missions.map((m) => [m.id, m]));
  const cand = new Map<string, MissionPlan>();
  const add = (mid: string, qid: string, code: string) => {
    const m = mById.get(mid); if (!m) return;
    const gravite = code === "C" ? 0 : code === "B" ? 1 : 2; // C avant B avant vérification U
    const ex = cand.get(mid);
    if (ex) { if (!ex.raisons.includes(qid)) ex.raisons.push(qid); ex.gravite = Math.min(ex.gravite, gravite); return; }
    cand.set(mid, { mission_id: mid, niveau: 3, raisons: [qid], gravite, duree: code === "U" ? 10 : m.duree_min, verification: code === "U" });
  };

  for (const q of questions) {
    if (!estApplicable(q, ctx, rep)) continue;
    const code = rep.get(q.id)?.valeur[0];
    // Listes à cocher dont les cases portent leur mission : une mission par case non cochée (toutes si « aucun » c0).
    // Les liens viennent de la base ; R13 et G22 gardent leurs liens historiques si la base ne les porte pas.
    const lo = liens.get(q.id) || LIENS_HISTORIQUES[q.id];
    if (lo && code && code !== "SKIP") {
      const v = rep.get(q.id)!.valeur.slice(1);
      for (const o of lo) {
        if (!o.mission_id || (o.condition && !conditionRemplie(o.condition, ctx, rep))) continue;
        if (v.includes("c0") || !v.includes(o.code)) add(o.mission_id, q.id, v.includes("c0") ? "C" : (o.gravite === "C" ? "C" : "B"));
      }
      continue;
    }
    if (!code || code === "SKIP" || (code === "A" && q.kind === "pratique")) continue;
    // G01 en liste à cocher : une mission selon ce qui manque sur la fiche Google
    if (q.id === "G01" && (rep.get("G01")?.valeur || []).some((x) => /^c\d$/.test(x))) {
      const v = rep.get("G01")!.valeur.slice(1);
      if (v.includes("c0") || !v.includes("c1")) { add("MG01", "G01", "C"); continue; }
      const manque = (codes: string[]) => codes.filter((c) => !v.includes(c)).length;
      if (manque(["c2", "c3", "c4", "c5", "c6", "c7"])) add("MG02", "G01", manque(["c2", "c3", "c4", "c5", "c6", "c7"]) >= 3 ? "C" : "B");
      if (!v.includes("c8")) add("MG03", "G01", "C");
      if (!v.includes("c9")) add("MG04", "G01", "B");
      continue;
    }
    if (q.kind === "pratique") {
      // Mission principale : celle qui porte le code de la question (M + id), sinon la première rattachée
      const mid = SUIVI_GROUP.includes(q.id) ? "M-SUIVI" : (missions.find((m) => m.id === "M" + q.id) || missions.find((m) => m.question_id === q.id && !estExperte(m.id) && !m.id.startsWith("MC")))?.id;
      if (mid) add(mid, q.id, code);
      // Missions sœurs proposées en plus de la principale
      for (const sid of MISSIONS_SOEURS[q.id] || []) if (["B", "C"].includes(code) && missions.some((m) => m.id === sid)) add(sid, q.id, code);
      // Missions complémentaires « communication » (MC) liées à la même question
      for (const m of missions.filter((m) => m.id.startsWith("MC") && m.question_id === q.id && (m.declenche_sur || []).includes(code))) add(m.id, q.id, code);
    } else if (q.kind === "branche") {
      for (const m of missions.filter((m) => m.question_id === q.id && !estExperte(m.id) && !m.id.startsWith("MC"))) {
        if (m.declenche_sur.includes(code)) add(m.id, q.id, ["B", "C"].includes(code) ? code : "B");
      }
      if (q.id === "NW2" && ["B", "C"].includes(code)) add("M-SUIVI", q.id, code);
    }
  }

  // Regroupement G10 + S07
  if (cand.has("MG10") && cand.has("MS07")) {
    const a = cand.get("MG10")!, b = cand.get("MS07")!;
    cand.delete("MG10"); cand.delete("MS07");
    cand.set("M-REPONSES", { mission_id: "M-REPONSES", niveau: 3, raisons: [...a.raisons, ...b.raisons], gravite: Math.min(a.gravite, b.gravite), duree: 30, verification: false });
  }

  // Regroupement G13 + N07 : la demande d'avis à la livraison fait partie du message d'après livraison (MN07)
  if (cand.has("MG13") && cand.has("MN07")) {
    const a = cand.get("MG13")!, b = cand.get("MN07")!;
    cand.delete("MG13");
    b.raisons = [...b.raisons, ...a.raisons];
    b.gravite = Math.min(a.gravite, b.gravite);
  }

  // Niveau 0 : contact
  const s11 = rep.get("S11")?.valeur[0], r03 = rep.get("R03")?.valeur[0];
  if (cand.has("MS11") && ["B", "C", "U"].includes(s11 || "")) cand.get("MS11")!.niveau = 0;
  if (cand.has("MR03") && r03 === "C") cand.get("MR03")!.niveau = 0;

  // Fiche Mon Photographe Bébé : levier direct de la plateforme, juste après le contact
  for (const c of cand.values()) if (c.niveau !== 0 && mById.get(c.mission_id)?.parcours === "F") c.niveau = 1;

  // Niveau 2 : objectif
  const objQ = new Set(OBJECTIF_QUESTIONS[ctx.objectif] || []);
  let objParcours = new Set<string>();
  if (ctx.objectif === "plus-demandes") {
    objParcours = new Set(ctx.sources.map((s) => SOURCE_PARCOURS[s]).filter(Boolean));
    if (ctx.p08.site === "maintenant") objParcours.add("S");
    if (ctx.p08.social === "maintenant") objParcours.add("R");
    if (!objParcours.size) objParcours = new Set(["G"]);
  }
  for (const c of cand.values()) {
    if (c.niveau <= 1) continue;
    const m = mById.get(c.mission_id)!;
    if (c.raisons.some((r) => objQ.has(r)) || (m.parcours && objParcours.has(m.parcours))) c.niveau = 2;
  }

  // Niveau 1 : prérequis d'une mission retenue (non satisfait par une réponse A)
  const satisfait = (mid: string) => { const q = mById.get(mid)?.question_id; return q ? rep.get(q)?.valeur[0] === "A" : false; };
  for (const c of [...cand.values()]) {
    for (const pre of mById.get(c.mission_id)?.prerequis || []) {
      if (satisfait(pre)) continue;
      const p = cand.get(pre);
      if (p && p.niveau > 1) p.niveau = 1;
    }
  }

  // Niveau 4 : missions « Aller plus loin », pour ce qui est déjà en place (réponse A) ou selon l'ancienneté (P03).
  // Elles viennent après toutes les autres ; celles qui servent l'objectif passent en premier.
  const MAX_EXPERTES = 12;
  const expertes: MissionPlan[] = [];
  for (const m of missions.filter((m) => estExperte(m.id) && m.question_id)) {
    const q = questions.find((x) => x.id === m.question_id);
    if (!q || !estApplicable(q, ctx, rep)) continue;
    const v = rep.get(q.id)?.valeur || [];
    if (!m.declenche_sur.some((c) => v.includes(c))) continue;
    const sertObjectif = (m.parcours && objParcours.has(m.parcours)) || objQ.has(q.id);
    expertes.push({ mission_id: m.id, niveau: 4, raisons: [q.id], gravite: sertObjectif ? 0 : 1, duree: m.duree_min, verification: false });
  }
  // Variété : on prend les missions expertes à tour de rôle dans chaque famille (celles qui servent l'objectif d'abord).
  expertes.sort((a, b) => a.gravite - b.gravite || a.mission_id.localeCompare(b.mission_id));
  const parFam = new Map<string, MissionPlan[]>();
  for (const e of expertes) { const k = mById.get(e.mission_id)?.parcours || "?"; parFam.set(k, [...(parFam.get(k) || []), e]); }
  const tour: MissionPlan[] = [];
  while ([...parFam.values()].some((l) => l.length)) for (const l of parFam.values()) { const e = l.shift(); if (e) tour.push(e); }
  tour.slice(0, MAX_EXPERTES).forEach((e) => cand.set(e.mission_id, e));

  const tri = (a: MissionPlan, b: MissionPlan) => a.niveau - b.niveau || a.gravite - b.gravite || a.duree - b.duree || a.mission_id.localeCompare(b.mission_id);
  const tous = [...cand.values()].sort(tri);
  // En tête : contact (0), fiche et prérequis (1), dans l'ordre de priorité.
  const tete = tous.filter((c) => c.niveau <= 1);
  // Ensuite, on varie les parcours : un tour de chaque famille (Google, site, réseaux, recommandations...),
  // en commençant par celles qui servent l'objectif, pour ne jamais enchaîner toute une famille.
  const files = new Map<string, MissionPlan[]>();
  for (const c of tous.filter((c) => c.niveau === 2 || c.niveau === 3)) {
    const k = mById.get(c.mission_id)?.parcours || "?";
    files.set(k, [...(files.get(k) || []), c]);
  }
  // Au plus 7 missions par famille dans le programme (en comptant celles déjà placées en tête) : les suivantes viendront au prochain bilan.
  const MAX_PAR_FAMILLE = 7;
  for (const [k, l] of files) files.set(k, l.slice(0, Math.max(0, MAX_PAR_FAMILLE - tete.filter((c) => mById.get(c.mission_id)?.parcours === k).length)));
  const familles = [...files.keys()].filter((k) => files.get(k)!.length).sort((x, y) => tri(files.get(x)![0], files.get(y)![0]));
  const melange: MissionPlan[] = [];
  while (familles.some((k) => files.get(k)!.length)) for (const k of familles) { const c = files.get(k)!.shift(); if (c) melange.push(c); }
  // Les missions « Aller plus loin » s'intercalent régulièrement, réparties sur tout le programme, plutôt que tout à la fin.
  const exp = tous.filter((c) => c.niveau >= 4);
  const pas = exp.length ? Math.max(2, Math.round(melange.length / (exp.length + 1))) : 0;
  const ordre: MissionPlan[] = [...tete];
  melange.forEach((c, i) => { ordre.push(c); if (pas && (i + 1) % pas === 0 && exp.length) ordre.push(exp.shift()!); });
  ordre.push(...exp);

  // Respect des prérequis dans l'ordre final
  const placed: MissionPlan[] = []; const seen = new Set<string>();
  const place = (c: MissionPlan) => {
    if (seen.has(c.mission_id)) return; seen.add(c.mission_id);
    for (const pre of mById.get(c.mission_id)?.prerequis || []) { const p = cand.get(pre); if (p && !satisfait(pre)) place(p); }
    placed.push(c);
  };
  ordre.forEach(place);
  return placed;
}

export const NOMS_PARCOURS: Record<string, string> = {
  F: "Ma fiche Mon Photographe Bébé", G: "Être trouvé sur Google et dans les IA", S: "Faire réserver depuis son site", R: "Communiquer sur les réseaux sociaux", N: "Développer son réseau et les recommandations",
};
