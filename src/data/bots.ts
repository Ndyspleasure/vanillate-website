// Registry bot Vanillate Studio.
// Tambah bot baru? Cukup tambahkan objek di array `bots` dan buat halaman docs jika perlu.
// Halaman /bots dan /bots/[slug] akan otomatis menampilkannya.

export type Bot = {
  slug: string;                 // URL segment: /bots/<slug>
  name: string;                 // Nama lengkap
  shortName: string;            // Nama pendek untuk tombol/badge
  tagline: string;              // Kalimat singkat 1 baris
  description: string;          // Paragraf pendek untuk halaman detail
  status: 'live' | 'beta' | 'preorder' | 'coming-soon';
  featured: boolean;            // Highlight utama di beranda
  category: string;             // ex: "Word Game", "Idle Simulation"
  clientId?: string;            // Discord Application/Client ID (kosongkan jika belum rilis)
  permissions: string;          // Bitwise permission integer
  scopes: string[];             // OAuth2 scopes
  color: string;                // Aksen warna bot (hex)
  icon: string;
  thumbnail?: string;           // Path thumbnail PNG persegi di /public
  features: string[];           // 3-6 poin fitur utama
  commands?: { name: string; description: string }[]; // sample command untuk halaman detail
  docsSlug?: string;            // slug dokumentasi /docs/<docsSlug> (kosongkan jika belum ada)
  longIntro?: string[];         // Paragraf narasi panjang untuk halaman detail (opsional)
  ctaNote?: string;             // Catatan kecil di bawah tombol invite (mis. status preorder)
  founding?: {                  // Program Founding Members / early access (opsional)
    title: string;
    intro: string;
    perks: string[];
    requirements?: string[];
    footnote?: string;
  };
};

/**
 * Bangun invite URL Discord dari clientId + permissions + scopes.
 */
export function buildInviteUrl(bot: Bot): string | null {
  if (!bot.clientId || bot.status === 'coming-soon') return null; // preorder tetap boleh diundang
  const params = new URLSearchParams({
    client_id: bot.clientId,
    permissions: bot.permissions,
    scope: bot.scopes.join(' '),
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export const bots: Bot[] = [
  {
    slug: 'sambung-kata',
    thumbnail: '/bots/sambung-kata.png',
    name: 'Vanillate Sambung Kata',
    shortName: 'Sambung Kata',
    tagline: 'Game sambung kata yang kamu kenal sejak kecil, dengan kedalaman yang belum pernah kamu mainkan.',
    description:
      'Permainan kata klasik Indonesia, dibangun ulang untuk Discord. Sambung kata bersama teman di mode PvP, tantang bot AI di empat tingkat kesulitan, atau turun sendirian ke Dungeon, sambil menaikkan Class, menyelesaikan Quest, dan meracik strategi Boost. Kamus 21.000+ kata memastikan setiap jawaban dinilai adil.',
    status: 'live',
    featured: true,
    category: 'Word Game',
    clientId: '1513806760622817320', // TODO: isi Client ID Discord
    permissions: '277025770496',
    scopes: ['bot', 'applications.commands'],
    color: '#E8B84A',
    icon: '✦',
    features: [
      'Kamus Bahasa Indonesia 21.000+ kata dengan validasi otomatis',
      'Tiga mode: PvP hingga 10 pemain, PvB 4 tingkat kesulitan, dan Dungeon',
      '9 Class dengan passive unik plus Talent Tree',
      'Boost system 5 jenis dengan rarity Common hingga Legendary',
      'Quest harian & mingguan, promo code, dan event in-game acak',
      'Leaderboard global, win streak, dan Dungeon Trophy',
    ],
    commands: [
      { name: '/sambungkata', description: 'Mulai permainan: mode PvP, PvB, atau Dungeon' },
      { name: '/stats', description: 'Statistik lengkap & Player ID' },
      { name: '/class', description: 'Pilih class & beli talent' },
      { name: '/quest', description: 'Dashboard quest harian & mingguan' },
      { name: '/shop', description: 'Beli boost & Golden Key dengan Coin' },
      { name: '/help', description: 'Panduan lengkap di dalam Discord' },
    ],
    docsSlug: 'sambung-kata',
  },
  {
    slug: 'tahu-bulat',
    thumbnail: '/bots/tahu-bulat.png',
    name: 'Vanillate Tahu Bulat',
    shortName: 'Tahu Bulat',
    tagline: 'Bangun kerajaan tahu bulat, dari gerobak kayu sampai food truck.',
    description:
      'Simulasi bisnis idle bertema kuliner paling Indonesia. Jual tahu, upgrade gerobak sampai jadi food truck, dan biarkan tokomu tetap menghasilkan bahkan saat kamu sedang offline. Buat yang sabar, Rebirth menghadiahkan bonus permanen yang menumpuk selamanya.',
    status: 'live',
    featured: false,
    category: 'Idle Simulation',
    clientId: '1521948490803187903', // TODO: isi Client ID Discord
    permissions: '277025770496',
    scopes: ['bot', 'applications.commands'],
    color: '#4FA89D',
    icon: '◉',
    features: [
      'Pendapatan offline hingga 8 jam saat tidak bermain',
      '5 kendaraan, 10 peralatan, dan 30 bahan untuk di-upgrade',
      'Rebirth dengan bonus permanen +20% yang menumpuk selamanya',
      'Misi harian dan 12 achievement permanen',
      'Fitur Upgrade Semua untuk menaikkan semua sekaligus',
      'Peringkat 3 kategori antar pemain',
    ],
    commands: [
      { name: '/tahu', description: 'Buka dashboard usaha: semua fitur ada di sini' },
      { name: '/help', description: 'Panduan lengkap di dalam Discord' },
    ],
    docsSlug: 'tahu-bulat',
  },
  {
    slug: 'anonymous-chat',
    thumbnail: '/bots/anonymous-chat.png',
    name: 'Anonymous Chat Vanillate',
    shortName: 'Anonymous Chat',
    tagline: 'Ketemu orang baru dan ngobrol tanpa mengungkap identitasmu.',
    description:
      'Discord Bot untuk bertemu dan mengobrol dengan orang baru secara anonim. Identitas Discord kamu disembunyikan, obrolan berlangsung di channel privat berdua, dan semuanya dirancang mengutamakan privasi, keamanan, serta kenyamanan.',
    status: 'preorder',
    featured: false,
    category: 'Social',
    clientId: '1528619351844982965',
    permissions: '268561488',
    scopes: ['bot', 'applications.commands'],
    color: '#14B8A6',
    icon: '◐',
    ctaNote: 'Preorder dibuka · masih tahap beta',
    longIntro: [
      'Anonymous Chat mempertemukanmu dengan pengguna lain di Discord tanpa perlu berteman lebih dulu. Sistem matchmaking-nya bisa memasangkanmu secara acak dalam hitungan detik, atau mencarikan partner dengan minat yang sama lewat Interest Match.',
      'Setiap pasangan mendapat channel privat yang hanya bisa diakses berdua. Kirim teks, gambar, GIF, sticker, dan emoji dengan bebas. Bosan atau ingin suasana baru? Pakai Next Partner untuk lompat ke obrolan berikutnya kapan saja.',
      'Privasi jadi inti dari semuanya. Identitas Discord disembunyikan sepanjang percakapan, dan channel otomatis terhapus setelah sesi berakhir sehingga tidak ada jejak yang tertinggal. Sistem report, block, dan filter otomatis menjaga obrolan tetap aman dan nyaman.',
      'Mau cari teman ngobrol, berbagi cerita, berdiskusi, atau sekadar mengisi waktu luang, Anonymous Chat siap mempertemukanmu dengan orang-orang baru dari berbagai komunitas.',
    ],
    features: [
      'Identitas Discord disembunyikan selama percakapan',
      'Random matchmaking, temukan partner secara acak dalam detik',
      'Interest Match, cari partner dengan minat atau topik yang sama',
      'Gender Preference untuk memilih partner (fitur Premium)',
      'Next Partner, lewati dan cari partner baru kapan saja',
      'Channel privat yang hanya bisa diakses kalian berdua',
      'Dukungan media: gambar, GIF, sticker, dan emoji',
      'Report dan block untuk pengguna yang mengganggu',
      'Moderasi dan filter otomatis demi kenyamanan',
      'Channel terhapus otomatis setelah sesi berakhir',
      'Matchmaking cepat dengan antrean real-time',
      'Terhubung dengan seluruh pengguna tanpa perlu berteman dulu',
    ],
    founding: {
      title: 'Founding Members Program',
      intro:
        'Jadi bagian dari pengguna pertama Anonymous Chat. Semua pemain yang bergabung selama masa beta mendapat hadiah eksklusif sebagai apresiasi atas dukungannya. Hadiah otomatis aktif begitu Anonymous Chat memasuki rilis resmi.',
      perks: [
        'Premium GRATIS selama 3 bulan setelah rilis resmi',
        'Akses fitur Gender Preference untuk memilih partner',
        'Badge Beta Tester eksklusif di profil',
        'Akses lebih awal ke fitur terbaru sebelum pengguna lain',
      ],
      requirements: [
        'Bergabung selama periode beta',
        'Menggunakan bot dan ikut menguji selama masa beta',
      ],
      footnote:
        'Terima kasih telah menjadi bagian dari perjalanan awal Anonymous Chat. Dukungan dan masukanmu membantu kami membangun pengalaman anonymous chat terbaik di Discord.',
    },
  },
  {
    slug: 'story',
    name: 'Vanillate Story',
    shortName: 'Story',
    tagline: 'Mulai dari nol di Kota Vanillate dan tulis kisah hidupmu sendiri.',
    description:
      'Life Simulation RPG berbasis Discord. Kamu datang ke Kota Vanillate sebagai pendatang baru tanpa pekerjaan, tanpa harta, dan tanpa pengalaman. Dari titik nol itu, jalan hidupmu sepenuhnya milikmu.',
    status: 'coming-soon',
    featured: false,
    category: 'Life Simulation RPG',
    permissions: '277025770496',
    scopes: ['bot', 'applications.commands'],
    color: '#6C3BEB',
    icon: '✧',
    longIntro: [
      'Kota Vanillate adalah kota yang penuh peluang, tantangan, dan cerita. Bangun karier dengan melamar berbagai pekerjaan, tingkatkan kemampuan lewat belajar dan berlatih, kumpulkan uang, beli rumah, koleksi kendaraan, pelihara hewan, dirikan bisnis, sampai menjadi salah satu warga paling sukses di kota.',
      'Tapi hidup di Vanillate bukan cuma soal bekerja. Kota ini dihuni banyak NPC dengan kepribadian, rutinitas, kesukaan, impian, dan cerita hidupnya masing-masing. Kenali mereka, bantu selesaikan masalahnya, beri hadiah favoritnya, dan bangun pertemanan. Siapa tahu, salah satunya menjadi pasangan hidupmu.',
      'Di luar rutinitas, ada banyak area untuk dijelajahi, quest untuk diselesaikan, event musiman untuk diikuti, dan achievement untuk dibuka. Setiap keputusan memengaruhi perkembangan karaktermu: skill yang kamu latih membuka profesi baru, pekerjaan bergaji lebih tinggi, peluang bisnis lebih besar, dan akses ke aktivitas eksklusif.',
      'Ekonominya pun hidup. Toko memperbarui stoknya, event tertentu bisa mengguncang pasar, dan setiap pemain punya cara berbeda untuk membangun kekayaannya.',
      'Tidak ada jalan yang benar atau salah. Kamu bisa jadi pekerja teladan yang meniti karier sampai puncak, pengusaha dengan banyak bisnis, petani yang hidup tenang, pemancing legendaris, kolektor barang langka, koki terkenal, atau sekadar menikmati hidup sederhana bersama orang yang kamu sayangi. Di Vanillate Story, setiap pemain punya cerita yang berbeda.',
    ],
    features: [
      'Ciptakan dan kembangkan karaktermu sendiri',
      'Puluhan profesi dengan jalur karier yang unik',
      'Tingkatkan berbagai skill untuk membuka peluang baru',
      'Beli, tingkatkan, dan hias rumah impianmu',
      'Koleksi kendaraan untuk mendukung aktivitasmu',
      'Bangun bisnis dan ciptakan penghasilan pasif',
      'Berteman, berkencan, hingga menikah dengan NPC',
      'Memancing, bertani, memasak, menambang, berburu, dan crafting',
      'Quest, event musiman, achievement, dan item langka',
      'Jelajahi area Kota Vanillate yang terus berkembang',
    ],
  },
];

export function getFeaturedBot(): Bot {
  return bots.find((b) => b.featured) ?? bots[0];
}
