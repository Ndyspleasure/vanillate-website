// Navigasi halaman server (murni, tanpa DOM): kategori, submenu Server Hub,
// dan pemetaan hash URL. Dites di tests/dashboard-review.test.ts supaya hash
// lama (#overview, #game-hub, #social-hub, #verification, #leveling,
// #share-server, #channels, #audit-log) tidak pernah rusak.

import type { IconName } from '@data/icons';
import type { Feature } from './model';

export type Tab =
  | 'overview'
  | 'game-hub'
  | 'social-hub'
  | 'verification'
  | 'leveling'
  | 'autorole'
  | 'welcome'
  | 'security'
  | 'share-server'
  | 'channels'
  | 'audit-log';
export type Hub = 'overview' | 'game-hub' | 'social-hub' | 'server-hub';

// Navigasi dua tingkat: kategori utama di atas, submenu Server Hub di sidebar.
// Hash URL tetap id tab (#verification, #share-server, …) supaya tautan lama
// dan tautan dari bot (dashboardLink) tetap berlaku; #server-hub = submenu terakhir.
export const HUBS: { id: Hub; label: string }[] = [
  { id: 'overview', label: 'Ringkasan' },
  { id: 'game-hub', label: 'Game Hub' },
  { id: 'social-hub', label: 'Social Hub' },
  { id: 'server-hub', label: 'Server Hub' },
];

export interface ServerTab {
  id: Tab;
  label: string;
  ic: IconName;
}

/** Submenu Server Hub, dikelompokkan menurut urusannya (urutan = urutan tampil). */
export const SERVER_GROUPS: { label: string; tabs: ServerTab[] }[] = [
  {
    label: 'Member baru',
    tabs: [
      { id: 'verification', label: 'Verification', ic: 'shield-check' },
      { id: 'autorole', label: 'Auto Role', ic: 'tag' },
      { id: 'welcome', label: 'Welcome', ic: 'handshake' },
    ],
  },
  {
    label: 'Aktivitas dan keamanan',
    tabs: [
      { id: 'leveling', label: 'Leveling', ic: 'trending-up' },
      { id: 'security', label: 'Security Center', ic: 'shield' },
    ],
  },
  {
    label: 'Promosi',
    tabs: [{ id: 'share-server', label: 'Share Server', ic: 'radio' }],
  },
  {
    label: 'Alat',
    tabs: [
      { id: 'channels', label: 'Peta Channel', ic: 'hash' },
      { id: 'audit-log', label: 'Riwayat', ic: 'history' },
    ],
  },
];

export const SERVER_TABS: ServerTab[] = SERVER_GROUPS.flatMap((g) => g.tabs);
export const TAB_IDS: Tab[] = ['overview', 'game-hub', 'social-hub', ...SERVER_TABS.map((t) => t.id)];

export function hubOf(tab: Tab): Hub {
  return SERVER_TABS.some((t) => t.id === tab) ? 'server-hub' : (tab as Hub);
}

/** Hash URL → tab. Hash tak dikenal jatuh ke Ringkasan; #server-hub ke submenu terakhir. */
export function parseTabHash(hash: string, lastServerTab: Tab): Tab {
  const id = hash.replace(/^#/, '');
  if (id === 'server-hub') return lastServerTab;
  return TAB_IDS.includes(id as Tab) ? (id as Tab) : 'overview';
}

export const SECTION_OF_TAB: Partial<Record<Tab, string>> = {
  'game-hub': 'game',
  'social-hub': 'social',
  verification: 'verification',
  leveling: 'leveling',
  autorole: 'autorole',
  welcome: 'welcome',
  security: 'security',
};

/** Tab tempat sebuah fitur diatur (bagian tak dikenal jatuh ke Game Hub). */
export function tabOfFeature(f: Pick<Feature, 'section'>): Tab {
  return (Object.keys(SECTION_OF_TAB) as Tab[]).find((t) => SECTION_OF_TAB[t] === f.section) ?? 'game-hub';
}
