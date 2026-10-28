// Tes model & renderer blog (src/lib/blog/model.ts, src/lib/blog/markdown.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  readingMinutes,
  renderBlogMarkdown,
  sanityImageSize,
  sanityImageUrl,
  sanitySrcset,
  slugify,
  truncate,
} from '../src/lib/blog/markdown.ts';
import {
  blogPostingJsonLd,
  buildBlogData,
  canonicalUrl,
  jsonLdString,
  listPath,
  postsForProduct,
  relatedPosts,
} from '../src/lib/blog/model.ts';

const IMG = 'https://cdn.sanity.io/images/62jp784l/production/0123abcd-1600x900.jpg';

const raw = (over: Record<string, unknown> = {}) => ({
  id: 'post.a',
  title: 'Cara main Sambung Kata',
  slug: 'cara-main-sambung-kata',
  body: '## Aturan dasar\n\nSambung kata dari huruf terakhir.',
  publishedAt: '2026-10-01T03:00:00Z',
  ...over,
});

test('slugify: huruf kecil, aksen dibuang, & jadi "dan"', () => {
  assert.equal(slugify('Tips & Trik Main Sambung Kata!'), 'tips-dan-trik-main-sambung-kata');
  assert.equal(slugify('Café Déjà vu'), 'cafe-deja-vu');
  assert.equal(slugify('   '), '');
});

test('renderBlogMarkdown: heading jadi h2/h3 ber-id unik + daftar isi', () => {
  const { html, headings } = renderBlogMarkdown('# Judul\n\n## Pendahuluan\n\n### Detail\n\n## Pendahuluan');
  assert.match(html, /<h2 id="judul"/);
  assert.match(html, /<h3 id="detail"/);
  assert.match(html, /<h2 id="pendahuluan-2"/);
  assert.equal(html.includes('<h1'), false);
  assert.deepEqual(headings.map((h) => h.id), ['judul', 'pendahuluan', 'detail', 'pendahuluan-2']);
});

test('renderBlogMarkdown: HTML mentah & javascript: tidak lolos', () => {
  const { html } = renderBlogMarkdown('<script>alert(1)</script>\n\n[klik](javascript:alert(1)) ![x](javascript:1)\n\n<img src=x onerror=alert(1)>');
  assert.equal(html.includes('<script'), false);
  assert.equal(html.includes('<img src=x'), false);
  assert.equal(html.includes('javascript:'), false);
  assert.match(html, /&lt;script&gt;/);
});

test('renderBlogMarkdown: penanda miring tidak menyusup ke href', () => {
  const { html } = renderBlogMarkdown('[a](https://x.com/_a_b_/c*d*) dan *miring* serta `kode *bukan*`');
  assert.match(html, /href="https:\/\/x\.com\/_a_b_\/c\*d\*"/);
  assert.match(html, /<em>miring<\/em>/);
  assert.match(html, /<code[^>]*>kode \*bukan\*<\/code>/);
});

test('renderBlogMarkdown: tautan eksternal target _blank, internal tidak', () => {
  const { html } = renderBlogMarkdown('[luar](https://google.com) [dalam](/products/sambung-kata) [vanillate](https://vanillate.id/faq)');
  assert.match(html, /href="https:\/\/google\.com"[^>]*target="_blank" rel="noopener"/);
  assert.match(html, /href="\/products\/sambung-kata" class="[^"]*">dalam/);
  assert.match(html, /href="https:\/\/vanillate\.id\/faq" class="[^"]*">vanillate/);
});

test('renderBlogMarkdown: gambar Sanity jadi figure + srcset + ukuran', () => {
  const { html } = renderBlogMarkdown(`![Papan permainan](${IMG} "Tampilan ronde pertama")`);
  assert.match(html, /<figure/);
  assert.match(html, /srcset="[^"]*w=480[^"]*480w/);
  assert.match(html, /width="1600" height="900"/);
  assert.match(html, /<figcaption[^>]*>Tampilan ronde pertama<\/figcaption>/);
  assert.match(html, /alt="Papan permainan"/);
});

test('renderBlogMarkdown: callout, tabel, list, token produk', () => {
  const md = '> [!TIP] Mulai dari kata pendek.\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n- satu\n- dua\n\n3. tiga\n4. empat\n\n{{produk:sambung-kata}}';
  const { html } = renderBlogMarkdown(md, { blockToken: (n, a) => (n === 'produk' ? `<div data-produk="${a}"></div>` : null) });
  assert.match(html, /<aside[^>]*>.*Tips.*Mulai dari kata pendek/s);
  assert.match(html, /<table/);
  assert.match(html, /<ul/);
  assert.match(html, />03<\/span>/);
  assert.match(html, /data-produk="sambung-kata"/);
});

test('gambar Sanity: ukuran dari nama file, URL CDN, srcset tidak melebihi asli', () => {
  assert.deepEqual(sanityImageSize(IMG), { width: 1600, height: 900 });
  assert.equal(sanityImageUrl(IMG, { w: 800 }), `${IMG}?w=800&fit=max&q=80&auto=format`);
  assert.equal(sanityImageUrl('https://contoh.com/a.jpg', { w: 800 }), 'https://contoh.com/a.jpg');
  const kecil = 'https://cdn.sanity.io/images/62jp784l/production/ab-600x400.png';
  assert.deepEqual(sanitySrcset(kecil).split(', ').map((s) => s.split(' ')[1]), ['480w', '600w']);
});

test('readingMinutes & truncate', () => {
  assert.equal(readingMinutes('kata '.repeat(1000)), 5);
  assert.equal(readingMinutes(''), 1);
  assert.equal(truncate('satu dua tiga empat lima', 12), 'satu dua…');
});

test('buildBlogData: draft, tanpa slug, & terjadwal dibuang; terbaru di atas', () => {
  const now = new Date('2026-10-10T00:00:00Z');
  const data = buildBlogData({
    posts: [
      raw(),
      raw({ id: 'drafts.post.b', slug: 'draft' }),
      raw({ id: 'post.c', slug: 'Bukan Slug' }),
      raw({ id: 'post.d', slug: 'nanti', publishedAt: '2026-12-01T00:00:00Z' }),
      raw({ id: 'post.e', slug: 'baru', publishedAt: '2026-10-05T00:00:00Z' }),
    ],
  }, now);
  assert.deepEqual(data.posts.map((p) => p.slug), ['baru', 'cara-main-sambung-kata']);
  assert.ok(data.posts[0].excerpt.length > 0, 'excerpt otomatis dari isi');
});

test('buildBlogData: penulis, kategori, tag, dan redirect slug lama', () => {
  const data = buildBlogData({
    authors: [{ id: 'author.andi', name: 'Andi', slug: 'andi', links: ['https://x.com/andi', 'javascript:1'] }],
    categories: [{ id: 'cat.panduan', title: 'Panduan', slug: 'panduan', sort: 1 }],
    posts: [
      raw({
        authorId: 'author.andi',
        categoryIds: ['cat.panduan', 'cat.hilang'],
        tags: ['Tips Main', 'tips main', 'Pemula'],
        previousSlugs: ['cara-bermain', 'cara-main-sambung-kata', 'lain'],
      }),
      raw({ id: 'post.lain', slug: 'lain' }),
    ],
  });
  const p = data.posts.find((x) => x.id === 'post.a')!;
  assert.equal(p.author?.name, 'Andi');
  assert.deepEqual(p.author?.links, ['https://x.com/andi']);
  assert.deepEqual(p.categories.map((c) => c.slug), ['panduan']);
  assert.deepEqual(p.tags.map((t) => t.slug), ['tips-main', 'pemula']);
  // "lain" dipakai artikel aktif → tidak boleh jadi redirect
  assert.deepEqual(data.redirects, [{ from: 'cara-bermain', to: 'cara-main-sambung-kata' }]);
  assert.deepEqual(data.tags.map((t) => [t.slug, t.count]), [['pemula', 1], ['tips-main', 1]]);
});

test('relatedPosts: manual dulu, lalu kemiripan, lalu terbaru', () => {
  const data = buildBlogData({
    categories: [{ id: 'c1', title: 'A', slug: 'a' }, { id: 'c2', title: 'B', slug: 'b' }],
    posts: [
      raw({ id: 'p1', slug: 'p1', categoryIds: ['c1'], tags: ['x'], relatedPostIds: ['p4'], publishedAt: '2026-10-01T00:00:00Z' }),
      raw({ id: 'p2', slug: 'p2', categoryIds: ['c1'], publishedAt: '2026-10-02T00:00:00Z' }),
      raw({ id: 'p3', slug: 'p3', tags: ['x'], publishedAt: '2026-10-03T00:00:00Z' }),
      raw({ id: 'p4', slug: 'p4', categoryIds: ['c2'], publishedAt: '2026-09-01T00:00:00Z' }),
      raw({ id: 'p5', slug: 'p5', publishedAt: '2026-10-09T00:00:00Z' }),
    ],
  });
  const p1 = data.posts.find((p) => p.id === 'p1')!;
  assert.deepEqual(relatedPosts(p1, data.posts).map((p) => p.id), ['p4', 'p2', 'p3']);
  assert.deepEqual(relatedPosts(p1, data.posts, 5).map((p) => p.id), ['p4', 'p2', 'p3', 'p5']);
});

test('postsForProduct & listPath', () => {
  const data = buildBlogData({ posts: [raw({ relatedProducts: ['sambung-kata', 'BUKAN SLUG'] })] });
  assert.equal(postsForProduct('sambung-kata', data.posts).length, 1);
  assert.deepEqual(data.posts[0].relatedProducts, ['sambung-kata']);
  assert.equal(listPath(1), '/blog');
  assert.equal(listPath(3), '/blog/halaman/3');
});

test('canonicalUrl: garis miring penutup kecuali berkas', () => {
  assert.equal(canonicalUrl('https://vanillate.id', '/blog/a'), 'https://vanillate.id/blog/a/');
  assert.equal(canonicalUrl('https://vanillate.id', '/blog/a/'), 'https://vanillate.id/blog/a/');
  assert.equal(canonicalUrl('https://vanillate.id', '/blog/rss.xml'), 'https://vanillate.id/blog/rss.xml');
});

test('JSON-LD BlogPosting lengkap & aman dari </script>', () => {
  const data = buildBlogData({
    authors: [{ id: 'a', name: 'Andi', slug: 'andi' }],
    posts: [raw({ authorId: 'a', title: 'Judul </script><script>x' })],
  });
  const site = { url: 'https://vanillate.id', name: 'Vanillate Studio', logo: 'https://vanillate.id/logo.png' };
  const ld = blogPostingJsonLd(data.posts[0], site, 'https://vanillate.id/og.png');
  assert.equal(ld['@type'], 'BlogPosting');
  assert.equal(ld.url, 'https://vanillate.id/blog/cara-main-sambung-kata/');
  assert.deepEqual((ld.author as any).url, 'https://vanillate.id/blog/penulis/andi/');
  assert.equal(jsonLdString(ld).includes('</script>'), false);
});

// ─── Editor CMS (src/lib/blog/editor.ts) ─────────────────────────────────────
import { isoKeLokal, lokalKeIso, rapikanTulisanAi, seoChecklist, skorSeo } from '../src/lib/blog/editor.ts';

const draft = (over: Record<string, unknown> = {}) => ({
  title: 'Cara Main Sambung Kata di Discord untuk Pemula',
  slug: '',
  excerpt: 'x'.repeat(130),
  body: `## Satu\n\n${'kata '.repeat(320)}\n\n## Dua\n\nLihat [produk](/products/sambung-kata).`,
  tldr: ['a'],
  faqs: [{ q: 'q', a: 'a' }],
  categoryIds: ['c'],
  mainImage: { alt: 'Papan' },
  seo: { title: '', description: '' },
  ...over,
});

test('seoChecklist: artikel lengkap semua ok, skor 100', () => {
  const cek = seoChecklist(draft());
  assert.deepEqual(cek.filter((c) => c.status !== 'ok').map((c) => c.label), []);
  assert.equal(skorSeo(cek), 100);
});

test('seoChecklist: syarat terbit jadi "bad", saran jadi "warn"', () => {
  const cek = seoChecklist(draft({ title: 'Hai', excerpt: '', body: 'pendek', mainImage: { alt: '' }, tldr: [], faqs: [], categoryIds: [] }));
  const s = Object.fromEntries(cek.map((c) => [c.label, c.status]));
  assert.equal(s['Judul'], 'bad');
  assert.equal(s['Meta description'], 'bad');
  assert.equal(s['Panjang isi'], 'bad');
  assert.equal(s['Featured image'], 'bad');
  assert.equal(s['Tautan internal'], 'warn');
  assert.equal(s['Kategori'], 'warn');
  assert.ok(skorSeo(cek) < 50);
});

test('rapikanTulisanAi: judul, bullet, heading, spasi', () => {
  const r = rapikanTulisanAi('# Judul Dari AI\n\n**Pendahuluan**\n\nIsi.\n\n\n\n### Bagian\n\n• satu\n• dua   ', '');
  assert.equal(r.title, 'Judul Dari AI');
  assert.equal(r.body, '## Pendahuluan\n\nIsi.\n\n### Bagian\n\n- satu\n- dua');
  assert.ok(r.changes.length >= 3);
  const r2 = rapikanTulisanAi('### A\n\nteks\n\n#### B', 'Sudah ada');
  assert.equal(r2.title, null);
  assert.equal(r2.body, '## A\n\nteks\n\n### B');
});

test('konversi tanggal datetime-local bolak-balik', () => {
  const iso = '2026-10-28T03:15:00.000Z';
  assert.equal(lokalKeIso(isoKeLokal(iso)), iso);
  assert.equal(lokalKeIso(''), null);
  assert.equal(isoKeLokal(null), '');
});
