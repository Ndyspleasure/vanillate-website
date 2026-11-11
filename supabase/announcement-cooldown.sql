-- ════════════════════════════════════════════════════════════════════════════
--  PENGUMUMAN DISCORD: jeda antar tampilan — setelan di /admin/kontrol
--  (bot: src/services/announcement.js, PR bot #246)
--
--  Menit antar tampilan pengumuman. 0 = muncul di setiap slash command.
--  Mode ephemeral: dihitung per pemain. Mode publik: dihitung per channel dan
--  selalu minimal 1 menit walau diisi 0, supaya channel tidak dibanjiri.
--  Jeda tersimpan di memori bot, jadi hilang saat bot restart.
--
--  Murni ADITIF dan idempoten. Bawaan 0 (tidak mengubah perilaku apa pun).
--  Pemulihan: announcement-cooldown-rollback.sql
-- ════════════════════════════════════════════════════════════════════════════

insert into public.bot_settings (key, label, value, kind, category, help, min_value, max_value, sort) values
  ('discord_announcement_cooldown_minutes', 'Jeda antar pengumuman (menit)', '0', 'number', 'pengumuman',
   'Berapa menit pengumuman tidak muncul lagi setelah tampil. 0 = muncul di setiap slash command. Bila pengumuman ephemeral, jeda dihitung per pemain. Bila publik, dihitung per channel dan minimal 1 menit walau diisi 0. Jeda disimpan di memori bot dan hilang saat bot restart.', 0, 1440, 24)
on conflict (key) do nothing;
