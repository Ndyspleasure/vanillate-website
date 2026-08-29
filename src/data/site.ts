// Konfigurasi global situs. Ubah nilai di sini untuk update satu tempat.

export const site = {
  name: 'Vanillate Studio',
  shortName: 'Vanillate',
  tagline: 'Studio produk digital Indonesia untuk komunitas dan pengalaman sosial.',
  description:
    'Vanillate Studio membangun, merilis, dan merawat produk digital untuk komunitas dan pengalaman sosial — dari aplikasi sosial, community tools, sampai otomasi dan AI. Produk kami dipakai ratusan ribu orang setiap hari, dan katalog kami terus bertambah.',
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

// Nav studio yang ramping. Item level-produk (FAQ, Changelog, Partnership)
// sengaja diturunkan ke footer & halaman produk — nav utama bicara atas nama
// studio, bukan satu produk.
export const nav = [
  { label: 'Beranda', href: '/' },
  { label: 'Produk', href: '/products' },
  { label: 'Tentang', href: '/about' },
  { label: 'Support', href: '/support' },
];

// Angka komunitas untuk social proof di beranda.
// Ini data nyata dari studio, update manual di sini saat berubah.
// `hint` menjelaskan maksud tiap angka supaya pengunjung tidak bingung.
export const homeStats = [
  { num: 150000, prefix: '', suffix: '+', label: 'Pengguna aktif', hint: 'Memakai produk kami setiap hari' },
  { num: 100000, prefix: '', suffix: '+', label: 'Komunitas terhubung', hint: 'Dari berbagai daerah di Indonesia' },
  { num: 300, prefix: '+', suffix: '%', label: 'Keaktifan komunitas', hint: 'Obrolan jadi jauh lebih ramai' },
  { num: 500, prefix: '+', suffix: '', label: 'Interaksi per sesi', hint: 'Rata-rata percakapan baru tiap sesi' },
] as const;

// Langkah memakai produk. Sengaja netral platform: tiap produk punya cara
// pasang sendiri (undang ke komunitas, unduh aplikasi, buka di web), dan
// detail teknisnya dijelaskan di halaman produk masing-masing.
// `icon` berisi path SVG (stroke) yang dirender lewat set:html.
export const inviteSteps = [
  {
    n: '01',
    title: 'Pilih produknya',
    desc: 'Buka katalog dan lihat produk yang paling cocok untuk komunitas atau kebutuhanmu, lengkap dengan fitur dan panduannya.',
    icon: '<path d="M21 21l-4.35-4.35"/><circle cx="11" cy="11" r="8"/>',
  },
  {
    n: '02',
    title: 'Pasang atau undang',
    desc: 'Satu klik dari halaman produk: undang ke komunitasmu, unduh aplikasinya, atau langsung buka versi webnya. Tanpa setup rumit.',
    icon: '<path d="M12 5v14M5 12h14"/>',
  },
  {
    n: '03',
    title: 'Pakai bareng komunitas',
    desc: 'Ajak anggota ikut mencoba. Progres dan datamu tersimpan otomatis, jadi pengalamannya berlanjut di mana pun kamu memakainya.',
    icon: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>',
  },
] as const;

// Keunggulan yang membedakan produk Vanillate. Dipakai di /products.
export const whyVanillate = [
  {
    title: 'Menghidupkan komunitas',
    desc: 'Komunitas yang mulai sepi bisa ramai lagi. Produk kami memancing anggota untuk kembali berinteraksi, jadi sangat cocok buat komunitas yang hidup dari keaktifan anggotanya.',
    icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  },
  {
    title: 'Dirawat, bukan ditinggal',
    desc: 'Update rutin, perbaikan cepat, dan pengalaman yang terus disempurnakan. Setiap pembaruan jadi bukti produk tidak berhenti berkembang setelah rilis.',
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
