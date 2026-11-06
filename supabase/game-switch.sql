-- ════════════════════════════════════════════════════════════════════════════
--  SAKELAR GAME DI /admin/kontrol › Mode & Game (bot: src/game/gameSwitch.js)
--
--  Satu toggle per game di Game Hub /game. Mati = game hilang dari hub, tombol
--  lama ditolak, dan tidak ada proses latar bot yang menyentuh jaringan atau
--  database untuk game itu. Acuan lengkap: docs/game-switch.md di repo bot.
--
--  Murni ADITIF dan idempoten (`on conflict do nothing`): nilai yang sudah ada
--  (mis. game_werewolf_enabled, game_pengacara_enabled) tidak pernah ditimpa.
--  Bawaan 'true' = game menyala, jadi memasang ini tidak mengubah perilaku bot.
--  Daftar baris dihasilkan dari gameSwitch.sqlRows() (dijaga test/gameSwitch.test.js).
--  Game baru: tambahkan entri di TOGGLES lalu jalankan ulang file ini dengan baris baru.
--  Pemulihan: delete from public.bot_settings where key in (...kunci game_*_enabled baru...);
-- ════════════════════════════════════════════════════════════════════════════

insert into public.bot_settings (key, label, value, kind, category, help, min_value, max_value, sort) values
  ('game_sambungkata_enabled', 'Game Sambung Kata', 'true', 'boolean', 'mode', 'Game utama. Mati total: hilang dari Game Hub, DM ajakan kembali berhenti, poller lawan lintas server berhenti, dan sinkron daftar pemain dan antrean kata ke CMS berhenti. Mode PvP, PvB, Server, Dungeon tetap punya sakelar sendiri.', null, null, 45),
  ('game_werewolf_enabled', 'Game Werewolf', 'true', 'boolean', 'mode', 'Werewolf Klasik. Mematikannya juga mematikan Werewolf Lanjutan.', null, null, 50),
  ('game_werewolf_adv_enabled', 'Game Werewolf Lanjutan', 'true', 'boolean', 'mode', 'Werewolf Lanjutan (54 peran). Bisa dimatikan sendiri tanpa mengubah Werewolf Klasik.', null, null, 55),
  ('game_pengacara_enabled', 'Game Pengacara', 'true', 'boolean', 'mode', 'Roleplay ruang sidang.', null, null, 60),
  ('game_uno_enabled', 'Game UNO', 'true', 'boolean', 'mode', 'Permainan kartu UNO.', null, null, 65),
  ('game_tebaklagu_enabled', 'Game Tebak Lagu', 'true', 'boolean', 'mode', 'Mati total: hilang dari Game Hub dan sinkron katalog lagu dari CMS berhenti (tidak ada unduhan audio).', null, null, 70),
  ('game_tahu_enabled', 'Game Tahu Bulat', 'true', 'boolean', 'mode', 'Progres pemain tetap tersimpan, hanya tidak bisa dimainkan. Dashboard lama yang masih terbuka juga ditolak.', null, null, 75),
  ('game_story_enabled', 'Game Vanillate Story', 'true', 'boolean', 'mode', 'Progres pemain tetap tersimpan, hanya tidak bisa dimainkan. Dashboard lama yang masih terbuka juga ditolak.', null, null, 80)
on conflict (key) do nothing;
