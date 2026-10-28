-- ════════════════════════════════════════════════════════════════════════════
--  Retensi salinan ✍️ Pemantau Kata-Kata di `bot_commands`.
--
--  Setiap kali Social Monitor (/admin/developer/sosial) membuka daftar
--  kata-kata satu server, bot menjawab perintah `social.kata` dengan satu
--  halaman tulisan — termasuk ISI tulisan member — di `bot_commands.result`.
--  Salinan itu tidak pernah diperbarui, jadi tulisan yang sudah terkirim,
--  dihapus penulisnya, atau dihapus admin (sudah dikosongkan di database bot)
--  masih tertinggal di Supabase. Panel hanya butuh hasilnya beberapa detik.
--
--  Aditif & idempoten (aman dijalankan ulang):
--    1. public.prune_social_kata_results(p_minutes) — salinan `social.kata`
--       yang lebih tua dari p_minutes menit: `result.entries` dikosongkan
--       (diganti `[]`, ditandai `entriesPruned: true`). Ringkasan angka & baris
--       perintahnya tetap (riwayat audit). Mengembalikan jumlah baris yang
--       dibersihkan. Hanya service_role / postgres yang boleh memanggil.
--    2. pg_cron: job `prune-social-kata-results` tiap 15 menit (salinan > 60
--       menit). Bila pg_cron tidak tersedia (Postgres lokal untuk tes), jadwal
--       dilewati dengan NOTICE — fungsi tetap terpasang.
--  Rollback: supabase/social-kata-retention-rollback.sql (isi yang sudah
--  dibersihkan tidak bisa dikembalikan; riwayat lengkap ada di channel arsip
--  Discord bot).
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Fungsi pembersih
create or replace function public.prune_social_kata_results(p_minutes integer default 60)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  if p_minutes is null or p_minutes < 5 then
    raise exception 'prune_social_kata_results: p_minutes minimal 5 (diberi %)', p_minutes;
  end if;
  update public.bot_commands
     set result = jsonb_set(result, '{entries}', '[]'::jsonb) || '{"entriesPruned": true}'::jsonb
   where type = 'social.kata'
     and jsonb_typeof(result) = 'object'
     and jsonb_typeof(result -> 'entries') = 'array'
     and jsonb_array_length(result -> 'entries') > 0
     and coalesce(processed_at, created_at) < now() - make_interval(mins => p_minutes);
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.prune_social_kata_results(integer) from public;
revoke all on function public.prune_social_kata_results(integer) from anon, authenticated;
grant execute on function public.prune_social_kata_results(integer) to service_role;

-- 2. Jadwal tiap 15 menit (pg_cron)
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    execute $sql$select cron.schedule('prune-social-kata-results', '*/15 * * * *',
                                      'select public.prune_social_kata_results(60)')$sql$;
  else
    raise notice 'pg_cron tidak tersedia — jadwal prune-social-kata-results tidak dipasang';
  end if;
end;
$$;
