// Pertanyaan yang sering ditanyakan, per bot.
// Dipakai oleh komponen <FAQAccordion> di halaman /bots/[slug].
// Jawaban ditulis mengikuti konten dokumentasi (docs.ts) supaya selalu akurat.
// Sintaks `kode` di dalam jawaban akan dirender sebagai <code> (lihat FAQAccordion).

export type FaqItem = { q: string; a: string };

// ═══════════════════════════════════════════════════════════════════
// FAQ UMUM (bukan spesifik satu bot)
// Dipakai di halaman /bots, /docs, dan /support lewat <FAQAccordion>.
// ═══════════════════════════════════════════════════════════════════
export const generalFaqs: FaqItem[] = [
  {
    q: 'Apakah semua bot Vanillate gratis?',
    a: 'Ya. Semua bot kami, Sambung Kata dan Vanillate Games (Werewolf + Tahu Bulat), gratis dimainkan tanpa langganan wajib. Kamu cukup mengundang bot ke server dan langsung bermain. Fitur Premium opsional hanya menambah kenyamanan, bukan syarat untuk menikmati intinya.',
  },
  {
    q: 'Bagaimana cara mengundang bot ke server saya?',
    a: 'Buka halaman bot yang kamu inginkan, tekan tombol `Undang ke Server`, pilih server tujuan, lalu setujui izin yang diminta. Kamu perlu izin `Manage Server` di server tersebut. Setelah itu bot langsung aktif dan bisa dipakai dengan slash command.',
  },
  {
    q: 'Izin apa saja yang dibutuhkan bot?',
    a: 'Bot hanya meminta izin yang benar-benar diperlukan untuk berfungsi: mengirim pesan, menyematkan embed, membaca jawaban di channel permainan, dan mengelola komponen interaktif. Kami tidak meminta izin administrator dan tidak menyentuh channel di luar keperluan permainan.',
  },
  {
    q: 'Apakah progres dan data saya aman?',
    a: 'Aman. Semua progres tersimpan otomatis di server kami, tidak ada wipe berkala, dan tidak ada data yang dijual ke pihak ketiga. Detail lengkapnya bisa kamu baca di halaman Kebijakan Privasi.',
  },
  {
    q: 'Bisa main bot yang sama di beberapa server sekaligus?',
    a: 'Bisa. Progres, statistik, dan leaderboard bersifat global per pemain, jadi capaianmu terbawa ke server mana pun kamu bermain. Kamu bisa mengundang bot ke sebanyak mungkin server tanpa biaya.',
  },
  {
    q: 'Bot tidak merespons command, kenapa?',
    a: 'Coba beberapa hal ini: pastikan bot punya izin mengirim pesan di channel tersebut, ketik ulang slash command dari awal (mulai dengan `/`), dan tunggu beberapa detik jika Discord sedang lambat memuat command. Kalau masih bermasalah, laporkan di server Discord Support kami, orang yang menulis kodenya akan langsung membantu.',
  },
  {
    q: 'Bagaimana cara memberi masukan atau melaporkan bug?',
    a: 'Gunakan command `/masukan` langsung di dalam bot, atau gabung ke server Discord Support dan sampaikan di channel yang sesuai. Kami membaca semua laporan dan masukan, dan banyak fitur kami justru lahir dari usulan komunitas.',
  },
  {
    q: 'Seberapa sering bot diperbarui?',
    a: 'Rutin. Kami merilis perbaikan bug, penyeimbangan gameplay, dan fitur baru secara berkala, sering kali setiap pekan. Bagi kami rilis adalah garis start, bukan garis finis, jadi bot terus dirawat setelah diluncurkan.',
  },
];

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
      q: 'Event spesial apa saja yang bisa muncul saat main PvP?',
      a: 'Ada 4 event yang muncul acak di ronde 20–30 mode PvP: 🤖 AI Challenger (boss bersama, kalahkan untuk reward ×2), 📡 Lost Signal (kumpulkan 5 fragmen), 🧳 Traveling Merchant (toko dadakan item langka, aktif 5 menit), dan 🗡️ Penjajah/Invader (boss event Hari Kemerdekaan 17 Agustus). Saat intro event timer dibekukan, jadi kamu sempat menyusun strategi. Detail tiap event ada di dokumentasi Sambung Kata bagian Event Spesial PvP.',
    },
    {
      q: 'Apa itu event Penjajah (Invader)?',
      a: 'Penjajah adalah event spesial musiman untuk memperingati Hari Kemerdekaan Indonesia (17 Agustus). Boss "Penjajah" menekan pemain lewat 3 mekanik paralel: Steal (merampas kata), Block (menahan input ~10 detik), dan Challenge (soal kuis kemerdekaan pilihan ganda). Jawab benar ≥3 kali untuk mengusirnya dan dapat reward ×2. Kalau salah ≥2 kali, event gagal (hard-fail) dan match berakhir tanpa reward.',
    },
    {
      q: 'Seberapa besar kamusnya, dan bagaimana kata dinilai?',
      a: 'Kamusnya berisi 25.000+ kata Bahasa Indonesia dengan validasi otomatis. Kata harus diawali huruf yang ditentukan, ada di kamus, minimal 2 huruf, dan belum pernah dipakai di ronde itu. Kamu bisa mengecek sebuah kata dengan `/kamus [kata]`.',
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
  // VANILLATE GAMES (hub: Werewolf & Tahu Bulat)
  // ═══════════════════════════════════════════════════════════════════
  'vanillate-games': [
    {
      q: 'Apa itu Vanillate Games?',
      a: 'Vanillate Games adalah hub game Discord dari Vanillate Studio. Satu bot yang berisi beberapa game sekaligus. Saat ini tersedia 🐺 Werewolf (deduksi sosial) dan 🥟 Tahu Bulat (simulasi bisnis idle), dengan game baru akan menyusul di bot yang sama, tanpa perlu invite ulang.',
    },
    {
      q: 'Command apa saja yang tersedia?',
      a: 'Ada tiga: `/gamewerewolf` untuk membuka lobi Werewolf, `/gametahu` untuk membuka dashboard Tahu Bulat, dan `/help` untuk panduan singkat di dalam Discord.',
    },
    // ── Werewolf ────────────────────────────────────────────
    {
      q: 'Bagaimana cara mulai main Werewolf?',
      a: 'Ketik `/gamewerewolf` di channel untuk membuka lobi. Pemain lain menekan ✅ Gabung, lalu setelah minimal 4 pemain masuk, host menekan ▶️ Mulai. Setiap pemain lalu menekan 🎭 Lihat Peran untuk melihat perannya secara rahasia.',
    },
    {
      q: 'Berapa jumlah pemain Werewolf?',
      a: 'Mode Klasik butuh 4–12 pemain. Bot mengatur komposisi peran otomatis: sekitar 1 serigala per 5 pemain, Peramal aktif sejak 4 pemain, Tabib aktif sejak 6 pemain. Mode Lanjutan mendukung lebih banyak pemain dengan hingga 54 role modern.',
    },
    {
      q: 'Apa bedanya mode Klasik dan Lanjutan?',
      a: 'Mode Klasik pakai 4 role dasar (Serigala, Peramal, Tabib, Warga), sederhana dan cepat dipahami. Mode Lanjutan dipandu narator dengan sistem giliran dan menyediakan hingga 54 role modern (Vigilante, Bodyguard, Cupid, Witch, dll). Durasi timernya sama untuk keduanya.',
    },
    {
      q: 'Berapa lama durasi tiap fase?',
      a: 'Fase Aksi Malam 50 detik, Diskusi Siang 3 menit, dan Voting 1 menit. Semua maju otomatis saat timer habis. Host bisa mempercepat fase kalau semua pemain sudah selesai beraksi.',
    },
    {
      q: 'Apa yang terjadi di fase Malam?',
      a: '🐺 Serigala memilih satu mangsa (suara terbanyak yang dimangsa), 🔮 Peramal menyelidiki satu pemain untuk tahu apakah ia serigala, dan 🩺 Tabib melindungi satu pemain dari terkaman malam itu. Host menekan 🌅 Lanjut ke Siang untuk menyelesaikan malam.',
    },
    {
      q: 'Bagaimana voting di siang hari bekerja?',
      a: 'Semua pemain hidup berdiskusi di channel Discord, lalu 🗳️ voting satu tersangka. Suara terbanyak dieksekusi; seri berarti tidak ada eksekusi hari itu. Host menekan ⚖️ Hitung Suara untuk menutup siang.',
    },
    {
      q: 'Kapan Warga menang, kapan Serigala menang?',
      a: 'Warga menang bila semua serigala tereksekusi. Serigala menang bila jumlah serigala menyamai jumlah warga. Setiap kubu berjuang untuk kubunya sendiri.',
    },
    {
      q: 'Apakah diskusi terjadi di bot?',
      a: 'Tidak. Diskusi terjadi langsung di channel Discord kamu, bot hanya mengatur aksi rahasia, timer, dan voting. Pastikan semua pemain hidup ada di channel yang sama saat fase Siang berjalan.',
    },
    // ── Tahu Bulat ─────────────────────────────────────────
    {
      q: 'Bagaimana cara mulai main Tahu Bulat?',
      a: 'Ketik `/gametahu` untuk membuka dashboard usaha (modal awal 1.000 coin). Tekan 🥟 Jual Tahu, tunggu beberapa detik sampai selesai menggoreng, dan coin masuk otomatis. Pakai coin itu untuk 🔧 Upgrade agar makin cuan.',
    },
    {
      q: 'Bagaimana pendapatan offline Tahu Bulat bekerja?',
      a: 'Saat kamu tidak bermain, toko tetap menghasilkan hingga 8 jam, sekitar 50% dari kecepatan aktif. Buka `/gametahu` lagi untuk mengklaim pendapatan yang terkumpul selama kamu pergi.',
    },
    {
      q: 'Kalau pergi lama, apakah rugi?',
      a: 'Tidak. Pendapatan offline Tahu Bulat dibatasi maksimal 8 jam, jadi kamu tidak kena penalti apa pun, hanya saja penghasilan tidak menumpuk melebihi batas itu. Aman ditinggal kerja atau tidur.',
    },
    {
      q: 'Apa itu Rebirth di Tahu Bulat?',
      a: 'Rebirth mengulang usaha dari awal demi bonus permanen +20% setiap kali, dan bonusnya menumpuk selamanya. Syaratnya: kendaraan sudah Food Truck, semua peralatan Level 5, dan semua bahan Level 50. Yang direset: coin, kendaraan, peralatan, bahan, promosi. Yang aman: jumlah rebirth, statistik, achievement.',
    },
    {
      q: 'Peralatan Tahu Bulat mana yang sebaiknya diprioritaskan?',
      a: 'Kompor. Kompor memangkas cooldown jualan (Lv1: 5 detik → Lv5: 2 detik). Cooldown lebih cepat berarti kamu bisa jualan lebih sering, sehingga pendapatan naik lebih cepat.',
    },
    // ── Umum ───────────────────────────────────────────────
    {
      q: 'Apakah progresku bisa hilang?',
      a: 'Tidak. Semua progres — statistik Tahu Bulat, riwayat match Werewolf, dan data akun lainnya — tersimpan otomatis di server, jadi tetap ada meski kamu tutup Discord.',
    },
    {
      q: 'Apakah akan ada game baru?',
      a: 'Ya. Vanillate Games dirancang sebagai hub: game baru akan ditambahkan sebagai command `/game...` berikutnya di bot yang sama, dan otomatis muncul untuk semua server yang sudah mengundang bot. Tidak perlu invite ulang.',
    },
    {
      q: 'Apa itu Vanillate Story? Kapan rilis?',
      a: 'Vanillate Story adalah Life Simulation RPG di Kota Vanillate: mulai dari nol sebagai pendatang, bangun karier, kumpulkan harta, kenali NPC, sampai membangun rumah tangga. Statusnya masih **coming soon**, command `/gamestory` belum aktif. Begitu rilis, command otomatis muncul di setiap server yang sudah pakai Vanillate Games — tanpa invite ulang. Ikuti kabar rilisnya di server Discord Support.',
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
