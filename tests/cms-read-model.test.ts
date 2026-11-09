// Tes model Server Hub CMS (src/lib/cms-read/serverhub-model.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { num, parseServerHub, perhatian, persen } from '../src/lib/cms-read/serverhub-model.ts';

const contoh = {
  generated_at: 1794207033553,
  verification: { servers_configured: 1, servers_on: 1, servers_incomplete: 0, members_verified: 4 },
  leveling: { servers_configured: 4, servers_on: 2, chat_on: 2, voice_on: 2, combined_on: 1, without_levelup_channel: 0, users_tracked: 18, rewards_total: 0 },
  autorole: { servers_configured: 0, servers_on: 0 },
  welcome: { servers_configured: 0, servers_on: 0, with_welcome_channel: 0, with_goodbye_channel: 0 },
  security: { servers_configured: 1, servers_on: 1, rejoin_alert_on: 0, actions_total: 3, by_action: { ban: 1, kick: 2 }, by_status: { active: 3 } },
};

test('num: angka tak negatif, string digit diterima, sisanya 0', () => {
  assert.equal(num(5), 5);
  assert.equal(num('12'), 12);
  assert.equal(num(-1), 0);
  assert.equal(num(1.9), 1);
  assert.equal(num('abc'), 0);
  assert.equal(num(null), 0);
  assert.equal(num(Number.NaN), 0);
  assert.equal(num(Infinity), 0);
});

test('parseServerHub membaca bentuk nyata dari fungsi baca', () => {
  const h = parseServerHub(contoh)!;
  assert.equal(h.generatedAt, 1794207033553);
  assert.equal(h.verification.members_verified, 4);
  assert.equal(h.leveling.servers_on, 2);
  assert.equal(h.leveling.users_tracked, 18);
  assert.deepEqual(h.security.by_action, { ban: 1, kick: 2 });
});

test('parseServerHub defensif: bukan objek = null, bagian hilang = 0', () => {
  assert.equal(parseServerHub(null), null);
  assert.equal(parseServerHub([]), null);
  assert.equal(parseServerHub('x'), null);
  const h = parseServerHub({})!;
  assert.equal(h.verification.servers_on, 0);
  assert.deepEqual(h.security.by_status, {});
});

test('peta menolak kunci aneh dan angka tak sah', () => {
  const h = parseServerHub({ security: { by_action: { ban: '2', '<script>': 9, kick: -4 } } })!;
  assert.deepEqual(h.security.by_action, { ban: 2, kick: 0 });
});

test('perhatian: server belum lengkap, tanpa channel, dan fitur belum dipakai', () => {
  const h = parseServerHub({
    ...contoh,
    verification: { ...contoh.verification, servers_incomplete: 2 },
    leveling: { ...contoh.leveling, without_levelup_channel: 1 },
    welcome: { servers_configured: 1, servers_on: 1, with_welcome_channel: 0, with_goodbye_channel: 0 },
  })!;
  const p = perhatian(h);
  assert.ok(p.some((x) => x.tone === 'warn' && /2 server memakai Verification/.test(x.text)));
  assert.ok(p.some((x) => /1 server Leveling aktif tanpa channel/.test(x.text)));
  assert.ok(p.some((x) => /Welcome aktif/.test(x.text)));
  assert.ok(p.some((x) => /Belum dipakai server mana pun: Auto Role/.test(x.text)));
});

test('perhatian: data sehat dan semua fitur dipakai = kosong', () => {
  const h = parseServerHub({
    ...contoh,
    autorole: { servers_configured: 1, servers_on: 1 },
    welcome: { servers_configured: 1, servers_on: 1, with_welcome_channel: 1, with_goodbye_channel: 1 },
  })!;
  assert.deepEqual(perhatian(h), []);
});

test('teks perhatian tanpa tanda pisah dilarang aturan dashboard', () => {
  const h = parseServerHub({ ...contoh, verification: { ...contoh.verification, servers_incomplete: 1 }, leveling: { ...contoh.leveling, without_levelup_channel: 1 } })!;
  for (const x of perhatian(h)) assert.ok(!/[—–]| - /.test(x.text), x.text);
});

test('persen membulatkan dan aman terhadap pembagi 0', () => {
  assert.equal(persen(1, 3), 33);
  assert.equal(persen(2, 3), 67);
  assert.equal(persen(1, 0), 0);
});
