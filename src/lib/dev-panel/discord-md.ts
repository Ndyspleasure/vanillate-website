// Pratinjau markdown Discord untuk Broadcast DM (model murni, tanpa DOM).
//
// Meniru subset yang dirender Discord di kartu Components V2: judul # ## ###,
// teks kecil -#, daftar, kutipan, blok kode, kode inline, tebal, miring, coret,
// garis bawah, spoiler, dan tautan [teks](https://…). Tabel, LaTeX, ####, dan
// garis --- sengaja TIDAK dirender (Discord juga menampilkannya apa adanya).
// Seluruh teks di-escape lebih dulu, jadi hasilnya aman untuk innerHTML.
// Tanpa import supaya bisa dites langsung oleh Node.

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Inline: input SUDAH di-escape. Kode inline dilindungi dulu agar isinya tidak diformat. */
function inline(escaped: string): string {
  const codes: string[] = [];
  let t = escaped.replace(/`([^`\n]+)`/g, (_m, c: string) => {
    codes.push(`<code class="rounded bg-black/30 px-1 font-mono text-[0.85em]">${c}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  t = t
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-sky-300 underline">$1</a>')
    .replace(/\|\|(.+?)\|\|/g, '<span class="rounded bg-black/60 px-0.5 text-transparent hover:text-inherit">$1</span>')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<u>$1</u>')
    .replace(/(^|[^*\w])\*(?!\s)([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/(^|[^_\w])_(?!\s)([^_\n]+?)_(?![_\w])/g, '$1<em>$2</em>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>');
  return t.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => codes[Number(i)]);
}

const HEADING = ['', 'text-xl font-bold', 'text-lg font-bold', 'text-base font-bold'];

export function discordMarkdownHtml(text: string): string {
  const lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (/^```/.test(line)) {
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i])) body.push(lines[i++]);
      i += 1; // penutup
      out.push(`<pre class="my-1 overflow-x-auto rounded bg-black/30 p-2 font-mono text-xs whitespace-pre">${esc(body.join('\n'))}</pre>`);
      continue;
    }

    const h = /^(#{1,3}) +(.+)$/.exec(line);
    if (h) { out.push(`<p class="mt-1 ${HEADING[h[1].length]}">${inline(esc(h[2]))}</p>`); i += 1; continue; }

    const small = /^-# +(.+)$/.exec(line);
    if (small) { out.push(`<p class="text-xs opacity-70">${inline(esc(small[1]))}</p>`); i += 1; continue; }

    if (/^> /.test(line)) {
      const q: string[] = [];
      while (i < lines.length && /^> /.test(lines[i])) q.push(lines[i++].slice(2));
      out.push(`<blockquote class="my-1 border-l-4 border-white/20 pl-2">${q.map((l) => inline(esc(l))).join('<br>')}</blockquote>`);
      continue;
    }

    const ul = /^[-*] +(.+)$/.exec(line);
    if (ul) {
      const items: string[] = [];
      while (i < lines.length && /^[-*] +/.test(lines[i])) items.push(lines[i++].replace(/^[-*] +/, ''));
      out.push(`<ul class="my-1 list-disc pl-5">${items.map((l) => `<li>${inline(esc(l))}</li>`).join('')}</ul>`);
      continue;
    }

    if (/^\d+\. +/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\. +/.test(lines[i])) items.push(lines[i++].replace(/^\d+\. +/, ''));
      out.push(`<ol class="my-1 list-decimal pl-5">${items.map((l) => `<li>${inline(esc(l))}</li>`).join('')}</ol>`);
      continue;
    }

    out.push(line.trim() === '' ? '<div class="h-2"></div>' : `<p>${inline(esc(line))}</p>`);
    i += 1;
  }
  return out.join('');
}
