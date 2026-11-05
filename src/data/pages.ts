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
    description: 'Hero, daftar game & bot, prinsip komunitas, dan CTA penutup di halaman depan.',
    fields: [
      { key: 'heroEyebrow', label: 'Eyebrow hero', type: 'text' },
      { key: 'heroTitle', label: 'Judul hero (sebelum kata beraksen)', type: 'text' },
      { key: 'heroTitleAccent', label: 'Kata beraksen (miring, warna emas)', type: 'text' },
      { key: 'heroTitleEnd', label: 'Judul hero (setelah kata beraksen)', type: 'text' },
      { key: 'heroLead', label: 'Paragraf hero', type: 'textarea' },
      { key: 'heroCtaPrimary', label: 'Label tombol utama', type: 'text' },
      { key: 'heroCtaSecondary', label: 'Label tombol kedua', type: 'text' },
      { key: 'proofEyebrow', label: 'Label di atas angka statistik', type: 'text' },
      { key: 'catalogEyebrow', label: 'Eyebrow section game & bot', type: 'text' },
      { key: 'catalogTitle', label: 'Judul section game & bot', type: 'text' },
      { key: 'catalogDesc', label: 'Deskripsi section game & bot', type: 'textarea' },
      { key: 'catalogLinkLabel', label: 'Label tautan "lihat semua"', type: 'text' },
      { key: 'aboutEyebrow', label: 'Eyebrow section tentang', type: 'text' },
      { key: 'aboutTitle', label: 'Judul section tentang', type: 'text' },
      { key: 'aboutDesc', label: 'Deskripsi section tentang', type: 'textarea' },
      { key: 'aboutLinkLabel', label: 'Label tautan tentang', type: 'text' },
      { key: 'principles', label: 'Prinsip komunitas', type: 'pairs', help: 'Satu per baris: Judul | Deskripsi' },
      { key: 'ctaTitle', label: 'Judul CTA penutup', type: 'text' },
      { key: 'ctaText', label: 'Teks CTA penutup', type: 'textarea' },
      { key: 'ctaPrimaryLabel', label: 'Label tombol CTA utama', type: 'text' },
      { key: 'ctaSecondaryLabel', label: 'Label tombol CTA kedua', type: 'text' },
    ],
  },
  {
    key: 'products',
    label: 'Game & Bot',
    description: 'Hero, langkah mulai, alasan betah, dan CTA di halaman /products.',
    fields: [
      { key: 'heroEyebrow', label: 'Eyebrow hero', type: 'text' },
      { key: 'heroTitle', label: 'Judul hero (sebelum kata beraksen)', type: 'text' },
      { key: 'heroTitleAccent', label: 'Kata beraksen', type: 'text' },
      { key: 'heroTitleEnd', label: 'Judul hero (setelah kata beraksen)', type: 'text' },
      { key: 'heroLead', label: 'Paragraf hero', type: 'textarea' },
      { key: 'stepsEyebrow', label: 'Eyebrow section langkah', type: 'text' },
      { key: 'stepsTitle', label: 'Judul section langkah', type: 'text' },
      { key: 'stepsLead', label: 'Deskripsi section langkah', type: 'textarea' },
      { key: 'whyEyebrow', label: 'Eyebrow section alasan betah', type: 'text' },
      { key: 'whyTitle', label: 'Judul section alasan betah', type: 'text' },
      { key: 'whyLead', label: 'Deskripsi section alasan betah', type: 'textarea' },
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
    label: 'Bantuan',
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
      { key: 'tagline', label: 'Tagline komunitas', type: 'text', help: 'Ikut tampil di judul SEO halaman depan.' },
      { key: 'description', label: 'Deskripsi SEO & footer', type: 'textarea' },
      { key: 'footerTagline', label: 'Teks kecil kanan bawah footer', type: 'text' },
    ],
  },
];

// ─── Teks bawaan (yang sedang tayang) ────────────────────────────────────────
export const pageDefaults: Record<string, Record<string, any>> = {
  home: {
    heroEyebrow: 'Komunitas · Indonesia',
    heroTitle: 'Tempat kita main, ngobrol, dan',
    heroTitleAccent: 'tumbuh',
    heroTitleEnd: 'bareng.',
    heroLead:
      'Vanillate Studio adalah komunitas Indonesia yang berkumpul di Discord. Kita main game kata, ikut event, saling bantu, dan membuat game serta bot yang dipakai ratusan ribu orang bersama-sama.',
    heroCtaPrimary: 'Gabung Discord',
    heroCtaSecondary: 'Lihat Game & Bot',
    proofEyebrow: 'Komunitas kita dalam angka',
    catalogEyebrow: 'Bot Kami',
    catalogTitle: 'Yang kita mainkan bareng.',
    catalogDesc:
      'Vanillate.ID adalah bot Discord buatan komunitas ini. Gratis, terus dirawat, dan berkembang dari ide anggota.',
    catalogLinkLabel: 'Lihat game & bot lainnya',
    aboutEyebrow: 'Tentang Kita',
    aboutTitle: 'Dimulai dari satu server, tumbuh karena anggotanya.',
    aboutDesc:
      'Vanillate bukan agency dan bukan perusahaan jasa. Ini komunitas yang dirawat oleh orang-orang yang juga ikut main di dalamnya.',
    aboutLinkLabel: 'Baca cerita kita',
    principles: [
      { title: 'Dirawat, bukan ditinggal', desc: 'Kami terus memperbaiki dan menambah hal baru setelah rilis, karena komunitas ini hidup setiap hari.' },
      { title: 'Dibuat untuk kita', desc: 'Bahasa, candaan, dan kebiasaan yang kita kenal sehari-hari, bukan sekadar hasil terjemahan.' },
      { title: 'Terbuka untuk semua', desc: 'Bebas gabung, bebas usul. Masukan anggota sering jadi fitur berikutnya.' },
    ],
    ctaTitle: 'Ayo main bareng kami.',
    ctaText: 'Gabung Discord, kenalan dengan anggota lain, dan ceritakan idemu. Pintu kami selalu terbuka.',
    ctaPrimaryLabel: 'Gabung Discord',
    ctaSecondaryLabel: 'Butuh bantuan?',
  },
  products: {
    heroEyebrow: 'Game & Bot',
    heroTitle: 'Game dan bot untuk',
    heroTitleAccent: 'main',
    heroTitleEnd: 'bareng.',
    heroLead:
      'Semua yang ada di sini lahir dari komunitas Vanillate dan dirawat bersama anggotanya. Pasang di servermu, ajak teman, lalu main. Bingung mulai dari mana? Panduannya ada di FAQ.',
    stepsEyebrow: 'Cara Mulai',
    stepsTitle: 'Tiga langkah, langsung main.',
    stepsLead:
      'Tanpa setup rumit. Cara pasangnya menyesuaikan: undang ke server, unduh aplikasinya, atau buka langsung di web.',
    whyEyebrow: 'Kenapa Betah',
    whyTitle: 'Kenapa komunitas ini bertahan.',
    whyLead: 'Banyak game dan bot serupa di luar sana. Ini alasan anggota kami memilih tinggal.',
    faqEyebrow: 'FAQ',
    faqTitle: 'Pertanyaan yang sering muncul.',
    faqLead:
      'Mau detail? Semua panduan ada di FAQ, dikelompokkan per kategori. Belum ketemu jawabannya? Tanya saja di Discord, ada yang siap membantu.',
    ctaTitle: 'Masih bingung?',
    ctaText: 'Baca FAQ lengkapnya, atau tanya langsung di Discord kami.',
  },
  about: {
    heroEyebrow: 'Tentang Kita',
    heroTitle: 'Komunitas kecil,',
    heroTitleAccent: 'hangat',
    heroTitleEnd: 'dan terus tumbuh.',
    heroLead:
      'Vanillate Studio adalah komunitas Indonesia yang berkumpul untuk main, ngobrol, dan membuat hal seru bersama. Game dan bot kami lahir dari obrolan anggota, lalu dirawat supaya rumah ini tetap nyaman.',
  },
  support: {
    heroLead:
      'Ceritakan kendalamu lewat formulir singkat, lalu lanjutkan ke WhatsApp atau email dengan pesan yang sudah tersusun rapi. Atau langsung gabung ke Discord dan tanya ke pengurus serta anggota yang siap membantu.',
  },
  global: {
    tagline: 'Komunitas Indonesia untuk main, ngobrol, dan tumbuh bareng.',
    description:
      'Vanillate Studio adalah komunitas Indonesia yang berkumpul di Discord untuk main game, ngobrol, dan membuat bot serta fitur seru bersama. Semua gratis, terbuka, dan dirawat oleh anggotanya.',
    footerTagline: 'Dibuat bareng komunitas, dari Indonesia.',
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
