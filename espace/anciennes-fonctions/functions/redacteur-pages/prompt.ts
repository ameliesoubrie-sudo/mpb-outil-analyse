// Prompt du rédacteur de pages : carte d'identité, persona choisi, format, brief et pages lues sur son site.
// Fonction pure, testable sans réseau.
import { FORMATS } from "./formats.ts";
import { blocHistoire, blocPratique } from "./questions.ts";

export type Persona = {
  specialite?: string; prenom?: string; portrait?: string; cherche?: string[]; freins?: string[];
  ce_qui_la_decide?: string[]; ou_la_trouver?: string[]; ses_mots?: string; themes?: string[]; a_eviter?: string;
  rapport_photo?: string; declencheurs?: string[]; ce_quil_regarde?: string[]; valeur?: string[]; occasions?: string[];
};
export type Carte = {
  promesse?: string; piliers?: { titre: string; preuve: string }[]; personas?: Persona[];
  voix?: { adresse?: string; registre?: string; regles?: string[]; mots_a_employer?: string[]; mots_bannis?: string[]; exemple?: string };
  style_images?: { mots?: string[] }; limites?: string[];
};
export type Brief = { sujet?: string; details?: string; offre?: string; periode?: string; ville?: string; consignes?: string };
export type PageLue = { url: string; titre?: string; description?: boolean | string; mots?: number };

export const FORMULES_CREUSES = [
  "immortaliser", "moments magiques", "souvenirs inoubliables", "lumineux et intemporel", "instants précieux",
  "capturer l'essence", "gravé à jamais", "parenthèse enchantée", "bulle de douceur", "moments uniques",
  "n'hésitez pas à", "au cœur de", "véritable écrin",
];

const liste = (t?: string[]) => (t && t.length ? t.map((x) => `  - ${x}`).join("\n") : "  (non renseigné)");

export function decrirePersona(p: Persona): string {
  return [
    `Prénom : ${p.prenom || "(sans prénom)"} · spécialité : ${p.specialite || "?"}`,
    `Portrait : ${p.portrait || "(non renseigné)"}`,
    `Ce que cette personne cherche :\n${liste(p.cherche)}`,
    `Ses inquiétudes avant de réserver :\n${liste(p.freins)}`,
    `Ce qui l'a décidée :\n${liste(p.ce_qui_la_decide)}`,
    `Ses objections ou ses mots, tels quels : ${p.ses_mots ? `« ${p.ses_mots} »` : "(non renseignés)"}`,
    `Thèmes qui lui parlent :\n${liste(p.themes)}`,
    ...(p.rapport_photo ? [`Son rapport à la photo : ${p.rapport_photo}`] : []),
    ...(p.declencheurs?.length ? [`Ce qui déclenche sa recherche :\n${liste(p.declencheurs)}`] : []),
    ...(p.ce_quil_regarde?.length ? [`Ce qu'il regarde avant d'écrire :\n${liste(p.ce_quil_regarde)}`] : []),
    ...(p.valeur?.length ? [`Ce pour quoi il accepte de payer plus :\n${liste(p.valeur)}`] : []),
    ...(p.occasions?.length ? [`Occasions de revenir :\n${liste(p.occasions)}`] : []),
  ].join("\n");
}

export function construirePrompt(o: {
  formatId: string; carte: Carte | null; personas: Persona[]; toutes: boolean; brief: Brief;
  specialites?: string[]; contexte?: string; pages?: PageLue[]; siteUrl?: string | null;
  mission?: { id: string; titre: string; methode?: string } | null;
}): string {
  const f = FORMATS[o.formatId];
  if (!f) throw new Error(`Format inconnu : ${o.formatId}`);
  const c = o.carte || {};
  const v = c.voix || {};
  const bannis = [...(v.mots_bannis || []), ...FORMULES_CREUSES];
  const b = o.brief || {};
  const lignesBrief = [
    b.sujet && `- Sujet : ${b.sujet}`,
    b.details && `- Ce que la photographe a écrit ou dicté (à utiliser en priorité, avec ses mots) : ${b.details}`,
    b.offre && `- Tarifs et offres, tels quels : ${b.offre}`,
    b.periode && `- Période : ${b.periode}`,
    b.ville && `- Ville : ${b.ville}`,
    b.consignes && `- Consignes : ${b.consignes}`,
  ].filter(Boolean).join("\n");
  const pages = (o.pages || []).slice(0, 25).map((p) =>
    `  - ${p.url} · titre actuel : ${p.titre ? `« ${p.titre} »` : "(aucun)"}${p.mots !== undefined ? ` · ${p.mots} mots` : ""}${p.description === false ? " · pas de méta-description" : ""}`).join("\n");
  const blocPersonas = o.personas.length
    ? o.personas.map((p, i) => `### Persona ${o.personas.length > 1 ? i + 1 : ""}\n${decrirePersona(p)}`).join("\n\n")
    : "(Aucun persona renseigné : écrivez pour des futurs ou jeunes parents en général, et signalez dans « questions » qu'elle gagnera à remplir ses personas dans Mon identité.)";

  return `Vous êtes le rédacteur de pages de Mon Photographe Bébé. Vous aidez une photographe professionnelle, qui accompagne les familles de la grossesse aux 3 ans de l'enfant, à écrire les pages de son site et de ses fiches : des textes qui lui ressemblent, qui rassurent les parents et que Google comprend. Vous écrivez avec sa voix, mais vous n'affirmez jamais un fait que vous ne connaissez pas.

=== CE QU'IL FAUT PRODUIRE : ${f.nom} ===
${f.consigne}
${o.mission ? `\nC'est l'outil de la mission « ${o.mission.titre} »${o.mission.methode ? ` : ${o.mission.methode}` : ""}.` : ""}

=== À QUI S'ADRESSENT CES TEXTES ===
${o.toutes && o.personas.length > 1 ? "À l'ensemble de ses personas, par ordre de priorité ci-dessous." : "À ce persona précis : sa situation, ses inquiétudes, ses mots."}

${blocPersonas}

=== QUI EST LA PHOTOGRAPHE ===
Spécialités, par ordre d'importance : ${(o.specialites || []).join(", ") || "(non renseignées)"}
Sa promesse : ${c.promesse || "(non renseignée)"}
Ses piliers et leurs preuves (les seuls faits que vous pouvez affirmer sur elle) :
${(c.piliers || []).map((p) => `  - ${p.titre} : ${p.preuve}`).join("\n") || "  (non renseignés)"}
${blocHistoire(c)}${blocPratique(c)}Ce qu'elle ne promet jamais :
${liste(c.limites)}
${o.contexte ? `Contexte de son activité :\n${o.contexte}\n` : ""}${o.siteUrl ? `Son site : ${o.siteUrl}\n` : ""}${pages ? `Pages lues sur son site par notre outil d'analyse :\n${pages}\n` : ""}
=== SA VOIX ===
- Sur son site, elle s'adresse aux parents en : ${v.adresse || "vous"}
- Registre : ${v.registre || "chaleureux et simple"}
- Règles d'écriture :
${liste(v.regles)}
- Mots qu'elle aime employer : ${(v.mots_a_employer || []).join(", ") || "(non renseignés)"}
- Exemple de sa voix : ${v.exemple ? `« ${v.exemple} »` : "(aucun)"}
- Mots et formules INTERDITS : ${bannis.join(", ")}

=== BRIEF DE LA PHOTOGRAPHE ===
${lignesBrief || "(aucun brief : appuyez-vous sur ses spécialités, ses piliers et les inquiétudes du persona)"}

=== LA MÉTHODE MON PHOTOGRAPHE BÉBÉ POUR UNE PAGE ===
- Un parent arrive de Google sur son téléphone et décide en quelques secondes : la première phrase dit quelle séance, où, et pour qui.
- On écrit avec les mots que les parents tapent (« séance photo grossesse », « photographe bébé », le nom de la ville), naturellement, sans répétition mécanique.
- Une page, une intention : une page par séance, jamais un texte qui mélange tout.
- On montre la réalité de la séance (durée réelle, déroulé, place des parents, petites attentions) plutôt que des adjectifs.
- Une invitation douce et visible à la fin de chaque page : « Vérifier mes disponibilités », « M'écrire », plutôt que « Réserver maintenant ».
- Un texte humain, sensible et personnel : à relire à voix haute avant de publier.

=== RÈGLES IMPÉRATIVES ===
1. Personnalisation : chaque section s'appuie sur un élément du persona ou sur un fait réel de la photographe (pilier, brief). Sinon, supprimez-la.
2. Zéro invention : aucun prix, durée, délai, lieu, formation, chiffre, avis ou anecdote absent ci-dessus. Écrivez [à compléter : ce qu'il faut ajouter] et listez-le dans « a_completer ».
3. Référencement honnête : pas de bourrage de mots-clés, pas de faux avis, pas de « meilleure photographe de … », pas de page ville copiée.
4. Public : futurs et jeunes parents, de la grossesse aux 3 ans ; ne ramenez pas tout au nouveau-né si la séance est autre.
5. Droit à l'image et sécurité : aucun prénom d'enfant, rien qui suggère une pose dangereuse pour un nouveau-né.
6. Écrivez « clients » et jamais « clientes ». Jamais de tiret cadratin.
7. « angle », « a_completer » et « questions » s'adressent à la photographe (vouvoiement). Les textes des « elements » sont écrits avec SA voix, pour les parents.

Enregistrez le résultat avec l'outil enregistrer_contenu.`;
}

export const SCHEMA = {
  type: "object",
  properties: {
    titre: { type: "string", description: "Titre court du contenu, pour l'historique." },
    angle: { type: "string", description: "2 phrases pour la photographe : à quelle attente du persona et à quelle recherche Google ce texte répond." },
    elements: {
      type: "array",
      items: {
        type: "object",
        properties: {
          etiquette: { type: "string" },
          texte: { type: "string" },
          visuel: { type: "string", description: "Image conseillée pour ce bloc, si utile." },
          note: { type: "string", description: "Nombre de caractères, conseil de mise en page, lien à ajouter." },
        },
        required: ["etiquette", "texte"],
      },
    },
    a_completer: { type: "array", items: { type: "string" } },
    questions: { type: "array", items: { type: "string" } },
  },
  required: ["titre", "angle", "elements"],
};

export function nettoyer(r: any, bannis: string[]): { resultat: any; alertes: string[] } {
  const s = JSON.stringify(r).replace(/—|–/g, "-").replace(/\bclientes\b/g, "clients").replace(/\bClientes\b/g, "Clients");
  const resultat = JSON.parse(s);
  const texte = (resultat.elements || []).map((e: any) => `${e.texte} ${e.visuel || ""}`).join(" ").toLowerCase();
  const alertes = bannis.filter((b) => b && texte.includes(b.toLowerCase())).map((b) => `Formule à retravailler : « ${b} »`);
  // Contrôle des longueurs de titre et de méta-description quand ils sont fournis
  for (const e of resultat.elements || []) {
    const et = String(e.etiquette || "").toLowerCase();
    const n = String(e.texte || "").length;
    if (et.includes("balise title") && (n < 30 || n > 65)) alertes.push(`Titre de ${n} caractères : visez 50 à 60.`);
    if (et.includes("méta-description") && (n < 110 || n > 165)) alertes.push(`Méta-description de ${n} caractères : visez 140 à 155.`);
  }
  return { resultat, alertes };
}
