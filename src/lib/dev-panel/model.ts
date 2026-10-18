// ════════════════════════════════════════════════════════════════════════════
//  Panel Developer — model murni (tanpa DOM, tanpa jaringan).
//
//  Aturan tampilan & validasi cepat yang bisa salah dikumpulkan di sini supaya
//  teruji (tests/dev-panel-model.test.ts). Validasi di sini HANYA umpan balik
//  sebelum perintah dikirim — penentu tetap bot (src/cms/handlers/* di repo
//  sambung-kata-bot) yang memvalidasi ulang setiap payload.
//  Berkas ini sengaja tanpa import supaya bisa dijalankan langsung oleh Node.
// ════════════════════════════════════════════════════════════════════════════

export type CommandStatus = 'pending' | 'processing' | 'done' | 'error';

export interface Progress {
  done?: number;
  total?: number;
  sent?: number;
  failed?: number;
  skipped?: number;
  phase?: string;
}

/** Perintah dengan prefiks `sys.` hanya boleh dikirim owner (dijaga DB & bot). */
export function isOwnerOnly(type: string): boolean {
  return type.startsWith('sys.');
}

export function canSend(role: string | null | undefined, type: string): boolean {
  if (role !== 'owner' && role !== 'admin') return false;
  return !isOwnerOnly(type) || role === 'owner';
}

export function isFinal(status: string | null | undefined): boolean {
  return status === 'done' || status === 'error';
}

/** Umur snapshot dalam detik (null bila belum pernah ada). */
export function ageSeconds(updatedAt: string | null | undefined, now = Date.now()): number | null {
  if (!updatedAt) return null;
  const t = Date.parse(updatedAt);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.round((now - t) / 1000));
}

/** Snapshot dianggap basi (bot kemungkinan offline) setelah 2 menit. */
export function isStale(updatedAt: string | null | undefined, now = Date.now(), maxSeconds = 120): boolean {
  const age = ageSeconds(updatedAt, now);
  return age === null || age > maxSeconds;
}

/** 3725 → "1 jam 2 mnt"; 45 → "45 dtk". */
export function fmtDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return '—';
  const s = Math.max(0, Math.floor(seconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d} hr ${h} jam`;
  if (h > 0) return `${h} jam ${m} mnt`;
  if (m > 0) return `${m} mnt ${s % 60} dtk`;
  return `${s} dtk`;
}

export function fmtBytes(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

export function progressPct(p: Progress | null | undefined): number | null {
  if (!p || !p.total) return null;
  return Math.min(100, Math.round(((p.done ?? 0) / p.total) * 100));
}

/** Waktu dari epoch ms ATAU teks ISO/SQLite → epoch ms. */
export function toEpoch(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const teks = String(v);
  const iso = teks.includes('T') ? teks : `${teks.replace(' ', 'T')}Z`;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

// ─── Game Monitor ───────────────────────────────────────────────────────────

export const MODE_LABEL: Record<string, string> = {
  pvp: 'PvP',
  pvb: 'PvB Battle',
  global: 'Global (lintas server)',
  dungeon: 'Dungeon',
  werewolf: 'Werewolf Klasik',
  werewolf_adv: 'Werewolf Lanjutan',
  pengacara: 'Pengacara',
  uno: 'UNO',
  tebaklagu: 'Tebak Lagu',
};

export function modeLabel(mode: string | null | undefined): string {
  if (!mode) return '—';
  if (MODE_LABEL[mode]) return MODE_LABEL[mode];
  if (mode.startsWith('bot_')) return `PvB ${mode.slice(4)}`;
  return mode;
}

/** Kelompok tampilan Game Monitor (sama dengan panel lama). */
export function modeGroup(mode: string | null | undefined): 'sambung' | 'sampingan' {
  return ['werewolf', 'werewolf_adv', 'pengacara', 'uno', 'tebaklagu'].includes(String(mode)) ? 'sampingan' : 'sambung';
}

export const GAME_ACTIONS: Record<string, { label: string; type: string; danger?: boolean }> = {
  end: { label: 'Akhiri game', type: 'game.end', danger: true },
  forceturn: { label: 'Pindah giliran', type: 'game.forceTurn' },
  setword: { label: 'Ganti kata', type: 'game.setWord' },
  eliminate: { label: 'Eliminasi pemain', type: 'game.eliminate', danger: true },
  revive: { label: 'Pulihkan pemain', type: 'game.revive' },
  spawnevent: { label: 'Munculkan event', type: 'game.spawnEvent' },
};

export const SPAWN_EVENTS: { code: string; label: string }[] = [
  { code: 'ai', label: 'AI Challenger' },
  { code: 'ls', label: 'Lost Signal' },
  { code: 'tm', label: 'Traveling Merchant' },
  { code: 'inv', label: 'Penjajah (musiman)' },
];

// ─── Event System ───────────────────────────────────────────────────────────

export const EVENT_KEYS = ['ai_challenger', 'lost_signal', 'traveling_merchant', 'invader'] as const;

export function chanceTotal(c: Record<string, number | string>): number {
  return EVENT_KEYS.reduce((s, k) => s + (Number(c[k]) || 0), 0);
}

/** null = valid; selain itu pesan error (cermin aturan bot). */
export function validateChances(c: Record<string, number | string>): string | null {
  for (const k of EVENT_KEYS) {
    const n = Number(String(c[k] ?? '').replace(',', '.'));
    if (String(c[k] ?? '').trim() === '' || !Number.isFinite(n) || n < 0 || n > 1) {
      return `Peluang ${k} harus angka 0–1 (0 = nonaktif).`;
    }
  }
  const total = chanceTotal(Object.fromEntries(EVENT_KEYS.map((k) => [k, Number(String(c[k]).replace(',', '.'))])));
  if (total > 1 + 1e-9) return `Jumlah peluang ${total.toFixed(2)} melebihi 1.0.`;
  return null;
}

// ─── Broadcast DM ───────────────────────────────────────────────────────────

export interface BroadcastDraft {
  audience: string;
  title?: string;
  message: string;
  color?: string;
  mediaUrl?: string;
  customLabel?: string;
  customUrl?: string;
  targetUser?: string;
  poll?: { question: string; options: string[]; durationHours: number } | null;
}

/** Satu opsi per baris; baris kosong dibuang; maks. 5. */
export function parsePollOptions(text: string): string[] {
  return String(text ?? '').split(/\r?\n/).map((s) => s.trim().slice(0, 80)).filter(Boolean).slice(0, 5);
}

const isHttp = (u: string) => /^https?:\/\/\S+$/i.test(u.trim());

/** Daftar masalah draft (kosong = siap kirim). Cermin validasi bot broadcast.send. */
export function validateBroadcast(d: BroadcastDraft, opts: { test?: boolean } = {}): string[] {
  const err: string[] = [];
  if (!d.audience) err.push('Pilih audiens.');
  if (!String(d.message ?? '').trim()) err.push('Isi pesan wajib diisi.');
  if (String(d.message ?? '').length > 4000) err.push('Isi pesan maksimal 4000 karakter.');
  if (d.color && !/^#?[0-9a-f]{6}$/i.test(d.color.trim())) err.push('Warna harus hex 6 digit, mis. 57F287.');
  if (d.mediaUrl && !isHttp(d.mediaUrl)) err.push('URL media harus http(s).');
  const adaLabel = Boolean(d.customLabel?.trim());
  const adaUrl = Boolean(d.customUrl?.trim());
  if (adaLabel !== adaUrl) err.push('Tombol custom butuh teks DAN URL (atau kosongkan keduanya).');
  if (adaUrl && !isHttp(d.customUrl!)) err.push('URL tombol custom harus http(s).');
  if (opts.test && !String(d.targetUser ?? '').trim()) err.push('Isi Player ID / Discord ID penerima test.');
  if (d.poll) {
    if (!d.poll.question.trim()) err.push('Pertanyaan polling wajib diisi.');
    if (d.poll.options.length < 2) err.push('Polling butuh minimal 2 opsi.');
    if (!(d.poll.durationHours >= 0.05 && d.poll.durationHours <= 168)) err.push('Durasi polling 0.05–168 jam.');
  }
  return err;
}

/** Klasifikasi media seperti bot: gambar → embed image, selain itu tautan auto-embed. */
export function mediaKind(url: string | null | undefined): 'image' | 'link' | null {
  const u = String(url ?? '').trim();
  if (!isHttp(u)) return null;
  return /\.(png|jpe?g|gif|webp)(\?\S*)?$/i.test(u) ? 'image' : 'link';
}

/**
 * Peringatan URL media sebelum kirim. Bot tetap memeriksa URL sungguhan
 * (Content-Type & og:image, `src/services/broadcastMedia.js` repo bot); ini
 * hanya umpan balik supaya admin tahu gambar mungkin tidak tampil.
 */
export function mediaHint(url: string | null | undefined): string[] {
  const u = String(url ?? '').trim();
  if (!isHttp(u)) return [];
  const out: string[] = [];
  let host = '';
  let parsed: URL | null = null;
  try { parsed = new URL(u); host = parsed.hostname.toLowerCase(); } catch { return []; }
  const video = /(youtube\.com|youtu\.be|tiktok\.com|twitch\.tv)$/i.test(host);
  if (!video && mediaKind(u) === 'link') {
    out.push('Ini bukan link gambar langsung (.png/.jpg/.gif/.webp). Bot akan mencoba mengambil gambar dari halamannya; bila tidak ketemu, dikirim sebagai tautan biasa. Paling aman: klik kanan gambar → "Copy image address".');
  }
  if (/(^|\.)(discordapp\.(com|net)|discord\.com)$/i.test(host) && parsed!.pathname.includes('/attachments/') && parsed!.searchParams.has('ex')) {
    out.push('Link lampiran Discord kedaluwarsa ±24 jam — gambar bisa hilang dari DM setelahnya. Pakai link gambar permanen (mis. i.imgur.com/…png).');
  }
  return out;
}

/** Ringkasan hasil pemeriksaan media oleh bot (`result.media` broadcast.send). */
export function describeMedia(m: { kind?: string | null; url?: string | null; source?: string; warning?: string } | null | undefined): string | null {
  if (!m?.url) return null;
  const sumber: Record<string, string> = {
    direct: 'gambar langsung',
    page: 'gambar diambil dari halaman (og:image)',
    video: 'tautan video',
    'page-link': 'halaman tanpa gambar — dikirim sebagai tautan',
    unchecked: 'tidak bisa dicek bot — ditebak dari akhiran URL',
  };
  const jenis = m.kind === 'image' ? '🖼️ Gambar' : '🔗 Tautan';
  return `${jenis}: ${sumber[m.source ?? ''] ?? m.source ?? ''}${m.warning ? ` · ⚠️ ${m.warning}` : ''}`;
}

/**
 * Judul & footer embed yang akan diterima (cermin buildBroadcastPayload &
 * serverBroadcast.buildServerPayload di bot).
 */
export function previewHeader(
  d: BroadcastDraft,
  { emergency = false, server = false }: { emergency?: boolean; server?: boolean } = {},
): { title: string | null; footer: string; color: string } {
  const title = emergency ? `🚨 ${d.title?.trim() || 'Informasi Penting'}` : (d.title?.trim() || null);
  const footer = server
    ? 'Sambung Kata • Info khusus owner/admin server'
    : emergency
      ? 'Sambung Kata • 🚨 Info darurat — dikirim ke semua pemain, termasuk yang menonaktifkan DM'
      : 'Sambung Kata • Pesan resmi dari tim';
  const hex = (d.color ?? '').trim().replace(/^#/, '');
  return { title, footer, color: /^[0-9a-f]{6}$/i.test(hex) ? `#${hex}` : '#57F287' };
}

/** Perkiraan durasi broadcast (jeda antar-DM × penerima). */
export function estimateMinutes(recipients: number, delayMs: number): number {
  return Math.round(((recipients * delayMs) / 60000) * 10) / 10;
}

// ─── Word Collection ────────────────────────────────────────────────────────

/** Jumlah kata dari teks bulk (baris/koma). "SEMUA" = seluruh sisa sesi. */
export function countBulkWords(text: string): number | 'SEMUA' {
  const t = String(text ?? '').trim();
  if (t.toUpperCase() === 'SEMUA') return 'SEMUA';
  return new Set(t.split(/[\s,;]+/).map((w) => w.trim().toLowerCase()).filter(Boolean)).size;
}

export const BULK_ACTIONS: Record<string, { label: string; from: string; reason: boolean }> = {
  accept: { label: 'Terima (Pending → Kamus)', from: 'pending', reason: false },
  reject: { label: 'Tolak (Pending → Ditolak)', from: 'pending', reason: true },
  to_accept: { label: 'Ubah Ditolak → Diterima', from: 'rejected', reason: false },
  to_reject: { label: 'Ubah Diterima → Ditolak', from: 'accepted', reason: true },
};
