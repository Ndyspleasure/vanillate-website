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
  role: 'Owner',
  roleFull: 'Owner Vanillate Studio',
  location: 'Bekasi, Indonesia',

  // Gambar Founder: PNG dengan background transparan (hanya objek Founder,
  // tanpa background/gradient/shadow). Background & efek dibuat oleh website
  // pada layer terpisah. File diletakkan di public/founder/andi-kurniawan.png.
  image: '/founder/andi-kurniawan.png',
  imageAlt: 'Andi Kurniawan, Owner Vanillate Studio',

  // Ringkasan singkat untuk kartu di /about.
  short:
    'Pendiri sekaligus penggerak harian Vanillate Studio. Dari satu game di Discord, ia ikut menumbuhkan komunitas online Indonesia yang saling menjaga dan terus berkembang.',

  // Ringkasan profil untuk halaman Founder.
  summary:
    'Andi Kurniawan adalah pendiri dan pemilik Vanillate Studio. Berangkat dari dunia management lalu berkembang ke data dan teknologi, ia menggabungkan sisi operasional dan teknis untuk merawat komunitas, dimulai dari Vanillate.ID (dulu Vanillate Sambung Kata) hingga ruang-ruang baru yang kini tumbuh bersama anggota.',

  // Peran di Vanillate — beberapa paragraf.
  roleInVanillate: [
    'Sebagai Owner, Andi memegang arah komunitas secara menyeluruh, mulai dari keputusan fitur, prioritas pengembangan, sampai operasional harian yang menjaga semuanya tetap berjalan.',
    'Ia terlibat langsung di banyak lini: merancang pengalaman bermain, menulis dan meninjau kode, mengelola data, serta menyapa anggota yang berkumpul di Vanillate setiap hari.',
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
    { label: 'Owner', org: 'Vanillate Studio', period: '2026 — Kini' },
    { label: 'Operations & Product', org: 'Vanillate Studio', period: '2026 — Kini' },
    { label: 'Developer', org: 'Vanillate Studio', period: '2026 — Kini' },
  ],

  // Kontribusi utama terhadap Vanillate.
  contributions: [
    'Mendirikan komunitas Vanillate Studio pada 2026 dan menetapkan prinsip "rilis adalah garis start, bukan garis finis".',
    'Membangun dan merawat Vanillate.ID (sebelumnya Vanillate Sambung Kata), game pertama komunitas, dari permainan kata sederhana menjadi pengalaman bersama dengan progresi yang dalam.',
    'Menyusun cara kerja komunitas: alur pengembangan, dokumentasi, dan bantuan untuk anggota.',
    'Mengarahkan komunitas ke ruang baru: fitur sosial, alat untuk pengurus server, otomasi, dan AI yang berguna.',
  ],

  // Fokus / bidang kerja utama.
  focus: [
    { title: 'Management & Operations', desc: 'Menjaga arah komunitas dan operasional harian tetap berjalan rapi, dari prioritas kerja sampai dokumentasi.' },
    { title: 'Product & Engineering', desc: 'Merancang pengalaman bermain sekaligus menulis dan meninjau kode yang menjalankannya.' },
    { title: 'Data & Automation', desc: 'Menjadikan data dasar keputusan, dan mengotomasi pekerjaan berulang agar pengurus bisa fokus menyapa anggota.' },
    { title: 'Community', desc: 'Menjaga hubungan dengan anggota yang bermain dan ngobrol di Vanillate setiap hari.' },
  ],

  // Tautan.
  personalWebsite: 'https://personal.andikurniawan.vanillate.id/',
  linkedin: 'https://www.linkedin.com/in/andi-kurniawan23/',
  email: 'andikurniawanoke23@gmail.com',
} as const;

export const founderUrl = `/founder/${founder.slug}`;
