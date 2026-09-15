// ─────────────────────────────────────────────────────────────────────────────
// TEAM — anggota tim di balik Vanillate Studio.
//
// SUMBER DATA: src/data/synced/team.json — ditarik dari Supabase saat build
// (scripts/sync-content.mjs). Jadi daftar anggota dikelola dari /admin/team,
// BUKAN ditulis di sini. Halaman /team dan section Team di /about hanya membaca
// modul ini.
//
//   Supabase team_members  →  scripts/sync-content.mjs  →  synced/team.json
//                                                        →  modul ini  →  halaman
//
// Sync hanya menuliskan anggota berstatus 'active' dan sudah mengurutkannya
// berdasarkan display_order, jadi modul ini cukup memvalidasi bentuk datanya.
// ─────────────────────────────────────────────────────────────────────────────

import teamData from './synced/team.json';

export type ProfileType = 'custom' | 'discord' | 'whatsapp' | 'instagram';

export type TeamMember = {
  id: string;
  name: string;
  /** Username Discord tanpa '@' (situs menambahkan '@' saat menampilkan). */
  discordUsername: string;
  position: string;
  /** Deskripsi singkat — opsional; kosong berarti tidak dirender. */
  description: string;
  /** URL foto custom — hanya dipakai bila profileType === 'custom'. */
  profileImage: string;
  profileType: ProfileType;
  /** Tautan profil — opsional; kosong berarti tombol/tautan tidak dirender. */
  profileLink: string;
  displayOrder: number;
};

// Bentuk baris team.json (keluaran sync). Dipisah dari tipe `TeamMember` supaya
// perubahan sumber tidak diam-diam mengubah kontrak yang dipakai komponen.
type RawMember = {
  id?: string;
  name?: string;
  discordUsername?: string;
  position?: string;
  description?: string;
  profileImage?: string;
  profileType?: string;
  profileLink?: string;
  displayOrder?: number;
};

const PROFILE_TYPES: readonly ProfileType[] = ['custom', 'discord', 'whatsapp', 'instagram'];

export const teamUrl = '/team';

// ─────────────────────────────────────────────────────────────────────────────
// Default profile SVG (Discord / WhatsApp / Instagram).
//
// Dipakai bila anggota belum punya foto custom. Sengaja SVG (bukan emoji, bukan
// gambar raster) supaya tajam di ukuran berapa pun. `inner` adalah isi <svg>
// (viewBox 0 0 24 24, fill mengikuti currentColor). `color` adalah warna merek
// yang tetap terbaca baik di background terang maupun gelap; wadah/aksennya yang
// mengikuti tema situs, jadi keseluruhan avatar tetap menyatu di kedua mode.
// ─────────────────────────────────────────────────────────────────────────────
export const DEFAULT_PROFILES: Record<Exclude<ProfileType, 'custom'>, { label: string; color: string; inner: string }> = {
  discord: {
    label: 'Discord',
    color: '#5865F2',
    inner:
      '<path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/>',
  },
  whatsapp: {
    label: 'WhatsApp',
    color: '#25D366',
    inner:
      '<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>',
  },
  instagram: {
    label: 'Instagram',
    color: '#E4405F',
    inner:
      '<path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm7.846-10.405a1.441 1.441 0 01-2.88 0 1.44 1.44 0 012.88 0z"/>',
  },
};

/** True bila anggota memakai foto custom yang benar-benar ada. */
export function hasCustomImage(m: TeamMember): boolean {
  return m.profileType === 'custom' && Boolean(m.profileImage);
}

/**
 * Username Discord siap tampil: '@' + username tanpa '@' ganda.
 * Kosong → string kosong, supaya pemanggil bisa memilih tidak merendernya.
 */
export function discordHandle(username: string | undefined | null): string {
  const clean = String(username ?? '').trim().replace(/^@+/, '');
  return clean ? `@${clean}` : '';
}

/** Hanya izinkan tautan http(s) — menutup skema seperti `javascript:`. */
function safeLink(value: string | undefined | null): string {
  const u = String(value ?? '').trim();
  return /^https?:\/\//i.test(u) ? u : '';
}

function toMember(r: RawMember, i: number): TeamMember {
  const profileType = (PROFILE_TYPES as readonly string[]).includes(r.profileType ?? '')
    ? (r.profileType as ProfileType)
    : 'discord';
  return {
    id: String(r.id ?? `member-${i}`),
    name: String(r.name ?? '').trim(),
    discordUsername: String(r.discordUsername ?? '').trim().replace(/^@+/, ''),
    position: String(r.position ?? '').trim(),
    description: String(r.description ?? '').trim(),
    profileImage: String(r.profileImage ?? '').trim(),
    profileType,
    profileLink: safeLink(r.profileLink),
    displayOrder: Number.isFinite(Number(r.displayOrder)) ? Number(r.displayOrder) : 100,
  };
}

const mentah = ((teamData as { members?: RawMember[] }).members ?? []) as RawMember[];

// Daftar publik anggota tim — SELURUHNYA dari CMS (termasuk Founder & maskot
// Vani), tanpa satu pun anggota yang dipatok di kode. Sudah difilter 'active' &
// diurut di sisi sync; pengurutan diulang di sini agar tetap benar meski
// sumbernya tak urut. Foto anggota boleh berupa aset repo (mis. /VaniStaff.jpg,
// /founder/andi-kurniawan.png) atau hasil unggahan ke Storage — keduanya
// ditangani sama oleh url() di komponen.
export const team: TeamMember[] = mentah
  .map(toMember)
  .filter((m) => m.name)
  .sort((a, b) => a.displayOrder - b.displayOrder);
