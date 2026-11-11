// ════════════════════════════════════════════════════════════════════════════
//  Portal Partner: model murni (tanpa DOM/Supabase) supaya bisa dites Node.
//  Validasi di sini hanya umpan balik cepat. Validasi akhir ada di RPC
//  partner_order_submit (supabase/partner-portal.sql). Acuan docs/PARTNER-PORTAL.md.
// ════════════════════════════════════════════════════════════════════════════

export const USERNAME_RE = /^[a-z0-9][a-z0-9_.-]{2,31}$/;
export const MAX_BRAND = 80;
export const MAX_AD = 2000;
export const MAX_NOTE = 1000;
export const MAX_QTY = 1_000_000;
export const REPORT_CHANNEL_ID = '1570076513230131210';

export interface CatalogProduct {
  key: string;
  name: string;
  price: number | null;
  priceUnit: string;
  unit: string;
  minQuantity: number;
}

export interface OrderInput {
  productKey: string;
  quantity: string | number;
  brandName: string;
  inviteUrl: string;
  scheduledFor: string; // YYYY-MM-DD atau kosong
  adText: string;
  note: string;
}

export type OrderErrors = Partial<Record<keyof OrderInput, string>>;

/** Rupiah dengan titik ribuan, tanpa Intl supaya sama di semua lingkungan. */
export function rupiah(n: number): string {
  const s = String(Math.round(n));
  return 'Rp ' + s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function priceText(p: Pick<CatalogProduct, 'price' | 'priceUnit'>): string {
  if (p.price === null || p.price === undefined) return 'Harga belum ditentukan';
  return rupiah(p.price) + (p.priceUnit ? ` ${p.priceUnit}` : '');
}

export function totalText(price: number | null, quantity: number): string {
  if (price === null || price === undefined || !Number.isFinite(quantity)) return 'Harga belum ditentukan';
  return rupiah(price * quantity);
}

/** Tanggal hari ini menurut WIB, format YYYY-MM-DD. */
export function todayWib(now: Date = new Date()): string {
  return new Date(now.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
}

export function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateOrder(input: OrderInput, product: CatalogProduct | null, today: string = todayWib()): OrderErrors {
  const e: OrderErrors = {};
  if (!product) e.productKey = 'Pilih paket.';
  const qty = Number(String(input.quantity).trim());
  const min = Math.max(product?.minQuantity ?? 1, 1);
  if (!Number.isInteger(qty) || qty < min || qty > MAX_QTY) {
    e.quantity = `Jumlah minimal ${min}${product?.unit ? ` ${product.unit.toLowerCase()}` : ''}.`;
  }
  const brand = input.brandName.trim();
  if (!brand) e.brandName = 'Nama server atau brand wajib diisi.';
  else if (brand.length > MAX_BRAND) e.brandName = `Maksimal ${MAX_BRAND} karakter.`;
  const url = input.inviteUrl.trim();
  if (url && (!/^https:\/\/[^\s]+$/.test(url) || url.length > 300)) e.inviteUrl = 'Link harus diawali https:// dan tanpa spasi.';
  const date = input.scheduledFor.trim();
  if (date) {
    if (!KEY_RE.test(date)) e.scheduledFor = 'Format tanggal tidak valid.';
    else if (date < today) e.scheduledFor = 'Tanggal tayang tidak boleh sudah lewat.';
    else if (date > addDays(today, 365)) e.scheduledFor = 'Maksimal 1 tahun ke depan.';
  }
  if (input.adText.trim().length > MAX_AD) e.adText = `Maksimal ${MAX_AD} karakter.`;
  if (input.note.trim().length > MAX_NOTE) e.note = `Maksimal ${MAX_NOTE} karakter.`;
  return e;
}

export function hasErrors(e: OrderErrors): boolean {
  return Object.keys(e).length > 0;
}

// ─── Status pesanan ────────────────────────────────────────────────────────

export const ORDER_STATUSES = ['dicatat', 'diproses', 'berjalan', 'selesai', 'dibatalkan'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_META: Record<OrderStatus, { label: string; hint: string; tone: 'neutral' | 'warning' | 'info' | 'success' | 'danger' }> = {
  dicatat: { label: 'Dicatat', hint: 'Pesanan tercatat dan menunggu tim kami.', tone: 'neutral' },
  diproses: { label: 'Diproses', hint: 'Tim kami sedang menyiapkan pesananmu.', tone: 'warning' },
  berjalan: { label: 'Berjalan', hint: 'Promosi sedang tayang.', tone: 'info' },
  selesai: { label: 'Selesai', hint: 'Pesanan sudah selesai.', tone: 'success' },
  dibatalkan: { label: 'Dibatalkan', hint: 'Pesanan dibatalkan.', tone: 'danger' },
};

export function statusMeta(status: string) {
  return STATUS_META[(ORDER_STATUSES as readonly string[]).includes(status) ? (status as OrderStatus) : 'dicatat'];
}

// ─── Pratinjau kartu laporan (meniru kartu yang dikirim bot) ───────────────

export interface ReportPreview {
  title: string;
  fields: Array<{ name: string; value: string }>;
  ad: string;
  note: string;
  inviteUrl: string;
  footer: string;
}

/** Pemotongan aman untuk tampilan kartu (bot memotong dengan aturan serupa). */
export function clip(text: string, max: number): string {
  const t = text.trim();
  return t.length <= max ? t : t.slice(0, Math.max(0, max - 1)).trimEnd() + '…';
}

export function formatDateId(ymd: string): string {
  if (!KEY_RE.test(ymd)) return '';
  const bulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const [y, m, d] = ymd.split('-').map(Number);
  return `${d} ${bulan[m - 1]} ${y}`;
}

export function buildReportPreview(args: {
  partnerName: string;
  product: CatalogProduct | null;
  input: OrderInput;
  orderId?: number | null;
}): ReportPreview {
  const { partnerName, product, input, orderId } = args;
  const qty = Number(String(input.quantity).trim());
  const okQty = Number.isInteger(qty) && qty > 0;
  const unit = product?.unit ? ` ${product.unit.toLowerCase()}` : '';
  const fields = [
    { name: 'Partner', value: partnerName || 'belum diisi' },
    { name: 'Paket', value: product?.name ?? 'belum dipilih' },
    { name: 'Jumlah', value: okQty ? `${qty.toLocaleString('id-ID')}${unit}` : 'belum diisi' },
    { name: 'Harga satuan', value: product ? priceText(product) : 'belum dipilih' },
    { name: 'Total', value: product && okQty ? totalText(product.price, qty) : 'belum dihitung' },
    { name: 'Server atau brand', value: input.brandName.trim() || 'belum diisi' },
    { name: 'Tanggal tayang', value: formatDateId(input.scheduledFor.trim()) || 'belum diatur' },
  ];
  return {
    title: `Pesanan partner baru${orderId ? ` #${orderId}` : ''}`,
    fields,
    ad: clip(input.adText, 600),
    note: clip(input.note, 400),
    inviteUrl: input.inviteUrl.trim(),
    footer: 'Made by Vanillate | https://vanillate.id/dashboard',
  };
}

// ─── Pesan galat ramah ─────────────────────────────────────────────────────

export function loginError(message: string | undefined): string {
  const m = (message ?? '').toLowerCase();
  if (m.includes('invalid login') || m.includes('invalid credentials')) {
    return 'Username atau password salah. Kalau lupa, hubungi WhatsApp official kami.';
  }
  if (m.includes('rate') || m.includes('too many')) return 'Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.';
  if (m.includes('fetch') || m.includes('network')) return 'Tidak bisa terhubung. Periksa koneksi internet lalu coba lagi.';
  return 'Gagal masuk. Coba lagi sebentar lagi.';
}

export function rpcError(message: string | undefined): string {
  const m = message ?? '';
  const known = [
    'Jumlah minimal', 'Nama server', 'Link harus', 'Tanggal tayang', 'Teks iklan', 'Catatan maksimal',
    'Batas 10 catatan', 'Paket tidak ditemukan', 'Ganti username',
  ];
  return known.some((k) => m.includes(k)) ? m : 'Gagal menyimpan pesanan. Coba lagi.';
}

/** Username: huruf kecil, tanpa pemisah ganda atau di ujung (sama dengan Edge Function). */
export function usernameProblem(raw: string): string | null {
  const u = raw.trim().toLowerCase();
  if (!USERNAME_RE.test(u) || /[._-]{2}/.test(u) || /[._-]$/.test(u)) {
    return 'Username 3 sampai 32 karakter: huruf kecil, angka, titik, garis bawah, atau strip.';
  }
  return null;
}

export function passwordProblem(password: string, username: string): string | null {
  if (password.length < 8) return 'Password minimal 8 karakter.';
  if (password.length > 72) return 'Password maksimal 72 karakter.';
  if (/^\d+$/.test(password)) return 'Password tidak boleh hanya angka.';
  const u = username.trim().toLowerCase();
  if (u.length >= 3 && password.toLowerCase().includes(u)) return 'Password tidak boleh memuat username.';
  return null;
}
