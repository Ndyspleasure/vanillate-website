import type { BotRegistryEntry, RegistryCommand } from '../lib/bot-registry';

// Audited source snapshot 2026-11-16. Only public-safe facts, never .env or raw config.
// Repository URLs are intentionally TODO: this site's HTML/JS is publicly downloadable.
const support = 'https://discord.gg/A7n88d6uRW';
const command = (name: string, description: string, category: string, permissions: string[] = [], cooldownSeconds: number | null = null): RegistryCommand => ({ name, description, category, permissions, options: [], cooldownSeconds });
const empty = (): Pick<BotRegistryEntry, 'visual' | 'discord' | 'runtime' | 'seo'> => ({
  visual: { logo: null, thumbnail: null, banner: null, color: null },
  discord: { clientId: null, permissions: null, permissionNames: [], intents: [], conditionalIntents: [], install: null },
  runtime: { locale: null, defaults: {}, featureFlags: [], defaultChannel: null, defaultRole: null, rateLimit: null },
  seo: { title: null, description: null, ogImage: null },
});
const links = (admin: string): BotRegistryEntry['links'] => ({ invite: null, support, repository: null, website: null, topgg: null, admin });

export const botRegistry: BotRegistryEntry[] = [
  {
    ...empty(), slug: 'vanillateID', name: 'Vanillate.ID', aliases: ['Sambung Kata', 'sambung-kata'], kind: 'bot', parentSlug: null,
    identity: { tagline: 'Satu bot Discord untuk game, sosial, dan pengelolaan server.', description: 'Bot Discord berbahasa Indonesia dengan Game Hub, Social Hub, serta pengaturan server melalui Vanillate Dashboard. Sambung Kata dan Vanillate Story merupakan fitur di dalam bot ini.', category: 'Bot serbaguna', status: 'live', version: '3.51.0', releasedAt: '2026-11-16' },
    links: { ...links('/admin/developer'), invite: 'https://discord.com/oauth2/authorize?client_id=1513806760622817320&permissions=2252747126074611&scope=bot%20applications.commands&integration_type=0', website: 'https://vanillate.id/products/vanillateID/', topgg: 'https://top.gg/bot/1513806760622817320/vote' },
    visual: { logo: null, thumbnail: '/bots/sambung-kata.png', banner: null, color: '#E8B84A' },
    discord: { clientId: '1513806760622817320', permissions: '2252747126074611', permissionNames: [], intents: ['Guilds', 'GuildInvites', 'GuildModeration', 'GuildMessages', 'MessageContent', 'DirectMessages', 'GuildVoiceStates'], conditionalIntents: ['GuildMembers: hanya jika diaktifkan di CMS dan Developer Portal'], install: 'Guild Install' },
    commands: [
      command('game', 'Buka Game Hub Vanillate.ID dan pilih game untuk dimainkan', 'Game'),
      command('sosial', 'Kegiatan bareng satu server: counting, streak harian, dan confession anonim', 'Sosial'),
      command('pengaturan', 'Buka pengaturan server di Vanillate Dashboard', 'Server', ['ManageGuild']),
      command('tutorial', 'Buka Tutorial Pemain Baru Vanillate.ID', 'Bantuan'),
      command('help', 'Tampilkan panduan lengkap bot Vanillate', 'Bantuan'),
      { ...command('rank', 'Lihat level dan XP kamu (atau member lain) di server ini', 'Server'), options: [{ name: 'user', type: 'User', description: 'Member yang ingin dilihat (kosong = kamu)', required: false }] },
    ],
    features: ['Sambung Kata', 'Vanillate Story', 'Vanillate Dungeon', 'Tahu Bulat', 'Tebak Lagu', 'Werewolf', 'Uno', 'Pengacara', 'Counting', 'Streak harian', 'Confession', 'Share Server', 'Leveling', 'Welcome', 'Auto Role', 'Security Center'],
    runtime: { locale: 'id-ID', defaults: { maintenance_mode: false, discord_announcement_enabled: false }, featureFlags: ['game_werewolf_enabled', 'game_pengacara_enabled'], defaultChannel: null, defaultRole: null, rateLimit: null },
    releases: [
      { version: '3.51.0', date: '2026-11-16', title: 'Vanillate Story kini punya gambar' },
      { version: '3.50.1', date: '2026-11-16', title: 'Vanillate Dungeon: pengenalan bertahap untuk pemain baru' },
      { version: '3.50.0', date: '2026-11-15', title: 'Vanillate Dungeon hadir di Game Hub' },
    ],
    seo: { title: 'Vanillate.ID, Bot Discord untuk Game, Sosial, dan Server', description: 'Vanillate.ID adalah bot Discord serbaguna berbahasa Indonesia untuk game, sosial, dan pengelolaan server.', ogImage: null },
    operations: { process: 'sambung kata', hosting: 'PM2 (konfigurasi repo)', telemetry: 'system', notes: ['Versi repo 3.51.0; versi yang berjalan dibaca dari snapshot bila tersedia.', 'Nilai default adalah bawaan sumber, bukan konfigurasi live per server.'] },
    sources: ['Vanillate.ID/version.json', 'Vanillate.ID/CHANGELOG.json (3 rilis terbaru)', 'Vanillate.ID/src/commands/*.js (6 command)', 'Vanillate.ID/index.js', 'Vanillate.ID/ecosystem.config.js', 'Vanillate.ID/src/social/share/topgg.js', 'vanillate-website/src/data/synced/products.json', 'vanillate-website/supabase/schema.sql'],
    todos: ['Logo, banner, dan OG image', 'URL repository publik yang boleh ditampilkan', 'Rincian cooldown tiap command dan rate limit runtime', 'Konfirmasi default channel/role per server lewat Dashboard', 'Lengkapi seluruh feature flag dan riwayat rilis di sumber; halaman ini menampilkan ringkasan'],
  },
  {
    ...empty(), slug: 'vanillate-match', name: 'Vanillate Match', aliases: ['Anonymous Chat Vanillate', 'AnonymousBotDiscord', 'Anonymous Bot'], kind: 'bot', parentSlug: null,
    identity: { tagline: 'Chat anonim satu lawan satu lewat DM.', description: 'Bot terpisah dengan User Install. Antrean dan sesi diproses di memori, dengan PostgreSQL opsional untuk pemulihan setelah restart. Vanillate.ID hanya menyediakan tautan instal.', category: 'Sosial', status: null, version: '0.1.0', releasedAt: null },
    links: { ...links('/admin/bots#vanillate-match'), invite: 'https://discord.com/oauth2/authorize?client_id=1521948490803187903&integration_type=1&scope=applications.commands' },
    visual: { logo: null, thumbnail: null, banner: null, color: '#5865F2' },
    discord: { clientId: '1521948490803187903', permissions: '0', permissionNames: [], intents: ['Guilds', 'DirectMessages'], conditionalIntents: [], install: 'User Install; command diproses hanya di DM bot' },
    commands: [command('start', 'Masuk antrean dan dipasangkan dengan orang acak', 'Chat', [], 5), command('stop', 'Akhiri chat atau keluar dari antrean', 'Chat'), command('next', 'Akhiri chat ini dan langsung cari lawan baru', 'Chat'), command('report', 'Laporkan lawan bicara (transkrip .txt ke moderator), lalu chat diakhiri', 'Moderasi'), command('help', 'Tampilkan panduan penggunaan', 'Bantuan'), command('rules', 'Peraturan penggunaan', 'Bantuan'), command('terms', 'Syarat dan ketentuan', 'Bantuan')],
    features: ['Pencocokan acak', 'Relay DM', 'Pelaporan transkrip', 'Filter media dan tautan', 'Onboarding', 'Pemulihan antrean PostgreSQL opsional'],
    runtime: { locale: 'id-ID', defaults: { queueTimeoutMs: 0, idleTimeoutMs: 86400000, idleReminderMs: 21600000, startCooldownMs: 5000, msgPerWindow: 8, msgWindowMs: 10000, maxMessageLength: 1000, transcriptMaxEntries: 500, maxMediaBytes: 8388608, maxMediaPerMessage: 4 }, featureFlags: [], defaultChannel: 'DM', defaultRole: null, rateLimit: '8 pesan / 10 detik; jeda /start 5 detik' },
    releases: [], operations: { process: null, hosting: 'README: Wispbyte, proses tunggal npm start', telemetry: null, notes: ['Belum ada pengiriman telemetry ke CMS di repo ini.', 'Status beta/preorder dari konteks awal belum dikonfirmasi sumber deployment; tidak disimpulkan dari versi paket.'] },
    sources: ['AnonymousBotDiscord/package.json', 'AnonymousBotDiscord/README.md', 'AnonymousBotDiscord/config.js (hanya allowlist limits dan brand)', 'AnonymousBotDiscord/src/commands.js', 'AnonymousBotDiscord/index.js', 'Vanillate.ID/src/social/hub/views.js (application ID fallback)'],
    todos: ['Konfirmasi status live/beta/preorder dan tanggal rilis', 'Konfirmasi application ID aktif jika fallback repo dioverride saat deploy', 'Logo, thumbnail, banner, dan SEO', 'Halaman produk, top.gg, dan repository publik', 'Nama proses dan telemetry kesehatan', 'Changelog dan cooldown command selain /start'],
  },
  {
    ...empty(), slug: 'workspace', name: 'Vanillate Workspace', aliases: ['vanillate-workspace'], kind: 'bot', parentSlug: null,
    identity: { tagline: null, description: 'Bot Discord manajemen kerja: tugas, absensi, laporan, kalender, notifikasi dan konfigurasi tim. CMS terpisah menggunakan tabel workspace_*.', category: 'Produktivitas', status: null, version: null, releasedAt: null },
    links: links('/admin/workspace'), commands: [], features: ['Tugas', 'Jadwal kerja', 'Tim & role', 'Target / OKR', 'Automation', 'Welcome & onboarding', 'Feature toggle'],
    releases: [], operations: { process: null, hosting: null, telemetry: 'workspace', notes: ['Repo bot Workspace tidak tersedia di workspace audit; detail runtime belum dapat diperiksa.'] },
    sources: ['vanillate-website/docs/WORKSPACE-CMS.md', 'vanillate-website/supabase/workspace-schema.sql'],
    todos: ['Repo bot untuk daftar command, permissions, intents dan cooldown', 'Identitas: tagline, status, versi, tanggal rilis', 'Application ID, invite dan halaman produk', 'Visual dan SEO', 'Konfigurasi runtime aktual, channel/role dan rate limit', 'Hosting, nama proses dan changelog'],
  },
  {
    ...empty(), slug: 'vanillate-story', name: 'Vanillate Story', aliases: ['Story', 'Life Simulation RPG'], kind: 'feature', parentSlug: 'vanillateID',
    identity: { tagline: null, description: 'Fitur game di dalam Vanillate.ID, bukan proses bot terpisah. Kode permainan tersedia di src/game/story dan rilis 3.51.0 menambahkan ilustrasi adegan.', category: 'Game / simulasi kehidupan', status: null, version: null, releasedAt: null },
    links: links('/admin/developer/story'), commands: [command('game', 'Pilih Vanillate Story di Game Hub bot induk', 'Game')], features: ['Adegan cerita', 'Interaksi warga', 'Peta kota'],
    releases: [], operations: { process: null, hosting: 'Mengikuti Vanillate.ID', telemetry: null, notes: ['Statistik proses dan server mengikuti bot induk; tidak dijumlahkan ulang.', 'Keterangan fase desain pada konteks awal berbeda dengan kode/rilis yang sudah tersedia.'] },
    sources: ['Vanillate.ID/src/game/story/', 'Vanillate.ID/CHANGELOG.json: 3.51.0', 'vanillate-website/src/pages/admin/developer/story.astro'],
    todos: ['Konfirmasi status peluncuran fitur dan tanggal rilis pertama', 'Lengkapi deskripsi produk, visual, SEO, dan halaman publik fitur', 'Konfigurasi runtime fitur tersedia melalui panel Story; jangan membuat bot/aplikasi Discord baru'],
  },
];
