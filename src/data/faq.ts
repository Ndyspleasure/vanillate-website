// ─────────────────────────────────────────────────────────────────────────────
// FAQ TERPUSAT — SUMBER TUNGGAL SELURUH PANDUAN
//
// Dulu panduan tersebar di dua tempat: dokumentasi per produk (src/data/docs.ts
// + halaman /docs/<slug>) dan daftar FAQ yang ditulis ulang di berkas ini.
// Keduanya saling menyalin dan pelan-pelan berbeda isi. Sekarang keduanya
// dilebur jadi satu sistem FAQ berkategori yang dikelola dari /admin/faq.
//
//   Supabase faq_categories + faqs
//     → scripts/sync-content.mjs → src/data/synced/faq.json → modul ini
//
// TIDAK ADA isi FAQ yang ditulis di source code. Modul ini hanya membaca data
// tersinkron dan menyediakan helper URL supaya halaman mana pun bisa menaut ke
// FAQ yang relevan tanpa menuliskan URL-nya sendiri.
// ─────────────────────────────────────────────────────────────────────────────

import faqData from './synced/faq.json';
import { url } from '@utils/url';
import { ringkas } from '@utils/markdown';

export type FaqCategory = {
  slug: string;
  name: string;
  description: string;
  icon: string;
  sortOrder: number;
};

export type FaqEntry = {
  category: string;      // slug kategori
  slug: string;
  question: string;
  answer: string;        // Markdown, dirender lewat @utils/markdown
  sortOrder: number;
  updatedAt: string;
  /** Slug lama yang masih dipakai tautan di luar sana. */
  aliases: string[];
};

/** Bentuk item untuk <FAQAccordion>. Dipertahankan supaya pemanggil lama utuh. */
export type FaqItem = { q: string; a: string; href?: string };

type RawData = { categories?: unknown[]; faqs?: unknown[] };

const mentah = faqData as RawData;

function teks(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}
function angka(v: unknown, bawaan = 100): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : bawaan;
}

// ─── Kategori ────────────────────────────────────────────────────────────────
export const faqCategories: FaqCategory[] = (mentah.categories ?? [])
  .map((c: any) => ({
    slug: teks(c?.slug),
    name: teks(c?.name) || teks(c?.slug),
    description: teks(c?.description),
    icon: teks(c?.icon) || 'circle-help',
    sortOrder: angka(c?.sortOrder),
  }))
  .filter((c) => c.slug)
  .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'id'));

const kategoriPerSlug = new Map(faqCategories.map((c) => [c.slug, c]));

// ─── Pertanyaan ──────────────────────────────────────────────────────────────
// FAQ yang menunjuk kategori tidak dikenal dibuang: kategori nonaktif tidak
// ikut tersinkron, dan menampilkan pertanyaannya berarti membocorkan konten
// yang sengaja disembunyikan admin.
export const faqs: FaqEntry[] = (mentah.faqs ?? [])
  .map((f: any) => ({
    category: teks(f?.category),
    slug: teks(f?.slug),
    question: teks(f?.question),
    answer: typeof f?.answer === 'string' ? f.answer : '',
    sortOrder: angka(f?.sortOrder),
    updatedAt: teks(f?.updatedAt),
    aliases: Array.isArray(f?.aliases) ? f.aliases.map(teks).filter(Boolean) : [],
  }))
  .filter((f) => f.slug && f.question && f.answer && kategoriPerSlug.has(f.category))
  .sort((a, b) => a.sortOrder - b.sortOrder || a.question.localeCompare(b.question, 'id'));

const faqPerKunci = new Map(faqs.map((f) => [`${f.category}/${f.slug}`, f]));

// ─── Query ───────────────────────────────────────────────────────────────────

/** FAQ dalam satu kategori, sudah terurut. */
export function faqsByCategory(categorySlug: string): FaqEntry[] {
  return faqs.filter((f) => f.category === categorySlug);
}

/** Jumlah FAQ per kategori — dipakai daftar kategori di halaman /faq. */
export function faqCount(categorySlug: string): number {
  return faqsByCategory(categorySlug).length;
}

export function getFaqCategory(slug: string): FaqCategory | undefined {
  return kategoriPerSlug.get(slug);
}

/** Satu FAQ berdasarkan kategori + slug. */
export function getFaq(categorySlug: string, faqSlug: string): FaqEntry | undefined {
  return faqPerKunci.get(`${categorySlug}/${faqSlug}`);
}

/**
 * Cari FAQ dari referensi bebas. Menerima "kategori/slug" atau slug saja
 * (dipakai <FAQLink faq="cara-melakukan-order" />). Slug tanpa kategori dicari
 * di seluruh FAQ, jadi halaman pemanggil tidak perlu tahu kategorinya.
 */
export function findFaq(ref: string): FaqEntry | undefined {
  const r = teks(ref).replace(/^\/+|\/+$/g, '');
  if (!r) return undefined;
  if (r.includes('/')) return faqPerKunci.get(r);
  return faqs.find((f) => f.slug === r);
}

/** Kategori yang dipetakan ke sebuah produk (products.faq_category_id). */
export function faqCategoryFor(categorySlug: string | undefined | null): FaqCategory | undefined {
  const s = teks(categorySlug);
  return s ? kategoriPerSlug.get(s) : undefined;
}

/** Kategori yang berisi FAQ. Kategori kosong tidak perlu ditawarkan ke pembaca. */
export const populatedFaqCategories: FaqCategory[] = faqCategories.filter((c) => faqCount(c.slug) > 0);

// ─── URL ─────────────────────────────────────────────────────────────────────
//
// SATU tempat yang tahu bentuk URL FAQ. Halaman lain memanggil helper ini,
// bukan menyusun string sendiri, supaya struktur rute bisa berubah tanpa
// berburu URL yang tertanam di seluruh situs.

// Ada DUA bentuk untuk tiap tautan, dan itu disengaja:
//   • …Path() → path apa adanya, untuk komponen yang sudah memanggil url()
//     sendiri (mis. <Button>). Memberi URL ber-base ke sana akan menempelkan
//     base dua kali begitu situs kembali dipasang di sub-path.
//   • …Url()  → sudah lewat url(), untuk <a href> biasa.

/** Path halaman utama FAQ (tanpa base). */
export function faqIndexPath(): string {
  return '/faq';
}

/** Path sebuah kategori (tanpa base). */
export function faqCategoryPath(categorySlug: string): string {
  return `/faq/${categorySlug}`;
}

/** Path sebuah FAQ (tanpa base). */
export function faqPath(categorySlug: string, faqSlug: string): string {
  return `/faq/${categorySlug}/${faqSlug}`;
}

/** URL halaman utama FAQ. */
export function faqIndexUrl(): string {
  return url(faqIndexPath());
}

/** URL sebuah kategori: /faq/<kategori>. */
export function faqCategoryUrl(categorySlug: string): string {
  return url(faqCategoryPath(categorySlug));
}

/** URL sebuah FAQ: /faq/<kategori>/<slug>. */
export function faqUrl(categorySlug: string, faqSlug: string): string {
  return url(faqPath(categorySlug, faqSlug));
}

/**
 * URL dari referensi bebas, dengan jaring pengaman.
 *
 * Bila FAQ yang dituju tidak ada (mis. slug-nya diganti admin dan alias belum
 * dibuat), pemanggil TIDAK dibiarkan menghasilkan tautan mati: fungsi ini
 * jatuh ke halaman kategori, lalu ke /faq. Lebih baik mendarat satu tingkat
 * lebih umum daripada mendarat di 404.
 */
export function resolveFaqUrl(ref: string, fallbackCategory?: string): string {
  const faq = findFaq(ref);
  if (faq) return faqUrl(faq.category, faq.slug);
  const kategori = teks(fallbackCategory) || (ref.includes('/') ? ref.split('/')[0] : '');
  if (kategori && kategoriPerSlug.has(kategori)) return faqCategoryUrl(kategori);
  return faqIndexUrl();
}

// ─── Bentuk turunan ──────────────────────────────────────────────────────────

/** FAQ satu kategori sebagai item akordeon (dipakai halaman produk & support). */
export function faqItems(categorySlug: string, limit?: number): FaqItem[] {
  const daftar = faqsByCategory(categorySlug);
  return (limit ? daftar.slice(0, limit) : daftar).map((f) => ({
    q: f.question,
    a: f.answer,
    href: faqUrl(f.category, f.slug),
  }));
}

/**
 * FAQ dari beberapa kategori sekaligus, dalam bentuk item akordeon.
 *
 * Dipakai halaman yang menampilkan FAQ umum (katalog produk, support): mereka
 * menyebut kategori mana yang relevan, bukan menulis ulang pertanyaannya.
 */
export function faqItemsFrom(categorySlugs: string[], limit?: number): FaqItem[] {
  const daftar = categorySlugs.flatMap((slug) => faqItems(slug));
  return limit ? daftar.slice(0, limit) : daftar;
}

/**
 * Indeks pencarian yang ditanam ke halaman /faq. Dibuat saat build supaya
 * pencarian berjalan tanpa permintaan jaringan sama sekali — situsnya statis.
 */
export type FaqSearchRow = {
  q: string;      // pertanyaan
  c: string;      // nama kategori
  cs: string;     // slug kategori
  s: string;      // ringkasan jawaban
  t: string;      // teks pencarian (huruf kecil)
  u: string;      // URL
};

export function faqSearchIndex(): FaqSearchRow[] {
  return faqs.map((f) => {
    const kategori = kategoriPerSlug.get(f.category);
    const ringkasan = ringkas(f.answer, 150);
    return {
      q: f.question,
      c: kategori?.name ?? f.category,
      cs: f.category,
      s: ringkasan,
      t: `${f.question} ${kategori?.name ?? ''} ${ringkas(f.answer, 600)}`.toLowerCase(),
      u: faqUrl(f.category, f.slug),
    };
  });
}
