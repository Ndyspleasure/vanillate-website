-- ════════════════════════════════════════════════════════════════════════════
--  Live Chat Web ↔ Discord — Skema Supabase
--
--  Dipakai bersama oleh:
--    • Website (vanillate-website)  — anon key + Google OAuth (tunduk RLS).
--    • Bot (vanillate-workspace)    — service_role key (bypass RLS).
--
--  Jalankan sekali di SQL Editor Supabase (atau lewat migration).
--  Aman diulang (idempoten): memakai IF NOT EXISTS / CREATE OR REPLACE.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Tabel: tiket ────────────────────────────────────────────────────────────
create table if not exists public.live_chat_tickets (
  id                 uuid primary key default gen_random_uuid(),
  customer_email     text not null,
  customer_name      text not null,
  subject            text,
  discord_channel_id text,
  status             text not null default 'open' check (status in ('open', 'closed')),
  created_at         timestamptz not null default now(),
  closed_at          timestamptz,
  last_message_at    timestamptz default now(),
  -- Throttle email "tiket dibalas" (diperbarui oleh Edge Function live-chat-email).
  last_reply_email_at timestamptz,
  metadata           jsonb
);

-- Kolom throttle email untuk instalasi lama (aman diulang).
alter table public.live_chat_tickets
  add column if not exists last_reply_email_at timestamptz;

create index if not exists live_chat_tickets_email_idx   on public.live_chat_tickets (customer_email);
create index if not exists live_chat_tickets_status_idx   on public.live_chat_tickets (status);
create index if not exists live_chat_tickets_channel_idx  on public.live_chat_tickets (discord_channel_id);

-- ─── Tabel: pesan ────────────────────────────────────────────────────────────
create table if not exists public.live_chat_messages (
  id                 uuid primary key default gen_random_uuid(),
  ticket_id          uuid not null references public.live_chat_tickets (id) on delete cascade,
  sender_type        text not null check (sender_type in ('customer', 'admin', 'system')),
  sender_id          text,
  sender_name        text not null,
  content            text not null,
  is_internal        boolean not null default false,
  discord_message_id text,
  created_at         timestamptz not null default now()
);

create index if not exists live_chat_messages_ticket_idx on public.live_chat_messages (ticket_id, created_at);
create index if not exists live_chat_messages_relay_idx  on public.live_chat_messages (sender_type, discord_message_id);

-- ─── Realtime ────────────────────────────────────────────────────────────────
-- Website subscribe ke INSERT pesan (difilter per ticket_id). RLS tetap berlaku
-- pada realtime, jadi customer hanya menerima pesan tiketnya & yang non-internal.
alter publication supabase_realtime add table public.live_chat_messages;

-- ════════════════════════════════════════════════════════════════════════════
--  RLS — customer (authenticated via Google) hanya boleh mengakses tiketnya
--  sendiri. Bot memakai service_role → otomatis bypass semua policy di bawah.
-- ════════════════════════════════════════════════════════════════════════════
alter table public.live_chat_tickets  enable row level security;
alter table public.live_chat_messages enable row level security;

-- Tiket: customer melihat & membuat tiket miliknya (dicocokkan lewat email JWT).
drop policy if exists lct_select_own on public.live_chat_tickets;
create policy lct_select_own on public.live_chat_tickets
  for select to authenticated
  using (customer_email = auth.jwt() ->> 'email');

drop policy if exists lct_insert_own on public.live_chat_tickets;
create policy lct_insert_own on public.live_chat_tickets
  for insert to authenticated
  with check (customer_email = auth.jwt() ->> 'email' and status = 'open');

-- Pesan: customer membaca pesan tiketnya yang BUKAN catatan internal.
drop policy if exists lcm_select_own on public.live_chat_messages;
create policy lcm_select_own on public.live_chat_messages
  for select to authenticated
  using (
    is_internal = false
    and exists (
      select 1 from public.live_chat_tickets t
      where t.id = live_chat_messages.ticket_id
        and t.customer_email = auth.jwt() ->> 'email'
    )
  );

-- Pesan: customer hanya boleh mengirim pesan (sender_type='customer', non-internal)
-- ke tiketnya sendiri yang masih 'open'.
drop policy if exists lcm_insert_own on public.live_chat_messages;
create policy lcm_insert_own on public.live_chat_messages
  for insert to authenticated
  with check (
    sender_type = 'customer'
    and is_internal = false
    and exists (
      select 1 from public.live_chat_tickets t
      where t.id = live_chat_messages.ticket_id
        and t.customer_email = auth.jwt() ->> 'email'
        and t.status = 'open'
    )
  );
