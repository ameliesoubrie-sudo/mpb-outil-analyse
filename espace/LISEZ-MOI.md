# Outil d'analyse Mon Photographe Bébé : version connectée au compte Pro

Servi sur `https://bilan.monphotographebebe.fr`. Le compte Pro (`pro.monphotographebebe.fr`) est la seule source d'identité et de droits.

- **Mise en service, bascule, retour arrière :** `docs/GUIDE-mise-en-service.md`
- **Droits par route et par fonction :** `docs/matrice-droits.md`
- **Ressources payantes et stockage privé :** `docs/ressources-privees.md`
- **Tests et limites :** `docs/RAPPORT-tests.md`

## Démarrer en local
```bash
cd serveur && npm ci
# Postgres local avec le schéma de test : voir tests/db/ ; puis
PGURL=postgres://postgres@localhost:54329 npm test
deno test -A ../tests/mpb_auth_test.ts
bash ../tests/db/test_migrations.sh
node test/recette/recette.mjs /tmp/captures      # recette Chromium avec un faux Pro
```

## Faire évoluer les écrans
Modifier `app/bilan.html` (dossier principal), puis :
```bash
python3 tools/sync_calculs.py                 # si le calculateur a changé
python3 espace/outils/convertir_front.py      # régénère espace/public/
```
