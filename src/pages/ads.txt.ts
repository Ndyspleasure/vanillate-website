// /ads.txt — penjual resmi iklan di vanillate.id. Dibangun dari ID publisher
// di src/lib/blog/ads.ts supaya tidak ada dua tempat yang harus disamakan.
import { adsTxt } from '@/lib/blog/ads';

export function GET() {
  return new Response(adsTxt(), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
