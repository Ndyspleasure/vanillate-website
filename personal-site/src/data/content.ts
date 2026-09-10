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
  email: 'andikurniawanoke23@gmail.com',
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

// Perjalanan sinematik satu tarikan: Bima Sakti → Bekasi.
export const globeStages = [
  { key: 'galaxy', label: 'BIMA SAKTI', id: 'Galaksi Bima Sakti', en: 'The Milky Way' },
  { key: 'solar', label: 'TATA SURYA', id: 'Tata Surya', en: 'Solar System' },
  { key: 'earth', label: 'BUMI', id: 'Planet Bumi', en: 'Planet Earth' },
  { key: 'indonesia', label: 'INDONESIA', id: 'Indonesia', en: 'Indonesia' },
  { key: 'westjava', label: 'JAWA BARAT', id: 'Jawa Barat', en: 'West Java' },
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
    lead: string;
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
  perf: {
    eyebrow: string;
    title: string;
    lead: string;
    recommended: string;
    systemPick: string;
    high: { name: string; desc: string };
    low: { name: string; desc: string };
    auto: { name: string; desc: string };
    start: string;
    later: string;
    label: string;
    change: string;
    modeHigh: string;
    modeLow: string;
    modeAuto: string;
    a11y: string;
    // step 2 — animation experience
    animEyebrow: string;
    animTitle: string;
    animLead: string;
    animAuto: { name: string; desc: string };
    animManual: { name: string; desc: string };
    animLabel: string;
    animAutoShort: string;
    animManualShort: string;
    animA11y: string;
    back: string;
    // closing panel at the bottom of the journey
    endEyebrow: string;
    endTitle: string;
    endLead: string;
  };
};

export const content: Record<Locale, Copy> = {
  // ═══════════════════════════════════════ INDONESIA (canonical) ═══════════
  id: {
    metaTitle: 'Andi Kurniawan, Mahasiswa, Profesional, Founder dan Developer',
    metaDescription:
      'Andi Kurniawan adalah mahasiswa, profesional, founder Vanillate Studio, dan developer yang berbasis di Bekasi, Indonesia. Berkarya di bidang management, data, teknologi, dan pengembangan produk digital.',
    nav: { about: 'Tentang', work: 'Karya', vanillate: 'Vanillate', contact: 'Kontak' },
    a11y: {
      skip: 'Lewati ke konten utama',
      theme: 'Ganti tema terang / gelap',
      lang: 'Ganti bahasa',
      menu: 'Buka menu navigasi',
    },
    hero: {
      roles: ['Mahasiswa', 'Profesional', 'Founder', 'Developer'],
      lead: 'Saya membangun dan mengelola produk digital — dari satu ide dan baris kode pertama, sampai jadi sesuatu yang benar-benar dipakai orang.',
      ctaPrimary: 'Lihat Karya',
      ctaSecondary: 'LinkedIn',
      scroll: 'Gulir untuk menjelajah',
    },
    about: {
      eyebrow: 'Mengenal Andi',
      title: 'Dari management ke data, teknologi, lalu membangun.',
      body: 'Saya berangkat dari dunia management, penasaran dengan data, lalu keterusan di teknologi. Sekarang sebagian besar waktu saya habis untuk membangun dan merawat produk lewat Vanillate Studio.',
      identity: ['Mahasiswa', 'Profesional', 'Founder', 'Developer'],
      stats: [
        { value: '2+', label: 'Tahun Pengalaman' },
        { value: '2026', label: 'Vanillate Studio' },
        { value: 'ID / EN', label: 'Bahasa' },
        { value: 'Bekasi', label: 'Berbasis di Indonesia' },
      ],
    },
    globe: {
      eyebrow: 'Dari Mana Berkarya',
      title: 'Berbasis di Bekasi, Indonesia.',
      body: 'Setiap produk dan keputusan berawal dari satu titik nyata di peta. Bekasi, Jawa Barat, Indonesia.',
      caption: 'Bekasi, Indonesia',
      hint: 'Gulir untuk menyusuri Bima Sakti hingga sampai ke Bekasi',
    },
    expertise: {
      eyebrow: 'Yang Dikerjakan',
      title: 'Empat disiplin yang saling menopang.',
      lead: 'Empat hal ini jarang saya kerjakan sendiri-sendiri. Management dan operasional yang menjaga semuanya tetap jalan, data untuk mengambil keputusan, dan teknologi untuk mewujudkannya.',
    },
    skills: {
      eyebrow: 'Perkakas',
      title: 'Alat yang dipakai setiap hari.',
      lead: 'Bukan daftar semua yang pernah saya coba — ini alat yang benar-benar saya buka hampir tiap hari, dari menulis kode sampai merapikan operasional.',
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
      fromTo: 'DARI KODE MENJADI PRODUK.',
      studioReveal: 'VANILLATE STUDIO',
      fallback: 'Membangun pengalaman digital melalui teknologi, data, AI, automation, dan community tools. Berawal dari fragmen kode, dirakit menjadi sistem, lalu tumbuh menjadi produk nyata.',
    },
    vanillate: {
      eyebrow: 'Founder Vanillate Studio',
      title: 'Membangun produk digital untuk komunitas Indonesia.',
      role: 'Founder dan Manajer Operasional',
      lead: 'Membangun produk digital yang menghadirkan pengalaman baru bagi komunitas dan pengguna Indonesia.',
      storyTitle: 'Berawal dari Satu Ide',
      story: [
        'Vanillate lahir pada 2026 dari satu hal yang mengganggu saya: banyak produk untuk komunitas online Indonesia yang ramai saat rilis, lalu pelan-pelan ditinggalkan. Saya ingin membuat yang sebaliknya — yang terus dirawat.',
        'Semua dimulai dari Vanillate Sambung Kata, satu game Discord. Dari situ pelan-pelan tumbuh jadi studio kecil yang membangun berbagai produk untuk komunitas dan pengguna di Indonesia.',
      ],
      futureTitle: 'Arah Berikutnya',
      future: ['Community Tools', 'Social Apps', 'AI Tools', 'Automation Platform', 'Web Platform', 'Mobile Applications', 'Cloud Services'],
      cta: 'Lihat Vanillate Studio',
    },
    work: {
      eyebrow: 'Karya Pilihan',
      title: 'Yang sudah dibangun.',
      lead: 'Produk nyata yang dipakai komunitas, dirawat dan terus dikembangkan, bukan proyek sekali rilis.',
      projectCategory: 'Game Komunitas Discord',
      projectDesc: 'Permainan komunitas yang dirancang untuk menciptakan interaksi dan menjaga komunitas tetap aktif.',
      cta: 'Lihat Project',
    },
    beyond: {
      eyebrow: 'Di Balik Layar',
      title: 'Di luar pekerjaan.',
      lead: 'Di luar layar, saya orang yang cukup biasa. Ini beberapa hal kecil yang mengisi waktu luang.',
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
      next: { label: 'Berikutnya', items: ['HR dan Team Lead'] },
    },
    contact: {
      eyebrow: 'Kontak',
      title: 'Mari bangun sesuatu yang berarti.',
      lead: 'Punya ide, tawaran kerja sama, atau sekadar ingin ngobrol soal produk dan teknologi? Kirim saja — saya baca semuanya.',
      emailLabel: 'Email',
      signoff: 'Andi Kurniawan',
    },
    footer: {
      tagline: 'Membangun pengalaman digital dari Bekasi, Indonesia.',
      rights: 'Seluruh hak cipta dilindungi.',
      backTop: 'Kembali ke atas',
    },
    perf: {
      eyebrow: 'Selamat Datang',
      title: 'Pilih pengalaman visual Anda.',
      lead: 'Situs ini menghadirkan perjalanan visual dari galaksi hingga Bekasi. Pilih tingkat kehalusan efek yang paling nyaman untuk perangkat Anda. Cerita dan tampilannya tetap sama utuh.',
      recommended: 'Direkomendasikan untuk perangkat Anda',
      systemPick: 'Rekomendasi sistem',
      high: {
        name: 'Performa Tinggi',
        desc: 'Partikel penuh, galaksi paling detail, dan animasi paling kaya. Paling cocok untuk perangkat yang bertenaga.',
      },
      low: {
        name: 'Performa Ringan',
        desc: 'Efek yang lebih hemat agar tetap mulus, tanpa kehilangan cerita maupun karakter visualnya.',
      },
      auto: {
        name: 'Otomatis',
        desc: 'Biarkan situs menyesuaikan sendiri dengan kemampuan perangkat Anda.',
      },
      start: 'Mulai jelajahi',
      later: 'Pakai rekomendasi sistem',
      label: 'Performa',
      change: 'Ubah kapan saja lewat tombol Performa di atas.',
      modeHigh: 'Tinggi',
      modeLow: 'Ringan',
      modeAuto: 'Otomatis',
      a11y: 'Ganti mode performa',
      animEyebrow: 'Langkah Dua',
      animTitle: 'Bagaimana Anda ingin menikmatinya?',
      animLead: 'Pilih cara menjalani perjalanan visualnya. Desain dan ceritanya tetap sama.',
      animAuto: {
        name: 'Otomatis',
        desc: 'Paling sinematik. Setiap tahap berjalan sendiri mengikuti timeline saat section aktif.',
      },
      animManual: {
        name: 'Manual',
        desc: 'Anda yang memegang kendali. Gulir untuk menyusuri setiap tahap dengan tempo Anda sendiri.',
      },
      animLabel: 'Animasi',
      animAutoShort: 'Otomatis',
      animManualShort: 'Manual',
      animA11y: 'Ganti mode animasi',
      back: 'Kembali',
      endEyebrow: 'Akhir Perjalanan',
      endTitle: 'Sudah sampai di ujung.',
      endLead: 'Coba rasakan dengan cara yang berbeda, lalu jelajahi sekali lagi.',
    },
  },

  // ═══════════════════════════════════════════════ ENGLISH ════════════════
  en: {
    metaTitle: 'Andi Kurniawan, Student, Professional, Founder and Developer',
    metaDescription:
      'Andi Kurniawan is a student, professional, founder of Vanillate Studio, and developer based in Bekasi, Indonesia. Working across management, data, technology, and digital product development.',
    nav: { about: 'About', work: 'Work', vanillate: 'Vanillate', contact: 'Contact' },
    a11y: {
      skip: 'Skip to main content',
      theme: 'Toggle light / dark theme',
      lang: 'Change language',
      menu: 'Open navigation menu',
    },
    hero: {
      roles: ['Student', 'Professional', 'Founder', 'Developer'],
      lead: 'I build and run digital products — from the first idea and line of code to something people actually use.',
      ctaPrimary: 'View Work',
      ctaSecondary: 'LinkedIn',
      scroll: 'Scroll to explore',
    },
    about: {
      eyebrow: 'Meet Andi',
      title: 'From management to data, technology, then building.',
      body: 'I started out in management, got curious about data, and ended up hooked on technology. These days most of my time goes into building and maintaining products through Vanillate Studio.',
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
      body: 'Every product and decision starts from one real point on the map. Bekasi, West Java, Indonesia.',
      caption: 'Bekasi, Indonesia',
      hint: 'Scroll to travel from the Milky Way all the way down to Bekasi',
    },
    expertise: {
      eyebrow: 'What I Do',
      title: 'Four disciplines that reinforce each other.',
      lead: 'I rarely use these one at a time. Management and operations keep things running, data guides the decisions, and technology makes them real.',
    },
    skills: {
      eyebrow: 'Toolkit',
      title: 'Tools used every day.',
      lead: 'Not everything I have ever tried — just the tools I actually open most days, from writing code to keeping operations tidy.',
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
      fallback: 'Building digital experiences through technology, data, AI, automation, and community tools. It starts with code fragments, assembles into a system, then grows into a real product.',
    },
    vanillate: {
      eyebrow: 'Founder of Vanillate Studio',
      title: 'Building digital products for Indonesian communities.',
      role: 'Founder and Operations Manager',
      lead: 'Building digital products that bring new experiences to Indonesian communities and users.',
      storyTitle: 'It Started With One Idea',
      story: [
        'Vanillate began in 2026 out of something that bugged me: so many products for Indonesian online communities are loud at launch, then slowly abandoned. I wanted to build the opposite — something that keeps getting cared for.',
        'It all started with Vanillate Sambung Kata, a single Discord game. From there it slowly grew into a small studio building products for communities and users across Indonesia.',
      ],
      futureTitle: "What's Next",
      future: ['Community Tools', 'Social Apps', 'AI Tools', 'Automation Platform', 'Web Platform', 'Mobile Applications', 'Cloud Services'],
      cta: 'Visit Vanillate Studio',
    },
    work: {
      eyebrow: 'Selected Work',
      title: "What's been built.",
      lead: 'Real products used by communities, maintained and evolved rather than launched once and left behind.',
      projectCategory: 'Discord Community Game',
      projectDesc: 'A community game designed to spark interaction and keep communities active.',
      cta: 'View Project',
    },
    beyond: {
      eyebrow: 'Behind the Scenes',
      title: 'Beyond work.',
      lead: 'Off the screen I am a pretty ordinary person. Here are a few small things that fill the downtime.',
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
      next: { label: 'Next', items: ['HR and Team Lead'] },
    },
    contact: {
      eyebrow: 'Contact',
      title: "Let's build something meaningful.",
      lead: 'Have an idea, a collaboration in mind, or just want to talk products and tech? Reach out — I read everything.',
      emailLabel: 'Email',
      signoff: 'Andi Kurniawan',
    },
    footer: {
      tagline: 'Building digital experiences from Bekasi, Indonesia.',
      rights: 'All rights reserved.',
      backTop: 'Back to top',
    },
    perf: {
      eyebrow: 'Welcome',
      title: 'Choose your visual experience.',
      lead: 'This site takes you on a visual journey from the galaxy down to Bekasi. Pick how rich the effects feel on your device. The story and the design stay exactly the same.',
      recommended: 'Recommended for your device',
      systemPick: 'System recommendation',
      high: {
        name: 'High Performance',
        desc: 'Full particles, the most detailed galaxy, and the richest animation. Best for capable devices.',
      },
      low: {
        name: 'Smooth Performance',
        desc: 'Lighter effects for a consistently smooth ride, without losing the story or the visual character.',
      },
      auto: {
        name: 'Automatic',
        desc: 'Let the site adapt itself to your device automatically.',
      },
      start: 'Start exploring',
      later: 'Use system recommendation',
      label: 'Performance',
      change: 'Change it anytime from the Performance button up top.',
      modeHigh: 'High',
      modeLow: 'Smooth',
      modeAuto: 'Auto',
      a11y: 'Change performance mode',
      animEyebrow: 'Step Two',
      animTitle: 'How would you like to experience it?',
      animLead: 'Choose how the visual journey unfolds. The design and the story stay the same.',
      animAuto: {
        name: 'Automatic',
        desc: 'The most cinematic. Each stage plays on its own timeline as the section comes into view.',
      },
      animManual: {
        name: 'Manual',
        desc: 'You are in control. Scroll to move through each stage at your own pace.',
      },
      animLabel: 'Animation',
      animAutoShort: 'Auto',
      animManualShort: 'Manual',
      animA11y: 'Change animation mode',
      back: 'Back',
      endEyebrow: 'Journey Complete',
      endTitle: "You've reached the end.",
      endLead: 'Try it a different way, then explore all over again.',
    },
  },
};

// Helper: URL alternatif untuk language toggle & hreflang.
export function altUrl(locale: Locale, path = '/'): string {
  const clean = path.replace(/^\/en(?=\/|$)/, '') || '/';
  if (locale === 'en') return '/en' + (clean === '/' ? '' : clean);
  return clean;
}
