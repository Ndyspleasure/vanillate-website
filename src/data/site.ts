// Konfigurasi global situs. Ubah nilai di sini untuk update satu tempat.

export const site = {
  name: 'Vanillate Studio',
  shortName: 'Vanillate',
  tagline: 'Studio teknologi Indonesia di balik Discord Bot yang dimainkan komunitas setiap hari.',
  description:
    'Vanillate Studio membangun Discord Bot berbahasa Indonesia yang digarap serius, cepat, stabil, dan terus diperbarui. Bot kami, Vanillate Sambung Kata, dimainkan ribuan orang tiap hari. Dirancang untuk menghidupkan obrolan server sekaligus mendukung sistem leveling komunitas Discord kamu.',
  url: 'https://vanillate.id',
  locale: 'id-ID',

  // Google Search Console verification
  googleSiteVerification: 'U25-rJMHaxtxI6CT73HN72IctS63oFj1X_bl-iHc_to',

  // Tautan eksternal.
  // Repository GitHub sengaja tidak ditautkan di situs publik.
  // Kanal WhatsApp & email support dikelola di src/data/support.ts.
  links: {
    discordSupport: 'https://discord.gg/A7n88d6uRW',
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
  { label: 'Changelog', href: '/changelog' },
  { label: 'Partnership', href: '/partnership' },
  { label: 'Support', href: '/support' },
];

// Angka komunitas untuk social proof di beranda.
// Ini data nyata dari studio, update manual di sini saat berubah.
// `hint` menjelaskan maksud tiap angka supaya pengunjung tidak bingung.
export const homeStats = [
  { num: 1500, prefix: '', suffix: '+', label: 'Pemain aktif', hint: 'Ikut bermain lintas server tiap hari' },
  { num: 1000, prefix: '', suffix: '+', label: 'Server memakai bot', hint: 'Komunitas Discord dari berbagai daerah' },
  { num: 300, prefix: '+', suffix: '%', label: 'Keaktifan chat', hint: 'Obrolan server jadi jauh lebih ramai' },
  { num: 500, prefix: '+', suffix: '', label: 'Chat per game', hint: 'Rata-rata pesan baru tiap sesi permainan' },
] as const;

// Langkah mengundang bot. Dipakai di /bots dan /docs.
// `icon` berisi path SVG (stroke) yang dirender lewat set:html.
export const inviteSteps = [
  {
    n: '01',
    title: 'Pilih & undang bot',
    desc: 'Tekan tombol Undang ke Server pada bot pilihanmu, pilih server tujuan, lalu setujui izin yang diminta. Butuh izin Manage Server di sisi kamu.',
    icon: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
  },
  {
    n: '02',
    title: 'Jalankan slash command',
    desc: 'Ketik "/" di channel mana pun untuk melihat semua command yang tersedia. Bot langsung merespons dengan menu interaktif, tanpa perlu setup tambahan.',
    icon: '<path d="m4 17 6-6-6-6"/><path d="M12 19h8"/>',
  },
  {
    n: '03',
    title: 'Main & undang teman',
    desc: 'Ajak anggota server ikut bermain. Progres, statistik, dan leaderboard tersimpan otomatis dan bersifat global, jadi terbawa ke server mana pun.',
    icon: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>',
  },
] as const;

// Keunggulan yang membedakan bot Vanillate. Dipakai di /bots.
export const whyVanillate = [
  {
    title: 'Menghidupkan komunitas',
    desc: 'Server yang mulai sepi bisa ramai lagi. Permainan kami memancing anggota untuk aktif mengetik, jadi sangat cocok buat server yang mengandalkan sistem leveling dari keaktifan chat.',
    icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  },
  {
    title: 'Dirawat, bukan ditinggal',
    desc: 'Update rutin, perbaikan cepat, dan gameplay yang terus diseimbangkan. Setiap pembaruan jadi bukti bot tidak berhenti berkembang setelah rilis.',
    icon: '<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>',
  },
  {
    title: 'Bahasa Indonesia, konteks lokal',
    desc: 'Dari kamus 25.000+ kata sampai konteks budaya lokal, produk kami dibuat untuk pemain Indonesia, bukan sekadar hasil terjemahan.',
    icon: '<path d="m5 8 6 6M4 14l6-6 2-3M2 5h12M7 2h1M22 22l-5-10-5 10M14 18h6"/>',
  },
  {
    title: 'Cepat dan stabil',
    desc: 'Respons terasa instan, uptime dijaga, dan data pemain aman. Interaksi yang mulus adalah bagian dari desain, bukan kebetulan.',
    icon: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
  },
  {
    title: 'Gratis tanpa paywall',
    desc: 'Semua inti permainan bisa dinikmati tanpa bayar. Tidak ada fitur penting yang dikunci di balik langganan wajib.',
    icon: '<circle cx="12" cy="12" r="10"/><path d="M9.5 9.5a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2-2.5 3.5M12 17h.01"/>',
  },
] as const;
