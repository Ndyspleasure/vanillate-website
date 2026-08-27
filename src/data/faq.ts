// Pertanyaan yang sering ditanyakan, per produk.
// Dipakai oleh komponen <FAQAccordion> di halaman /products/[slug].
// Jawaban ditulis mengikuti konten dokumentasi (docs.ts) supaya selalu akurat.
// Sintaks `kode` di dalam jawaban akan dirender sebagai <code> (lihat FAQAccordion).

export type FaqItem = { q: string; a: string };

// ═══════════════════════════════════════════════════════════════════
// FAQ UMUM — level studio, berlaku untuk seluruh produk.
// Dipakai di halaman /products, /docs, dan /support lewat <FAQAccordion>.
// Pertanyaannya sengaja netral platform; contoh spesifik (mis. Discord)
// hanya muncul di JAWABAN saat memang perlu supaya tetap akurat.
// ═══════════════════════════════════════════════════════════════════
export const generalFaqs: FaqItem[] = [
  {
    q: 'Apakah produk Vanillate bisa membantu menghidupkan komunitas yang sepi?',
    a: 'Bisa, dan itu memang salah satu kekuatannya. Produk kami dirancang mengajak banyak anggota ikut berinteraksi sekaligus, sehingga obrolan yang tadinya sepi cepat kembali ramai. Contohnya satu sesi Vanillate Sambung Kata di Discord bisa mendongkrak jumlah pesan sampai ratusan, sekaligus membantu anggota naik level di komunitas yang memakai sistem keaktifan.',
  },
  {
    q: 'Apakah produk Vanillate gratis?',
    a: 'Ya. Inti setiap produk kami bisa dipakai tanpa langganan wajib. Fitur Premium opsional hanya menambah kenyamanan, bukan syarat untuk menikmati bagian utamanya.',
  },
  {
    q: 'Bagaimana cara mulai memakai produknya?',
    a: 'Buka halaman produk yang kamu inginkan, lalu ikuti tombol utamanya. Caranya menyesuaikan jenis produk: ada yang diundang ke komunitasmu, ada yang diunduh sebagai aplikasi, ada pula yang langsung dibuka lewat web. Setiap halaman produk menjelaskan langkahnya.',
  },
  {
    q: 'Izin atau akses apa yang dibutuhkan?',
    a: 'Kami hanya meminta akses yang benar-benar diperlukan agar produk berfungsi, dan tidak pernah meminta hak administratif yang tidak perlu. Untuk produk komunitas seperti Sambung Kata di Discord, izinnya sebatas mengirim pesan, menyematkan embed, membaca jawaban di channel permainan, dan mengelola komponen interaktif.',
  },
  {
    q: 'Apakah progres dan data saya aman?',
    a: 'Aman. Data tersimpan otomatis di infrastruktur kami, tidak ada penghapusan berkala, dan tidak ada data yang dijual ke pihak ketiga. Detail lengkapnya bisa kamu baca di halaman Kebijakan Privasi.',
  },
  {
    q: 'Apakah progres saya terbawa antar komunitas atau perangkat?',
    a: 'Ya. Progres, statistik, dan peringkat bersifat global per pengguna, jadi capaianmu terbawa ke mana pun kamu memakainya. Kamu juga bebas memakainya di sebanyak mungkin komunitas tanpa biaya.',
  },
  {
    q: 'Produknya tidak merespons, apa yang harus dilakukan?',
    a: 'Coba beberapa hal ini dulu. Pastikan produk punya izin yang diperlukan di tempat kamu memakainya, ulangi aksinya dari awal, lalu tunggu beberapa detik bila platformnya sedang lambat. Kalau masih bermasalah, laporkan lewat kanal support kami, dan orang yang menulis kodenya akan langsung membantu.',
  },
  {
    q: 'Bagaimana cara memberi masukan atau melaporkan bug?',
    a: 'Kirim lewat Support Center di situs ini, atau gabung ke komunitas kami dan sampaikan di channel yang sesuai. Khusus Sambung Kata, kamu juga bisa memakai command `/masukan` langsung di dalam produknya. Kami membaca semua laporan, dan banyak fitur kami justru lahir dari usulan komunitas.',
  },
  {
    q: 'Seberapa sering produknya diperbarui?',
    a: 'Rutin. Kami merilis perbaikan bug, penyempurnaan pengalaman, dan fitur baru secara berkala, sering kali setiap pekan. Bagi kami rilis adalah garis start, bukan garis finis, jadi produk terus dirawat setelah diluncurkan.',
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
      a: 'Ada 4 event yang muncul acak di ronde 20 sampai 30 pada mode PvP, yaitu 🤖 AI Challenger (boss bersama, kalahkan untuk reward ×2), 📡 Lost Signal (kumpulkan 5 fragmen), 🧳 Traveling Merchant (toko dadakan item langka, aktif 5 menit), dan 🗡️ Penjajah atau Invader (boss event Hari Kemerdekaan 17 Agustus). Saat intro event timer dibekukan, jadi kamu sempat menyusun strategi. Detail tiap event ada di dokumentasi Vanillate Sambung Kata bagian Event Spesial PvP.',
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
};
