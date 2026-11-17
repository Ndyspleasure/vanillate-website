import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPoller,
  createTtlCache,
  nextDelay,
  FAST_MS,
  FAST_LATE_MS,
  IDLE_STEPS_MS,
  SLOW_STEPS_MS,
  type PollEnv,
} from '../src/lib/dashboard/polling.ts';

/** Lingkungan palsu: jam manual, satu timer, visibilitas yang bisa diubah. */
function fakeEnv() {
  const s = { now: 0, hidden: false, timer: null as null | { fn: () => void; ms: number }, visibility: () => {}, listeners: 0 };
  const env: PollEnv = {
    now: () => s.now,
    isHidden: () => s.hidden,
    setTimer: (fn, ms) => {
      s.timer = { fn, ms };
      return s.timer;
    },
    clearTimer: () => {
      s.timer = null;
    },
    onVisibility: (fn) => {
      s.visibility = fn;
      s.listeners += 1;
      return () => {
        s.listeners -= 1;
      };
    },
  };
  /** Majukan jam sampai timer jatuh tempo lalu jalankan. */
  const fire = async () => {
    const t = s.timer!;
    s.timer = null;
    s.now += t.ms;
    t.fn();
    await new Promise((r) => setImmediate(r));
  };
  return { s, env, fire };
}

test('nextDelay: cepat hanya selama aksi ditunggu, lalu mundur bertahap', () => {
  assert.equal(nextDelay({ watching: true, watchElapsedMs: 0, waitingForBot: true, quietStreak: 9 }), FAST_MS);
  assert.equal(nextDelay({ watching: true, watchElapsedMs: 25_000, waitingForBot: true, quietStreak: 0 }), FAST_LATE_MS);
  assert.deepEqual(
    [0, 1, 2, 3, 4, 99].map((q) => nextDelay({ watching: false, watchElapsedMs: 0, waitingForBot: true, quietStreak: q })),
    [15_000, 30_000, 60_000, 120_000, 300_000, 300_000],
  );
  assert.deepEqual(
    [0, 1, 2, 3, 50].map((q) => nextDelay({ watching: false, watchElapsedMs: 0, waitingForBot: false, quietStreak: q })),
    [30_000, 60_000, 120_000, 300_000, 300_000],
  );
  assert.equal(IDLE_STEPS_MS.at(-1), SLOW_STEPS_MS.at(-1));
});

test('satu jam diam: jauh lebih sedikit permintaan daripada jeda tetap 30 detik', async () => {
  const { s, env, fire } = fakeEnv();
  let calls = 0;
  const p = createPoller({ run: async () => { calls += 1; return false; }, delay: (q) => nextDelay({ watching: false, watchElapsedMs: 0, waitingForBot: false, quietStreak: q }), env });
  p.start();
  while (s.timer && s.now + s.timer.ms <= 3_600_000) await fire();
  assert.equal(calls, 14); // jeda tetap 30 detik = 120 permintaan per jam
  p.stop();
});

test('tab tersembunyi: nol permintaan, nol timer, dan tidak dijadwalkan ulang', async () => {
  const { s, env, fire } = fakeEnv();
  let calls = 0;
  const p = createPoller({ run: async () => { calls += 1; return false; }, delay: () => 30_000, env });
  p.start();
  assert.ok(s.timer);
  s.hidden = true;
  s.visibility();
  assert.equal(s.timer, null);
  p.kick(0);
  assert.equal(s.timer, null, 'kick saat tersembunyi tidak menjadwalkan');
  s.now += 10 * 60_000;
  assert.equal(calls, 0);
  // Terlihat lagi setelah lama: langsung muat sekali.
  s.hidden = false;
  s.visibility();
  await new Promise((r) => setImmediate(r));
  assert.equal(calls, 1);
  assert.ok(s.timer);
  // Timer yang jatuh tempo persis saat tab disembunyikan tidak mengirim permintaan.
  s.hidden = true;
  await fire();
  assert.equal(calls, 1);
  assert.equal(s.timer, null);
  p.stop();
});

test('bolak-balik tab dengan cepat tidak memicu permintaan baru', async () => {
  const { s, env } = fakeEnv();
  let calls = 0;
  const p = createPoller({ run: async () => { calls += 1; return false; }, delay: () => 30_000, minGapMs: 15_000, env });
  p.start();
  for (let i = 0; i < 5; i++) {
    s.hidden = true;
    s.visibility();
    s.now += 1000;
    s.hidden = false;
    s.visibility();
  }
  await new Promise((r) => setImmediate(r));
  assert.equal(calls, 0);
  assert.ok(s.timer && s.timer.ms <= 15_000, 'sisa jeda dijadwalkan, bukan dimuat sekarang');
  p.stop();
});

test('permintaan tidak pernah tumpang tindih', async () => {
  const { s, env } = fakeEnv();
  let calls = 0;
  let finish = (_: boolean) => {};
  const p = createPoller({ run: () => { calls += 1; return new Promise<boolean>((r) => { finish = r; }); }, delay: () => 1000, minGapMs: 0, env });
  p.start();
  const first = s.timer!;
  s.timer = null;
  first.fn(); // putaran pertama berjalan, belum selesai
  assert.equal(calls, 1);
  s.visibility(); // terlihat (tidak tersembunyi) saat masih berjalan
  p.kick(0);
  assert.equal(s.timer, null, 'tidak ada jadwal baru selama permintaan berjalan');
  assert.equal(calls, 1);
  finish(false);
  await new Promise((r) => setImmediate(r));
  assert.ok(s.timer, 'dijadwalkan lagi setelah selesai');
  p.stop();
});

test('perubahan data mengembalikan jeda ke langkah pertama, gagal jaringan ikut mundur', async () => {
  const { s, env, fire } = fakeEnv();
  const results: (boolean | Error)[] = [false, false, true, new Error('net'), false];
  const delays: number[] = [];
  const p = createPoller({
    run: async () => { const r = results.shift()!; if (r instanceof Error) throw r; return r; },
    delay: (q) => { const d = IDLE_STEPS_MS[Math.min(q, 3)]; delays.push(d); return d; },
    env,
  });
  p.start();
  for (let i = 0; i < 5; i++) await fire();
  assert.deepEqual(delays, [30_000, 60_000, 120_000, 30_000, 60_000, 120_000]);
  assert.equal(p.quietStreak, 2);
  p.kick();
  assert.equal(p.quietStreak, 0);
  p.stop();
  assert.equal(s.timer, null);
  assert.equal(s.listeners, 0);
});

test('createTtlCache: hasil dipakai ulang sampai kedaluwarsa', () => {
  let now = 0;
  const c = createTtlCache<string>(20_000, () => now);
  assert.equal(c.get(), null);
  c.set('a');
  now = 19_999;
  assert.equal(c.get(), 'a');
  assert.equal(c.fresh(), true);
  now = 20_000;
  assert.equal(c.get(), null);
  c.set('b');
  c.clear();
  assert.equal(c.fresh(), false);
});
