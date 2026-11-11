-- ════════════════════════════════════════════════════════════════════════════
--  PENGUMUMAN DISCORD: kategori "Pemicu & Tampilan" — setelan di /admin/kontrol
--  (bot: src/services/announcement.js, src/social/streak/handler.js)
--
--  Memisahkan DI MANA pengumuman muncul dan bagaimana tampilannya dari isi
--  pengumuman. Isi (aktif, judul, teks, kadaluwarsa) tetap di kategori
--  "Pengumuman Discord". Kategori baru "Pengumuman: Pemicu & Tampilan" memuat:
--    • pemicu: setelah slash command, Streak (di bawah kartu 💌 Kata-Kata Hari
--      Ini untukmu), Streak (balasan tanpa kartu itu);
--    • tampilan: ephemeral, jeda, jeda Streak, dua tombol link.
--
--  ADITIF dan idempoten. Baris lama (ephemeral, jeda, tombol) hanya dipindah
--  kategori dan diurutkan ulang; kunci dan nilainya TIDAK berubah, jadi bot
--  lama tetap membacanya. Pemicu baru bernilai sama dengan perilaku sekarang
--  (command nyala) atau diminta pemilik (Streak 💌 nyala, Streak lain mati).
--  Pemulihan: announcement-triggers-rollback.sql
-- ════════════════════════════════════════════════════════════════════════════

insert into public.bot_setting_categories (key, label, description, icon, sort) values
  ('pengumuman_pemicu', 'Pengumuman: Pemicu & Tampilan',
   'Di mana pengumuman Discord muncul (setelah slash command, di channel Streak Harian) dan bagaimana tampilannya (ephemeral, jeda, tombol link). Isi pengumuman ada di grup Pengumuman Discord.',
   'megaphone', 25)
on conflict (key) do nothing;

insert into public.bot_settings (key, label, value, kind, category, help, min_value, max_value, sort) values
  ('discord_announcement_on_command', 'Setelah slash command', 'true', 'boolean', 'pengumuman_pemicu',
   'Nyala: pengumuman muncul tepat di bawah balasan setiap slash command. Ephemeral atau publik diatur di bawah.', null, null, 10),
  ('discord_announcement_on_streak_kiriman', 'Streak: di bawah kartu Kata-Kata Hari Ini untukmu', 'true', 'boolean', 'pengumuman_pemicu',
   'Nyala: pengumuman muncul sebagai pesan baru tepat di bawah balasan Streak Tercatat yang memuat kartu 💌 Kata-Kata Hari Ini untukmu. Pesan di channel Streak selalu publik, jadi atur jedanya di bawah.', null, null, 20),
  ('discord_announcement_on_streak_tercatat', 'Streak: balasan tanpa kartu Kata-Kata Hari Ini', 'false', 'boolean', 'pengumuman_pemicu',
   'Nyala: pengumuman juga muncul di bawah balasan Streak Tercatat yang tidak memuat kartu Kata-Kata Hari Ini untukmu, misalnya saat kartunya berisi Belum ada kata-kata dari teman. Pesan di channel Streak selalu publik.', null, null, 30),
  ('discord_announcement_streak_cooldown_minutes', 'Jeda pengumuman di channel Streak (menit)', '30', 'number', 'pengumuman_pemicu',
   'Berapa menit pengumuman tidak muncul lagi di channel Streak yang sama setelah tampil. Minimal 1 menit. Jeda disimpan di memori bot dan hilang saat bot restart.', 1, 1440, 60)
on conflict (key) do nothing;

-- Setelan tampilan yang sudah ada dipindah ke kategori baru (hanya category dan sort).
update public.bot_settings set category = 'pengumuman_pemicu', sort = 40 where key = 'discord_announcement_ephemeral'                and category = 'pengumuman';
update public.bot_settings set category = 'pengumuman_pemicu', sort = 50 where key = 'discord_announcement_cooldown_minutes'         and category = 'pengumuman';
update public.bot_settings set category = 'pengumuman_pemicu', sort = 70 where key = 'discord_announcement_button1_label'           and category = 'pengumuman';
update public.bot_settings set category = 'pengumuman_pemicu', sort = 71 where key = 'discord_announcement_button1_url'             and category = 'pengumuman';
update public.bot_settings set category = 'pengumuman_pemicu', sort = 72 where key = 'discord_announcement_button2_label'           and category = 'pengumuman';
update public.bot_settings set category = 'pengumuman_pemicu', sort = 73 where key = 'discord_announcement_button2_url'             and category = 'pengumuman';

-- Teks bantuan yang kini kurang tepat (hanya menimpa bila masih persis teks lama).
update public.bot_settings
   set help = 'Sakelar utama pengumuman. Di mana pengumuman muncul (slash command, channel Streak) diatur di grup Pengumuman: Pemicu & Tampilan.'
 where key = 'discord_announcement_enabled'
   and help = 'Menampilkan pengumuman di bawah konten slash command.';

update public.bot_settings
   set help = 'Hanya untuk pemicu slash command. Nyala: ephemeral, hanya pemain yang memakai command yang melihatnya. Mati: publik, semua orang di channel melihatnya, jadi channel bisa ramai bila banyak yang memakai command. Tidak berlaku di channel Streak, yang selalu publik.'
 where key = 'discord_announcement_ephemeral'
   and help like 'Pengumuman tampil di bawah konten setiap slash command. Nyala: ephemeral%';

update public.bot_settings
   set help = 'Hanya untuk pemicu slash command. Berapa menit pengumuman tidak muncul lagi setelah tampil. 0 = muncul di setiap slash command. Bila pengumuman ephemeral, jeda dihitung per pemain. Bila publik, dihitung per channel dan minimal 1 menit walau diisi 0. Jeda channel Streak diatur terpisah. Jeda disimpan di memori bot dan hilang saat bot restart.'
 where key = 'discord_announcement_cooldown_minutes'
   and help like 'Berapa menit pengumuman tidak muncul lagi setelah tampil. 0 = muncul di setiap slash command.%';

update public.bot_settings
   set help = 'Teks tombol link pertama di bawah pengumuman (semua pemicu), maksimal 80 karakter, boleh memakai emoji. Kosong = tombol tidak tampil.'
 where key = 'discord_announcement_button1_label' and help like 'Teks tombol link pertama, maksimal 80 karakter%';
update public.bot_settings
   set help = 'Teks tombol link kedua di bawah pengumuman (semua pemicu), maksimal 80 karakter, boleh memakai emoji. Kosong = tombol tidak tampil.'
 where key = 'discord_announcement_button2_label' and help like 'Teks tombol link kedua, maksimal 80 karakter%';
