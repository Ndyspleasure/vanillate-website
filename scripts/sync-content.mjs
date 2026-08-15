// ════════════════════════════════════════════════════════════════════════════
// SYNC KONTEN DARI SUPABASE → WEBSITE
//
// Menarik tabel `site_content` (yang diedit lewat panel /admin) lalu menulisnya
// ke src/data/synced/site-content.json. Dipakai GitHub Actions
// (.github/workflows/sync-content.yml), terjadwal + manual.
//
// Kenapa lewat build, bukan dibaca langsung di browser pengunjung?
//   Website ini statis dan tabel site_content dijaga RLS — hanya admin yang
//   boleh membacanya. Kalau halaman publik membacanya langsung, tabel itu harus
//   dibuka untuk anon, dan panel admin kehilangan sebagian gunanya. Menariknya
//   saat build membuat pengunjung cukup menerima HTML biasa: nol query, nol
//   kunci, dan halaman tetap cepat.
//
// Skrip ini memakai SERVICE ROLE KEY, yang mem-bypass RLS. Kunci itu hanya
// boleh hidup sebagai GitHub Actions secret — jangan pernah masuk ke kode
// website atau ikut ter-bundle ke browser.
// ════════════════════════════════════════════════════════════════════════════

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_FILE = path.join(ROOT, 'src', 'data', 'synced', 'site-content.json');

const URL_SUPABASE = (process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

/** Bentuk aman saat konten belum bisa diambil. Situs tetap bisa di-build. */
const KOSONG = { announcement: { enabled: false, text: '', url: '' } };

function tulis(data) {
  // Serialisasi deterministik: bila isinya sama, file-nya identik, jadi tidak
  // ada diff palsu yang memicu deploy sia-sia.
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

/** Pertahankan file lama bila ada — lebih baik konten basi daripada hilang. */
function pertahankanYangLama(alasan) {
  console.error(`✗ ${alasan}`);
  if (fs.existsSync(OUT_FILE)) {
    console.error('  → mempertahankan site-content.json yang sudah ada.');
    process.exit(0);
  }
  console.error('  → belum ada file sebelumnya, menulis konten kosong.');
  tulis(KOSONG);
  process.exit(0);
}

if (!URL_SUPABASE || !SERVICE_KEY) {
  pertahankanYangLama('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diisi.');
}

// fetch melempar (bukan sekadar mengembalikan status) saat DNS gagal, koneksi
// putus, atau timeout — jadi harus ditangkap. Kalau tidak, workflow mati dan
// deploy ikut gagal hanya karena Supabase sedang tidak bisa dihubungi.
let res;
try {
  res = await fetch(`${URL_SUPABASE}/rest/v1/site_content?select=key,value,kind`, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(20_000),
  });
} catch (err) {
  pertahankanYangLama(`Tidak bisa menghubungi Supabase: ${err.message}`);
}

if (!res.ok) {
  pertahankanYangLama(`Supabase menjawab ${res.status} ${res.statusText}.`);
}

let baris;
try {
  baris = await res.json();
} catch {
  pertahankanYangLama('Jawaban Supabase bukan JSON yang valid.');
}

if (!Array.isArray(baris)) {
  pertahankanYangLama('Bentuk data tidak sesuai (bukan array).');
}

// Ubah daftar key/value jadi objek yang enak dipakai di template Astro.
const nilai = Object.fromEntries(baris.map((r) => [r.key, r.value]));

const hasil = {
  announcement: {
    enabled: nilai.announcement_enabled === 'true',
    // Dibatasi panjangnya: ini banner satu baris, bukan artikel.
    text: String(nilai.announcement_text ?? '').trim().slice(0, 200),
    url: String(nilai.announcement_url ?? '').trim(),
  },
};

// Banner tanpa teks tidak ada gunanya — anggap saja mati.
if (!hasil.announcement.text) hasil.announcement.enabled = false;

// Hanya izinkan tautan http(s) atau path internal. Nilai ini berasal dari input
// admin dan akan jadi href; menolak skema lain menutup pintu `javascript:`.
const u = hasil.announcement.url;
if (u && !/^https?:\/\//i.test(u) && !u.startsWith('/')) {
  console.warn(`! Tautan pengumuman diabaikan (skema tidak diizinkan): ${u}`);
  hasil.announcement.url = '';
}

tulis(hasil);
console.log('✓ site-content.json diperbarui.');
console.log(`  pengumuman: ${hasil.announcement.enabled ? 'aktif' : 'mati'}`);
