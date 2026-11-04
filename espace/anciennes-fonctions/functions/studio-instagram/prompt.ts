// Construction du prompt du studio Instagram, à partir de la carte d'identité,
// du persona choisi, du format et du brief. Fonction pure, testable sans réseau.
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
  style_images?: { mots?: string[]; images_phares?: string[] }; limites?: string[];
};
export type Brief = { sujet?: string; details?: string; offre?: string; periode?: string; ville?: string; consignes?: string };

export const FORMULES_CREUSES = [
  "immortaliser", "moments magiques", "souvenirs inoubliables", "lumineux et intemporel", "instants précieux",
  "capturer l'essence", "gravé à jamais", "parenthèse enchantée", "bulle de douceur", "moments uniques",
];

const liste = (t?: string[]) => (t && t.length ? t.map((x) => `  - ${x}`).join("\n") : "  (non renseigné)");

export function decrirePersona(p: Persona): string {
  return [
    `Prénom : ${p.prenom || "(sans prénom)"} · spécialité : ${p.specialite || "?"}`,
    `Portrait : ${p.portrait || "(non renseigné)"}`,
    `Ce que cette personne cherche :\n${liste(p.cherche)}`,
    `Ses inquiétudes avant de réserver :\n${liste(p.freins)}`,
    `Ce qui l'a décidée :\n${liste(p.ce_qui_la_decide)}`,
    `Où la trouver :\n${liste(p.ou_la_trouver)}`,
    `Ses objections ou ses mots, tels quels : ${p.ses_mots ? `« ${p.ses_mots} »` : "(non renseignés)"}`,
    `Thèmes qui lui parlent :\n${liste(p.themes)}`,
    ...(p.rapport_photo ? [`Son rapport à la photo : ${p.rapport_photo}`] : []),
    ...(p.declencheurs?.length ? [`Ce qui déclenche sa recherche :\n${liste(p.declencheurs)}`] : []),
    ...(p.ce_quil_regarde?.length ? [`Ce qu'il regarde avant d'écrire :\n${liste(p.ce_quil_regarde)}`] : []),
    ...(p.valeur?.length ? [`Ce pour quoi il accepte de payer plus :\n${liste(p.valeur)}`] : []),
    ...(p.occasions?.length ? [`Occasions de revenir :\n${liste(p.occasions)}`] : []),
    `Le client qui ne correspond pas : ${p.a_eviter || "(non renseigné)"}`,
  ].join("\n");
}

export function construirePrompt(o: {
  formatId: string; carte: Carte | null; personas: Persona[]; toutes: boolean; brief: Brief;
  emojis?: string; specialites?: string[]; contexte?: string; dejaFaits?: string[]; mission?: { id: string; titre: string; methode?: string } | null;
}): string {
  const f = FORMATS[o.formatId];
  if (!f) throw new Error(`Format inconnu : ${o.formatId}`);
  const c = o.carte || {};
  const v = c.voix || {};
  const bannis = [...(v.mots_bannis || []), ...FORMULES_CREUSES];
  const blocPersonas = o.personas.length
    ? o.personas.map((p, i) => `### Persona ${o.personas.length > 1 ? i + 1 : ""}\n${decrirePersona(p)}`).join("\n\n")
    : "(Aucun persona renseigné : écrivez pour des futurs ou jeunes parents en général, et signalez dans « questions » qu'elle gagnera à remplir ses personas dans Mon identité.)";
  const brief = o.brief || {};
  const lignesBrief = [
    brief.sujet && `- Sujet ou intention : ${brief.sujet}`,
    brief.details && `- Détails concrets donnés par la photographe (à utiliser en priorité, avec ses mots) : ${brief.details}`,
    brief.offre && `- Offre (quoi, dates, prix, places, comment réserver) : ${brief.offre}`,
    brief.periode && `- Période ou saison : ${brief.periode}`,
    brief.ville && `- Ville ou zone : ${brief.ville}`,
    brief.consignes && `- Consignes particulières : ${brief.consignes}`,
  ].filter(Boolean).join("\n");

  return `Vous êtes le studio Instagram de Mon Photographe Bébé. Vous aidez une photographe professionnelle, qui accompagne les familles de la grossesse aux 3 ans de l'enfant, à créer un contenu Instagram qui lui ressemble et qui parle à SES clients. Vous écrivez le contenu à sa place, avec sa voix, mais vous ne parlez jamais à sa place de faits que vous ne connaissez pas.

=== CE QU'IL FAUT PRODUIRE : ${f.nom} ===
${f.consigne}
${o.mission ? `\nC'est l'outil de la mission « ${o.mission.titre} »${o.mission.methode ? ` : ${o.mission.methode}` : ""}.` : ""}

=== À QUI ÇA S'ADRESSE ===
${o.toutes && o.personas.length > 1 ? "Le contenu s'adresse à l'ensemble de ses personas, ci-dessous par ordre de priorité." : "Le contenu s'adresse à ce persona précis. Tout le texte doit lui parler : sa situation, ses inquiétudes, ses mots. Un autre persona ne devrait pas se reconnaître autant."}

${blocPersonas}

=== QUI EST LA PHOTOGRAPHE ===
Spécialités, par ordre d'importance : ${(o.specialites || []).join(", ") || "(non renseignées)"}
Sa promesse : ${c.promesse || "(non renseignée)"}
Ses piliers et leurs preuves (les seuls faits que vous pouvez affirmer sur elle) :
${(c.piliers || []).map((p) => `  - ${p.titre} : ${p.preuve}`).join("\n") || "  (non renseignés)"}
Son style d'images : ${(c.style_images?.mots || []).join(", ") || "(non renseigné)"}${c.style_images?.images_phares?.length ? ` · images phares : ${c.style_images.images_phares.join(" ; ")}` : ""}
${blocHistoire(c)}${blocPratique(c)}Ce qu'elle ne promet jamais et ne montre pas :
${liste(c.limites)}
${o.contexte ? `Contexte de son activité :\n${o.contexte}\n` : ""}
=== SA VOIX (à respecter strictement) ===
- Elle s'adresse aux parents en : ${v.adresse || "vous"}
- Registre : ${v.registre || "chaleureux et simple"}
- Règles d'écriture :
${liste(v.regles)}
- Mots qu'elle aime employer : ${(v.mots_a_employer || []).join(", ") || "(non renseignés)"}
- Émojis : ${o.emojis || "avec modération, deux au maximum, jamais en début de phrase"}
- Exemple de sa voix : ${v.exemple ? `« ${v.exemple} »` : "(aucun)"}
- Mots et formules INTERDITS (ni eux ni leurs variantes) : ${bannis.join(", ")}

=== BRIEF DE LA PHOTOGRAPHE ===
${lignesBrief || "(aucun brief : choisissez un sujet concret tiré des thèmes et des inquiétudes du persona)"}
${o.dejaFaits?.length ? `\n=== DÉJÀ PRODUIT RÉCEMMENT (ne pas répéter les mêmes sujets ni les mêmes accroches) ===\n${o.dejaFaits.map((t) => `- ${t}`).join("\n")}\n` : ""}
=== LA MÉTHODE MON PHOTOGRAPHE BÉBÉ (conseils de la fondatrice, à appliquer quand c'est pertinent) ===
- Montrer plutôt que dire : les coulisses, la préparation du studio, l'accueil, les petites attentions (un thé pour les parents, le goûter des enfants, le prénom sur l'ardoise) sont d'excellents sujets, à condition d'expliquer pourquoi elle travaille ainsi.
- Des appels à l'action peu engageants, qui donnent envie de faire le premier pas : « Vérifiez mes disponibilités », « Écrivez-moi en message », plutôt que « Réservez maintenant ».
- Un texte humain, sensible et personnel : tout le monde produit avec l'IA et les textes se ressemblent. Ce qui fait la différence, ce sont ses mots, ses anecdotes, sa façon de parler. À relire à voix haute.
- La régularité compte plus que la quantité : quand c'est utile, conseillez de programmer les publications à l'avance et de produire par lot.

=== RÈGLES IMPÉRATIVES ===
1. Personnalisation : appuyez chaque contenu sur un élément précis du persona (une inquiétude, une envie, ses mots) et sur un fait réel de la photographe (un pilier, un détail du brief). Si vous ne pouvez pas rattacher une phrase à l'une ou à l'autre, supprimez-la.
2. Zéro invention : aucun prix, date, chiffre, formation, lieu, prénom de client ou anecdote qui ne figure pas ci-dessus. Là où il faudrait un détail qu'elle seule connaît (une anecdote, un geste, une phrase d'une famille), écrivez [à compléter : ce qu'il faut ajouter] et listez-le dans « a_completer ». Un texte humain vaut mieux qu'un texte complet.
3. Pas de texte d'IA : pas de formules creuses, pas de superlatifs (« la meilleure », « unique »), pas de questions rhétoriques en série, pas de listes à puces avec émojis, pas de tirets longs. Des phrases courtes, concrètes, comme elle les dirait à voix haute.
4. Public : futurs et jeunes parents (mères, pères, couples), de la grossesse aux 3 ans. Ne ramenez pas tout au nouveau-né si le persona concerne une autre séance.
5. Droit à l'image et sécurité : jamais de prénom d'enfant ni de détail privé ; un visuel avec un enfant suppose l'autorisation écrite des parents (rappelez-le dans « note » si besoin). Rien qui suggère une pose dangereuse pour un nouveau-né.
6. Avis : ne proposez jamais de contrepartie contre un avis, ni de demander un avis uniquement aux clients contents.
7. Écrivez « clients » et jamais « clientes ». Jamais de tiret cadratin.
8. Les champs « angle », « a_completer » et « questions » s'adressent à la photographe : vouvoiement. Les textes des « elements » sont écrits avec SA voix, pour ses abonnés.

Enregistrez le résultat avec l'outil enregistrer_contenu.`;
}

export const SCHEMA = {
  type: "object",
  properties: {
    titre: { type: "string", description: "Titre court du contenu, pour l'historique." },
    angle: { type: "string", description: "2 phrases pour la photographe : à quelle inquiétude ou envie du persona ce contenu répond, et pourquoi il lui parle." },
    elements: {
      type: "array",
      items: {
        type: "object",
        properties: {
          etiquette: { type: "string" },
          texte: { type: "string" },
          visuel: { type: "string", description: "Image, vidéo ou mise en page conseillée, si utile." },
          note: { type: "string", description: "Conseil d'usage, nombre de caractères, autorisation à vérifier." },
        },
        required: ["etiquette", "texte"],
      },
    },
    a_completer: { type: "array", description: "Les détails personnels qu'elle doit ajouter elle-même ([à compléter]).", items: { type: "string" } },
    questions: { type: "array", description: "Informations manquantes qui amélioreraient le contenu, 3 au maximum.", items: { type: "string" } },
  },
  required: ["titre", "angle", "elements"],
};

// Nettoyage de la sortie : tirets longs, « clientes », formules interdites signalées
export function nettoyer(r: any, bannis: string[]): { resultat: any; alertes: string[] } {
  let s = JSON.stringify(r).replace(/\u2014|\u2013/g, "-").replace(/\bclientes\b/g, "clients").replace(/\bClientes\b/g, "Clients");
  const resultat = JSON.parse(s);
  const texte = (resultat.elements || []).map((e: any) => `${e.texte} ${e.visuel || ""}`).join(" ").toLowerCase();
  const alertes = bannis.filter((b) => b && texte.includes(b.toLowerCase())).map((b) => `Formule à retravailler : « ${b} »`);
  return { resultat, alertes };
}
