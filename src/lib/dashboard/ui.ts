// Helper tampilan Vanillate Dashboard (berjalan di browser).
//
// Semua teks yang berasal dari Discord (nama server, channel, user) diketik
// orang luar → WAJIB lewat esc() sebelum masuk innerHTML.

import { icons, type IconName } from '@data/icons';
import { esc } from '../admin-ui';
import type { Tone } from './model';

export { esc };

export function icon(name: IconName, cls = 'h-4 w-4'): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${cls}" aria-hidden="true" focusable="false">${icons[name]}</svg>`;
}

export const TONE: Record<Tone, string> = {
  success: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-emerald-500/30',
  warning: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 ring-amber-500/30',
  danger: 'bg-red-500/15 text-red-700 dark:text-red-300 ring-red-500/30',
  info: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 ring-sky-500/30',
  neutral: 'bg-ink-500/10 text-ink-600 dark:text-cream-300 ring-ink-500/20',
};

const TONE_DOT: Record<Tone, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  info: 'bg-sky-500',
  neutral: 'bg-ink-400',
};

/** Badge status: titik warna + TEKS (status tidak pernah hanya warna). */
export function pill(label: string, tone: Tone, extra = ''): string {
  return `<span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${TONE[tone]} ${extra}">
    <span class="h-1.5 w-1.5 rounded-full ${TONE_DOT[tone]}" aria-hidden="true"></span>${esc(label)}</span>`;
}

export const CARD =
  'rounded-2xl border border-ink-900/10 bg-white/70 shadow-sm backdrop-blur dark:border-cream-100/10 dark:bg-ink-900/60';

export const BTN_PRIMARY =
  'inline-flex items-center justify-center gap-2 rounded-full bg-amber-500 px-5 py-2.5 text-sm font-semibold text-ink-950 shadow-sm transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50';

export const BTN_SECONDARY =
  'inline-flex items-center justify-center gap-2 rounded-full border border-ink-900/15 px-4 py-2 text-sm font-medium text-ink-800 transition hover:bg-ink-900/5 disabled:cursor-not-allowed disabled:opacity-50 dark:border-cream-100/15 dark:text-cream-100 dark:hover:bg-cream-100/5';

export const BTN_DISCORD =
  'inline-flex items-center justify-center gap-2.5 rounded-full bg-[#5865F2] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#4752C4] disabled:cursor-not-allowed disabled:opacity-50';

export function spinner(cls = 'h-4 w-4'): string {
  return `<span class="${cls} inline-block animate-spin rounded-full border-2 border-current border-t-transparent opacity-70" aria-hidden="true"></span>`;
}

export function loadingBlock(text = 'Memuat…'): string {
  return `<div class="flex items-center justify-center gap-3 py-20 text-sm text-ink-500 dark:text-cream-300/70" role="status">
    ${spinner('h-5 w-5 text-amber-500')}<span>${esc(text)}</span></div>`;
}

/** Notifikasi singkat di pojok layar (aria-live). */
export function toast(message: string, tone: Tone = 'info', ms = 4200): void {
  let host = document.getElementById('dash-toasts');
  if (!host) {
    host = document.createElement('div');
    host.id = 'dash-toasts';
    host.setAttribute('aria-live', 'polite');
    host.className = 'pointer-events-none fixed inset-x-0 top-20 z-50 flex flex-col items-center gap-2 px-4';
    document.body.appendChild(host);
  }
  const el = document.createElement('div');
  el.className = `pointer-events-auto max-w-md rounded-xl px-4 py-3 text-sm shadow-lg ring-1 ring-inset backdrop-blur ${TONE[tone]} bg-white/90 dark:bg-ink-900/90`;
  el.textContent = message;
  host.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

const AVATAR_FALLBACK =
  'shrink-0 rounded-2xl bg-amber-500/20 text-amber-800 dark:text-amber-300 inline-flex items-center justify-center font-display font-semibold';

/** Ikon server, atau inisial bila tidak ada / gagal dimuat (lihat wireAvatars). */
export function guildAvatar(iconUrl: string | null, initials: string, size = 'h-12 w-12 text-base'): string {
  const fallback = `<span class="${size} ${AVATAR_FALLBACK}" aria-hidden="true">${esc(initials)}</span>`;
  if (!iconUrl) return fallback;
  return `<img src="${esc(iconUrl)}" alt="" loading="lazy" data-avatar-size="${esc(size)}" data-avatar-initials="${esc(initials)}" class="${size} shrink-0 rounded-2xl object-cover ring-1 ring-ink-900/10 dark:ring-cream-100/10" />`;
}

/** Pasang fallback inisial untuk ikon yang gagal dimuat (tanpa handler inline). */
export function wireAvatars(root: ParentNode): void {
  root.querySelectorAll<HTMLImageElement>('img[data-avatar-initials]').forEach((img) => {
    const swap = () => {
      const span = document.createElement('span');
      span.className = `${img.dataset.avatarSize ?? ''} ${AVATAR_FALLBACK}`;
      span.setAttribute('aria-hidden', 'true');
      span.textContent = img.dataset.avatarInitials ?? '?';
      img.replaceWith(span);
    };
    if (img.complete && img.naturalWidth === 0) swap();
    else img.addEventListener('error', swap, { once: true });
  });
}
