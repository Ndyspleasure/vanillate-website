-- ════════════════════════════════════════════════════════════════════════════
--  Partner mengubah pesanannya sendiri (tombol "Ubah" di riwayat dashboard).
--  Boleh selama status masih `dicatat` atau `diproses`. Status `berjalan`,
--  `selesai`, `dibatalkan` terkunci.
--
--  • Kolom edited_at / edit_count (maks. 10 kali ubah per pesanan).
--  • RPC partner_order_update(): validasi sama dengan partner_order_submit,
--    harga dan total dihitung ulang dari katalog, paket hanya boleh diganti
--    ke paket sekanal (DM ke DM, Lobby ke Lobby).
--  • Campaign draft tertaut ikut disinkronkan. Campaign yang sudah antre
--    (queued atau scheduled) TIDAK disentuh; laporan ke bot memuat
--    campaignLocked = true supaya tim menyesuaikan manual.
--  • Satu laporan `partner.order.report` (edited = true) per perubahan partner.
--  • Admin editor CMS juga bisa mengubah isi pesanan (RPC
--    partner_order_admin_update, semua status, tanpa batas ubah). Perubahan
--    admin ditandai admin_edited_at dan TIDAK dilaporkan ke bot sebagai
--    "diubah partner".
--  • Logika bersama ada di partner_order_edit_core() (internal, tertutup).
--
--  Butuh partner-portal.sql, partner-order-fields.sql, partner-campaign-link.sql,
--  partner-order-draft.sql. Aditif & idempoten.
--  Rollback: supabase/partner-order-edit-rollback.sql.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.partner_orders
  add column if not exists edited_at  timestamptz,
  add column if not exists edit_count integer not null default 0,
  add column if not exists admin_edited_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'partner_orders_edit_count_chk') then
    alter table public.partner_orders
      add constraint partner_orders_edit_count_chk check (edit_count between 0 and 10);
  end if;
end $$;

-- Payload laporan bot dipakai bersama oleh trigger insert dan RPC ubah -----------
create or replace function public.partner_order_report_payload(o public.partner_orders)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'orderId',      o.id,
    'partnerName',  o.partner_name,
    'productName',  o.product_name,
    'priceText',    o.price_text,
    'quantity',     o.quantity,
    'unit',         coalesce(o.unit, ''),
    'totalText',    o.total_text,
    'brandName',    o.brand_name,
    'inviteUrl',    coalesce(o.invite_url, ''),
    'scheduledFor', coalesce(o.scheduled_for::text, ''),
    'adText',       coalesce(o.ad_text, ''),
    'note',         coalesce(o.note, ''),
    'adTitle',      coalesce(o.ad_title, ''),
    'adFooter',     coalesce(o.ad_footer, ''),
    'imageUrl',     coalesce(o.ad_image_url, ''),
    'buttons',      o.ad_buttons,
    'createdAt',    to_char(o.created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  );
$$;
revoke execute on function public.partner_order_report_payload(public.partner_orders) from public, anon, authenticated;

create or replace function public.partner_orders_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.bot_commands (bot_slug, type, payload, status, created_by)
  values ('vanillateID', 'partner.order.report', public.partner_order_report_payload(new), 'pending', null);
  return new;
end;
$$;
revoke execute on function public.partner_orders_report() from public, anon, authenticated;

-- Inti perubahan pesanan (internal, dipakai dua RPC di bawah) ----------------------
create or replace function public.partner_order_edit_core(
  p_order_id      bigint,
  p_admin         boolean,
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
returns public.partner_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_acc     public.partner_accounts%rowtype;
  v_old     public.partner_orders%rowtype;
  v_new     public.partner_orders%rowtype;
  v_prod    public.partnership_products%rowtype;
  v_old_ch  text;
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
  v_setting text;
  v_msg     text;
  v_cbtns   jsonb := '[]'::jsonb;
begin
  -- Kunci baris pesanan: dua ubahan bersamaan atau ubah vs ubah status berurutan.
  if p_admin then
    select * into v_old from public.partner_orders where id = p_order_id for update;
  else
    if v_uid is null then
      raise exception 'Belum login.' using errcode = '42501';
    end if;
    select * into v_acc from public.partner_accounts where id = v_uid;
    if not found then
      raise exception 'Akun ini bukan akun partner.' using errcode = '42501';
    end if;
    if v_acc.must_change_credentials then
      raise exception 'Ganti username dan password dulu sebelum mengubah pesanan.' using errcode = '42501';
    end if;
    select * into v_old from public.partner_orders where id = p_order_id and partner_id = v_uid for update;
  end if;
  if not found then
    raise exception 'Pesanan tidak ditemukan.' using errcode = '22023';
  end if;
  if not p_admin then
    if v_old.status not in ('dicatat', 'diproses') then
      raise exception 'Pesanan sudah berjalan, selesai, atau dibatalkan sehingga tidak bisa diubah lagi. Hubungi WhatsApp official.' using errcode = '22023';
    end if;
    if v_old.edit_count >= 10 then
      raise exception 'Batas 10 kali ubah pesanan tercapai. Hubungi WhatsApp official.' using errcode = '54000';
    end if;
  end if;

  select * into v_prod from public.partnership_products where key = p_product_key and enabled;
  if not found then
    raise exception 'Paket tidak ditemukan atau sedang tidak tersedia.' using errcode = '22023';
  end if;
  if p_product_key is distinct from v_old.product_key then
    select channel into v_old_ch from public.partnership_products where key = v_old.product_key;
    if v_old_ch is distinct from v_prod.channel then
      raise exception 'Paket hanya bisa diganti ke paket sekanal (DM ke DM, Lobby ke Lobby). Hubungi WhatsApp official.' using errcode = '22023';
    end if;
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
  -- Tanggal yang tidak diubah boleh sudah lewat; tanggal baru tidak.
  if p_scheduled_for is not null and p_scheduled_for is distinct from v_old.scheduled_for then
    if p_scheduled_for < v_today then
      raise exception 'Tanggal tayang tidak boleh sudah lewat.' using errcode = '22023';
    end if;
    if p_scheduled_for > v_today + 365 then
      raise exception 'Tanggal tayang maksimal 1 tahun ke depan.' using errcode = '22023';
    end if;
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

  v_price := case
    when v_prod.price is null then 'Harga belum ditentukan'
    else 'Rp ' || replace(to_char(round(v_prod.price), 'FM999,999,999,999,999,999'), ',', '.')
         || coalesce(' ' || nullif(btrim(v_prod.price_unit), ''), '')
  end;
  v_total := case
    when v_prod.price is null then 'Harga belum ditentukan'
    else 'Rp ' || replace(to_char(round(v_prod.price * v_qty), 'FM999,999,999,999,999,999'), ',', '.')
  end;

  update public.partner_orders set
    product_key = v_prod.key, product_name = v_prod.name, price_text = v_price,
    quantity = v_qty, unit = nullif(btrim(v_prod.unit), ''), total_text = v_total,
    brand_name = v_brand, invite_url = v_url, scheduled_for = p_scheduled_for,
    ad_text = v_ad, note = v_note, ad_title = v_title, ad_footer = v_footer,
    ad_image_url = v_image, ad_buttons = v_buttons,
    edited_at       = case when p_admin then v_old.edited_at else now() end,
    edit_count      = case when p_admin then v_old.edit_count else v_old.edit_count + 1 end,
    admin_edited_at = case when p_admin then now() else v_old.admin_edited_at end
  where id = v_old.id
  returning * into v_new;

  -- Campaign tertaut: draft disinkronkan, yang sudah antre dibiarkan (dikunci).
  if exists (select 1 from public.partnership_campaigns c where c.order_id = v_new.id and c.status = 'draft') then
    select nullif(btrim(s.partnership_url), '') into v_setting from public.partnership_settings s where s.id = 1;
    v_msg := concat_ws(E'\n\n',
      case when v_new.ad_title  is not null then '# ' || v_new.ad_title end,
      v_new.ad_text,
      case when v_new.ad_footer is not null then '-# ' || v_new.ad_footer end);
    if v_msg is null or btrim(v_msg) = '' then
      v_msg := '(Isi pesan belum diisi partner. Lengkapi sebelum dikirim.)';
    end if;
    if v_setting is not null then
      v_cbtns := jsonb_build_array(jsonb_build_object('label', 'Partnership', 'url', v_setting));
    end if;
    v_cbtns := v_cbtns || v_new.ad_buttons;
    update public.partnership_campaigns
       set name = left('Partner ' || v_new.brand_name || ' #' || v_new.id, 120),
           message = v_msg, buttons = v_cbtns, partnership_url = v_setting
     where order_id = v_new.id and status = 'draft';
  end if;

  return v_new;
end;
$$;
revoke execute on function public.partner_order_edit_core(bigint, boolean, text, integer, text, text, date, text, text, text, text, text, jsonb) from public, anon, authenticated;

-- RPC: partner mengubah pesanan sendiri ----------------------------------------
create or replace function public.partner_order_update(
  p_order_id      bigint,
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
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new    public.partner_orders%rowtype;
  v_locked boolean;
begin
  v_new := public.partner_order_edit_core(p_order_id, false, p_product_key, p_quantity, p_brand_name, p_invite_url,
    p_scheduled_for, p_ad_text, p_note, p_ad_title, p_ad_footer, p_ad_image_url, p_ad_buttons);

  -- Campaign yang sudah antre tidak disinkronkan: tim menyesuaikan manual.
  select exists (select 1 from public.partnership_campaigns c where c.order_id = v_new.id and c.status <> 'draft')
    into v_locked;

  insert into public.bot_commands (bot_slug, type, payload, status, created_by)
  values (
    'vanillateID',
    'partner.order.report',
    public.partner_order_report_payload(v_new) || jsonb_build_object(
      'edited',         true,
      'editCount',      v_new.edit_count,
      'editedAt',       to_char(v_new.edited_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'orderStatus',    v_new.status,
      'campaignLocked', v_locked
    ),
    'pending',
    null
  );
end;
$$;

revoke execute on function public.partner_order_update(bigint, text, integer, text, text, date, text, text, text, text, text, jsonb) from public, anon;
grant  execute on function public.partner_order_update(bigint, text, integer, text, text, date, text, text, text, text, text, jsonb) to authenticated;

-- RPC: admin editor CMS mengubah pesanan partner --------------------------------
create or replace function public.partner_order_admin_update(
  p_order_id      bigint,
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
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_admin_editor() then
    raise exception 'Hanya admin editor yang boleh mengubah pesanan partner.' using errcode = '42501';
  end if;
  perform public.partner_order_edit_core(p_order_id, true, p_product_key, p_quantity, p_brand_name, p_invite_url,
    p_scheduled_for, p_ad_text, p_note, p_ad_title, p_ad_footer, p_ad_image_url, p_ad_buttons);
end;
$$;

revoke execute on function public.partner_order_admin_update(bigint, text, integer, text, text, date, text, text, text, text, text, jsonb) from public, anon;
grant  execute on function public.partner_order_admin_update(bigint, text, integer, text, text, date, text, text, text, text, text, jsonb) to authenticated;
