-- Retour arrière de 0037. Ne supprime AUCUNE donnée métier.
-- Les clés étrangères reviennent vers auth.users. Attention : un membre créé par la connexion Pro (origine sso)
-- n'a pas de compte auth.users ; s'il a déjà des données, ce retour arrière échoue volontairement (contrôle ci-dessous)
-- plutôt que de supprimer ou d'orpheliner ses données. Dans ce cas, garder 0037 et annuler seulement la bascule (0038_rollback).

begin;

do $$
declare n int;
begin
  select count(*) into n from (
    select member_id from public.bilan_bilans union all select member_id from public.bilan_identite
    union all select member_id from public.bilan_textes union all select member_id from public.bilan_agent_appels
    union all select member_id from public.bilan_contenus union all select member_id from public.bilan_studio_contenu
  ) t where member_id not in (select id from auth.users);
  if n > 0 then raise exception 'retour arrière impossible : % lignes appartiennent à des membres sans compte Supabase Auth', n; end if;
end $$;

alter table public.bilan_bilans        drop constraint if exists bilan_bilans_member_id_fkey;
alter table public.bilan_identite      drop constraint if exists bilan_identite_member_id_fkey;
alter table public.bilan_textes        drop constraint if exists bilan_textes_member_id_fkey;
alter table public.bilan_agent_appels  drop constraint if exists bilan_agent_appels_member_id_fkey;
alter table public.bilan_contenus      drop constraint if exists bilan_contenus_member_id_fkey;
alter table public.bilan_studio_contenu drop constraint if exists bilan_studio_contenu_member_id_fkey;
alter table public.bilan_inscriptions  drop constraint if exists bilan_inscriptions_member_id_fkey;

alter table public.bilan_bilans        add constraint bilan_bilans_member_id_fkey        foreign key (member_id) references auth.users(id) on delete cascade;
alter table public.bilan_identite      add constraint bilan_identite_member_id_fkey      foreign key (member_id) references auth.users(id) on delete cascade;
alter table public.bilan_textes        add constraint bilan_textes_member_id_fkey        foreign key (member_id) references auth.users(id) on delete cascade;
alter table public.bilan_agent_appels  add constraint bilan_agent_appels_member_id_fkey  foreign key (member_id) references auth.users(id) on delete cascade;
alter table public.bilan_contenus      add constraint bilan_contenus_member_id_fkey      foreign key (member_id) references auth.users(id) on delete cascade;
alter table public.bilan_studio_contenu add constraint bilan_studio_contenu_member_id_fkey foreign key (member_id) references auth.users(id) on delete cascade;
-- bilan_inscriptions n'avait pas de clé étrangère sur member_id avant 0037.

drop trigger if exists mpb_inscrire_membre on auth.users;
drop function if exists public.mpb_membre_pour(text, text);
-- Le schéma mpb_prive (registre, correspondances, journal) est conservé pour l'audit. Pour le retirer :
--   drop schema mpb_prive cascade;   -- seulement après export du journal

commit;
