-- ════════════════════════════════════════════════════════════════════════════
--  Pesanan partner (paket DM) otomatis membuat CAMPAIGN DRAFT di CMS.
--  Admin tinggal mengecek, melengkapi target User ID, lalu konfirmasi di
--  /admin/partnership/broadcast?draft=<id>. Draft tidak pernah dikirim bot
--  (bot hanya memproses status queued). Paket Lobby cukup menjadi riwayat.
--
--  Butuh partner-portal.sql, partner-order-fields.sql, partner-campaign-link.sql.
--  Aditif & idempoten. Rollback: supabase/partner-order-draft-rollback.sql.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.partner_orders_draft()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_channel text;
  v_url     text;
  v_msg     text;
  v_buttons jsonb := '[]'::jsonb;
  v_bid     text;
  v_try     integer := 0;
begin
  select p.channel into v_channel from public.partnership_products p where p.key = new.product_key;
  if v_channel is distinct from 'dm' then
    return new;  -- Lobby dan produk tak dikenal: riwayat pemesanan saja
  end if;

  select nullif(btrim(s.partnership_url), '') into v_url from public.partnership_settings s where s.id = 1;

  v_msg := concat_ws(E'\n\n',
    case when new.ad_title  is not null then '# ' || new.ad_title end,
    new.ad_text,
    case when new.ad_footer is not null then '-# ' || new.ad_footer end);
  if v_msg is null or btrim(v_msg) = '' then
    v_msg := '(Isi pesan belum diisi partner. Lengkapi sebelum dikirim.)';
  end if;

  if v_url is not null then
    v_buttons := jsonb_build_array(jsonb_build_object('label', 'Partnership', 'url', v_url));
  end if;
  v_buttons := v_buttons || new.ad_buttons;

  loop
    v_try := v_try + 1;
    v_bid := public.next_partnership_broadcast_id();
    begin
      insert into public.partnership_campaigns
        (broadcast_id, name, category, channel, status, message, partnership_url, buttons,
         created_by, target_total, valid_count, invalid_count, order_id)
      values
        (v_bid, left('Partner ' || new.brand_name || ' #' || new.id, 120), 'marketing', 'dm', 'draft',
         v_msg, v_url, v_buttons, null, 0, 0, 0, new.id);
      exit;
    exception when unique_violation then
      if v_try >= 3 then
        return new;  -- jangan menggagalkan pesanan partner hanya karena draft
      end if;
    end;
  end loop;

  return new;
end;
$$;
revoke execute on function public.partner_orders_draft() from public, anon, authenticated;

drop trigger if exists partner_orders_draft on public.partner_orders;
create trigger partner_orders_draft
  after insert on public.partner_orders
  for each row execute function public.partner_orders_draft();

-- Draft adalah konfigurasi internal admin: tidak tampil di laporan partner.
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
