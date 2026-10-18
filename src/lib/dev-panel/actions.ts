// ════════════════════════════════════════════════════════════════════════════
//  Panel Developer — registry aksi form sederhana (satu form = satu perintah).
//
//  Dipakai /admin/operasi (konsol semua aksi) dan /admin/pemain (aksi pemain
//  dengan field Player terisi otomatis). Menambah aksi = tambah entri di sini
//  + handler dengan `type` yang sama di bot (src/cms/handlers/*). Aksi dengan
//  UI kaya (broadcast, game, kata, sosial, auto-heal, kontrol server) punya
//  halaman sendiri di /admin/developer/*.
// ════════════════════════════════════════════════════════════════════════════

import type { Field } from './ui';

export interface Aksi {
  type: string;
  label: string;
  danger?: boolean;
  fields: Field[];
  help?: string;
}

export interface Grup {
  key: string;
  label: string;
  desc: string;
  icon: string;
  aksi: Aksi[];
}

export const FPLAYER: Field = { name: 'player', label: 'Player ID / Discord ID', required: true, placeholder: 'mis. #A3K9 atau 123456789012345678' };
const FPLAYER_OPT: Field = { name: 'player', label: 'Player ID / Discord ID', placeholder: 'kosongkan = semua pemain', help: 'Kosongkan untuk menerapkan ke semua pemain.' };
const FREWARD: Field = { name: 'reward', label: 'Reward', placeholder: 'coin:300, exp:75, hint:1', help: 'Kunci: coin, exp, hint, reroll, shield, extra_time, extra_life.' };

// Ikon Lucide (inline SVG, satu icon pack — konsisten dengan Icon.astro).
export const IC = {
  user: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  tag: '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
  calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
};

export const GRUP: Grup[] = [
  {
    key: 'pemain', label: 'Pemain', icon: IC.user, desc: 'Ubah progres, moderasi, atau reset akun pemain.',
    aksi: [
      { type: 'player.setCoin', label: 'Set Coin', fields: [FPLAYER, { name: 'amount', label: 'Jumlah coin', type: 'number', required: true }] },
      { type: 'player.setScore', label: 'Set Total Kata', fields: [FPLAYER, { name: 'amount', label: 'Total kata', type: 'number', required: true }] },
      { type: 'player.setWins', label: 'Set Wins', fields: [FPLAYER, { name: 'amount', label: 'Jumlah menang', type: 'number', required: true }] },
      { type: 'player.setLives', label: 'Set Nyawa (sedang main)', help: 'Hanya untuk pemain yang sedang bermain PvP/PvB.', fields: [FPLAYER, { name: 'amount', label: 'Nyawa', type: 'number', required: true }] },
      { type: 'player.reset', label: 'Reset Statistik', danger: true, help: 'Wins, game, total kata, kata terpanjang, dan inventory boost kembali kosong.', fields: [FPLAYER] },
      { type: 'player.ban', label: 'Ban', danger: true, fields: [FPLAYER, { name: 'reason', label: 'Alasan', placeholder: 'opsional' }] },
      { type: 'player.unban', label: 'Unban', fields: [FPLAYER] },
    ],
  },
  {
    key: 'progression', label: 'Progression', icon: IC.star, desc: 'Coin, EXP, level akun, dan level class pemain.',
    aksi: [
      { type: 'progression.giveCoin', label: 'Tambah Coin', fields: [FPLAYER, { name: 'amount', label: 'Tambah coin', type: 'number', required: true }] },
      { type: 'progression.giveExp', label: 'Tambah EXP', fields: [FPLAYER, { name: 'amount', label: 'Tambah EXP', type: 'number', required: true }] },
      { type: 'progression.setAccountLevel', label: 'Set Level Akun', help: 'EXP ikut disinkronkan dengan kurva level akun.', fields: [FPLAYER, { name: 'level', label: 'Level', type: 'number', required: true }] },
      { type: 'progression.setClassLevel', label: 'Set Level Class', help: 'Pemain harus sudah memiliki class tersebut.', fields: [FPLAYER, { name: 'classId', label: 'Class ID', required: true, placeholder: 'mis. warrior' }, { name: 'level', label: 'Level (1–25)', type: 'number', required: true }] },
      { type: 'progression.reset', label: 'Reset Progression', danger: true, help: 'Reset coin, EXP, level, class & talent.', fields: [FPLAYER] },
    ],
  },
  {
    key: 'boost', label: 'Boost', icon: IC.zap, desc: 'Beri atau atur boost pemain.',
    aksi: [
      { type: 'boost.give', label: 'Beri Boost', fields: [FPLAYER, { name: 'boostId', label: 'Boost ID', required: true, placeholder: 'hint · reroll · shield · extra_life · extra_time', help: 'ID sesuai katalog boost bot (lihat Ringkasan Developer).' }, { name: 'amount', label: 'Jumlah', type: 'number', placeholder: 'default 1' }] },
      { type: 'boost.set', label: 'Set Jumlah Boost', fields: [FPLAYER, { name: 'boostId', label: 'Boost ID', required: true }, { name: 'amount', label: 'Jumlah', type: 'number', required: true }] },
      { type: 'boost.reset', label: 'Reset Semua Boost', danger: true, fields: [FPLAYER] },
    ],
  },
  {
    key: 'promo', label: 'Promo', icon: IC.tag, desc: 'Buat & ubah kode promo. Daftar & analitik ada di halaman Promo.',
    aksi: [
      { type: 'promo.create', label: 'Buat Promo', fields: [
        { name: 'code', label: 'Kode', required: true, placeholder: 'mis. GACOR2026' },
        { name: 'title', label: 'Judul', required: true },
        { name: 'description', label: 'Deskripsi', type: 'textarea' },
        { ...FREWARD, required: true },
        { name: 'maxClaims', label: 'Maks klaim', type: 'number', help: 'Kosongkan / 0 untuk tak terbatas.' },
        { name: 'expiredAt', label: 'Kedaluwarsa', type: 'datetime-local', help: 'Opsional.' },
      ] },
      { type: 'promo.edit', label: 'Ubah Promo', help: 'Kosongkan field yang tidak diubah.', fields: [
        { name: 'code', label: 'Kode', required: true },
        { name: 'title', label: 'Judul baru' },
        FREWARD,
        { name: 'maxClaims', label: 'Maks klaim baru', type: 'number' },
        { name: 'expiredAt', label: 'Kedaluwarsa baru', type: 'datetime-local' },
      ] },
      { type: 'promo.disable', label: 'Matikan Promo', danger: true, fields: [{ name: 'code', label: 'Kode', required: true }] },
      { type: 'promo.enable', label: 'Nyalakan Promo', fields: [{ name: 'code', label: 'Kode', required: true }] },
    ],
  },
  {
    key: 'quest', label: 'Quest', icon: IC.calendar, desc: 'Reset quest harian / mingguan.',
    aksi: [
      { type: 'quest.resetDaily', label: 'Reset Quest Harian', danger: true, fields: [FPLAYER_OPT] },
      { type: 'quest.resetWeekly', label: 'Reset Quest Mingguan', danger: true, fields: [FPLAYER_OPT] },
    ],
  },
  {
    key: 'tutorial', label: 'Tutorial', icon: IC.book, desc: 'Atur status tutorial satu pemain. Reset massal ada di halaman Tutorial.',
    aksi: [
      { type: 'tutorial.resetOne', label: 'Reset Tutorial', danger: true, help: 'Pemain mulai lagi dari quest pertama.', fields: [FPLAYER] },
      { type: 'tutorial.doneOne', label: 'Tandai Tutorial Selesai', fields: [FPLAYER] },
      { type: 'tutorial.cleanOne', label: 'Bersihkan Pinjaman Tutorial', help: 'Tarik kembali item pinjaman tutorial yang tertinggal.', fields: [FPLAYER] },
    ],
  },
  {
    key: 'campaign', label: 'DM Campaign', icon: IC.mail, desc: 'Kirim pengingat DM campaign sekarang ke satu pemain.',
    aksi: [
      { type: 'campaign.forceSend', label: 'Kirim DM Campaign', fields: [FPLAYER] },
    ],
  },
  {
    key: 'database', label: 'Database', icon: IC.database, desc: 'Perawatan data.',
    aksi: [
      { type: 'db.resetCooldown', label: 'Reset Cooldown Claim', fields: [FPLAYER_OPT] },
    ],
  },
];

/** Grup aksi yang bekerja pada SATU pemain (dipakai halaman Pemain). */
export const PLAYER_GROUP_KEYS = ['pemain', 'progression', 'boost', 'tutorial', 'campaign'];
