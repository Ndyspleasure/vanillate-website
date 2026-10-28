// Tes logika Edge Function blog-admin (supabase/functions/blog-admin/logic.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  authorDocument,
  buildListing,
  canWrite,
  categoryDocument,
  cleanPostFields,
  fieldsFromDocument,
  isDocId,
  newDocId,
  nextPreviousSlugs,
  postDocument,
  publishErrors,
  safeFilename,
  withoutSystemFields,
} from '../supabase/functions/blog-admin/logic.ts';
import { DOC_TYPES } from '../src/lib/blog/config.ts';
import { TYPES } from '../supabase/functions/blog-admin/logic.ts';

const ASSET = 'image-0123456789abcdef0123456789abcdef01234567-1600x900-jpg';
const AUTHOR = 'author.11111111-2222-3333-4444-555555555555';
const CAT = 'category.11111111-2222-3333-4444-555555555555';
const kata = (n: number) => Array.from({ length: n }, (_, i) => `kata${i}`).join(' ');

const lengkap = {
  title: 'Cara Main Sambung Kata untuk Pemula',
  body: `## Aturan\n\n${kata(80)}`,
  excerpt: 'Panduan singkat bermain Sambung Kata.',
  authorId: AUTHOR,
  categoryIds: [CAT],
  mainImage: { assetId: ASSET, alt: 'Papan permainan', caption: '' },
};

test('tipe dokumen sama dengan konfigurasi situs', () => {
  assert.deepEqual(TYPES, DOC_TYPES);
});

test('canWrite: hanya owner & admin', () => {
  assert.equal(canWrite('owner'), true);
  assert.equal(canWrite('admin'), true);
  assert.equal(canWrite('viewer'), false);
  assert.equal(canWrite(undefined), false);
});

test('isDocId & newDocId', () => {
  const id = newDocId('post');
  assert.equal(isDocId(id, 'post'), true);
  assert.equal(isDocId(id, 'author'), false);
  assert.equal(isDocId('drafts.' + id), false);
  assert.equal(isDocId('post.x'), false);
  assert.equal(isDocId('post.../../evil'), false);
});

test('cleanPostFields: slug dari judul, input liar dibuang', () => {
  const f = cleanPostFields({
    title: '  Tips &   Trik\u0000 Main  ',
    tags: ['Pemula', 'pemula', '', '!!!', 'x'.repeat(100)],
    categoryIds: [CAT, CAT, 'category.bad id', 5],
    authorId: 'author.<script>',
    mainImage: { assetId: 'https://evil.com/a.jpg', alt: 'x' },
    relatedProducts: ['sambung-kata', 'Bukan Slug'],
    relatedFaqs: ['umum/cara-main', '../x'],
    publishedAt: 'bukan tanggal',
    seo: { noindex: 'true' },
    faqs: [{ q: 'Apa?', a: '' }, { q: 'Kenapa?', a: 'Karena.' }],
  });
  assert.equal(f.title, 'Tips & Trik Main');
  assert.equal(f.slug, 'tips-dan-trik-main');
  assert.equal(f.tags.length, 2); // "pemula" duplikat Pemula; tag panjang dipotong 40 karakter
  assert.deepEqual(f.categoryIds, [CAT]);
  assert.equal(f.authorId, null);
  assert.equal(f.mainImage, null);
  assert.deepEqual(f.relatedProducts, ['sambung-kata']);
  assert.deepEqual(f.relatedFaqs, ['umum/cara-main']);
  assert.equal(f.publishedAt, null);
  assert.equal(f.seo.noindex, false);
  assert.deepEqual(f.faqs, [{ q: 'Kenapa?', a: 'Karena.' }]);
});

test('publishErrors: artikel lengkap lolos, yang kurang ditolak dengan alasan', () => {
  assert.deepEqual(publishErrors(cleanPostFields(lengkap)), []);
  const e = publishErrors(cleanPostFields({ title: 'Hai', body: 'pendek', mainImage: { assetId: ASSET, alt: '' } }));
  assert.equal(e.length, 5);
  assert.ok(e.some((x) => /alt text/.test(x)));
  assert.ok(e.some((x) => /penulis/i.test(x)));
  const rsv = publishErrors(cleanPostFields({ ...lengkap, slug: 'kategori' }));
  assert.ok(rsv.some((x) => /dipakai halaman blog lain/.test(x)));
  assert.ok(publishErrors(cleanPostFields({ ...lengkap, slug: '2' })).length === 1);
});

test('postDocument: referensi, kunci array, dan tanggal', () => {
  const id = 'post.11111111-2222-3333-4444-555555555555';
  const f = cleanPostFields({ ...lengkap, relatedPostIds: [id, 'post.99999999-2222-3333-4444-555555555555'], faqs: [{ q: 'A?', a: 'B' }] });
  const doc = postDocument(id, f, { previousSlugs: ['lama', 'cara-main-sambung-kata-untuk-pemula'], publishedAt: '2026-10-01T00:00:00.000Z', updatedAt: null });
  assert.equal(doc._type, 'blogPost');
  assert.deepEqual(doc.slug, { _type: 'slug', current: 'cara-main-sambung-kata-untuk-pemula' });
  assert.deepEqual((doc.author as any)._ref, AUTHOR);
  assert.equal((doc.categories as any[])[0]._ref, CAT);
  assert.ok((doc.categories as any[])[0]._key);
  // artikel tidak boleh menautkan dirinya sendiri; referensi terkait lemah
  assert.equal((doc.relatedPosts as any[]).length, 1);
  assert.equal((doc.relatedPosts as any[])[0]._weak, true);
  assert.deepEqual(doc.previousSlugs, ['lama']);
  assert.equal(doc.publishedAt, '2026-10-01T00:00:00.000Z');
  assert.equal('updatedAt' in doc, false);
  assert.equal((doc.mainImage as any).asset._ref, ASSET);
});

test('nextPreviousSlugs: slug terbit lama dicatat saat berubah', () => {
  const pub = { slug: { current: 'cara-bermain' }, previousSlugs: ['awal'] };
  assert.deepEqual(nextPreviousSlugs(pub, 'cara-main'), ['awal', 'cara-bermain']);
  assert.deepEqual(nextPreviousSlugs(pub, 'cara-bermain'), ['awal']);
  // kembali ke slug lama → tidak boleh mengalihkan ke dirinya sendiri
  assert.deepEqual(nextPreviousSlugs({ slug: { current: 'b' }, previousSlugs: ['a'] }, 'a'), ['b']);
  assert.deepEqual(nextPreviousSlugs(null, 'x'), []);
});

test('fieldsFromDocument kebalikan postDocument', () => {
  const id = 'post.11111111-2222-3333-4444-555555555555';
  const f = cleanPostFields({ ...lengkap, tags: ['Pemula'], tldr: ['Satu', 'Dua'], seo: { title: 'SEO', description: 'Desk', noindex: true } });
  const doc = { ...postDocument(id, f, { previousSlugs: [], publishedAt: null, updatedAt: null }), mainImageUrl: 'https://cdn.sanity.io/x.jpg' };
  const back = fieldsFromDocument(doc);
  assert.equal(back.mainImageUrl, 'https://cdn.sanity.io/x.jpg');
  const { mainImageUrl, ...sisa } = back;
  assert.deepEqual(sisa, f);
});

test('buildListing: status draft / terbit / ada perubahan / terjadwal', () => {
  const now = new Date('2026-10-10T00:00:00Z');
  const a = 'post.aaaaaaaa-2222-3333-4444-555555555555';
  const b = 'post.bbbbbbbb-2222-3333-4444-555555555555';
  const c = 'post.cccccccc-2222-3333-4444-555555555555';
  const d = 'post.dddddddd-2222-3333-4444-555555555555';
  const rows = buildListing([
    { _id: a, title: 'A', slug: { current: 'a' }, publishedAt: '2026-10-01T00:00:00Z', _updatedAt: '2026-10-01' },
    { _id: `drafts.${b}`, title: 'B', _updatedAt: '2026-10-05' },
    { _id: c, title: 'C lama', slug: { current: 'c' }, publishedAt: '2026-10-01T00:00:00Z', _updatedAt: '2026-10-02' },
    { _id: `drafts.${c}`, title: 'C baru', slug: { current: 'c-baru' }, _updatedAt: '2026-10-08' },
    { _id: d, title: 'D', slug: { current: 'd' }, publishedAt: '2026-12-01T00:00:00Z', _updatedAt: '2026-10-03' },
    { _id: 'author.x', title: 'bukan artikel' },
  ], now);
  const s = Object.fromEntries(rows.map((r) => [r.id, r]));
  assert.equal(rows.length, 4);
  assert.equal(s[a].status, 'published');
  assert.equal(s[b].status, 'draft');
  assert.equal(s[c].status, 'changed');
  assert.equal(s[c].title, 'C baru');
  assert.equal(s[c].publishedSlug, 'c');
  assert.equal(s[d].status, 'scheduled');
  assert.equal(rows[0].id, c, 'terakhir diedit di atas');
});

test('authorDocument & categoryDocument', () => {
  const a = authorDocument(AUTHOR, { name: ' Andi Kurniawan ', links: ['https://x.com/a', 'http://tidak-aman', 'javascript:1'] });
  assert.deepEqual(a.errors, []);
  assert.equal((a.doc!.slug as any).current, 'andi-kurniawan');
  assert.deepEqual(a.doc!.links, ['https://x.com/a']);
  assert.equal(authorDocument(AUTHOR, { name: 'A' }).doc, undefined);

  const c = categoryDocument(CAT, { title: 'Panduan & Tips', sort: '99999' });
  assert.equal((c.doc!.slug as any).current, 'panduan-dan-tips');
  assert.equal(c.doc!.sort, 9999);
});

test('withoutSystemFields & safeFilename', () => {
  const out = withoutSystemFields({ _id: 'post.a', _rev: 'r', _type: 'blogPost', _createdAt: 'x', title: 'T' }, 'drafts.post.a');
  assert.deepEqual(out, { _id: 'drafts.post.a', _type: 'blogPost', title: 'T' });
  assert.equal(safeFilename('Foto Saya (1).JPG'), 'foto-saya-1-.jpg');
  assert.equal(safeFilename(null), 'gambar');
});
