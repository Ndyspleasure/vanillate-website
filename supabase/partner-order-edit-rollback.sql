-- Rollback ubah pesanan partner. Menghapus RPC, kolom edited_at/edit_count
-- (riwayat ubah hilang), dan mengembalikan trigger laporan ke bentuk awal
-- (payload lengkap seperti partner-order-fields.sql).
drop function if exists public.partner_order_admin_update(bigint, text, integer, text, text, date, text, text, text, text, text, jsonb);
drop function if exists public.partner_order_edit_core(bigint, boolean, text, integer, text, text, date, text, text, text, text, text, jsonb);
drop function if exists public.partner_order_update(bigint, text, integer, text, text, date, text, text, text, text, text, jsonb);

create or replace function public.partner_orders_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.bot_commands (bot_slug, type, payload, status, created_by)
  values (
    'vanillateID',
    'partner.order.report',
    jsonb_build_object(
      'orderId',      new.id,
      'partnerName',  new.partner_name,
      'productName',  new.product_name,
      'priceText',    new.price_text,
      'quantity',     new.quantity,
      'unit',         coalesce(new.unit, ''),
      'totalText',    new.total_text,
      'brandName',    new.brand_name,
      'inviteUrl',    coalesce(new.invite_url, ''),
      'scheduledFor', coalesce(new.scheduled_for::text, ''),
      'adText',       coalesce(new.ad_text, ''),
      'note',         coalesce(new.note, ''),
      'adTitle',      coalesce(new.ad_title, ''),
      'adFooter',     coalesce(new.ad_footer, ''),
      'imageUrl',     coalesce(new.ad_image_url, ''),
      'buttons',      new.ad_buttons,
      'createdAt',    to_char(new.created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    ),
    'pending',
    null
  );
  return new;
end;
$$;
revoke execute on function public.partner_orders_report() from public, anon, authenticated;

drop function if exists public.partner_order_report_payload(public.partner_orders);
alter table public.partner_orders drop constraint if exists partner_orders_edit_count_chk;
alter table public.partner_orders
  drop column if exists edited_at,
  drop column if exists edit_count,
  drop column if exists admin_edited_at;
