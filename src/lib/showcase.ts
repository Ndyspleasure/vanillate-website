// Akses data 🌐 Showcase Server saat build. Logika murni ada di
// showcase-model.ts (diuji); berkas ini hanya menghubungkan env Astro.
//
// Memanggil RPC publik `showcase_public_list()` di proyek CMS dengan anon key
// (yang memang publik). Hasilnya di-cache selama satu proses build supaya
// beranda, halaman produk, dan /data/showcase.json hanya memicu satu request.
// Gagal apa pun = daftar kosong dan seksi tersembunyi, build tetap jalan.

import { fetchShowcase, type ShowcaseList } from './showcase-model';
import { BOT_SLUG_NEW } from './bot-slug';

let cache: Promise<ShowcaseList> | null = null;

export function getShowcase(): Promise<ShowcaseList> {
  cache ??= fetchShowcase({
    url: import.meta.env.PUBLIC_SUPABASE_URL as string | undefined,
    anonKey: import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined,
    slug: BOT_SLUG_NEW,
    onWarn: (msg) => console.warn(`[showcase] ${msg}`),
  });
  return cache;
}

/** Benih sampel: berganti tiap hari (UTC) supaya tiap build harian memberi sampel segar. */
export function sampleSeed(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}
