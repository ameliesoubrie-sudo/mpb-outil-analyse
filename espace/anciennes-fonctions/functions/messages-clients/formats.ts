// Formats du rédacteur de messages clients : les messages envoyés aux familles avant et après la séance.
// Partagé entre l'agent (prompt) et les tests.

export type Format = { id: string; nom: string; consigne: string; besoins?: string; multiPersona?: boolean };

const PERSO = `Si le brief donne une famille précise (prénoms des parents, séance, souvenir), écrivez le message pour ELLE, prêt à envoyer.
Sinon, écrivez un modèle à enregistrer dans son logiciel de gestion : les variables entre crochets ([Prénom], [lien de la galerie]…), et UNE phrase personnelle à compléter à chaque envoi, signalée par [à personnaliser : un souvenir précis de la séance].`;

export const FORMATS: Record<string, Format> = {
  apres_livraison: {
    id: "apres_livraison", nom: "Votre message d'après livraison",
    besoins: `sa façon de livrer (galerie en ligne, coffret, tirages), le canal d'envoi (e-mail, SMS, message) et un souvenir ou une habitude de fin de séance qui lui est propre`,
    consigne: `Rédigez le message envoyé 2 à 3 jours après la livraison, quand la famille a eu le temps de regarder ses images.
Ordre : prendre des nouvelles et vérifier que tout est bien reçu (la galerie s'ouvre, le coffret est arrivé), une phrase personnelle sur la séance, la demande d'avis simple avec le lien direct, une phrase qui dit qu'elle sera heureuse d'accueillir leurs proches, la signature.
${PERSO}
Éléments : « Moment d'envoi », « Objet » (si e-mail), « Message », « Relance unique » (10 jours plus tard, 2 à 3 phrases, sans insistance), « Version courte » (SMS ou message, 300 caractères maximum).
L'avis se demande à toutes les familles, sans orienter la note ni le contenu (jamais « 5 étoiles ») et sans aucune contrepartie.`,
  },
  apres_livraison_simple: {
    id: "apres_livraison_simple", nom: "Votre premier message après livraison",
    besoins: `sa façon de livrer et le canal d'envoi`,
    consigne: `Pour une photographe qui démarre : un message court et simple, à préparer maintenant et à envoyer seulement après une vraie livraison.
Ordre : remercier, vérifier que tout est bien reçu, une phrase personnelle, la demande d'avis avec le lien direct, la signature. 80 à 120 mots.
${PERSO}
Éléments : « Quand l'envoyer », « Objet » (si e-mail), « Message », « Relance unique » (10 jours plus tard, 2 phrases).
L'avis se demande à toutes les familles, sans orienter la note ni le contenu et sans aucune contrepartie.`,
  },
  seance_suivante: {
    id: "seance_suivante", nom: "La séance suivante proposée à la livraison",
    besoins: `la séance livrée, la séance suivante logique, l'avantage proposé et sa date limite`,
    consigne: `Rédigez la proposition de la séance suivante, glissée dans la livraison, au moment où l'émotion est au plus haut.
Suites logiques : grossesse vers nouveau-né, nouveau-né vers 6 mois ou 1 an, 1 an vers 2 ou 3 ans ou famille, famille vers l'année suivante. Adaptez à l'histoire de la famille si elle est donnée.
Éléments : « Paragraphe de livraison » (dans l'e-mail ou la galerie, 3 à 5 phrases : ce qui l'émeut dans la prochaine étape de l'enfant, la proposition concrète, l'avantage et sa date limite exacte, comment réserver), « Texte de la carte » (à glisser dans le coffret, 25 à 40 mots), « Relance douce » (quelques jours avant la date limite, 2 à 3 phrases, sans pression), « Rappel au bon moment » (le message à programmer quand la séance suivante devra être planifiée).
Aucun avantage, prix ou date inventé : [à compléter : …] s'il manque.
${PERSO}`,
  },
  parrainage: {
    id: "parrainage", nom: "Votre programme de parrainage", multiPersona: true,
    besoins: `l'avantage pour la famille qui recommande, l'attention pour la nouvelle famille et le moment où l'avantage est acquis`,
    consigne: `Rédigez son programme de parrainage, qui remercie le bouche-à-oreille sans jamais le confondre avec les avis.
Éléments : « Les règles en 3 lignes » (qui peut parrainer, quand l'avantage est acquis, comment le demander), « Texte de la carte » (à glisser dans chaque livraison, 30 à 50 mots), « Message aux familles » (pour présenter le programme, par e-mail ou message), « Remerciement à la famille qui recommande » (personnel et chaleureux, c'est le plus important), « Bienvenue à la famille recommandée », « Phrase pour votre site ».
Jamais d'avantage en échange d'un avis : le parrainage récompense une recommandation, pas un avis en ligne.`,
  },
  premiere_annee: {
    id: "premiere_annee", nom: "Votre formule première année et ses messages",
    besoins: `les séances incluses, ce qui est livré, le prix, l'échéancier de paiement et les conditions (délais, report)`,
    consigne: `Rédigez la présentation de sa formule première année (naissance, 6 mois, premier anniversaire, et éventuellement un album final) et les messages de chaque étape.
Éléments : « Présentation de la formule » (pour sa page nouveau-né ou sa confirmation de réservation, 80 à 140 mots, avec le contenu et le prix exactement tels que donnés), « Message à la réservation nouveau-né » (la proposer sans pression), « Rappel à 5 mois » (inviter à choisir la date de la séance 6 mois), « Rappel à 11 mois » (pour le premier anniversaire), « Message de fin » (la première année réunie, l'album s'il existe, et une ouverture vers la suite).
Les conditions ne sont jamais rédigées comme un contrat : listez dans « a_completer » les points à écrire et rappelez qu'au moindre doute elle peut prendre attache auprès d'un professionnel du droit.
Aucun prix, délai ni condition inventés.`,
  },
  questionnaire: {
    id: "questionnaire", nom: "Votre questionnaire de satisfaction", multiPersona: true,
    besoins: `le canal d'envoi et le délai après la livraison`,
    consigne: `Rédigez le questionnaire privé envoyé une semaine après la livraison, avant la demande d'avis public.
Éléments : « Question 1 », « Question 2 », « Question 3 », « Question 4 » (dans cet ordre : sur 10, recommanderiez-vous la séance à un proche ; ce que la famille a préféré ; ce qui aurait pu être mieux ; son accord pour être citée), « Message d'envoi » (court, qui dit que c'est 2 minutes et que tout est lu personnellement), « Message après une note de 8 ou moins » (proposer un échange par téléphone, sans se justifier), « Remerciement ».
Rappel dans « angle » : la demande d'avis Google part à toutes les familles, quelle que soit leur note.`,
  },
  synthese: {
    id: "synthese", nom: "La synthèse des réponses du mois", multiPersona: true,
    besoins: `les réponses au questionnaire du mois, copiées telles quelles`,
    consigne: `À partir des réponses copiées dans le brief, faites la synthèse du mois pour la photographe (ces textes s'adressent à ELLE, en vouvoiement).
Éléments : « Note moyenne » (calculée sur les notes données, avec le nombre de réponses), « Ce qui revient le plus » (ses forces citées au moins deux fois, avec les mots des familles entre guillemets), « Ce qui peut s'améliorer » (uniquement ce qui est écrit dans les réponses), « Familles à rappeler » (notes de 8 ou moins, sans données personnelles inutiles), « Phrases à reprendre » (2 ou 3 citations utilisables avec l'accord des familles), « Une action pour le mois prochain ».
N'inventez ni réponse, ni note, ni tendance : sans réponse dans le brief, dites-le dans « questions ».`,
  },
  appel_decouverte: {
    id: "appel_decouverte", nom: "Votre appel découverte",
    besoins: `l'outil ou le lien de prise de rendez-vous, la durée de l'appel et les formules qu'elle y présente`,
    consigne: `Rédigez tout ce qu'il faut pour proposer un appel découverte de 15 minutes et le mener.
Éléments : « Message qui propose l'appel » (en réponse à une demande, 3 à 5 phrases, avec le lien de rendez-vous), « Déroulé en 15 minutes » (3 min leur histoire et leurs attentes, 5 min sa façon de travailler, 5 min la séance qui leur correspond, 2 min la suite ; avec 2 ou 3 questions à poser, tirées des inquiétudes du persona), « Récapitulatif après l'appel » (le message qui reprend ce qui a été dit et donne le lien de réservation), « Relance douce à 3 jours ».
Écoute d'abord : les questions de l'appel portent sur la famille, pas sur la photographe.`,
  },
};

// Mission -> format proposé par défaut
export const FORMAT_DE_MISSION: Record<string, string> = {
  MN07: "apres_livraison", MNW1: "apres_livraison_simple", MEN5: "seance_suivante", MEN1: "parrainage",
  MEN3: "premiere_annee", MEN7: "questionnaire", MES5: "appel_decouverte",
};

// Missions qui proposent plusieurs formats
export const AUTRES_FORMATS: Record<string, string[]> = { MEN7: ["questionnaire", "synthese"] };
