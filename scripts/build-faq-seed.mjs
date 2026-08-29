// ════════════════════════════════════════════════════════════════════════════
// GENERATOR SEED FAQ
//
// Membaca satu sumber (scripts/faq-seed-data.mjs) lalu menulis DUA keluaran:
//   • supabase/seed-faq.sql     → isi awal tabel faq_categories & faqs, untuk
//                                 dijalankan di Supabase SQL Editor SETELAH
//                                 supabase/schema.sql.
//   • src/data/synced/faq.json  → snapshot yang dipakai `npm run build`
//                                 sebelum sinkronisasi pertama berjalan.
//
// Kenapa digenerate, bukan ditulis tangan dua kali: konten yang sama disalin
// ke dua format berbeda adalah undangan untuk saling menyimpang — persis
// masalah yang membuat dokumentasi lama dan FAQ lama tidak lagi cocok.
//
// Jalankan: node scripts/build-faq-seed.mjs
// ════════════════════════════════════════════════════════════════════════════

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { categories, faqs } from './faq-seed-data.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const FILE_SQL = path.join(ROOT, 'supabase', 'seed-faq.sql');
const FILE_JSON = path.join(ROOT, 'src', 'data', 'synced', 'faq.json');

/** Kutip literal string untuk SQL. Satu-satunya escaping yang dibutuhkan. */
const q = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`);

// ─── Validasi: lebih baik gagal di sini daripada menulis seed yang rusak ────
const slugKategori = new Set();
for (const c of categories) {
  if (!/^[a-z0-9-]+$/.test(c.slug)) throw new Error(`Slug kategori tidak valid: ${c.slug}`);
  if (slugKategori.has(c.slug)) throw new Error(`Slug kategori ganda: ${c.slug}`);
  slugKategori.add(c.slug);
}
const pasangan = new Set();
for (const f of faqs) {
  if (!slugKategori.has(f.category)) throw new Error(`FAQ "${f.slug}" menunjuk kategori tak dikenal: ${f.category}`);
  if (!/^[a-z0-9-]+$/.test(f.slug)) throw new Error(`Slug FAQ tidak valid: ${f.slug}`);
  const kunci = `${f.category}/${f.slug}`;
  if (pasangan.has(kunci)) throw new Error(`Slug FAQ ganda dalam satu kategori: ${kunci}`);
  pasangan.add(kunci);
  if (!f.question?.trim()) throw new Error(`FAQ "${kunci}" tanpa pertanyaan.`);
  if (!f.answer?.trim()) throw new Error(`FAQ "${kunci}" tanpa jawaban.`);
}

// ─── 1. SQL ─────────────────────────────────────────────────────────────────
const barisKategori = categories
  .map((c) => `  (${q(c.name)}, ${q(c.slug)}, ${q(c.description)}, ${q(c.icon)}, 'active', ${Number(c.sortOrder) || 100})`)
  .join(',\n');

const barisFaq = faqs
  .map((f) => `  (${q(f.category)}, ${q(f.question)}, ${q(f.slug)}, ${q(f.answer)}, 'active', ${Number(f.sortOrder) || 100})`)
  .join(',\n');

// Kategori yang dipetakan ke produk. Pemetaan inilah pengganti docs_slug.
const barisProduk = categories
  .filter((c) => c.productSlug)
  .map((c) => `  (${q(c.productSlug)}, ${q(c.slug)})`)
  .join(',\n');

const sql = `-- ═══════════════════════════════════════════════════════════════════════════
--  Vanillate — Isi awal FAQ (hasil migrasi dokumentasi lama)
--
--  BERKAS INI DIGENERATE. Jangan disunting langsung.
--  Sumber: scripts/faq-seed-data.mjs → node scripts/build-faq-seed.mjs
--
--  Jalankan SETELAH supabase/schema.sql, di Supabase Dashboard → SQL Editor.
--  Aman dijalankan ulang: baris yang slug-nya sudah ada TIDAK ditimpa, jadi
--  penyuntingan yang sudah dilakukan admin lewat /admin/faq tidak hilang.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Kategori
insert into public.faq_categories (name, slug, description, icon, status, sort_order)
values
${barisKategori}
on conflict (slug) do nothing;

-- 2. Pertanyaan. category_id dicari dari slug kategori supaya seed tidak perlu
--    tahu UUID apa pun.
insert into public.faqs (category_id, question, slug, answer, status, sort_order)
select c.id, v.question, v.slug, v.answer, v.status, v.sort_order
from (values
${barisFaq}
) as v(category_slug, question, slug, answer, status, sort_order)
join public.faq_categories c on c.slug = v.category_slug
on conflict (category_id, slug) do nothing;

-- 3. Pemetaan produk → kategori FAQ (pengganti products.docs_slug).
--    Hanya diisi bila produk belum menunjuk kategori mana pun, supaya
--    pemetaan yang sudah diatur admin tidak tertimpa.
update public.products p
set faq_category_id = c.id
from (values
${barisProduk}
) as v(product_slug, category_slug)
join public.faq_categories c on c.slug = v.category_slug
where p.slug = v.product_slug and p.faq_category_id is null;
`;

// ─── 2. JSON snapshot (bentuknya sama dengan keluaran sync-content.mjs) ──────
const stempel = new Date().toISOString();
const json = {
  categories: categories.map((c) => ({
    slug: c.slug,
    name: c.name,
    description: c.description ?? '',
    icon: c.icon ?? '',
    sortOrder: Number(c.sortOrder) || 100,
  })),
  faqs: faqs.map((f) => ({
    category: f.category,
    slug: f.slug,
    question: f.question,
    answer: f.answer,
    sortOrder: Number(f.sortOrder) || 100,
    updatedAt: stempel,
    aliases: Array.isArray(f.aliases) ? f.aliases : [],
  })),
};

fs.mkdirSync(path.dirname(FILE_JSON), { recursive: true });
fs.writeFileSync(FILE_SQL, sql, 'utf8');
fs.writeFileSync(FILE_JSON, JSON.stringify(json, null, 2) + '\n', 'utf8');

console.log(`✓ ${path.relative(ROOT, FILE_SQL)}`);
console.log(`✓ ${path.relative(ROOT, FILE_JSON)}`);
console.log(`  kategori: ${categories.length} · FAQ: ${faqs.length}`);
