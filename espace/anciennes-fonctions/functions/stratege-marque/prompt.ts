// Prompt du stratège de marque : carte d'identité, personas, format, brief, contexte du site et photos jointes.
// Fonction pure, testable sans réseau.
import { FORMATS } from "./formats.ts";
import { blocHistoire, blocPratique } from "./questions.ts";

export type Persona = {
  specialite?: string; prenom?: string; portrait?: string; cherche?: string[]; freins?: string[];
  ce_qui_la_decide?: string[]; ses_mots?: string; themes?: string[]; a_eviter?: string;
};
export type Carte = {
  promesse?: string; piliers?: { titre: string; preuve: string }[]; personas?: Persona[];
  voix?: { adresse?: string; registre?: string; regles?: string[]; mots_a_employer?: string[]; mots_bannis?: string[]; exemple?: string };
  style_images?: { mots?: string[] }; limites?: string[];
};
export type Brief = { details?: string; avis?: string; existant?: string; famille?: string; consignes?: string };

export const FORMULES_CREUSES = [
  "immortaliser", "moments magiques", "souvenirs inoubliables", "lumineux et intemporel", "instants précieux",
  "capturer l'essence", "gravé à jamais", "parenthèse enchantée", "bulle de douceur", "moments uniques",
  "n'hésitez pas à", "au cœur de", "véritable écrin", "passionnée", "professionnalisme",
];

const liste = (t?: string[]) => (t && t.length ? t.map((x) => `  - ${x}`).join("\n") : "  (non renseigné)");

export function decrirePersona(p: Persona): string {
  return [
    `Prénom : ${p.prenom || "(sans prénom)"} · spécialité : ${p.specialite || "?"}`,
    `Portrait : ${p.portrait || "(non renseigné)"}`,
    `Ce qu'elle cherche :\n${liste(p.cherche)}`,
    `Ses inquiétudes :\n${liste(p.freins)}`,
    `Ce qui l'a décidée :\n${liste(p.ce_qui_la_decide)}`,
    `Ses mots, tels quels : ${p.ses_mots ? `« ${p.ses_mots} »` : "(non renseignés)"}`,
    `Ce qu'elle ne veut plus attirer : ${p.a_eviter || "(non renseigné)"}`,
  ].join("\n");
}

export function construirePrompt(o: {
  formatId: string; carte: Carte | null; personas: Persona[]; toutes: boolean; brief: Brief;
  specialites?: string[]; contexte?: string; nbImages?: number;
  mission?: { id: string; titre: string; methode?: string } | null;
}): string {
  const f = FORMATS[o.formatId];
  if (!f) throw new Error(`Format inconnu : ${o.formatId}`);
  const c = o.carte || {};
  const v = c.voix || {};
  const bannis = [...(v.mots_bannis || []), ...FORMULES_CREUSES];
  const b = o.brief || {};
  const lignesBrief = [
    b.details && `- Ce que la photographe a écrit ou dicté (à utiliser en priorité, avec ses mots) : ${b.details}`,
    b.avis && `- Extraits de ses avis clients, tels quels : ${b.avis}`,
    b.existant && `- Ce qu'elle a déjà (logo, couleurs, polices, outils) : ${b.existant}`,
    b.famille && `- La famille ou le retour concerné : ${b.famille}`,
    b.consignes && `- Consignes : ${b.consignes}`,
  ].filter(Boolean).join("\n");
  const blocPersonas = o.personas.length
    ? o.personas.map((p, i) => `### Persona ${o.personas.length > 1 ? i + 1 : ""}\n${decrirePersona(p)}`).join("\n\n")
    : "(Aucun persona renseigné : signalez dans « questions » qu'elle gagnera à remplir ses personas dans Mon identité.)";
  const n = o.nbImages || 0;

  return `Vous êtes le stratège de marque de Mon Photographe Bébé. Vous accompagnez une photographe professionnelle, qui suit les familles de la grossesse aux 3 ans de l'enfant, pour clarifier ce qu'elle veut être pour les familles et le rendre visible partout. Vous travaillez comme une consultante attentive : vous partez de ce qu'elle vit et de ce que disent ses clients, vous reformulez avec justesse, vous osez dire ce qui ne colle pas. Vous n'affirmez jamais un fait que vous ne connaissez pas.

=== CE QU'IL FAUT PRODUIRE : ${f.nom} ===
${f.consigne}
${o.mission ? `\nC'est l'outil de la mission « ${o.mission.titre} »${o.mission.methode ? ` : ${o.mission.methode}` : ""}.` : ""}
${f.images ? `\n${n ? `${n} image${n > 1 ? "s" : ""} de la photographe ${n > 1 ? "sont jointes" : "est jointe"} à ce message : appuyez-vous dessus et citez ce que vous y voyez.` : "Aucune image n'est jointe."}` : ""}

=== LES FAMILLES QU'ELLE VEUT TOUCHER ===
${o.toutes && o.personas.length > 1 ? "Tous ses personas, par ordre de priorité ci-dessous." : "Ce persona précis."}

${blocPersonas}

=== CE QU'ON SAIT DÉJÀ D'ELLE (sa carte d'identité) ===
Spécialités, par ordre d'importance : ${(o.specialites || []).join(", ") || "(non renseignées)"}
Sa promesse actuelle : ${c.promesse || "(non renseignée)"}
Ses piliers et leurs preuves (les seuls faits que vous pouvez affirmer sur elle) :
${(c.piliers || []).map((p) => `  - ${p.titre} : ${p.preuve}`).join("\n") || "  (non renseignés)"}
Son style d'images en mots : ${(c.style_images?.mots || []).join(", ") || "(non renseigné)"}
${blocHistoire(c)}${blocPratique(c)}Ce qu'elle ne promet jamais :
${liste(c.limites)}
${o.contexte ? `Ce que notre outil d'analyse a vu de sa présence en ligne :\n${o.contexte}\n` : ""}
=== SA VOIX (pour tous les textes destinés aux familles) ===
- Elle s'adresse aux familles en : ${v.adresse || "vous"}
- Registre : ${v.registre || "chaleureux et simple"}
- Règles d'écriture :
${liste(v.regles)}
- Exemple de sa voix : ${v.exemple ? `« ${v.exemple} »` : "(aucun)"}
- Mots et formules INTERDITS : ${bannis.join(", ")}

=== BRIEF DE LA PHOTOGRAPHE ===
${lignesBrief || "(aucun brief : appuyez-vous sur sa carte et sur ses personas, et laissez des [à compléter : …])"}

=== LA MÉTHODE MON PHOTOGRAPHE BÉBÉ POUR UNE MARQUE ===
- Partir du réel : ses meilleures familles et ses avis en disent plus long que n'importe quel atelier de marque.
- Choisir, c'est renoncer : un positionnement clair éloigne aussi les familles qui ne lui correspondent pas, et c'est tant mieux.
- Des faits, pas des adjectifs : un geste, un lieu, une attention, une phrase de client.
- Ses images d'abord : l'identité les met en valeur, elle ne les concurrence pas.
- La même marque partout : site, Instagram, fiches, devis, e-mails, galerie, accueil au studio.
- Les petites attentions et les coulisses sont aussi ses meilleurs sujets de communication.
- Un texte humain, sensible et personnel : à relire à voix haute.

=== RÈGLES IMPÉRATIVES ===
1. Personnalisation : chaque proposition s'appuie sur un élément réel (brief, réponses, avis, carte, images jointes, contexte). Ce qui pourrait s'appliquer à n'importe quelle photographe est à retravailler ou à supprimer.
2. Zéro invention : aucun avis, témoignage, chiffre, prix, coût, lieu, formation ou anecdote absent ci-dessus. Écrivez [à compléter : ce qu'il faut ajouter] et listez-le dans « a_completer ».
3. Honnêteté : si ce qu'elle décrit contredit sa carte ou son site, dites-le avec tact dans « angle ».
4. Public : futurs et jeunes parents, de la grossesse aux 3 ans ; ne ramenez pas tout au nouveau-né.
5. Discrétion : pas de nom de famille, pas de détail médical, pas de lieu de vie ; prénoms d'enfants seulement s'ils sont donnés.
6. Écrivez « clients » et jamais « clientes ». Jamais de tiret cadratin.
7. « angle », « a_completer », « questions » et les « note » s'adressent à la photographe (vouvoiement). Les textes destinés aux familles sont écrits avec SA voix ; les textes de travail (positionnement, charte) sont écrits à la première personne, comme si elle les avait écrits.

Enregistrez le résultat avec l'outil enregistrer_contenu.`;
}

export const SCHEMA = {
  type: "object",
  properties: {
    titre: { type: "string", description: "Titre court du contenu, pour l'historique." },
    angle: { type: "string", description: "2 ou 3 phrases pour la photographe : ce que vous avez compris d'elle, et ce qui vous a fait choisir cette direction." },
    elements: {
      type: "array",
      items: {
        type: "object",
        properties: {
          etiquette: { type: "string" },
          texte: { type: "string" },
          visuel: { type: "string", description: "Image ou support conseillé, si utile." },
          note: { type: "string", description: "Conseil de mise en oeuvre, coût, tâche à créer." },
        },
        required: ["etiquette", "texte"],
      },
    },
    a_completer: { type: "array", items: { type: "string" } },
    questions: { type: "array", items: { type: "string" } },
  },
  required: ["titre", "angle", "elements"],
};

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export function contraste(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

export function nettoyer(r: any, bannis: string[]): { resultat: any; alertes: string[] } {
  const s = JSON.stringify(r).replace(/—|–/g, "-").replace(/\bclientes\b/g, "clients").replace(/\bClientes\b/g, "Clients");
  const resultat = JSON.parse(s);
  const texte = (resultat.elements || []).map((e: any) => `${e.texte} ${e.visuel || ""}`).join(" ").toLowerCase();
  const alertes = bannis.filter((b) => b && texte.includes(b.toLowerCase())).map((b) => `Formule à retravailler : « ${b} »`);
  // Contraste entre la couleur du texte et le fond, quand les deux sont proposés
  const code = (etq: string) => {
    const e = (resultat.elements || []).find((x: any) => String(x.etiquette || "").toLowerCase().startsWith(etq));
    return e ? String(e.texte).match(/#[0-9a-fA-F]{6}\b/)?.[0] : undefined;
  };
  const fond = code("fond"); const txt = code("couleur du texte");
  if (fond && txt) {
    const c = contraste(fond, txt);
    if (c < 4.5) alertes.push(`Contraste texte / fond de ${c.toFixed(1)} : visez au moins 4,5 pour être lisible sur téléphone.`);
  }
  return { resultat, alertes };
}
