-- ════════════════════════════════════════════════════════════════════════════
--  PANEL DEVELOPER (V3) — CMS Admin menggantikan slash command /developer.
--
--  Jalankan SETELAH supabase/schema.sql. Aman dijalankan berulang (idempoten).
--  Murni ADITIF: hanya tabel, kolom, fungsi, trigger, policy, dan bucket BARU.
--  Tidak ada baris lama yang diubah atau dihapus. Aman diterapkan kapan saja —
--  bot & website versi lama mengabaikan semua objek ini.
--
--  Baris setting baru ada di berkas terpisah, supabase/developer-panel-settings.sql,
--  yang diterapkan SETELAH website v3 live (lihat alasannya di berkas itu).
--  Pemulihan: supabase/developer-panel-rollback.sql.
--
--  Alur (lihat docs/DEVELOPER-PANEL.md):
--    • bot → website : bot_panel_snapshots (keadaan bot terkini per panel)
--    • website → bot : bot_commands (sudah ada) — kini dengan progress &
--                      heartbeat untuk tugas panjang, plus penjaga owner.
--    • backup DB     : bucket privat bot-backups (hanya owner yang bisa unduh).
-- ════════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- 1. SNAPSHOT PANEL (bot → website)
-- ───────────────────────────────────────────────────────────────────────────
-- Satu baris per panel (key): system, games, polls, events, errors, tutorial,
-- campaign, social, autoheal, words, broadcast. Ditulis bot (service_role) tiap
-- ±30 dtk dan segera setelah perintah yang mengubahnya. Website hanya membaca.
create table if not exists public.bot_panel_snapshots (
  bot_slug   text        not null default 'sambung-kata',
  key        text        not null,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (bot_slug, key)
);

comment on table public.bot_panel_snapshots is
  'Keadaan bot terkini untuk Panel Developer di /admin (game aktif, polling, error, tutorial, sosial, auto-heal, dll). Ditulis bot (service_role); dibaca admin. updated_at basi = bot offline.';

alter table public.bot_panel_snapshots enable row level security;

-- Policy dibuat bila belum ada (tanpa DROP): migrasi ini tidak pernah
-- menghapus objek, termasuk saat dijalankan ulang.
do $$
begin
  if not exists (select 1 from pg_policies
                 where schemaname = 'public' and tablename = 'bot_panel_snapshots'
                   and policyname = 'admin_baca_bot_panel_snapshots') then
    create policy admin_baca_bot_panel_snapshots on public.bot_panel_snapshots
      for select to authenticated using (public.is_admin());
  end if;
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. bot_commands: progress & heartbeat untuk tugas panjang
-- ───────────────────────────────────────────────────────────────────────────
-- Broadcast ribuan DM atau restart bot bisa melewati 10 menit. Bot menulis
-- progress (jsonb) dan heartbeat_at selama bekerja; perintah `processing` baru
-- dianggap macet bila heartbeat-nya basi, bukan karena umurnya.
alter table public.bot_commands add column if not exists progress     jsonb;
alter table public.bot_commands add column if not exists heartbeat_at timestamptz;

comment on column public.bot_commands.progress is
  'Kemajuan tugas panjang (mis. broadcast: done/total/sent/failed). Ditulis bot.';
comment on column public.bot_commands.heartbeat_at is
  'Detak terakhir bot saat memproses perintah ini. Basi > 10 menit = macet.';

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Penjaga owner: perintah berawalan `sys.` hanya boleh dari owner
-- ───────────────────────────────────────────────────────────────────────────
-- Aksi sistem (restart/update bot, backup database, bersihkan log, reset
-- tutorial massal, Auto-Heal) diberi tipe `sys.*`. Bot juga memeriksa peran
-- pembuat perintah sebelum mengeksekusi — trigger ini lapis kedua di database.
create or replace function public.bot_commands_owner_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.type like 'sys.%'
     and coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
     and not public.is_owner() then
    raise exception 'Perintah % hanya boleh dikirim owner.', new.type
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.bot_commands_owner_guard() from public, anon, authenticated;

create or replace trigger bot_commands_owner_guard
  before insert on public.bot_commands
  for each row execute function public.bot_commands_owner_guard();

-- ───────────────────────────────────────────────────────────────────────────
-- 4. Bucket privat backup database (sys.db.backup)
-- ───────────────────────────────────────────────────────────────────────────
-- Bot mengunggah salinan SQLite ter-gzip memakai service_role. Hanya owner yang
-- boleh membaca (membuat signed URL ±10 menit) dan menghapus. Bot menghapus
-- otomatis berkas yang berumur > 24 jam. 50 MB = batas berkas paket gratis.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bot-backups', 'bot-backups', false, 52428800, array['application/gzip'])
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies
                 where schemaname = 'storage' and tablename = 'objects'
                   and policyname = 'owner_baca_bot_backups') then
    create policy owner_baca_bot_backups on storage.objects
      for select to authenticated
      using (bucket_id = 'bot-backups' and public.is_owner());
  end if;
  if not exists (select 1 from pg_policies
                 where schemaname = 'storage' and tablename = 'objects'
                   and policyname = 'owner_hapus_bot_backups') then
    create policy owner_hapus_bot_backups on storage.objects
      for delete to authenticated
      using (bucket_id = 'bot-backups' and public.is_owner());
  end if;
end;
$$;
