begin;
create or replace function public.guard_admin_profile() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if current_user in ('anon', 'authenticated') and
     (new.role is distinct from old.role or new.id is distinct from old.id or new.username is distinct from old.username) then
    raise exception 'Protected admin identity must be managed server-side' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_admin_profile on public.admin_users;
create trigger guard_admin_profile before update on public.admin_users
for each row execute function public.guard_admin_profile();
revoke execute on function public.resolve_admin_login(text) from public, anon, authenticated;

-- At most 400 chronological samples; existing RLS still applies.
create or replace function public.admin_stats_series(p_days integer default 7)
returns setof public.bot_stats language sql stable security invoker
set search_path = '' as $$
  with ranked as (
    select s, row_number() over (order by captured_at desc, id desc) as rn,
      count(*) over () as total
    from public.bot_stats s
    where bot_slug in ('vanillateID','sambung-kata')
      and captured_at >= now() - make_interval(days => least(30,greatest(1,coalesce(p_days,7))))
  ), sampled as (
    select distinct on (floor((rn - 1) * 400.0 / greatest(total,1))) s
    from ranked
    order by floor((rn - 1) * 400.0 / greatest(total,1)), rn
  ) select (s).* from sampled order by (s).captured_at;
$$;
revoke all on function public.admin_stats_series(integer) from public, anon;
grant execute on function public.admin_stats_series(integer) to authenticated;

commit;
