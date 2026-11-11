-- Rollback draft otomatis. Draft yang sudah dibuat tetap ada (hapus manual bila perlu).
-- Fungsi laporan partner kembali ke versi tanpa filter draft: jalankan ulang
-- supabase/partner-campaign-link.sql bila ingin memulihkannya.
drop trigger if exists partner_orders_draft on public.partner_orders;
drop function if exists public.partner_orders_draft();
