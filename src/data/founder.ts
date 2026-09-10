// ─────────────────────────────────────────────────────────────────────────
// FOUNDER — sumber kebenaran tunggal untuk profil pendiri Vanillate Studio.
// Dipakai oleh section Founder di /about, halaman /founder/andi-kurniawan,
// serta structured data (Schema.org Person). Fakta konsisten dengan personal
// website Founder (personal.andikurniawan.vanillate.id).
// ─────────────────────────────────────────────────────────────────────────

export const founder = {
  slug: 'andi-kurniawan',
  name: 'Andi Kurniawan',
  nickname: 'Ndyspleasure',
  initials: 'AK',
  role: 'Founder & Owner',
  roleFull: 'Founder & Owner Vanillate Studio',
  location: 'Bekasi, Indonesia',

  // Gambar Founder: PNG dengan background transparan (hanya objek Founder,
  // tanpa background/gradient/shadow). Background & efek dibuat oleh website
  // pada layer terpisah. File diletakkan di public/founder/andi-kurniawan.png.
  image: '/founder/andi-kurniawan.png',
  imageAlt: 'Andi Kurniawan, Founder & Owner Vanillate Studio',

  // Ringkasan singkat untuk kartu di /about.
  short:
    'Pendiri sekaligus penggerak harian Vanillate Studio. Dari satu game komunitas, ia membangun studio yang merawat produknya untuk komunitas online Indonesia.',

  // Ringkasan profil untuk halaman Founder.
  summary:
    'Andi Kurniawan adalah pendiri dan pemilik Vanillate Studio. Berangkat dari dunia management lalu berkembang ke data dan teknologi, ia menggabungkan sisi operasional dan teknis untuk membangun serta merawat produk digital, dimulai dari Vanillate Sambung Kata hingga arah studio yang lebih luas.',

  // Peran di Vanillate — beberapa paragraf.
  roleInVanillate: [
    'Sebagai Founder & Owner, Andi memegang arah studio secara menyeluruh, mulai dari keputusan produk, prioritas pengembangan, sampai operasional harian yang menjaga semuanya tetap berjalan.',
    'Ia terlibat langsung di banyak lini: merancang pengalaman produk, menulis dan meninjau kode, mengelola data, serta menjaga hubungan dengan komunitas yang memakai produk Vanillate setiap hari.',
  ],

  // Keahlian utama.
  skills: [
    'Management & Operations',
    'Leadership',
    'Data Analysis',
    'JavaScript',
    'Python',
    'Automation',
    'AI Tools',
    'Product Development',
  ],

  // Pengalaman / kapasitas.
  experience: [
    { label: 'Founder & Owner', org: 'Vanillate Studio', period: '2026 — Kini' },
    { label: 'Operations & Product', org: 'Vanillate Studio', period: '2026 — Kini' },
    { label: 'Developer', org: 'Vanillate Studio', period: '2026 — Kini' },
  ],

  // Kontribusi utama terhadap Vanillate.
  contributions: [
    'Mendirikan Vanillate Studio pada 2026 dan menetapkan prinsip "rilis adalah garis start, bukan garis finis".',
    'Membangun dan merawat Vanillate Sambung Kata, produk pertama studio, dari game kata sederhana menjadi pengalaman komunitas dengan progresi yang dalam.',
    'Menyusun operasional studio: alur pengembangan, dokumentasi, dan dukungan komunitas.',
    'Mengarahkan perluasan studio ke aplikasi sosial, community tools, otomasi, dan AI.',
  ],

  // Fokus / bidang kerja utama.
  focus: [
    { title: 'Management & Operations', desc: 'Menjaga arah studio dan operasional harian tetap berjalan rapi, dari prioritas kerja sampai dokumentasi.' },
    { title: 'Product & Engineering', desc: 'Merancang pengalaman produk sekaligus menulis dan meninjau kode yang menjalankannya.' },
    { title: 'Data & Automation', desc: 'Menjadikan data dasar keputusan, dan mengotomasi pekerjaan berulang agar tim tetap ramping.' },
    { title: 'Community', desc: 'Menjaga hubungan dengan komunitas yang memakai produk Vanillate setiap hari.' },
  ],

  // Tautan.
  personalWebsite: 'https://personal.andikurniawan.vanillate.id/',
  linkedin: 'https://www.linkedin.com/in/andi-kurniawan23/',
  email: 'andikurniawanoke23@gmail.com',
} as const;

export const founderUrl = `/founder/${founder.slug}`;
