// Formats du stratège de marque : positionnement, expérience signature, récits de familles,
// identité visuelle (à partir de ses photos) et mini charte.
// Partagé entre l'agent (prompt) et les tests.

export type Format = { id: string; nom: string; consigne: string; besoins?: string; multiPersona?: boolean; images?: boolean };

export const FORMATS: Record<string, Format> = {
  positionnement: {
    id: "positionnement", nom: "Votre page de positionnement", multiPersona: true,
    besoins: `qui sont ses meilleures familles (les 10 avec qui tout s'est le mieux passé : ce qu'elles cherchaient, d'où elles venaient), quelques phrases tirées de ses avis, et ce qu'elle fait que d'autres ne font pas`,
    consigne: `Construisez sa page de positionnement, en partant du réel (ses meilleures familles, ses avis), jamais de la concurrence.
Sa carte d'identité contient déjà une promesse et des piliers : ne les recopiez pas, confrontez-les à ce qu'elle raconte maintenant. Si quelque chose a changé ou sonne faux, dites-le dans « angle ».
Éléments, dans cet ordre :
« Pour qui je travaille » (une phrase sur son client idéal, tirée de vraies familles),
« Ma promesse » (ce que la famille vit et emporte, en une phrase),
« Mes 3 valeurs » (trois mots que ses clients pourraient employer, chacun suivi entre parenthèses de la phrase d'avis qui le prouve ; sans preuve, [à vérifier dans vos avis]),
« Ma différence » (2 ou 3 phrases concrètes : sa lumière, son accompagnement, son lieu, sa spécialité),
« Ce à quoi je dis non » (ce qu'elle cesse de proposer ou les demandes qu'elle oriente ailleurs : choisir, c'est renoncer),
« Les écarts à corriger » (ce que son site, sa fiche ou ses réseaux disent d'autre, d'après le contexte ; sinon [à compléter]),
« En une phrase » (le positionnement complet, à garder sous les yeux).
Pas de valeurs que tout le monde a (« professionnalisme », « passion », « qualité ») : si c'est ce qui ressort, cherchez plus précis avec elle dans « questions ».`,
  },
  experience_signature: {
    id: "experience_signature", nom: "Votre expérience signature", multiPersona: true,
    besoins: `ce que les familles retiennent dans ses avis, la durée de ses séances, et les attentions qu'elle a déjà (ou aimerait avoir)`,
    consigne: `Définissez avec elle 4 moments signature que chaque famille vivra, toujours les mêmes, toujours soignés : un avant (la préparation), un à l'arrivée, un pendant, un après (la découverte des images, la livraison, les produits).
Partez de ce que les familles retiennent déjà dans ses avis et de ce qu'elle fait déjà : on renforce ce qui lui ressemble, on n'invente pas une hôtesse d'accueil.
Éléments : « Avant la séance », « À l'arrivée », « Pendant », « Après » ; pour chacun, « texte » = ce que la famille voit, entend ou reçoit, en une ou deux phrases concrètes ; « note » = le coût par séance s'il est connu (sinon [à chiffrer]) et la tâche à créer dans son workflow.
Puis « Ce qu'il faut prévoir » (achats, stock, vérification des allergies si collation : gâteaux emballés individuellement), et « Comment le montrer » (3 idées de contenus : coulisses du studio, préparation de l'arrivée d'une famille, la pause goûter, les produits qui attendent ; avec pourquoi elle fonctionne ainsi).
Une attention n'a pas besoin d'être chère : elle doit être constante. Pensez au confort des parents (femme enceinte, jeune maman, parents fatigués).`,
  },
  recit_famille: {
    id: "recit_famille", nom: "Une histoire de famille complète",
    besoins: `la séance concernée, ce que la famille attendait ou craignait en arrivant, un moment fort précis de la séance, et ce que la famille a dit ou écrit à la livraison (avec leurs mots)`,
    consigne: `Rédigez l'histoire complète d'une famille accompagnée, du premier message à la livraison, pour sa page de prestation ou son blog.
Éléments : « Titre », « Leur attente » (ce qu'ils cherchaient, ce qui les inquiétait), « Le jour de la séance », « Le moment fort » (un instant précis, raconté), « La livraison » (leur réaction, avec leurs mots entre guillemets s'ils sont donnés), « Les images à choisir » (5 à 8 images qui racontent, décrites en une ligne chacune, pas seulement les plus belles), « Lien vers la prestation » (la page à relier et la phrase d'invitation), « Pour la recycler » (un carrousel, un paragraphe de newsletter, un post Google).
Discrétion : pas de nom de famille, pas de détail médical, pas de lieu de vie ; prénoms d'enfants seulement s'ils sont donnés et autorisés.
Rappel dans « a_completer » : l'accord écrit de la famille pour le récit et les images, avec la liste des supports.`,
  },
  accompagnement: {
    id: "accompagnement", nom: "Votre accompagnement montré concrètement",
    besoins: `soit un retour de famille autorisé (avec ses mots et sa date), soit le déroulé réel de sa préparation d'une séance`,
    consigne: `Rédigez un bloc pour son site qui montre son accompagnement de façon concrète.
S'il y a un retour de famille autorisé dans le brief : « Le retour », cité tel quel avec le prénom et le mois si elle les donne, puis « Ce qu'il raconte » (2 ou 3 phrases d'elle sur ce moment).
S'il n'y en a pas : expliquez la préparation réelle d'une séance (« Avant », « Le jour J », « Après ») avec ce qu'elle fait vraiment. Jamais de témoignage inventé, jamais de « une maman m'a dit » sans source.
Terminez par « Appel à l'action » (une phrase douce et le bouton « Vérifier mes disponibilités »).`,
  },
  identite_visuelle: {
    id: "identite_visuelle", nom: "Votre identité visuelle", multiPersona: true, images: true,
    besoins: `quelques-unes de ses photos préférées (jointes), et ce qu'elle a déjà (logo, couleurs du site, fiche)`,
    consigne: `À partir de ses photos jointes (regardez-les vraiment : lumière, tonalités, saturation, contraste, ambiance) et de ce qu'elle a déjà, proposez son identité visuelle.
Éléments :
« Ce que disent vos images » (3 ou 4 phrases d'observation précise sur SES photos : couleurs dominantes, lumière, ambiance ; c'est ce qui prouve que la proposition vient d'elles),
« Couleur principale », « Couleur douce », « Fond », « Couleur du texte » (pour chacune : le code au format #RRGGBB au début du texte, puis pourquoi elle va avec ses photos ; la couleur du texte doit rester très lisible sur le fond),
« Police des titres » et « Police des textes » (des polices disponibles gratuitement dans Canva et sur Google Fonts ; une élégante ou graphique pour les titres, une très lisible pour les textes),
« Mon style d'images en 3 mots »,
« Ma planche Canva » (ce qu'elle y met : couleurs, polices, logo, 6 images types, décrites),
« À harmoniser » (photo de profil, couvertures de stories à la une, bio, site : ce qui doit changer).
Les couleurs mettent ses photos en valeur, elles ne les concurrencent pas. Si elle a déjà des couleurs, partez-en : tout doit se ressembler.
Sans photo jointe, appuyez-vous sur les mots de son style d'images et dites dans « questions » qu'une proposition faite à partir de ses images sera plus juste.`,
  },
  charte: {
    id: "charte", nom: "Votre mini charte et les écarts à corriger", multiPersona: true, images: true,
    besoins: `son logo, ses couleurs et polices actuelles, son ton (vous ou tu), et les outils qui envoient ses documents (logiciel de gestion, galerie, e-mails)`,
    consigne: `Écrivez sa mini charte d'une page, puis vérifiez la cohérence de tout ce qu'une famille reçoit d'elle.
Éléments : « Logo » (versions et usages), « Couleurs » (2 ou 3, avec leur code #RRGGBB s'ils sont donnés ou visibles sur les images jointes), « Typographies » (1 ou 2), « Ton » (vous ou tu, chaleureux ou sobre, 3 règles), « Signature d'e-mail » (le texte complet, prêt à coller),
puis « Les écarts à corriger » : un point par support (site, Instagram, fiche Google, fiche Mon Photographe Bébé, devis, contrat, factures, e-mails, galerie), en disant ce qui ne colle pas d'après le contexte, ses réponses ou les captures jointes ; si vous ne savez pas, écrivez [à vérifier] plutôt que d'inventer,
et « Le parcours test » (la liste de ce qu'elle doit recevoir en se créant un projet test, du devis à la livraison).
Mentions légales des documents : signalez seulement qu'elles doivent être à jour, et qu'au moindre doute elle peut prendre attache auprès d'un professionnel du droit.`,
  },
};

// Mission -> format proposé par défaut
export const FORMAT_DE_MISSION: Record<string, string> = {
  MES7: "positionnement", MES6: "experience_signature", MES4: "recit_famille", MS08: "accompagnement",
  MC1: "identite_visuelle", MES8: "charte",
};

export const AUTRES_FORMATS: Record<string, string[]> = {};
