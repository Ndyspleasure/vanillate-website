// Konfigurasi blog (/blog). Sanity hanya tempat penyimpanan — artikel ditulis,
// diedit, dan diterbitkan dari CMS admin (/admin/blog) lewat Edge Function
// `blog-admin`. Lihat docs/BLOG.md.
//
// Project ID & nama dataset bukan rahasia: dataset `production` bersifat public,
// artinya HANYA dokumen yang sudah terbit yang bisa dibaca tanpa token. Draft
// (`drafts.*`) tetap tertutup. Token tulis Sanity hidup di secret Edge Function,
// tidak pernah di repo ini.
//
// File ini sengaja tanpa alias impor (@/…) supaya bisa dipakai astro.config.mjs
// dan tes `node --test`.

export const SANITY_PROJECT_ID = '62jp784l';
export const SANITY_DATASET = 'production';
export const SANITY_API_VERSION = 'v2025-02-19';

export const BLOG_PATH = '/blog';
export const POSTS_PER_PAGE = 12;
export const RELATED_LIMIT = 3;

/** Tipe dokumen di Sanity. Harus sama dengan supabase/functions/blog-admin/logic.ts. */
export const DOC_TYPES = {
  post: 'blogPost',
  author: 'blogAuthor',
  category: 'blogCategory',
} as const;
