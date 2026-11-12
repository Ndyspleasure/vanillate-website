// ════════════════════════════════════════════════════════════════════════════
//  Portal Penulis Blog — logika murni peninjauan (tanpa Deno/jaringan, teruji
//  dengan Node). Dipakai blog-admin (setujui/tolak) dan blog-writer (validasi).
//  Acuan: docs/BLOG-PENULIS.md.
// ════════════════════════════════════════════════════════════════════════════

import { isDocId, line, LIMITS, multiline, slugify, publishErrors, cleanPostFields, type PostFields } from './logic.ts';

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
/** Path berkas di bucket `blog-penulis`: `<user-id>/<uuid>.<ext>`. */
const STORAGE_PATH = new RegExp(`^(${UUID})/(${UUID})\\.(webp|jpg|png)$`);
const SANITY_IMG = /^https:\/\/cdn\.sanity\.io\/images\/[a-z0-9]+\/[a-z0-9_-]+\/[a-f0-9]+-\d+x\d+\.[a-z]+/i;
/** `![alt](alamat "keterangan")`, alamat tanpa spasi atau kurung. */
const MD_IMAGE = /!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

export const WRITER_LIMITS = {
  imageBytes: 2 * 1024 * 1024,
  bodyImages: 10,
  title: LIMITS.title,
  body: 60_000,
  categories: 4,
};

export const WRITER_IMAGE_TYPES: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

export function isStoragePath(path: unknown, userId?: string): path is string {
  if (typeof path !== 'string') return false;
  const m = STORAGE_PATH.exec(path);
  return Boolean(m) && (!userId || m![1] === userId);
}

export function newStoragePath(userId: string, ext: 'webp' | 'jpg' | 'png'): string {
  return `${userId}/${crypto.randomUUID()}.${ext}`;
}

/** Path `blogimg:` yang dipakai isi tulisan, urut kemunculan, tanpa duplikat. */
export function bodyImagePaths(body: string): string[] {
  const out: string[] = [];
  for (const m of String(body ?? '').matchAll(MD_IMAGE)) {
    if (m[1].startsWith('blogimg:') && !out.includes(m[1].slice(8))) out.push(m[1].slice(8));
  }
  return out;
}

/**
 * Masalah pada gambar di isi tulisan. Penulis hanya boleh memakai gambar yang
 * diunggah lewat editor (`blogimg:<path>` miliknya) atau gambar Sanity. Alamat
 * luar ditolak: mencegah pelacak/hotlink dan konten di luar kendali kita.
 */
export function bodyImageProblems(body: string, userId: string): string[] {
  const e: string[] = [];
  let luar = 0;
  let milikSendiri = 0;
  for (const m of String(body ?? '').matchAll(MD_IMAGE)) {
    const src = m[1];
    if (src.startsWith('blogimg:')) {
      if (isStoragePath(src.slice(8), userId)) milikSendiri++;
      else e.push('Ada gambar yang bukan milik akunmu. Unggah ulang lewat editor.');
    } else if (!SANITY_IMG.test(src)) luar++;
  }
  if (luar) e.push('Gambar dari alamat luar tidak diizinkan. Unggah gambar lewat tombol gambar di editor.');
  if (milikSendiri > WRITER_LIMITS.bodyImages) e.push(`Maksimal ${WRITER_LIMITS.bodyImages} gambar di dalam tulisan.`);
  return [...new Set(e)];
}

/** Ganti `blogimg:<path>` dengan URL final (mis. URL CDN Sanity). */
export function rewriteBodyImages(body: string, urls: Record<string, string>): string {
  return String(body ?? '').replace(MD_IMAGE, (whole, src: string) => {
    if (!src.startsWith('blogimg:')) return whole;
    const url = urls[src.slice(8)];
    return url ? whole.replace(src, url) : whole;
  });
}

/** Semua path Storage yang dipakai tulisan (gambar utama + isi), tanpa duplikat. */
export function allImagePaths(row: { main_image_path?: string | null; body?: string | null }): string[] {
  const out = bodyImagePaths(row.body ?? '');
  if (row.main_image_path && !out.includes(row.main_image_path)) out.unshift(row.main_image_path);
  return out;
}

// ─── Isian dari penulis ──────────────────────────────────────────────────────

export interface WriterRowPatch {
  title: string;
  slug: string | null;
  excerpt: string;
  tldr: string[];
  body: string;
  categories: string[];
  tags: string[];
  main_image_path: string | null;
  main_image_alt: string;
  ai_image: boolean;
  image_paths: string[];
}

/** Bentuk aman dari isian editor penulis. Tidak menolak apa pun (draf boleh setengah jadi). */
export function cleanWriterInput(input: any, userId: string): WriterRowPatch {
  const list = (v: unknown) => (Array.isArray(v) ? v : []);
  const title = line(input?.title, WRITER_LIMITS.title);
  const slug = slugify(typeof input?.slug === 'string' && input.slug.trim() ? input.slug : title);
  const body = multiline(input?.body, WRITER_LIMITS.body);
  const main = isStoragePath(input?.mainImagePath, userId) ? input.mainImagePath : null;
  const patch: WriterRowPatch = {
    title,
    slug: slug || null,
    excerpt: line(input?.excerpt, LIMITS.excerpt),
    tldr: list(input?.tldr).map((t) => line(t, LIMITS.tldrItem)).filter(Boolean).slice(0, LIMITS.tldr),
    body,
    categories: [...new Set(list(input?.categories).filter((c) => isDocId(c, 'category')) as string[])].slice(0, WRITER_LIMITS.categories),
    tags: list(input?.tags).map((t) => line(t, LIMITS.tag)).filter((t) => slugify(t))
      .filter((t, i, a) => a.findIndex((x) => slugify(x) === slugify(t)) === i).slice(0, LIMITS.tags),
    main_image_path: main,
    main_image_alt: line(input?.mainImageAlt, LIMITS.alt),
    ai_image: input?.aiImage === true,
    image_paths: [],
  };
  patch.image_paths = allImagePaths({ main_image_path: main, body }).filter((p) => isStoragePath(p, userId)).slice(0, WRITER_LIMITS.bodyImages);
  return patch;
}

/** PostFields dari baris tulisan yang disimpan, untuk validasi dan penerbitan. */
export function submissionToPostFields(
  row: Record<string, any>,
  opts: { authorId: string | null; assetId?: string | null; body?: string; ugc: boolean },
): PostFields {
  return cleanPostFields({
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    tldr: row.tldr,
    body: opts.body ?? row.body,
    mainImage: opts.assetId
      ? { assetId: opts.assetId, alt: row.main_image_alt, caption: row.ai_image ? 'Gambar dibuat dengan bantuan AI.' : '' }
      : null,
    authorId: opts.authorId,
    categoryIds: row.categories,
    tags: row.tags,
    seo: { title: '', description: '', noindex: false },
    ugc: opts.ugc,
  });
}

/** Alasan tulisan belum layak diajukan. Kosong = boleh diajukan. */
export function submitProblems(row: Record<string, any>, userId: string): string[] {
  // Aturan terbit yang sama dengan editor admin. authorId diisi penanda karena
  // penulis dibuatkan dokumen Sanity saat tulisan disetujui.
  const f = submissionToPostFields(row, { authorId: 'author-00000000', ugc: true });
  const e = publishErrors({ ...f, mainImage: null });
  if (row.main_image_path && !String(row.main_image_alt ?? '').trim()) e.push('Gambar utama wajib punya alt text.');
  if (!row.main_image_path) e.push('Gambar utama wajib diunggah.');
  if (!Array.isArray(row.categories) || row.categories.length === 0) e.push('Pilih minimal satu kategori.');
  e.push(...bodyImageProblems(String(row.body ?? ''), userId));
  return [...new Set(e)];
}

// ─── Profil penulis ─────────────────────────────────────────────────────────

export interface ProfilePatch {
  display_name: string;
  slug: string;
  bio: string;
  links: string[];
}

export function cleanProfile(input: any): { value?: ProfilePatch; errors: string[] } {
  const name = line(input?.displayName, 80);
  const slug = slugify(typeof input?.slug === 'string' && input.slug.trim() ? input.slug : name, 40);
  const errors: string[] = [];
  if (name.length < 2) errors.push('Nama tampil minimal 2 karakter.');
  if (slug.length < 3) errors.push('Slug profil minimal 3 karakter.');
  if (errors.length) return { errors };
  const links = (Array.isArray(input?.links) ? input.links : [])
    .map((l: unknown) => line(l, 300))
    .filter((l: string) => /^https:\/\/[^\s]+$/.test(l))
    .slice(0, 5);
  return { value: { display_name: name, slug, bio: multiline(input?.bio, 500), links }, errors };
}

// ─── Discord dari identitas auth ────────────────────────────────────────────

/** Ambil identitas Discord dari objek user Supabase Auth (data dari server, bukan klien). */
export function discordFromUser(user: any): { id: string; username: string } | null {
  const ident = (Array.isArray(user?.identities) ? user.identities : []).find((i: any) => i?.provider === 'discord');
  if (!ident) return null;
  const d = ident.identity_data ?? {};
  const id = String(ident.id ?? d.provider_id ?? d.sub ?? '');
  if (!/^[0-9]{15,25}$/.test(id)) return null;
  const username = line(d.custom_claims?.global_name ?? d.full_name ?? d.name ?? d.user_name ?? '', 80);
  return { id, username };
}

// ─── Email ──────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
}

export interface ReviewEmailInput {
  kind: 'setujui' | 'tolak';
  writerName: string;
  title: string;
  reason?: string;
  /** Tautan artikel (setujui) atau dasbor penulis (tolak). */
  url: string;
}

export function reviewEmail(i: ReviewEmailInput): { subject: string; html: string; text: string } {
  const ok = i.kind === 'setujui';
  const subject = ok ? `Tulisanmu terbit: ${i.title}` : `Tulisanmu perlu direvisi: ${i.title}`;
  const pesan = ok
    ? `Kabar baik! Tulisan <strong>${esc(i.title)}</strong> sudah disetujui dan akan tayang di blog Vanillate setelah situs selesai dibangun (beberapa menit).`
    : `Tulisan <strong>${esc(i.title)}</strong> belum bisa kami terbitkan. Kamu bisa merevisinya lalu mengajukannya lagi.`;
  const alasan = !ok && i.reason
    ? `<div style="margin:16px 0;padding:12px 14px;border-radius:12px;background:#faf5ea;border:1px solid #eadfc4"><div style="font-size:12px;color:#8a8577;margin-bottom:4px">Alasan dari tim</div><div style="white-space:pre-wrap">${esc(i.reason)}</div></div>`
    : '';
  const tombol = ok ? 'Lihat tulisan' : 'Buka dasbor penulis';
  const html = `<!doctype html><html><body style="margin:0;background:#f5f3ee;font-family:Inter,Arial,sans-serif;color:#111015">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px">
    <div style="background:#fff;border-radius:16px;padding:28px;border:1px solid #eee">
      <h1 style="margin:0 0 12px;font-size:20px">${esc(subject)}</h1>
      <p style="margin:0 0 8px">Halo ${esc(i.writerName)},</p>
      <p style="margin:0 0 8px;line-height:1.55">${pesan}</p>
      ${alasan}
      <p style="margin:20px 0 0"><a href="${esc(i.url)}" style="display:inline-block;background:#f59e0b;color:#111015;text-decoration:none;font-weight:600;padding:10px 18px;border-radius:12px">${tombol}</a></p>
    </div>
    <p style="text-align:center;color:#8a8577;font-size:12px;margin-top:16px">Vanillate Studio. Email ini dikirim otomatis, mohon tidak membalas ke alamat ini.</p>
  </div></body></html>`;
  const text = `Halo ${i.writerName},\n\n${pesan.replace(/<[^>]+>/g, '')}\n${!ok && i.reason ? `\nAlasan dari tim:\n${i.reason}\n` : ''}\n${tombol}: ${i.url}\n`;
  return { subject, html, text };
}
