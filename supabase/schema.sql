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


-- ───────────────────────────────────────────────────────────────────────────
-- 7. CONTROL PANEL BOT — mengatur bot dari website (arah balik)
-- ───────────────────────────────────────────────────────────────────────────
-- Sampai di sini, arah data hanya BOT → website (bot menulis, panel membaca).
-- Dua tabel berikut menambahkan arah balik WEBSITE → BOT, mengubah panel /admin
-- menjadi control panel: admin mengatur bot tanpa menyentuh source code.
--
--   * bot_settings  → state deklaratif (maintenance, pengumuman, toggle mode,
--                     tunable angka, feature flag). Bot MENARIKNYA berkala
--                     (live polling) lalu menerapkannya.
--   * bot_commands  → antrean perintah sekali-jalan (aksi seperti Developer
--                     Dashboard: kelola pemain/boost/promo/broadcast). Website
--                     meng-INSERT perintah `pending`; bot mengeksekusi lalu
--                     menulis balik statusnya.
--
-- Model keamanannya sama: browser hanya pegang anon key, RLS yang menjaga.
-- Bot menulis balik status memakai service_role (mem-bypass RLS) — kunci itu
-- HANYA di server bot. Versi/changelog TIDAK diatur di sini: SSoT-nya tetap
-- version.json + CHANGELOG.json di repo bot.

-- 7a. Settings bot yang bisa diubah dari panel
create table if not exists public.bot_settings (
  key         text primary key,
  bot_slug    text not null default 'sambung-kata',
  label       text not null,
  value       text,
  kind        text not null default 'text'
                check (kind in ('text', 'markdown', 'url', 'boolean', 'number')),
  category    text not null default 'umum',
  help        text,
  min_value   numeric,   -- hanya untuk kind = 'number' (batas bawah, inklusif)
  max_value   numeric,   -- hanya untuk kind = 'number' (batas atas, inklusif)
  sort        integer not null default 100,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.admin_users(id) on delete set null
);

comment on table public.bot_settings is
  'Setting bot yang diatur dari panel /admin. Bot menariknya live (service_role) lalu menerapkannya. Bot meng-clamp/validasi setiap nilai — jangan percaya input mentah.';

-- Nilai numerik SELALU divalidasi ulang & di-clamp di sisi bot. min_value/
-- max_value di sini hanya untuk bantuan input di panel, bukan penjaga sebenarnya.
insert into public.bot_settings (key, label, value, kind, category, help, min_value, max_value, sort) values
  -- Maintenance
  ('maintenance_mode',    'Maintenance mode',       'false', 'boolean', 'maintenance',
   'Saat aktif, bot menolak command/permainan baru (jalur support tetap terbuka).', null, null, 10),
  ('maintenance_message', 'Pesan maintenance',      '🔧 Bot sedang dalam maintenance. Mohon tunggu sebentar.', 'text', 'maintenance',
   'Ditampilkan ke pemain saat maintenance aktif.', null, null, 20),

  -- Pengumuman di dalam Discord (Lobby) — BUKAN banner website (itu di site_content).
  ('discord_announcement_enabled', 'Tampilkan pengumuman di Discord', 'false', 'boolean', 'pengumuman',
   'Menampilkan pengumuman di Lobby/embed bot.', null, null, 10),
  ('discord_announcement_text',    'Isi pengumuman Discord',          '',      'text',    'pengumuman',
   'Satu-dua kalimat singkat untuk pemain.', null, null, 20),

  -- Toggle mode permainan (Sambung Kata + game sampingan)
  ('mode_pvp_enabled',      'Mode PvP',              'true', 'boolean', 'mode', 'Player vs Player (2–10 pemain).',        null, null, 10),
  ('mode_pvb_enabled',      'Mode PvB',              'true', 'boolean', 'mode', 'Player vs Bot (Battle Skill & Klasik).', null, null, 20),
  ('mode_server_enabled',   'Mode Player vs Server', 'true', 'boolean', 'mode', 'Pertandingan lintas server.',            null, null, 30),
  ('mode_dungeon_enabled',  'Mode Dungeon',          'true', 'boolean', 'mode', 'Dungeon Mode (butuh Golden Key).',       null, null, 40),
  ('game_werewolf_enabled', 'Game Werewolf',         'true', 'boolean', 'mode', 'Game sampingan Werewolf.',               null, null, 50),
  ('game_pengacara_enabled','Game Pengacara',        'true', 'boolean', 'mode', 'Game sampingan Pengacara.',              null, null, 60),

  -- Tunable numerik gameplay (di-clamp di bot)
  ('tunable_turn_timeout',        'Waktu per giliran (detik)',       '30', 'number', 'tunable',
   'Batas waktu menjawab per giliran mode klasik/PvP.', 10, 120, 10),
  ('tunable_min_players',         'Minimal pemain PvP',              '2',  'number', 'tunable',
   'Jumlah pemain minimum agar match bisa dimulai.', 2, 10, 20),
  ('tunable_max_players',         'Maksimal pemain PvP',             '10', 'number', 'tunable',
   'Jumlah pemain maksimum dalam satu match.', 2, 10, 30),
  ('tunable_battle_turn_timeout', 'Waktu per giliran PvB (detik)',   '30', 'number', 'tunable',
   'Batas waktu menjawab per giliran mode Player vs Bot.', 10, 120, 40),

  -- Feature flag sistem
  ('feature_shop_enabled',   'Shop aktif',            'true', 'boolean', 'fitur', 'Menyalakan/mematikan /shop.',                 null, null, 10),
  ('feature_quest_enabled',  'Quest aktif',           'true', 'boolean', 'fitur', 'Menyalakan/mematikan sistem quest.',          null, null, 20),
  ('feature_events_enabled', 'Event in-game aktif',   'true', 'boolean', 'fitur', 'Event acak di dalam permainan.',              null, null, 30)
on conflict (key) do nothing;

create index if not exists bot_settings_category_idx on public.bot_settings (bot_slug, category, sort);

-- 7b. Antrean perintah (aksi imperatif sekali-jalan)
create table if not exists public.bot_commands (
  id           bigint generated always as identity primary key,
  bot_slug     text not null default 'sambung-kata',
  type         text not null,                 -- mis. 'player.setCoin', 'promo.create'
  payload      jsonb not null default '{}'::jsonb,
  status       text not null default 'pending'
                 check (status in ('pending', 'processing', 'done', 'error')),
  result       jsonb,
  error        text,
  created_by   uuid references public.admin_users(id) on delete set null,
  created_at   timestamptz not null default now(),
  processed_at timestamptz
);

comment on table public.bot_commands is
  'Antrean perintah dari panel /admin ke bot. Admin meng-INSERT status pending; bot (service_role) mengeksekusi lalu menulis status/result. Bot memvalidasi setiap payload.';

create index if not exists bot_commands_status_idx on public.bot_commands (bot_slug, status, created_at);
create index if not exists bot_commands_recent_idx on public.bot_commands (bot_slug, created_at desc);

-- 7c. RLS untuk kedua tabel
alter table public.bot_settings enable row level security;
alter table public.bot_commands enable row level security;

-- Settings: admin boleh baca, editor boleh ubah. (Bot pakai service_role → bypass.)
drop policy if exists "admin baca bot_settings" on public.bot_settings;
create policy "admin baca bot_settings" on public.bot_settings
  for select to authenticated using (public.is_admin());

drop policy if exists "editor ubah bot_settings" on public.bot_settings;
create policy "editor ubah bot_settings" on public.bot_settings
  for update to authenticated
  using (public.is_admin_editor())
  with check (public.is_admin_editor());

-- Commands: admin boleh baca riwayat; editor boleh menaruh perintah baru.
-- Status/result hanya ditulis bot (service_role) → tidak ada policy UPDATE/DELETE
-- untuk `authenticated`. INSERT dipaksa `pending` + atas nama diri sendiri.
drop policy if exists "admin baca bot_commands" on public.bot_commands;
create policy "admin baca bot_commands" on public.bot_commands
  for select to authenticated using (public.is_admin());

drop policy if exists "editor tambah bot_commands" on public.bot_commands;
create policy "editor tambah bot_commands" on public.bot_commands
  for insert to authenticated
  with check (
    public.is_admin_editor()
    and created_by = auth.uid()
    and status = 'pending'
  );
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- 8. CONTROL PANEL BOT — peningkatan (audit, penjadwalan, inspeksi live)
-- ───────────────────────────────────────────────────────────────────────────

-- 8a. Setting tambahan: jadwal maintenance & kadaluwarsa pengumuman.
--     Bot mengevaluasinya tiap poll: maintenance efektif = manual OR jendela
--     terjadwal aktif; pengumuman otomatis mati setelah waktu kadaluwarsa.
insert into public.bot_settings (key, label, value, kind, category, help, sort) values
  ('maintenance_start_at', 'Jadwal maintenance — mulai',   '', 'text', 'maintenance',
   'Opsional. ISO/waktu lokal, mis. 2026-08-20T20:00. Kosong = tanpa jadwal.', 30),
  ('maintenance_end_at',   'Jadwal maintenance — selesai', '', 'text', 'maintenance',
   'Opsional. Setelah waktu ini, maintenance mati otomatis.', 40),
  ('discord_announcement_expires_at', 'Pengumuman kadaluwarsa pada', '', 'text', 'pengumuman',
   'Opsional. Setelah waktu ini, pengumuman berhenti tampil otomatis.', 30)
on conflict (key) do nothing;

-- 8b. Audit trail perubahan setting — siapa mengubah apa, kapan.
create table if not exists public.bot_settings_audit (
  id         bigint generated always as identity primary key,
  key        text not null,
  old_value  text,
  new_value  text,
  changed_by uuid references public.admin_users(id) on delete set null,
  changed_at timestamptz not null default now()
);
create index if not exists bot_settings_audit_idx on public.bot_settings_audit (changed_at desc);

-- Trigger: catat tiap UPDATE yang benar-benar mengubah value.
create or replace function public.log_bot_settings_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.value is distinct from old.value then
    insert into public.bot_settings_audit (key, old_value, new_value, changed_by)
    values (new.key, old.value, new.value, new.updated_by);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bot_settings_audit on public.bot_settings;
create trigger trg_bot_settings_audit
  after update on public.bot_settings
  for each row execute function public.log_bot_settings_change();

-- 8c. Snapshot game aktif (live monitor). Di-upsert bot; game selesai dihapus.
create table if not exists public.bot_games (
  id           bigint generated always as identity primary key,
  bot_slug     text not null default 'sambung-kata',
  game_id      text not null,
  mode         text,
  guild_name   text,
  channel_id   text,
  player_count integer,
  status       text,
  started_at   timestamptz,
  updated_at   timestamptz not null default now(),
  meta         jsonb,
  unique (bot_slug, game_id)
);
create index if not exists bot_games_idx on public.bot_games (bot_slug, updated_at desc);

-- 8d. Cermin daftar promo (baca cepat untuk halaman Promo).
create table if not exists public.bot_promos (
  id            bigint generated always as identity primary key,
  bot_slug      text not null default 'sambung-kata',
  code          text not null,
  title         text,
  reward        text,
  status        text,
  claimed_count integer,
  max_claims    integer,
  expired_at    timestamptz,
  created_at    timestamptz,
  updated_at    timestamptz not null default now(),
  meta          jsonb,
  unique (bot_slug, code)
);
create index if not exists bot_promos_idx on public.bot_promos (bot_slug, updated_at desc);

-- 8e. Antrean kata untuk moderasi (Word Collection). Di-upsert bot.
create table if not exists public.bot_word_queue (
  id         bigint generated always as identity primary key,
  bot_slug   text not null default 'sambung-kata',
  word       text not null,
  hits       integer,
  first_seen timestamptz,
  updated_at timestamptz not null default now(),
  meta       jsonb,
  unique (bot_slug, word)
);
create index if not exists bot_word_queue_idx on public.bot_word_queue (bot_slug, hits desc);

-- 8f. RLS: semua tabel inspeksi ini baca-saja untuk admin; ditulis bot (service_role).
alter table public.bot_settings_audit enable row level security;
alter table public.bot_games         enable row level security;
alter table public.bot_promos        enable row level security;
alter table public.bot_word_queue    enable row level security;

drop policy if exists "admin baca audit" on public.bot_settings_audit;
create policy "admin baca audit" on public.bot_settings_audit
  for select to authenticated using (public.is_admin());

drop policy if exists "admin baca bot_games" on public.bot_games;
create policy "admin baca bot_games" on public.bot_games
  for select to authenticated using (public.is_admin());

drop policy if exists "admin baca bot_promos" on public.bot_promos;
create policy "admin baca bot_promos" on public.bot_promos
  for select to authenticated using (public.is_admin());

drop policy if exists "admin baca word_queue" on public.bot_word_queue;
create policy "admin baca word_queue" on public.bot_word_queue
  for select to authenticated using (public.is_admin());
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- 9. KATEGORI SETTING — hierarki Kategori → Item yang data-driven
-- ───────────────────────────────────────────────────────────────────────────
-- Sebelumnya label/urutan/ikon kategori di-hardcode di frontend, sehingga
-- kategori/item baru yang ditambah lewat DB tidak ikut terorganisir. Tabel ini
-- menjadikan metadata kategori sebagai DATA: panel /admin/kontrol membacanya
-- lalu merender satu section per kategori (masing-masing dengan daftar item-nya
-- sendiri). Menambah kategori baru = cukup INSERT satu baris di sini; setting
-- (bot_settings.category) yang menunjuk ke `key` otomatis mengelompok di bawahnya.
--
-- `icon` menyimpan NAMA ikon (Lucide), bukan markup — frontend memetakannya ke
-- SVG lewat registry aman (mencegah HTML sembarang dari DB). Nama tak dikenal
-- jatuh ke ikon default.

create table if not exists public.bot_setting_categories (
  key         text primary key,
  label       text not null,
  description text,
  icon        text,               -- nama ikon Lucide (mis. 'wrench'); bukan SVG mentah
  sort        integer not null default 100
);

comment on table public.bot_setting_categories is
  'Metadata kategori untuk bot_settings (hierarki Kategori → Item). Dibaca panel /admin. Bot tidak memakainya.';

insert into public.bot_setting_categories (key, label, description, icon, sort) values
  ('maintenance', 'Maintenance',        'Hentikan sementara permainan baru; jalur support tetap terbuka.', 'wrench',    10),
  ('pengumuman',  'Pengumuman Discord', 'Pesan singkat yang tampil ke pemain di dalam bot.',               'megaphone', 20),
  ('mode',        'Mode & Game',        'Nyalakan / matikan tiap mode permainan.',                          'gamepad',   30),
  ('tunable',     'Tunable Gameplay',   'Nilai numerik permainan. Bot tetap membatasi ke rentang aman.',    'sliders',   40),
  ('fitur',       'Fitur Sistem',       'Aktif / nonaktifkan subsistem bot.',                               'toggle',    50)
on conflict (key) do nothing;

alter table public.bot_setting_categories enable row level security;

drop policy if exists "admin baca kategori setting" on public.bot_setting_categories;
create policy "admin baca kategori setting" on public.bot_setting_categories
  for select to authenticated using (public.is_admin());
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- 10. PARTNERSHIP SYSTEM
-- ───────────────────────────────────────────────────────────────────────────
-- Partnership adalah LAYANAN BERBAYAR: studio menjual dua produk broadcast ke
-- partner — Broadcast via DM dan Broadcast via Lobby — dengan harga yang diatur
-- dari CMS dan tampil otomatis di halaman publik /partnership.
--
-- Pembagian peran (sama seperti bagian 7):
--   • Website (panel /admin) → membuat & mengelola campaign + katalog + konten.
--   • Bot (service_role)     → SATU-SATUNYA yang mengirim DM, lalu menulis
--                              balik progress & status per penerima.
--
-- Catatan cakupan: eksekusi otomatis tahap ini hanya `channel = 'dm'`. Kolom
-- `channel` sudah ada sejak awal supaya delivery Lobby bisa ditambah nanti
-- tanpa mengubah struktur. Produk Lobby tetap dijual & ditangani manual dulu.

-- 10a. Katalog produk + HARGA (dikelola CMS, tampil di halaman publik)
create table if not exists public.partnership_products (
  key         text primary key,                 -- 'broadcast_dm' | 'broadcast_lobby' | dst
  name        text not null,
  tagline     text,
  description text,
  channel     text not null default 'dm' check (channel in ('dm', 'lobby')),
  price       numeric(12,2) not null default 0 check (price >= 0),
  currency    text not null default 'IDR',
  price_unit  text,                              -- mis. 'per campaign'
  price_note  text,                              -- mis. 'Harga dapat menyesuaikan volume'
  features    jsonb not null default '[]'::jsonb,-- array string (bullet)
  badge       text,                              -- mis. 'Terpopuler'
  cta_label   text not null default 'Ajukan Partnership',
  -- 'whatsapp' → tombol membuka WhatsApp official dengan pesan terisi.
  -- 'url'      → tombol memakai cta_url (mis. Google Form).
  cta_mode    text not null default 'whatsapp' check (cta_mode in ('whatsapp', 'url')),
  cta_url     text,
  enabled     boolean not null default true,
  sort        integer not null default 100,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.admin_users(id) on delete set null
);

comment on table public.partnership_products is
  'Katalog produk Partnership + harga. Dikelola dari /admin/partnership/products, ditarik saat build ke halaman publik /partnership.';

insert into public.partnership_products
  (key, name, tagline, description, channel, price, price_unit, features, badge, sort) values
  ('broadcast_dm', 'Broadcast via DM',
   'Pesan langsung ke DM pemain aktif.',
   'Kami mengirim pesan promosi kamu langsung ke DM pemain yang masih aktif bermain. Cocok untuk pengumuman, promo, dan undangan komunitas.',
   'dm', 0, 'per campaign',
   '["Terkirim langsung ke DM pemain aktif","Target bisa dipilih (pemain paling aktif)","Tombol menuju link kamu","Laporan terkirim & gagal"]'::jsonb,
   'Terpopuler', 10),
  ('broadcast_lobby', 'Broadcast via Lobby',
   'Tampil di lobby permainan.',
   'Pesan kamu ditampilkan di lobby permainan sehingga terlihat oleh pemain saat mereka hendak bermain. Cocok untuk eksposur berulang.',
   'lobby', 0, 'per campaign',
   '["Tampil di lobby permainan","Terlihat berulang oleh pemain aktif","Tombol menuju link kamu"]'::jsonb,
   null, 20)
on conflict (key) do nothing;

-- 10b. Campaign (persistent — tidak hilang setelah broadcast selesai)
create table if not exists public.partnership_campaigns (
  id              bigint generated always as identity primary key,
  broadcast_id    text not null unique,          -- 'PTN-YYYYMMDD-NNNN'
  name            text not null,
  category        text not null default 'marketing',
  channel         text not null default 'dm' check (channel in ('dm', 'lobby')),
  status          text not null default 'draft'
                    check (status in ('draft','scheduled','queued','running','completed','cancelled','failed')),
  message         text not null,
  partnership_url text,                          -- snapshot URL tombol Partnership
  buttons         jsonb not null default '[]'::jsonb, -- snapshot [{label,url}]
  created_by      uuid references public.admin_users(id) on delete set null,
  target_total    integer not null default 0,
  valid_count     integer not null default 0,
  invalid_count   integer not null default 0,
  sent_count      integer not null default 0,
  success_count   integer not null default 0,
  failed_count    integer not null default 0,
  skipped_count   integer not null default 0,
  scheduled_at    timestamptz,
  started_at      timestamptz,
  completed_at    timestamptz,
  cancel_requested boolean not null default false,
  error           text,
  logs            jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists partnership_campaigns_status_idx  on public.partnership_campaigns (status, created_at);
create index if not exists partnership_campaigns_recent_idx  on public.partnership_campaigns (created_at desc);
create index if not exists partnership_campaigns_name_idx    on public.partnership_campaigns (name);

comment on table public.partnership_campaigns is
  'Campaign Partnership (persistent). Website membuat status queued; bot (service_role) mengeksekusi & menulis progress.';

-- 10c. Status pengiriman per penerima
create table if not exists public.partnership_recipients (
  id          bigint generated always as identity primary key,
  campaign_id bigint not null references public.partnership_campaigns(id) on delete cascade,
  user_id     text not null,
  status      text not null default 'pending'
                check (status in ('pending','success','failed','skipped')),
  error       text,
  sent_at     timestamptz,
  unique (campaign_id, user_id)
);

create index if not exists partnership_recipients_idx on public.partnership_recipients (campaign_id, status);

-- 10d. Custom link tambahan untuk tombol broadcast
create table if not exists public.partnership_links (
  id         bigint generated always as identity primary key,
  label      text not null,
  url        text not null,
  enabled    boolean not null default true,
  sort       integer not null default 100,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.admin_users(id) on delete set null
);

-- 10e. Setting Partnership (satu baris)
create table if not exists public.partnership_settings (
  id              smallint primary key default 1 check (id = 1),
  partnership_url text,     -- URL halaman publik untuk tombol wajib di broadcast
  apply_url       text,     -- CTA 'Become a Partner' (opsional; kosong → WhatsApp)
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.admin_users(id) on delete set null
);

insert into public.partnership_settings (id, partnership_url)
values (1, 'https://vanillate.id/partnership')
on conflict (id) do nothing;

-- 10f. Konten halaman publik (dikelola CMS, ditarik saat build)
create table if not exists public.partnership_page (
  id         smallint primary key default 1 check (id = 1),
  content    jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.admin_users(id) on delete set null
);

insert into public.partnership_page (id, content) values (1, jsonb_build_object(
  'hero', jsonb_build_object(
    'title', 'Partnership',
    'subtitle', 'Jangkau ribuan pemain aktif Discord lewat bot yang mereka mainkan setiap hari.',
    'ctaLabel', 'Become a Partner'
  ),
  'intro', jsonb_build_array(
    jsonb_build_object('title', 'Apa itu Partnership', 'text', 'Program kerja sama antara Vanillate Studio dan komunitas, kreator, atau brand yang ingin menjangkau pemain kami.'),
    jsonb_build_object('title', 'Tujuan', 'text', 'Membantu partner memperkenalkan komunitas, produk, atau event mereka kepada audiens yang relevan dan aktif.'),
    jsonb_build_object('title', 'Siapa yang dapat mengajukan', 'text', 'Komunitas Discord, kreator konten, penyelenggara event, dan brand yang produknya relevan bagi pemain kami.'),
    jsonb_build_object('title', 'Ketentuan umum', 'text', 'Materi promosi wajib sopan, tidak menyesatkan, bukan penipuan, tanpa konten dewasa, dan mematuhi Ketentuan Layanan Discord.')
  ),
  'benefits', jsonb_build_array(
    jsonb_build_object('title', 'Eksposur', 'text', 'Pesan kamu dilihat pemain yang benar-benar aktif.'),
    jsonb_build_object('title', 'Dukungan promosi', 'text', 'Kami bantu menyusun pesan agar mudah dipahami pemain.'),
    jsonb_build_object('title', 'Kolaborasi komunitas', 'text', 'Peluang kerja sama lintas komunitas Discord.'),
    jsonb_build_object('title', 'Laporan campaign', 'text', 'Ringkasan jumlah terkirim dan gagal setelah campaign selesai.')
  ),
  'process', jsonb_build_array(
    jsonb_build_object('n', '01', 'title', 'Submit', 'text', 'Ajukan partnership lewat WhatsApp official kami.'),
    jsonb_build_object('n', '02', 'title', 'Review', 'text', 'Tim meninjau pengajuan dan kesesuaian materi.'),
    jsonb_build_object('n', '03', 'title', 'Discussion', 'text', 'Diskusi bentuk kerja sama, jadwal, dan harga.'),
    jsonb_build_object('n', '04', 'title', 'Collaboration', 'text', 'Campaign dijalankan dan laporannya kami sampaikan.')
  ),
  'faq', jsonb_build_array(
    jsonb_build_object('q', 'Bagaimana cara mengajukan partnership?', 'a', 'Pilih produk yang kamu inginkan di halaman ini, lalu tombolnya akan membuka WhatsApp official kami dengan pesan yang sudah terisi.'),
    jsonb_build_object('q', 'Apakah harga bisa menyesuaikan kebutuhan?', 'a', 'Bisa. Harga yang tertera adalah harga dasar; silakan diskusikan kebutuhan kamu lewat WhatsApp.'),
    jsonb_build_object('q', 'Materi seperti apa yang tidak kami terima?', 'a', 'Konten menyesatkan, penipuan, judi, konten dewasa, dan apa pun yang melanggar Ketentuan Layanan Discord.')
  ),
  'cta', jsonb_build_object(
    'title', 'Tertarik bekerja sama dengan kami?',
    'text', 'Ceritakan rencana kamu, kami bantu menyesuaikan bentuk kerja samanya.',
    'label', 'Become a Partner'
  ),
  'seo', jsonb_build_object(
    'title', 'Partnership',
    'description', 'Jangkau ribuan pemain aktif Discord lewat Vanillate. Pilih Broadcast via DM atau Broadcast via Lobby — ajukan partnership langsung lewat WhatsApp.',
    'ogImage', ''
  ),
  'showStats', true
))
on conflict (id) do nothing;

-- 10g. Template pesan broadcast (minimal, extensible)
create table if not exists public.partnership_templates (
  id         bigint generated always as identity primary key,
  name       text not null,
  message    text not null,
  buttons    jsonb not null default '[]'::jsonb,
  created_by uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 10h. Generator Broadcast ID harian: PTN-YYYYMMDD-NNNN
create or replace function public.next_partnership_broadcast_id()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  hari   text := to_char(now() at time zone 'Asia/Jakarta', 'YYYYMMDD');
  urut   integer;
begin
  -- Hitung dari campaign hari ini, lalu ambil nomor berikutnya. Loop kecil
  -- menjaga aman bila ada dua pembuatan hampir bersamaan (unique constraint
  -- yang menjadi penentu akhir).
  select coalesce(max(substring(broadcast_id from 14 for 4)::integer), 0) + 1
    into urut
  from public.partnership_campaigns
  where broadcast_id like 'PTN-' || hari || '-%';

  return 'PTN-' || hari || '-' || lpad(urut::text, 4, '0');
end;
$$;

grant execute on function public.next_partnership_broadcast_id() to authenticated;

-- 10i. RLS
alter table public.partnership_products  enable row level security;
alter table public.partnership_campaigns enable row level security;
alter table public.partnership_recipients enable row level security;
alter table public.partnership_links     enable row level security;
alter table public.partnership_settings  enable row level security;
alter table public.partnership_page      enable row level security;
alter table public.partnership_templates enable row level security;

-- Katalog produk, link, setting, konten, template: admin baca; editor kelola.
-- Ditulis eksplisit (bukan loop dinamis) supaya konsisten dengan bagian lain
-- file ini dan mudah dibaca saat di-review di SQL Editor.

drop policy if exists "admin baca produk" on public.partnership_products;
create policy "admin baca produk" on public.partnership_products
  for select to authenticated using (public.is_admin());
drop policy if exists "editor kelola produk" on public.partnership_products;
create policy "editor kelola produk" on public.partnership_products
  for all to authenticated
  using (public.is_admin_editor()) with check (public.is_admin_editor());

drop policy if exists "admin baca links" on public.partnership_links;
create policy "admin baca links" on public.partnership_links
  for select to authenticated using (public.is_admin());
drop policy if exists "editor kelola links" on public.partnership_links;
create policy "editor kelola links" on public.partnership_links
  for all to authenticated
  using (public.is_admin_editor()) with check (public.is_admin_editor());

drop policy if exists "admin baca ptn settings" on public.partnership_settings;
create policy "admin baca ptn settings" on public.partnership_settings
  for select to authenticated using (public.is_admin());
drop policy if exists "editor kelola ptn settings" on public.partnership_settings;
create policy "editor kelola ptn settings" on public.partnership_settings
  for all to authenticated
  using (public.is_admin_editor()) with check (public.is_admin_editor());

drop policy if exists "admin baca ptn page" on public.partnership_page;
create policy "admin baca ptn page" on public.partnership_page
  for select to authenticated using (public.is_admin());
drop policy if exists "editor kelola ptn page" on public.partnership_page;
create policy "editor kelola ptn page" on public.partnership_page
  for all to authenticated
  using (public.is_admin_editor()) with check (public.is_admin_editor());

drop policy if exists "admin baca templates" on public.partnership_templates;
create policy "admin baca templates" on public.partnership_templates
  for select to authenticated using (public.is_admin());
drop policy if exists "editor kelola templates" on public.partnership_templates;
create policy "editor kelola templates" on public.partnership_templates
  for all to authenticated
  using (public.is_admin_editor()) with check (public.is_admin_editor());

-- Campaign: admin baca; editor boleh membuat & mengubah (mis. minta cancel).
-- Progress/eksekusi ditulis bot lewat service_role (bypass RLS).
drop policy if exists "admin baca campaigns" on public.partnership_campaigns;
create policy "admin baca campaigns" on public.partnership_campaigns
  for select to authenticated using (public.is_admin());

drop policy if exists "editor buat campaigns" on public.partnership_campaigns;
create policy "editor buat campaigns" on public.partnership_campaigns
  for insert to authenticated with check (public.is_admin_editor());

drop policy if exists "editor ubah campaigns" on public.partnership_campaigns;
create policy "editor ubah campaigns" on public.partnership_campaigns
  for update to authenticated
  using (public.is_admin_editor())
  with check (public.is_admin_editor());

-- Recipients: admin baca; editor hanya boleh MENAMBAH target saat membuat
-- campaign. Status pengiriman TIDAK boleh diubah dari browser — itu wewenang
-- bot (service_role), supaya laporan pengiriman tidak bisa dipalsukan.
drop policy if exists "admin baca recipients" on public.partnership_recipients;
create policy "admin baca recipients" on public.partnership_recipients
  for select to authenticated using (public.is_admin());

drop policy if exists "editor tambah recipients" on public.partnership_recipients;
create policy "editor tambah recipients" on public.partnership_recipients
  for insert to authenticated
  with check (public.is_admin_editor() and status = 'pending');
-- ═══════════════════════════════════════════════════════════════════════════
