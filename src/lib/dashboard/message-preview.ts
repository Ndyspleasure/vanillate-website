// Preview kartu pesan bot (Discord Components V2) di Vanillate Dashboard.
//
// Menggambar perkiraan tampilan kartu dari DRAFT setelan (belum disimpan), supaya
// admin melihat hasilnya sebelum menekan Simpan. Teks & warna bawaan berasal dari
// `placeholder` di schema yang diterbitkan bot. Variabel diganti data contoh.
// Semua teks lewat esc(); warna hanya lolos bila #RRGGBB.

import type { GuideRow, SettingProp } from './model';

export interface PreviewContext {
  guildName: string;
  guildIconUrl: string | null;
  viewerName: string;
  /** Nama channel (tanpa #) dari snapshot Discord; kosong bila tidak ditemukan. */
  channelName: (id: string) => string | null;
}

type Settings = Record<string, unknown>;

/** Escape HTML (sama dengan esc() di admin-ui; salinan kecil agar modul ini bisa dites tanpa bundler). */
function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const COLOR = /^#[0-9a-fA-F]{6}$/;
const SAMPLE = (c: PreviewContext): Record<string, string> => ({
  server: c.guildName, user: c.viewerName, tag: `@${c.viewerName}`, level: '5', xp: '1.250', kategori: 'Chat',
  role: '@Member', number: '1417', steps: '3', need: '3', detik: '30', cooldown: '30', benar: '3', total: '3',
});

/** Jenis pesan sebuah kelompok setelan, dari kunci `{jenis}_thumb`; null bila tidak ada. */
export function previewKind(props: SettingProp[]): string | null {
  const t = props.find((p) => p.key.endsWith('_thumb'));
  return t ? t.key.slice(0, -'_thumb'.length) : null;
}

function fill(text: string, vars: Record<string, string>): string {
  return text.replace(/\{([a-z]+)\}/gi, (m, n: string) => vars[n.toLowerCase()] ?? m);
}

/** Markdown Discord paling dasar (tebal, baris baru) setelah di-escape. */
function md(text: string): string {
  return esc(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

export function previewHtml(props: SettingProp[], settings: Settings, ctx: PreviewContext): string {
  const kind = previewKind(props);
  if (!kind) return '';
  const by = (suffix: string) => props.find((p) => p.key === `${kind}_${suffix}`);
  const val = (key: string) => str(settings[key]).trim();
  const vars = SAMPLE(ctx);

  const titleProp = props.find((p) => p.key === `${kind}_title`);
  const descProp = props.find((p) => p.key === `${kind}_description` || (kind === 'levelup' && p.key === 'levelup_message'));
  const title = titleProp ? val(titleProp.key) || titleProp.placeholder || '' : '';
  let description = descProp ? val(descProp.key) || descProp.placeholder || '' : '';
  if (kind === 'rank') description = '💬 **Chat** · Level 5 · 1.250 XP\n▰▰▰▰▰▱▱▱▱▱ 50%\nPeringkat #3';

  const guide = (Array.isArray(settings[`${kind}_guide`]) ? (settings[`${kind}_guide`] as GuideRow[]) : [])
    .filter((r) => r && r.channel_id)
    .map((r) => {
      const name = ctx.channelName(r.channel_id);
      const chip = `<span class="rounded bg-[#3c4270] px-1 text-[#c9cdfb]">#${esc(name ?? 'channel')}</span>`;
      return `<div>✧ ${chip}${r.text ? ` · ${esc(r.text)}` : ''}</div>`;
    });

  const colorRaw = val(`${kind}_color`);
  const color = COLOR.test(colorRaw) ? colorRaw : COLOR.test(by('color')?.placeholder ?? '') ? (by('color')!.placeholder as string) : '#5865f2';
  const thumbKey = val(`${kind}_thumb`) || String(by('thumb')?.default ?? 'none');
  const footer = val(`${kind}_footer`) || by('footer')?.placeholder || '';
  const greeting = val(`${kind}_greeting`);

  const avatar = (round: boolean) => {
    const cls = `h-14 w-14 shrink-0 object-cover ${round ? 'rounded-full' : 'rounded-lg'}`;
    if (thumbKey === 'server') {
      return ctx.guildIconUrl
        ? `<img src="${esc(ctx.guildIconUrl)}" alt="" class="${cls}" />`
        : `<span class="${cls} inline-flex items-center justify-center bg-[#5865f2] text-lg font-bold text-white">${esc(ctx.guildName.slice(0, 1).toUpperCase())}</span>`;
    }
    return `<span class="${cls} inline-flex items-center justify-center bg-[#4e5058] text-lg font-bold text-white">${esc(ctx.viewerName.slice(0, 1).toUpperCase())}</span>`;
  };

  const button = kind === 'panel'
    ? `<span class="mt-3 inline-block rounded bg-[#248046] px-3 py-1 text-xs font-semibold text-white">✅ ${esc(fill(val('panel_button') || by('button')?.placeholder || 'Verifikasi', vars))}</span>`
    : kind === 'info'
      ? `<span class="mt-3 inline-block rounded bg-[#248046] px-3 py-1 text-xs font-semibold text-white">Verifikasi Sekarang</span>`
      : '';

  const titleText = title ? `${kind === 'panel' ? '✅ ' : ''}${fill(title, vars)}` : '';
  return `
    <div class="rounded-xl bg-[#313338] p-3 text-[#dbdee1]" data-preview-kind="${esc(kind)}">
      <p class="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[#949ba4]">Preview dengan data contoh</p>
      ${greeting ? `<p class="mb-2 text-sm">${md(fill(greeting, vars))}</p>` : ''}
      <div class="rounded-lg bg-[#2b2d31] p-3" style="border-left:4px solid ${COLOR.test(color) ? color : '#5865f2'}">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 text-sm">
            ${titleText ? `<p class="font-semibold text-white">${md(titleText)}</p>` : ''}
            ${description ? `<p class="mt-1 break-words text-[#dbdee1]">${md(fill(description, vars))}</p>` : ''}
            ${guide.length ? `<div class="mt-2 space-y-0.5">${guide.join('')}</div>` : ''}
            ${button}
          </div>
          ${thumbKey !== 'none' ? avatar(thumbKey === 'member') : ''}
        </div>
        <div class="mt-3 border-t border-white/10 pt-2 text-[11px] text-[#949ba4]">
          ${footer ? `<p>${esc(fill(footer, vars))}</p>` : ''}
          <p>Made by Vanillate | https://vanillate.id/dashboard</p>
        </div>
      </div>
    </div>`;
}
