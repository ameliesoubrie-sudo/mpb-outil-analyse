#!/usr/bin/env bash
# Annule la bascule : rétablit les droits Supabase Auth (0038_rollback) et redéploie les anciennes fonctions.
# Les données ne sont pas touchées. Les anciennes fonctions sont celles du dossier de passation du 19 octobre (verify_jwt = true).
set -euo pipefail
cd "$(dirname "$0")/.."
PROJET=htyvaqxdfptgswvwqplq
: "${SUPABASE_DB_URL:?SUPABASE_DB_URL manquante}"
: "${ANCIENNES_FONCTIONS:?chemin du dossier supabase/functions de l'ancienne version}"
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0038_rollback.sql
for f in analyse-site generer-plan agent-identite studio-instagram redacteur-pages messages-clients stratege-marque assistant-partenaires studio-contenu calculateur; do
  (cd "$ANCIENNES_FONCTIONS/.." && supabase functions deploy "$f" --project-ref "$PROJET")
done
echo "Ancienne connexion rétablie. Couper aussi MPB_REMOTE_ENABLED côté Pro si l'outil ne doit plus être proposé."
