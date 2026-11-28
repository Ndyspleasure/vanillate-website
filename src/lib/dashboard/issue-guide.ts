// ════════════════════════════════════════════════════════════════════════════
//  Vanillate Dashboard: buku panduan kendala (satu sumber teks).
//
//  Setiap kendala (Issue dari bot atau pemeriksaan di browser) diterjemahkan
//  menjadi kartu tetap: tingkat, judul singkat, penyebab, langkah bernomor, dan
//  tombol aksi. Pop up kendala, lencana, kartu fitur, Ringkasan, dan Riwayat
//  membaca modul ini, jadi perbaikan teks cukup di satu tempat.
//
//  Murni (tanpa DOM, tanpa jaringan). Acuan teks dan keputusan pemilik:
//  docs/DASHBOARD-PANDUAN-KENDALA.md. Tes: tests/dashboard-issue-guide.test.ts.
//
//  Aturan teks (CLAUDE.md): tanpa tanda pisah sebagai penghubung kalimat.
// ════════════════════════════════════════════════════════════════════════════

import {
  categoryLabel,
  channelLabel,
  permissionFix,
  REINVITE_LABEL,
  roleLabel,
  typedSettings,
  type Issue,
  type PermissionFix,
  type TextContext,
} from './model.ts';

/** 🔴 fitur tidak jalan (pop up), 🟡 perlu dicek (lencana), ⚪ salah isi form (kartu fitur). */
export type GuideLevel = 'red' | 'yellow' | 'info';

export type GuideAction =
  | { kind: 'reinvite' }
  | { kind: 'invite' }
  | { kind: 'check' }
  | { kind: 'open-channel'; channelId: string }
  | { kind: 'goto'; feature: string; label: string }
  | { kind: 'retry-apply' }
  | { kind: 'apply-pending' }
  | { kind: 'view-changes' }
  | { kind: 'reload-latest' }
  | { kind: 'reload' }
  | { kind: 'contact' };

export interface Guide {
  /** Sidik kendala, dipakai untuk "sudah dilihat" dan penggabungan. */
  id: string;
  code: string;
  level: GuideLevel;
  title: string;
  cause: string;
  steps: string[];
  actions: GuideAction[];
  /** Fitur yang terdampak (kunci registry), kosong untuk kendala halaman. */
  features: string[];
}

/** Dari mana kendala datang: ditolak bot saat menerapkan, terlihat dari data Discord, atau isian draft. */
export type IssueSource = 'bot' | 'live' | 'draft';

// ─── Label tombol (satu tempat, dipakai halaman) ────────────────────────────

export const CHECK_LABEL = 'Cek lagi';
export const RETRY_APPLY_LABEL = 'Coba terapkan lagi';
export const APPLY_PENDING_LABEL = 'Terapkan perubahan ini';
export const CONTACT_LABEL = 'Masih bingung? Hubungi tim';

export function actionLabel(a: GuideAction): string {
  switch (a.kind) {
    case 'reinvite':
      return REINVITE_LABEL;
    case 'invite':
      return 'Undang bot';
    case 'check':
      return CHECK_LABEL;
    case 'open-channel':
      return 'Buka channel di Discord';
    case 'goto':
      return a.label;
    case 'retry-apply':
      return RETRY_APPLY_LABEL;
    case 'apply-pending':
      return APPLY_PENDING_LABEL;
    case 'view-changes':
      return 'Lihat perubahan';
    case 'reload-latest':
      return 'Muat versi terbaru';
    case 'reload':
      return 'Muat ulang';
    case 'contact':
      return CONTACT_LABEL;
  }
}

// ─── Nama izin dua bahasa ───────────────────────────────────────────────────

/** Nama izin di Discord berbahasa Indonesia (kunci = nama Inggris yang dikirim bot). */
export const PERMISSION_ID: Readonly<Record<string, string>> = Object.freeze({
  'View Channel': 'Lihat Saluran',
  'Send Messages': 'Kirim Pesan',
  'Send Messages in Threads': 'Kirim Pesan di Thread',
  'Embed Links': 'Sematkan Tautan',
  'Attach Files': 'Lampirkan File',
  'Read Message History': 'Baca Riwayat Pesan',
  'Add Reactions': 'Tambahkan Reaksi',
  'Use External Emojis': 'Gunakan Emoji Eksternal',
  'Manage Messages': 'Kelola Pesan',
  'Pin Messages': 'Sematkan Pesan',
  'Manage Threads': 'Kelola Thread',
  'Create Public Threads': 'Buat Thread Publik',
  'Create Private Threads': 'Buat Thread Pribadi',
  'Mention Everyone': 'Sebut @everyone',
  'Manage Channels': 'Kelola Saluran',
  'Manage Roles': 'Kelola Peran',
  'Manage Server': 'Kelola Server',
  'Kick Members': 'Keluarkan Anggota',
  'View Audit Log': 'Lihat Log Audit',
  'Create Invite': 'Buat Undangan',
  Connect: 'Hubungkan',
  Speak: 'Bicara',
  Administrator: 'Administrator',
});

/** "Send Messages (Kirim Pesan)"; nama yang belum dikenal tampil apa adanya. */
export function permissionLabel(name: string): string {
  const id = PERMISSION_ID[name];
  return id && id !== name ? `${name} (${id})` : name;
}

function listJoin(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} dan ${items[items.length - 1]}`;
}

const permList = (names: string[] | undefined) => listJoin((names ?? []).map(permissionLabel));

// Nama menu Discord dua bahasa (dipakai di langkah).
const MENU_ROLES = 'Pengaturan Server › Roles (Peran)';
const MENU_CHANNEL_PERMS = 'Edit Channel › Permissions (Izin)';
const AUTHORIZE = 'Authorize (Otorisasi)';

// ─── Penyebab role yang tidak bisa diberikan ────────────────────────────────

export type RoleReason = 'MANAGE_ROLES_MISSING' | 'ROLE_TOO_LOW' | 'ROLE_MANAGED' | 'EVERYONE' | 'NOT_MENTIONABLE' | 'UNKNOWN';

/**
 * Kode penyebab ROLE_UNUSABLE. Bot baru mengirim `reason_code`; bot lama hanya
 * mengirim kalimat `reason`, jadi kalimat itu dikenali sebagai cadangan.
 */
export function roleReason(issue: Pick<Issue, 'reason' | 'reason_code' | 'key'>): RoleReason {
  const known: RoleReason[] = ['MANAGE_ROLES_MISSING', 'ROLE_TOO_LOW', 'ROLE_MANAGED', 'EVERYONE', 'NOT_MENTIONABLE'];
  if (issue.reason_code && (known as string[]).includes(issue.reason_code)) return issue.reason_code as RoleReason;
  const r = issue.reason ?? '';
  if (/Manage Roles/i.test(r)) return 'MANAGE_ROLES_MISSING';
  if (/integrasi/i.test(r)) return 'ROLE_MANAGED';
  if (/@everyone/i.test(r)) return 'EVERYONE';
  if (/mention/i.test(r)) return 'NOT_MENTIONABLE';
  if (/posisi|sejajar|lebih tinggi/i.test(r)) return 'ROLE_TOO_LOW';
  return 'UNKNOWN';
}

// ─── Teks per kode ──────────────────────────────────────────────────────────

function featureName(ctx: TextContext, key: string | undefined): string {
  if (!key) return 'Fitur';
  return ctx.registry.find((f) => f.key === key)?.name ?? key;
}

function settingTitle(ctx: TextContext, issue: Issue): string {
  const f = ctx.registry.find((x) => x.key === issue.feature);
  return (f && typedSettings(f).find((p) => p.key === issue.key)?.title) || issue.key || 'setelan';
}

type Body = Omit<Guide, 'id' | 'code' | 'features'>;

const INVITE_STEPS = [
  `Tekan ${REINVITE_LABEL}.`,
  `Pilih server ini, lalu tekan ${AUTHORIZE}.`,
  `Kembali ke sini dan tekan ${CHECK_LABEL}.`,
];

function body(issue: Issue, ctx: TextContext, source: IssueSource): Body {
  const name = featureName(ctx, issue.feature);
  const ch = channelLabel(ctx, issue.channel_id, issue.channel_name);
  const f = issue.feature ?? '';
  const pickChannel = (label = 'Pilih channel lain'): GuideAction => ({ kind: 'goto', feature: f, label });
  const pickRole: GuideAction = { kind: 'goto', feature: f, label: 'Pilih role lain' };
  const role = roleLabel(ctx, issue.role_id);

  switch (issue.code) {
    case 'MISSING_PERMISSIONS': {
      const perms = permList(issue.missing);
      const fix: PermissionFix = issueFixOf(issue, ctx) ?? 'unknown';
      if (fix === 'reinvite') {
        return {
          level: 'red',
          title: `Bot kurang izin di ${ch}`,
          cause: `Role bot belum punya izin ${perms}, jadi ${name} tidak bisa berjalan di channel itu.`,
          steps: [...INVITE_STEPS, 'Pengaturan bot yang sudah ada tidak hilang.'],
          actions: [{ kind: 'reinvite' }, { kind: 'check' }],
        };
      }
      if (fix === 'channel') {
        return {
          level: 'red',
          title: `Channel ${ch} menolak izin bot`,
          cause: `Role bot sudah punya izin ${perms}, tetapi pengaturan channel ${ch} atau kategorinya menolak izin itu. Mengundang ulang bot tidak membantu untuk kendala ini.`,
          steps: [
            `Buka ${ch} di Discord, pilih ${MENU_CHANNEL_PERMS}.`,
            `Tambahkan role bot, lalu beri centang hijau pada ${perms}.`,
            `Kembali ke sini dan tekan ${CHECK_LABEL}.`,
            `Cara lain: pilih channel lain untuk ${name}.`,
          ],
          actions: [
            ...(issue.channel_id ? [{ kind: 'open-channel', channelId: issue.channel_id } as GuideAction] : []),
            pickChannel(),
            { kind: 'check' },
          ],
        };
      }
      if (fix === 'stale') {
        return {
          level: 'yellow',
          title: 'Data izin bot perlu diperbarui',
          cause: 'Bot memegang izin Administrator, jadi seharusnya tidak ada izin yang kurang. Data Discord yang tersimpan kemungkinan sudah lama.',
          steps: [`Tekan ${CHECK_LABEL}.`, 'Bila kendala ini masih muncul, hubungi tim kami.'],
          actions: [{ kind: 'check' }, { kind: 'contact' }],
        };
      }
      return {
        level: 'red',
        title: `Bot kurang izin di ${ch}`,
        cause: `Bot tidak punya izin ${perms} di ${ch}. Kami belum bisa memastikan apakah kurangnya di role bot atau di pengaturan channel.`,
        steps: [
          `Tekan ${REINVITE_LABEL}, pilih server ini, lalu ${AUTHORIZE}.`,
          `Tekan ${CHECK_LABEL}.`,
          'Bila kendala masih ada, panduan berikutnya muncul di sini.',
        ],
        actions: [{ kind: 'reinvite' }, { kind: 'check' }],
      };
    }
    case 'MISSING_GUILD_PERMISSIONS': {
      const perms = permList(issue.missing);
      const fix = issueFixOf(issue, ctx);
      if (fix === 'reinvite' || fix === 'unknown') {
        return {
          level: 'red',
          title: `Bot kurang izin server ${perms}`,
          cause: `${name} butuh izin ${perms} di tingkat server, dan role bot belum memilikinya.`,
          steps: INVITE_STEPS,
          actions: [{ kind: 'reinvite' }, { kind: 'check' }],
        };
      }
      if (fix === 'stale') {
        return {
          level: 'yellow',
          title: 'Data izin bot perlu diperbarui',
          cause: 'Bot memegang izin Administrator, jadi seharusnya tidak ada izin yang kurang. Data Discord yang tersimpan kemungkinan sudah lama.',
          steps: [`Tekan ${CHECK_LABEL}.`, 'Bila kendala ini masih muncul, hubungi tim kami.'],
          actions: [{ kind: 'check' }, { kind: 'contact' }],
        };
      }
      return {
        level: 'red',
        title: `Bot kurang izin server ${perms}`,
        cause: `${name} butuh izin ${perms}, dan izin ini perlu dinyalakan manual.`,
        steps: [
          `Buka ${MENU_ROLES}.`,
          'Pilih role bot, buka tab Permissions (Izin).',
          `Nyalakan ${perms}, simpan, lalu tekan ${CHECK_LABEL}.`,
        ],
        actions: [{ kind: 'check' }],
      };
    }
    case 'CHANNEL_NOT_FOUND':
      return {
        level: source === 'bot' ? 'red' : 'yellow',
        title: `Channel ${name} tidak ditemukan`,
        cause: `Channel ${ch} sudah tidak ada di server, mungkin dihapus.`,
        steps: [`Bila channel baru saja dibuat ulang, tekan ${CHECK_LABEL}.`, `Bila tidak, pilih channel lain untuk ${name}, lalu simpan.`],
        actions: [pickChannel(), { kind: 'check' }],
      };
    case 'CHANNEL_TYPE_INVALID':
      return {
        level: 'info',
        title: 'Jenis channel tidak cocok',
        cause: `${ch} bukan channel teks biasa.`,
        steps: ['Pilih channel teks, bukan voice, forum, atau kategori.'],
        actions: [pickChannel()],
      };
    case 'CHANNEL_REQUIRED':
      return {
        level: 'info',
        title: `${name} belum punya channel`,
        cause: 'Fitur ini butuh channel selama aktif.',
        steps: ['Pilih channel, atau matikan fitur ini.'],
        actions: [pickChannel('Pilih channel')],
      };
    case 'CHANNEL_CONFLICT':
      return {
        level: 'info',
        title: 'Satu channel dipakai dua fitur',
        cause: `${name} dan ${featureName(ctx, issue.other_feature)} tidak boleh memakai channel yang sama (${ch}).`,
        steps: ['Pilih channel lain untuk salah satu fitur.'],
        actions: [pickChannel()],
      };
    case 'ROLE_NOT_FOUND':
      return {
        level: source === 'bot' ? 'red' : 'yellow',
        title: 'Role tidak ditemukan',
        cause: `Role untuk ${settingTitle(ctx, issue)} di ${name} sudah tidak ada di server, mungkin dihapus.`,
        steps: [`Bila role baru saja dibuat ulang, tekan ${CHECK_LABEL}.`, 'Bila tidak, pilih role lain.'],
        actions: [pickRole, { kind: 'check' }],
      };
    case 'ROLE_UNUSABLE':
      switch (roleReason(issue)) {
        case 'MANAGE_ROLES_MISSING':
          return {
            level: 'red',
            title: 'Bot belum boleh memberi role',
            cause: `Role bot belum punya izin ${permissionLabel('Manage Roles')}, jadi ${name} tidak bisa memberikan ${role}.`,
            steps: [`Tekan ${REINVITE_LABEL}, pilih server ini, lalu ${AUTHORIZE}.`, `Tekan ${CHECK_LABEL}.`],
            actions: [{ kind: 'reinvite' }, { kind: 'check' }],
          };
        case 'ROLE_TOO_LOW':
          return {
            level: 'red',
            title: 'Role bot terlalu rendah',
            cause: `Bot hanya bisa memberi role yang posisinya di bawah role bot. Saat ini ${role} sejajar atau di atasnya, jadi ${name} belum bisa memberikannya.`,
            steps: [`Buka ${MENU_ROLES}.`, `Seret role bot ke atas ${role}.`, `Tekan ${CHECK_LABEL}.`],
            actions: [{ kind: 'check' }],
          };
        case 'ROLE_MANAGED':
          return {
            level: 'red',
            title: 'Role ini tidak bisa diberikan',
            cause: `${role} dikelola integrasi, misalnya bot lain, Server Booster, atau langganan. Tidak ada bot yang boleh memberikannya, walau posisinya dinaikkan.`,
            steps: [`Pilih role lain untuk ${settingTitle(ctx, issue)}.`],
            actions: [pickRole],
          };
        case 'EVERYONE':
          return {
            level: 'info',
            title: '@everyone tidak bisa jadi penerima',
            cause: 'Role @everyone tidak boleh dipakai sebagai penerima notifikasi.',
            steps: ['Pilih role lain.'],
            actions: [pickRole],
          };
        case 'NOT_MENTIONABLE':
          return {
            level: 'yellow',
            title: 'Role tidak bisa di-mention bot',
            cause: `${role} belum mengizinkan mention, jadi notifikasi ${name} tidak akan memanggil anggotanya.`,
            steps: [
              `Buka ${MENU_ROLES}, pilih ${role}.`,
              'Nyalakan "Allow anyone to @mention this role" (Izinkan siapa pun @mention peran ini).',
              `Tekan ${CHECK_LABEL}.`,
            ],
            actions: [{ kind: 'check' }, pickRole],
          };
        default:
          return {
            level: 'red',
            title: 'Role tidak bisa diberikan bot',
            cause: issue.reason ? `${name} tidak bisa memakai ${role}. Keterangan dari bot: ${issue.reason.replace(/\.?$/, '.')}` : `${name} tidak bisa memakai ${role}.`,
            steps: [`Tekan ${CHECK_LABEL}.`, 'Bila masih ada, pilih role lain atau hubungi tim kami.'],
            actions: [{ kind: 'check' }, pickRole],
          };
      }
    case 'ROLE_CONFLICT':
      if (issue.key === 'unverified_role') {
        return {
          level: 'info',
          title: 'Role yang sama dipakai dua kali',
          cause: 'Role belum terverifikasi tidak boleh sama dengan Verified Role.',
          steps: ['Pilih role lain.'],
          actions: [pickRole],
        };
      }
      if (issue.key === 'member_roles' || issue.key === 'bot_roles') {
        return {
          level: 'info',
          title: 'Role ini milik Verification',
          cause: `${role} dipakai sebagai Verified Role, jadi tidak boleh diberikan otomatis ke member baru.`,
          steps: ['Pilih role lain di Auto Role.'],
          actions: [pickRole],
        };
      }
      return {
        level: 'info',
        title: 'Role ini milik Verification',
        cause: `${role} sudah dipakai Verification sebagai Verified Role atau role belum terverifikasi, jadi tidak bisa dijadikan hadiah level.`,
        steps: ['Pilih role lain untuk hadiah level.'],
        actions: [pickRole],
      };
    case 'SETTING_REQUIRED':
      return {
        level: 'info',
        title: `${settingTitle(ctx, issue)} belum diisi`,
        cause: `Setelan ini wajib diisi selama ${name} aktif.`,
        steps: [`Isi ${settingTitle(ctx, issue)}, atau matikan fitur ini.`],
        actions: [{ kind: 'goto', feature: f, label: 'Isi sekarang' }],
      };
    case 'SETTING_OUT_OF_RANGE':
      return {
        level: 'info',
        title: 'Nilai di luar batas',
        cause: `${name}: ${settingTitle(ctx, issue)} harus antara ${issue.min ?? '…'} dan ${issue.max ?? '…'}.`,
        steps: ['Ubah nilainya supaya masuk batas.'],
        actions: [{ kind: 'goto', feature: f, label: 'Ubah nilai' }],
      };
    case 'SETTING_INVALID':
      return {
        level: 'info',
        title: 'Nilai tidak bisa dipakai',
        cause: `Isi ${settingTitle(ctx, issue)} di ${name} tidak sesuai format yang dibutuhkan bot.`,
        steps: ['Periksa lagi isinya. Bila yakin sudah benar, muat ulang halaman lalu coba lagi.'],
        actions: [{ kind: 'goto', feature: f, label: 'Ubah nilai' }],
      };
    case 'REWARD_LIMIT':
      return {
        level: 'info',
        title: 'Terlalu banyak hadiah level',
        cause: `Hadiah ${categoryLabel(issue.category)} paling banyak ${issue.max ?? '…'} baris.`,
        steps: ['Hapus sebagian baris hadiah.'],
        actions: [{ kind: 'goto', feature: f, label: 'Atur hadiah' }],
      };
    case 'REWARD_DUPLICATE':
      return {
        level: 'info',
        title: 'Dua hadiah di level yang sama',
        cause: `${issue.level ? `Level ${issue.level}` : 'Satu level'} punya dua hadiah ${categoryLabel(issue.category)}. Satu level hanya boleh punya satu hadiah per kategori.`,
        steps: ['Hapus salah satu, atau ganti levelnya.'],
        actions: [{ kind: 'goto', feature: f, label: 'Atur hadiah' }],
      };
    case 'NO_DISCORD_DATA':
      return {
        level: 'yellow',
        title: 'Daftar channel belum dimuat',
        cause: 'Bot belum mengirim daftar channel dan role server ini.',
        steps: [`Tekan ${CHECK_LABEL}, lalu tunggu beberapa detik.`],
        actions: [{ kind: 'check' }],
      };
    case 'BOT_NOT_IN_GUILD':
      return BOT_MISSING;
    case 'ACTOR_FORBIDDEN':
      return {
        level: 'red',
        title: 'Perubahan terakhir ditahan bot',
        cause: 'Orang yang menyimpan perubahan ini sudah tidak punya izin Manage Server, jadi bot belum mau menerapkannya.',
        steps: ['Lihat isi perubahannya di Riwayat.', `Bila kamu setuju, tekan ${APPLY_PENDING_LABEL}.`, 'Bila tidak, ubah lalu simpan ulang.'],
        actions: [{ kind: 'view-changes' }, { kind: 'apply-pending' }],
      };
    case 'APPLY_FAILED':
      return {
        level: 'red',
        title: 'Bot gagal menerapkan pengaturan',
        cause: 'Terjadi gangguan saat bot menerapkan revisi ini. Pengaturan lama tetap berlaku.',
        steps: [`Tunggu sebentar, lalu tekan ${RETRY_APPLY_LABEL}.`, 'Bila gagal lagi, hubungi tim kami.'],
        actions: [{ kind: 'retry-apply' }, { kind: 'contact' }],
      };
    case 'UNKNOWN_FEATURE':
      return {
        level: 'yellow',
        title: 'Fitur belum dikenal bot',
        cause: `${issue.feature ? `${name} belum` : 'Fitur ini belum'} dikenal oleh versi bot yang sedang berjalan. Biasanya hilang sendiri setelah bot diperbarui.`,
        steps: ['Bila masih muncul setelah satu hari, hubungi tim kami.'],
        actions: [{ kind: 'contact' }],
      };
    case 'UNKNOWN_PURPOSE':
    case 'INVALID_CHANNEL':
    case 'INVALID_PAYLOAD':
    case 'SETTINGS_INVALID':
      return {
        level: 'yellow',
        title: 'Data pengaturan tidak terbaca',
        cause: `Data pengaturan ${name} tidak sesuai format yang dikenal bot.`,
        steps: ['Muat ulang halaman, lalu coba lagi.', 'Bila terulang, hubungi tim kami.'],
        actions: [{ kind: 'reload' }, { kind: 'contact' }],
      };
    default:
      return {
        level: 'yellow',
        title: `${name} mengalami kendala`,
        cause: issue.detail ? issue.detail.replace(/\.?$/, '.') : `Kami belum punya panduan untuk kendala ini (kode ${issue.code}).`,
        steps: [`Tekan ${CHECK_LABEL}.`, 'Bila masih ada, hubungi tim kami.'],
        actions: [{ kind: 'check' }, { kind: 'contact' }],
      };
  }
}

const BOT_MISSING: Body = {
  level: 'red',
  title: 'Bot tidak ada di server ini',
  cause: 'Bot belum diundang atau sudah dikeluarkan, jadi pengaturan tidak bisa diterapkan. Pengaturan yang tersimpan tetap ada.',
  steps: ['Tekan Undang bot.', `Pilih server ini, lalu ${AUTHORIZE}.`, 'Muat ulang halaman ini.'],
  actions: [{ kind: 'invite' }],
};

function issueFixOf(issue: Issue, ctx: TextContext): PermissionFix | null {
  if (issue.code !== 'MISSING_PERMISSIONS' && issue.code !== 'MISSING_GUILD_PERMISSIONS') return null;
  return permissionFix(ctx.snapshot, issue.missing ?? [], ctx.invitePermissions ?? '0');
}

function issueId(issue: Issue): string {
  return [issue.code, issue.feature ?? '', issue.purpose ?? '', issue.channel_id ?? '', issue.key ?? '', issue.role_id ?? '', (issue.missing ?? []).join('+')].join('|');
}

/** Kartu panduan untuk satu kendala. */
export function issueGuide(issue: Issue, ctx: TextContext, source: IssueSource = 'live'): Guide {
  const b = body(issue, ctx, source);
  // Tingkat isian draft selalu ⚪ kecuali izin dan role (fitur memang tidak akan jalan).
  return { ...b, id: issueId(issue), code: issue.code, features: issue.feature ? [issue.feature] : [] };
}

/** Kalimat datar (penyebab + langkah) untuk tempat sempit: kartu fitur, Riwayat. */
export function describeIssue(issue: Issue, ctx: TextContext): string {
  const g = issueGuide(issue, ctx);
  return [`${g.title}.`, g.cause, ...g.steps].join(' ');
}

// ─── Kendala tingkat halaman ────────────────────────────────────────────────

export interface PageIssueState {
  botInstalled: boolean;
  botOnline: boolean;
  /** Draft dibuat dari revisi lama: ada yang menyimpan di tempat lain. */
  remoteChanged: boolean;
  revision: number | null;
  syncTimedOut: boolean;
  /** Daftar channel dari Discord belum pernah dimuat. */
  noDiscordData: boolean;
  /** Kalimat gagal memuat (describeError), bila ada. */
  loadError: string | null;
}

export function pageGuides(s: PageIssueState): Guide[] {
  const page = (id: string, b: Body): Guide => ({ ...b, id: `page|${id}`, code: id, features: [] });
  if (!s.botInstalled) return [page('BOT_NOT_IN_GUILD', BOT_MISSING)];
  const out: Guide[] = [];
  if (s.loadError) {
    out.push(page('LOAD_FAILED', { level: 'yellow', title: 'Data terbaru gagal dimuat', cause: s.loadError, steps: ['Periksa koneksi internet, lalu muat ulang halaman.'], actions: [{ kind: 'reload' }] }));
  }
  if (s.remoteChanged) {
    out.push(page(`REMOTE_CHANGED|${s.revision ?? ''}`, {
      level: 'red',
      title: 'Ada perubahan dari admin lain',
      cause: `Pengaturan server ini diubah di tempat lain (revisi ${s.revision ?? '?'}) saat kamu sedang mengedit.`,
      steps: ['Muat versi terbaru sebelum menyimpan, supaya perubahan admin lain tidak tertimpa.'],
      actions: [{ kind: 'reload-latest' }],
    }));
  }
  if (s.syncTimedOut) {
    out.push(page(`SYNC_TIMEOUT|${s.revision ?? ''}`, {
      level: 'yellow',
      title: 'Bot belum menerapkan perubahan',
      cause: 'Bot belum melapor dalam waktu yang wajar. Bot mungkin sedang sibuk atau offline.',
      steps: [`Tekan ${RETRY_APPLY_LABEL}. Bila bot offline, perubahan akan diterapkan otomatis saat bot kembali online.`],
      actions: [{ kind: 'retry-apply' }],
    }));
  }
  if (s.noDiscordData) out.push(page('NO_DISCORD_DATA', { ...body({ code: 'NO_DISCORD_DATA' }, { registry: [], snapshot: null }, 'live') }));
  if (!s.botOnline) {
    out.push(page('BOT_OFFLINE', {
      level: 'yellow',
      title: 'Bot sedang offline',
      cause: 'Perubahan tetap bisa disimpan dan akan diterapkan otomatis saat bot kembali online.',
      steps: ['Tidak perlu tindakan.'],
      actions: [],
    }));
  }
  return out;
}

// ─── Gabung, urutkan, tampilkan ─────────────────────────────────────────────

const LEVEL_RANK: Record<GuideLevel, number> = { red: 0, yellow: 1, info: 2 };
/** Urutan dalam satu tingkat: gagal diterapkan, izin, role, channel, lainnya. */
const CODE_RANK: Record<string, number> = {
  BOT_NOT_IN_GUILD: 0,
  APPLY_FAILED: 1,
  ACTOR_FORBIDDEN: 1,
  REMOTE_CHANGED: 2,
  MISSING_GUILD_PERMISSIONS: 3,
  MISSING_PERMISSIONS: 3,
  ROLE_UNUSABLE: 4,
  ROLE_NOT_FOUND: 5,
  CHANNEL_NOT_FOUND: 5,
};
const codeRank = (code: string) => CODE_RANK[code.split('|')[0]] ?? 9;

export function sortGuides(list: Guide[]): Guide[] {
  return [...list].sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level] || codeRank(a.code) - codeRank(b.code));
}

/**
 * Kartu kendala untuk pop up dan lencana. Kendala kembar dibuang, dan izin
 * channel yang kurang dengan penyebab sama digabung menjadi satu kartu
 * ("Bot kurang izin Kirim Pesan di 3 channel: #a, #b dan #c").
 */
export function buildGuides(items: { issue: Issue; source: IssueSource }[], ctx: TextContext, page: Guide[] = []): Guide[] {
  const seen = new Set<string>();
  const out: Guide[] = [...page];
  const perms = new Map<string, { issues: Issue[]; guide: Guide }>();
  for (const { issue, source } of items) {
    const g = issueGuide(issue, ctx, source);
    if (seen.has(g.id)) continue;
    seen.add(g.id);
    if (issue.code === 'MISSING_PERMISSIONS' && issue.channel_id) {
      const fix = issueFixOf(issue, ctx);
      const key = `${fix}|${[...(issue.missing ?? [])].sort().join('+')}`;
      const group = perms.get(key);
      if (group) {
        group.issues.push(issue);
        for (const f of g.features) if (!group.guide.features.includes(f)) group.guide.features.push(f);
        continue;
      }
      perms.set(key, { issues: [issue], guide: g });
    }
    out.push(g);
  }
  for (const { issues, guide } of perms.values()) {
    const channels = [...new Set(issues.map((i) => i.channel_id!))];
    if (channels.length < 2) continue;
    const labels = channels.map((id) => channelLabel(ctx, id, issues.find((i) => i.channel_id === id)?.channel_name));
    const perm = permList(issues[0].missing);
    const names = listJoin(guide.features.map((k) => featureName(ctx, k)));
    const fix = issueFixOf(issues[0], ctx);
    guide.id = `group|${guide.id}|${channels.join(',')}`;
    if (fix === 'stale') continue;
    guide.title = `Bot kurang izin ${perm} di ${channels.length} channel`;
    if (fix === 'channel') {
      guide.title = `${channels.length} channel menolak izin bot`;
      guide.cause = `Role bot sudah punya izin ${perm}, tetapi pengaturan channel ${listJoin(labels)} menolaknya. Fitur terdampak: ${names}.`;
      guide.steps = [
        `Buka setiap channel di Discord, pilih ${MENU_CHANNEL_PERMS}.`,
        `Tambahkan role bot, lalu beri centang hijau pada ${perm}.`,
        `Kembali ke sini dan tekan ${CHECK_LABEL}.`,
      ];
      guide.actions = guide.actions.filter((a) => a.kind !== 'open-channel');
    } else {
      guide.cause = `Bot tidak punya izin ${perm} di ${listJoin(labels)}. Fitur terdampak: ${names}.`;
    }
  }
  return sortGuides(out);
}

/** Kendala yang perlu pop up (🔴) dan yang dihitung di lencana (🔴 + 🟡). */
export const popupGuides = (list: Guide[]) => list.filter((g) => g.level === 'red');
export const badgeGuides = (list: Guide[]) => list.filter((g) => g.level !== 'info');

/** Pop up dibuka otomatis bila ada kendala 🔴 yang belum pernah dilihat di sesi ini. */
export function hasUnseen(list: Guide[], seen: ReadonlySet<string>): boolean {
  return popupGuides(list).some((g) => !seen.has(g.id));
}

/** Pesan WhatsApp "Hubungi tim" yang membawa konteks kendala (tanpa data pemain). */
export function contactMessage(guildId: string, g: Guide | null, ctx: TextContext): string {
  const lines = ['Halo tim Vanillate, saya butuh bantuan di Vanillate Dashboard.', `Server ID: ${guildId}`];
  if (g) {
    lines.push(`Kendala: ${g.title} (kode ${g.code.split('|')[0]})`);
    if (g.features.length) lines.push(`Fitur: ${listJoin(g.features.map((k) => featureName(ctx, k)))}`);
  }
  return lines.join('\n');
}
