-- ════════════════════════════════════════════════════════════════════════════
--  PULIHKAN DENGAN VOTE — sakelar di /admin/kontrol (bot: src/social/restore)
--
--  Streak Harian yang putus dan hitungan Counting yang direset bisa dipulihkan
--  dengan vote Top.gg. Diatur HANYA oleh tim Vanillate di CMS, bukan oleh admin
--  server (tidak ada setelan di Vanillate Dashboard). Syarat vote tidak bisa
--  ditawar: tanpa vote tidak ada pemulihan.
--
--  Murni ADITIF dan idempoten. Bawaan NYALA (value 'true').
--  Pemulihan: delete from bot_settings where key = 'social_vote_restore_enabled';
-- ════════════════════════════════════════════════════════════════════════════

insert into public.bot_setting_categories (key, label, description, icon, sort) values
  ('sosial', 'Sosial Hub', 'Aturan fitur Sosial Hub yang berlaku untuk semua server (Counting & Streak Harian).', 'toggle', 85)
on conflict (key) do nothing;

insert into public.bot_settings (key, label, value, kind, category, help, min_value, max_value, sort) values
  ('social_vote_restore_enabled', 'Pulihkan dengan vote', 'true', 'boolean', 'sosial',
   'Bawaan NYALA untuk semua server. Streak Harian yang putus sampai 3 hari bisa dipulihkan dengan 1 vote Top.gg milik pemiliknya; pesannya ditahan paling lama 12 jam menunggu vote. Counting yang direset (hitungan minimal 20) bisa dikembalikan dengan 1 vote dari siapa saja. Mematikan sakelar ini menghentikan penahanan pesan baru dan menyembunyikan tombol pulihkan, streak langsung mulai dari hari pertama. Admin server tidak bisa mengubahnya.', null, null, 10)
on conflict (key) do nothing;
