-- ════════════════════════════════════════════════════════════════════════════
--  Tes Showcase Server (supabase/showcase-servers.sql).
--  Dijalankan oleh scripts/test-guild-dashboard-sql.sh SETELAH suite Panel
--  Developer: memakai admin_users, fungsi peran, dan helper tests_dev.ok/throws.
--  Migrasi dijalankan dua kali di sini (idempoten).
--  Cakupan: RLS (anon tidak membaca tabel, viewer hanya membaca), RPC publik
--  menyaring server tersembunyi dan tidak membocorkan alasan, daftar diganti
--  utuh, batas format, dan riwayat tinjauan.
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
reset role;
\i supabase/showcase-servers.sql
\i supabase/showcase-servers.sql

insert into public.showcase_snapshot (bot_slug, data, total) values
  ('vanillateID',
   '[{"i":"811111111111111111","n":"Server A","h":null,"m":40},{"i":"822222222222222222","n":"Server B","h":"abc","m":120,"v":"kodeB"},{"i":"833333333333333333","n":"Server C","h":null,"m":5}]'::jsonb, 3);

-- ─── RPC publik ─────────────────────────────────────────────────────────────
set role anon;
select tests_dev.ok((select jsonb_array_length(public.showcase_public_list() -> 'servers') = 3), 'anon melihat 3 server lewat RPC publik');
select tests_dev.ok((select public.showcase_public_list() ->> 'updated_at' is not null), 'updated_at ikut dikembalikan');
select tests_dev.ok((select jsonb_array_length(public.showcase_public_list('slug-tidak-ada') -> 'servers') = 0), 'slug tanpa daftar = kosong, bukan error');
select tests_dev.ok((select count(*) = 0 from public.showcase_snapshot), 'anon tidak bisa membaca snapshot langsung');
select tests_dev.ok((select count(*) = 0 from public.showcase_hidden), 'anon tidak bisa membaca daftar tinjauan');
select tests_dev.throws($$insert into public.showcase_hidden (guild_id) values ('899999999999999999')$$, '42501', 'anon tidak bisa menyembunyikan');
reset role;

-- ─── Viewer: baca saja ──────────────────────────────────────────────────────
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated"}', false);
select tests_dev.ok((select count(*) = 1 from public.showcase_snapshot), 'viewer bisa membaca snapshot');
select tests_dev.throws($$insert into public.showcase_hidden (guild_id) values ('822222222222222222')$$, '42501', 'viewer tidak bisa menyembunyikan');

-- ─── Editor: sembunyikan, ubah, tampilkan lagi ──────────────────────────────
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', false);
insert into public.showcase_hidden (guild_id, reason, note, hidden_by)
  values ('822222222222222222', 'violation', 'catatan internal', 'a0000000-0000-0000-0000-000000000002');
select tests_dev.ok((select count(*) = 1 from public.showcase_hidden), 'editor bisa menyembunyikan server');
select tests_dev.throws($$insert into public.showcase_hidden (guild_id) values ('bukan-id')$$, '23514', 'format ID server dicek');
select tests_dev.throws($$insert into public.showcase_hidden (guild_id, reason) values ('844444444444444444', 'asal')$$, '23514', 'kode alasan dibatasi');
select tests_dev.throws($$insert into public.showcase_hidden (guild_id, note) values ('844444444444444444', repeat('x', 501))$$, '23514', 'catatan maksimal 500 karakter');
reset role;

set role anon;
select tests_dev.ok((select jsonb_array_length(public.showcase_public_list() -> 'servers') = 2), 'server tersembunyi hilang dari RPC publik');
select tests_dev.ok((select public.showcase_public_list()::text !~ '822222222222222222|violation|catatan internal'), 'RPC publik tidak membocorkan ID, alasan, atau catatan');
reset role;

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', false);
update public.showcase_hidden set reason = 'review' where guild_id = '822222222222222222';
delete from public.showcase_hidden where guild_id = '822222222222222222';
select tests_dev.ok((select count(*) = 3 from public.showcase_hidden_log where guild_id = '822222222222222222'), 'riwayat mencatat hide, update, unhide');
select tests_dev.ok((select string_agg(action, ',' order by id) = 'hide,update,unhide' from public.showcase_hidden_log where guild_id = '822222222222222222'), 'urutan riwayat benar');
delete from public.showcase_hidden_log;
select tests_dev.ok((select count(*) = 3 from public.showcase_hidden_log where guild_id = '822222222222222222'), 'riwayat tidak bisa dihapus lewat API (RLS menyaring semua baris)');
reset role;

set role anon;
select tests_dev.ok((select jsonb_array_length(public.showcase_public_list() -> 'servers') = 3), 'ditampilkan lagi setelah tinjauan dicabut');
reset role;

-- ─── Daftar diganti utuh (bot keluar dari server = hilang) ───────────────────
insert into public.showcase_snapshot (bot_slug, data, total, updated_at)
  values ('vanillateID', '[{"i":"811111111111111111","n":"Server A","h":null,"m":40}]'::jsonb, 1, now())
  on conflict (bot_slug) do update set data = excluded.data, total = excluded.total, updated_at = excluded.updated_at;
set role anon;
select tests_dev.ok((select jsonb_array_length(public.showcase_public_list() -> 'servers') = 1), 'terbitan baru mengganti daftar lama sepenuhnya');
reset role;
select tests_dev.throws($$insert into public.showcase_snapshot (bot_slug, data) values ('x', '{}'::jsonb)$$, '23514', 'data wajib berupa array');

delete from public.showcase_snapshot;
delete from public.showcase_hidden_log;

select 'LULUS - Showcase Server';
