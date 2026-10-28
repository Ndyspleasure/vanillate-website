// ─────────────────────────────────────────────────────────────────────────────
// RENDERER MARKDOWN ARTIKEL BLOG
//
// Isi artikel disimpan sebagai Markdown di Sanity dan dirender DUA kali dengan
// fungsi yang sama: saat build (halaman /blog/<slug>) dan di pratinjau CMS
// (/admin/blog/tulis). Karena itu modul ini murni — tanpa alias impor, tanpa
// import.meta.env — supaya pratinjau persis sama dengan hasil tayang dan bisa
// diuji dengan `node --test`.
//
// Keamanan sama dengan renderer FAQ (src/utils/markdown.ts): semua teks
// di-escape lebih dulu, hanya konstruksi yang didukung yang menjadi tag, dan
// URL selain http(s)/path internal/mailto/#anchor dibuang.
//
// Yang didukung:
//   # / ## Judul        → <h2 id>   (# diturunkan: <h1> milik judul artikel)
//   ### Judul           → <h3 id>
//   #### Judul          → <h4>
//   paragraf, - list, 1. list, > kutipan, ```kode```, ---, | tabel |
//   > [!TIP] / [!INFO] / [!PENTING] teks   → kotak sorotan
//   ![alt](url "keterangan")  di baris sendiri → <figure> + <figcaption>
//   **tebal**, *miring*, `kode`, [teks](url)
//   {{produk:slug}}     → kartu produk (lewat opsi `blockToken`)
//
// Gambar dari cdn.sanity.io otomatis diberi srcset + format modern (WebP/AVIF)
// dan width/height (dibaca dari nama file aset) supaya tidak terjadi layout shift.
// ─────────────────────────────────────────────────────────────────────────────

export interface Heading {
  id: string;
  text: string;
  level: 2 | 3;
}

export interface RenderOptions {
  /** Token blok `{{nama:argumen}}` → HTML aman, atau null bila tidak dikenal. */
  blockToken?: (name: string, arg: string) => string | null;
  /** Ubah path internal (mis. menambah `base`). Default: apa adanya. */
  internalUrl?: (path: string) => string;
}

export interface RenderResult {
  html: string;
  headings: Heading[];
}

const C = {
  h2: 'font-display text-2xl md:text-[1.75rem] font-semibold tracking-tightest text-ink-900 dark:text-cream-50 mt-12 mb-4 scroll-mt-24',
  h3: 'font-display text-xl font-semibold tracking-tightest text-ink-900 dark:text-cream-50 mt-9 mb-3 scroll-mt-24',
  h4: 'font-display text-base font-semibold tracking-tightest text-ink-900 dark:text-cream-50 mt-7 mb-2',
  p: 'text-[1.0625rem] text-ink-700 dark:text-cream-200 leading-[1.8] mb-5',
  ul: 'mb-5 space-y-2 pl-1',
  ol: 'mb-5 space-y-2 pl-1',
  li: 'flex gap-3 text-[1.0625rem] text-ink-700 dark:text-cream-200 leading-[1.75]',
  marker: 'text-amber-600 dark:text-amber-500 font-mono text-sm mt-1.5 flex-none',
  link: 'text-amber-700 dark:text-amber-400 underline underline-offset-[3px] decoration-amber-500/40 hover:decoration-amber-500 transition-colors',
  quote: 'mb-6 border-l-2 border-amber-500 pl-5 py-1 text-lg italic text-ink-700 dark:text-cream-200 leading-relaxed',
  pre: 'mb-6 overflow-x-auto rounded-xl border border-ink-900/10 dark:border-cream-100/10 bg-cream-100/60 dark:bg-ink-900/60 p-4 text-sm leading-relaxed',
  code: 'font-mono text-[0.85em] text-amber-700 dark:text-amber-400 bg-cream-100 dark:bg-ink-900 px-1.5 py-0.5 rounded',
  tableWrap: 'mb-6 overflow-x-auto rounded-xl border border-ink-900/10 dark:border-cream-100/10',
  th: 'px-4 py-3 text-left font-semibold text-ink-900 dark:text-cream-50 whitespace-nowrap',
  td: 'px-4 py-3 text-ink-700 dark:text-cream-200 align-top',
  figure: 'my-8',
  img: 'w-full h-auto rounded-2xl border border-ink-900/10 dark:border-cream-100/10 bg-cream-100 dark:bg-ink-900',
  imgInline: 'inline-block max-w-full h-auto rounded-lg',
  caption: 'mt-3 text-center text-sm text-ink-500 dark:text-cream-300/60',
  strong: 'font-semibold text-ink-900 dark:text-cream-50',
  hr: 'my-10 border-ink-900/10 dark:border-cream-100/10',
};

const CALLOUT: Record<string, { label: string; cls: string }> = {
  tip: { label: 'Tips', cls: 'border-teal-500/40 bg-teal-500/5' },
  info: { label: 'Info', cls: 'border-ink-900/15 dark:border-cream-100/15 bg-cream-100/50 dark:bg-ink-900/50' },
  penting: { label: 'Penting', cls: 'border-amber-500/50 bg-amber-500/10' },
  warning: { label: 'Penting', cls: 'border-amber-500/50 bg-amber-500/10' },
  note: { label: 'Catatan', cls: 'border-ink-900/15 dark:border-cream-100/15 bg-cream-100/50 dark:bg-ink-900/50' },
};

export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Slug dari teks bebas: huruf kecil, angka, tanda hubung. Dipakai heading, tag, slug. */
export function slugify(text: string, max = 80): string {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' dan ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '');
}

// ─── Gambar Sanity ───────────────────────────────────────────────────────────

const SANITY_CDN = /^https:\/\/cdn\.sanity\.io\/images\/[a-z0-9]+\/[a-z0-9_-]+\/[a-f0-9]+-(\d+)x(\d+)\.[a-z]+/i;

/** Lebar & tinggi asli aset Sanity, dibaca dari nama filenya. */
export function sanityImageSize(src: string): { width: number; height: number } | null {
  const m = String(src ?? '').match(SANITY_CDN);
  return m ? { width: Number(m[1]), height: Number(m[2]) } : null;
}

export function isSanityImage(src: string): boolean {
  return SANITY_CDN.test(String(src ?? ''));
}

/**
 * URL gambar Sanity dengan transformasi CDN. `auto=format` mengirim WebP/AVIF
 * ke browser yang mendukung; `fit=max` tidak pernah memperbesar gambar kecil.
 */
export function sanityImageUrl(
  src: string,
  opts: { w?: number; h?: number; fit?: 'max' | 'crop'; q?: number; fm?: 'jpg' | 'png' } = {},
): string {
  if (!isSanityImage(src)) return src;
  const base = src.split('?')[0];
  const p = new URLSearchParams();
  if (opts.w) p.set('w', String(Math.round(opts.w)));
  if (opts.h) p.set('h', String(Math.round(opts.h)));
  p.set('fit', opts.fit ?? 'max');
  if (opts.fit === 'crop') p.set('crop', 'entropy');
  p.set('q', String(opts.q ?? 80));
  // Kartu share (OG) & RSS butuh format pasti; selain itu biarkan CDN memilih WebP/AVIF.
  if (opts.fm) p.set('fm', opts.fm);
  else p.set('auto', 'format');
  return `${base}?${p.toString()}`;
}

export const IMAGE_WIDTHS = [480, 800, 1200, 1600];

/** srcset untuk aset Sanity; lebar di atas ukuran asli dilewati. */
export function sanitySrcset(src: string, widths = IMAGE_WIDTHS): string {
  const size = sanityImageSize(src);
  const list = widths.filter((w) => !size || w <= size.width);
  if (size && (list.length === 0 || list[list.length - 1] < size.width)) list.push(Math.min(size.width, 2000));
  return list.map((w) => `${sanityImageUrl(src, { w })} ${w}w`).join(', ');
}

// ─── URL & inline ────────────────────────────────────────────────────────────

function safeUrl(raw: string, internal: (p: string) => string): string | null {
  const u = raw.trim().replace(/&amp;/g, '&');
  if (!u) return null;
  if (/^https?:\/\//i.test(u) || /^mailto:/i.test(u)) return escapeHtml(u);
  if (u.startsWith('#')) return escapeHtml(u);
  if (u.startsWith('/') && !u.startsWith('//')) return escapeHtml(internal(u));
  return null;
}

function imgTag(src: string, alt: string, cls: string, eager = false): string {
  const loading = eager ? 'eager' : 'lazy';
  if (!isSanityImage(src.replace(/&amp;/g, '&'))) {
    return `<img src="${src}" alt="${alt}" class="${cls}" loading="${loading}" decoding="async" />`;
  }
  const raw = src.replace(/&amp;/g, '&');
  const size = sanityImageSize(raw);
  const dim = size ? ` width="${size.width}" height="${size.height}"` : '';
  return `<img src="${escapeHtml(sanityImageUrl(raw, { w: 1200 }))}" srcset="${escapeHtml(sanitySrcset(raw))}" sizes="(min-width: 768px) 720px, 100vw" alt="${alt}"${dim} class="${cls}" loading="${loading}" decoding="async" />`;
}

/** Format inline pada teks yang SUDAH di-escape. */
function inline(escaped: string, internal: (p: string) => string): string {
  // Kode, gambar, dan tautan yang sudah jadi tag disimpan di placeholder supaya
  // penanda tebal/miring tidak pernah menyusup ke dalam atribut href/src.
  const simpanan: string[] = [];
  const simpan = (html: string) => {
    simpanan.push(html);
    return `\u0000${simpanan.length - 1}\u0000`;
  };
  const tekanan = (s: string) => s
    .replace(/\*\*([^*]+)\*\*/g, `<strong class="${C.strong}">$1</strong>`)
    .replace(/(^|[^*\w])\*([^*\s][^*]*?)\*/g, '$1<em>$2</em>')
    .replace(/(^|[^_\w])_([^_\s][^_]*?)_(?!\w)/g, '$1<em>$2</em>');

  const s = escaped
    .replace(/`([^`]+)`/g, (_, isi) => simpan(`<code class="${C.code}">${isi}</code>`))
    .replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;[^)]*&quot;)?\)/g, (_, alt, href) => {
      const u = safeUrl(href, internal);
      return u ? simpan(imgTag(u, alt, C.imgInline)) : alt;
    })
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, teks, href) => {
      const u = safeUrl(href, internal);
      if (!u) return teks;
      const luar = /^https?:\/\//i.test(u) && !/^https?:\/\/(www\.)?vanillate\.id(\/|$)/i.test(u);
      const atribut = luar ? ' target="_blank" rel="noopener"' : '';
      return simpan(`<a href="${u}" class="${C.link}"${atribut}>${tekanan(teks)}</a>`);
    });
  // Placeholder bisa bersarang (kode di dalam teks tautan), jadi pulihkan berulang.
  let out = tekanan(s);
  for (let n = 0; n < 3 && out.includes('\u0000'); n++) {
    out = out.replace(/\u0000(\d+)\u0000/g, (_, i) => simpanan[Number(i)] ?? '');
  }
  return out;
}

function selBaris(baris: string): string[] {
  return baris.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((s) => s.trim());
}

const PEMISAH_TABEL = /^\s*\|?[\s:|-]+\|[\s:|-]*$/;
const MULAI_BLOK = /^(#{1,6}\s|[-*+]\s|\d+[.)]\s|>|```|\|)/;
const GARIS = /^(-{3,}|_{3,}|\*{3,})$/;
const TOKEN = /^\{\{\s*([a-z-]+)\s*:\s*([a-z0-9/_-]+)\s*\}\}$/i;
const GAMBAR_SENDIRI = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)$/;

/** Teks polos dari heading (tanpa penanda markdown) untuk id & daftar isi. */
function teksPolos(s: string): string {
  return s
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '')
    .trim();
}

/** Ubah Markdown artikel menjadi HTML aman untuk `set:html` + daftar heading. */
export function renderBlogMarkdown(source: string, opts: RenderOptions = {}): RenderResult {
  const internal = opts.internalUrl ?? ((p: string) => p);
  const baris = String(source ?? '').replace(/\u0000/g, '').replace(/\r\n?/g, '\n').split('\n');
  const keluar: string[] = [];
  const headings: Heading[] = [];
  const idDipakai = new Map<string, number>();
  let i = 0;

  const idUnik = (teks: string): string => {
    const dasar = slugify(teks, 60) || 'bagian';
    const n = idDipakai.get(dasar) ?? 0;
    idDipakai.set(dasar, n + 1);
    return n === 0 ? dasar : `${dasar}-${n + 1}`;
  };

  while (i < baris.length) {
    const teks = baris[i].trim();

    if (!teks) { i++; continue; }

    const token = teks.match(TOKEN);
    if (token && opts.blockToken) {
      const html = opts.blockToken(token[1].toLowerCase(), token[2]);
      if (html !== null) { keluar.push(html); i++; continue; }
    }

    if (teks.startsWith('```')) {
      const isi: string[] = [];
      i++;
      while (i < baris.length && !baris[i].trim().startsWith('```')) { isi.push(baris[i]); i++; }
      i++;
      keluar.push(`<pre class="${C.pre}"><code class="font-mono">${escapeHtml(isi.join('\n'))}</code></pre>`);
      continue;
    }

    if (GARIS.test(teks)) {
      keluar.push(`<hr class="${C.hr}" />`);
      i++;
      continue;
    }

    const heading = teks.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const isi = heading[2].replace(/\s+#+\s*$/, '').trim();
      const lvl = heading[1].length;
      const dalam = inline(escapeHtml(isi), internal);
      if (lvl <= 3) {
        const level = lvl <= 2 ? 2 : 3;
        const polos = teksPolos(isi);
        const id = idUnik(polos);
        headings.push({ id, text: polos, level });
        keluar.push(`<h${level} id="${id}" class="${level === 2 ? C.h2 : C.h3}">${dalam}</h${level}>`);
      } else {
        keluar.push(`<h4 class="${C.h4}">${dalam}</h4>`);
      }
      i++;
      continue;
    }

    const gambar = teks.match(GAMBAR_SENDIRI);
    if (gambar) {
      const u = safeUrl(gambar[2], internal);
      if (u) {
        const alt = escapeHtml(gambar[1]);
        const cap = gambar[3] ? `<figcaption class="${C.caption}">${inline(escapeHtml(gambar[3]), internal)}</figcaption>` : '';
        keluar.push(`<figure class="${C.figure}">${imgTag(u, alt, C.img)}${cap}</figure>`);
      }
      i++;
      continue;
    }

    if (teks.includes('|') && i + 1 < baris.length && PEMISAH_TABEL.test(baris[i + 1])) {
      const header = selBaris(teks).map((h) => `<th class="${C.th}">${inline(escapeHtml(h), internal)}</th>`).join('');
      i += 2;
      const isi: string[] = [];
      while (i < baris.length && baris[i].includes('|') && baris[i].trim()) {
        const sel = selBaris(baris[i]).map((c) => `<td class="${C.td}">${inline(escapeHtml(c), internal)}</td>`).join('');
        isi.push(`<tr class="border-b border-ink-900/5 dark:border-cream-100/5 last:border-0">${sel}</tr>`);
        i++;
      }
      keluar.push(
        `<div class="${C.tableWrap}"><table class="w-full text-sm">` +
        `<thead><tr class="bg-cream-100/60 dark:bg-ink-900/60 border-b border-ink-900/10 dark:border-cream-100/10">${header}</tr></thead>` +
        `<tbody>${isi.join('')}</tbody></table></div>`,
      );
      continue;
    }

    if (/^\d+[.)]\s+/.test(teks)) {
      const item: string[] = [];
      let n = Number(teks.match(/^(\d+)/)![1]) || 1;
      while (i < baris.length && /^\d+[.)]\s+/.test(baris[i].trim())) {
        const isi = inline(escapeHtml(baris[i].trim().replace(/^\d+[.)]\s+/, '')), internal);
        item.push(`<li class="${C.li}"><span class="${C.marker}" aria-hidden="true">${String(n).padStart(2, '0')}</span><span>${isi}</span></li>`);
        n++;
        i++;
      }
      keluar.push(`<ol class="${C.ol}">${item.join('')}</ol>`);
      continue;
    }

    if (/^[-*+]\s+/.test(teks)) {
      const item: string[] = [];
      while (i < baris.length && /^[-*+]\s+/.test(baris[i].trim())) {
        const isi = inline(escapeHtml(baris[i].trim().replace(/^[-*+]\s+/, '')), internal);
        item.push(`<li class="${C.li}"><span class="${C.marker}" aria-hidden="true">→</span><span>${isi}</span></li>`);
        i++;
      }
      keluar.push(`<ul class="${C.ul}">${item.join('')}</ul>`);
      continue;
    }

    if (teks.startsWith('>')) {
      const isi: string[] = [];
      while (i < baris.length && baris[i].trim().startsWith('>')) {
        isi.push(baris[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      const jenis = isi[0]?.match(/^\[!([a-z]+)\]\s*(.*)$/i);
      const callout = jenis ? CALLOUT[jenis[1].toLowerCase()] : undefined;
      if (jenis && callout) {
        const badan = [jenis[2], ...isi.slice(1)].filter(Boolean).join(' ');
        keluar.push(
          `<aside class="mb-6 rounded-2xl border ${callout.cls} px-5 py-4">` +
          `<p class="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-amber-700 dark:text-amber-400 mb-1.5">${callout.label}</p>` +
          `<p class="text-ink-700 dark:text-cream-200 leading-relaxed">${inline(escapeHtml(badan), internal)}</p></aside>`,
        );
      } else {
        keluar.push(`<blockquote class="${C.quote}">${inline(escapeHtml(isi.join(' ')), internal)}</blockquote>`);
      }
      continue;
    }

    const isi: string[] = [];
    while (i < baris.length) {
      const t = baris[i].trim();
      if (!t || MULAI_BLOK.test(t) || GARIS.test(t) || TOKEN.test(t) || GAMBAR_SENDIRI.test(t)) break;
      isi.push(t);
      i++;
    }
    if (isi.length) keluar.push(`<p class="${C.p}">${inline(escapeHtml(isi.join(' ')), internal)}</p>`);
    else i++; // pengaman: selalu maju
  }

  return { html: keluar.join('\n'), headings };
}

/** Teks polos dari Markdown artikel — untuk hitung kata, ringkasan, RSS. */
export function markdownPlainText(source: string): string {
  return String(source ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\{\{[^}]+\}\}/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s*>\s*\[![a-z]+\]/gim, ' ')
    .replace(/^\s*\|?[\s:|-]+\|[\s:|-]*$/gm, ' ')
    .replace(/[#>*_`|]/g, ' ')
    .replace(/^\s*[-+]\s+/gm, ' ')
    .replace(/^\s*\d+[.)]\s+/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function wordCount(source: string): number {
  const t = markdownPlainText(source);
  return t ? t.split(' ').length : 0;
}

/** Perkiraan waktu baca (menit), 200 kata/menit, minimal 1. */
export function readingMinutes(source: string): number {
  return Math.max(1, Math.round(wordCount(source) / 200));
}

/** Potong teks polos tanpa memotong kata di tengah. */
export function truncate(text: string, max = 160): string {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).trimEnd() + '…';
}
