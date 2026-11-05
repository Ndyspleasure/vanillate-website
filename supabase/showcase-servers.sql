-- ════════════════════════════════════════════════════════════════════════════
--  🌐 Showcase Server — daftar server pemakai bot di website vanillate.id
--
--  Bot (sambung-kata-bot: src/showcase/) menerbitkan daftar server yang tampil
--  sebagai SATU baris `showcase_snapshot` (diganti utuh tiap terbit, jadi server
--  yang bot-nya keluar otomatis hilang, tanpa sisa data). Tim Vanillate bisa
--  menyembunyikan server lewat `showcase_hidden` di /admin/showcase. Website
--  memanggil RPC `showcase_public_list()` (anon) saat build; fungsi itu yang
--  menyaring server tersembunyi, jadi daftar tinjauan TIDAK pernah publik.
--
--  Tabel ini di proyek CMS (lvfwopnvvqncopvathop), BUKAN Database Bot: tidak ada
--  data pemain, hanya data yang memang tampil di halaman publik.
--
--  Aditif & idempoten. Terapkan lewat Supabase MCP `apply_migration`.
--  Rollback: supabase/showcase-servers-rollback.sql.
--  Tes: supabase/tests/showcase-servers.test.sql.
--  Acuan: docs/SHOWCASE-SERVER.md · repo bot docs/showcase-server.md
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. Daftar terbitan bot (1 baris per bot_slug) ───────────────────────────
-- data = [{ i: id server, n: nama, h: hash ikon|null, m: member (kasar), v?: kode undangan }]
create table if not exists public.showcase_snapshot (
  bot_slug   text primary key,
  data       jsonb not null default '[]'::jsonb check (jsonb_typeof(data) = 'array'),
  total      integer not null default 0 check (total >= 0),
  updated_at timestamptz not null default now()
);

comment on table public.showcase_snapshot is
  'Daftar server yang tampil di website, DITERBITKAN bot (service_role) dan diganti utuh. Tidak ada policy anon: publik lewat showcase_public_list().';

-- ─── 2. Server yang disembunyikan tim Vanillate ──────────────────────────────
-- Hanya ID + kode alasan + catatan internal. Nama/ikon/link tidak disimpan.
create table if not exists public.showcase_hidden (
  guild_id  text primary key check (guild_id ~ '^[0-9]{15,22}$'),
  reason    text not null default 'review' check (reason in ('review', 'nsfw', 'violation', 'other')),
  note      text check (note is null or char_length(note) <= 500),
  hidden_by uuid references public.admin_users(id) on delete set null,
  hidden_at timestamptz not null default now()
);

comment on table public.showcase_hidden is
  'Server yang tidak ditampilkan karena tinjauan. Dibaca bot (service_role) untuk teks netral di dashboard; alasan/catatan tidak pernah keluar dari CMS.';

-- Riwayat siapa/kapan/alasan (tanpa nama server).
create table if not exists public.showcase_hidden_log (
  id        bigserial primary key,
  guild_id  text not null,
  action    text not null check (action in ('hide', 'update', 'unhide')),
  reason    text,
  note      text,
  actor     uuid,
  at        timestamptz not null default now()
);
create index if not exists showcase_hidden_log_guild_idx on public.showcase_hidden_log (guild_id, id desc);

create or replace function public.showcase_hidden_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.showcase_hidden_log (guild_id, action, reason, note, actor)
    values (new.guild_id, 'hide', new.reason, new.note, coalesce(new.hidden_by, auth.uid()));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.showcase_hidden_log (guild_id, action, reason, note, actor)
    values (new.guild_id, 'update', new.reason, new.note, auth.uid());
    return new;
  end if;
  insert into public.showcase_hidden_log (guild_id, action, reason, note, actor)
  values (old.guild_id, 'unhide', old.reason, old.note, auth.uid());
  return old;
end;
$$;

drop trigger if exists showcase_hidden_audit_trg on public.showcase_hidden;
create trigger showcase_hidden_audit_trg
  after insert or update or delete on public.showcase_hidden
  for each row execute function public.showcase_hidden_audit();

-- ─── 3. RLS ──────────────────────────────────────────────────────────────────
-- Admin membaca; editor (owner/admin) mengelola daftar tersembunyi. Bot memakai
-- service_role (mem-bypass RLS). Tanpa policy untuk anon.
alter table public.showcase_snapshot   enable row level security;
alter table public.showcase_hidden     enable row level security;
alter table public.showcase_hidden_log enable row level security;

drop policy if exists "admin baca showcase_snapshot" on public.showcase_snapshot;
create policy "admin baca showcase_snapshot" on public.showcase_snapshot
  for select to authenticated using (public.is_admin());

drop policy if exists "admin baca showcase_hidden" on public.showcase_hidden;
create policy "admin baca showcase_hidden" on public.showcase_hidden
  for select to authenticated using (public.is_admin());
drop policy if exists "editor kelola showcase_hidden" on public.showcase_hidden;
create policy "editor kelola showcase_hidden" on public.showcase_hidden
  for all to authenticated
  using (public.is_admin_editor()) with check (public.is_admin_editor());

drop policy if exists "admin baca showcase_hidden_log" on public.showcase_hidden_log;
create policy "admin baca showcase_hidden_log" on public.showcase_hidden_log
  for select to authenticated using (public.is_admin());

-- ─── 4. RPC publik: daftar yang sudah disaring ───────────────────────────────
-- Dipanggil website saat build (anon key) dan halaman publik. Hanya mengembalikan
-- server yang TIDAK ada di showcase_hidden. Tidak membocorkan daftar tinjauan.
create or replace function public.showcase_public_list(p_bot_slug text default 'vanillateID')
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'updated_at', (select s.updated_at from public.showcase_snapshot s where s.bot_slug = p_bot_slug),
    'servers', coalesce((
      select jsonb_agg(e order by e ->> 'i')
      from public.showcase_snapshot s
      cross join lateral jsonb_array_elements(s.data) e
      where s.bot_slug = p_bot_slug
        and not exists (select 1 from public.showcase_hidden h where h.guild_id = e ->> 'i')
    ), '[]'::jsonb)
  );
$$;

revoke execute on function public.showcase_public_list(text) from public;
grant execute on function public.showcase_public_list(text) to anon, authenticated;
