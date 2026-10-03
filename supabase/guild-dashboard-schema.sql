-- ════════════════════════════════════════════════════════════════════════════
--  Vanillate Dashboard — Konfigurasi Server Discord (guild) — Skema Supabase
--
--  Acuan: docs/DASHBOARD-SERVER.md (arsitektur, alur, kontrak bot).
--
--  Dipakai bersama oleh:
--    • Website /dashboard   — login Discord (Supabase Auth). TIDAK PERNAH
--      menyentuh tabel langsung: semua baca/tulis lewat fungsi RPC di bawah,
--      yang memeriksa akses guild di sisi server.
--    • Edge Function `dashboard-discord` — memverifikasi guild yang boleh
--      dikelola user lewat Discord API, lalu mengisi guild_dashboard_access.
--    • Bot sambung-kata-bot — service_role: menerbitkan registry fitur &
--      snapshot channel, menarik revisi, menerapkan, dan melapor balik.
--
--  Prinsip:
--    • Database = sumber kebenaran konfigurasi (desired state, ber-revisi).
--    • Bot = executor: memvalidasi ulang di Discord lalu menerapkan.
--    • guild_id / channel_id dari browser tidak pernah dipercaya mentah.
--
--  Aman diulang (idempoten): IF NOT EXISTS / CREATE OR REPLACE.
-- ════════════════════════════════════════════════════════════════════════════


-- ─── 1. Registry fitur (diterbitkan bot) ─────────────────────────────────────
-- Satu baris = satu fitur yang bisa diatur per server. Dashboard dirender dari
-- tabel ini (data-driven), jadi game/fitur baru di bot otomatis muncul tanpa
-- mengubah website. Bot menimpanya saat start (guild_bot_publish_registry).
--
-- purposes: array tujuan channel fitur, mis.
--   [{ "key": "game_channel", "label": "Channel game", "required": false,
--      "channel_types": [0], "unique_scope": null,
--      "empty_label": "Bebas — semua channel",
--      "permissions": [{ "bit": "1024", "name": "View Channel" }, …] }]
--   required     = wajib diisi selama fitur aktif
--   unique_scope = channel tidak boleh dipakai dua fitur aktif dengan scope sama
create table if not exists public.guild_feature_registry (
  bot_slug        text not null default 'sambung-kata',
  feature_key     text not null check (feature_key ~ '^[A-Z][A-Z0-9_]{1,47}$'),
  section         text not null default 'game' check (section in ('game', 'social', 'other')),
  name            text not null,
  emoji           text,
  description     text,
  sort            integer not null default 100,
  default_enabled boolean not null default false,
  purposes        jsonb not null default '[]'::jsonb check (jsonb_typeof(purposes) = 'array'),
  settings_schema jsonb not null default '{}'::jsonb check (jsonb_typeof(settings_schema) = 'object'),
  meta            jsonb not null default '{}'::jsonb,
  active          boolean not null default true,
  updated_at      timestamptz not null default now(),
  primary key (bot_slug, feature_key)
);

comment on table public.guild_feature_registry is
  'Registry fitur yang bisa diatur per server di /dashboard. Diterbitkan bot (service_role) saat start; dibaca website. Jangan diedit manual — SSoT-nya kode bot (src/dashboard/registry.js).';


-- ─── 2. Konfigurasi per server ───────────────────────────────────────────────
-- current_revision naik tiap perubahan tersimpan; applied_revision = revisi
-- terakhir yang SUDAH diterapkan bot. sync_status diturunkan trigger dari
-- keduanya (+ hasil percobaan terakhir & laporan kesehatan bot).
create table if not exists public.guild_config (
  id                  bigint generated always as identity primary key,
  bot_slug            text not null default 'sambung-kata',
  guild_id            text not null check (guild_id ~ '^[0-9]{15,22}$'),
  timezone            text not null default 'Asia/Jakarta',
  locale              text not null default 'id-ID',
  current_revision    bigint not null default 0 check (current_revision >= 0),
  applied_revision    bigint not null default 0 check (applied_revision >= 0),
  sync_status         text not null default 'SYNCING'
                      check (sync_status in ('SYNCING', 'ACTIVE', 'NEEDS_ATTENTION')),
  attempted_revision  bigint,
  attempted_at        timestamptz,
  applied_at          timestamptz,
  last_error          jsonb,                          -- issues percobaan apply yang gagal
  health              jsonb not null default '[]'::jsonb, -- issues pemeriksaan bot setelah apply
  health_checked_at   timestamptz,
  resync_requested_at timestamptz,
  updated_by          text,                           -- Discord user ID (atau 'bot')
  updated_by_name     text,
  updated_source      text not null default 'web' check (updated_source in ('web', 'discord', 'import')),
  updated_at          timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  unique (bot_slug, guild_id)
);

create index if not exists guild_config_pending_idx
  on public.guild_config (bot_slug, updated_at)
  where current_revision > applied_revision or resync_requested_at is not null;

comment on table public.guild_config is
  'Status konfigurasi tiap server: revisi tersimpan vs revisi yang sudah diterapkan bot. Ditulis lewat RPC guild_config_* / guild_bot_*.';

create table if not exists public.guild_feature_config (
  id          bigint generated always as identity primary key,
  bot_slug    text not null default 'sambung-kata',
  guild_id    text not null,
  feature_key text not null,
  enabled     boolean not null default false,
  settings    jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  updated_at  timestamptz not null default now(),
  unique (bot_slug, guild_id, feature_key)
);

create table if not exists public.guild_channel_config (
  id          bigint generated always as identity primary key,
  bot_slug    text not null default 'sambung-kata',
  guild_id    text not null,
  feature_key text not null,
  purpose     text not null,
  channel_id  text not null check (channel_id ~ '^[0-9]{15,22}$'),
  updated_at  timestamptz not null default now(),
  unique (bot_slug, guild_id, feature_key, purpose)
);

-- Riwayat perubahan & sinkronisasi. Append-only: tidak ada policy UPDATE/DELETE
-- untuk siapa pun selain service_role; baris hanya ditulis fungsi RPC.
create table if not exists public.guild_config_audit (
  id             bigint generated always as identity primary key,
  bot_slug       text not null default 'sambung-kata',
  guild_id       text not null,
  actor_id       text not null,                  -- Discord user ID, atau 'bot'
  actor_name     text,
  source         text not null check (source in ('web', 'discord', 'import', 'bot')),
  revision       bigint not null,
  action         text not null,
  changed_fields jsonb not null default '[]'::jsonb,
  created_at     timestamptz not null default now()
);

create index if not exists guild_config_audit_guild_idx
  on public.guild_config_audit (bot_slug, guild_id, id desc);


-- ─── 3. Akses user ke server (diisi Edge Function dashboard-discord) ─────────
-- Hasil verifikasi server-side: guild mana yang boleh dikelola user (owner /
-- Administrator / Manage Server), diambil dari Discord API memakai token OAuth
-- user. Berumur pendek — RPC menolak verifikasi yang lebih tua dari 15 menit,
-- dan website memverifikasi ulang otomatis.
create table if not exists public.guild_dashboard_access (
  user_id         uuid not null references auth.users (id) on delete cascade,
  guild_id        text not null,
  discord_user_id text not null,
  guild_name      text,
  guild_icon      text,
  is_owner        boolean not null default false,
  permissions     text,
  verified_at     timestamptz not null default now(),
  primary key (user_id, guild_id)
);

-- Token OAuth Discord user (scope identify + guilds). HANYA dibaca Edge
-- Function (service_role); tidak ada policy apa pun untuk browser.
create table if not exists public.guild_dashboard_tokens (
  user_id             uuid primary key references auth.users (id) on delete cascade,
  discord_user_id     text not null,
  discord_username    text,
  access_token        text not null,
  refresh_token       text,
  expires_at          timestamptz,
  last_guilds_sync_at timestamptz,
  updated_at          timestamptz not null default now()
);


-- ─── 4. Data Discord dari bot (snapshot channel) ─────────────────────────────
-- Daftar channel nyata sebuah server + izin bot per channel, diterbitkan bot
-- (sumbernya cache gateway Discord). requested_at diisi website lewat tombol
-- "Refresh Discord Data"; bot menerbitkan ulang lalu mengisi refreshed_at.
-- channels: [{ id, name, type, parent_id, position, perms }]
--   perms = bitfield izin bot di channel itu (string desimal).
create table if not exists public.guild_discord_snapshot (
  bot_slug        text not null default 'sambung-kata',
  guild_id        text not null,
  guild_name      text,
  icon_hash       text,
  owner_id        text,
  member_count    integer,
  bot_present     boolean not null default true,
  bot_permissions text,
  channels        jsonb not null default '[]'::jsonb check (jsonb_typeof(channels) = 'array'),
  requested_at    timestamptz,
  requested_by    uuid,
  refreshed_at    timestamptz,
  primary key (bot_slug, guild_id)
);

-- Heartbeat sinkronisasi bot (ditulis tiap poll, dibatasi ±15 dtk).
create table if not exists public.guild_dashboard_bot_state (
  bot_slug          text primary key,
  last_heartbeat_at timestamptz not null default now(),
  bot_version       text,
  started_at        timestamptz not null default now()
);


-- ─── 5. RLS ──────────────────────────────────────────────────────────────────
-- Semua tabel terkunci. Satu-satunya policy: registry boleh dibaca (isinya
-- hanya nama & deskripsi fitur). Sisanya lewat RPC security definer.
alter table public.guild_feature_registry     enable row level security;
alter table public.guild_config               enable row level security;
alter table public.guild_feature_config       enable row level security;
alter table public.guild_channel_config       enable row level security;
alter table public.guild_config_audit         enable row level security;
alter table public.guild_dashboard_access     enable row level security;
alter table public.guild_dashboard_tokens     enable row level security;
alter table public.guild_discord_snapshot     enable row level security;
alter table public.guild_dashboard_bot_state  enable row level security;

drop policy if exists "registry dibaca publik" on public.guild_feature_registry;
create policy "registry dibaca publik" on public.guild_feature_registry
  for select to anon, authenticated using (active);


-- ─── 6. Status sinkronisasi (trigger) ────────────────────────────────────────
create or replace function public.guild_config_set_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.sync_status := case
    when new.current_revision > new.applied_revision then
      case
        when new.attempted_revision = new.current_revision and new.last_error is not null
          then 'NEEDS_ATTENTION'
        else 'SYNCING'
      end
    when jsonb_typeof(new.health) = 'array' and jsonb_array_length(new.health) > 0
      then 'NEEDS_ATTENTION'
    else 'ACTIVE'
  end;
  return new;
end;
$$;

drop trigger if exists guild_config_status_trg on public.guild_config;
create trigger guild_config_status_trg
  before insert or update on public.guild_config
  for each row execute function public.guild_config_set_status();


-- ─── 7. Helper internal ──────────────────────────────────────────────────────

-- Lempar error terstruktur. message = kode stabil (dipetakan website ke teks
-- manusia), detail = JSON tambahan.
create or replace function public.guild_dashboard_fail(p_code text, p_detail jsonb default null)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = 'P0001',
    message = p_code,
    detail  = coalesce(p_detail, '{}'::jsonb)::text;
end;
$$;

-- Identitas Discord pemanggil, dari auth.identities (BUKAN user_metadata yang
-- bisa diubah user sendiri).
create or replace function public.guild_dashboard_identity()
returns table (discord_id text, display_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select i.provider_id,
         coalesce(
           nullif(i.identity_data -> 'custom_claims' ->> 'global_name', ''),
           nullif(i.identity_data ->> 'full_name', ''),
           nullif(i.identity_data ->> 'name', ''),
           i.provider_id
         )
  from auth.identities i
  where i.user_id = auth.uid() and i.provider = 'discord'
  order by i.last_sign_in_at desc nulls last
  limit 1;
$$;

-- Pastikan pemanggil boleh mengelola guild ini. Mengembalikan identitasnya.
create or replace function public.guild_dashboard_assert_access(p_guild_id text)
returns table (discord_id text, display_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id   text;
  v_name text;
  v_at   timestamptz;
begin
  if auth.uid() is null then
    perform public.guild_dashboard_fail('NOT_AUTHENTICATED');
  end if;
  if p_guild_id is null or p_guild_id !~ '^[0-9]{15,22}$' then
    perform public.guild_dashboard_fail('INVALID_GUILD');
  end if;

  select x.discord_id, x.display_name into v_id, v_name
  from public.guild_dashboard_identity() x;
  if v_id is null then
    perform public.guild_dashboard_fail('NO_DISCORD_IDENTITY');
  end if;

  select a.verified_at into v_at
  from public.guild_dashboard_access a
  where a.user_id = auth.uid() and a.guild_id = p_guild_id and a.discord_user_id = v_id;

  if v_at is null then
    perform public.guild_dashboard_fail('ACCESS_DENIED');
  end if;
  if v_at < now() - interval '15 minutes' then
    perform public.guild_dashboard_fail('ACCESS_STALE');
  end if;

  return query select v_id, v_name;
end;
$$;

-- State efektif sebuah server: registry aktif + nilai tersimpan.
--   { "FEATURE": { "enabled": bool, "settings": {}, "channels": { purpose: id } } }
-- Fitur tanpa baris memakai default_enabled dari registry.
create or replace function public.guild_config_state(p_bot_slug text, p_guild_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(r.feature_key, jsonb_build_object(
    'enabled',  coalesce(f.enabled, r.default_enabled),
    'settings', coalesce(f.settings, '{}'::jsonb),
    'channels', coalesce((
      select jsonb_object_agg(c.purpose, c.channel_id)
      from public.guild_channel_config c
      where c.bot_slug = r.bot_slug
        and c.guild_id = p_guild_id
        and c.feature_key = r.feature_key
        and exists (
          select 1 from jsonb_array_elements(r.purposes) p where p ->> 'key' = c.purpose
        )
    ), '{}'::jsonb)
  )), '{}'::jsonb)
  from public.guild_feature_registry r
  left join public.guild_feature_config f
    on f.bot_slug = r.bot_slug and f.guild_id = p_guild_id and f.feature_key = r.feature_key
  where r.bot_slug = p_bot_slug and r.active;
$$;

-- Daftar perubahan antara dua state: [{ path, from, to }].
create or replace function public.guild_config_diff(p_old jsonb, p_new jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_out  jsonb := '[]'::jsonb;
  v_key  text;
  v_sub  text;
  v_o    jsonb;
  v_n    jsonb;
begin
  for v_key in
    select k from (
      select jsonb_object_keys(coalesce(p_old, '{}'::jsonb)) as k
      union
      select jsonb_object_keys(coalesce(p_new, '{}'::jsonb))
    ) s order by k
  loop
    v_o := coalesce(p_old -> v_key, '{}'::jsonb);
    v_n := coalesce(p_new -> v_key, '{}'::jsonb);

    if (v_o -> 'enabled') is distinct from (v_n -> 'enabled') then
      v_out := v_out || jsonb_build_array(jsonb_build_object(
        'path', v_key || '.enabled', 'from', v_o -> 'enabled', 'to', v_n -> 'enabled'));
    end if;

    for v_sub in
      select k from (
        select jsonb_object_keys(coalesce(v_o -> 'channels', '{}'::jsonb)) as k
        union
        select jsonb_object_keys(coalesce(v_n -> 'channels', '{}'::jsonb))
      ) s order by k
    loop
      if (v_o -> 'channels' -> v_sub) is distinct from (v_n -> 'channels' -> v_sub) then
        v_out := v_out || jsonb_build_array(jsonb_build_object(
          'path', v_key || '.channels.' || v_sub,
          'from', v_o -> 'channels' -> v_sub, 'to', v_n -> 'channels' -> v_sub));
      end if;
    end loop;

    for v_sub in
      select k from (
        select jsonb_object_keys(coalesce(v_o -> 'settings', '{}'::jsonb)) as k
        union
        select jsonb_object_keys(coalesce(v_n -> 'settings', '{}'::jsonb))
      ) s order by k
    loop
      if (v_o -> 'settings' -> v_sub) is distinct from (v_n -> 'settings' -> v_sub) then
        v_out := v_out || jsonb_build_array(jsonb_build_object(
          'path', v_key || '.settings.' || v_sub,
          'from', v_o -> 'settings' -> v_sub, 'to', v_n -> 'settings' -> v_sub));
      end if;
    end loop;
  end loop;
  return v_out;
end;
$$;

-- Validasi state baru (blocking). Channel hanya dicek terhadap snapshot Discord
-- bila NILAINYA BERUBAH: channel lama yang kini hilang tidak memblokir simpan
-- (itu dilaporkan bot sebagai masalah kesehatan).
create or replace function public.guild_config_validate(
  p_bot_slug text, p_guild_id text, p_old jsonb, p_new jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_issues   jsonb := '[]'::jsonb;
  v_reg      record;
  v_feat     jsonb;
  v_purpose  jsonb;
  v_pkey     text;
  v_channel  text;
  v_snap     record;
  v_ch       jsonb;
  v_seen     jsonb := '{}'::jsonb;   -- "scope|channel" → feature_key
  v_skey     text;
  v_props    jsonb;
  v_no_data  boolean := false;
begin
  select s.channels, s.refreshed_at into v_snap
  from public.guild_discord_snapshot s
  where s.bot_slug = p_bot_slug and s.guild_id = p_guild_id;

  for v_reg in
    select r.feature_key, r.name, r.purposes, r.settings_schema
    from public.guild_feature_registry r
    where r.bot_slug = p_bot_slug and r.active
    order by r.sort, r.feature_key
  loop
    v_feat := p_new -> v_reg.feature_key;
    if v_feat is null then continue; end if;

    -- Settings: objek kecil; bila schema punya "properties", key wajib dikenal.
    if jsonb_typeof(v_feat -> 'settings') is distinct from 'object'
       or length((v_feat -> 'settings')::text) > 4000 then
      v_issues := v_issues || jsonb_build_array(jsonb_build_object(
        'code', 'SETTINGS_INVALID', 'feature', v_reg.feature_key));
    else
      v_props := v_reg.settings_schema -> 'properties';
      if jsonb_typeof(v_props) = 'object' and exists (
        select 1 from jsonb_object_keys(v_feat -> 'settings') k where not (v_props ? k)
      ) then
        v_issues := v_issues || jsonb_build_array(jsonb_build_object(
          'code', 'SETTINGS_INVALID', 'feature', v_reg.feature_key));
      end if;
    end if;

    -- Channel per tujuan.
    for v_pkey, v_channel in
      select key, value #>> '{}' from jsonb_each(coalesce(v_feat -> 'channels', '{}'::jsonb))
    loop
      select p into v_purpose
      from jsonb_array_elements(v_reg.purposes) p
      where p ->> 'key' = v_pkey;

      if v_purpose is null then
        v_issues := v_issues || jsonb_build_array(jsonb_build_object(
          'code', 'UNKNOWN_PURPOSE', 'feature', v_reg.feature_key, 'purpose', v_pkey));
        continue;
      end if;
      if v_channel is null or v_channel !~ '^[0-9]{15,22}$' then
        v_issues := v_issues || jsonb_build_array(jsonb_build_object(
          'code', 'INVALID_CHANNEL', 'feature', v_reg.feature_key, 'purpose', v_pkey));
        continue;
      end if;

      -- Channel baru/berubah → wajib ada di data Discord terbaru dari bot.
      if (p_old -> v_reg.feature_key -> 'channels' ->> v_pkey) is distinct from v_channel then
        if v_snap.refreshed_at is null then
          v_no_data := true;
        else
          select c into v_ch
          from jsonb_array_elements(v_snap.channels) c
          where c ->> 'id' = v_channel;

          if v_ch is null then
            v_issues := v_issues || jsonb_build_array(jsonb_build_object(
              'code', 'CHANNEL_NOT_FOUND', 'feature', v_reg.feature_key,
              'purpose', v_pkey, 'channel_id', v_channel));
          elsif jsonb_typeof(v_purpose -> 'channel_types') = 'array'
                and not ((v_purpose -> 'channel_types') @> to_jsonb((v_ch ->> 'type')::int)) then
            v_issues := v_issues || jsonb_build_array(jsonb_build_object(
              'code', 'CHANNEL_TYPE_INVALID', 'feature', v_reg.feature_key,
              'purpose', v_pkey, 'channel_id', v_channel, 'channel_name', v_ch ->> 'name'));
          end if;
        end if;
      end if;
    end loop;

    -- Tujuan wajib & keunikan channel hanya untuk fitur yang aktif.
    if coalesce((v_feat ->> 'enabled')::boolean, false) then
      for v_purpose in select p from jsonb_array_elements(v_reg.purposes) p loop
        v_pkey := v_purpose ->> 'key';
        v_channel := v_feat -> 'channels' ->> v_pkey;

        if coalesce((v_purpose ->> 'required')::boolean, false) and v_channel is null then
          v_issues := v_issues || jsonb_build_array(jsonb_build_object(
            'code', 'CHANNEL_REQUIRED', 'feature', v_reg.feature_key, 'purpose', v_pkey));
        end if;

        if v_channel is not null and nullif(v_purpose ->> 'unique_scope', '') is not null then
          v_skey := (v_purpose ->> 'unique_scope') || '|' || v_channel;
          if v_seen ? v_skey then
            v_issues := v_issues || jsonb_build_array(jsonb_build_object(
              'code', 'CHANNEL_CONFLICT', 'feature', v_reg.feature_key, 'purpose', v_pkey,
              'channel_id', v_channel, 'other_feature', v_seen ->> v_skey));
          else
            v_seen := v_seen || jsonb_build_object(v_skey, v_reg.feature_key);
          end if;
        end if;
      end loop;
    end if;
  end loop;

  if v_no_data then
    v_issues := v_issues || jsonb_build_array(jsonb_build_object('code', 'NO_DISCORD_DATA'));
  end if;
  return v_issues;
end;
$$;

-- Bitfield izin aman: string desimal → bigint, null bila tidak valid.
create or replace function public.guild_dashboard_bits(p_value text)
returns bigint
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_value is null or p_value !~ '^[0-9]{1,19}$' then return null; end if;
  return p_value::bigint;
exception when others then
  return null;
end;
$$;

-- Peringatan (non-blocking): izin bot yang kurang di channel fitur aktif,
-- menurut snapshot terakhir. Bot tetap memvalidasi ulang saat menerapkan.
create or replace function public.guild_config_perm_warnings(
  p_bot_slug text, p_guild_id text, p_state jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_out     jsonb := '[]'::jsonb;
  v_reg     record;
  v_purpose jsonb;
  v_channel text;
  v_ch      jsonb;
  v_perms   bigint;
  v_missing jsonb;
  v_snap    jsonb;
begin
  select s.channels into v_snap
  from public.guild_discord_snapshot s
  where s.bot_slug = p_bot_slug and s.guild_id = p_guild_id and s.refreshed_at is not null;
  if v_snap is null then return v_out; end if;

  for v_reg in
    select r.feature_key, r.purposes from public.guild_feature_registry r
    where r.bot_slug = p_bot_slug and r.active order by r.sort
  loop
    if not coalesce((p_state -> v_reg.feature_key ->> 'enabled')::boolean, false) then continue; end if;
    for v_purpose in select p from jsonb_array_elements(v_reg.purposes) p loop
      v_channel := p_state -> v_reg.feature_key -> 'channels' ->> (v_purpose ->> 'key');
      if v_channel is null then continue; end if;
      select c into v_ch from jsonb_array_elements(v_snap) c where c ->> 'id' = v_channel;
      if v_ch is null then continue; end if;
      v_perms := public.guild_dashboard_bits(v_ch ->> 'perms');
      if v_perms is null then continue; end if;

      select coalesce(jsonb_agg(pm ->> 'name'), '[]'::jsonb) into v_missing
      from jsonb_array_elements(coalesce(v_purpose -> 'permissions', '[]'::jsonb)) pm
      where public.guild_dashboard_bits(pm ->> 'bit') is not null
        and (v_perms & public.guild_dashboard_bits(pm ->> 'bit')) = 0;

      if jsonb_array_length(v_missing) > 0 then
        v_out := v_out || jsonb_build_array(jsonb_build_object(
          'code', 'MISSING_PERMISSIONS', 'feature', v_reg.feature_key,
          'purpose', v_purpose ->> 'key', 'channel_id', v_channel,
          'channel_name', v_ch ->> 'name', 'missing', v_missing));
      end if;
    end loop;
  end loop;
  return v_out;
end;
$$;

-- Tulis state untuk fitur-fitur tertentu (baris fitur + channel diganti penuh).
create or replace function public.guild_config_write(
  p_bot_slug text, p_guild_id text, p_state jsonb, p_features text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text;
begin
  foreach v_key in array coalesce(p_features, '{}'::text[]) loop
    if p_state -> v_key is null then continue; end if;

    insert into public.guild_feature_config (bot_slug, guild_id, feature_key, enabled, settings, updated_at)
    values (
      p_bot_slug, p_guild_id, v_key,
      coalesce((p_state -> v_key ->> 'enabled')::boolean, false),
      coalesce(p_state -> v_key -> 'settings', '{}'::jsonb),
      now()
    )
    on conflict (bot_slug, guild_id, feature_key) do update
      set enabled = excluded.enabled, settings = excluded.settings, updated_at = now()
      where public.guild_feature_config.enabled is distinct from excluded.enabled
         or public.guild_feature_config.settings is distinct from excluded.settings;

    delete from public.guild_channel_config c
    where c.bot_slug = p_bot_slug and c.guild_id = p_guild_id and c.feature_key = v_key
      and not ((p_state -> v_key -> 'channels') ? c.purpose);

    insert into public.guild_channel_config (bot_slug, guild_id, feature_key, purpose, channel_id, updated_at)
    select p_bot_slug, p_guild_id, v_key, e.key, e.value #>> '{}', now()
    from jsonb_each(coalesce(p_state -> v_key -> 'channels', '{}'::jsonb)) e
    on conflict (bot_slug, guild_id, feature_key, purpose) do update
      set channel_id = excluded.channel_id, updated_at = now()
      where public.guild_channel_config.channel_id is distinct from excluded.channel_id;
  end loop;
end;
$$;

create or replace function public.guild_config_audit_add(
  p_bot_slug text, p_guild_id text, p_actor_id text, p_actor_name text,
  p_source text, p_revision bigint, p_action text, p_changed jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.guild_config_audit
    (bot_slug, guild_id, actor_id, actor_name, source, revision, action, changed_fields)
  values
    (p_bot_slug, p_guild_id, coalesce(p_actor_id, 'bot'), p_actor_name, p_source,
     coalesce(p_revision, 0), p_action, coalesce(p_changed, '[]'::jsonb));
$$;

-- Bot sedang online? (heartbeat < 90 dtk)
create or replace function public.guild_dashboard_bot_online(p_bot_slug text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select b.last_heartbeat_at > now() - interval '90 seconds'
    from public.guild_dashboard_bot_state b where b.bot_slug = p_bot_slug
  ), false);
$$;


-- ─── 8. RPC website (authenticated) ──────────────────────────────────────────

-- Seluruh data satu halaman server dalam satu panggilan.
create or replace function public.guild_dashboard_get(
  p_guild_id text, p_bot_slug text default 'sambung-kata'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me    record;
  v_cfg   public.guild_config;
  v_snap  public.guild_discord_snapshot;
  v_acc   public.guild_dashboard_access;
  v_bot   public.guild_dashboard_bot_state;
  v_inst  boolean;
begin
  select * into v_me from public.guild_dashboard_assert_access(p_guild_id);

  select * into v_cfg  from public.guild_config c where c.bot_slug = p_bot_slug and c.guild_id = p_guild_id;
  select * into v_snap from public.guild_discord_snapshot s where s.bot_slug = p_bot_slug and s.guild_id = p_guild_id;
  select * into v_acc  from public.guild_dashboard_access a where a.user_id = auth.uid() and a.guild_id = p_guild_id;
  select * into v_bot  from public.guild_dashboard_bot_state b where b.bot_slug = p_bot_slug;
  select exists (
    select 1 from public.bot_guilds g
    where g.bot_slug = p_bot_slug and g.guild_id = p_guild_id and g.is_active
  ) into v_inst;

  return jsonb_build_object(
    'guild', jsonb_build_object(
      'id', p_guild_id,
      'name', coalesce(v_snap.guild_name, v_acc.guild_name),
      'icon', coalesce(v_snap.icon_hash, v_acc.guild_icon),
      'member_count', v_snap.member_count
    ),
    'bot', jsonb_build_object(
      'installed', v_inst and coalesce(v_snap.bot_present, true),
      'online', public.guild_dashboard_bot_online(p_bot_slug),
      'last_heartbeat_at', v_bot.last_heartbeat_at,
      'version', v_bot.bot_version
    ),
    'config', case when v_cfg.id is null then null else jsonb_build_object(
      'revision', v_cfg.current_revision,
      'applied_revision', v_cfg.applied_revision,
      'sync_status', v_cfg.sync_status,
      'attempted_revision', v_cfg.attempted_revision,
      'attempted_at', v_cfg.attempted_at,
      'applied_at', v_cfg.applied_at,
      'last_error', v_cfg.last_error,
      'health', v_cfg.health,
      'health_checked_at', v_cfg.health_checked_at,
      'resync_requested_at', v_cfg.resync_requested_at,
      'updated_at', v_cfg.updated_at,
      'updated_by', v_cfg.updated_by,
      'updated_by_name', v_cfg.updated_by_name,
      'updated_source', v_cfg.updated_source,
      'timezone', v_cfg.timezone
    ) end,
    'registry', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', r.feature_key, 'section', r.section, 'name', r.name, 'emoji', r.emoji,
        'description', r.description, 'sort', r.sort, 'default_enabled', r.default_enabled,
        'purposes', r.purposes, 'settings_schema', r.settings_schema, 'meta', r.meta
      ) order by r.sort, r.feature_key)
      from public.guild_feature_registry r
      where r.bot_slug = p_bot_slug and r.active
    ), '[]'::jsonb),
    'state', public.guild_config_state(p_bot_slug, p_guild_id),
    'snapshot', case when v_snap.guild_id is null then null else jsonb_build_object(
      'refreshed_at', v_snap.refreshed_at,
      'requested_at', v_snap.requested_at,
      'bot_present', v_snap.bot_present,
      'bot_permissions', v_snap.bot_permissions,
      'channels', v_snap.channels
    ) end,
    'viewer', jsonb_build_object(
      'discord_id', v_me.discord_id,
      'name', v_me.display_name,
      'is_owner', coalesce(v_acc.is_owner, false),
      'access_verified_at', v_acc.verified_at
    ),
    'server_time', now()
  );
end;
$$;

-- Simpan perubahan (satu transaksi). Payload deklaratif:
--   p_features = { "FEATURE": { "enabled": bool, "settings": {} } }
--   p_channels = [{ "featureKey", "purpose", "channelId" }]
-- Setiap fitur yang disebut (di p_features ATAU p_channels) dideskripsikan
-- penuh oleh payload: channel tujuan yang tidak dikirim dianggap dikosongkan.
-- Fitur yang tidak disebut tidak berubah. p_revision wajib sama dengan revisi
-- tersimpan (optimistic concurrency) — selain itu ditolak STALE_REVISION.
create or replace function public.guild_config_save(
  p_guild_id text,
  p_revision bigint,
  p_features jsonb,
  p_channels jsonb,
  p_bot_slug text default 'sambung-kata'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me      record;
  v_cfg     public.guild_config;
  v_old     jsonb;
  v_new     jsonb;
  v_touched text[] := '{}';
  v_issues  jsonb := '[]'::jsonb;
  v_key     text;
  v_val     jsonb;
  v_entry   jsonb;
  v_fk      text;
  v_purpose text;
  v_channel text;
  v_pairs   text[] := '{}';
  v_diff    jsonb;
  v_rev     bigint;
begin
  select * into v_me from public.guild_dashboard_assert_access(p_guild_id);

  if not exists (
    select 1 from public.bot_guilds g
    where g.bot_slug = p_bot_slug and g.guild_id = p_guild_id and g.is_active
  ) then
    perform public.guild_dashboard_fail('BOT_NOT_INSTALLED');
  end if;

  -- Bot yang mendukung dashboard belum pernah jalan: pengaturan lama dari
  -- /pengaturan belum diimpor, jadi simpan dari website bisa menimpanya.
  -- Heartbeat pertama ditulis bot SETELAH impor selesai.
  if not exists (select 1 from public.guild_dashboard_bot_state b where b.bot_slug = p_bot_slug) then
    perform public.guild_dashboard_fail('BOT_NOT_READY');
  end if;

  insert into public.guild_config (bot_slug, guild_id, updated_by, updated_by_name)
  values (p_bot_slug, p_guild_id, v_me.discord_id, v_me.display_name)
  on conflict (bot_slug, guild_id) do nothing;

  select * into v_cfg from public.guild_config c
  where c.bot_slug = p_bot_slug and c.guild_id = p_guild_id
  for update;

  if p_revision is distinct from v_cfg.current_revision then
    perform public.guild_dashboard_fail('STALE_REVISION',
      jsonb_build_object('current_revision', v_cfg.current_revision));
  end if;

  if p_features is null then p_features := '{}'::jsonb; end if;
  if p_channels is null then p_channels := '[]'::jsonb; end if;
  if jsonb_typeof(p_features) <> 'object' or jsonb_typeof(p_channels) <> 'array'
     or jsonb_array_length(p_channels) > 200 then
    perform public.guild_dashboard_fail('INVALID_PAYLOAD');
  end if;

  v_old := public.guild_config_state(p_bot_slug, p_guild_id);
  v_new := v_old;

  -- Flag & settings.
  for v_key, v_val in select key, value from jsonb_each(p_features) loop
    if not (v_old ? v_key) then
      v_issues := v_issues || jsonb_build_array(jsonb_build_object('code', 'UNKNOWN_FEATURE', 'feature', v_key));
      continue;
    end if;
    if jsonb_typeof(v_val) <> 'object' then
      v_issues := v_issues || jsonb_build_array(jsonb_build_object('code', 'INVALID_PAYLOAD', 'feature', v_key));
      continue;
    end if;
    v_touched := array_append(v_touched, v_key);
    if v_val ? 'enabled' then
      if jsonb_typeof(v_val -> 'enabled') <> 'boolean' then
        v_issues := v_issues || jsonb_build_array(jsonb_build_object('code', 'INVALID_PAYLOAD', 'feature', v_key));
      else
        v_new := jsonb_set(v_new, array[v_key, 'enabled'], v_val -> 'enabled');
      end if;
    end if;
    if v_val ? 'settings' then
      v_new := jsonb_set(v_new, array[v_key, 'settings'], v_val -> 'settings');
    end if;
  end loop;

  -- Fitur yang disebut di p_channels juga dianggap disentuh.
  for v_entry in select e from jsonb_array_elements(p_channels) e loop
    v_fk := coalesce(v_entry ->> 'featureKey', v_entry ->> 'feature_key');
    if v_fk is null or not (v_old ? v_fk) then
      v_issues := v_issues || jsonb_build_array(jsonb_build_object('code', 'UNKNOWN_FEATURE', 'feature', v_fk));
      continue;
    end if;
    if not (v_fk = any (v_touched)) then
      v_touched := array_append(v_touched, v_fk);
    end if;
  end loop;

  -- Channel fitur yang disentuh diganti penuh oleh payload.
  foreach v_key in array v_touched loop
    v_new := jsonb_set(v_new, array[v_key, 'channels'], '{}'::jsonb);
  end loop;
  for v_entry in select e from jsonb_array_elements(p_channels) e loop
    v_fk := coalesce(v_entry ->> 'featureKey', v_entry ->> 'feature_key');
    v_purpose := v_entry ->> 'purpose';
    v_channel := nullif(coalesce(v_entry ->> 'channelId', v_entry ->> 'channel_id'), '');
    if v_fk is null or not (v_old ? v_fk) or v_channel is null then continue; end if;
    if v_purpose is null or (v_fk || '|' || v_purpose) = any (v_pairs) then
      v_issues := v_issues || jsonb_build_array(jsonb_build_object(
        'code', 'INVALID_PAYLOAD', 'feature', v_fk, 'purpose', v_purpose));
      continue;
    end if;
    v_pairs := array_append(v_pairs, v_fk || '|' || v_purpose);
    v_new := jsonb_set(v_new, array[v_fk, 'channels', v_purpose], to_jsonb(v_channel));
  end loop;

  v_issues := v_issues || public.guild_config_validate(p_bot_slug, p_guild_id, v_old, v_new);
  if jsonb_array_length(v_issues) > 0 then
    perform public.guild_dashboard_fail('VALIDATION_FAILED', jsonb_build_object('issues', v_issues));
  end if;

  v_diff := public.guild_config_diff(v_old, v_new);
  if jsonb_array_length(v_diff) = 0 then
    return jsonb_build_object(
      'ok', true, 'changed', false,
      'revision', v_cfg.current_revision, 'sync_status', v_cfg.sync_status,
      'warnings', public.guild_config_perm_warnings(p_bot_slug, p_guild_id, v_new));
  end if;

  perform public.guild_config_write(p_bot_slug, p_guild_id, v_new, v_touched);

  update public.guild_config c set
    current_revision = c.current_revision + 1,
    updated_by       = v_me.discord_id,
    updated_by_name  = v_me.display_name,
    updated_source   = 'web',
    updated_at       = now()
  where c.id = v_cfg.id
  returning c.current_revision into v_rev;

  perform public.guild_config_audit_add(p_bot_slug, p_guild_id, v_me.discord_id, v_me.display_name,
    'web', v_rev, 'config.save', v_diff);

  return jsonb_build_object(
    'ok', true, 'changed', true, 'revision', v_rev,
    'sync_status', (select c.sync_status from public.guild_config c where c.id = v_cfg.id),
    'changes', v_diff,
    'warnings', public.guild_config_perm_warnings(p_bot_slug, p_guild_id, v_new));
end;
$$;

-- "Retry Sync": minta bot memuat ulang & menerapkan revisi terbaru.
create or replace function public.guild_config_request_resync(
  p_guild_id text, p_bot_slug text default 'sambung-kata'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me  record;
  v_cfg public.guild_config;
begin
  select * into v_me from public.guild_dashboard_assert_access(p_guild_id);

  select * into v_cfg from public.guild_config c
  where c.bot_slug = p_bot_slug and c.guild_id = p_guild_id
  for update;
  if v_cfg.id is null then
    perform public.guild_dashboard_fail('NO_CONFIG');
  end if;

  -- Satu permintaan per 10 detik cukup; klik beruntun tidak menambah antrean.
  if v_cfg.resync_requested_at is null or v_cfg.resync_requested_at < now() - interval '10 seconds' then
    update public.guild_config c set resync_requested_at = now() where c.id = v_cfg.id;
    perform public.guild_config_audit_add(p_bot_slug, p_guild_id, v_me.discord_id, v_me.display_name,
      'web', v_cfg.current_revision, 'sync.resync_requested', '[]'::jsonb);
  end if;

  return jsonb_build_object('ok', true, 'requested_at', now(),
    'bot_online', public.guild_dashboard_bot_online(p_bot_slug));
end;
$$;

-- "Refresh Discord Data": minta bot menerbitkan ulang daftar channel & izin.
create or replace function public.guild_dashboard_request_refresh(
  p_guild_id text, p_bot_slug text default 'sambung-kata'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.guild_dashboard_assert_access(p_guild_id);

  insert into public.guild_discord_snapshot as s (bot_slug, guild_id, requested_at, requested_by)
  values (p_bot_slug, p_guild_id, now(), auth.uid())
  on conflict (bot_slug, guild_id) do update
    set requested_at = now(), requested_by = auth.uid()
    where s.requested_at is null or s.requested_at < now() - interval '5 seconds';

  return jsonb_build_object('ok', true, 'requested_at', now(),
    'bot_online', public.guild_dashboard_bot_online(p_bot_slug));
end;
$$;

-- Riwayat (audit log) sebuah server, terbaru dulu, berhalaman.
create or replace function public.guild_config_audit_list(
  p_guild_id text,
  p_bot_slug text default 'sambung-kata',
  p_limit integer default 20,
  p_before_id bigint default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform 1 from public.guild_dashboard_assert_access(p_guild_id);
  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x.id desc)
    from (
      select a.id, a.actor_id, a.actor_name, a.source, a.revision, a.action,
             a.changed_fields, a.created_at
      from public.guild_config_audit a
      where a.bot_slug = p_bot_slug and a.guild_id = p_guild_id
        and (p_before_id is null or a.id < p_before_id)
      order by a.id desc
      limit least(greatest(coalesce(p_limit, 20), 1), 100)
    ) x
  ), '[]'::jsonb);
end;
$$;


-- ─── 9. RPC bot (service_role) ───────────────────────────────────────────────

-- Satu panggilan per putaran poll: heartbeat + pekerjaan yang menunggu.
--   pending : server yang revisinya belum diterapkan / minta resync, lengkap
--             dengan konfigurasi tersimpannya.
--   refresh : server yang minta snapshot Discord diterbitkan ulang.
-- Revisi yang gagal diterapkan tidak diulang tiap poll: diulang saat ada revisi
-- baru, resync diminta, atau 10 menit setelah percobaan terakhir.
create or replace function public.guild_bot_poll(
  p_bot_slug text, p_bot_version text default null, p_limit integer default 10
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.guild_dashboard_bot_state as b (bot_slug, last_heartbeat_at, bot_version, started_at)
  values (p_bot_slug, now(), p_bot_version, now())
  on conflict (bot_slug) do update
    set last_heartbeat_at = now(), bot_version = excluded.bot_version
    where b.last_heartbeat_at < now() - interval '15 seconds'
       or b.bot_version is distinct from excluded.bot_version;

  return jsonb_build_object(
    'now', now(),
    'pending', coalesce((
      select jsonb_agg(jsonb_build_object(
        'guild_id', c.guild_id,
        'revision', c.current_revision,
        'applied_revision', c.applied_revision,
        'resync', c.resync_requested_at is not null
                  and c.resync_requested_at > coalesce(c.attempted_at, '-infinity'::timestamptz),
        'updated_by', c.updated_by,
        'updated_source', c.updated_source,
        'features', coalesce((
          select jsonb_object_agg(f.feature_key, jsonb_build_object('enabled', f.enabled, 'settings', f.settings))
          from public.guild_feature_config f
          where f.bot_slug = c.bot_slug and f.guild_id = c.guild_id
        ), '{}'::jsonb),
        'channels', coalesce((
          select jsonb_agg(jsonb_build_object('feature_key', ch.feature_key, 'purpose', ch.purpose, 'channel_id', ch.channel_id))
          from public.guild_channel_config ch
          where ch.bot_slug = c.bot_slug and ch.guild_id = c.guild_id
        ), '[]'::jsonb)
      ))
      from (
        select * from public.guild_config c0
        where c0.bot_slug = p_bot_slug
          and (
            (c0.current_revision > c0.applied_revision and (
                c0.attempted_revision is distinct from c0.current_revision
                or c0.attempted_at < now() - interval '10 minutes'
                or coalesce(c0.resync_requested_at, '-infinity'::timestamptz) > coalesce(c0.attempted_at, '-infinity'::timestamptz)))
            or coalesce(c0.resync_requested_at, '-infinity'::timestamptz) > coalesce(c0.attempted_at, '-infinity'::timestamptz)
          )
        order by c0.updated_at
        limit least(greatest(coalesce(p_limit, 10), 1), 50)
      ) c
    ), '[]'::jsonb),
    'refresh', coalesce((
      select jsonb_agg(s.guild_id)
      from (
        select s0.guild_id from public.guild_discord_snapshot s0
        where s0.bot_slug = p_bot_slug
          and s0.requested_at is not null
          and s0.requested_at > coalesce(s0.refreshed_at, '-infinity'::timestamptz)
        order by s0.requested_at
        limit 20
      ) s
    ), '[]'::jsonb)
  );
end;
$$;

-- Hasil percobaan bot.
--   p_kind = 'apply'  → hasil menerapkan p_revision (ok / gagal + issues)
--   p_kind = 'health' → pemeriksaan ulang revisi yang sudah diterapkan
-- issues: [{ code, feature?, purpose?, channel_id?, missing?, detail? }]
create or replace function public.guild_bot_report(
  p_bot_slug text, p_guild_id text, p_revision bigint, p_ok boolean,
  p_issues jsonb default '[]'::jsonb, p_kind text default 'apply'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cfg    public.guild_config;
  v_issues jsonb := coalesce(p_issues, '[]'::jsonb);
  v_last   record;
begin
  select * into v_cfg from public.guild_config c
  where c.bot_slug = p_bot_slug and c.guild_id = p_guild_id
  for update;
  if v_cfg.id is null then
    return jsonb_build_object('ok', false, 'reason', 'NO_CONFIG');
  end if;
  if jsonb_typeof(v_issues) <> 'array' then v_issues := '[]'::jsonb; end if;

  if p_kind = 'health' then
    -- Hanya berlaku untuk revisi yang memang sudah diterapkan.
    if p_revision = v_cfg.applied_revision then
      update public.guild_config c
      set health = v_issues, health_checked_at = now()
      where c.id = v_cfg.id;
    end if;

  elsif p_ok then
    update public.guild_config c set
      applied_revision   = greatest(c.applied_revision, p_revision),
      applied_at         = now(),
      attempted_revision = p_revision,
      attempted_at       = now(),
      last_error         = null,
      health             = v_issues,
      health_checked_at  = now()
    where c.id = v_cfg.id;

    perform public.guild_config_audit_add(p_bot_slug, p_guild_id, 'bot', 'Bot', 'bot',
      p_revision, 'sync.applied', v_issues);

  else
    update public.guild_config c set
      attempted_revision = p_revision,
      attempted_at       = now(),
      last_error         = v_issues,
      -- Menerapkan ulang (Retry Sync) revisi yang sudah berlaku gagal → revisi
      -- itu sendiri bermasalah sekarang: tampilkan sebagai masalah kesehatan.
      health             = case when p_revision <= c.applied_revision then v_issues else c.health end,
      health_checked_at  = case when p_revision <= c.applied_revision then now() else c.health_checked_at end
    where c.id = v_cfg.id;

    -- Kegagalan yang sama untuk revisi yang sama tidak dicatat berulang.
    select a.revision, a.action, a.changed_fields into v_last
    from public.guild_config_audit a
    where a.bot_slug = p_bot_slug and a.guild_id = p_guild_id
    order by a.id desc limit 1;

    if not (v_last.action = 'sync.failed' and v_last.revision = p_revision
            and v_last.changed_fields = v_issues) then
      perform public.guild_config_audit_add(p_bot_slug, p_guild_id, 'bot', 'Bot', 'bot',
        p_revision, 'sync.failed', v_issues);
    end if;
  end if;

  select * into v_cfg from public.guild_config c where c.id = v_cfg.id;
  return jsonb_build_object('ok', true, 'sync_status', v_cfg.sync_status,
    'revision', v_cfg.current_revision, 'applied_revision', v_cfg.applied_revision);
end;
$$;

-- Perubahan yang dibuat dari Discord (/pengaturan, Social Monitor) dan SUDAH
-- diterapkan bot. Dicatat sebagai delta di atas state terbaru supaya perubahan
-- website yang belum diterapkan tidak tertimpa.
--   p_ops = [{ "feature_key": "X", "enabled"?: bool,
--              "channels"?: { "<purpose>": "<channel_id>" | null } }]
create or replace function public.guild_bot_record_local_change(
  p_bot_slug text, p_guild_id text, p_actor_id text, p_actor_name text, p_ops jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cfg     public.guild_config;
  v_old     jsonb;
  v_new     jsonb;
  v_op      jsonb;
  v_fk      text;
  v_purpose text;
  v_channel jsonb;
  v_touched text[] := '{}';
  v_diff    jsonb;
  v_synced  boolean;
  v_rev     bigint;
begin
  if jsonb_typeof(p_ops) is distinct from 'array' then
    return jsonb_build_object('ok', false, 'reason', 'INVALID_PAYLOAD');
  end if;

  insert into public.guild_config (bot_slug, guild_id, updated_source)
  values (p_bot_slug, p_guild_id, 'discord')
  on conflict (bot_slug, guild_id) do nothing;

  select * into v_cfg from public.guild_config c
  where c.bot_slug = p_bot_slug and c.guild_id = p_guild_id
  for update;

  v_old := public.guild_config_state(p_bot_slug, p_guild_id);
  v_new := v_old;

  for v_op in select o from jsonb_array_elements(p_ops) o loop
    v_fk := v_op ->> 'feature_key';
    if v_fk is null or not (v_new ? v_fk) then continue; end if;
    if not (v_fk = any (v_touched)) then v_touched := array_append(v_touched, v_fk); end if;

    if jsonb_typeof(v_op -> 'enabled') = 'boolean' then
      v_new := jsonb_set(v_new, array[v_fk, 'enabled'], v_op -> 'enabled');
    end if;
    if jsonb_typeof(v_op -> 'channels') = 'object' then
      for v_purpose, v_channel in select key, value from jsonb_each(v_op -> 'channels') loop
        if v_channel is null or jsonb_typeof(v_channel) = 'null' then
          v_new := jsonb_set(v_new, array[v_fk, 'channels'], (v_new -> v_fk -> 'channels') - v_purpose);
        elsif (v_channel #>> '{}') ~ '^[0-9]{15,22}$' then
          v_new := jsonb_set(v_new, array[v_fk, 'channels', v_purpose], v_channel);
        end if;
      end loop;
    end if;
  end loop;

  v_diff := public.guild_config_diff(v_old, v_new);
  if jsonb_array_length(v_diff) = 0 then
    return jsonb_build_object('ok', true, 'changed', false, 'revision', v_cfg.current_revision);
  end if;

  perform public.guild_config_write(p_bot_slug, p_guild_id, v_new, v_touched);
  v_synced := v_cfg.applied_revision >= v_cfg.current_revision;

  update public.guild_config c set
    current_revision   = c.current_revision + 1,
    -- Sudah sinkron sebelumnya → revisi baru ini sudah berlaku di bot.
    applied_revision   = case when v_synced then c.current_revision + 1 else c.applied_revision end,
    applied_at         = case when v_synced then now() else c.applied_at end,
    attempted_revision = case when v_synced then c.current_revision + 1 else c.attempted_revision end,
    attempted_at       = case when v_synced then now() else c.attempted_at end,
    last_error         = case when v_synced then null else c.last_error end,
    updated_by         = p_actor_id,
    updated_by_name    = p_actor_name,
    updated_source     = 'discord',
    updated_at         = now()
  where c.id = v_cfg.id
  returning c.current_revision into v_rev;

  perform public.guild_config_audit_add(p_bot_slug, p_guild_id, p_actor_id, p_actor_name,
    'discord', v_rev, 'config.discord', v_diff);

  return jsonb_build_object('ok', true, 'changed', true, 'revision', v_rev, 'applied', v_synced);
end;
$$;

-- Impor konfigurasi lama dari bot (dibuat lewat /pengaturan sebelum dashboard
-- ada). Hanya untuk server yang BELUM punya baris guild_config — tidak pernah
-- menimpa konfigurasi yang sudah dikelola dashboard.
--   p_items = [{ "guild_id", "features": { KEY: { enabled } },
--                "channels": [{ feature_key, purpose, channel_id }] }]
create or replace function public.guild_bot_import(p_bot_slug text, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item     jsonb;
  v_gid      text;
  v_old      jsonb;
  v_new      jsonb;
  v_key      text;
  v_val      jsonb;
  v_ch       jsonb;
  v_touched  text[];
  v_diff     jsonb;
  v_imported integer := 0;
  v_skipped  integer := 0;
begin
  if jsonb_typeof(p_items) is distinct from 'array' then
    return jsonb_build_object('ok', false, 'reason', 'INVALID_PAYLOAD');
  end if;

  for v_item in select i from jsonb_array_elements(p_items) i loop
    v_gid := v_item ->> 'guild_id';
    if v_gid is null or v_gid !~ '^[0-9]{15,22}$' then
      v_skipped := v_skipped + 1; continue;
    end if;
    if exists (select 1 from public.guild_config c where c.bot_slug = p_bot_slug and c.guild_id = v_gid) then
      v_skipped := v_skipped + 1; continue;
    end if;

    v_old := public.guild_config_state(p_bot_slug, v_gid);
    v_new := v_old;
    v_touched := '{}';

    for v_key, v_val in select key, value from jsonb_each(coalesce(v_item -> 'features', '{}'::jsonb)) loop
      if not (v_new ? v_key) or jsonb_typeof(v_val -> 'enabled') <> 'boolean' then continue; end if;
      v_new := jsonb_set(v_new, array[v_key, 'enabled'], v_val -> 'enabled');
      if not (v_key = any (v_touched)) then v_touched := array_append(v_touched, v_key); end if;
    end loop;
    for v_ch in select c from jsonb_array_elements(coalesce(v_item -> 'channels', '[]'::jsonb)) c loop
      v_key := v_ch ->> 'feature_key';
      if v_key is null or not (v_new ? v_key) or (v_ch ->> 'channel_id') !~ '^[0-9]{15,22}$'
         or v_ch ->> 'purpose' is null then continue; end if;
      v_new := jsonb_set(v_new, array[v_key, 'channels', v_ch ->> 'purpose'], to_jsonb(v_ch ->> 'channel_id'));
      if not (v_key = any (v_touched)) then v_touched := array_append(v_touched, v_key); end if;
    end loop;

    v_diff := public.guild_config_diff(v_old, v_new);
    if jsonb_array_length(v_diff) = 0 then
      v_skipped := v_skipped + 1; continue;
    end if;

    insert into public.guild_config
      (bot_slug, guild_id, current_revision, applied_revision, attempted_revision,
       attempted_at, applied_at, updated_by, updated_by_name, updated_source)
    values
      (p_bot_slug, v_gid, 1, 1, 1, now(), now(), 'bot', 'Impor dari /pengaturan', 'import')
    on conflict (bot_slug, guild_id) do nothing;
    if not found then
      v_skipped := v_skipped + 1; continue;
    end if;

    perform public.guild_config_write(p_bot_slug, v_gid, v_new, v_touched);
    perform public.guild_config_audit_add(p_bot_slug, v_gid, 'bot', 'Impor dari /pengaturan',
      'import', 1, 'config.import', v_diff);
    v_imported := v_imported + 1;
  end loop;

  return jsonb_build_object('ok', true, 'imported', v_imported, 'skipped', v_skipped);
end;
$$;

-- Konfigurasi tersimpan untuk pemeriksaan kesehatan (sapuan bot & event).
-- p_guild_ids null = semua server bot ini.
create or replace function public.guild_bot_get_configs(p_bot_slug text, p_guild_ids text[] default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'guild_id', c.guild_id,
    'revision', c.current_revision,
    'applied_revision', c.applied_revision,
    'sync_status', c.sync_status,
    'updated_by', c.updated_by,
    'updated_source', c.updated_source,
    'features', coalesce((
      select jsonb_object_agg(f.feature_key, jsonb_build_object('enabled', f.enabled, 'settings', f.settings))
      from public.guild_feature_config f
      where f.bot_slug = c.bot_slug and f.guild_id = c.guild_id
    ), '{}'::jsonb),
    'channels', coalesce((
      select jsonb_agg(jsonb_build_object('feature_key', ch.feature_key, 'purpose', ch.purpose, 'channel_id', ch.channel_id))
      from public.guild_channel_config ch
      where ch.bot_slug = c.bot_slug and ch.guild_id = c.guild_id
    ), '[]'::jsonb)
  ) order by c.guild_id), '[]'::jsonb)
  from public.guild_config c
  where c.bot_slug = p_bot_slug
    and (p_guild_ids is null or c.guild_id = any (p_guild_ids));
$$;

-- Terbitkan registry fitur. Fitur yang tidak lagi diterbitkan dinonaktifkan
-- (tidak dihapus — konfigurasi lamanya tetap ada bila fitur kembali).
create or replace function public.guild_bot_publish_registry(p_bot_slug text, p_features jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_keys text[];
begin
  if jsonb_typeof(p_features) is distinct from 'array' then
    return jsonb_build_object('ok', false, 'reason', 'INVALID_PAYLOAD');
  end if;

  insert into public.guild_feature_registry as r
    (bot_slug, feature_key, section, name, emoji, description, sort, default_enabled,
     purposes, settings_schema, meta, active, updated_at)
  select p_bot_slug, f ->> 'key', coalesce(f ->> 'section', 'other'), f ->> 'name', f ->> 'emoji',
         f ->> 'description', coalesce((f ->> 'sort')::int, 100),
         coalesce((f ->> 'default_enabled')::boolean, false),
         coalesce(f -> 'purposes', '[]'::jsonb), coalesce(f -> 'settings_schema', '{}'::jsonb),
         coalesce(f -> 'meta', '{}'::jsonb), true, now()
  from jsonb_array_elements(p_features) f
  where f ->> 'key' ~ '^[A-Z][A-Z0-9_]{1,47}$' and f ->> 'name' is not null
  on conflict (bot_slug, feature_key) do update set
    section = excluded.section, name = excluded.name, emoji = excluded.emoji,
    description = excluded.description, sort = excluded.sort,
    default_enabled = excluded.default_enabled, purposes = excluded.purposes,
    settings_schema = excluded.settings_schema, meta = excluded.meta,
    active = true, updated_at = now()
  where (r.section, r.name, r.emoji, r.description, r.sort, r.default_enabled,
         r.purposes, r.settings_schema, r.meta, r.active)
        is distinct from
        (excluded.section, excluded.name, excluded.emoji, excluded.description, excluded.sort,
         excluded.default_enabled, excluded.purposes, excluded.settings_schema, excluded.meta, true);

  select array_agg(f ->> 'key') into v_keys from jsonb_array_elements(p_features) f;
  update public.guild_feature_registry r set active = false, updated_at = now()
  where r.bot_slug = p_bot_slug and r.active and not (r.feature_key = any (coalesce(v_keys, '{}')));

  return jsonb_build_object('ok', true, 'count', coalesce(array_length(v_keys, 1), 0));
end;
$$;

-- Terbitkan snapshot Discord (satu atau beberapa server sekaligus).
--   p_items = [{ guild_id, guild_name, icon_hash, owner_id, member_count,
--                bot_present, bot_permissions, channels }]
create or replace function public.guild_bot_publish_snapshot(p_bot_slug text, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  if jsonb_typeof(p_items) is distinct from 'array' then
    return jsonb_build_object('ok', false, 'reason', 'INVALID_PAYLOAD');
  end if;

  insert into public.guild_discord_snapshot as s
    (bot_slug, guild_id, guild_name, icon_hash, owner_id, member_count, bot_present,
     bot_permissions, channels, refreshed_at)
  select p_bot_slug, i ->> 'guild_id', i ->> 'guild_name', i ->> 'icon_hash', i ->> 'owner_id',
         (i ->> 'member_count')::int, coalesce((i ->> 'bot_present')::boolean, true),
         i ->> 'bot_permissions',
         case when jsonb_typeof(i -> 'channels') = 'array' then i -> 'channels' else '[]'::jsonb end,
         now()
  from jsonb_array_elements(p_items) i
  where i ->> 'guild_id' ~ '^[0-9]{15,22}$'
  on conflict (bot_slug, guild_id) do update set
    guild_name = excluded.guild_name, icon_hash = excluded.icon_hash,
    owner_id = excluded.owner_id, member_count = excluded.member_count,
    bot_present = excluded.bot_present, bot_permissions = excluded.bot_permissions,
    channels = excluded.channels, refreshed_at = now();

  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'count', v_n);
end;
$$;


-- ─── 10. Hak eksekusi ────────────────────────────────────────────────────────
-- Supabase memberi EXECUTE ke anon/authenticated secara default — dicabut
-- eksplisit, lalu diberikan hanya ke peran yang memang memakainya.
revoke execute on function public.guild_config_set_status() from public, anon, authenticated;
revoke execute on function public.guild_dashboard_fail(text, jsonb) from public, anon, authenticated;
revoke execute on function public.guild_dashboard_identity() from public, anon, authenticated;
revoke execute on function public.guild_dashboard_assert_access(text) from public, anon, authenticated;
revoke execute on function public.guild_config_state(text, text) from public, anon, authenticated;
revoke execute on function public.guild_config_diff(jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.guild_config_validate(text, text, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.guild_dashboard_bits(text) from public, anon, authenticated;
revoke execute on function public.guild_config_perm_warnings(text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.guild_config_write(text, text, jsonb, text[]) from public, anon, authenticated;
revoke execute on function public.guild_config_audit_add(text, text, text, text, text, bigint, text, jsonb) from public, anon, authenticated;
revoke execute on function public.guild_dashboard_bot_online(text) from public, anon, authenticated;

-- Website (user login).
revoke execute on function public.guild_dashboard_get(text, text) from public, anon;
revoke execute on function public.guild_config_save(text, bigint, jsonb, jsonb, text) from public, anon;
revoke execute on function public.guild_config_request_resync(text, text) from public, anon;
revoke execute on function public.guild_dashboard_request_refresh(text, text) from public, anon;
revoke execute on function public.guild_config_audit_list(text, text, integer, bigint) from public, anon;
grant execute on function public.guild_dashboard_get(text, text) to authenticated;
grant execute on function public.guild_config_save(text, bigint, jsonb, jsonb, text) to authenticated;
grant execute on function public.guild_config_request_resync(text, text) to authenticated;
grant execute on function public.guild_dashboard_request_refresh(text, text) to authenticated;
grant execute on function public.guild_config_audit_list(text, text, integer, bigint) to authenticated;

-- Bot (service_role saja).
revoke execute on function public.guild_bot_poll(text, text, integer) from public, anon, authenticated;
revoke execute on function public.guild_bot_report(text, text, bigint, boolean, jsonb, text) from public, anon, authenticated;
revoke execute on function public.guild_bot_record_local_change(text, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.guild_bot_import(text, jsonb) from public, anon, authenticated;
revoke execute on function public.guild_bot_publish_registry(text, jsonb) from public, anon, authenticated;
revoke execute on function public.guild_bot_publish_snapshot(text, jsonb) from public, anon, authenticated;
revoke execute on function public.guild_bot_get_configs(text, text[]) from public, anon, authenticated;
grant execute on function public.guild_bot_poll(text, text, integer) to service_role;
grant execute on function public.guild_bot_report(text, text, bigint, boolean, jsonb, text) to service_role;
grant execute on function public.guild_bot_record_local_change(text, text, text, text, jsonb) to service_role;
grant execute on function public.guild_bot_import(text, jsonb) to service_role;
grant execute on function public.guild_bot_publish_registry(text, jsonb) to service_role;
grant execute on function public.guild_bot_publish_snapshot(text, jsonb) to service_role;
grant execute on function public.guild_bot_get_configs(text, text[]) to service_role;


-- ─── 11. Seed registry (bootstrap) ───────────────────────────────────────────
-- Isi awal supaya /dashboard langsung bisa dipakai sebelum bot versi baru jalan.
-- SSoT tetap kode bot (src/dashboard/registry.js): saat start, bot menimpa
-- baris-baris ini lewat guild_bot_publish_registry. ON CONFLICT DO NOTHING agar
-- menjalankan ulang file ini tidak menimpa registry yang sudah diterbitkan bot.
insert into public.guild_feature_registry
  (feature_key, section, name, emoji, description, sort, default_enabled, purposes, meta)
values
  ('SAMBUNG_KATA', 'game', 'Sambung Kata', '🔤',
   'Game utama sambung kata. Berlaku untuk semua mode: Player vs Player, Player vs Bot, Player vs Server, & Dungeon.',
   10, true,
   '[{"key": "game_channel", "label": "Channel khusus", "required": false, "channel_types": [0], "unique_scope": null, "empty_label": "Bebas — bisa dibuka di semua channel", "help": "Pemain yang membuka game dari channel lain diarahkan ke channel ini. Thread permainan dibuat di sana.", "permissions": [{"bit": "1024", "name": "View Channel"}, {"bit": "2048", "name": "Send Messages"}, {"bit": "34359738368", "name": "Create Public Threads"}, {"bit": "274877906944", "name": "Send Messages in Threads"}, {"bit": "16384", "name": "Embed Links"}]}]'::jsonb,
   '{"command": "/sambungkata", "runtime_key": "sambungkata"}'::jsonb),
  ('WEREWOLF', 'game', 'Werewolf Klasik', '🐺',
   'Deduksi sosial: warga vs serigala.',
   20, true,
   '[{"key": "game_channel", "label": "Channel khusus", "required": false, "channel_types": [0], "unique_scope": null, "empty_label": "Bebas — bisa dibuka di semua channel", "help": "Pemain yang membuka game dari channel lain diarahkan ke channel ini. Thread permainan dibuat di sana.", "permissions": [{"bit": "1024", "name": "View Channel"}, {"bit": "2048", "name": "Send Messages"}, {"bit": "34359738368", "name": "Create Public Threads"}, {"bit": "274877906944", "name": "Send Messages in Threads"}, {"bit": "16384", "name": "Embed Links"}]}]'::jsonb,
   '{"command": "/game", "runtime_key": "werewolf"}'::jsonb),
  ('WEREWOLF_ADV', 'game', 'Werewolf Lanjutan', '🌕',
   'Mode lengkap 54 peran (Warga · Serigala · Netral).',
   21, true,
   '[{"key": "game_channel", "label": "Channel khusus", "required": false, "channel_types": [0], "unique_scope": null, "empty_label": "Bebas — bisa dibuka di semua channel", "help": "Pemain yang membuka game dari channel lain diarahkan ke channel ini. Thread permainan dibuat di sana.", "permissions": [{"bit": "1024", "name": "View Channel"}, {"bit": "2048", "name": "Send Messages"}, {"bit": "34359738368", "name": "Create Public Threads"}, {"bit": "274877906944", "name": "Send Messages in Threads"}, {"bit": "16384", "name": "Embed Links"}]}]'::jsonb,
   '{"command": "/game", "runtime_key": "werewolf_adv"}'::jsonb),
  ('PENGACARA', 'game', 'Pengacara', '⚖️',
   'Persidangan roleplay: ungkap siapa yang bersalah.',
   22, true,
   '[{"key": "game_channel", "label": "Channel khusus", "required": false, "channel_types": [0], "unique_scope": null, "empty_label": "Bebas — bisa dibuka di semua channel", "help": "Pemain yang membuka game dari channel lain diarahkan ke channel ini. Thread permainan dibuat di sana.", "permissions": [{"bit": "1024", "name": "View Channel"}, {"bit": "2048", "name": "Send Messages"}, {"bit": "34359738368", "name": "Create Public Threads"}, {"bit": "274877906944", "name": "Send Messages in Threads"}, {"bit": "16384", "name": "Embed Links"}]}]'::jsonb,
   '{"command": "/game", "runtime_key": "pengacara"}'::jsonb),
  ('UNO', 'game', 'UNO', '🃏',
   'Adu kartu warna & angka — habiskan kartumu lebih dulu!',
   23, true,
   '[{"key": "game_channel", "label": "Channel khusus", "required": false, "channel_types": [0], "unique_scope": null, "empty_label": "Bebas — bisa dibuka di semua channel", "help": "Pemain yang membuka game dari channel lain diarahkan ke channel ini. Thread permainan dibuat di sana.", "permissions": [{"bit": "1024", "name": "View Channel"}, {"bit": "2048", "name": "Send Messages"}, {"bit": "34359738368", "name": "Create Public Threads"}, {"bit": "274877906944", "name": "Send Messages in Threads"}, {"bit": "16384", "name": "Embed Links"}]}]'::jsonb,
   '{"command": "/game", "runtime_key": "uno"}'::jsonb),
  ('TEBAK_LAGU', 'game', 'Tebak Lagu', '🎵',
   'Dengar cuplikan lagu, tebak judulnya paling cepat!',
   24, true,
   '[{"key": "game_channel", "label": "Channel khusus", "required": false, "channel_types": [0], "unique_scope": null, "empty_label": "Bebas — bisa dibuka di semua channel", "help": "Pemain yang membuka game dari channel lain diarahkan ke channel ini. Thread permainan dibuat di sana.", "permissions": [{"bit": "1024", "name": "View Channel"}, {"bit": "2048", "name": "Send Messages"}, {"bit": "34359738368", "name": "Create Public Threads"}, {"bit": "274877906944", "name": "Send Messages in Threads"}, {"bit": "16384", "name": "Embed Links"}]}]'::jsonb,
   '{"command": "/game", "runtime_key": "tebaklagu"}'::jsonb),
  ('SOCIAL_COUNT', 'social', 'Counting', '🔢',
   'Hitung bareng satu server — ketik angka berikutnya secara bergantian.',
   50, false,
   '[{"key": "activity_channel", "label": "Channel fitur", "required": true, "channel_types": [0], "unique_scope": "social", "empty_label": "Belum dipilih", "help": "Sebaiknya channel khusus, terpisah dari obrolan utama. Satu channel hanya untuk satu fitur sosial.", "permissions": [{"bit": "1024", "name": "View Channel"}, {"bit": "2048", "name": "Send Messages"}, {"bit": "16384", "name": "Embed Links"}, {"bit": "65536", "name": "Read Message History"}, {"bit": "64", "name": "Add Reactions"}]}]'::jsonb,
   '{"command": "/sosial", "runtime_key": "counting"}'::jsonb),
  ('SOCIAL_STREAK', 'social', 'Streak Harian', '🔥',
   'Tulis kata-kata hari ini (minimal 5 kata) setiap hari untuk menjaga streak.',
   51, false,
   '[{"key": "activity_channel", "label": "Channel fitur", "required": true, "channel_types": [0], "unique_scope": "social", "empty_label": "Belum dipilih", "help": "Sebaiknya channel khusus, terpisah dari obrolan utama. Satu channel hanya untuk satu fitur sosial.", "permissions": [{"bit": "1024", "name": "View Channel"}, {"bit": "2048", "name": "Send Messages"}, {"bit": "16384", "name": "Embed Links"}, {"bit": "65536", "name": "Read Message History"}, {"bit": "64", "name": "Add Reactions"}]}]'::jsonb,
   '{"command": "/sosial", "runtime_key": "streak_harian"}'::jsonb)
on conflict (bot_slug, feature_key) do nothing;
