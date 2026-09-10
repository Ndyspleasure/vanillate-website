// ═══════════════════════════════════════════════════════════════════════════
// SPACE JOURNEY — one continuous flight: Milky Way → Solar System → Earth →
// Indonesia → West Java → Bekasi. A WebGL particle starfield stays behind
// every scene and flies THROUGH as the camera dives, so nothing reads as a
// background swap. Progress is driven by an internal timeline (Auto mode) or
// by scroll (Manual mode). Degrades to Canvas2D, then to a static globe.
// ═══════════════════════════════════════════════════════════════════════════
import { geo } from '../data/geo.ts';

type Scene = { el: HTMLElement; g: SVGGElement; range: [number, number]; sIn: number; sOut: number; t: [number, number] };

const E = geo.earth;

export function initJourney() {
  const section = document.querySelector('[data-jr]') as HTMLElement | null;
  if (!section) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;
  const canvas = section.querySelector('[data-gl]') as HTMLCanvasElement | null;
  const stageEl = section.querySelector('[data-stage]') as HTMLElement | null;
  const rail = Array.from(section.querySelectorAll('[data-rail]')) as HTMLElement[];
  const bar = section.querySelector('[data-jrbar]') as HTMLElement | null;
  const core = section.querySelector('.jr__core') as HTMLElement | null;
  const nebs = Array.from(section.querySelectorAll('.jr__neb')) as HTMLElement[];

  const sceneEl = (n: string) => section.querySelector(`.scene--${n}`) as HTMLElement;
  const mk = (n: string, range: [number, number], sIn: number, sOut: number, t: [number, number]): Scene => {
    const el = sceneEl(n);
    return { el, g: el.querySelector('[data-zoom]') as SVGGElement, range, sIn, sOut, t };
  };
  const scenes: Scene[] = [
    mk('solar', [0.14, 0.4], 0.85, 3.0, [393, 583]),
    mk('earth', [0.36, 0.62], 0.9, 3.4, E.target as [number, number]),
    mk('indonesia', [0.58, 0.79], 0.95, 3.0, geo.indonesia.target as [number, number]),
    mk('westjava', [0.76, 0.9], 0.95, 2.6, geo.westJava.target as [number, number]),
    mk('bekasi', [0.86, 1.0], 0.98, 1.7, geo.bekasi.marker as [number, number]),
  ];
  // stage thresholds → index into the 6 rail items
  const stageBreaks = [0.14, 0.4, 0.62, 0.79, 0.9];
  const stageNames = ['BIMA SAKTI', 'TATA SURYA', 'BUMI', 'INDONESIA', 'JAWA BARAT', 'BEKASI'];

  const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a: number, b: number, x: number) => a + (b - a) * x;
  const seg = (p: number, a: number, b: number, c: number, d: number) =>
    p <= a || p >= d ? 0 : p < b ? (p - a) / (b - a) : p > c ? 1 - (p - c) / (d - c) : 1;
  const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

  // On landscape the scene fills the whole viewport (cover), which is much wider
  // than the old centre square, so the SVG is drawn larger. Scale the scene zoom
  // down to match, which also pulls edge labels (e.g. KARAWANG) back inside the
  // viewBox instead of being clipped. Portrait/mobile keeps the original zoom.
  let zoomK = 1;
  const computeZoomK = () => {
    const vw = window.innerWidth || 1, vh = window.innerHeight || 1;
    zoomK = vw >= vh ? clamp(0.94 * vh / vw, 0.52, 1) : 1;
  };
  computeZoomK();

  // ─── static fallback (reduced motion) ─────────────────────────────────────
  if (reduce) {
    (window as any).__journey = { setProgress() {}, reduced: true };
    return;
  }

  // ─── perf budget ──────────────────────────────────────────────────────────
  const budgets: Record<string, number> = { high: 5200, low: 1500 };
  let perf = root.getAttribute('data-perf') === 'low' ? 'low' : 'high';
  let anim = root.getAttribute('data-anim') === 'manual' ? 'manual' : 'auto';

  // Interactive 3D camera parallax — a tiny offset from pointer / device tilt,
  // eased on the CPU. Target (offTX/offTY) is set by input; offX/offY chase it.
  let offTX = 0, offTY = 0, offX = 0, offY = 0;

  // ─── WebGL galaxy ─────────────────────────────────────────────────────────
  const gl = canvas ? (canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: false }) as WebGLRenderingContext | null) : null;
  let render2d: ((p: number, tSec: number) => void) | null = null;
  let renderGL: ((p: number, tSec: number) => void) | null = null;
  let resizeGL: (() => void) | null = null;
  let drawCount = budgets[perf];
  let targetCount = budgets[perf];
  const MAX = budgets.high;

  if (gl && canvas) {
    const vs = `
      attribute vec2 a_dir; attribute float a_z; attribute float a_size; attribute float a_bright; attribute float a_col;
      uniform float u_cam; uniform float u_px; uniform float u_dim; uniform vec2 u_aspect; uniform vec2 u_off;
      varying float v_b; varying float v_col;
      void main(){
        float f = fract(a_z - u_cam);
        float zz = f * 0.985 + 0.015;
        // Interactive 3D camera: nearer stars shift more than far ones (parallax
        // depth). u_off is a tiny pointer/gyro offset eased on the CPU side.
        vec2 par = u_off * (0.5 + min(1.0 / zz, 5.0));
        vec2 pos = (a_dir / zz) + par;
        gl_Position = vec4(pos.x * u_aspect.x, pos.y * u_aspect.y, 0.0, 1.0);
        gl_PointSize = clamp(a_size / zz * u_px, 0.0, 26.0 * u_px);
        float farFade = smoothstep(1.0, 0.2, f);
        float nearFade = smoothstep(0.0, 0.05, f);
        v_b = a_bright * farFade * nearFade * u_dim;
        v_col = a_col;
      }`;
    const fs = `
      precision mediump float; varying float v_b; varying float v_col;
      vec3 pal(float i){
        if(i < 1.0) return vec3(1.0,1.0,1.0);
        if(i < 2.0) return vec3(0.70,0.82,1.0);
        if(i < 3.0) return vec3(1.0,0.86,0.62);
        return vec3(1.0,0.62,0.86);
      }
      void main(){
        vec2 d = gl_PointCoord - 0.5;
        float r = dot(d,d);
        float a = smoothstep(0.25, 0.0, r);
        gl_FragColor = vec4(pal(v_col) * v_b, a * v_b);
      }`;
    const sh = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    // particle data — Milky-Way band + depth
    const dir = new Float32Array(MAX * 2), zA = new Float32Array(MAX), size = new Float32Array(MAX), bri = new Float32Array(MAX), col = new Float32Array(MAX);
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
    for (let i = 0; i < MAX; i++) {
      const band = Math.random() < 0.62;
      let x = rnd(-1.25, 1.25);
      let y = band ? gauss() * 0.42 + 0.02 : rnd(-1.1, 1.1);
      // gentle spiral swirl for structure
      const rr = Math.hypot(x, y), ang = Math.atan2(y, x) + rr * 0.9;
      x = Math.cos(ang) * rr; y = Math.sin(ang) * rr;
      dir[i * 2] = x; dir[i * 2 + 1] = y;
      zA[i] = Math.random();
      const big = Math.random();
      size[i] = 0.9 + big * big * big * 6.0;
      bri[i] = rnd(0.35, 0.9);
      const c = Math.random();
      col[i] = c < 0.6 ? 0 : c < 0.82 ? 1 : c < 0.95 ? 2 : 3;
      if (col[i] === 3) { size[i] += 5; bri[i] *= 0.5; } // nebula motes: bigger, softer
    }
    const buf = (data: Float32Array, name: string, n: number) => {
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, name); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, 0, 0);
    };
    buf(dir, 'a_dir', 2); buf(zA, 'a_z', 1); buf(size, 'a_size', 1); buf(bri, 'a_bright', 1); buf(col, 'a_col', 1);
    const uCam = gl.getUniformLocation(prog, 'u_cam');
    const uPx = gl.getUniformLocation(prog, 'u_px');
    const uDim = gl.getUniformLocation(prog, 'u_dim');
    const uAspect = gl.getUniformLocation(prog, 'u_aspect');
    const uOff = gl.getUniformLocation(prog, 'u_off');
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.clearColor(0, 0, 0, 0);

    let dpr = 1;
    resizeGL = () => {
      dpr = Math.min(window.devicePixelRatio || 1, perf === 'low' ? 1.4 : 2);
      const w = canvas.clientWidth || section.clientWidth, h = canvas.clientHeight || window.innerHeight;
      canvas.width = Math.floor(w * dpr); canvas.height = Math.floor(h * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      const a = canvas.width / canvas.height;
      // fill the frame: keep points spread across the wider axis
      gl.uniform2f(uAspect, a >= 1 ? 1 : a, a >= 1 ? 1 / a : 1);
      gl.uniform1f(uPx, dpr);
    };
    resizeGL();
    renderGL = (p: number, tSec: number) => {
      const cam = p * 2.4 + tSec * 0.012; // dive with progress + gentle constant drift
      const dim = lerp(1.0, 0.32, clamp((p - 0.28) / 0.34)); // fade stars behind the planet scenes
      gl.uniform1f(uCam, cam);
      gl.uniform1f(uDim, dim);
      gl.uniform2f(uOff, offX, offY);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.POINTS, 0, Math.floor(drawCount));
    };
  } else if (canvas) {
    // Canvas2D fallback — layered parallax starfield
    const ctx = canvas.getContext('2d');
    if (ctx) {
      let stars: { x: number; y: number; z: number; s: number; b: number }[] = [];
      let dpr = 1, W = 0, H = 0;
      const build = () => {
        const n = perf === 'low' ? 260 : 620;
        stars = Array.from({ length: n }, () => ({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: Math.random(), s: Math.random() * 1.6 + 0.4, b: Math.random() * 0.6 + 0.3 }));
      };
      resizeGL = () => { dpr = Math.min(window.devicePixelRatio || 1, 1.5); W = canvas.width = section.clientWidth * dpr; H = canvas.height = window.innerHeight * dpr; };
      build(); resizeGL();
      render2d = (p: number, tSec: number) => {
        ctx.clearRect(0, 0, W, H); ctx.save(); ctx.translate(W / 2, H / 2);
        const cam = p * 1.2 + tSec * 0.01, dim = lerp(1, 0.4, clamp((p - 0.28) / 0.34));
        for (const st of stars) {
          const f = ((st.z - cam) % 1 + 1) % 1, zz = f * 0.985 + 0.015;
          const x = (st.x / zz) * (W / 2), y = (st.y / zz) * (H / 2);
          if (x < -W / 2 || x > W / 2 || y < -H / 2 || y > H / 2) continue;
          const a = st.b * (1 - f) * dim;
          ctx.globalAlpha = Math.max(0, a); ctx.fillStyle = '#dfe8ff';
          ctx.beginPath(); ctx.arc(x, y, (st.s / zz) * dpr, 0, 6.28); ctx.fill();
        }
        ctx.restore(); ctx.globalAlpha = 1;
      };
    }
  }

  // ─── progress source ──────────────────────────────────────────────────────
  let autoP = 0;          // internal timeline value
  let autoDir = 1;        // boomerang direction (+1 dive in, -1 zoom back out)
  let autoHold = 0;       // ms pause at each end
  let inView = false;
  let hasArmed = false;   // auto: has the current pass started
  const AUTO_DUR = 17;    // seconds per direction (comfortable)
  const AUTO_HOLD = 1200; // ms pause at Bekasi / at the galaxy before reversing
  const scrollP = () => {
    const rect = section.getBoundingClientRect();
    const total = section.offsetHeight - window.innerHeight;
    return total > 0 ? clamp(-rect.top / total) : 0;
  };

  // ─── scene + hud update ───────────────────────────────────────────────────
  let lastStage = -1;
  function paint(p: number) {
    for (const s of scenes) {
      const [a, b] = s.range;
      const o = seg(p, a - 0.02, a + 0.06, b - 0.06, b + 0.03);
      s.el.style.opacity = String(o);
      if (o > 0.001) {
        const lp = clamp((p - a) / (b - a));
        const sc = lerp(s.sIn, s.sOut, easeInOut(lp)) * zoomK;
        s.g.setAttribute('transform', `translate(${500 - s.t[0] * sc} ${500 - s.t[1] * sc}) scale(${sc.toFixed(3)})`);
      }
    }
    // core + nebula fade with the galaxy stage
    if (core) core.style.opacity = String(lerp(1, 0, clamp((p - 0.04) / 0.24)));
    nebs.forEach((n, i) => (n.style.opacity = String(lerp(0.9, 0.12, clamp((p - 0.05) / (0.4 + i * 0.08))))));
    // stage label + rail
    let idx = 0; while (idx < stageBreaks.length && p >= stageBreaks[idx]) idx++;
    if (idx !== lastStage) {
      lastStage = idx;
      if (stageEl) stageEl.textContent = stageNames[idx];
      rail.forEach((li, i) => li.classList.toggle('is-active', i === idx));
    }
    if (bar) bar.style.width = (p * 100).toFixed(1) + '%';
  }

  // ─── loop + graceful degradation ──────────────────────────────────────────
  let raf = 0, t0 = performance.now(), ema = 16, last = t0, slow = 0;
  function frame(now: number) {
    const dt = now - last; last = now;
    ema = ema * 0.9 + dt * 0.1;
    // dynamic quality: if High struggles, shed particles (never below a floor)
    if (perf === 'high') {
      if (ema > 26) { slow += dt; if (slow > 1400 && drawCount > 2200) { drawCount *= 0.82; slow = 0; if (drawCount < budgets.low) section.classList.add('jr--eco'); } }
      else slow = Math.max(0, slow - dt);
    }
    // ramp drawCount toward target after a perf switch
    if (Math.abs(drawCount - targetCount) > 20) drawCount += (targetCount - drawCount) * 0.06;

    let p: number;
    if (anim === 'manual') {
      p = scrollP();
    } else {
      // seamless boomerang: dive galaxy → Bekasi, hold, zoom back out, hold, repeat
      if (inView && hasArmed) {
        if (autoHold > 0) autoHold -= dt;
        else {
          autoP += (autoDir * dt) / 1000 / AUTO_DUR;
          if (autoP >= 1) { autoP = 1; autoDir = -1; autoHold = AUTO_HOLD; }
          else if (autoP <= 0) { autoP = 0; autoDir = 1; autoHold = AUTO_HOLD; }
        }
      }
      p = autoP;
    }
    // ease the interactive camera offset toward its pointer/gyro target
    offX += (offTX - offX) * 0.06;
    offY += (offTY - offY) * 0.06;
    // cohere the depth: nebula clouds drift at their own rate (GL stars parallax
    // in the shader), so the scene feels layered rather than flat.
    if (Math.abs(offX) > 0.0002 || Math.abs(offY) > 0.0002) {
      const nx = offX * 900, ny = offY * 900;
      nebs.forEach((n, i) => {
        const k = 1.4 + i * 0.5;
        n.style.transform = `translate3d(${(nx * k).toFixed(1)}px, ${(ny * k).toFixed(1)}px, 0)`;
      });
    }

    const tSec = (now - t0) / 1000;
    if (renderGL) renderGL(p, tSec); else if (render2d) render2d(p, tSec);
    paint(p);
    raf = requestAnimationFrame(frame);
  }

  function start() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }

  // observe visibility (drives auto timeline + pauses render offscreen)
  const io = new IntersectionObserver(
    (ents) => {
      for (const e of ents) {
        inView = e.isIntersecting;
        if (inView) { if (anim === 'auto' && !hasArmed) hasArmed = true; start(); }
        else stop();
      }
    },
    { threshold: 0 }
  );
  io.observe(section);

  // ─── external controls (Performance / Animation / restart) ────────────────
  window.addEventListener('exp:perf', (e: any) => {
    perf = e.detail?.perf === 'low' ? 'low' : 'high';
    targetCount = budgets[perf];
    if (perf === 'high') { drawCount = Math.max(drawCount, budgets.low); section.classList.remove('jr--eco'); slow = 0; }
    resizeGL && resizeGL();
  });
  window.addEventListener('exp:anim', (e: any) => {
    const next = e.detail?.anim === 'manual' ? 'manual' : 'auto';
    if (next === anim) return;
    anim = next;
    if (anim === 'auto') { autoP = scrollP(); hasArmed = inView; } // continue from where scroll left off
  });
  window.addEventListener('exp:restart', () => {
    autoP = 0; autoDir = 1; autoHold = 0; hasArmed = false; lastStage = -1; paint(0);
    // re-arm once the section is back in view after the scroll-to-top
    setTimeout(() => { if (anim === 'auto' && inView) hasArmed = true; }, 60);
  });

  window.addEventListener('resize', () => { computeZoomK(); resizeGL && resizeGL(); }, { passive: true });

  // ─── interactive camera input (pointer on desktop, tilt on mobile) ─────────
  const amp = () => (perf === 'low' ? 0.014 : 0.022);
  section.addEventListener(
    'pointermove',
    (e) => {
      if ((e as PointerEvent).pointerType === 'touch') return;
      const a = amp();
      offTX = ((e as PointerEvent).clientX / window.innerWidth - 0.5) * a * 2;
      offTY = -((e as PointerEvent).clientY / window.innerHeight - 0.5) * a * 2;
    },
    { passive: true }
  );
  section.addEventListener('pointerleave', () => { offTX = 0; offTY = 0; });
  // Device tilt (best-effort; iOS needs a permission gesture we don't force).
  window.addEventListener(
    'deviceorientation',
    (e) => {
      if (e.gamma == null || e.beta == null) return;
      const a = amp();
      offTX = clamp(e.gamma / 30, -1, 1) * a;
      offTY = clamp((e.beta - 45) / 30, -1, 1) * a;
    },
    { passive: true }
  );

  paint(0);

  // QA / debug hook
  (window as any).__journey = {
    setProgress(p: number) { stop(); anim = 'manual-frozen' as any; if (renderGL) renderGL(p, 2); else if (render2d) render2d(p, 2); paint(p); },
    resume() { anim = root.getAttribute('data-anim') === 'manual' ? 'manual' : 'auto'; start(); },
  };
}
