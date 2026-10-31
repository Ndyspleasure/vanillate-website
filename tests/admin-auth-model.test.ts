// Tes aturan login admin lewat kode email (src/lib/admin-auth-model.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bacaHashAuth, normalisasiKode, pesanKirimKode, validasiPasswordBaru } from '../src/lib/admin-auth-model.ts';

test('normalisasiKode menerima 6 sampai 10 digit, spasi & tanda hubung dibuang', () => {
  assert.equal(normalisasiKode('123456'), '123456');
  assert.equal(normalisasiKode(' 123 456 '), '123456');
  assert.equal(normalisasiKode('123-456'), '123456');
  assert.equal(normalisasiKode('1234567890'), '1234567890');
});

test('normalisasiKode menolak kode kependekan, kepanjangan, atau berhuruf', () => {
  assert.equal(normalisasiKode('12345'), null);
  assert.equal(normalisasiKode('12345678901'), null);
  assert.equal(normalisasiKode('12a456'), null);
  assert.equal(normalisasiKode(''), null);
});

test('validasiPasswordBaru', () => {
  assert.match(validasiPasswordBaru('pendek', 'pendek')!, /minimal 8/);
  assert.match(validasiPasswordBaru(' rahasia123', ' rahasia123')!, /spasi/);
  assert.match(validasiPasswordBaru('rahasia123', 'rahasia124')!, /belum sama/);
  assert.equal(validasiPasswordBaru('rahasia123', 'rahasia123'), null);
});

test('pesanKirimKode: batas kirim diberi tahu, error akun disamarkan', () => {
  assert.deepEqual(pesanKirimKode(null), { ok: true });
  assert.equal(pesanKirimKode({ status: 429, message: 'x' }).ok, false);
  assert.equal(pesanKirimKode({ code: 'over_email_send_rate_limit' }).ok, false);
  assert.equal(pesanKirimKode({ status: 500, message: 'Error sending magic link email' }).ok, false);
  // Email tidak terdaftar & signup dimatikan: tetap "terkirim".
  assert.deepEqual(pesanKirimKode({ status: 422, message: 'Signups not allowed for otp' }), { ok: true });
  assert.deepEqual(pesanKirimKode({ status: 400, message: 'User not found' }), { ok: true });
});

test('bacaHashAuth: link recovery & magiclink dari email', () => {
  assert.deepEqual(bacaHashAuth('#access_token=a&expires_in=3600&refresh_token=r&token_type=bearer&type=recovery'), {
    kind: 'sesi', type: 'recovery', accessToken: 'a', refreshToken: 'r',
  });
  assert.equal((bacaHashAuth('#access_token=a&refresh_token=r&type=magiclink') as { type: string }).type, 'magiclink');
});

test('bacaHashAuth: link kedaluwarsa & fragmen lain', () => {
  const e = bacaHashAuth('#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid');
  assert.equal(e?.kind, 'error');
  assert.match((e as { pesan: string }).pesan, /kedaluwarsa/);
  assert.equal(bacaHashAuth(''), null);
  assert.equal(bacaHashAuth('#bagian-lain'), null);
  assert.equal(bacaHashAuth('#access_token=a'), null);
});
