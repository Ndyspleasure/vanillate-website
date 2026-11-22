// Tes pemakaian ulang hasil perintah baca-saja read.* (src/lib/cms-read/reuse.ts, HO-037).
//   node --experimental-strip-types --test tests/cms-read-reuse.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { READ_TYPE, REUSE_MS, bersihkanHasil, hasilSegar } from '../src/lib/cms-read/reuse.ts';

const now = Date.parse('2026-11-22T03:00:00Z');
const iso = (msLalu: number) => new Date(now - msLalu).toISOString();

test('tipe perintah serverhub sama dengan registry bot (read.serverhub)', () => {
  assert.equal(READ_TYPE.serverhub, 'read.serverhub');
  assert.ok(READ_TYPE.serverhub.startsWith('read.'), 'viewer hanya boleh tipe berawalan read.');
});

test('hasil done yang masih segar dipakai ulang', () => {
  const hasil = hasilSegar([{ status: 'done', result: { a: 1 }, processed_at: iso(10_000) }], now);
  assert.deepEqual(hasil, { a: 1 });
});

test('hasil lebih tua dari 60 detik tidak dipakai', () => {
  assert.equal(hasilSegar([{ status: 'done', result: { a: 1 }, processed_at: iso(REUSE_MS + 1) }], now), null);
  assert.deepEqual(hasilSegar([{ status: 'done', result: { a: 1 }, processed_at: iso(REUSE_MS - 1) }], now), { a: 1 });
});

test('baris pending, error, atau tanpa hasil dilewati; hasil done lebih lama yang masih segar tetap dipakai', () => {
  const rows = [
    { status: 'pending', result: null, processed_at: null },
    { status: 'error', result: null, processed_at: iso(2_000) },
    { status: 'done', result: { a: 2 }, processed_at: iso(20_000) },
  ];
  assert.deepEqual(hasilSegar(rows, now), { a: 2 });
  assert.equal(hasilSegar(rows.slice(0, 2), now), null);
  assert.equal(hasilSegar([], now), null);
});

test('hasil bukan objek atau waktu tidak valid ditolak; jam sedikit mendahului server ditoleransi 5 detik', () => {
  assert.equal(hasilSegar([{ status: 'done', result: [1], processed_at: iso(1_000) }], now), null);
  assert.equal(hasilSegar([{ status: 'done', result: 'x', processed_at: iso(1_000) }], now), null);
  assert.equal(hasilSegar([{ status: 'done', result: { a: 1 }, processed_at: 'bukan tanggal' }], now), null);
  assert.deepEqual(hasilSegar([{ status: 'done', result: { a: 1 }, processed_at: iso(-4_000) }], now), { a: 1 });
  assert.equal(hasilSegar([{ status: 'done', result: { a: 1 }, processed_at: iso(-6_000) }], now), null);
});

test('bersihkanHasil membuang kunci cached tanpa mengubah sisanya', () => {
  assert.deepEqual(bersihkanHasil({ cached: true, generated_at: 5, verification: {} }), { generated_at: 5, verification: {} });
});
