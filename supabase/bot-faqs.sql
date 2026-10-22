-- ════════════════════════════════════════════════════════════════════════════
--  FAQ Bot — pertanyaan & jawaban Pusat Bantuan bot Sambung Kata di Discord
--  (/help › 🛟 Pusat Bantuan dan DM bot).
--
--  Terpisah dari `faqs` (FAQ website, /faq): FAQ bot ditulis untuk Discord —
--  tanpa tabel & tautan relatif, ada pertanyaan khusus Discord (izin bot), dan
--  menunya maksimal 50 item. Dikelola di /admin/faq/bot; bot menariknya
--  berkala lewat service_role (sambung-kata-bot: src/support/faqSync.js).
--  Pengganti /supportfaq (dihapus di bot v3.3.0).
--
--  Aditif & idempoten. Isi awal = FAQ bawaan bot (src/support/faqDefaults.js),
--  hanya disisipkan bila belum ada satu baris pun untuk bot itu — menjalankan
--  ulang tidak menimpa suntingan admin.
--  Terapkan lewat Supabase MCP `apply_migration`. Rollback:
--  supabase/bot-faqs-rollback.sql.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.bot_faqs (
  id          uuid primary key default gen_random_uuid(),
  bot_slug    text not null default 'sambung-kata',
  -- Batas mengikuti bot (src/support/supportFaq.js MAX_Q / MAX_A): judul embed
  -- Discord ≤ 256, deskripsi ≤ 4096.
  question    text not null check (char_length(btrim(question)) between 1 and 256),
  answer      text not null check (char_length(btrim(answer)) between 1 and 4000),
  enabled     boolean not null default true,
  sort        integer not null default 100,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.admin_users(id) on delete set null
);

create index if not exists bot_faqs_slug_sort_idx on public.bot_faqs(bot_slug, sort);

comment on table public.bot_faqs is
  'FAQ Pusat Bantuan bot Discord (bukan FAQ website). Dikelola di /admin/faq/bot, ditarik bot lewat service_role.';

-- updated_at selalu benar, memakai fungsi yang sama dengan FAQ website.
create or replace function public.touch_faq_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists bot_faqs_touch on public.bot_faqs;
create trigger bot_faqs_touch before update on public.bot_faqs
  for each row execute function public.touch_faq_updated_at();

-- RLS — admin baca, editor kelola (sama dengan faqs). Bot memakai service_role.
alter table public.bot_faqs enable row level security;

drop policy if exists "admin baca bot_faqs" on public.bot_faqs;
create policy "admin baca bot_faqs" on public.bot_faqs
  for select to authenticated using (public.is_admin());
drop policy if exists "editor kelola bot_faqs" on public.bot_faqs;
create policy "editor kelola bot_faqs" on public.bot_faqs
  for all to authenticated
  using (public.is_admin_editor()) with check (public.is_admin_editor());

-- Isi awal (sekali saja).
insert into public.bot_faqs (question, answer, sort)
select v.question, v.answer, v.sort
from (values
    ($faq$🤖 Bot tidak merespons / tidak mengirim pesan di channel$faq$,
     $faq$Hampir selalu penyebabnya **izin bot kurang** di channel itu — bukan bot rusak.

### Minta admin server mengecek
Role bot wajib punya izin berikut di channel tempat kamu bermain:
• **View Channel** — supaya bot bisa melihat channel
• **Send Messages** — supaya bot bisa membalas
• **Embed Links** — semua tampilan bot berupa embed; tanpa izin ini pesannya dibuang Discord
• **Read Message History** — supaya bot bisa membaca jawabanmu
• **Add Reactions** — untuk tanda ✅/❌ dan fitur sosial

### Izin channel bisa menimpa izin role
Walau role bot sudah lengkap, pengaturan per-channel bisa memblokirnya. Cek di **Edit Channel → Permissions**: pastikan role bot (atau @everyone) tidak diberi tanda ❌ pada izin di atas.

### Cek juga
• Bot **online** (titik hijau di daftar member).
• Server mungkin memakai **channel khusus game** (`/pengaturan`). Bila iya, bot akan mengarahkanmu ke channel yang benar.
• Masih diam? Tunggu 1–2 menit — bot mungkin sedang restart setelah update.$faq$,
     10),
    ($faq$⌨️ Perintah garis miring (/) bot tidak muncul$faq$,
     $faq$Perintah `/` hanya muncul bila bot diundang dengan izin **applications.commands**.

### Cara memperbaiki
1. Minta admin **mengundang ulang bot** memakai tautan invite resmi (scope `bot` + `applications.commands`).
2. Tunggu beberapa menit sampai daftar perintah tersinkron. Perintah baru setelah update bisa butuh hingga ±1 jam untuk muncul di semua server.
3. Tutup lalu buka lagi Discord (atau tekan **Ctrl+R** di PC) supaya daftarnya dimuat ulang.
4. Ketik `/` lagi dan cari nama perintahnya, mis. `/sambungkata`.

### Perlu diketahui
• Mengundang ulang **tidak** mengeluarkan bot dan **tidak** menghapus data siapa pun.
• Admin bisa membatasi siapa yang boleh memakai perintah lewat **Server Settings → Integrations**. Bila perintah muncul untuk orang lain tapi tidak untukmu, kemungkinan besar dibatasi di sana.$faq$,
     20),
    ($faq$🚫 Bot gagal membuat room/thread game atau tiket$faq$,
     $faq$Beberapa fitur membuat channel atau thread sendiri, jadi butuh izin tambahan.

### Izin yang dibutuhkan
• **Manage Channels** — untuk membuat room game & tiket support
• **Create Public Threads** / **Create Private Threads** — untuk thread game & Tutorial Pemain Baru
• **Send Messages in Threads** — supaya bot bisa bermain di dalam thread
• **Manage Threads** — untuk menutup/mengarsipkan thread setelah game selesai

### Urutan role
Di **Server Settings → Roles**, letakkan role bot **di atas** role yang perlu diatur bot. Discord tidak mengizinkan bot mengatur role yang posisinya lebih tinggi.

Setelah izin diperbaiki, ulangi aksinya dari awal (mis. buka lagi `/sambungkata`).$faq$,
     30),
    ($faq$😶 Tombol, menu, atau reaksi bot tidak berfungsi$faq$,
     $faq$### Muncul "This interaction failed"?
• Tombol punya **batas waktu**. Dashboard `/sambungkata` aktif ±2 menit sejak interaksi terakhir; lobby yang tidak dimulai juga tutup otomatis. Jalankan ulang perintahnya untuk mendapat tombol baru.
• Bot mungkin sedang **restart singkat** setelah update. Tunggu 1–2 menit lalu coba lagi.

### Tombol tidak bereaksi sama sekali
• Pastikan bot **online**.
• Beberapa tombol hanya untuk orang tertentu — mis. tombol **Mulai** hanya untuk host lobby, dan tombol giliran hanya untuk pemain yang sedang mendapat giliran.
• Kamu masih dalam **Tutorial Pemain Baru**? Selesaikan atau lewati dulu (`/tutorial`).

### Reaksi tidak muncul
Bot butuh izin **Add Reactions** (dan **Use External Emojis** untuk emoji kustom) di channel itu.$faq$,
     40),
    ($faq$📩 Bot tidak bisa DM saya (chat support tidak masuk)$faq$,
     $faq$Chat dengan Tim Support berjalan lewat **DM**, jadi DM dari bot harus diizinkan.

### Di PC / browser
1. Klik kanan ikon server tempat bot berada → **Privacy Settings**.
2. Aktifkan **Direct Messages**.
3. Tekan **Hubungi Tim Support** lagi.

### Di HP
1. Tekan nama server → **Settings** / ikon ⚙️.
2. Aktifkan **Allow Direct Messages** (Izinkan Pesan Langsung).

### Masih tidak masuk?
• Pastikan kamu **tidak memblokir** bot.
• Cek pengaturan global **User Settings → Privacy & Safety** — opsi DM dari anggota server harus aktif.$faq$,
     50),
    ($faq$🎮 Bagaimana cara mulai bermain Sambung Kata?$faq$,
     $faq$Sambung Kata adalah game kata berantai Bahasa Indonesia dengan progresi: Class, Quest, Boost, sampai Dungeon.

### Langkah awal
1. Pemain baru otomatis diajak **Tutorial Pemain Baru** di thread pribadi (bisa dibuka lagi dengan `/tutorial`).
2. Ketik `/sambungkata` untuk membuka dashboard.
3. Pilih mode: **Player vs Player**, **Player vs Bot**, **Player vs Server**, atau **Dungeon**.
4. Jawab dengan kata yang diawali awalan yang ditentukan (lihat embed giliran). Kata harus ada di kamus.
5. Kumpulkan EXP & Coin, buka **Class** di Level 3, lalu taklukkan Dungeon.

### Tips pemula
• Coba dulu **Player vs Bot → Mode Normal → Mudah** untuk latihan sendiri.
• Ambil boost gratis setiap hari di `/claim`.
• Cek `/quest` supaya setiap match juga menyelesaikan quest.
• Panduan lengkap ada di `/help`.$faq$,
     60),
    ($faq$📖 Apa aturan dasar permainan Sambung Kata?$faq$,
     $faq$Setiap pemain menyebut kata yang diawali **akhiran** kata sebelumnya. Contoh: dari `MAKAN` huruf berikutnya `N`, jadi `NASI`, `NAMA`, atau `NILAI` valid. Untuk kata yang lebih panjang, awalannya bisa **2–3 huruf** terakhir (mis. `AN` atau `KAN`) — awalan yang berlaku selalu tertulis di embed giliran.

### Syarat kata
• Diawali awalan yang ditentukan.
• Ada di kamus Bahasa Indonesia (puluhan ribu kata, terus bertambah).
• Belum pernah dipakai di ronde itu.
• Satu kata per giliran (tanpa spasi), minimal 2 huruf.

### Waktu & nyawa
• Setiap giliran **30 detik** (+5 detik dengan boost Extra Time). Waktu habis = langsung kehilangan 1 nyawa dan giliran pindah.
• Setiap pemain mulai dengan **5 nyawa**. Jawaban salah mengurangi 1 dari 5 kesempatan di giliran itu; setelah 5 kali salah, 1 nyawa hilang dan giliran pindah.
• Nyawa habis = tereliminasi.

### Cara menang
• **PvP/PvB:** jadi pemain terakhir yang bertahan.
• **Dungeon:** tumbangkan Guardian sampai wave 5.
• Pemain bisa voting menghentikan game (30 detik). Bila skor seri, **Balapan Ayam** menentukan pemenang.

### Kata istimewa
• Kata **≥8 huruf** memberi bonus EXP & Coin.
• Kata berakhiran huruf langka (**X, Q, Z, V**) memberi bonus Coin.$faq$,
     70),
    ($faq$📝 Kata saya ditolak, kenapa?$faq$,
     $faq$Kata ditolak bila tidak memenuhi salah satu syarat berikut:

• **Awalan salah** — kata harus diawali awalan yang diminta, yang bisa 1–3 huruf (lihat embed giliran).
• **Tidak ada di kamus** — kamus berisi puluhan ribu kata Bahasa Indonesia. Singkatan, nama orang/merek, kata asing, dan kata gaul tidak diterima.
• **Sudah dipakai** — setiap kata hanya boleh muncul sekali per ronde.
• **Lebih dari satu kata** atau mengandung spasi/angka/simbol.
• **Terlalu pendek** — minimal 2 huruf.
• **Bukan giliranmu** — jawaban hanya dihitung dari pemain yang sedang mendapat giliran.

### Cari ide kata
Pakai `/kamus [huruf]` untuk melihat kata di kamus yang diawali 1–3 huruf, mis. `/kamus AN` atau `/kamus KAN`.
Setiap salah jawab mengurangi 1 kesempatan; 5 kali salah dalam satu giliran = −1 nyawa.

### Yakin kata kamu benar?
Laporkan lewat `/help` → tombol **📬 Kirim Masukan** → kategori **Bug**, sertakan katanya. Tim akan mengecek dan menambahkannya ke kamus bila valid — kata yang disetujui langsung aktif tanpa menunggu update.$faq$,
     80),
    ($faq$🕹️ Mode permainan apa saja yang tersedia?$faq$,
     $faq$Semua mode dibuka dari `/sambungkata` lewat tombol di dashboard.

### ⚔️ Player vs Player (PvP)
2–10 pemain per room. Host membuka lobby, pemain lain bergabung, lalu host menekan Mulai. Lobby tutup sendiri bila tidak dimulai dalam 2 menit.

### 🤖 Player vs Bot — Mode Normal (Klasik)
Duel 1v1 melawan bot, boost tetap berlaku. Pilih kesulitan:
• **Mudah** — bot memilih kata acak
• **Normal** — bot menghindari huruf sulit
• **Sulit** — bot menjebakmu dengan huruf sulit
• **Impossible** — bot memilih kata terburuk untukmu

### 🧠 Player vs Bot — Mode Lanjutan (Battle Skill)
Satu tim (bisa solo) melawan bot dengan HP, Mana, dan Skill. Mana penuh (100) membuka Skill: Attack, Recovery, Defense, Mana, Buff, Debuff, Cleanse. Boost tidak berlaku di mode ini.

### 🌐 Player vs Server
Lawan pemain dari server lain. Buka lobby, lalu bot mencarikan lawan otomatis. 2–10 pemain gabungan dengan rating global terpisah (lihat `/stats`).

### 🏰 Dungeon Mode
Mode solo melawan Dungeon Guardian selama 5 wave. Butuh **Golden Key**.

### ⏱️ Fase Pre-Match
Sebelum game dimulai ada 30 detik untuk mengaktifkan boost **Extra Life**, **Shield**, dan **Extra Time**.$faq$,
     90),
    ($faq$🎓 Kenapa ada Tutorial / sebagian perintah terkunci?$faq$,
     $faq$Setiap pemain baru diperkenalkan dulu pada sistem bot lewat **Tutorial Pemain Baru** di thread pribadi milikmu. Selama tutorial belum selesai, **sebagian perintah belum bisa dipakai** — ini disengaja, bukan error.

### Cara menyelesaikan
• Baca setiap materi; setelah waktu baca singkat, tombol **Saya Sudah Paham** terbuka.
• Bingung? Tekan **Belum Paham** untuk memilih topik yang ingin dijelaskan lebih detail.
• Sudah paham sistemnya? Tekan **Lewati Tutorial** untuk membaca ringkasannya saja.

### Thread tutorial hilang?
Ketik `/tutorial` kapan saja untuk membukanya lagi. Pastikan bot punya izin membuat thread di channel itu.$faq$,
     100),
    ($faq$📈 Bagaimana sistem Level, EXP, dan Coin?$faq$,
     $faq$### Account Level
Setiap pemain mendapat Account EXP dari match dan quest. **1 level = 300 EXP**. Level 3 membuka **Class**. Cek progresmu di `/stats`.

### EXP per match
• +2 EXP per kata valid
• +15 EXP menyelesaikan pertandingan
• +25 EXP menang, +10 EXP MVP
EXP masuk ke Account **dan** ke Class aktif (bila sudah memilih class).

### Coin
• +5 Coin selesai pertandingan
• +10 Coin menang, +5 Coin MVP
• +1 Coin per 10 kata valid
• +1 Coin untuk kata ≥8 huruf
• +2 Coin untuk kata berakhiran X/Q/Z/V
• Bonus dari quest, win streak, dan passive class

Coin dipakai di `/shop`, untuk talent class, dan di Traveling Merchant. Coin **hanya** didapat dari bermain — tidak bisa dibeli.$faq$,
     110),
    ($faq$⚡ Apa itu Boost, cara dapat & harga di Shop?$faq$,
     $faq$Boost adalah item yang membantu dalam permainan.

### Pre-Match (dipakai sebelum game)
• ❤️ **Extra Life** (Legendary) — +1 nyawa
• 🛡️ **Shield** (Epic) — melindungi dari 1 kesalahan
• ⏳ **Extra Time** (Common) — +5 detik per giliran

### In-Game (dipakai saat giliranmu)
• 💡 **Hint** (Common) — menampilkan 1 kata valid
• 🔄 **Reroll** (Rare) — mengganti huruf awalan

### Cara mendapatkan
• `/claim` → **Claim Harian** — boost gratis tiap 24 jam
• `/claim` → **Claim Server Support** — reward member server support
• `/claim` → **Redeem Promo Code**
• `/shop` — beli dengan Coin
• Reward **Quest** harian & mingguan

Lihat boost yang kamu punya di `/inventory`. Boost muncul otomatis sebagai tombol saat pre-match/giliranmu. Boost **tidak berlaku** di Player vs Bot Mode Lanjutan.

### 🏪 Harga di `/shop`
• 💡 Hint 150 · 🔄 Reroll 200 · ⏳ Extra Time 250 · 🛡️ Shield 300 · ❤️ Extra Life 400
• 📦 Mystery Box 500 (boost acak, ada peluang Legendary)
• 💡 Hint x5 Bundle 600 · 🛡️ Shield x3 Bundle 750
• 🗝️ Golden Key 350 (pembuka Dungeon Mode)
_Harga dalam Coin; yang tampil di `/shop` selalu yang berlaku._$faq$,
     120),
    ($faq$🧙 Apa itu Class, kapan terbuka, dan bisakah diganti?$faq$,
     $faq$Class terbuka di **Account Level 3**. Setiap class punya passive nyata: bonus reward, boost harian ekstra, peluang selamat dari eliminasi, damage ekstra di Dungeon, dan lainnya.

### Daftar class
• Dari Level 3: **Scholar, Speedster, Guardian, Lucky, Hunter**
• Terbuka bertahap di Level 8, 12, 16, dan 20: **Gambler, Alchemist, Linguist, Berserker**

### Ganti class
• Pilihan pertama **gratis**; ganti berikutnya **750 Coin**.
• Progres class lama **tetap tersimpan** — kamu bisa kembali kapan saja.

### Talent Tree
Setiap class punya talent eksklusif yang memberi bonus pasif. Beli dengan Coin lewat `/class` → tombol talent. Detail tiap class: `/class list` dan `/class info [nama_class]`.$faq$,
     130),
    ($faq$📜 Bagaimana sistem Quest harian & mingguan?$faq$,
     $faq$Buka dashboard quest dengan `/quest`. Dua jenis quest berjalan bersamaan:

• **4 Daily Quest** — reset setiap tengah malam
• **6 Weekly Quest** — reset setiap Senin

### Hadiah
• Setiap quest memberi Coin/EXP/boost.
• Weekly quest **⚡ Kilat Kata** (20 jawaban dalam ≤5 detik) memberi **Golden Key**.
• Menyelesaikan semua quest memberi **Bonus Chest** berisi Coin dan Mystery Box.

### Tips
Progres quest dihitung otomatis dari match. Quest yang selesai diumumkan di akhir match — **jangan lupa diklaim** di `/quest`.$faq$,
     140),
    ($faq$🏰 Apa itu Dungeon Mode & cara dapat Golden Key?$faq$,
     $faq$Dungeon adalah mode solo paling menantang: kamu melawan **Dungeon Guardian** selama 5 wave. Masuk lewat `/sambungkata` → **Dungeon Mode**. Setiap masuk menghabiskan **1 Golden Key**.

### Cara dapat Golden Key
1. `/shop` — 350 Coin
2. Weekly quest **⚡ Kilat Kata** — gratis
3. **Traveling Merchant** — sering dijual diskon (250 Coin)
Kamu hanya bisa memegang **maksimal 1** Golden Key.

### Aturan
• Damage kata: dasar 2, kata ≥6 huruf +1, ≥8 huruf +1, akhiran langka +2.
• Guardian membalas 4–8 kata per giliran dan makin kuat tiap wave; waktu berpikir makin singkat.
• Class berpengaruh: Guardian +1 nyawa, Hunter & Berserker damage ekstra.

### Reward
• Semua reward match **×2**.
• Bonus tamat: +100 Coin + 30 Coin per wave (tamat 5 wave = +250 Coin).
• Drop pasti saat tamat: Extra Life, boost acak, dan Dungeon Trophy.$faq$,
     150),
    ($faq$🎲 Event spesial apa saja yang muncul saat PvP?$faq$,
     $faq$Event **hanya** ada di mode Player vs Player. Paling banyak satu event per match, diundi pada ronde 20–30 — tidak setiap match kebagian event. Saat intro, timer dibekukan.

### 👾 AI Challenger
Boss AI dengan HP `200 + (pemain × 20)`. Semua pemain bekerja sama: kata biasa = 1 damage, kata ≥8 huruf = 2, akhiran X/Z/Q/V +1. Boss tumbang = reward ×2. Gagal = tanpa penalti.

### 📡 Lost Signal
Kumpulkan 5 fragmen (A–E) sebelum match berakhir. Setiap kata valid berpeluang menjatuhkan fragmen; kata ≥6 huruf menaikkan peluang. Lengkap = reward ×2. Gagal = tanpa penalti.

### 🧳 Traveling Merchant
Toko pop-up 5 menit, bayar dengan Coin pribadimu: Unknown Package (100), Merchant Box (300), Rewind Ticket (400, pulihkan 1 nyawa), Contract (500, 50/50 reward ×2 atau ×0), dan kadang Golden Key (250).

### ⚔️ Penjajah (Invader)
Event musiman Hari Kemerdekaan. Boss mengganggu dengan **Steal** (kata dirampas), **Block** (tidak bisa mengetik ±10 detik), dan **Challenge** (kuis kemerdekaan). Benar ≥3 = sukses, reward ×2. Salah ≥2 = gagal, **tanpa Coin & EXP**.$faq$,
     160),
    ($faq$🃏 Game sampingan apa saja yang ada di /game?$faq$,
     $faq$Ketik `/game`, pilih game, lalu lobby dibuka di channel untuk mengajak yang lain. Game sampingan bersifat santai — **tidak** menambah Coin, EXP, atau inventory.

### 🐺 Werewolf
• **Klasik** — 4 peran (Serigala, Peramal, Tabib, Warga), 4–30 pemain.
• **Lanjutan** — 54 peran (Warga, Serigala, Netral), hingga 100 pemain.

### ⚖️ Pengacara (Persidangan)
Roleplay sidang dengan Hakim, Jaksa, Pengacara, Tersangka, dan Saksi. Puluhan skenario kasus, 8–25 pemain.

### 🎴 UNO
Habiskan kartumu lebih dulu. Ada Skip, Reverse, +2, Wild, +4, dan aturan "UNO!". 2–25 pemain, giliran 45 detik; mulai 8 pemain memakai dua dek.

### 🎵 Tebak Lagu
Bot memutar cuplikan ±20 detik, tebak judulnya lewat form privat. Makin cepat benar, makin besar skor (maks. 100/ronde). 1–15 pemain; mode voice memutar lagu di voice channel host, jadi host & pemain perlu bergabung ke voice channel itu.

Admin server bisa mengatur channel khusus tiap game lewat `/pengaturan`.$faq$,
     170),
    ($faq$🤝 Apa itu Social Hub (Counting & Streak Harian)?$faq$,
     $faq$**Social Hub** (`/sosial`) berisi aktivitas komunitas yang berjalan terus di server. Murni seru-seruan — tanpa Coin, EXP, atau item. Fitur baru aktif setelah admin memilih channel-nya di `/pengaturan`.

### 🔢 Counting
• Hitung bersama di channel Counting, satu angka per orang secara bergantian.
• Boleh angka atau hitungan: `12`, `3*4`, `(10+2)`, `1.000`.
• Benar = ✅ (🏆 saat rekor server pecah). Salah atau menjawab dua kali berturut-turut = hitungan kembali ke 0.
• Pesan bukan angka dianggap obrolan dan diabaikan.

### 🔥 Streak Harian
• Tulis "kata-kata hari ini" minimal **5 kata** sekali sehari di channel streak.
• Kurang dari 5 kata diberi ⏳ — kamu boleh mengedit pesan yang sama.
• Hari berganti pukul **00.00 WIB**; pengingat dikirim ±20.00 & 23.00 WIB.
• Punya **2 🛡️ pelindung per minggu** yang otomatis menyelamatkan streak saat lupa.
• Streak yang putus dihapus **3 hari** kemudian bila tidak dilanjutkan.

Cek status pribadimu di `/sosial` → **Streak Saya**.$faq$,
     180),
    ($faq$🎁 Coin / hadiah / boost saya belum masuk?$faq$,
     $faq$### Cek dulu
• **Reward match** masuk setelah match benar-benar selesai. Match yang dihentikan atau bubar sebelum selesai bisa tidak memberi reward penuh.
• **Reward quest** harus **diklaim** di `/quest`.
• **Boost** dari `/claim`, shop, atau quest bisa dilihat di `/inventory`.
• **Coin & EXP** terbaru bisa dicek di `/stats`.
• Game sampingan (`/game`) dan Social Hub memang **tidak** memberi Coin/EXP.
• Event **Penjajah** yang gagal dan **Contract** yang kalah membuat reward match ×0.

### Masih belum masuk?
Tunggu ±10 menit lalu cek lagi. Bila tetap tidak masuk, tekan tombol di bawah jawaban ini untuk dibantu lebih lanjut, lalu sertakan:
• **Player ID** (ada di `/stats`)
• Nama server & perkiraan jam kejadian
• Reward apa yang seharusnya diterima
• Screenshot bila ada$faq$,
     190),
    ($faq$🎟️ Cara klaim boost harian, reward server & Promo Code$faq$,
     $faq$Semua klaim ada di satu perintah: ketik `/claim` di server.

• 🎁 **Claim Harian** — boost gratis, bisa diambil lagi setelah 24 jam. Class tertentu mendapat bonus boost harian.
• 🎉 **Claim Server Support** — reward khusus member server support resmi (reset 24 jam).
• 🎟️ **Redeem Promo Code** — masukkan kode dari pengumuman resmi. Setiap kode hanya bisa diklaim **sekali per pemain**; reward bisa Coin, EXP, atau boost.

### Klaim ditolak?
• Klaim harian belum 24 jam sejak klaim terakhir — tunggu sampai waktunya.
• Kode promo salah ketik, kedaluwarsa, kuotanya habis, atau sudah pernah kamu pakai.$faq$,
     200),
    ($faq$💾 Apakah progres saya aman & terbawa ke server lain?$faq$,
     $faq$Ya. Progres, statistik, Class, inventory, dan peringkat tersimpan otomatis di server kami dan bersifat **global per akun Discord**.

• Bermain di server mana pun, progresmu tetap sama — tanpa biaya tambahan.
• **Tidak ada wipe berkala**.
• Bot keluar dari server atau diundang ulang **tidak** menghapus progres.
• Pengecualian: data **Streak Harian** (Social Hub) yang putus dihapus 3 hari kemudian bila tidak dilanjutkan.

Kami tidak menjual data ke pihak ketiga. Progres terikat ke akun Discord — bila kamu memakai akun lain, progresnya terpisah.$faq$,
     210),
    ($faq$⚙️ Saya admin — bagaimana mengatur bot di server?$faq$,
     $faq$Ada dua cara dengan hasil yang sama. Butuh izin **Manage Server** (atau Administrator/pemilik server).

### Lewat Discord
Ketik `/pengaturan` untuk membuka panel pengaturan.

### Lewat website
1. Buka **vanillate.id/dashboard** lalu masuk dengan akun Discord.
2. Pilih server yang kamu kelola.
3. Ubah pengaturan lalu simpan — bot mengecek izinnya dan menerapkan otomatis dalam beberapa detik.

### Yang bisa diatur
• **Channel khusus tiap game** — bila dikosongkan, game bisa dibuka di semua channel. Pemain yang membuka game di channel lain akan diarahkan.
• **Channel fitur sosial** (Counting & Streak Harian) — fitur sosial **mati** sampai channel-nya dipilih, dan satu channel hanya untuk satu fitur.

Pastikan bot punya izin View Channel, Send Messages, Embed Links, Read Message History, dan Add Reactions di channel yang dipilih.$faq$,
     220),
    ($faq$🐞 Bagaimana cara melapor bug atau memberi saran?$faq$,
     $faq$### Lewat Kirim Masukan
Ketik `/help` di server, tekan tombol **📬 Kirim Masukan**, pilih kategori **Bug**, **Saran**, **Pertanyaan**, atau **Lainnya**, lalu tulis isinya. Bisa dikirim anonim atau dengan nama, dan langsung diterima tim developer.

### Supaya laporan bug cepat ditangani
• Apa yang kamu lakukan (perintah/tombol apa)
• Apa yang terjadi vs. yang seharusnya terjadi
• Kapan kejadiannya & di server mana
• Pesan error / screenshot bila ada

### Butuh bantuan langsung?
Tekan tombol di bawah jawaban ini untuk dibantu lebih lanjut lewat DM.$faq$,
     230),
    ($faq$🧠 Tips & strategi supaya lebih sering menang$faq$,
     $faq$### Saat bermain
• **Jebak lawan dengan huruf akhir sulit.** Kata yang berakhiran huruf jarang dipakai sebagai awal kata (X, Q, Z, V) membuat lawan kesulitan — sekaligus memberi bonus Coin.
• **Siapkan cadangan kata.** Hafalkan beberapa kata untuk huruf yang sering muncul. Latihan dengan `/kamus [huruf]` sebelum bermain.
• **Jawab cepat.** Jawaban ≤5 detik mengisi weekly quest **⚡ Kilat Kata** (hadiah Golden Key), dan class **Speedster** dapat bonus Coin.
• **Kata panjang itu berharga.** Kata ≥8 huruf memberi bonus Coin, damage besar di Dungeon, dan mempercepat event AI Challenger & Lost Signal.
• Pemain dengan kata terbanyak menjadi **🏅 MVP** (+10 EXP, +5 Coin).

### Pakai boost dengan tepat
• Pasang **Shield / Extra Life** di Pre-Match untuk game kompetitif.
• Simpan **Hint** untuk huruf yang benar-benar buntu, dan **Reroll** bila huruf awalnya sulit.

### Kejar bonus
• **Win Streak:** menang beruntun 3 / 5 / 10 kali memberi +10 / +25 / +50 Coin; 20 kali memberi Mystery Box; 50 & 100 kali memberi gelar khusus.
• Selesaikan semua quest harian (**+25 Coin**) dan mingguan (**+100 Coin + Mystery Box**).
• Ambil `/claim` setiap hari — gratis!
• Pilih class sesuai gaya main: **Scholar** (Hint gratis harian), **Guardian** (Extra Life gratis harian), **Hunter** (bonus kata panjang & huruf langka).$faq$,
     240),
    ($faq$📚 Apa saja perintah (command) yang tersedia?$faq$,
     $faq$### Bermain
• `/sambungkata` — semua mode: PvP, PvB, Player vs Server, Dungeon
• `/game` — Werewolf, Pengacara, UNO, Tebak Lagu
• `/sosial` — Social Hub: Counting & Streak Harian

### Progres & info
• `/stats` — statistik lengkap & Player ID
• `/leaderboard` — 10 pemain teratas
• `/class` — pilih class & beli talent
• `/quest` — quest harian & mingguan
• `/kamus [huruf]` — daftar kata berdasarkan 1–3 huruf awal

### Ekonomi
• `/claim` — boost harian, reward server, promo code
• `/shop` — beli boost & Golden Key
• `/inventory` — boost yang kamu miliki

### Bantuan
• `/tutorial` — Tutorial Pemain Baru
• `/help` — panduan lengkap, plus tombol **🛟 Pusat Bantuan** (FAQ ini & Tim Support) dan **📬 Kirim Masukan** (saran & laporan bug)

### Admin server
• `/pengaturan` — channel game & fitur sosial (butuh Manage Server)$faq$,
     250)
) as v(question, answer, sort)
where not exists (select 1 from public.bot_faqs where bot_slug = 'sambung-kata');
