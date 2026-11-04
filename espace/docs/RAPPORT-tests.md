# Rapport de tests, 28 octobre 2026

Tous les tests ont tourné en local, sur une copie du schéma relevé en production le 28 octobre (Postgres 16), avec un faux Pro qui respecte le contrat du 26 octobre. Les faux services ne valent pas validation de la production.

| Suite | Commande | Résultat |
|---|---|---|
| Serveur : connexion, sessions, déconnexion, CSRF | `cd serveur && npm test` (`sso.test.js`) | 23 / 23 |
| Serveur : routes métier, isolation, droits, fonctions, rattachement | `metier.test.js` | 10 / 10 |
| Contenu généré (plus de Supabase côté navigateur, calculateur synchronisé, CSS isolé) | `front.test.js` | 5 / 5 |
| Helper des Edge Functions et usage dans les 10 fonctions | `deno test -A tests/mpb_auth_test.ts` | 10 / 10 |
| Migrations 0037/0038, retours arrière, ancien JWT | `bash tests/db/test_migrations.sh` | 32 / 32 contrôles |
| Recette Chromium (faux Pro, catalogue réel du 20 octobre) | `node serveur/test/recette/recette.mjs` | 25 / 25 contrôles |
| Moteur de règles, calculateur et assistants (non-régression) | `deno test -A tests/` (dossier principal) | 60 / 60 |

## Ce qui est couvert
- **Connexion :**
  - ouverture depuis un Pro connecté, arrivée directe, écran de connexion du Pro puis reprise ;
  - lien `#mission-...` conservé à travers la connexion ;
  - destination externe refusée ;
  - session existante qui renvoie directement à la destination.
- **Protocole :**
  - `state` faux, rejoué ou venant d'un autre navigateur (la transaction n'est pas consommée) ;
  - émetteur faux, paramètres répétés ou en trop ;
  - code expiré, PKCE croisé, onglets concurrents.
- **Sessions et secrets :**
  - rotation de l'identifiant et révocation de l'ancienne autorisation ;
  - jeton chiffré en base, absent du cookie, de la page, du stockage et des journaux ;
  - code jamais journalisé.
- **Fin de session et pannes :**
  - révocation distante, compte désactivé, droits modifiés, expiration : relance automatique unique, puis un lien sans boucle ;
  - panne du Pro : 503 avec « Réessayer », session conservée.
- **Déconnexion :**
  - confirmation en GET, puis POST protégé (Origin + CSRF, ou CSRF seul sans Origin) ;
  - révocation, cookie effacé, `Clear-Site-Data`, retour au Pro ;
  - fonctionne même si la révocation distante échoue.
- **Données :**
  - deux membres isolés sur bilans, réponses, plan, suivi, constats, contenus et identité ;
  - un `member_id` envoyé par le navigateur est ignoré ;
  - réponses 404 sans révéler l'existence d'une ligne ;
  - champs bornés.
- **Droits :**
  - gratuit, Visibilité et Studios sur les routes, les fichiers, les événements et les fonctions ;
  - contenu des missions réservé au programme payant ;
  - formule envoyée dans le corps sans effet ;
  - `studios` jamais accordé sans `training`.
- **Rattachement :**
  - un compte historique au même e-mail n'est pas rattaché automatiquement ;
  - rattachement explicite journalisé, puis bilan retrouvé avec son UUID ;
  - collisions refusées.
- **Migrations :**
  - UUID et propriétaires inchangés, orphelin conservé, 7 clés étrangères repointées ;
  - l'ancienne application fonctionne toujours après 0037 ;
  - après 0038, un ancien jeton Supabase et la clé anon ne lisent ni n'écrivent plus aucune donnée privée ;
  - l'URL des ressources n'est plus exposée, RLS reste active ;
  - retours arrière vérifiés, y compris le refus de 0037_rollback quand il orphelinerait des données.
- **Fonctions :**
  - bearer absent, ambigu ou JWT (anon, service_role, ancien jeton) refusé sans appel au Pro ;
  - panne ou réponse incohérente du Pro : jamais d'accès ;
  - la vérification est la première instruction des 10 fonctions ;
  - `config.toml` met `verify_jwt = false` uniquement pour elles.
- **Écrans :**
  - header et footer du Pro, isolation CSS dans les deux sens (avec un CSS du Pro volontairement agressif) ;
  - largeur 1240 px, aucun débordement à 390 et 768 px ;
  - bouton Cookies du footer, fermeture au clavier ;
  - aucune erreur ni violation CSP dans la console.

## Relecture indépendante
Une relecture séparée du code, contre le contrat, n'a trouvé aucune faille d'accès entre membres, de CSRF, de fixation de session, de redirection ouverte, de rejeu ni d'injection SQL. Ses autres remarques ont été corrigées et testées :
- contenu des missions réservé au droit `training` ;
- quotas sur l'analyse de site (20 par mois) et la génération du plan (30 par mois) ;
- limite de 10 nouveaux bilans par mois ;
- `analyse-site` ne lit plus que des sites publics : adresses internes, ports inhabituels et redirections vers le réseau interne refusés ;
- feuilles Google Fonts acceptées dans le header du Pro ;
- page d'échec du retour de connexion sans ressource tierce ;
- déconnexion sans en-tête Origin ;
- session locale détruite quand une fonction refuse le jeton ;
- limite des démarrages de connexion (30 par minute et par adresse) ;
- vidéos externes de nouveau intégrées.

## Impossible à vérifier d'ici
- Le vrai Pro : contenu réel de `/chrome` (feuilles, scripts, images), menus réels au clavier et au toucher, délais de révocation.
- Les deux domaines réels : DNS, certificats, Nginx, en-têtes derrière le proxy, cookies `__Host-` en HTTPS réel.
- La connexion du serveur au Postgres Supabase réel (pooler, certificat racine) et plusieurs instances simultanées.
- Le déploiement des 10 fonctions en mode Pro et les secrets associés (jour de la bascule).
- Le chargement réel des polices Google, bloqué dans l'environnement de test.
- La protection réelle des fichiers payants : le bucket reste public tant que `ressources-privees.md` n'est pas appliqué.
