// Formats du studio Instagram : ce que l'agent doit produire pour chaque type de contenu,
// et quelle mission y conduit. Partagé entre l'agent (prompt) et les tests.

export type Format = {
  id: string;
  nom: string;
  consigne: string; besoins?: string; // ce que l'agent produit, en détail
  multiPersona?: boolean; // le contenu peut s'adresser à tous les personas
};

export const FORMATS: Record<string, Format> = {
  bio: {
    id: "bio", nom: "Bio Instagram", besoins: `sa ville ou sa zone, ce qui la distingue et l'action qu'elle veut que la personne fasse`, multiPersona: true,
    consigne: `Proposez 3 versions de bio Instagram, chacune dans un élément (etiquette « Version 1 », « Version 2 », « Version 3 »).
La bio est la vitrine miniature du compte : en 3 secondes, une personne qui la découvre doit savoir si elle est au bon endroit. Chaque version répond aux 3 questions de la méthode Mon Photographe Bébé : qui est-elle (son activité, son positionnement, ses spécialités, sa ville ou sa zone), à qui s'adresse-t-elle (que le persona se reconnaisse immédiatement), que trouve-t-on sur son compte (ce que son contenu apporte), puis se termine par un appel à l'action clair (écrire en message, vérifier ses disponibilités, découvrir ses séances via le lien).
150 caractères maximum, espaces compris, sur 3 ou 4 lignes courtes. Des mots forts et précis, pas d'histoire personnelle.
Dans « note », indiquez le nombre de caractères et ce qui distingue cette version des autres.`,
  },
  questions: {
    id: "questions", nom: "Les questions de vos futurs clients",
    consigne: `Listez 10 questions que se pose le persona avant de réserver, formulées avec SES mots (comme ces parents les taperaient ou les poseraient), en partant de ses freins et de ce qu'elle cherche.
Un élément par question : etiquette « Question 1 »… , texte = la question, note = l'idée de publication qui y répond (format conseillé : photo, carrousel, réel ou story).`,
  },
  publication: {
    id: "publication", nom: "Publication", besoins: `le sujet et ce que l'on voit sur l'image choisie`,
    consigne: `Rédigez une publication complète, en 4 éléments :
1. « Accroche » : la première ligne, celle qui s'affiche avant « plus », 125 caractères maximum, qui parle directement au persona.
2. « Légende » : 80 à 180 mots, phrases courtes, paragraphes aérés, qui raconte quelque chose de concret (la séance, un geste, un moment) plutôt que des généralités.
3. « Appel à l'action » : une phrase simple et précise (écrire en message, réserver via le lien, poser sa question).
4. « Visuel » : la photo ou la vidéo à choisir dans ses images, décrite précisément, en accord avec son style d'images.
Ajoutez un 5e élément « Mots-clés » seulement si c'est utile : 3 à 5 hashtags locaux ou de spécialité, jamais une liste de 30.`,
  },
  etape: {
    id: "etape", nom: "Publication sur une étape de séance", besoins: `comment cette étape se passe concrètement chez elle`,
    consigne: `Rédigez une publication qui montre UNE étape concrète de la séance (accueil, préparation, un geste, une pause, la livraison), pour que le persona se projette et soit rassuré.
Éléments : « Accroche » (125 caractères maximum), « Légende » (80 à 180 mots, ce qu'elle fait et pourquoi elle le fait), « Appel à l'action », « Visuel » (ce qu'il faut montrer, sans aucun enfant identifiable sans autorisation).`,
  },
  offre: {
    id: "offre", nom: "Publication d'offre", besoins: `ce qui est proposé, les dates, le prix, le nombre de places et la façon de réserver`,
    consigne: `Rédigez une publication d'offre claire : pour qui, quoi, quand, combien si elle l'indique, comment réserver.
Éléments : « Accroche » (125 caractères maximum), « Légende » (60 à 140 mots, l'information utile d'abord), « Appel à l'action » (précis, avec la date limite si elle existe), « Visuel ».
N'inventez ni prix, ni date, ni nombre de places : utilisez uniquement ceux du brief, sinon écrivez [à compléter : …].`,
  },
  carrousel: {
    id: "carrousel", nom: "Carrousel", besoins: `ses vrais conseils sur le sujet`,
    consigne: `Écrivez un carrousel de 6 à 8 slides, prêt à poser dans un modèle Canva.
Un élément par slide (etiquette « Slide 1 »…) : texte = le texte affiché sur la slide, 25 mots maximum (la slide 1 est une promesse ou une question qui donne envie de faire défiler, la dernière invite à agir ou à enregistrer) ; visuel = ce qu'il faut mettre sur la slide (photo, fond uni, pictogramme).
Ajoutez ensuite un élément « Légende » (60 à 140 mots) et un élément « Appel à l'action ».`,
  },
  planning: {
    id: "planning", nom: "Planning du mois", besoins: `le mois visé, ses disponibilités et ses offres du moment`, multiPersona: true,
    consigne: `Construisez un planning de 4 publications pour le mois, une par semaine, qui alternent les formats (photo, carrousel, réel, story à la une) et les objectifs (rassurer, montrer, faire réserver, créer du lien).
Un élément par semaine (etiquette « Semaine 1 »…) : texte = le sujet et l'accroche proposée ; visuel = le format et l'image à utiliser ; note = le persona visé et le frein ou le désir auquel la publication répond.
Si plusieurs personas sont fournies, répartissez les publications entre elles selon la priorité de ses spécialités.`,
  },
  deux_contenus: {
    id: "deux_contenus", nom: "Deux contenus d'avance", besoins: `les séances ou les images qu'elle peut montrer`,
    consigne: `Préparez 2 publications complètes, à programmer d'avance, sur deux sujets différents adaptés à la saison et au persona.
Pour chacune, 3 éléments : « Publication 1 · Accroche », « Publication 1 · Légende » (80 à 160 mots, visuel conseillé dans « visuel »), « Publication 1 · Appel à l'action », puis la même chose pour la publication 2.`,
  },
  reponses: {
    id: "reponses", nom: "Réponses types aux messages", besoins: `son prix de départ, son lien de réservation et son délai de réponse`, multiPersona: true,
    consigne: `Rédigez des réponses types aux messages privés les plus fréquents : demande de tarifs, « êtes-vous disponible le … », « comment se passe une séance », « que faut-il prévoir », « je ne suis pas à l'aise en photo », et toute situation ajoutée dans le brief.
Un élément par situation : etiquette = la situation, texte = la réponse, chaleureuse, courte (3 à 6 phrases), qui répond vraiment puis propose une étape suivante (appel, lien de réservation, formulaire). Laissez [à compléter : …] pour les informations qu'elle n'a pas données (prix, lien, délai).`,
  },
  invitations: {
    id: "invitations", nom: "Fins de publication qui invitent à agir", besoins: `la façon dont on la contacte ou dont on réserve`, multiPersona: true,
    consigne: `Proposez 10 fins de publication variées qui invitent à agir (écrire, réserver, enregistrer, partager à un proche, poser sa question), adaptées au persona.
Un élément par proposition : texte = la phrase, note = le type d'action et le meilleur contexte d'usage.`,
  },
  format_signature: {
    id: "format_signature", nom: "Format signature", besoins: `ce qu'elle aime montrer et ce qu'elle publie déjà`,
    consigne: `Proposez 3 idées de format récurrent (une rubrique qu'elle publie régulièrement et qui devient reconnaissable), chacune dans un élément : etiquette = le nom de la rubrique, texte = le principe, la fréquence et pourquoi il parle au persona, visuel = le gabarit visuel à créer une fois.
Puis rédigez le premier épisode de la première idée : éléments « Épisode 1 · Accroche », « Épisode 1 · Légende », « Épisode 1 · Appel à l'action ».`,
  },
  declinaison: {
    id: "declinaison", nom: "Une séance en cinq contenus", besoins: `le déroulé de cette séance et l'accord de la famille pour publier`,
    consigne: `À partir de la séance décrite dans le brief, proposez 5 contenus différents : une photo phare, un carrousel des coulisses, un réel ou une vidéo courte, une story (avec sondage ou question), un témoignage (seulement si la famille a donné son accord, sinon une publication sur ce qu'elle a vécu de son côté à elle).
Un élément par contenu : etiquette = le format, texte = l'accroche et la légende courte, visuel = les images à utiliser, note = l'autorisation à vérifier.`,
  },
  offre_saison: {
    id: "offre_saison", nom: "Offre saisonnière en trois temps", besoins: `l'offre, les dates, le prix, le nombre de places et la façon de réserver`,
    consigne: `Préparez le lancement d'une offre saisonnière en 3 temps : « Annonce » (4 à 6 semaines avant), « Rappel » (2 semaines avant, avec une preuve ou un exemple), « Dernières places » (quelques jours avant la fin).
Pour chaque temps, un élément « … · Publication » (accroche et légende) et un élément « … · Story » (texte court de story avec sticker conseillé). N'inventez ni prix, ni date, ni nombre de places.`,
  },
};

// Mission -> format proposé par défaut
export const FORMAT_DE_MISSION: Record<string, string> = {
  MR01: "bio", MRW2: "bio", MR04: "questions", MR05: "etape", MR06: "offre", MR07: "planning", MR08: "deux_contenus",
  MR09: "reponses", MR10: "invitations", MC3: "publication", MC4: "carrousel",
  MER1: "format_signature", MER2: "declinaison", MER3: "offre_saison",
};
