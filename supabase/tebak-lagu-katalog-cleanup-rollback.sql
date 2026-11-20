-- ════════════════════════════════════════════════════════════════════════════
--  ROLLBACK tebak-lagu-katalog-cleanup.sql
--  Membuat ulang STRUKTUR katalog Tebak Lagu (tabel, indeks, RLS, kebijakan
--  storage) persis seperti bagian 17 lama di schema.sql. DATA lagu dan berkas
--  audio tidak dipulihkan. Bucket `tebak-lagu-audio` tidak dihapus oleh
--  cleanup, jadi baris bucket hanya dibuat bila belum ada.
--  Teks help sakelar game_tebaklagu_enabled sengaja tidak dikembalikan.
--  Aman diulang (idempoten).
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.bot_songs (
  id                bigint generated always as identity primary key,
  bot_slug          text not null default 'sambung-kata',
  title             text not null,                 -- judul kanonik (jawaban utama)
  accepted_answers  text[] not null default '{}',  -- alias/variasi judul yang dianggap benar
  artist            text,                          -- opsional, ditampilkan saat reveal
  storage_path      text not null,                 -- path objek di bucket tebak-lagu-audio
  duration_seconds  numeric,                       -- durasi total lagu (untuk clamp offset acak)
  min_start_seconds numeric not null default 0,    -- batas bawah offset acak (skip intro senyap)
  max_start_seconds numeric,                        -- batas atas offset acak (null = duration - 20)
  difficulty        text not null default 'normal',-- easy | normal | hard (opsional, untuk kurasi)
  active            boolean not null default true,  -- hanya lagu aktif yang diputar bot
  meta              jsonb,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists bot_songs_aktif_idx
  on public.bot_songs (bot_slug, active);

-- 17a. RLS: kunci jawaban TIDAK boleh publik. Admin login boleh baca; hanya
--      editor (owner/admin) yang boleh menulis. Bot memakai service_role
--      (bypass RLS) untuk menarik katalog.
alter table public.bot_songs enable row level security;

drop policy if exists "admin baca bot_songs" on public.bot_songs;
create policy "admin baca bot_songs" on public.bot_songs
  for select to authenticated using (public.is_admin());

drop policy if exists "editor kelola bot_songs" on public.bot_songs;
create policy "editor kelola bot_songs" on public.bot_songs
  for all to authenticated
  using (public.is_admin_editor()) with check (public.is_admin_editor());

-- 17b. Storage bucket PRIVAT `tebak-lagu-audio` (≤20 MB per file).
--   Berbeda dari product-media/team-media yang PUBLIK: bucket ini privat supaya
--   file audio tak bisa diunduh anonim (anti-contek). Tidak ada policy select
--   untuk role `public` — hanya admin login (preview via signed URL) & editor
--   (kelola). Bot memakai service_role yang mem-bypass seluruh RLS ini.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('tebak-lagu-audio', 'tebak-lagu-audio', false, 20971520,
   array['audio/mpeg','audio/mp4','audio/aac','audio/x-m4a','audio/ogg','audio/webm','audio/wav','audio/x-wav'])
on conflict (id) do nothing;

drop policy if exists "admin baca tebak-lagu-audio" on storage.objects;
create policy "admin baca tebak-lagu-audio" on storage.objects
  for select to authenticated
  using (bucket_id = 'tebak-lagu-audio' and public.is_admin());

drop policy if exists "editor kelola tebak-lagu-audio" on storage.objects;
create policy "editor kelola tebak-lagu-audio" on storage.objects
  for all to authenticated
  using (bucket_id = 'tebak-lagu-audio' and public.is_admin_editor())
  with check (bucket_id = 'tebak-lagu-audio' and public.is_admin_editor());
