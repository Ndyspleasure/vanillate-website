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
  isSnowflake,
  missingPermissions,
  normalizeState,
  permissionWarnings,
  relativeTime,
  serverIssues,
  sortedRegistry,
  STATUS_META,
  validateDraft,
  type AuditRow,
  type ConfigState,
  type Feature,
  type GuildData,
  type Issue,
  type Purpose,
  type TextContext,
  type Tone,
} from './model';
import { rememberNextAndGoToLogin } from './servers-page';
import { BTN_PRIMARY, BTN_SECONDARY, CARD, esc, guildAvatar, icon, loadingBlock, pill, spinner, toast, wireAvatars } from './ui';

type Tab = 'overview' | 'game-hub' | 'social-hub' | 'channels' | 'audit-log';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Ringkasan' },
  { id: 'game-hub', label: 'Game Hub' },
  { id: 'social-hub', label: 'Social Hub' },
  { id: 'channels', label: 'Channel' },
  { id: 'audit-log', label: 'Riwayat' },
];

const SECTION_OF_TAB: Partial<Record<Tab, string>> = { 'game-hub': 'game', 'social-hub': 'social' };

const FAST_POLL_MS = 2500;
const SLOW_POLL_MS = 15000;
const IDLE_POLL_MS = 30000;
const SYNC_TIMEOUT_MS = 60000;
const REFRESH_TIMEOUT_MS = 30000;
const STALE_SNAPSHOT_MS = 10 * 60 * 1000;

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
  let tab: Tab = parseTab(location.hash);
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
  let refreshWatch: { prev: string | null; until: number } | null = null;
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

  function parseTab(hash: string): Tab {
    const id = hash.replace(/^#/, '') as Tab;
    return TABS.some((t) => t.id === id) ? id : 'overview';
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
      if (pageError.code === 'NOT_AUTHENTICATED') return rememberNextAndGoToLogin(location.pathname + location.search);
      if (pageError.code === 'DISCORD_RELOGIN') return rememberNextAndGoToLogin(location.pathname + location.search);
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
          refreshWatch = null;
          toast('Data channel dari Discord diperbarui.', 'success');
        } else if (Date.now() > refreshWatch.until) {
          refreshWatch = null;
          toast(data.bot.online ? 'Bot belum mengirim data channel. Coba lagi sebentar lagi.' : 'Bot sedang offline — data channel diperbarui saat bot online.', 'warning', 6000);
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
        toast('Konfigurasi baru saja diubah dari Discord (/pengaturan).', 'info', 6000);
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

    root.innerHTML = `
      <a href="/dashboard/" class="inline-flex items-center gap-1.5 text-sm text-ink-600 hover:text-ink-900 dark:text-cream-300 dark:hover:text-cream-50">
        ${icon('arrow-left')} Semua server
      </a>
      <div class="mt-4" data-region="header">${headerHtml()}</div>
      <div data-region="attention">${attentionHtml()}</div>
      <div class="mt-6 overflow-x-auto" role="tablist" aria-label="Bagian konfigurasi">
        <div class="flex min-w-max gap-1 rounded-full border border-ink-900/10 bg-white/60 p-1 dark:border-cream-100/10 dark:bg-ink-900/40">
          ${TABS.map(
            (t) => `<button type="button" role="tab" id="tab-${t.id}" aria-controls="panel" aria-selected="${t.id === tab}" data-tab="${t.id}"
              class="rounded-full px-4 py-2 text-sm font-medium transition ${t.id === tab ? 'bg-amber-500 text-ink-950' : 'text-ink-600 hover:bg-ink-900/5 dark:text-cream-300 dark:hover:bg-cream-100/5'}">${t.label}</button>`,
          ).join('')}
        </div>
      </div>
      <section id="panel" role="tabpanel" aria-labelledby="tab-${tab}" class="mt-6 pb-28">${panelHtml()}</section>
      ${saveBarHtml()}`;
    wireAvatars(root);
    if (focusSel) root.querySelector<HTMLElement>(focusSel)?.focus();
    if (tab === 'audit-log' && audit === null && !auditLoading && !auditError) void loadAudit();
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
      <div class="${CARD} p-5 sm:p-6">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="flex min-w-0 items-center gap-4">
            ${guildAvatar(guildIconUrl(guildId, d.guild.icon), guildInitials(name), 'h-14 w-14 text-lg')}
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
        <div class="mt-5 grid gap-3 text-sm sm:grid-cols-3">
          <div class="rounded-xl bg-ink-900/[0.03] px-4 py-3 dark:bg-cream-100/[0.04]">
            <p class="text-xs text-ink-500 dark:text-cream-300/70">Revisi tersimpan</p>
            <p class="mt-0.5 font-display text-xl font-semibold">${c?.revision ?? 0}</p>
          </div>
          <div class="rounded-xl bg-ink-900/[0.03] px-4 py-3 dark:bg-cream-100/[0.04]">
            <p class="text-xs text-ink-500 dark:text-cream-300/70">Diterapkan bot</p>
            <p class="mt-0.5 font-display text-xl font-semibold">${c?.applied_revision ?? 0}</p>
          </div>
          <div class="rounded-xl bg-ink-900/[0.03] px-4 py-3 dark:bg-cream-100/[0.04]">
            <p class="text-xs text-ink-500 dark:text-cream-300/70">Sinkron terakhir</p>
            <p class="mt-0.5 font-medium" title="${esc(formatWib(c?.applied_at))}">${c ? esc(relativeTime(c.applied_at)) : 'Pengaturan bawaan'}</p>
          </div>
        </div>
        <p class="mt-3 text-xs text-ink-500 dark:text-cream-300/70">${esc(st.hint)}${
          c ? ` Diubah terakhir oleh <strong>${esc(c.updated_by_name ?? c.updated_by ?? '—')}</strong> lewat ${source}, ${esc(formatWib(c.updated_at))}.` : ''
        }</p>
        <div class="mt-4 flex flex-wrap gap-2">
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
    const section = SECTION_OF_TAB[tab]!;
    const feats = registry().filter((f) => f.section === section);
    const intro =
      section === 'game'
        ? 'Matikan game yang tidak ingin dimainkan di server ini, atau kunci game ke satu channel khusus. Game tanpa channel khusus bisa dibuka di channel mana pun.'
        : 'Fitur sosial berjalan di channel khusus pilihanmu. Fitur yang belum diberi channel tidak aktif. Satu channel hanya untuk satu fitur sosial.';
    if (!feats.length) return `<p class="text-sm text-ink-500">Belum ada fitur di bagian ini.</p>`;
    return `
      <p class="max-w-3xl text-sm text-ink-600 dark:text-cream-300">${intro}</p>
      ${data!.snapshot?.refreshed_at ? `<p class="mt-2 text-xs text-ink-500 dark:text-cream-300/60">Daftar channel dari Discord: ${esc(relativeTime(data!.snapshot.refreshed_at))}.</p>` : ''}
      <div class="mt-5 grid gap-4 lg:grid-cols-2">${feats.map(featureCardHtml).join('')}</div>`;
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
    const empty = p.required ? '— Pilih channel —' : p.empty_label ?? 'Tidak diatur';
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
      ${!d.snapshot?.refreshed_at ? `<p class="mt-1.5 text-xs text-amber-800 dark:text-amber-300">Daftar channel belum dimuat — tekan Refresh Discord Data.</p>` : ''}
      ${missing.length ? `<p class="mt-1.5 text-xs text-amber-800 dark:text-amber-300">Izin bot kurang di #${esc(ch!.name)}: ${esc(missing.join(', '))}.</p>` : ''}`;
  }

  function featureCardHtml(f: Feature): string {
    const s = draft[f.key];
    const status = featureIssues(f);
    const statusPill =
      status.level === 'off'
        ? pill('Nonaktif', 'neutral')
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

    return `
      <article class="${CARD} p-5 ${s.enabled ? '' : 'opacity-90'}" aria-labelledby="feat-${esc(f.key)}">
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <h3 id="feat-${esc(f.key)}" class="font-display text-lg font-semibold">${f.emoji ? `<span aria-hidden="true">${esc(f.emoji)}</span> ` : ''}${esc(f.name)}</h3>
            ${command ? `<p class="mt-0.5 font-mono text-xs text-ink-500 dark:text-cream-300/60">${esc(command)}</p>` : ''}
          </div>
          <button type="button" role="switch" aria-checked="${s.enabled}" aria-label="${esc(f.name)}: ${s.enabled ? 'aktif' : 'nonaktif'}"
            data-toggle="${esc(f.key)}" data-focus="tg-${esc(f.key)}" ${disabled ? 'disabled' : ''}
            class="group inline-flex shrink-0 items-center gap-2 rounded-full text-xs font-semibold disabled:opacity-60">
            <span class="relative inline-flex h-6 w-11 items-center rounded-full transition ${s.enabled ? 'bg-emerald-500' : 'bg-ink-400/40 dark:bg-ink-600'}">
              <span class="inline-block h-5 w-5 rounded-full bg-white shadow transition ${s.enabled ? 'translate-x-5' : 'translate-x-0.5'}"></span>
            </span>
            <span class="w-7 text-left">${s.enabled ? 'ON' : 'OFF'}</span>
          </button>
        </div>
        ${f.description ? `<p class="mt-3 text-sm text-ink-600 dark:text-cream-300/80">${esc(f.description)}</p>` : ''}
        <div class="mt-4 space-y-4">
          ${
            s.enabled
              ? f.purposes.map((p) => `<div>${selectHtml(f, p)}</div>`).join('')
              : savedChannels.length
                ? `<p class="text-xs text-ink-500 dark:text-cream-300/60">Tersimpan: ${esc(savedChannels.join(' · '))} — dipakai lagi saat fitur diaktifkan.</p>`
                : ''
          }
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
    const mapped = feats.reduce((n, f) => n + Object.keys(base[f.key]?.channels ?? {}).length, 0);
    const tile = (label: string, value: string, sub = '') => `
      <div class="${CARD} p-5">
        <p class="text-xs text-ink-500 dark:text-cream-300/70">${label}</p>
        <p class="mt-1 font-display text-3xl font-semibold">${value}</p>
        ${sub ? `<p class="mt-1 text-xs text-ink-500 dark:text-cream-300/60">${sub}</p>` : ''}
      </div>`;
    const sections = [
      { id: 'game-hub', title: 'Game Hub', section: 'game', ic: 'gamepad-2' as const },
      { id: 'social-hub', title: 'Social Hub', section: 'social', ic: 'users' as const },
    ];
    return `
      <div class="grid gap-4 sm:grid-cols-3">
        ${tile('Fitur aktif', `${active}<span class="text-lg text-ink-400"> / ${feats.length}</span>`)}
        ${tile('Channel diatur', String(mapped), 'Pemetaan fitur → channel')}
        ${tile('Status bot', d.bot.installed ? (d.bot.online ? 'Online' : 'Offline') : 'Tidak ada', d.bot.version ? `Versi ${esc(d.bot.version)}` : '')}
      </div>
      <div class="mt-4 grid gap-4 lg:grid-cols-2">
        ${sections
          .map((sec) => {
            const list = feats.filter((f) => f.section === sec.section);
            return `
            <div class="${CARD} p-5">
              <div class="flex items-center justify-between gap-3">
                <h2 class="flex items-center gap-2 font-display text-lg font-semibold">${icon(sec.ic, 'h-5 w-5 text-amber-600')} ${sec.title}</h2>
                <button type="button" data-tab="${sec.id}" data-focus="go-${sec.id}" class="text-sm font-medium text-amber-700 hover:underline dark:text-amber-300">Atur →</button>
              </div>
              <ul class="mt-4 divide-y divide-ink-900/5 dark:divide-cream-100/5">
                ${list
                  .map((f) => {
                    const s = base[f.key];
                    const ch = f.purposes.map((p) => s.channels[p.key]).find(Boolean);
                    const where = !s.enabled ? 'Nonaktif' : ch ? channelLabel(ctx(), ch) : f.purposes.some((p) => p.required) ? 'Belum ada channel' : 'Semua channel';
                    return `<li class="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <span class="truncate">${f.emoji ? `${esc(f.emoji)} ` : ''}${esc(f.name)}</span>
                      <span class="shrink-0 text-xs ${s.enabled ? 'text-ink-600 dark:text-cream-300' : 'text-ink-400'}">${esc(where)}</span></li>`;
                  })
                  .join('')}
              </ul>
            </div>`;
          })
          .join('')}
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
        const sectionTab = f.section === 'social' ? 'social-hub' : 'game-hub';
        return `<tr class="border-t border-ink-900/5 dark:border-cream-100/5">
          <td class="py-3 pr-4">${f.emoji ? `${esc(f.emoji)} ` : ''}${esc(f.name)}</td>
          <td class="py-3 pr-4 text-ink-600 dark:text-cream-300/80">${esc(p.label)}</td>
          <td class="py-3 pr-4 font-mono text-xs">${id ? esc(channelLabel(ctx(), id)) : '—'}</td>
          <td class="py-3 pr-4">${status}</td>
          <td class="py-3 text-right"><button type="button" data-tab="${sectionTab}" data-focus="edit-${esc(f.key)}-${esc(p.key)}" class="text-xs font-medium text-amber-700 hover:underline dark:text-amber-300">Ubah</button></td>
        </tr>`;
      }),
    );
    return `
      <p class="max-w-3xl text-sm text-ink-600 dark:text-cream-300">Pemetaan channel yang <strong>tersimpan</strong> untuk setiap fitur, diperiksa terhadap data Discord terbaru. Ubah lewat tab Game Hub atau Social Hub.</p>
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

  function auditHtml(): string {
    if (audit === null && auditError) {
      return `<div class="text-sm text-ink-600 dark:text-cream-300">Gagal memuat riwayat.
        <button type="button" data-action="audit-retry" class="ml-1 font-medium text-amber-700 underline dark:text-amber-300">Coba lagi</button></div>`;
    }
    if (audit === null) return loadingBlock('Memuat riwayat…');
    if (!audit.length) return `<p class="text-sm text-ink-500">Belum ada riwayat perubahan untuk server ini.</p>`;
    return `
      <ol class="space-y-3">
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
                      .map((c) => `<li class="flex gap-2"><span class="text-ink-400">–</span><span>${esc(formatAuditChange(c, ctx()))}</span></li>`)
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
      toast(r.bot_online ? 'Bot diminta memuat ulang konfigurasi terbaru…' : 'Permintaan tercatat. Bot sedang offline — dijalankan saat online.', r.bot_online ? 'info' : 'warning');
      await load(true);
      renderAll();
      if (pollTimer) clearTimeout(pollTimer);
      pollTimer = setTimeout(poll, FAST_POLL_MS);
    } catch (err) {
      btn.disabled = false;
      toast(describeError(err instanceof DashboardError ? err.code : 'NETWORK'), 'danger');
    }
  }

  async function discordRefresh(): Promise<void> {
    try {
      const prev = data?.snapshot?.refreshed_at ?? null;
      const r = await requestDiscordRefresh(guildId);
      refreshWatch = { prev, until: Date.now() + REFRESH_TIMEOUT_MS };
      if (!r.bot_online) toast('Bot sedang offline — data channel diperbarui saat bot online.', 'warning');
      renderAll();
      if (pollTimer) clearTimeout(pollTimer);
      pollTimer = setTimeout(poll, FAST_POLL_MS);
    } catch (err) {
      toast(describeError(err instanceof DashboardError ? err.code : 'NETWORK'), 'danger');
      schedulePoll();
    }
  }

  function setTab(next: Tab): void {
    tab = next;
    history.replaceState(null, '', `${location.pathname}${location.search}#${next}`);
    renderAll();
    root.querySelector<HTMLElement>(`#tab-${next}`)?.focus();
  }

  root.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const tabBtn = target.closest<HTMLElement>('[data-tab]');
    if (tabBtn) return setTab(tabBtn.dataset.tab as Tab);

    const toggle = target.closest<HTMLButtonElement>('[data-toggle]');
    if (toggle && !toggle.disabled && data) {
      const key = toggle.dataset.toggle!;
      draft[key].enabled = !draft[key].enabled;
      attemptIssues = attemptIssues.filter((i) => i.feature !== key);
      renderAll();
      return;
    }

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

  root.addEventListener('change', (e) => {
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
    if (!session) return rememberNextAndGoToLogin(location.pathname + location.search);

    await load(false);
    const loaded = current();
    if (!loaded) return renderError();
    renderAll();

    // Data channel belum ada / basi → minta bot menerbitkan ulang otomatis.
    const at = Date.parse(loaded.snapshot?.refreshed_at ?? '');
    if (loaded.bot.installed && (!Number.isFinite(at) || serverNow() - at > STALE_SNAPSHOT_MS)) await discordRefresh();
    else schedulePoll();
  })();
}
