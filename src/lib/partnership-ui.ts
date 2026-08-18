// Helper tampilan khusus halaman Partnership di panel admin. Berjalan di browser.
//
// Dipisah dari admin-ui.ts supaya helper umum (esc/stateBlock/pesanError) tetap
// ramping, sementara yang khas Partnership (badge status campaign, label) punya
// satu tempat — jadi tampilannya seragam di Overview, History, dan detail.

import { esc } from './admin-ui';

export type CampaignStatus =
  | 'draft' | 'scheduled' | 'queued' | 'running' | 'completed' | 'cancelled' | 'failed';

const WARNA: Record<string, string> = {
  draft:     'bg-ink-500/15 text-ink-500 dark:text-cream-300/60',
  scheduled: 'bg-teal-500/15 text-teal-700 dark:text-teal-300',
  queued:    'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  running:   'bg-amber-500/25 text-amber-800 dark:text-amber-300',
  completed: 'bg-teal-500/15 text-teal-700 dark:text-teal-300',
  cancelled: 'bg-ink-500/15 text-ink-500 dark:text-cream-300/60',
  failed:    'bg-red-500/15 text-red-600 dark:text-red-400',
};

const LABEL: Record<string, string> = {
  draft: 'Draft',
  scheduled: 'Terjadwal',
  queued: 'Mengantre',
  running: 'Berjalan',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
  failed: 'Gagal',
};

/** Badge status campaign (HTML siap tempel, sudah di-escape). */
export function statusBadge(status: string): string {
  const s = String(status ?? '');
  const warna = WARNA[s] ?? WARNA.draft;
  const label = LABEL[s] ?? s;
  return `<span class="inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[0.7rem] font-medium ${warna}">${esc(label)}</span>`;
}

/** Badge status pengiriman per penerima. */
export function recipientBadge(status: string): string {
  const peta: Record<string, string> = {
    pending: 'bg-ink-500/15 text-ink-500 dark:text-cream-300/60',
    success: 'bg-teal-500/15 text-teal-700 dark:text-teal-300',
    failed:  'bg-red-500/15 text-red-600 dark:text-red-400',
    skipped: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  };
  const s = String(status ?? 'pending');
  return `<span class="inline-block rounded-full px-2 py-0.5 text-[0.65rem] font-medium ${peta[s] ?? peta.pending}">${esc(s)}</span>`;
}

/** Campaign yang masih bisa dibatalkan. */
export function bisaDibatalkan(status: string): boolean {
  return status === 'queued' || status === 'running';
}

/** Progress bar sederhana (0–100%). */
export function progressBar(sent: number, total: number): string {
  const t = Math.max(0, Number(total) || 0);
  const s = Math.min(Math.max(0, Number(sent) || 0), t || Number.MAX_SAFE_INTEGER);
  const pct = t > 0 ? Math.round((s / t) * 100) : 0;
  return `
    <div class="h-2 w-full overflow-hidden rounded-full bg-ink-900/10 dark:bg-cream-100/10">
      <div class="h-full rounded-full bg-amber-500 transition-all" style="width:${pct}%"></div>
    </div>
    <p class="mt-1 text-xs text-ink-500 dark:text-cream-300/60 tabular-nums">${s} / ${t} terkirim (${pct}%)</p>`;
}
