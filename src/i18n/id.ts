// Struktur i18n ready-to-extend.
// Untuk menambah EN nanti: buat src/i18n/en.ts dengan struktur yang sama,
// lalu tambahkan language switcher di Header dan routing berbasis locale.

export const t = {
  common: {
    inviteBot: 'Pakai Produk',
    viewFaq: 'Lihat Panduan',
    joinDiscord: 'Gabung Komunitas',
    learnMore: 'Selengkapnya',
    getStarted: 'Mulai',
    backToTop: 'Kembali ke atas',
  },
  nav: {
    home: 'Beranda',
    about: 'Tentang',
    bots: 'Produk',
    faq: 'FAQ & Panduan',
    support: 'Support',
    terms: 'Syarat Layanan',
    privacy: 'Kebijakan Privasi',
  },
  footer: {
    tagline: 'Dibangun dengan teliti di Indonesia.',
    rights: 'Seluruh hak cipta dilindungi.',
  },
} as const;
