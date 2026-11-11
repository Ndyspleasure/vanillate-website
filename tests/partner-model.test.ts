import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays, buildReportPreview, clip, formatDateId, hasErrors, loginError, passwordProblem, priceText,
  rpcError, rupiah, statusMeta, todayWib, totalText, usernameProblem, validateOrder,
  type CatalogProduct, type OrderInput,
} from '../src/lib/partner/model.ts';

const DM: CatalogProduct = { key: 'broadcast_dm', name: 'Broadcast via DM', price: 150, priceUnit: 'per dm', unit: 'Pemain', minQuantity: 100 };
const base: OrderInput = { productKey: 'broadcast_dm', quantity: '100', brandName: 'Server Uji', inviteUrl: '', scheduledFor: '', adText: '', note: '' };

test('rupiah memakai titik ribuan', () => {
  assert.equal(rupiah(150), 'Rp 150');
  assert.equal(rupiah(15000), 'Rp 15.000');
  assert.equal(rupiah(1500000), 'Rp 1.500.000');
  assert.equal(priceText(DM), 'Rp 150 per dm');
  assert.equal(priceText({ price: null, priceUnit: '' }), 'Harga belum ditentukan');
  assert.equal(totalText(150, 100), 'Rp 15.000');
  assert.equal(totalText(null, 100), 'Harga belum ditentukan');
});

test('tanggal WIB dan penambahan hari', () => {
  assert.equal(todayWib(new Date('2026-11-11T20:00:00Z')), '2026-11-12');
  assert.equal(todayWib(new Date('2026-11-11T10:00:00Z')), '2026-11-11');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(formatDateId('2026-11-11'), '11 November 2026');
  assert.equal(formatDateId('x'), '');
});

test('validateOrder: jalur sah', () => {
  assert.equal(hasErrors(validateOrder(base, DM, '2026-11-11')), false);
});

test('validateOrder: jumlah, brand, link, tanggal, panjang', () => {
  const e = validateOrder({ ...base, quantity: '99', brandName: ' ', inviteUrl: 'http://x', scheduledFor: '2026-11-10', adText: 'a'.repeat(2001), note: 'b'.repeat(1001) }, DM, '2026-11-11');
  assert.match(e.quantity!, /minimal 100 pemain/);
  assert.ok(e.brandName && e.inviteUrl && e.scheduledFor && e.adText && e.note);
  assert.ok(validateOrder({ ...base, quantity: '1.5' }, DM, '2026-11-11').quantity);
  assert.ok(validateOrder({ ...base, quantity: '' }, DM, '2026-11-11').quantity);
  assert.ok(validateOrder({ ...base, scheduledFor: '2028-01-01' }, DM, '2026-11-11').scheduledFor);
  assert.ok(validateOrder({ ...base, inviteUrl: 'https://a b' }, DM, '2026-11-11').inviteUrl);
  assert.ok(validateOrder(base, null, '2026-11-11').productKey);
});

test('status: nilai tak dikenal jatuh ke dicatat', () => {
  assert.equal(statusMeta('berjalan').label, 'Berjalan');
  assert.equal(statusMeta('aneh').label, 'Dicatat');
});

test('pratinjau kartu laporan', () => {
  const p = buildReportPreview({ partnerName: 'Mitra Satu', product: DM, input: { ...base, scheduledFor: '2026-11-20', adText: 'Halo **dunia**', inviteUrl: 'https://discord.gg/x' }, orderId: 7 });
  assert.equal(p.title, 'Pesanan partner baru #7');
  const f = Object.fromEntries(p.fields.map((x) => [x.name, x.value]));
  assert.equal(f['Total'], 'Rp 15.000');
  assert.equal(f['Tanggal tayang'], '20 November 2026');
  assert.equal(f['Jumlah'], '100 pemain');
  assert.equal(p.ad, 'Halo **dunia**');
  const kosong = buildReportPreview({ partnerName: '', product: null, input: { ...base, productKey: '', quantity: '', brandName: '' } });
  assert.equal(kosong.fields[1].value, 'belum dipilih');
  assert.equal(kosong.title, 'Pesanan partner baru');
});

test('clip memotong dengan elipsis', () => {
  assert.equal(clip('abcdef', 4), 'abc…');
  assert.equal(clip(' ab ', 10), 'ab');
});

test('username dan password', () => {
  assert.equal(usernameProblem('mitra.satu'), null);
  assert.ok(usernameProblem('AB'));
  assert.ok(usernameProblem('mitra..satu'));
  assert.equal(usernameProblem('  Mitra '), null);
  assert.ok(passwordProblem('pendek', 'x'));
  assert.ok(passwordProblem('12345678', 'x'));
  assert.ok(passwordProblem('xxmitraxx', 'mitra'));
  assert.equal(passwordProblem('rahasia-kuat-1', 'mitra'), null);
});

test('pesan galat tidak membocorkan detail teknis', () => {
  assert.match(loginError('Invalid login credentials'), /WhatsApp/);
  assert.match(loginError('weird'), /Gagal masuk/);
  assert.equal(rpcError('Jumlah minimal 100 Pemain.'), 'Jumlah minimal 100 Pemain.');
  assert.equal(rpcError('permission denied for table x'), 'Gagal menyimpan pesanan. Coba lagi.');
});
