// Tes iklan blog (src/lib/blog/ads.ts): mati tanpa ID, ads.txt, sisipan iklan tengah.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ADSENSE, adHtml, adsenseClient, adsTxt, withInArticleAd } from '../src/lib/blog/ads.ts';

const aktif = {
  client: 'ca-pub-1234567890123456',
  slots: { inArticle: '1111111111', afterArticle: '2222222222' },
  inArticleBeforeH2: 3,
};
const isi = (n: number) => Array.from({ length: n }, (_, i) => `<h2 id="h${i}">H${i}</h2><p>isi</p>`).join('');

test('ID di repo valid (iklan aktif)', () => {
  assert.equal(adsenseClient(ADSENSE), ADSENSE.client);
  assert.notEqual(adHtml('inArticle', ADSENSE), '');
  assert.notEqual(adHtml('afterArticle', ADSENSE), '');
});

test('ID kosong: iklan mati, ads.txt hanya komentar', () => {
  const kosong = { client: '', slots: { inArticle: '', afterArticle: '' }, inArticleBeforeH2: 3 };
  assert.equal(adsenseClient(kosong), null);
  assert.equal(adHtml('afterArticle', kosong), '');
  assert.equal(withInArticleAd(isi(5), kosong), isi(5));
  assert.match(adsTxt(kosong), /^#/);
});

test('ID tidak valid dianggap mati', () => {
  assert.equal(adsenseClient({ ...aktif, client: 'pub-123' }), null);
  assert.equal(adHtml('inArticle', { ...aktif, slots: { ...aktif.slots, inArticle: 'abc"' } }), '');
});

test('ads.txt memakai ID publisher tanpa awalan ca-', () => {
  assert.equal(adsTxt(aktif), 'google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n');
});

test('unit iklan memuat client, slot, dan format yang sesuai', () => {
  const tengah = adHtml('inArticle', aktif);
  assert.match(tengah, /data-ad-client="ca-pub-1234567890123456"/);
  assert.match(tengah, /data-ad-slot="1111111111"/);
  assert.match(tengah, /data-ad-layout="in-article"/);
  assert.match(adHtml('afterArticle', aktif), /data-ad-format="auto"/);
  // Kelas pengait CSS yang menyembunyikan kotak iklan kosong / diblokir.
  assert.match(tengah, /<aside class="blog-iklan /);
});

test('iklan tengah disisipkan tepat sebelum H2 ke-3', () => {
  const out = withInArticleAd(isi(5), aktif);
  assert.equal(out.match(/adsbygoogle/g)?.length, 1);
  assert.ok(out.indexOf('adsbygoogle') > out.indexOf('id="h1"'));
  assert.ok(out.indexOf('adsbygoogle') < out.indexOf('id="h2"'));
});

test('artikel dengan subjudul kurang dari 3 tidak diberi iklan tengah', () => {
  assert.equal(withInArticleAd(isi(2), aktif), isi(2));
});
