// ════════════════════════════════════════════════════════════════════════════
// Dashboard › tab Ringkasan: kartu statistik server (HTML murni, tanpa DOM)
//
// Data dari bot (`snapshot.stats_summary` + `security_summary`), diparse
// stats-model.ts / model.ts. Aturan:
//   • Fitur belum aktif tampil sebagai kotak penjelasan + tombol ke tabnya,
//     bukan hilang (aturan setelan terkunci).
//   • Alasan terkunci (intent Server Members) berasal dari bot (`locked_note`),
//     website tidak mengarang alasan.
//   • Semua teks dari bot lewat esc(). Tanpa tanda pisah di teks pengguna.
//   • Hanya angka gabungan: tidak ada nama atau ID member di halaman ini.
// ════════════════════════════════════════════════════════════════════════════

import type { SecuritySummary } from './model';
import { dayLabel, formatCount, formatPercent, growthOf, percentOf, type StatsDay, type StatsSummary } from './stats-model';
import { CARD, esc, icon } from './ui';

const MUTED = 'text-ink-500 dark:text-cream-300/70';
const TILE = 'rounded-xl border border-ink-900/10 p-3 dark:border-cream-100/10';
const GHOST_BTN =
  'inline-flex min-h-[44px] items-center rounded-full border border-ink-900/15 px-4 text-sm font-medium text-amber-700 transition hover:bg-ink-900/5 dark:border-cream-100/15 dark:text-amber-300 dark:hover:bg-cream-100/5';

export interface OverviewStatsInput {
  stats: StatsSummary | null;
  security: SecuritySummary | null;
  /** Jumlah member dari snapshot Discord (cadangan bila ringkasan belum punya). */
  memberCount: number | null;
  /** Kata "diperbarui … lalu" siap pakai, atau null. */
  updatedAgo: string | null;
  /** Bot terpasang? Tanpa bot, ringkasan memang tidak akan terbit. */
  botInstalled: boolean;
}

function section(id: string, title: string, meta: string, body: string, cls = ''): string {
  return `<section aria-labelledby="ov-${id}" class="${CARD} min-w-0 p-4 sm:p-5 ${cls}">
    <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <h2 id="ov-${id}" class="font-display text-base font-semibold sm:text-lg">${esc(title)}</h2>
      ${meta ? `<p class="text-xs ${MUTED}">${esc(meta)}</p>` : ''}
    </div>
    ${body}
  </section>`;
}

/** Kotak penjelasan untuk bagian yang belum bisa tampil (fitur mati atau terkunci). */
function lockBox(title: string, text: string, cta: { label: string; tab: string } | null): string {
  return `<div class="mt-3 flex items-start gap-3 rounded-xl border border-dashed border-ink-900/25 bg-ink-900/[0.04] p-3.5 dark:border-cream-100/25 dark:bg-cream-100/[0.04]">
    ${icon('lock', 'mt-0.5 h-4 w-4 shrink-0 text-ink-500 dark:text-cream-300/70')}
    <div class="min-w-0">
      <p class="text-sm font-semibold">${esc(title)}</p>
      <p class="mt-1 text-xs leading-relaxed ${MUTED}">${esc(text)}</p>
      ${cta ? `<button type="button" data-tab="${esc(cta.tab)}" class="${GHOST_BTN} mt-2.5">${esc(cta.label)}</button>` : ''}
    </div>
  </div>`;
}

function stat(label: string, value: string, hint = '', tone = ''): string {
  return `<div class="min-w-0">
    <p class="text-xs ${MUTED}">${esc(label)}</p>
    <p class="mt-1 font-display text-2xl font-semibold tabular-nums sm:text-3xl ${tone}">${value}</p>
    ${hint ? `<p class="mt-0.5 text-xs ${MUTED}">${esc(hint)}</p>` : ''}
  </div>`;
}

function bar(label: string, value: number, pct: number, tone = 'bg-amber-500'): string {
  return `<li class="flex items-center gap-3 text-sm">
    <span class="w-16 shrink-0">${esc(label)}</span>
    <span class="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-ink-900/10 dark:bg-cream-100/10"><span class="block h-full rounded-full ${tone}" style="width:${Math.max(pct, value > 0 ? 2 : 0)}%"></span></span>
    <span class="w-12 shrink-0 text-right font-semibold tabular-nums">${formatCount(value)}</span>
  </li>`;
}

function activityCard(i: OverviewStatsInput): string {
  const a = i.stats?.activity ?? null;
  if (!a) {
    return section('aktivitas', 'Aktivitas member', '', lockBox(
      'Aktivitas member belum tersedia',
      'Datanya diambil dari Leveling, yang belum dinyalakan di server ini. Setelah aktif, jumlah member aktif 24 jam, 7 hari, dan 30 hari serta porsi chat dan voice muncul di sini.',
      { label: 'Atur Leveling', tab: 'leveling' },
    ), 'lg:col-span-2');
  }
  const total = i.stats?.members.total ?? i.memberCount;
  const rate7 = percentOf(a.active_7d, total);
  const base = total ?? Math.max(a.active_30d, a.active_7d, a.active_1d, 1);
  const chat = a.chat_pct;
  const split = chat == null
    ? `<p class="mt-2 text-sm ${MUTED}">Belum ada XP yang tercatat.</p>`
    : `<div role="img" aria-label="Porsi XP: chat ${chat} persen, voice ${100 - chat} persen" class="mt-2 flex h-3.5 overflow-hidden rounded-full">
         <span class="bg-amber-500" style="width:${chat}%"></span><span class="bg-teal-500" style="width:${100 - chat}%"></span>
       </div>
       <p class="mt-2 text-sm"><span class="font-semibold text-amber-700 dark:text-amber-300">Chat ${chat}%</span> <span class="${MUTED}">·</span> <span class="font-semibold text-teal-700 dark:text-teal-300">Voice ${100 - chat}%</span> <span class="${MUTED}">dari total XP server</span></p>`;
  const body = `
    <div class="mt-3 grid grid-cols-2 gap-4">
      ${stat('Total member', total == null ? 'Belum ada data' : formatCount(total))}
      ${stat('Aktif 7 hari', formatCount(a.active_7d), rate7 == null ? '' : `${rate7}% dari seluruh member`, 'text-amber-700 dark:text-amber-300')}
    </div>
    <ul class="mt-4 grid gap-2.5">
      ${bar('24 jam', a.active_1d, Math.min(100, Math.round((a.active_1d / base) * 100)))}
      ${bar('7 hari', a.active_7d, Math.min(100, Math.round((a.active_7d / base) * 100)))}
      ${bar('30 hari', a.active_30d, Math.min(100, Math.round((a.active_30d / base) * 100)))}
    </ul>
    <h3 class="mt-5 text-sm font-semibold">Chat dan voice</h3>
    ${split}
    <p class="mt-3 text-xs ${MUTED}">Dihitung dari member yang mendapat XP Leveling. Member yang diam atau yang sudah keluar mungkin belum tercermin.</p>`;
  return section('aktivitas', 'Aktivitas member', 'Sumber: Leveling', body, 'lg:col-span-2');
}

function growthChart(history: StatsDay[]): string {
  const g = growthOf(history);
  if (!g) return '';
  const sign = g.delta > 0 ? '+' : '';
  const first = history[0];
  const last = history[history.length - 1];
  return `
    <p class="mt-3 font-display text-3xl font-semibold tabular-nums">${sign}${formatCount(g.delta)} <span class="font-sans text-sm font-normal ${MUTED}">dalam ${history.length} hari${g.pct == null ? '' : ` (${g.pct > 0 ? '+' : ''}${formatPercent(g.pct)})`}</span></p>
    <svg viewBox="0 0 600 150" preserveAspectRatio="none" class="mt-3 block h-36 w-full" role="img" aria-label="Jumlah member ${history.length} hari terakhir, dari ${formatCount(g.first)} menjadi ${formatCount(g.last)}">
      <path d="${g.area}" class="fill-amber-500/15"></path>
      <path d="${g.line}" fill="none" class="stroke-amber-600 dark:stroke-amber-400" stroke-width="2.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"></path>
    </svg>
    <div class="mt-1 flex justify-between text-xs ${MUTED}"><span>${esc(first.day)} · ${formatCount(first.n)}</span><span>${esc(last.day)} · ${formatCount(last.n)}</span></div>`;
}

function growthCard(i: OverviewStatsInput): string {
  const s = i.stats;
  const total = s?.members.total ?? i.memberCount;
  const jl = s?.join_leave;
  const joinLeaveNote = jl?.locked_note ?? 'Belum bisa ditampilkan.';
  let body = '';
  let joinLeaveBox = true;
  if (s?.members.history) {
    body += growthChart(s.members.history);
  } else {
    body += `<p class="mt-3 text-xs ${MUTED}">Jumlah member</p>
      <p class="font-display text-3xl font-semibold tabular-nums">${total == null ? 'Belum ada data' : formatCount(total)}</p>`;
    const note = s?.members.history_note;
    if (note && note === joinLeaveNote) {
      // Alasan yang sama dari bot: satu kotak cukup, tidak perlu dua kali.
      body += lockBox('Riwayat pertumbuhan dan member masuk keluar', note, null);
      joinLeaveBox = false;
    } else if (note) {
      body += lockBox('Grafik pertumbuhan belum tersedia', note, null);
    }
  }
  if (joinLeaveBox) body += lockBox('Member masuk dan keluar', joinLeaveNote, null);
  return section('pertumbuhan', 'Pertumbuhan member', '', body);
}

function verifyBars(days: StatsDay[]): string {
  const max = Math.max(1, ...days.map((d) => d.n));
  const label = days.map((d) => `${dayLabel(d.day)} ${d.n}`).join(', ');
  return `<div role="img" aria-label="Lulus verifikasi per hari: ${esc(label)}" class="mt-3 flex h-24 items-end gap-2">
      ${days.map((d) => `<div class="flex h-full flex-1 flex-col items-center justify-end gap-1">
        <span class="text-[11px] tabular-nums ${MUTED}">${formatCount(d.n)}</span>
        <span class="block w-full max-w-9 rounded-t-md bg-teal-600 dark:bg-teal-500" style="height:${Math.max(4, Math.round((d.n / max) * 64))}px"></span>
      </div>`).join('')}
    </div>
    <div class="mt-1 flex gap-2">${days.map((d) => `<span class="flex-1 text-center text-[11px] ${MUTED}">${esc(dayLabel(d.day))}</span>`).join('')}</div>`;
}

function securityCard(i: OverviewStatsInput): string {
  const sec = i.security;
  const ver = i.stats?.verification ?? null;
  let body = '';

  if (sec?.enabled) {
    const t = (label: string, value: number, hint: string) => `<div class="${TILE} min-w-0 flex-1 basis-28">
      <p class="text-xs ${MUTED}">${esc(label)}</p><p class="mt-1 font-display text-2xl font-semibold tabular-nums">${formatCount(value)}</p><p class="mt-0.5 text-xs ${MUTED}">${esc(hint)}</p></div>`;
    body += `<div class="mt-3 flex flex-wrap gap-2.5">
      ${t('Kick 7 hari', sec.last7_kick, 'dari Security Center')}
      ${t('Ban 7 hari', sec.last7_ban, 'dari Security Center')}
      ${t('Menunggu kategori', sec.pending, 'belum dipilih moderator')}
    </div>`;
  } else {
    body += lockBox('Security Center belum aktif', 'Catatan kick, ban, dan kategori alasannya muncul setelah Security Center dinyalakan. Bot perlu izin Lihat Audit Log.', { label: 'Atur Security Center', tab: 'security' });
  }

  if (ver) {
    body += `<h3 class="mt-5 text-sm font-semibold">Lulus verifikasi 7 hari terakhir</h3>
      <p class="text-sm ${MUTED}">${formatCount(ver.total7)} member lulus</p>${verifyBars(ver.days)}`;
  } else {
    body += lockBox('Verification belum aktif', 'Jumlah member yang lulus verifikasi per hari muncul setelah Verification dinyalakan.', { label: 'Atur Verification', tab: 'verification' });
  }
  body += `<p class="mt-4 text-xs leading-relaxed ${MUTED}">Hanya angka gabungan. Tidak ada nama atau ID member di halaman ini.</p>`;
  return section('keamanan', 'Keamanan dan verifikasi', '', body);
}

function communityCard(i: OverviewStatsInput): string {
  const c = i.stats?.community ?? { streak: null, counting: null };
  const rows: string[] = [];
  if (c.streak) {
    rows.push(row('Peserta Streak hari ini', 'menulis kata-kata hari ini', formatCount(c.streak.today)));
    rows.push(row('Rekor Streak', 'terpanjang di server ini', `${formatCount(c.streak.best)} hari`));
  }
  if (c.counting) rows.push(row('Rekor Counting', 'hitungan tertinggi', formatCount(c.counting.record)));
  let body = rows.length ? `<ul class="mt-2 divide-y divide-ink-900/10 dark:divide-cream-100/10">${rows.join('')}</ul>` : '';
  if (!c.streak || !c.counting) {
    const missing = !c.streak && !c.counting ? 'Streak Harian dan Counting belum diatur' : !c.streak ? 'Streak Harian belum diatur' : 'Counting belum diatur';
    body += lockBox(missing, 'Pilih channel di Social Hub. Angkanya akan tampil di sini.', { label: 'Atur Social Hub', tab: 'social-hub' });
  }
  return section('komunitas', 'Komunitas', '', body);
}

function row(label: string, hint: string, value: string): string {
  return `<li class="flex items-baseline justify-between gap-3 py-3">
    <span class="min-w-0"><span class="block text-sm font-semibold">${esc(label)}</span><span class="mt-0.5 block text-xs ${MUTED}">${esc(hint)}</span></span>
    <span class="shrink-0 font-display text-xl font-semibold tabular-nums">${esc(value)}</span>
  </li>`;
}

/** Belum ada ringkasan sama sekali (bot lama, belum refresh, atau bot belum terpasang). */
function pendingCard(i: OverviewStatsInput): string {
  const text = i.botInstalled
    ? 'Ringkasan statistik belum diterbitkan bot. Biasanya muncul dalam beberapa detik setelah halaman dibuka. Tekan Refresh Discord Data bila belum muncul.'
    : 'Ringkasan muncul setelah bot ada di server ini.';
  return `<div class="${CARD} p-4 sm:p-5" role="status">
    <h2 class="font-display text-base font-semibold sm:text-lg">Statistik server</h2>
    <p class="mt-1.5 text-sm ${MUTED}">${esc(text)}</p>
  </div>`;
}

/** Kartu statistik tab Ringkasan (di bawah kartu status dan "Perlu perhatian"). */
export function overviewStatsHtml(i: OverviewStatsInput): string {
  if (!i.stats) return pendingCard(i);
  return `
    <div class="grid gap-3 sm:gap-4 lg:grid-cols-3">${activityCard(i)}${growthCard(i)}</div>
    <div class="grid gap-3 sm:gap-4 lg:grid-cols-2">${securityCard(i)}${communityCard(i)}</div>
    ${i.updatedAgo ? `<p class="text-xs ${MUTED}">Statistik diperbarui ${esc(i.updatedAgo)}. Dihitung ulang saat Ringkasan dibuka atau saat Refresh Discord Data ditekan.</p>` : ''}`;
}
