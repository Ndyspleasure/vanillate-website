-- ════════════════════════════════════════════════════════════════════════════
--  PEMBERSIHAN KATALOG TEBAK LAGU (proyek CMS lvfwopnvvqncopvathop)
--
--  Game Tebak Lagu di bot memakai sumber audio baru, jadi katalog lagu manual
--  (halaman /admin/lagu, tabel public.bot_songs, bucket tebak-lagu-audio) tidak
--  dipakai lagi dan halamannya sudah dihapus dari website.
--
--  URUTAN EKSEKUSI (penting):
--    1. Gabungkan bot versi baru, lalu Update & Restart di Kontrol Server.
--       Jalankan berkas ini HANYA setelah bot versi baru berjalan, karena bot
--       lama masih menarik tabel bot_songs.
--    2. Jalankan berkas ini.
--    3. Kosongkan lalu hapus bucket `tebak-lagu-audio` lewat dashboard Supabase
--       (Storage) atau Storage API. Berkas ini SENGAJA tidak menghapus baris
--       bucket dan tidak menyentuh storage.objects, karena Supabase melarang
--       penghapusan langsung lewat SQL.
--
--  Aman diulang (idempoten). Data bot_songs tidak bisa dipulihkan oleh
--  rollback (hanya strukturnya).
--  Rollback: supabase/tebak-lagu-katalog-cleanup-rollback.sql
-- ════════════════════════════════════════════════════════════════════════════

-- Kebijakan akses bucket (storage.objects) milik katalog.
drop policy if exists "admin baca tebak-lagu-audio" on storage.objects;
drop policy if exists "editor kelola tebak-lagu-audio" on storage.objects;

-- Tabel katalog (indeks dan kebijakan RLS ikut terhapus bersama tabelnya).
drop table if exists public.bot_songs;

-- Samakan teks penjelasan sakelar Tebak Lagu. game-switch.sql memakai
-- `on conflict do nothing`, jadi baris yang sudah ada tidak ikut berubah.
-- Hanya menimpa bila teksnya masih teks lama.
update public.bot_settings
   set help = 'Mati total: hilang dari Game Hub dan tidak ada permintaan ke penyedia lagu atau node audio.'
 where key = 'game_tebaklagu_enabled'
   and help = 'Mati total: hilang dari Game Hub dan sinkron katalog lagu dari CMS berhenti (tidak ada unduhan audio).';
