// Tes model Ringkasan Statistik dashboard (src/lib/dashboard/stats-model.ts).
// Jalankan: npm test  (node --experimental-strip-types --test)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  STATS_STALE_MS,
  dayLabel,
  formatCount,
  formatPercent,
  growthOf,
  growthRateOf,
  isStatsStale,
  parseStatsSummary,
  percentOf,
  stickinessOf,
  verifyStatsOf,
} from '../src/lib/dashboard/stats-model.ts';

const FULL = {
  v: 1,
  updated_at: '2026-11-04T09:00:00.000Z',
  members: { total: 1284, history: [['2026-11-02', 1270], ['2026-11-03', 1277], ['2026-11-04', 1284]], history_note: null },
  join_leave: { available: false, locked_note: 'Butuh izin khusus Discord.' },
  activity: { ever: 900, active_1d: 212, active_7d: 486, active_30d: 731, chat_xp: 460, voice_xp: 250, chat_pct: 65 },
  verification: { days: [{ day: '2026-11-03', n: 9 }, { day: '2026-11-04', n: 14 }], total7: 23 },
  community: { streak: { today: 64, best: 41 }, counting: { record: 1208 } },
};

test('parseStatsSummary: ringkasan lengkap terbaca', () => {
  const s = parseStatsSummary(FULL)!;
  assert.equal(s.members.total, 1284);
  assert.deepEqual(s.members.history, [{ day: '2026-11-02', n: 1270 }, { day: '2026-11-03', n: 1277 }, { day: '2026-11-04', n: 1284 }]);
  assert.equal(s.activity!.active_7d, 486);
  assert.equal(s.activity!.chat_pct, 65);
  assert.equal(s.verification!.total7, 23);
  assert.deepEqual(s.community.streak, { today: 64, best: 41 });
  assert.deepEqual(s.community.counting, { record: 1208 });
  assert.equal(s.join_leave.available, false);
  assert.equal(s.join_leave.locked_note, 'Butuh izin khusus Discord.');
});

test('parseStatsSummary: bentuk salah / versi tak dikenal → null (bukan error)', () => {
  for (const bad of [null, undefined, 'x', 5, [], {}, { v: 2 }, { v: '1' }]) assert.equal(parseStatsSummary(bad), null);
});

test('parseStatsSummary: bagian fitur mati tetap null, bukan hilang', () => {
  const s = parseStatsSummary({ v: 1, updated_at: null, members: { total: 5, history: null, history_note: 'Tunggu.' }, join_leave: {}, activity: null, verification: null, community: { streak: null, counting: null } })!;
  assert.equal(s.activity, null);
  assert.equal(s.verification, null);
  assert.deepEqual(s.community, { streak: null, counting: null });
  assert.equal(s.members.history, null);
  assert.equal(s.members.history_note, 'Tunggu.');
  assert.equal(s.join_leave.available, false);
});

test('parseStatsSummary: angka dipaksa bilangan bulat >= 0, persen dibatasi 0..100', () => {
  const s = parseStatsSummary({ ...FULL, activity: { ever: -3, active_1d: 2.9, active_7d: 'x', active_30d: Infinity, chat_xp: 1e3, voice_xp: null, chat_pct: 150 }, members: { total: -1, history: null } })!;
  assert.equal(s.activity!.ever, 0);
  assert.equal(s.activity!.active_1d, 2);
  assert.equal(s.activity!.active_7d, 0);
  assert.equal(s.activity!.active_30d, 0);
  assert.equal(s.activity!.chat_pct, 100);
  assert.equal(s.members.total, null);
});

test('parseStatsSummary: hari tidak valid dibuang, riwayat < 2 titik dianggap belum ada, teks dipotong', () => {
  const s = parseStatsSummary({ ...FULL, members: { total: 10, history: [['bukan-hari', 5], ['2026-11-04', 9]], history_note: 'a'.repeat(1000) } })!;
  assert.equal(s.members.history, null);
  assert.equal(s.members.history_note!.length, 400);
  const v = parseStatsSummary({ ...FULL, verification: { days: [{ day: 'x', n: 1 }, { day: '2026-11-04', n: 2 }], total7: 2 } })!;
  assert.deepEqual(v.verification!.days, [{ day: '2026-11-04', n: 2 }]);
});

test('parseStatsSummary: tidak membawa bidang asing (mis. ID pemain) ke model', () => {
  const s = parseStatsSummary({ ...FULL, secret: '910000000000000101', activity: { ...FULL.activity, user_id: '910000000000000102' } })!;
  assert.ok(!JSON.stringify(s).includes('9100000000000001'));
});

test('isStatsStale: kosong, rusak, atau lebih tua dari batas → basi', () => {
  const now = Date.parse('2026-11-04T09:10:00Z');
  assert.equal(isStatsStale(null, now), true);
  assert.equal(isStatsStale(parseStatsSummary({ ...FULL, updated_at: null }), now), true);
  assert.equal(isStatsStale(parseStatsSummary({ ...FULL, updated_at: 'tidak valid' }), now), true);
  assert.equal(isStatsStale(parseStatsSummary(FULL), now), false);
  assert.equal(isStatsStale(parseStatsSummary(FULL), Date.parse(FULL.updated_at) + STATS_STALE_MS + 1), true);
});

test('percentOf: dibulatkan, dibatasi 100, pembagi tak dikenal → null', () => {
  assert.equal(percentOf(486, 1284), 38);
  assert.equal(percentOf(2000, 1284), 100);
  assert.equal(percentOf(5, 0), null);
  assert.equal(percentOf(5, null), null);
});

test('growthOf: selisih, persen, dan path SVG; titik kurang → null', () => {
  const g = growthOf([{ day: '2026-11-01', n: 1230 }, { day: '2026-11-02', n: 1257 }, { day: '2026-11-03', n: 1284 }])!;
  assert.equal(g.delta, 54);
  assert.equal(g.pct, 4.4);
  assert.ok(g.line.startsWith('M0 '));
  assert.ok(g.line.includes('L600 '));
  assert.ok(g.area.endsWith('L600 150 L0 150 Z'));
  assert.equal(growthOf(null), null);
  assert.equal(growthOf([{ day: '2026-11-01', n: 5 }]), null);
  // Datar (semua sama) tidak membagi nol.
  const flat = growthOf([{ day: '2026-11-01', n: 7 }, { day: '2026-11-02', n: 7 }])!;
  assert.equal(flat.delta, 0);
  assert.ok(!flat.line.includes('NaN'));
  assert.equal(growthOf([{ day: '2026-11-01', n: 0 }, { day: '2026-11-02', n: 3 }])!.pct, null);
});

test('dayLabel & format angka (id-ID)', () => {
  assert.equal(dayLabel('2026-11-02'), 'Sen');
  assert.equal(dayLabel('2026-11-08'), 'Min');
  assert.equal(dayLabel('bukan'), '');
  assert.equal(formatCount(1284).replace(/\s/g, ''), '1.284');
  assert.equal(formatPercent(4.4), '4,4%');
});

test('stickinessOf: persen aktif 24 jam dari aktif 7 hari, dibatasi 100, tanpa data → null', () => {
  assert.equal(stickinessOf({ active_1d: 212, active_7d: 486 }), 44);
  assert.equal(stickinessOf({ active_1d: 10, active_7d: 5 }), 100);
  assert.equal(stickinessOf({ active_1d: 0, active_7d: 0 }), null);
  assert.equal(stickinessOf({ active_1d: 0, active_7d: 20 }), 0);
});

test('verifyStatsOf: rata-rata per hari satu desimal dan hari terbaik', () => {
  const days = [9, 14, 11, 17, 22, 28, 19].map((n, i) => ({ day: `2026-11-0${i + 1}`, n }));
  const r = verifyStatsOf({ days, total7: 120 });
  assert.equal(r.avg, 17.1);
  assert.deepEqual(r.best, { day: '2026-11-06', n: 28 });
  const empty = verifyStatsOf({ days: days.map((d) => ({ ...d, n: 0 })), total7: 0 });
  assert.equal(empty.avg, 0);
  assert.equal(empty.best, null, 'tanpa kelulusan tidak ada hari terbaik');
  const tie = verifyStatsOf({ days: [{ day: '2026-11-01', n: 5 }, { day: '2026-11-02', n: 5 }], total7: 10 });
  assert.equal(tie.best!.day, '2026-11-01');
  assert.equal(verifyStatsOf({ days: [], total7: 0 }).avg, 0);
});

test('growthRateOf: rata-rata per hari memakai jarak hari sebenarnya; hari terbaik hanya dari hari berurutan', () => {
  const h = [['2026-11-01', 100], ['2026-11-02', 104], ['2026-11-03', 105], ['2026-11-04', 112]].map(([day, n]) => ({ day: day as string, n: n as number }));
  const r = growthRateOf(h)!;
  assert.equal(r.avg, 4);
  assert.deepEqual(r.best, { day: '2026-11-04', delta: 7 });
  // Hari bolong: 10 hari, +40 → 4 per hari, bukan 20 per titik.
  const gap = growthRateOf([{ day: '2026-11-01', n: 100 }, { day: '2026-11-11', n: 140 }])!;
  assert.equal(gap.avg, 4);
  assert.equal(gap.best, null, 'dua titik tidak berurutan tidak dianggap kenaikan harian');
  // Turun tetap dilaporkan sebagai rata-rata negatif, tanpa hari terbaik.
  const down = growthRateOf([{ day: '2026-11-01', n: 100 }, { day: '2026-11-02', n: 90 }])!;
  assert.equal(down.avg, -10);
  assert.equal(down.best, null);
  assert.equal(growthRateOf(null), null);
  assert.equal(growthRateOf([{ day: '2026-11-01', n: 5 }]), null);
  assert.equal(growthRateOf([{ day: '2026-11-01', n: 5 }, { day: '2026-11-01', n: 9 }]), null, 'jarak 0 hari');
});
