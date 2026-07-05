// Struktur i18n ready-to-extend.
// Untuk menambah EN nanti: buat src/i18n/en.ts dengan struktur yang sama,
// lalu tambahkan language switcher di Header dan routing berbasis locale.

export const t = {
  common: {
    inviteBot: 'Undang Bot',
    viewDocs: 'Lihat Dokumentasi',
    joinDiscord: 'Gabung Discord Support',
    learnMore: 'Selengkapnya',
    getStarted: 'Mulai',
    backToTop: 'Kembali ke atas',
  },
  nav: {
    home: 'Beranda',
    about: 'Tentang',
    bots: 'Bot Kami',
    docs: 'Dokumentasi',
    support: 'Support',
    terms: 'Syarat Layanan',
    privacy: 'Kebijakan Privasi',
  },
  footer: {
    tagline: 'Dibangun dengan teliti di Indonesia.',
    rights: 'Seluruh hak cipta dilindungi.',
  },
} as const;
