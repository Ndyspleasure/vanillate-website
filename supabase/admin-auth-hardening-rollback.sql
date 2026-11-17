-- Restores the previous access model, including its known weaknesses.
begin;
drop trigger if exists guard_admin_profile on public.admin_users;
drop function if exists public.guard_admin_profile();
grant execute on function public.resolve_admin_login(text) to anon, authenticated;
drop function if exists public.admin_stats_series(integer);

commit;
