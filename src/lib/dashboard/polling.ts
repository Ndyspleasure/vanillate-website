// ════════════════════════════════════════════════════════════════════════════
//  Vanillate Dashboard — penjadwal polling hemat (murni, tanpa DOM langsung).
//
//  Tujuan utama: hemat kuota Database Bot (CLAUDE.md). Aturan:
//    • Tab tersembunyi = NOL permintaan dan NOL timer. Saat kembali terlihat,
//      data dimuat ulang hanya bila sudah lebih tua dari `minGapMs`.
//    • Permintaan tidak pernah tumpang tindih.
//    • Cepat hanya selama ada aksi yang menunggu bot (simpan, Retry Sync,
//      Refresh Discord Data), lalu kembali lambat dengan backoff.
//  Lingkungan (jam, timer, visibilitas) disuntikkan supaya bisa dites tanpa
//  browser (tests/dashboard-polling.test.ts).
// ════════════════════════════════════════════════════════════════════════════

/** Langkah jeda saat tidak ada yang ditunggu: makin lama diam, makin jarang. */
export const IDLE_STEPS_MS = [30_000, 60_000, 120_000, 300_000] as const;
/** Bot belum juga mengambil revisi (mis. sedang offline): mundur bertahap. */
export const SLOW_STEPS_MS = [15_000, 30_000, 60_000, 120_000, 300_000] as const;
/** Jeda selama jendela tunggu aksi: rapat di awal, lalu sedikit lebih jarang. */
export const FAST_MS = 2500;
export const FAST_LATE_MS = 5000;
export const FAST_EARLY_WINDOW_MS = 20_000;

export interface DelayInput {
  /** Ada aksi pengguna yang hasilnya ditunggu, dan jendelanya belum habis. */
  watching: boolean;
  /** Lama (ms) sejak aksi yang ditunggu itu dimulai. */
  watchElapsedMs: number;
  /** Revisi tersimpan belum diterapkan bot, tetapi jendela cepat sudah lewat. */
  waitingForBot: boolean;
  /** Jumlah poll berturut-turut yang tidak membawa perubahan. */
  quietStreak: number;
}

const step = (steps: readonly number[], i: number) => steps[Math.min(Math.max(0, i), steps.length - 1)];

/** Jeda sampai poll berikutnya. Murni, jadi mudah dites dan dilaporkan. */
export function nextDelay(i: DelayInput): number {
  if (i.watching) return i.watchElapsedMs < FAST_EARLY_WINDOW_MS ? FAST_MS : FAST_LATE_MS;
  if (i.waitingForBot) return step(SLOW_STEPS_MS, i.quietStreak);
  return step(IDLE_STEPS_MS, i.quietStreak);
}

export interface PollEnv {
  now(): number;
  isHidden(): boolean;
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(id: unknown): void;
  /** Mengembalikan fungsi untuk melepas pendengar. */
  onVisibility(fn: () => void): () => void;
}

export const browserPollEnv = (): PollEnv => ({
  now: () => Date.now(),
  isHidden: () => document.hidden,
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
  onVisibility: (fn) => {
    document.addEventListener('visibilitychange', fn);
    return () => document.removeEventListener('visibilitychange', fn);
  },
});

export interface PollerOptions {
  /** Satu putaran muat data. Mengembalikan true bila ada yang berubah. */
  run: () => Promise<boolean>;
  /** Jeda berikutnya, diberi jumlah putaran sepi berturut-turut. */
  delay: (quietStreak: number) => number;
  /**
   * Ragam saat ini (mis. 'fast' | 'slow' | 'idle'). Saat ragam berganti, hitungan
   * sepi dimulai dari nol supaya jeda tidak langsung melompat ke langkah terjauh.
   */
  mode?: () => string;
  /** Saat tab kembali terlihat, lewati muat ulang bila data lebih muda dari ini. */
  minGapMs?: number;
  env?: PollEnv;
}

export interface Poller {
  /** Mulai menjadwalkan (tanpa langsung memuat: pemanggil sudah memuat data awal). */
  start(): void;
  stop(): void;
  /** Jadwalkan ulang lebih cepat setelah aksi pengguna, dan mulai hitung sepi dari nol. */
  kick(ms?: number): void;
  /** Catat bahwa data baru saja dimuat di luar poller (mis. setelah simpan). */
  touch(): void;
  /** Untuk tes dan laporan. */
  readonly quietStreak: number;
}

export function createPoller(opts: PollerOptions): Poller {
  const env = opts.env ?? browserPollEnv();
  const minGap = opts.minGapMs ?? 15_000;
  let timer: unknown = null;
  let running = false;
  let active = false;
  let quiet = 0;
  let lastRunAt = env.now();
  let offVisibility: (() => void) | null = null;
  let lastMode: string | undefined;

  function delay(): number {
    const mode = opts.mode?.();
    if (mode !== lastMode) {
      lastMode = mode;
      quiet = 0;
    }
    return opts.delay(quiet);
  }

  function clear(): void {
    if (timer !== null) env.clearTimer(timer);
    timer = null;
  }

  function schedule(ms?: number): void {
    clear();
    if (!active || env.isHidden()) return;
    timer = env.setTimer(tick, ms ?? delay());
  }

  async function tick(): Promise<void> {
    timer = null;
    if (!active || running) return;
    if (env.isHidden()) return; // tidak ada permintaan dan tidak dijadwalkan ulang
    running = true;
    try {
      const changed = await opts.run();
      quiet = changed ? 0 : quiet + 1;
    } catch {
      quiet += 1; // gagal jaringan: mundur, jangan membanjiri
    } finally {
      running = false;
      lastRunAt = env.now();
      schedule();
    }
  }

  function onVisibility(): void {
    if (!active) return;
    if (env.isHidden()) return clear();
    if (running) return;
    const age = env.now() - lastRunAt;
    // Bolak-balik tab dengan cepat tidak memicu permintaan baru.
    if (age >= minGap) void tick();
    else schedule(Math.min(delay(), minGap - age));
  }

  return {
    start() {
      if (active) return;
      active = true;
      offVisibility = env.onVisibility(onVisibility);
      schedule();
    },
    stop() {
      active = false;
      clear();
      offVisibility?.();
      offVisibility = null;
    },
    kick(ms) {
      quiet = 0;
      if (active && !running) schedule(ms);
    },
    touch() {
      lastRunAt = env.now();
    },
    get quietStreak() {
      return quiet;
    },
  };
}

/** Cache kecil berumur pendek untuk hasil RPC yang dibuka ulang (mis. pindah tab bolak-balik). */
export function createTtlCache<T>(ttlMs: number, now: () => number = Date.now) {
  let value: T | null = null;
  let at = 0;
  return {
    get: (): T | null => (value !== null && now() - at < ttlMs ? value : null),
    set(v: T): void {
      value = v;
      at = now();
    },
    clear(): void {
      value = null;
      at = 0;
    },
    fresh: (): boolean => value !== null && now() - at < ttlMs,
  };
}
