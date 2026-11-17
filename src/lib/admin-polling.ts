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
}

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
  };
}

export function startAdminPolling(
  task: () => Promise<unknown>,
  intervalMs = 30_000,
  options: { immediate?: boolean; environment?: PollEnvironment; onError?: (error: unknown) => void } = {},
) {
  const env = options.environment ?? browserEnvironment();
  const interval = Math.max(1000, intervalMs);
  let timer: unknown = null;
  let running: Promise<void> | null = null;
  let stopped = false;
  let suspended = false;
  let failures = 0;
  const clear = () => { if (timer !== null) env.clearTimer(timer); timer = null; };
  const active = () => !stopped && !suspended && !env.isHidden();
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
  if (options.immediate === false) schedule(); else void refresh();
  return {
    refresh,
    stop() { stopped = true; clear(); remove.forEach((off) => off()); },
  };
}
