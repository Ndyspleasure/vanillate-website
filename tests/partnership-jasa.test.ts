import test from 'node:test';
import assert from 'node:assert/strict';
import { normalisasiJasa, buildJasaMessage } from '../src/data/partnership-jasa.ts';
import seed from '../src/data/synced/partnership-jasa.json' with { type: 'json' };

test('isi awal: hosting Rp5.000/bulan dan pembuatan bot Rp30.000', () => {
  const k = normalisasiJasa(seed.content);
  assert.equal(k.packages.length, 2);
  assert.equal(k.packages[0].price, 5000);
  assert.equal(k.packages[0].unit, 'bulan');
  assert.deepEqual(k.packages[0].specs.map((s) => s.value), ['512 MB', '1 GB', '35%', '99,9%']);
  assert.equal(k.packages[1].price, 30000);
});

test('isi kosong atau rusak tidak melempar dan memberi bawaan aman', () => {
  for (const bad of [null, undefined, 'x', 5, [], { packages: 'x', faq: 3 }]) {
    const k = normalisasiJasa(bad);
    assert.deepEqual(k.packages, []);
    assert.deepEqual(k.faq, []);
    assert.ok(k.hero.title);
  }
});

test('harga kosong menjadi null, nol tetap nol, bukan angka dibuang', () => {
  const k = normalisasiJasa({ packages: [
    { name: 'A', price: '' }, { name: 'B', price: 0 }, { name: 'C', price: 'abc' }, { name: '', price: 1 },
  ] });
  assert.deepEqual(k.packages.map((p) => p.price), [null, 0, null]);
});

test('spesifikasi tanpa label atau nilai dibuang, ogImage berbahaya dikosongkan', () => {
  const k = normalisasiJasa({
    packages: [{ name: 'A', specs: [{ label: 'RAM', value: '' }, { label: 'CPU', value: '35%' }] }],
    seo: { ogImage: 'javascript:alert(1)' },
  });
  assert.deepEqual(k.packages[0].specs, [{ label: 'CPU', value: '35%' }]);
  assert.equal(k.seo.ogImage, '');
});

test('pesan WhatsApp memuat nama paket tanpa harga', () => {
  const m = buildJasaMessage('Hosting Bot');
  assert.match(m, /Jasa\s+: Hosting Bot/);
  assert.doesNotMatch(m, /Rp/);
  assert.doesNotMatch(buildJasaMessage(''), /Jasa\s+:/);
});
