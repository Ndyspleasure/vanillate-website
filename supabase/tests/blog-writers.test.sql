-- ════════════════════════════════════════════════════════════════════════════
--  Tes Portal Penulis Blog (supabase/blog-writers.sql). Dijalankan oleh
--  scripts/test-guild-dashboard-sql.sh setelah suite Panel Developer (memakai
--  tests_dev.ok/throws dan admin_users).
--  Cakupan: anon/authenticated tidak punya akses langsung, batas pengajuan
--  (3 menunggu, 5 per 24 jam), Discord wajib tertaut, penulis diblokir tidak
--  bisa mengajukan, alur status, alasan tolak wajib dan tercatat di riwayat,
--  revisi menggantikan tulisan terbit, hapus permanen ikut menghapus riwayat
--  dan mengembalikan path gambar, idempoten, rollback.
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
reset role;
set client_min_messages = notice;

\ir ../blog-writers.sql
\ir ../blog-writers.sql

insert into auth.users (id, email) values
  ('c0000000-0000-0000-0000-000000000001', 'penulis1@contoh.id'),
  ('c0000000-0000-0000-0000-000000000002', 'penulis2@contoh.id'),
  ('c0000000-0000-0000-0000-000000000003', 'tanpa-discord@contoh.id'),
  ('c0000000-0000-0000-0000-000000000004', 'diblokir@contoh.id'),
  ('a0000000-0000-0000-0000-000000000201', 'peninjau@contoh.id')
on conflict (id) do nothing;
insert into public.admin_users (id, username, role) values
  ('a0000000-0000-0000-0000-000000000201', 'peninjau_bw', 'admin')
on conflict (id) do nothing;

select tests_dev.throws($$insert into public.blog_writers (user_id, display_name, slug)
  values ('c0000000-0000-0000-0000-000000000001', 'A', 'AB')$$, '23514', 'slug penulis tidak sah ditolak');
select tests_dev.throws($$insert into public.blog_writers (user_id, display_name, slug, discord_id)
  values ('c0000000-0000-0000-0000-000000000001', 'A', 'penulis-satu', 'bukan-angka')$$, '23514', 'discord_id tidak sah ditolak');

insert into public.blog_writers (user_id, display_name, slug, discord_id, discord_username) values
  ('c0000000-0000-0000-0000-000000000001', 'Penulis Satu', 'penulis-satu', '111111111111111111', 'satu'),
  ('c0000000-0000-0000-0000-000000000002', 'Penulis Dua',  'penulis-dua',  '222222222222222222', 'dua'),
  ('c0000000-0000-0000-0000-000000000003', 'Tanpa Discord', 'tanpa-discord', null, null);
insert into public.blog_writers (user_id, display_name, slug, discord_id, status) values
  ('c0000000-0000-0000-0000-000000000004', 'Diblokir', 'diblokir', '444444444444444444', 'diblokir');

select tests_dev.throws($$insert into public.blog_writers (user_id, display_name, slug)
  values ('c0000000-0000-0000-0000-000000000002', 'Dobel', 'penulis-satu')$$, '23505', 'slug penulis harus unik');

-- ─── Tidak ada akses langsung untuk anon / authenticated ────────────────────
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-0000-0000-000000000001","role":"authenticated"}', false);
select tests_dev.throws($$select * from public.blog_writers$$, '42501', 'authenticated tidak bisa membaca penulis');
select tests_dev.throws($$select * from public.blog_submissions$$, '42501', 'authenticated tidak bisa membaca tulisan');
select tests_dev.throws($$select * from public.blog_review_log$$, '42501', 'authenticated tidak bisa membaca riwayat');
select tests_dev.throws($$insert into public.blog_submissions (writer_id, title) values ('c0000000-0000-0000-0000-000000000001', 'x')$$,
  '42501', 'authenticated tidak bisa menulis langsung');
select tests_dev.throws($$select public.blog_submission_submit(gen_random_uuid(), 'c0000000-0000-0000-0000-000000000001')$$,
  '42501', 'authenticated tidak bisa memanggil fungsi ajukan');
select tests_dev.throws($$select public.blog_submission_review(gen_random_uuid(), 'setujui', null, null, 'post-x')$$,
  '42501', 'authenticated tidak bisa memanggil fungsi tinjau');
set role anon;
select tests_dev.throws($$select * from public.blog_submissions$$, '42501', 'anon tidak bisa membaca tulisan');
reset role;

-- ─── Alur status dan batas ──────────────────────────────────────────────────
set role service_role;

insert into public.blog_submissions (id, writer_id, title, slug, body) values
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Tulisan Pertama', 'tulisan-pertama', 'isi'),
  ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'Tulisan Kedua', 'tulisan-kedua', 'isi'),
  ('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'Tulisan Ketiga', 'tulisan-ketiga', 'isi'),
  ('d0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', 'Tulisan Keempat', 'tulisan-keempat', 'isi'),
  ('d0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000001', 'Pdk', 'pendek-sekali', 'isi'),
  ('d0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000001', 'Tanpa Slug Dulu', null, 'isi');

select tests_dev.throws($$insert into public.blog_submissions (writer_id, title, slug)
  values ('c0000000-0000-0000-0000-000000000002', 'Slug Kembar', 'tulisan-pertama')$$, '23505', 'slug tulisan harus unik');
select tests_dev.throws($$insert into public.blog_submissions (writer_id, status) values ('c0000000-0000-0000-0000-000000000001', 'ditolak')$$,
  '23514', 'status ditolak tanpa alasan ditolak');
select tests_dev.throws($$insert into public.blog_submissions (writer_id, body) values ('c0000000-0000-0000-0000-000000000001', repeat('a', 60001))$$,
  '23514', 'isi di atas 60000 karakter ditolak');

select tests_dev.throws($$select public.blog_submission_submit('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002')$$,
  '22023', 'penulis lain tidak bisa mengajukan tulisan orang');
select tests_dev.throws($$select public.blog_submission_submit('d0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000001')$$,
  '22023', 'judul di bawah 5 karakter ditolak');
select tests_dev.throws($$select public.blog_submission_submit('d0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000001')$$,
  '22023', 'tanpa slug ditolak');

-- Discord wajib, penulis diblokir ditolak.
insert into public.blog_submissions (id, writer_id, title, slug) values
  ('d0000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-000000000003', 'Tanpa Discord Tulis', 'tanpa-discord-tulis'),
  ('d0000000-0000-0000-0000-000000000012', 'c0000000-0000-0000-0000-000000000004', 'Diblokir Tulis', 'diblokir-tulis');
select tests_dev.throws($$select public.blog_submission_submit('d0000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-000000000003')$$,
  '22023', 'tanpa Discord tertaut tidak bisa mengajukan');
select tests_dev.throws($$select public.blog_submission_submit('d0000000-0000-0000-0000-000000000012', 'c0000000-0000-0000-0000-000000000004')$$,
  '42501', 'penulis diblokir tidak bisa mengajukan');

-- Batas 3 menunggu sekaligus.
select public.blog_submission_submit('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001');
select public.blog_submission_submit('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001');
select public.blog_submission_submit('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001');
select tests_dev.ok(
  (select count(*) = 3 and bool_and(submitted_at is not null) from public.blog_submissions where status = 'menunggu'),
  'tiga tulisan menunggu dengan waktu ajuan');
select tests_dev.throws($$select public.blog_submission_submit('d0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001')$$,
  '53400', 'tulisan menunggu ke-4 ditolak');
select tests_dev.throws($$select public.blog_submission_submit('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001')$$,
  '22023', 'tulisan yang sudah menunggu tidak bisa diajukan lagi');

-- Alur status sah / tidak sah.
select tests_dev.throws($$update public.blog_submissions set status = 'terbit', sanity_id = 'post-x'
  where id = 'd0000000-0000-0000-0000-000000000004'$$, '22023', 'draf tidak bisa langsung terbit');

-- ─── Tinjau ─────────────────────────────────────────────────────────────────
select tests_dev.throws($$select public.blog_submission_review('d0000000-0000-0000-0000-000000000001', 'tolak', 'a0000000-0000-0000-0000-000000000201', '  ', null)$$,
  '22023', 'penolakan tanpa alasan ditolak');
select tests_dev.throws($$select public.blog_submission_review('d0000000-0000-0000-0000-000000000001', 'setujui', 'a0000000-0000-0000-0000-000000000201', null, null)$$,
  '22023', 'persetujuan tanpa id Sanity ditolak');
select tests_dev.throws($$select public.blog_submission_review('d0000000-0000-0000-0000-000000000001', 'lainnya', null, null, null)$$,
  '22023', 'aksi tidak dikenal ditolak');
select tests_dev.throws($$select public.blog_submission_review('d0000000-0000-0000-0000-000000000004', 'tolak', null, 'alasan', null)$$,
  '22023', 'hanya tulisan menunggu yang bisa ditinjau');

select tests_dev.ok(
  public.blog_submission_review('d0000000-0000-0000-0000-000000000001', 'tolak', 'a0000000-0000-0000-0000-000000000201', 'Terlalu singkat, tambahkan contoh.', null)->>'title' = 'Tulisan Pertama',
  'penolakan mengembalikan judul untuk email');
select tests_dev.ok(
  (select status = 'ditolak' and reject_reason = 'Terlalu singkat, tambahkan contoh.' and reviewed_by is not null
     from public.blog_submissions where id = 'd0000000-0000-0000-0000-000000000001'),
  'tulisan ditolak menyimpan alasan');
select tests_dev.ok(
  (select count(*) = 1 from public.blog_review_log
    where submission_id = 'd0000000-0000-0000-0000-000000000001' and action = 'tolak' and reason like 'Terlalu singkat%'),
  'riwayat mencatat penolakan beserta alasan');

-- Revisi: ajukan ulang menghapus alasan di tulisan, riwayat tetap.
select public.blog_submission_submit('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001');
select tests_dev.ok(
  (select status = 'menunggu' and reject_reason is null from public.blog_submissions where id = 'd0000000-0000-0000-0000-000000000001'),
  'ajukan ulang membersihkan alasan di tulisan');
select tests_dev.ok(
  (select count(*) = 1 from public.blog_review_log where submission_id = 'd0000000-0000-0000-0000-000000000001' and action = 'tolak'),
  'riwayat penolakan lama tetap ada setelah diajukan ulang');

select public.blog_submission_review('d0000000-0000-0000-0000-000000000001', 'setujui', 'a0000000-0000-0000-0000-000000000201', null, 'post-aaa');
select tests_dev.ok(
  (select status = 'terbit' and sanity_id = 'post-aaa' from public.blog_submissions where id = 'd0000000-0000-0000-0000-000000000001'),
  'persetujuan menjadikan tulisan terbit');
select tests_dev.throws($$update public.blog_submissions set status = 'draf' where id = 'd0000000-0000-0000-0000-000000000001'$$,
  '22023', 'tulisan terbit tidak bisa kembali ke draf');

-- ─── Batas 5 pengajuan per 24 jam ───────────────────────────────────────────
-- Sudah ada 4 pengajuan (3 awal + 1 ajukan ulang). Tolak dua agar slot menunggu kosong.
select public.blog_submission_review('d0000000-0000-0000-0000-000000000002', 'tolak', null, 'tidak sesuai', null);
select public.blog_submission_review('d0000000-0000-0000-0000-000000000003', 'tolak', null, 'tidak sesuai', null);
select public.blog_submission_submit('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001');
select tests_dev.throws($$select public.blog_submission_submit('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001')$$,
  '53400', 'pengajuan ke-6 dalam 24 jam ditolak');
update public.blog_review_log set at = now() - interval '25 hours' where action = 'ajukan';
select public.blog_submission_submit('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001');
select tests_dev.ok(
  (select status = 'menunggu' from public.blog_submissions where id = 'd0000000-0000-0000-0000-000000000003'),
  'batas harian reda setelah 24 jam');

-- ─── Revisi tulisan terbit ──────────────────────────────────────────────────
select tests_dev.throws($$select public.blog_submission_revise('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001')$$,
  '22023', 'hanya tulisan terbit yang bisa direvisi');
select tests_dev.throws($$select public.blog_submission_revise('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002')$$,
  '22023', 'penulis lain tidak bisa merevisi');

create temp table rev as
  select public.blog_submission_revise('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001') as id;
select tests_dev.ok(
  (select count(*) = 1 from public.blog_submissions r join rev on r.id = rev.id
    where r.status = 'draf' and r.revision_of = 'post-aaa' and r.slug = 'tulisan-pertama' and r.title = 'Tulisan Pertama'),
  'revisi menyalin tulisan terbit menjadi draf');
select tests_dev.throws($$select public.blog_submission_revise('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001')$$,
  '22023', 'satu tulisan hanya punya satu revisi berjalan');

update public.blog_submissions set title = 'Tulisan Pertama (revisi)', body = 'isi baru'
  where id = (select id from rev);
update public.blog_review_log set at = now() - interval '25 hours' where action = 'ajukan';
-- Kosongkan slot menunggu agar revisi bisa diajukan.
select public.blog_submission_review('d0000000-0000-0000-0000-000000000002', 'tolak', null, 'tidak sesuai', null);
select public.blog_submission_submit((select id from rev), 'c0000000-0000-0000-0000-000000000001');
select tests_dev.ok(
  (select status = 'terbit' from public.blog_submissions where id = 'd0000000-0000-0000-0000-000000000001'),
  'versi lama tetap terbit selama revisi menunggu');

select public.blog_submission_review((select id from rev), 'setujui', 'a0000000-0000-0000-0000-000000000201', null, 'post-aaa');
select tests_dev.ok(
  (select count(*) = 0 from public.blog_submissions where id = 'd0000000-0000-0000-0000-000000000001'),
  'persetujuan revisi menggantikan baris tulisan lama');
select tests_dev.ok(
  (select count(*) = 1 and bool_and(status = 'terbit' and revision_of is null and sanity_id = 'post-aaa' and body = 'isi baru')
     from public.blog_submissions where slug = 'tulisan-pertama'),
  'baris revisi menjadi tulisan terbit dengan isi baru');

-- ─── Hapus permanen ─────────────────────────────────────────────────────────
update public.blog_submissions
   set main_image_path = 'c0000000-0000-0000-0000-000000000001/a.webp',
       image_paths = array['c0000000-0000-0000-0000-000000000001/a.webp', 'c0000000-0000-0000-0000-000000000001/b.webp']
 where id = 'd0000000-0000-0000-0000-000000000002';
select tests_dev.ok(
  (select count(*) >= 2 from public.blog_review_log where submission_id = 'd0000000-0000-0000-0000-000000000002'),
  'tulisan yang akan dihapus punya riwayat');
select tests_dev.ok(
  (select cardinality(public.blog_submission_delete('d0000000-0000-0000-0000-000000000002')) = 2),
  'hapus permanen mengembalikan path gambar tanpa duplikat');
select tests_dev.ok(
  (select count(*) = 0 from public.blog_review_log where submission_id = 'd0000000-0000-0000-0000-000000000002')
  and (select count(*) = 0 from public.blog_submissions where id = 'd0000000-0000-0000-0000-000000000002'),
  'hapus permanen ikut menghapus riwayat');
select tests_dev.throws($$select public.blog_submission_delete('d0000000-0000-0000-0000-000000000002')$$,
  '22023', 'hapus tulisan yang tidak ada ditolak');

-- Akun penulis dihapus: semua tulisannya ikut terhapus.
reset role;
delete from auth.users where id = 'c0000000-0000-0000-0000-000000000004';
select tests_dev.ok((select count(*) = 0 from public.blog_submissions where writer_id = 'c0000000-0000-0000-0000-000000000004'),
  'hapus akun penulis menghapus tulisannya');

-- ─── Rollback ───────────────────────────────────────────────────────────────
\ir ../blog-writers-rollback.sql
select tests_dev.ok(
  (select count(*) = 0 from information_schema.tables
    where table_schema = 'public' and table_name in ('blog_writers', 'blog_submissions', 'blog_review_log'))
  and (select count(*) = 0 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname like 'blog\_submission%'),
  'rollback menghapus tabel dan fungsi');
\ir ../blog-writers.sql
select tests_dev.ok((select count(*) = 3 from information_schema.tables
    where table_schema = 'public' and table_name in ('blog_writers', 'blog_submissions', 'blog_review_log')),
  'skema bisa diterapkan lagi setelah rollback');
\ir ../blog-writers-rollback.sql
delete from auth.users where id in (
  'c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002',
  'c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000201');
