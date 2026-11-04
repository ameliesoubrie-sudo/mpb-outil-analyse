// Formats de l'assistant partenaires : trouver des partenaires locaux, les approcher, travailler avec eux,
// obtenir des liens et des articles locaux. Partagé entre l'agent (prompt) et les tests.

export type Format = { id: string; nom: string; consigne: string; besoins?: string; recherche?: boolean };

const SOURCES = `Chaque structure citée doit venir de vos recherches : nom exact, ville, et dans « note » le lien de la page où vous l'avez trouvée. Jamais de structure inventée ni de coordonnées devinées (pas d'e-mail ou de téléphone que vous n'avez pas lus sur une page). Si vous trouvez peu de résultats, dites-le et proposez les recherches à faire elle-même.`;

export const FORMATS: Record<string, Format> = {
  part_recherche: {
    id: "part_recherche", nom: "Vos partenaires possibles près de chez vous", recherche: true,
    consigne: `Cherchez sur le web, autour de sa ville et de sa zone, 8 à 12 partenaires possibles qui voient passer ses futurs clients : sages-femmes libérales, maternités et cliniques, consultantes en lactation, doulas, ostéopathes ou kinés spécialisés en périnatalité, cours de préparation à la naissance ou de yoga prénatal, boutiques de puériculture ou de vêtements pour bébé, portage et massage bébé, crèches et micro-crèches, relais petite enfance, ateliers parents-enfants.
Variez les types et restez dans sa zone. Privilégiez ceux qui collent à ses spécialités et à ses personas.
Éléments : un élément par partenaire, dans l'ordre de priorité. « etiquette » : le nom, le type et la ville. « texte » : en 2 ou 3 phrases, pourquoi ce partenaire (ses clients, son positionnement) et l'échange concret qu'elle pourrait lui proposer (des images pour ses supports, un atelier, une attention pour ses clients). « note » : le lien de la page source, puis « À contacter en premier » pour les 2 meilleurs.
Terminez par un élément « Vos 2 premiers contacts » qui explique en 3 phrases pourquoi commencer par ces deux-là.
${SOURCES}`,
  },
  part_support: {
    id: "part_support", nom: "Votre support partenaire",
    besoins: `ses séances, sa ville ou sa zone, ses coordonnées ou l'adresse de la page vers laquelle renverra le QR code`,
    consigne: `Rédigez le support qu'elle remet à ses partenaires : une carte ou un flyer A6, et la page simple vers laquelle renvoie le QR code.
Éléments : « Titre de la carte » (8 mots au plus, qui parle aux parents), « Présentation » (4 lignes, avec sa voix : qui elle est, ce qu'elle propose, où), « Ses séances » (la liste, une ligne chacune), « Appel à l'action » (sous le QR code, 6 à 10 mots), « Verso » (une phrase pour les parents, et la mention « Recommandé par [nom du partenaire] »), « Page du QR code » (titre et 3 courts paragraphes : bienvenue, ses séances, comment réserver, avec un avantage seulement s'il est donné), « Les 3 images à choisir » (quel type d'image pour chaque emplacement).
Dans « note », les conseils d'impression (format, papier, quantité de départ).`,
  },
  part_approche: {
    id: "part_approche", nom: "Votre premier contact avec un partenaire",
    besoins: `le partenaire visé (nom, métier, ville) et l'échange concret qu'elle veut proposer`,
    consigne: `Rédigez le premier contact avec le partenaire décrit dans le brief, ou à défaut avec le type de partenaire le plus pertinent pour elle.
Le message parle d'abord du partenaire et de ses clients, propose un échange concret et équilibré, et demande un rendez-vous court. Jamais de demande de recommandation dès le premier message.
Éléments : « E-mail » (objet et message, 120 à 180 mots), « Message court » (pour Instagram ou SMS, 300 caractères au plus), « Si vous passez le voir » (ce qu'elle dit en 30 secondes en déposant ses cartes), « Relance » (10 jours plus tard, 2 ou 3 phrases), « Ce qu'il faut avoir sous la main » (support, exemples d'images, disponibilités).`,
  },
  part_proposition: {
    id: "part_proposition", nom: "Votre proposition de partenariat en une page",
    besoins: `le type de partenaire visé, ce qu'elle peut apporter (images, atelier, attention pour les clients) et ce qu'elle demande en retour`,
    consigne: `Rédigez sa proposition de partenariat, à remettre ou à envoyer, tenant sur une page.
Éléments : « Titre », « En deux phrases » (le partenariat résumé), « Ce que je vous apporte » (3 à 5 points concrets), « Ce que je vous propose en retour pour vos clients » (si elle propose un avantage, tel que donné), « Ce que je vous demande » (simple et précis : afficher ses cartes, la citer, une publication commune), « Comment on s'organise » (durée d'essai de 3 mois, point au bout de 3 mois, qui fait quoi), « Contact ».
Aucun avantage, prix ou chiffre inventé : [à compléter : …] s'il manque. Pas de commission sur les séances : si elle en parle, rappelez dans « angle » de vérifier les règles de la profession du partenaire (les professions de santé ont des obligations déontologiques).`,
  },
  part_relance: {
    id: "part_relance", nom: "Garder le lien avec vos partenaires",
    besoins: `ses partenaires actuels et la date du dernier échange avec chacun`,
    consigne: `Rédigez de quoi entretenir ses partenariats sans les solliciter lourdement.
Éléments : « Message de nouvelles » (à envoyer aux partenaires sans échange depuis 3 mois : une nouvelle utile, une image récente si l'accord des parents le permet, une proposition simple), « Mot à glisser avec les cartes » (quand elle réassortit, 25 à 40 mots, manuscrit), « Remerciement » (quand une famille vient de la part d'un partenaire, sans donnée personnelle sur la famille), « Idée du trimestre » (une action commune légère : une publication, un atelier, un affichage), « Tableau de suivi » (les colonnes à tenir : partenaire, type, dernier échange, cartes déposées, familles venues de sa part, prochaine action).`,
  },
  part_publication: {
    id: "part_publication", nom: "Votre publication commune avec un partenaire",
    besoins: `le partenaire (nom, métier, compte Instagram si elle l'a) et le sujet envisagé`,
    consigne: `Préparez une publication commune avec un partenaire, publiée sur les deux comptes (publication en collaboration sur Instagram).
Choisissez un sujet utile aux parents où chacun apporte son expertise, sans jamais qu'elle parle à la place du partenaire sur son métier (santé, allaitement, sommeil : c'est le partenaire qui valide).
Éléments : « Le sujet et l'angle », « Message pour proposer l'idée au partenaire », « Format conseillé » (publication en collaboration, carrousel à quatre mains ou live, et pourquoi), « Texte de la publication » (avec sa voix, et les parties à écrire par le partenaire signalées [à écrire par le partenaire : …]), « Slides » si c'est un carrousel (une ligne par slide), « Après la publication » (répondre aux commentaires, noter les demandes reçues).`,
  },
  part_atelier: {
    id: "part_atelier", nom: "Votre atelier avec un partenaire",
    besoins: `le partenaire et son métier, le thème, le lieu possible, la date ou la période, et si l'atelier est gratuit ou payant`,
    consigne: `Construisez avec elle un atelier pour futurs ou jeunes parents, animé avec un partenaire de la périnatalité, qui lui fait rencontrer ses clients de demain.
Le partenaire anime son expertise, elle apporte le souvenir (un temps photo, des mini-portraits, un échange sur les images de famille). Rien de médical ne vient d'elle.
Éléments : « Le concept » (titre de l'atelier et promesse en une phrase), « Programme » (déroulé minute par minute, 1 h 30 à 2 h), « Ce qu'il faut prévoir » (lieu, matériel, nombre de places, prix ou gratuité, qui fait quoi), « Message au partenaire pour proposer l'atelier », « Annonce commune » (publication et texte d'inscription), « Autorisations » (le formulaire de droit à l'image à faire signer avant de photographier), « Après l'atelier » (le message aux participants, avec les images si elles sont autorisées et une présentation douce de ses séances).
Aucun prix, date ni lieu inventés : [à compléter : …].`,
  },
  part_liens: {
    id: "part_liens", nom: "Des liens vers votre site", recherche: true,
    consigne: `Cherchez sur le web, autour de sa ville et dans son secteur, des sites qui pourraient raisonnablement mettre un lien vers son site : annuaires locaux de qualité (pas de fermes à liens), associations de parents, sites de la commune ou de l'office de tourisme, blogs de parents ou de la région, partenaires existants, fournisseurs (labo photo, boutique), presse locale en ligne.
Éléments : un élément par site trouvé (6 à 10), « etiquette » : le nom et le type, « texte » : pourquoi ce site, et la contrepartie utile qu'elle peut proposer (une image, un article invité, un conseil, un lien réciproque avec un partenaire), « note » : le lien de la page source.
Puis : « Demande de lien type » (e-mail de 80 à 120 mots, à adapter à chaque site, qui propose quelque chose d'utile en échange), « À vérifier d'abord » (que sa fiche Mon Photographe Bébé renvoie bien vers son site, et ses liens existants dans la Search Console).
Jamais d'achat de liens ni d'échanges de liens en masse : rappelez-le dans « angle ».
${SOURCES}`,
  },
  part_media: {
    id: "part_media", nom: "Un article dans un média local", recherche: true,
    besoins: `un sujet ou une actualité possible (un atelier, une exposition, une collecte, un chiffre sur son métier, une histoire de famille autorisée)`,
    consigne: `Cherchez sur le web 3 à 5 médias locaux autour de sa ville (quotidien régional et son édition locale, site d'information de la ville, magazine municipal, radio locale, blog de parents), puis préparez sa proposition.
Éléments : un élément par média trouvé (« etiquette » : le nom, « texte » : la rubrique ou le type de sujet qu'il publie, d'après ce que vous avez vu, « note » : le lien de la page source).
Puis : « L'angle d'intérêt général » (pourquoi ce sujet intéresse les lecteurs maintenant, sans être une publicité pour elle), « Proposition à envoyer » (10 lignes : le sujet, pourquoi maintenant, ce qu'elle peut fournir : images, témoignage, contact d'un partenaire), « Objet de l'e-mail », « Relance à 10 jours », « Si l'article paraît » (remercier, partager, demander un lien vers son site).
${SOURCES}`,
  },
};

// Mission -> format proposé par défaut
export const FORMAT_DE_MISSION: Record<string, string> = {
  MN01: "part_recherche", MN02: "part_support", MN03: "part_approche", MN04: "part_proposition",
  MN05: "part_relance", MN06: "part_relance", MER4: "part_publication", MEN2: "part_atelier",
  MG16: "part_liens", MEG5: "part_media",
};

// Missions qui proposent plusieurs formats
export const AUTRES_FORMATS: Record<string, string[]> = { MN01: ["part_recherche", "part_approche"], MN03: ["part_approche", "part_recherche"] };
