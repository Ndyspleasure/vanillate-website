-- ═══════════════════════════════════════════════════════════════════════════
-- SEED DEMO — data contoh untuk mencoba panel admin
-- ═══════════════════════════════════════════════════════════════════════════
-- Panel admin hanya MEMBACA. Yang mengisi tabel di bawah adalah bot, memakai
-- service_role key (lihat docs/ADMIN-CMS.md bagian 5). Selama bot belum
-- terhubung, semua halaman tampil kosong — itu normal, bukan error.
--
-- File ini mengisi data palsu supaya kamu bisa memastikan panelnya berfungsi:
-- grafik tampil, filter log jalan, tabel server dan pemain terisi.
--
-- Cara pakai : Supabase → SQL Editor → tempel seluruh isi file → Run.
-- Cara hapus : jalankan blok "MEMBERSIHKAN DATA DEMO" di bagian paling bawah.
--
-- Semua baris demo ditandai meta->>'demo' = 'true' supaya bisa dihapus
-- terpisah tanpa menyentuh data asli dari bot.
-- ───────────────────────────────────────────────────────────────────────────


-- ── 0. Bersihkan sisa demo sebelumnya ──────────────────────────────────────
-- Supaya file ini aman dijalankan berulang kali tanpa menumpuk baris ganda.
-- Data asli dari bot tidak punya penanda ini, jadi tidak ikut terhapus.
delete from public.bot_logs    where meta->>'demo' = 'true';
delete from public.bot_stats   where meta->>'demo' = 'true';
delete from public.bot_guilds  where meta->>'demo' = 'true';
delete from public.bot_players where meta->>'demo' = 'true';


-- ── 1. Log aktivitas ───────────────────────────────────────────────────────
-- Campuran level supaya filter di /admin/logs bisa dicoba.
insert into public.bot_logs (level, event, message, guild_id, guild_name, actor_id, meta, created_at) values
  ('info',  'bot_ready',      'Bot online, 3 server termuat',              null,           null,                  null,                 '{"demo":true}', now() - interval '6 hours'),
  ('info',  'command_run',    'Perintah /mulai dijalankan',                '111111111111', 'Warung Kopi Gaming',  '900000000000000001', '{"demo":true,"command":"mulai"}',  now() - interval '5 hours'),
  ('info',  'game_start',     'Ronde baru dimulai (8 pemain)',             '111111111111', 'Warung Kopi Gaming',  null,                 '{"demo":true,"players":8}',        now() - interval '5 hours'),
  ('warn',  'rate_limit',     'Kena rate limit Discord, menunggu 2 detik', '222222222222', 'Santai Sejenak',      null,                 '{"demo":true,"retry_after":2}',    now() - interval '4 hours'),
  ('info',  'game_end',       'Ronde selesai, pemenang: Rizky',            '111111111111', 'Warung Kopi Gaming',  '900000000000000002', '{"demo":true,"duration_s":412}',   now() - interval '4 hours'),
  ('error', 'command_failed', 'Gagal memuat kamus: timeout ke API kamus',  '222222222222', 'Santai Sejenak',      null,                 '{"demo":true,"code":"ETIMEDOUT"}', now() - interval '3 hours'),
  ('info',  'guild_join',     'Bot ditambahkan ke server baru',            '333333333333', 'Kelas Malam',         null,                 '{"demo":true}',                    now() - interval '2 hours'),
  ('debug', 'cache_refresh',  'Cache kamus disegarkan (12.480 kata)',      null,           null,                  null,                 '{"demo":true,"words":12480}',      now() - interval '90 minutes'),
  ('warn',  'slow_response',  'Respons perintah 3.2 detik, di atas ambang','333333333333', 'Kelas Malam',         null,                 '{"demo":true,"ms":3200}',          now() - interval '45 minutes'),
  ('error', 'db_write',       'Gagal menyimpan skor pemain, dicoba ulang', '111111111111', 'Warung Kopi Gaming',  '900000000000000003', '{"demo":true,"retries":1}',        now() - interval '20 minutes'),
  ('info',  'command_run',    'Perintah /skor dijalankan',                 '333333333333', 'Kelas Malam',         '900000000000000004', '{"demo":true,"command":"skor"}',   now() - interval '5 minutes');


-- ── 2. Snapshot statistik ──────────────────────────────────────────────────
-- 24 titik dengan jarak 1 jam, supaya grafik di /admin/statistik punya bentuk.
insert into public.bot_stats (captured_at, guild_count, member_reach, active_players, games_played, commands_run, uptime_seconds, latency_ms, meta)
select
  now() - (n || ' hours')::interval,
  case when n > 2 then 2 else 3 end,                      -- server ke-3 baru gabung 2 jam lalu
  case when n > 2 then 840 else 1120 end + (23 - n) * 3,
  greatest(0, 14 + ((23 - n) % 7) - 3),
  40 + (23 - n) * 2,
  180 + (23 - n) * 9,
  (24 - n) * 3600,
  60 + ((n * 7) % 45),
  '{"demo":true}'::jsonb
from generate_series(23, 0, -1) as n;


-- ── 3. Daftar server ───────────────────────────────────────────────────────
insert into public.bot_guilds (guild_id, name, member_count, owner_id, joined_at, last_seen_at, is_active, meta) values
  ('111111111111', 'Warung Kopi Gaming', 642, '900000000000000010', now() - interval '90 days', now(), true,  '{"demo":true}'),
  ('222222222222', 'Santai Sejenak',     198, '900000000000000011', now() - interval '40 days', now(), true,  '{"demo":true}'),
  ('333333333333', 'Kelas Malam',        280, '900000000000000012', now() - interval '2 hours', now(), true,  '{"demo":true}'),
  ('444444444444', 'Server Lama',         55, '900000000000000013', now() - interval '200 days', now() - interval '30 days', false, '{"demo":true}')
on conflict (bot_slug, guild_id) do nothing;


-- ── 4. Daftar pemain ───────────────────────────────────────────────────────
insert into public.bot_players (player_id, display_name, level, games_played, wins, last_seen_at, is_banned, meta) values
  ('900000000000000001', 'Rizky',    12, 148, 61, now() - interval '20 minutes', false, '{"demo":true}'),
  ('900000000000000002', 'Anindita',  9, 102, 44, now() - interval '1 hour',     false, '{"demo":true}'),
  ('900000000000000003', 'Bagas',     7,  88, 25, now() - interval '3 hours',    false, '{"demo":true}'),
  ('900000000000000004', 'Citra',     6,  71, 19, now() - interval '5 minutes',  false, '{"demo":true}'),
  ('900000000000000005', 'Dimas',     4,  40, 11, now() - interval '2 days',     false, '{"demo":true}'),
  ('900000000000000006', 'Eka',       3,  27,  6, now() - interval '4 days',     false, '{"demo":true}'),
  ('900000000000000007', 'Farhan',    2,  15,  2, now() - interval '9 days',     true,  '{"demo":true,"ban_reason":"spam"}')
on conflict (bot_slug, player_id) do nothing;


-- ═══════════════════════════════════════════════════════════════════════════
-- MEMBERSIHKAN DATA DEMO
-- ═══════════════════════════════════════════════════════════════════════════
-- Jalankan blok ini (hapus tanda komentarnya) kalau bot asli sudah terhubung
-- dan data demo tidak diperlukan lagi. Data asli dari bot tidak ikut terhapus
-- karena tidak punya penanda meta->>'demo'.
--
-- delete from public.bot_logs    where meta->>'demo' = 'true';
-- delete from public.bot_stats   where meta->>'demo' = 'true';
-- delete from public.bot_guilds  where meta->>'demo' = 'true';
-- delete from public.bot_players where meta->>'demo' = 'true';
