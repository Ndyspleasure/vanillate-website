// Pratinjau iklan partner bergaya pesan Discord. Dipakai dashboard partner dan
// halaman CMS Pesanan Partner. Semua teks lewat esc() / discordMarkdownHtml()
// (sudah escape). URL hanya https (divalidasi RPC dan model).

import { esc } from '../admin-ui.ts';
import { discordMarkdownHtml } from '../dev-panel/discord-md.ts';
import type { AdButton } from './model.ts';

export interface AdParts {
  title?: string | null;
  text?: string | null;
  footer?: string | null;
  imageUrl?: string | null;
  buttons?: AdButton[] | null;
}

const httpsOnly = (u: string | null | undefined): string => (u && /^https:\/\/[^\s]+$/.test(u) ? u : '');

/** Kotak gelap ala Discord berisi judul, isi, gambar, footer, dan tombol. */
export function adPreviewHtml(p: AdParts, emptyHint = 'Iklan akan tampil di sini.'): string {
  const title = (p.title ?? '').trim();
  const text = (p.text ?? '').trim();
  const footer = (p.footer ?? '').trim();
  const image = httpsOnly(p.imageUrl?.trim());
  const buttons = (p.buttons ?? []).filter((b) => b.label.trim() && httpsOnly(b.url.trim()));
  if (!title && !text && !footer && !image && buttons.length === 0) {
    return `<span class="opacity-60">${esc(emptyHint)}</span>`;
  }
  return [
    title ? `<p class="text-base font-bold text-white">${esc(title)}</p>` : '',
    text ? `<div class="${title ? 'mt-1' : ''}">${discordMarkdownHtml(text)}</div>` : '',
    image ? `<img src="${esc(image)}" alt="" loading="lazy" referrerpolicy="no-referrer" class="mt-3 max-h-56 rounded-lg" />` : '',
    footer ? `<p class="mt-3 text-xs text-[#949ba4]">${esc(footer)}</p>` : '',
    buttons.length
      ? `<div class="mt-3 flex flex-wrap gap-2">${buttons
          .map((b) => `<span class="inline-flex items-center gap-1 rounded bg-[#4e5058] px-3 py-1.5 text-xs font-medium text-white" title="${esc(b.url.trim())}">${esc(b.label.trim())}</span>`)
          .join('')}</div>`
      : '',
  ].join('');
}
