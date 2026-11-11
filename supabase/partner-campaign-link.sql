-- ════════════════════════════════════════════════════════════════════════════
--  Campaign Broadcast DM terhubung ke akun partner dan pesanannya.
--  Acuan: docs/PARTNER-PORTAL.md (bagian "Campaign partner").
--
--  • partnership_campaigns.partner_id / order_id (opsional, aditif).
--  • Trigger: campaign yang tertaut ke pesanan menggerakkan status pesanan
--    (queued -> diproses, running -> berjalan, completed -> selesai).
--    Status yang diubah manual ke dibatalkan/selesai tidak ditimpa.
--  • RPC partner_order_campaigns(): laporan AGREGAT (angka saja, tanpa User ID
--    penerima, pesan, atau log) hanya untuk pesanan milik pemanggil.
--
--  Butuh supabase/partner-portal.sql lebih dulu. Aditif & idempoten.
--  Rollback: supabase/partner-campaign-link-rollback.sql.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.partnership_campaigns
  add column if not exists partner_id uuid references public.partner_accounts (id) on delete set null,
  add column if not exists order_id   bigint references public.partner_orders (id) on delete set null;

create index if not exists partnership_campaigns_order_idx
  on public.partnership_campaigns (order_id) where order_id is not null;
create index if not exists partnership_campaigns_partner_idx
  on public.partnership_campaigns (partner_id) where partner_id is not null;

comment on column public.partnership_campaigns.partner_id is
  'Akun partner pemilik campaign (opsional). Diturunkan dari order_id bila pesanan dipilih.';
comment on column public.partnership_campaigns.order_id is
  'Pesanan partner yang dipenuhi campaign ini (opsional). Status campaign menggerakkan status pesanan.';

-- Sinkron partner_id dari pesanan + gerakkan status pesanan --------------------
create or replace function public.partnership_campaign_partner_sync()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.partner_orders%rowtype;
  v_next  text;
begin
  if new.order_id is null then
    return new;
  end if;

  select * into v_order from public.partner_orders where id = new.order_id;
  if not found then
    new.order_id := null;
    return new;
  end if;
  -- partner_id selalu mengikuti pesanan (admin tidak bisa mencampur partner).
  new.partner_id := v_order.partner_id;

  v_next := case new.status
    when 'queued'    then 'diproses'
    when 'running'   then 'berjalan'
    when 'completed' then 'selesai'
    else null
  end;

  if v_next is not null
     and v_order.status not in ('dibatalkan', 'selesai')
     and v_order.status is distinct from v_next
     -- tidak pernah mundur: diproses tidak menimpa berjalan
     and array_position(array['dicatat','diproses','berjalan','selesai'], v_order.status)
         < array_position(array['dicatat','diproses','berjalan','selesai'], v_next)
  then
    update public.partner_orders set status = v_next where id = v_order.id;
  end if;

  return new;
end;
$$;
revoke execute on function public.partnership_campaign_partner_sync() from public, anon, authenticated;

drop trigger if exists partnership_campaign_partner_sync on public.partnership_campaigns;
create trigger partnership_campaign_partner_sync
  before insert or update of status, order_id on public.partnership_campaigns
  for each row execute function public.partnership_campaign_partner_sync();

-- Laporan campaign untuk partner (agregat) ------------------------------------
create or replace function public.partner_order_campaigns(p_order_ids bigint[])
returns table (
  order_id      bigint,
  broadcast_id  text,
  channel       text,
  status        text,
  target_total  integer,
  success_count integer,
  failed_count  integer,
  skipped_count integer,
  started_at    timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.order_id, c.broadcast_id, c.channel, c.status, c.target_total,
         c.success_count, c.failed_count, c.skipped_count,
         c.started_at, c.completed_at, c.created_at
    from public.partnership_campaigns c
    join public.partner_orders o on o.id = c.order_id
   where o.partner_id = auth.uid()
     and auth.uid() is not null
     and c.status <> 'draft'
     and c.order_id = any (p_order_ids)
   order by c.created_at desc
   limit 200;
$$;
revoke execute on function public.partner_order_campaigns(bigint[]) from public, anon;
grant  execute on function public.partner_order_campaigns(bigint[]) to authenticated;
