// Konfigurasi global situs. Ubah nilai di sini untuk update satu tempat.

export const site = {
  name: 'Vanillate Studio',
  shortName: 'Vanillate',
  tagline: 'Studio teknologi Indonesia di balik Discord Bot yang dimainkan setiap hari.',
  description:
    'Vanillate Studio membangun Discord Bot berbahasa Indonesia yang digarap serius: cepat, stabil, dan terus diperbarui. Dua game kami, Sambung Kata dan Tahu Bulat, dimainkan komunitas setiap hari.',
  url: 'https://vanillate.id',
  locale: 'id-ID',

  // Google Search Console verification
  googleSiteVerification: 'U25-rJMHaxtxI6CT73HN72IctS63oFj1X_bl-iHc_to',

  // Tautan eksternal
  links: {
    discordSupport: 'https://discord.gg/A7n88d6uRW',
    github: 'https://github.com/Ndyspleasure',
  },

  // Halaman legal
  legal: {
    termsUrl: '/terms',
    privacyUrl: '/privacy',
  },
} as const;

export const nav = [
  { label: 'Beranda', href: '/' },
  { label: 'Tentang', href: '/about' },
  { label: 'Bot Kami', href: '/bots' },
  { label: 'Dokumentasi', href: '/docs' },
  { label: 'Support', href: '/support' },
];
