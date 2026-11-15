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
--  Pengecualian: game yang belum dibuka untuk umum (TOGGLES `defaultEnabled: false`, kini
--  game_vdungeon_enabled) dan fitur turunannya (SUBSWITCHES, kini game_vdungeon_party_enabled
--  untuk mode party) diisi 'false'. Bot memperlakukan baris yang belum ada sebagai MATI untuk
--  keduanya (fail-closed), jadi game dan mode party terbuka hanya saat pemilik menyalakan
--  sakelarnya di /admin/kontrol › Mode & Game (berlaku 1 sampai 2 menit, tanpa restart
--  dan tanpa .env). Mode party juga butuh game induknya menyala. Memasang baris ini tidak
--  mengubah apa pun bagi pemain.
--  Daftar baris dihasilkan dari gameSwitch.sqlRows() (dijaga test/gameSwitch.test.js).
--  Game baru: tambahkan entri di TOGGLES lalu jalankan ulang file ini dengan baris baru.
--  Pemulihan: delete from public.bot_settings where key in (...kunci game_*_enabled baru...);
--             (Vanillate Dungeon saja: delete from public.bot_settings where key in ('game_vdungeon_enabled', 'game_vdungeon_party_enabled');)
-- ════════════════════════════════════════════════════════════════════════════

insert into public.bot_settings (key, label, value, kind, category, help, min_value, max_value, sort) values
  ('game_sambungkata_enabled', 'Game Sambung Kata', 'true', 'boolean', 'mode', 'Game utama. Mati total: hilang dari Game Hub, DM ajakan kembali berhenti, poller lawan lintas server berhenti, dan sinkron daftar pemain dan antrean kata ke CMS berhenti. Mode PvP, PvB, Server, Dungeon tetap punya sakelar sendiri.', null, null, 45),
  ('game_werewolf_enabled', 'Game Werewolf', 'true', 'boolean', 'mode', 'Werewolf Klasik. Mematikannya juga mematikan Werewolf Lanjutan.', null, null, 50),
  ('game_werewolf_adv_enabled', 'Game Werewolf Lanjutan', 'true', 'boolean', 'mode', 'Werewolf Lanjutan (54 peran). Bisa dimatikan sendiri tanpa mengubah Werewolf Klasik.', null, null, 55),
  ('game_pengacara_enabled', 'Game Pengacara', 'true', 'boolean', 'mode', 'Roleplay ruang sidang.', null, null, 60),
  ('game_uno_enabled', 'Game UNO', 'true', 'boolean', 'mode', 'Permainan kartu UNO.', null, null, 65),
  ('game_tebaklagu_enabled', 'Game Tebak Lagu', 'true', 'boolean', 'mode', 'Mati total: hilang dari Game Hub dan sinkron katalog lagu dari CMS berhenti (tidak ada unduhan audio).', null, null, 70),
  ('game_tahu_enabled', 'Game Tahu Bulat', 'true', 'boolean', 'mode', 'Progres pemain tetap tersimpan, hanya tidak bisa dimainkan. Dashboard lama yang masih terbuka juga ditolak.', null, null, 75),
  ('game_story_enabled', 'Game Vanillate Story', 'true', 'boolean', 'mode', 'Progres pemain tetap tersimpan, hanya tidak bisa dimainkan. Dashboard lama yang masih terbuka juga ditolak.', null, null, 80),
  ('game_vdungeon_enabled', 'Game Vanillate Dungeon', 'false', 'boolean', 'mode', 'RPG dungeon satu pemain. Bawaan MATI: nyalakan sakelar ini untuk membuka game bagi semua server sekaligus (berlaku 1 sampai 2 menit, tanpa restart). Mematikannya lagi menyembunyikan game dari Game Hub tanpa menghapus progres pemain. Run yang sedang berjalan ditolak di klik berikutnya dan bisa dilanjutkan setelah game menyala lagi.', null, null, 85),
  ('game_vdungeon_party_enabled', 'Vanillate Dungeon: mode party', 'false', 'boolean', 'mode', 'Mode party (2 sampai 4 pemain, thread khusus) di dalam Vanillate Dungeon. Bawaan MATI supaya mode solo bisa dibuka lebih dulu. Menyala hanya bila Game Vanillate Dungeon juga menyala. Mematikannya tidak menghentikan party yang sedang berjalan (selesai alami), tetapi lobby dan party baru tidak bisa dibuka.', null, null, 86)
on conflict (key) do nothing;
