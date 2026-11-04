#!/usr/bin/env bash
# Test des migrations 0037 / 0038 et de leurs retours arrière sur une copie locale du schéma de production.
# Usage : PGURL=postgres://postgres@localhost:54329 ./test_migrations.sh
set -euo pipefail
cd "$(dirname "$0")"
PGURL="${PGURL:-postgres://postgres@localhost:54329}"
DB="mpb_test_migr_$$"
psql "$PGURL/postgres" -qc "create database $DB" >/dev/null
trap 'psql "$PGURL/postgres" -qc "drop database if exists $DB" >/dev/null' EXIT
Q() { psql "$PGURL/$DB" -v ON_ERROR_STOP=1 -qAt "$@"; }
ok() { echo "  ok  $1"; }
verif() { if [ "$1" = "$2" ]; then ok "$3"; else echo "ÉCHEC : $3 (obtenu « $1 », attendu « $2 »)"; exit 1; fi; }

Q -f 00_supabase_simule.sql -f 01_schema_production_2026-10-28.sql -f 02_rls_droits_production.sql >/dev/null
Q -f donnees_historiques.sql >/dev/null
AVANT=$(Q -c "select string_agg(t||'='||n, ' ' order by t) from (
  select 'bilans' t, count(*) n from bilan_bilans union all select 'reponses', count(*) from bilan_reponses
  union all select 'identite', count(*) from bilan_identite union all select 'contenus', count(*) from bilan_contenus
  union all select 'studio', count(*) from bilan_studio_contenu union all select 'inscriptions', count(*) from bilan_inscriptions
  union all select 'appels', count(*) from bilan_agent_appels union all select 'textes', count(*) from bilan_textes) x")
PROPRIOS_AVANT=$(Q -c "select md5(string_agg(id::text||member_id::text, ',' order by id)) from bilan_bilans")
echo "Données historiques : $AVANT"

echo "0037 (registre, correspondances, clés étrangères)"
Q -f ../../supabase/migrations/0037_registre_membres_sso.sql >/dev/null
verif "$(Q -c "select count(*) from mpb_prive.membres")" "4" "4 membres : 3 comptes Auth + 1 orphelin conservé"
verif "$(Q -c "select count(*) from mpb_prive.membres where id = '00000000-0000-0000-0000-0000000000dd'")" "1" "UUID orphelin conservé tel quel"
verif "$(Q -c "select md5(string_agg(id::text||member_id::text, ',' order by id)) from bilan_bilans")" "$PROPRIOS_AVANT" "propriétaires des bilans inchangés"
verif "$(Q -c "select count(*) from pg_constraint where confrelid = 'auth.users'::regclass and connamespace = 'public'::regnamespace")" "0" "plus aucune clé étrangère vers auth.users"
verif "$(Q -c "select count(*) from pg_constraint where confrelid = 'mpb_prive.membres'::regclass and connamespace = 'public'::regnamespace")" "7" "7 clés étrangères vers le registre"
# L'ancienne application fonctionne toujours : un membre lit et écrit ses données avec son jeton Supabase
verif "$(Q -c "begin; set local role authenticated; set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000aa';
      insert into bilan_bilans default values; select count(*) from bilan_bilans; commit;")" "2" "ancienne app : lecture/écriture par jeton Supabase toujours possible (2 bilans visibles, les siens)"
# Nouveau compte Supabase Auth -> ajouté au registre par le déclencheur
Q -c "insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000ee', 'nouvelle@test.fr')"
verif "$(Q -c "select origine from mpb_prive.membres where id = '00000000-0000-0000-0000-0000000000ee'")" "legacy" "inscription Supabase Auth -> registre"
# Résolution SSO
R1=$(Q -c "select etat from mpb_prive.resoudre_membre('https://pro.test', '101', 'nouveau@pro.test', 'Nouveau')")
verif "$R1" "actif" "compte Pro sans historique : membre créé"
R1B=$(Q -c "select member_id from mpb_prive.resoudre_membre('https://pro.test', '101', 'autre@pro.test', 'Nouveau')")
verif "$(Q -c "select count(*) from mpb_prive.correspondances where member_id = '$R1B'")" "1" "reconnexion (même iss/sub, e-mail changé) : même membre"
R2=$(Q -c "select etat from mpb_prive.resoudre_membre('https://pro.test', '102', 'CAMILLE@test.fr', 'Camille')")
verif "$R2" "rattachement_necessaire" "e-mail d'un compte historique : pas de rattachement automatique"
verif "$(Q -c "select count(*) from mpb_prive.correspondances where mpb_subject = '102'")" "0" "aucune correspondance créée par l'e-mail"
verif "$(Q -c "select count(*) from mpb_prive.membres where origine = 'sso'")" "1" "pas de doublon de membre"
# Rattachement explicite et collisions
Q -c "select mpb_prive.rattacher('https://pro.test', '102', '00000000-0000-0000-0000-0000000000aa', 'amelie', 'vérifié par téléphone')" >/dev/null
verif "$(Q -c "select etat from mpb_prive.resoudre_membre('https://pro.test', '102', 'camille@test.fr', 'Camille')")" "actif" "rattachement explicite puis connexion"
if Q -c "select mpb_prive.rattacher('https://pro.test', '103', '00000000-0000-0000-0000-0000000000aa', 'amelie', 'erreur')" 2>/dev/null; then echo "ÉCHEC : un membre rattaché deux fois"; exit 1; else ok "collision : un membre ne peut pas avoir deux comptes Pro"; fi
if Q -c "select mpb_prive.rattacher('https://pro.test', '102', '00000000-0000-0000-0000-0000000000bb', 'amelie', 'erreur')" 2>/dev/null; then echo "ÉCHEC : correspondance déplacée"; exit 1; else ok "collision : une correspondance n'est pas déplacée sans détachement"; fi
if Q -c "select mpb_prive.rattacher('https://pro.test', '104', '00000000-0000-0000-0000-0000000000bb', '', '')" 2>/dev/null; then echo "ÉCHEC : rattachement sans auteur"; exit 1; else ok "auteur et motif obligatoires"; fi
verif "$(Q -c "select count(*) >= 3 from mpb_prive.journal_rattachements")" "t" "journal d'audit alimenté"
# Les rôles publics n'ont pas accès au registre
for role in anon authenticated; do
  if Q -c "begin; set local role $role; select count(*) from mpb_prive.correspondances; commit;" 2>/dev/null; then echo "ÉCHEC : $role lit les correspondances"; exit 1; fi
  if Q -c "begin; set local role $role; select public.mpb_membre_pour('https://pro.test','102'); commit;" 2>/dev/null; then echo "ÉCHEC : $role exécute mpb_membre_pour"; exit 1; fi
done; ok "anon et authenticated : aucun accès au registre ni à mpb_membre_pour"
verif "$(Q -c "begin; set local role service_role; select public.mpb_membre_pour('https://pro.test','102'); commit;")" "00000000-0000-0000-0000-0000000000aa" "service_role résout (iss, sub) -> membre"

echo "0037 rollback (refusé tant qu'un membre SSO a des données, sinon accepté)"
Q -c "insert into bilan_bilans (member_id) values ('$R1B')"
if Q -f ../../supabase/migrations/0037_rollback.sql >/dev/null 2>&1; then echo "ÉCHEC : rollback a orpheliné des données"; exit 1; else ok "rollback refusé : données d'un membre SSO protégées"; fi
Q -c "delete from bilan_bilans where member_id = '$R1B'"
Q -c "insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000dd')"   # l'orphelin doit avoir un compte pour revenir aux FK auth.users
Q -f ../../supabase/migrations/0037_rollback.sql >/dev/null && ok "rollback appliqué"
verif "$(Q -c "select count(*) from pg_constraint where confrelid = 'auth.users'::regclass and connamespace = 'public'::regnamespace")" "6" "clés étrangères revenues vers auth.users"
Q -f ../../supabase/migrations/0037_registre_membres_sso.sql >/dev/null && ok "0037 réappliquée (idempotente)"

echo "0038 (bascule)"
Q -f ../../supabase/migrations/0038_bascule_connexion_pro.sql >/dev/null
for t in bilan_bilans bilan_reponses bilan_identite bilan_contenus bilan_studio_contenu bilan_mission_suivi bilan_inscriptions bilan_textes bilan_agent_appels bilan_plans bilan_constats bilan_analyses bilan_plan_missions bilan_evenements bilan_questions; do
  for role in anon authenticated; do
    if Q -c "begin; set local role $role; set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000aa'; select count(*) from $t; commit;" >/dev/null 2>&1; then echo "ÉCHEC : $role lit $t après bascule"; exit 1; fi
  done
done; ok "ancien jeton Supabase (authenticated) et clé anon : aucune lecture des données privées ni du catalogue réservé"
if Q -c "begin; set local role authenticated; set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000aa'; insert into bilan_bilans default values; commit;" >/dev/null 2>&1; then echo "ÉCHEC : écriture"; exit 1; else ok "ancien jeton Supabase : aucune écriture"; fi
verif "$(Q -c "begin; set local role anon; select count(*) >= 0 from bilan_ressources; commit;")" "t" "catalogue public des ressources toujours lisible"
if Q -c "begin; set local role anon; select url from bilan_ressources; commit;" >/dev/null 2>&1; then echo "ÉCHEC : url des ressources lisible"; exit 1; else ok "adresse des fichiers non exposée par l'API publique"; fi
verif "$(Q -c "select count(*) from pg_class where relnamespace = 'public'::regnamespace and relname like 'bilan_%' and relkind = 'r' and not relrowsecurity")" "0" "RLS toujours activée partout"
verif "$(Q -c "select string_agg(t||'='||n, ' ' order by t) from (
  select 'bilans' t, count(*) n from bilan_bilans union all select 'reponses', count(*) from bilan_reponses
  union all select 'identite', count(*) from bilan_identite union all select 'contenus', count(*) from bilan_contenus
  union all select 'studio', count(*) from bilan_studio_contenu union all select 'inscriptions', count(*) from bilan_inscriptions
  union all select 'appels', count(*) from bilan_agent_appels union all select 'textes', count(*) from bilan_textes) x")" "$(echo "$AVANT" | sed 's/bilans=2/bilans=3/')" "aucune ligne perdue (seul le bilan de test ajouté)"

echo "0038 rollback"
Q -f ../../supabase/migrations/0038_rollback.sql >/dev/null
verif "$(Q -c "begin; set local role authenticated; set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000aa'; select count(*) from bilan_bilans; commit;")" "2" "ancienne app rétablie"
verif "$(Q -c "begin; set local role authenticated; set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000bb'; select count(*) from bilan_bilans where member_id <> '00000000-0000-0000-0000-0000000000bb'; commit;")" "0" "isolation entre membres rétablie"
Q -f ../../supabase/migrations/0038_bascule_connexion_pro.sql >/dev/null && ok "bascule réappliquée"
echo "Tous les tests de migration sont passés."
