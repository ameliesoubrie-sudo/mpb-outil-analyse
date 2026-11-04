# Outil d'analyse Mon Photographe Bébé

- `espace/` : la version connectée au compte Pro (serveur, appli, Edge Functions, migrations, tests). Commencer par `espace/LISEZ-MOI.md` puis `espace/docs/GUIDE-mise-en-service.md`.
- `app/bilan.html` : source des écrans. Après une modification : `python3 espace/outils/convertir_front.py` régénère `espace/public/`.

Aucun secret dans ce dépôt : les valeurs réelles vont dans `/etc/mpb/outil-analyse.env` (voir `espace/.env.example`) et dans les secrets Supabase.
