-- Rollback form lengkap. Menghapus kolom iklan baru (isinya hilang) dan RPC 11 argumen.
-- Setelah ini jalankan ulang supabase/partner-portal.sql untuk memulihkan RPC 7 argumen
-- dan trigger laporan versi awal.
drop function if exists public.partner_order_submit(text, integer, text, text, date, text, text, text, text, text, jsonb);
alter table public.partner_orders drop constraint if exists partner_orders_ad_fields_chk;
alter table public.partner_orders
  drop column if exists ad_title,
  drop column if exists ad_footer,
  drop column if exists ad_image_url,
  drop column if exists ad_buttons;
