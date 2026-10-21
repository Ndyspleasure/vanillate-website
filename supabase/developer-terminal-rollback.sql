-- ════════════════════════════════════════════════════════════════════════════
--  ROLLBACK supabase/developer-terminal.sql — kembalikan policy SELECT
--  bot_commands ke versi lama (semua admin boleh baca semua baris, termasuk
--  `sys.*`). Tidak menghapus data apa pun.
-- ════════════════════════════════════════════════════════════════════════════

drop policy if exists "admin baca bot_commands" on public.bot_commands;
create policy "admin baca bot_commands" on public.bot_commands
  for select to authenticated using (public.is_admin());
