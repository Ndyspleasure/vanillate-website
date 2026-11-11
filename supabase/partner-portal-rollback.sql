-- Rollback Portal Partner. Menghapus pesanan & profil partner (akun auth.users
-- dihapus lewat Edge Function partner-admin / dashboard Supabase).
drop trigger if exists partner_orders_report on public.partner_orders;
drop function if exists public.partner_orders_report();
drop function if exists public.partner_order_submit(text, text, text, date, text, text);
drop table if exists public.partner_orders;
drop function if exists public.partner_orders_touch();
drop table if exists public.partner_accounts;
