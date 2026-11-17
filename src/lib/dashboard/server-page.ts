// /dashboard/server/?id=<guildId> — konfigurasi satu server (inti halaman).
//
// Alur (docs/DASHBOARD-SERVER.md §Alur):
//   muat → draft lokal (DRAFT) → Simpan (SAVING) → revisi N+1 di database
//   (SAVED/SYNCING) → bot menerapkan → applied = N+1 (ACTIVE) atau gagal
//   (NEEDS_ATTENTION). Tidak ada yang ditulis ke database sebelum Simpan.
//
// Hemat sumber daya (docs/DASHBOARD-SERVER.md §7):
//   • Isi tiap tab ada di tab-*.ts dan share-server.ts, diunduh saat tab dibuka.
//   • Polling lewat polling.ts: berhenti total saat tab browser tersembunyi,
//     cepat hanya selama ada aksi yang menunggu bot, lalu mundur bertahap.

import { DashboardError, getGuild, getGuildIfChanged, getSession, isDashboardConfigured, requestDiscordRefresh, requestResync, saveConfig } from './api';
import {
  buildSavePayload,
  channelById,
  cloneState,
  describeError,
  describeIssue,
  diffStates,
  displayStatus,
  formatWib,
  guildIconUrl,
  guildInitials,
  inviteUrl,
  normalizeState,
  permissionWarnings,
  relativeTime,
  serverIssues,
  STATUS_META,
  validateDraft,
  type ConfigState,
  type GuildData,
  type Issue,
  type SyncStatus,
  type TextContext,
  type Tone,
} from './model';
import { rememberNextAndGoToLogin } from './login-redirect';
import { createPoller, FAST_MS, nextDelay } from './polling';
import { describeChange } from './review-model';
import { HUBS, hubOf, parseTabHash, SECTION_OF_TAB, SERVER_GROUPS, type Hub, type PageCtx, type Tab } from './server-shared';
import { isStatsStale, parseStatsSummary } from './stats-model';
import { BTN_PRIMARY, BTN_SECONDARY, CARD, esc, guildAvatar, icon, loadingBlock, pill, spinner, toast, wireAvatars } from './ui';
import type { ShareController } from './share-server';
import type { AuditController } from './tab-audit';

const SYNC_TIMEOUT_MS = 60000;
const REFRESH_TIMEOUT_MS = 30000;
const STALE_SNAPSHOT_MS = 10 * 60 * 1000;
const STATS_AUTO_REFRESH_MS = 60 * 60 * 1000;
/** Kembali ke tab browser: data yang lebih muda dari ini tidak dimuat ulang. */
const VISIBLE_MIN_GAP_MS = 15000;

interface PageConfig {
  root: HTMLElement;
  clientId: string;
  permissions: string;
}

/** Jumlah masalah yang langsung tampil; sisanya dilipat supaya isi tab tidak terdorong jauh di HP. */
const ATTENTION_SHOWN = 2;

/** Urutan status di bantuan "Arti status" (sama dengan alur simpan). */
const STATUS_HELP: SyncStatus[] = ['DRAFT', 'SAVED', 'SYNCING', 'ACTIVE', 'NEEDS_ATTENTION', 'BOT_OFFLINE', 'NOT_INSTALLED'];

type ModuleKey = 'features' | 'overview' | 'channels' | 'audit' | 'share';

function moduleOf(tab: Tab): ModuleKey {
  if (tab === 'overview') return 'overview';
  if (tab === 'channels') return 'channels';
  if (tab === 'audit-log') return 'audit';
  if (tab === 'share-server') return 'share';
  return 'features';
}

export function mountServerPage(cfg: PageConfig): void {
  const { root } = cfg;
  const guildId = new URLSearchParams(location.search).get('id') ?? '';

  let data: GuildData | null = null;
  let base: ConfigState = {};
  let draft: ConfigState = {};
  // Submenu Server Hub yang terakhir dibuka (tujuan klik "Server Hub").
  let lastServerTab: Tab = 'verification';
  let tab: Tab = parseTabHash(location.hash, lastServerTab);
  if (hubOf(tab) === 'server-hub') lastServerTab = tab;
  let saving = false;
  let justSaved = false;
  let attemptIssues: Issue[] = []; // dari percobaan simpan (klien/server)
  let pageError: { code: string; detail: Record<string, unknown> | null } | null = null;
  let syncWatchUntil = 0;
  let watchStartedAt = 0;
  // Selesai saat refreshed_at snapshot berubah dari nilai sebelum permintaan
  // (dibandingkan dengan nilai dari server, bukan jam browser).
  let refreshWatch: { prev: string | null; until: number; quiet?: boolean } | null = null;
  let remoteChanged = false;
  // Revisi tempat draft dibuat. Dikirim saat simpan, jadi perubahan dari tempat
  // lain selama mengedit selalu ditolak STALE_REVISION (bukan ditimpa diam-diam).
  let baseRevision = 0;
  // Selisih jam server − jam browser (server_time dari guild_dashboard_get).
  let clockSkew = 0;
  let deferredRender = false;
  let selectFocusAt = 0;
  let reviewOpen = false;
  // Lipatan <details> yang sedang dibuka, supaya tetap terbuka setelah gambar ulang.
  const openDetails = new Set<string>();
  let setupDismissed = false;
  try {
    setupDismissed = localStorage.getItem(`vn-setup-hide-${guildId}`) === '1';
  } catch {
    /* penyimpanan diblokir: kartu langkah awal tetap tampil */
  }

  // Dibaca lewat fungsi: TypeScript tidak tahu load() mengubah `data`.
  const current = (): GuildData | null => data;
  const ctx = (): TextContext => ({ registry: data?.registry ?? [], snapshot: data?.snapshot ?? null });
  const changes = () => (data ? diffStates(base, draft, data.registry) : []);
  const dirty = () => changes().length > 0;
  const editable = () => Boolean(data?.bot.installed);
  const serverNow = () => Date.now() + clockSkew;

  // ─── Modul tab (dimuat malas) ────────────────────────────────────────────

  const mods: {
    features?: typeof import('./tab-features');
    overview?: typeof import('./tab-overview');
    channels?: typeof import('./tab-channels');
    audit?: AuditController;
    share?: ShareController;
  } = {};
  const pending = new Map<ModuleKey, Promise<void>>();
  let moduleError = false;

  function ensureModule(key: ModuleKey): Promise<void> {
    if (mods[key]) return Promise.resolve();
    let p = pending.get(key);
    if (!p) {
      p = (async () => {
        if (key === 'features') mods.features = await import('./tab-features');
        else if (key === 'overview') mods.overview = await import('./tab-overview');
        else if (key === 'channels') mods.channels = await import('./tab-channels');
        else if (key === 'audit') mods.audit = (await import('./tab-audit')).createAuditController(guildId, root);
        // 📣 Share Server punya data dan antreannya sendiri (bukan revisi dashboard).
        else mods.share = (await import('./share-server')).createShareController(guildId, () => renderAll(), root);
        moduleError = false;
      })().catch(() => {
        moduleError = true; // jaringan putus atau situs baru saja diperbarui
      }).finally(() => pending.delete(key));
      pending.set(key, p);
    }
    return p;
  }

  /** Keadaan halaman untuk modul tab. Dibuat ulang tiap dipakai (draft bisa diganti). */
  function pageCtx(): PageCtx {
    const d = data!;
    return {
      guildId,
      data: d,
      base,
      draft,
      attemptIssues,
      editable: editable(),
      saving,
      text: ctx(),
      registry: [...d.registry].sort((a, b) => a.sort - b.sort || a.key.localeCompare(b.key)),
      serverNow,
      render: renderAll,
      clearAttempt(featureKey) {
        attemptIssues = attemptIssues.filter((i) => i.feature !== featureKey);
      },
      replaceDraft(next) {
        draft = next;
        attemptIssues = [];
        renderAll();
      },
    };
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

  /** `ifChanged` (poll): hanya penanda kecil yang diunduh bila tidak ada yang berubah. */
  async function load(keepDraft = false, ifChanged = false): Promise<void> {
    try {
      const next = ifChanged ? await getGuildIfChanged(guildId) : await getGuild(guildId);
      pageError = null;
      if (next) applyData(next, { keepDraft });
    } catch (err) {
      pageError = err instanceof DashboardError ? { code: err.code, detail: err.detail } : { code: 'NETWORK', detail: null };
      if (pageError.code === 'NOT_AUTHENTICATED') return rememberNextAndGoToLogin(location.pathname + location.search + location.hash);
      if (pageError.code === 'DISCORD_RELOGIN') return rememberNextAndGoToLogin(location.pathname + location.search + location.hash);
    } finally {
      poller.touch();
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

  // Jeda poll: cepat selama aksi ditunggu, lalu mundur bertahap (polling.ts).
  const watchingBot = () => Boolean(refreshWatch) || (waitingForBot() && Date.now() < syncWatchUntil);
  const pollMode = () => (watchingBot() ? 'fast' : waitingForBot() ? 'slow' : 'idle');
  const pollDelay = (quiet: number) =>
    nextDelay({ watching: watchingBot(), watchElapsedMs: Date.now() - watchStartedAt, waitingForBot: waitingForBot(), quietStreak: quiet });

  /** Bot belum juga mengambil revisi tersimpan setelah SYNC_TIMEOUT_MS (jam server). */
  function syncTimedOut(): boolean {
    const c = data?.config;
    return Boolean(c && data?.bot.online && c.revision > c.applied_revision && c.sync_status !== 'NEEDS_ATTENTION'
      && c.attempted_revision !== c.revision && Date.parse(c.updated_at) < serverNow() - SYNC_TIMEOUT_MS);
  }

  /**
   * Isi yang ditampilkan, tanpa stempel yang berubah sendiri dan tidak ditampilkan
   * (jam server, heartbeat bot, waktu cek kesehatan, waktu verifikasi akses).
   * Stempel itu tidak boleh memicu gambar ulang atau mengembalikan jeda poll ke rapat.
   */
  const renderSignature = () =>
    JSON.stringify({
      data: data
        ? {
            ...data,
            server_time: null,
            bot: { ...data.bot, last_heartbeat_at: null },
            config: data.config ? { ...data.config, health_checked_at: null } : null,
            viewer: { ...data.viewer, access_verified_at: null },
          }
        : null,
      pageError,
      timedOut: syncTimedOut(),
    });

  /** Riwayat bertambah saat revisi/percobaan/permintaan berubah → muat ulang. */
  const auditSignature = (c: GuildData['config'] | undefined) =>
    c ? `${c.revision}|${c.applied_revision}|${c.attempted_at ?? ''}|${c.resync_requested_at ?? ''}` : '';

  /** Satu putaran poll. Mengembalikan true bila ada yang berubah (jeda kembali rapat). */
  async function pollOnce(): Promise<boolean> {
    const before = data;
    const beforeSig = renderSignature();
    const watching = refreshWatch;
    const wasRemote = remoteChanged;
    await load(true, true);
    if (!data) return false;

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
    // Tidak ada yang berubah → jangan gambar ulang (fokus tetap di tempatnya),
    // kecuali gambar ulang yang tertunda sudah melewati batas 15 detik.
    const changed = renderSignature() !== beforeSig || refreshWatch !== watching || remoteChanged !== wasRemote;
    const deferExpired = deferredRender && Date.now() - selectFocusAt >= 15000;
    if (!deferExpired && !changed) return false;
    // Dropdown channel sedang dipakai: tunda gambar ulang (mengganti
    // elemennya menutup daftar pilihan di tengah jalan) — paling lama 15 dtk.
    const active = document.activeElement;
    if (active instanceof HTMLSelectElement && root.contains(active) && Date.now() - selectFocusAt < 15000) {
      deferredRender = true;
      return changed;
    }
    renderAll();
    return changed;
  }

  const poller = createPoller({ run: pollOnce, delay: pollDelay, mode: pollMode, minGapMs: VISIBLE_MIN_GAP_MS });

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

    const bar = saveBarHtml();
    root.innerHTML = `
      <a href="/dashboard/" class="inline-flex min-h-[44px] items-center gap-1.5 text-sm text-ink-600 hover:text-ink-900 sm:min-h-0 dark:text-cream-300 dark:hover:text-cream-50">
        ${icon('arrow-left')} Semua server
      </a>
      <div class="mt-1 sm:mt-4" data-region="header">${headerHtml()}</div>
      <div data-region="attention">${attentionHtml()}</div>
      ${navHtml(Boolean(bar))}
      ${bar}`;
    wireAvatars(root);
    for (const [k, top] of scrolls) {
      const el = root.querySelector<HTMLElement>(`[data-scroll-keep="${CSS.escape(k)}"]`);
      if (el) el.scrollTop = top;
    }
    if (focusSel) root.querySelector<HTMLElement>(focusSel)?.focus({ preventScroll: true });
    if (tab === 'share-server') mods.share?.activate();
    else mods.share?.deactivate();
  }

  // ─── Navigasi ────────────────────────────────────────────────────────────

  function navHtml(hasBar: boolean): string {
    const hub = hubOf(tab);
    // Ruang di bawah supaya isi terakhir tidak tertutup bar simpan yang mengambang
    // (di HP bar berada di atas maskot dan tombol kembali ke atas milik layout).
    const panel = `<section id="panel" role="tabpanel" aria-labelledby="tab-${hub}" class="min-w-0 ${hasBar ? 'pb-44 sm:pb-24' : 'pb-4 sm:pb-10'}">${panelHtml()}</section>`;
    const top = `
      <div class="mt-3 sm:mt-6" role="tablist" aria-label="Kategori pengaturan">
        <div class="grid grid-cols-4 gap-1 rounded-2xl border border-ink-900/10 bg-white/60 p-1 sm:inline-flex sm:rounded-full dark:border-cream-100/10 dark:bg-ink-900/40">
          ${HUBS.map(
            (h) => `<button type="button" role="tab" id="tab-${h.id}" aria-controls="panel" aria-selected="${h.id === hub}" data-tab="${h.id}"
              class="min-h-[44px] rounded-xl px-1.5 py-2 text-xs font-medium leading-tight transition sm:min-h-0 sm:rounded-full sm:px-4 sm:text-sm ${h.id === hub ? 'bg-amber-500 text-ink-950' : 'text-ink-600 hover:bg-ink-900/5 dark:text-cream-300 dark:hover:bg-cream-100/5'}">${h.label}</button>`,
          ).join('')}
        </div>
      </div>`;
    if (hub !== 'server-hub') return `${top}<div class="mt-3 sm:mt-6">${panel}</div>`;
    // Server Hub: di HP satu menu pilih (tanpa geser menyamping), di layar lebar sidebar berkelompok.
    const select = `
      <label class="block md:hidden">
        <span class="sr-only">Menu Server Hub</span>
        <select data-nav-select data-focus="nav-select"
          class="min-h-[44px] w-full rounded-xl border border-ink-900/15 bg-white px-3 py-2.5 text-sm font-medium outline-none focus:border-amber-500 dark:border-cream-100/15 dark:bg-ink-800">
          ${SERVER_GROUPS.map(
            (g) => `<optgroup label="${esc(g.label)}">${g.tabs.map((t) => `<option value="${t.id}" ${t.id === tab ? 'selected' : ''}>${esc(t.label)}</option>`).join('')}</optgroup>`,
          ).join('')}
        </select>
      </label>`;
    const side = `
      <nav aria-label="Menu Server Hub" class="hidden md:sticky md:top-24 md:block md:rounded-2xl md:border md:border-ink-900/10 md:bg-white/60 md:p-2 dark:md:border-cream-100/10 dark:md:bg-ink-900/40">
        ${SERVER_GROUPS.map(
          (g, gi) => `<p class="${gi ? 'mt-3' : ''} px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-500 dark:text-cream-300/60">${esc(g.label)}</p>
          <ul>${g.tabs
            .map((t) => {
              const on = t.id === tab;
              return `<li><button type="button" id="subtab-${t.id}" data-tab="${t.id}" ${on ? 'aria-current="page"' : ''}
                class="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                  on ? 'bg-amber-500/15 text-amber-900 dark:text-amber-200' : 'text-ink-600 hover:bg-ink-900/5 dark:text-cream-300 dark:hover:bg-cream-100/5'
                }">${icon(t.ic, 'h-4 w-4 shrink-0')} ${esc(t.label)}</button></li>`;
            })
            .join('')}</ul>`,
        ).join('')}
      </nav>`;
    return `${top}
      <div class="mt-3 grid gap-3 md:mt-6 md:grid-cols-[12rem_minmax(0,1fr)] md:items-start md:gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">${select}${side}${panel}</div>`;
  }

  function renderError(): void {
    const code = pageError?.code ?? 'NETWORK';
    root.innerHTML = `
      <a href="/dashboard/" class="inline-flex min-h-[44px] items-center gap-1.5 text-sm text-ink-600 hover:text-ink-900 dark:text-cream-300">${icon('arrow-left')} Semua server</a>
      <div class="${CARD} mx-auto mt-4 max-w-xl p-6 text-center sm:mt-6 sm:p-8">
        <span class="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/15 text-red-600 dark:text-red-300">${icon(code === 'ACCESS_DENIED' ? 'lock' : 'triangle-alert', 'h-6 w-6')}</span>
        <h1 class="mt-4 font-display text-2xl font-semibold">${code === 'ACCESS_DENIED' ? 'Tidak punya akses' : 'Gagal memuat server'}</h1>
        <p class="mt-3 text-sm text-ink-600 dark:text-cream-300">${esc(describeError(code, pageError?.detail))}</p>
        <div class="mt-6 flex flex-wrap justify-center gap-3">
          <a href="/dashboard/" class="${BTN_SECONDARY} min-h-[44px]">Kembali</a>
          <button type="button" data-action="reload" class="${BTN_PRIMARY} min-h-[44px]">${icon('refresh-cw')} Coba lagi</button>
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
    const stat = (label: string, value: string, title = '') => `
      <div class="min-w-0 rounded-xl bg-ink-900/[0.03] px-3 py-2.5 sm:px-4 sm:py-3 dark:bg-cream-100/[0.04]" ${title ? `title="${esc(title)}"` : ''}>
        <p class="text-xs text-ink-500 dark:text-cream-300/70">${label}</p>${value}
      </div>`;
    return `
      <div class="${CARD} p-4 sm:p-6">
        <div class="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
          <div class="flex min-w-0 items-center gap-3 sm:gap-4">
            ${guildAvatar(guildIconUrl(guildId, d.guild.icon), guildInitials(name), 'h-12 w-12 text-base sm:h-14 sm:w-14 sm:text-lg')}
            <div class="min-w-0">
              <p class="eyebrow">Sedang mengatur</p>
              <h1 class="truncate font-display text-2xl font-semibold sm:text-3xl" title="${esc(name)}">${esc(name)}</h1>
              <p class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500 dark:text-cream-300/70">
                <span class="inline-flex items-center">Guild ID <span class="ml-1 font-mono">${esc(guildId)}</span>
                  <button type="button" data-action="copy-id" class="-my-3 inline-flex h-11 w-9 items-center justify-center text-ink-400 hover:text-amber-600" aria-label="Salin Guild ID" title="Salin Guild ID">${icon('copy', 'h-3.5 w-3.5')}</button></span>
                ${d.guild.member_count != null ? `<span>${d.guild.member_count.toLocaleString('id-ID')} member</span>` : ''}
              </p>
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-2">${bot}${pill(st.label, st.tone)}</div>
        </div>
        <div class="mt-3 grid grid-cols-3 gap-2 text-sm sm:mt-5 sm:gap-3">
          ${stat('Revisi tersimpan', `<p class="mt-0.5 font-display text-lg font-semibold sm:text-xl">${c?.revision ?? 0}</p>`, 'Nomor versi pengaturan yang tersimpan. Naik satu setiap kali ada perubahan disimpan.')}
          ${stat('Diterapkan bot', `<p class="mt-0.5 font-display text-lg font-semibold sm:text-xl">${c?.applied_revision ?? 0}</p>`, 'Revisi yang sedang dijalankan bot. Sama dengan revisi tersimpan berarti sudah sinkron.')}
          ${stat('Sinkron terakhir', `<p class="mt-0.5 truncate font-medium">${c ? esc(relativeTime(c.applied_at)) : 'Pengaturan bawaan'}</p>`, formatWib(c?.applied_at))}
        </div>
        <p class="mt-3 text-xs text-ink-500 dark:text-cream-300/70">${esc(st.hint)}${
          c ? ` Diubah terakhir oleh <strong>${esc(c.updated_by_name ?? c.updated_by ?? 'tidak diketahui')}</strong> lewat ${source}, ${esc(formatWib(c.updated_at))}.` : ''
        }</p>
        <div class="mt-3 flex flex-wrap items-center gap-2 sm:mt-4">
          <button type="button" data-action="resync" class="${BTN_SECONDARY} min-h-[44px] sm:min-h-0" ${c && d.bot.installed ? '' : 'disabled'}
            title="Minta bot memuat dan menerapkan ulang revisi terbaru. Pakai bila status tidak kunjung Aktif.">${icon('refresh-cw')} Retry Sync</button>
          <button type="button" data-action="discord-refresh" class="${BTN_SECONDARY} min-h-[44px] sm:min-h-0" ${d.bot.installed && !refreshWatch ? '' : 'disabled'}
            title="Minta bot mengirim ulang daftar channel, role, dan izin bot dari Discord. Pakai setelah membuat channel atau mengubah izin.">
            ${refreshWatch ? spinner() : icon('refresh-cw')} Refresh Discord Data</button>
        </div>
        <details class="mt-2 text-xs text-ink-600 dark:text-cream-300" ${openDetails.has('status') ? 'open' : ''} data-keep-open="status">
          <summary class="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 font-medium text-ink-600 hover:text-ink-900 sm:min-h-0 sm:py-1 dark:text-cream-300 dark:hover:text-cream-50" data-focus="status-help">${icon('circle-help', 'h-3.5 w-3.5')} Arti status dan tombol</summary>
          <dl class="mt-1 grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
            ${STATUS_HELP.map((s) => `<div class="flex gap-2"><dt class="shrink-0 font-semibold">${esc(STATUS_META[s].label)}</dt><dd class="text-ink-500 dark:text-cream-300/70">${esc(STATUS_META[s].hint)}</dd></div>`).join('')}
            <div class="flex gap-2"><dt class="shrink-0 font-semibold">Retry Sync</dt><dd class="text-ink-500 dark:text-cream-300/70">Meminta bot memuat dan menerapkan ulang revisi terbaru.</dd></div>
            <div class="flex gap-2"><dt class="shrink-0 font-semibold">Refresh Discord Data</dt><dd class="text-ink-500 dark:text-cream-300/70">Meminta bot mengirim ulang daftar channel, role, dan izin bot.</dd></div>
          </dl>
        </details>
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
    for (const f of d.registry) {
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
      out.push({ text: describeError('SYNC_TIMEOUT'), tone: 'warning', action: 'resync' });
    }
    return out;
  }

  function attentionHtml(): string {
    const items = topIssues();
    if (!items.length) return '';
    const invite = inviteUrl(cfg.clientId, cfg.permissions, guildId);
    const link = 'inline-flex min-h-[44px] items-center font-medium text-amber-700 underline sm:min-h-0 dark:text-amber-300';
    const row = (i: (typeof items)[number]) => `<li class="flex gap-2"><span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${i.tone === 'danger' ? 'bg-red-500' : i.tone === 'warning' ? 'bg-amber-500' : 'bg-ink-400'}" aria-hidden="true"></span>
      <span class="min-w-0">${esc(i.text)}${i.action === 'invite' && invite ? ` <a href="${esc(invite)}" target="_blank" rel="noopener noreferrer" class="${link}">Undang bot</a>` : ''}${
        i.action === 'reload-latest' ? ` <button type="button" data-action="reload-latest" class="${link}">Muat versi terbaru</button>` : ''
      }${i.action === 'resync' ? ` <button type="button" data-action="resync" class="${link}">Retry Sync</button>` : ''}</span></li>`;
    return `
      <div class="mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.07] p-4 sm:mt-4 sm:p-5" role="region" aria-label="Perlu perhatian">
        <p class="flex items-center gap-2 font-medium text-amber-900 dark:text-amber-200">${icon('triangle-alert')} Perlu perhatian</p>
        <ul class="mt-2 space-y-2 text-sm sm:mt-3">${items.slice(0, ATTENTION_SHOWN).map(row).join('')}</ul>
        ${
          items.length > ATTENTION_SHOWN
            ? `<details class="mt-1 text-sm" ${openDetails.has('attention') ? 'open' : ''} data-keep-open="attention">
                <summary class="inline-flex min-h-[44px] cursor-pointer items-center font-medium text-amber-800 sm:min-h-0 sm:py-1 dark:text-amber-300" data-focus="attention-more">${items.length - ATTENTION_SHOWN} hal lain</summary>
                <ul class="mt-1 space-y-2">${items.slice(ATTENTION_SHOWN).map(row).join('')}</ul>
              </details>`
            : ''
        }
      </div>`;
  }

  // ─── Panel ───────────────────────────────────────────────────────────────

  function panelHtml(): string {
    const key = moduleOf(tab);
    if (!mods[key]) {
      if (moduleError && !pending.has(key)) {
        return `<div class="${CARD} p-5 text-sm text-ink-600 dark:text-cream-300">Bagian ini gagal dimuat. Periksa koneksi internet, lalu
          <button type="button" data-action="module-retry" class="font-medium text-amber-700 underline dark:text-amber-300">coba lagi</button>.</div>`;
      }
      void ensureModule(key).then(() => {
        if (moduleOf(tab) === key) renderAll();
      });
      return loadingBlock('Memuat…');
    }
    const c = pageCtx();
    if (key === 'overview') return mods.overview!.panelHtml(c, { clientId: cfg.clientId, permissions: cfg.permissions, setupDismissed });
    if (key === 'channels') return mods.channels!.panelHtml(c);
    if (key === 'audit') return mods.audit!.html(c, auditSignature(data!.config));
    if (key === 'share') return mods.share!.html(data!.snapshot ?? null);
    return mods.features!.panelHtml(c, tab);
  }

  // ─── Save bar ────────────────────────────────────────────────────────────

  /** Daftar perubahan draft dibanding yang tersimpan, sebelum Simpan ditekan. */
  function reviewHtml(): string {
    const lines = changes().map((ch) => describeChange(ch, ctx()));
    return `
      <div id="review-list" class="max-h-[40vh] w-full overflow-y-auto border-b border-ink-900/10 pb-3 dark:border-cream-100/10" data-scroll-keep="review">
        <p class="text-xs text-ink-500 dark:text-cream-300/70">Yang akan disimpan, dibanding pengaturan tersimpan (revisi ${baseRevision}):</p>
        <ul class="mt-2 space-y-1.5 text-sm">
          ${lines
            .map(
              (l) => `<li class="break-words"><strong>${esc(l.featureName)}</strong> <span aria-hidden="true">·</span> ${esc(l.label)}:
                <span class="text-ink-500 line-through decoration-ink-400/60 dark:text-cream-300/60">${esc(l.from)}</span>
                <span aria-hidden="true">→</span><span class="sr-only"> menjadi </span> <span class="font-medium">${esc(l.to)}</span></li>`,
            )
            .join('')}
        </ul>
      </div>`;
  }

  function saveBarHtml(): string {
    if (!data || !editable()) return '';
    const n = changes().length;
    if (!n) reviewOpen = false;
    // Tab edit (Game/Social Hub) selalu menampilkan bar (tombol nonaktif bila
    // tidak ada perubahan); tab lain hanya bila ada draft yang belum disimpan.
    if (!SECTION_OF_TAB[tab] && !n && !saving) return '';
    return `
      <div class="pointer-events-none fixed bottom-28 left-3 right-3 z-30 sm:bottom-4 sm:left-1/2 sm:right-auto sm:w-[min(44rem,calc(100vw-14rem))] sm:-translate-x-1/2" data-region="savebar">
        <div class="pointer-events-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-2xl border px-3 py-2.5 shadow-lg backdrop-blur sm:px-4 sm:py-3 ${
          n ? 'border-amber-500/40 bg-cream-50/95 dark:bg-ink-900/95' : 'border-ink-900/10 bg-white/90 dark:border-cream-100/10 dark:bg-ink-900/90'
        }">
          ${reviewOpen && n ? reviewHtml() : ''}
          <p class="text-sm ${n ? 'font-medium text-amber-800 dark:text-amber-300' : 'text-ink-500 dark:text-cream-300/60'}" aria-live="polite">
            ${saving ? 'Menyimpan perubahan…' : n ? `${n} perubahan belum disimpan` : 'Tidak ada perubahan'}
          </p>
          <div class="flex flex-wrap gap-2">
            ${n ? `<button type="button" data-action="review" aria-expanded="${reviewOpen}" aria-controls="review-list" class="${BTN_SECONDARY} min-h-[44px] sm:min-h-0">${reviewOpen ? 'Tutup' : 'Tinjau'}</button>` : ''}
            <button type="button" data-action="discard" class="${BTN_SECONDARY} min-h-[44px] sm:min-h-0" ${n && !saving ? '' : 'disabled'}>Batalkan</button>
            <button type="button" data-action="save" class="${BTN_PRIMARY} min-h-[44px] sm:min-h-0" ${n && !saving ? '' : 'disabled'}>
              ${saving ? spinner() : icon('check')} Simpan<span class="hidden sm:inline"> Perubahan</span></button>
          </div>
        </div>
      </div>`;
  }

  // ─── Aksi ────────────────────────────────────────────────────────────────

  /** Mulai jendela cepat: hasil aksi ini ditunggu dari bot. */
  function watchBot(): void {
    watchStartedAt = Date.now();
    poller.kick(FAST_MS);
  }

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
        toast(`Tersimpan sebagai revisi ${res.revision}. Menunggu bot menerapkan…`, 'success');
      }
      await load(false);
      renderAll();
      if (res.changed) watchBot();
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
      watchBot();
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
    if (refreshWatch) return;
    try {
      const prev = data?.snapshot?.refreshed_at ?? null;
      const r = await requestDiscordRefresh(guildId);
      refreshWatch = { prev, until: Date.now() + REFRESH_TIMEOUT_MS, quiet };
      if (!r.bot_online && !quiet) toast('Bot sedang offline. Data channel diperbarui saat bot online.', 'warning');
      renderAll();
      watchBot();
    } catch (err) {
      toast(describeError(err instanceof DashboardError ? err.code : 'NETWORK'), 'danger');
    }
  }

  function setTab(target: Tab | Hub, focus = true): void {
    const next: Tab = target === 'server-hub' ? lastServerTab : target;
    tab = next;
    if (hubOf(next) === 'server-hub') lastServerTab = next;
    history.replaceState(null, '', `${location.pathname}${location.search}#${next}`);
    renderAll();
    if (!focus) return;
    const hub = hubOf(next);
    const el =
      target === 'server-hub' || hub !== 'server-hub'
        ? root.querySelector<HTMLElement>(`#tab-${hub}`)
        : root.querySelector<HTMLElement>(`#subtab-${next}`);
    // Sidebar tersembunyi di HP: fokus jatuh ke kategori supaya tidak hilang.
    if (el && el.offsetParent !== null) el.focus({ preventScroll: true });
    else root.querySelector<HTMLElement>(`#tab-${hub}`)?.focus({ preventScroll: true });
  }

  root.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const tabBtn = target.closest<HTMLElement>('[data-tab]');
    if (tabBtn) return setTab(tabBtn.dataset.tab as Tab | Hub);
    if (!data) {
      if (target.closest('[data-action="reload"]')) reload();
      return;
    }

    if (mods.features?.onClick(pageCtx(), target)) return;
    if (tab === 'audit-log' && mods.audit?.onClick(pageCtx(), target)) return;

    const shareBtn = target.closest<HTMLButtonElement>('[data-share-action]');
    if (shareBtn && !shareBtn.disabled && mods.share?.onClick(shareBtn)) return;

    const btn = target.closest<HTMLButtonElement>('[data-action]');
    if (!btn) return;
    switch (btn.dataset.action) {
      case 'save':
        void save();
        break;
      case 'review':
        reviewOpen = !reviewOpen;
        renderAll();
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
      case 'setup-dismiss':
        setupDismissed = true;
        try {
          localStorage.setItem(`vn-setup-hide-${guildId}`, '1');
        } catch {
          /* hanya berlaku sampai halaman ditutup */
        }
        renderAll();
        break;
      case 'module-retry':
        moduleError = false;
        renderAll();
        break;
      case 'reload':
        reload();
        break;
      case 'reload-latest':
        if (!dirty() || confirm('Perubahan yang belum disimpan akan hilang. Lanjutkan?')) {
          void load(false).then(renderAll);
        }
        break;
    }
  });

  function reload(): void {
    root.innerHTML = loadingBlock();
    void load(false).then(() => {
      renderAll();
      if (data) poller.start();
    });
  }

  root.addEventListener('input', (e) => {
    if (!data) return;
    const target = e.target as HTMLElement;
    // Formulir 📣 Share Server (draft disimpan di controller-nya).
    const shareField = target.closest<HTMLElement>('[data-share-field]');
    if (shareField) return void mods.share?.onInput(shareField);
    if (tab === 'audit-log' && mods.audit?.onInput(pageCtx(), target)) return;
    mods.features?.onInput(pageCtx(), target);
  });
  root.addEventListener('submit', (e) => {
    const form = e.target as HTMLFormElement;
    if (form.matches?.('[data-share-form]')) {
      e.preventDefault();
      mods.share?.onSubmit(form);
    }
  });
  root.addEventListener('focusout', () => setTimeout(() => mods.share?.flush(), 0));

  root.addEventListener('change', (e) => {
    if (!data) return;
    const target = e.target as HTMLElement;
    const navSelect = target.closest<HTMLSelectElement>('[data-nav-select]');
    if (navSelect) return setTab(navSelect.value as Tab, false);
    const shareField = target.closest<HTMLElement>('[data-share-field]');
    if (shareField) return void mods.share?.onInput(shareField);
    if (tab === 'audit-log' && mods.audit?.onChange(pageCtx(), target)) return;
    mods.features?.onChange(pageCtx(), target);
  });

  root.addEventListener('toggle', (e) => {
    const d = e.target as HTMLDetailsElement;
    const key = d.dataset?.keepOpen;
    if (!key) return;
    if (d.open) openDetails.add(key);
    else openDetails.delete(key);
  }, true);

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
    const next = parseTabHash(location.hash, lastServerTab);
    if (next !== tab) {
      tab = next;
      if (hubOf(next) === 'server-hub') lastServerTab = next;
      if (data) renderAll();
    }
  });

  window.addEventListener('beforeunload', (e) => {
    if (dirty()) {
      e.preventDefault();
      e.returnValue = '';
    }
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

    // Kode tab yang dibuka diunduh bersamaan dengan data, bukan sesudahnya.
    const tabReady = ensureModule(moduleOf(tab));
    await load(false);
    const loaded = current();
    if (!loaded) return renderError();
    await tabReady;
    renderAll();
    poller.start();

    // Data channel belum ada / basi → minta bot menerbitkan ulang otomatis.
    const at = Date.parse(loaded.snapshot?.refreshed_at ?? '');
    const statsStale = loaded.bot.installed && tab === 'overview' && isStatsStale(parseStatsSummary(loaded.snapshot?.stats_summary), serverNow()) && statsRefreshAllowed();
    if (loaded.bot.installed && (!Number.isFinite(at) || serverNow() - at > STALE_SNAPSHOT_MS || statsStale)) await discordRefresh(statsStale);
  })();
}
