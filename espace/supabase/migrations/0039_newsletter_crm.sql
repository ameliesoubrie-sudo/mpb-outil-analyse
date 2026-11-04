-- 0039 : « lettre » devient « newsletter » (demande d'Amélie du 2 novembre 2026)
create or replace function pg_temp.nl(s text) returns text language sql as $$
  select regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(s,
    '\mlettre d''information\M', 'newsletter', 'g'),
    '\mLettres\M', 'Newsletters', 'g'), '\mlettres\M', 'newsletters', 'g'),
    '\mLettre\M', 'Newsletter', 'g'), '\mlettre\M', 'newsletter', 'g') $$;
update bilan_missions set titre = pg_temp.nl(titre), methode = pg_temp.nl(methode), critere_fin = pg_temp.nl(critere_fin),
  etapes = pg_temp.nl(etapes::text)::jsonb, ressources = pg_temp.nl(ressources::text)::jsonb,
  comprendre = pg_temp.nl(comprendre::text)::jsonb, updated_at = now()
where id in ('MEN4','MES4','MER2');
update bilan_ressources set titre = pg_temp.nl(titre), description = pg_temp.nl(description), updated_at = now() where id = 'mission-men4';
