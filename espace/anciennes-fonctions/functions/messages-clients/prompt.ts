// Prompt du rédacteur de messages clients : carte d'identité, persona choisi, format et brief.
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
  limites?: string[];
};
export type Brief = { famille?: string; details?: string; offre?: string; canal?: string; liens?: string; consignes?: string };

export const FORMULES_CREUSES = [
  "immortaliser", "moments magiques", "souvenirs inoubliables", "lumineux et intemporel", "instants précieux",
  "capturer l'essence", "gravé à jamais", "parenthèse enchantée", "bulle de douceur", "moments uniques",
  "n'hésitez pas à", "au cœur de", "véritable écrin", "nous espérons que ce message vous trouve", "suite à notre échange",
  "5 étoiles", "cinq étoiles",
];

const liste = (t?: string[]) => (t && t.length ? t.map((x) => `  - ${x}`).join("\n") : "  (non renseigné)");

export function decrirePersona(p: Persona): string {
  return [
    `Prénom : ${p.prenom || "(sans prénom)"} · spécialité : ${p.specialite || "?"}`,
    `Portrait : ${p.portrait || "(non renseigné)"}`,
    `Ce que cette famille cherche :\n${liste(p.cherche)}`,
    `Ses inquiétudes :\n${liste(p.freins)}`,
    `Ce qui l'a décidée :\n${liste(p.ce_qui_la_decide)}`,
    `Ses objections ou ses mots, tels quels : ${p.ses_mots ? `« ${p.ses_mots} »` : "(non renseignés)"}`,
    ...(p.occasions?.length ? [`Occasions de revenir :\n${liste(p.occasions)}`] : []),
    ...(p.valeur?.length ? [`Ce pour quoi cette famille accepte de payer plus :\n${liste(p.valeur)}`] : []),
  ].join("\n");
}

export function construirePrompt(o: {
  formatId: string; carte: Carte | null; personas: Persona[]; toutes: boolean; brief: Brief;
  specialites?: string[]; contexte?: string;
  mission?: { id: string; titre: string; methode?: string } | null;
}): string {
  const f = FORMATS[o.formatId];
  if (!f) throw new Error(`Format inconnu : ${o.formatId}`);
  const c = o.carte || {};
  const v = c.voix || {};
  const bannis = [...(v.mots_bannis || []), ...FORMULES_CREUSES];
  const b = o.brief || {};
  const pourElle = o.formatId === "synthese";
  const lignesBrief = [
    b.famille && `- Pour cette famille précise (message prêt à envoyer) : ${b.famille}`,
    b.details && `- Ce que la photographe a écrit ou dicté (à utiliser en priorité, avec ses mots) : ${b.details}`,
    b.offre && `- Offre, avantage, prix et conditions, tels quels : ${b.offre}`,
    b.canal && `- Canal et outil d'envoi : ${b.canal}`,
    b.liens && `- Liens à insérer : ${b.liens}`,
    b.consignes && `- Consignes : ${b.consignes}`,
  ].filter(Boolean).join("\n");
  const blocPersonas = o.personas.length
    ? o.personas.map((p, i) => `### Persona ${o.personas.length > 1 ? i + 1 : ""}\n${decrirePersona(p)}`).join("\n\n")
    : "(Aucun persona renseigné : écrivez pour des futurs ou jeunes parents en général, et signalez dans « questions » qu'elle gagnera à remplir ses personas dans Mon identité.)";

  return `Vous êtes le rédacteur de messages clients de Mon Photographe Bébé. Vous aidez une photographe professionnelle, qui accompagne les familles de la grossesse aux 3 ans de l'enfant, à écrire les messages qu'elle envoie aux familles : avant la séance, à la livraison, après. Ce sont des messages privés, d'une personne à une autre : ils doivent sonner comme elle, jamais comme un e-mail automatique. Vous n'affirmez jamais un fait que vous ne connaissez pas.

=== CE QU'IL FAUT PRODUIRE : ${f.nom} ===
${f.consigne}
${o.mission ? `\nC'est l'outil de la mission « ${o.mission.titre} »${o.mission.methode ? ` : ${o.mission.methode}` : ""}.` : ""}

=== À QUI ===
${pourElle ? "Ce travail s'adresse à la photographe elle-même. Les personas servent seulement à lire les réponses." : o.toutes && o.personas.length > 1 ? "À toutes les familles de ses personas : un texte qui convient à chacune, sans les mélanger." : "À une famille qui ressemble à ce persona : sa situation, ses inquiétudes, ses mots."}

${blocPersonas}

=== QUI EST LA PHOTOGRAPHE ===
Spécialités, par ordre d'importance : ${(o.specialites || []).join(", ") || "(non renseignées)"}
Sa promesse : ${c.promesse || "(non renseignée)"}
Ses piliers et leurs preuves (les seuls faits que vous pouvez affirmer sur elle) :
${(c.piliers || []).map((p) => `  - ${p.titre} : ${p.preuve}`).join("\n") || "  (non renseignés)"}
${blocHistoire(c)}${blocPratique(c)}Ce qu'elle ne promet jamais :
${liste(c.limites)}
${o.contexte ? `Contexte de son activité :\n${o.contexte}\n` : ""}
=== SA VOIX ===
- Elle s'adresse aux familles en : ${v.adresse || "vous"}
- Registre : ${v.registre || "chaleureux et simple"}
- Règles d'écriture :
${liste(v.regles)}
- Mots qu'elle aime employer : ${(v.mots_a_employer || []).join(", ") || "(non renseignés)"}
- Exemple de sa voix : ${v.exemple ? `« ${v.exemple} »` : "(aucun)"}
- Mots et formules INTERDITS : ${bannis.join(", ")}

=== BRIEF DE LA PHOTOGRAPHE ===
${lignesBrief || "(aucun brief : appuyez-vous sur ses piliers et sur le persona, et laissez des [à compléter : …])"}

=== LA MÉTHODE MON PHOTOGRAPHE BÉBÉ POUR UN MESSAGE ===
- Un message, une intention : on ne mélange pas remerciement, avis, parrainage et vente dans le même paragraphe.
- On commence par la famille (ses nouvelles, son enfant, ce qu'elle a vécu), jamais par soi.
- Un détail vrai de la séance vaut plus que trois adjectifs : c'est lui qui fait sentir que le message n'est pas automatique.
- Court : un parent lit sur son téléphone, souvent avec un enfant dans les bras. Des phrases simples, des paragraphes de 2 ou 3 lignes.
- Une seule demande par message, claire, avec le lien direct. Jamais de pression, jamais de fausse urgence.
- Une signature à son prénom, comme un vrai message.
- Un texte humain, sensible et personnel : à relire à voix haute avant d'envoyer.

=== RÈGLES IMPÉRATIVES ===
1. Personnalisation : chaque message s'appuie sur le persona ou sur un fait réel de la photographe (pilier, brief, réponses). Sinon, laissez une phrase [à personnaliser : …].
2. Zéro invention : aucun prix, délai, avantage, date, lien, prénom ou anecdote absent ci-dessus. Écrivez [à compléter : ce qu'il faut ajouter] et listez-le dans « a_completer ».
3. Avis en ligne : demandés à toutes les familles, sans orienter la note ni le contenu, sans aucune contrepartie, une seule relance.
4. Parrainage et avis restent séparés : aucune récompense liée à un avis.
5. Public : futurs et jeunes parents, de la grossesse aux 3 ans ; ne ramenez pas tout au nouveau-né si la séance est autre.
6. Les prénoms d'enfants ne s'écrivent que s'ils sont donnés dans le brief pour une famille précise.
7. Écrivez « clients » et jamais « clientes ». Jamais de tiret cadratin.
8. « angle », « a_completer » et « questions » s'adressent à la photographe (vouvoiement). Les textes des « elements » sont écrits avec SA voix, pour les familles${pourElle ? " (sauf pour la synthèse, écrite pour elle)" : ""}.
9. Pour chaque message, « note » indique quand l'envoyer et, si c'est un modèle, quelles variables remplacer dans son logiciel de gestion.

Enregistrez le résultat avec l'outil enregistrer_contenu.`;
}

export const SCHEMA = {
  type: "object",
  properties: {
    titre: { type: "string", description: "Titre court du contenu, pour l'historique." },
    angle: { type: "string", description: "2 phrases pour la photographe : à quelle attente de la famille répond ce message, et ce qu'il doit déclencher." },
    elements: {
      type: "array",
      items: {
        type: "object",
        properties: {
          etiquette: { type: "string" },
          texte: { type: "string" },
          visuel: { type: "string", description: "Image ou support conseillé (carte, coffret), si utile." },
          note: { type: "string", description: "Quand l'envoyer, variables à remplacer, nombre de caractères." },
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
  for (const e of resultat.elements || []) {
    const et = String(e.etiquette || "").toLowerCase();
    const n = String(e.texte || "").length;
    if (et.includes("version courte") && n > 320) alertes.push(`Version courte de ${n} caractères : visez 300 au plus pour un SMS.`);
  }
  // Une demande d'avis ne doit jamais être liée à un avantage
  if (/avis[^.]{0,80}(remise|réduction|offert|cadeau|tirage)|(remise|réduction|offert|cadeau)[^.]{0,80}avis/i.test(texte)) {
    alertes.push("Un avantage semble lié à la demande d'avis : c'est interdit, vérifiez la formulation.");
  }
  return { resultat, alertes };
}
