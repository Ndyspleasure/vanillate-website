import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMail, nextState, secretOk, tanggalId, esc, type NoticeRow } from '../supabase/functions/partner-reminders/logic.ts';

const baris = (over: Partial<NoticeRow> = {}): NoticeRow => ({
  id: 1, kind: 'h5', to_email: 'a@b.id', ends_on: '2026-11-17', attempts: 0,
  service: { label: 'Hosting Bot A', kind: 'hosting_bot', partner_name: 'Mitra Satu', starts_on: '2026-10-18', ends_on: '2026-11-17' },
  ...over,
});

test('tanggalId memformat tanggal Indonesia dan membiarkan masukan aneh', () => {
  assert.equal(tanggalId('2026-11-17'), '17 November 2026');
  assert.equal(tanggalId('2026-01-05'), '5 Januari 2026');
  assert.equal(tanggalId('bukan tanggal'), 'bukan tanggal');
});

test('email H-5 dan habis berisi layanan, tanggal, dan tanpa tanda pisah', () => {
  const a = buildMail(baris(), 'https://vanillate.id/partnership/dashboard/', 'https://wa.me/62')!;
  assert.match(a.subject, /berakhir dalam 5 hari/);
  assert.match(a.html, /Hosting Bot A/);
  assert.match(a.html, /17 November 2026/);
  assert.match(a.html, /wa\.me\/62/);
  const b = buildMail(baris({ kind: 'habis' }), 'https://vanillate.id/x', '')!;
  assert.match(b.subject, /sudah berakhir/);
  for (const m of [a, b]) assert.doesNotMatch(m.subject + m.text, /—|–| - /);
});

test('isi dari database di-escape dan tombol hanya untuk tautan https', () => {
  const m = buildMail(baris({ service: { label: '<img src=x onerror=1>', kind: 'lobby', partner_name: 'A&B', starts_on: '', ends_on: '' } }), 'javascript:alert(1)', '')!;
  assert.doesNotMatch(m.html, /<img/);
  assert.match(m.html, /A&amp;B/);
  assert.doesNotMatch(m.html, /javascript:/);
  assert.doesNotMatch(m.html, /<a /);
});

test('tanpa layanan tidak ada email', () => {
  assert.equal(buildMail(baris({ service: null }), '', ''), null);
});

test('nextState: sukses, gagal berulang sampai failed', () => {
  assert.deepEqual(nextState(0, true, '', 'T'), { status: 'sent', attempts: 1, error: null, sent_at: 'T' });
  assert.equal(nextState(0, false, 'x', 'T').status, 'pending');
  assert.equal(nextState(1, false, 'x', 'T').status, 'pending');
  assert.equal(nextState(2, false, 'x', 'T').status, 'failed');
  assert.equal(nextState(0, false, 'a'.repeat(999), 'T').error!.length, 300);
});

test('secretOk: kosong = tidak diwajibkan, selain itu harus sama persis', () => {
  assert.equal(secretOk('', null), true);
  assert.equal(secretOk('abc', 'abc'), true);
  assert.equal(secretOk('abc', 'abd'), false);
  assert.equal(secretOk('abc', null), false);
  assert.equal(secretOk('abc', 'abcd'), false);
});

test('esc menutup tanda kutip', () => {
  assert.equal(esc(`"'<>&`), '&quot;&#39;&lt;&gt;&amp;');
});
