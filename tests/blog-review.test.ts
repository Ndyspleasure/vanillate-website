// Tes logika peninjauan Portal Penulis Blog (supabase/functions/blog-admin/review.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  allImagePaths,
  bodyImagePaths,
  bodyImageProblems,
  cleanProfile,
  cleanWriterInput,
  discordFromUser,
  isStoragePath,
  reviewEmail,
  rewriteBodyImages,
  submitProblems,
  submissionToPostFields,
} from '../supabase/functions/blog-admin/review.ts';
import { cleanPostFields, postDocument, fieldsFromDocument } from '../supabase/functions/blog-admin/logic.ts';

const U = 'c0000000-0000-4000-8000-000000000001';
const OTHER = 'c0000000-0000-4000-8000-000000000002';
const P1 = `${U}/11111111-1111-4111-8111-111111111111.webp`;
const P2 = `${U}/22222222-2222-4222-8222-222222222222.jpg`;
const kata = (n: number) => Array.from({ length: n }, (_, i) => `kata${i}`).join(' ');
const CAT = 'category-11111111-2222-3333-4444-555555555555';

test('isStoragePath: format dan pemilik', () => {
  assert.equal(isStoragePath(P1, U), true);
  assert.equal(isStoragePath(P1, OTHER), false);
  assert.equal(isStoragePath(`${U}/../x.webp`, U), false);
  assert.equal(isStoragePath('bebas.png'), false);
  assert.equal(isStoragePath(null), false);
});

test('bodyImagePaths dan allImagePaths', () => {
  const body = `Halo\n\n![a](blogimg:${P1})\n\n![b](blogimg:${P2} "ket")\n\n![c](blogimg:${P1})`;
  assert.deepEqual(bodyImagePaths(body), [P1, P2]);
  const P3 = `${U}/33333333-3333-4333-8333-333333333333.png`;
  assert.deepEqual(allImagePaths({ main_image_path: P3, body }), [P3, P1, P2]);
  assert.deepEqual(allImagePaths({ main_image_path: P2, body }), [P1, P2], 'gambar utama yang juga ada di isi tidak ganda');
});

test('bodyImageProblems: alamat luar dan gambar milik orang lain ditolak', () => {
  assert.deepEqual(bodyImageProblems(`![a](blogimg:${P1})`, U), []);
  assert.equal(bodyImageProblems('![x](https://evil.example/p.png)', U).length, 1);
  assert.equal(bodyImageProblems('![x](http://evil.example/p.png)', U).length, 1);
  assert.equal(bodyImageProblems(`![a](blogimg:${P1})`, OTHER).length, 1);
  assert.deepEqual(
    bodyImageProblems('![x](https://cdn.sanity.io/images/62jp784l/production/0123456789abcdef-800x600.png)', U), []);
  const banyak = Array.from({ length: 11 }, (_, i) => `![a](blogimg:${U}/${String(i).padStart(8, '0')}-1111-4111-8111-111111111111.webp)`).join('\n\n');
  assert.ok(bodyImageProblems(banyak, U).some((m) => m.includes('Maksimal')));
});

test('rewriteBodyImages mengganti hanya blogimg yang dikenal', () => {
  const body = `![a](blogimg:${P1} "ket")\n\n![b](blogimg:${P2})\n\n![c](https://x.id/a.png)`;
  const out = rewriteBodyImages(body, { [P1]: 'https://cdn.sanity.io/images/p/d/abc-10x10.webp' });
  assert.ok(out.includes('![a](https://cdn.sanity.io/images/p/d/abc-10x10.webp "ket")'));
  assert.ok(out.includes(`blogimg:${P2}`));
  assert.ok(out.includes('https://x.id/a.png'));
});

test('cleanWriterInput membersihkan dan membatasi isian', () => {
  const r = cleanWriterInput({
    title: '  Judul   Bagus  ', slug: '', excerpt: 'ringkas', tldr: ['a', '', 'b'],
    body: `isi ![a](blogimg:${P1})`, categories: [CAT, 'bukan-id', CAT], tags: ['Satu', 'satu', 'dua'],
    mainImagePath: OTHER + '/x.webp', mainImageAlt: 'alt', aiImage: true,
  }, U);
  assert.equal(r.title, 'Judul Bagus');
  assert.equal(r.slug, 'judul-bagus');
  assert.deepEqual(r.tldr, ['a', 'b']);
  assert.deepEqual(r.categories, [CAT]);
  assert.deepEqual(r.tags, ['Satu', 'dua']);
  assert.equal(r.main_image_path, null, 'path gambar milik orang lain dibuang');
  assert.equal(r.ai_image, true);
  assert.deepEqual(r.image_paths, [P1]);
  assert.equal(cleanWriterInput({ title: '' }, U).slug, null);
});

test('submitProblems: tulisan lengkap lolos, kekurangan dilaporkan', () => {
  const lengkap = {
    title: 'Cara Main Sambung Kata', slug: 'cara-main', excerpt: 'Ringkas.', body: `## Aturan\n\n${kata(80)}`,
    categories: [CAT], main_image_path: P1, main_image_alt: 'Papan permainan', tldr: [], tags: [],
  };
  assert.deepEqual(submitProblems(lengkap, U), []);
  const e = submitProblems({ ...lengkap, main_image_path: null, categories: [], body: 'singkat' }, U);
  assert.ok(e.some((m) => m.includes('50 kata')));
  assert.ok(e.some((m) => m.includes('Gambar utama')));
  assert.ok(e.some((m) => m.includes('kategori')));
  assert.ok(submitProblems({ ...lengkap, main_image_alt: '' }, U).some((m) => m.includes('alt')));
  assert.ok(submitProblems({ ...lengkap, slug: 'masuk' }, U).some((m) => m.includes('masuk')));
  assert.ok(submitProblems({ ...lengkap, body: `${lengkap.body}\n\n![x](https://evil.example/a.png)` }, U).some((m) => m.includes('luar')));
});

test('submissionToPostFields + postDocument: ugc, gambar utama, penulis', () => {
  const row = {
    title: 'Judul Tulisan', slug: 'judul-tulisan', excerpt: 'Ringkas', body: `isi ${kata(60)}`, categories: [CAT],
    tags: ['a'], tldr: [], main_image_alt: 'alt gambar', ai_image: true,
  };
  const f = submissionToPostFields(row, {
    authorId: 'author-c0000000-0000-4000-8000-000000000001',
    assetId: 'image-0123456789abcdef0123456789abcdef01234567-1600x900-webp', ugc: true,
  });
  assert.equal(f.ugc, true);
  assert.equal(f.mainImage?.alt, 'alt gambar');
  assert.ok(f.mainImage?.caption.includes('AI'));
  const doc: any = postDocument('post-11111111-2222-3333-4444-555555555555', f, { previousSlugs: [], publishedAt: null, updatedAt: null });
  assert.equal(doc.ugc, true);
  assert.equal(doc.author._ref, 'author-c0000000-0000-4000-8000-000000000001');
  assert.equal(fieldsFromDocument(doc).ugc, true);
  assert.equal(cleanPostFields({}).ugc, false, 'tulisan tim tidak bertanda ugc');
});

test('cleanProfile: validasi nama, slug, dan tautan', () => {
  assert.ok(cleanProfile({ displayName: 'A' }).errors.length > 0);
  const r = cleanProfile({ displayName: ' Budi  Santoso ', bio: 'Penulis', links: ['https://x.com/budi', 'http://salah.id', 'javascript:alert(1)'] });
  assert.equal(r.value?.slug, 'budi-santoso');
  assert.deepEqual(r.value?.links, ['https://x.com/budi']);
  assert.ok(cleanProfile({ displayName: 'Budi', slug: 'ab' }).errors.length > 0);
});

test('discordFromUser membaca identitas dari server', () => {
  const user = { identities: [
    { provider: 'google', id: '999', identity_data: {} },
    { provider: 'discord', id: '123456789012345678', identity_data: { full_name: 'budi#0', custom_claims: { global_name: 'Budi' } } },
  ] };
  assert.deepEqual(discordFromUser(user), { id: '123456789012345678', username: 'Budi' });
  assert.equal(discordFromUser({ identities: [{ provider: 'google' }] }), null);
  assert.equal(discordFromUser({ identities: [{ provider: 'discord', id: 'abc' }] }), null);
  assert.equal(discordFromUser(null), null);
});

test('reviewEmail: alasan, tautan, dan escape HTML', () => {
  const t = reviewEmail({ kind: 'tolak', writerName: 'Budi <b>', title: 'Judul "X"', reason: 'Kurang <script>contoh</script>', url: 'https://vanillate.id/blog/dashboard/' });
  assert.ok(t.subject.includes('perlu direvisi'));
  assert.ok(!t.html.includes('<script>'));
  assert.ok(t.html.includes('&lt;script&gt;'));
  assert.ok(t.text.includes('Kurang <script>contoh</script>'), 'versi teks tidak di-escape tetapi bukan HTML');
  assert.ok(t.html.includes('Buka dasbor penulis'));
  const ok = reviewEmail({ kind: 'setujui', writerName: 'Budi', title: 'Judul', url: 'https://vanillate.id/blog/judul/' });
  assert.ok(ok.subject.includes('terbit'));
  assert.ok(!ok.html.includes('Alasan dari tim'));
});

import { previewBody, quickChecks, statusMeta, tagsFromText, tldrFromText } from '../src/lib/blog/writer-model.ts';

test('writer-model: status, tag, poin penting, pratinjau, petunjuk', () => {
  assert.equal(statusMeta('ditolak').label, 'Perlu revisi');
  assert.equal(statusMeta('aneh').label, 'Draf');
  assert.deepEqual(tagsFromText('Satu, satu,\ndua ,, '), ['Satu', 'dua']);
  assert.deepEqual(tldrFromText('- a\n\n• b\nc'), ['a', 'b', 'c']);
  assert.equal(previewBody(`![x](blogimg:${P1} "ket")`, { [P1]: 'https://s/u' }), '![x](https://s/u "ket")');
  assert.equal(previewBody('![x](blogimg:hilang.webp)', {}), '![x](blogimg:hilang.webp)');
  const bad = quickChecks({ title: 'x', body: 'a b', excerpt: '', mainImagePath: null, mainImageAlt: '', categories: [] });
  assert.ok(bad.every((h) => !h.ok));
  const good = quickChecks({ title: 'Judul bagus', body: kata(60), excerpt: 'r', mainImagePath: P1, mainImageAlt: 'alt', categories: [CAT] });
  assert.ok(good.every((h) => h.ok));
});
