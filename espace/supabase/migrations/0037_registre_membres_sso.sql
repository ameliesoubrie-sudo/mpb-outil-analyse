-- 0037 : registre des membres, correspondance avec le compte Pro, sessions du serveur de l'outil.
--
-- Migration ADDITIVE : l'application actuelle (connexion Supabase Auth) continue de fonctionner.
--  - mpb_prive.membres reprend EXACTEMENT les UUID existants (auth.users + tous les member_id présents dans les données,
--    y compris d'éventuels orphelins) ; aucun propriétaire de donnée n'est réécrit.
--  - Les clés étrangères member_id -> auth.users sont repointées vers mpb_prive.membres (ON DELETE RESTRICT :
--    supprimer un compte ne supprime plus ses données).
--  - Un déclencheur ajoute au registre chaque nouveau compte Supabase Auth, tant que l'ancienne connexion existe.
--  - Le schéma mpb_prive n'est pas exposé à l'API : aucun droit pour anon / authenticated.
-- Retour arrière : 0037_rollback.sql.

begin;

create schema if not exists mpb_prive;
revoke all on schema mpb_prive from public;
revoke all on schema mpb_prive from anon, authenticated;

-- ---------- Registre des membres ----------
create table if not exists mpb_prive.membres (
  id uuid primary key default gen_random_uuid(),
  origine text not null check (origine in ('legacy', 'sso')),
  cree_le timestamptz not null default now()
);
comment on table mpb_prive.membres is 'Registre des membres de l''outil. Reprend les UUID historiques (origine legacy) ; les nouveaux membres SSO reçoivent un UUID généré par le serveur.';

-- Comptes Supabase Auth existants
insert into mpb_prive.membres (id, origine) select id, 'legacy' from auth.users on conflict (id) do nothing;
-- Tous les member_id présents dans les données, même sans compte (orphelins conservés, jamais supprimés)
insert into mpb_prive.membres (id, origine)
select distinct member_id, 'legacy' from (
  select member_id from public.bilan_bilans union select member_id from public.bilan_identite
  union select member_id from public.bilan_textes union select member_id from public.bilan_agent_appels
  union select member_id from public.bilan_contenus union select member_id from public.bilan_studio_contenu
  union select member_id from public.bilan_inscriptions
) t where member_id is not null
on conflict (id) do nothing;

-- ---------- Correspondance compte Pro -> membre ----------
create table if not exists mpb_prive.correspondances (
  mpb_issuer text not null check (mpb_issuer ~ '^https://[a-z0-9.-]+$'),
  mpb_subject text not null check (length(mpb_subject) between 1 and 255 and mpb_subject !~ '[[:cntrl:]]'),
  member_id uuid not null unique references mpb_prive.membres(id) on delete restrict,
  cree_le timestamptz not null default now(),
  cree_par text not null,
  primary key (mpb_issuer, mpb_subject)
);
comment on table mpb_prive.correspondances is 'Clé d''identité (iss, sub) du Pro -> UUID membre. Un compte Pro = un membre. Jamais déplacée par une requête utilisateur : seulement par mpb_prive.rattacher / detacher, journalisées.';

create table if not exists mpb_prive.rattachements_attente (
  mpb_issuer text not null,
  mpb_subject text not null,
  email text,
  nom text,
  candidats uuid[] not null,
  premiere_detection timestamptz not null default now(),
  derniere_detection timestamptz not null default now(),
  primary key (mpb_issuer, mpb_subject)
);
comment on table mpb_prive.rattachements_attente is 'Comptes Pro sans correspondance pour lesquels un compte historique existe peut-être (même e-mail) : aucun rattachement automatique, l''équipe tranche avec mpb_prive.rattacher().';

create table if not exists mpb_prive.journal_rattachements (
  id bigint generated always as identity primary key,
  mpb_issuer text not null,
  mpb_subject text not null,
  member_id uuid,
  action text not null check (action in ('creation_sso', 'rattachement', 'detachement', 'attente')),
  auteur text not null,
  motif text,
  le timestamptz not null default now()
);

-- ---------- Sessions et transactions SSO du serveur de l'outil ----------
create table if not exists mpb_prive.sessions (
  id_hash text primary key,                 -- SHA-256 de l'identifiant opaque du cookie (le cookie lui-même n'est jamais stocké)
  mpb_issuer text not null,
  mpb_subject text not null,
  member_id uuid references mpb_prive.membres(id) on delete restrict,
  jeton_chiffre text not null,              -- jeton MPB chiffré AES-256-GCM (clé hors base)
  jeton_expire_le timestamptz not null,
  cree_le timestamptz not null default now(),
  vu_le timestamptz not null default now()
);
create index if not exists sessions_expiration_idx on mpb_prive.sessions (jeton_expire_le);

create table if not exists mpb_prive.transactions_sso (
  state_hash text primary key,              -- SHA-256 du state
  navigateur_hash text not null,            -- SHA-256 du cookie de liaison au navigateur
  verifier_chiffre text not null,           -- code_verifier PKCE chiffré
  destination text not null,
  expire_le timestamptz not null,
  consomme_le timestamptz,
  cree_le timestamptz not null default now()
);
create index if not exists transactions_expiration_idx on mpb_prive.transactions_sso (expire_le);

-- ---------- Résolution et rattachement ----------
-- Appelée par le serveur de l'outil après chaque connexion. Ne rattache JAMAIS sur la seule base de l'e-mail :
-- si un compte historique non rattaché porte le même e-mail, le compte passe en « rattachement nécessaire ».
create or replace function mpb_prive.resoudre_membre(p_iss text, p_sub text, p_email text, p_nom text)
returns table (member_id uuid, etat text)
language plpgsql security definer set search_path = pg_catalog, mpb_prive
as $$
declare
  v_id uuid;
  v_candidats uuid[];
begin
  perform pg_advisory_xact_lock(hashtextextended(p_iss || '|' || p_sub, 0));
  select c.member_id into v_id from mpb_prive.correspondances c where c.mpb_issuer = p_iss and c.mpb_subject = p_sub;
  if v_id is not null then
    return query select v_id, 'actif'::text; return;
  end if;
  select coalesce(array_agg(u.id order by u.id), '{}') into v_candidats
  from auth.users u
  where p_email is not null and length(p_email) > 3 and lower(u.email) = lower(p_email)
    and not exists (select 1 from mpb_prive.correspondances c where c.member_id = u.id);
  if cardinality(v_candidats) > 0 then
    insert into mpb_prive.rattachements_attente (mpb_issuer, mpb_subject, email, nom, candidats)
    values (p_iss, p_sub, p_email, p_nom, v_candidats)
    on conflict (mpb_issuer, mpb_subject) do update set email = excluded.email, nom = excluded.nom, candidats = excluded.candidats, derniere_detection = now();
    insert into mpb_prive.journal_rattachements (mpb_issuer, mpb_subject, action, auteur, motif)
    values (p_iss, p_sub, 'attente', 'serveur', 'compte historique possible');
    return query select null::uuid, 'rattachement_necessaire'::text; return;
  end if;
  insert into mpb_prive.membres (origine) values ('sso') returning id into v_id;
  insert into mpb_prive.correspondances (mpb_issuer, mpb_subject, member_id, cree_par) values (p_iss, p_sub, v_id, 'sso_nouveau');
  insert into mpb_prive.journal_rattachements (mpb_issuer, mpb_subject, member_id, action, auteur) values (p_iss, p_sub, v_id, 'creation_sso', 'serveur');
  return query select v_id, 'actif'::text;
end $$;

-- Rattachement explicite d'un compte Pro à un membre existant (procédure d'équipe, depuis l'éditeur SQL).
create or replace function mpb_prive.rattacher(p_iss text, p_sub text, p_member_id uuid, p_auteur text, p_motif text)
returns void
language plpgsql security definer set search_path = pg_catalog, mpb_prive
as $$
begin
  if coalesce(trim(p_auteur), '') = '' or coalesce(trim(p_motif), '') = '' then raise exception 'auteur et motif obligatoires'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_iss || '|' || p_sub, 0));
  if not exists (select 1 from mpb_prive.membres where id = p_member_id) then raise exception 'membre % inconnu', p_member_id; end if;
  if exists (select 1 from mpb_prive.correspondances where mpb_issuer = p_iss and mpb_subject = p_sub) then
    raise exception 'ce compte Pro est déjà rattaché : utiliser d''abord mpb_prive.detacher()';
  end if;
  if exists (select 1 from mpb_prive.correspondances where member_id = p_member_id) then
    raise exception 'ce membre est déjà rattaché à un autre compte Pro';
  end if;
  insert into mpb_prive.correspondances (mpb_issuer, mpb_subject, member_id, cree_par) values (p_iss, p_sub, p_member_id, 'rattachement:' || p_auteur);
  delete from mpb_prive.rattachements_attente where mpb_issuer = p_iss and mpb_subject = p_sub;
  delete from mpb_prive.sessions where mpb_issuer = p_iss and mpb_subject = p_sub;   -- la personne se reconnecte avec le bon membre
  insert into mpb_prive.journal_rattachements (mpb_issuer, mpb_subject, member_id, action, auteur, motif) values (p_iss, p_sub, p_member_id, 'rattachement', p_auteur, p_motif);
end $$;

-- Détachement (correction d'une erreur). Le membre et ses données restent intacts.
create or replace function mpb_prive.detacher(p_iss text, p_sub text, p_auteur text, p_motif text)
returns void
language plpgsql security definer set search_path = pg_catalog, mpb_prive
as $$
declare v_id uuid;
begin
  if coalesce(trim(p_auteur), '') = '' or coalesce(trim(p_motif), '') = '' then raise exception 'auteur et motif obligatoires'; end if;
  delete from mpb_prive.correspondances where mpb_issuer = p_iss and mpb_subject = p_sub returning member_id into v_id;
  if v_id is null then raise exception 'aucune correspondance pour ce compte'; end if;
  delete from mpb_prive.sessions where mpb_issuer = p_iss and mpb_subject = p_sub;
  insert into mpb_prive.journal_rattachements (mpb_issuer, mpb_subject, member_id, action, auteur, motif) values (p_iss, p_sub, v_id, 'detachement', p_auteur, p_motif);
end $$;

revoke all on all tables in schema mpb_prive from public, anon, authenticated;
revoke all on all functions in schema mpb_prive from public, anon, authenticated;

-- Fonction lue par les Edge Functions (clé service_role uniquement) : (iss, sub) -> membre rattaché, sinon null.
create or replace function public.mpb_membre_pour(p_iss text, p_sub text)
returns uuid
language sql stable security definer set search_path = pg_catalog, mpb_prive
as $$ select c.member_id from mpb_prive.correspondances c where c.mpb_issuer = p_iss and c.mpb_subject = p_sub $$;
revoke all on function public.mpb_membre_pour(text, text) from public, anon, authenticated;
grant execute on function public.mpb_membre_pour(text, text) to service_role;

-- ---------- Nouveaux comptes Supabase Auth (tant que l'ancienne connexion existe) ----------
create or replace function mpb_prive.inscrire_membre_auth()
returns trigger language plpgsql security definer set search_path = pg_catalog, mpb_prive
as $$ begin insert into mpb_prive.membres (id, origine) values (new.id, 'legacy') on conflict (id) do nothing; return new; end $$;
revoke all on function mpb_prive.inscrire_membre_auth() from public, anon, authenticated;
drop trigger if exists mpb_inscrire_membre on auth.users;
create trigger mpb_inscrire_membre after insert on auth.users for each row execute function mpb_prive.inscrire_membre_auth();

-- ---------- Clés étrangères : auth.users -> registre (les UUID ne changent pas) ----------
alter table public.bilan_bilans        drop constraint if exists bilan_bilans_member_id_fkey;
alter table public.bilan_identite      drop constraint if exists bilan_identite_member_id_fkey;
alter table public.bilan_textes        drop constraint if exists bilan_textes_member_id_fkey;
alter table public.bilan_agent_appels  drop constraint if exists bilan_agent_appels_member_id_fkey;
alter table public.bilan_contenus      drop constraint if exists bilan_contenus_member_id_fkey;
alter table public.bilan_studio_contenu drop constraint if exists bilan_studio_contenu_member_id_fkey;
alter table public.bilan_inscriptions  drop constraint if exists bilan_inscriptions_member_id_fkey;

alter table public.bilan_bilans        add constraint bilan_bilans_member_id_fkey        foreign key (member_id) references mpb_prive.membres(id) on delete restrict;
alter table public.bilan_identite      add constraint bilan_identite_member_id_fkey      foreign key (member_id) references mpb_prive.membres(id) on delete restrict;
alter table public.bilan_textes        add constraint bilan_textes_member_id_fkey        foreign key (member_id) references mpb_prive.membres(id) on delete restrict;
alter table public.bilan_agent_appels  add constraint bilan_agent_appels_member_id_fkey  foreign key (member_id) references mpb_prive.membres(id) on delete restrict;
alter table public.bilan_contenus      add constraint bilan_contenus_member_id_fkey      foreign key (member_id) references mpb_prive.membres(id) on delete restrict;
alter table public.bilan_studio_contenu add constraint bilan_studio_contenu_member_id_fkey foreign key (member_id) references mpb_prive.membres(id) on delete restrict;
alter table public.bilan_inscriptions  add constraint bilan_inscriptions_member_id_fkey  foreign key (member_id) references mpb_prive.membres(id) on delete restrict;

-- Contrôle : aucune donnée sans membre au registre
do $$
declare n int;
begin
  select count(*) into n from (
    select member_id from public.bilan_bilans union all select member_id from public.bilan_identite
    union all select member_id from public.bilan_contenus union all select member_id from public.bilan_studio_contenu
  ) t where member_id not in (select id from mpb_prive.membres);
  if n > 0 then raise exception 'données sans membre au registre : %', n; end if;
end $$;

commit;
