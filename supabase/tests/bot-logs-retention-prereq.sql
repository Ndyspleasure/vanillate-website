-- Prasyarat tes retensi log — salinan tabel bot_logs dari supabase/schema.sql.
-- HANYA untuk tes lokal/CI; jangan dijalankan di project Supabase sungguhan.
create table if not exists public.bot_logs (
  id         bigint generated always as identity primary key,
  bot_slug   text not null default 'sambung-kata',
  level      text not null default 'info'
               check (level in ('debug', 'info', 'warn', 'error')),
  event      text not null,
  message    text,
  guild_id   text,
  guild_name text,
  actor_id   text,
  meta       jsonb,
  created_at timestamptz not null default now()
);
