// Pertanyaan yang sering ditanyakan, per bot.
// Dipakai oleh komponen <FAQAccordion> di halaman /bots/[slug].
// Jawaban ditulis mengikuti konten dokumentasi (docs.ts) supaya selalu akurat.
// Sintaks `kode` di dalam jawaban akan dirender sebagai <code> (lihat FAQAccordion).

export type FaqItem = { q: string; a: string };

export const faqs: Record<string, FaqItem[]> = {
  // ═══════════════════════════════════════════════════════════════════
  // SAMBUNG KATA
  // ═══════════════════════════════════════════════════════════════════
  'sambung-kata': [
    {
      q: 'Bagaimana cara mulai bermain?',
      a: 'Undang bot ke server, lalu jalankan `/sambungkata mode:pvp` untuk buka lobby bersama teman, atau `mode:pvb` untuk melawan bot AI. Sambung kata dari huruf yang ditentukan, dan pastikan katanya ada di kamus.',
    },
    {
      q: 'Bagaimana cara mendapatkan EXP?',
      a: 'Kamu dapat +1 EXP tiap kata valid, +10 EXP menyelesaikan pertandingan, +15 EXP saat menang, dan +5 EXP jika jadi MVP. EXP masuk ke Account Level dan Class yang sedang aktif. Quest harian & mingguan juga memberi EXP tambahan.',
    },
    {
      q: 'Kapan Class terbuka dan apa gunanya?',
      a: 'Class System terbuka di Account Level 3 (butuh 500 EXP per level). Ada 9 Class yang masing-masing punya passive nyata: bonus reward, boost harian ekstra, peluang selamat dari eliminasi, damage ekstra di Dungeon, dan lainnya. Cek daftarnya dengan `/class list`.',
    },
    {
      q: 'Apakah class bisa diganti?',
      a: 'Bisa. Pemilihan class pertama gratis, dan ganti class berikutnya seharga 750 Coin lewat `/class`. Setiap class juga punya Talent Tree eksklusif yang bisa dibeli dengan Coin untuk bonus pasif tambahan.',
    },
    {
      q: 'Apa itu Dungeon dan bagaimana cara masuknya?',
      a: 'Dungeon adalah mode solo paling menantang: kamu melawan Dungeon Guardian selama 5 wave. Untuk masuk kamu butuh 🗝️ Golden Key. Jika tamat, semua reward digandakan (x2) plus drop pasti berupa Extra Life, boost acak, dan Dungeon Trophy.',
    },
    {
      q: 'Bagaimana cara mendapatkan Golden Key?',
      a: 'Ada 3 cara: beli langsung 350 Coin di `/shop`, selesaikan weekly quest ⚡ Kilat Kata (20 jawaban ≤5 detik), atau beli dengan harga diskon (250 Coin) saat Traveling Merchant muncul. Kamu maksimal memegang 1 kunci.',
    },
    {
      q: 'Apa itu Boost dan bagaimana mendapatkannya?',
      a: 'Boost adalah item bantu main. Pre-Match Boost (Extra Life, Shield, Extra Time) diaktifkan sebelum game; In-Game Boost (Hint, Reroll) dipakai saat bermain. Dapatkan dari `/claim` (gratis tiap 24 jam), `/shop`, Mystery Box, atau reward quest.',
    },
    {
      q: 'Seberapa besar kamusnya, dan bagaimana kata dinilai?',
      a: 'Kamusnya berisi 21.000+ kata Bahasa Indonesia dengan validasi otomatis. Kata harus diawali huruf yang ditentukan, ada di kamus, minimal 2 huruf, dan belum pernah dipakai di ronde itu. Kamu bisa mengecek sebuah kata dengan `/kamus [kata]`.',
    },
    {
      q: 'Bisa main di berapa server?',
      a: 'Tidak terbatas. Progress, statistik, dan leaderboard bersifat global per pemain, jadi capaianmu terbawa ke server mana pun kamu bermain.',
    },
    {
      q: 'Apakah quest reset? Kapan?',
      a: 'Ya. Ada 4 Daily Quest yang reset tiap tengah malam dan 6 Weekly Quest yang reset setiap Senin. Menyelesaikan semuanya memberi Bonus Chest berisi Coin dan Mystery Box.',
    },
    {
      q: 'Apakah progresku bisa hilang?',
      a: 'Tidak. Semua progres tersimpan otomatis di server dan tidak ada wipe berkala. Statistikmu, Class, dan inventory tetap aman.',
    },
  ],

  // ═══════════════════════════════════════════════════════════════════
  // TAHU BULAT
  // ═══════════════════════════════════════════════════════════════════
  'tahu-bulat': [
    {
      q: 'Bagaimana cara mulai bermain?',
      a: 'Ketik `/tahu` untuk membuka dashboard usaha (modal awal 1.000 coin). Tekan 🥟 Jual Tahu, tunggu beberapa detik sampai selesai menggoreng, dan coin masuk otomatis. Pakai coin itu untuk 🔧 Upgrade agar makin cuan.',
    },
    {
      q: 'Bagaimana pendapatan offline bekerja?',
      a: 'Saat kamu tidak bermain, toko tetap menghasilkan hingga 8 jam, sekitar 50% dari kecepatan aktif. Buka `/tahu` lagi untuk mengklaim pendapatan yang terkumpul selama kamu pergi.',
    },
    {
      q: 'Kalau pergi lama, apakah rugi?',
      a: 'Tidak. Pendapatan offline dibatasi maksimal 8 jam, jadi kamu tidak kena penalti apa pun, hanya saja penghasilan tidak menumpuk melebihi batas itu. Aman ditinggal kerja atau tidur.',
    },
    {
      q: 'Apa saja tingkatan kendaraan dan harganya?',
      a: 'Ada 5 tingkat: Gerobak Kayu (kendaraan awal) → Motor Tahu (5.000) → Pick Up Tahu (50.000) → Van Tahu (500.000) → Food Truck (5.000.000 coin). Food Truck adalah kendaraan tertinggi sekaligus syarat untuk Rebirth.',
    },
    {
      q: 'Apa itu Rebirth?',
      a: 'Rebirth mengulang usaha dari awal demi bonus permanen +20% setiap kali, dan bonusnya menumpuk selamanya. Syaratnya: kendaraan sudah Food Truck, semua peralatan Level 5, dan semua bahan Level 50.',
    },
    {
      q: 'Apa yang hilang dan apa yang aman saat Rebirth?',
      a: 'Yang direset: coin, kendaraan, peralatan, bahan, dan promosi. Yang tetap aman: jumlah rebirth, statistik, dan achievement. Jadi kamu memulai lagi lebih kuat, bukan dari nol yang sebenarnya.',
    },
    {
      q: 'Bagaimana sistem upgrade bekerja?',
      a: 'Ada 3 lapis: Kendaraan menentukan pendapatan dasar; 10 Peralatan (maks Level 5, harga naik 1.35× per level) memberi bonus; dan 30 Bahan (maks Level 50, harga naik 1.18× per level) adalah kunci penghasilan besar di late game. Ada tombol ⬆️ Upgrade Semua untuk menaikkan sekaligus.',
    },
    {
      q: 'Peralatan mana yang sebaiknya diprioritaskan?',
      a: 'Kompor. Kompor memangkas cooldown jualan (Lv1: 5 detik → Lv5: 2 detik). Cooldown lebih cepat berarti kamu bisa jualan lebih sering, sehingga pendapatan naik lebih cepat.',
    },
    {
      q: 'Apa itu Promosi?',
      a: 'Promosi memberi bonus pendapatan sementara, dari 📰 Poster (+15%) sampai 📱 Media Sosial (+50%). Hanya satu promosi bisa aktif dalam satu waktu, dan efeknya bisa diperkuat dengan menaikkan level Banner Promosi.',
    },
    {
      q: 'Bisa main bareng teman?',
      a: 'Bisa. Setiap orang punya usaha sendiri, lalu kalian bisa saling adu di 🏆 Peringkat dengan kategori Total Coin Dihasilkan, Kekayaan, dan Total Rebirth.',
    },
    {
      q: 'Kenapa tombol saya terkunci?',
      a: 'Kendaraan sedang menggoreng/berjualan. Selama proses itu semua tombol terkunci sebentar, kamu tidak perlu menekan apa pun. Tunggu beberapa detik dan tombol terbuka sendiri, tanpa perlu refresh manual.',
    },
    {
      q: 'Apakah progresku bisa hilang?',
      a: 'Tidak. Semua progres tersimpan otomatis di server, jadi usahamu tetap ada meski kamu tutup Discord.',
    },
  ],

  // ═══════════════════════════════════════════════════════════════════
  // ANONYMOUS CHAT
  // ═══════════════════════════════════════════════════════════════════
  'anonymous-chat': [
    {
      q: 'Bagaimana privasi saya dijaga?',
      a: 'Identitas Discord kamu disembunyikan sepanjang percakapan. Obrolan terjadi di channel privat yang hanya bisa diakses kalian berdua, dan channel itu otomatis terhapus setelah sesi berakhir sehingga tidak ada jejak yang tertinggal.',
    },
    {
      q: 'Apakah obrolan tersimpan?',
      a: 'Tidak. Channel privat setiap pasangan otomatis terhapus begitu sesi selesai, jadi percakapan tidak diarsipkan.',
    },
    {
      q: 'Bagaimana cara ketemu partner ngobrol?',
      a: 'Random matchmaking memasangkanmu dengan pengguna lain secara acak dalam hitungan detik. Kalau mau lebih terarah, pakai Interest Match untuk dipasangkan dengan orang yang punya minat atau topik serupa.',
    },
    {
      q: 'Apa itu Interest Match?',
      a: 'Interest Match adalah matchmaking berbasis minat: kamu dipasangkan dengan partner yang memiliki ketertarikan atau topik yang sama denganmu, supaya obrolan lebih nyambung.',
    },
    {
      q: 'Apa itu Gender Preference?',
      a: 'Gender Preference adalah fitur Premium yang memungkinkanmu memilih preferensi gender partner. Founding Members yang bergabung selama beta mendapat akses fitur ini sebagai bagian dari hadiah.',
    },
    {
      q: 'Bisa kirim gambar, GIF, atau sticker?',
      a: 'Bisa. Anonymous Chat mendukung teks, gambar, GIF, sticker, dan emoji selama percakapan.',
    },
    {
      q: 'Bagaimana kalau ketemu orang yang mengganggu?',
      a: 'Tersedia tombol Report dan Block untuk pengguna yang mengganggu. Selain itu ada moderasi dan filter otomatis yang bekerja menjaga obrolan tetap aman dan nyaman.',
    },
    {
      q: 'Apa itu Next Partner?',
      a: 'Next Partner adalah fitur untuk melewati obrolan yang sedang berjalan dan langsung mencari partner baru kapan saja, tanpa perlu keluar-masuk lagi.',
    },
    {
      q: 'Perlu berteman dulu di Discord?',
      a: 'Tidak perlu. Kamu bisa terhubung dan mengobrol dengan pengguna lain tanpa harus add friend lebih dulu.',
    },
    {
      q: 'Apa itu program Founding Members?',
      a: 'Semua pemain yang bergabung selama masa beta mendapat hadiah eksklusif yang aktif otomatis saat rilis resmi: Premium gratis 3 bulan, akses fitur Gender Preference, badge Beta Tester di profil, dan akses lebih awal ke fitur terbaru.',
    },
    {
      q: 'Kapan rilis resminya?',
      a: 'Saat ini Anonymous Chat berada di tahap beta dengan preorder yang sudah dibuka. Undang sekarang untuk mengamankan status Founding Members, dan ikuti kabar rilisnya di server Discord kami.',
    },
  ],
};
