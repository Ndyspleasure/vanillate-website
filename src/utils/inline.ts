// Formatter inline-markdown ringan untuk konten dari data internal (docs.ts,
// faq.ts, dll) — bukan input user. Mendukung:
//   `kode`      → <code>
//   **tebal**   → <strong>
//   *miring*    → <em>
// HTML di-escape lebih dulu supaya aman, lalu inline code diproses sebelum
// bold/italic agar karakter penanda di dalam `code` tidak ikut diformat.

export const codeClass =
  'font-mono text-[0.85em] text-amber-600 dark:text-amber-400 bg-cream-100 dark:bg-ink-900 px-1.5 py-0.5 rounded';

const strongClass = 'font-semibold text-ink-900 dark:text-cream-50';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Ubah string ber-markdown ringan menjadi HTML aman untuk `set:html`.
 */
export function inlineMarkdown(s: string): string {
  return escapeHtml(s)
    .replace(/`([^`]+)`/g, `<code class="${codeClass}">$1</code>`)
    .replace(/\*\*([^*]+)\*\*/g, `<strong class="${strongClass}">$1</strong>`)
    .replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, '$1<em>$2</em>');
}
