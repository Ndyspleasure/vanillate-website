-- ════════════════════════════════════════════════════════════════════════════
--  MODE HEMAT SUMBER DAYA — toggle di /admin/kontrol (bot: src/services/powerSaver.js)
--
--  Menurunkan trafik bot ke Supabase CMS (snapshot, polling antrean, sinkron
--  statistik/pemain/promo/kata, log INFO) saat kuota paket gratis hampir habis.
--  Murni ADITIF dan idempoten. value NULL = bot mengadopsi nilai lokalnya
--  (sekarang NYALA), jadi bot langsung mengadopsi mode hemat.
--  Pemulihan: delete from bot_settings where key = 'power_saver_enabled';
-- ════════════════════════════════════════════════════════════════════════════

insert into public.bot_setting_categories (key, label, description, icon, sort) values
  ('hemat', 'Hemat Sumber Daya', 'Kurangi trafik bot ke Supabase saat kuota (egress, request, log) hampir habis.', 'toggle', 90)
on conflict (key) do nothing;

insert into public.bot_settings (key, label, value, kind, category, help, min_value, max_value, sort) values
  ('power_saver_enabled', 'Mode hemat sumber daya', 'true', 'boolean', 'hemat',
   'Bawaan NYALA. Bot mengirim dan menarik data ke Supabase lebih jarang: snapshot panel, antrean perintah (hingga 45 detik saat sepi), statistik, pemain, promo, kata, dan log INFO tidak dikirim. Perintah dari panel bisa terlambat beberapa detik. Fitur untuk pemain di Discord tidak berubah.', null, null, 10)
on conflict (key) do nothing;
