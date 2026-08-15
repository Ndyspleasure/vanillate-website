-- ═══════════════════════════════════════════════════════════════════════════
--  Vanillate Admin — Skema Database Supabase
--  Jalankan seluruh isi file ini di Supabase Dashboard → SQL Editor → New query.
--  Aman dijalankan ulang (idempoten).
-- ═══════════════════════════════════════════════════════════════════════════
--
--  MODEL KEAMANAN
--  --------------
--  Website vanillate.id adalah situs STATIS di GitHub Pages, jadi tidak ada
--  server milik kita yang bisa memeriksa siapa yang sedang mengakses. Karena
--  itu seluruh penjagaan dipindahkan ke database ini lewat Row Level Security.
--
--    * Browser hanya memegang `anon key` (memang publik).
--    * Tanpa JWT admin yang valid, SEMUA tabel di bawah mengembalikan 0 baris.
--    * Bot menulis data memakai `service_role key` yang mem-bypass RLS.
--      Kunci itu HANYA boleh ada di server bot — tidak pernah di repo website.
--
--  Artinya: halaman /admin boleh saja diunduh siapa pun, tapi tetap kosong
--  selama tidak ada yang berhasil login.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- 1. TABEL ADMIN
-- ───────────────────────────────────────────────────────────────────────────
-- Menautkan akun Supabase Auth ke username + peran. Sebuah akun auth yang
-- tidak punya baris di sini TIDAK dianggap admin dan tidak bisa melihat apa pun.

create table if not exists public.admin_users (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      text not null unique,
  display_name  text,
  role          text not null default 'viewer'
                  check (role in ('owner', 'admin', 'viewer')),
  last_login_at timestamptz,
  created_at    timestamptz not null default now()
);

comment on table public.admin_users is
  'Daftar admin website. Peran: owner (penuh), admin (baca + edit konten), viewer (baca saja).';


-- ───────────────────────────────────────────────────────────────────────────
-- 2. FUNGSI BANTU
-- ───────────────────────────────────────────────────────────────────────────

-- Apakah pemanggil saat ini seorang admin?
-- SECURITY DEFINER supaya bisa membaca admin_users tanpa terjerat RLS-nya
-- sendiri (kalau tidak, policy akan memanggil dirinya sendiri = rekursi).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users where id = auth.uid()
  );
$$;

-- Apakah pemanggil boleh MENGUBAH data (bukan sekadar melihat)?
create or replace function public.is_admin_editor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users
    where id = auth.uid() and role in ('owner', 'admin')
  );
$$;

-- Apakah pemanggil seorang owner?
--
-- Harus berupa fungsi SECURITY DEFINER, BUKAN subquery yang ditulis langsung di
-- dalam policy admin_users. Policy pada sebuah tabel yang menanyai tabel itu
-- sendiri membuat PostgreSQL menolaknya sebagai rekursi tak berujung
-- (error 42P17), sehingga pembacaan profil admin gagal dan login ikut ditolak.
create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users
    where id = auth.uid() and role = 'owner'
  );
$$;

-- Menukar username menjadi email supaya admin bisa login pakai username.
-- Supabase Auth hanya mengenal email, jadi halaman login memanggil fungsi ini
-- lebih dulu. Fungsi ini hanya mengembalikan email — tidak ada data lain — dan
-- password tetap wajib diverifikasi oleh Supabase Auth setelahnya.
create or replace function public.resolve_admin_login(p_username text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select u.email
  from public.admin_users a
  join auth.users u on u.id = a.id
  where lower(a.username) = lower(trim(p_username))
  limit 1;
$$;

-- Fungsi resolve boleh dipanggil sebelum login (memang harus).
grant execute on function public.resolve_admin_login(text) to anon, authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_admin_editor() to authenticated;
grant execute on function public.is_owner() to authenticated;


-- ───────────────────────────────────────────────────────────────────────────
-- 3. TABEL DATA BOT
-- ───────────────────────────────────────────────────────────────────────────
-- Semua tabel ini DIISI OLEH BOT memakai service_role key, bukan oleh website.
-- Website hanya membaca. Lihat docs/ADMIN-CMS.md untuk kontrak datanya.

-- 3a. Log aktivitas bot
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

create index if not exists bot_logs_created_at_idx on public.bot_logs (created_at desc);
create index if not exists bot_logs_level_idx      on public.bot_logs (level, created_at desc);
create index if not exists bot_logs_bot_idx        on public.bot_logs (bot_slug, created_at desc);

-- 3b. Snapshot statistik (satu baris per pengambilan, mis. tiap 5 menit)
create table if not exists public.bot_stats (
  id             bigint generated always as identity primary key,
  bot_slug       text not null default 'sambung-kata',
  captured_at    timestamptz not null default now(),
  guild_count    integer,
  member_reach   integer,
  active_players integer,
  games_played   integer,
  commands_run   integer,
  uptime_seconds bigint,
  latency_ms     integer,
  meta           jsonb
);

create index if not exists bot_stats_captured_idx on public.bot_stats (bot_slug, captured_at desc);

-- 3c. Daftar server (guild) tempat bot berada
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

create index if not exists bot_guilds_active_idx on public.bot_guilds (bot_slug, is_active, member_count desc);

-- 3d. Daftar pemain
--     CATATAN PRIVASI: simpan seminimal mungkin. Discord ID + nama tampilan
--     sudah cukup untuk keperluan moderasi. Jangan menaruh email, IP, atau isi
--     percakapan di sini — lihat kebijakan privasi di /privacy.
create table if not exists public.bot_players (
  id           bigint generated always as identity primary key,
  bot_slug     text not null default 'sambung-kata',
  player_id    text not null,
  display_name text,
  level        integer,
  games_played integer,
  wins         integer,
  last_seen_at timestamptz,
  is_banned    boolean not null default false,
  meta         jsonb,
  unique (bot_slug, player_id)
);

create index if not exists bot_players_seen_idx  on public.bot_players (bot_slug, last_seen_at desc);
create index if not exists bot_players_games_idx on public.bot_players (bot_slug, games_played desc);


-- ───────────────────────────────────────────────────────────────────────────
-- 4. KONTEN WEBSITE YANG BISA DIEDIT DARI DASHBOARD
-- ───────────────────────────────────────────────────────────────────────────
-- Konten website tersimpan sebagai file .ts di repo (sumber kebenaran).
-- Tabel ini menampung bagian yang boleh diubah tanpa ngoding — mis. pengumuman
-- atau banner. GitHub Actions menariknya lalu me-rebuild situs, mengikuti pola
-- auto-sync yang sudah ada. Lihat docs/ADMIN-CMS.md bagian 6.

create table if not exists public.site_content (
  key         text primary key,
  label       text not null,
  value       text,
  kind        text not null default 'text' check (kind in ('text', 'markdown', 'url', 'boolean')),
  help        text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.admin_users(id) on delete set null
);

-- Isi awal: pengumuman sederhana di beranda.
insert into public.site_content (key, label, value, kind, help) values
  ('announcement_enabled', 'Tampilkan pengumuman', 'false', 'boolean',
   'Aktifkan untuk menampilkan banner pengumuman di seluruh halaman.'),
  ('announcement_text',    'Isi pengumuman',       '',      'text',
   'Satu kalimat singkat, mis. "Maintenance terjadwal Sabtu 20.00 WIB".'),
  ('announcement_url',     'Tautan pengumuman',    '',      'url',
   'Opsional. Bila diisi, banner bisa diklik.')
on conflict (key) do nothing;


-- ───────────────────────────────────────────────────────────────────────────
-- 5. ROW LEVEL SECURITY
-- ───────────────────────────────────────────────────────────────────────────
-- Inti dari seluruh model keamanan. Setelah blok ini, tidak ada satu pun baris
-- yang bisa dibaca browser tanpa JWT admin yang sah.

alter table public.admin_users  enable row level security;
alter table public.bot_logs     enable row level security;
alter table public.bot_stats    enable row level security;
alter table public.bot_guilds   enable row level security;
alter table public.bot_players  enable row level security;
alter table public.site_content enable row level security;

-- admin_users: tiap admin hanya melihat barisnya sendiri; owner melihat semua.
drop policy if exists "admin baca profil sendiri" on public.admin_users;
create policy "admin baca profil sendiri" on public.admin_users
  for select to authenticated
  using (id = auth.uid() or public.is_owner());

drop policy if exists "admin update profil sendiri" on public.admin_users;
create policy "admin update profil sendiri" on public.admin_users
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Data bot: baca saja, khusus admin.
drop policy if exists "admin baca logs" on public.bot_logs;
create policy "admin baca logs" on public.bot_logs
  for select to authenticated using (public.is_admin());

drop policy if exists "admin baca stats" on public.bot_stats;
create policy "admin baca stats" on public.bot_stats
  for select to authenticated using (public.is_admin());

drop policy if exists "admin baca guilds" on public.bot_guilds;
create policy "admin baca guilds" on public.bot_guilds
  for select to authenticated using (public.is_admin());

drop policy if exists "admin baca players" on public.bot_players;
create policy "admin baca players" on public.bot_players
  for select to authenticated using (public.is_admin());

-- Konten situs: admin boleh baca, editor boleh ubah.
drop policy if exists "admin baca konten" on public.site_content;
create policy "admin baca konten" on public.site_content
  for select to authenticated using (public.is_admin());

drop policy if exists "editor ubah konten" on public.site_content;
create policy "editor ubah konten" on public.site_content
  for update to authenticated
  using (public.is_admin_editor())
  with check (public.is_admin_editor());

-- Tidak ada policy INSERT/DELETE untuk peran `authenticated` di tabel data bot.
-- Itu disengaja: hanya bot (service_role) yang boleh menulis.


-- ───────────────────────────────────────────────────────────────────────────
-- 6. MEMBUAT ADMIN PERTAMA
-- ───────────────────────────────────────────────────────────────────────────
--  Langkah 1 — buat user di Dashboard:
--     Authentication → Users → "Add user" → Create new user
--     Email    : owner@vanillate.id   (boleh email apa saja, tidak harus nyata)
--     Password : (pilih yang kuat)
--     Centang "Auto Confirm User" supaya bisa langsung dipakai.
--
--  Langkah 2 — jalankan query di bawah, ganti emailnya bila berbeda:
--
--     insert into public.admin_users (id, username, display_name, role)
--     select id, 'andi', 'Andi Kurniawan', 'owner'
--     from auth.users where email = 'owner@vanillate.id'
--     on conflict (id) do update
--       set username = excluded.username,
--           display_name = excluded.display_name,
--           role = excluded.role;
--
--  Setelah itu login di /admin memakai username `andi` + password tadi.
-- ═══════════════════════════════════════════════════════════════════════════
