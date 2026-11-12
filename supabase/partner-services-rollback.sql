-- Rollback partner-services.sql. Riwayat layanan dan email ikut hilang.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'partner-services-tick';
  end if;
end;
$$;
drop trigger if exists partner_orders_to_service on public.partner_orders;
drop function if exists public.partner_orders_to_service();
drop function if exists public.partner_services_check_now();
drop function if exists public.partner_services_tick();
drop table if exists public.partner_service_notices;
drop table if exists public.partner_services;
drop function if exists public.partner_services_before();
alter table public.partner_accounts drop column if exists contact_email;
