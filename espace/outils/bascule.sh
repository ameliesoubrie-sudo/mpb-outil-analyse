#!/usr/bin/env bash
# Bascule de l'outil vers la connexion Pro. À lancer UNIQUEMENT quand https://bilan.monphotographebebe.fr répond
# avec le nouveau serveur et que la recette sur les deux domaines est validée (docs/GUIDE-mise-en-service.md, étape 6).
# Prérequis : supabase CLI connectée au projet, psql, variable SUPABASE_DB_URL (connexion postgres du projet).
set -euo pipefail
cd "$(dirname "$0")/.."
PROJET=htyvaqxdfptgswvwqplq
: "${SUPABASE_DB_URL:?SUPABASE_DB_URL manquante}"

echo "1/4 Secret des fonctions (MPB_PRO_ORIGIN)"
supabase secrets set --project-ref "$PROJET" MPB_PRO_ORIGIN=https://pro.monphotographebebe.fr

echo "2/4 Copie du helper dans chaque fonction, puis contrôles"
python3 outils/sync_mpb_auth.py
deno test -A tests/mpb_auth_test.ts

echo "3/4 Droits de la base : fin de l'accès direct par jeton Supabase (0038)"
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0038_bascule_connexion_pro.sql

echo "4/4 Déploiement des 10 fonctions en mode Pro (verify_jwt = false, lu dans supabase/config.toml)"
for f in analyse-site generer-plan agent-identite studio-instagram redacteur-pages messages-clients stratege-marque assistant-partenaires studio-contenu calculateur; do
  supabase functions deploy "$f" --project-ref "$PROJET" --no-verify-jwt
done
echo "Bascule terminée. Vérifier : un ancien jeton Supabase reçoit 401 sur chaque fonction et ne lit plus aucune table privée."
