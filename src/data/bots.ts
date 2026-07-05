// Registry bot Vanillate Studio.
// Tambah bot baru? Cukup tambahkan objek di array `bots` dan buat halaman docs jika perlu.
// Halaman /bots dan /bots/[slug] akan otomatis menampilkannya.

export type Bot = {
  slug: string;                 // URL segment: /bots/<slug>
  name: string;                 // Nama lengkap
  shortName: string;            // Nama pendek untuk tombol/badge
  tagline: string;              // Kalimat singkat 1 baris
  description: string;          // Paragraf pendek untuk halaman detail
  status: 'live' | 'beta' | 'coming-soon';
  featured: boolean;            // Highlight utama di beranda
  category: string;             // ex: "Word Game", "Idle Simulation"
  clientId: string;             // Discord Application/Client ID (untuk invite)
  permissions: string;          // Bitwise permission integer
  scopes: string[];             // OAuth2 scopes
  color: string;                // Aksen warna bot (hex)
  icon: string;                 // Emoji / simbol pendek
  features: string[];           // 3-6 poin fitur utama
  commands?: { name: string; description: string }[]; // sample command untuk halaman detail
  docsSlug: string;             // slug halaman dokumentasi: /docs/<docsSlug>
};

/**
 * Bangun invite URL Discord dari clientId + permissions + scopes.
 */
export function buildInviteUrl(bot: Bot): string {
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
    name: 'Vanillate Sambung Kata',
    shortName: 'Sambung Kata',
    tagline: 'Bot game sambung kata paling lengkap untuk komunitas Discord Indonesia.',
    description:
      'Vanillate Sambung Kata menghadirkan pengalaman permainan sambung kata modern dengan sistem EXP, Dungeon, Class, Quest, dan Campaign. Dirancang untuk komunitas Discord berbahasa Indonesia yang menginginkan permainan kata dengan progresi mendalam.',
    status: 'live',
    featured: true,
    category: 'Word Game',
    clientId: '1513806760622817320', // TODO: isi Client ID Discord
    permissions: '277025770496',
    scopes: ['bot', 'applications.commands'],
    color: '#E8B84A',
    icon: '✦',
    features: [
      'Sistem EXP dan progresi karakter yang terbalance',
      'Mode Dungeon dengan berbagai tingkat kesulitan',
      'Sistem Class dan Talent untuk personalisasi',
      'Quest harian dan Campaign story-based',
      'Leaderboard komunitas real-time',
      'Anti-cheat dan validasi kata otomatis',
    ],
    commands: [
      { name: '/main', description: 'Mulai atau bergabung ke sesi sambung kata' },
      { name: '/profil', description: 'Lihat profil, EXP, dan statistik karakter' },
      { name: '/dungeon', description: 'Masuk ke mode Dungeon untuk tantangan lebih' },
      { name: '/quest', description: 'Lihat daftar quest aktif dan progresnya' },
    ],
    docsSlug: 'sambung-kata',
  },
  {
    slug: 'tahu-bulat',
    name: 'Vanillate Tahu Bulat',
    shortName: 'Tahu Bulat',
    tagline: 'Idle & business simulation bot bertema kuliner khas Indonesia.',
    description:
      'Vanillate Tahu Bulat adalah bot idle dan simulasi bisnis di mana pemain membangun kerajaan tahu bulat mereka sendiri. Kelola armada gerobak, hitung offline income, lakukan rebirth, dan naik level bersama teman-teman satu server.',
    status: 'live',
    featured: false,
    category: 'Idle Simulation',
    clientId: '1521948490803187903', // TODO: isi Client ID Discord
    permissions: '277025770496',
    scopes: ['bot', 'applications.commands'],
    color: '#4FA89D',
    icon: '◉',
    features: [
      'Simulasi bisnis idle dengan progresi jangka panjang',
      'Offline income — tetap dapat penghasilan saat tidak bermain',
      'Sistem armada kendaraan dengan berbagai tier',
      'Fitur Upgrade All dengan algoritma optimal',
      'Sistem rebirth untuk progresi lanjutan',
      'UI kartu status dinamis (IDLE / SELLING / REBIRTH)',
    ],
    commands: [
      { name: '/main', description: 'Buka panel utama Tahu Bulat' },
      { name: '/jual', description: 'Jual stok tahu bulat yang sudah siap' },
      { name: '/upgrade', description: 'Upgrade armada atau fasilitas' },
      { name: '/help', description: 'Buka panduan lengkap bot' },
    ],
    docsSlug: 'tahu-bulat',
  },
];

export function getFeaturedBot(): Bot {
  return bots.find((b) => b.featured) ?? bots[0];
}
