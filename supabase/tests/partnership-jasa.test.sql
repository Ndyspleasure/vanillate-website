-- Tes supabase/partnership-jasa.sql. Dijalankan scripts/test-guild-dashboard-sql.sh
-- setelah suite Portal Partner (memakai tests_dev.ok, admin_users, is_admin*).
-- Cakupan: idempoten, isi awal, RLS aktif + dua policy, suntingan admin tidak
-- ditimpa saat dijalankan ulang, hanya satu baris, rollback.
\set ON_ERROR_STOP on
reset role;
set client_min_messages = notice;

\ir ../partnership-jasa.sql
\ir ../partnership-jasa.sql

select tests_dev.ok((select count(*) = 1 from public.partnership_jasa_page), 'satu baris isi awal');
select tests_dev.ok(
  (select jsonb_array_length(content->'packages') = 2 from public.partnership_jasa_page where id = 1),
  'dua paket awal');
select tests_dev.ok(
  (select (content->'packages'->0->>'price')::numeric = 5000
      and jsonb_array_length(content->'packages'->0->'specs') = 4
   from public.partnership_jasa_page where id = 1),
  'paket hosting: harga dan empat spesifikasi');
select tests_dev.ok(
  (select (content->'packages'->1->>'price')::numeric = 30000 from public.partnership_jasa_page where id = 1),
  'paket pembuatan bot: harga');
select tests_dev.ok(
  (select relrowsecurity from pg_class where oid = 'public.partnership_jasa_page'::regclass),
  'RLS aktif');
select tests_dev.ok(
  (select count(*) = 2 from pg_policies where tablename = 'partnership_jasa_page'),
  'dua policy (admin baca, editor kelola)');
select tests_dev.throws($$insert into public.partnership_jasa_page (id) values (2)$$, '23514', 'hanya id = 1');

update public.partnership_jasa_page set content = '{"x":1}'::jsonb where id = 1;
\ir ../partnership-jasa.sql
select tests_dev.ok(
  (select content = '{"x":1}'::jsonb from public.partnership_jasa_page where id = 1),
  'menjalankan ulang tidak menimpa suntingan admin');

\ir ../partnership-jasa-rollback.sql
select tests_dev.ok(
  (select count(*) = 0 from information_schema.tables where table_name = 'partnership_jasa_page'),
  'rollback menghapus tabel');
