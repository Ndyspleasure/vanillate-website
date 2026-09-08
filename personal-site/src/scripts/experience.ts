// ═══════════════════════════════════════════════════════════════════════════
// EXPERIENCE STATE — two independent layers the visitor controls:
//   Performance (auto | high | low)   → rendering intensity  (data-perf)
//   Animation   (auto | manual)       → how the journey plays (data-anim)
// A saved manual choice always wins; the capability probe only recommends.
// Journey + coding showcase listen to the dispatched events. window.EXP is the
// single source other components (nav toggles, closing panel) drive.
// ═══════════════════════════════════════════════════════════════════════════
const root = document.documentElement;
const store = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch {} },
};
const emit = (name: string, detail: any) => window.dispatchEvent(new CustomEvent(name, { detail }));
const boot = (window as any).__EXP__ || { perfChoice: 'auto', anim: 'auto', rec: 'high' };

type PerfChoice = 'auto' | 'high' | 'low';
type Anim = 'auto' | 'manual';

let perfChoice: PerfChoice = boot.perfChoice;
let anim: Anim = boot.anim;
const rec: 'high' | 'low' = boot.rec === 'low' ? 'low' : 'high';
const resolve = (c: PerfChoice) => (c === 'auto' ? rec : c);

function applyPerf(c: PerfChoice) {
  perfChoice = c;
  store.set('exp.perf', c);
  const active = resolve(c);
  root.setAttribute('data-perf', active);
  root.setAttribute('data-perf-choice', c);
  emit('exp:perf', { perf: active, choice: c });
  syncToggles();
}
function applyAnim(m: Anim) {
  anim = m;
  store.set('exp.anim', m);
  root.setAttribute('data-anim', m);
  emit('exp:anim', { anim: m });
  syncToggles();
}
function markSeen() { store.set('exp.seen', '1'); root.removeAttribute('data-exp-fresh'); }

function smoothTop() {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
}
// Restart the whole journey in a (possibly new) mode: apply → reset state →
// scroll to top → replay. No page reload.
function restart(nextAnim?: Anim) {
  if (nextAnim && nextAnim !== anim) applyAnim(nextAnim);
  emit('exp:restart', {});            // components reset their timelines to 0
  smoothTop();                        // then glide back to the beginning
}

const EXP = { get perfChoice() { return perfChoice; }, get anim() { return anim; }, get rec() { return rec; }, resolve, applyPerf, applyAnim, restart };
(window as any).EXP = EXP;

// ─── nav toggles ─────────────────────────────────────────────────────────────
function syncToggles() {
  document.querySelectorAll('[data-exp-tog]').forEach((tog) => {
    const kind = (tog as HTMLElement).dataset.expTog; // 'perf' | 'anim'
    const cur = kind === 'perf' ? perfChoice : anim;
    const opts = Array.from(tog.querySelectorAll('[data-exp-set]')) as HTMLElement[];
    let short = '';
    opts.forEach((o) => {
      const on = o.dataset.expSet === `${kind}:${cur}`;
      o.setAttribute('aria-checked', String(on));
      o.classList.toggle('is-on', on);
      if (on) short = o.dataset.short || '';
    });
    const val = tog.querySelector('[data-exp-val]');
    if (val) val.textContent = short;
  });
}

function wireToggles() {
  const closeAll = (except?: Element) =>
    document.querySelectorAll('[data-exp-menu]').forEach((m) => { if (m !== except) { (m as HTMLElement).hidden = true; m.previousElementSibling?.setAttribute('aria-expanded', 'false'); } });

  document.querySelectorAll('[data-exp-tog]').forEach((tog) => {
    const btn = tog.querySelector('[data-exp-btn]') as HTMLElement;
    const menu = tog.querySelector('[data-exp-menu]') as HTMLElement;
    btn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = menu.hidden;
      closeAll(open ? menu : undefined);
      menu.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
    });
    tog.querySelectorAll('[data-exp-set]').forEach((o) => {
      o.addEventListener('click', () => {
        const [kind, val] = ((o as HTMLElement).dataset.expSet || '').split(':');
        if (kind === 'perf') applyPerf(val as PerfChoice);
        else if (kind === 'anim') applyAnim(val as Anim);
        menu.hidden = true; btn.setAttribute('aria-expanded', 'false');
      });
    });
  });
  document.addEventListener('click', () => closeAll());
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); });
}

// ─── first-visit chooser ──────────────────────────────────────────────────────
function wireOverlay() {
  const overlay = document.querySelector('[data-expo]') as HTMLElement | null;
  if (!overlay) return;
  // show the recommended badge on the right perf card
  const badge = overlay.querySelector(`[data-rec="${rec}"]`) as HTMLElement | null;
  if (badge) badge.hidden = false;

  let tentPerf: PerfChoice = 'auto';
  let tentAnim: Anim | null = null;
  const startBtn = overlay.querySelector('[data-expo-start]') as HTMLButtonElement;
  startBtn.disabled = true;

  const goStep = (n: 1 | 2) => {
    overlay.dataset.at = String(n);
    overlay.querySelectorAll('[data-dot]').forEach((d) => d.classList.toggle('is-on', +((d as HTMLElement).dataset.dot || '1') <= n));
  };
  const open = () => { overlay.hidden = false; overlay.setAttribute('aria-hidden', 'false'); requestAnimationFrame(() => overlay.classList.add('is-in')); document.body.style.overflow = 'hidden'; };
  const close = () => {
    overlay.classList.add('is-out');
    document.body.style.overflow = '';
    setTimeout(() => { overlay.hidden = true; overlay.setAttribute('aria-hidden', 'true'); }, 480);
  };
  const finish = () => { applyPerf(tentPerf); applyAnim(tentAnim || 'auto'); markSeen(); close(); };

  overlay.querySelectorAll('[data-pick-perf]').forEach((b) =>
    b.addEventListener('click', () => {
      tentPerf = (b as HTMLElement).dataset.pickPerf as PerfChoice;
      overlay.querySelectorAll('[data-pick-perf]').forEach((x) => x.classList.toggle('is-sel', x === b));
      setTimeout(() => goStep(2), 180);
    })
  );
  overlay.querySelectorAll('[data-pick-anim]').forEach((b) =>
    b.addEventListener('click', () => {
      tentAnim = (b as HTMLElement).dataset.pickAnim as Anim;
      overlay.querySelectorAll('[data-pick-anim]').forEach((x) => x.classList.toggle('is-sel', x === b));
      startBtn.disabled = false;
    })
  );
  overlay.querySelector('[data-expo-back]')?.addEventListener('click', () => goStep(1));
  overlay.querySelector('[data-expo-auto]')?.addEventListener('click', () => { tentPerf = 'auto'; tentAnim = 'auto'; finish(); });
  startBtn.addEventListener('click', finish);

  if (root.hasAttribute('data-exp-fresh')) open();
}

export function initExperience() {
  wireToggles();
  syncToggles();
  wireOverlay();
}
