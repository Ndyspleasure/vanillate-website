// Uji manual dan pengukuran Vanillate Dashboard dengan data fixture (tanpa
// Supabase sungguhan). Butuh Playwright + Chromium (tidak dipasang oleh repo ini).
//
//   BLOG_FIXTURE=tests/fixtures/blog.json BLOG_ALLOW_EMPTY=1 \
//   PUBLIC_BOT_SUPABASE_URL=https://fixture.supabase.test PUBLIC_BOT_SUPABASE_ANON_KEY=anon-fixture \
//   npx astro build
//   node scripts/dashboard-fixture/run.mjs measure          # jumlah request per skenario
//   node scripts/dashboard-fixture/run.mjs check            # overflow dan target sentuh di 360/390/768/1440
//   node scripts/dashboard-fixture/run.mjs shots <folder>   # tangkapan layar
//
// Opsi: DIST=<folder hasil build> (bawaan ./dist).

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { auditRows, GUILD_ID, guildData, serversResponse, shareDashboard } from './fixture.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const DIST = path.resolve(process.env.DIST ?? 'dist');
const API = 'https://fixture.supabase.test';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };

function serve() {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(DIST, p);
    if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      return res.end('not found');
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, origin: `http://127.0.0.1:${server.address().port}` })));
}

/** Sesi palsu di localStorage (klien dashboard hanya membaca, tidak memverifikasi JWT). */
function sessionScript() {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 86400 * 30;
  const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'fixture-user', role: 'authenticated', exp })}.fixture`;
  const session = { access_token: token, refresh_token: 'fixture-refresh', token_type: 'bearer', expires_in: 86400 * 30, expires_at: exp, user: { id: 'fixture-user', aud: 'authenticated', role: 'authenticated', email: 'fixture@example.test', app_metadata: { provider: 'discord' }, user_metadata: {}, identities: [] } };
  return `localStorage.setItem('vanillate-dashboard-auth', ${JSON.stringify(JSON.stringify(session))});`;
}

/** Backend palsu. `state` bisa diubah skenario (mis. revisi belum diterapkan). */
async function mockApi(context, state, sim) {
  const log = [];
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  await context.route(`${API}/**`, async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    sim.inflight += 1;
    const url = new URL(req.url());
    const name = url.pathname.replace(/^\/(rest\/v1\/rpc|functions\/v1|auth\/v1)\//, '');
    let body = {};
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      const now = Date.now() + sim.offset;
      if (name === 'guild_dashboard_get') body = state.guild(now);
      else if (name === 'guild_config_audit_list') body = auditRows(now);
      else if (name === 'share_dashboard_get') body = shareDashboard(now);
      else if (name === 'guild_config_save') body = state.save(now);
      else if (name === 'guild_dashboard_request_refresh' || name === 'guild_config_request_resync') body = state.request?.(name, now) ?? { ok: true, bot_online: true };
      else body = { ok: true, id: 1 };
    } else if (name === 'dashboard-discord') body = serversResponse();
    else if (name === 'settings') body = { external: { discord: true } };
    const text = JSON.stringify(body);
    log.push({ name, bytes: Buffer.byteLength(text), at: Date.now() + sim.offset });
    await route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: text });
    sim.inflight -= 1;
  });
  return log;
}

const counts = (log) => {
  const out = {};
  for (const r of log) out[r.name] = (out[r.name] ?? 0) + 1;
  return out;
};

async function open(browser, origin, { viewport = { width: 1280, height: 900 }, hash = '', pageUrl, state, clock = false, dark = false } = {}) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, colorScheme: dark ? 'dark' : 'light' });
  await context.addInitScript(sessionScript());
  if (dark) await context.addInitScript(`localStorage.setItem('theme','dark');`);
  const st = state ?? { guild: (now) => guildData(now), save: () => ({ ok: true, changed: true, revision: 13, sync_status: 'SYNCING', warnings: [] }) };
  const sim = { offset: 0, inflight: 0 };
  const log = await mockApi(context, st, sim);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  if (clock) await page.clock.install();
  await page.goto(pageUrl ?? `${origin}/dashboard/server/?id=${GUILD_ID}${hash}`);
  await page.waitForSelector('[data-region="header"], [data-action="refresh"]', { timeout: 15000 });
  /** Majukan jam palsu sedikit demi sedikit supaya balasan jaringan sempat diproses. */
  const advance = async (ms, stepMs = 2500) => {
    for (let t = 0; t < ms; t += stepMs) {
      await page.clock.runFor(stepMs);
      sim.offset += stepMs;
      do await page.evaluate(() => new Promise((r) => queueMicrotask(r)));
      while (sim.inflight > 0);
      await page.evaluate(() => new Promise((r) => queueMicrotask(r)));
    }
  };
  return { context, page, log, errors, advance };
}

// ─── measure ─────────────────────────────────────────────────────────────────

async function measure(browser, origin) {
  const out = {};
  const run = async (label, fn) => {
    out[label] = await fn();
    console.log(label, JSON.stringify(out[label]));
  };

  await run('A. buka Ringkasan lalu diam 1 jam (tab terlihat)', async () => {
    const { context, log, errors, advance } = await open(browser, origin, { clock: true });
    await advance(3600_000);
    const r = { requests: counts(log), total: log.length, bytes: log.reduce((a, x) => a + x.bytes, 0), errors: errors.length };
    await context.close();
    return r;
  });

  await run('B. tab Share Server terbuka, lalu tab browser tersembunyi 1 jam', async () => {
    const { context, page, log, advance } = await open(browser, origin, { clock: true, hash: '#share-server' });
    await advance(5000);
    const before = log.length;
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await advance(3600_000);
    const r = { saatTersembunyi: counts(log.slice(before)), totalSaatTersembunyi: log.length - before };
    await context.close();
    return r;
  });

  await run('C. keliling semua tab sekali (tanpa menunggu)', async () => {
    const { context, page, log } = await open(browser, origin);
    for (const t of ['game-hub', 'social-hub', 'verification', 'leveling', 'autorole', 'welcome', 'security', 'share-server', 'channels', 'audit-log', 'share-server', 'audit-log', 'overview']) {
      await page.evaluate((h) => { location.hash = h; }, t);
      await page.waitForTimeout(250);
    }
    const r = { requests: counts(log), total: log.length };
    await context.close();
    return r;
  });

  await run('D. simpan, bot menerapkan setelah 8 detik, lalu diam 10 menit', async () => {
    let savedAt = 0;
    const state = {
      guild: (now) => {
        const g = guildData(now);
        if (savedAt) {
          g.config.revision = 13;
          g.state.GAME_UNO.enabled = false;
          g.config.updated_at = new Date(savedAt).toISOString();
          if (now - savedAt >= 8000) { g.config.applied_revision = 13; g.config.applied_at = new Date(savedAt + 8000).toISOString(); }
          else g.config.sync_status = 'SYNCING';
        }
        return g;
      },
      save: (now) => { savedAt = now; return { ok: true, changed: true, revision: 13, sync_status: 'SYNCING', warnings: [] }; },
    };
    const { context, page, log, advance } = await open(browser, origin, { clock: true, hash: '#game-hub', state });
    await page.waitForSelector('[data-toggle="GAME_UNO"]');
    const before = log.length;
    await page.click('[data-toggle="GAME_UNO"]');
    await page.click('[data-action="save"]');
    await advance(600_000);
    const r = { requests: counts(log.slice(before)), total: log.length - before };
    await context.close();
    return r;
  });

  await run('E. Share Server terbuka dan diam 1 jam', async () => {
    const { context, log, advance } = await open(browser, origin, { clock: true, hash: '#share-server' });
    await advance(3600_000);
    const r = { requests: counts(log), total: log.length };
    await context.close();
    return r;
  });
  return out;
}

// ─── check & shots ───────────────────────────────────────────────────────────

const VIEWPORTS = [{ width: 360, height: 740 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }];
const TABS = ['overview', 'game-hub', 'social-hub', 'verification', 'leveling', 'autorole', 'welcome', 'security', 'share-server', 'channels', 'audit-log'];

async function inspect(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const small = [];
    for (const el of document.querySelectorAll('[data-dashboard] button, [data-dashboard] a[href].inline-flex, [data-dashboard] select, [data-dashboard] input:not([type=checkbox]):not([type=radio]):not([type=color]), [data-dashboard] summary')) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (r.height < 43.5) small.push(`${el.tagName.toLowerCase()}[${(el.getAttribute('data-action') || el.getAttribute('data-tab') || el.textContent || '').trim().slice(0, 24)}] ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    return { overflow: doc.scrollWidth - doc.clientWidth, height: doc.scrollHeight, small: [...new Set(small)] };
  });
}

async function check(browser, origin, shotsDir) {
  let bad = 0;
  for (const viewport of VIEWPORTS) {
    for (const dark of shotsDir ? [false, true] : [false]) {
      const { context, page, errors } = await open(browser, origin, { viewport, dark });
      for (const t of TABS) {
        await page.evaluate((h) => { location.hash = h; }, t);
        await page.waitForTimeout(350);
        const r = await inspect(page);
        const touch = viewport.width < 640 ? r.small : [];
        if (r.overflow > 0 || touch.length) bad += 1;
        if (!dark) console.log(`${viewport.width}px #${t}: overflow ${r.overflow}px, tinggi ${r.height}px${touch.length ? `, target <44px: ${touch.join(' | ')}` : ''}`);
        if (shotsDir && (viewport.width === 390 || viewport.width === 1440)) {
          await page.screenshot({ path: path.join(shotsDir, `${viewport.width}${dark ? '-gelap' : ''}-${t}.png`), fullPage: true });
          if (t === 'game-hub' && !dark) {
            await page.click('[data-toggle="GAME_UNO"]');
            await page.click('[data-action="review"]');
            await page.screenshot({ path: path.join(shotsDir, `${viewport.width}-layar-tinjau.png`) });
            await page.click('[data-action="discard"]');
          }
        }
      }
      if (errors.length) { bad += 1; console.log('ERROR JS:', errors.join('\n')); }
      await context.close();
    }
    const list = await open(browser, origin, { viewport, pageUrl: `${origin}/dashboard/` });
    const r = await inspect(list.page);
    console.log(`${viewport.width}px /dashboard: overflow ${r.overflow}px${viewport.width < 640 && r.small.length ? `, target <44px: ${r.small.join(' | ')}` : ''}`);
    if (shotsDir && (viewport.width === 390 || viewport.width === 1440)) await list.page.screenshot({ path: path.join(shotsDir, `${viewport.width}-daftar-server.png`), fullPage: true });
    await list.context.close();
  }
  return bad;
}

const mode = process.argv[2] ?? 'measure';
const { server, origin } = await serve();
const browser = await chromium.launch();
let exit = 0;
try {
  if (mode === 'measure') await measure(browser, origin);
  else if (mode === 'check') exit = (await check(browser, origin, null)) ? 1 : 0;
  else if (mode === 'shots') {
    const dir = path.resolve(process.argv[3] ?? 'dashboard-shots');
    fs.mkdirSync(dir, { recursive: true });
    await check(browser, origin, dir);
    console.log('tangkapan layar di', dir);
  } else console.log('mode: measure | check | shots <folder>');
} finally {
  await browser.close();
  server.close();
}
process.exit(exit);
