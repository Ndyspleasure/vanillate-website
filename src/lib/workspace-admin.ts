// ════════════════════════════════════════════════════════════════════════════
//  Katalog konfigurasi bot Vanillate Workspace (untuk panel /admin/workspace).
//
//  KONTRAK: nilai di sini HARUS selaras dengan enum di repo bot
//  `Vanillate-Workspace/src/types/models.ts` (Permission, PermissionScope,
//  AutomationTrigger, AutomationAction, StaffStatus, FeatureState). Bila enum
//  bot berubah, perbarui daftar di bawah. Bot tetap MEMVALIDASI setiap nilai
//  saat menerapkannya — panel ini hanya bantuan input.
// ════════════════════════════════════════════════════════════════════════════

export interface PermCategory {
  key: string;
  label: string;
  emoji: string;
  permissions: string[];
}

/** Kategori izin (mengikuti src/core/permissionMeta.ts di bot). */
export const PERMISSION_CATEGORIES: PermCategory[] = [
  { key: 'umum', label: 'Umum', emoji: '🏠', permissions: ['dashboard.access', 'workspace.manage'] },
  { key: 'task', label: 'Pekerjaan', emoji: '📋', permissions: [
    'task.view', 'task.view_all', 'task.create', 'task.edit', 'task.delete', 'task.assign',
    'task.change_deadline', 'task.change_priority', 'task.complete', 'task.cancel',
    'task.manage_absolute', 'task.review',
  ] },
  { key: 'schedule', label: 'Jadwal', emoji: '📅', permissions: [
    'schedule.view', 'schedule.create', 'schedule.edit', 'schedule.assign', 'holiday.manage',
  ] },
  { key: 'attendance', label: 'Absensi', emoji: '🕐', permissions: [
    'attendance.view_self', 'attendance.view_team', 'attendance.edit', 'attendance.approve_correction',
  ] },
  { key: 'project', label: 'Proyek', emoji: '📁', permissions: [
    'project.view', 'project.create', 'project.edit', 'project.delete',
  ] },
  { key: 'okr', label: 'Target/OKR', emoji: '🎯', permissions: ['okr.view', 'okr.manage'] },
  { key: 'team', label: 'Tim', emoji: '👥', permissions: ['team.view', 'team.manage'] },
  { key: 'role', label: 'Role & Anggota', emoji: '🛡️', permissions: ['role.manage', 'member.manage'] },
  { key: 'approval', label: 'Persetujuan', emoji: '📝', permissions: ['approval.request', 'approval.decide'] },
  { key: 'document', label: 'Dokumen', emoji: '📄', permissions: ['document.view', 'document.manage'] },
  { key: 'report', label: 'Laporan', emoji: '📊', permissions: ['report.view', 'report.view_team', 'report.staff_stats'] },
  { key: 'notif', label: 'Notifikasi & Audit', emoji: '🔔', permissions: ['notification.broadcast', 'audit.view'] },
  { key: 'developer', label: 'Developer', emoji: '🧑‍💻', permissions: [
    'developer.access', 'developer.workspace.manage', 'developer.staff.manage', 'developer.welcome.manage',
    'developer.role.manage', 'developer.permission.manage', 'developer.notification.manage',
    'developer.task.manage', 'developer.schedule.manage', 'developer.automation.manage',
    'developer.feature.manage', 'developer.system.manage', 'developer.system.health',
    'developer.audit.view', 'developer.testing',
  ] },
];

export const WILDCARD_PERMISSION = '*';

/** Semua kunci izin (flat). */
export const ALL_PERMISSIONS: string[] = PERMISSION_CATEGORIES.flatMap((c) => c.permissions);

/** Izin yang cakupannya bermakna (SCOPED_PERMISSIONS di bot). */
export const SCOPED_PERMISSIONS: string[] = [
  'task.view', 'task.view_all', 'task.edit', 'task.assign', 'task.review',
  'attendance.view_team', 'report.view', 'report.view_team', 'report.staff_stats',
  'project.view', 'project.edit', 'okr.view',
];

export const PERMISSION_SCOPES = ['own', 'team', 'project', 'workspace'] as const;
export const SCOPE_LABEL: Record<string, string> = {
  own: 'Own (milik sendiri)', team: 'Team', project: 'Project', workspace: 'Workspace (semua)',
};

/** Label ramah dari kunci izin, mis. "task.view_all" → "task · view all". */
export function permissionLabel(p: string): string {
  const [ns, ...rest] = p.split('.');
  const action = rest.join('.').replace(/_/g, ' ');
  return `${ns} · ${action || 'akses'}`;
}

export const AUTOMATION_TRIGGERS = [
  { value: 'staff.activated', label: 'Staff menjadi Aktif' },
  { value: 'staff.joined_team', label: 'Staff bergabung ke tim' },
  { value: 'task.completed', label: 'Pekerjaan selesai' },
  { value: 'task.overdue', label: 'Pekerjaan terlambat' },
];

export const AUTOMATION_ACTIONS = [
  { value: 'send_welcome', label: 'Kirim Welcome' },
  { value: 'assign_onboarding', label: 'Beri langkah Onboarding' },
  { value: 'notify_team_lead', label: 'Beritahu Ketua Tim' },
  { value: 'notify', label: 'Kirim Notifikasi (butuh pesan)' },
  { value: 'assign_first_task', label: 'Buat Pekerjaan Pertama' },
];

export const STAFF_STATUSES = [
  { value: 'candidate', label: 'Kandidat' },
  { value: 'pending', label: 'Menunggu' },
  { value: 'active', label: 'Aktif' },
  { value: 'inactive', label: 'Nonaktif' },
  { value: 'suspended', label: 'Ditangguhkan' },
  { value: 'resigned', label: 'Mengundurkan diri' },
  { value: 'rejected', label: 'Ditolak' },
];

export const NOTIFICATION_TYPES = [
  'penugasan_baru', 'pekerjaan_selesai', 'pekerjaan_hampir_jatuh_tempo', 'pekerjaan_terlambat',
  'mention', 'jadwal_kerja', 'pengingat_absensi', 'perubahan_jadwal', 'perubahan_proyek',
  'target_okr', 'pengumuman', 'permintaan_persetujuan', 'daily_brief', 'eskalasi',
];

export const DAY_LABELS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

/** Prefix ID (mengikuti store/id.ts bot) — dipakai saat membuat baris baru. */
export function newWorkspaceId(prefix: string): string {
  const ALPHABET = '0123456789ABCDEFGHJKLMNPQRSTVWXYZ';
  let out = '';
  for (let i = 0; i < 6; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return `${prefix}-${out}`;
}

/** Parse daftar angka menit dari string "1440, 180, 60". */
export function parseMinutes(s: string): number[] {
  return s.split(',').map((x) => parseInt(x.trim(), 10)).filter((n) => Number.isFinite(n) && n >= 0);
}
