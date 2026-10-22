-- ════════════════════════════════════════════════════════════════════════════
--  📣 Share Server — Sosial Hub Sambung Kata (broadcast promosi antar server)
--
--  Aditif & idempoten (aman dijalankan ulang; tanpa DROP data). Butuh
--  supabase/guild-dashboard-schema.sql (guild_dashboard_assert_access,
--  guild_dashboard_bot_online, guild_dashboard_fail). Rollback:
--  supabase/share-server-rollback.sql. Tes: supabase/tests/share-server.test.sql.
--
--  Bot = satu-satunya pemilik aturan & data (SQLite). Supabase hanya jembatan:
--    share_topgg_votes  kotak masuk webhook Top.gg (ditulis Edge Function
--                       topgg-webhook dengan service_role; dibaca bot)
--    share_guild_state  status + riwayat per server, DITERBITKAN bot
--    share_requests     aksi admin dari vanillate.id/dashboard → dijalankan bot
--                       setelah izin user diperiksa ulang di Discord
--  Semua tabel RLS tanpa policy: browser hanya lewat RPC security definer.
--  Acuan: docs/DASHBOARD-SERVER.md › Share Server, repo bot docs/share-server.md.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. Kotak masuk vote Top.gg ──────────────────────────────────────────────
create table if not exists public.share_topgg_votes (
  id              bigserial primary key,
  event_key       text not null unique,
  discord_user_id text not null check (discord_user_id ~ '^[0-9]{15,22}$'),
  voted_at        timestamptz not null default now(),
  weight          integer,
  query           jsonb,
  source          text not null default 'webhook',
  received_at     timestamptz not null default now(),
  processed_at    timestamptz,
  result          text
);
create index if not exists share_topgg_votes_pending_idx
  on public.share_topgg_votes (id) where processed_at is null;

-- ─── 2. Status per server (diterbitkan bot) ──────────────────────────────────
create table if not exists public.share_guild_state (
  bot_slug   text not null default 'sambung-kata',
  guild_id   text not null check (guild_id ~ '^[0-9]{15,22}$'),
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (bot_slug, guild_id)
);

-- ─── 3. Permintaan dari dashboard ────────────────────────────────────────────
create table if not exists public.share_requests (
  id              bigserial primary key,
  bot_slug        text not null default 'sambung-kata',
  guild_id        text not null check (guild_id ~ '^[0-9]{15,22}$'),
  user_id         uuid not null references auth.users (id) on delete cascade,
  discord_user_id text not null,
  actor_name      text,
  type            text not null check (type in ('save', 'activate', 'deactivate', 'test', 'recheck_invite', 'ack')),
  payload         jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  status          text not null default 'pending' check (status in ('pending', 'running', 'done', 'error')),
  result          jsonb,
  error           text,
  created_at      timestamptz not null default now(),
  started_at      timestamptz,
  finished_at     timestamptz
);
create index if not exists share_requests_queue_idx
  on public.share_requests (bot_slug, status, id);
create index if not exists share_requests_guild_idx
  on public.share_requests (bot_slug, guild_id, id desc);

alter table public.share_topgg_votes enable row level security;
alter table public.share_guild_state enable row level security;
alter table public.share_requests    enable row level security;

-- ─── 4. RPC website (authenticated) ──────────────────────────────────────────

-- Status Share Server + 10 permintaan terakhir server itu.
create or replace function public.share_dashboard_get(
  p_guild_id text, p_bot_slug text default 'sambung-kata'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_state public.share_guild_state;
begin
  perform public.guild_dashboard_assert_access(p_guild_id);
  select * into v_state from public.share_guild_state s
  where s.bot_slug = p_bot_slug and s.guild_id = p_guild_id;
  return jsonb_build_object(
    'state', v_state.data,
    'updated_at', v_state.updated_at,
    'bot_online', public.guild_dashboard_bot_online(p_bot_slug),
    'requests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'type', r.type, 'status', r.status, 'result', r.result, 'error', r.error,
        'created_at', r.created_at, 'finished_at', r.finished_at, 'actor_name', r.actor_name
      ) order by r.id desc)
      from (select * from public.share_requests q
            where q.bot_slug = p_bot_slug and q.guild_id = p_guild_id
            order by q.id desc limit 10) r
    ), '[]'::jsonb)
  );
end;
$$;

-- Kirim aksi ke bot. Bot memverifikasi ulang izin user di Discord.
create or replace function public.share_request_submit(
  p_guild_id text, p_bot_slug text, p_type text, p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me  record;
  v_id  bigint;
  v_txt text;
begin
  select * into v_me from public.guild_dashboard_assert_access(p_guild_id);
  if p_type is null or p_type not in ('save', 'activate', 'deactivate', 'test', 'recheck_invite', 'ack') then
    perform public.guild_dashboard_fail('INVALID_TYPE');
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or length(p_payload::text) > 4000 then
    perform public.guild_dashboard_fail('INVALID_PAYLOAD');
  end if;
  -- Satu permintaan aktif per server; maks. 30 per user per jam (anti-spam).
  if exists (select 1 from public.share_requests r
             where r.bot_slug = p_bot_slug and r.guild_id = p_guild_id and r.status in ('pending', 'running')
               and r.created_at > now() - interval '10 minutes') then
    perform public.guild_dashboard_fail('TOO_MANY_REQUESTS');
  end if;
  if (select count(*) from public.share_requests r
      where r.user_id = auth.uid() and r.created_at > now() - interval '1 hour') >= 30 then
    perform public.guild_dashboard_fail('RATE_LIMITED');
  end if;
  v_txt := p_payload ->> 'description';
  if v_txt is not null and length(v_txt) > 500 then
    perform public.guild_dashboard_fail('INVALID_PAYLOAD');
  end if;

  insert into public.share_requests (bot_slug, guild_id, user_id, discord_user_id, actor_name, type, payload)
  values (p_bot_slug, p_guild_id, auth.uid(), v_me.discord_id, left(v_me.display_name, 100), p_type, p_payload)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

-- ─── 5. Hak eksekusi ─────────────────────────────────────────────────────────
revoke execute on function public.share_dashboard_get(text, text) from public, anon;
revoke execute on function public.share_request_submit(text, text, text, jsonb) from public, anon;
grant execute on function public.share_dashboard_get(text, text) to authenticated;
grant execute on function public.share_request_submit(text, text, text, jsonb) to authenticated;

-- Tabel: browser tidak boleh langsung (RLS tanpa policy + cabut hak tabel).
revoke all on public.share_topgg_votes from anon, authenticated;
revoke all on public.share_guild_state from anon, authenticated;
revoke all on public.share_requests from anon, authenticated;
grant all on public.share_topgg_votes, public.share_guild_state, public.share_requests to service_role;
grant usage, select on sequence public.share_topgg_votes_id_seq, public.share_requests_id_seq to service_role;

-- ─── 6. Retensi: kotak masuk vote yang sudah diproses > 30 hari ─────────────
create or replace function public.share_prune()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  delete from public.share_topgg_votes where processed_at < now() - interval '30 days';
  get diagnostics n = row_count;
  delete from public.share_requests where created_at < now() - interval '30 days';
  return n;
end;
$$;
revoke execute on function public.share_prune() from public, anon, authenticated;
grant execute on function public.share_prune() to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if not exists (select 1 from cron.job where jobname = 'share-server-prune') then
      perform cron.schedule('share-server-prune', '23 19 * * *', 'select public.share_prune()');
    end if;
  end if;
end $$;
