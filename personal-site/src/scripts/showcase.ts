// ═══════════════════════════════════════════════════════════════════════════
// LIVE CODING SHOWCASE — a self-running "system being built". One internal
// timeline drives an IDE that types a real file, a terminal that logs, a
// data-flow core, an API response and status. The timeline ping-pongs
// (forward → reverse → forward) so the loop is seamless, never a hard reset.
// ═══════════════════════════════════════════════════════════════════════════

const CODE = [
  '// vanillate/core/system.ts',
  'import { db } from "./db";',
  'import { ai } from "./ai";',
  'import { queue } from "./automation";',
  '',
  'interface Player { id: string; name: string; score: number }',
  '',
  'const config = {',
  '  game: "sambung-kata",',
  '  locale: "id-ID",',
  '  words: 25_000,',
  '};',
  '',
  'export class SystemCore {',
  '  async play(word: string): Promise<Player> {',
  '    const ok = await ai.check(word, config.locale);',
  '    if (!ok) return this.retry();',
  '    const row = await db.query(',
  '      `select * from players order by score desc limit 1`',
  '    );',
  '    await queue.emit("round.next", { word });',
  '    return row as Player;',
  '  }',
  '}',
  '',
  'const core = new SystemCore();',
  'await core.play("vanilla");',
];

const TERM = [
  { at: 0.30, html: '<span class="dim">$</span> pnpm build' },
  { at: 0.45, html: '<span class="dim">›</span> compiling modules …' },
  { at: 0.60, html: '<span class="ok">✓</span> 42 modules, 0 errors' },
  { at: 0.74, html: '<span class="ac">▲</span> deploying to edge' },
  { at: 0.88, html: '<span class="ok">✓</span> live in 1.2s' },
];

const KW = new Set(['import', 'from', 'export', 'const', 'let', 'var', 'async', 'await', 'function', 'class', 'return', 'new', 'if', 'else', 'for', 'of', 'in', 'interface', 'type', 'extends', 'implements', 'this', 'true', 'false', 'null', 'as', 'void']);

function tokenize(line: string): [string, string][] {
  const out: [string, string][] = [];
  let i = 0;
  const push = (tx: string, cls: string) => tx && out.push([tx, cls]);
  while (i < line.length) {
    const rest = line.slice(i);
    let m: RegExpMatchArray | null;
    if ((m = rest.match(/^\/\/.*/))) { push(m[0], 'c'); i += m[0].length; continue; }
    if ((m = rest.match(/^`[^`]*`|^"[^"]*"|^'[^']*'/))) { push(m[0], 's'); i += m[0].length; continue; }
    if ((m = rest.match(/^\d[\d_]*\.?\d*/))) { push(m[0], 'n'); i += m[0].length; continue; }
    if ((m = rest.match(/^\.[A-Za-z_$][\w$]*/))) { push(m[0], 'p'); i += m[0].length; continue; }
    if ((m = rest.match(/^[A-Za-z_$][\w$]*/))) {
      const w = m[0];
      let cls = '';
      if (KW.has(w)) cls = 'k';
      else if (/^[A-Z]/.test(w)) cls = 't';
      else if (/^\s*\(/.test(rest.slice(w.length))) cls = 'f';
      push(w, cls); i += w.length; continue;
    }
    if ((m = rest.match(/^\s+/))) { push(m[0], ''); i += m[0].length; continue; }
    push(rest[0], ''); i++;
  }
  return out;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const spanFull = (toks: [string, string][]) => toks.map(([tx, c]) => (c ? `<span class="${c}">${esc(tx)}</span>` : esc(tx))).join('');
function spanPartial(toks: [string, string][], n: number) {
  let out = '', used = 0;
  for (const [tx, c] of toks) {
    if (used >= n) break;
    const take = Math.min(tx.length, n - used);
    const part = esc(tx.slice(0, take));
    out += c ? `<span class="${c}">${part}</span>` : part;
    used += take;
  }
  return out;
}

export function initShowcase() {
  const section = document.querySelector('[data-sc]') as HTMLElement | null;
  if (!section) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const codeEl = section.querySelector('[data-code]') as HTMLElement;
  const gutterEl = section.querySelector('[data-gutter]') as HTMLElement;
  const termEl = section.querySelector('[data-term]') as HTMLElement;
  const statusEl = section.querySelector('[data-status]') as HTMLElement;
  const statusTxt = section.querySelector('[data-statustxt]') as HTMLElement;
  const coreEl = section.querySelector('[data-core]') as HTMLElement;
  const apiEl = section.querySelector('[data-api]') as HTMLElement;
  const jsonEl = section.querySelector('[data-json]') as HTMLElement;
  const gitEl = section.querySelector('[data-git]') as HTMLElement;
  const gitTxt = section.querySelector('[data-gittxt]') as HTMLElement;
  const cnodes = Array.from(section.querySelectorAll('[data-cnode]')) as HTMLElement[];
  const cflows = Array.from(section.querySelectorAll('[data-cflow]')) as HTMLElement[];

  const toks = CODE.map(tokenize);
  const fullHTML = toks.map(spanFull);
  const unit = CODE.map((l) => l.length + 1); // +1 for the line break
  const total = unit.reduce((a, b) => a + b, 0);

  // build line rows + gutter numbers
  codeEl.innerHTML = CODE.map((_, i) => `<span class="ln" data-ln="${i}"></span>`).join('');
  gutterEl.textContent = CODE.map((_, i) => i + 1).join('\n');
  const lineEls = Array.from(codeEl.querySelectorAll('.ln')) as HTMLElement[];
  const termLineEls = TERM.map(() => { const s = document.createElement('span'); s.className = 'tl'; termEl.appendChild(s); return s; });
  TERM.forEach((tm, i) => (termLineEls[i].innerHTML = tm.html));

  const JSON_HTML = [
    '{',
    '  <span class="k">"ok"</span>: <span class="n">true</span>,',
    '  <span class="k">"round"</span>: <span class="n">128</span>,',
    '  <span class="k">"top"</span>: <span class="s">"vanilla"</span>,',
    '  <span class="k">"score"</span>: <span class="n">980</span>',
    '}',
  ].join('\n');
  jsonEl.innerHTML = JSON_HTML;

  const lineState: number[] = CODE.map(() => -2); // -2 empty, -1 full, >=0 partial count
  let lineH = 0;

  function render(t: number) {
    const budget = Math.floor(t * total);
    let cum = 0, caret = 0;
    for (let i = 0; i < CODE.length; i++) {
      const L = unit[i];
      if (budget >= cum + L) {
        if (lineState[i] !== -1) { lineEls[i].innerHTML = fullHTML[i]; lineState[i] = -1; }
        cum += L;
      } else {
        const into = Math.max(0, Math.min(CODE[i].length, budget - cum));
        lineEls[i].innerHTML = spanPartial(toks[i], into) + '<span class="sc__caret"></span>';
        lineState[i] = into;
        caret = i;
        // clear the rest
        for (let j = i + 1; j < CODE.length; j++) {
          if (lineState[j] !== -2) { lineEls[j].innerHTML = ''; lineState[j] = -2; }
        }
        break;
      }
      if (i === CODE.length - 1) caret = i;
    }
    // hot line
    lineEls.forEach((el, i) => el.classList.toggle('is-hot', i === caret && t > 0.001 && t < 0.999));
    // auto-scroll to keep the caret comfortably in view
    if (!lineH) { const r = lineEls[1]?.getBoundingClientRect(); lineH = r ? r.height : 20; }
    const viewH = codeEl.parentElement!.clientHeight || 300;
    const y = Math.max(0, caret * lineH - viewH * 0.62);
    codeEl.style.transform = gutterEl.style.transform = `translateY(${-y}px)`;

    // terminal
    TERM.forEach((tm, i) => termLineEls[i].classList.toggle('on', t >= tm.at));
    // status
    let tone = '', txt = 'READY';
    if (t >= 0.9) { tone = 'ok'; txt = 'DEPLOYED'; }
    else if (t >= 0.72) { tone = 'build'; txt = 'VALIDATING'; }
    else if (t >= 0.3) { tone = 'build'; txt = 'BUILDING'; }
    else if (t >= 0.06) { tone = ''; txt = 'COMPILING'; }
    if (statusEl.dataset.tone !== tone) statusEl.dataset.tone = tone;
    if (statusTxt.textContent !== txt) statusTxt.textContent = txt;
    // git
    const g = t >= 0.82 ? 'main pushed ✓' : t >= 0.4 ? 'main 3 ahead' : 'main syncing';
    if (gitTxt.textContent !== g) gitTxt.textContent = g;
    gitEl.classList.toggle('on', t > 0.05);
    // data-flow core
    coreEl.classList.toggle('on', t > 0.24);
    const nOn = Math.floor(Math.min(1, Math.max(0, (t - 0.28) / 0.5)) * (cnodes.length + 1));
    cnodes.forEach((n, i) => n.classList.toggle('on', i < nOn));
    cflows.forEach((f, i) => f.classList.toggle('on', i < nOn && t > 0.5 && t < 0.98));
    // api
    apiEl.classList.toggle('on', t > 0.66);
  }

  if (reduce) { render(1); return; }

  // ─── ping-pong timeline ─────────────────────────────────────────────────
  let t = 0, dir = 1, hold = 0, paused = false, raf = 0, last = 0;
  const DUR = 17000; // ms galaxy-slow, comfortable to read
  const HOLD = 1400; // pause at each end

  function frame(now: number) {
    const dt = Math.min(48, now - last); last = now;
    if (!paused) {
      if (hold > 0) hold -= dt;
      else {
        t += (dir * dt) / DUR;
        if (t >= 1) { t = 1; dir = -1; hold = HOLD; }
        else if (t <= 0) { t = 0; dir = 1; hold = HOLD; }
      }
    }
    render(t);
    raf = requestAnimationFrame(frame);
  }
  const start = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  const stop = () => { if (raf) { cancelAnimationFrame(raf); raf = 0; } };

  const io = new IntersectionObserver((es) => { for (const e of es) e.isIntersecting ? start() : stop(); }, { threshold: 0.15 });
  io.observe(section);
  render(0);

  // optional, non-disruptive interaction: hover pauses the loop
  const stage = section.querySelector('[data-scstage]') as HTMLElement;
  stage.addEventListener('pointerenter', () => (paused = true));
  stage.addEventListener('pointerleave', () => (paused = false));

  // reset to the very start (used by the "try a different experience" restart)
  window.addEventListener('exp:restart', () => { t = 0; dir = 1; hold = HOLD; lineState.forEach((_, i) => (lineState[i] = -2)); render(0); });

  (window as any).__showcase = { setT(v: number) { stop(); paused = true; render(v); }, resume() { paused = false; start(); } };
}
