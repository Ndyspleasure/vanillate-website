// ═══════════════════════════════════════════════════════════════════════════
// MOTION SYSTEM — one small, dependency-free engine every section reuses.
//
// Nothing here is mandatory: each behaviour is opt-in through a data-* attribute
// on the markup, so a section only animates when it asks to. Everything obeys
// the three global signals already in the site:
//   • prefers-reduced-motion  → all decorative motion is skipped, content stays
//   • data-perf (high | low)  → heavy pointer effects (tilt, cursor) stand down
//   • pointer / hover query    → touch devices never get hover-only interactions
//
// It also listens to the existing `exp:perf` event, so switching Performance in
// the nav re-gates the pointer effects live, without a reload. Content-first:
// reveal + counters degrade to the finished state; they never hide anything.
// ═══════════════════════════════════════════════════════════════════════════

type Perf = 'high' | 'low';

const root = document.documentElement;
const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
const mqFine = matchMedia('(pointer: fine)');
const mqHover = matchMedia('(hover: hover)');

// Live perf value — read inside handlers so a runtime switch takes effect at once.
let perf: Perf = root.getAttribute('data-perf') === 'low' ? 'low' : 'high';

const reduced = () => mqReduce.matches;
// A "rich" pointer = a real mouse/trackpad that hovers. Excludes touch, so we
// never attach hover-only interactions where they'd feel broken.
const richPointer = () => mqFine.matches && mqHover.matches;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

// ─── Reveal on scroll ────────────────────────────────────────────────────────
// Supports directions + a container-level stagger. Reuses the existing `.is-in`
// class + `--reveal-delay` var so old markup keeps working unchanged.
function initReveal() {
  // Expand [data-reveal-stagger] containers: give each child an incremental delay.
  document.querySelectorAll<HTMLElement>('[data-reveal-stagger]').forEach((c) => {
    const step = parseFloat(c.dataset.revealStagger || '') || 80;
    const base = parseFloat(c.dataset.revealBase || '') || 0;
    Array.from(c.children).forEach((child, i) => {
      const el = child as HTMLElement;
      if (!el.hasAttribute('data-reveal')) el.setAttribute('data-reveal', '');
      if (!el.style.getPropertyValue('--reveal-delay')) {
        el.style.setProperty('--reveal-delay', `${base + i * step}ms`);
      }
    });
  });

  const els = document.querySelectorAll<HTMLElement>('[data-reveal]');
  if (!els.length) return;
  if (reduced() || !('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.05 }
  );
  els.forEach((el) => io.observe(el));
}

// ─── Number counters ─────────────────────────────────────────────────────────
// The element's text (or data-count) is the destination, e.g. "150K+", "+300%",
// "2026". We parse prefix / number / suffix and count the number up on reveal.
function initCounters() {
  const els = Array.from(document.querySelectorAll<HTMLElement>('[data-count]'));
  if (!els.length) return;

  const run = (el: HTMLElement) => {
    const raw = (el.dataset.count || el.textContent || '').trim();
    const m = raw.match(/^(\D*?)([\d.,]+)(.*)$/s);
    if (!m) return; // no number to animate — leave as-is
    const [, pre, numStr, suf] = m;
    const target = parseFloat(numStr.replace(/,/g, ''));
    if (isNaN(target)) return;
    const decimals = (numStr.split('.')[1] || '').length;
    const fmt = (v: number) => pre + v.toFixed(decimals) + suf;

    if (reduced()) {
      el.textContent = raw;
      return;
    }
    const dur = 1400;
    let start = 0;
    el.textContent = fmt(0);
    const step = (t: number) => {
      if (!start) start = t;
      const p = clamp((t - start) / dur, 0, 1);
      const e = 1 - Math.pow(1 - p, 3); // easeOutCubic
      el.textContent = fmt(target * e);
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = raw; // land exactly on the authored string
    };
    requestAnimationFrame(step);
  };

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          run(e.target as HTMLElement);
          io.unobserve(e.target);
        }
      }
    },
    { threshold: 0.4 }
  );
  els.forEach((el) => io.observe(el));
}

// ─── Magnetic elements ───────────────────────────────────────────────────────
// The element eases toward the pointer and springs back on leave. Cheap enough
// to keep on both perf modes; skipped for touch + reduced motion.
function initMagnetic() {
  if (reduced() || !richPointer()) return;
  document.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((el) => {
    const strength = parseFloat(el.dataset.magnetic || '') || 0.3;
    let raf = 0, tx = 0, ty = 0, cx = 0, cy = 0;
    const loop = () => {
      cx += (tx - cx) * 0.15;
      cy += (ty - cy) * 0.15;
      el.style.transform = `translate(${cx.toFixed(2)}px, ${cy.toFixed(2)}px)`;
      if (Math.abs(tx - cx) > 0.1 || Math.abs(ty - cy) > 0.1) {
        raf = requestAnimationFrame(loop);
      } else {
        raf = 0;
        if (tx === 0 && ty === 0) el.style.transform = '';
      }
    };
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      const r = el.getBoundingClientRect();
      tx = (e.clientX - (r.left + r.width / 2)) * strength;
      ty = (e.clientY - (r.top + r.height / 2)) * strength;
      if (!raf) raf = requestAnimationFrame(loop);
    });
    el.addEventListener('pointerleave', () => {
      tx = 0; ty = 0;
      if (!raf) raf = requestAnimationFrame(loop);
    });
  });
}

// ─── 3D tilt cards ───────────────────────────────────────────────────────────
// rotateX/Y toward the pointer, with an optional light glare. Composes with a
// hover lift via the shared --lift var (CSS owns the transform string). Gated to
// rich pointer + high perf; re-checked per-event so a live perf switch applies.
function initTilt() {
  const els = Array.from(document.querySelectorAll<HTMLElement>('[data-tilt]'));
  if (!els.length) return;
  els.forEach((el) => {
    const max = parseFloat(el.dataset.tilt || '') || 7;
    let raf = 0, rx = 0, ry = 0, trx = 0, try_ = 0, active = false;
    const loop = () => {
      rx += (trx - rx) * 0.12;
      ry += (try_ - ry) * 0.12;
      el.style.setProperty('--rx', rx.toFixed(2) + 'deg');
      el.style.setProperty('--ry', ry.toFixed(2) + 'deg');
      if (active || Math.abs(trx - rx) > 0.03 || Math.abs(try_ - ry) > 0.03) {
        raf = requestAnimationFrame(loop);
      } else {
        raf = 0;
      }
    };
    const enabled = () => !reduced() && perf === 'high' && richPointer();
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch' || !enabled()) return;
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      try_ = px * max * 2;
      trx = -py * max * 2;
      el.style.setProperty('--mx', (px * 100 + 50).toFixed(1) + '%');
      el.style.setProperty('--my', (py * 100 + 50).toFixed(1) + '%');
      active = true;
      el.classList.add('is-tilting');
      if (!raf) raf = requestAnimationFrame(loop);
    });
    el.addEventListener('pointerleave', () => {
      trx = 0; try_ = 0; active = false;
      el.classList.remove('is-tilting');
      if (!raf) raf = requestAnimationFrame(loop);
    });
  });
}

// ─── Parallax ────────────────────────────────────────────────────────────────
// Subtle depth on decorative elements only (never on text the reader needs).
function initParallax() {
  const els = Array.from(document.querySelectorAll<HTMLElement>('[data-parallax]'));
  if (!els.length || reduced()) return;
  let ticking = false;
  const update = () => {
    ticking = false;
    const vh = window.innerHeight;
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.bottom < -120 || r.top > vh + 120) continue;
      const speed = parseFloat(el.dataset.parallax || '') || 0.12;
      const mid = r.top + r.height / 2 - vh / 2;
      el.style.transform = `translate3d(0, ${(-mid * speed).toFixed(1)}px, 0)`;
    }
  };
  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true }
  );
  update();
}

// ─── Custom cursor ───────────────────────────────────────────────────────────
// An additive accent ring that trails the native cursor and grows over
// interactive targets. High perf + rich pointer only; the native cursor stays.
function initCursor() {
  const ring = document.querySelector<HTMLElement>('[data-cursor]');
  if (!ring || reduced() || !richPointer()) return;
  let x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y, raf = 0, shown = false;
  const loop = () => {
    rx += (x - rx) * 0.2;
    ry += (y - ry) * 0.2;
    ring.style.transform = `translate3d(${rx.toFixed(1)}px, ${ry.toFixed(1)}px, 0) translate(-50%, -50%)`;
    if (perf === 'high') raf = requestAnimationFrame(loop);
    else raf = 0;
  };
  window.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse') return;
      x = e.clientX; y = e.clientY;
      if (!shown) { shown = true; ring.classList.add('is-on'); }
      if (!raf && perf === 'high') raf = requestAnimationFrame(loop);
    },
    { passive: true }
  );
  const interactive = 'a, button, [data-magnetic], [data-tilt], input, textarea, select, [role="button"]';
  document.addEventListener('pointerover', (e) => {
    if ((e.target as HTMLElement).closest?.(interactive)) ring.classList.add('is-active');
  }, true);
  document.addEventListener('pointerout', (e) => {
    if ((e.target as HTMLElement).closest?.(interactive)) ring.classList.remove('is-active');
  }, true);
  window.addEventListener('blur', () => ring.classList.remove('is-on'));
}

// ─── Boot ────────────────────────────────────────────────────────────────────
export function initMotion() {
  window.addEventListener('exp:perf', (e: any) => {
    perf = e.detail?.perf === 'low' ? 'low' : 'high';
    root.classList.toggle('perf-low', perf === 'low');
  });
  root.classList.toggle('perf-low', perf === 'low');

  initReveal();
  initCounters();
  initMagnetic();
  initTilt();
  initParallax();
  initCursor();
}
