-- Rollback announcement-triggers.sql: mengembalikan setelan ke kategori dan urutan semula,
-- menghapus pemicu baru dan kategori, serta mengembalikan teks bantuan lama.
update public.bot_settings set category = 'pengumuman', sort = 25 where key = 'discord_announcement_ephemeral'        and category = 'pengumuman_pemicu';
update public.bot_settings set category = 'pengumuman', sort = 24 where key = 'discord_announcement_cooldown_minutes' and category = 'pengumuman_pemicu';
update public.bot_settings set category = 'pengumuman', sort = 26 where key = 'discord_announcement_button1_label'   and category = 'pengumuman_pemicu';
update public.bot_settings set category = 'pengumuman', sort = 27 where key = 'discord_announcement_button1_url'     and category = 'pengumuman_pemicu';
update public.bot_settings set category = 'pengumuman', sort = 28 where key = 'discord_announcement_button2_label'   and category = 'pengumuman_pemicu';
update public.bot_settings set category = 'pengumuman', sort = 29 where key = 'discord_announcement_button2_url'     and category = 'pengumuman_pemicu';

delete from public.bot_settings where key in (
  'discord_announcement_on_command', 'discord_announcement_on_streak_kiriman',
  'discord_announcement_on_streak_tercatat', 'discord_announcement_streak_cooldown_minutes');
delete from public.bot_setting_categories
  where key = 'pengumuman_pemicu'
    and not exists (select 1 from public.bot_settings where category = 'pengumuman_pemicu');

update public.bot_settings set help = 'Menampilkan pengumuman di bawah konten slash command.'
 where key = 'discord_announcement_enabled'
   and help like 'Sakelar utama pengumuman.%';
update public.bot_settings
   set help = 'Pengumuman tampil di bawah konten setiap slash command. Nyala: ephemeral, hanya pemain yang memakai command yang melihatnya. Mati: publik, semua orang di channel melihatnya, jadi channel bisa ramai bila banyak yang memakai command.'
 where key = 'discord_announcement_ephemeral' and help like 'Hanya untuk pemicu slash command. Nyala: ephemeral%';
update public.bot_settings
   set help = 'Berapa menit pengumuman tidak muncul lagi setelah tampil. 0 = muncul di setiap slash command. Bila pengumuman ephemeral, jeda dihitung per pemain. Bila publik, dihitung per channel dan minimal 1 menit walau diisi 0. Jeda disimpan di memori bot dan hilang saat bot restart.'
 where key = 'discord_announcement_cooldown_minutes' and help like 'Hanya untuk pemicu slash command. Berapa menit%';
update public.bot_settings set help = 'Teks tombol link pertama, maksimal 80 karakter (boleh memakai emoji). Kosong = tombol tidak tampil.'
 where key = 'discord_announcement_button1_label' and help like 'Teks tombol link pertama di bawah pengumuman%';
update public.bot_settings set help = 'Teks tombol link kedua, maksimal 80 karakter (boleh memakai emoji). Kosong = tombol tidak tampil.'
 where key = 'discord_announcement_button2_label' and help like 'Teks tombol link kedua di bawah pengumuman%';
