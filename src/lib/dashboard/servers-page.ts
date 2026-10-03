// /dashboard — login Discord + daftar server yang boleh dikelola.

import {
  DashboardError,
  discordLoginEnabled,
  fetchServers,
  getDashboardSupabase,
  getSession,
  isDashboardConfigured,
  linkDiscordIfNeeded,
  signInWithDiscord,
  signOut,
  type ServersResponse,
} from './api';
import { describeError, guildInitials, inviteUrl, relativeTime, STATUS_META, type SyncStatus } from './model';
import {
  BTN_DISCORD,
  BTN_PRIMARY,
  BTN_SECONDARY,
  CARD,
  esc,
  guildAvatar,
  icon,
  loadingBlock,
  pill,
  toast,
  wireAvatars,
} from './ui';

const NEXT_KEY = 'vanillate-dashboard-next';

interface PageConfig {
  root: HTMLElement;
  clientId: string;
  permissions: string;
  privacyUrl: string;
  /** Halaman produk pemilik dashboard (dashboard tidak ada di menu utama). */
  productUrl: string;
  productName: string;
}

export function mountServersPage(cfg: PageConfig): void {
  const { root } = cfg;
  let data: ServersResponse | null = null;
  let query = '';

  const redirectTo = () => `${location.origin}/dashboard/`;

  /** Tautan balik ke halaman produk — satu-satunya pintu masuk dashboard selain footer. */
  const productLink = () => `
    <a href="${esc(cfg.productUrl)}" class="inline-flex items-center gap-1.5 text-sm text-ink-600 hover:text-ink-900 dark:text-cream-300 dark:hover:text-cream-50">
      ${icon('arrow-left')} ${esc(cfg.productName)}
    </a>`;
  const serverUrl = (id: string) => `/dashboard/server/?id=${encodeURIComponent(id)}`;

  // ─── Render ──────────────────────────────────────────────────────────────

  function renderMessage(title: string, body: string, actions = ''): void {
    root.innerHTML = `
      <div class="${CARD} mx-auto max-w-xl p-8 text-center">
        <h1 class="font-display text-2xl font-semibold">${esc(title)}</h1>
        <p class="mt-3 text-sm leading-relaxed text-ink-600 dark:text-cream-300">${body}</p>
        ${actions ? `<div class="mt-6 flex flex-wrap justify-center gap-3">${actions}</div>` : ''}
      </div>`;
  }

  function renderLogin(enabled: boolean | null): void {
    const disabled = enabled === false;
    root.innerHTML = `
      <div class="mx-auto mb-8 max-w-5xl">${productLink()}</div>
      <div class="mx-auto grid max-w-5xl items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p class="eyebrow flex items-center gap-2">${icon('layout-dashboard', 'h-3.5 w-3.5')} Vanillate Dashboard</p>
          <h1 class="mt-3 font-display text-4xl font-semibold leading-tight sm:text-5xl">Atur bot Vanillate di server Discord-mu.</h1>
          <p class="mt-4 max-w-xl text-base leading-relaxed text-ink-600 dark:text-cream-300">
            Masuk dengan Discord untuk memilih fitur yang aktif dan channel tiap fitur di server tempat kamu menjadi admin.
            Perubahan disimpan di sini lalu diterapkan otomatis oleh bot — lengkap dengan status sinkronisasi.
          </p>
          <div class="mt-8 flex flex-col items-start gap-3">
            <button type="button" data-action="login" class="${BTN_DISCORD}" ${disabled ? 'disabled' : ''}>
              ${icon('discord', 'h-5 w-5')} Masuk dengan Discord
            </button>
            ${
              disabled
                ? `<p class="text-sm text-amber-800 dark:text-amber-300">Login Discord sedang disiapkan oleh tim Vanillate. Sementara itu, admin server bisa mengatur bot langsung di Discord lewat <code class="font-mono">/pengaturan</code>.</p>`
                : ''
            }
            <p data-el="login-error" class="hidden text-sm text-red-600 dark:text-red-400" role="alert"></p>
          </div>
          <p class="mt-6 max-w-xl text-xs leading-relaxed text-ink-500 dark:text-cream-300/70">
            Kami hanya meminta izin membaca profil dasar dan daftar server-mu (<span class="font-mono">identify</span>,
            <span class="font-mono">guilds</span>) untuk memastikan server mana yang boleh kamu kelola. Kami tidak bisa membaca
            pesanmu atau bertindak atas namamu. Lihat <a class="underline hover:text-amber-700 dark:hover:text-amber-300" href="${esc(cfg.privacyUrl)}">Kebijakan Privasi</a>.
          </p>
        </div>
        <ul class="${CARD} space-y-5 p-6 sm:p-8">
          ${[
            ['shield', 'Hanya server milikmu', 'Server tampil bila kamu pemiliknya atau punya izin Manage Server — diverifikasi langsung ke Discord.'],
            ['gamepad-2', 'Game Hub & Social Hub', 'Aktifkan atau matikan tiap game dan fitur sosial, lalu pilih channel khususnya.'],
            ['refresh-cw', 'Status sinkronisasi jelas', 'Lihat kapan bot sudah menerapkan perubahanmu, dan apa yang perlu diperbaiki bila gagal.'],
            ['history', 'Riwayat perubahan', 'Setiap perubahan tercatat: siapa, kapan, dan apa yang diubah.'],
          ]
            .map(
              ([ic, t, d]) => `
            <li class="flex gap-4">
              <span class="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300">${icon(ic as 'shield', 'h-5 w-5')}</span>
              <div><p class="font-medium">${t}</p><p class="mt-1 text-sm text-ink-600 dark:text-cream-300/80">${d}</p></div>
            </li>`,
            )
            .join('')}
        </ul>
      </div>`;
  }

  function statusFor(s: ServersResponse['servers'][number]): string {
    if (!s.botInstalled) return pill('Bot belum terpasang', 'neutral');
    if (!s.configured) return pill('Pengaturan bawaan', 'neutral');
    const meta = STATUS_META[(s.syncStatus as SyncStatus) ?? 'ACTIVE'] ?? STATUS_META.ACTIVE;
    return pill(meta.label, meta.tone);
  }

  function renderServers(): void {
    if (!data) return;
    const { user } = data;
    const q = query.trim().toLowerCase();
    const list = data.servers.filter((s) => !q || s.name.toLowerCase().includes(q) || s.guildId.includes(q));

    const cards = list
      .map((s) => {
        const action = s.botInstalled
          ? `<a href="${serverUrl(s.guildId)}" class="${BTN_PRIMARY} w-full">${icon('settings-2')} Kelola</a>`
          : (() => {
              const url = inviteUrl(cfg.clientId, cfg.permissions, s.guildId);
              return url
                ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer" class="${BTN_SECONDARY} w-full">${icon('plus')} Undang Bot</a>`
                : '';
            })();
        return `
        <li class="${CARD} flex flex-col gap-4 p-5">
          <div class="flex items-center gap-3">
            ${guildAvatar(s.iconUrl, guildInitials(s.name))}
            <div class="min-w-0">
              <p class="truncate font-display text-lg font-semibold" title="${esc(s.name)}">${esc(s.name)}</p>
              <p class="text-xs text-ink-500 dark:text-cream-300/70">${s.isOwner ? 'Pemilik server' : 'Admin server'}</p>
            </div>
          </div>
          <div>${statusFor(s)}</div>
          <div class="mt-auto">${action}</div>
        </li>`;
      })
      .join('');

    root.innerHTML = `
      <div class="mb-6">${productLink()}</div>
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          ${
            user.avatar
              ? `<img src="${esc(user.avatar)}" alt="" class="h-11 w-11 rounded-full ring-1 ring-ink-900/10 dark:ring-cream-100/10" />`
              : `<span class="inline-flex h-11 w-11 items-center justify-center rounded-full bg-amber-500/20">${icon('user', 'h-5 w-5')}</span>`
          }
          <div>
            <p class="eyebrow flex items-center gap-2">${icon('layout-dashboard', 'h-3.5 w-3.5')} Vanillate Dashboard</p>
            <h1 class="font-display text-2xl font-semibold">Halo, ${esc(user.name)}</h1>
          </div>
        </div>
        <div class="flex gap-2">
          <button type="button" data-action="refresh" class="${BTN_SECONDARY}">${icon('refresh-cw')} Segarkan</button>
          <button type="button" data-action="logout" class="${BTN_SECONDARY}">${icon('log-out')} Keluar</button>
        </div>
      </div>
      <p class="mt-6 text-sm text-ink-600 dark:text-cream-300">
        Pilih server yang ingin kamu atur. Hanya server tempat kamu pemilik, Administrator, atau punya izin
        <strong>Manage Server</strong> yang tampil di sini.
      </p>
      ${
        data.servers.length > 6
          ? `<label class="mt-5 flex max-w-sm items-center gap-2 rounded-full border border-ink-900/10 bg-white/60 px-4 py-2 dark:border-cream-100/10 dark:bg-ink-900/40">
              ${icon('search', 'h-4 w-4 text-ink-400')}
              <span class="sr-only">Cari server</span>
              <input data-el="search" type="search" value="${esc(query)}" placeholder="Cari nama atau ID server…" class="w-full bg-transparent text-sm outline-none" />
            </label>`
          : ''
      }
      ${
        data.servers.length === 0
          ? `<div class="${CARD} mt-8 p-8 text-center text-sm text-ink-600 dark:text-cream-300">
               Belum ada server yang bisa kamu kelola. Kamu perlu menjadi pemilik server atau punya izin <strong>Manage Server</strong>.
               Sudah punya? Tekan <strong>Segarkan</strong>.
             </div>`
          : list.length === 0
            ? `<p class="mt-8 text-sm text-ink-500">Tidak ada server yang cocok dengan “${esc(query)}”.</p>`
            : `<ul class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">${cards}</ul>`
      }
      <p class="mt-8 text-xs text-ink-500 dark:text-cream-300/60">
        Daftar diverifikasi ke Discord ${esc(relativeTime(data.synced_at))}${data.cached ? ' (tersimpan sementara)' : ''}.
        Bot belum ada di server? Tekan <strong>Undang Bot</strong>, lalu kembali ke sini.
      </p>`;
    wireAvatars(root);
    const search = root.querySelector<HTMLInputElement>('[data-el="search"]');
    search?.addEventListener('input', () => {
      query = search.value;
      const pos = search.selectionStart;
      renderServers();
      const again = root.querySelector<HTMLInputElement>('[data-el="search"]');
      again?.focus();
      if (pos !== null) again?.setSelectionRange(pos, pos);
    });
  }

  function renderRelogin(message: string): void {
    renderMessage(
      'Hubungkan ulang Discord',
      esc(message),
      `<button type="button" data-action="relogin" class="${BTN_DISCORD}">${icon('discord', 'h-5 w-5')} Hubungkan Discord</button>
       <button type="button" data-action="logout" class="${BTN_SECONDARY}">${icon('log-out')} Keluar</button>`,
    );
  }

  // ─── Alur ────────────────────────────────────────────────────────────────

  async function load(force = false): Promise<void> {
    try {
      data = await fetchServers(force);
      renderServers();
    } catch (err) {
      handleError(err);
    }
  }

  function handleError(err: unknown): void {
    const code = err instanceof DashboardError ? err.code : 'NETWORK';
    if (code === 'DISCORD_RELOGIN' || code === 'TOKEN_MISMATCH') return renderRelogin(describeError(code));
    if (code === 'NOT_AUTHENTICATED' || code === 'NO_DISCORD_IDENTITY') {
      void signOut().then(() => start());
      return;
    }
    renderMessage(
      'Gagal memuat server',
      esc(describeError(code, err instanceof DashboardError ? err.detail : null)),
      `<button type="button" data-action="retry" class="${BTN_PRIMARY}">${icon('refresh-cw')} Coba lagi</button>`,
    );
  }

  async function start(): Promise<void> {
    root.innerHTML = loadingBlock();
    if (!isDashboardConfigured) {
      renderMessage('Dashboard belum aktif', 'Koneksi ke Supabase belum dikonfigurasi pada build ini.');
      return;
    }
    // Baca hasil redirect OAuth sebelum URL dibersihkan. Klien Supabase
    // menukar ?code= menjadi sesi saat diinisialisasi (getSession menunggunya).
    const params = new URLSearchParams(`${location.search.slice(1)}&${location.hash.slice(1)}`);
    const oauthError = params.get('error_description') || params.get('error');
    getDashboardSupabase();
    const session = await getSession();
    if (params.has('code') || oauthError) history.replaceState(null, '', location.pathname);
    if (!session) {
      renderLogin(await discordLoginEnabled());
      if (oauthError) {
        const el = root.querySelector('[data-el="login-error"]');
        if (el) {
          el.textContent = /denied|cancel/i.test(oauthError)
            ? 'Login Discord dibatalkan. Tekan tombol di atas untuk mencoba lagi.'
            : `Login Discord gagal: ${oauthError}`;
          el.classList.remove('hidden');
        }
      }
      return;
    }

    try {
      const linked = await linkDiscordIfNeeded(session);
      const next = sessionStorage.getItem(NEXT_KEY);
      if (linked && next && next.startsWith('/dashboard/')) {
        sessionStorage.removeItem(NEXT_KEY);
        location.replace(next);
        return;
      }
      if (linked) {
        data = linked;
        renderServers();
        return;
      }
    } catch (err) {
      handleError(err);
      return;
    }
    await load();
  }

  root.addEventListener('click', async (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'login' || action === 'relogin') {
      btn.disabled = true;
      try {
        await signInWithDiscord(redirectTo(), action === 'relogin');
      } catch {
        btn.disabled = false;
        const el = root.querySelector('[data-el="login-error"]');
        if (el) {
          el.textContent = 'Gagal membuka login Discord. Coba lagi.';
          el.classList.remove('hidden');
        } else toast('Gagal membuka login Discord. Coba lagi.', 'danger');
      }
    } else if (action === 'logout') {
      await signOut();
      data = null;
      renderLogin(await discordLoginEnabled());
    } else if (action === 'refresh') {
      btn.disabled = true;
      btn.innerHTML = `${icon('refresh-cw', 'h-4 w-4 animate-spin')} Menyegarkan…`;
      await load(true);
      toast('Daftar server diperbarui dari Discord.', 'success');
    } else if (action === 'retry') {
      root.innerHTML = loadingBlock();
      await load(true);
    }
  });

  void start();
}

/** Dipakai halaman server: simpan tujuan lalu arahkan ke login. */
export function rememberNextAndGoToLogin(next: string): void {
  try {
    sessionStorage.setItem(NEXT_KEY, next);
  } catch {
    /* mode privat: abaikan */
  }
  location.replace('/dashboard/');
}
