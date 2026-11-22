-- Prasyarat tes: bentuk tabel dan RLS bot_settings. HANYA untuk Postgres lokal.
create role anon; create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create table public.admin_users(id uuid primary key, role text);
create function public.is_admin_editor() returns boolean language sql stable security definer as
  $$ select exists(select 1 from public.admin_users where id = auth.uid() and role in ('owner','admin','editor')) $$;
create function public.is_admin() returns boolean language sql stable security definer as
  $$ select exists(select 1 from public.admin_users where id = auth.uid()) $$;
create table public.bot_settings(
  key text primary key, bot_slug text, label text, value text, kind text not null, category text, help text,
  min_value numeric, max_value numeric, sort integer, updated_at timestamptz not null default now(),
  updated_by uuid references public.admin_users(id) on delete set null,
  constraint bot_settings_kind_check check (kind in ('text','markdown','url','boolean','number')));
create table public.bot_settings_audit(id bigserial primary key, key text, old_value text, new_value text, changed_by uuid, changed_at timestamptz default now());
create function public.log_bot_settings_change() returns trigger language plpgsql security definer set search_path='' as $$
begin if new.value is distinct from old.value then
  insert into public.bot_settings_audit(key, old_value, new_value, changed_by) values (new.key, old.value, new.value, new.updated_by);
end if; return new; end $$;
create trigger trg_bot_settings_audit after update on public.bot_settings for each row execute function public.log_bot_settings_change();
alter table public.bot_settings enable row level security;
create policy "admin baca" on public.bot_settings for select to authenticated using (public.is_admin());
create policy "editor ubah" on public.bot_settings for update to authenticated using (public.is_admin_editor()) with check (public.is_admin_editor());
grant select, update on public.bot_settings to authenticated;
grant usage on schema auth, public to authenticated, anon;
grant execute on function auth.uid(), public.is_admin_editor(), public.is_admin() to authenticated;
insert into public.admin_users values ('00000000-0000-0000-0000-0000000000a1','owner'), ('00000000-0000-0000-0000-0000000000b2','viewer');
insert into public.bot_settings(key,label,value,kind,min_value,max_value,updated_at) values
 ('f_bool','b','true','boolean',null,null,'2026-01-01'),
 ('f_waiting','w',null,'boolean',null,null,'2026-01-01'),
 ('tunable_min_players','min','2','number',2,10,'2026-01-01'),
 ('tunable_max_players','max','6','number',2,10,'2026-01-01'),
 ('f_url','u','','url',null,null,'2026-01-01');
grant select on public.bot_settings_audit to authenticated;
