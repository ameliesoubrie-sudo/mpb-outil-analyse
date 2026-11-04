# Charte graphique - Mon Photographe Bébé

## 1. Statut, source et périmètre

**Ce document est le référentiel graphique commun à appliquer à toutes les créations et évolutions de Mon Photographe Bébé.**

Il formalise la charte fournie par le client le **18 octobre 2026**, dans le texte intitulé « Mon Photographe Bébé - La charte graphique de Mon Photographe Bébé, l’annuaire et la plateforme d’accompagnement… », associé à cet [artefact de référence](https://claude.ai/artifact/CzeXJyhwrhvgKX96SGYtAj). Les règles et valeurs ci-dessous proviennent du texte transmis directement par le client.

La marque s’adresse aux photographes spécialisés en grossesse, naissance, bébé, enfant et famille, de la grossesse aux 3 ans de l’enfant.

Le référentiel couvre :

- le site public destiné aux parents, ses pages éditoriales, l’annuaire, les fiches et les parcours de demande ;
- les pages publiques Pro, l’espace Pro connecté et ses outils ;
- le back-office et les écrans d’administration ;
- les deux blogs WordPress, leurs articles et leur éditeur ;
- les composants communs, la navigation, les formulaires et les messages d’interface ;
- les newsletters, les visuels destinés aux réseaux sociaux et les documents.

Les anciennes maquettes, les captures de recette et les feuilles CSS existantes décrivent des versions antérieures ou un état d’implémentation. Elles ne constituent pas des exceptions à cette charte. En cas de contradiction graphique, appliquer ce référentiel, sauf nouvelle consigne explicite du client.

Les sections 2 à 11 reprennent les règles et tokens de la charte. Les sections 12 à 15 précisent leur intégration technique et leur contrôle. L’état d’application, les pages préservées et les limites de vérification sont consignés en section 14 et dans le compte rendu de recette lié.

## 2. Esprit de la marque

**Léger, expert et chaleureux.**

La composition repose sur beaucoup de blanc, une police fine, des touches de pastel et un seul mot écrit à la main dans un titre. La photographie et le contenu occupent la place principale. Les ornements restent peu nombreux et servent la composition.

À rechercher :

- une hiérarchie lisible, avec des titres extra-fins et des textes concrets ;
- des espaces réguliers et généreux ;
- une présence discrète des couleurs pastel ;
- des actions principales immédiatement identifiables ;
- la même identité entre les univers Parents, Pro et administration.

## 3. Ton et écriture

- S’adresser aux photographes en **vous**.
- Utiliser des phrases courtes, concrètes et sans jargon.
- Parler de **familles**, de **séances**, de **visibilité** et de **demandes**.
- Ne pas utiliser de tiret long dans les textes. Employer un tiret simple ou une virgule.
- Ne jamais citer le nom d’un outil d’IA.

### Vocabulaire maison

| Sujet | Formulation à employer |
| --- | --- |
| Bilan de visibilité | « notre outil d’analyse » |
| Outils d’accompagnement de la formule complète | « studios de création » |
| Rythme des missions | « missions chaque semaine » |

### Exemples de titres fournis

- « Arrêtez de chercher des clients. Laissez-les vous trouver. »
- « Un parcours de formation guidé, étape par étape, pour booster votre visibilité »

Ces exemples illustrent le ton. Ils n’imposent pas de remplacer tous les titres existants par les mêmes phrases.

## 4. Palette de couleurs

### Tokens de référence

| Token couleur | Valeur exacte | Usage |
| --- | --- | --- |
| `bordeaux` | `#9b2f45` | Actions principales, surtitres, mot manuscrit, chiffres, coches et tracés de la signature |
| `encre` | `#474746` | Titres et textes d’interface mis en avant |
| `texte` | `#5f5f5d` | Texte courant |
| `texte-discret` | `#737371` | Légendes et informations secondaires |
| `rose` | `#f6dce0` | Surligneur, pastilles et aplats pastel |
| `peche` | `#fce2d2` | Surligneur, pastilles et aplats pastel |
| `sauge` | `#e2ece1` | Surligneur, pastilles et aplats pastel |
| `trait` | `#ebdcda` | Traits de séparation et bordures discrètes |
| `sur-bordeaux` | `#ffffff` | Texte et signes sur les boutons principaux bordeaux |
| `fond` | `#ffffff` | Fond blanc |
| `fond-poudre` | `#fbf5f3` | Fond poudré des sections alternées |
| `gris-bouton` | `#f3eeec` | Fond des boutons secondaires |

### Règles d’association

1. Le bordeaux est **la seule couleur forte**. Ne pas l’utiliser en grand aplat de fond.
2. Les textes utilisent les gris chauds. Ne pas introduire de noir pur.
3. Faire tourner rose, pêche et sauge d’une section à l’autre pour varier les accents.
4. Alterner les sections `fond` et `fond-poudre`. Ne pas placer deux sections successives sur le même fond.
5. Réserver les pastels aux accents, pastilles et aplats prévus. Un pastel ne remplace pas la couleur du texte courant.

Les cartes, champs ou cellules à l’intérieur d’une section ne sont pas chacun une nouvelle section. L’alternance se lit à l’échelle des bandes et ensembles de la page.

## 5. Typographie

### Familles et graisses

| Famille | Graisses prévues | Utilisation |
| --- | --- | --- |
| **Mulish** | `200`, `300`, `600` | Toute la typographie de l’interface et des contenus, hors accents manuscrits et prénoms |
| **Nothing You Could Do** | `400`, Regular | Un mot manuscrit par titre au maximum, ainsi que le traitement des prénoms |

- Titres : Mulish extra-fin, `200`.
- Texte : Mulish fin, `300`.
- Titres de bloc, sous-titres et boutons : Mulish semi-gras, `600`.
- Surtitres et boutons : majuscules espacées.
- Ne pas remplacer ces familles par une police ronde, une police à empattements ou une police fantaisie.

**Semi-gras signifie `600`, Light signifie `300`. Le Regular `400` du tableau concerne la police manuscrite, pas une nouvelle graisse Mulish à ajouter au contrat.**

### Styles typographiques exacts

Les tailles sont en pixels, sauf `mot-manuscrit`, dont la taille est relative au titre. Les interlignes sans unité sont des multiplicateurs.

| Token typographique | Famille | Taille | Interligne | Graisse | Espacement / casse |
| --- | --- | --- | --- | --- | --- |
| `titre-hero` | Mulish | `62px` | `1.18` | `200` | Casse naturelle |
| `titre-section` | Mulish | `44px` | `1.25` | `200` | Casse naturelle |
| `titre-bloc` | Mulish | `20px` | `1.3` | `600` | Casse naturelle |
| `chiffre-etape` | Mulish | `56px` | `1` | `200` | Bordeaux |
| `chapeau` | Mulish | `19px` | `1.7` | `300` | Casse naturelle |
| `texte` | Mulish | `17px` | `1.65` | `300` | Casse naturelle |
| `texte-petit` | Mulish | `15px` | `1.6` | `300` | Casse naturelle |
| `legende` | Mulish | `13px` | `1.5` | `300` | Casse naturelle |
| `sur-titre` | Mulish | `13px` | `16px` | `600` | `0.16em`, majuscules |
| `bouton` | Mulish | `13px` | `16px` | `600` | `0.07em`, majuscules |
| `mot-manuscrit` | Nothing You Could Do | `1.12em` | `1` | `400` | Bordeaux |
| `prenom` | Nothing You Could Do | `38px` | `1.15` | `400` | Casse naturelle |

`sur-titre` et `bouton` ont un interligne absolu de **16 pixels**, pas un multiplicateur de 16.

### Mot manuscrit

- Au maximum **un mot manuscrit par titre**. Une expression de plusieurs mots ne compte pas comme un seul mot.
- Taille de `1.12` fois celle du titre, en bordeaux.
- Ne jamais appliquer le manuscrit et le surligneur au même mot.
- Ne pas composer une phrase, une description ou un paragraphe entier en manuscrit.
- Le style `prenom` sert au traitement des prénoms. Il ne remplace pas la typographie des biographies ou des fonctions.

Exemple de calcul : dans un titre à `44px`, le mot manuscrit mesure `49.28px`. La relation reste relative lorsque le titre s’adapte à l’écran.

## 6. Mise en page et rythme

### Géométrie commune

| Règle | Ordinateur | Téléphone |
| --- | --- | --- |
| Largeur maximale du contenu | `1240px` | Largeur disponible, sans débordement |
| Gouttières latérales | `64px`, soit `space-7` | `24px`, soit `space-4` |
| Espacement haut et bas d’une section | `104px`, soit `space-8` | `72px` |
| Colonnes | Composition adaptée au contenu | Colonnes empilées |

**Évolution demandée le 18 octobre 2026 :** le site Parents utilise désormais un maximum de `1440px`, afin d’élargir sa zone centrale. Le socle `1240px` reste celui du Pro et de l’administration. Cette adaptation, détaillée en section 12, remplace la largeur du tableau uniquement pour les interfaces Parents.

Le rythme `104px` / `72px` concerne les sections de page. Il ne doit pas être répété comme padding de chaque carte, cellule de tableau, champ ou ligne d’une liste.

### Échelle d’espacement

| Token | Valeur exacte |
| --- | --- |
| `space-1` | `4px` |
| `space-2` | `8px` |
| `space-3` | `14px` |
| `space-4` | `24px` |
| `space-5` | `40px` |
| `space-6` | `56px` |
| `space-7` | `64px` |
| `space-8` | `104px` |

L’échelle n’est pas une suite générique de multiples de huit : `space-3` vaut **14px** et `space-8` vaut **104px**. Le rythme mobile de section à `72px` est une règle explicite supplémentaire.

### Rayons

| Token | Valeur exacte | Usage |
| --- | --- | --- |
| `radius-photo-petite` | `18px` | Petites photographies |
| `radius-photo` | `24px` | Photographies principales |
| `radius-pilule` | `999px` | Boutons |
| `radius-rond` | `50%` | Pastilles rondes |

## 7. Signature graphique

### Surligneur

- Surligner **un ou deux mots clés**, avec une bande de pastel sur la moitié basse du texte.
- Au maximum **une plage de surlignage par titre**.
- Garder une bande unie, comme un trait de feutre. Ne pas en faire un fond dégradé.
- Choisir un autre mot pour l’éventuel accent manuscrit.

### Aplats pastel derrière une photo ou une pastille

- Formes douces et irrégulières.
- Rose, pêche ou sauge.
- Débordement possible derrière la photo ou la pastille, sans empiéter sur la lecture.

### Pastilles

- Rond pastel rose, pêche ou sauge.
- Icône au trait bordeaux.
- Libellé associé au pictogramme.

### Traits d’énergie, appelés « guillemets » dans la charte

- Chaque motif est composé de **trois petits traits bordeaux**.
- Utiliser **deux à quatre motifs par section**.
- Les poser en coin d’un titre, d’un bouton, d’une pastille ou d’un prénom.
- Les orienter vers l’élément qu’ils animent.
- Ne jamais les coller au texte ni les faire passer dessus.

### Aplats d’angle

- Forme pastel aux bords arrondis, dans un coin haut droit ou bas gauche de la section.
- Un trait bordeaux fin accompagne sa courbe.
- Préférer ces formes aux grands ronds pour habiller les fonds.
- Utiliser **un ou deux aplats par section**, placés en diagonale.
- Ne jamais les placer derrière un texte.

### Ligne courbe

- Trait fin bordeaux à **35 % d’opacité**.
- Relie des étapes ou des points numérotés.
- Reste un élément de liaison. Elle ne doit pas traverser les libellés ou gêner les contrôles.

### Règle de composition d’un titre

Un titre peut associer au maximum :

1. une plage de surlignage sur un ou deux mots ;
2. un seul autre mot en manuscrit.

Le reste du titre reste en Mulish extra-fin.

## 8. Iconographie

### Style des icônes

- Tracé fin de **1,5**.
- Coins arrondis.
- Couleur bordeaux.
- Icône posée dans une pastille ronde rose, pêche ou sauge.
- **Toujours un libellé à côté d’un pictogramme.**

Pour les SVG du site, utiliser `currentColor` pour que le tracé hérite du bordeaux du composant. Le nom accessible d’une action ne doit pas dépendre d’un pictogramme seul.

### Bibliothèque annoncée par la charte

La bibliothèque **Pictogrammes** comprend **60 pictogrammes SVG bordeaux**, prévus pour Canva ou Figma, dans quatre familles :

- séance et sécurité ;
- clients et prestations ;
- site et référencement ;
- réseaux et contenus.

La collection **Icones** correspond aux icônes de la page photographes, destinées au site en `currentColor`.

Le texte transmis ne contient pas les fichiers de cette bibliothèque ni la liste de ses 60 fichiers. Cette description ne vaut pas inventaire des SVG déjà présents dans le dépôt. Ne pas substituer une bibliothèque de style différent et la présenter comme celle de la charte.

Les pictogrammes servent à expliquer une action ou une information. **Pas de cœur ni de pictogramme décoratif.** Les traits d’énergie et les formes de la signature ont leur propre rôle, distinct de celui des pictogrammes.

## 9. Photographies

- Photos lumineuses, aux tons chauds et naturels.
- Coins arrondis : `radius-photo`, ou `radius-photo-petite` pour les petits visuels.
- Une photo importante peut recevoir un aplat pastel qui déborde derrière elle.
- Les photographies détourées avec fond transparent se posent directement sur un **fond blanc**.

Déclinaison technique : préserver les proportions, la qualité et la transparence des fichiers. Adapter le cadrage au contenant sans étirer les visages ou le corps. Vérifier le rendu sur téléphone, y compris lorsqu’un conteneur passe de plusieurs colonnes à une pile verticale.

Les interdits de la charte s’appliquent aussi aux ornements intégrés dans un fichier image. Un cœur présent dans un montage existant ne devient pas conforme parce qu’il est incorporé à la photo.

## 10. Boutons et catalogue de composants

### Boutons

| Variante | Fond | Texte | Forme | Typographie |
| --- | --- | --- | --- | --- |
| Principal | `bordeaux` | `sur-bordeaux` | `radius-pilule` | Style `bouton` |
| Secondaire | `gris-bouton` | Gris chaud de la palette | `radius-pilule` | Style `bouton` |

Les libellés utilisent Mulish `600`, `13px / 16px`, en majuscules avec `0.07em` d’espacement. Ne pas transformer une action secondaire en bouton à contour épais ou en aplat d’une autre couleur forte.

### Noms des composants de la charte

Conserver ces noms dans le référentiel et les discussions de conception :

| Composant | Fonction et règles |
| --- | --- |
| `AplatAngle` | Forme pastel d’angle avec courbe bordeaux fine, sans texte superposé |
| `Bouton` | Action principale bordeaux ou secondaire gris-bouton, en pilule |
| `Etape` | Étape avec chiffre Mulish fin, libellé et contenu explicatif |
| `IconePastille` | Pictogramme au trait bordeaux dans un rond pastel, avec libellé |
| `LigneCourbe` | Liaison bordeaux fine à 35 % d’opacité |
| `ListeCochee` | Liste avec coches bordeaux et textes lisibles |
| `MotManuscrit` | Un mot par titre au maximum, en Nothing You Could Do, bordeaux, à `1.12em` |
| `PhotoAplat` | Photo lumineuse arrondie avec une forme pastel débordante |
| `Pictogrammes` | Bibliothèque de 60 SVG bordeaux, distincte des ornements |
| `Prenom` | Prénom en Nothing You Could Do, `38px / 1.15`, Regular |
| `SurTitre` | Mulish `600`, `13px / 16px`, capitales espacées à `0.16em` |
| `Surligneur` | Une bande pastel sur la moitié basse d’un ou deux mots clés |
| `TraitsEnergie` | Trois petits traits bordeaux orientés vers l’élément accompagné |

Ces noms décrivent les composants attendus. Ils ne signifient pas que des composants techniques portant exactement ces noms existent déjà dans le code.

## 11. Interdits

- Cœurs, emoji et étoiles.
- Pictogrammes purement décoratifs.
- Dessins décoratifs autres que les traits d’énergie, les aplats et la ligne courbe prévus par la charte.
- Ombres portées, dégradés et contours épais.
- Noir pur et couleurs vives autres que le bordeaux.
- Grands aplats de fond bordeaux.
- Plusieurs mots manuscrits dans un même titre.
- Paragraphes entiers en manuscrit.
- Manuscrit et surligneur sur le même mot.
- Plusieurs plages de surlignage dans un même titre.
- Polices rondes, à empattements ou fantaisie.
- Deux sections successives sur le même fond.

Ces règles valent aussi pour un ancien composant ou un asset repris d’une maquette antérieure.

## 12. Déclinaison dans l’interface et responsive

Cette section traduit les règles dans le produit. Elle ne fournit pas de nouvelles valeurs attribuées à la charte.

### Cohérence entre surfaces

- Réutiliser les mêmes familles, couleurs, styles typographiques et composants entre le public, le Pro, l’administration et les blogs.
- Une page privée ou un formulaire n’autorise pas une autre famille de caractères.
- Les cartes, tableaux, champs et messages utilisent la palette et les tokens communs. Leur fonction et leur densité ne doivent pas créer une nouvelle identité.
- Le logo reste un fichier graphique fourni. Ne pas le recréer avec une police Web. Les fichiers et licences sont documentés dans [l’annexe d’identité visuelle](identite-visuelle.md) ; leur conformité aux nouveaux usages reste distincte de leur provenance technique.

### Largeur Parents, évolution du 18 octobre 2026

À la demande explicite du client, le site Parents emploie une largeur maximale de conteneur de **1440px**, au lieu du socle de 1240px. Les gouttières restent de 64px sur ordinateur et de 24px sur téléphone, soit une zone utile de 1312px au maximum sur grand écran. Les tailles de texte ne sont pas augmentées et les images de l’annuaire restent bornées à 300px de hauteur.

- Le périmètre `parents-site` surcharge `--mpb-content-max` sur le body, sans modifier le token racine utilisé par le Pro et l’administration.
- Le hero, les étapes, les engagements, les profils, les articles et le pied de page partagent les mêmes bords de contenu.
- L’illustration du hero appartient à la grille du conteneur. Ne pas la positionner dans un autre canvas calculé depuis le viewport.
- Les paragraphes et formulaires conservent leurs limites internes de lecture. Une largeur de page supérieure n’impose pas des lignes de texte illimitées.
- Les deux pages Pro fournies et validées restent préservées.

### Page Programme Pro, reprise du 19 octobre 2026

Après la première intégration de `mpb-page-programme.zip`, la cliente signale une qualité de mise en page insuffisante, notamment des arrondis manquants. Le client demande de retravailler `/ressources-photographes` et sollicite un choix de direction. L’arbitrage annoncé consiste à retrouver la composition et les proportions du HTML fourni, en conservant l’identité commune.

Cette reprise prévoit une exception locale pour les titres de cette page publique Pro : hero à **46px / 1.2**, titres de section à **42px / 1.22** sur ordinateur, conformément au HTML source. Ces valeurs ne remplacent ni les tokens communs `62px` et `44px`, ni les règles des autres pages. Elles ne s’étendent pas à l’espace membre, à l’administration, au site Parents ou à WordPress. Les adaptations mobiles restent propres au rendu responsive, à vérifier séparément.

La fidélité porte également sur les surfaces arrondies, la séparation des blocs, les superpositions, les aplats pastel et la hiérarchie des contenus. Elle n’autorise pas à reprendre les ombres, dégradés, boutons à contour ou expressions manuscrites de plusieurs mots présents dans la source. Palette, familles et graisses, mot manuscrit unique, largeur Pro et espacements communs restent applicables. La [recette de la page Programme](qa/pro-programme-2026-10-19.md) distingue la première livraison de cette reprise et de ses vérifications.

### Comportement responsive

- Sur téléphone, empiler les colonnes, appliquer les gouttières de `24px` et les espacements de section de `72px`.
- Préserver la hiérarchie entre titre, accent manuscrit, texte et action.
- Conserver le rapport `1.12em` du manuscrit lorsque la taille du titre s’adapte.
- Permettre le retour à la ligne des libellés plutôt que couper un bouton ou provoquer un débordement.
- Préserver les proportions des photographies dans les mises en page flex et grid.
- Repositionner ou masquer un ornement qui gêne la lecture sur petit écran, sans ajouter un autre motif.
- Ne pas résoudre un débordement en tronquant un texte nécessaire ou en cachant le problème avec `overflow: hidden`.

### Lisibilité et interactions

- Garder les libellés visibles et les contenus lisibles dans les états normal, survol, focus, désactivé, chargement, succès et erreur.
- Conserver un focus clavier visible, des labels de formulaire et des messages d’erreur explicites.
- Ne pas transmettre une information uniquement par la couleur.
- Les SVG décoratifs ne doivent pas polluer le nom accessible d’un bouton ou d’un lien ; les pictogrammes informatifs conservent leur libellé.

### Ce que la source ne chiffre pas

Le texte fourni ne fixe pas de tableau complet de tailles typographiques mobiles, de seuils de rupture, de dimensions d’icônes et pastilles, de padding ou hauteur des boutons, de rayons de champs ou modales, de couleurs d’erreur ou de variantes de survol.

Ces détails doivent être définis et mutualisés dans l’implémentation, avec contrôle du rendu. Ne pas présenter les anciennes valeurs CSS ou les ajustements d’une seule page comme des valeurs explicitement prescrites par cette charte. Ne pas introduire une nouvelle famille ou une nouvelle couleur forte pour compléter ces états.

## 13. Intégration technique et propagation

### Principe

Centraliser les tokens et les styles de composants, puis les réutiliser. Une correction d’un style partagé doit se propager à toutes les pages qui l’utilisent. Éviter les tailles locales et les surcharges qui recréent une identité par gabarit.

### Points de raccord dans le dépôt

| Zone | Fichiers et points à aligner |
| --- | --- |
| Tokens Symfony | `assets/styles/design-tokens.css` |
| Styles communs et Pro | `assets/styles/brand-theme.css`, `brand-parents.css`, `brand-home.css`, `brand-directory.css`, `brand-profile.css`, `pro-theme.css` et feuilles des composants/pages ; `app.css` conserve les structures héritées |
| Chargement des polices Symfony | `templates/base.html.twig`, puis blocs de styles locaux à rationaliser |
| Accueil Pro actuel | `templates/public/pro_landing.html.twig`, `assets/styles/pro-landing-saas.css` |
| Espace connecté et administration | Feuilles des écrans métier et règles locales de famille, graisse, couleur et densité |
| Tokens et styles WordPress | `wordpress/themes/mon-photographe-bebe/assets/css/design-tokens.css`, `brand-theme.css`, `pro-theme.css`, `theme.css` et feuilles propres aux audiences |
| Polices WordPress | Chargement dans `wordpress/themes/mon-photographe-bebe/functions.php` |
| Éditeur WordPress | `wordpress/themes/mon-photographe-bebe/theme.json`, `assets/css/brand-editor.css` et `assets/css/editor.css` |
| Packaging WordPress | `wordpress/build-theme.sh` |
| Assets et provenance | [Visuels Pro d’octobre 2026](assets/pro-saas-october-2026.md), [identité visuelle](identite-visuelle.md) |

Le packaging WordPress synchronise `design-tokens.css`, `brand-theme.css` et `pro-theme.css`, puis génère `brand-editor.css` à partir du socle commun pour le canvas de l’éditeur. Les polices sont chargées explicitement dans `functions.php` pour le front et Gutenberg ; `theme.json` reprend la palette et les familles communes. Le [guide WordPress](theme-wordpress-mon-photographe.md) détaille la version 1.4.0 et sa recette locale du 19 octobre 2026.

### Exemple de nommage des variables

Les variables suivantes sont implémentées dans `design-tokens.css`. Le préfixe couleur évite les collisions entre le token couleur `texte` et le style typographique `texte`. Les échelles complètes figurent dans cette feuille ; les valeurs restent celles des tableaux de référence.

```css
:root {
  --mpb-color-bordeaux: #9b2f45;
  --mpb-color-encre: #474746;
  --mpb-color-texte: #5f5f5d;
  --mpb-color-texte-discret: #737371;
  --mpb-color-rose: #f6dce0;
  --mpb-color-peche: #fce2d2;
  --mpb-color-sauge: #e2ece1;
  --mpb-color-trait: #ebdcda;
  --mpb-color-sur-bordeaux: #ffffff;
  --mpb-color-fond: #ffffff;
  --mpb-color-fond-poudre: #fbf5f3;
  --mpb-color-gris-bouton: #f3eeec;

  --font-body: "Mulish", sans-serif;
  --font-handwritten: "Nothing You Could Do", cursive;
  --mpb-font-weight-title: 200;
  --mpb-font-weight-body: 300;
  --mpb-font-weight-strong: 600;
  --mpb-font-size-handwritten: 1.12em;

  --mpb-content-max: 1240px;
  --mpb-gutter: 64px;
  --mpb-section-space: 104px;
}
```

Les fallbacks système servent à la continuité du chargement. Ils ne sont pas des familles graphiques alternatives. Le chargement Google Fonts doit couvrir Mulish `200`, `300`, `600` et Nothing You Could Do Regular.

Les styles `prenom` et `mot-manuscrit` gardent chacun leur taille et interligne propres. Les propriétés de `sur-titre` et `bouton` doivent être mutualisées sans confondre leurs espacements de lettres.

## 14. État d’application au 18 octobre 2026

L’harmonisation est appliquée dans le dépôt aux interfaces Parents, aux pages publiques Pro restantes, aux espaces connectés, à l’administration et aux gabarits d’e-mails. Le thème WordPress 1.3.0 et Gutenberg reprennent les mêmes tokens. Les archives anciennes restent historiques.

- Le site Parents utilise désormais un conteneur de 1440px et une grille commune au hero et aux sections, conformément à la nouvelle demande. La [recette de largeur et d’alignement](qa/public-alignment-2026-10-18.md) remplace les mesures antérieures de largeur pour ces interfaces.
- Le chargement commun couvre Mulish 200/300/600 et Nothing You Could Do 400. Les alias historiques de famille pointent vers Mulish ; ils ne prescrivent aucune serif.
- `brand-site` active le socle commun. Les modules métier conservent les structures, états et contrôles existants, avec une densité adaptée aux formulaires et tableaux.
- Les pages `/pour-photographes` et `/pour-photographes/comment-ca-marche` restent explicitement exclues de cette modification à la demande du client. Elles conservent les proportions des derniers HTML fournis (`46px / 1.22` et `40px / 1.25`), leurs visuels, leur en-tête et leur pied de page. Cette conservation n’étend pas leurs valeurs locales aux autres gabarits.
- Le manuscrit dynamique de l’accueil Parents est limité à un mot ; le surlignage porte sur un mot distinct. Les anciennes expressions Hello et les décors en forme de cœur ne sont plus rendus sur les surfaces harmonisées. Les logos graphiques fournis restent conservés.
- Les quatre pictogrammes de parcours Parents par défaut sont désormais des SVG au trait 1,5 sur pastille pastel. Leurs emplacements BO restent personnalisables. Ils ne constituent pas la bibliothèque complète des 60 icônes, qui n’a pas été fournie.
- Sur mobile, l’implémentation retient des titres de page de 32 à 44px et des titres de section de 28px, avec des cartes à 20px et des champs à 17px. Ces choix de responsive complètent la source ; ils ne lui sont pas attribués.
- Le thème WordPress est livré sous forme d’archive installable. Les blogs en production n’ont pas été modifiés par cette livraison. Les documents ou images téléversés par les utilisateurs ne sont pas régénérés.

La [recette du rendu public](qa/public-spacing-2026-10-18.md) documente les corrections de composition et le contrôle des contenus réels. La [recette d’harmonisation](qa/site-charter-2026-10-18.md) distingue les contrôles navigateur, les parcours testés et les limites de validation, notamment l’accès protégé au site Pro en ligne et les clients de messagerie.

## 15. Contrôle avant livraison d’une évolution graphique

- [ ] Le public, le Pro connecté ou non, le back-office et WordPress suivent les mêmes familles et tokens pour les composants concernés.
- [ ] Les polices réellement chargées correspondent à Mulish `200` / `300` / `600` et à Nothing You Could Do Regular pour les usages prévus.
- [ ] Les textes utilisent les gris chauds ; le bordeaux reste la seule couleur forte.
- [ ] Les sections alternent blanc et poudre, avec les espacements et gouttières prescrits.
- [ ] Chaque titre a au plus un surlignage et un seul autre mot manuscrit.
- [ ] Les pictogrammes ont un libellé ; les traits sont fins et cohérents.
- [ ] Aucun cœur, emoji, étoile, pictogramme décoratif, effet ou police interdits n’a été ajouté ou repris sans correction.
- [ ] Les photographies conservent leurs proportions ; les détourages sont posés sur blanc.
- [ ] Les boutons, titres et textes restent entiers et lisibles sur téléphone.
- [ ] Les changements de colonnes et les largeurs intermédiaires ont été contrôlés dans le navigateur, en plus des vues ordinateur, tablette et mobile.
- [ ] Les liens, menus, formulaires et leurs états concernés fonctionnent ; le focus et les libellés restent accessibles.
- [ ] Les pages voisines et composants partagés ont été contrôlés pour prévenir les régressions.
- [ ] Les copies WordPress, les polices chargées et le rendu de l’éditeur ont été vérifiés si leur périmètre est concerné.
- [ ] Le compte rendu distingue les règles appliquées, les écarts restant à traiter et les vérifications impossibles.

