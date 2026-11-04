// /dashboard/server/?id=<guildId> — konfigurasi satu server.
//
// Alur (docs/DASHBOARD-SERVER.md §Alur):
//   muat → draft lokal (DRAFT) → Simpan (SAVING) → revisi N+1 di database
//   (SAVED/SYNCING) → bot menerapkan → applied = N+1 (ACTIVE) atau gagal
//   (NEEDS_ATTENTION). Tidak ada yang ditulis ke database sebelum Simpan.

import {
  auditList,
  DashboardError,
  getGuild,
  getSession,
  isDashboardConfigured,
  requestDiscordRefresh,
  requestResync,
  saveConfig,
} from './api';
import {
  AUDIT_ACTION,
  buildSavePayload,
  channelById,
  channelLabel,
  channelOptions,
  cloneState,
  describeError,
  describeIssue,
  diffStates,
  displayStatus,
  formatAuditChange,
  formatWib,
  guildIconUrl,
  guildInitials,
  inviteUrl,
  isNotUsed,
  isSnowflake,
  missingPermissions,
  NOT_USED,
  normalizeState,
  permissionWarnings,
  relativeTime,
  parseSecuritySummary,
  featureLock,
  LOCK_FALLBACK_NOTE,
  categoryLabel,
  roleLabel,
  roleOptions,
  serverIssues,
  settingValue,
  sortedRegistry,
  STATUS_META,
  supportsNotUsed,
  typedSettings,
  validateDraft,
  type AuditRow,
  type ConfigState,
  type Feature,
  type GuildData,
  type Issue,
  type Purpose,
  type RewardRow,
  type GuideRow,
  type SettingProp,
  type TextContext,
  type Tone,
} from './model';
import { rememberNextAndGoToLogin } from './servers-page';
import type { IconName } from '@data/icons';
import { BTN_PRIMARY, BTN_SECONDARY, CARD, esc, guildAvatar, icon, loadingBlock, pill, spinner, toast, wireAvatars } from './ui';
import { createShareController } from './share-server';
import { overviewStatsHtml } from './overview';
import { isStatsStale, parseStatsSummary } from './stats-model';
import { previewHtml, previewKind, type PreviewContext } from './message-preview';

/** Kartu terakhir yang ganjil melebar penuh, jadi tidak ada slot kosong di kanan (desktop). */
const SPAN_LAST = 'lg:[&>*:last-child:nth-child(odd)]:col-span-2';

type Tab = 'overview' | 'game-hub' | 'social-hub' | 'verification' | 'leveling' | 'autorole' | 'welcome' | 'security' | 'share-server' | 'channels' | 'audit-log';
type Hub = 'overview' | 'game-hub' | 'social-hub' | 'server-hub';

// Navigasi dua tingkat: kategori utama di atas, submenu Server Hub di sidebar.
// Hash URL tetap id tab (#verification, #share-server, …) supaya tautan lama
// & tautan dari bot (dashboardLink) tetap berlaku; #server-hub = submenu terakhir.
const HUBS: { id: Hub; label: string }[] = [
  { id: 'overview', label: 'Ringkasan' },
  { id: 'game-hub', label: 'Game Hub' },
  { id: 'social-hub', label: 'Social Hub' },
  { id: 'server-hub', label: 'Server Hub' },
];

const SERVER_TABS: { id: Tab; label: string; ic: IconName }[] = [
  { id: 'verification', label: 'Verification', ic: 'shield-check' },
  { id: 'leveling', label: 'Leveling', ic: 'trending-up' },
  { id: 'autorole', label: 'Auto Role', ic: 'tag' },
  { id: 'welcome', label: 'Welcome', ic: 'handshake' },
  { id: 'security', label: 'Security Center', ic: 'shield' },
  { id: 'share-server', label: 'Share Server', ic: 'radio' },
  { id: 'channels', label: 'Channel', ic: 'hash' },
  { id: 'audit-log', label: 'Riwayat', ic: 'history' },
];

const TAB_IDS: Tab[] = ['overview', 'game-hub', 'social-hub', ...SERVER_TABS.map((t) => t.id)];

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
const SECTION_ICON: Record<string, IconName> = { game: 'gamepad-2', social: 'users', verification: 'shield-check', leveling: 'trending-up', autorole: 'tag', welcome: 'handshake', security: 'shield' };

function featureIcon(f: Feature): IconName {
  const runtimeKey = typeof f.meta?.runtime_key === 'string' ? f.meta.runtime_key : '';
  return FEATURE_ICON[runtimeKey] ?? SECTION_ICON[f.section] ?? 'settings-2';
}

/** Ikon fitur kecil sebaris teks (daftar Ringkasan, tabel Channel). */
function featureLabel(f: Feature): string {
  return `<span class="inline-flex min-w-0 items-center gap-2">${icon(featureIcon(f), 'h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400')}<span class="truncate">${esc(f.name)}</span></span>`;
}

function hubOf(tab: Tab): Hub {
  return SERVER_TABS.some((t) => t.id === tab) ? 'server-hub' : (tab as Hub);
}

const SECTION_OF_TAB: Partial<Record<Tab, string>> = { 'game-hub': 'game', 'social-hub': 'social', verification: 'verification', leveling: 'leveling', autorole: 'autorole', welcome: 'welcome', security: 'security' };

const FAST_POLL_MS = 2500;
const SLOW_POLL_MS = 15000;
const IDLE_POLL_MS = 30000;
const SYNC_TIMEOUT_MS = 60000;
const REFRESH_TIMEOUT_MS = 30000;
const STALE_SNAPSHOT_MS = 10 * 60 * 1000;
const STATS_AUTO_REFRESH_MS = 60 * 60 * 1000;

interface PageConfig {
  root: HTMLElement;
  clientId: string;
  permissions: string;
}

export function mountServerPage(cfg: PageConfig): void {
  const { root } = cfg;
  const guildId = new URLSearchParams(location.search).get('id') ?? '';

  let data: GuildData | null = null;
  let base: ConfigState = {};
  let draft: ConfigState = {};
  // Submenu Server Hub yang terakhir dibuka (tujuan klik "Server Hub").
  let lastServerTab: Tab = 'verification';
  let tab: Tab = parseTab(location.hash);
  if (hubOf(tab) === 'server-hub') lastServerTab = tab;
  let saving = false;
  let justSaved = false;
  let attemptIssues: Issue[] = []; // dari percobaan simpan (klien/server)
  let pageError: { code: string; detail: Record<string, unknown> | null } | null = null;
  let audit: AuditRow[] | null = null;
  let auditDone = false;
  let auditLoading = false;
  let auditError = false;
  let syncWatchUntil = 0;
  // Selesai saat refreshed_at snapshot berubah dari nilai sebelum permintaan
  // (dibandingkan dengan nilai dari server, bukan jam browser).
  let refreshWatch: { prev: string | null; until: number; quiet?: boolean } | null = null;
  let pollTimer: ReturnType<typeof setTimeout> | null = null;
  let remoteChanged = false;
  // Revisi tempat draft dibuat. Dikirim saat simpan, jadi perubahan dari tempat
  // lain selama mengedit selalu ditolak STALE_REVISION (bukan ditimpa diam-diam).
  let baseRevision = 0;
  // Selisih jam server − jam browser (server_time dari guild_dashboard_get).
  let clockSkew = 0;
  let deferredRender = false;
  let selectFocusAt = 0;

  // Dibaca lewat fungsi: TypeScript tidak tahu load() mengubah `data`.
  const current = (): GuildData | null => data;
  const ctx = (): TextContext => ({ registry: data?.registry ?? [], snapshot: data?.snapshot ?? null });
  const registry = () => sortedRegistry(data?.registry ?? []);
  const changes = () => (data ? diffStates(base, draft, data.registry) : []);
  const dirty = () => changes().length > 0;
  const editable = () => Boolean(data?.bot.installed);
  const serverNow = () => Date.now() + clockSkew;
  // 📣 Share Server punya data & antreannya sendiri (bukan revisi dashboard).
  const share = createShareController(guildId, () => renderAll(), root);

  function parseTab(hash: string): Tab {
    const id = hash.replace(/^#/, '');
    if (id === 'server-hub') return lastServerTab;
    return TAB_IDS.includes(id as Tab) ? (id as Tab) : 'overview';
  }

  // ─── Data ────────────────────────────────────────────────────────────────

  function applyData(next: GuildData, { keepDraft }: { keepDraft: boolean }): void {
    const wasDirty = data ? dirty() : false;
    const nextRevision = next.config?.revision ?? 0;
    data = next;
    const serverTime = Date.parse(next.server_time);
    if (Number.isFinite(serverTime)) clockSkew = serverTime - Date.now();
    const serverState = normalizeState(next.state, next.registry);
    if (!keepDraft || !wasDirty) {
      base = serverState;
      draft = cloneState(serverState);
      baseRevision = nextRevision;
      remoteChanged = false;
    } else if (nextRevision === baseRevision) {
      base = serverState;
      // Fitur baru di registry (bot baru diperbarui) ikut masuk ke draft.
      for (const k of Object.keys(serverState)) if (!draft[k]) draft[k] = cloneState({ [k]: serverState[k] })[k];
    } else {
      // Ada yang menyimpan di tempat lain saat user sedang mengedit: draft &
      // base dipertahankan (simpan ditolak STALE_REVISION sampai dimuat ulang).
      // Fitur baru di registry tetap dilengkapi supaya tampilan tidak rusak.
      for (const k of Object.keys(serverState)) {
        if (!base[k]) base[k] = cloneState({ [k]: serverState[k] })[k];
        if (!draft[k]) draft[k] = cloneState({ [k]: serverState[k] })[k];
      }
      remoteChanged = true;
    }
    if (next.config && next.config.revision <= next.config.applied_revision) justSaved = false;
  }

  async function load(keepDraft = false): Promise<void> {
    try {
      const next = await getGuild(guildId);
      pageError = null;
      applyData(next, { keepDraft });
    } catch (err) {
      pageError = err instanceof DashboardError ? { code: err.code, detail: err.detail } : { code: 'NETWORK', detail: null };
      if (pageError.code === 'NOT_AUTHENTICATED') return rememberNextAndGoToLogin(location.pathname + location.search + location.hash);
      if (pageError.code === 'DISCORD_RELOGIN') return rememberNextAndGoToLogin(location.pathname + location.search + location.hash);
    }
  }

  /** Bot belum memproses revisi tersimpan atau permintaan Retry Sync. */
  function waitingForBot(): boolean {
    const c = data?.config;
    if (!c) return false;
    if (c.revision > c.applied_revision && c.sync_status !== 'NEEDS_ATTENTION') return true;
    if (!c.resync_requested_at) return false;
    const attempted = Date.parse(c.attempted_at ?? '');
    return !Number.isFinite(attempted) || Date.parse(c.resync_requested_at) > attempted;
  }

  function schedulePoll(): void {
    if (pollTimer) clearTimeout(pollTimer);
    const now = Date.now();
    let delay = IDLE_POLL_MS;
    if (refreshWatch && now < refreshWatch.until) delay = FAST_POLL_MS;
    else if (waitingForBot()) delay = now < syncWatchUntil ? FAST_POLL_MS : SLOW_POLL_MS;
    pollTimer = setTimeout(poll, delay);
  }

  /** Bot belum juga mengambil revisi tersimpan setelah SYNC_TIMEOUT_MS (jam server). */
  function syncTimedOut(): boolean {
    const c = data?.config;
    return Boolean(c && data?.bot.online && c.revision > c.applied_revision && c.sync_status !== 'NEEDS_ATTENTION'
      && c.attempted_revision !== c.revision && Date.parse(c.updated_at) < serverNow() - SYNC_TIMEOUT_MS);
  }

  /** Isi yang ditampilkan (tanpa stempel waktu yang berubah tiap permintaan). */
  const renderSignature = () =>
    JSON.stringify({ data: data ? { ...data, server_time: null, bot: { ...data.bot, last_heartbeat_at: null } } : null, pageError, timedOut: syncTimedOut() });

  /** Riwayat bertambah saat revisi/percobaan/permintaan berubah → muat ulang. */
  const auditSignature = (c: GuildData['config'] | undefined) =>
    c ? `${c.revision}|${c.applied_revision}|${c.attempted_at ?? ''}|${c.resync_requested_at ?? ''}` : '';

  async function poll(): Promise<void> {
    if (pollTimer) clearTimeout(pollTimer);
    pollTimer = null;
    try {
      if (document.hidden) return;
      const before = data;
      const beforeSig = renderSignature();
      const watching = refreshWatch;
      const wasRemote = remoteChanged;
      await load(true);
      if (!data) return;

      if (refreshWatch) {
        if ((data.snapshot?.refreshed_at ?? null) !== refreshWatch.prev) {
          const quiet = refreshWatch.quiet;
          refreshWatch = null;
          if (!quiet) toast('Data channel dari Discord diperbarui.', 'success');
        } else if (Date.now() > refreshWatch.until) {
          const quiet = refreshWatch.quiet;
          refreshWatch = null;
          if (!quiet) toast(data.bot.online ? 'Bot belum mengirim data channel. Coba lagi sebentar lagi.' : 'Bot sedang offline. Data channel diperbarui saat bot online.', 'warning', 6000);
        }
      }
      const was = before?.config;
      const now = data.config;
      if (was && now && was.applied_revision < now.applied_revision && now.applied_revision >= now.revision) {
        toast(now.sync_status === 'ACTIVE' ? `Revisi ${now.applied_revision} sudah diterapkan bot.` : 'Revisi diterapkan, tapi ada yang perlu diperhatikan.', now.sync_status === 'ACTIVE' ? 'success' : 'warning');
      }
      const justApplied = Boolean(was && now && was.applied_revision < now.applied_revision);
      if (was && now && !justApplied && now.sync_status === 'NEEDS_ATTENTION' && was.sync_status !== 'NEEDS_ATTENTION') {
        toast('Bot menemukan masalah saat menerapkan konfigurasi. Lihat bagian Perlu perhatian.', 'danger', 6000);
      }
      if (now && now.revision > (was?.revision ?? 0) && was && !justSaved && now.updated_source !== 'web') {
        toast('Konfigurasi baru saja diubah dari luar dashboard (bot atau tim Vanillate).', 'info', 6000);
      }
      if (audit !== null && auditSignature(was) !== auditSignature(now)) {
        audit = null;
        auditDone = false;
      }
      // Tidak ada yang berubah → jangan gambar ulang (fokus tetap di tempatnya),
      // kecuali gambar ulang yang tertunda sudah melewati batas 15 detik.
      const deferExpired = deferredRender && Date.now() - selectFocusAt >= 15000;
      if (!deferExpired && renderSignature() === beforeSig && refreshWatch === watching && remoteChanged === wasRemote) return;
      // Dropdown channel sedang dipakai: tunda gambar ulang (mengganti
      // elemennya menutup daftar pilihan di tengah jalan) — paling lama 15 dtk.
      const active = document.activeElement;
      if (active instanceof HTMLSelectElement && root.contains(active) && Date.now() - selectFocusAt < 15000) {
        deferredRender = true;
        return;
      }
      renderAll();
    } finally {
      schedulePoll();
    }
  }

  // ─── Render: kerangka ────────────────────────────────────────────────────

  /** Selector untuk memulihkan fokus setelah innerHTML diganti. */
  function focusSelector(el: HTMLElement | null): string | null {
    if (!el || !root.contains(el)) return null;
    if (el.dataset.focus) return `[data-focus="${CSS.escape(el.dataset.focus)}"]`;
    if (el.id) return `#${CSS.escape(el.id)}`;
    if (el.dataset.action) return `[data-action="${CSS.escape(el.dataset.action)}"]`;
    return null;
  }

  function renderAll(): void {
    deferredRender = false;
    if (!data) return renderError();
    const focusSel = focusSelector(document.activeElement as HTMLElement | null);
    // Posisi gulir daftar pilihan (role/channel) ikut dipulihkan.
    const scrolls = [...root.querySelectorAll<HTMLElement>('[data-scroll-keep]')].map((el) => [el.dataset.scrollKeep!, el.scrollTop] as const);

    root.innerHTML = `
      <a href="/dashboard/" class="inline-flex items-center gap-1.5 text-sm text-ink-600 hover:text-ink-900 dark:text-cream-300 dark:hover:text-cream-50">
        ${icon('arrow-left')} Semua server
      </a>
      <div class="mt-4" data-region="header">${headerHtml()}</div>
      <div data-region="attention">${attentionHtml()}</div>
      ${navHtml()}
      ${saveBarHtml()}`;
    wireAvatars(root);
    for (const [k, top] of scrolls) {
      const el = root.querySelector<HTMLElement>(`[data-scroll-keep="${CSS.escape(k)}"]`);
      if (el) el.scrollTop = top;
    }
    if (focusSel) root.querySelector<HTMLElement>(focusSel)?.focus({ preventScroll: true });
    if (tab === 'audit-log' && audit === null && !auditLoading && !auditError) void loadAudit();
    if (tab === 'share-server') share.activate();
    else share.deactivate();
  }

  // ─── Navigasi ────────────────────────────────────────────────────────────

  function navHtml(): string {
    const hub = hubOf(tab);
    const panel = `<section id="panel" role="tabpanel" aria-labelledby="${hub === 'server-hub' ? `subtab-${tab}` : `tab-${hub}`}" class="min-w-0 pb-6 sm:pb-10">${panelHtml()}</section>`;
    const top = `
      <div class="mt-4 sm:mt-6" role="tablist" aria-label="Kategori pengaturan">
        <div class="grid grid-cols-4 gap-1 rounded-2xl border border-ink-900/10 bg-white/60 p-1 sm:inline-flex sm:rounded-full dark:border-cream-100/10 dark:bg-ink-900/40">
          ${HUBS.map(
            (h) => `<button type="button" role="tab" id="tab-${h.id}" aria-controls="panel" aria-selected="${h.id === hub}" data-tab="${h.id}"
              class="rounded-xl px-1.5 py-2 text-xs font-medium leading-tight transition sm:rounded-full sm:px-4 sm:text-sm ${h.id === hub ? 'bg-amber-500 text-ink-950' : 'text-ink-600 hover:bg-ink-900/5 dark:text-cream-300 dark:hover:bg-cream-100/5'}">${h.label}</button>`,
          ).join('')}
        </div>
      </div>`;
    if (hub !== 'server-hub') return `${top}<div class="mt-4 sm:mt-6">${panel}</div>`;
    // Server Hub: sidebar kiri (md ke atas) · baris submenu bergeser di HP.
    const side = `
      <nav aria-label="Submenu Server Hub" class="-mx-4 overflow-x-auto px-4 md:mx-0 md:overflow-visible md:px-0">
        <div role="tablist" class="flex min-w-max gap-1 md:sticky md:top-24 md:min-w-0 md:flex-col md:rounded-2xl md:border md:border-ink-900/10 md:bg-white/60 md:p-2 dark:md:border-cream-100/10 dark:md:bg-ink-900/40">
          ${SERVER_TABS.map((t) => {
            const on = t.id === tab;
            return `<button type="button" role="tab" id="subtab-${t.id}" aria-controls="panel" aria-selected="${on}" data-tab="${t.id}"
              class="inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition md:w-full md:rounded-xl md:border-0 md:px-3 md:py-2.5 md:text-left ${
                on
                  ? 'border-amber-500/40 bg-amber-500/15 text-amber-900 dark:text-amber-200'
                  : 'border-ink-900/10 text-ink-600 hover:bg-ink-900/5 dark:border-cream-100/10 dark:text-cream-300 dark:hover:bg-cream-100/5'
              }">${icon(t.ic, 'h-4 w-4 shrink-0')} ${t.label}</button>`;
          }).join('')}
        </div>
      </nav>`;
    return `${top}
      <div class="mt-3 grid gap-4 sm:mt-4 md:mt-6 md:grid-cols-[12rem_minmax(0,1fr)] md:items-start md:gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">${side}${panel}</div>`;
  }

  function renderError(): void {
    const code = pageError?.code ?? 'NETWORK';
    root.innerHTML = `
      <a href="/dashboard/" class="inline-flex items-center gap-1.5 text-sm text-ink-600 hover:text-ink-900 dark:text-cream-300">${icon('arrow-left')} Semua server</a>
      <div class="${CARD} mx-auto mt-6 max-w-xl p-8 text-center">
        <span class="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/15 text-red-600 dark:text-red-300">${icon(code === 'ACCESS_DENIED' ? 'lock' : 'triangle-alert', 'h-6 w-6')}</span>
        <h1 class="mt-4 font-display text-2xl font-semibold">${code === 'ACCESS_DENIED' ? 'Tidak punya akses' : 'Gagal memuat server'}</h1>
        <p class="mt-3 text-sm text-ink-600 dark:text-cream-300">${esc(describeError(code, pageError?.detail))}</p>
        <div class="mt-6 flex justify-center gap-3">
          <a href="/dashboard/" class="${BTN_SECONDARY}">Kembali</a>
          <button type="button" data-action="reload" class="${BTN_PRIMARY}">${icon('refresh-cw')} Coba lagi</button>
        </div>
      </div>`;
  }

  function statusTone(): { label: string; tone: Tone; hint: string } {
    const s = displayStatus({ bot: data!.bot, config: data!.config, dirty: dirty(), saving, justSaved });
    return STATUS_META[s];
  }

  function headerHtml(): string {
    const d = data!;
    const name = d.guild.name ?? `Server ${guildId}`;
    const st = statusTone();
    const c = d.config;
    const bot = !d.bot.installed
      ? pill('Bot tidak terpasang', 'neutral')
      : d.bot.online
        ? pill('Bot online', 'success')
        : pill('Bot offline', 'neutral');
    const source = c?.updated_source === 'discord' ? 'Discord' : c?.updated_source === 'import' ? 'impor otomatis' : 'website';
    return `
      <div class="${CARD} p-4 sm:p-6">
        <div class="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
          <div class="flex min-w-0 items-center gap-3 sm:gap-4">
            ${guildAvatar(guildIconUrl(guildId, d.guild.icon), guildInitials(name), 'h-12 w-12 text-base sm:h-14 sm:w-14 sm:text-lg')}
            <div class="min-w-0">
              <p class="eyebrow">Sedang mengatur</p>
              <h1 class="truncate font-display text-2xl font-semibold sm:text-3xl" title="${esc(name)}">${esc(name)}</h1>
              <p class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500 dark:text-cream-300/70">
                <span>Guild ID <span class="font-mono">${esc(guildId)}</span>
                  <button type="button" data-action="copy-id" class="ml-1 inline-flex align-middle text-ink-400 hover:text-amber-600" aria-label="Salin Guild ID">${icon('copy', 'h-3.5 w-3.5')}</button></span>
                ${d.guild.member_count != null ? `<span>${d.guild.member_count.toLocaleString('id-ID')} member</span>` : ''}
              </p>
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-2">${bot}${pill(st.label, st.tone)}</div>
        </div>
        <div class="mt-4 grid grid-cols-3 gap-2 text-sm sm:mt-5 sm:gap-3">
          <div class="min-w-0 rounded-xl bg-ink-900/[0.03] px-3 py-2.5 sm:px-4 sm:py-3 dark:bg-cream-100/[0.04]">
            <p class="text-xs text-ink-500 dark:text-cream-300/70">Revisi tersimpan</p>
            <p class="mt-0.5 font-display text-lg font-semibold sm:text-xl">${c?.revision ?? 0}</p>
          </div>
          <div class="min-w-0 rounded-xl bg-ink-900/[0.03] px-3 py-2.5 sm:px-4 sm:py-3 dark:bg-cream-100/[0.04]">
            <p class="text-xs text-ink-500 dark:text-cream-300/70">Diterapkan bot</p>
            <p class="mt-0.5 font-display text-lg font-semibold sm:text-xl">${c?.applied_revision ?? 0}</p>
          </div>
          <div class="min-w-0 rounded-xl bg-ink-900/[0.03] px-3 py-2.5 sm:px-4 sm:py-3 dark:bg-cream-100/[0.04]">
            <p class="text-xs text-ink-500 dark:text-cream-300/70">Sinkron terakhir</p>
            <p class="mt-0.5 truncate font-medium" title="${esc(formatWib(c?.applied_at))}">${c ? esc(relativeTime(c.applied_at)) : 'Pengaturan bawaan'}</p>
          </div>
        </div>
        <p class="mt-3 text-xs text-ink-500 dark:text-cream-300/70">${esc(st.hint)}${
          c ? ` Diubah terakhir oleh <strong>${esc(c.updated_by_name ?? c.updated_by ?? 'tidak diketahui')}</strong> lewat ${source}, ${esc(formatWib(c.updated_at))}.` : ''
        }</p>
        <div class="mt-3 flex flex-wrap gap-2 sm:mt-4">
          <button type="button" data-action="resync" class="${BTN_SECONDARY}" ${c && d.bot.installed ? '' : 'disabled'}>${icon('refresh-cw')} Retry Sync</button>
          <button type="button" data-action="discord-refresh" class="${BTN_SECONDARY}" ${d.bot.installed && !refreshWatch ? '' : 'disabled'}>
            ${refreshWatch ? spinner() : icon('refresh-cw')} Refresh Discord Data</button>
        </div>
      </div>`;
  }

  // ─── Perlu perhatian ─────────────────────────────────────────────────────

  function topIssues(): { text: string; tone: Tone; action?: string }[] {
    const d = data!;
    const out: { text: string; tone: Tone; action?: string }[] = [];
    const seen = new Set<string>();
    const add = (i: Issue, tone: Tone) => {
      const k = `${i.code}|${i.feature ?? ''}|${i.purpose ?? ''}|${i.channel_id ?? ''}`;
      if (seen.has(k)) return;
      seen.add(k);
      out.push({ text: describeIssue(i, ctx()), tone });
    };

    if (!d.bot.installed) {
      out.push({ text: 'Bot Vanillate belum ada di server ini. Undang bot dulu, lalu muat ulang halaman.', tone: 'neutral', action: 'invite' });
      return out;
    }
    if (pageError) out.push({ text: describeError(pageError.code, pageError.detail), tone: 'danger' });
    for (const i of attemptIssues) add(i, 'danger');
    for (const i of serverIssues(d.config)) add(i, 'danger');
    for (const i of permissionWarnings(base, d.registry, d.snapshot)) add(i, 'warning');
    for (const f of registry()) {
      const s = base[f.key];
      if (!s?.enabled || !d.snapshot?.refreshed_at) continue;
      for (const p of f.purposes) {
        const id = s.channels[p.key];
        if (id && !channelById(d.snapshot, id)) add({ code: 'CHANNEL_NOT_FOUND', feature: f.key, purpose: p.key, channel_id: id }, 'warning');
      }
    }
    if (!d.snapshot?.refreshed_at) {
      out.push({ text: 'Daftar channel dari Discord belum dimuat. Tekan Refresh Discord Data.', tone: 'info' });
    }
    if (!d.bot.online) {
      out.push({ text: 'Bot sedang offline. Perubahan tetap bisa disimpan dan akan diterapkan otomatis saat bot kembali online.', tone: 'neutral' });
    }
    const c = d.config;
    if (remoteChanged) {
      out.push({ text: `Konfigurasi server ini diubah di tempat lain (revisi ${c?.revision ?? '?'}) saat kamu sedang mengedit. Muat versi terbaru sebelum menyimpan.`, tone: 'warning', action: 'reload-latest' });
    }
    if (syncTimedOut()) {
      out.push({ text: describeError('SYNC_TIMEOUT'), tone: 'warning' });
    }
    return out;
  }

  function attentionHtml(): string {
    const items = topIssues();
    if (!items.length) return '';
    const invite = inviteUrl(cfg.clientId, cfg.permissions, guildId);
    return `
      <div class="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/[0.07] p-5" role="region" aria-label="Perlu perhatian">
        <p class="flex items-center gap-2 font-medium text-amber-900 dark:text-amber-200">${icon('triangle-alert')} Perlu perhatian</p>
        <ul class="mt-3 space-y-2 text-sm">
          ${items
            .map(
              (i) => `<li class="flex gap-2"><span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${i.tone === 'danger' ? 'bg-red-500' : i.tone === 'warning' ? 'bg-amber-500' : 'bg-ink-400'}" aria-hidden="true"></span>
                <span>${esc(i.text)}${i.action === 'invite' && invite ? ` <a href="${esc(invite)}" target="_blank" rel="noopener noreferrer" class="font-medium text-amber-700 underline dark:text-amber-300">Undang bot</a>` : ''}${
                  i.action === 'reload-latest' ? ` <button type="button" data-action="reload-latest" class="font-medium text-amber-700 underline dark:text-amber-300">Muat versi terbaru</button>` : ''
                }</span></li>`,
            )
            .join('')}
        </ul>
      </div>`;
  }

  // ─── Panel ───────────────────────────────────────────────────────────────

  function panelHtml(): string {
    if (tab === 'overview') return overviewHtml();
    if (tab === 'channels') return channelsHtml();
    if (tab === 'audit-log') return auditHtml();
    if (tab === 'share-server') return share.html(data!.snapshot ?? null);
    const section = SECTION_OF_TAB[tab]!;
    const feats = registry().filter((f) => f.section === section);
    // Pengantar bagian; sinopsis tiap fitur ada di kartunya (description registry bot).
    const intro =
      section === 'game'
        ? 'Kumpulan game yang bisa dimainkan member lewat /game. Matikan game yang tidak ingin dimainkan di server ini, atau kunci game ke satu channel khusus. Game tanpa channel khusus bisa dibuka di channel mana pun.'
        : section === 'verification'
          ? 'Syarat: bot butuh izin Manage Roles dan role bot harus berada di atas Verified Role. Jumlah langkah bisa diatur; batas lulus 80% benar ditetapkan sistem.'
          : section === 'leveling'
            ? 'Batas XP dan cooldown ditetapkan sistem Vanillate. Vote bot di Top.gg memberi +100% XP selama 12 jam (otomatis, semua server).'
            : section === 'autorole'
              ? 'Syarat: bot butuh izin Manage Roles dan role bot harus berada di atas role yang diberikan. Bila Verification aktif, role member diberikan setelah member lulus verifikasi. Verified Role tidak boleh dipakai di sini.'
              : section === 'welcome'
                ? 'Kosongkan channel untuk mematikan salah satu pesan: welcome saat member masuk, goodbye saat member keluar. Akun bot tidak disambut. Syarat: bot butuh izin mengirim pesan di channel yang dipilih.'
                : section === 'security'
                  ? 'Syarat: bot butuh izin View Audit Log di server, serta View Channel dan Send Messages di channel log. Pilih minimal satu role admin atau moderator. Kategori alasan dipilih lewat tombol tanpa input teks bebas, dan catatan hanya tersimpan di server ini.'
                  : 'Kegiatan harian yang bikin member rajin mampir ke server. Setiap fitur berjalan di channel khusus pilihanmu; fitur yang belum diberi channel tidak aktif, dan satu channel hanya untuk satu fitur sosial.';
    if (!feats.length) return `<p class="text-sm text-ink-500">Belum ada fitur di bagian ini.</p>`;
    const summaryBlock = section === 'security' ? securitySummaryHtml() : '';
    return `
      <p class="max-w-3xl text-sm text-ink-600 dark:text-cream-300">${intro}</p>
      ${data!.snapshot?.refreshed_at ? `<p class="mt-2 text-xs text-ink-500 dark:text-cream-300/60">Daftar channel dari Discord: ${esc(relativeTime(data!.snapshot.refreshed_at))}.</p>` : ''}
      ${
        feats.length === 1
          ? `<div class="mt-4 sm:mt-5">${featureSectionHtml(feats[0])}</div>`
          : `<div class="${SPAN_LAST} mt-4 grid gap-3 sm:mt-5 sm:gap-4 lg:grid-cols-2">${feats.map((f) => featureCardHtml(f)).join('')}</div>`
      }${summaryBlock}`;
  }

  /** Ringkasan data lokal Security Center: hanya angka agregat dari bot, tanpa nama atau ID. */
  function securitySummaryHtml(): string {
    const s = parseSecuritySummary(data!.snapshot?.security_summary);
    if (!s) {
      return `<div class="${CARD} mt-4 p-4 sm:mt-5 sm:p-5">
        <h3 class="font-display text-base font-semibold">Ringkasan data server</h3>
        <p class="mt-1 text-sm text-ink-500 dark:text-cream-300/70">Belum ada ringkasan. Ringkasan muncul setelah Security Center diaktifkan dan bot menerbitkannya (kurang dari semenit). Tekan Refresh Discord Data bila belum muncul.</p>
      </div>`;
    }
    const tile = (label: string, value: number, hint = '') => `
      <div class="rounded-xl border border-ink-900/10 p-3 dark:border-cream-100/10">
        <p class="text-xs text-ink-500 dark:text-cream-300/60">${esc(label)}</p>
        <p class="mt-1 font-display text-xl font-semibold sm:text-2xl">${value}</p>
        ${hint ? `<p class="mt-0.5 text-xs text-ink-500 dark:text-cream-300/60">${esc(hint)}</p>` : ''}
      </div>`;
    const max = Math.max(1, ...s.by_reason.map((c) => c.count));
    const bars = s.by_reason.length
      ? s.by_reason.map((c) => `
        <li class="flex items-center gap-3 text-sm">
          <span class="w-40 shrink-0 truncate sm:w-52">${esc(c.label)}</span>
          <span class="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-ink-900/10 dark:bg-cream-100/10"><span class="block h-full rounded-full bg-amber-500" style="width:${Math.round((c.count / max) * 100)}%"></span></span>
          <span class="w-8 shrink-0 text-right tabular-nums">${c.count}</span>
        </li>`).join('')
      : `<li class="text-sm text-ink-500 dark:text-cream-300/70">Belum ada catatan dengan kategori alasan.</li>`;
    return `<div class="${CARD} mt-4 p-4 sm:mt-5 sm:p-5">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <h3 class="font-display text-base font-semibold">Ringkasan data server</h3>
        <p class="text-xs text-ink-500 dark:text-cream-300/60">${s.updated_at ? `Diperbarui ${esc(relativeTime(s.updated_at))}` : ''}</p>
      </div>
      <div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        ${tile('Kick aktif', s.kick_active)}
        ${tile('Ban aktif', s.ban_active)}
        ${tile('Menunggu kategori', s.pending, 'belum dipilih moderator')}
        ${tile('Alasan tidak jelas', s.not_provided, 'lewat 24 jam')}
        ${tile('Dicabut', s.revoked, 'dihapus dalam 7 hari')}
        ${tile('7 hari terakhir', s.last7_kick + s.last7_ban, `${s.last7_kick} kick dan ${s.last7_ban} ban`)}
      </div>
      <h4 class="mt-4 text-sm font-semibold">Kategori alasan (catatan aktif)</h4>
      <ul class="mt-2 grid gap-2">${bars}</ul>
      <p class="mt-4 text-xs text-ink-500 dark:text-cream-300/60">${s.last_at ? `Kejadian terakhir ${esc(relativeTime(s.last_at))}. ` : ''}Hanya angka gabungan untuk server ini. Tidak ada nama atau ID di halaman ini, dan catatan tidak dibagikan ke server lain. Catatan aktif disimpan maksimal 90 hari.</p>
    </div>`;
  }

  function featureIssues(f: Feature): { level: 'ok' | 'warn' | 'error' | 'off' | 'dirty'; messages: string[] } {
    const d = data!;
    const s = draft[f.key];
    const messages: string[] = [];
    let level: 'ok' | 'warn' | 'error' | 'off' | 'dirty' = s.enabled ? 'ok' : 'off';

    const mine = (i: Issue) => i.feature === f.key;
    const errs = [...validateDraft(draft, base, d.registry, d.snapshot).filter(mine), ...attemptIssues.filter(mine)];
    const fromBot = !diffStates({ [f.key]: base[f.key] }, { [f.key]: s }, [f]).length ? serverIssues(d.config).filter(mine) : [];
    const warns = permissionWarnings({ [f.key]: s }, [f], d.snapshot);
    if (s.enabled && d.snapshot?.refreshed_at) {
      for (const p of f.purposes) {
        const id = s.channels[p.key];
        if (id && id === base[f.key]?.channels[p.key] && !channelById(d.snapshot, id)) {
          warns.push({ code: 'CHANNEL_NOT_FOUND', feature: f.key, purpose: p.key, channel_id: id });
        }
      }
    }
    const seen = new Set<string>();
    const push = (i: Issue) => {
      const t = describeIssue(i, ctx());
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
    else if (diffStates({ [f.key]: base[f.key] }, { [f.key]: s }, [f]).length) level = 'dirty';
    return { level, messages };
  }

  function selectHtml(f: Feature, p: Purpose): string {
    const d = data!;
    const current = draft[f.key].channels[p.key] ?? '';
    const options = channelOptions(d.snapshot, p);
    const groups = new Map<string, typeof options>();
    for (const o of options) {
      const g = o.category ?? '';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(o);
    }
    const known = options.some((o) => o.id === current);
    const optHtml = (o: { id: string; name: string }) => `<option value="${esc(o.id)}" ${o.id === current ? 'selected' : ''}>#${esc(o.name)}</option>`;
    const missingCurrent = current && !known ? `<option value="${esc(current)}" selected>${esc(channelLabel(ctx(), current))}</option>` : '';
    const empty = p.required ? 'Pilih channel' : p.empty_label ?? 'Tidak diatur';
    const disabled = !editable() || saving;

    const ch = channelById(d.snapshot, current);
    const missing = ch ? missingPermissions(ch, p) : [];
    return `
      <label class="block">
        <span class="text-xs font-medium text-ink-600 dark:text-cream-300">${esc(p.label)}${p.required ? ' <span class="text-red-600">*</span>' : ''}</span>
        <select data-channel="${esc(f.key)}|${esc(p.key)}" data-focus="ch-${esc(f.key)}-${esc(p.key)}" ${disabled ? 'disabled' : ''}
          class="mt-1.5 w-full rounded-xl border border-ink-900/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-500 disabled:opacity-60 dark:border-cream-100/15 dark:bg-ink-800">
          <option value="" ${current ? '' : 'selected'}>${esc(empty)}</option>
          ${missingCurrent}
          ${[...groups.entries()]
            .map(([g, list]) => (g ? `<optgroup label="${esc(g)}">${list.map(optHtml).join('')}</optgroup>` : list.map(optHtml).join('')))
            .join('')}
        </select>
      </label>
      ${p.help ? `<p class="mt-1.5 text-xs text-ink-500 dark:text-cream-300/60">${esc(p.help)}</p>` : ''}
      ${!d.snapshot?.refreshed_at ? `<p class="mt-1.5 text-xs text-amber-800 dark:text-amber-300">Daftar channel belum dimuat. Tekan Refresh Discord Data.</p>` : ''}
      ${missing.length ? `<p class="mt-1.5 text-xs text-amber-800 dark:text-amber-300">Izin bot kurang di #${esc(ch!.name)}: ${esc(missing.join(', '))}.</p>` : ''}`;
  }

  /** Centang "Tidak dipakai" untuk fitur sosial yang OFF. */
  function notUsedHtml(f: Feature, checked: boolean, disabled: boolean): string {
    return `
      <div>
        <label class="inline-flex cursor-pointer items-center gap-2 text-sm font-medium">
          <input type="checkbox" class="h-4 w-4 rounded accent-amber-600" data-not-used="${esc(f.key)}" data-focus="nu-${esc(f.key)}"
            ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''} />
          Tidak dipakai di server ini
        </label>
        <p class="mt-1 text-xs text-ink-500 dark:text-cream-300/60">Centang bila server ini sengaja tidak memakai fitur ini, supaya pengingat setup dari bot berhenti menanyakannya. Bisa diaktifkan kapan saja.</p>
      </div>`;
  }

  /** Kontrol setelan bertipe (settings_schema) per kelompok (`group`) untuk fitur aktif. */
  function settingsBlocks(f: Feature): { group?: string; text: boolean; html: string; props: SettingProp[] }[] {
    const props = typedSettings(f);
    if (!props.length) return [];
    const disabled = !editable() || saving;
    const d = data!;
    const s = draft[f.key];
    const cls = 'mt-1.5 w-full rounded-xl border border-ink-900/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-500 disabled:opacity-60 dark:border-cream-100/15 dark:bg-ink-800';
    const field = (p: SettingProp): string => {
      const id = `${esc(f.key)}|${esc(p.key)}`;
      const base = `data-setting="${id}" data-type="${p.type}" data-focus="st-${esc(f.key)}-${esc(p.key)}" ${disabled ? 'disabled' : ''}`;
      const cur = settingValue(f, s, p.key);
      switch (p.type) {
        case 'integer':
          return `<input type="number" step="1" ${p.min != null ? `min="${p.min}"` : ''} ${p.max != null ? `max="${p.max}"` : ''} ${base} value="${cur ?? ''}" class="${cls}" />`;
        case 'string': {
          const long = (p.max_length ?? 0) > 120;
          const v = typeof s.settings[p.key] === 'string' ? (s.settings[p.key] as string) : '';
          return long
            ? `<textarea rows="4" ${p.max_length ? `maxlength="${p.max_length}"` : ''} ${p.placeholder ? `placeholder="${esc(p.placeholder)}"` : ''} ${base} class="${cls}">${esc(v)}</textarea>`
            : `<input type="text" ${p.max_length ? `maxlength="${p.max_length}"` : ''} ${p.placeholder ? `placeholder="${esc(p.placeholder)}"` : ''} ${base} value="${esc(v)}" class="${cls}" />`;
        }
        case 'boolean':
          return `<label class="inline-flex cursor-pointer items-center gap-2 text-sm font-medium"><input type="checkbox" class="h-4 w-4 shrink-0 rounded accent-amber-600" ${base} ${cur === true ? 'checked' : ''} /> ${esc(p.title)}</label>`;
        case 'enum':
          return `<select ${base} class="${cls}">${(p.values ?? []).map((v) => `<option value="${esc(v)}" ${cur === v ? 'selected' : ''}>${esc(p.labels?.[v] ?? v)}</option>`).join('')}</select>`;
        case 'role': {
          const roles = roleOptions(d.snapshot);
          const known = roles.some((r) => r.id === cur);
          return `<select ${base} class="${cls}">
            <option value="" ${cur ? '' : 'selected'}>Pilih role</option>
            ${cur && !known ? `<option value="${esc(String(cur))}" selected>${esc(roleLabel(ctx(), String(cur)))}</option>` : ''}
            ${roles.map((r) => `<option value="${esc(r.id)}" ${r.id === cur ? 'selected' : ''}>@${esc(r.name)}${r.managed ? ' (integrasi)' : ''}</option>`).join('')}
          </select>`;
        }
        case 'role_list':
          return checkList(f, p, cur, roleOptions(d.snapshot).filter((r) => r.id !== guildId && r.name !== '@everyone').map((r) => ({ id: r.id, label: `@${r.name}` })), (id) => roleLabel(ctx(), id), 'role');
        case 'reward_list': {
          const rows = (Array.isArray(s.settings[p.key]) ? s.settings[p.key] : []) as RewardRow[];
          const cats = Object.keys(p.limits ?? {});
          const roles = roleOptions(d.snapshot);
          const count = (c: string) => rows.filter((r) => r.category === c).length;
          const rowCls = 'rounded-xl border border-ink-900/15 bg-white px-2.5 py-2 text-sm outline-none focus:border-amber-500 disabled:opacity-60 dark:border-cream-100/15 dark:bg-ink-800';
          const rowHtml = rows
            .map((r, i) => `
              <div class="flex flex-wrap items-center gap-2" data-reward-row="${esc(f.key)}|${esc(p.key)}|${i}">
                <select data-reward-field="category" aria-label="Kategori" ${disabled ? 'disabled' : ''} class="${rowCls}">
                  ${cats.map((c) => `<option value="${esc(c)}" ${r.category === c ? 'selected' : ''}>${esc(categoryLabel(c))}</option>`).join('')}
                </select>
                <label class="inline-flex items-center gap-1.5 text-xs">Level
                  <input type="number" min="1" max="${p.max_level ?? 1000}" step="1" data-reward-field="level" ${disabled ? 'disabled' : ''}
                    value="${r.level ?? ''}" class="${rowCls} w-24" />
                </label>
                <select data-reward-field="role_id" aria-label="Role" ${disabled ? 'disabled' : ''} class="${rowCls} min-w-[10rem] flex-1">
                  <option value="" ${r.role_id ? '' : 'selected'}>Pilih role</option>
                  ${r.role_id && !roles.some((x) => x.id === r.role_id) ? `<option value="${esc(r.role_id)}" selected>${esc(roleLabel(ctx(), r.role_id))}</option>` : ''}
                  ${roles.map((x) => `<option value="${esc(x.id)}" ${x.id === r.role_id ? 'selected' : ''}>@${esc(x.name)}${x.managed ? ' (integrasi)' : ''}</option>`).join('')}
                </select>
                <button type="button" data-reward-del="${esc(f.key)}|${esc(p.key)}|${i}" ${disabled ? 'disabled' : ''}
                  class="rounded-lg px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:text-red-300 dark:hover:bg-red-950/30" aria-label="Hapus reward">Hapus</button>
              </div>`)
            .join('');
          const full = cats.every((c) => count(c) >= (p.limits?.[c] ?? 0));
          return `
            <div class="mt-1.5 space-y-2" data-focus="st-${esc(f.key)}-${esc(p.key)}">
              ${rowHtml || '<p class="text-xs text-ink-500 dark:text-cream-300/60">Belum ada reward.</p>'}
              <div class="flex flex-wrap items-center gap-3">
                <button type="button" data-reward-add="${esc(f.key)}|${esc(p.key)}" ${disabled || full ? 'disabled' : ''}
                  class="rounded-lg border border-ink-900/15 px-3 py-1.5 text-xs font-medium hover:bg-ink-900/5 disabled:opacity-50 dark:border-cream-100/15 dark:hover:bg-cream-100/5">+ Tambah reward</button>
                <span class="text-xs text-ink-500 dark:text-cream-300/60">${cats.map((c) => `${esc(categoryLabel(c))} ${count(c)}/${p.limits?.[c] ?? 0}`).join(' · ')}</span>
              </div>
            </div>`;
        }
        case 'color': {
          const v = typeof s.settings[p.key] === 'string' ? (s.settings[p.key] as string) : '';
          const ok = /^#[0-9a-fA-F]{6}$/.test(v);
          return `<div class="mt-1.5 flex items-center gap-2">
            <input type="color" aria-label="Pilih warna" ${base.replace(/data-focus="[^"]*"/, '')} value="${ok ? esc(v) : '#5865f2'}"
              class="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-ink-900/15 bg-white p-1 disabled:opacity-60 dark:border-cream-100/15 dark:bg-ink-800" />
            <input type="text" inputmode="text" maxlength="7" placeholder="${esc(p.placeholder ?? '#RRGGBB')} (kosong = bawaan)" ${base} value="${esc(v)}" class="${cls} !mt-0 font-mono" />
          </div>`;
        }
        case 'guide_list': {
          const rows = (Array.isArray(s.settings[p.key]) ? s.settings[p.key] : []) as GuideRow[];
          const chans = (d.snapshot?.channels ?? [])
            .filter((c) => c.type === 0 || c.type === 5 || c.type === 2)
            .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
          const rowCls = 'rounded-xl border border-ink-900/15 bg-white px-2.5 py-2 text-sm outline-none focus:border-amber-500 disabled:opacity-60 dark:border-cream-100/15 dark:bg-ink-800';
          const rowHtml = rows
            .map((r, i) => `
              <div class="flex flex-wrap items-center gap-2" data-guide-row="${esc(f.key)}|${esc(p.key)}|${i}">
                <select data-guide-field="channel_id" aria-label="Channel" ${disabled ? 'disabled' : ''} class="${rowCls} min-w-[9rem] flex-1">
                  <option value="" ${r.channel_id ? '' : 'selected'}>Pilih channel</option>
                  ${r.channel_id && !chans.some((c) => c.id === r.channel_id) ? `<option value="${esc(r.channel_id)}" selected>${esc(channelLabel(ctx(), r.channel_id))}</option>` : ''}
                  ${chans.map((c) => `<option value="${esc(c.id)}" ${c.id === r.channel_id ? 'selected' : ''}>${c.type === 2 ? 'Voice: ' : '#'}${esc(c.name)}</option>`).join('')}
                </select>
                <input type="text" data-guide-field="text" aria-label="Keterangan" placeholder="Keterangan, mis. baca rules" ${p.max_text ? `maxlength="${p.max_text}"` : ''}
                  ${disabled ? 'disabled' : ''} value="${esc(r.text ?? '')}" class="${rowCls} min-w-[9rem] flex-[2]" />
                <button type="button" data-guide-del="${esc(f.key)}|${esc(p.key)}|${i}" ${disabled ? 'disabled' : ''}
                  class="rounded-lg px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:text-red-300 dark:hover:bg-red-950/30" aria-label="Hapus baris">Hapus</button>
              </div>`)
            .join('');
          const full = p.max_items != null && rows.length >= p.max_items;
          return `
            <div class="mt-1.5 space-y-2" data-focus="st-${esc(f.key)}-${esc(p.key)}">
              ${rowHtml || '<p class="text-xs text-ink-500 dark:text-cream-300/60">Belum ada baris.</p>'}
              <div class="flex flex-wrap items-center gap-3">
                <button type="button" data-guide-add="${esc(f.key)}|${esc(p.key)}" ${disabled || full ? 'disabled' : ''}
                  class="rounded-lg border border-ink-900/15 px-3 py-1.5 text-xs font-medium hover:bg-ink-900/5 disabled:opacity-50 dark:border-cream-100/15 dark:hover:bg-cream-100/5">+ Tambah channel</button>
                <span class="text-xs text-ink-500 dark:text-cream-300/60">${rows.length}${p.max_items != null ? ` dari maksimal ${p.max_items}` : ''} baris</span>
              </div>
            </div>`;
        }
        case 'channel_list': {
          const opts = (d.snapshot?.channels ?? [])
            .filter((c) => c.type === 0 || c.type === 5 || c.type === 2 || c.type === 4)
            .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
            .map((c) => ({ id: c.id, label: c.type === 4 ? `Kategori: ${c.name}` : c.type === 2 ? `Voice: ${c.name}` : `#${c.name}` }));
          return checkList(f, p, cur, opts, (id) => channelLabel(ctx(), id), 'channel');
        }
        default:
          return '';
      }
    };
    /** Daftar centang untuk role_list/channel_list (pengganti select multiple). */
    const checkList = (
      f: Feature,
      p: SettingProp,
      cur: unknown,
      options: { id: string; label: string }[],
      missingLabel: (id: string) => string,
      noun: string,
    ): string => {
      const chosen = Array.isArray(cur) ? (cur as string[]) : [];
      const set = new Set(chosen);
      const known = new Set(options.map((o) => o.id));
      // Pilihan tersimpan yang sudah tidak ada di Discord tetap tampil agar bisa dilepas.
      const all = [...chosen.filter((id) => !known.has(id)).map((id) => ({ id, label: missingLabel(id) })), ...options];
      const full = p.max_items != null && chosen.length >= p.max_items;
      const key = `${f.key}|${p.key}`;
      const rows = all
        .map((o) => {
          const on = set.has(o.id);
          return `<label class="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-ink-900/5 dark:hover:bg-cream-100/5 ${on ? 'font-medium' : ''}">
            <input type="checkbox" class="h-4 w-4 shrink-0 rounded accent-amber-600" data-list="${esc(key)}" value="${esc(o.id)}"
              data-focus="ls-${esc(f.key)}-${esc(p.key)}-${esc(o.id)}" ${on ? 'checked' : ''} ${disabled || (full && !on) ? 'disabled' : ''} />
            <span class="min-w-0 truncate">${esc(o.label)}</span>
          </label>`;
        })
        .join('');
      return `
        <div class="mt-1.5 max-h-56 overflow-y-auto rounded-xl border border-ink-900/15 bg-white p-1 dark:border-cream-100/15 dark:bg-ink-800" data-scroll-keep="${esc(key)}">
          ${rows || `<p class="px-2 py-1.5 text-xs text-ink-500 dark:text-cream-300/60">Belum ada ${noun} yang bisa dipilih. Tekan Refresh Discord Data.</p>`}
        </div>
        <p class="mt-1 text-xs text-ink-500 dark:text-cream-300/60">${chosen.length} dipilih${p.max_items != null ? ` dari maksimal ${p.max_items}` : ''}.</p>`;
    };
    const hint = (p: SettingProp) => {
      const note = (t: string) => `<p class="mt-1 text-xs text-ink-500 dark:text-cream-300/60">${esc(t)}</p>`;
      const parts: string[] = [];
      if (p.help) parts.push(note(p.help));
      if (p.type === 'integer' && (p.min != null || p.max != null)) {
        parts.push(note(`Rentang ${p.min ?? '…'} sampai ${p.max ?? '…'}${p.default != null ? `, bawaan ${p.default}` : ''}.`));
      } else if (p.type === 'string' && p.max_length) {
        parts.push(note(`Maksimal ${p.max_length} karakter.${p.help?.includes('Kosongkan') ? '' : ' Kosongkan untuk teks bawaan.'}`));
      }
      return parts.join('');
    };
    const item = (p: SettingProp) =>
      p.type === 'boolean'
        ? `<div>${field(p)}${hint(p)}</div>`
        : `<div><span class="block text-xs font-medium text-ink-600 dark:text-cream-300">${esc(p.title)}${p.required ? ' <span class="text-red-600">*</span>' : ''}</span>${field(p)}${hint(p)}</div>`;
    // Setelan berurutan dengan `group` sama dikumpulkan di bawah satu judul.
    const blocks: { group?: string; items: SettingProp[] }[] = [];
    for (const p of props) {
      const last = blocks[blocks.length - 1];
      if (last && p.group && last.group === p.group) last.items.push(p);
      else blocks.push({ group: p.group, items: [p] });
    }
    return blocks.map((b) => ({
      group: b.group,
      // Kelompok yang isinya hanya teks (judul, isi pesan, tombol) = kategori "Pesan teks".
      text: b.items.some((p) => p.category === 'message') || b.items.every((p) => p.type === 'string'),
      html: b.items.map(item).join(''),
      props: b.items,
    }));
  }

  /** Setelan bertipe dalam satu kolom (fitur di daftar dua kolom, mis. Game/Social Hub). */
  function settingsHtml(f: Feature): string {
    return settingsBlocks(f)
      .map((b) =>
        b.group
          ? `<fieldset class="space-y-4 border-t border-ink-900/10 pt-4 dark:border-cream-100/10">
              <legend class="pr-2 text-sm font-semibold text-ink-900 dark:text-cream-50">${esc(b.group)}</legend>
              ${b.html}
            </fieldset>`
          : b.html,
      )
      .join('');
  }

  /** Preview kartu dari draft setelan (belum disimpan) untuk satu kelompok pesan. */
  function previewFor(f: Feature, props: SettingProp[]): string {
    const d = data!;
    const ctxPreview: PreviewContext = {
      guildName: d.guild.name ?? `Server ${guildId}`,
      guildIconUrl: guildIconUrl(guildId, d.guild.icon),
      viewerName: d.viewer.name || 'Member',
      channelName: (id) => channelById(d.snapshot, id)?.name ?? null,
    };
    return previewHtml(props, draft[f.key]?.settings ?? {}, ctxPreview);
  }

  /**
   * Bagian dengan satu fitur besar (Verification, Leveling): kartu utama penuh,
   * lalu konfigurasi dan pesan teks dipisah per kategori, tiap kelompok satu kartu.
   */
  function featureSectionHtml(f: Feature): string {
    const s = draft[f.key];
    const blocks = s.enabled ? settingsBlocks(f) : [];
    const groupCard = (b: { group?: string; html: string; props: SettingProp[] }) => {
      const kind = previewKind(b.props);
      const head = `<h4 class="text-sm font-semibold text-ink-900 dark:text-cream-50">${esc(b.group ?? 'Umum')}</h4>`;
      if (!kind) {
        return `<section class="${CARD} min-w-0 space-y-4 p-4 sm:p-5">${head}${b.html}</section>`;
      }
      // Kelompok pesan: kolom isian di kiri, preview kartu menempel di kanan.
      return `<section class="${CARD} min-w-0 p-4 sm:p-5">
        ${head}
        <div class="mt-3 grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div class="min-w-0 space-y-4">${b.html}</div>
          <div class="min-w-0"><div class="lg:sticky lg:top-24" data-preview="${esc(f.key)}|${esc(kind)}">${previewFor(f, b.props)}</div></div>
        </div>
      </section>`;
    };
    const category = (title: string, hint: string, list: typeof blocks) =>
      list.length
        ? `<div class="mt-6">
            <h3 class="font-display text-base font-semibold">${title}</h3>
            <p class="mt-0.5 text-xs text-ink-500 dark:text-cream-300/60">${hint}</p>
            <div class="${list.some((b) => previewKind(b.props)) ? 'grid gap-3 sm:gap-4' : `${SPAN_LAST} grid gap-3 sm:gap-4 lg:grid-cols-2`} mt-3">${list.map(groupCard).join('')}</div>
          </div>`
        : '';
    return `${featureCardHtml(f, false)}
      ${category('Konfigurasi', 'Aturan, batas, dan role yang dipakai fitur ini.', blocks.filter((b) => !b.text))}
      ${category('Pesan teks', 'Teks yang dilihat member di Discord. Kosongkan kolom untuk memakai teks bawaan.', blocks.filter((b) => b.text))}`;
  }

  /** Kotak penjelasan untuk setelan yang dikunci bot, supaya admin tidak mengira itu bug. */
  function lockNoticeHtml(f: Feature): string {
    const lock = featureLock(f);
    if (!lock.items.length) return '';
    const box = 'rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200';
    if (lock.full) {
      const note = lock.items[0].note ?? LOCK_FALLBACK_NOTE;
      return `<div class="${box}" role="note">
        <p class="flex items-center gap-2 font-semibold">${icon('lock', 'h-4 w-4 shrink-0')} Belum tersedia</p>
        <p class="mt-1">${esc(note)}</p>
      </div>`;
    }
    return `<div class="${box}" role="note">
      <p class="flex items-center gap-2 font-semibold">${icon('lock', 'h-4 w-4 shrink-0')} Sebagian opsi belum tersedia</p>
      <ul class="mt-1 space-y-1.5">${lock.items.map((i) => `<li><span class="font-medium">${esc(i.title)}:</span> ${esc(i.note ?? LOCK_FALLBACK_NOTE)}</li>`).join('')}</ul>
    </div>`;
  }

  function featureCardHtml(f: Feature, withSettings = true): string {
    const s = draft[f.key];
    const lockFull = featureLock(f).full;
    const status = featureIssues(f);
    const notUsed = isNotUsed(s);
    const statusPill =
      lockFull && !s.enabled
        ? pill('Belum tersedia', 'neutral')
        : status.level === 'off'
        ? pill(notUsed ? 'Tidak dipakai' : 'Nonaktif', 'neutral')
        : status.level === 'error'
          ? pill('Perlu perhatian', 'danger')
          : status.level === 'warn'
            ? pill('Perlu perhatian', 'warning')
            : status.level === 'dirty'
              ? pill('Belum disimpan', 'warning')
              : pill('Valid', 'success');
    const savedChannels = f.purposes
      .map((p) => (s.channels[p.key] ? `${p.label}: ${channelLabel(ctx(), s.channels[p.key])}` : ''))
      .filter(Boolean);
    const command = typeof f.meta?.command === 'string' ? f.meta.command : null;
    const disabled = !editable() || saving;
    // Fitur yang seluruh setelannya terkunci tidak bisa dinyalakan (tidak akan berfungsi).
    const toggleOff = disabled || (lockFull && !s.enabled);

    return `
      <article class="${CARD} p-4 sm:p-5 ${s.enabled ? '' : 'opacity-90'}" aria-labelledby="feat-${esc(f.key)}">
        <div class="flex items-start justify-between gap-4">
          <div class="flex min-w-0 items-center gap-3">
            <span class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300">${icon(featureIcon(f), 'h-5 w-5')}</span>
            <div class="min-w-0">
              <h3 id="feat-${esc(f.key)}" class="font-display text-lg font-semibold leading-tight">${esc(f.name)}</h3>
              ${command ? `<p class="mt-0.5 font-mono text-xs text-ink-500 dark:text-cream-300/60">${esc(command)}</p>` : ''}
            </div>
          </div>
          <button type="button" role="switch" aria-checked="${s.enabled}" aria-label="${esc(f.name)}: ${s.enabled ? 'aktif' : 'nonaktif'}"
            data-toggle="${esc(f.key)}" data-focus="tg-${esc(f.key)}" ${toggleOff ? 'disabled' : ''} ${lockFull && !s.enabled ? 'title="Belum tersedia, lihat penjelasan di bawah"' : ''}
            class="group inline-flex shrink-0 items-center gap-2 rounded-full text-xs font-semibold disabled:opacity-60">
            <span class="relative inline-flex h-6 w-11 items-center rounded-full transition ${s.enabled ? 'bg-emerald-500' : 'bg-ink-400/40 dark:bg-ink-600'}">
              <span class="inline-block h-5 w-5 rounded-full bg-white shadow transition ${s.enabled ? 'translate-x-5' : 'translate-x-0.5'}"></span>
            </span>
            <span class="w-7 text-left">${s.enabled ? 'ON' : 'OFF'}</span>
          </button>
        </div>
        ${f.description ? `<p class="mt-3 text-sm text-ink-600 dark:text-cream-300/80">${esc(f.description)}</p>` : ''}
        ${lockFull ? `<div class="mt-3">${lockNoticeHtml(f)}</div>` : ''}
        <div class="mt-4 space-y-4">
          ${
            s.enabled
              ? f.purposes.map((p) => `<div>${selectHtml(f, p)}</div>`).join('') + (withSettings ? settingsHtml(f) : '')
              : savedChannels.length
                ? `<p class="text-xs text-ink-500 dark:text-cream-300/60">Tersimpan: ${esc(savedChannels.join(' · '))}, dipakai lagi saat fitur diaktifkan.</p>`
                : ''
          }
          ${!s.enabled && supportsNotUsed(f) ? notUsedHtml(f, notUsed, disabled) : ''}
          ${lockFull ? '' : lockNoticeHtml(f)}
        </div>
        <div class="mt-4 flex flex-wrap items-center gap-2 border-t border-ink-900/5 pt-4 dark:border-cream-100/5">
          <span class="text-xs text-ink-500 dark:text-cream-300/60">Status:</span> ${statusPill}
        </div>
        ${
          status.messages.length
            ? `<ul class="mt-3 space-y-1.5 text-xs ${status.level === 'error' ? 'text-red-700 dark:text-red-300' : 'text-amber-800 dark:text-amber-300'}">
                ${status.messages.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>`
            : ''
        }
      </article>`;
  }

  function overviewHtml(): string {
    const d = data!;
    const feats = registry();
    const active = feats.filter((f) => base[f.key]?.enabled).length;
    const tile = (label: string, value: string, sub = '', tone = '') => `
      <div class="${CARD} min-w-0 p-3 sm:p-5">
        <p class="text-xs text-ink-500 dark:text-cream-300/70">${label}</p>
        <p class="mt-1 font-display text-xl font-semibold sm:text-3xl ${tone}">${value}</p>
        ${sub ? `<p class="mt-1 hidden text-xs text-ink-500 sm:block dark:text-cream-300/60">${sub}</p>` : ''}
      </div>`;

    // Masalah konfigurasi dari pemeriksaan yang sama dengan tab fitur (tanpa data bot tambahan).
    const attention = feats.flatMap((f) => {
      const r = featureIssues(f);
      if (r.level !== 'warn' && r.level !== 'error') return [];
      const tabId = (Object.keys(SECTION_OF_TAB) as Tab[]).find((t) => SECTION_OF_TAB[t] === f.section) ?? 'game-hub';
      return r.messages.map((m) => ({ f, m, tabId }));
    });
    const attentionHtml = attention.length
      ? `<section aria-labelledby="ov-perhatian" class="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 sm:p-5">
          <h2 id="ov-perhatian" class="font-display text-base font-semibold text-amber-800 dark:text-amber-300">Perlu perhatian</h2>
          <ul class="mt-2 divide-y divide-amber-500/25">
            ${attention.map(({ f, m, tabId }) => `<li class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5 text-sm">
              <span class="min-w-0"><strong>${esc(f.name)}</strong> <span aria-hidden="true">·</span> ${esc(m)}</span>
              <button type="button" data-tab="${esc(tabId)}" data-focus="go-${esc(tabId)}" class="${BTN_SECONDARY} min-h-[44px] shrink-0">Atur</button></li>`).join('')}
          </ul>
        </section>`
      : '';

    const stats = parseStatsSummary(d.snapshot?.stats_summary);
    const security = parseSecuritySummary(d.snapshot?.security_summary);
    return `
      <div class="grid grid-cols-3 gap-2 sm:gap-4">
        ${tile('Status bot', d.bot.installed ? (d.bot.online ? 'Online' : 'Offline') : 'Tidak ada', d.bot.version ? `Versi ${esc(d.bot.version)}` : '', d.bot.installed && d.bot.online ? 'text-emerald-700 dark:text-emerald-400' : '')}
        ${tile('Fitur aktif', `${active}<span class="text-sm text-ink-400 sm:text-lg"> / ${feats.length}</span>`, 'Detail di tab Channel')}
        ${tile('Perlu perhatian', String(attention.length), attention.length ? 'Daftar di bawah' : 'Semuanya beres', attention.length ? 'text-amber-700 dark:text-amber-300' : '')}
      </div>
      <div class="mt-3 flex flex-col gap-3 sm:mt-4 sm:gap-4">
        ${attentionHtml}
        ${overviewStatsHtml({
          stats,
          security,
          memberCount: d.guild.member_count ?? null,
          updatedAgo: stats?.updated_at ? relativeTime(stats.updated_at, serverNow()) : null,
          botInstalled: d.bot.installed,
        })}
      </div>`;
  }

  function channelsHtml(): string {
    const d = data!;
    const rows = registry().flatMap((f) =>
      f.purposes.map((p) => {
        const s = base[f.key];
        const id = s.channels[p.key];
        const ch = channelById(d.snapshot, id);
        let status: string;
        if (!s.enabled) status = pill('Fitur nonaktif', 'neutral');
        else if (!id) status = p.required ? pill('Belum diatur', 'danger') : pill('Semua channel', 'neutral');
        else if (!d.snapshot?.refreshed_at) status = pill('Belum dicek', 'neutral');
        else if (!ch) status = pill('Channel hilang', 'danger');
        else {
          const missing = missingPermissions(ch, p);
          status = missing.length ? pill(`Izin kurang: ${missing.join(', ')}`, 'warning') : pill('OK', 'success');
        }
        const sectionTab = (Object.keys(SECTION_OF_TAB) as Tab[]).find((t) => SECTION_OF_TAB[t] === f.section) ?? 'game-hub';
        return `<tr class="border-t border-ink-900/5 dark:border-cream-100/5">
          <td class="py-3 pr-4">${featureLabel(f)}</td>
          <td class="py-3 pr-4 text-ink-600 dark:text-cream-300/80">${esc(p.label)}</td>
          <td class="py-3 pr-4 font-mono text-xs">${id ? esc(channelLabel(ctx(), id)) : 'Tidak diatur'}</td>
          <td class="py-3 pr-4">${status}</td>
          <td class="py-3 text-right"><button type="button" data-tab="${sectionTab}" data-focus="edit-${esc(f.key)}-${esc(p.key)}" class="text-xs font-medium text-amber-700 hover:underline dark:text-amber-300">Ubah</button></td>
        </tr>`;
      }),
    );
    return `
      <p class="max-w-3xl text-sm text-ink-600 dark:text-cream-300">Peta lengkap channel yang dipakai setiap fitur bot di server ini, dicek langsung dengan data Discord terbaru. Channel yang hilang atau izin bot yang kurang langsung kelihatan di sini. Ubah lewat Game Hub, Social Hub, atau submenu fiturnya di Server Hub.</p>
      <div class="${CARD} mt-5 overflow-x-auto p-5">
        <table class="w-full min-w-[640px] text-left text-sm">
          <thead class="text-xs uppercase tracking-wide text-ink-500 dark:text-cream-300/60">
            <tr><th class="pb-2 pr-4 font-medium">Fitur</th><th class="pb-2 pr-4 font-medium">Tujuan</th><th class="pb-2 pr-4 font-medium">Channel</th><th class="pb-2 pr-4 font-medium">Status</th><th class="pb-2"></th></tr>
          </thead>
          <tbody>${rows.join('')}</tbody>
        </table>
      </div>`;
  }

  // ─── Riwayat ─────────────────────────────────────────────────────────────

  const SOURCE_LABEL: Record<string, string> = { web: 'Website', discord: 'Discord', import: 'Impor', bot: 'Bot' };

  const AUDIT_INTRO = `<p class="max-w-3xl text-sm text-ink-600 dark:text-cream-300">Catatan setiap perubahan pengaturan server ini: siapa yang mengubah, dari mana (website, Discord, atau bot), apa saja yang berubah, dan apakah bot sudah menerapkannya.</p>`;

  function auditHtml(): string {
    if (audit === null && auditError) {
      return `<div class="text-sm text-ink-600 dark:text-cream-300">Gagal memuat riwayat.
        <button type="button" data-action="audit-retry" class="ml-1 font-medium text-amber-700 underline dark:text-amber-300">Coba lagi</button></div>`;
    }
    if (audit === null) return loadingBlock('Memuat riwayat…');
    if (!audit.length) return `${AUDIT_INTRO}<p class="mt-4 text-sm text-ink-500">Belum ada riwayat perubahan untuk server ini.</p>`;
    return `${AUDIT_INTRO}
      <ol class="mt-4 space-y-3">
        ${audit
          .map((a) => {
            const items = Array.isArray(a.changed_fields) ? (a.changed_fields as unknown[]) : [];
            const tone: Tone = a.action === 'sync.failed' ? 'danger' : a.action === 'sync.applied' ? 'success' : 'info';
            return `<li class="${CARD} p-4">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <p class="text-sm"><strong>${esc(a.actor_name ?? a.actor_id)}</strong>
                  <span class="text-ink-500 dark:text-cream-300/70">· ${esc(AUDIT_ACTION[a.action] ?? a.action)}</span></p>
                <div class="flex items-center gap-2">${pill(SOURCE_LABEL[a.source] ?? a.source, 'neutral')}${pill(`Revisi ${a.revision}`, tone)}</div>
              </div>
              ${
                items.length
                  ? `<ul class="mt-2 space-y-1 text-sm text-ink-700 dark:text-cream-200">${items
                      .slice(0, 20)
                      .map((c) => `<li class="flex gap-2"><span class="text-ink-400">•</span><span>${esc(formatAuditChange(c, ctx()))}</span></li>`)
                      .join('')}</ul>`
                  : ''
              }
              <p class="mt-2 text-xs text-ink-500 dark:text-cream-300/60">${esc(formatWib(a.created_at))}</p>
            </li>`;
          })
          .join('')}
      </ol>
      ${auditDone ? '' : `<div class="mt-4 text-center"><button type="button" data-action="audit-more" class="${BTN_SECONDARY}" ${auditLoading ? 'disabled' : ''}>Muat lebih banyak</button></div>`}`;
  }

  async function loadAudit(more = false): Promise<void> {
    auditLoading = true;
    try {
      const before = more && audit?.length ? audit[audit.length - 1].id : null;
      const rows = await auditList(guildId, before, 20);
      audit = more && audit ? [...audit, ...rows] : rows;
      auditDone = rows.length < 20;
      auditError = false;
    } catch (err) {
      // Gagal memuat halaman pertama → tampilkan error + Coba lagi (bukan
      // "belum ada riwayat"). Gagal "muat lebih banyak" → daftar lama tetap.
      if (!more || audit === null) auditError = true;
      toast(describeError(err instanceof DashboardError ? err.code : 'NETWORK'), 'danger');
    } finally {
      auditLoading = false;
      if (tab === 'audit-log') renderAll();
    }
  }

  // ─── Save bar ────────────────────────────────────────────────────────────

  function saveBarHtml(): string {
    if (!data || !editable()) return '';
    const n = changes().length;
    // Tab edit (Game/Social Hub) selalu menampilkan bar (tombol nonaktif bila
    // tidak ada perubahan); tab lain hanya bila ada draft yang belum disimpan.
    if (!SECTION_OF_TAB[tab] && !n && !saving) return '';
    return `
      <div class="pointer-events-none fixed bottom-28 left-4 right-4 z-30 sm:bottom-4 sm:left-1/2 sm:right-auto sm:w-[min(44rem,calc(100vw-14rem))] sm:-translate-x-1/2" data-region="savebar">
        <div class="pointer-events-auto flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 shadow-lg backdrop-blur ${
          n ? 'border-amber-500/40 bg-cream-50/95 dark:bg-ink-900/95' : 'border-ink-900/10 bg-white/90 dark:border-cream-100/10 dark:bg-ink-900/90'
        }">
          <p class="text-sm ${n ? 'font-medium text-amber-800 dark:text-amber-300' : 'text-ink-500 dark:text-cream-300/60'}" aria-live="polite">
            ${saving ? 'Menyimpan perubahan…' : n ? `${n} perubahan belum disimpan` : 'Tidak ada perubahan'}
          </p>
          <div class="flex gap-2">
            <button type="button" data-action="discard" class="${BTN_SECONDARY}" ${n && !saving ? '' : 'disabled'}>Batalkan</button>
            <button type="button" data-action="save" class="${BTN_PRIMARY}" ${n && !saving ? '' : 'disabled'}>
              ${saving ? spinner() : icon('check')} Simpan Perubahan</button>
          </div>
        </div>
      </div>`;
  }

  // ─── Aksi ────────────────────────────────────────────────────────────────

  async function save(): Promise<void> {
    if (!data || saving) return;
    const local = validateDraft(draft, base, data.registry, data.snapshot);
    if (local.length) {
      attemptIssues = local;
      renderAll();
      toast('Ada pengaturan yang belum valid. Periksa pesan di setiap fitur.', 'danger');
      return;
    }
    saving = true;
    attemptIssues = [];
    renderAll();
    try {
      const res = await saveConfig(guildId, baseRevision, buildSavePayload(draft, data.registry));
      saving = false;
      if (!res.changed) {
        toast('Tidak ada perubahan yang perlu disimpan.', 'info');
      } else {
        justSaved = true;
        syncWatchUntil = Date.now() + SYNC_TIMEOUT_MS;
        audit = null;
        auditDone = false;
        toast(`Tersimpan sebagai revisi ${res.revision}. Menunggu bot menerapkan…`, 'success');
      }
      await load(false);
      renderAll();
      schedulePoll();
    } catch (err) {
      saving = false;
      const e = err instanceof DashboardError ? err : new DashboardError('NETWORK');
      if (e.code === 'VALIDATION_FAILED' && Array.isArray(e.detail?.issues)) {
        attemptIssues = e.detail!.issues as Issue[];
      } else {
        attemptIssues = [];
        pageErrorFlash(e);
      }
      renderAll();
    }
  }

  function pageErrorFlash(e: DashboardError): void {
    if (e.code === 'STALE_REVISION') {
      if (confirm(`${describeError(e.code, e.detail)}\n\nMuat versi terbaru sekarang? Perubahan yang belum disimpan akan hilang.`)) {
        void load(false).then(renderAll);
      }
      return;
    }
    toast(describeError(e.code, e.detail), 'danger', 7000);
  }

  async function resync(btn: HTMLButtonElement): Promise<void> {
    btn.disabled = true;
    try {
      const r = await requestResync(guildId);
      syncWatchUntil = Date.now() + SYNC_TIMEOUT_MS;
      toast(r.bot_online ? 'Bot diminta memuat ulang konfigurasi terbaru…' : 'Permintaan tercatat. Bot sedang offline, perintah dijalankan saat online.', r.bot_online ? 'info' : 'warning');
      await load(true);
      renderAll();
      if (pollTimer) clearTimeout(pollTimer);
      pollTimer = setTimeout(poll, FAST_POLL_MS);
    } catch (err) {
      btn.disabled = false;
      toast(describeError(err instanceof DashboardError ? err.code : 'NETWORK'), 'danger');
    }
  }

  /**
   * Ringkasan statistik hanya dihitung bot saat refresh diminta. Otomatis paling
   * sering sekali per jam per server (per tab browser) supaya bot lama yang belum
   * menerbitkan ringkasan tidak dibanjiri permintaan setiap halaman dibuka.
   */
  function statsRefreshAllowed(): boolean {
    const key = `vn-stats-refresh-${guildId}`;
    try {
      const last = Number(sessionStorage.getItem(key) ?? 0);
      if (Date.now() - last < STATS_AUTO_REFRESH_MS) return false;
      sessionStorage.setItem(key, String(Date.now()));
    } catch {
      /* penyimpanan diblokir: tetap boleh, hanya sekali per pemuatan halaman */
    }
    return true;
  }

  async function discordRefresh(quiet = false): Promise<void> {
    try {
      const prev = data?.snapshot?.refreshed_at ?? null;
      const r = await requestDiscordRefresh(guildId);
      refreshWatch = { prev, until: Date.now() + REFRESH_TIMEOUT_MS, quiet };
      if (!r.bot_online && !quiet) toast('Bot sedang offline. Data channel diperbarui saat bot online.', 'warning');
      renderAll();
      if (pollTimer) clearTimeout(pollTimer);
      pollTimer = setTimeout(poll, FAST_POLL_MS);
    } catch (err) {
      toast(describeError(err instanceof DashboardError ? err.code : 'NETWORK'), 'danger');
      schedulePoll();
    }
  }

  function setTab(target: Tab | Hub): void {
    const next: Tab = target === 'server-hub' ? lastServerTab : target;
    tab = next;
    if (hubOf(next) === 'server-hub') lastServerTab = next;
    history.replaceState(null, '', `${location.pathname}${location.search}#${next}`);
    renderAll();
    root.querySelector<HTMLElement>(target === 'server-hub' ? '#tab-server-hub' : `[role="tab"][data-tab="${next}"]`)?.focus();
  }

  root.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const tabBtn = target.closest<HTMLElement>('[data-tab]');
    if (tabBtn) return setTab(tabBtn.dataset.tab as Tab | Hub);

    const toggle = target.closest<HTMLButtonElement>('[data-toggle]');
    if (toggle && !toggle.disabled && data) {
      const key = toggle.dataset.toggle!;
      draft[key].enabled = !draft[key].enabled;
      // Diaktifkan = keputusan "Tidak dipakai" batal.
      if (draft[key].enabled && draft[key].settings[NOT_USED] === true) draft[key].settings[NOT_USED] = false;
      attemptIssues = attemptIssues.filter((i) => i.feature !== key);
      renderAll();
      return;
    }

    const rwAdd = target.closest<HTMLButtonElement>('[data-reward-add]');
    if (rwAdd && !rwAdd.disabled && data) {
      const [fKey, pKey] = rwAdd.dataset.rewardAdd!.split('|');
      const prop = typedSettings(registry().find((x) => x.key === fKey)!).find((x) => x.key === pKey);
      if (!draft[fKey] || !prop) return;
      const rows = (Array.isArray(draft[fKey].settings[pKey]) ? draft[fKey].settings[pKey] : []) as RewardRow[];
      const category = Object.keys(prop.limits ?? {}).find((c) => rows.filter((r) => r.category === c).length < (prop.limits?.[c] ?? 0));
      if (!category) return;
      const used = rows.filter((r) => r.category === category).map((r) => Number(r.level) || 0);
      draft[fKey].settings[pKey] = [...rows, { category, level: (used.length ? Math.max(...used) : 0) + 5, role_id: '' }];
      attemptIssues = attemptIssues.filter((i) => i.feature !== fKey);
      renderAll();
      return;
    }
    const rwDel = target.closest<HTMLButtonElement>('[data-reward-del]');
    if (rwDel && !rwDel.disabled && data) {
      const [fKey, pKey, idx] = rwDel.dataset.rewardDel!.split('|');
      const rows = (Array.isArray(draft[fKey]?.settings[pKey]) ? draft[fKey].settings[pKey] : []) as RewardRow[];
      const next = rows.filter((_, i) => i !== Number(idx));
      if (next.length) draft[fKey].settings[pKey] = next;
      else delete draft[fKey].settings[pKey];
      attemptIssues = attemptIssues.filter((i) => i.feature !== fKey);
      renderAll();
      return;
    }

    const gAdd = target.closest<HTMLButtonElement>('[data-guide-add]');
    if (gAdd && !gAdd.disabled && data) {
      const [fKey, pKey] = gAdd.dataset.guideAdd!.split('|');
      const prop = typedSettings(registry().find((x) => x.key === fKey)!).find((x) => x.key === pKey);
      if (!draft[fKey] || !prop) return;
      const rows = (Array.isArray(draft[fKey].settings[pKey]) ? draft[fKey].settings[pKey] : []) as GuideRow[];
      if (prop.max_items != null && rows.length >= prop.max_items) return;
      draft[fKey].settings[pKey] = [...rows, { channel_id: '', text: '' }];
      attemptIssues = attemptIssues.filter((i) => i.feature !== fKey);
      renderAll();
      return;
    }
    const gDel = target.closest<HTMLButtonElement>('[data-guide-del]');
    if (gDel && !gDel.disabled && data) {
      const [fKey, pKey, idx] = gDel.dataset.guideDel!.split('|');
      const rows = (Array.isArray(draft[fKey]?.settings[pKey]) ? draft[fKey].settings[pKey] : []) as GuideRow[];
      const next = rows.filter((_, i) => i !== Number(idx));
      if (next.length) draft[fKey].settings[pKey] = next;
      else delete draft[fKey].settings[pKey];
      attemptIssues = attemptIssues.filter((i) => i.feature !== fKey);
      renderAll();
      return;
    }

    const notUsed = target.closest<HTMLInputElement>('input[data-not-used]');
    if (notUsed && !notUsed.disabled && data) {
      const key = notUsed.dataset.notUsed!;
      draft[key].settings[NOT_USED] = notUsed.checked;
      renderAll();
      return;
    }

    const shareBtn = target.closest<HTMLButtonElement>('[data-share-action]');
    if (shareBtn && !shareBtn.disabled && share.onClick(shareBtn)) return;

    const btn = target.closest<HTMLButtonElement>('[data-action]');
    if (!btn) return;
    switch (btn.dataset.action) {
      case 'save':
        void save();
        break;
      case 'discard':
        draft = cloneState(base);
        attemptIssues = [];
        renderAll();
        break;
      case 'resync':
        void resync(btn);
        break;
      case 'discord-refresh':
        void discordRefresh();
        break;
      case 'copy-id':
        void navigator.clipboard?.writeText(guildId).then(() => toast('Guild ID disalin.', 'success'));
        break;
      case 'audit-more':
        void loadAudit(true);
        break;
      case 'audit-retry':
        auditError = false;
        renderAll();
        break;
      case 'reload':
        root.innerHTML = loadingBlock();
        void load(false).then(() => {
          renderAll();
          schedulePoll();
        });
        break;
      case 'reload-latest':
        if (!dirty() || confirm('Perubahan yang belum disimpan akan hilang. Lanjutkan?')) {
          void load(false).then(renderAll);
        }
        break;
    }
  });

  // Preview kartu ikut berubah saat mengetik (draft diperbarui tanpa menggambar ulang halaman).
  root.addEventListener('input', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLInputElement | HTMLTextAreaElement>('[data-setting]');
    if (!el || !data || (el.dataset.type !== 'string' && el.dataset.type !== 'color')) return;
    const [fKey, pKey] = el.dataset.setting!.split('|');
    if (!draft[fKey]) return;
    if (el.value === '') delete draft[fKey].settings[pKey];
    else draft[fKey].settings[pKey] = el.value;
    const feat = registry().find((x) => x.key === fKey);
    const box = el.closest('section')?.querySelector<HTMLElement>('[data-preview]');
    if (!feat || !box) return;
    const kind = box.dataset.preview!.split('|')[1];
    const props = typedSettings(feat).filter((p) => p.key.startsWith(`${kind}_`) || (kind === 'levelup' && p.key.startsWith('levelup')));
    box.innerHTML = previewFor(feat, props.length ? props : typedSettings(feat));
  });

  // Formulir 📣 Share Server (draft disimpan di controller-nya).
  root.addEventListener('input', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-share-field]');
    if (el) share.onInput(el);
  });
  root.addEventListener('submit', (e) => {
    const form = e.target as HTMLFormElement;
    if (form.matches?.('[data-share-form]')) {
      e.preventDefault();
      share.onSubmit(form);
    }
  });
  root.addEventListener('focusout', () => setTimeout(() => share.flush(), 0));

  root.addEventListener('change', (e) => {
    const shareField = (e.target as HTMLElement).closest<HTMLElement>('[data-share-field]');
    if (shareField) {
      share.onInput(shareField);
      return;
    }
    const rwField = (e.target as HTMLElement).closest<HTMLInputElement | HTMLSelectElement>('[data-reward-field]');
    if (rwField && data) {
      const rowEl = rwField.closest<HTMLElement>('[data-reward-row]');
      const [fKey, pKey, idx] = (rowEl?.dataset.rewardRow ?? '').split('|');
      const rows = (Array.isArray(draft[fKey]?.settings[pKey]) ? draft[fKey].settings[pKey] : []) as RewardRow[];
      const row = rows[Number(idx)];
      if (!row) return;
      const field = rwField.dataset.rewardField;
      if (field === 'level') row.level = rwField.value.trim() === '' ? null : Number(rwField.value);
      else if (field === 'category') row.category = rwField.value;
      else if (field === 'role_id') row.role_id = rwField.value;
      attemptIssues = attemptIssues.filter((i) => i.feature !== fKey);
      renderAll();
      return;
    }
    const gField = (e.target as HTMLElement).closest<HTMLInputElement | HTMLSelectElement>('[data-guide-field]');
    if (gField && data) {
      const rowEl = gField.closest<HTMLElement>('[data-guide-row]');
      const [fKey, pKey, idx] = (rowEl?.dataset.guideRow ?? '').split('|');
      const rows = (Array.isArray(draft[fKey]?.settings[pKey]) ? draft[fKey].settings[pKey] : []) as GuideRow[];
      const row = rows[Number(idx)];
      if (!row) return;
      if (gField.dataset.guideField === 'text') row.text = gField.value;
      else row.channel_id = gField.value;
      attemptIssues = attemptIssues.filter((i) => i.feature !== fKey);
      renderAll();
      return;
    }
    const listBox = (e.target as HTMLElement).closest<HTMLInputElement>('input[data-list]');
    if (listBox && data) {
      const [fKey, pKey] = listBox.dataset.list!.split('|');
      if (!draft[fKey]) return;
      const st = draft[fKey].settings;
      const cur = Array.isArray(st[pKey]) ? (st[pKey] as string[]) : [];
      const next = cur.filter((id) => id !== listBox.value);
      if (listBox.checked) next.push(listBox.value);
      if (next.length) st[pKey] = next;
      else delete st[pKey];
      attemptIssues = attemptIssues.filter((i) => i.feature !== fKey);
      renderAll();
      return;
    }
    const setting = (e.target as HTMLElement).closest<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-setting]');
    if (setting && data) {
      const [fKey, pKey] = setting.dataset.setting!.split('|');
      if (!draft[fKey]) return;
      const t = setting.dataset.type;
      const st = draft[fKey].settings;
      if (t === 'boolean') st[pKey] = (setting as HTMLInputElement).checked;
      else if (t === 'integer') {
        if (setting.value.trim() === '') delete st[pKey];
        else st[pKey] = Number(setting.value);
      } else if (setting.value === '') delete st[pKey];
      else st[pKey] = setting.value;
      attemptIssues = attemptIssues.filter((i) => i.feature !== fKey);
      renderAll();
      return;
    }
    const sel = (e.target as HTMLElement).closest<HTMLSelectElement>('select[data-channel]');
    if (!sel || !data) return;
    const [key, purpose] = sel.dataset.channel!.split('|');
    if (!draft[key]) return;
    if (isSnowflake(sel.value)) draft[key].channels[purpose] = sel.value;
    else delete draft[key].channels[purpose];
    attemptIssues = attemptIssues.filter((i) => i.feature !== key);
    renderAll();
  });

  // Gambar ulang yang ditunda selama dropdown channel dipakai.
  root.addEventListener('focusin', (e) => {
    if (e.target instanceof HTMLSelectElement) selectFocusAt = Date.now();
  });
  root.addEventListener('focusout', () => {
    if (!deferredRender) return;
    setTimeout(() => {
      const a = document.activeElement;
      if (deferredRender && !(a instanceof HTMLSelectElement && root.contains(a))) renderAll();
    }, 0);
  });

  window.addEventListener('hashchange', () => {
    const next = parseTab(location.hash);
    if (next !== tab) {
      tab = next;
      if (hubOf(next) === 'server-hub') lastServerTab = next;
      renderAll();
    }
  });

  window.addEventListener('beforeunload', (e) => {
    if (dirty()) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && data) void poll();
  });

  // ─── Mulai ───────────────────────────────────────────────────────────────

  (async () => {
    root.innerHTML = loadingBlock('Memuat konfigurasi server…');
    if (!isDashboardConfigured) {
      pageError = { code: 'NETWORK', detail: null };
      return renderError();
    }
    if (!/^[0-9]{15,22}$/.test(guildId)) {
      pageError = { code: 'INVALID_GUILD', detail: null };
      return renderError();
    }
    const session = await getSession();
    if (!session) return rememberNextAndGoToLogin(location.pathname + location.search + location.hash);

    await load(false);
    const loaded = current();
    if (!loaded) return renderError();
    renderAll();

    // Data channel belum ada / basi → minta bot menerbitkan ulang otomatis.
    const at = Date.parse(loaded.snapshot?.refreshed_at ?? '');
    const statsStale = loaded.bot.installed && tab === 'overview' && isStatsStale(parseStatsSummary(loaded.snapshot?.stats_summary), serverNow()) && statsRefreshAllowed();
    if (loaded.bot.installed && (!Number.isFinite(at) || serverNow() - at > STALE_SNAPSHOT_MS || statsStale)) await discordRefresh(statsStale);
    else schedulePoll();
  })();
}
