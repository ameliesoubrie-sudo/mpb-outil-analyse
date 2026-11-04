// Prompt de l'assistant partenaires : carte d'identité, personas, zone, format et brief.
// Fonction pure, testable sans réseau.
import { FORMATS } from "./formats.ts";
import { blocHistoire, blocPratique } from "./questions.ts";

export type Persona = { specialite?: string; prenom?: string; portrait?: string; cherche?: string[]; freins?: string[]; ce_qui_la_decide?: string[]; ses_mots?: string };
export type Carte = {
  promesse?: string; piliers?: { titre: string; preuve: string }[]; personas?: Persona[];
  voix?: { adresse?: string; registre?: string; regles?: string[]; mots_a_employer?: string[]; mots_bannis?: string[]; exemple?: string };
  limites?: string[];
};
export type Brief = { partenaire?: string; details?: string; offre?: string; consignes?: string };

export const FORMULES_CREUSES = [
  "immortaliser", "moments magiques", "souvenirs inoubliables", "instants précieux", "capturer l'essence", "gravé à jamais",
  "n'hésitez pas à", "au cœur de", "partenariat gagnant-gagnant", "synergie", "opportunité unique",
];

const liste = (t?: string[]) => (t && t.length ? t.map((x) => `  - ${x}`).join("\n") : "  (non renseigné)");

export function decrirePersona(p: Persona): string {
  return [
    `Prénom : ${p.prenom || "(sans prénom)"} · spécialité : ${p.specialite || "?"}`,
    `Portrait : ${p.portrait || "(non renseigné)"}`,
    `Ce que cette famille cherche :\n${liste(p.cherche)}`,
    `Ses inquiétudes :\n${liste(p.freins)}`,
  ].join("\n");
}

export function construirePrompt(o: {
  formatId: string; carte: Carte | null; personas: Persona[]; brief: Brief;
  specialites?: string[]; zone?: string; contexte?: string; recherchePossible?: boolean;
  mission?: { id: string; titre: string; methode?: string } | null;
}): string {
  const f = FORMATS[o.formatId];
  if (!f) throw new Error(`Format inconnu : ${o.formatId}`);
  const c = o.carte || {};
  const v = c.voix || {};
  const bannis = [...(v.mots_bannis || []), ...FORMULES_CREUSES];
  const b = o.brief || {};
  const lignesBrief = [
    b.partenaire && `- Partenaire visé : ${b.partenaire}`,
    b.details && `- Ce que la personne a écrit ou dicté (à utiliser en priorité, avec ses mots) : ${b.details}`,
    b.offre && `- Ce qu'elle propose ou demande, tel quel : ${b.offre}`,
    b.consignes && `- Consignes : ${b.consignes}`,
  ].filter(Boolean).join("\n");
  const blocPersonas = o.personas.length
    ? o.personas.map((p, i) => `### Persona ${o.personas.length > 1 ? i + 1 : ""}\n${decrirePersona(p)}`).join("\n\n")
    : "(Aucun persona renseigné : signalez dans « questions » que remplir ses personas dans Mon identité aidera à mieux choisir les partenaires.)";
  const recherche = f.recherche
    ? (o.recherchePossible
      ? `\n=== RECHERCHE WEB ===\nUtilisez l'outil de recherche web (5 recherches au plus) avant d'écrire. Cherchez en français, avec la ville ou les communes de sa zone dans chaque requête. Ne retenez que ce que vous avez réellement vu dans les résultats.\n`
      : `\n=== RECHERCHE WEB INDISPONIBLE ===\nVous ne pouvez pas chercher sur le web pour ce contenu. Ne citez AUCUN nom de structure : à la place, donnez les recherches exactes à taper (Google, Google Maps, annuaires professionnels), les types de structures à viser et comment les évaluer, et dites-le dans « angle ».\n`)
    : "";

  return `Vous êtes l'assistant partenaires de Mon Photographe Bébé. Vous aidez un ou une photographe professionnel, qui accompagne les familles de la grossesse aux 3 ans de l'enfant, à développer son réseau local : partenaires de la périnatalité et de la petite enfance, liens vers son site, presse locale. Vous travaillez comme un chargé de développement local, concret et respectueux des métiers des autres. Vous n'affirmez jamais un fait que vous ne connaissez pas.

=== CE QU'IL FAUT PRODUIRE : ${f.nom} ===
${f.consigne}
${o.mission ? `\nC'est l'outil de la mission « ${o.mission.titre} »${o.mission.methode ? ` : ${o.mission.methode}` : ""}.` : ""}
${recherche}
=== SA ZONE ===
${o.zone || "(non renseignée : demandez-la dans « questions » et restez général)"}

=== LES FAMILLES QU'IL OU ELLE VEUT TOUCHER ===
${blocPersonas}

=== CE QU'ON SAIT DE CETTE PERSONNE (sa carte d'identité) ===
Spécialités, par ordre d'importance : ${(o.specialites || []).join(", ") || "(non renseignées)"}
Sa promesse : ${c.promesse || "(non renseignée)"}
Ses piliers et leurs preuves (les seuls faits que vous pouvez affirmer) :
${(c.piliers || []).map((p) => `  - ${p.titre} : ${p.preuve}`).join("\n") || "  (non renseignés)"}
${blocHistoire(c)}${blocPratique(c)}Ce qui n'est jamais promis :
${liste(c.limites)}
${o.contexte ? `Contexte de son activité :\n${o.contexte}\n` : ""}
=== SA VOIX (pour les textes envoyés aux partenaires ou publiés) ===
- Registre : ${v.registre || "chaleureux et professionnel"}
- Règles d'écriture :
${liste(v.regles)}
- Exemple de sa voix : ${v.exemple ? `« ${v.exemple} »` : "(aucun)"}
- Mots et formules INTERDITS : ${bannis.join(", ")}
- Avec un partenaire professionnel : vouvoiement par défaut.

=== BRIEF ===
${lignesBrief || "(aucun brief : appuyez-vous sur sa carte, sa zone et ses personas, et laissez des [à compléter : …])"}

=== LA MÉTHODE MON PHOTOGRAPHE BÉBÉ POUR UN PARTENARIAT ===
- Donner avant de demander : on commence par ce qu'on apporte au partenaire et à ses clients.
- Un échange concret et équilibré, jamais une demande de recommandation brute.
- Peu de partenaires, bien choisis et bien entretenus, valent mieux qu'une longue liste.
- Respecter le métier de l'autre : rien de médical ne vient du ou de la photographe.
- Un texte humain et personnel : à relire à voix haute.

=== RÈGLES IMPÉRATIVES ===
1. Zéro invention : aucune structure, coordonnée, prix, date, chiffre ou anecdote absent ci-dessus ou de vos recherches. Écrivez [à compléter : ce qu'il faut ajouter] et listez-le dans « a_completer ».
2. Personnalisation : chaque proposition s'appuie sur ses spécialités, sa zone, ses personas ou un fait réel de sa carte.
3. Écriture neutre : on ne sait pas si cette personne est une femme ou un homme. Dans « angle », « a_completer », « questions » et les « note », vouvoiement sans aucun accord au féminin ni au masculin (pas de « prête », « seule », « installée » : reformulez). Dans les textes qu'elle signe, évitez aussi les accords genrés qui la concernent, sauf si sa carte l'indique clairement.
4. Les familles sont des parents, pas seulement des mères : parlez des « parents », des « futurs parents » ou des « familles ».
5. Discrétion : pas de nom de famille, pas de détail médical ; une image de famille ne se montre qu'avec l'accord écrit des parents.
6. Écrivez « clients » et jamais « clientes ». Jamais de tiret cadratin.

Enregistrez le résultat avec l'outil enregistrer_contenu.`;
}

export const SCHEMA = {
  type: "object",
  properties: {
    titre: { type: "string", description: "Titre court du contenu, pour l'historique." },
    angle: { type: "string", description: "2 ou 3 phrases pour la personne, en vouvoiement neutre : ce que vous avez compris et pourquoi cette direction." },
    elements: {
      type: "array",
      items: {
        type: "object",
        properties: {
          etiquette: { type: "string" },
          texte: { type: "string" },
          visuel: { type: "string", description: "Image ou support conseillé, si utile." },
          note: { type: "string", description: "Lien de la source pour une structure trouvée, conseil de mise en œuvre." },
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
  // Une structure citée sans lien source est signalée
  const sansSource = (resultat.elements || []).filter((e: any) => /^(.+?)\s[·-]\s/.test(String(e.etiquette || "")) && !/https?:\/\//.test(String(e.note || ""))).length;
  if (sansSource) alertes.push(`${sansSource} structure${sansSource > 1 ? "s" : ""} sans lien source : vérifiez ${sansSource > 1 ? "qu'elles existent" : "qu'elle existe"} avant de prendre contact.`);
  if (/commission|pourcentage sur (les|chaque) séance/i.test(texte)) alertes.push("Une commission est évoquée : vérifiez qu'elle est permise par la déontologie du partenaire (professions de santé notamment).");
  return { resultat, alertes };
}
