-- ═════════════════════════════════════════════════
--  Tes policy viewer read.* (supabase/bot-commands-viewer-read.sql, HO-037).
--  Dijalankan oleh scripts/test-guild-dashboard-sql.sh setelah suite Panel Developer
--  (memakai fixture & helper tests_dev di sana: owner a..01, admin a..02,
--  viewer a..03, bukan-admin a..04). Gagal = exception (psql ON_ERROR_STOP).
-- ═════════════════════════════════════════════════

\set ON_ERROR_STOP on
set client_min_messages = notice;

-- Jalankan dua kali: idempoten, tepat satu policy.
\ir ../bot-commands-viewer-read.sql
\ir ../bot-commands-viewer-read.sql
select tests_dev.ok((select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'bot_commands'
      and policyname = 'viewer tambah bot_commands baca-saja') = 1,
  'policy viewer read.* ada tepat satu setelah dijalankan dua kali');

set role authenticated;

-- ─── Viewer ───────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated"}', false);
insert into public.bot_commands (type, payload, status, created_by)
  values ('read.serverhub', '{}', 'pending', 'a0000000-0000-0000-0000-000000000003');
select tests_dev.ok(true, 'viewer boleh mengantre read.serverhub');
select tests_dev.ok((select count(*) from public.bot_commands where type = 'read.serverhub') >= 1,
  'viewer bisa membaca perintah read.* miliknya (hasilnya ditulis bot)');

select tests_dev.throws($$insert into public.bot_commands (type, payload, status, created_by)
  values ('player.view', '{}', 'pending', 'a0000000-0000-0000-0000-000000000003')$$,
  '42501', 'viewer tetap tidak boleh mengantre perintah biasa');
select tests_dev.throws($$insert into public.bot_commands (type, payload, status, created_by)
  values ('sys.bot.restart', '{}', 'pending', 'a0000000-0000-0000-0000-000000000003')$$,
  '42501', 'viewer tidak boleh mengantre sys.*');
select tests_dev.throws($$insert into public.bot_commands (type, payload, status, created_by)
  values ('read.serverhub', '{}', 'pending', 'a0000000-0000-0000-0000-000000000001')$$,
  '42501', 'viewer tidak bisa menyamar sebagai akun lain lewat created_by');
select tests_dev.throws($$insert into public.bot_commands (type, payload, status, created_by)
  values ('read.serverhub', '{}', 'done', 'a0000000-0000-0000-0000-000000000003')$$,
  '42501', 'viewer tidak bisa langsung menulis status selain pending');
select tests_dev.throws($$insert into public.bot_commands (type, payload, status, created_by)
  values ('readx.serverhub', '{}', 'pending', 'a0000000-0000-0000-0000-000000000003')$$,
  '42501', 'awalan harus persis read. (readx. ditolak)');
select tests_dev.throws($$insert into public.bot_commands (type, payload, status, created_by)
  values ('read.', '{}', 'pending', 'a0000000-0000-0000-0000-000000000003')$$,
  '42501', 'nama tipe kosong setelah read. ditolak');
select tests_dev.throws($$insert into public.bot_commands (type, payload, status, created_by)
  values ('read.a b', '{}', 'pending', 'a0000000-0000-0000-0000-000000000003')$$,
  '42501', 'karakter di luar huruf, angka, titik ditolak');
select tests_dev.throws(format($q$insert into public.bot_commands (type, payload, status, created_by)
  values ('read.serverhub', %L::jsonb, 'pending', 'a0000000-0000-0000-0000-000000000003')$q$,
  json_build_object('x', repeat('a', 3000))::text),
  '42501', 'payload di atas 2 KB ditolak');

-- ─── Bukan admin ─────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}', false);
select tests_dev.throws($$insert into public.bot_commands (type, payload, status, created_by)
  values ('read.serverhub', '{}', 'pending', 'a0000000-0000-0000-0000-000000000004')$$,
  '42501', 'akun bukan admin tidak boleh mengantre read.*');

-- ─── Admin dan owner tetap seperti semula ────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', false);
insert into public.bot_commands (type, payload, status, created_by)
  values ('read.serverhub', '{}', 'pending', 'a0000000-0000-0000-0000-000000000002');
select tests_dev.ok(true, 'admin boleh mengantre read.serverhub');
insert into public.bot_commands (type, payload, status, created_by)
  values ('game.end', '{"gameId":"G-2"}', 'pending', 'a0000000-0000-0000-0000-000000000002');
select tests_dev.ok(true, 'admin tetap boleh mengantre perintah biasa');
select tests_dev.throws($$insert into public.bot_commands (type, payload, status, created_by)
  values ('sys.db.backup', '{}', 'pending', 'a0000000-0000-0000-0000-000000000002')$$,
  'hanya boleh dikirim owner', 'admin tetap ditolak untuk sys.*');

reset role;
\ir ../bot-commands-viewer-read-rollback.sql
select tests_dev.ok((select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'bot_commands'
      and policyname = 'viewer tambah bot_commands baca-saja') = 0,
  'rollback menghapus policy');
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated"}', false);
select tests_dev.throws($$insert into public.bot_commands (type, payload, status, created_by)
  values ('read.serverhub', '{}', 'pending', 'a0000000-0000-0000-0000-000000000003')$$,
  '42501', 'setelah rollback viewer kembali tidak bisa mengantre apa pun');
reset role;
\ir ../bot-commands-viewer-read.sql
select tests_dev.ok((select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'bot_commands'
      and policyname = 'viewer tambah bot_commands baca-saja') = 1,
  'policy dipasang lagi setelah rollback');

\echo LULUS: tes policy viewer read.*
