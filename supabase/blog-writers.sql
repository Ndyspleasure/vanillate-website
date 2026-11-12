-- ════════════════════════════════════════════════════════════════════════════
--  Portal Penulis Blog (/blog/masuk). Acuan: docs/BLOG-PENULIS.md.
--
--  • blog_writers      : profil penulis (id = auth.users.id). Login Google,
--                        Discord wajib tertaut sebelum mengajukan tulisan.
--  • blog_submissions  : tulisan penulis sebelum/selagi terbit. Draf TIDAK
--                        pernah ke Sanity (dataset Sanity public).
--  • blog_review_log   : riwayat pengajuan, persetujuan, dan penolakan
--                        (beserta alasan).
--
--  Semua tabel RLS aktif TANPA policy dan tanpa hak untuk anon/authenticated:
--  akses hanya lewat Edge Function (`blog-writer`, `blog-admin`) memakai
--  service_role. Aturan bisnis (batas pengajuan, alur status) ada di fungsi
--  di bawah supaya atomik dan teruji; fungsi hanya bisa dipanggil service_role.
--
--  Aditif & idempoten. Terapkan lewat Supabase MCP `apply_migration`.
--  Rollback: supabase/blog-writers-rollback.sql.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.blog_writers (
  user_id          uuid primary key references auth.users (id) on delete cascade,
  display_name     text not null check (char_length(display_name) between 1 and 80),
  slug             text not null check (slug ~ '^[a-z0-9][a-z0-9-]{2,39}$'),
  bio              text not null default '' check (char_length(bio) <= 500),
  avatar_path      text check (avatar_path is null or char_length(avatar_path) <= 300),
  links            text[] not null default '{}'
                     check (cardinality(links) <= 5),
  discord_id       text check (discord_id is null or discord_id ~ '^[0-9]{15,25}$'),
  discord_username text check (discord_username is null or char_length(discord_username) <= 80),
  status           text not null default 'aktif' check (status in ('aktif', 'diblokir')),
  sanity_author_id text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index if not exists blog_writers_slug_key on public.blog_writers (slug);

comment on table public.blog_writers is
  'Penulis portal blog (login Google, Discord tertaut). Bukan admin_users. Akses hanya lewat Edge Function.';

create table if not exists public.blog_submissions (
  id               uuid primary key default gen_random_uuid(),
  writer_id        uuid not null references public.blog_writers (user_id) on delete cascade,
  title            text not null default '' check (char_length(title) <= 160),
  slug             text check (slug is null or slug ~ '^[a-z0-9][a-z0-9-]{2,99}$'),
  excerpt          text not null default '' check (char_length(excerpt) <= 300),
  tldr             text[] not null default '{}' check (cardinality(tldr) <= 6),
  body             text not null default '' check (char_length(body) <= 60000),
  categories       text[] not null default '{}' check (cardinality(categories) <= 5),
  tags             text[] not null default '{}' check (cardinality(tags) <= 10),
  main_image_path  text check (main_image_path is null or char_length(main_image_path) <= 300),
  main_image_alt   text not null default '' check (char_length(main_image_alt) <= 200),
  ai_image         boolean not null default false,
  image_paths      text[] not null default '{}' check (cardinality(image_paths) <= 10),
  status           text not null default 'draf'
                     check (status in ('draf', 'menunggu', 'ditolak', 'terbit')),
  reject_reason    text check (reject_reason is null or char_length(reject_reason) <= 500),
  revision_of      text,                      -- id dokumen Sanity bila ini revisi tulisan terbit
  sanity_id        text,
  submitted_at     timestamptz,
  reviewed_by      uuid references public.admin_users (id) on delete set null,
  reviewed_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint blog_submissions_ditolak_alasan
    check (status <> 'ditolak' or (reject_reason is not null and char_length(btrim(reject_reason)) >= 3)),
  constraint blog_submissions_terbit_sanity
    check (status <> 'terbit' or sanity_id is not null)
);
-- Slug tulisan baru unik (revisi memakai slug tulisan asalnya, jadi dikecualikan).
create unique index if not exists blog_submissions_slug_key
  on public.blog_submissions (slug) where slug is not null and revision_of is null;
-- Satu tulisan terbit hanya boleh punya satu revisi berjalan.
create unique index if not exists blog_submissions_revision_key
  on public.blog_submissions (revision_of) where revision_of is not null;
create index if not exists blog_submissions_writer_idx
  on public.blog_submissions (writer_id, updated_at desc);
create index if not exists blog_submissions_queue_idx
  on public.blog_submissions (submitted_at) where status = 'menunggu';

comment on table public.blog_submissions is
  'Tulisan penulis portal blog: draf, menunggu, ditolak (beserta alasan), terbit. Draf tidak pernah ke Sanity.';

create table if not exists public.blog_review_log (
  id             bigint generated always as identity primary key,
  submission_id  uuid not null references public.blog_submissions (id) on delete cascade,
  writer_id      uuid not null references public.blog_writers (user_id) on delete cascade,
  title          text not null,
  action         text not null check (action in ('ajukan', 'setujui', 'tolak')),
  reason         text check (reason is null or char_length(reason) <= 500),
  actor          uuid references public.admin_users (id) on delete set null,
  at             timestamptz not null default now()
);
create index if not exists blog_review_log_recent_idx on public.blog_review_log (id desc);
create index if not exists blog_review_log_submission_idx on public.blog_review_log (submission_id, id desc);

comment on table public.blog_review_log is
  'Riwayat pengajuan/persetujuan/penolakan tulisan. Ikut terhapus saat tulisan dihapus permanen.';

alter table public.blog_writers     enable row level security;
alter table public.blog_submissions enable row level security;
alter table public.blog_review_log  enable row level security;
revoke all on public.blog_writers     from anon, authenticated;
revoke all on public.blog_submissions from anon, authenticated;
revoke all on public.blog_review_log  from anon, authenticated;
grant all on public.blog_writers, public.blog_submissions, public.blog_review_log to service_role;

-- ─── updated_at + penjaga alur status ───────────────────────────────────────
-- Alur sah: draf → menunggu · menunggu → terbit | ditolak | draf (ditarik)
--           ditolak → draf | menunggu · terbit tidak berubah status.
create or replace function public.blog_submissions_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if not (
         (old.status = 'draf'     and new.status = 'menunggu')
      or (old.status = 'menunggu' and new.status in ('terbit', 'ditolak', 'draf'))
      or (old.status = 'ditolak'  and new.status in ('draf', 'menunggu'))
    ) then
      raise exception 'Perubahan status % -> % tidak diizinkan.', old.status, new.status
        using errcode = '22023';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists blog_submissions_guard on public.blog_submissions;
create trigger blog_submissions_guard
  before insert or update on public.blog_submissions
  for each row execute function public.blog_submissions_guard();
revoke execute on function public.blog_submissions_guard() from public, anon, authenticated;

create or replace function public.blog_writers_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists blog_writers_touch on public.blog_writers;
create trigger blog_writers_touch
  before update on public.blog_writers
  for each row execute function public.blog_writers_touch();
revoke execute on function public.blog_writers_touch() from public, anon, authenticated;

-- ─── Ajukan tulisan ─────────────────────────────────────────────────────────
-- Batas awal (ubah di sini bila perlu): maks. 3 tulisan menunggu sekaligus,
-- maks. 5 pengajuan dalam 24 jam. Isi, kata, dan gambar divalidasi lagi oleh
-- Edge Function (logic.ts) sebelum fungsi ini dipanggil.
create or replace function public.blog_submission_submit(p_id uuid, p_writer uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  w public.blog_writers%rowtype;
  s public.blog_submissions%rowtype;
  v_menunggu integer;
  v_hari integer;
begin
  select * into w from public.blog_writers where user_id = p_writer for update;
  if not found then
    raise exception 'Akun penulis tidak ditemukan.' using errcode = '22023';
  end if;
  if w.status <> 'aktif' then
    raise exception 'Akun penulis diblokir.' using errcode = '42501';
  end if;
  if w.discord_id is null then
    raise exception 'Tautkan Discord dulu sebelum mengajukan tulisan.' using errcode = '22023';
  end if;

  select * into s from public.blog_submissions where id = p_id and writer_id = p_writer for update;
  if not found then
    raise exception 'Tulisan tidak ditemukan.' using errcode = '22023';
  end if;
  if s.status not in ('draf', 'ditolak') then
    raise exception 'Hanya draf atau tulisan ditolak yang bisa diajukan.' using errcode = '22023';
  end if;
  if char_length(btrim(s.title)) < 5 then
    raise exception 'Judul minimal 5 karakter.' using errcode = '22023';
  end if;
  if s.slug is null then
    raise exception 'Slug wajib diisi.' using errcode = '22023';
  end if;

  select count(*) into v_menunggu from public.blog_submissions
    where writer_id = p_writer and status = 'menunggu';
  if v_menunggu >= 3 then
    raise exception 'Maksimal 3 tulisan menunggu persetujuan sekaligus.' using errcode = '53400';
  end if;
  select count(*) into v_hari from public.blog_review_log
    where writer_id = p_writer and action = 'ajukan' and at > now() - interval '24 hours';
  if v_hari >= 5 then
    raise exception 'Batas 5 pengajuan per 24 jam tercapai.' using errcode = '53400';
  end if;

  update public.blog_submissions
     set status = 'menunggu', submitted_at = now(), reject_reason = null,
         reviewed_by = null, reviewed_at = null
   where id = p_id;
  insert into public.blog_review_log (submission_id, writer_id, title, action)
    values (p_id, p_writer, s.title, 'ajukan');
end $$;

-- ─── Tinjau (setujui / tolak) ───────────────────────────────────────────────
-- Setujui revisi: baris revisi menggantikan baris tulisan terbit asalnya.
create or replace function public.blog_submission_review(
  p_id uuid, p_action text, p_actor uuid, p_reason text default null, p_sanity_id text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.blog_submissions%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  select * into s from public.blog_submissions where id = p_id for update;
  if not found then
    raise exception 'Tulisan tidak ditemukan.' using errcode = '22023';
  end if;
  if s.status <> 'menunggu' then
    raise exception 'Hanya tulisan berstatus menunggu yang bisa ditinjau.' using errcode = '22023';
  end if;

  if p_action = 'setujui' then
    if p_sanity_id is null or btrim(p_sanity_id) = '' then
      raise exception 'ID dokumen Sanity wajib saat menyetujui.' using errcode = '22023';
    end if;
    if s.revision_of is not null then
      delete from public.blog_submissions
        where status = 'terbit' and sanity_id = s.revision_of and id <> p_id;
    end if;
    update public.blog_submissions
       set status = 'terbit', sanity_id = p_sanity_id, reject_reason = null,
           revision_of = null, reviewed_by = p_actor, reviewed_at = now()
     where id = p_id;
  elsif p_action = 'tolak' then
    if v_reason is null or char_length(v_reason) < 3 then
      raise exception 'Alasan penolakan wajib diisi.' using errcode = '22023';
    end if;
    update public.blog_submissions
       set status = 'ditolak', reject_reason = v_reason,
           reviewed_by = p_actor, reviewed_at = now()
     where id = p_id;
  else
    raise exception 'Aksi tidak dikenal: %', p_action using errcode = '22023';
  end if;

  insert into public.blog_review_log (submission_id, writer_id, title, action, reason, actor)
    values (p_id, s.writer_id, s.title, p_action, case when p_action = 'tolak' then v_reason end, p_actor);
  return jsonb_build_object('writer_id', s.writer_id, 'title', s.title, 'slug', s.slug);
end $$;

-- ─── Revisi tulisan terbit ──────────────────────────────────────────────────
-- Menyalin tulisan terbit menjadi draf baru (versi lama tetap tayang).
create or replace function public.blog_submission_revise(p_id uuid, p_writer uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.blog_submissions%rowtype;
  v_new uuid;
begin
  select * into s from public.blog_submissions
    where id = p_id and writer_id = p_writer and status = 'terbit' and revision_of is null;
  if not found then
    raise exception 'Hanya tulisan terbit milikmu yang bisa direvisi.' using errcode = '22023';
  end if;
  if exists (select 1 from public.blog_submissions where revision_of = s.sanity_id) then
    raise exception 'Tulisan ini sudah punya revisi berjalan.' using errcode = '22023';
  end if;
  insert into public.blog_submissions (
      writer_id, title, slug, excerpt, tldr, body, categories, tags,
      main_image_path, main_image_alt, ai_image, image_paths, revision_of)
    values (
      s.writer_id, s.title, s.slug, s.excerpt, s.tldr, s.body, s.categories, s.tags,
      s.main_image_path, s.main_image_alt, s.ai_image, s.image_paths, s.sanity_id)
    returning id into v_new;
  return v_new;
end $$;

-- ─── Hapus permanen ─────────────────────────────────────────────────────────
-- Mengembalikan path berkas Storage yang harus dihapus Edge Function.
create or replace function public.blog_submission_delete(p_id uuid)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.blog_submissions%rowtype;
  v_paths text[];
begin
  delete from public.blog_submissions where id = p_id returning * into s;
  if not found then
    raise exception 'Tulisan tidak ditemukan.' using errcode = '22023';
  end if;
  select coalesce(array_agg(distinct p), '{}') into v_paths
    from unnest(s.image_paths || array[s.main_image_path]) as p
    where p is not null;
  return v_paths;
end $$;

-- Hanya service_role (Edge Function) yang boleh memanggil fungsi aturan.
revoke execute on function public.blog_submission_submit(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.blog_submission_review(uuid, text, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.blog_submission_revise(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.blog_submission_delete(uuid) from public, anon, authenticated;
grant  execute on function public.blog_submission_submit(uuid, uuid) to service_role;
grant  execute on function public.blog_submission_review(uuid, text, uuid, text, text) to service_role;
grant  execute on function public.blog_submission_revise(uuid, uuid) to service_role;
grant  execute on function public.blog_submission_delete(uuid) to service_role;

-- ─── Bucket Storage privat untuk gambar sementara ───────────────────────────
-- Dilewati di Postgres biasa (tes lokal) yang tidak punya skema storage.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('blog-penulis', 'blog-penulis', false, 2097152,
            array['image/webp', 'image/jpeg', 'image/png'])
    on conflict (id) do nothing;
  end if;
end $$;
