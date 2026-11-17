// Data fixture Vanillate Dashboard untuk uji manual dan pengukuran (BUKAN data
// produksi: semua nama, ID, dan angka di sini karangan untuk pengujian).
// Dipakai scripts/dashboard-fixture/run.mjs. Bentuknya mengikuti GuildData,
// AuditRow, dan ShareDashboard di src/lib/dashboard/.

export const GUILD_ID = '900000000000000001';
// Stempel waktu data berpatokan pada saat modul dimuat (stabil antar-respons,
// seperti data nyata). Hanya server_time dan heartbeat bot yang ikut berjalan.
const T0 = Date.now();
const VIEW = { bit: '1024', name: 'View Channel' };
const SEND = { bit: '2048', name: 'Send Messages' };
const ALL = '1099511627775'; // semua izin channel
const ch = (n, name, type = 0, parent = null, perms = ALL) => ({ id: `91000000000000${String(n).padStart(4, '0')}`, name, type, parent_id: parent, position: n, perms });
const role = (n, name, position, managed = false) => ({ id: `92000000000000${String(n).padStart(4, '0')}`, name, position, managed });

export function guildData(now = Date.now(), over = {}) {
  const iso = (msAgo) => new Date(T0 - msAgo).toISOString();
  const cat = ch(1, 'KOMUNITAS', 4);
  const channels = [
    cat,
    ch(2, 'umum', 0, cat.id),
    ch(3, 'sambung-kata', 0, cat.id),
    ch(4, 'counting', 0, cat.id),
    ch(5, 'streak-harian', 0, cat.id, '1024'), // izin Send Messages kurang
    ch(6, 'selamat-datang', 0, cat.id),
    ch(7, 'log-moderasi', 0, cat.id),
    ch(8, 'pengumuman-yang-namanya-sangat-panjang-sekali-untuk-uji-layar-sempit', 5, cat.id),
    ch(9, 'Ruang Suara', 2, cat.id),
  ];
  const roles = [role(1, 'Admin', 9), role(2, 'Moderator', 8), role(3, 'Terverifikasi', 3), role(4, 'Level 10', 2), role(5, 'Vanillate', 10, true)];
  const game = (key, name, sort, runtime, desc) => ({
    key, section: 'game', name, sort, default_enabled: true, description: desc,
    purposes: [{ key: 'main', label: 'Channel khusus', empty_label: 'Semua channel', channel_types: [0], permissions: [VIEW, SEND], help: 'Kosongkan agar bisa dibuka di channel mana pun.' }],
    meta: { runtime_key: runtime, command: '/game' },
  });
  const social = (key, name, sort, runtime, desc) => ({
    key, section: 'social', name, sort, default_enabled: false, description: desc,
    purposes: [{ key: 'main', label: 'Channel khusus', required: true, channel_types: [0], unique_scope: 'social', permissions: [VIEW, SEND] }],
    settings_schema: { properties: { not_used: { type: 'boolean', title: 'Tidak dipakai' } } },
    meta: { runtime_key: runtime },
  });
  const LOCK = 'Fitur ini butuh intent Server Members yang belum aktif untuk bot Vanillate. Ini bukan bug dan tidak ada yang perlu diubah di server Anda.';
  const registry = [
    game('GAME_SAMBUNGKATA', 'Sambung Kata', 10, 'sambungkata', 'Sambung kata dari huruf terakhir, dengan beberapa mode permainan.'),
    game('GAME_UNO', 'UNO', 20, 'uno', 'Permainan kartu UNO untuk 2 sampai 8 pemain.'),
    game('GAME_TEBAKLAGU', 'Tebak Lagu', 30, 'tebaklagu', 'Tebak judul lagu dari potongan lirik.'),
    social('SOCIAL_COUNTING', 'Counting', 110, 'counting', 'Berhitung bergantian di satu channel.'),
    social('SOCIAL_STREAK', 'Streak Harian', 120, 'streak_harian', 'Member menulis sekali sehari untuk menjaga streak.'),
    {
      key: 'VERIFICATION', section: 'verification', name: 'Verification', sort: 210, default_enabled: false,
      description: 'Member baru menyelesaikan verifikasi emoji sebelum mendapat akses.',
      purposes: [{ key: 'panel', label: 'Channel panel verifikasi', required: true, channel_types: [0], permissions: [VIEW, SEND] }],
      settings_schema: { properties: {
        verified_role: { type: 'role', title: 'Verified Role', required: true, order: 1, group: 'Role', help: 'Role yang diberikan setelah lulus.' },
        steps: { type: 'integer', title: 'Jumlah langkah', min: 3, max: 10, default: 5, order: 2, group: 'Aturan' },
        unverified_role: { type: 'role', title: 'Role belum terverifikasi', order: 3, available: false, requires: 'guild_members_intent', locked_note: LOCK },
        panel_title: { type: 'string', title: 'Judul panel', max_length: 80, order: 4, group: 'Panel', category: 'message', placeholder: 'Verifikasi dulu ya' },
      } },
      meta: { runtime_key: 'verification' },
    },
    {
      key: 'LEVELING', section: 'leveling', name: 'Leveling', sort: 220, default_enabled: false,
      description: 'XP dari chat dan voice, dengan role hadiah per level.',
      purposes: [{ key: 'levelup', label: 'Channel pengumuman level', channel_types: [0], empty_label: 'Channel tempat member chat', permissions: [VIEW, SEND] }],
      settings_schema: { properties: {
        mode: { type: 'enum', title: 'Mode', values: ['chat', 'voice', 'combined'], labels: { chat: 'Chat', voice: 'Voice', combined: 'Combined' }, default: 'combined', order: 1, group: 'Umum' },
        no_xp_channels: { type: 'channel_list', title: 'Channel tanpa XP', max_items: 20, order: 2, group: 'Umum' },
        rewards: { type: 'reward_list', title: 'Level Rewards', limits: { chat: 10, voice: 10, combined: 5 }, max_level: 100, order: 3, group: 'Hadiah' },
        levelup_text: { type: 'string', title: 'Pesan naik level', max_length: 300, order: 4, group: 'Pesan naik level', category: 'message', placeholder: 'Selamat {user}, kamu naik ke level {level}!' },
      } },
      meta: { runtime_key: 'leveling' },
    },
    {
      key: 'AUTOROLE', section: 'autorole', name: 'Auto Role', sort: 230, default_enabled: false,
      description: 'Role otomatis untuk member dan bot yang baru masuk.', purposes: [],
      settings_schema: { properties: {
        member_roles: { type: 'role_list', title: 'Role member', max_items: 5, available: false, requires: 'guild_members_intent', locked_note: LOCK },
        bot_roles: { type: 'role_list', title: 'Role bot', max_items: 5, available: false, requires: 'guild_members_intent', locked_note: LOCK },
      } },
      meta: { runtime_key: 'autorole' },
    },
    {
      key: 'WELCOME', section: 'welcome', name: 'Welcome', sort: 240, default_enabled: false,
      description: 'Pesan sambutan saat member masuk dan pamit saat keluar.',
      purposes: [
        { key: 'welcome', label: 'Channel welcome', channel_types: [0], permissions: [VIEW, SEND] },
        { key: 'goodbye', label: 'Channel goodbye', channel_types: [0], permissions: [VIEW, SEND] },
      ],
      settings_schema: { properties: {
        welcome_text: { type: 'string', title: 'Isi pesan welcome', max_length: 500, order: 1, group: 'Welcome', category: 'message', placeholder: 'Halo {user}, selamat datang di {server}!' },
        welcome_color: { type: 'color', title: 'Warna kartu', order: 2, group: 'Welcome', category: 'message', placeholder: '#F3C158' },
      } },
      meta: { runtime_key: 'welcome' },
    },
    {
      key: 'SECURITY', section: 'security', name: 'Security Center', sort: 250, default_enabled: false,
      description: 'Catatan kick dan ban dengan kategori alasan.',
      purposes: [{ key: 'log', label: 'Channel log', required: true, channel_types: [0], permissions: [VIEW, SEND] }],
      settings_schema: { properties: {
        mod_roles: { type: 'role_list', title: 'Role moderator', max_items: 5, required: true, order: 1 },
        rejoin_alert: { type: 'boolean', title: 'Peringatan masuk ulang', order: 2, available: false, locked_note: LOCK },
      } },
      meta: { runtime_key: 'security' },
    },
  ];
  const C = Object.fromEntries(channels.map((c) => [c.name, c.id]));
  const state = {
    GAME_SAMBUNGKATA: { enabled: true, settings: {}, channels: { main: C['sambung-kata'] } },
    GAME_UNO: { enabled: true, settings: {}, channels: {} },
    GAME_TEBAKLAGU: { enabled: false, settings: {}, channels: {} },
    SOCIAL_COUNTING: { enabled: true, settings: {}, channels: { main: C.counting } },
    SOCIAL_STREAK: { enabled: true, settings: {}, channels: { main: C['streak-harian'] } },
    VERIFICATION: { enabled: true, settings: { verified_role: roles[2].id, steps: 5 }, channels: { panel: C.umum } },
    LEVELING: { enabled: true, settings: { mode: 'combined', rewards: [{ category: 'chat', level: 10, role_id: roles[3].id }] }, channels: {} },
    SECURITY: { enabled: true, settings: { mod_roles: [roles[1].id] }, channels: { log: C['log-moderasi'] } },
  };
  const days = Array.from({ length: 7 }, (_, i) => ({ day: new Date(T0 - (6 - i) * 86400000).toISOString().slice(0, 10), n: 40 + i * 3 }));
  return {
    guild: { id: GUILD_ID, name: 'Komunitas Uji Vanillate', icon: null, member_count: 1284 },
    bot: { installed: true, online: true, last_heartbeat_at: new Date(now - 4000).toISOString(), version: '3.50.0' },
    config: {
      revision: 12, applied_revision: 12, sync_status: 'ACTIVE', attempted_revision: 12, attempted_at: iso(3600000), applied_at: iso(3600000),
      last_error: null, health: null, health_checked_at: iso(600000), resync_requested_at: null,
      updated_at: iso(3600000), updated_by: '930000000000000001', updated_by_name: 'admin_uji', updated_source: 'web',
    },
    registry,
    state,
    snapshot: {
      refreshed_at: iso(120000), requested_at: iso(125000), bot_present: true, bot_permissions: ALL, channels, roles, bot_top_position: 10,
      security_summary: { v: 1, kick_active: 3, ban_active: 1, pending: 1, not_provided: 0, revoked: 1, last7_kick: 2, last7_ban: 0, enabled: true, by_reason: { spam: 3 }, last_at: iso(86400000), updated_at: iso(120000) },
      stats_summary: {
        v: 1, updated_at: iso(120000),
        members: { total: 1284, history: days.map((x, i) => ({ day: x.day, n: 1240 + i * 7 })) },
        join_leave: { available: false, locked_note: LOCK },
        activity: { ever: 640, active_1d: 58, active_7d: 210, active_30d: 402, chat_xp: 81234, voice_xp: 20987, chat_pct: 79 },
        verification: { days, total7: days.reduce((a, x) => a + x.n, 0) },
        community: { streak: { today: 37, best: 112 }, counting: { record: 2048 } },
      },
    },
    viewer: { discord_id: '930000000000000001', name: 'admin_uji', is_owner: true, access_verified_at: iso(60000) },
    server_time: new Date(now).toISOString(),
    ...over,
  };
}

export function auditRows(now = Date.now()) {
  const d = guildData(now);
  const C = Object.fromEntries(d.snapshot.channels.map((c) => [c.name, c.id]));
  const row = (id, minsAgo, action, source, revision, changed, actor = 'admin_uji') => ({
    id, actor_id: '930000000000000001', actor_name: actor, source, revision, action, changed_fields: changed, created_at: new Date(T0 - minsAgo * 60000).toISOString(),
  });
  return [
    row(40, 60, 'sync.applied', 'bot', 12, []),
    row(39, 61, 'config.save', 'web', 12, [
      { path: 'GAME_TEBAKLAGU.enabled', from: true, to: false },
      { path: 'GAME_SAMBUNGKATA.channels.main', from: C.umum, to: C['sambung-kata'] },
      { path: 'VERIFICATION.settings.steps', from: 4, to: 5 },
    ]),
    row(38, 600, 'sync.failed', 'bot', 11, [{ code: 'MISSING_PERMISSIONS', feature: 'SOCIAL_STREAK', purpose: 'main', channel_id: C['streak-harian'], missing: ['Send Messages'] }]),
    row(37, 601, 'config.save', 'web', 11, [{ path: 'SOCIAL_STREAK.enabled', from: false, to: true }, { path: 'SOCIAL_STREAK.channels.main', from: null, to: C['streak-harian'] }], 'moderator_uji'),
    row(36, 3000, 'config.discord', 'discord', 10, [{ path: 'SOCIAL_COUNTING.channels.main', from: null, to: C.counting }], 'Vanillate'),
    row(35, 9000, 'sync.resync_requested', 'web', 9, []),
  ];
}

export function shareDashboard(_now = Date.now()) {
  const now = T0;
  return {
    state: {
      guildId: GUILD_ID, feature: true, configured: true, enabled: true, status: 'ACTIVE', statusLabel: 'Aktif dan menerima promosi dari server peserta lain.', receiving: true, botPresent: true,
      config: { promoChannelId: '910000000000000002', voteChannelId: '910000000000000002', voteMessageId: null, alertsChannelId: null, category: 'gaming', description: 'Komunitas uji untuk fitur Vanillate.', inviteUrl: 'https://discord.gg/ujivanillate', inviteMethod: 'manual', inviteChannelId: null, inviteStatus: 'ACTIVE', inviteCheckedAt: now - 3600000, inviteValidatedAt: now - 3600000, guildName: 'Komunitas Uji Vanillate' },
      checklist: [{ key: 'promo', label: 'Channel penerima promosi publik', ok: true }, { key: 'invite', label: 'Link undangan permanen terverifikasi', ok: true }, { key: 'desc', label: 'Deskripsi dan kategori terisi', ok: true }],
      votes: 3, reductionMs: 1800000, cooldownEndsAt: now + 7200000, lastBroadcastAt: now - 86400000, queue: null, hold: null, disabled: null,
      violations: { week: '2026-W47', count: 1, quota: 5, resetAt: now + 3 * 86400000 }, recover: { used: 0, max: 3 }, incidents: [], test: null,
      lastTest: { purpose: 'activate', status: 'PASSED', result: null, at: now - 5 * 86400000 }, rules: { DESCRIPTION_MAX: 200, GUARD_HOURS: 24 },
      categories: [{ key: 'gaming', label: 'Gaming', emoji: '🎮' }, { key: 'lainnya', label: 'Lainnya', emoji: '✨' }],
      broadcasts: [{ id: 1, createdAt: now - 86400000, sent: 42, failed: 1, skipped: 2, blocked: 0, removed: 1, pending: 0, total: 46 }],
      received: [], history: [], audit: [{ action: 'activate', detail: null, actor: 'admin_uji', at: now - 5 * 86400000 }],
      showcase: { enabled: true, status: 'LISTED', statusText: 'Server ini tampil di daftar server pengguna Vanillate.ID.', invite: { url: 'https://discord.gg/ujivanillate', status: 'ACTIVE', method: 'manual', checkedAt: now - 3600000, note: null, paused: false, optedOut: false }, autoInvite: { possible: true, channelName: 'umum', lockedNote: null } },
    },
    updated_at: new Date(now - 60000).toISOString(),
    requests: [{ id: 5, type: 'save', status: 'done', result: { ok: true, message: 'Pengaturan disimpan.' }, error: null, created_at: new Date(now - 5 * 86400000).toISOString(), finished_at: new Date(now - 5 * 86400000 + 4000).toISOString(), actor_name: 'admin_uji' }],
    bot_online: true,
  };
}

export function serversResponse(now = Date.now()) {
  const s = (n, name, over = {}) => ({ guildId: `9000000000000000${String(n).padStart(2, '0')}`, name, iconUrl: null, isOwner: n === 1, manageable: true, botInstalled: true, configured: true, syncStatus: 'ACTIVE', revision: 12, ...over });
  return {
    user: { id: '930000000000000001', name: 'admin_uji', avatar: null },
    servers: [
      s(1, 'Komunitas Uji Vanillate'),
      s(2, 'Server Perlu Perhatian', { syncStatus: 'NEEDS_ATTENTION' }),
      s(3, 'Server Belum Diatur', { configured: false, syncStatus: null, revision: null }),
      s(4, 'Server Tanpa Bot', { botInstalled: false, configured: false, syncStatus: null, revision: null }),
      s(5, 'Nama Server Yang Sangat Panjang Sekali Untuk Menguji Tampilan Layar Sempit'),
      s(6, 'Ruang Belajar'), s(7, 'Klub Musik'), s(8, 'Warung Kopi'),
    ],
    cached: false,
    synced_at: new Date(now - 30000).toISOString(),
  };
}
