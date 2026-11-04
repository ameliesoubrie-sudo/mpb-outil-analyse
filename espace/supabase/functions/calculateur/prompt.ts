// Prompt du calculateur commenté : les chiffres sont calculés par le code, notre studio de création ne fait que les lire.
// Fonctions pures, testables sans réseau.

const LIBRE: Record<string, string> = {
  cout_seance: `« Vos trois options » : garder, ajuster le prix, ou alléger la prestation (moins d'images, moins de tenues, retouche plus courte), avec pour chacune ce que ça change, en citant uniquement les chiffres fournis.`,
  panier_moyen: `« Là où se joue votre panier » : selon qu'elle vend en galerie ou en visionnage, où se fait la vente additionnelle chez elle et ce qui peut la remplacer quand elle n'est pas là (diaporama, visuels d'offres dans la galerie, date limite, appel à l'ouverture).`,
  transformation: `« La source à travailler » : pour la source la plus faible parmi celles qui ont assez de données, les causes possibles de la perte (réponse lente, tarif découvert trop tard, demandes hors zone) sous forme de questions qu'elle peut vérifier.`,
  fideles: `« Ce qui fait revenir » : 2 ou 3 leviers concrets (séance suivante proposée à la livraison, formule première année, message aux anciennes familles, parrainage).`,
  instagram: `« L'idée à refaire » : à partir de ses 3 meilleures publications, ce qu'elles ont en commun et UNE idée précise pour le mois prochain (le même sujet sous un autre angle, ou le même format sur un autre sujet).`,
  charges: `« Les 3 charges à comparer » : les trois lignes où une comparaison d'offres ou une résiliation rapporterait le plus, et ce qu'il faut demander à chaque fournisseur.`,
  bilan_annuel: `« Objectif 1 », « Objectif 2 », « Objectif 3 » : chacun mesurable (un chiffre, une date), tiré de ses chiffres et de ce qu'elle a écrit ; « note » = la mission de la liste fournie qui y mène (son identifiant et son titre exacts). Pas plus de trois. Arrêter quelque chose peut être un objectif.`,
  modele_vente: `« L'amélioration à essayer » : une seule, adaptée à ses contraintes (simplifier ses formules, soigner sa galerie, proposer un visionnage en option ou en visio, passer à un forfait). Il n'y a pas de bon ou de mauvais modèle : le meilleur est celui qu'elle tient dans la durée.`,
};

export function construirePrompt(o: {
  calcul: string; chiffres: string; donnees: Record<string, unknown>; contexte?: string; carte: any; specialites?: string[];
  mission?: { id: string; titre: string; methode?: string } | null; missions?: string[];
}): string {
  const c = o.carte || {};
  const textes = Object.entries(o.donnees || {}).filter(([k, v]) => typeof v === "string" && v.length > 20 && !/^\d/.test(v as string)).map(([k, v]) => `- ${k} : ${v}`).join("\n");
  return `Vous êtes le calculateur commenté de Mon Photographe Bébé. Une photographe professionnelle, qui accompagne les familles de la grossesse aux 3 ans de l'enfant, vient de saisir ses chiffres. Le calcul a déjà été fait par le code, il est juste. Votre rôle : lui expliquer en clair ce que ces chiffres veulent dire pour SON activité, et ce qu'elle peut faire en premier. Vous parlez comme une consœur expérimentée et bienveillante, jamais comme un tableur.

=== SES CHIFFRES (calculés par le code, ils font foi) ===
${o.chiffres}
${textes ? `\nCe qu'elle a écrit :\n${textes}\n` : ""}${o.contexte ? `\nSon contexte, avec ses mots : ${o.contexte}\n` : ""}
=== QUI ELLE EST ===
Spécialités : ${(o.specialites || []).join(", ") || "(non renseignées)"}
Sa promesse : ${c.promesse || "(non renseignée)"}
${o.mission ? `C'est la mission « ${o.mission.titre} »${o.mission.methode ? ` : ${o.mission.methode}` : ""}.` : ""}
${o.missions?.length ? `\nMissions de son programme, à citer pour les objectifs :\n${o.missions.join("\n")}\n` : ""}
=== CE QU'IL FAUT PRODUIRE ===
Éléments, dans cet ordre :
« Ce que disent vos chiffres » (3 à 5 phrases : la lecture d'ensemble, ce qui est solide, ce qui inquiète),
« Ce qui compte le plus » (LE chiffre qui doit retenir son attention, et pourquoi),
${LIBRE[o.calcul] || ""}
« Votre première action » (une seule, faisable cette semaine, concrète),
« À surveiller » (ce qu'elle doit mesurer de nouveau, et quand).

=== RÈGLES IMPÉRATIVES ===
1. Aucun calcul : ne refaites aucune opération, n'arrondissez pas autrement, ne créez aucun nouveau chiffre (pas de moyenne du secteur, pas de pourcentage « habituel », pas d'estimation). Vous ne citez QUE des chiffres présents ci-dessus, écrits exactement comme ils apparaissent.
2. Si une donnée manque pour conclure, dites-le et ce qu'il faudrait saisir, dans « questions ».
3. Pas de comparaison avec d'autres photographes : on se compare à soi.
4. Cotisations, TVA, statut, déductions : renvoyez vers son comptable ou son expert-comptable, sans donner de taux ni de règle fiscale.
5. Écriture neutre : on ne sait pas si la personne photographe est une femme ou un homme. Vouvoiement sans aucun accord au féminin ni au masculin qui la concerne (reformulez : « tout est prêt » plutôt que « vous êtes prête ») ; parlez des parents ou des familles, pas seulement des mères ; pas de point médian.
6. Ton : vouvoiement, chaleureux, direct, sans jargon. Pas de culpabilisation : un chiffre faible est une information, pas une faute.
6. Écrivez « clients » et jamais « clientes ». Jamais de tiret cadratin.

Enregistrez le résultat avec l'outil enregistrer_commentaire.`;
}

export const SCHEMA = {
  type: "object",
  properties: {
    titre: { type: "string", description: "Titre court, pour l'historique." },
    angle: { type: "string", description: "Une phrase qui résume la situation." },
    elements: {
      type: "array",
      items: {
        type: "object",
        properties: { etiquette: { type: "string" }, texte: { type: "string" }, note: { type: "string" } },
        required: ["etiquette", "texte"],
      },
    },
    a_completer: { type: "array", items: { type: "string" } },
    questions: { type: "array", items: { type: "string" } },
  },
  required: ["titre", "angle", "elements"],
};

// Nombres présents dans un texte, normalisés (« 1 200,5 » -> 1200.5)
export function nombres(t: string): number[] {
  return (String(t).match(/\d[\d\s  ]*(?:[.,]\d+)?/g) || [])
    .map((x) => Number(x.replace(/[\s  ]/g, "").replace(",", ".")))
    .filter((x) => Number.isFinite(x));
}

// Nettoie le commentaire et signale tout chiffre qui n'apparaît pas dans les données fournies
export function nettoyer(r: any, source: string): { resultat: any; alertes: string[] } {
  const s = JSON.stringify(r).replace(/—|–/g, "-").replace(/\bclientes\b/g, "clients").replace(/\bClientes\b/g, "Clients");
  const resultat = JSON.parse(s);
  const connus = new Set(nombres(source).map((x) => Math.abs(x)));
  const texte = [resultat.angle || "", ...(resultat.elements || []).map((e: any) => `${e.texte} ${e.note || ""}`)].join(" ");
  const inconnus = [...new Set(nombres(texte))].filter((x) => !connus.has(x) && !(Number.isInteger(x) && x <= 12) && !(x >= 2020 && x <= 2040));
  // Les identifiants de mission (MEB3…) ne sont pas des chiffres
  const ids = new Set(nombres((texte.match(/\bM[A-Z]{1,3}\d+\b/g) || []).join(" ")));
  const alertes = inconnus.filter((x) => !ids.has(x)).map((x) => `Chiffre à vérifier dans le commentaire : ${x.toLocaleString("fr-FR")} (il ne vient pas de vos données).`);
  return { resultat, alertes };
}
