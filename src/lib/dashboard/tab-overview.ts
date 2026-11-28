// Halaman server › Ringkasan (#overview). Dimuat malas oleh server-page.ts.
// Semua angka berasal dari data yang sudah dimuat halaman (tanpa permintaan tambahan).

import { inviteUrl, parseSecuritySummary, relativeTime } from './model';
import { overviewStatsHtml } from './overview';
import { setupSteps } from './review-model';
import { featureIssues, reinviteLinkHtml, tabOfFeature, type PageCtx } from './server-shared';
import { parseStatsSummary } from './stats-model';
import { BTN_SECONDARY, CARD, esc, icon } from './ui';

export interface OverviewOptions {
  clientId: string;
  permissions: string;
  /** Kartu langkah awal sudah ditutup admin di browser ini. */
  setupDismissed: boolean;
}

/** Langkah awal: hanya tampil selama masih ada yang belum selesai dan belum ditutup. */
function setupHtml(c: PageCtx, o: OverviewOptions): string {
  const steps = setupSteps(c.data, c.base);
  const left = steps.filter((s) => !s.done).length;
  if (!left || o.setupDismissed) return '';
  const invite = inviteUrl(o.clientId, o.permissions, c.guildId);
  const actionHtml = (s: (typeof steps)[number]): string => {
    const a = s.action;
    if (!a || s.done) return '';
    const cls = `${BTN_SECONDARY} min-h-[44px] shrink-0`;
    if (a.do === 'invite') return invite ? `<a href="${esc(invite)}" target="_blank" rel="noopener noreferrer" class="${cls}">${esc(a.label)}</a>` : '';
    if (a.do === 'discord-refresh') return `<button type="button" data-action="discord-refresh" data-focus="setup-refresh" class="${cls}">${esc(a.label)}</button>`;
    return a.tab ? `<button type="button" data-tab="${esc(a.tab)}" data-focus="setup-${esc(s.id)}" class="${cls}">${esc(a.label)}</button>` : '';
  };
  return `<section aria-labelledby="ov-setup" class="${CARD} p-4 sm:p-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <h2 id="ov-setup" class="font-display text-base font-semibold sm:text-lg">Langkah awal</h2>
        <p class="mt-0.5 text-xs text-ink-500 dark:text-cream-300/70">${steps.length - left} dari ${steps.length} selesai. Kartu ini hilang sendiri setelah semuanya beres.</p>
      </div>
      <button type="button" data-action="setup-dismiss" class="inline-flex min-h-[44px] items-center text-xs font-medium text-ink-500 underline hover:text-ink-800 dark:text-cream-300/70 dark:hover:text-cream-50">Sembunyikan</button>
    </div>
    <ol class="mt-3 divide-y divide-ink-900/5 dark:divide-cream-100/5">
      ${steps
        .map(
          (s) => `<li class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5">
            <span class="flex min-w-0 flex-1 items-start gap-2.5">
              ${
                s.done
                  ? icon('circle-check', 'mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400')
                  : '<span class="mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 border-ink-300 dark:border-cream-100/30" aria-hidden="true"></span>'
              }
              <span class="min-w-0"><span class="block text-sm font-medium ${s.done ? 'text-ink-500 dark:text-cream-300/70' : ''}">${esc(s.label)}<span class="sr-only">${s.done ? ' (selesai)' : ' (belum)'}</span></span>
              <span class="mt-0.5 block text-xs text-ink-500 dark:text-cream-300/70">${esc(s.hint)}</span></span>
            </span>
            ${actionHtml(s)}
          </li>`,
        )
        .join('')}
    </ol>
  </section>`;
}

export function panelHtml(c: PageCtx, o: OverviewOptions): string {
  const d = c.data;
  const feats = c.registry;
  const active = feats.filter((f) => c.base[f.key]?.enabled).length;
  const mapped = feats.reduce((n, f) => n + Object.values(c.base[f.key]?.channels ?? {}).filter(Boolean).length, 0);
  const tile = (label: string, value: string, sub = '', tone = '') => `
    <div class="${CARD} min-w-0 p-3 sm:p-5">
      <p class="text-xs text-ink-500 dark:text-cream-300/70">${label}</p>
      <p class="mt-1 font-display text-xl font-semibold sm:text-3xl ${tone}">${value}</p>
      ${sub ? `<p class="mt-1 hidden text-xs text-ink-500 sm:block dark:text-cream-300/60">${sub}</p>` : ''}
    </div>`;

  // Masalah konfigurasi dari pemeriksaan yang sama dengan tab fitur (tanpa data bot tambahan).
  const attention = feats.flatMap((f) => {
    const r = featureIssues(c, f);
    if (r.level !== 'warn' && r.level !== 'error') return [];
    const tabId = tabOfFeature(f);
    return r.messages.map((m) => ({ f, m, tabId }));
  });
  const reinvite = c.inviteUrl && feats.some((f) => {
    const r = featureIssues(c, f);
    return (r.level === 'warn' || r.level === 'error') && r.reinvite;
  });
  const attentionHtml = attention.length
    ? `<section aria-labelledby="ov-perhatian" class="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 sm:p-5">
        <h2 id="ov-perhatian" class="font-display text-base font-semibold text-amber-800 dark:text-amber-300">Perlu perhatian</h2>
        <ul class="mt-2 divide-y divide-amber-500/25">
          ${attention
            .map(
              ({ f, m, tabId }, i) => `<li class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5 text-sm">
            <span class="min-w-0 flex-1"><strong>${esc(f.name)}</strong> <span aria-hidden="true">·</span> ${esc(m)}</span>
            <button type="button" data-tab="${esc(tabId)}" data-focus="go-${esc(f.key)}-${i}" class="${BTN_SECONDARY} min-h-[44px] shrink-0" aria-label="Atur ${esc(f.name)}">Atur</button></li>`,
            )
            .join('')}
        </ul>
        ${
          reinvite
            ? `<div class="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-amber-500/25 pt-3 text-sm">
                <p class="min-w-0 flex-1">Sebagian masalah di atas karena role bot belum punya izin yang dibutuhkan. Undang ulang bot memakai tautan berizin lengkap: pilih server ini, tekan Authorize (Otorisasi), lalu tekan Cek lagi. Pengaturan yang sudah ada tidak hilang.</p>
                ${reinviteLinkHtml(c, `${BTN_SECONDARY} min-h-[44px] shrink-0`)}
              </div>`
            : ''
        }
      </section>`
    : '';

  const stats = parseStatsSummary(d.snapshot?.stats_summary);
  const security = parseSecuritySummary(d.snapshot?.security_summary);
  return `
    <div class="grid grid-cols-3 gap-2 sm:gap-4">
      ${tile('Status bot', d.bot.installed ? (d.bot.online ? 'Online' : 'Offline') : 'Tidak ada', d.bot.version ? `Versi ${esc(d.bot.version)}` : '', d.bot.installed && d.bot.online ? 'text-emerald-700 dark:text-emerald-400' : '')}
      ${tile('Fitur aktif', `${active}<span class="text-sm text-ink-400 sm:text-lg"> / ${feats.length}</span>`, `${mapped} channel diatur. Detail di Peta Channel`)}
      ${tile('Perlu perhatian', String(attention.length), attention.length ? 'Daftar di bawah' : 'Semuanya beres', attention.length ? 'text-amber-700 dark:text-amber-300' : '')}
    </div>
    <div class="mt-3 flex flex-col gap-3 sm:mt-4 sm:gap-4">
      ${setupHtml(c, o)}
      ${attentionHtml}
      ${overviewStatsHtml({
        stats,
        security,
        memberCount: d.guild.member_count ?? null,
        updatedAgo: stats?.updated_at ? relativeTime(stats.updated_at, c.serverNow()) : null,
        botInstalled: d.bot.installed,
      })}
    </div>`;
}
