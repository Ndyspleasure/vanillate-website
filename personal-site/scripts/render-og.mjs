// Render public/og-image.png (1200×630) dari scripts/og-template.html.
//
// Cara pakai:
//   node scripts/render-og.mjs
//
// Butuh Chromium. Set CHROME_BIN bila binari tidak ditemukan otomatis, mis:
//   CHROME_BIN=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node scripts/render-og.mjs
//
// Catatan teknis: headless Chromium melayout viewport ~100px lebih pendek dari
// tinggi window, tetapi menulis PNG setinggi window. Karena itu template
// dirender pada window 1200×730 (viewport ≈ 630, area terpakai penuh) lalu
// di-crop ke 1200×630 baris teratas.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const template = join(here, 'og-template.html');
const outPng = join(here, '..', 'public', 'og-image.png');

const candidates = [
  process.env.CHROME_BIN,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
].filter(Boolean);
const chrome = candidates.find((p) => existsSync(p));
if (!chrome) {
  console.error('Chromium tidak ditemukan. Set CHROME_BIN ke path binari Chromium.');
  process.exit(1);
}

const work = mkdtempSync(join(tmpdir(), 'og-'));
const raw = join(work, 'raw.png');

execFileSync(chrome, [
  '--headless', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
  '--force-device-scale-factor=1',
  `--screenshot=${raw}`, '--window-size=1200,730',
  `file://${template}`,
], { stdio: 'ignore' });

// Crop 1200×730 → 1200×630 (baris teratas) memakai pngjs (dipasang on-demand).
let PNG;
try {
  ({ PNG } = await import('pngjs'));
} catch {
  execFileSync('npm', ['i', 'pngjs', '--no-save'], { cwd: join(here, '..'), stdio: 'ignore' });
  ({ PNG } = await import('pngjs'));
}
const src = PNG.sync.read(readFileSync(raw));
const W = 1200, H = 630;
const out = new PNG({ width: W, height: H });
src.data.copy(out.data, 0, 0, W * H * 4); // width sama → H baris teratas = W*H*4 byte pertama
writeFileSync(outPng, PNG.sync.write(out));
console.log(`OK → ${outPng} (${W}×${H})`);
