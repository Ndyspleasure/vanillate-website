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
 * Format harga untuk tampilan publik. `IDR` dirender sebagai "Rp150.000"
 * (tanpa desimal — harga layanan selalu bulat), mata uang lain memakai format
 * standar Intl.
 */
export function formatPrice(price: number | null | undefined, currency = 'IDR'): string {
  // Null/kosong DIBEDAKAN dari nol. `Number(null)` bernilai 0, jadi tanpa
  // penjagaan ini produk yang harganya belum diisi akan tampil "Rp 0" —
  // terbaca "gratis" oleh calon partner. Harga belum diisi harus tampil "—".
  if (price === null || price === undefined || String(price).trim() === '') return '—';
  const n = Number(price);
  if (!Number.isFinite(n) || n < 0) return '—';
  try {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: currency || 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${currency} ${n.toLocaleString('id-ID')}`;
  }
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
