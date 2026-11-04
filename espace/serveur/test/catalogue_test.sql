insert into bilan_questions (id, kind, parcours, texte, active) values ('G02', 'pratique', 'G', 'Avis Google', true), ('G99', 'pratique', 'G', 'Ancienne question', false);
insert into bilan_question_options (question_id, code, libelle, points) values ('G01', 'A', 'Oui', 2), ('G01', 'C', 'Non', 0);
insert into bilan_ressources (id, type, theme, titre, url, acces) values
  ('res-libre', 'ressource', 'fiche', 'Guide gratuit', 'https://htyvaqxdfptgswvwqplq.supabase.co/storage/v1/object/public/ressources/guide.pdf', 'tous'),
  ('res-audit', 'ressource', 'google', 'Fiche payante', 'https://htyvaqxdfptgswvwqplq.supabase.co/storage/v1/object/public/ressources/fiche.pdf', 'audit'),
  ('res-complete', 'outil', 'gestion', 'Outil studios', 'https://htyvaqxdfptgswvwqplq.supabase.co/storage/v1/object/public/ressources/outil.pdf', 'complete');
insert into bilan_evenements (id, titre, debut, acces, zoom_url) values ('20000000-0000-0000-0000-000000000002', 'Atelier studios', now() + interval '5 days', 'complete', 'https://zoom.example/secret');
insert into bilan_identite_questions (id, bloc, bloc_titre, ordre, texte, type) values ('ID01', 'vous', 'Vous', 1, 'Vos spécialités', 'multi');
