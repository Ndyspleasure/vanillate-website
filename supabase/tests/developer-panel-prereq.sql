-- ════════════════════════════════════════════════════════════════════════════
--  Prasyarat tes Panel Developer — salinan objek supabase/schema.sql yang
--  dibutuhkan supabase/developer-panel-schema.sql (admin_users + fungsi peran,
--  bot_commands, bot_settings, bot_setting_categories) dan stub skema storage.
--  HANYA untuk tes lokal/CI; jangan dijalankan di project Supabase sungguhan.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.admin_users (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      text not null unique,
  display_name  text,
  role          text not null default 'viewer' check (role in ('owner', 'admin', 'viewer')),
  last_login_at timestamptz,
  created_at    timestamptz not null default now()
);
alter table public.admin_users enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admin_users where id = auth.uid());
$$;
create or replace function public.is_admin_editor() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admin_users where id = auth.uid() and role in ('owner', 'admin'));
$$;
create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admin_users where id = auth.uid() and role = 'owner');
$$;

create table if not exists public.bot_commands (
  id           bigint generated always as identity primary key,
  bot_slug     text not null default 'sambung-kata',
  type         text not null,
  payload      jsonb not null default '{}'::jsonb,
  status       text not null default 'pending' check (status in ('pending', 'processing', 'done', 'error')),
  result       jsonb,
  error        text,
  created_by   uuid references public.admin_users(id) on delete set null,
  created_at   timestamptz not null default now(),
  processed_at timestamptz
);
alter table public.bot_commands enable row level security;
drop policy if exists "admin baca bot_commands" on public.bot_commands;
create policy "admin baca bot_commands" on public.bot_commands
  for select to authenticated using (public.is_admin());
drop policy if exists "editor tambah bot_commands" on public.bot_commands;
create policy "editor tambah bot_commands" on public.bot_commands
  for insert to authenticated
  with check (public.is_admin_editor() and created_by = auth.uid() and status = 'pending');

create table if not exists public.bot_settings (
  key         text primary key,
  bot_slug    text not null default 'sambung-kata',
  label       text not null,
  value       text,
  kind        text not null default 'text' check (kind in ('text', 'markdown', 'url', 'boolean', 'number')),
  category    text not null default 'umum',
  help        text,
  min_value   numeric,
  max_value   numeric,
  sort        integer not null default 100,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.admin_users(id) on delete set null
);
alter table public.bot_settings enable row level security;

create table if not exists public.bot_setting_categories (
  key         text primary key,
  label       text not null,
  description text,
  icon        text,
  sort        integer not null default 100
);

-- Stub storage (Supabase menyediakan skema ini; di Postgres biasa dibuat minimal).
create schema if not exists storage;
grant usage on schema storage to anon, authenticated, service_role;
create table if not exists storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean default false,
  file_size_limit    bigint,
  allowed_mime_types text[]
);
create table if not exists storage.objects (
  id        uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name      text
);
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;
