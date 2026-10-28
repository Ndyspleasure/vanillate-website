// Logika murni editor artikel (/admin/blog/tulis): checklist SEO/GEO, perapian
// tulisan dari Claude/ChatGPT, dan konversi tanggal. Tanpa DOM supaya teruji.
// Validasi AKHIR tetap di Edge Function blog-admin (publishErrors).

import { renderBlogMarkdown, slugify, wordCount } from './markdown.ts';

export interface DraftLike {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  tldr: string[];
  faqs: { q: string; a: string }[];
  categoryIds: string[];
  mainImage: { alt: string } | null;
  seo: { title: string; description: string };
}

export type CekStatus = 'ok' | 'warn' | 'bad';

export interface Cek {
  status: CekStatus;
  label: string;
  hint: string;
}

const INTERNAL_LINK = /\]\((\/(products|faq|blog)\b[^)]*|https:\/\/(www\.)?vanillate\.id\/[^)]*)\)|\{\{produk:/;

/**
 * Checklist SEO & GEO yang ditampilkan langsung saat menulis. "bad" = akan
 * ditolak saat publish (sama dengan publishErrors di Edge Function); "warn" =
 * boleh terbit, tapi sebaiknya diperbaiki.
 */
export function seoChecklist(d: DraftLike): Cek[] {
  const judul = (d.seo.title || d.title).trim();
  const desk = (d.seo.description || d.excerpt).trim();
  const kata = wordCount(d.body);
  const h2 = renderBlogMarkdown(d.body).headings.filter((h) => h.level === 2).length;
  const out: Cek[] = [];

  out.push(
    judul.length < 5
      ? { status: 'bad', label: 'Judul', hint: 'Judul minimal 5 karakter.' }
      : judul.length > 65
        ? { status: 'warn', label: 'Judul', hint: `${judul.length} karakter — Google memotong di ±60. Isi SEO title yang lebih pendek.` }
        : judul.length < 30
          ? { status: 'warn', label: 'Judul', hint: `${judul.length} karakter — 30–60 lebih ideal.` }
          : { status: 'ok', label: 'Judul', hint: `${judul.length} karakter, pas.` },
  );
  out.push(
    !desk
      ? { status: 'bad', label: 'Meta description', hint: 'Isi Ringkasan atau Meta description.' }
      : desk.length < 110 || desk.length > 160
        ? { status: 'warn', label: 'Meta description', hint: `${desk.length} karakter — idealnya 120–160.` }
        : { status: 'ok', label: 'Meta description', hint: `${desk.length} karakter, pas.` },
  );
  const slug = d.slug || slugify(d.title);
  out.push(
    !slug
      ? { status: 'bad', label: 'Slug URL', hint: 'Slug kosong.' }
      : slug.split('-').length > 8
        ? { status: 'warn', label: 'Slug URL', hint: 'Slug panjang — 3–6 kata kunci saja lebih baik.' }
        : { status: 'ok', label: 'Slug URL', hint: `/blog/${slug}` },
  );
  out.push(
    kata < 50
      ? { status: 'bad', label: 'Panjang isi', hint: `${kata} kata — minimal 50 untuk terbit.` }
      : kata < 300
        ? { status: 'warn', label: 'Panjang isi', hint: `${kata} kata — artikel ≥ 600 kata lebih mudah bersaing di Google.` }
        : { status: 'ok', label: 'Panjang isi', hint: `${kata} kata.` },
  );
  out.push(
    h2 >= 2
      ? { status: 'ok', label: 'Subjudul', hint: `${h2} subjudul (##) — daftar isi terbentuk.` }
      : { status: 'warn', label: 'Subjudul', hint: 'Pakai ≥ 2 subjudul "## …" agar mudah dipindai pembaca, Google & AI.' },
  );
  out.push(
    !d.mainImage
      ? { status: 'warn', label: 'Featured image', hint: 'Tanpa gambar, kartu share & hasil Google kurang menarik.' }
      : !d.mainImage.alt.trim()
        ? { status: 'bad', label: 'Featured image', hint: 'Alt text wajib diisi.' }
        : { status: 'ok', label: 'Featured image', hint: 'Ada, dengan alt text.' },
  );
  out.push(
    INTERNAL_LINK.test(d.body)
      ? { status: 'ok', label: 'Tautan internal', hint: 'Ada tautan ke produk/FAQ/artikel lain.' }
      : { status: 'warn', label: 'Tautan internal', hint: 'Tautkan minimal satu produk, FAQ, atau artikel lain.' },
  );
  out.push(
    d.categoryIds.length
      ? { status: 'ok', label: 'Kategori', hint: 'Sudah dipilih.' }
      : { status: 'warn', label: 'Kategori', hint: 'Pilih kategori supaya artikel mudah ditemukan.' },
  );
  out.push(
    d.tldr.length
      ? { status: 'ok', label: 'Poin penting (GEO)', hint: 'Ringkasan poin membantu dikutip AI.' }
      : { status: 'warn', label: 'Poin penting (GEO)', hint: 'Isi 2–4 poin penting — mesin AI suka jawaban ringkas.' },
  );
  out.push(
    d.faqs.length
      ? { status: 'ok', label: 'FAQ artikel (GEO)', hint: `${d.faqs.length} tanya-jawab (schema FAQPage).` }
      : { status: 'warn', label: 'FAQ artikel (GEO)', hint: 'Tambah 2–4 tanya-jawab — sering dikutip ChatGPT/Perplexity.' },
  );
  return out;
}

export function skorSeo(cek: Cek[]): number {
  if (!cek.length) return 0;
  const nilai = cek.reduce((n, c) => n + (c.status === 'ok' ? 1 : c.status === 'warn' ? 0.5 : 0), 0);
  return Math.round((nilai / cek.length) * 100);
}

export interface Rapian {
  title: string | null;
  body: string;
  changes: string[];
}

/**
 * Rapikan Markdown hasil Claude/ChatGPT: judul "# …" di baris pertama dipindah
 * ke kolom Judul (bila kosong), heading bertingkat dinaikkan supaya subjudul
 * utama jadi "##", bullet "•" jadi "-", tebal-sebaris jadi subjudul, dan baris
 * kosong berlebih dirapatkan.
 */
export function rapikanTulisanAi(body: string, currentTitle: string): Rapian {
  let teks = String(body ?? '').replace(/\r\n?/g, '\n').replace(/ /g, ' ');
  const changes: string[] = [];
  let title: string | null = null;

  const h1 = teks.match(/^\s*#\s+(.+?)\s*#*\s*(\n|$)/);
  if (h1) {
    if (!currentTitle.trim()) {
      title = h1[1].replace(/[*_`]/g, '').trim();
      changes.push('Judul diambil dari baris "# …" pertama.');
    }
    teks = teks.slice(h1[0].length);
    if (!title) changes.push('Judul "# …" di awal isi dibuang (judul artikel sudah ada).');
  }

  const sebelumBullet = teks;
  teks = teks.replace(/^(\s*)[•●▪◦]\s*/gm, '$1- ');
  if (teks !== sebelumBullet) changes.push('Bullet "•" diubah jadi daftar Markdown.');

  const sebelumBold = teks;
  teks = teks.replace(/^\*\*([^*\n]{3,80})\*\*:?[ \t]*$/gm, '## $1');
  if (teks !== sebelumBold) changes.push('Baris tebal tunggal dijadikan subjudul.');

  // Tanpa "##" tapi ada "###" → naikkan satu tingkat.
  if (!/^##\s/m.test(teks) && /^###\s/m.test(teks)) {
    teks = teks.replace(/^(#{3,6})\s/gm, (_, h: string) => `${h.slice(1)} `);
    changes.push('Tingkat subjudul dinaikkan (### → ##).');
  }

  const sebelumSpasi = teks;
  teks = teks.replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
  if (teks !== sebelumSpasi.trim()) changes.push('Spasi & baris kosong berlebih dirapikan.');

  return { title, body: teks, changes };
}

/** ISO → nilai <input type="datetime-local"> dalam zona waktu browser. */
export function isoKeLokal(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Nilai <input type="datetime-local"> → ISO (UTC), atau null bila kosong. */
export function lokalKeIso(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
