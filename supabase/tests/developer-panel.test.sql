-- ════════════════════════════════════════════════════════════════════════════
--  Tes skema Panel Developer (supabase/developer-panel-schema.sql +
--  supabase/developer-panel-settings.sql).
--  Dijalankan oleh scripts/test-guild-dashboard-sql.sh (suite kedua) di atas
--  Postgres lokal + supabase-stub.sql + developer-panel-prereq.sql.
--  Gagal = exception (psql ON_ERROR_STOP).
--
--  Cakupan: penjaga owner untuk perintah `sys.*` (owner / admin / viewer /
--  service_role), RLS snapshot (admin baca, non-admin & tulis ditolak), RLS
--  bucket bot-backups (hanya owner), kolom progress/heartbeat, dan seed setting
--  yang tidak menimpa nilai yang sudah ada saat dijalankan ulang.
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
set client_min_messages = notice;

create schema if not exists tests_dev;
grant usage on schema tests_dev to anon, authenticated, service_role;

create or replace function tests_dev.ok(p_cond boolean, p_name text)
returns void language plpgsql as $$
begin
  if p_cond is distinct from true then
    raise exception 'GAGAL: %', p_name;
  end if;
  raise notice 'ok - %', p_name;
end $$;

create or replace function tests_dev.throws(p_sql text, p_code text, p_name text)
returns void language plpgsql as $$
declare
  v_msg text; v_state text;
begin
  execute p_sql;
  raise exception 'GAGAL: % (tidak ada error, harusnya %)', p_name, p_code;
exception when others then
  get stacked diagnostics v_msg = message_text, v_state = returned_sqlstate;
  if v_msg like 'GAGAL:%' then raise; end if;
  if position(p_code in v_msg) = 0 and v_state <> p_code then
    raise exception 'GAGAL: % (dapat "%" [%], harusnya %)', p_name, v_msg, v_state, p_code;
  end if;
  raise notice 'ok - %', p_name;
end $$;

grant execute on all functions in schema tests_dev to anon, authenticated, service_role;

-- ─── Fixture ────────────────────────────────────────────────────────────────
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'owner@contoh.id'),
  ('a0000000-0000-0000-0000-000000000002', 'admin@contoh.id'),
  ('a0000000-0000-0000-0000-000000000003', 'viewer@contoh.id'),
  ('a0000000-0000-0000-0000-000000000004', 'luar@contoh.id');
insert into public.admin_users (id, username, role) values
  ('a0000000-0000-0000-0000-000000000001', 'owner', 'owner'),
  ('a0000000-0000-0000-0000-000000000002', 'admin', 'admin'),
  ('a0000000-0000-0000-0000-000000000003', 'viewer', 'viewer');

insert into public.bot_panel_snapshots (key, data) values ('system', '{"ok":true}');
insert into storage.objects (bucket_id, name) values ('bot-backups', 'sambungkata-uji.db.gz');

-- Nilai yang sudah ada TIDAK boleh tertimpa saat skema dijalankan ulang.
update public.bot_settings set value = 'false' where key = 'tutorial_enabled';
\ir ../developer-panel-schema.sql
\ir ../developer-panel-settings.sql
select tests_dev.ok((select value from public.bot_settings where key = 'tutorial_enabled') = 'false',
  'jalankan ulang skema: nilai setting yang sudah diisi tetap');
select tests_dev.ok((select value is null from public.bot_settings where key = 'changelog_lobby_enabled'),
  'setting baru mulai NULL (diisi bot dari nilai lokal)');
select tests_dev.ok((select count(*) from public.bot_setting_categories where key in ('tutorial', 'campaign')) = 2,
  'kategori tutorial & campaign tersedia');
select tests_dev.ok((select public = false from storage.buckets where id = 'bot-backups'),
  'bucket bot-backups privat');

-- ─── Penjaga owner (sys.*) ──────────────────────────────────────────────────
set role authenticated;

select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', false);
insert into public.bot_commands (type, payload, status, created_by)
  values ('sys.bot.restart', '{}', 'pending', 'a0000000-0000-0000-0000-000000000001');
select tests_dev.ok(true, 'owner boleh mengirim sys.bot.restart');
insert into public.bot_commands (type, payload, status, created_by)
  values ('player.view', '{"player":"1"}', 'pending', 'a0000000-0000-0000-0000-000000000001');
select tests_dev.ok(true, 'owner boleh mengirim perintah biasa');

select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', false);
select tests_dev.throws($$insert into public.bot_commands (type, payload, status, created_by)
  values ('sys.db.backup', '{}', 'pending', 'a0000000-0000-0000-0000-000000000002')$$,
  'hanya boleh dikirim owner', 'admin ditolak untuk sys.db.backup');
insert into public.bot_commands (type, payload, status, created_by)
  values ('game.end', '{"gameId":"G-1"}', 'pending', 'a0000000-0000-0000-0000-000000000002');
select tests_dev.ok(true, 'admin tetap boleh mengirim perintah biasa');
select tests_dev.throws($$insert into public.bot_commands (type, payload, status, created_by)
  values ('sys.autoheal.decide', '{}', 'pending', 'a0000000-0000-0000-0000-000000000001')$$,
  '42501', 'admin tidak bisa menyamar sebagai owner lewat created_by');

select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated"}', false);
select tests_dev.throws($$insert into public.bot_commands (type, payload, status, created_by)
  values ('player.view', '{}', 'pending', 'a0000000-0000-0000-0000-000000000003')$$,
  '42501', 'viewer tidak boleh mengirim perintah apa pun');

-- ─── RLS snapshot ───────────────────────────────────────────────────────────
select tests_dev.ok((select count(*) from public.bot_panel_snapshots) = 1, 'viewer bisa membaca snapshot');
select tests_dev.throws($$insert into public.bot_panel_snapshots (key, data) values ('palsu', '{}')$$,
  '42501', 'admin web tidak bisa menulis snapshot');

select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}', false);
select tests_dev.ok((select count(*) from public.bot_panel_snapshots) = 0, 'akun bukan admin tidak melihat snapshot');

-- ─── Bucket backup: hanya owner ─────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', false);
select tests_dev.ok((select count(*) from storage.objects where bucket_id = 'bot-backups') = 0,
  'admin tidak bisa melihat berkas backup');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', false);
select tests_dev.ok((select count(*) from storage.objects where bucket_id = 'bot-backups') = 1,
  'owner bisa melihat berkas backup (untuk signed URL)');

-- ─── Konsol Dev: baris sys.* hanya terbaca owner ────────────────────────────
-- Diterapkan DI SINI (sesudah skema dijalankan ulang di atas) supaya policy
-- yang dipersempit tidak tertimpa oleh "admin baca bot_commands" versi lama.
reset role;
\ir ../developer-terminal.sql
set role authenticated;

select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', false);
select tests_dev.ok((select count(*) from public.bot_commands where type like 'sys.%') = 0,
  'admin TIDAK melihat baris perintah sys.* (keluaran konsol bisa memuat info host)');
select tests_dev.ok((select count(*) from public.bot_commands where type not like 'sys.%') >= 2,
  'admin tetap melihat perintah non-sys (riwayat biasa)');

select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', false);
select tests_dev.ok((select count(*) from public.bot_commands where type like 'sys.%') >= 1,
  'owner tetap melihat baris perintah sys.*');

reset role;

-- ─── Bot (service_role) ─────────────────────────────────────────────────────
set role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', false);
update public.bot_commands
   set status = 'processing', progress = '{"done":20,"total":100}', heartbeat_at = now()
 where type = 'sys.bot.restart';
select tests_dev.ok((select progress ->> 'done' from public.bot_commands where type = 'sys.bot.restart') = '20',
  'bot bisa menulis progress & heartbeat');
insert into public.bot_panel_snapshots (key, data) values ('games', '{"rooms":[]}')
  on conflict (bot_slug, key) do update set data = excluded.data, updated_at = now();
select tests_dev.ok((select count(*) from public.bot_panel_snapshots) = 2, 'bot bisa upsert snapshot');
reset role;

select 'LULUS' as hasil;
