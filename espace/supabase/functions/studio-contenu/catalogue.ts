// Mon studio de contenu : réseaux, formats par réseau et consignes de rédaction.
// Partagé entre la fonction (prompt) et les tests.

export type FormatContenu = { id: string; nom: string; consigne: string };
export type Reseau = { id: string; nom: string; regles: string; formats: FormatContenu[] };

const ACCROCHE_IG = "« Accroche » : la première ligne, celle qui s'affiche avant « plus », 125 caractères maximum, qui parle directement au persona.";
const VISUEL = "« Visuel » : la photo ou la vidéo à choisir dans ses propres images, décrite précisément, en accord avec son style d'images (jamais un enfant identifiable sans autorisation écrite).";
const CTA = "« Appel à l'action » : une phrase simple et peu engageante (écrire en message, vérifier ses disponibilités, enregistrer la publication, poser sa question).";

export const RESEAUX: Record<string, Reseau> = {
  instagram: {
    id: "instagram", nom: "Instagram",
    regles: "Instagram : des parents qui font défiler vite. Une accroche forte, des phrases courtes, des paragraphes aérés, 3 à 5 hashtags locaux ou de spécialité au plus.",
    formats: [
      { id: "publication", nom: "Publication avec légende", consigne: `Rédigez une publication complète, en éléments :
1. ${ACCROCHE_IG}
2. « Légende » : 80 à 180 mots, qui raconte quelque chose de concret (la séance, un geste, un moment, un conseil) plutôt que des généralités.
3. ${CTA}
4. ${VISUEL}
5. « Mots-clés » : 3 à 5 hashtags locaux ou de spécialité.` },
      { id: "carrousel", nom: "Carrousel", consigne: `Écrivez un carrousel de 6 à 8 slides, prêt à poser dans un modèle Canva.
Un élément par slide (etiquette « Slide 1 »…) : texte = le texte affiché sur la slide, 25 mots maximum ; la slide 1 est une promesse ou une question qui donne envie de faire défiler, la dernière invite à agir ou à enregistrer ; visuel = ce qu'il faut mettre sur la slide (photo, fond uni, pictogramme).
Puis un élément « Légende » (60 à 140 mots) et un élément « Appel à l'action ».` },
      { id: "reel", nom: "Script de reel", consigne: `Écrivez le script d'un reel de 15 à 40 secondes, facile à tourner seul au téléphone.
Éléments : « Accroche » (ce qui est dit ou écrit à l'écran dans les 2 premières secondes) ; puis « Plan 1 », « Plan 2 »… (4 à 6 plans : texte = ce qu'on voit et ce qui est dit, visuel = comment le filmer, note = durée en secondes) ; « Texte à l'écran » (les phrases à incruster) ; « Légende » (40 à 100 mots) ; « Appel à l'action ». Proposez dans une note un type de son (voix, musique douce, son du studio) sans citer de titre précis.` },
      { id: "stories", nom: "Séquence de stories", consigne: `Écrivez une séquence de 4 à 6 stories qui se suivent.
Un élément par story (etiquette « Story 1 »…) : texte = le texte affiché, 20 mots maximum ; visuel = ce qu'on voit (photo, vidéo face caméra, coulisses) ; note = l'outil interactif à ajouter si utile (sondage, question, curseur, lien). La dernière story invite à écrire en message ou à cliquer sur le lien.` },
    ],
  },
  facebook: {
    id: "facebook", nom: "Facebook",
    regles: "Facebook : un public souvent un peu plus âgé (parents, grands-parents qui offrent des séances), des textes qui peuvent être un peu plus longs, un ton de proximité locale. Un lien peut être mis directement dans le texte. Pas plus de 2 ou 3 hashtags.",
    formats: [
      { id: "publication", nom: "Publication", consigne: `Rédigez une publication Facebook :
1. « Accroche » : les 2 premières lignes, visibles avant « Voir plus ».
2. « Texte » : 100 à 220 mots, chaleureux, concret, ancré dans sa ville ou sa région quand c'est connu.
3. ${CTA} Le lien peut être indiqué en clair s'il figure dans les informations.
4. ${VISUEL}` },
      { id: "album", nom: "Album photo commenté", consigne: `Préparez un album de 5 à 8 photos qui raconte une séance ou un thème.
Éléments : « Texte de l'album » (80 à 160 mots), puis « Photo 1 », « Photo 2 »… : texte = la courte légende de chaque photo (15 mots maximum), visuel = l'image à choisir dans ses séances. Terminez par un « Appel à l'action ». Rappelez dans une note l'autorisation écrite des familles.` },
      { id: "video", nom: "Vidéo courte", consigne: `Écrivez le script d'une vidéo courte (30 à 60 secondes) pour Facebook, face caméra ou en coulisses.
Éléments : « Accroche » (la première phrase dite), « Plan 1 », « Plan 2 »… (3 à 5 plans : ce qu'on voit et ce qui est dit, note = durée), « Sous-titres » (les phrases clés, car beaucoup regardent sans le son), « Texte de la publication » (50 à 120 mots), « Appel à l'action ».` },
    ],
  },
  tiktok: {
    id: "tiktok", nom: "TikTok",
    regles: "TikTok : tout se joue dans les 2 premières secondes. Un ton direct, spontané, parlé. Une seule idée par vidéo. Légende courte, 3 à 5 hashtags.",
    formats: [
      { id: "video", nom: "Script de vidéo", consigne: `Écrivez le script d'une vidéo TikTok de 20 à 45 secondes, à tourner au téléphone.
Éléments : « Accroche » (ce qui est dit et écrit à l'écran dans les 2 premières secondes, une phrase qui arrête le pouce) ; « Plan 1 », « Plan 2 »… (4 à 6 plans : texte = ce qui est dit, visuel = ce qu'on voit et comment le filmer, note = durée) ; « Texte à l'écran » ; « Légende » (150 caractères maximum) ; « Mots-clés » (3 à 5 hashtags). Proposez dans une note un type de son sans citer de titre précis.` },
      { id: "carrousel", nom: "Carrousel photo", consigne: `Écrivez un carrousel photo TikTok de 5 à 8 images.
Un élément par image (etiquette « Image 1 »…) : texte = le texte posé sur l'image, 15 mots maximum, visuel = la photo à choisir. La première image doit donner envie de faire défiler. Puis « Légende » (150 caractères maximum) et « Mots-clés » (3 à 5 hashtags).` },
    ],
  },
  linkedin: {
    id: "linkedin", nom: "LinkedIn",
    regles: "LinkedIn : un réseau professionnel. On y parle en cheffe ou chef d'entreprise et en professionnel de l'image : son métier, ses engagements (sécurité, formation, qualité), ses partenariats, les cartes cadeaux pour les entreprises et les CSE. Vouvoiement par défaut. Accroche de 2 lignes avant « voir plus », paragraphes d'une ou deux phrases, 3 hashtags au plus. Jamais de photo d'enfant.",
    formats: [
      { id: "post", nom: "Post texte", consigne: `Rédigez un post LinkedIn :
1. « Accroche » : 2 lignes, 200 caractères maximum, qui donnent envie de cliquer sur « voir plus ».
2. « Texte » : 120 à 250 mots, à la première personne, un retour d'expérience ou un point de vue de professionnel, en paragraphes très courts.
3. « Appel à l'action » : une question ouverte ou une invitation à échanger.
4. « Visuel » : une photo d'elle au travail, du studio, d'un partenariat ou d'un produit, jamais d'enfant.
5. « Mots-clés » : 3 hashtags au plus.` },
      { id: "document", nom: "Carrousel en document", consigne: `Écrivez un carrousel LinkedIn (document PDF) de 6 à 10 pages.
Un élément par page (etiquette « Page 1 »…) : texte = le texte de la page, 30 mots maximum ; visuel = la mise en page conseillée. La page 1 annonce clairement ce que le lecteur va apprendre, la dernière présente qui elle est et comment la contacter. Puis « Texte du post » (60 à 140 mots) et « Appel à l'action ».` },
    ],
  },
};

export const RETOUCHES: Record<string, string> = {
  court: "Raccourcissez nettement le texte (environ un tiers de moins) sans perdre l'idée principale ni le ton.",
  personnel: "Rendez le texte plus personnel : plus de première personne, un détail concret de sa façon de travailler tiré des informations ci-dessus, et un [à compléter : …] là où une anecdote vécue ferait la différence.",
  accroche: "Gardez le corps du texte et proposez une accroche complètement différente, plus forte, qui parle directement à l'inquiétude ou à l'envie du persona.",
};

export function trouverFormat(reseau: string, format: string): { reseau: Reseau; format: FormatContenu } | null {
  const r = RESEAUX[reseau];
  const f = r?.formats.find((x) => x.id === format);
  return r && f ? { reseau: r, format: f } : null;
}

// Cibles proposées pour le persona professionnel
export const CIBLES_PRO: [string, string][] = [
  ["perinatalite", "Sages-femmes et professionnels de la périnatalité"],
  ["boutiques", "Boutiques de puériculture et commerces pour enfants"],
  ["entreprises", "Entreprises et CSE (cartes cadeaux, avantages salariés)"],
  ["creches", "Crèches, assistantes maternelles et lieux d'accueil"],
  ["photographes", "Autres photographes et prestataires (mariage, événementiel)"],
];
