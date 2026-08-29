// ─────────────────────────────────────────────────────────────────────────────
// Support Center → WhatsApp Business.
//
// File ini adalah SATU sumber kebenaran untuk fitur "Hubungi Support":
//   • nomor WhatsApp Business & alamat email (konfigurasi/env, bukan hardcode)
//   • daftar produk & kategori kendala beserta ikon SVG-nya
//   • pembuat Support ID
//   • penyusun template pesan (dipakai bersama oleh WhatsApp & email)
//   • pembuat URL wa.me dan mailto:
//
// Semua fungsi di bawah bersifat murni (tanpa DOM) supaya bisa dipakai di
// frontmatter Astro (build time) maupun di script browser (runtime).
//
// Website TIDAK mengirim pesan apa pun. Website hanya menyusun teks lalu
// membuka WhatsApp atau aplikasi email dengan pesan yang sudah terisi — user
// tetap yang menekan tombol Kirim.
// ─────────────────────────────────────────────────────────────────────────────

import type { IconName } from './icons';

/**
 * Nomor WhatsApp Business support.
 *
 * Ubah lewat environment variable `PUBLIC_SUPPORT_WHATSAPP` saat build
 * (file `.env` lokal atau repository variable di GitHub Actions). Konstanta di
 * bawah hanya fallback supaya build tetap jalan tanpa env.
 *
 * Jangan menulis ulang nomor ini di komponen atau halaman mana pun — impor
 * `whatsappNumber` dari sini.
 */
const FALLBACK_WHATSAPP = '6281540040115';

/** Format internasional tanpa "+" dan tanpa pemisah — sesuai kebutuhan wa.me. */
export const whatsappNumber = String(
  import.meta.env.PUBLIC_SUPPORT_WHATSAPP || FALLBACK_WHATSAPP,
).replace(/\D/g, '');

/** Versi rapi untuk ditampilkan ke user, mis. "+62 815-4004-0115". */
export function formatWhatsappNumber(digits: string = whatsappNumber): string {
  const local = digits.startsWith('62') ? digits.slice(2) : '';
  const groups = local.match(/^(\d{3})(\d{4})(\d{3,5})$/);
  return groups ? `+62 ${groups[1]}-${groups[2]}-${groups[3]}` : `+${digits}`;
}

/**
 * Alamat email support — kanal alternatif dari WhatsApp.
 *
 * Sama seperti nomor WhatsApp: ubah lewat env `PUBLIC_SUPPORT_EMAIL` saat
 * build, konstanta di bawah hanya fallback.
 */
const FALLBACK_EMAIL = 'vanillatestudio@gmail.com';

export const supportEmail = String(
  import.meta.env.PUBLIC_SUPPORT_EMAIL || FALLBACK_EMAIL,
).trim();

/** Batas & konstanta form. Dipakai bersama oleh UI dan validasi. */
export const supportConfig = {
  /** Prefix Support ID: VS = Vanillate Support. */
  idPrefix: 'VS',
  /** Panjang minimum deskripsi kendala supaya laporan tetap berguna. */
  minMessage: 15,
  /** Batas atas deskripsi kendala. Menjaga URL wa.me tetap pendek & aman. */
  maxMessage: 700,
  maxName: 60,
  maxDiscordUsername: 40,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 — Produk
// ─────────────────────────────────────────────────────────────────────────────

export type SupportOption = {
  id: string;
  label: string;
  desc: string;
  icon: IconName;
};

export const supportProducts: SupportOption[] = [
  {
    id: 'vanillate-games',
    label: 'Vanillate Games',
    desc: 'Bot permainan Vanillate secara umum.',
    icon: 'gamepad-2',
  },
  {
    id: 'sambung-kata',
    label: 'Vanillate Sambung Kata',
    desc: 'Mode PvP, Dungeon, Class, Quest, dan statistik.',
    icon: 'sparkles',
  },
  {
    id: 'website',
    label: 'Website',
    desc: 'vanillate.id, FAQ, atau halaman lainnya.',
    icon: 'globe',
  },
  {
    id: 'lainnya',
    label: 'Lainnya',
    desc: 'Di luar daftar di atas.',
    icon: 'ellipsis',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Step 2 — Kategori kendala
//
// `hint` dipakai di Step 3 sebagai arahan menulis, supaya laporan yang masuk
// sudah membawa informasi yang biasanya ditanyakan tim support.
// ─────────────────────────────────────────────────────────────────────────────

export type SupportCategory = SupportOption & { hint: string };

export const supportCategories: SupportCategory[] = [
  {
    id: 'bug',
    label: 'Bug / Error',
    desc: 'Ada yang tidak berjalan semestinya.',
    icon: 'bug',
    hint: 'Sebutkan langkah yang kamu lakukan, hasil yang muncul, serta command atau tombol yang dipakai.',
  },
  {
    id: 'pertanyaan',
    label: 'Pertanyaan',
    desc: 'Butuh penjelasan soal fitur atau cara main.',
    icon: 'circle-help',
    hint: 'Tulis pertanyaanmu selengkap mungkin, termasuk bagian mana yang membingungkan.',
  },
  {
    id: 'saran',
    label: 'Saran',
    desc: 'Punya ide untuk membuat bot lebih seru.',
    icon: 'lightbulb',
    hint: 'Ceritakan idemu dan masalah apa yang ingin diselesaikan lewat ide tersebut.',
  },
  {
    id: 'laporan',
    label: 'Laporan',
    desc: 'Melaporkan pelanggaran atau penyalahgunaan.',
    icon: 'flag',
    hint: 'Sertakan konteks kejadian: kapan, di server mana, dan siapa yang terlibat bila relevan.',
  },
  {
    id: 'akun',
    label: 'Masalah Akun',
    desc: 'Progres, statistik, atau data pemain.',
    icon: 'circle-user',
    hint: 'Sebutkan sejak kapan masalahnya muncul dan lampirkan Player ID dari /stats bila ada.',
  },
  {
    id: 'kerja-sama',
    label: 'Kerja Sama',
    desc: 'Partnership, kolaborasi, atau promosi.',
    icon: 'handshake',
    hint: 'Jelaskan bentuk kerja sama yang ditawarkan dan gambaran singkat komunitas atau brand kamu.',
  },
  {
    id: 'lainnya',
    label: 'Lainnya',
    desc: 'Tidak termasuk kategori di atas.',
    icon: 'ellipsis',
    hint: 'Jelaskan sedetail mungkin supaya tim support tidak perlu bertanya ulang.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Support ID
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bangun Support ID dengan format konsisten: `VS-YYYYMMDD-NNNN`.
 * Contoh: `VS-20260815-4827`.
 *
 * Tanggal memakai waktu lokal user (bukan UTC) supaya ID cocok dengan hari saat
 * laporan dibuat. Empat digit acak di belakang menjaga ID tetap unik untuk
 * laporan yang dibuat pada hari yang sama.
 */
export function buildSupportId(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${supportConfig.idPrefix}-${y}${m}${d}-${randomSuffix()}`;
}

/** Empat digit acak (1000–9999). Pakai crypto bila tersedia. */
function randomSuffix(): string {
  const range = 9000;
  let n: number;
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    n = buf[0] % range;
  } else {
    n = Math.floor(Math.random() * range);
  }
  return String(1000 + n);
}

// ─────────────────────────────────────────────────────────────────────────────
// Template pesan WhatsApp
// ─────────────────────────────────────────────────────────────────────────────

export type SupportTechInfo = {
  browser?: string;
  os?: string;
  page?: string;
  version?: string;
};

export type SupportDraft = {
  supportId: string;
  product: string;
  category: string;
  message: string;
  name?: string;
  discordUsername?: string;
  discordUserId?: string;
  tech?: SupportTechInfo;
};

/** Separator sederhana — tanpa emoji, tetap terbaca rapi di WhatsApp. */
const SEPARATOR = '━'.repeat(18);

/** Lebar label supaya titik dua sejajar di semua baris. */
const LABEL_WIDTH = 10;

function row(label: string, value: string): string {
  return `${label.padEnd(LABEL_WIDTH)} : ${value}`;
}

/**
 * Nilai dianggap kosong bila string kosong ATAU berisi placeholder seperti
 * `-`, `null`, `undefined`. Field kosong tidak pernah masuk ke template.
 */
function filled(value: string | undefined | null): value is string {
  if (typeof value !== 'string') return false;
  const v = value.trim();
  if (!v) return false;
  return !['-', '–', '—', 'null', 'undefined', 'nan', 'n/a', 'na'].includes(v.toLowerCase());
}

/** Rapikan teks bebas dari user: buang spasi ekor & tumpukan baris kosong. */
function tidy(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Samakan format username Discord jadi satu `@` di depan. */
function normalizeDiscord(username: string): string {
  return `@${username.trim().replace(/^@+/, '')}`;
}

function techRows(tech: SupportTechInfo | undefined): string[] {
  if (!tech) return [];
  const rows: string[] = [];
  if (filled(tech.browser)) rows.push(row('Browser', tech.browser.trim()));
  if (filled(tech.os)) rows.push(row('OS', tech.os.trim()));
  if (filled(tech.page)) rows.push(row('Halaman', tech.page.trim()));
  if (filled(tech.version)) rows.push(row('Versi Web', tech.version.trim()));
  return rows;
}

/**
 * Susun pesan WhatsApp dari data form.
 *
 * Aturan template:
 *   • tanpa emoji, separator sederhana, label konsisten
 *   • field kosong dihilangkan sepenuhnya (tidak ada `-`/`null`/`undefined`)
 *   • informasi teknis berada di blok terpisah dan hanya muncul bila tersedia
 */
export function buildSupportMessage(draft: SupportDraft): string {
  const lines: string[] = [
    'Halo Tim Vanillate,',
    '',
    'Saya ingin meminta bantuan terkait kendala yang saya alami.',
    '',
    SEPARATOR,
    'DETAIL SUPPORT',
    SEPARATOR,
    '',
    row('Support ID', draft.supportId),
    row('Produk', draft.product),
    row('Kategori', draft.category),
    '',
    'Kendala:',
    tidy(draft.message),
  ];

  const details: string[] = [];
  if (filled(draft.name)) details.push(row('Nama', draft.name.trim()));
  if (filled(draft.discordUsername)) details.push(row('Discord', normalizeDiscord(draft.discordUsername)));
  if (filled(draft.discordUserId)) details.push(row('Discord ID', draft.discordUserId.trim()));
  if (details.length) lines.push('', ...details);

  const tech = techRows(draft.tech);
  if (tech.length) {
    lines.push('', SEPARATOR, 'INFORMASI TEKNIS', SEPARATOR, '', ...tech);
  }

  lines.push('', SEPARATOR, '', 'Terima kasih atas bantuannya.');

  return lines.join('\n');
}

/**
 * Bangun URL WhatsApp dengan pesan yang sudah di-URL-encode.
 * Membuka tautan ini akan memunculkan WhatsApp Business dengan pesan terisi;
 * user sendiri yang menekan Kirim.
 */
export function buildWhatsappUrl(message: string, number: string = whatsappNumber): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

/**
 * Subjek email support. Formatnya konsisten dan sudah membawa Support ID,
 * kategori, dan produk sehingga mudah difilter di kotak masuk tim.
 *
 * Contoh: `[Support] VS-20260815-4827 — Bug / Error — Vanillate Sambung Kata`
 */
export function buildSupportSubject(draft: SupportDraft): string {
  return [`[Support] ${draft.supportId}`, draft.category, draft.product]
    .filter((part) => filled(part))
    .join(' — ');
}

/**
 * Bangun tautan `mailto:` dengan penerima, subjek, dan isi yang sudah terisi.
 * Isi email memakai template yang sama dengan WhatsApp supaya laporan yang
 * masuk lewat kanal mana pun terbaca dengan format yang sama.
 *
 * Catatan: `encodeURIComponent` dipakai langsung (bukan URLSearchParams) karena
 * sebagian aplikasi email tidak menerjemahkan `+` sebagai spasi pada mailto.
 */
export function buildMailtoUrl(
  draft: SupportDraft,
  message: string,
  email: string = supportEmail,
): string {
  const subject = encodeURIComponent(buildSupportSubject(draft));
  const body = encodeURIComponent(message);
  return `mailto:${email}?subject=${subject}&body=${body}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Kanal langsung (tanpa formulir)
//
// Dipakai untuk pintasan seperti ikon di footer: membuka WhatsApp atau email
// dengan sapaan pembuka saja. Laporan yang butuh detail tetap sebaiknya lewat
// wizard di /support agar formatnya terstruktur.
// ─────────────────────────────────────────────────────────────────────────────

const DIRECT_GREETING = 'Halo Tim Vanillate, saya ingin bertanya terkait produk Vanillate.';
const DIRECT_SUBJECT = '[Support] Pertanyaan untuk Tim Vanillate';

/** Tautan WhatsApp tanpa data formulir. */
export function buildDirectWhatsappUrl(): string {
  return buildWhatsappUrl(DIRECT_GREETING);
}

/** Tautan email tanpa data formulir. */
export function buildDirectMailtoUrl(email: string = supportEmail): string {
  return `mailto:${email}?subject=${encodeURIComponent(DIRECT_SUBJECT)}&body=${encodeURIComponent(DIRECT_GREETING)}`;
}
