// Formats du rédacteur de pages : ce que l'agent produit pour chaque mission « site » ou « Google ».
// Partagé entre l'agent (prompt) et les tests.

export type Format = { id: string; nom: string; consigne: string; besoins?: string; multiPersona?: boolean };

const STRUCTURE_PAGE = `Structure de la page, un élément par bloc :
« Titre de la page (balise title) » : 50 à 60 caractères, la séance et la ville d'abord, son nom ensuite.
« Méta-description » : 140 à 155 caractères, ce que la personne trouvera et une invitation douce.
« Titre H1 » : le titre visible, clair, avec la séance et la ville.
« Introduction » : 2 à 4 phrases qui disent tout de suite à qui s'adresse la page et ce qu'elle apporte.
Puis une « Section : … » par partie (titre H2 dans l'étiquette, texte dans « texte »).
« Appel à l'action » : une phrase et le libellé du bouton (par exemple « Vérifier mes disponibilités »).
« Liens internes » : 2 ou 3 pages de son site vers lesquelles faire un lien depuis cette page, et inversement.`;

export const FORMATS: Record<string, Format> = {
  prestations: {
    id: "prestations", nom: "Descriptions de vos prestations", besoins: `la grille : nom de chaque prestation, prix, durée, nombre de photos livrées et ce qui est inclus`,
    consigne: `À partir de la grille tarifaire donnée, rédigez une description par prestation (un élément par prestation, etiquette = le nom de la prestation tel que les parents le comprennent).
Chaque description : 3 à 5 phrases, ce qui est inclus, la durée, ce qui est livré (galerie, tirages, album si elle en vend), pour qui c'est fait, et le prix exactement tel qu'il est donné. Aucun prix ni contenu inventé.`,
  },
  livraison: {
    id: "livraison", nom: "Options et livraison expliquées", besoins: `le délai de livraison, le fonctionnement de la galerie et ce qu'elle propose en tirages ou albums`,
    consigne: `Reformulez ses options et ses modalités de livraison en phrases simples pour les parents : délai, galerie en ligne, choix des images, tirages et albums s'il y en a, ce qui se passe ensuite.
Un élément par point (« Délai de livraison », « La galerie », « Les tirages et albums », « Après la livraison »…). Laissez [à compléter : …] pour toute information manquante.`,
  },
  arborescence: {
    id: "arborescence", nom: "Organisation de vos pages", besoins: `ses prestations et les villes où elle travaille`, multiPersona: true,
    consigne: `Proposez l'organisation de son site : une page par prestation, plus Accueil, À propos, Tarifs (ou tarifs dans chaque page), Contact, et les pages villes si elle se déplace.
Un élément par page : etiquette = nom de la page, texte = son rôle, le titre H1 proposé et les 3 à 5 sections qu'elle doit contenir ; note = la recherche Google à laquelle elle répond. Terminez par un élément « Menu conseillé » (ordre des pages dans le menu).`,
  },
  titres: {
    id: "titres", nom: "Titres et méta-descriptions de vos pages", besoins: `les séances et les villes à mettre en avant`, multiPersona: true,
    consigne: `Pour chaque page lue sur son site (liste fournie dans le contexte), proposez un titre et une méta-description.
Un élément par page : etiquette = l'adresse ou le nom de la page, texte = « Titre : … » puis à la ligne « Méta-description : … » ; note = le nombre de caractères et ce qui change par rapport à l'actuel.
Titre : 50 à 60 caractères, la séance et la ville d'abord, son nom à la fin. Méta-description : 140 à 155 caractères. Deux pages ne doivent jamais avoir le même titre.
S'il n'y a aucune page dans le contexte, proposez les titres de ses pages principales selon ses spécialités et signalez-le dans « questions ».`,
  },
  question: {
    id: "question", nom: "Réponse à une question de parent", besoins: `la question exacte et sa réponse à elle`,
    consigne: `À partir de la question exacte d'un parent et de sa réponse en vrac, rédigez une section de page ou un court article.
${STRUCTURE_PAGE}
Le titre H1 reprend la question telle que les parents la formulent. Le texte répond d'abord directement, en 2 phrases, puis détaille. 300 à 600 mots en tout.`,
  },
  recherches: {
    id: "recherches", nom: "Vos 5 recherches cibles", besoins: `ses séances et les villes de sa zone`, multiPersona: true,
    consigne: `Proposez 5 recherches Google que ses futurs clients tapent réellement, en combinant ses spécialités et les villes de sa zone (formulées comme on les tape : « photographe grossesse versailles », « séance photo bébé 1 an saint-cloud »).
Un élément par recherche : etiquette = « Recherche 1 »…, texte = la recherche, note = la page de son site qui doit y répondre (existante ou à créer) et pourquoi elle est prioritaire. Variez les séances : pas uniquement le nouveau-né.`,
  },
  zone: {
    id: "zone", nom: "Votre zone et vos modalités", besoins: `où se passent les séances, les villes desservies et les frais éventuels`,
    consigne: `Rédigez le bloc « Où se passent les séances » de son site : studio (adresse ou quartier si elle l'affiche, stationnement, accès), déplacements à domicile ou à la maternité, villes desservies, frais de déplacement s'il y en a.
Un élément par partie (« Au studio », « À domicile », « Les villes où je me déplace », « Frais de déplacement »). Uniquement les informations données ; sinon [à compléter : …].`,
  },
  deroule: {
    id: "deroule", nom: "Le déroulé de votre séance", besoins: `la durée réelle et les étapes de la séance chez elle`,
    consigne: `Rédigez la page ou la section qui décrit concrètement comment se passe une séance, étape par étape, pour que les parents se projettent et soient rassurés.
${STRUCTURE_PAGE}
Les sections suivent le vrai déroulé qu'elle décrit (avant, le jour J, après, la livraison). Durée réelle, rythme de l'enfant respecté, place des parents. 400 à 700 mots.`,
  },
  facon: {
    id: "facon", nom: "Votre façon de travailler", besoins: `son accueil, ce qu'elle fait pour la sécurité et le confort, son rythme`,
    consigne: `Rédigez la section « Ma façon de travailler » : comment elle accueille, ce qu'elle fait pour la sécurité et le confort de chacun, son rythme, ses petites attentions, ce qui la distingue (tiré des piliers).
Éléments : « Titre H2 », puis 3 à 4 « Paragraphe … » de 2 à 4 phrases chacun, à la première personne, et une « Phrase de conclusion ». Pas d'adjectifs creux : des faits.`,
  },
  hesitations: {
    id: "hesitations", nom: "Trois hésitations levées",
    consigne: `Choisissez les 3 hésitations les plus fortes du persona (dans ses inquiétudes et dans les questions données) et rédigez une réponse courte pour chacune, à placer sur la page de la séance.
Un élément par hésitation : etiquette = la question telle que les parents la poseraient, texte = la réponse en 3 à 5 phrases, chaleureuse et précise.`,
  },
  presentation_simple: {
    id: "presentation_simple", nom: "Une présentation en ligne d'une page", besoins: `ses séances, sa zone et la façon de la joindre`, multiPersona: true,
    consigne: `Pour une photographe qui n'a pas encore de site, rédigez une page unique qui présente tout l'essentiel : qui elle est, ses séances, sa zone, le déroulé en bref, ce que les familles reçoivent, comment la contacter.
${STRUCTURE_PAGE}
300 à 500 mots, simple et chaleureux.`,
  },
  cahier_charges: {
    id: "cahier_charges", nom: "Le mini-cahier des charges de votre site", besoins: `les pages voulues, son budget et ses délais`, multiPersona: true,
    consigne: `Construisez le mini-cahier des charges de son futur site, à remettre à un prestataire ou à suivre elle-même.
Éléments : « Objectif du site », « Public visé » (ses personas), « Pages à créer » (liste avec le rôle de chacune), « Contenus à fournir » (textes, photos, informations), « Fonctions indispensables » (formulaire, réservation, galerie, mobile), « Budget et délais » (uniquement ce qu'elle a donné, sinon [à compléter]), « Questions à poser au prestataire » (propriété du nom de domaine, accès, mises à jour, sauvegardes).`,
  },
  page_ville: {
    id: "page_ville", nom: "Votre page pour une deuxième ville", besoins: `des informations locales réelles sur cette ville (trajet, lieux, séances faites là-bas)`,
    consigne: `Rédigez une page dédiée à la ville indiquée, avec un contenu réellement local tiré du brief (temps de trajet, déplacement à domicile, lieux de séance en extérieur, partenaires du secteur, séances déjà faites là-bas). Jamais une page copiée où seul le nom de la ville change.
${STRUCTURE_PAGE}
400 à 600 mots. Aucune information locale inventée : sans détail réel, écrivez [à compléter : …].`,
  },
  search_console: {
    id: "search_console", nom: "Vos prochaines pages d'après la Search Console", besoins: `les requêtes copiées depuis sa Search Console`, multiPersona: true,
    consigne: `À partir des requêtes copiées depuis sa Search Console, repérez les 3 recherches qui méritent une page ou une section (beaucoup d'impressions, peu de clics, ou une position entre 5 et 20).
Un élément par page proposée : etiquette = la recherche, texte = le titre H1 proposé, le plan en 3 à 5 sections et la page existante à enrichir ou à créer ; note = les chiffres de la requête qui justifient ce choix.`,
  },
  guide: {
    id: "guide", nom: "Votre guide de référence pour les parents", besoins: `ses vrais conseils sur ce thème`,
    consigne: `Rédigez un guide complet sur le thème donné, qui devienne LA page de référence que les parents gardent et partagent (par exemple : préparer sa séance, que porter, quand réserver).
${STRUCTURE_PAGE}
700 à 1 200 mots, avec ses conseils à elle (brief) en priorité, organisés en 5 à 7 sections claires. Ajoutez une section « Questions fréquentes » de 3 questions.`,
  },
};

// Mission -> format proposé par défaut
export const FORMAT_DE_MISSION: Record<string, string> = {
  MF05: "prestations", MF08: "livraison", MG08: "arborescence", MG09: "titres", MG10: "question", MG18: "recherches",
  MS02: "zone", MS03: "deroule", MS06: "facon", MS07: "hesitations", MSW1: "presentation_simple", MSW2: "cahier_charges",
  MEG2: "page_ville", MEG3: "search_console", MEG4: "guide",
};
