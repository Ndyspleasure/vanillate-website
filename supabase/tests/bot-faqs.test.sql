-- ════════════════════════════════════════════════════════════════════════════
--  Tes FAQ Bot (supabase/bot-faqs.sql).
--  Dijalankan oleh scripts/test-guild-dashboard-sql.sh (suite keempat) SETELAH
--  suite Panel Developer — memakai admin_users, fungsi peran, dan helper
--  tests_dev.ok/throws dari sana. Migrasi sudah dijalankan dua kali sebelumnya.
--  Cakupan: isi awal sekali saja (idempoten), batas panjang, updated_at, RLS
--  (anon & viewer tidak bisa menulis, viewer bisa baca, admin bisa kelola).
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
reset role;

select tests_dev.ok((select count(*) = 25 from public.bot_faqs), 'isi awal 25 FAQ, tidak berlipat walau migrasi dijalankan dua kali');
select tests_dev.ok((select count(*) = 0 from public.bot_faqs where question ~ '/(support|masukan|supportfaq)\M' or answer ~ '`/(support|masukan|supportfaq)`'),
  'isi awal tidak menyebut command yang sudah dihapus');
select tests_dev.ok((select bool_and(enabled) and count(distinct sort) = count(*) from public.bot_faqs), 'isi awal aktif dengan urutan unik');

select tests_dev.throws($$insert into public.bot_faqs (question, answer) values ('   ', 'jawaban')$$, '23514', 'pertanyaan kosong ditolak');
select tests_dev.throws($$insert into public.bot_faqs (question, answer) values ('tanya', repeat('x', 4001))$$, '23514', 'jawaban > 4000 karakter ditolak');

-- ─── RLS ────────────────────────────────────────────────────────────────────
set role anon;
select tests_dev.ok((select count(*) = 0 from public.bot_faqs), 'anon tidak bisa membaca');
reset role;

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated"}', false);
select tests_dev.ok((select count(*) = 25 from public.bot_faqs), 'viewer bisa membaca');
select tests_dev.throws($$insert into public.bot_faqs (question, answer) values ('viewer', 'tidak boleh')$$, '42501', 'viewer tidak bisa menambah');

select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', false);
insert into public.bot_faqs (question, answer, sort, updated_by)
  values ('Pertanyaan uji', 'Jawaban uji', 999, 'a0000000-0000-0000-0000-000000000002');
select tests_dev.ok((select count(*) = 26 from public.bot_faqs), 'admin bisa menambah');
update public.bot_faqs set answer = 'Jawaban baru', updated_at = now() - interval '1 day' where question = 'Pertanyaan uji';
select tests_dev.ok((select updated_at > now() - interval '1 minute' from public.bot_faqs where question = 'Pertanyaan uji'), 'updated_at diperbarui otomatis');
delete from public.bot_faqs where question = 'Pertanyaan uji';
select tests_dev.ok((select count(*) = 25 from public.bot_faqs), 'admin bisa menghapus');
reset role;

select 'LULUS - FAQ Bot';
