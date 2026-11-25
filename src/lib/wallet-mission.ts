// 💜 Vanillate Wallet › Misi Cuan: aturan formulir misi di browser.
// Sama dengan `normalizeMission` di bot (src/wallet/missions.js). Ini hanya
// umpan balik; validasi akhir selalu di bot (`sys.wallet.mission.save`).

export const MAX_REWARD = 1_000_000;
export const MAX_QUOTA = 100_000;

export interface MissionForm {
  id?: number | string | null;
  title: string;
  description: string;
  instructions: string;
  requirements?: string;
  targetUrl?: string;
  rewardVp: number | string;
  proofLink: boolean;
  proofText: boolean;
  proofImage: boolean;
  startsAt?: string;
  endsAt?: string;
  quota?: number | string | null;
  sortOrder?: number | string | null;
  active: boolean;
}

export interface MissionCheck {
  ok: boolean;
  error: string | null;
  payload: Record<string, unknown> | null;
}

const trim = (v: unknown) => String(v ?? '').trim();

function lengthError(v: string, min: number, max: number, label: string): string | null {
  if (v.length < min || v.length > max) return `${label} harus ${min} sampai ${max} karakter.`;
  return null;
}

/** `<input type="datetime-local">` (waktu lokal browser) → ISO UTC, kosong = null. */
export function localToIso(v: string | undefined | null): string | null {
  const s = trim(v);
  if (!s) return null;
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/** ISO → nilai `datetime-local` di zona browser. */
export function isoToLocal(v: string | number | null | undefined): string {
  if (v == null || v === '') return '';
  const d = new Date(v);
  if (!Number.isFinite(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function checkMission(f: MissionForm): MissionCheck {
  const fail = (error: string): MissionCheck => ({ ok: false, error, payload: null });
  const title = trim(f.title);
  const description = trim(f.description);
  const instructions = trim(f.instructions);
  const requirements = trim(f.requirements);
  const targetUrl = trim(f.targetUrl);
  const e = lengthError(title, 3, 60, 'Nama misi')
    ?? lengthError(description, 3, 200, 'Deskripsi')
    ?? lengthError(instructions, 3, 1500, 'Instruksi')
    ?? (requirements.length > 800 ? 'Persyaratan maksimal 800 karakter.' : null);
  if (e) return fail(e);
  if (targetUrl && (targetUrl.length > 500 || !/^https:\/\/[^\s<>]+$/i.test(targetUrl))) return fail('Tautan tujuan harus diawali https://.');
  const reward = Number(f.rewardVp);
  if (!Number.isSafeInteger(reward) || reward < 1 || reward > MAX_REWARD) return fail('Reward harus bilangan bulat 1 sampai 1.000.000 VP.');
  if (!f.proofLink && !f.proofText && !f.proofImage) return fail('Pilih minimal satu jenis bukti.');
  const quotaRaw = trim(f.quota);
  const quota = quotaRaw === '' ? null : Number(quotaRaw);
  if (quota != null && (!Number.isSafeInteger(quota) || quota < 1 || quota > MAX_QUOTA)) return fail('Kuota harus 1 sampai 100.000 atau dikosongkan.');
  const sortRaw = trim(f.sortOrder);
  const sortOrder = sortRaw === '' ? 0 : Number(sortRaw);
  if (!Number.isSafeInteger(sortOrder) || sortOrder < -1000 || sortOrder > 1000) return fail('Urutan harus -1000 sampai 1000.');
  const startsAt = localToIso(f.startsAt);
  const endsAt = localToIso(f.endsAt);
  if (trim(f.startsAt) && !startsAt) return fail('Tanggal mulai tidak valid.');
  if (trim(f.endsAt) && !endsAt) return fail('Tanggal berakhir tidak valid.');
  if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) return fail('Tanggal berakhir harus setelah tanggal mulai.');
  const id = f.id == null || f.id === '' ? null : Number(f.id);
  return {
    ok: true,
    error: null,
    payload: {
      ...(id ? { id } : {}),
      title, description, instructions,
      requirements: requirements || null,
      targetUrl: targetUrl || null,
      rewardVp: reward,
      proofLink: !!f.proofLink, proofText: !!f.proofText, proofImage: !!f.proofImage,
      startsAt, endsAt, quota, sortOrder,
      active: !!f.active,
    },
  };
}

export const SUB_STATUS: Record<string, [string, 'ok' | 'warn' | 'bad' | 'muted']> = {
  pending: ['Menunggu review', 'warn'],
  approved: ['Disetujui', 'ok'],
  rejected: ['Ditolak', 'bad'],
  cancelled: ['Tidak terkirim', 'muted'],
};

/** Keadaan misi untuk tabel CMS (sama dengan `closedReason` di bot). */
export function missionState(m: { active: boolean; startsAt: number | null; endsAt: number | null; quota: number | null; approvedCount: number }, now = Date.now()): string {
  if (!m.active) return 'Nonaktif';
  if (m.startsAt && now < m.startsAt) return 'Terjadwal';
  if (m.endsAt && now >= m.endsAt) return 'Berakhir';
  if (m.quota != null && m.approvedCount >= m.quota) return 'Kuota penuh';
  return 'Aktif';
}

/** Tautan ke kartu Discord berisi bukti gambar (channel staff privat). */
export function discordMessageUrl(guildId: string | null | undefined, channelId: string | null, messageId: string | null): string | null {
  const id = /^[0-9]{15,22}$/;
  if (!guildId || !channelId || !messageId || !id.test(guildId) || !id.test(channelId) || !id.test(messageId)) return null;
  return `https://discord.com/channels/${guildId}/${channelId}/${messageId}`;
}
