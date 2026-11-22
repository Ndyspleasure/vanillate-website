-- 📖 Viewer boleh meminta perintah BACA-SAJA `read.*` ke bot (HO-037)
--
-- Latar: data game pindah ke PostgreSQL di VPS. Ringkasan Server Hub dihitung bot
-- sesuai permintaan (perintah `read.serverhub` lewat antrean `bot_commands`), bukan
-- lagi lewat Edge Function `cms-read` ke Database Bot. Tanpa perubahan ini viewer
-- (peran baca-saja) tidak bisa membuka Server Hub, karena INSERT ke `bot_commands`
-- hanya untuk owner dan admin (`is_admin_editor()`).
--
-- Yang dibuka (aditif, policy RLS baru, tidak ada yang dihapus atau diubah):
--   • semua akun admin CMS (`is_admin()`, termasuk viewer) boleh INSERT perintah
--     yang tipenya berawalan `read.` saja, atas nama dirinya, status `pending`,
--     payload maksimal 2 KB.
--   • tipe lain tetap hanya untuk owner dan admin; `sys.*` tetap hanya owner
--     (trigger `bot_commands_owner_guard` tidak berubah).
-- Sisi bot: tipe `read.*` berperan 'viewer' dan wajib baca-saja, agregat, `quiet`
-- (src/cms/registry.js dan test/cms.test.js di repo bot). Validasi akhir tetap di bot.
--
-- Idempoten: dijalankan ulang tidak menggandakan atau menimpa. Rollback:
-- supabase/bot-commands-viewer-read-rollback.sql.

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'bot_commands'
      and policyname = 'viewer tambah bot_commands baca-saja'
  ) then
    create policy "viewer tambah bot_commands baca-saja" on public.bot_commands
      for insert to authenticated
      with check (
        public.is_admin()
        and created_by = auth.uid()
        and status = 'pending'
        and type ~ '^read\.[A-Za-z][A-Za-z0-9.]{0,63}$'
        and coalesce(octet_length(payload::text), 0) <= 2048
      );
  end if;
end;
$$;

comment on policy "viewer tambah bot_commands baca-saja" on public.bot_commands is
  'HO-037: semua admin CMS (termasuk viewer) boleh mengantre perintah baca-saja read.* (maks. 2 KB). Perintah lain tetap owner/admin.';
