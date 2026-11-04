// Prompts de « Mon studio de contenu » : piliers par persona, persona professionnel, idées de sujets,
// rédaction et retouche. Fonctions pures, testables sans réseau.
import { RESEAUX, RETOUCHES, CIBLES_PRO, trouverFormat } from "./catalogue.ts";
import { blocHistoire, blocPratique } from "./questions.ts";

export type Persona = {
  specialite?: string; prenom?: string; portrait?: string; cherche?: string[]; freins?: string[];
  ce_qui_la_decide?: string[]; ou_la_trouver?: string[]; ses_mots?: string; themes?: string[]; a_eviter?: string;
  rapport_photo?: string; declencheurs?: string[]; ce_quil_regarde?: string[]; valeur?: string[]; occasions?: string[];
};
export type Carte = {
  promesse?: string; piliers?: { titre: string; preuve: string }[]; personas?: Persona[];
  voix?: { adresse?: string; registre?: string; regles?: string[]; mots_a_employer?: string[]; mots_bannis?: string[]; exemple?: string };
  style_images?: { mots?: string[]; images_phares?: string[] }; limites?: string[]; histoire?: unknown; pratique?: unknown;
};
export type Pilier = { titre: string; description?: string };
export type Contexte = { carte: Carte | null; specialites?: string[]; contexte?: string; emojis?: string };

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
    `Ses inquiétudes ou ses freins :\n${liste(p.freins)}`,
    `Ce qui la décide :\n${liste(p.ce_qui_la_decide)}`,
    `Où la trouver :\n${liste(p.ou_la_trouver)}`,
    `Ses objections ou ses mots, tels quels : ${p.ses_mots ? `« ${p.ses_mots} »` : "(non renseignés)"}`,
    `Thèmes qui lui parlent :\n${liste(p.themes)}`,
    ...(p.rapport_photo ? [`Son rapport à la photo : ${p.rapport_photo}`] : []),
    ...(p.declencheurs?.length ? [`Ce qui déclenche sa recherche :\n${liste(p.declencheurs)}`] : []),
    ...(p.ce_quil_regarde?.length ? [`Ce qu'il regarde avant d'écrire :\n${liste(p.ce_quil_regarde)}`] : []),
    ...(p.valeur?.length ? [`Ce pour quoi il accepte de payer plus :\n${liste(p.valeur)}`] : []),
    ...(p.occasions?.length ? [`Occasions de revenir :\n${liste(p.occasions)}`] : []),
    `Ce qui ne lui correspond pas : ${p.a_eviter || "(non renseigné)"}`,
  ].join("\n");
}

export function blocPhotographe(o: Contexte): string {
  const c = o.carte || {};
  const v = c.voix || {};
  return `=== QUI EST LA PERSONNE PHOTOGRAPHE ===
Spécialités, par ordre d'importance : ${(o.specialites || []).join(", ") || "(non renseignées)"}
Sa promesse : ${c.promesse || "(non renseignée)"}
Ce qui la distingue, avec ses preuves (les seuls faits que vous pouvez affirmer) :
${(c.piliers || []).map((p) => `  - ${p.titre} : ${p.preuve}`).join("\n") || "  (non renseigné)"}
Son style d'images : ${(c.style_images?.mots || []).join(", ") || "(non renseigné)"}${c.style_images?.images_phares?.length ? ` · images phares : ${c.style_images.images_phares.join(" ; ")}` : ""}
${blocHistoire(c)}${blocPratique(c)}Ce qu'elle ne promet jamais et ne montre pas :
${liste(c.limites)}
${o.contexte ? `Contexte de son activité :\n${o.contexte}\n` : ""}
=== SA VOIX (à respecter strictement) ===
- Adresse aux parents : ${v.adresse || "vous"}
- Registre : ${v.registre || "chaleureux et simple"}
- Règles d'écriture :
${liste(v.regles)}
- Mots qu'elle aime employer : ${(v.mots_a_employer || []).join(", ") || "(non renseignés)"}
- Émojis : ${o.emojis || "avec modération, deux au maximum, jamais en début de phrase"}
- Exemple de sa voix : ${v.exemple ? `« ${v.exemple} »` : "(aucun)"}
- Mots et formules INTERDITS (ni eux ni leurs variantes) : ${[...(v.mots_bannis || []), ...FORMULES_CREUSES].join(", ")}
`;
}

const INTRO = "Vous êtes « Mon studio de contenu », le studio de création de Mon Photographe Bébé. Vous aidez une personne photographe professionnelle, qui accompagne les familles de la grossesse aux 3 ans de l'enfant, à communiquer sur les réseaux sociaux avec SA voix, pour SES clients ou ses partenaires.";

const REGLES_COMMUNES = `- Zéro invention : aucun prix, date, chiffre, formation, lieu, accessoire, prénom ou anecdote qui ne figure pas dans les informations. Si elle n'a pas de lieu de séance à elle, ne parlez jamais de « son studio ».
- Sécurité et droit à l'image : rien qui suggère une pose dangereuse pour un nouveau-né ; jamais de prénom d'enfant ; toute image d'enfant suppose l'autorisation écrite des parents.
- Avis : jamais de contrepartie contre un avis.
- Écrivez « clients » et jamais « clientes ». Parlez des parents ou des familles, pas seulement des mères. Pas d'écriture inclusive avec point médian. Jamais de tiret cadratin ni demi-cadratin.
- Ce qui s'adresse à la personne photographe (descriptions, angles, notes) : vouvoiement, sans accord au féminin ni au masculin qui la concerne.`;

// ---------- Persona professionnel ----------
export function promptPersonaPro(o: Contexte & { cibles: string[]; precision?: string }): string {
  const noms = o.cibles.map((c) => CIBLES_PRO.find((x) => x[0] === c)?.[1] || c);
  return `${INTRO}

=== VOTRE TÂCHE ===
Elle veut aussi toucher des professionnels, dans le cadre de son réseau, de ses recommandations et de ses partenariats. Construisez UN persona professionnel qui réunit les cibles choisies :
${noms.map((n) => `  - ${n}`).join("\n") || "  - Professionnels de la périnatalité et partenaires locaux"}
${o.precision ? `Précision donnée par la personne photographe : ${o.precision}\n` : ""}
Ce persona n'est pas un parent : c'est une personne qui peut la recommander, travailler avec elle, offrir ses séances ou ses cartes cadeaux. Décrivez ce que ce professionnel cherche (servir ses propres clients ou salariés, une partenaire fiable, des engagements de sécurité et de qualité, une relation simple), ses freins (manque de temps, peur d'être démarché, image de son propre établissement), ce qui le décide, et où le trouver (LinkedIn, réseaux de professionnels, salons, associations, rendez-vous en personne).

${blocPhotographe(o)}
=== RÈGLES ===
- specialite : « Professionnels et partenaires ».
- prenom : un prénom suivi du métier principal, par exemple « Sophie, sage-femme libérale ».
- themes : 5 thèmes de communication qui parlent à ce professionnel.
${REGLES_COMMUNES}

Enregistrez le résultat avec l'outil enregistrer_persona.`;
}

export const SCHEMA_PERSONA = {
  type: "object",
  properties: {
    specialite: { type: "string" }, prenom: { type: "string" },
    portrait: { type: "string", description: "2 ou 3 phrases : qui est cette personne, son métier, son quotidien." },
    cherche: { type: "array", items: { type: "string" } }, freins: { type: "array", items: { type: "string" } },
    ce_qui_la_decide: { type: "array", items: { type: "string" } }, ou_la_trouver: { type: "array", items: { type: "string" } },
    ses_mots: { type: "string" }, themes: { type: "array", items: { type: "string" } }, a_eviter: { type: "string" },
  },
  required: ["specialite", "prenom", "portrait", "cherche", "freins", "themes"],
};

// ---------- Piliers de contenu ----------
export function promptPiliers(o: Contexte & { persona: Persona; pro: boolean }): string {
  return `${INTRO}

=== VOTRE TÂCHE ===
Définissez 5 piliers de contenu pour ce persona : les grandes familles de sujets sur lesquelles elle va publier régulièrement pour lui parler. Exemple pour un persona nouveau-né, chez une photographe qui a un studio : « La sécurité du nouveau-né », « Hygiène et préparation du studio », « Confort et accessoires de bébé », « Rassurer les parents », « Les coulisses d'une séance ».
Partez des thèmes, des inquiétudes et de ce que cherche le persona, et de ce qui la distingue vraiment. Chaque pilier doit pouvoir nourrir au moins 10 publications différentes. Les 5 piliers ne se recouvrent pas.
${o.pro ? "Ce persona est un professionnel : les piliers parlent de partenariat, de recommandation, de ses engagements de professionnelle (sécurité, formation, qualité), de ce qu'elle apporte aux clients ou aux salariés de ce professionnel, et de son métier vu de l'intérieur." : "Ce persona est un parent : les piliers répondent à ce qu'il vit, à ses questions et à ses peurs avant, pendant et après la séance."}

=== LE PERSONA ===
${decrirePersona(o.persona)}

${blocPhotographe(o)}
=== RÈGLES ===
- titre : 2 à 6 mots, clair, sans jeu de mots.
- description : une phrase pour la personne photographe, qui dit ce que couvre le pilier et pourquoi il parle à ce persona.
- Rien qui ne corresponde pas à sa pratique réelle (lieu, accessoires, séances proposées).
${REGLES_COMMUNES}

Enregistrez le résultat avec l'outil enregistrer_piliers.`;
}

export const SCHEMA_PILIERS = {
  type: "object",
  properties: {
    piliers: {
      type: "array", description: "Exactement 5 piliers.",
      items: { type: "object", properties: { titre: { type: "string" }, description: { type: "string" } }, required: ["titre", "description"] },
    },
  },
  required: ["piliers"],
};

// ---------- Idées de sujets ----------
export function promptSujets(o: Contexte & { persona: Persona; pilier: Pilier; deja: string[]; reseau?: string }): string {
  const r = o.reseau ? RESEAUX[o.reseau] : null;
  return `${INTRO}

=== VOTRE TÂCHE ===
Proposez 12 sujets de publication concrets pour le pilier « ${o.pilier.titre} »${o.pilier.description ? ` (${o.pilier.description})` : ""}, destinés à ce persona${r ? `, pour ${r.nom}` : ""}.
Variez les angles : un conseil pratique, une question que les parents posent vraiment, une idée reçue à corriger, une coulisse de sa façon de travailler, un avant et après, une erreur fréquente, une liste utile, une histoire de séance (à compléter avec son vécu), une prise de position, un geste ou un rituel qui lui est propre.
Chaque sujet doit être précis (pas « la sécurité » mais « Pourquoi je chauffe le studio à 26 degrés avant votre arrivée », si c'est vrai chez elle) et ancré dans ce que l'on sait d'elle.

=== LE PERSONA ===
${decrirePersona(o.persona)}

${blocPhotographe(o)}
${o.deja.length ? `=== SUJETS DÉJÀ PROPOSÉS OU TRAITÉS (à ne pas répéter, même reformulés) ===\n${o.deja.slice(0, 80).map((t) => `- ${t}`).join("\n")}\n` : ""}
=== RÈGLES ===
- titre : le sujet formulé comme un titre de publication, 12 mots maximum.
- angle : une phrase pour la personne photographe, qui dit ce qu'on y raconte et à quelle envie ou inquiétude du persona ça répond.
${REGLES_COMMUNES}

Enregistrez le résultat avec l'outil enregistrer_sujets.`;
}

export const SCHEMA_SUJETS = {
  type: "object",
  properties: {
    sujets: {
      type: "array", description: "12 sujets.",
      items: { type: "object", properties: { titre: { type: "string" }, angle: { type: "string" } }, required: ["titre", "angle"] },
    },
  },
  required: ["sujets"],
};

// ---------- Rédaction ----------
export function promptRedaction(o: Contexte & {
  persona: Persona; pro: boolean; pilier: Pilier; sujet: { titre: string; angle?: string }; reseau: string; format: string; detail?: string; dejaFaits?: string[];
}): string {
  const rf = trouverFormat(o.reseau, o.format);
  if (!rf) throw new Error(`Format inconnu : ${o.reseau} / ${o.format}`);
  return `${INTRO}

=== CE QU'IL FAUT PRODUIRE : ${rf.format.nom} pour ${rf.reseau.nom} ===
${rf.format.consigne}

Règles du réseau : ${rf.reseau.regles}

=== LE SUJET ===
Pilier : ${o.pilier.titre}${o.pilier.description ? ` (${o.pilier.description})` : ""}
Sujet : ${o.sujet.titre}${o.sujet.angle ? `\nAngle : ${o.sujet.angle}` : ""}
${o.detail ? `Détail donné par la personne photographe, à utiliser en priorité et avec ses mots : ${o.detail}\n` : ""}
=== À QUI ÇA S'ADRESSE ===
${o.pro ? "Un professionnel, pas un parent : on lui parle de partenariat, de confiance, de ce qu'elle apporte à ses propres clients ou salariés. Vouvoiement." : "Ce persona précis. Tout le texte doit lui parler : sa situation, ses inquiétudes, ses mots. Un autre persona ne devrait pas se reconnaître autant."}

${decrirePersona(o.persona)}

${blocPhotographe(o)}
${o.dejaFaits?.length ? `=== DÉJÀ PRODUIT RÉCEMMENT (ne pas répéter les mêmes accroches) ===\n${o.dejaFaits.map((t) => `- ${t}`).join("\n")}\n` : ""}
=== LA MÉTHODE MON PHOTOGRAPHE BÉBÉ ===
- Montrer plutôt que dire : les coulisses, la préparation, l'accueil, les petites attentions, en expliquant pourquoi elle travaille ainsi.
- Des appels à l'action peu engageants, qui donnent envie de faire le premier pas.
- Un texte humain et personnel : ce qui fait la différence, ce sont ses mots, ses anecdotes, sa façon de parler.

=== RÈGLES IMPÉRATIVES ===
1. Personnalisation : chaque phrase s'appuie sur un élément du persona ou sur un fait réel de la personne photographe. Sinon, supprimez-la.
2. Là où il faudrait un détail qu'elle seule connaît (une anecdote, un geste, une phrase d'une famille), écrivez [à compléter : ce qu'il faut ajouter] et listez-le dans « a_completer ».
3. Pas de texte d'IA : pas de formules creuses, pas de superlatifs, pas de questions rhétoriques en série, pas de listes à puces avec émojis. Des phrases courtes, comme elle les dirait à voix haute.
${REGLES_COMMUNES}
- Les textes des « elements » sont écrits avec SA voix, pour son public ; « angle », « note », « a_completer » s'adressent à elle.

Enregistrez le résultat avec l'outil enregistrer_contenu.`;
}

export function promptRetouche(base: string, precedent: unknown, consigne: string): string {
  const c = RETOUCHES[consigne] || `Consigne de la personne photographe : ${consigne}`;
  return base.replace(/Enregistrez le résultat avec l'outil enregistrer_contenu\.\s*$/, "").trimEnd() + `

=== VERSION PRÉCÉDENTE ===
${JSON.stringify(precedent)}

=== RETOUCHE DEMANDÉE ===
${c}
Gardez la même structure d'éléments, sauf si la consigne demande autre chose. Gardez les [à compléter : …] encore utiles.

Enregistrez le résultat avec l'outil enregistrer_contenu.`;
}

export const SCHEMA = {
  type: "object",
  properties: {
    titre: { type: "string", description: "Titre court du contenu, pour l'historique." },
    angle: { type: "string", description: "2 phrases pour la personne photographe : à quelle envie ou inquiétude du persona ce contenu répond." },
    elements: {
      type: "array",
      items: {
        type: "object",
        properties: {
          etiquette: { type: "string" }, texte: { type: "string" },
          visuel: { type: "string", description: "Image, vidéo ou mise en page conseillée, si utile." },
          note: { type: "string", description: "Conseil d'usage, durée, nombre de caractères, autorisation à vérifier." },
        },
        required: ["etiquette", "texte"],
      },
    },
    a_completer: { type: "array", items: { type: "string" } },
  },
  required: ["titre", "angle", "elements"],
};

// Nettoyage : tirets longs, « clientes », formules interdites signalées
export function nettoyer(r: any, bannis: string[]): { resultat: any; alertes: string[] } {
  const s = JSON.stringify(r).replace(/—|–/g, "-").replace(/\bclientes\b/g, "clients").replace(/\bClientes\b/g, "Clients");
  const resultat = JSON.parse(s);
  const texte = (resultat.elements || []).map((e: any) => `${e.texte} ${e.visuel || ""}`).join(" ").toLowerCase();
  const alertes = bannis.filter((b) => b && texte.includes(b.toLowerCase())).map((b) => `Formule à retravailler : « ${b} »`);
  return { resultat, alertes };
}
export const propre = (x: unknown) => JSON.parse(JSON.stringify(x).replace(/—|–/g, "-").replace(/\bclientes\b/g, "clients"));
