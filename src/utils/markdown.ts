// ─────────────────────────────────────────────────────────────────────────────
// RENDERER MARKDOWN UNTUK JAWABAN FAQ
//
// Jawaban FAQ ditulis admin di CMS, jadi ia adalah teks yang datang dari luar
// source code. Renderer ini sengaja kecil dan tertutup: HTML di-escape lebih
// dulu, lalu hanya konstruksi yang memang didukung yang diubah jadi tag. Tidak
// ada HTML mentah yang lolos, dan tidak ada URL berskema aneh yang jadi href.
//
// Yang didukung (cukup untuk menulis panduan lengkap):
//   ## Heading, ### Heading    → <h3>, <h4>
//   paragraf                   → <p>
//   - item / 1. item           → <ul> / <ol>
//   | tabel | markdown |       → <table>
//   > kutipan                  → <blockquote>
//   ```blok kode```            → <pre><code>
//   **tebal**, *miring*, `kode`, [teks](url), ![alt](url)
//   ---                        → <hr>
//   {{shop-table}}             → tabel harga shop yang tersinkron otomatis
//
// Kelas Tailwind ditempel di sini supaya tampilannya konsisten di mana pun
// jawaban FAQ dirender (halaman detail, akordeon, dan preview di CMS).
// ─────────────────────────────────────────────────────────────────────────────

import shopData from '@data/synced/shop.json';
import { codeClass } from './inline';
import { url } from './url';

const H3 = 'font-display text-xl md:text-2xl font-semibold tracking-tightest mt-10 mb-3 scroll-mt-24';
const H4 = 'font-display text-base font-semibold tracking-tightest mt-8 mb-2 text-ink-900 dark:text-cream-50';
const P = 'text-ink-700 dark:text-cream-200 leading-relaxed mb-4';
const UL = 'mb-4 space-y-2';
const OL = 'mb-4 space-y-2 list-none';
const LI = 'flex gap-3 text-ink-700 dark:text-cream-200 leading-relaxed';
const LINK = 'text-amber-600 dark:text-amber-400 underline underline-offset-2 hover:text-amber-500 transition-colors';
const QUOTE = 'mb-4 border-l-2 border-amber-500 bg-amber-500/5 px-5 py-4 text-ink-700 dark:text-cream-200 leading-relaxed';
const PRE = 'mb-4 overflow-x-auto rounded-xl border border-ink-900/10 dark:border-cream-100/10 bg-cream-100/60 dark:bg-ink-900/60 p-4 text-sm';
const TABLE_WRAP = 'mb-4 overflow-x-auto rounded-xl border border-ink-900/10 dark:border-cream-100/10';
const TH = 'px-4 py-3 text-left font-semibold text-ink-900 dark:text-cream-50 whitespace-nowrap';
const TD = 'px-4 py-3 text-ink-700 dark:text-cream-200';
const IMG = 'mb-4 rounded-xl border border-ink-900/10 dark:border-cream-100/10 max-w-full h-auto';
const STRONG = 'font-semibold text-ink-900 dark:text-cream-50';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Hanya http(s), path internal, dan mailto yang boleh jadi href/src.
 * Nilai lain dibuang — inilah yang menutup pintu `javascript:`.
 */
function safeUrl(raw: string): string | null {
  const u = raw.trim();
  if (!u) return null;
  if (/^https?:\/\//i.test(u) || /^mailto:/i.test(u) || u.startsWith('#')) return u;
  // Path internal dilewatkan url() supaya ikut menghormati `base` di
  // astro.config.mjs — persis seperti tautan lain di situs.
  if (u.startsWith('/')) return url(u);
  return null;
}

/** Format inline di dalam satu baris teks yang SUDAH di-escape. */
function inline(escaped: string): string {
  return escaped
    // Gambar diproses sebelum tautan: sintaksnya cuma beda tanda seru di depan.
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, alt, href) => {
      const u = safeUrl(href);
      return u ? `<img src="${u}" alt="${alt}" class="${IMG}" loading="lazy" decoding="async" />` : alt;
    })
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, teks, href) => {
      const u = safeUrl(href);
      if (!u) return teks;
      const luar = /^https?:\/\//i.test(u);
      const atribut = luar ? ' target="_blank" rel="noopener noreferrer"' : '';
      return `<a href="${u}" class="${LINK}"${atribut}>${teks}</a>`;
    })
    .replace(/`([^`]+)`/g, `<code class="${codeClass}">$1</code>`)
    .replace(/\*\*([^*]+)\*\*/g, `<strong class="${STRONG}">$1</strong>`)
    .replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, '$1<em>$2</em>');
}

/** Butir list dengan penanda "→" seperti daftar lain di situs. */
function bullet(isi: string, penanda: string): string {
  return `<li class="${LI}"><span class="text-amber-600 dark:text-amber-500 font-mono text-sm mt-1 flex-none">${penanda}</span><span>${isi}</span></li>`;
}

/** Baris tabel markdown → sel. Pipa di ujung baris diabaikan. */
function selBaris(baris: string): string[] {
  return baris.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((s) => s.trim());
}

const PEMISAH_TABEL = /^\s*\|?[\s:|-]+\|[\s:|-]*$/;

/**
 * Tabel harga shop, digenerate dari data yang tersinkron otomatis dari repo bot
 * (src/data/synced/shop.json). Ditulis di jawaban FAQ sebagai {{shop-table}},
 * jadi admin tidak perlu menyalin ulang harga setiap kali berubah.
 */
function shopTable(): string {
  const baris = [...shopData.items]
    .sort((a, b) => a.harga - b.harga)
    .map((i) => `<tr class="border-b border-ink-900/5 dark:border-cream-100/5 last:border-0"><td class="${TD}">${escapeHtml(i.nama)}</td><td class="${TD}">${escapeHtml(String(i.harga))} Coin</td></tr>`)
    .join('');
  return `<div class="${TABLE_WRAP}"><table class="w-full text-sm"><thead><tr class="bg-cream-100/60 dark:bg-ink-900/60 border-b border-ink-900/10 dark:border-cream-100/10"><th class="${TH}">Item</th><th class="${TH}">Harga</th></tr></thead><tbody>${baris}</tbody></table></div>`;
}

/** Token dinamis yang boleh dipakai di jawaban FAQ. */
const TOKEN: Record<string, () => string> = {
  'shop-table': shopTable,
};

/**
 * Ubah jawaban FAQ (Markdown ringan) menjadi HTML yang aman untuk `set:html`.
 */
export function renderMarkdown(source: string): string {
  const baris = String(source ?? '').replace(/\r\n?/g, '\n').split('\n');
  const keluar: string[] = [];
  let i = 0;

  while (i < baris.length) {
    const b = baris[i];
    const teks = b.trim();

    // Baris kosong: tidak menghasilkan apa-apa, jarak diatur lewat margin.
    if (!teks) { i++; continue; }

    // Token dinamis, mis. {{shop-table}}
    const token = teks.match(/^\{\{\s*([a-z-]+)\s*\}\}$/i);
    if (token && TOKEN[token[1].toLowerCase()]) {
      keluar.push(TOKEN[token[1].toLowerCase()]());
      i++;
      continue;
    }

    // Blok kode berpagar
    if (teks.startsWith('```')) {
      const isi: string[] = [];
      i++;
      while (i < baris.length && !baris[i].trim().startsWith('```')) { isi.push(baris[i]); i++; }
      i++; // lewati pagar penutup
      keluar.push(`<pre class="${PRE}"><code class="font-mono">${escapeHtml(isi.join('\n'))}</code></pre>`);
      continue;
    }

    // Garis pemisah
    if (/^(-{3,}|_{3,}|\*{3,})$/.test(teks)) {
      keluar.push('<hr class="my-8 border-ink-900/10 dark:border-cream-100/10" />');
      i++;
      continue;
    }

    // Heading. Level 1 dan 2 sama-sama jadi <h3>: <h1>/<h2> sudah dipakai
    // kerangka halaman, dan judul FAQ tidak boleh menyaingi judul halaman.
    const heading = teks.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const dalam = inline(escapeHtml(heading[2].trim()));
      const tag = heading[1].length <= 2 ? 'h3' : 'h4';
      keluar.push(`<${tag} class="${tag === 'h3' ? H3 : H4}">${dalam}</${tag}>`);
      i++;
      continue;
    }

    // Tabel: baris header + baris pemisah.
    if (teks.includes('|') && i + 1 < baris.length && PEMISAH_TABEL.test(baris[i + 1])) {
      const header = selBaris(teks).map((h) => `<th class="${TH}">${inline(escapeHtml(h))}</th>`).join('');
      i += 2;
      const isi: string[] = [];
      while (i < baris.length && baris[i].includes('|') && baris[i].trim()) {
        const sel = selBaris(baris[i]).map((c) => `<td class="${TD}">${inline(escapeHtml(c))}</td>`).join('');
        isi.push(`<tr class="border-b border-ink-900/5 dark:border-cream-100/5 last:border-0">${sel}</tr>`);
        i++;
      }
      keluar.push(
        `<div class="${TABLE_WRAP}"><table class="w-full text-sm">` +
        `<thead><tr class="bg-cream-100/60 dark:bg-ink-900/60 border-b border-ink-900/10 dark:border-cream-100/10">${header}</tr></thead>` +
        `<tbody>${isi.join('')}</tbody></table></div>`,
      );
      continue;
    }

    // Daftar berurutan
    if (/^\d+[.)]\s+/.test(teks)) {
      const item: string[] = [];
      let n = 1;
      while (i < baris.length && /^\d+[.)]\s+/.test(baris[i].trim())) {
        const isi = inline(escapeHtml(baris[i].trim().replace(/^\d+[.)]\s+/, '')));
        item.push(bullet(isi, String(n).padStart(2, '0')));
        n++;
        i++;
      }
      keluar.push(`<ol class="${OL}">${item.join('')}</ol>`);
      continue;
    }

    // Daftar tak berurutan
    if (/^[-*]\s+/.test(teks)) {
      const item: string[] = [];
      while (i < baris.length && /^[-*]\s+/.test(baris[i].trim())) {
        item.push(bullet(inline(escapeHtml(baris[i].trim().replace(/^[-*]\s+/, ''))), '→'));
        i++;
      }
      keluar.push(`<ul class="${UL}">${item.join('')}</ul>`);
      continue;
    }

    // Kutipan
    if (teks.startsWith('>')) {
      const isi: string[] = [];
      while (i < baris.length && baris[i].trim().startsWith('>')) {
        isi.push(baris[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      keluar.push(`<blockquote class="${QUOTE}">${inline(escapeHtml(isi.join(' ')))}</blockquote>`);
      continue;
    }

    // Paragraf: baris berturut-turut digabung sampai bertemu baris kosong atau
    // awal blok lain.
    const isi: string[] = [];
    while (
      i < baris.length &&
      baris[i].trim() &&
      !/^(#{1,6}\s|[-*]\s|\d+[.)]\s|>|```)/.test(baris[i].trim()) &&
      !/^(-{3,}|_{3,}|\*{3,})$/.test(baris[i].trim()) &&
      !/^\{\{\s*[a-z-]+\s*\}\}$/i.test(baris[i].trim())
    ) {
      isi.push(baris[i].trim());
      i++;
    }
    if (isi.length) keluar.push(`<p class="${P}">${inline(escapeHtml(isi.join(' ')))}</p>`);
    else i++; // pengaman: jangan pernah berhenti maju
  }

  return keluar.join('\n');
}

/**
 * Versi teks polos dari jawaban — untuk ringkasan kartu, meta description, dan
 * indeks pencarian. Menghapus penanda markdown tanpa menyisakan HTML.
 */
export function markdownToText(source: string): string {
  return String(source ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\{\{[^}]+\}\}/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s*\|.*$/gm, ' ')
    .replace(/[#>*_`|]/g, '')
    .replace(/^\s*[-]\s+/gm, '')
    .replace(/^\s*\d+[.)]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Potong teks polos ke panjang tertentu tanpa memotong kata di tengah. */
export function ringkas(source: string, maks = 160): string {
  const teks = markdownToText(source);
  if (teks.length <= maks) return teks;
  const potong = teks.slice(0, maks);
  const spasi = potong.lastIndexOf(' ');
  return (spasi > maks * 0.6 ? potong.slice(0, spasi) : potong).trimEnd() + '…';
}
