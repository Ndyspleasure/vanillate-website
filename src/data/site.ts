// Konfigurasi global situs. Ubah nilai di sini untuk update satu tempat.

export const site = {
  name: 'Vanillate Studio',
  shortName: 'Vanillate',
  tagline: 'Studio pengembang Discord Bot yang mengutamakan kualitas, stabilitas, dan pengalaman pengguna.',
  description:
    'Vanillate Studio adalah studio pengembang Discord Bot asal Indonesia yang membangun bot berkualitas tinggi dengan fokus pada performa, keamanan, dan pengalaman pengguna.',
  url: 'https://vanillate.com',
  locale: 'id-ID',

  // Tautan eksternal
  links: {
    discordSupport: 'https://discord.gg/A7n88d6uRW',
    github: 'https://github.com/REPLACE_ME',         // opsional
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
