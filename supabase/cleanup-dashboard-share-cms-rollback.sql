-- Rollback pembersihan CMS: data yang sudah dihapus TIDAK bisa dikembalikan dari sini.
-- Pulihkan dari backup yang dibuat sebelum cleanup-dashboard-share-cms.sql.
-- Bila hanya skema yang dibutuhkan, ambil dari riwayat git:
--   git log --diff-filter=D -- supabase/guild-dashboard-schema.sql supabase/share-server.sql
select 'Tidak ada rollback otomatis: pulihkan dari backup' as catatan;
