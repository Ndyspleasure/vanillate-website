-- ════════════════════════════════════════════════════════════════════════════
--  Stub minimal lingkungan Supabase untuk menguji SQL di Postgres biasa.
--  HANYA untuk tes lokal/CI (scripts/test-guild-dashboard-sql.sh) — jangan
--  pernah dijalankan di project Supabase sungguhan.
--
--  Meniru: peran anon/authenticated/service_role, skema auth (users,
--  identities, uid(), jwt()), hak default Supabase (EXECUTE fungsi otomatis
--  untuk anon/authenticated — supaya revoke di skema ikut teruji), dan tabel
--  bot_guilds dari supabase/schema.sql.
-- ════════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

create table if not exists auth.users (
  id    uuid primary key default gen_random_uuid(),
  email text
);

create table if not exists auth.identities (
  id              uuid primary key default gen_random_uuid(),
  provider_id     text not null,
  user_id         uuid not null references auth.users (id) on delete cascade,
  identity_data   jsonb not null default '{}'::jsonb,
  provider        text not null,
  last_sign_in_at timestamptz,
  created_at      timestamptz default now(),
  unique (provider_id, provider)
);

create or replace function auth.jwt() returns jsonb
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
$$;

create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid;
$$;

grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

-- Salinan bot_guilds (supabase/schema.sql §3c).
create table if not exists public.bot_guilds (
  id           bigint generated always as identity primary key,
  bot_slug     text not null default 'sambung-kata',
  guild_id     text not null,
  name         text,
  member_count integer,
  owner_id     text,
  joined_at    timestamptz,
  last_seen_at timestamptz not null default now(),
  is_active    boolean not null default true,
  meta         jsonb,
  unique (bot_slug, guild_id)
);
alter table public.bot_guilds enable row level security;
