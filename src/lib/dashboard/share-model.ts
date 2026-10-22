// ════════════════════════════════════════════════════════════════════════════
//  Vanillate Dashboard › 📣 Share Server — model murni (tanpa DOM/jaringan).
//
//  Status & riwayat Share Server DITERBITKAN bot (share_guild_state); website
//  hanya mengirim permintaan (share_requests) yang divalidasi ulang oleh bot.
//  Validasi di sini hanya umpan balik cepat — cermin aturan bot
//  (sambung-kata-bot: src/social/share/rules.js & invite.js).
//  Diuji tests/share-model.test.ts. Sengaja tanpa import.
// ════════════════════════════════════════════════════════════════════════════

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface ShareConfig {
  promoChannelId: string | null;
  voteChannelId: string | null;
  voteMessageId: string | null;
  alertsChannelId: string | null;
  category: string | null;
  description: string | null;
  inviteUrl: string | null;
  inviteMethod: 'manual' | 'auto' | null;
  inviteChannelId: string | null;
  inviteStatus: 'NONE' | 'ACTIVE' | 'NEEDS_UPDATE';
  inviteCheckedAt: number | null;
  inviteValidatedAt: number | null;
  guildName: string | null;
}

export interface ShareState {
  guildId: string;
  feature: boolean;
  configured: boolean;
  enabled: boolean;
  status: 'ACTIVE' | 'HELD' | 'PROBLEM' | 'OFF';
  statusLabel: string;
  receiving: boolean;
  botPresent: boolean;
  config: ShareConfig | null;
  checklist: { key: string; label: string; ok: boolean }[];
  votes: number;
  reductionMs: number;
  cooldownEndsAt: number;
  lastBroadcastAt: number | null;
  queue: { position: number; total: number; estimateAt: number } | null;
  hold: { reason: 'violations' | 'cms'; at: number; note: string | null } | null;
  disabled: { reason: string; at: number } | null;
  violations: { week: string; count: number; quota: number; resetAt: number };
  recover: { used: number; max: number };
  incidents: { id: number; type: string; firstAt: number; respondedAt: number | null; alertError: string | null }[];
  test: { purpose: string; dueAt: number } | null;
  lastTest: { purpose: string; status: string; result: string | null; at: number } | null;
  rules: Record<string, number>;
  categories: { key: string; label: string; emoji: string }[];
  broadcasts: { id: number; createdAt: number; sent: number; failed: number; skipped: number; blocked: number; removed: number; pending: number; total: number }[];
  received: { id: number; sentAt: number | null; status: string; guard: string | null; lastError: string | null }[];
  history: { id: number; type: string; status: string; firstAt: number; resolvedAt: number | null }[];
  audit: { action: string; detail: string | null; actor: string | null; at: number }[];
}

export interface ShareRequest {
  id: number;
  type: string;
  status: 'pending' | 'running' | 'done' | 'error';
  result: { ok: boolean; message: string } | null;
  error: string | null;
  created_at: string;
  finished_at: string | null;
  actor_name: string | null;
}

export interface ShareDashboard {
  state: ShareState | null;
  updated_at: string | null;
  requests: ShareRequest[];
  bot_online: boolean;
}

export const STATUS_META: Record<ShareState['status'], { label: string; tone: Tone }> = {
  ACTIVE: { label: 'Aktif', tone: 'success' },
  HELD: { label: 'Terhambat', tone: 'danger' },
  PROBLEM: { label: 'Perlu perhatian', tone: 'warning' },
  OFF: { label: 'Nonaktif', tone: 'neutral' },
};

export const REQUEST_LABEL: Record<string, string> = {
  save: 'Simpan pengaturan',
  activate: 'Aktifkan',
  deactivate: 'Nonaktifkan',
  test: 'Pesan Uji pemulihan',
  recheck_invite: 'Cek ulang link',
  ack: 'Konfirmasi alert',
};

export const INCIDENT_LABEL: Record<string, string> = {
  violation: 'Iklan terhapus < 24 jam',
  hold: 'Terhambat',
  invite: 'Link undangan bermasalah',
  channel: 'Channel bermasalah',
};

export const AUDIT_LABEL: Record<string, string> = {
  vote_channel: 'Channel dashboard vote diubah',
  promo_channel: 'Channel penerima promosi diubah',
  profile: 'Profil promosi diubah',
  invite: 'Link undangan disimpan',
  invite_invalid: 'Link undangan tidak valid',
  activate: 'Share Server diaktifkan',
  deactivate: 'Share Server dinonaktifkan',
  test_start: 'Pesan Uji dikirim',
  test_pass: 'Pesan Uji lolos',
  test_fail: 'Pesan Uji gagal',
  broadcast: 'Server ini tayang',
  violation: 'Iklan diterima terhapus < 24 jam',
  hold: 'Terhambat',
  lift: 'Status terhambat dicabut',
  ack: 'Alert dikonfirmasi',
  alerts_channel: 'Channel alert dibuat',
  auto_disable: 'Dinonaktifkan otomatis',
};

/** Permintaan yang masih diproses bot. */
export function pendingRequest(reqs: ShareRequest[] | null | undefined): ShareRequest | null {
  return (reqs ?? []).find((r) => r.status === 'pending' || r.status === 'running') ?? null;
}

/** Status dari bot basi (bot offline / belum pernah menerbitkan). */
export function isStale(updatedAt: string | null, now = Date.now(), maxMs = 20 * 60 * 1000): boolean {
  const t = Date.parse(updatedAt ?? '');
  return !Number.isFinite(t) || now - t > maxMs;
}

export function formatDuration(ms: number): string {
  const m = Math.round(Math.max(0, ms) / 60000);
  const j = Math.floor(m / 60);
  const s = m % 60;
  if (!j) return `${s} menit`;
  return s ? `${j} jam ${s} menit` : `${j} jam`;
}

// ─── Validasi umpan balik (cermin bot) ──────────────────────────────────────

export function validateDescription(text: string, max = 200): string | null {
  const v = String(text ?? '').trim();
  if (v.length < 10) return 'Deskripsi minimal 10 karakter.';
  if (v.length > max) return `Deskripsi maksimal ${max} karakter.`;
  if (/(https?:\/\/|www\.|discord\.(gg|com|io|me|li)|\.gg\/|dsc\.gg)/i.test(v)) return 'Deskripsi tidak boleh berisi tautan.';
  if (/@(everyone|here)|<@[!&]?\d+>|<#\d+>/i.test(v)) return 'Deskripsi tidak boleh berisi mention atau @everyone/@here.';
  return null;
}

/** null = format sah (verifikasi tetap di bot lewat Discord API). */
export function validateInviteUrl(input: string): string | null {
  let u: URL;
  try {
    u = new URL(String(input ?? '').trim());
  } catch {
    return 'Format link tidak dikenali. Contoh: https://discord.gg/kodekamu';
  }
  if (u.protocol !== 'https:') return 'Link wajib memakai https://.';
  if (u.username || u.password || u.port || u.search || u.hash) return 'Hapus bagian setelah kode undangan.';
  const parts = u.pathname.split('/').filter(Boolean);
  const host = u.hostname.toLowerCase();
  const code = host === 'discord.gg' && parts.length === 1 ? parts[0]
    : host === 'discord.com' && parts.length === 2 && parts[0] === 'invite' ? parts[1] : null;
  if (!code) return 'Hanya link resmi discord.gg/… atau discord.com/invite/… yang diterima.';
  if (!/^[A-Za-z0-9-]{2,32}$/.test(code)) return 'Kode undangan tidak sah.';
  return null;
}

export interface ShareDraft {
  voteChannelId?: string;
  promoChannelId?: string;
  category?: string;
  description?: string;
  inviteMode?: 'manual' | 'auto';
  inviteUrl?: string;
  inviteAutoChannelId?: string;
}

/**
 * Payload permintaan `save`: hanya yang berubah dari konfigurasi bot.
 * @returns {{ payload, errors }} errors = pesan validasi klien
 */
export function buildSavePayload(draft: ShareDraft, cfg: ShareConfig | null, max = 200): { payload: Record<string, string>; errors: string[] } {
  const payload: Record<string, string> = {};
  const errors: string[] = [];
  const snow = (v?: string) => typeof v === 'string' && /^[0-9]{15,22}$/.test(v);
  if (snow(draft.voteChannelId) && draft.voteChannelId !== cfg?.voteChannelId) payload.voteChannelId = draft.voteChannelId!;
  if (snow(draft.promoChannelId) && draft.promoChannelId !== cfg?.promoChannelId) payload.promoChannelId = draft.promoChannelId!;
  if (draft.category && draft.category !== cfg?.category) payload.category = draft.category;
  if (draft.description !== undefined && draft.description.trim() !== (cfg?.description ?? '')) {
    const e = validateDescription(draft.description, max);
    if (e) errors.push(e);
    else payload.description = draft.description.trim();
  }
  if (draft.inviteMode === 'manual' && draft.inviteUrl && draft.inviteUrl.trim() !== (cfg?.inviteUrl ?? '')) {
    const e = validateInviteUrl(draft.inviteUrl);
    if (e) errors.push(e);
    else payload.inviteUrl = draft.inviteUrl.trim();
  }
  if (draft.inviteMode === 'auto' && snow(draft.inviteAutoChannelId)) payload.inviteAutoChannelId = draft.inviteAutoChannelId!;
  return { payload, errors };
}
