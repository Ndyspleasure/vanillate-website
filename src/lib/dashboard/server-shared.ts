// Bagian bersama halaman server: navigasi, konteks halaman untuk modul tab yang
// dimuat malas (tab-*.ts), dan pemeriksaan status per fitur.
//
// Halaman server dipecah per tab supaya browser hanya mengunduh kode tab yang
// dibuka (hemat JS terkirim): inti ada di server-page.ts, isi tab di tab-*.ts.

import type { IconName } from '@data/icons';
import {
  channelById,
  describeIssue,
  diffStates,
  permissionWarnings,
  serverIssues,
  validateDraft,
  type ConfigState,
  type Feature,
  type GuildData,
  type Issue,
  type TextContext,
} from './model';
import { esc, icon } from './ui';

export * from './nav-model';

// Ikon SVG per fitur (pengganti emoji dari registry bot), dikunci runtime_key.
// Fitur baru yang belum terdaftar memakai ikon bagiannya.
const FEATURE_ICON: Record<string, IconName> = {
  sambungkata: 'type',
  werewolf: 'moon',
  werewolf_adv: 'moon-star',
  pengacara: 'scale',
  uno: 'layers',
  tebaklagu: 'music',
  tahu: 'store',
  counting: 'list-ordered',
  streak_harian: 'flame',
  verification: 'shield-check',
  leveling: 'trending-up',
  autorole: 'tag',
  welcome: 'handshake',
  security: 'shield',
};
const SECTION_ICON: Record<string, IconName> = {
  game: 'gamepad-2',
  social: 'users',
  verification: 'shield-check',
  leveling: 'trending-up',
  autorole: 'tag',
  welcome: 'handshake',
  security: 'shield',
};

export function featureIcon(f: Feature): IconName {
  const runtimeKey = typeof f.meta?.runtime_key === 'string' ? f.meta.runtime_key : '';
  return FEATURE_ICON[runtimeKey] ?? SECTION_ICON[f.section] ?? 'settings-2';
}

/** Ikon fitur kecil sebaris teks (daftar Ringkasan, Peta Channel). */
export function featureLabel(f: Feature): string {
  return `<span class="inline-flex min-w-0 items-center gap-2">${icon(featureIcon(f), 'h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400')}<span class="truncate">${esc(f.name)}</span></span>`;
}

/** Kartu terakhir yang ganjil melebar penuh, jadi tidak ada slot kosong di kanan (desktop). */
export const SPAN_LAST = 'lg:[&>*:last-child:nth-child(odd)]:col-span-2';

/**
 * Keadaan halaman yang dibutuhkan modul tab. Dibuat ulang tiap render oleh
 * server-page.ts; `draft` adalah objek yang sama dengan milik halaman, jadi
 * modul tab boleh mengubah isinya lalu memanggil `render()`.
 */
export interface PageCtx {
  guildId: string;
  data: GuildData;
  base: ConfigState;
  draft: ConfigState;
  attemptIssues: Issue[];
  editable: boolean;
  saving: boolean;
  text: TextContext;
  /** Registry terurut. */
  registry: Feature[];
  serverNow(): number;
  render(): void;
  /** Hapus pesan gagal simpan milik satu fitur (setelah fitur itu disunting). */
  clearAttempt(featureKey: string): void;
  /** Ganti seluruh draft (dipakai "Kembalikan" di Riwayat). */
  replaceDraft(next: ConfigState): void;
}

export type FeatureLevel = 'ok' | 'warn' | 'error' | 'off' | 'dirty';

/** Status satu fitur dari draft: valid, belum disimpan, atau perlu perhatian beserta pesannya. */
export function featureIssues(c: PageCtx, f: Feature): { level: FeatureLevel; messages: string[] } {
  const d = c.data;
  const s = c.draft[f.key];
  const messages: string[] = [];
  let level: FeatureLevel = s.enabled ? 'ok' : 'off';

  const mine = (i: Issue) => i.feature === f.key;
  const changed = diffStates({ [f.key]: c.base[f.key] }, { [f.key]: s }, [f]).length > 0;
  const errs = [...validateDraft(c.draft, c.base, d.registry, d.snapshot).filter(mine), ...c.attemptIssues.filter(mine)];
  const fromBot = !changed ? serverIssues(d.config).filter(mine) : [];
  const warns = permissionWarnings({ [f.key]: s }, [f], d.snapshot);
  if (s.enabled && d.snapshot?.refreshed_at) {
    for (const p of f.purposes) {
      const id = s.channels[p.key];
      if (id && id === c.base[f.key]?.channels[p.key] && !channelById(d.snapshot, id)) {
        warns.push({ code: 'CHANNEL_NOT_FOUND', feature: f.key, purpose: p.key, channel_id: id });
      }
    }
  }
  const seen = new Set<string>();
  const push = (i: Issue) => {
    const t = describeIssue(i, c.text);
    if (!seen.has(t)) {
      seen.add(t);
      messages.push(t);
    }
  };
  errs.forEach(push);
  fromBot.forEach(push);
  if (s.enabled) warns.forEach(push);

  if (errs.length || fromBot.length) level = 'error';
  else if (s.enabled && warns.length) level = 'warn';
  else if (changed) level = 'dirty';
  return { level, messages };
}
