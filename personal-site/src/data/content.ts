// ═══════════════════════════════════════════════════════════════════════════
// CONTENT MODEL — sumber kebenaran tunggal untuk seluruh teks situs.
// Memisahkan KONTEN dari PRESENTASI & ANIMASI (master brief §61).
// Bahasa utama (canonical): Indonesia. English tersedia via language toggle.
// ═══════════════════════════════════════════════════════════════════════════

export const SITE_URL = 'https://personal.andikurniawan.vanillate.id';

export const site = {
  url: SITE_URL,
  author: 'Andi Kurniawan',
  nickname: 'Ndyspleasure',
  initials: 'AK',
  locality: 'Bekasi',
  region: 'Jawa Barat',
  country: 'Indonesia',
  countryCode: 'ID',
  email: 'halo@andikurniawan.vanillate.id', // placeholder — ganti bila perlu (lihat README)
  linkedin: 'https://www.linkedin.com/in/andi-kurniawan23/',
  discord: 'https://discord.gg/A7n88d6uRW',
  studioUrl: 'https://vanillate.id',
  studioName: 'Vanillate Studio',
  knowsAbout: [
    'Management',
    'Administration',
    'Data',
    'Technology',
    'Leadership',
    'Operations',
    'JavaScript',
    'Python',
    'Automation',
    'AI',
  ],
} as const;

export type Locale = 'id' | 'en';

// Statistik resmi Vanillate (konsisten dengan src/data/site.ts situs studio).
export const studioStats = [
  { value: '150K+', id: 'Pengguna Aktif', en: 'Active Users' },
  { value: '100K+', id: 'Komunitas Terhubung', en: 'Communities Connected' },
  { value: '+300%', id: 'Keaktifan Komunitas', en: 'Community Activity' },
  { value: '+500', id: 'Interaksi per Sesi', en: 'Interactions per Session' },
] as const;

// Zoom sinematik: SPACE → BEKASI (master brief §12).
export const globeStages = [
  { key: 'space', label: 'SPACE', id: 'Ruang angkasa', en: 'Outer space' },
  { key: 'earth', label: 'EARTH', id: 'Bumi', en: 'Earth' },
  { key: 'asia', label: 'ASIA', id: 'Asia', en: 'Asia' },
  { key: 'indonesia', label: 'INDONESIA', id: 'Indonesia', en: 'Indonesia' },
  { key: 'westjava', label: 'WEST JAVA', id: 'Jawa Barat', en: 'West Java' },
  { key: 'bekasi', label: 'BEKASI', id: 'Bekasi', en: 'Bekasi' },
] as const;

export const skills = [
  { name: 'JavaScript', id: 'Bahasa untuk membangun web interaktif & otomasi.', en: 'Language for interactive web & automation.' },
  { name: 'Python', id: 'Analisis data, scripting, dan tooling AI.', en: 'Data analysis, scripting, and AI tooling.' },
  { name: 'CSS', id: 'Antarmuka rapi, responsif, dan bertekstur.', en: 'Clean, responsive, textured interfaces.' },
  { name: 'Microsoft Excel', id: 'Pemodelan data, laporan, dan operasional.', en: 'Data modeling, reporting, and operations.' },
  { name: 'Microsoft Word', id: 'Dokumentasi dan administrasi profesional.', en: 'Professional documentation & administration.' },
  { name: 'Notion', id: 'Sistem kerja, dokumentasi, dan knowledge base.', en: 'Work systems, docs, and knowledge base.' },
  { name: 'Google Workspace', id: 'Kolaborasi, dokumen, dan operasional tim.', en: 'Collaboration, documents, and team ops.' },
  { name: 'Discord', id: 'Membangun & mengelola komunitas.', en: 'Building & managing communities.' },
] as const;

export const expertise = [
  {
    key: 'management',
    title: 'Management',
    items: ['Management', 'Administration', 'Leadership'],
  },
  {
    key: 'data',
    title: 'Data',
    items: ['Data Analysis', 'Data Management', 'Problem Solving'],
  },
  {
    key: 'technology',
    title: 'Technology',
    items: ['JavaScript', 'Python', 'CSS', 'AI', 'Automation'],
  },
  {
    key: 'operations',
    title: 'Operations',
    items: ['Project Management', 'Operations', 'Community'],
  },
] as const;

// Tahap animasi "Building Digital Experiences" (§18–24) — teks selalu di DOM.
export const buildStages = [
  { label: 'LOADING', id: 'Memuat', en: 'Loading' },
  { label: 'ANALYZING', id: 'Menganalisis', en: 'Analyzing' },
  { label: 'BUILDING', id: 'Membangun', en: 'Building' },
  { label: 'VALIDATING', id: 'Memvalidasi', en: 'Validating' },
  { label: 'SUCCESS', id: 'Berhasil', en: 'Success' },
  { label: 'DEPLOYED', id: 'Tayang', en: 'Deployed' },
] as const;

export const systemNodes = ['AI', 'DATA', 'API', 'AUTOMATION', 'DATABASE', 'SYSTEM'] as const;

type Copy = {
  metaTitle: string;
  metaDescription: string;
  nav: { about: string; work: string; vanillate: string; contact: string };
  a11y: { skip: string; theme: string; lang: string; menu: string };
  hero: {
    roles: string[];
    lead: string;
    ctaPrimary: string;
    ctaSecondary: string;
    scroll: string;
  };
  about: {
    eyebrow: string;
    title: string;
    body: string;
    identity: string[];
    stats: { value: string; label: string }[];
  };
  globe: {
    eyebrow: string;
    title: string;
    body: string;
    caption: string;
    hint: string;
  };
  expertise: { eyebrow: string; title: string; lead: string };
  skills: { eyebrow: string; title: string; lead: string; hoverHint: string };
  build: {
    eyebrow: string;
    title: string;
    lead: string;
    fragments: string[];
    convergeLabel: string;
    coreLabel: string;
    failed: string;
    retrying: string;
    recovered: string;
    complete: string;
    fromTo: string;
    studioReveal: string;
    fallback: string;
  };
  vanillate: {
    eyebrow: string;
    title: string;
    role: string;
    lead: string;
    storyTitle: string;
    story: string[];
    futureTitle: string;
    future: string[];
    cta: string;
  };
  work: {
    eyebrow: string;
    title: string;
    lead: string;
    projectCategory: string;
    projectDesc: string;
    cta: string;
  };
  beyond: {
    eyebrow: string;
    title: string;
    groups: { label: string; items: string[] }[];
  };
  values: {
    eyebrow: string;
    title: string;
    items: { key: string; title: string; desc: string }[];
  };
  career: {
    eyebrow: string;
    title: string;
    now: { label: string; items: string[] };
    focus: { label: string; items: string[] };
    next: { label: string; items: string[] };
  };
  contact: {
    eyebrow: string;
    title: string;
    lead: string;
    emailLabel: string;
    signoff: string;
  };
  footer: { tagline: string; rights: string; backTop: string };
};

export const content: Record<Locale, Copy> = {
  // ═══════════════════════════════════════ INDONESIA (canonical) ═══════════
  id: {
    metaTitle: 'Andi Kurniawan — Mahasiswa, Profesional, Founder & Developer',
    metaDescription:
      'Andi Kurniawan — mahasiswa, profesional, founder Vanillate Studio, dan developer berbasis di Bekasi, Indonesia. Menjelajahi management, data, teknologi, dan pengembangan produk digital.',
    nav: { about: 'Tentang', work: 'Karya', vanillate: 'Vanillate', contact: 'Kontak' },
    a11y: {
      skip: 'Lewati ke konten utama',
      theme: 'Ganti tema terang / gelap',
      lang: 'Ganti bahasa',
      menu: 'Buka menu navigasi',
    },
    hero: {
      roles: ['Mahasiswa', 'Profesional', 'Founder', 'Developer'],
      lead: 'Membangun, mengelola, dan mengembangkan berbagai produk serta pengalaman digital.',
      ctaPrimary: 'Lihat Karya',
      ctaSecondary: 'LinkedIn',
      scroll: 'Gulir untuk menjelajah',
    },
    about: {
      eyebrow: 'Mengenal Andi',
      title: 'Dari management ke data, teknologi, lalu membangun.',
      body: 'Berangkat dari dunia management, berkembang ke data dan teknologi, lalu membangun berbagai pengalaman digital melalui Vanillate Studio.',
      identity: ['Mahasiswa', 'Profesional', 'Founder', 'Developer'],
      stats: [
        { value: '2+', label: 'Tahun Pengalaman' },
        { value: '2026', label: 'Vanillate Studio' },
        { value: 'ID / EN', label: 'Bahasa' },
        { value: 'Bekasi', label: 'Berbasis di Indonesia' },
      ],
    },
    globe: {
      eyebrow: 'Dari Mana Berkarya?',
      title: 'Berbasis di Bekasi, Indonesia.',
      body: 'Setiap produk dan keputusan berangkat dari satu titik nyata di peta — Bekasi, Jawa Barat, Indonesia.',
      caption: 'Bekasi · Indonesia',
      hint: 'Gulir untuk memperbesar dari ruang angkasa menuju Bekasi',
    },
    expertise: {
      eyebrow: 'Yang Dikerjakan',
      title: 'Empat disiplin yang saling menopang.',
      lead: 'Management, data, teknologi, dan operasional — dipakai bersama untuk membangun dan menjaga produk tetap berjalan.',
    },
    skills: {
      eyebrow: 'Perkakas',
      title: 'Alat yang dipakai setiap hari.',
      lead: 'Dari kode hingga operasional tim — perangkat yang menopang cara kerja sehari-hari.',
      hoverHint: 'Arahkan kursor untuk detail',
    },
    build: {
      eyebrow: 'Building Digital Experiences',
      title: 'Dari kode menjadi produk.',
      lead: 'Membangun pengalaman digital melalui teknologi, data, AI, automation, dan community tools.',
      fragments: ['const experience = build();', 'analyze(data)', 'system.deploy()', 'community.connect()', 'ai.assist()', 'automation.run()'],
      convergeLabel: 'Fragmen kode menyatu menjadi',
      coreLabel: 'System Core',
      failed: 'BUILD FAILED',
      retrying: 'RETRYING…',
      recovered: 'BUILD SUCCESS',
      complete: 'BUILD COMPLETE',
      fromTo: 'FROM CODE TO PRODUCT.',
      studioReveal: 'VANILLATE STUDIO',
      fallback: 'Membangun pengalaman digital melalui teknologi, data, AI, automation, dan community tools — dari fragmen kode, dirakit menjadi sistem, hingga menjadi produk nyata.',
    },
    vanillate: {
      eyebrow: 'Founder — Vanillate Studio',
      title: 'Membangun produk digital untuk komunitas Indonesia.',
      role: 'Founder · Manajer Operasional',
      lead: 'Membangun produk digital yang menghadirkan pengalaman baru bagi komunitas dan pengguna Indonesia.',
      storyTitle: 'Berawal dari Satu Ide',
      story: [
        'Vanillate lahir pada 2026 dari satu pengamatan sederhana: komunitas online Indonesia membutuhkan produk digital yang terus dikembangkan, bukan sekadar diluncurkan lalu ditinggalkan.',
        'Dimulai dari Vanillate Sambung Kata, kemudian berkembang menjadi studio yang membangun berbagai pengalaman digital untuk komunitas dan pengguna Indonesia.',
      ],
      futureTitle: 'Arah Berikutnya',
      future: ['Community Tools', 'Social Apps', 'AI Tools', 'Automation Platform', 'Web Platform', 'Mobile Applications', 'Cloud Services'],
      cta: 'Lihat Vanillate Studio',
    },
    work: {
      eyebrow: 'Karya Pilihan',
      title: 'Yang sudah dibangun.',
      lead: 'Produk nyata yang dipakai komunitas — dirawat dan dikembangkan, bukan proyek sekali rilis.',
      projectCategory: 'Community Game · Discord',
      projectDesc: 'Permainan komunitas yang dirancang untuk menciptakan interaksi dan menjaga komunitas tetap aktif.',
      cta: 'Lihat Project',
    },
    beyond: {
      eyebrow: 'Di Balik Layar',
      title: 'Di luar pekerjaan.',
      groups: [
        { label: 'Games', items: ['Mobile Legends', 'Roblox', 'Minecraft'] },
        { label: 'Platform', items: ['Discord'] },
        { label: 'Minuman', items: ['Kopi', 'Cokelat', 'Vanilla'] },
        { label: 'Makanan', items: ['Mie Ayam', 'Pecel Ayam'] },
      ],
    },
    values: {
      eyebrow: 'Yang Dipercaya',
      title: 'Prinsip yang memandu.',
      items: [
        { key: 'initiative', title: 'Initiative', desc: 'Jangan menunggu. Mulai.' },
        { key: 'leadership', title: 'Leadership', desc: 'Berani bertanggung jawab.' },
        { key: 'management', title: 'Management', desc: 'Membuat sesuatu berjalan.' },
      ],
    },
    career: {
      eyebrow: 'Ke Mana Arah Berikutnya?',
      title: 'Arah dan perkembangan.',
      now: { label: 'Sekarang', items: ['Mahasiswa', 'Profesional', 'Founder'] },
      focus: { label: 'Fokus', items: ['Management', 'Data', 'Technology', 'Leadership'] },
      next: { label: 'Berikutnya', items: ['HR · Team Lead'] },
    },
    contact: {
      eyebrow: 'Kontak',
      title: 'Mari bangun sesuatu yang berarti.',
      lead: 'Ide dimulai dari sesuatu yang sederhana. Tinggal bagaimana membuatnya menjadi nyata.',
      emailLabel: 'Email',
      signoff: 'Andi Kurniawan',
    },
    footer: {
      tagline: 'Membangun pengalaman digital dari Bekasi, Indonesia.',
      rights: 'Seluruh hak cipta dilindungi.',
      backTop: 'Kembali ke atas',
    },
  },

  // ═══════════════════════════════════════════════ ENGLISH ════════════════
  en: {
    metaTitle: 'Andi Kurniawan — Student, Professional, Founder & Developer',
    metaDescription:
      'Andi Kurniawan — student, professional, founder of Vanillate Studio, and developer based in Bekasi, Indonesia. Working across management, data, technology, and digital product development.',
    nav: { about: 'About', work: 'Work', vanillate: 'Vanillate', contact: 'Contact' },
    a11y: {
      skip: 'Skip to main content',
      theme: 'Toggle light / dark theme',
      lang: 'Change language',
      menu: 'Open navigation menu',
    },
    hero: {
      roles: ['Student', 'Professional', 'Founder', 'Developer'],
      lead: 'Building, managing, and growing digital products and experiences.',
      ctaPrimary: 'View Work',
      ctaSecondary: 'LinkedIn',
      scroll: 'Scroll to explore',
    },
    about: {
      eyebrow: 'Meet Andi',
      title: 'From management to data, technology, then building.',
      body: 'Starting in management, moving into data and technology, then building digital experiences through Vanillate Studio.',
      identity: ['Student', 'Professional', 'Founder', 'Developer'],
      stats: [
        { value: '2+', label: 'Years of Experience' },
        { value: '2026', label: 'Vanillate Studio' },
        { value: 'ID / EN', label: 'Languages' },
        { value: 'Bekasi', label: 'Based in Indonesia' },
      ],
    },
    globe: {
      eyebrow: "Where I'm Building From",
      title: 'Based in Bekasi, Indonesia.',
      body: 'Every product and decision starts from one real point on the map — Bekasi, West Java, Indonesia.',
      caption: 'Bekasi · Indonesia',
      hint: 'Scroll to zoom from outer space down to Bekasi',
    },
    expertise: {
      eyebrow: 'What I Do',
      title: 'Four disciplines that reinforce each other.',
      lead: 'Management, data, technology, and operations — used together to build products and keep them running.',
    },
    skills: {
      eyebrow: 'Toolkit',
      title: 'Tools used every day.',
      lead: 'From code to team operations — the tools behind the daily workflow.',
      hoverHint: 'Hover for details',
    },
    build: {
      eyebrow: 'Building Digital Experiences',
      title: 'From code to product.',
      lead: 'Building digital experiences through technology, data, AI, automation, and community tools.',
      fragments: ['const experience = build();', 'analyze(data)', 'system.deploy()', 'community.connect()', 'ai.assist()', 'automation.run()'],
      convergeLabel: 'Code fragments converge into',
      coreLabel: 'System Core',
      failed: 'BUILD FAILED',
      retrying: 'RETRYING…',
      recovered: 'BUILD SUCCESS',
      complete: 'BUILD COMPLETE',
      fromTo: 'FROM CODE TO PRODUCT.',
      studioReveal: 'VANILLATE STUDIO',
      fallback: 'Building digital experiences through technology, data, AI, automation, and community tools — from code fragments, assembled into a system, into a real product.',
    },
    vanillate: {
      eyebrow: 'Founder — Vanillate Studio',
      title: 'Building digital products for Indonesian communities.',
      role: 'Founder · Operations Manager',
      lead: 'Building digital products that bring new experiences to Indonesian communities and users.',
      storyTitle: 'It Started With One Idea',
      story: [
        'Vanillate was born in 2026 from a simple observation: Indonesian online communities need digital products that keep evolving, not ones that are launched then abandoned.',
        'It began with Vanillate Sambung Kata, then grew into a studio building digital experiences for Indonesian communities and users.',
      ],
      futureTitle: "What's Next",
      future: ['Community Tools', 'Social Apps', 'AI Tools', 'Automation Platform', 'Web Platform', 'Mobile Applications', 'Cloud Services'],
      cta: 'Visit Vanillate Studio',
    },
    work: {
      eyebrow: 'Selected Work',
      title: "What's been built.",
      lead: 'Real products used by communities — maintained and evolved, not one-off launches.',
      projectCategory: 'Community Game · Discord',
      projectDesc: 'A community game designed to spark interaction and keep communities active.',
      cta: 'View Project',
    },
    beyond: {
      eyebrow: 'Behind the Scenes',
      title: 'Beyond work.',
      groups: [
        { label: 'Games', items: ['Mobile Legends', 'Roblox', 'Minecraft'] },
        { label: 'Platform', items: ['Discord'] },
        { label: 'Drinks', items: ['Coffee', 'Chocolate', 'Vanilla'] },
        { label: 'Food', items: ['Mie Ayam', 'Pecel Ayam'] },
      ],
    },
    values: {
      eyebrow: 'What I Believe',
      title: 'The principles that guide.',
      items: [
        { key: 'initiative', title: 'Initiative', desc: "Don't wait. Start." },
        { key: 'leadership', title: 'Leadership', desc: 'Own the responsibility.' },
        { key: 'management', title: 'Management', desc: 'Make things work.' },
      ],
    },
    career: {
      eyebrow: "Where To Next?",
      title: 'Direction and growth.',
      now: { label: 'Now', items: ['Student', 'Professional', 'Founder'] },
      focus: { label: 'Focus', items: ['Management', 'Data', 'Technology', 'Leadership'] },
      next: { label: 'Next', items: ['HR · Team Lead'] },
    },
    contact: {
      eyebrow: 'Contact',
      title: "Let's build something meaningful.",
      lead: 'Ideas start from something simple. It comes down to making them real.',
      emailLabel: 'Email',
      signoff: 'Andi Kurniawan',
    },
    footer: {
      tagline: 'Building digital experiences from Bekasi, Indonesia.',
      rights: 'All rights reserved.',
      backTop: 'Back to top',
    },
  },
};

// Helper: URL alternatif untuk language toggle & hreflang.
export function altUrl(locale: Locale, path = '/'): string {
  const clean = path.replace(/^\/en(?=\/|$)/, '') || '/';
  if (locale === 'en') return '/en' + (clean === '/' ? '' : clean);
  return clean;
}
