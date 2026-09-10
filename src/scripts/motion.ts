// ═══════════════════════════════════════════════════════════════════════════
// MOTION SYSTEM (Vanillate Studio) — one small, dependency-free engine for the
// public site's micro-interactions. Ported from the personal site so both sites
// share the same vocabulary.
//
// Everything is opt-in through a data-* attribute and always obeys:
//   • prefers-reduced-motion → all decorative motion is skipped
//   • pointer / hover query   → touch devices never get hover-only effects
//
// Scroll reveal already lives in BaseLayout (.reveal → .is-visible); this engine
// adds counters, magnetic elements, 3D tilt, and an additive cursor ring. It is
// booted only from BaseLayout, so the admin panel (AdminLayout) is untouched.
// ═══════════════════════════════════════════════════════════════════════════

const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
const mqFine = matchMedia('(pointer: fine)');
const mqHover = matchMedia('(hover: hover)');

const reduced = () => mqReduce.matches;
const richPointer = () => mqFine.matches && mqHover.matches;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

// ─── Number counters ─────────────────────────────────────────────────────────
// Prefer an explicit numeric target in data-count (with data-count-prefix /
// -suffix and dot grouping for id-ID); otherwise parse the element's own text.
function initCounters() {
  const els = Array.from(document.querySelectorAll<HTMLElement>('[data-count]'));
  if (!els.length) return;
  const group = (n: number) => Math.round(n).toLocaleString('id-ID');

  const run = (el: HTMLElement) => {
    const attr = (el.dataset.count || '').trim();
    let target: number, pre: string, suf: string, decimals = 0, grouped = true;

    if (attr && !isNaN(parseFloat(attr))) {
      target = parseFloat(attr);
      pre = el.dataset.countPrefix || '';
      suf = el.dataset.countSuffix || '';
    } else {
      const raw = (el.textContent || '').trim();
      const m = raw.match(/^(\D*?)([\d.,]+)(.*)$/s);
      if (!m) return;
      pre = m[1];
      suf = m[3];
      const numStr = m[2].replace(/[.,]/g, '');
      target = parseFloat(numStr);
      decimals = 0;
      grouped = /[.,]/.test(m[2]);
    }
    if (isNaN(target)) return;

    const finalText = pre + (grouped ? group(target) : target.toFixed(decimals)) + suf;
    if (reduced()) { el.textContent = finalText; return; }

    const dur = 1400;
    let start = 0;
    el.textContent = pre + '0' + suf;
    const step = (t: number) => {
      if (!start) start = t;
      const p = clamp((t - start) / dur, 0, 1);
      const e = 1 - Math.pow(1 - p, 3);
      const v = target * e;
      el.textContent = pre + (grouped ? group(v) : v.toFixed(decimals)) + suf;
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = finalText;
    };
    requestAnimationFrame(step);
  };

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) { run(e.target as HTMLElement); io.unobserve(e.target); }
      }
    },
    { threshold: 0.4 }
  );
  els.forEach((el) => io.observe(el));
}

// ─── Magnetic elements ───────────────────────────────────────────────────────
function initMagnetic() {
  if (reduced() || !richPointer()) return;
  document.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((el) => {
    const strength = parseFloat(el.dataset.magnetic || '') || 0.3;
    let raf = 0, tx = 0, ty = 0, cx = 0, cy = 0;
    const loop = () => {
      cx += (tx - cx) * 0.15;
      cy += (ty - cy) * 0.15;
      el.style.transform = `translate(${cx.toFixed(2)}px, ${cy.toFixed(2)}px)`;
      if (Math.abs(tx - cx) > 0.1 || Math.abs(ty - cy) > 0.1) raf = requestAnimationFrame(loop);
      else { raf = 0; if (tx === 0 && ty === 0) el.style.transform = ''; }
    };
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      const r = el.getBoundingClientRect();
      tx = (e.clientX - (r.left + r.width / 2)) * strength;
      ty = (e.clientY - (r.top + r.height / 2)) * strength;
      if (!raf) raf = requestAnimationFrame(loop);
    });
    el.addEventListener('pointerleave', () => { tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(loop); });
  });
}

// ─── 3D tilt cards ───────────────────────────────────────────────────────────
function initTilt() {
  const els = Array.from(document.querySelectorAll<HTMLElement>('[data-tilt]'));
  if (!els.length) return;
  els.forEach((el) => {
    const max = parseFloat(el.dataset.tilt || '') || 6;
    let raf = 0, rx = 0, ry = 0, trx = 0, try_ = 0, active = false;
    const loop = () => {
      rx += (trx - rx) * 0.12;
      ry += (try_ - ry) * 0.12;
      el.style.setProperty('--rx', rx.toFixed(2) + 'deg');
      el.style.setProperty('--ry', ry.toFixed(2) + 'deg');
      if (active || Math.abs(trx - rx) > 0.03 || Math.abs(try_ - ry) > 0.03) raf = requestAnimationFrame(loop);
      else raf = 0;
    };
    const enabled = () => !reduced() && richPointer();
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

// ─── Custom cursor ring (additive) ───────────────────────────────────────────
function initCursor() {
  const ring = document.querySelector<HTMLElement>('[data-cursor]');
  if (!ring || reduced() || !richPointer()) return;
  let x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y, raf = 0, shown = false;
  const loop = () => {
    rx += (x - rx) * 0.2;
    ry += (y - ry) * 0.2;
    ring.style.transform = `translate3d(${rx.toFixed(1)}px, ${ry.toFixed(1)}px, 0) translate(-50%, -50%)`;
    raf = requestAnimationFrame(loop);
  };
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    x = e.clientX; y = e.clientY;
    if (!shown) { shown = true; ring.classList.add('is-on'); }
    if (!raf) raf = requestAnimationFrame(loop);
  }, { passive: true });
  const interactive = 'a, button, [data-magnetic], [data-tilt], input, textarea, select, [role="button"]';
  document.addEventListener('pointerover', (e) => {
    if ((e.target as HTMLElement).closest?.(interactive)) ring.classList.add('is-active');
  }, true);
  document.addEventListener('pointerout', (e) => {
    if ((e.target as HTMLElement).closest?.(interactive)) ring.classList.remove('is-active');
  }, true);
  window.addEventListener('blur', () => ring.classList.remove('is-on'));
}

export function initMotion() {
  initCounters();
  initMagnetic();
  initTilt();
  initCursor();
}
