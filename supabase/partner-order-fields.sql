-- ════════════════════════════════════════════════════════════════════════════
--  Form pesanan partner lengkap: judul, footer, gambar, dan tombol iklan.
--  Menambah kolom ke partner_orders, MENGGANTI RPC partner_order_submit
--  (parameter baru, yang lama dihapus) dan memperluas payload laporan bot.
--  Butuh supabase/partner-portal.sql lebih dulu. Aditif pada data, idempoten.
--  Jalankan SETELAH partner-portal.sql (menjalankan partner-portal.sql lagi
--  akan memulihkan RPC lama, lalu jalankan berkas ini lagi).
--  Rollback: supabase/partner-order-fields-rollback.sql.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.partner_orders
  add column if not exists ad_title     text,
  add column if not exists ad_footer    text,
  add column if not exists ad_image_url text,
  add column if not exists ad_buttons   jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'partner_orders_ad_fields_chk') then
    alter table public.partner_orders add constraint partner_orders_ad_fields_chk check (
      (ad_title is null or char_length(ad_title) <= 100)
      and (ad_footer is null or char_length(ad_footer) <= 100)
      and (ad_image_url is null or (ad_image_url ~ '^https://[^[:space:]]+$' and char_length(ad_image_url) <= 300))
      and jsonb_typeof(ad_buttons) = 'array'
      and jsonb_array_length(ad_buttons) <= 3
    );
  end if;
end $$;

-- RPC lama (7 argumen) diganti versi lengkap (11 argumen).
drop function if exists public.partner_order_submit(text, integer, text, text, date, text, text);

create or replace function public.partner_order_submit(
  p_product_key   text,
  p_quantity      integer,
  p_brand_name    text,
  p_invite_url    text default null,
  p_scheduled_for date default null,
  p_ad_text       text default null,
  p_note          text default null,
  p_ad_title      text default null,
  p_ad_footer     text default null,
  p_ad_image_url  text default null,
  p_ad_buttons    jsonb default '[]'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_acc     public.partner_accounts%rowtype;
  v_prod    public.partnership_products%rowtype;
  v_brand   text := btrim(coalesce(p_brand_name, ''));
  v_url     text := nullif(btrim(coalesce(p_invite_url, '')), '');
  v_ad      text := nullif(btrim(coalesce(p_ad_text, '')), '');
  v_note    text := nullif(btrim(coalesce(p_note, '')), '');
  v_title   text := nullif(btrim(coalesce(p_ad_title, '')), '');
  v_footer  text := nullif(btrim(coalesce(p_ad_footer, '')), '');
  v_image   text := nullif(btrim(coalesce(p_ad_image_url, '')), '');
  v_buttons jsonb := '[]'::jsonb;
  v_btn     jsonb;
  v_label   text;
  v_burl    text;
  v_price   text;
  v_total   text;
  v_qty     integer := coalesce(p_quantity, 0);
  v_min     integer;
  v_today   date := (now() at time zone 'Asia/Jakarta')::date;
  v_id      bigint;
begin
  if v_uid is null then
    raise exception 'Belum login.' using errcode = '42501';
  end if;
  select * into v_acc from public.partner_accounts where id = v_uid;
  if not found then
    raise exception 'Akun ini bukan akun partner.' using errcode = '42501';
  end if;
  if v_acc.must_change_credentials then
    raise exception 'Ganti username dan password dulu sebelum mencatat pesanan.' using errcode = '42501';
  end if;

  select * into v_prod from public.partnership_products
   where key = p_product_key and enabled;
  if not found then
    raise exception 'Paket tidak ditemukan atau sedang tidak tersedia.' using errcode = '22023';
  end if;

  v_min := greatest(coalesce(v_prod.min_quantity, 1), 1);
  if v_qty < v_min or v_qty > 1000000 then
    raise exception 'Jumlah minimal % %.', v_min, coalesce(nullif(btrim(v_prod.unit), ''), 'unit') using errcode = '22023';
  end if;

  if char_length(v_brand) not between 1 and 80 then
    raise exception 'Nama server atau brand wajib diisi (maks. 80 karakter).' using errcode = '22023';
  end if;
  if v_url is not null and (v_url !~ '^https://[^[:space:]]+$' or char_length(v_url) > 300) then
    raise exception 'Link harus diawali https:// dan tanpa spasi.' using errcode = '22023';
  end if;
  if p_scheduled_for is not null and p_scheduled_for < v_today then
    raise exception 'Tanggal tayang tidak boleh sudah lewat.' using errcode = '22023';
  end if;
  if p_scheduled_for is not null and p_scheduled_for > v_today + 365 then
    raise exception 'Tanggal tayang maksimal 1 tahun ke depan.' using errcode = '22023';
  end if;
  if v_ad is not null and char_length(v_ad) > 2000 then
    raise exception 'Teks iklan maksimal 2000 karakter.' using errcode = '22023';
  end if;
  if v_note is not null and char_length(v_note) > 1000 then
    raise exception 'Catatan maksimal 1000 karakter.' using errcode = '22023';
  end if;
  if v_title is not null and char_length(v_title) > 100 then
    raise exception 'Judul iklan maksimal 100 karakter.' using errcode = '22023';
  end if;
  if v_footer is not null and char_length(v_footer) > 100 then
    raise exception 'Footer iklan maksimal 100 karakter.' using errcode = '22023';
  end if;
  if v_image is not null and (v_image !~ '^https://[^[:space:]]+$' or char_length(v_image) > 300) then
    raise exception 'Link gambar harus diawali https:// dan tanpa spasi.' using errcode = '22023';
  end if;

  if p_ad_buttons is null or jsonb_typeof(p_ad_buttons) <> 'array' then
    raise exception 'Tombol iklan tidak valid.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_ad_buttons) > 3 then
    raise exception 'Tombol iklan maksimal 3.' using errcode = '22023';
  end if;
  for v_btn in select * from jsonb_array_elements(p_ad_buttons) loop
    if jsonb_typeof(v_btn) <> 'object' then
      raise exception 'Tombol iklan tidak valid.' using errcode = '22023';
    end if;
    v_label := btrim(coalesce(v_btn ->> 'label', ''));
    v_burl  := btrim(coalesce(v_btn ->> 'url', ''));
    if char_length(v_label) not between 1 and 80 then
      raise exception 'Nama tombol wajib diisi (maks. 80 karakter).' using errcode = '22023';
    end if;
    if v_burl !~ '^https://[^[:space:]]+$' or char_length(v_burl) > 300 then
      raise exception 'Link tombol harus diawali https:// dan tanpa spasi.' using errcode = '22023';
    end if;
    v_buttons := v_buttons || jsonb_build_array(jsonb_build_object('label', v_label, 'url', v_burl));
  end loop;

  if (select count(*) from public.partner_orders
       where partner_id = v_uid and created_at > now() - interval '1 day') >= 10 then
    raise exception 'Batas 10 catatan pesanan per hari tercapai. Coba lagi besok.' using errcode = '54000';
  end if;

  v_price := case
    when v_prod.price is null then 'Harga belum ditentukan'
    else 'Rp ' || replace(to_char(round(v_prod.price), 'FM999,999,999,999,999,999'), ',', '.')
         || coalesce(' ' || nullif(btrim(v_prod.price_unit), ''), '')
  end;
  v_total := case
    when v_prod.price is null then 'Harga belum ditentukan'
    else 'Rp ' || replace(to_char(round(v_prod.price * v_qty), 'FM999,999,999,999,999,999'), ',', '.')
  end;

  insert into public.partner_orders
    (partner_id, partner_name, product_key, product_name, price_text, quantity, unit, total_text,
     brand_name, invite_url, scheduled_for, ad_text, note, ad_title, ad_footer, ad_image_url, ad_buttons)
  values
    (v_uid, v_acc.display_name, v_prod.key, v_prod.name, v_price, v_qty, nullif(btrim(v_prod.unit), ''), v_total,
     v_brand, v_url, p_scheduled_for, v_ad, v_note, v_title, v_footer, v_image, v_buttons)
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.partner_order_submit(text, integer, text, text, date, text, text, text, text, text, jsonb) from public, anon;
grant  execute on function public.partner_order_submit(text, integer, text, text, date, text, text, text, text, text, jsonb) to authenticated;

-- Payload laporan bot diperluas (field baru opsional di sisi bot) ---------------
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
