-- 0038 : BASCULE vers la connexion par le compte Pro.
-- À appliquer UNIQUEMENT quand le serveur de l'outil tourne sur https://bilan.monphotographebebe.fr, en même temps que
-- le déploiement des 10 Edge Functions en mode Pro (voir docs/GUIDE-mise-en-service.md, étape « Bascule »).
--
-- Effet : plus aucun accès direct aux données privées avec la clé anon ou un jeton Supabase Auth (ancien JWT).
-- Les données ne sont ni supprimées ni modifiées. La sécurité par ligne (RLS) reste ACTIVÉE sur toutes les tables
-- comme défense supplémentaire ; les anciennes politiques « auth.uid() » sont retirées car plus aucun membre n'a de jeton Supabase.
-- Le serveur de l'outil (connexion Postgres directe) et les Edge Functions (service_role) imposent le member_id
-- de la session Pro vérifiée : ce n'est PAS un filtrage RLS, c'est un filtrage explicite dans chaque requête.
-- Retour arrière : 0038_rollback.sql.

begin;

do $$
declare t text;
begin
  -- Données privées des membres : aucun accès direct
  foreach t in array array['bilan_bilans','bilan_reponses','bilan_analyses','bilan_constats','bilan_plans','bilan_plan_missions',
    'bilan_mission_suivi','bilan_identite','bilan_textes','bilan_agent_appels','bilan_inscriptions','bilan_contenus','bilan_studio_contenu'] loop
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
  -- Catalogue : plus aucune écriture ; lecture seulement pour bilan_ressources (catalogue public, fichiers déjà publics)
  foreach t in array array['bilan_parcours','bilan_questions','bilan_question_options','bilan_missions','bilan_identite_questions','bilan_evenements','bilan_ressources'] loop
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;
-- Catalogue public sans la colonne url : les fichiers passent par le serveur de l'outil, qui contrôle le droit
grant select (id, type, theme, titre, description, format, pages, acces, missions, ordre, actif, updated_at, date_publication)
  on table public.bilan_ressources to anon, authenticated;

-- Anciennes politiques fondées sur auth.uid() (sans objet sans jeton Supabase)
drop policy if exists own on public.bilan_bilans;
drop policy if exists own on public.bilan_reponses;
drop policy if exists own_read on public.bilan_analyses;
drop policy if exists own_read on public.bilan_constats;
drop policy if exists own_update on public.bilan_constats;
drop policy if exists own_read on public.bilan_plans;
drop policy if exists own on public.bilan_plan_missions;
drop policy if exists own on public.bilan_mission_suivi;
drop policy if exists "identite perso" on public.bilan_identite;
drop policy if exists "textes perso" on public.bilan_textes;
drop policy if exists "appels perso lisibles" on public.bilan_agent_appels;
drop policy if exists inscr_own on public.bilan_inscriptions;
drop policy if exists "contenus lecture" on public.bilan_contenus;
drop policy if exists "contenus maj" on public.bilan_contenus;
drop policy if exists "contenus suppression" on public.bilan_contenus;
drop policy if exists "studio contenu lecture" on public.bilan_studio_contenu;
drop policy if exists catalogue_read on public.bilan_parcours;
drop policy if exists catalogue_read on public.bilan_questions;
drop policy if exists catalogue_read on public.bilan_question_options;
drop policy if exists catalogue_read on public.bilan_missions;
drop policy if exists "catalogue identite lisible" on public.bilan_identite_questions;
drop policy if exists evenements_read on public.bilan_evenements;
-- bilan_ressources garde sa politique catalogue_read (lecture publique)

-- Les nouveaux comptes Supabase Auth ne sont plus des membres
drop trigger if exists mpb_inscrire_membre on auth.users;

create table if not exists mpb_prive.bascule (le timestamptz primary key default now(), etape text not null);
revoke all on mpb_prive.bascule from public, anon, authenticated;
insert into mpb_prive.bascule (etape) values ('0038 appliquée : connexion Pro seule');

commit;
