// Tes logika Edge Function partner-admin (supabase/functions/partner-admin/logic.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  allowedOrigin,
  bearerToken,
  createAttemptLimiter,
  emailFor,
  normalizeUsername,
  parseAction,
  passwordProblem,
  validUsername,
} from '../supabase/functions/partner-admin/logic.ts';

const ID = '3f2b8c1e-9d4a-4e6b-8a1c-0d5e7f9a2b34';

test('username: aturan format', () => {
  assert.equal(validUsername('mitra.satu'), true);
  assert.equal(validUsername('ab'), false);
  assert.equal(validUsername('Mitra'), false);
  assert.equal(validUsername('a'.repeat(33)), false);
  assert.equal(validUsername('mitra..satu'), false);
  assert.equal(validUsername('mitra-'), false);
  assert.equal(validUsername('-mitra'), false);
  assert.equal(validUsername('mitra satu'), false);
  assert.equal(validUsername('mitra@x'), false);
  assert.equal(normalizeUsername('  MitraSatu '), 'mitrasatu');
  assert.equal(normalizeUsername(42), '');
});

test('email sintetis memakai domain partner', () => {
  assert.equal(emailFor('mitra'), 'mitra@partner.vanillate.id');
});

test('password: panjang, hanya angka, memuat username', () => {
  assert.equal(passwordProblem('pendek', 'x'), 'Password minimal 8 karakter.');
  assert.match(passwordProblem('a'.repeat(73), 'x')!, /maksimal/);
  assert.match(passwordProblem('12345678', 'x')!, /angka/);
  assert.match(passwordProblem('xxmitrasatuxx', 'mitrasatu')!, /username/);
  assert.equal(passwordProblem('rahasia-kuat-1', 'mitrasatu'), null);
  assert.match(passwordProblem(undefined, 'x')!, /wajib/);
});

test('create: normalisasi dan validasi', () => {
  const r = parseAction({ action: 'create', username: ' Mitra.Satu ', displayName: '  Mitra   Satu ', password: 'rahasia-kuat-1' });
  assert.deepEqual(r, { ok: true, value: { action: 'create', username: 'mitra.satu', displayName: 'Mitra Satu', password: 'rahasia-kuat-1' } });
  assert.equal(parseAction({ action: 'create', username: 'a', displayName: 'x', password: 'rahasia-kuat-1' }).ok, false);
  assert.equal(parseAction({ action: 'create', username: 'mitra', displayName: '', password: 'rahasia-kuat-1' }).ok, false);
  assert.equal(parseAction({ action: 'create', username: 'mitra', displayName: 'x'.repeat(81), password: 'rahasia-kuat-1' }).ok, false);
  assert.equal(parseAction({ action: 'create', username: 'mitra', displayName: 'x', password: 'mitra12345' }).ok, false);
});

test('reset dan delete: ID harus UUID', () => {
  assert.equal(parseAction({ action: 'reset', id: ID, password: 'rahasia-kuat-1' }).ok, true);
  assert.equal(parseAction({ action: 'reset', id: 'x', password: 'rahasia-kuat-1' }).ok, false);
  assert.equal(parseAction({ action: 'reset', id: ID, password: 'pendek' }).ok, false);
  assert.equal(parseAction({ action: 'delete', id: ID }).ok, true);
  assert.equal(parseAction({ action: 'delete', id: "1' or 1=1" }).ok, false);
});

test('change: password baru harus beda dan sah', () => {
  const ok = parseAction({ action: 'change', currentPassword: 'awal-12345', username: 'baru.nama', password: 'rahasia-kuat-1' });
  assert.equal(ok.ok, true);
  assert.equal(parseAction({ action: 'change', currentPassword: 'rahasia-kuat-1', username: 'baru.nama', password: 'rahasia-kuat-1' }).ok, false);
  assert.equal(parseAction({ action: 'change', currentPassword: '', username: 'baru.nama', password: 'rahasia-kuat-1' }).ok, false);
  assert.equal(parseAction({ action: 'change', currentPassword: 'x', username: 'A', password: 'rahasia-kuat-1' }).ok, false);
});

test('aksi tidak dikenal / body kosong ditolak', () => {
  assert.equal(parseAction({ action: 'drop' }).ok, false);
  assert.equal(parseAction(null).ok, false);
  assert.equal(parseAction({ action: '__proto__' }).ok, false);
});

test('bearerToken & allowedOrigin', () => {
  assert.equal(bearerToken('Bearer ' + 'a'.repeat(30)), 'a'.repeat(30));
  assert.equal(bearerToken('Bearer x'), null);
  assert.equal(bearerToken(null), null);
  assert.equal(allowedOrigin('https://vanillate.id', ['https://vanillate.id']), 'https://vanillate.id');
  assert.equal(allowedOrigin('https://jahat.id', ['https://vanillate.id']), null);
});

test('pembatas percobaan: lewat batas ditolak, jendela bergeser', () => {
  let t = 0;
  const l = createAttemptLimiter(3, 1000, () => t);
  assert.equal(l.hit('a'), true);
  assert.equal(l.hit('a'), true);
  assert.equal(l.hit('a'), true);
  assert.equal(l.hit('a'), false);
  assert.equal(l.hit('b'), true);
  t = 1500;
  assert.equal(l.hit('a'), true);
});

test('email kontak: normalisasi, change opsional, aksi email', async () => {
  const { normalizeEmail } = await import('../supabase/functions/partner-admin/logic.ts');
  assert.equal(normalizeEmail('  Nama@Contoh.ID '), 'nama@contoh.id');
  assert.equal(normalizeEmail('bukan-email'), null);
  assert.equal(normalizeEmail('a b@c.id'), null);
  assert.equal(normalizeEmail(5), null);
  const base = { action: 'change', currentPassword: 'awal-12345', username: 'baru.nama', password: 'rahasia-kuat-1' };
  const tanpa = parseAction(base);
  assert.equal(tanpa.ok && (tanpa.value as any).email, null);
  const ada = parseAction({ ...base, email: 'Mitra@Contoh.id' });
  assert.equal(ada.ok && (ada.value as any).email, 'mitra@contoh.id');
  assert.equal(parseAction({ ...base, email: 'salah' }).ok, false);
  assert.equal(parseAction({ action: 'email', email: 'mitra@contoh.id' }).ok, true);
  assert.equal(parseAction({ action: 'email', email: '' }).ok, false);
});
