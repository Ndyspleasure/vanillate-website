// ════════════════════════════════════════════════════════════════════════════
// SYNC KONTEN DARI SUPABASE → WEBSITE
//
// Menarik konten yang diedit lewat panel /admin lalu menulisnya ke
// src/data/synced/*.json. Dipakai GitHub Actions
// (.github/workflows/sync-content.yml), terjadwal + manual.
//
// Dua keluaran:
//   • site-content.json  ← tabel `site_content`      (banner pengumuman)
//   • partnership.json   ← tabel `partnership_*`     (konten & HARGA halaman
//                                                     publik /partnership)
//
// Kenapa lewat build, bukan dibaca langsung di browser pengunjung?
//   Website ini statis dan tabel-tabel itu dijaga RLS — hanya admin yang boleh
//   membacanya. Kalau halaman publik membacanya langsung, tabelnya harus dibuka
//   untuk anon, dan panel admin kehilangan sebagian gunanya. Menariknya saat
//   build membuat pengunjung cukup menerima HTML biasa: nol query, nol kunci.
//
// Skrip ini memakai SERVICE ROLE KEY, yang mem-bypass RLS. Kunci itu hanya
// boleh hidup sebagai GitHub Actions secret — jangan pernah masuk ke kode
// website atau ikut ter-bundle ke browser.
//
// PENTING: skrip ini TIDAK BOLEH menggagalkan build. Setiap keluaran dijaga
// sendiri-sendiri: bila satu gagal ditarik, file lamanya dipertahankan dan
// keluaran lain tetap diproses. Selalu exit 0.
// ════════════════════════════════════════════════════════════════════════════

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DIR_SYNCED = path.join(ROOT, 'src', 'data', 'synced');

const FILE_KONTEN = path.join(DIR_SYNCED, 'site-content.json');
const FILE_PARTNERSHIP = path.join(DIR_SYNCED, 'partnership.json');

const URL_SUPABASE = (process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

/** Bentuk aman saat konten belum bisa diambil. Situs tetap bisa di-build. */
const KOSONG_KONTEN = { announcement: { enabled: false, text: '', url: '' } };
const KOSONG_PARTNERSHIP = {
  settings: { partnershipUrl: '', applyUrl: '' },
  products: [],
  links: [],
  content: {},
};

// ─── Util berkas ────────────────────────────────────────────────────────────

function tulis(file, data) {
  // Serialisasi deterministik: bila isinya sama, file-nya identik, jadi tidak
  // ada diff palsu yang memicu deploy sia-sia.
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

/** Pertahankan file lama bila ada — lebih baik konten basi daripada hilang. */
function pertahankanYangLama(file, kosong, alasan) {
  console.error(`✗ ${alasan}`);
  if (fs.existsSync(file)) {
    console.error(`  → mempertahankan ${path.basename(file)} yang sudah ada.`);
    return;
  }
  console.error(`  → belum ada file sebelumnya, menulis ${path.basename(file)} kosong.`);
  tulis(file, kosong);
}

// ─── Util HTTP ──────────────────────────────────────────────────────────────

/**
 * Ambil baris dari PostgREST. Melempar Error dengan pesan siap-log bila gagal,
 * supaya pemanggilnya bisa memutuskan mempertahankan file lama.
 *
 * fetch melempar (bukan sekadar mengembalikan status) saat DNS gagal, koneksi
 * putus, atau timeout — jadi harus ditangkap. Kalau tidak, workflow mati dan
 * deploy ikut gagal hanya karena Supabase sedang tidak bisa dihubungi.
 */
async function ambil(pathQuery) {
  let res;
  try {
    res = await fetch(`${URL_SUPABASE}/rest/v1/${pathQuery}`, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    throw new Error(`Tidak bisa menghubungi Supabase: ${err.message}`);
  }

  if (!res.ok) {
    throw new Error(`Supabase menjawab ${res.status} ${res.statusText} untuk ${pathQuery}.`);
  }

  let baris;
  try {
    baris = await res.json();
  } catch {
    throw new Error(`Jawaban Supabase bukan JSON yang valid untuk ${pathQuery}.`);
  }

  if (!Array.isArray(baris)) {
    throw new Error(`Bentuk data tidak sesuai (bukan array) untuk ${pathQuery}.`);
  }
  return baris;
}

/**
 * Hanya izinkan tautan http(s) atau path internal.
 *
 * Nilai ini berasal dari input admin dan akan jadi href; menolak skema lain
 * menutup pintu `javascript:`.
 */
function urlAman(nilai, konteks = 'tautan') {
  const u = String(nilai ?? '').trim();
  if (!u) return '';
  if (/^https?:\/\//i.test(u) || u.startsWith('/')) return u;
  console.warn(`! ${konteks} diabaikan (skema tidak diizinkan): ${u}`);
  return '';
}

// ─── 1. Banner pengumuman (site_content) ────────────────────────────────────

async function syncSiteContent() {
  let baris;
  try {
    baris = await ambil('site_content?select=key,value,kind');
  } catch (err) {
    pertahankanYangLama(FILE_KONTEN, KOSONG_KONTEN, err.message);
    return;
  }

  // Ubah daftar key/value jadi objek yang enak dipakai di template Astro.
  const nilai = Object.fromEntries(baris.map((r) => [r.key, r.value]));

  const hasil = {
    announcement: {
      enabled: nilai.announcement_enabled === 'true',
      // Dibatasi panjangnya: ini banner satu baris, bukan artikel.
      text: String(nilai.announcement_text ?? '').trim().slice(0, 200),
      url: urlAman(nilai.announcement_url, 'Tautan pengumuman'),
    },
  };

  // Banner tanpa teks tidak ada gunanya — anggap saja mati.
  if (!hasil.announcement.text) hasil.announcement.enabled = false;

  tulis(FILE_KONTEN, hasil);
  console.log('✓ site-content.json diperbarui.');
  console.log(`  pengumuman: ${hasil.announcement.enabled ? 'aktif' : 'mati'}`);
}

// ─── 2. Halaman & harga Partnership ─────────────────────────────────────────

/** Harga: kosong/negatif/bukan angka → null, supaya tampil "—" bukan "Rp 0". */
function hargaAman(nilai) {
  if (nilai === null || nilai === undefined || String(nilai).trim() === '') return null;
  const n = Number(nilai);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function daftarTeks(nilai, maks = 12) {
  if (!Array.isArray(nilai)) return [];
  return nilai
    .map((v) => String(v ?? '').trim())
    .filter(Boolean)
    .slice(0, maks);
}

async function syncPartnership() {
  let produkRaw, linkRaw, settingRaw, pageRaw;
  try {
    [produkRaw, linkRaw, settingRaw, pageRaw] = await Promise.all([
      ambil('partnership_products?select=key,name,tagline,description,channel,price,currency,price_unit,price_note,features,badge,cta_label,cta_mode,cta_url,enabled,sort&enabled=is.true&order=sort.asc'),
      ambil('partnership_links?select=label,url,enabled,sort&enabled=is.true&order=sort.asc'),
      ambil('partnership_settings?select=partnership_url,apply_url&id=eq.1'),
      ambil('partnership_page?select=content&id=eq.1'),
    ]);
  } catch (err) {
    pertahankanYangLama(FILE_PARTNERSHIP, KOSONG_PARTNERSHIP, err.message);
    return;
  }

  const setting = settingRaw[0] ?? {};
  const content = pageRaw[0]?.content ?? {};

  const products = produkRaw.map((p) => ({
    key: String(p.key ?? ''),
    name: String(p.name ?? '').trim(),
    tagline: String(p.tagline ?? '').trim(),
    description: String(p.description ?? '').trim(),
    channel: p.channel === 'lobby' ? 'lobby' : 'dm',
    price: hargaAman(p.price),
    currency: String(p.currency ?? 'IDR').trim() || 'IDR',
    priceUnit: String(p.price_unit ?? '').trim(),
    priceNote: String(p.price_note ?? '').trim(),
    features: daftarTeks(p.features),
    badge: String(p.badge ?? '').trim(),
    ctaLabel: String(p.cta_label ?? '').trim() || 'Ajukan Partnership',
    ctaMode: p.cta_mode === 'url' ? 'url' : 'whatsapp',
    // URL hanya dipakai saat mode 'url'; tetap disanitasi apa pun modenya.
    ctaUrl: urlAman(p.cta_url, `CTA produk ${p.key}`),
  })).filter((p) => p.key && p.name);

  const hasil = {
    settings: {
      partnershipUrl: urlAman(setting.partnership_url, 'Partnership URL'),
      applyUrl: urlAman(setting.apply_url, 'Apply URL'),
    },
    products,
    links: linkRaw
      .map((l) => ({ label: String(l.label ?? '').trim(), url: urlAman(l.url, `Custom link ${l.label}`) }))
      .filter((l) => l.label && l.url),
    content,
  };

  tulis(FILE_PARTNERSHIP, hasil);
  console.log('✓ partnership.json diperbarui.');
  console.log(`  produk aktif: ${products.length} · custom link: ${hasil.links.length}`);
}

// ─── Jalan ──────────────────────────────────────────────────────────────────

if (!URL_SUPABASE || !SERVICE_KEY) {
  const alasan = 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diisi.';
  pertahankanYangLama(FILE_KONTEN, KOSONG_KONTEN, alasan);
  pertahankanYangLama(FILE_PARTNERSHIP, KOSONG_PARTNERSHIP, alasan);
  process.exit(0);
}

// Dijalankan berurutan supaya log-nya mudah dibaca; masing-masing sudah
// menangani kegagalannya sendiri sehingga satu yang gagal tidak menjatuhkan
// yang lain, dan build tetap lanjut.
await syncSiteContent();
await syncPartnership();
process.exit(0);
