// Tes model murni Panel Developer (src/lib/dev-panel/model.ts).
// Aturan di sini cermin validasi bot (src/cms/*) — bila bot berubah, tes ini
// mengingatkan agar umpan balik di website ikut diselaraskan.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  describeMedia,
  ageSeconds,
  BULK_ACTIONS,
  canSend,
  chanceTotal,
  countBulkWords,
  estimateMinutes,
  fmtBytes,
  fmtDuration,
  isFinal,
  isOwnerOnly,
  isStale,
  mediaHint,
  mediaKind,
  modeGroup,
  modeLabel,
  parsePollOptions,
  previewHeader,
  progressPct,
  toEpoch,
  validateBroadcast,
  validateChances,
} from '../src/lib/dev-panel/model.ts';

test('peran: sys.* khusus owner, viewer tidak bisa mengirim apa pun', () => {
  assert.equal(isOwnerOnly('sys.bot.restart'), true);
  assert.equal(isOwnerOnly('player.ban'), false);
  assert.equal(canSend('owner', 'sys.db.backup'), true);
  assert.equal(canSend('admin', 'sys.db.backup'), false);
  assert.equal(canSend('admin', 'player.ban'), true);
  assert.equal(canSend('viewer', 'player.view'), false);
  assert.equal(canSend(null, 'player.view'), false);
  // Prefiks harus persis di awal — "xsys." bukan perintah owner.
  assert.equal(canSend('admin', 'xsys.bot.restart'), true);
});

test('isFinal hanya done/error', () => {
  assert.equal(isFinal('done'), true);
  assert.equal(isFinal('error'), true);
  assert.equal(isFinal('processing'), false);
  assert.equal(isFinal('pending'), false);
  assert.equal(isFinal(null), false);
});

test('kesegaran snapshot', () => {
  const now = Date.parse('2026-10-17T10:00:00Z');
  assert.equal(ageSeconds(null, now), null);
  assert.equal(ageSeconds('bukan-tanggal', now), null);
  assert.equal(ageSeconds('2026-10-17T09:59:30Z', now), 30);
  assert.equal(ageSeconds('2026-10-17T10:00:05Z', now), 0, 'jam bot sedikit di depan tidak negatif');
  assert.equal(isStale('2026-10-17T09:59:00Z', now), false);
  assert.equal(isStale('2026-10-17T09:57:00Z', now), true);
  assert.equal(isStale(null, now), true);
});

test('format durasi & ukuran', () => {
  assert.equal(fmtDuration(45), '45 dtk');
  assert.equal(fmtDuration(125), '2 mnt 5 dtk');
  assert.equal(fmtDuration(3725), '1 jam 2 mnt');
  assert.equal(fmtDuration(90000), '1 hr 1 jam');
  assert.equal(fmtDuration(null), '—');
  assert.equal(fmtDuration(Number.NaN), '—');
  assert.equal(fmtBytes(512), '512 B');
  assert.equal(fmtBytes(2048), '2.0 KB');
  assert.equal(fmtBytes(5 * 1048576), '5.0 MB');
  assert.equal(fmtBytes(undefined), '—');
});

test('progressPct dibatasi 0–100 dan null tanpa total', () => {
  assert.equal(progressPct(null), null);
  assert.equal(progressPct({ done: 1 }), null);
  assert.equal(progressPct({ done: 1, total: 4 }), 25);
  assert.equal(progressPct({ done: 9, total: 4 }), 100);
});

test('toEpoch: epoch ms, ISO, dan teks SQLite (UTC)', () => {
  assert.equal(toEpoch(1700000000000), 1700000000000);
  assert.equal(toEpoch('2026-10-17T10:00:00Z'), Date.parse('2026-10-17T10:00:00Z'));
  assert.equal(toEpoch('2026-10-17 10:00:00'), Date.parse('2026-10-17T10:00:00Z'));
  assert.equal(toEpoch(''), null);
  assert.equal(toEpoch(null), null);
  assert.equal(toEpoch('ngawur'), null);
  assert.equal(toEpoch(Number.POSITIVE_INFINITY), null);
});

test('label & kelompok mode game', () => {
  assert.equal(modeLabel('pvp'), 'PvP');
  assert.equal(modeLabel('bot_hard'), 'PvB hard');
  assert.equal(modeLabel('baru'), 'baru');
  assert.equal(modeLabel(null), '—');
  assert.equal(modeGroup('uno'), 'sampingan');
  assert.equal(modeGroup('pvp'), 'sambung');
});

test('peluang event: tiap nilai 0–1 dan jumlah ≤ 1 (cermin event.setChances)', () => {
  const ok = { ai_challenger: '0.2', lost_signal: '0,3', traveling_merchant: 0.1, invader: 0 };
  assert.equal(validateChances(ok), null);
  assert.equal(chanceTotal({ ai_challenger: 0.2, lost_signal: 0.3, traveling_merchant: 0.1, invader: 0 }).toFixed(2), '0.60');
  assert.match(validateChances({ ...ok, invader: '' }) ?? '', /invader/);
  assert.match(validateChances({ ...ok, ai_challenger: '1.5' }) ?? '', /ai_challenger/);
  assert.match(validateChances({ ...ok, ai_challenger: '-0.1' }) ?? '', /ai_challenger/);
  assert.match(validateChances({ ai_challenger: 0.5, lost_signal: 0.5, traveling_merchant: 0.1, invader: 0 }) ?? '', /melebihi 1/);
  // Tepat 1.0 masih sah meski ada galat pembulatan.
  assert.equal(validateChances({ ai_challenger: 0.1, lost_signal: 0.2, traveling_merchant: 0.3, invader: 0.4 }), null);
});

test('opsi polling: satu per baris, tanpa baris kosong, maks 5, maks 80 karakter', () => {
  assert.deepEqual(parsePollOptions('A\n\n B \r\nC'), ['A', 'B', 'C']);
  assert.equal(parsePollOptions('1\n2\n3\n4\n5\n6').length, 5);
  assert.equal(parsePollOptions('x'.repeat(100))[0].length, 80);
  assert.deepEqual(parsePollOptions(''), []);
});

test('validasi draft broadcast (cermin broadcast.send)', () => {
  const dasar = { audience: 'all', message: 'Halo pemain!' };
  assert.deepEqual(validateBroadcast(dasar), []);
  assert.ok(validateBroadcast({ ...dasar, audience: '' }).some((e) => /audiens/.test(e)));
  assert.ok(validateBroadcast({ ...dasar, message: '   ' }).some((e) => /wajib/.test(e)));
  assert.ok(validateBroadcast({ ...dasar, message: 'x'.repeat(4001) }).some((e) => /4000/.test(e)));
  assert.ok(validateBroadcast({ ...dasar, color: 'merah' }).some((e) => /hex/.test(e)));
  assert.deepEqual(validateBroadcast({ ...dasar, color: '#57f287' }), []);
  assert.ok(validateBroadcast({ ...dasar, mediaUrl: 'javascript:alert(1)' }).some((e) => /media/.test(e)));
  assert.ok(validateBroadcast({ ...dasar, customLabel: 'Buka' }).some((e) => /teks DAN URL/.test(e)));
  assert.ok(validateBroadcast({ ...dasar, customLabel: 'Buka', customUrl: 'ftp://x' }).some((e) => /http/.test(e)));
  assert.deepEqual(validateBroadcast({ ...dasar, customLabel: 'Buka', customUrl: 'https://vanillate.id' }), []);
  assert.ok(validateBroadcast(dasar, { test: true }).some((e) => /penerima test/.test(e)));
  assert.deepEqual(validateBroadcast({ ...dasar, targetUser: '#A3K9' }, { test: true }), []);
  const poll = { question: 'Mode favorit?', options: ['PvP', 'UNO'], durationHours: 24 };
  assert.deepEqual(validateBroadcast({ ...dasar, poll }), []);
  assert.ok(validateBroadcast({ ...dasar, poll: { ...poll, options: ['PvP'] } }).some((e) => /2 opsi/.test(e)));
  assert.ok(validateBroadcast({ ...dasar, poll: { ...poll, question: ' ' } }).some((e) => /Pertanyaan/.test(e)));
  assert.ok(validateBroadcast({ ...dasar, poll: { ...poll, durationHours: 200 } }).some((e) => /Durasi/.test(e)));
});

test('jenis media & pratinjau header', () => {
  assert.equal(mediaKind('https://cdn.example.com/a.PNG?x=1'), 'image');
  assert.equal(mediaKind('https://youtu.be/abc'), 'link');
  assert.equal(mediaKind('data:image/png;base64,xx'), null);
  assert.equal(mediaKind(''), null);

  // Peringatan media: link halaman & lampiran Discord yang kedaluwarsa.
  assert.deepEqual(mediaHint('https://i.imgur.com/abc.png'), []);
  assert.deepEqual(mediaHint('https://youtu.be/abc'), []);
  assert.deepEqual(mediaHint(''), []);
  assert.ok(mediaHint('https://imgur.com/abc').some((h) => /bukan link gambar langsung/.test(h)));
  assert.ok(mediaHint('https://cdn.discordapp.com/attachments/1/2/a.png?ex=1&is=2&hm=3').some((h) => /kedaluwarsa/.test(h)));
  assert.deepEqual(mediaHint('https://cdn.discordapp.com/attachments/1/2/a.png'), []);
  assert.equal(describeMedia(null), null);
  assert.match(describeMedia({ kind: 'image', url: 'https://i.imgur.com/a.jpeg', source: 'page' })!, /og:image/);
  assert.match(describeMedia({ kind: 'link', url: 'https://x.id', source: 'page-link', warning: 'w' })!, /Tautan.*⚠️ w/);

  const d = { audience: 'all', message: 'x', title: '  ', color: 'zzz' };
  assert.deepEqual(previewHeader(d), { title: null, footer: 'Vanillate.ID • Pesan resmi dari tim', color: '#57F287' });
  const darurat = previewHeader({ ...d, color: 'ED4245' }, { emergency: true });
  assert.equal(darurat.title, '🚨 Informasi Penting');
  assert.equal(darurat.color, '#ED4245');
  assert.match(darurat.footer, /darurat/);
  assert.equal(previewHeader({ ...d, title: 'Update' }, { server: true }).footer, 'Vanillate.ID • Info khusus owner/admin server');
});

test('estimasi durasi broadcast', () => {
  assert.equal(estimateMinutes(600, 1000), 10);
  assert.equal(estimateMinutes(0, 1000), 0);
  assert.equal(estimateMinutes(7, 1500), 0.2);
});

test('hitung kata bulk: unik, tanpa beda huruf besar, keyword SEMUA', () => {
  assert.equal(countBulkWords('Satu\nsatu, dua; tiga  empat'), 4);
  assert.equal(countBulkWords(''), 0);
  assert.equal(countBulkWords('  semua '), 'SEMUA');
});

test('aksi bulk memetakan sesi export yang benar (cermin ACTION_SESSION_KIND bot)', () => {
  assert.equal(BULK_ACTIONS.accept.from, 'pending');
  assert.equal(BULK_ACTIONS.reject.from, 'pending');
  assert.equal(BULK_ACTIONS.to_accept.from, 'rejected');
  assert.equal(BULK_ACTIONS.to_reject.from, 'accepted');
  assert.equal(BULK_ACTIONS.accept.reason, false);
  assert.equal(BULK_ACTIONS.reject.reason, true);
});
