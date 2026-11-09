-- Prasyarat tes ringkasan statistik: salinan bentuk tabel bot_stats.
-- HANYA untuk tes lokal/CI; jangan dijalankan di project Supabase sungguhan.
create table if not exists public.bot_stats (
  id             bigint generated always as identity primary key,
  bot_slug       text not null default 'vanillateID',
  captured_at    timestamptz not null default now(),
  guild_count    integer,
  member_reach   integer,
  active_players integer,
  games_played   integer,
  commands_run   integer,
  uptime_seconds integer,
  latency_ms     integer,
  meta           jsonb
);
