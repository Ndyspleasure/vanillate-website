import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseUserIds, countDuplicates, checkBulk, MAX_BULK_USERS } from '../src/lib/wallet-bulk.ts';

const A = '1181499656765706280';
const B = '481103128331026452';
const C = '1562725978344792155';

test('parseUserIds: ambil kolom ID dari CSV, abaikan angka pendek dan tanggal, buang ganda', () => {
  const csv = `peringkat,discord_id,nama,skor,terakhir_aktif\n1,${A},satu,131.6,2026-11-24T00:00:00.000Z\n2,${B},dua 2026,93.2,2026-11-22T04:33:36.127Z\n3,${C},tiga,82,x\n4,${A},lagi,1,x`;
  assert.deepEqual(parseUserIds(csv), [A, B, C]);
  assert.equal(countDuplicates(csv), 1);
  assert.deepEqual(parseUserIds(`<@${A}>, ${B}\n${C}`), [A, B, C]);
  assert.deepEqual(parseUserIds('12345678901234567890123'), []);
});

test('checkBulk: batas sama dengan bot', () => {
  assert.equal(checkBulk([A, B], 1000, 'Hadiah pemain teraktif').total, 2000);
  assert.ok(checkBulk([A, B], 1000, 'Hadiah pemain teraktif').ok);
  assert.match(checkBulk([], 1000, 'alasan').error!, /Belum ada/);
  const many = Array.from({ length: MAX_BULK_USERS + 1 }, (_, i) => String(1e17 + i));
  assert.match(checkBulk(many, 1, 'alasan').error!, /Maksimal 200/);
  assert.match(checkBulk(many.slice(0, 101), 10_000, 'alasan').error!, /melebihi batas/);
  assert.match(checkBulk([A], 1.5, 'alasan').error!, /bulat/);
  assert.match(checkBulk([A], 10, 'ok').error!, /Alasan wajib/);
});

test('teks pengguna tanpa tanda pisah', () => {
  for (const e of [checkBulk([], 1, 'x').error, checkBulk([A], 0, 'alasan').error]) assert.doesNotMatch(e!, /[—–]| - /);
});
