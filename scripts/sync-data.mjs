// ════════════════════════════════════════════════════════════════════════════
// SYNC DATA DARI REPO BOT → WEBSITE
//
// Menarik data "source of truth" dari repo bot (Ndyspleasure/sambung-kata-bot,
// PRIVAT) lalu menuliskannya ke src/data/synced/*.json. Dipakai oleh GitHub
// Actions (.github/workflows/sync-data.yml), terjadwal + manual.
//
// Prinsip aman (agar data website tidak pernah corrupt):
//   • Tiap file di-fetch, di-parse, lalu DIVALIDASI bentuknya.
//   • File yang gagal fetch/parse/validasi TIDAK ditimpa — versi terakhir yang
//     baik (yang sudah ter-commit di repo) dipertahankan.
//   • Output di-serialize rapi & deterministik; bila data hulu tak berubah,
//     file hasil identik → tidak ada diff → tidak ada deploy sia-sia.
//   • _status.json mencatat kapan & dari commit mana sinkron terakhir.
//
// Tanpa dependency eksternal: pakai global fetch (Node 18+) & node:fs.
// ════════════════════════════════════════════════════════════════════════════

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'src', 'data', 'synced');

const REPO = (process.env.BOT_REPO || 'Ndyspleasure/sambung-kata-bot').trim();
const BRANCH = (process.env.BOT_BRANCH || 'main').trim();
const TOKEN = process.env.BOT_REPO_TOKEN || process.env.GITHUB_TOKEN || '';
const API = 'https://api.github.com';

// ─── Validator ringan (kontrak: (data) => string[] daftar error, kosong = ok) ──
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const isNonEmptyStr = (v) => typeof v === 'string' && v.trim().length > 0;

function vShop(d) {
  const e = [];
  if (!isObj(d)) return ['bukan object'];
  if (!Array.isArray(d.items) || d.items.length === 0) return ['items harus array tidak kosong'];
  d.items.forEach((it, i) => {
    if (!isNonEmptyStr(it.id)) e.push(`items[${i}].id kosong`);
    if (!isNonEmptyStr(it.nama)) e.push(`items[${i}].nama kosong`);
    if (!Number.isFinite(it.harga) || it.harga < 0) e.push(`items[${i}].harga tidak valid`);
    if (!['boost', 'bundle', 'special'].includes(it.kategori)) e.push(`items[${i}].kategori tidak valid`);
  });
  return e;
}

function vBotInfo(d) {
  const e = [];
  if (!isObj(d)) return ['bukan object'];
  if (!Array.isArray(d.features) || d.features.length === 0) e.push('features harus array tidak kosong');
  if (!Array.isArray(d.commands) || d.commands.length === 0) e.push('commands harus array tidak kosong');
  (d.commands || []).forEach((c, i) => {
    if (!isNonEmptyStr(c?.name)) e.push(`commands[${i}].name kosong`);
  });
  return e;
}

function vVersion(d) {
  if (!isObj(d)) return ['bukan object'];
  return isNonEmptyStr(d.version) ? [] : ['version kosong'];
}

function vChangelog(d) {
  if (!Array.isArray(d) || d.length === 0) return ['changelog harus array tidak kosong'];
  const e = [];
  d.slice(0, 5).forEach((c, i) => {
    if (!isNonEmptyStr(c?.version)) e.push(`entri[${i}].version kosong`);
  });
  return e;
}

// ─── Target sinkronisasi ───────────────────────────────────────────────────────
const TARGETS = [
  { name: 'shop', src: 'config-data/shop.json', out: 'shop.json', validate: vShop },
  { name: 'botInfo', src: 'config-data/bot-info.json', out: 'bot-info.json', validate: vBotInfo },
  { name: 'version', src: 'version.json', out: 'version.json', validate: vVersion },
  { name: 'changelog', src: 'CHANGELOG.json', out: 'changelog.json', validate: vChangelog },
];

// ─── Util GitHub ───────────────────────────────────────────────────────────────
function headers(accept) {
  const h = {
    Accept: accept,
    'User-Agent': 'vanillate-website-sync',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (TOKEN) h.Authorization = `Bearer ${TOKEN}`;
  return h;
}

async function fetchRaw(srcPath) {
  const url = `${API}/repos/${REPO}/contents/${srcPath.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(BRANCH)}`;
  const res = await fetch(url, { headers: headers('application/vnd.github.raw') });
  if (!res.ok) {
    const hint = res.status === 404
      ? '404 (file/branch tidak ada, atau token tidak punya akses ke repo privat)'
      : res.status === 401 || res.status === 403
        ? `${res.status} (auth/rate-limit — cek secret BOT_REPO_TOKEN)`
        : `HTTP ${res.status}`;
    throw new Error(hint);
  }
  return res.text();
}

async function fetchSha() {
  const url = `${API}/repos/${REPO}/commits/${encodeURIComponent(BRANCH)}`;
  const res = await fetch(url, { headers: headers('application/vnd.github.sha') });
  if (!res.ok) throw new Error(`gagal ambil SHA: HTTP ${res.status}`);
  return (await res.text()).trim();
}

function writeJson(absFile, data) {
  fs.writeFileSync(absFile, JSON.stringify(data, null, 2) + '\n');
}

// ─── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`[sync] Sumber: ${REPO}@${BRANCH}${TOKEN ? ' (auth)' : ' (tanpa token)'}`);

  let sourceCommit = null;
  try {
    sourceCommit = await fetchSha();
    console.log(`[sync] Commit sumber: ${sourceCommit.slice(0, 7)}`);
  } catch (err) {
    console.error(`[sync] ⚠ ${err.message}`);
  }

  const fileStatus = [];
  let okCount = 0;

  for (const t of TARGETS) {
    const outAbs = path.join(OUT_DIR, t.out);
    try {
      const raw = await fetchRaw(t.src);
      let data;
      try { data = JSON.parse(raw); }
      catch (err) { throw new Error(`JSON tidak valid: ${err.message}`); }

      const errs = t.validate(data);
      if (errs.length) throw new Error(`validasi gagal: ${errs.slice(0, 3).join('; ')}`);

      writeJson(outAbs, data);
      okCount++;
      fileStatus.push({ name: t.name, src: t.src, out: t.out, ok: true });
      console.log(`[sync] ✓ ${t.name} (${t.src})`);
    } catch (err) {
      const kept = fs.existsSync(outAbs);
      fileStatus.push({ name: t.name, src: t.src, out: t.out, ok: false, error: err.message, keptLastGood: kept });
      console.error(`[sync] ✗ ${t.name}: ${err.message}${kept ? ' — pakai data lama (last-good)' : ' — belum ada data lama!'}`);
    }
  }

  // Status selalu ditulis (tetapi hanya di-commit workflow bila file DATA berubah).
  const status = {
    lastSyncedAt: new Date().toISOString(),
    sourceRepo: REPO,
    sourceBranch: BRANCH,
    sourceCommit,
    sourceCommitShort: sourceCommit ? sourceCommit.slice(0, 7) : null,
    ok: okCount === TARGETS.length,
    okCount,
    total: TARGETS.length,
    files: fileStatus,
  };
  writeJson(path.join(OUT_DIR, '_status.json'), status);

  console.log(`[sync] Selesai: ${okCount}/${TARGETS.length} file berhasil.`);

  // Hard-fail hanya bila TIDAK ADA satu pun file berhasil (mis. token/jaringan
  // total bermasalah) → job Action merah sebagai alarm. Tidak ada data corrupt
  // karena file gagal tidak pernah ditimpa.
  if (okCount === 0) {
    console.error('[sync] ❌ Tidak ada file yang berhasil disinkron.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[sync] Fatal:', err.message);
  process.exit(1);
});
