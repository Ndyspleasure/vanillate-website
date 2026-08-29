// ─────────────────────────────────────────────────────────────────────────────
// KONTEN HALAMAN PUBLIK YANG DIKELOLA DARI CMS
//
// Tujuannya: teks di halaman publik bisa diubah dari /admin/halaman tanpa
// menyentuh source code. Polanya sama dengan Partnership (bagian 14 skema):
//
//   Supabase page_content  →  scripts/sync-content.mjs  →  synced/pages.json
//                                                        →  modul ini  →  halaman
//
// Dua hal yang membuat ini aman dipakai:
//   • DEFAULTS di bawah adalah teks yang sedang tayang. Field yang dikosongkan
//     di CMS otomatis kembali memakai default, jadi halaman TIDAK PERNAH kosong.
//   • SCHEMAS mendeskripsikan form di panel admin. Menambah field baru cukup
//     menambah satu entri di sini — panelnya ikut bertambah sendiri.
// ─────────────────────────────────────────────────────────────────────────────

import pagesData from './synced/pages.json';

export type FieldType = 'text' | 'textarea' | 'list' | 'pairs';

export type Field = {
  key: string;
  label: string;
  type: FieldType;
  help?: string;
};

export type PageSchema = {
  key: string;
  label: string;
  description: string;
  fields: Field[];
};

export type Pair = { title: string; desc: string };

// ─── Skema form di panel admin ───────────────────────────────────────────────
export const pageSchemas: PageSchema[] = [
  {
    key: 'home',
    label: 'Beranda',
    description: 'Hero, katalog, prinsip studio, dan CTA penutup di halaman depan.',
    fields: [
      { key: 'heroEyebrow', label: 'Eyebrow hero', type: 'text' },
      { key: 'heroTitle', label: 'Judul hero (sebelum kata beraksen)', type: 'text' },
      { key: 'heroTitleAccent', label: 'Kata beraksen (miring, warna emas)', type: 'text' },
      { key: 'heroTitleEnd', label: 'Judul hero (setelah kata beraksen)', type: 'text' },
      { key: 'heroLead', label: 'Paragraf hero', type: 'textarea' },
      { key: 'heroCtaPrimary', label: 'Label tombol utama', type: 'text' },
      { key: 'heroCtaSecondary', label: 'Label tombol kedua', type: 'text' },
      { key: 'proofEyebrow', label: 'Label di atas angka statistik', type: 'text' },
      { key: 'catalogEyebrow', label: 'Eyebrow section katalog', type: 'text' },
      { key: 'catalogTitle', label: 'Judul section katalog', type: 'text' },
      { key: 'catalogDesc', label: 'Deskripsi section katalog', type: 'textarea' },
      { key: 'catalogLinkLabel', label: 'Label tautan "lihat semua"', type: 'text' },
      { key: 'aboutEyebrow', label: 'Eyebrow section studio', type: 'text' },
      { key: 'aboutTitle', label: 'Judul section studio', type: 'text' },
      { key: 'aboutDesc', label: 'Deskripsi section studio', type: 'textarea' },
      { key: 'aboutLinkLabel', label: 'Label tautan studio', type: 'text' },
      { key: 'principles', label: 'Prinsip studio', type: 'pairs', help: 'Satu per baris: Judul | Deskripsi' },
      { key: 'ctaTitle', label: 'Judul CTA penutup', type: 'text' },
      { key: 'ctaText', label: 'Teks CTA penutup', type: 'textarea' },
      { key: 'ctaPrimaryLabel', label: 'Label tombol CTA utama', type: 'text' },
      { key: 'ctaSecondaryLabel', label: 'Label tombol CTA kedua', type: 'text' },
    ],
  },
  {
    key: 'products',
    label: 'Katalog Produk',
    description: 'Hero katalog, langkah mulai, keunggulan, dan CTA di halaman /products.',
    fields: [
      { key: 'heroEyebrow', label: 'Eyebrow hero', type: 'text' },
      { key: 'heroTitle', label: 'Judul hero (sebelum kata beraksen)', type: 'text' },
      { key: 'heroTitleAccent', label: 'Kata beraksen', type: 'text' },
      { key: 'heroTitleEnd', label: 'Judul hero (setelah kata beraksen)', type: 'text' },
      { key: 'heroLead', label: 'Paragraf hero', type: 'textarea' },
      { key: 'stepsEyebrow', label: 'Eyebrow section langkah', type: 'text' },
      { key: 'stepsTitle', label: 'Judul section langkah', type: 'text' },
      { key: 'stepsLead', label: 'Deskripsi section langkah', type: 'textarea' },
      { key: 'whyEyebrow', label: 'Eyebrow section keunggulan', type: 'text' },
      { key: 'whyTitle', label: 'Judul section keunggulan', type: 'text' },
      { key: 'whyLead', label: 'Deskripsi section keunggulan', type: 'textarea' },
      { key: 'faqEyebrow', label: 'Eyebrow section FAQ', type: 'text' },
      { key: 'faqTitle', label: 'Judul section FAQ', type: 'text' },
      { key: 'faqLead', label: 'Deskripsi section FAQ', type: 'textarea' },
      { key: 'ctaTitle', label: 'Judul CTA penutup', type: 'text' },
      { key: 'ctaText', label: 'Teks CTA penutup', type: 'textarea' },
    ],
  },
  {
    key: 'about',
    label: 'Tentang',
    description: 'Hero halaman Tentang.',
    fields: [
      { key: 'heroEyebrow', label: 'Eyebrow hero', type: 'text' },
      { key: 'heroTitle', label: 'Judul hero (sebelum kata beraksen)', type: 'text' },
      { key: 'heroTitleAccent', label: 'Kata beraksen', type: 'text' },
      { key: 'heroTitleEnd', label: 'Judul hero (setelah kata beraksen)', type: 'text' },
      { key: 'heroLead', label: 'Paragraf hero', type: 'textarea' },
    ],
  },
  {
    key: 'support',
    label: 'Support',
    description: 'Pengantar halaman bantuan.',
    fields: [
      { key: 'heroLead', label: 'Paragraf pengantar', type: 'textarea' },
    ],
  },
  {
    key: 'global',
    label: 'Global',
    description: 'Teks yang dipakai lintas halaman: tagline, deskripsi SEO, dan footer.',
    fields: [
      { key: 'tagline', label: 'Tagline studio', type: 'text', help: 'Ikut tampil di judul SEO halaman depan.' },
      { key: 'description', label: 'Deskripsi SEO & footer', type: 'textarea' },
      { key: 'footerTagline', label: 'Teks kecil kanan bawah footer', type: 'text' },
    ],
  },
];

// ─── Teks bawaan (yang sedang tayang) ────────────────────────────────────────
export const pageDefaults: Record<string, Record<string, any>> = {
  home: {
    heroEyebrow: 'Studio Produk Digital · Indonesia',
    heroTitle: 'Kami membangun pengalaman digital yang',
    heroTitleAccent: 'dinikmati',
    heroTitleEnd: 'banyak orang.',
    heroLead:
      'Vanillate Studio adalah studio produk digital asal Indonesia. Kami membangun, merilis, dan merawat aplikasi sosial serta community tools yang dipakai ratusan ribu orang setiap hari.',
    heroCtaPrimary: 'Jelajahi Produk',
    heroCtaSecondary: 'Kenali Studio',
    proofEyebrow: 'Dipercaya komunitas online Indonesia',
    catalogEyebrow: 'Produk',
    catalogTitle: 'Yang kami bangun.',
    catalogDesc:
      'Produk Vanillate Studio yang aktif dan dipakai hari ini — kami rawat serta kembangkan terus, bukan proyek sekali rilis.',
    catalogLinkLabel: 'Lihat semua produk',
    aboutEyebrow: 'Tentang Studio',
    aboutTitle: 'Kami membuat produk sendiri — dan merawatnya.',
    aboutDesc:
      'Vanillate bukan agency yang mengerjakan pesanan orang lain. Kami merancang, membangun, dan merawat produk kami sendiri untuk pengguna Indonesia.',
    aboutLinkLabel: 'Selengkapnya tentang kami',
    principles: [
      { title: 'Dirawat, bukan ditinggal', desc: 'Update rutin dan perbaikan cepat setelah rilis. Bagi kami, rilis adalah garis start, bukan finis.' },
      { title: 'Konteks lokal Indonesia', desc: 'Dibuat untuk pengguna Indonesia, dari bahasa sampai budayanya — bukan sekadar hasil terjemahan.' },
      { title: 'Cepat & stabil', desc: 'Respons terasa instan, uptime dijaga, dan data pengguna aman. Interaksi mulus adalah bagian dari desain.' },
    ],
    ctaTitle: 'Punya ide, masukan, atau mau berkolaborasi?',
    ctaText: 'Studio ini tumbuh bareng komunitasnya. Sapa kami langsung, atau jelajahi produk yang sedang berjalan.',
    ctaPrimaryLabel: 'Jelajahi Produk',
    ctaSecondaryLabel: 'Hubungi Studio',
  },
  products: {
    heroEyebrow: 'Katalog Produk',
    heroTitle: 'Sedikit produk,',
    heroTitleAccent: 'perhatian',
    heroTitleEnd: 'penuh.',
    heroLead:
      'Kami sengaja tidak membuat banyak produk sekaligus. Setiap yang dirilis diperlakukan sebagai produk utama, dengan update rutin, penyempurnaan yang terus berjalan, dan telinga yang selalu terbuka untuk komunitasnya. Pakai langsung, atau intip panduannya dulu di FAQ.',
    stepsEyebrow: 'Cara Mulai',
    stepsTitle: 'Tiga langkah, langsung jalan.',
    stepsLead:
      'Tanpa setup rumit. Cara memasangnya menyesuaikan produk — undang ke komunitas, unduh aplikasinya, atau langsung buka di web.',
    whyEyebrow: 'Kenapa Vanillate',
    whyTitle: 'Kenapa produk kami dipilih.',
    whyLead: 'Ada ratusan produk sejenis di luar sana. Ini yang membuat komunitas memilih dan bertahan dengan buatan kami.',
    faqEyebrow: 'FAQ',
    faqTitle: 'Pertanyaan yang sering muncul.',
    faqLead:
      'Butuh detail spesifik? Semua panduan kami terkumpul di FAQ, dikelompokkan per kategori. Belum ketemu jawabannya? Tanya langsung di komunitas kami.',
    ctaTitle: 'Masih ada pertanyaan?',
    ctaText: 'Cek FAQ lengkapnya, atau langsung tanya-tanya di komunitas kami.',
  },
  about: {
    heroEyebrow: 'Tentang Kami',
    heroTitle: 'Studio kecil,',
    heroTitleAccent: 'standar',
    heroTitleEnd: 'yang tidak kecil.',
    heroLead:
      'Vanillate Studio adalah studio produk digital independen asal Indonesia. Kami membangun pengalaman sosial dan community tools yang dipakai setiap hari, lalu merawatnya seperti produk yang layak dibanggakan, bukan proyek yang ditinggal setelah rilis.',
  },
  support: {
    heroLead:
      'Ceritakan kendalamu lewat formulir singkat, lalu lanjutkan ke WhatsApp atau email dengan pesan yang sudah tersusun rapi. Tidak perlu mengetik ulang. Atau gabung ke komunitas kami dan bertanya langsung ke orang yang menulis kodenya.',
  },
  global: {
    tagline: 'Studio produk digital Indonesia untuk komunitas dan pengalaman sosial.',
    description:
      'Vanillate Studio membangun, merilis, dan merawat produk digital untuk komunitas dan pengalaman sosial — dari aplikasi sosial, community tools, sampai otomasi dan AI. Produk kami dipakai ratusan ribu orang setiap hari, dan katalog kami terus bertambah.',
    footerTagline: 'Dibangun dengan teliti di Indonesia.',
  },
};

/** Nilai dianggap "diisi" bila bukan string kosong maupun array kosong. */
function terisi(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

/**
 * Konten satu halaman: nilai dari CMS ditimpakan di atas default.
 *
 * Field yang dikosongkan admin sengaja jatuh kembali ke default, bukan menjadi
 * string kosong — supaya menghapus isi di panel tidak pernah menghasilkan
 * judul kosong atau section melayang di halaman publik.
 */
export function pageContent<T extends Record<string, any> = Record<string, any>>(key: string): T {
  const defaults = pageDefaults[key] ?? {};
  const cms = ((pagesData as Record<string, any>).pages?.[key] ?? {}) as Record<string, any>;
  const hasil: Record<string, any> = { ...defaults };
  for (const [k, v] of Object.entries(cms)) {
    if (terisi(v)) hasil[k] = v;
  }
  return hasil as T;
}
