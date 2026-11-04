-- Retour arrière de 0038 : rétablit exactement les droits et politiques relevés le 28 octobre 2026 avant la bascule,
-- pour que l'ancienne application (connexion Supabase Auth) fonctionne de nouveau. Aucune donnée n'est touchée.
-- Les membres créés par la connexion Pro (origine sso) n'ont pas de compte Supabase Auth : ils ne pourront pas
-- se connecter à l'ancienne application, mais leurs données restent en place.
-- Penser aussi à redéployer les anciennes versions des Edge Functions (verify_jwt = true), voir le guide.

begin;

do $$
declare t text;
begin
  foreach t in array array['bilan_bilans','bilan_reponses','bilan_analyses','bilan_constats','bilan_plans','bilan_plan_missions',
    'bilan_mission_suivi','bilan_identite','bilan_textes','bilan_agent_appels','bilan_inscriptions','bilan_contenus','bilan_studio_contenu',
    'bilan_parcours','bilan_questions','bilan_question_options','bilan_missions','bilan_identite_questions','bilan_evenements','bilan_ressources'] loop
    execute format('grant select, insert, update, delete, truncate, references, trigger on table public.%I to authenticated', t);
  end loop;
  -- Droits anon tels qu'ils existaient (les politiques RLS empêchaient tout accès réel sans jeton)
  foreach t in array array['bilan_agent_appels','bilan_contenus','bilan_evenements','bilan_identite','bilan_identite_questions',
    'bilan_inscriptions','bilan_ressources','bilan_studio_contenu','bilan_textes'] loop
    execute format('grant select, insert, update, delete, truncate, references, trigger on table public.%I to anon', t);
  end loop;
end $$;

create policy own on public.bilan_bilans for all to authenticated using (member_id = (select auth.uid())) with check (member_id = (select auth.uid()));
create policy own on public.bilan_reponses for all to authenticated
  using (exists (select 1 from bilan_bilans b where b.id = bilan_reponses.bilan_id and b.member_id = (select auth.uid())))
  with check (exists (select 1 from bilan_bilans b where b.id = bilan_reponses.bilan_id and b.member_id = (select auth.uid())));
create policy own_read on public.bilan_analyses for select to authenticated
  using (exists (select 1 from bilan_bilans b where b.id = bilan_analyses.bilan_id and b.member_id = (select auth.uid())));
create policy own_read on public.bilan_constats for select to authenticated
  using (exists (select 1 from bilan_bilans b where b.id = bilan_constats.bilan_id and b.member_id = (select auth.uid())));
create policy own_update on public.bilan_constats for update to authenticated
  using (exists (select 1 from bilan_bilans b where b.id = bilan_constats.bilan_id and b.member_id = (select auth.uid())));
create policy own_read on public.bilan_plans for select to authenticated
  using (exists (select 1 from bilan_bilans b where b.id = bilan_plans.bilan_id and b.member_id = (select auth.uid())));
create policy own on public.bilan_plan_missions for all to authenticated
  using (exists (select 1 from bilan_plans p join bilan_bilans b on b.id = p.bilan_id where p.id = bilan_plan_missions.plan_id and b.member_id = (select auth.uid())));
create policy own on public.bilan_mission_suivi for all to authenticated
  using (exists (select 1 from bilan_bilans b where b.id = bilan_mission_suivi.bilan_id and b.member_id = (select auth.uid())))
  with check (exists (select 1 from bilan_bilans b where b.id = bilan_mission_suivi.bilan_id and b.member_id = (select auth.uid())));
create policy "identite perso" on public.bilan_identite for all to authenticated using (member_id = auth.uid()) with check (member_id = auth.uid());
create policy "textes perso" on public.bilan_textes for all to authenticated using (member_id = auth.uid()) with check (member_id = auth.uid());
create policy "appels perso lisibles" on public.bilan_agent_appels for select to authenticated using (member_id = auth.uid());
create policy inscr_own on public.bilan_inscriptions for all to authenticated using (member_id = auth.uid()) with check (member_id = auth.uid());
create policy "contenus lecture" on public.bilan_contenus for select to public using (auth.uid() = member_id);
create policy "contenus maj" on public.bilan_contenus for update to public using (auth.uid() = member_id) with check (auth.uid() = member_id);
create policy "contenus suppression" on public.bilan_contenus for delete to public using (auth.uid() = member_id);
create policy "studio contenu lecture" on public.bilan_studio_contenu for select to public using (auth.uid() = member_id);
create policy catalogue_read on public.bilan_parcours for select to authenticated using (true);
create policy catalogue_read on public.bilan_questions for select to authenticated using (true);
create policy catalogue_read on public.bilan_question_options for select to authenticated using (true);
create policy catalogue_read on public.bilan_missions for select to authenticated using (true);
create policy "catalogue identite lisible" on public.bilan_identite_questions for select to authenticated using (true);
create policy evenements_read on public.bilan_evenements for select to authenticated using (actif);

-- Les comptes Supabase Auth créés pendant le retour arrière redeviennent des membres
create or replace function mpb_prive.inscrire_membre_auth()
returns trigger language plpgsql security definer set search_path = pg_catalog, mpb_prive
as $$ begin insert into mpb_prive.membres (id, origine) values (new.id, 'legacy') on conflict (id) do nothing; return new; end $$;
drop trigger if exists mpb_inscrire_membre on auth.users;
create trigger mpb_inscrire_membre after insert on auth.users for each row execute function mpb_prive.inscrire_membre_auth();

insert into mpb_prive.bascule (etape) values ('0038 annulée : connexion Supabase Auth rétablie');

commit;
