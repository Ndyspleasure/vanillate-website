// ════════════════════════════════════════════════════════════════════════════
// PARTNERSHIP JASA (/partnership/jasa): normalisasi isi halaman dari CMS
//
// Isi mentah (jsonb) ditarik saat build ke src/data/synced/partnership-jasa.json.
// Modul ini MURNI (tanpa DOM, tanpa Supabase, tanpa env) supaya bisa dites dan dipakai
// halaman statis: membersihkan tipe, memangkas panjang, membuang baris kosong.
// Isi dari admin tidak pernah dipercaya apa adanya.
// ════════════════════════════════════════════════════════════════════════════

export interface JasaSpec { label: string; value: string }
export interface JasaPaket {
  key: string;
  name: string;
  tagline: string;
  badge: string;
  /** null = harga belum diisi (tampil "Hubungi kami"). 0 = gratis. */
  price: number | null;
  currency: string;
  /** Satuan harga, mis. "bulan". Kosong = harga sekali bayar. */
  unit: string;
  priceNote: string;
  specs: JasaSpec[];
  features: string[];
  ctaLabel: string;
}
export interface JasaKonten {
  hero: { title: string; subtitle: string; ctaLabel: string };
  packages: JasaPaket[];
  process: Array<{ n: string; title: string; text: string }>;
  faq: Array<{ q: string; a: string }>;
  cta: { title: string; text: string; label: string };
  seo: { title: string; description: string; ogImage: string };
}

const teks = (v: unknown, maks = 600): string => String(v ?? '').trim().slice(0, maks);
const obj = (v: unknown): Record<string, any> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, any>) : {};
const daftar = (v: unknown, maks: number): any[] => (Array.isArray(v) ? v.slice(0, maks) : []);

function harga(v: unknown): number | null {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function normalisasiJasa(raw: unknown): JasaKonten {
  const c = obj(raw);
  const hero = obj(c.hero);
  const cta = obj(c.cta);
  const seo = obj(c.seo);

  const packages: JasaPaket[] = daftar(c.packages, 12)
    .map((p) => obj(p))
    .map((p, i) => ({
      key: teks(p.key, 60) || `paket-${i + 1}`,
      name: teks(p.name, 80),
      tagline: teks(p.tagline, 200),
      badge: teks(p.badge, 30),
      price: harga(p.price),
      currency: teks(p.currency, 3).toUpperCase() || 'IDR',
      unit: teks(p.unit, 30),
      priceNote: teks(p.priceNote, 300),
      specs: daftar(p.specs, 12)
        .map((s) => obj(s))
        .map((s) => ({ label: teks(s.label, 60), value: teks(s.value, 80) }))
        .filter((s) => s.label && s.value),
      features: daftar(p.features, 12).map((f) => teks(f, 160)).filter(Boolean),
      ctaLabel: teks(p.ctaLabel, 40) || 'Pesan Sekarang',
    }))
    .filter((p) => p.name);

  return {
    hero: {
      title: teks(hero.title, 100) || 'Jasa Bot Discord',
      subtitle: teks(hero.subtitle, 300),
      ctaLabel: teks(hero.ctaLabel, 40) || 'Pesan Sekarang',
    },
    packages,
    process: daftar(c.process, 8)
      .map((s, i) => ({ n: String(i + 1).padStart(2, '0'), title: teks(obj(s).title, 60), text: teks(obj(s).text, 240) }))
      .filter((s) => s.title),
    faq: daftar(c.faq, 20)
      .map((f) => ({ q: teks(obj(f).q, 200), a: teks(obj(f).a, 1000) }))
      .filter((f) => f.q && f.a),
    cta: {
      title: teks(cta.title, 120) || 'Butuh bot untuk komunitasmu?',
      text: teks(cta.text, 300),
      label: teks(cta.label, 40) || 'Hubungi via WhatsApp',
    },
    seo: {
      title: teks(seo.title, 120),
      description: teks(seo.description, 300),
      ogImage: /^https?:\/\//i.test(teks(seo.ogImage, 500)) || teks(seo.ogImage, 500).startsWith('/') ? teks(seo.ogImage, 500) : '',
    },
  };
}

/** Pesan WhatsApp pesanan jasa: tanpa harga dan tanpa ID, hanya paket yang dipilih.
 *  URL-nya dibangun halaman dengan buildWhatsappUrl (src/data/support.ts). */
export function buildJasaMessage(namaPaket?: string | null): string {
  const paket = teks(namaPaket, 80);
  const baris = ['Halo Tim Vanillate,', '', 'Saya ingin memesan jasa bot.'];
  if (paket) baris.push('', `Jasa     : ${paket}`);
  baris.push('', 'Mohon informasi lebih lanjut mengenai ketentuan dan langkah selanjutnya.', '', 'Terima kasih.');
  return baris.join('\n');
}
