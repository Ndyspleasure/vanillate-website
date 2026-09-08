// ═══════════════════════════════════════════════════════════════════════════
// PROJECTS — dipakai oleh kartu di beranda (Work.astro) DAN halaman detail
// dengan URL sendiri (/work/[slug]). Master brief §30–31.
// ═══════════════════════════════════════════════════════════════════════════
import { site, type Locale } from './content.ts';

export type Project = {
  slug: string;
  name: string;
  category: string;
  year: string;
  image: string;
  alt: Record<Locale, string>;
  liveUrl: string;
  liveLabel: Record<Locale, string>;
  role: Record<Locale, string>;
  tech: string[];
  summary: Record<Locale, string>;
  body: Record<Locale, string[]>;
  metaTitle: Record<Locale, string>;
  metaDescription: Record<Locale, string>;
};

export const projects: Project[] = [
  {
    slug: 'vanillate-sambung-kata',
    name: 'Vanillate Sambung Kata',
    category: 'Discord Community Game',
    year: '2026',
    image: '/work/vanillate-sambung-kata.png',
    alt: {
      id: 'Vanillate Sambung Kata, permainan komunitas di Discord oleh Andi Kurniawan, Vanillate Studio',
      en: 'Vanillate Sambung Kata, a Discord community game by Andi Kurniawan, Vanillate Studio',
    },
    liveUrl: `${site.studioUrl}/bots/sambung-kata`,
    liveLabel: { id: 'Lihat di Vanillate Studio', en: 'View on Vanillate Studio' },
    role: { id: 'Founder, Pengembang, dan Operasional', en: 'Founder, Developer, and Operations' },
    tech: ['Discord', 'JavaScript', 'Supabase', 'Automation', 'AI'],
    summary: {
      id: 'Permainan komunitas yang dirancang untuk menciptakan interaksi dan menjaga komunitas tetap aktif.',
      en: 'A community game designed to spark interaction and keep communities active.',
    },
    body: {
      id: [
        'Vanillate Sambung Kata adalah produk pertama Vanillate Studio, sebuah permainan sambung kata berbahasa Indonesia yang hidup di dalam komunitas Discord. Tujuannya sederhana namun penting, yaitu membuat komunitas yang mulai sepi kembali ramai lewat interaksi yang ringan dan menyenangkan.',
        'Dibangun di atas kamus lebih dari 25.000 kata dengan konteks lokal Indonesia, permainan ini menekankan respons instan, kestabilan, dan pengalaman yang terus disempurnakan setelah rilis, bukan proyek sekali jalan.',
        'Sebagai founder sekaligus pengembang, saya menangani rancangan produk, pengembangan, hingga operasional harian, mulai dari alur permainan dan integrasi data sampai perawatan serta pembaruan rutin bersama komunitas.',
      ],
      en: [
        'Vanillate Sambung Kata is the first product from Vanillate Studio, an Indonesian word-chain game that lives inside Discord communities. The goal is simple but meaningful, bringing quiet communities back to life through light, enjoyable interaction.',
        'Built on a dictionary of more than 25,000 words with local Indonesian context, it emphasizes instant responses, stability, and an experience that keeps improving after launch rather than a one-off project.',
        'As founder and developer, I handle product design, development, and daily operations, from game flow and data integration to ongoing maintenance and updates alongside the community.',
      ],
    },
    metaTitle: {
      id: 'Vanillate Sambung Kata, Permainan Komunitas Discord oleh Andi Kurniawan',
      en: 'Vanillate Sambung Kata, a Discord Community Game by Andi Kurniawan',
    },
    metaDescription: {
      id: 'Studi kasus Vanillate Sambung Kata, permainan komunitas Discord oleh Andi Kurniawan, founder Vanillate Studio. Menyoroti peran, teknologi, dan latar belakang produk.',
      en: 'A case study of Vanillate Sambung Kata, a Discord community game by Andi Kurniawan, founder of Vanillate Studio. Covering the role, technology, and product background.',
    },
  },
];

export const getProject = (slug: string) => projects.find((p) => p.slug === slug);
