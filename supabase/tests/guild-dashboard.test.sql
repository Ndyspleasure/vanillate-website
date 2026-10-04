-- ════════════════════════════════════════════════════════════════════════════
--  Tes skema Vanillate Dashboard (supabase/guild-dashboard-schema.sql).
--  Dijalankan oleh scripts/test-guild-dashboard-sql.sh di atas Postgres lokal
--  + supabase-stub.sql. Gagal = exception (psql ON_ERROR_STOP).
--
--  Cakupan: otorisasi (anon / tanpa identitas Discord / tanpa akses / akses
--  basi / user lain), validasi simpan, revisi & optimistic concurrency, audit,
--  RLS tabel, alur bot (poll → apply ok/gagal → resync → health), perubahan
--  dari Discord, impor, registry, snapshot & refresh, ACTOR_FORBIDDEN & Retry
--  Sync oleh admin lain, apply sebagian.
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
set client_min_messages = notice;

create schema if not exists tests;
grant usage on schema tests to anon, authenticated, service_role;

create or replace function tests.ok(p_cond boolean, p_name text)
returns void language plpgsql as $$
begin
  if p_cond is distinct from true then
    raise exception 'GAGAL: %', p_name;
  end if;
  raise notice 'ok - %', p_name;
end $$;

-- Jalankan SQL dan pastikan gagal dengan pesan (kode) tertentu.
create or replace function tests.throws(p_sql text, p_code text, p_name text)
returns jsonb language plpgsql as $$
declare
  v_msg text; v_detail text;
begin
  execute p_sql;
  raise exception 'GAGAL: % (tidak ada error, harusnya %)', p_name, p_code;
exception when others then
  get stacked diagnostics v_msg = message_text, v_detail = pg_exception_detail;
  if v_msg like 'GAGAL:%' then raise; end if;
  if position(p_code in v_msg) = 0 then
    raise exception 'GAGAL: % (dapat "%", harusnya %)', p_name, v_msg, p_code;
  end if;
  raise notice 'ok - %', p_name;
  return case when v_detail ~ '^\s*[\{\[]' then v_detail::jsonb else null end;
end $$;

grant execute on all functions in schema tests to anon, authenticated, service_role;

-- ─── Fixture ────────────────────────────────────────────────────────────────
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@contoh.id'),
  ('22222222-2222-2222-2222-222222222222', 'b@contoh.id'),
  ('33333333-3333-3333-3333-333333333333', 'c@contoh.id');

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at) values
  ('100000000000000001', '11111111-1111-1111-1111-111111111111',
   '{"name":"andi","custom_claims":{"global_name":"Andi"}}', 'discord', now()),
  ('100000000000000002', '22222222-2222-2222-2222-222222222222', '{"name":"budi"}', 'discord', now()),
  ('c@contoh.id', '33333333-3333-3333-3333-333333333333', '{}', 'google', now());

insert into public.bot_guilds (guild_id, name, is_active) values
  ('900000000000000001', 'Server Uji', true),
  ('900000000000000003', 'Server Lama', false);

-- Akses (seperti hasil Edge Function): A → guild 1 & 3; B → guild 2; A basi → guild 4.
insert into public.guild_dashboard_access (user_id, guild_id, discord_user_id, guild_name, verified_at) values
  ('11111111-1111-1111-1111-111111111111', '900000000000000001', '100000000000000001', 'Server Uji', now()),
  ('11111111-1111-1111-1111-111111111111', '900000000000000003', '100000000000000001', 'Server Lama', now()),
  ('11111111-1111-1111-1111-111111111111', '900000000000000004', '100000000000000001', 'Server Basi', now() - interval '1 hour'),
  ('22222222-2222-2222-2222-222222222222', '900000000000000002', '100000000000000002', 'Server B', now()),
  ('11111111-1111-1111-1111-111111111111', '900000000000000005', '100000000000000001', 'Server Impor', now());

-- ─── Registry (diterbitkan bot) ─────────────────────────────────────────────
set role service_role;
select tests.ok((public.guild_bot_publish_registry('sambung-kata', $json$[
  {"key":"SAMBUNG_KATA","section":"game","name":"Sambung Kata","sort":10,"default_enabled":true,
   "purposes":[{"key":"game_channel","label":"Channel game","required":false,"channel_types":[0],
     "permissions":[{"bit":"1024","name":"View Channel"},{"bit":"2048","name":"Send Messages"}]}]},
  {"key":"SOCIAL_COUNT","section":"social","name":"Counting","sort":50,"default_enabled":false,
   "purposes":[{"key":"activity_channel","label":"Channel","required":true,"unique_scope":"social","channel_types":[0],
     "permissions":[{"bit":"1024","name":"View Channel"},{"bit":"64","name":"Add Reactions"}]}]},
  {"key":"SOCIAL_STREAK","section":"social","name":"Streak Harian","sort":51,"default_enabled":false,
   "purposes":[{"key":"activity_channel","label":"Channel","required":true,"unique_scope":"social","channel_types":[0],
     "permissions":[{"bit":"1024","name":"View Channel"}]}]},
  {"key":"FITUR_LAMA","section":"other","name":"Fitur Lama","sort":99}
]$json$::jsonb) ->> 'count')::int = 4, 'registry diterbitkan');

-- Terbit ulang tanpa FITUR_LAMA → dinonaktifkan, bukan dihapus.
select public.guild_bot_publish_registry('sambung-kata', (
  select jsonb_agg(jsonb_build_object('key', feature_key, 'section', section, 'name', name, 'sort', sort,
    'default_enabled', default_enabled, 'purposes', purposes))
  from public.guild_feature_registry where feature_key <> 'FITUR_LAMA' and active));
reset role;
select tests.ok((select not active from public.guild_feature_registry where feature_key = 'FITUR_LAMA'),
  'fitur yang tidak diterbitkan lagi dinonaktifkan');

-- ─── Anon ───────────────────────────────────────────────────────────────────
set role anon;
select tests.throws($$select public.guild_dashboard_get('900000000000000001')$$, 'permission denied', 'anon tidak bisa memanggil RPC dashboard');
select tests.throws($$select public.guild_bot_poll('sambung-kata')$$, 'permission denied', 'anon tidak bisa memanggil RPC bot');
select tests.ok((select count(*) from public.guild_feature_registry) = 3, 'anon hanya melihat registry aktif');
select tests.ok((select count(*) from public.guild_dashboard_access) = 0, 'anon tidak melihat tabel akses');
reset role;

-- ─── Authenticated: otorisasi ───────────────────────────────────────────────
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', false);
select tests.throws($$select public.guild_dashboard_get('900000000000000001')$$, 'NO_DISCORD_IDENTITY', 'login Google tanpa Discord ditolak');

select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', false);
select tests.throws($$select public.guild_dashboard_get('900000000000000001')$$, 'ACCESS_DENIED', 'user lain tidak bisa membuka server yang bukan miliknya');
select tests.throws($$select public.guild_bot_poll('sambung-kata')$$, 'permission denied', 'user login tidak bisa memanggil RPC bot');

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', false);
select tests.throws($$select public.guild_dashboard_get('900000000000000004')$$, 'ACCESS_STALE', 'verifikasi akses yang basi ditolak');
select tests.throws($$select public.guild_dashboard_get('abc')$$, 'INVALID_GUILD', 'guild_id tidak valid ditolak');
select tests.throws($$select public.guild_config_save('900000000000000003', 0, '{}', '[]')$$, 'BOT_NOT_INSTALLED', 'simpan ditolak bila bot tidak ada di server');

-- RLS: tabel inti tidak bisa dibaca/ditulis langsung.
select tests.ok((select count(*) from public.guild_dashboard_access) = 0, 'tabel akses tidak terbaca langsung');
select tests.ok((select count(*) from public.guild_dashboard_tokens) = 0, 'tabel token tidak terbaca langsung');
select tests.throws($$insert into public.guild_config_audit (guild_id, actor_id, source, revision, action) values ('900000000000000001','x','web',1,'palsu')$$,
  'row-level security', 'audit tidak bisa ditulis langsung');
select tests.throws($$insert into public.guild_dashboard_access (user_id, guild_id, discord_user_id) values ('11111111-1111-1111-1111-111111111111','900000000000000002','100000000000000001')$$,
  'row-level security', 'user tidak bisa memberi dirinya akses');

-- Get awal: default registry, tanpa config.
select tests.ok((
  select (d -> 'config') = 'null'::jsonb
     and (d -> 'state' -> 'SAMBUNG_KATA' ->> 'enabled')::boolean
     and not (d -> 'state' -> 'SOCIAL_COUNT' ->> 'enabled')::boolean
     and jsonb_array_length(d -> 'registry') = 3
     and (d -> 'viewer' ->> 'name') = 'Andi'
     and (d -> 'bot' ->> 'installed')::boolean
     and not (d -> 'bot' ->> 'online')::boolean
  from (select public.guild_dashboard_get('900000000000000001') d) x
), 'get awal: default registry, belum ada config, bot offline');

-- Bot versi baru belum pernah jalan (belum impor /pengaturan lama) → simpan ditolak.
select tests.throws($$select public.guild_config_save('900000000000000001', 0,
  '{"SAMBUNG_KATA":{"enabled":true}}', '[]')$$,
  'BOT_NOT_READY', 'simpan ditolak sebelum bot (dengan impor) pernah aktif');
reset role;

-- ─── Refresh Discord Data → bot menerbitkan snapshot ────────────────────────
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', false);
select tests.ok((public.guild_dashboard_request_refresh('900000000000000001') ->> 'ok')::boolean, 'refresh diminta');
reset role;

set role service_role;
select tests.ok((
  select (p -> 'refresh') @> '["900000000000000001"]'::jsonb
  from (select public.guild_bot_poll('sambung-kata', '9.9.9') p) x
), 'poll bot melihat permintaan refresh');
select public.guild_bot_publish_snapshot('sambung-kata', $json$[{
  "guild_id":"900000000000000001","guild_name":"Server Uji","member_count":42,"bot_present":true,
  "channels":[
    {"id":"800000000000000001","name":"sambung-kata","type":0,"perms":"3072"},
    {"id":"800000000000000002","name":"umum","type":0,"perms":"1024"},
    {"id":"800000000000000003","name":"Suara","type":2,"perms":"3072"},
    {"id":"800000000000000004","name":"sosial","type":0,"perms":"1088"}
  ]}]$json$::jsonb);
select tests.ok((
  select jsonb_array_length(p -> 'refresh') = 0
  from (select public.guild_bot_poll('sambung-kata', '9.9.9') p) x
), 'refresh selesai setelah snapshot terbit');
reset role;
select tests.ok((select bot_version = '9.9.9' from public.guild_dashboard_bot_state where bot_slug = 'sambung-kata'), 'heartbeat bot tercatat');

-- ─── Simpan ─────────────────────────────────────────────────────────────────
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', false);

select tests.ok((select (public.guild_dashboard_get('900000000000000001') -> 'bot' ->> 'online')::boolean), 'bot online setelah heartbeat');

select tests.throws($$select public.guild_config_save('900000000000000001', 0, '{}',
  '[{"featureKey":"SAMBUNG_KATA","purpose":"game_channel","channelId":"800000000000000099"}]')$$,
  'VALIDATION_FAILED', 'channel yang tidak ada di server ditolak');
select tests.ok((
  select x::jsonb -> 'issues' @> '[{"code":"CHANNEL_TYPE_INVALID"}]'
  from tests.throws($$select public.guild_config_save('900000000000000001', 0, '{}',
    '[{"featureKey":"SAMBUNG_KATA","purpose":"game_channel","channelId":"800000000000000003"}]')$$,
    'VALIDATION_FAILED', 'channel voice untuk game ditolak') x
), 'detail error memuat CHANNEL_TYPE_INVALID');
select tests.ok((
  select x::jsonb -> 'issues' @> '[{"code":"CHANNEL_REQUIRED","feature":"SOCIAL_COUNT"}]'
  from tests.throws($$select public.guild_config_save('900000000000000001', 0,
    '{"SOCIAL_COUNT":{"enabled":true}}', '[]')$$, 'VALIDATION_FAILED', 'fitur sosial aktif tanpa channel ditolak') x
), 'detail error memuat CHANNEL_REQUIRED');
select tests.ok((
  select x::jsonb -> 'issues' @> '[{"code":"CHANNEL_CONFLICT"}]'
  from tests.throws($$select public.guild_config_save('900000000000000001', 0,
    '{"SOCIAL_COUNT":{"enabled":true},"SOCIAL_STREAK":{"enabled":true}}',
    '[{"featureKey":"SOCIAL_COUNT","purpose":"activity_channel","channelId":"800000000000000004"},
      {"featureKey":"SOCIAL_STREAK","purpose":"activity_channel","channelId":"800000000000000004"}]')$$,
    'VALIDATION_FAILED', 'dua fitur sosial di satu channel ditolak') x
), 'detail error memuat CHANNEL_CONFLICT');
select tests.throws($$select public.guild_config_save('900000000000000001', 0,
  '{"TIDAK_ADA":{"enabled":true}}', '[]')$$, 'VALIDATION_FAILED', 'fitur tak dikenal ditolak');
select tests.throws($$select public.guild_config_save('900000000000000001', 0,
  '{"SAMBUNG_KATA":{"enabled":"ya"}}', '[]')$$, 'VALIDATION_FAILED', 'enabled bukan boolean ditolak');
select tests.throws($$select public.guild_config_save('900000000000000001', 0, '{}',
  '[{"featureKey":"SAMBUNG_KATA","purpose":"tujuan_palsu","channelId":"800000000000000001"}]')$$,
  'VALIDATION_FAILED', 'purpose tak dikenal ditolak');

-- Simpan sah: revisi 0 → 1.
select tests.ok((
  select (r ->> 'revision')::int = 1 and (r ->> 'changed')::boolean and r ->> 'sync_status' = 'SYNCING'
     and r -> 'warnings' @> '[{"code":"MISSING_PERMISSIONS","feature":"SOCIAL_COUNT","missing":["Add Reactions"]}]'
  from (select public.guild_config_save('900000000000000001', 0,
    '{"SAMBUNG_KATA":{"enabled":true},"SOCIAL_COUNT":{"enabled":true},"SOCIAL_STREAK":{"enabled":false}}',
    '[{"featureKey":"SAMBUNG_KATA","purpose":"game_channel","channelId":"800000000000000001"},
      {"featureKey":"SOCIAL_COUNT","purpose":"activity_channel","channelId":"800000000000000002"}]') r) x
), 'simpan sah menaikkan revisi ke 1, status SYNCING, peringatan izin');

select tests.throws($$select public.guild_config_save('900000000000000001', 0, '{"SAMBUNG_KATA":{"enabled":false}}',
  '[{"featureKey":"SAMBUNG_KATA","purpose":"game_channel","channelId":"800000000000000001"}]')$$,
  'STALE_REVISION', 'revisi basi ditolak (optimistic concurrency)');

select tests.ok((
  select not (r ->> 'changed')::boolean and (r ->> 'revision')::int = 1
  from (select public.guild_config_save('900000000000000001', 1,
    '{"SAMBUNG_KATA":{"enabled":true},"SOCIAL_COUNT":{"enabled":true},"SOCIAL_STREAK":{"enabled":false}}',
    '[{"featureKey":"SAMBUNG_KATA","purpose":"game_channel","channelId":"800000000000000001"},
      {"featureKey":"SOCIAL_COUNT","purpose":"activity_channel","channelId":"800000000000000002"}]') r) x
), 'simpan tanpa perubahan tidak menaikkan revisi');

select tests.ok((
  select jsonb_array_length(a) = 1 and a -> 0 ->> 'action' = 'config.save' and (a -> 0 ->> 'revision')::int = 1
     and a -> 0 ->> 'actor_id' = '100000000000000001'
     and a -> 0 -> 'changed_fields' @> '[{"path":"SOCIAL_COUNT.enabled","from":false,"to":true}]'
     and a -> 0 -> 'changed_fields' @> '[{"path":"SAMBUNG_KATA.channels.game_channel","to":"800000000000000001"}]'
  from (select public.guild_config_audit_list('900000000000000001') a) x
), 'audit mencatat aktor, revisi, dan field yang berubah');

select tests.ok((
  select d -> 'config' ->> 'sync_status' = 'SYNCING'
     and (d -> 'config' ->> 'revision')::int = 1 and (d -> 'config' ->> 'applied_revision')::int = 0
     and d -> 'state' -> 'SAMBUNG_KATA' -> 'channels' ->> 'game_channel' = '800000000000000001'
  from (select public.guild_dashboard_get('900000000000000001') d) x
), 'get mencerminkan revisi tersimpan vs diterapkan');
reset role;

-- ─── Bot: poll → apply ──────────────────────────────────────────────────────
set role service_role;
select tests.ok((
  select jsonb_array_length(p -> 'pending') = 1
     and p -> 'pending' -> 0 ->> 'guild_id' = '900000000000000001'
     and (p -> 'pending' -> 0 ->> 'revision')::int = 1
     and p -> 'pending' -> 0 -> 'features' -> 'SOCIAL_COUNT' ->> 'enabled' = 'true'
     and p -> 'pending' -> 0 -> 'channels' @> '[{"feature_key":"SAMBUNG_KATA","purpose":"game_channel","channel_id":"800000000000000001"}]'
     and p -> 'pending' -> 0 ->> 'updated_by' = '100000000000000001'
  from (select public.guild_bot_poll('sambung-kata', '9.9.9') p) x
), 'poll bot menerima revisi baru lengkap dengan konfigurasinya');

-- Gagal: NEEDS_ATTENTION, tidak diulang tiap poll.
select tests.ok((
  select r ->> 'sync_status' = 'NEEDS_ATTENTION'
  from (select public.guild_bot_report('sambung-kata', '900000000000000001', 1, false,
    '[{"code":"MISSING_PERMISSIONS","feature":"SOCIAL_COUNT","missing":["View Channel"]}]') r) x
), 'apply gagal → NEEDS_ATTENTION');
select public.guild_bot_report('sambung-kata', '900000000000000001', 1, false,
  '[{"code":"MISSING_PERMISSIONS","feature":"SOCIAL_COUNT","missing":["View Channel"]}]');
select tests.ok((select jsonb_array_length(public.guild_bot_poll('sambung-kata') -> 'pending') = 0),
  'revisi yang gagal tidak diulang tiap poll');
reset role;
select tests.ok((select count(*) = 1 from public.guild_config_audit where action = 'sync.failed'),
  'kegagalan identik tidak dicatat berulang');

-- Retry Sync dari website → muncul lagi di poll.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', false);
select tests.ok((public.guild_config_request_resync('900000000000000001') ->> 'ok')::boolean, 'retry sync diminta');
reset role;
set role service_role;
select tests.ok((
  select jsonb_array_length(p -> 'pending') = 1 and (p -> 'pending' -> 0 ->> 'resync')::boolean
  from (select public.guild_bot_poll('sambung-kata') p) x
), 'retry sync membuat revisi diambil ulang');

select tests.ok((
  select r ->> 'sync_status' = 'ACTIVE' and (r ->> 'applied_revision')::int = 1
  from (select public.guild_bot_report('sambung-kata', '900000000000000001', 1, true, '[]') r) x
), 'apply sukses → ACTIVE, applied_revision = 1');
select tests.ok((select jsonb_array_length(public.guild_bot_poll('sambung-kata') -> 'pending') = 0),
  'tidak ada pekerjaan setelah diterapkan');

-- Kesehatan: channel dihapus setelah diterapkan.
select tests.ok((
  select r ->> 'sync_status' = 'NEEDS_ATTENTION'
  from (select public.guild_bot_report('sambung-kata', '900000000000000001', 1, true,
    '[{"code":"CHANNEL_NOT_FOUND","feature":"SAMBUNG_KATA","purpose":"game_channel"}]', 'health') r) x
), 'laporan kesehatan bermasalah → NEEDS_ATTENTION');
select tests.ok((
  select r ->> 'sync_status' = 'ACTIVE'
  from (select public.guild_bot_report('sambung-kata', '900000000000000001', 1, true, '[]', 'health') r) x
), 'laporan kesehatan bersih → ACTIVE');
select tests.ok((
  select r ->> 'sync_status' = 'ACTIVE'
  from (select public.guild_bot_report('sambung-kata', '900000000000000001', 0, true,
    '[{"code":"CHANNEL_NOT_FOUND"}]', 'health') r) x
), 'laporan kesehatan untuk revisi lama diabaikan');
select tests.ok((
  select r ->> 'sync_status' = 'NEEDS_ATTENTION'
  from (select public.guild_bot_report('sambung-kata', '900000000000000001', 1, false,
    '[{"code":"MISSING_PERMISSIONS","feature":"SAMBUNG_KATA"}]') r) x
), 'Retry Sync gagal pada revisi yang sudah berlaku → NEEDS_ATTENTION');
select tests.ok((
  select r ->> 'sync_status' = 'ACTIVE' and (r ->> 'applied_revision')::int = 1
  from (select public.guild_bot_report('sambung-kata', '900000000000000001', 1, true, '[]') r) x
), 'Retry Sync berhasil → kembali ACTIVE');

-- ─── Perubahan dari Discord (/pengaturan) ───────────────────────────────────
select tests.ok((
  select (r ->> 'revision')::int = 2 and (r ->> 'applied')::boolean
  from (select public.guild_bot_record_local_change('sambung-kata', '900000000000000001',
    '100000000000000002', 'budi', '[{"feature_key":"SAMBUNG_KATA","channels":{"game_channel":null}}]') r) x
), 'perubahan Discord saat sinkron → revisi 2 langsung berlaku');
select tests.ok((
  select not (r ->> 'changed')::boolean
  from (select public.guild_bot_record_local_change('sambung-kata', '900000000000000001',
    '100000000000000002', 'budi', '[{"feature_key":"SAMBUNG_KATA","channels":{"game_channel":null}}]') r) x
), 'perubahan Discord yang sama tidak menaikkan revisi');
reset role;
select tests.ok((
  select current_revision = 2 and applied_revision = 2 and sync_status = 'ACTIVE' and updated_source = 'discord'
  from public.guild_config where guild_id = '900000000000000001'
), 'state setelah perubahan Discord: rev 2, ACTIVE, sumber discord');

-- Website menyimpan rev 3 (belum diterapkan), lalu ada perubahan Discord → rev 4 belum berlaku.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', false);
select public.guild_config_save('900000000000000001', 2, '{"SOCIAL_STREAK":{"enabled":true}}',
  '[{"featureKey":"SOCIAL_STREAK","purpose":"activity_channel","channelId":"800000000000000004"}]');
reset role;
set role service_role;
select tests.ok((
  select (r ->> 'revision')::int = 4 and not (r ->> 'applied')::boolean
  from (select public.guild_bot_record_local_change('sambung-kata', '900000000000000001',
    '100000000000000002', 'budi', '[{"feature_key":"SAMBUNG_KATA","enabled":false}]') r) x
), 'perubahan Discord saat ada revisi web tertunda → tidak menandai berlaku');
select tests.ok((
  select (p -> 'pending' -> 0 ->> 'revision')::int = 4
     and p -> 'pending' -> 0 -> 'features' -> 'SOCIAL_STREAK' ->> 'enabled' = 'true'
     and p -> 'pending' -> 0 -> 'features' -> 'SAMBUNG_KATA' ->> 'enabled' = 'false'
  from (select public.guild_bot_poll('sambung-kata') p) x
), 'revisi gabungan (web + Discord) dikirim ke bot');
reset role;

-- ─── Impor konfigurasi lama ─────────────────────────────────────────────────
insert into public.bot_guilds (guild_id, name) values ('900000000000000005', 'Server Impor');
set role service_role;
select tests.ok((
  select (r ->> 'imported')::int = 1 and (r ->> 'skipped')::int = 2
  from (select public.guild_bot_import('sambung-kata', $json$[
    {"guild_id":"900000000000000005","features":{"SOCIAL_COUNT":{"enabled":true}},
     "channels":[{"feature_key":"SOCIAL_COUNT","purpose":"activity_channel","channel_id":"800000000000000009"}]},
    {"guild_id":"900000000000000001","features":{"SAMBUNG_KATA":{"enabled":true}}},
    {"guild_id":"900000000000000006","features":{}}
  ]$json$::jsonb) r) x
), 'impor hanya membuat config untuk server baru yang punya pengaturan');
reset role;
select tests.ok((
  select current_revision = 1 and applied_revision = 1 and sync_status = 'ACTIVE' and updated_source = 'import'
  from public.guild_config where guild_id = '900000000000000005'
), 'server impor langsung ACTIVE di revisi 1');
select tests.ok((
  select count(*) = 0 from public.guild_config where guild_id = '900000000000000006'
), 'server tanpa pengaturan tidak diimpor');

-- ─── Channel lama yang kini hilang tidak memblokir simpan ───────────────────
set role service_role;
select public.guild_bot_publish_snapshot('sambung-kata', $json$[{
  "guild_id":"900000000000000001","guild_name":"Server Uji","channels":[
    {"id":"800000000000000001","name":"sambung-kata","type":0,"perms":"3072"},
    {"id":"800000000000000004","name":"sosial","type":0,"perms":"1088"}]}]$json$::jsonb);
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', false);
select tests.ok((
  select (r ->> 'revision')::int = 5
  from (select public.guild_config_save('900000000000000001', 4,
    '{"SAMBUNG_KATA":{"enabled":true},"SOCIAL_COUNT":{"enabled":true},"SOCIAL_STREAK":{"enabled":true}}',
    '[{"featureKey":"SOCIAL_COUNT","purpose":"activity_channel","channelId":"800000000000000002"},
      {"featureKey":"SOCIAL_STREAK","purpose":"activity_channel","channelId":"800000000000000004"}]') r) x
), 'channel tersimpan yang kini hilang tidak memblokir perubahan lain');
select tests.throws($$select public.guild_dashboard_request_refresh('900000000000000002')$$, 'ACCESS_DENIED',
  'refresh server tanpa akses ditolak');
select tests.ok((
  select x::jsonb -> 'issues' @> '[{"code":"NO_DISCORD_DATA"}]'
  from tests.throws($$select public.guild_config_save('900000000000000005', 1, '{}',
    '[{"featureKey":"SAMBUNG_KATA","purpose":"game_channel","channelId":"800000000000000001"}]')$$,
    'VALIDATION_FAILED', 'channel baru tanpa data Discord ditolak') x
), 'detail error memuat NO_DISCORD_DATA');
reset role;

-- ─── Konfigurasi untuk pemeriksaan kesehatan bot ────────────────────────────
set role service_role;
select tests.ok((
  select jsonb_array_length(c) = 2
     and c -> 0 ->> 'guild_id' = '900000000000000001'
     and c -> 0 -> 'features' -> 'SOCIAL_STREAK' ->> 'enabled' = 'true'
  from (select public.guild_bot_get_configs('sambung-kata') c) x
), 'bot bisa membaca semua konfigurasi untuk sapuan kesehatan');
select tests.ok((
  select jsonb_array_length(public.guild_bot_get_configs('sambung-kata', array['900000000000000005'])) = 1
), 'bot bisa membaca konfigurasi satu server');
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', false);
select tests.throws($$select public.guild_bot_get_configs('sambung-kata')$$, 'permission denied', 'user tidak bisa membaca konfigurasi semua server');
reset role;

-- ─── Revisi web dari admin yang kehilangan izin (ACTOR_FORBIDDEN) ──────────
-- Server tim: A & B sama-sama admin. B menyimpan, lalu kehilangan Manage Server.
insert into public.bot_guilds (guild_id, name, is_active) values ('900000000000000007', 'Server Tim', true);
insert into public.guild_dashboard_access (user_id, guild_id, discord_user_id, guild_name, verified_at) values
  ('11111111-1111-1111-1111-111111111111', '900000000000000007', '100000000000000001', 'Server Tim', now()),
  ('22222222-2222-2222-2222-222222222222', '900000000000000007', '100000000000000002', 'Server Tim', now());

create or replace function tests.pending_item(p_guild text)
returns jsonb language sql as $$
  select e from jsonb_array_elements(public.guild_bot_poll('sambung-kata') -> 'pending') e
  where e ->> 'guild_id' = p_guild limit 1
$$;

set role service_role;
select public.guild_bot_publish_snapshot('sambung-kata', $json$[{
  "guild_id":"900000000000000007","guild_name":"Server Tim","channels":[
    {"id":"800000000000000071","name":"sambung-kata","type":0,"perms":"3072"}]}]$json$::jsonb);
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', false);
select public.guild_config_save('900000000000000007', 0, '{"SAMBUNG_KATA":{"enabled":false}}', '[]');
reset role;
set role service_role;
select public.guild_bot_report('sambung-kata', '900000000000000007', 1, false, '[{"code":"ACTOR_FORBIDDEN"}]');
select tests.ok((
  select (r ->> 'revision')::int = 2 and not (r ->> 'applied')::boolean
  from (select public.guild_bot_record_local_change('sambung-kata', '900000000000000007',
    '100000000000000009', 'admin-discord',
    '[{"feature_key":"SAMBUNG_KATA","channels":{"game_channel":"800000000000000071"}}]') r) x
), 'perubahan Discord di atas revisi web yang ditolak tidak menandai berlaku');
select tests.ok((
  select i ->> 'updated_source' = 'web' and i ->> 'updated_by' = '100000000000000002'
     and (i ->> 'revision')::int = 2 and i -> 'features' -> 'SAMBUNG_KATA' ->> 'enabled' = 'false'
  from (select tests.pending_item('900000000000000007') i) x
), 'revisi gabungan tetap atas nama penyimpan web → bot memeriksa izinnya lagi');
reset role;
select tests.ok((
  select a.actor_id = '100000000000000009' and a.source = 'discord'
  from public.guild_config_audit a
  where a.guild_id = '900000000000000007' and a.action = 'config.discord'
), 'admin Discord tetap tercatat di audit');

-- Admin lain (A) menekan Retry Sync → revisi tertunda kini atas nama A.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', false);
select tests.ok((public.guild_config_request_resync('900000000000000007') ->> 'ok')::boolean, 'admin lain meminta Retry Sync');
reset role;
select tests.ok((
  select updated_by = '100000000000000001' and updated_by_name = 'Andi' and updated_source = 'web'
  from public.guild_config where guild_id = '900000000000000007'
), 'Retry Sync oleh admin lain mengambil alih revisi web tertunda');
select tests.ok((
  select a.actor_id = '100000000000000001' and a.revision = 2
     and a.changed_fields -> 0 ->> 'previous_actor_id' = '100000000000000002'
  from public.guild_config_audit a
  where a.guild_id = '900000000000000007' and a.action = 'sync.reauthorized'
), 'pengambilalihan revisi tercatat di audit');
set role service_role;
select tests.ok((
  select (i ->> 'resync')::boolean and i ->> 'updated_by' = '100000000000000001'
  from (select tests.pending_item('900000000000000007') i) x
), 'bot menerima revisi atas nama admin yang meminta Retry Sync');
select public.guild_bot_report('sambung-kata', '900000000000000007', 2, true, '[]');
reset role;

-- Retry Sync yang sudah dilayani bot boleh diulang segera (bukan dibuang diam-diam).
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', false);
select public.guild_config_request_resync('900000000000000007');
reset role;
select tests.ok((
  select updated_by = '100000000000000001' from public.guild_config where guild_id = '900000000000000007'
), 'Retry Sync revisi yang sudah berlaku tidak mengubah penyimpan');
set role service_role;
select tests.ok((
  select (i ->> 'resync')::boolean from (select tests.pending_item('900000000000000007') i) x
), 'Retry Sync segera setelah dilayani bot tetap diteruskan');
select public.guild_bot_report('sambung-kata', '900000000000000007', 2, true, '[]');
reset role;

-- Apply sebagian: diterapkan (ok) + masalah fitur → applied naik, tampil sebagai kesehatan.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', false);
select public.guild_config_save('900000000000000007', 2, '{"SAMBUNG_KATA":{"enabled":true}}', '[]');
reset role;
set role service_role;
select tests.ok((
  select r ->> 'sync_status' = 'NEEDS_ATTENTION' and (r ->> 'applied_revision')::int = 3
  from (select public.guild_bot_report('sambung-kata', '900000000000000007', 3, true,
    '[{"code":"MISSING_PERMISSIONS","feature":"SAMBUNG_KATA","missing":["Send Messages"]}]') r) x
), 'diterapkan dengan masalah fitur → applied naik, NEEDS_ATTENTION lewat kesehatan');
reset role;
select tests.ok((
  select last_error is null and health @> '[{"code":"MISSING_PERMISSIONS"}]'
  from public.guild_config where guild_id = '900000000000000007'
), 'masalah fitur disimpan sebagai kesehatan, bukan kegagalan apply');

-- Refresh Discord Data yang sudah dilayani boleh diulang segera.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', false);
select public.guild_dashboard_request_refresh('900000000000000007');
reset role;
set role service_role;
select public.guild_bot_publish_snapshot('sambung-kata', $json$[{
  "guild_id":"900000000000000007","guild_name":"Server Tim","channels":[]}]$json$::jsonb);
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', false);
select public.guild_dashboard_request_refresh('900000000000000007');
reset role;
set role service_role;
select tests.ok((
  select public.guild_bot_poll('sambung-kata') -> 'refresh' ? '900000000000000007'
), 'Refresh Discord Data segera setelah dilayani tetap diteruskan');
reset role;

-- ─── Impor tetap jalan untuk baris kosong revisi 0 ──────────────────────────
insert into public.bot_guilds (guild_id, name, is_active) values ('900000000000000008', 'Server Kosong', true);
insert into public.guild_dashboard_access (user_id, guild_id, discord_user_id, guild_name, verified_at) values
  ('11111111-1111-1111-1111-111111111111', '900000000000000008', '100000000000000001', 'Server Kosong', now());
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', false);
select tests.ok((
  select not (r ->> 'changed')::boolean
  from (select public.guild_config_save('900000000000000008', 0, '{}', '[]') r) x
), 'simpan tanpa perubahan');
reset role;
select tests.ok((
  select current_revision = 0 from public.guild_config where guild_id = '900000000000000008'
), 'simpan tanpa perubahan meninggalkan baris kosong revisi 0');
set role service_role;
select tests.ok((
  select (r ->> 'imported')::int = 1
  from (select public.guild_bot_import('sambung-kata',
    '[{"guild_id":"900000000000000008","features":{"SAMBUNG_KATA":{"enabled":false}}}]'::jsonb) r) x
), 'baris kosong revisi 0 tidak menghalangi impor pengaturan lama');
select tests.ok((
  select (r ->> 'imported')::int = 0 and (r ->> 'skipped')::int = 1
  from (select public.guild_bot_import('sambung-kata',
    '[{"guild_id":"900000000000000008","features":{"SAMBUNG_KATA":{"enabled":true}}}]'::jsonb) r) x
), 'impor tidak pernah menimpa konfigurasi yang sudah ada');
reset role;
select tests.ok((
  select current_revision = 1 and applied_revision = 1 and updated_source = 'import' and sync_status = 'ACTIVE'
  from public.guild_config where guild_id = '900000000000000008'
), 'server dari baris kosong diimpor di revisi 1, ACTIVE');
select tests.ok((
  select enabled = false from public.guild_feature_config
  where guild_id = '900000000000000008' and feature_key = 'SAMBUNG_KATA'
), 'nilai impor tersimpan');

select 'SEMUA TES LULUS' as hasil;
