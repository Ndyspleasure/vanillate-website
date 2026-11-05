-- ════════════════════════════════════════════════════════════════════════════
--  ROLLBACK supabase/showcase-servers.sql — hanya bila Showcase Server
--  ditinggalkan. Menghapus daftar terbitan, daftar tinjauan, dan riwayatnya.
--  Bot tetap jalan: tanpa tabel ini penerbit hanya mencatat peringatan.
--  Website membangun tanpa seksi daftar server.
-- ════════════════════════════════════════════════════════════════════════════

drop function if exists public.showcase_public_list(text);
drop trigger if exists showcase_hidden_audit_trg on public.showcase_hidden;
drop function if exists public.showcase_hidden_audit();
drop table if exists public.showcase_hidden_log;
drop table if exists public.showcase_hidden;
drop table if exists public.showcase_snapshot;
