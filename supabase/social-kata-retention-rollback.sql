-- ════════════════════════════════════════════════════════════════════════════
--  ROLLBACK — Retensi salinan Pemantau Kata-Kata (supabase/social-kata-retention.sql).
--  Mencabut jadwal & fungsi pembersih. Isi yang SUDAH dibersihkan tidak bisa
--  dikembalikan. Ekstensi pg_cron dibiarkan (dipakai job lain).
-- ════════════════════════════════════════════════════════════════════════════

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    execute $sql$select cron.unschedule(jobid) from cron.job where jobname = 'prune-social-kata-results'$sql$;
  end if;
end;
$$;

drop function if exists public.prune_social_kata_results(integer);
