/** Poll only while the page is visible. A slow request never starts a second
 * copy; returning to a tab refreshes once, without replaying missed ticks.
 * Nothing is cached in localStorage (admin data stays in the current page).
 */
export interface PollEnvironment {
  isHidden(): boolean;
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(timer: unknown): void;
  onVisibility(fn: () => void): () => void;
  onPageHide(fn: () => void): () => void;
  onPageShow(fn: () => void): () => void;
  /** Interaksi pengguna (pointerdown, keydown, wheel/scroll, touchstart). Opsional agar pemanggil lama tetap jalan. */
  onInteraction?(fn: () => void): () => void;
  /** Waktu sekarang dalam ms (disuntik untuk tes). Bawaan Date.now. */
  now?(): number;
}

/** Batas diam bawaan: tanpa interaksi sekian lama, polling berhenti sampai ada interaksi lagi. */
export const DEFAULT_IDLE_MS = 30 * 60 * 1000;

function browserEnvironment(): PollEnvironment {
  const listen = (target: EventTarget, event: string, fn: () => void) => {
    target.addEventListener(event, fn);
    return () => target.removeEventListener(event, fn);
  };
  return {
    isHidden: () => document.hidden,
    setTimer: (fn, ms) => window.setTimeout(fn, ms),
    clearTimer: (timer) => window.clearTimeout(timer as number),
    onVisibility: (fn) => listen(document, 'visibilitychange', fn),
    onPageHide: (fn) => listen(window, 'pagehide', fn),
    onPageShow: (fn) => listen(window, 'pageshow', fn),
    onInteraction: (fn) => {
      const events = ['pointerdown', 'keydown', 'wheel', 'scroll', 'touchstart'];
      events.forEach((e) => window.addEventListener(e, fn, { passive: true, capture: true }));
      return () => events.forEach((e) => window.removeEventListener(e, fn, { capture: true }));
    },
    now: () => Date.now(),
  };
}

export function startAdminPolling(
  task: () => Promise<unknown>,
  intervalMs = 30_000,
  options: {
    immediate?: boolean;
    environment?: PollEnvironment;
    onError?: (error: unknown) => void;
    /** Berhenti bila tak ada interaksi selama sekian ms (bawaan 30 menit, 0 = tidak pernah berhenti). */
    idleMs?: number;
  } = {},
) {
  const env = options.environment ?? browserEnvironment();
  const interval = Math.max(1000, intervalMs);
  let timer: unknown = null;
  let running: Promise<void> | null = null;
  let stopped = false;
  let suspended = false;
  let failures = 0;
  const clear = () => { if (timer !== null) env.clearTimer(timer); timer = null; };
  const idleMs = options.idleMs ?? DEFAULT_IDLE_MS;
  const now = () => (env.now ? env.now() : Date.now());
  let lastActivity = now();
  let idle = false;
  const isIdle = () => {
    if (idleMs > 0 && !idle && now() - lastActivity >= idleMs) idle = true;
    return idle;
  };
  const active = () => !stopped && !suspended && !env.isHidden() && !isIdle();
  const schedule = () => {
    clear();
    if (active()) timer = env.setTimer(() => { timer = null; void refresh(); }, interval * Math.min(4, 2 ** failures));
  };
  function refresh(): Promise<void> {
    if (running) return running;
    if (!active()) return Promise.resolve();
    clear();
    running = Promise.resolve().then(task).then(() => { failures = 0; }, (error) => {
      failures++;
      options.onError?.(error);
    }).finally(() => { running = null; schedule(); });
    return running;
  }
  const remove = [
    env.onVisibility(() => { clear(); if (active()) void refresh(); }),
    env.onPageHide(() => { suspended = true; clear(); }),
    env.onPageShow(() => { suspended = false; if (active()) void refresh(); }),
  ];
  if (idleMs > 0 && env.onInteraction) {
    remove.push(env.onInteraction(() => {
      lastActivity = now();
      if (idle) { idle = false; void refresh(); }
    }));
  }
  if (options.immediate === false) schedule(); else void refresh();
  return {
    refresh,
    stop() { stopped = true; clear(); remove.forEach((off) => off()); },
  };
}
