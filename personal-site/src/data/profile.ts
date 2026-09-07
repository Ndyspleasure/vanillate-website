// ─────────────────────────────────────────────────────────────────────────────
// DATA DIRI — sumber kebenaran tunggal untuk isi halaman personal.
//
// Ubah nilai di sini untuk memperbarui seluruh halaman. Tidak perlu menyentuh
// markup di src/pages/index.astro.
//
// Situs ini sengaja dibuat sebagai TEMPLATE personal untuk tim Vanillate:
// tiap anggota tim bisa menyalin folder `personal-site/`, mengganti isi file
// ini, lalu men-deploy ke subdomain masing-masing
// (mis. personal.<nama>.vanillate.id).
// ─────────────────────────────────────────────────────────────────────────────

export const profile = {
  // ─── Identitas ─────────────────────────────────────────────────────────────
  name: 'Andi Kurniawan',
  // Inisial untuk avatar (dipakai bila `avatar` kosong). Maks 2 huruf.
  initials: 'AK',
  // Path gambar avatar di /public (mis. '/avatar.jpg'). Kosongkan untuk memakai
  // avatar inisial berbasis gradien — tanpa perlu file gambar.
  avatar: '',
  role: 'Founder & Product Lead',
  org: 'Vanillate Studio',
  orgUrl: 'https://vanillate.id',
  location: 'Indonesia',
  pronounHint: '', // opsional, mis. 'they/them' — kosongkan bila tidak dipakai

  // Tagline singkat di hero (1 kalimat).
  tagline:
    'Membangun dan merawat produk digital untuk komunitas dan pengalaman sosial di Indonesia.',

  // ─── Tentang (paragraf bio, boleh lebih dari satu) ───────────────────────────
  about: [
    'Saya membangun produk digital di Vanillate Studio — studio produk asal Indonesia yang merancang, merilis, dan merawat aplikasi sosial serta community tools yang dipakai ratusan ribu orang setiap hari.',
    'Fokus saya ada pada mempertemukan kebutuhan komunitas dengan produk yang cepat, stabil, dan enak dipakai — dari ide, desain, sampai perawatan jangka panjang setelah rilis.',
  ],

  // ─── Data diri ringkas (grid info) ───────────────────────────────────────────
  // Tiap item tampil sebagai kartu kecil. Ubah/ tambah sesuai kebutuhan.
  facts: [
    { label: 'Peran', value: 'Founder & Product Lead' },
    { label: 'Studio', value: 'Vanillate Studio' },
    { label: 'Lokasi', value: 'Indonesia' },
    { label: 'Fokus', value: 'Produk sosial & community tools' },
  ] as { label: string; value: string }[],

  // ─── Fokus / keahlian (chips) ────────────────────────────────────────────────
  focus: [
    'Product Strategy',
    'Community Tools',
    'Astro & Web',
    'Discord Bots',
    'UI/UX',
    'Supabase',
  ] as string[],

  // ─── Tautan kontak & sosial ──────────────────────────────────────────────────
  // `primary: true` ditonjolkan sebagai tombol utama. Ganti email placeholder
  // di bawah dengan alamat yang ingin kamu tampilkan (lihat catatan di README).
  links: [
    { label: 'Website Studio', href: 'https://vanillate.id', kind: 'web', primary: true },
    { label: 'Email', href: 'mailto:halo@andikurniawan.vanillate.id', kind: 'email', primary: false },
    { label: 'Discord', href: 'https://discord.gg/A7n88d6uRW', kind: 'discord', primary: false },
  ] as { label: string; href: string; kind: string; primary?: boolean }[],

  // ─── SEO ─────────────────────────────────────────────────────────────────────
  seo: {
    // Judul <title> dan og:title. Kosongkan `title` untuk memakai "Nama · Peran".
    title: '',
    description:
      'Halaman personal Andi Kurniawan — Founder & Product Lead di Vanillate Studio, studio produk digital Indonesia untuk komunitas dan pengalaman sosial.',
    // Gambar Open Graph di /public (1200×630 disarankan). Kosongkan bila belum ada.
    ogImage: '',
  },
} as const;

export type Profile = typeof profile;
