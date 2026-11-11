-- Rollback tautan campaign partner. Kolom dihapus (nilai partner_id/order_id hilang).
drop trigger if exists partnership_campaign_partner_sync on public.partnership_campaigns;
drop function if exists public.partnership_campaign_partner_sync();
drop function if exists public.partner_order_campaigns(bigint[]);
drop index if exists public.partnership_campaigns_order_idx;
drop index if exists public.partnership_campaigns_partner_idx;
alter table public.partnership_campaigns
  drop column if exists order_id,
  drop column if exists partner_id;
