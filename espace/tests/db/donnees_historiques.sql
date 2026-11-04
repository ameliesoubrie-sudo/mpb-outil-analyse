-- Jeu de données historique : 2 membres Supabase Auth avec données, 1 compte sans données, 1 UUID orphelin (sans compte).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000aa', 'camille@test.fr'),
  ('00000000-0000-0000-0000-0000000000bb', 'lea@test.fr'),
  ('00000000-0000-0000-0000-0000000000cc', 'sans-donnees@test.fr');
insert into bilan_parcours (code, titre, ordre) values ('F', 'Fiche', 1), ('G', 'Google', 2);
insert into bilan_questions (id, kind, parcours, texte) values ('P04', 'contexte', null, 'Vos supports'), ('G01', 'pratique', 'G', 'Fiche Google');
insert into bilan_missions (id, parcours, titre, duree_min) values ('MG01', 'G', 'Créer sa fiche', 30);
insert into bilan_bilans (id, member_id) values
  ('10000000-0000-0000-0000-0000000000aa', '00000000-0000-0000-0000-0000000000aa'),
  ('10000000-0000-0000-0000-0000000000bb', '00000000-0000-0000-0000-0000000000bb');
insert into bilan_reponses (bilan_id, question_id, valeur) values ('10000000-0000-0000-0000-0000000000aa', 'G01', '{A}'), ('10000000-0000-0000-0000-0000000000bb', 'G01', '{C}');
insert into bilan_identite (member_id, reponses) values ('00000000-0000-0000-0000-0000000000aa', '{"ID01":{"v":["Grossesse"]}}');
insert into bilan_contenus (member_id, format, resultat) values ('00000000-0000-0000-0000-0000000000bb', 'bio', '{}');
insert into bilan_agent_appels (member_id, agent) values ('00000000-0000-0000-0000-0000000000aa', 'identite');
insert into bilan_textes (member_id, cle, texte) values ('00000000-0000-0000-0000-0000000000aa', 'bio', 'texte');
insert into bilan_evenements (id, titre, debut) values ('20000000-0000-0000-0000-000000000001', 'Masterclass', now() + interval '3 days');
insert into bilan_inscriptions (evenement_id, member_id) values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000bb');
-- UUID orphelin : donnée dont le compte a disparu (pas de FK sur bilan_studio_contenu dans ce cas simulé)
alter table bilan_studio_contenu drop constraint bilan_studio_contenu_member_id_fkey;
insert into bilan_studio_contenu (member_id) values ('00000000-0000-0000-0000-0000000000dd');
