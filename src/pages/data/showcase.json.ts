// Daftar lengkap server untuk tombol "Lihat semua server" (dimuat browser hanya
// saat tombol diklik). Berkas statis hasil build, tidak ada query per kunjungan.
import type { APIRoute } from 'astro';
import { getShowcase } from '@/lib/showcase';

export const GET: APIRoute = async () => {
  const { servers } = await getShowcase();
  return new Response(JSON.stringify(servers), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
