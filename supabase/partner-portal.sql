-- ════════════════════════════════════════════════════════════════════════════
--  Portal Partner (/partnership/masuk). Acuan: docs/PARTNER-PORTAL.md.
--
--  • partner_accounts : profil akun partner (id = auth.users.id). Akun dibuat
--                       dan dihapus owner lewat Edge Function `partner-admin`.
--  • partner_orders   : CATATAN pesanan partner (pesan sebenarnya lewat
--                       WhatsApp). Partner hanya bisa MEMBACA barisnya sendiri
--                       (RLS) dan menambah lewat RPC partner_order_submit().
--  • Trigger          : pesanan baru -> bot_commands `partner.order.report`
--                       (created_by NULL, hanya mungkin dari trigger/service
--                       role) -> bot melapor ke channel Discord.
--
--  Aditif & idempoten. Terapkan lewat Supabase MCP `apply_migration`.
--  Rollback: supabase/partner-portal-rollback.sql.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.partner_accounts (
  id                      uuid primary key references auth.users (id) on delete cascade,
  username                text not null
                            check (username ~ '^[a-z0-9][a-z0-9_.-]{2,31}$'),
  display_name            text not null check (char_length(display_name) between 1 and 80),
  must_change_credentials boolean not null default true,
  created_by              uuid references public.admin_users (id) on delete set null,
  created_at              timestamptz not null default now()
);
create unique index if not exists partner_accounts_username_key
  on public.partner_accounts (username);

comment on table public.partner_accounts is
  'Akun partner (login /partnership/masuk). Dibuat/dihapus owner lewat Edge Function partner-admin. Partner bukan admin_users.';

create table if not exists public.partner_orders (
  id            bigint generated always as identity primary key,
  partner_id    uuid references public.partner_accounts (id) on delete set null,
  partner_name  text not null,                     -- snapshot, riwayat tetap ada bila akun dihapus
  product_key   text,
  product_name  text not null,                     -- snapshot dari katalog
  price_text    text not null,                     -- snapshot, bukan input partner
  brand_name    text not null check (char_length(brand_name) between 1 and 80),
  invite_url    text check (invite_url is null or (invite_url ~ '^https://[^[:space:]]+$' and char_length(invite_url) <= 300)),
  scheduled_for date,
  ad_text       text check (ad_text is null or char_length(ad_text) <= 2000),
  note          text check (note is null or char_length(note) <= 1000),
  status        text not null default 'dicatat'
                  check (status in ('dicatat', 'diproses', 'berjalan', 'selesai', 'dibatalkan')),
  status_note   text check (status_note is null or char_length(status_note) <= 300),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists partner_orders_partner_idx on public.partner_orders (partner_id, id desc);
create index if not exists partner_orders_recent_idx  on public.partner_orders (id desc);

comment on table public.partner_orders is
  'Catatan pesanan partner. Partner hanya membaca miliknya (RLS); INSERT hanya lewat RPC partner_order_submit; status diubah editor CMS.';

alter table public.partner_accounts enable row level security;
alter table public.partner_orders   enable row level security;

revoke all on public.partner_accounts from anon, authenticated;
revoke all on public.partner_orders   from anon, authenticated;
grant select on public.partner_accounts to authenticated;
grant select on public.partner_orders   to authenticated;
-- Editor CMS hanya boleh mengubah status; kolom lain tertutup.
grant update (status, status_note) on public.partner_orders to authenticated;

drop policy if exists "partner baca akun sendiri" on public.partner_accounts;
create policy "partner baca akun sendiri" on public.partner_accounts
  for select to authenticated using (id = auth.uid());

drop policy if exists "admin baca akun partner" on public.partner_accounts;
create policy "admin baca akun partner" on public.partner_accounts
  for select to authenticated using (public.is_admin());

drop policy if exists "partner baca pesanan sendiri" on public.partner_orders;
create policy "partner baca pesanan sendiri" on public.partner_orders
  for select to authenticated using (partner_id = auth.uid());

drop policy if exists "admin baca pesanan partner" on public.partner_orders;
create policy "admin baca pesanan partner" on public.partner_orders
  for select to authenticated using (public.is_admin());

drop policy if exists "editor ubah status pesanan partner" on public.partner_orders;
create policy "editor ubah status pesanan partner" on public.partner_orders
  for update to authenticated
  using (public.is_admin_editor())
  with check (public.is_admin_editor());

-- updated_at otomatis ----------------------------------------------------------
create or replace function public.partner_orders_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function public.partner_orders_touch() from public, anon, authenticated;

drop trigger if exists partner_orders_touch on public.partner_orders;
create trigger partner_orders_touch
  before update on public.partner_orders
  for each row execute function public.partner_orders_touch();

-- RPC: partner mencatat pesanan ----------------------------------------------
create or replace function public.partner_order_submit(
  p_product_key   text,
  p_brand_name    text,
  p_invite_url    text default null,
  p_scheduled_for date default null,
  p_ad_text       text default null,
  p_note          text default null
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
  v_price   text;
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

  if (select count(*) from public.partner_orders
       where partner_id = v_uid and created_at > now() - interval '1 day') >= 10 then
    raise exception 'Batas 10 catatan pesanan per hari tercapai. Coba lagi besok.' using errcode = '54000';
  end if;

  v_price := case
    when v_prod.price is null then 'Harga belum ditentukan'
    else 'Rp ' || replace(to_char(round(v_prod.price), 'FM999,999,999,999,999,999'), ',', '.')
         || coalesce(' ' || nullif(btrim(v_prod.price_unit), ''), '')
  end;

  insert into public.partner_orders
    (partner_id, partner_name, product_key, product_name, price_text,
     brand_name, invite_url, scheduled_for, ad_text, note)
  values
    (v_uid, v_acc.display_name, v_prod.key, v_prod.name, v_price,
     v_brand, v_url, p_scheduled_for, v_ad, v_note)
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.partner_order_submit(text, text, text, date, text, text) from public, anon;
grant  execute on function public.partner_order_submit(text, text, text, date, text, text) to authenticated;

-- Trigger: laporan ke bot -----------------------------------------------------
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
      'brandName',    new.brand_name,
      'inviteUrl',    coalesce(new.invite_url, ''),
      'scheduledFor', coalesce(new.scheduled_for::text, ''),
      'adText',       coalesce(new.ad_text, ''),
      'note',         coalesce(new.note, ''),
      'createdAt',    to_char(new.created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    ),
    'pending',
    null
  );
  return new;
end;
$$;
revoke execute on function public.partner_orders_report() from public, anon, authenticated;

drop trigger if exists partner_orders_report on public.partner_orders;
create trigger partner_orders_report
  after insert on public.partner_orders
  for each row execute function public.partner_orders_report();
