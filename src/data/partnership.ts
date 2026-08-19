// ════════════════════════════════════════════════════════════════════════════
// PARTNERSHIP — util bersama
//
// Dipakai DUA sisi, jadi ditaruh di src/data (bukan src/lib):
//   • saat build   → halaman publik /partnership membangun tautan WhatsApp.
//   • di browser   → panel /admin memvalidasi & menghitung target User ID.
// Semua fungsi di sini MURNI (tanpa DOM, tanpa Supabase) supaya aman dipakai
// keduanya — pola yang sama dipakai src/data/support.ts.
//
// Nomor WhatsApp & pembuat URL-nya SENGAJA diambil dari support.ts: nomornya
// sudah dikonfigurasi lewat env PUBLIC_SUPPORT_WHATSAPP, jadi jangan pernah
// menuliskan nomornya lagi di sini atau di komponen.
// ════════════════════════════════════════════════════════════════════════════

import { buildWhatsappUrl, whatsappNumber } from './support';

export { whatsappNumber };

// ─── Validasi Discord User ID (snowflake) ────────────────────────────────────

/**
 * Discord snowflake: bilangan bulat panjang. Rentang 17–20 digit menampung ID
 * lama maupun baru tanpa perlu diperbarui setiap tahun.
 */
export const USER_ID_PATTERN = /^\d{17,20}$/;

export function isValidUserId(value: string): boolean {
  return USER_ID_PATTERN.test(value.trim());
}

export interface ParsedTargets {
  /** ID valid, sudah unik & urut sesuai kemunculan pertama. */
  valid: string[];
  /** Entri yang tidak berbentuk User ID (ditampilkan agar admin bisa perbaiki). */
  invalid: string[];
  /** Jumlah entri terbaca sebelum dedup. */
  parsed: number;
  /** Berapa banyak duplikat yang dibuang. */
  duplicates: number;
}

/**
 * Baca paste-an User ID dari admin.
 *
 * Sengaja permisif soal pemisah: admin biasanya menempel dari spreadsheet,
 * hasil export, atau daftar Active Players — jadi baris baru, koma, titik koma,
 * spasi, dan tab semuanya diterima. Yang ketat justru bentuk ID-nya.
 */
export function parseUserIds(raw: string): ParsedTargets {
  const potongan = String(raw ?? '')
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const valid: string[] = [];
  const invalid: string[] = [];
  const terlihat = new Set<string>();
  let duplicates = 0;

  for (const p of potongan) {
    if (!isValidUserId(p)) {
      // Batasi daftar invalid supaya UI tidak meledak bila paste-annya kacau.
      if (invalid.length < 50) invalid.push(p);
      continue;
    }
    if (terlihat.has(p)) {
      duplicates += 1;
      continue;
    }
    terlihat.add(p);
    valid.push(p);
  }

  return { valid, invalid, parsed: potongan.length, duplicates };
}

// ─── Harga ───────────────────────────────────────────────────────────────────

/**
 * Format harga untuk tampilan publik. `IDR` dirender sebagai "Rp150.000",
 * mata uang lain memakai format standar Intl.
 *
 * TANPA pembatasan nominal: berapa pun angkanya (termasuk pecahan dan nilai
 * yang sangat besar) tetap dirender apa adanya. Desimal hanya ditulis bila
 * harganya memang punya pecahan, jadi harga bulat tetap bersih.
 */
export function formatPrice(price: number | null | undefined, currency = 'IDR'): string {
  // Null/kosong DIBEDAKAN dari nol. `Number(null)` bernilai 0, jadi tanpa
  // penjagaan ini produk yang harganya belum diisi akan tampil "Rp 0" —
  // terbaca "gratis" oleh calon partner. Harga belum diisi harus tampil "—".
  if (price === null || price === undefined || String(price).trim() === '') return '—';
  const n = Number(price);
  if (!Number.isFinite(n)) return '—';
  // Nol adalah harga yang sah (dan berarti gratis) — beda dari "belum diisi".
  if (n === 0) return 'Gratis';
  const pecahan = Math.abs(n % 1) > 0 ? 2 : 0;
  try {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: currency || 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: pecahan,
    }).format(n);
  } catch {
    return `${currency} ${n.toLocaleString('id-ID', { maximumFractionDigits: pecahan })}`;
  }
}

export interface ParsedPrice {
  /** Input terbaca sebagai angka (atau memang sengaja dikosongkan). */
  valid: boolean;
  /** Nilai numerik; null = kosong (harga belum ditentukan). */
  value: number | null;
}

/**
 * Baca harga yang diketik admin — TANPA batas nominal, tanpa kelipatan.
 *
 * Input `<input type="number">` dengan `step` menolak nominal yang bukan
 * kelipatan step-nya (mis. 150.500 pada step 1000), dan `min`/`max` mengunci
 * rentang. Karena itu harga kini diketik sebagai teks bebas lalu dibaca di
 * sini: "150000", "150.000", "150,000", "Rp 150.000", bahkan "1.250.000,75"
 * semuanya diterima. Yang ditolak hanya yang benar-benar bukan angka.
 *
 * Pemisah ribuan/desimal gaya Indonesia dan gaya internasional sama-sama
 * dikenali: pemisah yang muncul TERAKHIR dianggap desimal bila sisa digit di
 * belakangnya bukan kelompok ribuan (tiga digit).
 */
export function parsePrice(raw: string | number | null | undefined): ParsedPrice {
  if (raw === null || raw === undefined) return { valid: true, value: null };
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? { valid: true, value: raw } : { valid: false, value: null };
  }

  // Buang simbol mata uang, spasi (termasuk spasi tak terpisah), dan pemisah
  // yang kadang ikut ter-copy dari spreadsheet.
  let teks = String(raw).trim().replace(/[\s ]/g, '').replace(/^(rp|idr)/i, '');
  if (teks === '') return { valid: true, value: null };

  const negatif = teks.startsWith('-');
  if (negatif || teks.startsWith('+')) teks = teks.slice(1);
  if (!/^[\d.,]+$/.test(teks)) return { valid: false, value: null };

  const titik = teks.lastIndexOf('.');
  const koma = teks.lastIndexOf(',');
  const posisi = Math.max(titik, koma);

  let angka: string;
  if (posisi === -1) {
    angka = teks;
  } else {
    const belakang = teks.slice(posisi + 1);
    // Tepat tiga digit di belakang pemisah terakhir = kelompok ribuan
    // ("150.000"), kecuali memang tidak ada pemisah lain dan penulisnya
    // memakai gaya campuran — pada kasus ambigu itu ribuan lebih masuk akal
    // untuk harga rupiah.
    const desimal = !/^\d{3}$/.test(belakang);
    angka = desimal
      ? `${teks.slice(0, posisi).replace(/[.,]/g, '')}.${belakang}`
      : teks.replace(/[.,]/g, '');
  }

  if (angka === '' || angka === '.') return { valid: false, value: null };
  const n = Number(angka);
  if (!Number.isFinite(n)) return { valid: false, value: null };
  return { valid: true, value: negatif ? -n : n };
}

/**
 * Baca jumlah bulat bebas (mis. minimum order). Sama seperti `parsePrice`,
 * tanpa batas atas — hanya dibulatkan ke bilangan bulat.
 */
export function parseJumlah(raw: string | number | null | undefined): ParsedPrice {
  const hasil = parsePrice(raw);
  if (!hasil.valid || hasil.value === null) return hasil;
  return { valid: true, value: Math.round(hasil.value) };
}

// ─── Pesan WhatsApp ──────────────────────────────────────────────────────────

/** Label kategori yang enak dibaca di pesan. */
export function labelKategori(category: string | null | undefined): string {
  const c = String(category ?? '').trim().toLowerCase();
  if (!c) return 'Marketing';
  return c.charAt(0).toUpperCase() + c.slice(1);
}

export interface PartnershipInquiry {
  /** Nama produk yang dipilih, mis. "Broadcast via DM". Kosong = pengajuan umum. */
  productName?: string | null;
  /** Kategori, mis. "Marketing". */
  category?: string | null;
}

/**
 * Susun pesan pengajuan Partnership untuk WhatsApp.
 *
 * SENGAJA tanpa harga dan tanpa ID pengajuan (permintaan pemilik): cukup produk
 * + kategori supaya tim langsung tahu konteksnya, dan pesannya tetap enak
 * dibaca di layar HP. Karena isinya statis per produk, tautannya bisa dibangun
 * saat build — tidak butuh JavaScript di halaman publik.
 *
 * Gaya penulisan mengikuti konvensi Support Wizard: tanpa emoji, label sejajar,
 * dan field kosong dihilangkan sepenuhnya (tidak pernah muncul "-"/"undefined").
 */
export function buildPartnershipMessage(inquiry: PartnershipInquiry = {}): string {
  const produk = String(inquiry.productName ?? '').trim();
  const kategori = String(inquiry.category ?? '').trim();

  const baris: string[] = ['Halo Tim Vanillate,', '', 'Saya ingin mengajukan kerja sama Partnership.'];

  const detail: string[] = [];
  if (produk) detail.push(`Produk   : ${produk}`);
  if (kategori) detail.push(`Kategori : ${labelKategori(kategori)}`);
  if (detail.length) baris.push('', ...detail);

  baris.push('', 'Mohon informasi lebih lanjut mengenai ketentuan dan langkah selanjutnya.', '', 'Terima kasih.');

  return baris.join('\n');
}

/** URL WhatsApp siap pakai untuk pengajuan Partnership. */
export function buildPartnershipWhatsappUrl(inquiry: PartnershipInquiry = {}): string {
  return buildWhatsappUrl(buildPartnershipMessage(inquiry));
}

// ─── Sanitasi URL ────────────────────────────────────────────────────────────

/**
 * Hanya izinkan tautan http(s) atau path internal.
 *
 * Nilai ini berasal dari input admin lalu dipakai sebagai `href`, jadi menolak
 * skema lain menutup pintu `javascript:` — pola yang sama dipakai
 * scripts/sync-content.mjs untuk tautan banner.
 */
export function safeUrl(value: string | null | undefined): string {
  const u = String(value ?? '').trim();
  if (!u) return '';
  if (/^https?:\/\//i.test(u) || u.startsWith('/')) return u;
  return '';
}
