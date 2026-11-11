import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adPreviewHtml } from '../src/lib/partner/render.ts';

test('pratinjau iklan: bagian lengkap dan aman', () => {
  const h = adPreviewHtml({
    title: 'Judul <b>x</b>', text: '**tebal** <img src=x onerror=alert(1)>', footer: 'Foot <script>',
    imageUrl: 'https://cdn.id/a.png', buttons: [{ label: 'Gabung <i>', url: 'https://discord.gg/x' }],
  });
  assert.match(h, /Judul &lt;b&gt;x&lt;\/b&gt;/);
  assert.match(h, /<strong>tebal<\/strong>/);
  assert.ok(!/<img src=x/.test(h) && !/<script/.test(h) && !/<i>/.test(h));
  assert.match(h, /referrerpolicy="no-referrer"/);
  assert.match(h, /Gabung &lt;i&gt;/);
});

test('pratinjau iklan: URL non-https dibuang, kosong memberi petunjuk', () => {
  const h = adPreviewHtml({ imageUrl: 'javascript:alert(1)', buttons: [{ label: 'x', url: 'http://x.id' }], text: 'isi' });
  assert.ok(!h.includes('<img') && !h.includes('http://x.id'));
  assert.match(adPreviewHtml({}), /Iklan akan tampil di sini/);
});
