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
const FILE_PRODUCTS = path.join(DIR_SYNCED, 'products.json');

const URL_SUPABASE = (process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

/** Bentuk aman saat konten belum bisa diambil. Situs tetap bisa di-build. */
const KOSONG_KONTEN = { announcement: { enabled: false, text: '', url: '' } };
const KOSONG_PARTNERSHIP = {
  settings: { partnershipUrl: '', applyUrl: '' },
  categories: [],
  products: [],
  links: [],
  content: {},
};
const KOSONG_PRODUCTS = { products: [] };

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
 * Ambil dengan kolom opsional.
 *
 * Kolom baru (mis. `category`) baru ada setelah schema terbaru dijalankan. Di
 * database yang belum dimigrasi PostgREST menjawab 400 untuk seluruh query —
 * itu akan menjatuhkan sinkronisasi harga hanya karena satu kolom. Jadi bila
 * percobaan pertama gagal, ulangi tanpa kolom opsional tersebut.
 */
async function ambilLonggar(tabel, kolomWajib, kolomOpsional, ekor) {
  const semua = [...kolomWajib, ...kolomOpsional].join(',');
  try {
    return await ambil(`${tabel}?select=${semua}${ekor}`);
  } catch (err) {
    if (kolomOpsional.length === 0) throw err;
    console.warn(`  ! ${tabel}: kolom ${kolomOpsional.join(', ')} belum ada — memakai kolom lama (${err.message})`);
    return await ambil(`${tabel}?select=${kolomWajib.join(',')}${ekor}`);
  }
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

/**
 * Harga: kosong/bukan angka → null, supaya tampil "—" bukan "Rp 0".
 *
 * TANPA batas nominal — nilai sebesar/sekecil apa pun diteruskan apa adanya,
 * termasuk pecahan. Yang disaring hanya yang bukan angka; `0` sengaja
 * dipertahankan karena artinya "gratis", bukan "belum diisi".
 */
function hargaAman(nilai) {
  if (nilai === null || nilai === undefined || String(nilai).trim() === '') return null;
  const n = Number(nilai);
  return Number.isFinite(n) ? n : null;
}

/** Minimum order: bilangan bulat, tanpa batas atas; bukan angka → null. */
function minimumAman(nilai) {
  if (nilai === null || nilai === undefined || String(nilai).trim() === '') return null;
  const n = Number(nilai);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function daftarTeks(nilai, maks = 12) {
  if (!Array.isArray(nilai)) return [];
  return nilai
    .map((v) => String(v ?? '').trim())
    .filter(Boolean)
    .slice(0, maks);
}

async function syncPartnership() {
  let produkRaw, linkRaw, settingRaw, pageRaw, kategoriRaw;
  try {
    [produkRaw, linkRaw, settingRaw, pageRaw] = await Promise.all([
      ambilLonggar(
        'partnership_products',
        ['key', 'name', 'tagline', 'description', 'channel', 'price', 'currency', 'price_unit', 'price_note',
         'features', 'badge', 'cta_label', 'cta_mode', 'cta_url', 'enabled', 'sort', 'unit', 'min_quantity', 'info', 'terms'],
        ['category'],
        '&enabled=is.true&order=sort.asc',
      ),
      ambil('partnership_links?select=label,url,enabled,sort&enabled=is.true&order=sort.asc'),
      ambil('partnership_settings?select=partnership_url,apply_url&id=eq.1'),
      ambil('partnership_page?select=content&id=eq.1'),
    ]);
  } catch (err) {
    pertahankanYangLama(FILE_PARTNERSHIP, KOSONG_PARTNERSHIP, err.message);
    return;
  }

  // Kategori memakai urutan yang sama dengan CMS & bot, jadi halaman publik
  // mengelompokkan paket persis seperti yang diatur admin. Ditarik TERPISAH:
  // pada database yang belum menjalankan schema terbaru tabelnya belum ada,
  // dan itu tidak boleh menjatuhkan sinkronisasi produk/harga.
  try {
    kategoriRaw = await ambil('partnership_categories?select=key,label,description,emoji,scope,enabled,sort&enabled=is.true&order=sort.asc');
  } catch (err) {
    kategoriRaw = [];
    console.warn(`  ! kategori partnership dilewati: ${err.message}`);
  }

  const setting = settingRaw[0] ?? {};
  const content = pageRaw[0]?.content ?? {};

  const products = produkRaw.map((p) => ({
    key: String(p.key ?? ''),
    name: String(p.name ?? '').trim(),
    tagline: String(p.tagline ?? '').trim(),
    description: String(p.description ?? '').trim(),
    channel: p.channel === 'lobby' ? 'lobby' : 'dm',
    // Kategori = kunci pengelompokan di halaman publik. Kosong → 'lainnya'
    // supaya paket tidak pernah hilang dari halaman hanya karena belum
    // dikategorikan.
    category: String(p.category ?? '').trim() || 'lainnya',
    price: hargaAman(p.price),
    currency: String(p.currency ?? 'IDR').trim() || 'IDR',
    priceUnit: String(p.price_unit ?? '').trim(),
    // Satuan & minimum order paket (mis. 100 Pemain / 15 Hari). Keduanya dari
    // CMS; minimum dinormalisasi ke bilangan bulat ≥ 0, sisanya null.
    unit: String(p.unit ?? '').trim(),
    minQuantity: minimumAman(p.min_quantity),
    info: String(p.info ?? '').trim(),
    terms: String(p.terms ?? '').trim(),
    priceNote: String(p.price_note ?? '').trim(),
    features: daftarTeks(p.features),
    badge: String(p.badge ?? '').trim(),
    ctaLabel: String(p.cta_label ?? '').trim() || 'Ajukan Partnership',
    ctaMode: p.cta_mode === 'url' ? 'url' : 'whatsapp',
    // URL hanya dipakai saat mode 'url'; tetap disanitasi apa pun modenya.
    ctaUrl: urlAman(p.cta_url, `CTA produk ${p.key}`),
  })).filter((p) => p.key && p.name);

  // Hanya kategori yang benar-benar dipakai paket yang ikut terbit — halaman
  // publik tidak perlu tahu kategori khusus partner.
  const dipakai = new Set(products.map((p) => p.category));
  const categories = (kategoriRaw ?? [])
    .filter((c) => c.scope !== 'partner' && dipakai.has(String(c.key)))
    .map((c) => ({
      key: String(c.key ?? ''),
      label: String(c.label ?? '').trim() || String(c.key ?? ''),
      description: String(c.description ?? '').trim(),
      emoji: String(c.emoji ?? '').trim(),
      sort: Number.isFinite(Number(c.sort)) ? Number(c.sort) : 100,
    }))
    .filter((c) => c.key);

  const hasil = {
    settings: {
      partnershipUrl: urlAman(setting.partnership_url, 'Partnership URL'),
      applyUrl: urlAman(setting.apply_url, 'Apply URL'),
    },
    categories,
    products,
    links: linkRaw
      .map((l) => ({ label: String(l.label ?? '').trim(), url: urlAman(l.url, `Custom link ${l.label}`) }))
      .filter((l) => l.label && l.url),
    content,
  };

  tulis(FILE_PARTNERSHIP, hasil);
  console.log('✓ partnership.json diperbarui.');
  console.log(`  produk aktif: ${products.length} · kategori: ${categories.length} · custom link: ${hasil.links.length}`);
}

// ─── 3. Katalog produk (products / product_media / product_releases) ─────────

/** URL berkas: pakai kolom `url` bila ada, jika kosong bangun dari path Storage publik. */
function urlBerkas(u, storagePath, bucket) {
  const url = String(u ?? '').trim();
  if (url) return /^https?:\/\//i.test(url) || url.startsWith('/') ? url : '';
  if (storagePath) return `${URL_SUPABASE}/storage/v1/object/public/${bucket}/${storagePath}`;
  return '';
}

async function syncProducts() {
  let prodRaw;
  try {
    // Kolom konten CMS (badge, FAQ, langkah install, CTA penutup) ditandai
    // opsional supaya database yang belum menjalankan schema terbaru tetap
    // bisa menerbitkan katalognya, hanya tanpa field-field itu.
    prodRaw = await ambilLonggar(
      'products',
      ['id', 'slug', 'name', 'short_name', 'tagline', 'description', 'platform', 'status', 'category',
       'accent_color', 'icon', 'thumbnail_url', 'featured', 'verified', 'sort', 'features', 'long_intro',
       'commands', 'discord_client_id', 'discord_permissions', 'discord_scopes', 'discord_integration_type',
       'invite_url', 'package_name', 'min_android', 'install_note', 'cta_label', 'cta_url', 'docs_slug',
       'seo_title', 'seo_description', 'og_image_url'],
      ['badge', 'badge_tone', 'cta_heading', 'cta_text', 'cta_note', 'faq', 'install_steps'],
      '&enabled=is.true&order=sort.asc',
    );
  } catch (err) {
    pertahankanYangLama(FILE_PRODUCTS, KOSONG_PRODUCTS, err.message);
    return;
  }

  // Media & rilis ditarik terpisah: bila tabelnya belum ada (schema lama),
  // katalog tetap terbit tanpa media/rilis alih-alih gagal total.
  let mediaRaw = [];
  let releaseRaw = [];
  try {
    mediaRaw = await ambil('product_media?select=product_id,kind,url,storage_path,alt,sort&order=sort.asc');
  } catch (err) {
    console.warn(`  ! product_media dilewati: ${err.message}`);
  }
  try {
    releaseRaw = await ambil('product_releases?select=product_id,version,url,storage_path,file_size,sha256,min_android,release_notes,is_latest,created_at&published=is.true&order=created_at.desc');
  } catch (err) {
    console.warn(`  ! product_releases dilewati: ${err.message}`);
  }

  const mediaByProduct = new Map();
  for (const m of mediaRaw) {
    const list = mediaByProduct.get(m.product_id) ?? [];
    list.push({
      kind: ['icon', 'screenshot', 'video', 'banner'].includes(m.kind) ? m.kind : 'screenshot',
      url: urlBerkas(m.url, m.storage_path, 'product-media'),
      alt: String(m.alt ?? '').trim(),
    });
    mediaByProduct.set(m.product_id, list);
  }

  // Rilis terbaru per produk: is_latest bila ada; jika tidak, yang paling baru
  // (baris sudah urut created_at desc).
  const latestByProduct = new Map();
  for (const r of releaseRaw) {
    const cur = latestByProduct.get(r.product_id);
    if (!cur || (r.is_latest && !cur.is_latest)) latestByProduct.set(r.product_id, r);
  }

  const products = prodRaw
    .map((p) => {
      const rel = latestByProduct.get(p.id);
      return {
        slug: String(p.slug ?? ''),
        name: String(p.name ?? '').trim(),
        shortName: String(p.short_name ?? p.name ?? '').trim(),
        tagline: String(p.tagline ?? '').trim(),
        description: String(p.description ?? '').trim(),
        platform: ['discord', 'android', 'web'].includes(p.platform) ? p.platform : 'discord',
        status: ['live', 'beta', 'preorder', 'coming-soon'].includes(p.status) ? p.status : 'live',
        category: String(p.category ?? '').trim(),
        color: String(p.accent_color ?? '').trim() || '#E8B84A',
        icon: String(p.icon ?? '').trim() || 'sparkles',
        thumbnail: urlBerkas(p.thumbnail_url, '', 'product-media'),
        featured: Boolean(p.featured),
        verified: Boolean(p.verified),
        sort: Number.isFinite(Number(p.sort)) ? Number(p.sort) : 100,
        features: daftarTeks(p.features, 12),
        longIntro: daftarTeks(p.long_intro, 12),
        commands: Array.isArray(p.commands)
          ? p.commands.filter((c) => c && c.name).map((c) => ({ name: String(c.name), description: String(c.description ?? '') })).slice(0, 60)
          : [],
        discord: {
          clientId: String(p.discord_client_id ?? '').trim(),
          permissions: String(p.discord_permissions ?? '').trim(),
          scopes: Array.isArray(p.discord_scopes) ? p.discord_scopes.map(String) : ['bot', 'applications.commands'],
          integrationType: String(p.discord_integration_type ?? '').trim(),
          inviteUrl: urlAman(p.invite_url, `invite ${p.slug}`),
        },
        android: p.platform === 'android'
          ? {
              packageName: String(p.package_name ?? '').trim(),
              minAndroid: String(p.min_android ?? '').trim(),
              installNote: String(p.install_note ?? '').trim(),
            }
          : null,
        badge: String(p.badge ?? '').trim(),
        badgeTone: ['accent', 'info', 'success', 'warn', 'neutral'].includes(p.badge_tone) ? p.badge_tone : 'accent',
        // FAQ & langkah install: dibersihkan supaya entri setengah jadi dari CMS
        // tidak pernah tampil sebagai pertanyaan tanpa jawaban.
        faq: Array.isArray(p.faq)
          ? p.faq
              .map((f) => ({ q: String(f?.q ?? '').trim(), a: String(f?.a ?? '').trim() }))
              .filter((f) => f.q && f.a)
              .slice(0, 30)
          : [],
        installSteps: daftarTeks(p.install_steps, 10),
        ctaHeading: String(p.cta_heading ?? '').trim(),
        ctaText: String(p.cta_text ?? '').trim(),
        ctaNote: String(p.cta_note ?? '').trim(),
        ctaLabel: String(p.cta_label ?? '').trim(),
        ctaUrl: urlAman(p.cta_url, `cta ${p.slug}`),
        docsSlug: String(p.docs_slug ?? '').trim(),
        seoTitle: String(p.seo_title ?? '').trim(),
        seoDescription: String(p.seo_description ?? '').trim(),
        ogImage: urlBerkas(p.og_image_url, '', 'product-media'),
        media: mediaByProduct.get(p.id) ?? [],
        release: rel
          ? {
              version: String(rel.version ?? '').trim(),
              url: urlBerkas(rel.url, rel.storage_path, 'product-apk'),
              fileSize: Number.isFinite(Number(rel.file_size)) ? Number(rel.file_size) : null,
              sha256: String(rel.sha256 ?? '').trim() || null,
              minAndroid: String(rel.min_android ?? '').trim(),
              releaseNotes: String(rel.release_notes ?? '').trim(),
            }
          : null,
      };
    })
    .filter((p) => p.slug && p.name);

  tulis(FILE_PRODUCTS, { products });
  console.log('✓ products.json diperbarui.');
  console.log(`  produk: ${products.length}`);
}

// ─── Jalan ──────────────────────────────────────────────────────────────────

if (!URL_SUPABASE || !SERVICE_KEY) {
  const alasan = 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diisi.';
  pertahankanYangLama(FILE_KONTEN, KOSONG_KONTEN, alasan);
  pertahankanYangLama(FILE_PARTNERSHIP, KOSONG_PARTNERSHIP, alasan);
  pertahankanYangLama(FILE_PRODUCTS, KOSONG_PRODUCTS, alasan);
  process.exit(0);
}

// Dijalankan berurutan supaya log-nya mudah dibaca; masing-masing sudah
// menangani kegagalannya sendiri sehingga satu yang gagal tidak menjatuhkan
// yang lain, dan build tetap lanjut.
await syncSiteContent();
await syncPartnership();
await syncProducts();
process.exit(0);
