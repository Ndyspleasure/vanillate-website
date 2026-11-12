-- ════════════════════════════════════════════════════════════════════════════
-- PEMANTAUAN LAYANAN PARTNER (Broadcast Lobby, Hosting Bot, dst.)
--
-- Satu tempat untuk semua layanan berbatas waktu milik partner:
--   • Broadcast Lobby  → dibuat OTOMATIS saat pesanan berstatus 'berjalan'
--                        (satuan Hari: mulai = tanggal tayang, selesai = mulai + jumlah hari).
--   • Hosting Bot dll. → dicatat owner/admin di /admin/partnership/layanan.
--
-- Pemeriksa harian (pg_cron) memakai tanggal WIB:
--   1. layanan lewat masa → status 'habis';
--   2. antre email pengingat H-5 (5 hari sebelum habis) dan email 'habis';
--   3. bila ada email menunggu, memanggil Edge Function `partner-reminders`
--      (pg_net) yang mengirim lewat Resend. Hari tanpa email menunggu = nol panggilan HTTP.
--
-- Biaya: satu UPDATE + dua INSERT berindeks per hari. Tanpa polling, tanpa
-- snapshot bot. Partner membaca miliknya satu SELECT saat dashboard dibuka.
--
-- Aditif & idempoten (dijalankan dua kali aman). Rollback: partner-services-rollback.sql
-- Prasyarat: partner-portal.sql, fungsi is_admin()/is_admin_editor().
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Email kontak partner (diisi partner saat mengganti kredensial pertama kali)
alter table public.partner_accounts
  add column if not exists contact_email text
  check (contact_email is null or (char_length(contact_email) <= 254 and contact_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'));

-- 2. Layanan berbatas waktu
create table if not exists public.partner_services (
  id           bigint generated always as identity primary key,
  partner_id   uuid references public.partner_accounts (id) on delete set null,
  partner_name text not null default '',            -- snapshot, riwayat tetap bila akun dihapus
  kind         text not null check (kind in ('lobby', 'hosting_bot', 'lainnya')),
  label        text not null check (char_length(label) between 1 and 120),
  order_id     bigint references public.partner_orders (id) on delete set null,
  starts_on    date not null,
  ends_on      date not null,                       -- hari aktif TERAKHIR (inklusif)
  status       text not null default 'aktif' check (status in ('aktif', 'habis', 'dihentikan')),
  note         text check (note is null or char_length(note) <= 500),
  created_by   uuid references public.admin_users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create unique index if not exists partner_services_order_uidx on public.partner_services (order_id) where order_id is not null;
create index if not exists partner_services_due_idx     on public.partner_services (ends_on) where status = 'aktif';
create index if not exists partner_services_partner_idx on public.partner_services (partner_id, id desc);

comment on table public.partner_services is
  'Layanan berbatas waktu milik partner (Lobby, Hosting Bot). Dipantau pemeriksa harian. Partner hanya membaca miliknya (RLS).';

-- 3. Antrean email (outbox) agar pengiriman idempoten dan bisa diaudit
create table if not exists public.partner_service_notices (
  id         bigint generated always as identity primary key,
  service_id bigint not null references public.partner_services (id) on delete cascade,
  kind       text not null check (kind in ('h5', 'habis')),
  ends_on    date not null,                         -- masa berakhir yang diingatkan (perpanjangan = pengingat baru)
  to_email   text,
  status     text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  attempts   integer not null default 0,
  error      text check (error is null or char_length(error) <= 300),
  created_at timestamptz not null default now(),
  sent_at    timestamptz,
  unique (service_id, kind, ends_on)
);
create index if not exists partner_service_notices_pending_idx on public.partner_service_notices (id) where status = 'pending';

comment on table public.partner_service_notices is
  'Outbox email pengingat layanan partner. Ditulis pemeriksa harian, dikirim Edge Function partner-reminders.';

alter table public.partner_services        enable row level security;
alter table public.partner_service_notices enable row level security;

revoke all on public.partner_services        from anon, authenticated;
revoke all on public.partner_service_notices from anon, authenticated;
grant select on public.partner_services        to authenticated;
grant select on public.partner_service_notices to authenticated;
grant insert, update, delete on public.partner_services to authenticated;

drop policy if exists "partner baca layanan sendiri" on public.partner_services;
create policy "partner baca layanan sendiri" on public.partner_services
  for select to authenticated using (partner_id = auth.uid());
drop policy if exists "admin baca layanan partner" on public.partner_services;
create policy "admin baca layanan partner" on public.partner_services
  for select to authenticated using (public.is_admin());
drop policy if exists "editor kelola layanan partner" on public.partner_services;
create policy "editor kelola layanan partner" on public.partner_services
  for all to authenticated
  using (public.is_admin_editor()) with check (public.is_admin_editor());
drop policy if exists "admin baca email layanan" on public.partner_service_notices;
create policy "admin baca email layanan" on public.partner_service_notices
  for select to authenticated using (public.is_admin());

-- 4. Trigger: isi snapshot nama, rapikan status saat diperpanjang
create or replace function public.partner_services_before()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
begin
  if tg_op = 'INSERT' and btrim(coalesce(new.partner_name, '')) = '' and new.partner_id is not null then
    select display_name into new.partner_name from public.partner_accounts where id = new.partner_id;
    new.partner_name := coalesce(new.partner_name, '');
  end if;
  if tg_op = 'UPDATE' then
    new.updated_at := now();
    -- Diperpanjang setelah habis → aktif lagi (pengingat baru dibuat untuk ends_on baru).
    if new.ends_on is distinct from old.ends_on and new.status = 'habis' and new.ends_on >= v_today then
      new.status := 'aktif';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.partner_services_before() from public, anon, authenticated;

drop trigger if exists partner_services_before on public.partner_services;
create trigger partner_services_before
  before insert or update on public.partner_services
  for each row execute function public.partner_services_before();

-- 5. Pesanan berstatus 'berjalan' dengan satuan Hari → layanan Lobby otomatis
create or replace function public.partner_orders_to_service()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start date;
begin
  if new.status = 'berjalan'
     and (tg_op = 'INSERT' or old.status is distinct from 'berjalan')
     and lower(btrim(coalesce(new.unit, ''))) = 'hari'
     and new.quantity >= 1 then
    v_start := coalesce(new.scheduled_for, (now() at time zone 'Asia/Jakarta')::date);
    insert into public.partner_services
      (partner_id, partner_name, kind, label, order_id, starts_on, ends_on)
    values
      (new.partner_id, new.partner_name, 'lobby', new.product_name || ' (' || new.brand_name || ')',
       new.id, v_start, v_start + (new.quantity - 1))
    on conflict (order_id) where order_id is not null do nothing;
  end if;
  return new;
end;
$$;
revoke execute on function public.partner_orders_to_service() from public, anon, authenticated;

drop trigger if exists partner_orders_to_service on public.partner_orders;
create trigger partner_orders_to_service
  after insert or update of status on public.partner_orders
  for each row execute function public.partner_orders_to_service();

-- 6. Pemeriksa harian (tanggal WIB). Mengembalikan jumlah email menunggu.
create or replace function public.partner_services_tick()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today   date := (now() at time zone 'Asia/Jakarta')::date;
  v_habis   integer := 0;
  v_h5      integer := 0;
  v_expired integer := 0;
  v_pending integer := 0;
  v_secret  text;
  v_url     constant text := 'https://lvfwopnvvqncopvathop.supabase.co/functions/v1/partner-reminders';
begin
  -- 1. Lewat masa → habis, dan antre email 'habis' untuk yang baru saja habis.
  with kena as (
    update public.partner_services set status = 'habis'
     where status = 'aktif' and ends_on < v_today
    returning id, partner_id, ends_on
  ), ins as (
    insert into public.partner_service_notices (service_id, kind, ends_on, to_email, status, error)
    select k.id, 'habis', k.ends_on, a.contact_email,
           case when a.contact_email is null then 'skipped' else 'pending' end,
           case when a.contact_email is null then 'Email kontak partner belum diisi.' end
      from kena k left join public.partner_accounts a on a.id = k.partner_id
    on conflict (service_id, kind, ends_on) do nothing
    returning 1
  )
  select (select count(*) from kena), (select count(*) from ins) into v_habis, v_expired;

  -- 2. H-5: layanan aktif yang berakhir dalam 5 hari (termasuk hari ini).
  with ins as (
    insert into public.partner_service_notices (service_id, kind, ends_on, to_email, status, error)
    select s.id, 'h5', s.ends_on, a.contact_email,
           case when a.contact_email is null then 'skipped' else 'pending' end,
           case when a.contact_email is null then 'Email kontak partner belum diisi.' end
      from public.partner_services s left join public.partner_accounts a on a.id = s.partner_id
     where s.status = 'aktif' and s.ends_on <= v_today + 5
    on conflict (service_id, kind, ends_on) do nothing
    returning 1
  )
  select count(*) into v_h5 from ins;

  select count(*) into v_pending from public.partner_service_notices where status = 'pending' and attempts < 3;

  -- 3. Panggil pengirim hanya bila ada yang menunggu (pg_net bisa tak ada di Postgres lokal).
  if v_pending > 0 and to_regnamespace('net') is not null then
    if to_regnamespace('vault') is not null then
      begin
        execute $q$select decrypted_secret from vault.decrypted_secrets where name = 'partner_reminder_secret' limit 1$q$
          into v_secret;
      exception when others then
        v_secret := null;
      end;
    end if;
    execute $q$select net.http_post(url := $1, headers := $2, body := '{}'::jsonb)$q$
      using v_url,
            jsonb_build_object('Content-Type', 'application/json')
              || case when v_secret is not null then jsonb_build_object('x-cron-secret', v_secret) else '{}'::jsonb end;
  end if;

  return jsonb_build_object('habis', v_habis, 'h5_baru', v_h5, 'habis_baru', v_expired, 'menunggu', v_pending);
end;
$$;
revoke all on function public.partner_services_tick() from public, anon, authenticated;
grant execute on function public.partner_services_tick() to service_role;

-- 7. Tombol "Periksa sekarang" di CMS: editor saja, memakai pemeriksa yang sama.
create or replace function public.partner_services_check_now()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin_editor() then
    raise exception 'Hanya editor CMS yang boleh menjalankan pemeriksaan.' using errcode = '42501';
  end if;
  return public.partner_services_tick();
end;
$$;
revoke all on function public.partner_services_check_now() from public, anon;
grant execute on function public.partner_services_check_now() to authenticated;

-- 8. Jadwal harian 01.05 UTC (08.05 WIB). Tanpa pg_cron jadwal dilewati dengan NOTICE.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    execute $sql$select cron.schedule('partner-services-tick', '5 1 * * *', 'select public.partner_services_tick()')$sql$;
  else
    raise notice 'pg_cron tidak tersedia: jadwal partner-services-tick tidak dipasang';
  end if;
end;
$$;
