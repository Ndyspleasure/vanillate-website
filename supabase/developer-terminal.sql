-- ════════════════════════════════════════════════════════════════════════════
--  Konsol Dev (Kontrol Server CMS) — pengetatan RLS bot_commands.
--
--  Konsol allowlist (perintah `sys.console.run`, bot: src/services/devConsole.js)
--  menuliskan keluaran perintah host (git/pm2/npm/node) ke bot_commands.result.
--  Keluaran itu bisa memuat info host (path, cabang, log proses), jadi baris
--  perintah `sys.*` HANYA boleh dibaca owner — bukan admin/viewer biasa.
--
--  Ini mempersempit policy SELECT yang lama (semua admin boleh baca semua).
--  Perilaku saat ini tidak berubah selama owner satu-satunya admin; pengetatan
--  baru terasa begitu ada admin non-owner. Aditif & idempoten (create or
--  replace policy via drop/create). INSERT & penjaga owner tidak disentuh.
--
--  Terapkan lewat Supabase MCP `apply_migration`. Rollback:
--  supabase/developer-terminal-rollback.sql.
-- ════════════════════════════════════════════════════════════════════════════

-- Admin boleh baca riwayat perintah; baris `sys.*` hanya untuk owner.
drop policy if exists "admin baca bot_commands" on public.bot_commands;
create policy "admin baca bot_commands" on public.bot_commands
  for select to authenticated
  using (
    public.is_admin()
    and (type not like 'sys.%' or public.is_owner())
  );
