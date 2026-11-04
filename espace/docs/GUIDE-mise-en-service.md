# Outil d'analyse : connexion par le compte Pro, guide de mise en service

Livraison du 28 octobre 2026, à lire avec le contrat d'intégration du Pro (`integration-espace-visibilite.md`, 26 octobre) et la charte graphique commune.

## 1. Ce qui change

| Avant | Après |
|---|---|
| Page HTML seule, connexion e-mail et mot de passe Supabase | Serveur Node.js sur `bilan.monphotographebebe.fr`, connexion par le compte Pro (code + PKCE) |
| Le navigateur lit et écrit la base avec la clé anon et un JWT Supabase | Le navigateur appelle seulement les routes métier `/api/...` du serveur ; aucune clé ni jeton Supabase côté navigateur |
| Les fonctions vérifient le JWT Supabase | Les fonctions vérifient la session Pro (`mpb_auth.ts`) et les droits d'abonnement |
| `FORMULE = "complete"` dans le code | Droits `analysis`, `training`, `studios` du Pro, contrôlés côté serveur à chaque requête |
| Header et logo reconstitués | Header et footer réels du Pro, contenu de l'outil isolé dans un Shadow DOM |

Supabase reste la base de toutes les données. Seule la connexion Supabase Auth disparaît. Aucune donnée n'est supprimée et les UUID des membres ne changent pas.

## 2. Contenu du dossier

| Chemin | Rôle |
|---|---|
| `serveur/` | Serveur de l'outil (Node.js 22, une seule dépendance : `pg`). `src/app.js` : routes ; `src/metier.js` : routes métier ; `src/pro.js` : client du Pro ; `src/stockage.js` : sessions |
| `public/` | Contenu de l'outil généré depuis `app/bilan.html` par `outils/convertir_front.py` |
| `supabase/migrations/0037_*` | Registre des membres et correspondances (déjà appliquée en production le 28 octobre) |
| `supabase/migrations/0038_*` | Bascule des droits (à appliquer le jour J) et son retour arrière |
| `supabase/functions/` | Les 10 fonctions adaptées + `mpb_auth.ts` ; `config.toml` |
| `anciennes-fonctions/` | Les fonctions telles qu'en production avant la bascule (retour arrière) |
| `ranger-ressources` | Ancien outil de rangement (jeton fixe) : retiré des fonctions publiques ; son code reste seulement dans le dossier de travail d’Amélie, hors de ce dossier |
| `deploy/` | Dockerfile, docker-compose, vhost Nginx |
| `outils/` | Conversion du front, copie du helper, scripts de bascule et de retour arrière |
| `tests/`, `serveur/test/` | Tests (voir `RAPPORT-tests.md`) |

## 3. État au 28 octobre

- **Fait en production :** migration 0037 (registre des membres reprenant les 4 comptes existants, correspondances, sessions, clés étrangères repointées). L'application actuelle fonctionne toujours. L'outil `ranger-ressources` répond désormais 410.
- **Prêt, non appliqué :** 0038, déploiement des 10 fonctions en mode Pro, mise en ligne du serveur. Les appliquer avant que le serveur tourne couperait l'accès à tous les membres.

## 4. Mise en service, dans l'ordre

### Étape 1 : DNS et certificat
Créer `bilan.monphotographebebe.fr` (A/AAAA vers le serveur du Pro), puis le certificat (`certbot --nginx -d bilan.monphotographebebe.fr`).

### Étape 2 : secrets
1. Générer le secret client sur une machine autorisée : `openssl rand -hex 32`. L'installer côté Pro (`MPB_REMOTE_CLIENT_SECRET`) et côté outil (`MPB_CLIENT_SECRET`), nulle part ailleurs.
2. Générer une clé de chiffrement distincte : `openssl rand -hex 32` → `SESSION_ENCRYPTION_KEY`.
3. Récupérer la chaîne de connexion Postgres (Supabase > Project Settings > Database, « Session pooler », `sslmode=require`) → `SESSION_STORE_URL`, et le certificat racine Supabase → `/etc/mpb/supabase-ca.crt` (le fichier est déjà dans le dépôt : `espace/deploy/supabase-ca.crt`, certificat public, valable jusqu'en avril 2031).
4. Créer `/etc/mpb/outil-analyse.env` à partir de `.env.example` (root, droits 600).

### Étape 3 : serveur de l'outil
```bash
cd espace
docker build -f deploy/Dockerfile -t mpb-outil-analyse .
docker compose -f deploy/docker-compose.yml up -d
curl -s http://127.0.0.1:8081/sante        # ok
```
Plusieurs instances peuvent tourner : sessions et transactions sont dans Postgres (schéma `mpb_prive`). Le serveur purge chaque heure les sessions expirées.

### Étape 4 : Nginx
Copier `deploy/nginx-bilan.monphotographebebe.fr.conf` et `deploy/mpb-outil-proxy.conf`, `nginx -t`, recharger. Le vhost ne journalise ni les query strings ni `/auth/*`. Aucun cache sur les réponses (toutes en `Cache-Control: no-store`, sauf `/static/` en `no-cache` avec ETag).

### Étape 5 : côté Pro
`MPB_REMOTE_ENABLED=1`, `MPB_REMOTE_CLIENT_ID=espace-visibilite`, `MPB_REMOTE_REDIRECT_URI=https://bilan.monphotographebebe.fr/auth/callback`, `MPB_REMOTE_START_URL=https://bilan.monphotographebebe.fr/auth/login`, puis reconstruire le cache.

### Étape 6 : rattacher les comptes existants (avant d'ouvrir)
Il y a 4 comptes historiques (`mpb_prive.membres`, origine `legacy`). Pour chacun, la personne se connecte une fois par le Pro : si l'e-mail est le même, elle voit « Retrouvons vos bilans » et apparaît dans `mpb_prive.rattachements_attente`. Après vérification (téléphone, e-mail connu), dans l'éditeur SQL :
```sql
select mpb_issuer, mpb_subject, email, candidats from mpb_prive.rattachements_attente;
select mpb_prive.rattacher('https://pro.monphotographebebe.fr', '<sub Pro>', '<uuid historique>', 'amelie', 'vérifié par téléphone le ...');
```
Rien n'est jamais rattaché sur la seule base de l'e-mail. Si l'e-mail Pro diffère de l'ancien, la personne obtient un compte neuf : on peut alors `detacher()` puis `rattacher()` au bon UUID (journalisé dans `mpb_prive.journal_rattachements`). Les UUID non rattachés restent conservés.

### Étape 7 : bascule
Quand la recette (section 6) est validée sur les deux domaines :
```bash
export SUPABASE_DB_URL='postgres://...'
./outils/bascule.sh
```
Le script installe `MPB_PRO_ORIGIN` dans les secrets des fonctions, applique 0038 (fin de l'accès par jeton Supabase, RLS gardée) et déploie les 10 fonctions avec `verify_jwt = false`. Amélie peut aussi demander à Claude de faire la bascule depuis le projet.

## 5. Retour arrière
- **Bascule annulée :** `ANCIENNES_FONCTIONS=anciennes-fonctions/functions ./outils/retour-arriere.sh`, puis `MPB_REMOTE_ENABLED=0` côté Pro. Les membres retrouvent l'ancienne connexion. Les membres créés par le Pro gardent leurs données mais ne peuvent pas se connecter à l'ancienne version.
- **Registre (0037) :** `0037_rollback.sql` refuse de s'exécuter si un membre créé par le Pro a des données, pour ne rien orpheliner.
- Aucune étape ne supprime de compte Supabase, de bilan ou de contenu.

## 6. Recette à faire sur les deux domaines réels
1. Depuis le Pro connecté, menu « Notre outil d'analyse » : arrivée sans mot de passe.
2. Arrivée directe sur `https://bilan.monphotographebebe.fr/#mission-MG09` sans être connecté : connexion Pro puis ouverture de la mission.
3. Comptes gratuit, Visibilité et Studios : programme, ressources payantes et studios de création ouverts ou fermés comme prévu (`matrice-droits.md`), y compris par appel direct à `/api/...`.
4. Changement d'offre, désactivation du compte, changement de mot de passe : effet à la requête suivante.
5. Déconnexion depuis le header (confirmation puis retour au Pro) ; déconnexion depuis le Pro puis retour sur l'outil.
6. Un ancien JWT Supabase (copié d'un navigateur avant la bascule) : 401 sur chaque fonction, aucune table privée lisible avec la clé anon.
7. Téléphone et ordinateur : menus du header, bouton Cookies du footer, styles de l'outil et du Pro sans interférence.
8. Panne simulée du Pro : message « Service momentanément indisponible » et bouton Réessayer, sans boucle de connexion.

## 7. Points de vigilance
- **Ressources payantes :** le bucket `ressources` est public. Le serveur contrôle le droit avant de rediriger vers un fichier, mais l'URL publique reste accessible à qui la connaît. Voir `ressources-privees.md`.
- **Colonne `url` des ressources :** après la bascule, la clé anon ne lit plus `bilan_ressources.url`. Si un autre site (Pro, WordPress) lisait ce catalogue directement, il doit passer par sa propre clé serveur.
- **Nouvelles tables :** Supabase donne par défaut tous les droits aux rôles `anon` et `authenticated` sur les nouvelles tables du schéma `public`. Toute nouvelle table privée doit recevoir `revoke all ... from anon, authenticated` et RLS.
- **Évolutions de l'application :** les écrans se modifient toujours dans `app/bilan.html`, puis `python3 espace/outils/convertir_front.py` régénère `public/`. Le script s'arrête si un point d'intégration a changé.
- **Écriture :** les textes destinés aux membres parlent de « notre outil d'analyse » et de « nos studios de création ».
