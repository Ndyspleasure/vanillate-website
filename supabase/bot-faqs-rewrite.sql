-- ════════════════════════════════════════════════════════════════════════════
--  FAQ Bot ke sinopsis Vanillate.ID (Game, Sosial, Server)
--
--  Mengubah 6 FAQ identitas di bot_faqs dan menambah 1 FAQ pengantar, supaya
--  Pusat Bantuan bot tidak lagi memosisikan Vanillate.ID sebagai bot Sambung
--  Kata saja. FAQ teknis (izin, tombol, DM, dst.) tidak diubah.
--
--  Aman diulang: salinan teks lama disimpan SEKALI di bot_faqs_backup_20261104
--  (RLS aktif tanpa policy). Pemulihan: supabase/bot-faqs-rewrite-rollback.sql.
--  Tidak mengubah kolom bot_slug.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.bot_faqs_backup_20261104 as
  select * from public.bot_faqs where bot_slug = 'sambung-kata';
alter table public.bot_faqs_backup_20261104 enable row level security;

-- ─── FAQ pengantar baru (urutan teratas) ───────────────────────────────────
insert into public.bot_faqs (bot_slug, question, answer, enabled, sort)
select 'sambung-kata',
  '🤖 Apa itu Vanillate.ID dan apa saja yang bisa dilakukan?',
  $f$Vanillate.ID adalah bot Discord serbaguna untuk komunitas Indonesia. Fungsinya terbagi dalam tiga hal.

### Game
Tempat member bermain bersama teman di server. Semua game dibuka lewat `/game`, dari permainan kata sampai game santai untuk ramai-ramai. Game utamanya punya progres dan hadiah.

### Sosial
Kegiatan ringan yang membuat server terasa hidup setiap hari dan membuat member saling berinteraksi. Dibuka lewat `/sosial` dan baru aktif setelah admin memilihnya di dashboard.

### Server
Alat bantu untuk owner dan admin agar server tertata, aman, dan ramah pendatang baru. Semuanya diatur dari Vanillate Dashboard di https://vanillate.id/dashboard/ tanpa mengetik command.

### Mulai dari mana
Pemain baru cukup menjalankan `/tutorial`. Panduan lengkap ada di `/help` kapan saja. Info produk: https://vanillate.id/products/vanillateID/$f$,
  true, 5
where not exists (
  select 1 from public.bot_faqs
  where bot_slug = 'sambung-kata' and question like '%Apa itu Vanillate.ID%'
);

-- ─── Cara mulai bermain ────────────────────────────────────────────────────
update public.bot_faqs set
  question = '🎮 Bagaimana cara mulai bermain game di Vanillate.ID?',
  answer = $f$Semua game dibuka lewat `/game`. Game utamanya Sambung Kata, permainan kata berantai Bahasa Indonesia dengan progres: Class, Quest, Boost, sampai Dungeon.

### Langkah awal
1. Pemain baru otomatis diajak **Tutorial Pemain Baru** (bisa dibuka lagi dengan `/tutorial`).
2. Ketik `/game`, lalu pilih game. Untuk Sambung Kata pilih **🔤 Sambung Kata** untuk membuka menu mode. Kamus, Stats, Quest, Shop, Claim, dan lainnya ada di tombol **📊 Dashboard** di sana.
3. Pilih mode: **Player vs Player**, **Player vs Bot**, **Player vs Server**, atau **Dungeon**.
4. Jawab dengan kata yang diawali awalan yang ditentukan (lihat embed giliran). Kata harus ada di kamus.
5. Kumpulkan EXP dan Coin, buka **Class** di Level 3, lalu taklukkan Dungeon.

### Tips pemula
• Coba dulu **Player vs Bot → Mode Normal → Mudah** untuk latihan sendiri.
• Ambil boost gratis setiap hari di **📊 Dashboard › Claim**.
• Cek **📊 Dashboard › Quest** supaya setiap match juga menyelesaikan quest.
• Panduan lengkap ada di `/help`.$f$
where id = 'ad39f749-a283-4674-820c-03b204e9c148';

-- ─── Tutorial ──────────────────────────────────────────────────────────────
update public.bot_faqs set
  question = '🎓 Kenapa ada Tutorial dan sebagian perintah terkunci?',
  answer = $f$Tutorial Pemain Baru memperkenalkan tiga pintu utama Vanillate.ID: `/game` untuk game, `/sosial` untuk kegiatan komunitas, dan Vanillate Dashboard untuk mengatur server. Selama tutorial belum selesai, **sebagian perintah belum bisa dipakai**. Ini disengaja, bukan error.

### Cara menyelesaikan
• Baca setiap materi, lalu tekan tombol lanjut setelah waktu baca singkat berlalu.
• Ingin cepat? Tekan **Lewati Tutorial** untuk membaca ringkasannya saja.

### Thread tutorial hilang?
Ketik `/tutorial` kapan saja untuk membukanya lagi. Pastikan bot punya izin membuat thread di channel itu.$f$
where id = 'e8c6ac16-0d44-4a52-96a5-722c51eb9d87';

-- ─── Game di /game ─────────────────────────────────────────────────────────
update public.bot_faqs set
  question = '🃏 Game apa saja yang ada di /game?',
  answer = $f$Ketik `/game`, pilih game, lalu lobby dibuka di channel untuk mengajak yang lain. Game utamanya **🔤 Sambung Kata** (Coin, EXP, class, quest, dan 📊 Dashboard). Game lain bersifat santai dan **tidak** menambah Coin, EXP, atau inventory Sambung Kata. Beberapa menyimpan progresnya sendiri.

### 🐺 Werewolf
Klasik dengan 4 peran untuk 4 sampai 30 pemain, atau Lanjutan dengan 54 peran untuk hingga 100 pemain.

### ⚖️ Pengacara (Persidangan)
Roleplay sidang dengan Hakim, Jaksa, Pengacara, Tersangka, dan Saksi. Puluhan skenario kasus untuk 8 sampai 25 pemain.

### 🎴 UNO
Habiskan kartumu lebih dulu. Ada Skip, Reverse, +2, Wild, +4, dan aturan "UNO!". 2 sampai 25 pemain, giliran 45 detik.

### 🎵 Tebak Lagu
Bot memutar cuplikan ±20 detik, tebak judulnya lewat form privat. Makin cepat benar, makin besar skor. Mode voice memutar lagu di voice channel host.

### 🥟 Tahu Bulat
Simulasi bisnis santai untuk satu pemain: jual tahu, upgrade, buka kota, donasi, rebirth. Progres dan coin Tahu tersimpan dan terpisah dari Sambung Kata.

Admin server bisa mengatur channel khusus tiap game di **Vanillate Dashboard** (`/pengaturan` memberi tautannya).$f$
where id = 'cdf8cea0-50cf-498f-a39b-a9fc0e907a56';

-- ─── Sosial ────────────────────────────────────────────────────────────────
update public.bot_faqs set
  question = '🤝 Apa itu Sosial dan apa gunanya untuk server?',
  answer = $f$**Sosial** (`/sosial`) adalah kumpulan kegiatan ringan yang membuat server terasa hidup dan mendorong member saling berinteraksi setiap hari, bukan hanya mengobrol sesekali. Murni untuk kebersamaan, tanpa Coin, EXP, atau item.

### Cara kerjanya
• Tiap kegiatan **mati** sampai admin menyalakannya dan memilih channel-nya di **Vanillate Dashboard**. Belum diatur berarti memang belum aktif.
• Aturan dan status kegiatan tampil di channel masing-masing. Status pribadimu bisa dilihat di `/sosial`.

### Contoh kegiatan
• **Counting**: berhitung bersama secara bergantian.
• **Streak Harian**: kebiasaan menulis sekali sehari bersama teman server.
• **Anonymous Confession**: ruang bercerita tanpa nama dengan moderasi.

Admin yang belum memerlukan sebuah kegiatan cukup mencentang **Tidak dipakai** di dashboard.$f$
where id = 'cd6de44c-a26d-41a2-96a3-db12f45a8862';

-- ─── Admin: pilar Server ───────────────────────────────────────────────────
update public.bot_faqs set
  question = '⚙️ Saya admin, bagaimana mengatur bot di server?',
  answer = $f$Pilar **Server** Vanillate.ID membantu owner dan admin menata komunitas, dan semuanya diatur lewat **Vanillate Dashboard** (website), bukan command. Butuh izin **Manage Server** (atau Administrator atau pemilik server).

### Cara mengatur
1. Buka **vanillate.id/dashboard** (atau ketik `/pengaturan` untuk tautan langsung ke server ini) lalu masuk dengan akun Discord.
2. Pilih server yang kamu kelola.
3. Ubah pengaturan lalu simpan. Bot mengecek izinnya dan menerapkan otomatis dalam beberapa detik.

### Yang bisa diatur
• **Game**: channel khusus tiap game. Bila dikosongkan, game bisa dibuka di semua channel.
• **Sosial**: channel untuk tiap kegiatan komunitas. Kegiatan sosial **mati** sampai channel-nya dipilih, dan satu channel hanya untuk satu kegiatan. Tidak dipakai? Centang **Tidak dipakai**.
• **Server**: alat penataan server dan promosi antar server lewat Share Server. Opsi yang belum bisa dipakai tampil dengan penjelasan syaratnya.

Pastikan bot punya izin View Channel, Send Messages, Embed Links, Read Message History, dan Add Reactions di channel yang dipilih.$f$
where id = '8ccc0514-156f-4077-a9ed-35777a89a9ca';

-- ─── Daftar perintah ───────────────────────────────────────────────────────
update public.bot_faqs set
  question = '📚 Apa saja perintah yang tersedia?',
  answer = $f$### Game
• `/game`: pusat semua game. Pilih **🔤 Sambung Kata** untuk mode PvP, PvB, Player vs Server, dan Dungeon. Game lain: Werewolf, Pengacara, UNO, Tebak Lagu, Tahu Bulat.
• Di dalam Sambung Kata, tombol **📊 Dashboard** memuat Kamus, Stats, Leaderboard, Class, Quest, Shop, Inventory, dan Claim.
• `/rank`: lihat level dan peringkat aktivitasmu di server.

### Sosial
• `/sosial`: pusat kegiatan komunitas server dan status pribadimu.

### Server
• `/pengaturan`: tautan ke Vanillate Dashboard untuk mengatur server (butuh Manage Server).

### Bantuan
• `/tutorial`: Tutorial Pemain Baru.
• `/help`: panduan lengkap, plus tombol **🛟 Pusat Bantuan** (FAQ ini dan Tim Support) dan **📬 Kirim Masukan** (saran dan laporan bug).$f$
where id = '6348fac9-a119-47d3-b69a-80fa34a7c468';
