# Connexion de l’espace visibilité au Pro

Livraison du 26 octobre 2026. Implémentation côté Mon Photographe Bébé ; l’application du ZIP doit encore être adaptée avec le [prompt d’intégration](prompt-claude-espace-visibilite.md). Les domaines prévus sont `pro.monphotographebebe.fr` et `bilan.monphotographebebe.fr`.

## Parcours et périmètre

Le Pro reste la source d’identité. Le lien « Notre outil d’analyse », dans les menus Ressources et le footer connectés, ouvre `/auth/login` sur l’outil. Son backend crée une transaction `state` + PKCE S256 et redirige le navigateur vers le Pro. Le Pro utilise sa session existante ou présente son écran de connexion, puis renvoie un code à usage unique au callback enregistré. Seul le backend de l’outil peut échanger ce code contre un jeton opaque avec son secret client.

Il s’agit d’un contrat dédié à un client confidentiel de la marque, pas d’un fournisseur OIDC généraliste. Aucun JWT Supabase, ID token, refresh token ou cookie Pro n’est transmis à l’outil. Les règles de code, PKCE et comparaison exacte des URI suivent les recommandations du [RFC 9700](https://www.rfc-editor.org/rfc/rfc9700.html). L’intégration existante Supabase et ses UUID nécessitent une migration spécifique, décrite dans le prompt.

Les autorisations sont stockées dans `remote_access_grant`, dans la base applicative commune à tous les workers. Codes et jetons aléatoires de 256 bits sont stockés uniquement sous forme SHA-256. L’échange du code est un `UPDATE` conditionnel atomique. L’API utilise un firewall stateless indépendant : un cookie Pro ne remplace jamais un bearer.

## Configuration Pro

L’intégration est **désactivée par défaut**. Aucune entrée vers un outil non déployé n’apparaît dans les menus. La configuration suivante doit être installée hors du dépôt, dans l’environnement de production ou `.env.local` :

```dotenv
MPB_REMOTE_ENABLED=1
MPB_REMOTE_CLIENT_ID=espace-visibilite
MPB_REMOTE_CLIENT_SECRET=<secret aléatoire partagé avec le backend uniquement>
MPB_REMOTE_REDIRECT_URI=https://bilan.monphotographebebe.fr/auth/callback
MPB_REMOTE_START_URL=https://bilan.monphotographebebe.fr/auth/login
```

Générer le secret dans le gestionnaire de secrets ou avec `openssl rand -hex 32` sur une machine autorisée, puis l’installer sur les deux serveurs sans le copier dans le prompt ni dans un ticket. Le validateur exige au moins 32 caractères ; la commande fournit 32 octets aléatoires encodés en 64 caractères. Aucun secret n’est livré dans ce dépôt.

Le callback et le départ doivent utiliser HTTPS, la même origine, sans identifiants, query string ni fragment. Le callback est comparé intégralement, sans wildcard. L’émetteur est calculé depuis `APP_PRO_DOMAIN` et `APP_CANONICAL_SCHEME` existants ; il doit être HTTPS. Pour changer le sous-domaine de l’outil, modifier ces deux URL et la configuration du backend externe ensemble. Pour la recette locale, utiliser des noms HTTPS et une configuration d’émetteur distincte. L’API refuse HTTP, les hôtes alternatifs et les redirections de canonicalisation pour ne pas transporter des secrets vers un autre hôte.

## API v1

Tous les chemins ci-dessous sont sur l’origine Pro. Les réponses, y compris les erreurs, utilisent `Cache-Control: private, no-store`, `Referrer-Policy: no-referrer` et `X-Robots-Tag: noindex, nofollow`. Il n’y a pas de CORS navigateur : les appels API proviennent des serveurs.

| Méthode et chemin | Authentification | Résultat |
| --- | --- | --- |
| `GET /connexion/outils/autoriser` | Session Pro, rôle photographe, compte actif ; assistance administrateur interdite | Redirection vers le callback avec `code`, `state`, `iss`, fragment neutre `#_` |
| `POST /api/pro-integration/token` | HTTP Basic `client_id:client_secret` | `access_token`, `token_type: Bearer`, `expires_in: 28800`, `scope: profile` |
| `GET /api/pro-integration/session` | Bearer | Identité, droits actuels et liens Pro |
| `GET /api/pro-integration/chrome` | Bearer | Header/footer HTML réels, URL des styles/scripts et classes de body |
| `POST /api/pro-integration/revoke` | Bearer | HTTP 204 ; révoque ce jeton |

Paramètres d’autorisation : `response_type=code`, `client_id`, `redirect_uri`, `state` base64url de 32 à 256 caractères, `code_challenge` base64url de 43 caractères, `code_challenge_method=S256`. Le backend doit générer `state` avec au moins 32 octets aléatoires. Les paramètres invalides produisent une erreur locale, jamais une redirection sur une URI fournie non validée. Le code expire après 60 secondes.

Le token endpoint accepte uniquement `application/x-www-form-urlencoded`, avec `grant_type=authorization_code`, `code`, `redirect_uri`, `code_verifier` (43 à 128 caractères RFC 7636). Il refuse les secrets dans l’URL ou une authentification par cookie. Il retourne 401 `invalid_client` pour le client incorrect, 400 `invalid_grant` pour le code, callback ou PKCE incorrect. Les APIs protégées retournent 401 `invalid_token` sans redirection de connexion. La révocation répétée d’un jeton déjà révoqué retourne donc 401 ; le backend doit considérer le nettoyage local comme réussi. Les émissions sont limitées à 120 par minute et par membre ; les mauvais secrets à 30 réponses par minute et par IP, puis 429 avec `Retry-After`.

Exemple de réponse `/session` (valeurs illustratives) :

```json
{
  "active": true,
  "iss": "https://pro.monphotographebebe.fr",
  "sub": "123",
  "email": "photographe@example.test",
  "email_verified": true,
  "name": "Camille",
  "account_plan": "pro",
  "subscription_plan": "studios",
  "entitlements": {"analysis": true, "training": true, "studios": true},
  "photographer_id": 456,
  "links": {
    "dashboard": "https://pro.monphotographebebe.fr/espace",
    "profile_edit": "https://pro.monphotographebebe.fr/espace/profil",
    "public_profile": null,
    "logout": "https://pro.monphotographebebe.fr/deconnexion"
  }
}
```

Les URL sont générées par le routeur et doivent être utilisées telles quelles. La clé stable de rattachement est `(iss, sub)`, pas l’e-mail ni l’ID de fiche. L’e-mail non vérifié n’empêche pas l’accès actuel au Pro ; `email_verified` reflète sa valeur réelle. Aucun rôle d’administration n’est exporté comme permission de l’outil.

`analysis` autorise tout photographe actif. `training` réutilise `TrainingAccessPolicy`, avec ses délais de fin d’accès et d’impayés. `studios` exige aussi le plan `studios`. Les droits sont recalculés à chaque lecture, sans les figer dans un token. Les contenus réservés doivent être contrôlés dans le backend externe et les Edge Functions, pas seulement masqués dans le front.

## Sessions et déconnexion

Le jeton distant expire huit heures après son échange, sans renouvellement silencieux par API. Une nouvelle navigation SSO peut ensuite réutiliser la connexion Pro. La session externe ne doit jamais durer plus longtemps que cette autorisation.

La déconnexion Pro révoque tous les codes et jetons issus de la même session navigateur, avant que Symfony ne termine sa déconnexion. Les autres navigateurs du compte restent connectés. Le mécanisme s’appuie sur [l’événement de déconnexion Symfony](https://symfony.com/doc/current/security.html#customizing-logout). Un changement de mot de passe, d’e-mail ou de rôles invalide l’empreinte d’identité ; un compte désactivé, supprimé ou sans rôle photographe est refusé à chaque validation. La rotation du secret client invalide également les autorisations existantes.

La fermeture d’un onglet ou l’expiration naturelle du cookie Pro n’émet pas d’événement de déconnexion : le jeton distant garde alors sa propre échéance maximale de huit heures. La révocation est constatée lorsque l’outil appelle l’API, pas par une notification poussée. Le backend externe doit donc vérifier `/session` **sur chaque requête privée**, sans réutiliser une autorisation en cache. Un contrôle périodique peut nettoyer l’interface d’un onglet inactif ; il ne remplace pas le contrôle des requêtes. Un appel métier déjà autorisé peut terminer.

Le bouton distant ouvre `/auth/logout` sur le domaine de l’outil. Le backend externe doit afficher une confirmation GET puis exécuter le POST protégé CSRF : révocation MPB, destruction de session locale, suppression du cookie et redirection navigateur vers le logout Pro. Le cookie externe est `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, sans `Domain` partagé. Le POST de révocation MPB est protégé par bearer, pas par cookie.

## Header/footer communs

Le renderer utilise `pro/base.html.twig`, `_member_navigation.html.twig`, `_footer.html.twig` et les assets courants d’AssetMapper. Ce n’est pas une copie de maquette. Les URL de navigation, logo et CSS sont absolues ; `/auth/logout` reste volontairement local à l’outil. Les formulaires d’administration et leurs jetons CSRF ne sont pas exportés. Une fiche indisponible renvoie vers sa modification Pro au lieu d’un dialogue dépendant de l’application locale.

Le JSON annonce `version: 1`, `integration_mode: document`, `header_html`, `footer_html`, `stylesheets`, `scripts`, `body_classes`, `logout_url`, `cookie_settings_event`. Les fragments doivent être placés dans le document principal. Le script autonome `remote-chrome.js` gère les menus sans importer Turbo ou Stimulus. Après un remplacement, appeler `window.MPBProChrome.init()`. Le footer émet `mpb:cookie-settings` pour ouvrir le gestionnaire de consentement propre à l’outil.

Le CSS métier du ZIP doit être isolé dans sa propre racine Shadow DOM. Le prompt couvre le déplacement des sélecteurs, ancres, overlays et handlers pour que ce déplacement ne casse pas `boot()`. Aucun cache partagé de HTML personnalisé entre comptes. Les styles incluent les polices Google utilisées par le Pro ; configurer la CSP externe en conséquence.

## Mise en service

1. Déployer le code Pro en gardant `MPB_REMOTE_ENABLED=0`. Appliquer les migrations : `php bin/console doctrine:migrations:migrate --env=prod --no-interaction`. La nouvelle migration est `Version20261026120000`.
2. Compiler les assets et reconstruire le cache avec le processus habituel de déploiement (`asset-map:compile` doit inclure `remote-chrome.js`).
3. Reporter dans le vhost réel les deux locations SSO de `deploy/config/nginx-monphotographe.conf`. Elles désactivent la journalisation des URL sensibles et la protection HTTP Basic de préproduction sur l’API, qui possède sa propre authentification. Préserver `Authorization` vers PHP-FPM. Le script de déploiement applicatif ne remplace pas automatiquement le vhost installé ; vérifier `nginx -t` puis recharger Nginx.
4. Ne pas journaliser Authorization, cookies, callback, state, code, verifier, token ou corps d’échange dans les proxys, APM et outils externes. Le filtre Sentry applicatif exclut les routes SSO/API. Garder le profiler désactivé en production.
5. Ajouter la tâche de nettoyage horaire présente dans `deploy/config/cron-monphotographe`, ou exécuter `php bin/console app:remote-access:purge --env=prod` depuis le planificateur existant. Le rate limiter reprend le verrou inter-workers du déploiement mono-hôte ; passer à un verrou/stockage distribué avant un déploiement Pro multi-hôte.
6. Faire adapter et déployer l’outil avec le prompt joint : BFF, stockage de session, migration Supabase contrôlée, helpers Edge Functions et chrome. Configurer DNS/TLS du sous-domaine prévu. Aucun changement Supabase n’est appliqué par la présente livraison Pro.
7. Installer le même secret sur les deux serveurs, activer le client Pro et reconstruire l’environnement compilé/cache si nécessaire. Valider les deux domaines ensemble avant ouverture aux membres.

Pour couper l’intégration : `MPB_REMOTE_ENABLED=0` puis reconstruire l’environnement/cache. Les menus disparaissent et les appels bearer sont refusés. Pour renouveler le secret : remplacer sur les deux serveurs de façon coordonnée ; les membres devront reprendre un parcours SSO. La table ne contient pas de données métier de l’outil. Ne pas supprimer de comptes Supabase ou de bilans pour revenir sur cette configuration.

## Recette à effectuer sur les deux domaines

- Ouverture depuis un Pro connecté sans mot de passe supplémentaire ; arrivée directe anonyme avec retour au bon écran après connexion.
- Échange confidentiel, refus d’un callback différent, d’un code expiré ou rejoué et d’un PKCE incorrect ; absence de secrets dans le navigateur.
- Accès réel à un bilan existant avec son UUID conservé ; isolation de deux comptes, anciens JWT Supabase sans accès privé.
- Droits gratuit/Visibilité/Studios, changement de formule, désactivation, mot de passe modifié et déconnexion dans les deux sens.
- Header/footer et menus sur téléphone et ordinateur, liens Pro, préférences cookies, retour par ancre et isolation des styles.
- Panne du Pro : opération privée refusée avec message de réessai, sans perte de données ni boucle de connexion.

Les tests locaux couvrent le protocole Pro, la persistance/migration et les fragments communs. Ils ne remplacent pas une recette de l’outil externe modifié, ni une validation du DNS, de Supabase et de l’hébergement réels.

Les résultats et limites sont consignés dans la [recette du 26 octobre 2026](qa/sso-espace-visibilite-2026-10-26.md).
