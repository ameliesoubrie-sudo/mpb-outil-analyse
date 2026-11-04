# Ressources payantes : passer à un stockage privé (préparé, non appliqué)

## Situation
- `bilan_ressources` reste lisible publiquement (catalogue) et le bucket `ressources` est public.
- Le serveur de l'outil ne donne plus l'URL directe : chaque lien passe par `/api/ressources/:id/fichier`, qui vérifie le droit puis redirige. Tant que le bucket est public, quelqu'un qui connaît l'URL publique d'un PDF payant peut l'ouvrir. Masquer un bouton ne protège rien.
- Les fiches PDF contiennent des liens entre elles (« Va plus loin ») et des QR codes vers `#mission-...`. Les liens vers les PDF pointent sur l'URL publique.

## Migration proposée
1. Créer un bucket privé `ressources-privees`.
2. Y copier uniquement les fichiers des ressources `acces = 'audit'` ou `'complete'`. Les fiches gratuites et les fiches des missions restent dans le bucket public, pour ne casser aucun lien imprimé.
3. Ajouter une colonne `bilan_ressources.fichier_prive text` (chemin dans le bucket privé).
4. Dans `fichierRessource()` (`serveur/src/metier.js`), si `fichier_prive` est renseigné : créer une URL signée de 5 minutes (`POST /storage/v1/object/sign/ressources-privees/<chemin>` avec la clé service_role, côté serveur seulement) et rediriger dessus.
5. Pour les liens présents dans les PDF : remplacer, à la prochaine génération des fiches, les liens vers un PDF payant par `https://bilan.monphotographebebe.fr/api/ressources/<id>/fichier` (le membre passe par la connexion, puis le contrôle du droit).
6. Une fois les PDF régénérés et déposés, supprimer les copies publiques des fichiers payants. Jusque-là, les deux copies coexistent : aucun lien n'est cassé en silence.
