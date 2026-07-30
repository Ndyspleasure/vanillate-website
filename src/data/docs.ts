// Konten dokumentasi per bot.
// Update dokumentasi? Cukup edit file ini. Halaman /docs/[slug] akan render otomatis.
// Bot baru tanpa entry di sini akan menampilkan placeholder default.

import { sambungKataEvents, type GameEvent } from './events';

export type DocSubsection = {
  title?: string;                                    // Judul kecil, boleh dengan emoji
  text?: string;                                     // Paragraf biasa
  items?: string[];                                  // Bullet list
  table?: { headers: string[]; rows: string[][] };   // Tabel data
};

// Kartu event highlight dirender sebagai kartu berwarna (bukan list biasa).
// Datanya berasal dari sumber tunggal `src/data/events.ts` supaya sinkron
// dengan highlight di beranda. Alias tipe dipertahankan untuk kompatibilitas.
export type DocEventCard = GameEvent;

export type DocSection = {
  id: string;          // Anchor untuk sidebar TOC
  title: string;       // Judul section
  intro?: string;      // Paragraf pembuka section
  events?: GameEvent[];  // Kartu event highlight (opsional, dirender di atas subsections)
  subsections: DocSubsection[];
  note?: string;       // Catatan/tip penutup section
};

export type BotDoc = {
  intro: string;
  quickStart?: string[];
  sections: DocSection[];
};

export const docs: Record<string, BotDoc> = {
  // ═══════════════════════════════════════════════════════════════════
  // VANILLATE SAMBUNG KATA
  // ═══════════════════════════════════════════════════════════════════
  'sambung-kata': {
    intro:
      'Vanillate Sambung Kata adalah bot game kata berantai dalam Bahasa Indonesia. Setiap pemain menyambung kata dari huruf yang ditentukan, dengan sistem progresi mendalam: Class, Quest, Boost, hingga Dungeon Mode.',
    quickStart: [
      'Undang bot ke server Discord kamu.',
      'Jalankan `/sambungkata mode:pvp` untuk buka lobby, atau `mode:pvb` untuk lawan bot.',
      'Jawab dengan kata yang diawali huruf yang ditentukan. Kata harus ada di kamus.',
      'Kumpulkan EXP & Coin, buka Class di Level 3, dan taklukkan Dungeon!',
    ],
    sections: [
      {
        id: 'cara-bermain',
        title: 'Cara Bermain',
        intro:
          'Sambung Kata adalah permainan kata berantai. Setiap pemain harus menyebut kata yang diawali huruf yang ditentukan dari kata sebelumnya. Contoh: kata `MAKAN` → huruf berikut `N` → jawaban valid: `NASI`, `NAMA`, `NILAI`, dan seterusnya.',
        subsections: [
          {
            title: '📌 Aturan Dasar',
            items: [
              'Kata harus diawali dari huruf yang ditentukan.',
              'Kata harus ada di kamus Bahasa Indonesia (25.000+ kata).',
              'Kata yang sudah pernah dipakai tidak boleh diulang.',
              'Hanya 1 kata per giliran (tanpa spasi).',
              'Kata minimum 2 huruf.',
            ],
          },
          {
            title: '⏱️ Waktu per Giliran',
            items: [
              'Setiap pemain punya waktu terbatas untuk menjawab.',
              'Waktu habis → kehilangan 1 ❤️ nyawa dan giliran pindah.',
              'Jawab dalam ≤5 detik → dihitung ke quest ⚡ Kilat Kata.',
              'Gunakan boost ⏳ Extra Time untuk menambah waktu giliran.',
            ],
          },
          {
            title: '❤️ Sistem Nyawa',
            items: [
              'Setiap pemain mulai dengan 5 nyawa.',
              'Jawaban salah atau waktu habis = -1 kesempatan.',
              'Setelah 5 kesempatan gagal = -1 nyawa dan giliran pindah.',
              'Nyawa habis = 💀 eliminasi dari permainan.',
            ],
          },
          {
            title: '🏆 Cara Menang',
            items: [
              'PvP/PvB: jadilah pemain terakhir yang bertahan.',
              'Dungeon: tumbangkan Guardian sampai wave 5.',
              'Jika skor seri saat voting stop → Balapan Ayam 🐔 menentukan pemenang.',
            ],
          },
          {
            title: '🗳️ Voting Perhentian',
            items: [
              'Pemain bisa mengajukan voting untuk menghentikan game.',
              'Semua pemain aktif punya 30 detik untuk vote.',
              'Mayoritas memilih Hentikan → game berakhir lebih awal.',
              'Mayoritas Lanjutkan atau seri → game dilanjutkan.',
            ],
          },
          {
            title: '📝 Kata Istimewa',
            items: [
              'Kata ≥8 huruf → bonus EXP & damage besar di Dungeon.',
              'Kata berakhiran huruf langka (X, Q, Z, V) → bonus Coin & damage tertinggi.',
            ],
          },
        ],
      },
      {
        id: 'mode-permainan',
        title: 'Mode Permainan',
        subsections: [
          {
            title: '👥 Player vs Player (PvP)',
            items: [
              'Minimal 2 pemain manusia, maksimal 10 pemain per room.',
              'Command: `/sambungkata mode:pvp`.',
              'Host buka lobby → pemain join → host mulai.',
              'Lobby otomatis tutup dalam 2 menit jika tidak dimulai.',
            ],
          },
          {
            title: '🤖 Player vs Bot (PvB)',
            items: [
              'Bermain sendirian melawan bot AI.',
              'Command: `/sambungkata mode:pvb kesulitan:[easy|normal|hard|impossible]`.',
              '🟢 Easy: bot lambat, sering salah.',
              '🟡 Normal: bot seimbang.',
              '🔴 Hard: bot cepat, jarang salah.',
              '☠️ Impossible: bot hampir tidak pernah kalah.',
            ],
          },
          {
            title: '🏰 Dungeon Mode',
            items: [
              'Mode solo menantang: kamu vs Dungeon Guardian, 5 wave.',
              'Command: `/sambungkata mode:dungeon` (butuh 🗝️ Golden Key).',
              'Guardian membalas beberapa kata per giliran, makin cepat tiap wave.',
              'Reward x2 + bonus besar & drop pasti jika tamat.',
              'Detail lengkap ada di section Dungeon & Events.',
            ],
          },
          {
            title: '🎯 Fase Pre-Match (30 detik)',
            items: [
              'Sebelum game ada 30 detik fase persiapan.',
              'Aktifkan boost Pre-Match di fase ini: ❤️ Extra Life (+1 nyawa), 🛡️ Shield (proteksi 1 kesalahan), ⏳ Extra Time (tambah waktu per giliran).',
              'Beli boost di `/shop` atau klaim di `/claim`.',
            ],
          },
          {
            title: '🔥 Win Streak',
            items: [
              'Menang berturut-turut membangun Win Streak.',
              'Milestone tertentu memberikan bonus Coin & reward.',
              'Streak hilang jika kalah atau tidak menang.',
              'Cek streak di `/stats`.',
            ],
          },
        ],
      },
      {
        id: 'boost-system',
        title: 'Boost System',
        intro:
          'Boost adalah item spesial yang membantu kamu dalam permainan. Ada 2 jenis boost berdasarkan waktu penggunaan.',
        subsections: [
          {
            title: '🎯 Pre-Match Boost',
            items: [
              '❤️ Extra Life (Legendary): tambah 1 nyawa ekstra sebelum game.',
              '🛡️ Shield (Epic): proteksi dari 1 kesalahan dalam game.',
              '⏳ Extra Time (Common): tambah +5 detik per giliran.',
            ],
          },
          {
            title: '⚡ In-Game Boost',
            items: [
              '💡 Hint (Common): tampilkan 1 kata valid sebagai jawaban.',
              '🔄 Reroll (Rare): ganti huruf awalan dengan huruf lain.',
            ],
          },
          {
            title: '⭐ Rarity System',
            items: [
              '⚪ Common: Hint, Extra Time (peluang tertinggi).',
              '🔵 Rare: Reroll.',
              '🟣 Epic: Shield.',
              '🟡 Legendary: Extra Life (peluang terendah).',
            ],
          },
          {
            title: '🎁 Cara Mendapatkan Boost',
            items: [
              '`/claim` → claim boost gratis setiap 24 jam (class tertentu dapat bonus!).',
              '`/claim` → reward member Server Support (reset 24 jam).',
              '`/claim` → redeem Promo Code jika ada kode aktif.',
              '`/shop` → beli boost dengan Coin.',
              '📦 Mystery Box → boost acak dari shop (500🪙).',
              '📅 Quest → reward dari daily & weekly quest.',
            ],
          },
          {
            title: '📦 Lihat & Kelola Boost',
            items: [
              '`/inventory` → lihat semua boost yang kamu miliki.',
              'Boost otomatis refresh di tombol pre-match setelah klaim/beli.',
            ],
          },
        ],
      },
      {
        id: 'progression',
        title: 'Sistem Progression',
        subsections: [
          {
            title: '👤 Account Level',
            items: [
              'Semua pemain dapat Account EXP dari setiap match & quest.',
              'Butuh 500 EXP per level.',
              'Level 3 → membuka Class System.',
              'Cek progress di `/stats`.',
            ],
          },
          {
            title: '🎭 Class System (9 Class)',
            items: [
              'Tersedia dari Level 3: 📚 Scholar, ⚡ Speedster, 🛡️ Guardian, 🍀 Lucky, 🏹 Hunter.',
              'Terbuka bertahap (Lv.8 / 12 / 16 / 20): 🎲 Gambler, 🧪 Alchemist, 🧠 Linguist, ⚔️ Berserker.',
              'Pilih pertama GRATIS, ganti class 750🪙.',
              'Setiap class punya passive nyata: bonus reward, boost harian ekstra, peluang selamat dari eliminasi, damage ekstra di Dungeon, dan lainnya.',
              'Gunakan `/class list` untuk melihat semua class.',
            ],
          },
          {
            title: '⭐ EXP per Match',
            items: [
              '+1 EXP per kata valid.',
              '+10 EXP menyelesaikan pertandingan.',
              '+15 EXP menang, +5 EXP MVP.',
              'EXP masuk ke Account (semua pemain) dan Class aktif (jika ada).',
            ],
          },
          {
            title: '🪙 Coin Economy',
            items: [
              '+5 Coin selesai pertandingan.',
              '+10 Coin menang pertandingan.',
              '+1 Coin per 10 kata valid.',
              '+1 Coin kata ≥8 huruf.',
              '+2 Coin huruf langka (X/Q/Z/V).',
              'Bonus dari quest, win streak, dan passive class.',
            ],
          },
          {
            title: '🌟 Talent Tree',
            items: [
              'Setiap class punya talent eksklusif yang bisa dibeli.',
              'Talent memberikan bonus pasif saat bermain.',
              'Dibeli dengan Coin melalui `/class` → tombol talent.',
              'Cek talent tersedia di `/class info [nama_class]`.',
            ],
          },
        ],
      },
      {
        id: 'quest-shop',
        title: 'Quest & Shop',
        subsections: [
          {
            title: '📅 Quest System',
            items: [
              '`/quest` → dashboard quest (Harian + Mingguan).',
              '4 Daily Quest: reset tengah malam.',
              '6 Weekly Quest: reset setiap Senin.',
              '⚡ Kilat Kata (weekly): 20 jawaban ≤5 detik → hadiah 🗝️ Golden Key!',
              'Selesaikan semua → Bonus Chest (Coin + Mystery Box).',
              'Quest yang selesai diumumkan di akhir match, jangan lupa klaim!',
            ],
          },
          {
            title: '🏪 Shop',
            table: {
              headers: ['Item', 'Harga'],
              rows: [
                ['💡 Hint', '150🪙'],
                ['🔄 Reroll', '200🪙'],
                ['⏳ Extra Time', '250🪙'],
                ['🛡️ Shield', '300🪙'],
                ['🗝️ Golden Key', '350🪙'],
                ['❤️ Extra Life', '400🪙'],
                ['📦 Mystery Box', '500🪙'],
                ['💡 Hint x5 Bundle', '600🪙'],
                ['🛡️ Shield x3 Bundle', '750🪙'],
              ],
            },
          },
          {
            title: '🎟️ Promo Code',
            items: [
              '`/claim` → tombol 🎟️ Redeem Promo Code.',
              'Kode promo dibagikan lewat pengumuman resmi.',
              'Setiap kode hanya bisa diklaim 1x per pemain.',
              'Reward bervariasi: Coin, EXP, atau Boost.',
            ],
          },
          {
            title: '📝 Masukan & Saran',
            items: [
              '`/masukan` → kirim saran, bug report, atau pertanyaan.',
              'Pilih kategori: 🐛 Bug, 💡 Saran, ❓ Pertanyaan, 📝 Lainnya.',
              'Bisa dikirim anonim atau dengan nama.',
              'Masukan langsung diterima tim developer.',
            ],
          },
        ],
      },
      {
        id: 'dungeon-events',
        title: 'Dungeon & In-Game Events',
        intro: 'Tantangan solo paling berat dan kejutan yang bisa muncul di tengah pertandingan!',
        subsections: [
          {
            title: '🗝️ Golden Key: 3 Cara Mendapatkan',
            items: [
              '🏪 `/shop` → beli langsung 350🪙.',
              '📆 Weekly quest ⚡ Kilat Kata → 20 jawaban ≤5 detik = kunci gratis.',
              '🧳 Traveling Merchant → sering menjual dengan harga diskon (250🪙).',
              'Kunci habis dipakai setiap masuk Dungeon. Maksimal pegang 1.',
            ],
          },
          {
            title: '🏰 Aturan Dungeon',
            items: [
              'Solo: kamu vs Dungeon Guardian, total 5 wave.',
              'Damage kata: dasar 2 | ≥6 huruf +1 | ≥8 huruf +1 | akhiran langka +2.',
              'Guardian membalas 4–8 kata per giliran (bertambah tiap wave).',
              'Waktu berpikir menyusut tiap wave. Nyawa habis = Game Over.',
              'Class perks aktif di sini: Guardian +1 nyawa, Hunter & Berserker +damage.',
            ],
          },
          {
            title: '🎁 Reward Dungeon',
            items: [
              'Semua reward match x2.',
              'Bonus tamat: +100🪙 + 30🪙/wave (tamat 5 wave = +250🪙).',
              'Tamat = drop PASTI: ❤️ Extra Life + 📦 boost acak + 🏆 Dungeon Trophy.',
            ],
          },
          {
            title: '🎲 In-Game Events (muncul acak di PvP)',
            items: [
              '🤖 AI Challenger: AI menantang seisi room; kalahkan bersama untuk reward x2.',
              '🧳 Traveling Merchant: toko dadakan berisi item diskon & langka.',
              '📡 Lost Signal: kumpulkan 5 fragmen untuk hadiah x2.',
              '🗡️ Penjajah (Invader): boss musiman 17 Agustus dengan Steal, Block, & Challenge.',
              'Event muncul di ronde 20–30 dan menjeda game saat intro. Detail lengkap tiap event ada di section **Event Spesial PvP**.',
            ],
          },
        ],
      },
      {
        id: 'event-spesial',
        title: 'Event Spesial PvP',
        intro:
          'Di ronde 20–30 mode PvP, ada peluang salah satu dari **4 event spesial** muncul secara acak dan mengubah jalannya pertandingan. Saat intro event, timer dibekukan, jadi kamu punya waktu membaca lore dan menyusun strategi. Tiap event punya mekanik, cara menang, reward sukses, dan konsekuensi gagal yang berbeda.',
        events: sambungKataEvents,
        subsections: [
          {
            title: '🤖 AI Challenger — Boss Bersama',
            text:
              'Boss AI muncul di tengah match untuk menantang semua pemain sekaligus. Tidak ada kompetisi antarpemain, semua bekerja sama menghajar boss sebelum match berakhir.',
            items: [
              'Intro 15 detik: game dijeda, embed dramatis mengumumkan kedatangan boss.',
              'HP Boss: `200 + (jumlah pemain × 20)`. Contoh 3 pemain → boss punya 260 HP.',
              'Setiap kata valid melukai boss. Menang jika HP boss ≤ 0 sebelum match habis.',
              'Match berakhir tanpa boss tumbang → tidak ada reward, tapi juga tanpa penalti (bukan hard-fail).',
              'Embed penutup menampilkan leaderboard kontribusi damage tiap pemain.',
            ],
          },
          {
            title: '💥 Sistem Damage AI Challenger',
            text:
              'Semakin panjang dan langka katamu, semakin sakit untuk boss. Gilir memberi kata berat bersama tim biar boss cepat tumbang. Contoh: `KOMPLEKS` (panjang, akhiran S) = 2 damage.',
            table: {
              headers: ['Jenis Kata', 'Damage'],
              rows: [
                ['Kata biasa (3–7 huruf)', '1'],
                ['Kata panjang (≥8 huruf)', '2'],
                ['Berakhir huruf langka (X / Z / Q / V)', '+1 tambahan'],
              ],
            },
          },
          {
            title: '📡 Lost Signal — Kumpulkan 5 Fragmen',
            text:
              'Language Core tidak stabil dan sinyalnya pecah jadi 5 fragmen (A–E). Kumpulkan kelimanya sebelum match berakhir untuk restore sistem dan dapat reward.',
            items: [
              'Intro 15 detik: embed sistematis, "Language Core tidak stabil, fragmen terpecah".',
              'Setiap kata valid punya peluang menjatuhkan fragmen (tidak dijamin tiap kata).',
              'Kata panjang (≥6 huruf) menaikkan peluang drop.',
              'Sistem memprioritaskan fragmen yang belum terkumpul, jadi tidak ada yang mubazir.',
              'Menang jika semua 5 fragmen terkumpul. Kurang dari 5 saat match usai → gagal (tanpa penalti).',
              'Embed mencatat progress tiap fragmen drop: siapa dapat apa dari kata apa.',
            ],
          },
          {
            title: '🧳 Traveling Merchant — Toko Dadakan',
            text:
              'Merchant musafir membuka toko pop-up berisi item langka dengan harga spesial. Toko hanya aktif 5 menit lalu merchant pergi. Beli pakai Coin milikmu sendiri, bukan pool match. Ini bukan musuh, jadi tidak ada menang/kalah.',
            items: [
              'Klik tombol item di embed toko; Coin langsung dipotong dari akunmu.',
              'Item "unknown" baru di-roll saat dibeli.',
              'Toko tutup otomatis setelah 5 menit atau saat match berakhir (mana lebih dulu).',
            ],
          },
          {
            title: '🛒 Barang Merchant (4–5 item acak per kunjungan)',
            table: {
              headers: ['Item', 'Harga', 'Efek', 'Rarity'],
              rows: [
                ['📦 Unknown Package', '100🪙', 'Drop acak: Hint, Reroll, Extra Time, atau ZONK', 'Common'],
                ['🧳 Merchant Box', '300🪙', 'Drop pasti: Shield, Extra Life, Reroll, atau Hint', 'Rare'],
                ['📜 Contract', '500🪙', 'HIGH RISK 50/50: reward akhir ×2 atau ×0', 'Epic'],
                ['⏪ Rewind Ticket', '400🪙', 'Pulihkan 1 nyawa. Maks 1× per match per pemain', 'Rare'],
                ['🗝️ Golden Key', '250🪙', 'Buka Dungeon Mode (muncul sesekali, langka)', 'Epic'],
              ],
            },
          },
          {
            title: '🧠 Strategi Belanja',
            items: [
              '📦 Unknown Package: judi murah, bagus kalau hoki dapat boost, apes kalau zonk.',
              '🧳 Merchant Box: lebih pasti daripada Package, tapi lebih mahal.',
              '📜 Contract: taruhan tinggi, beli hanya kalau yakin menang. Cuma pembeli yang terpengaruh, pemain lain tetap normal.',
              '⏪ Rewind Ticket: asuransi, beli saat nyawa tinggal 1 dan khawatir gugur.',
              '🗝️ Golden Key: jalur alternatif kalau ingin akses Dungeon Mode sekarang.',
            ],
          },
          {
            title: '🗡️ Penjajah (Invader) — Boss Hari Kemerdekaan',
            text:
              'Event paling kompleks, sekaligus event spesial untuk memperingati Hari Kemerdekaan Indonesia (17 Agustus). Boss "Penjajah" hadir musiman dengan tiga mekanik gangguan yang berjalan paralel dan terus menekan pemain. Tahan sampai boss terusir. Intro ±50 detik dengan monolog Penjajah, game dijeda, timer dibekukan.',
            items: [
              'Menang: menangkan cukup banyak Challenge (≥3 jawaban benar) → Penjajah diusir, match lanjut.',
              'Kalah: terlalu banyak Challenge salah (≥2 salah) → Penjajah menang, match berakhir.',
              'Steal & Block bukan hard-fail, cuma buang waktu. Skor, giliran, nyawa, huruf target tetap utuh.',
            ],
          },
          {
            title: '⚔️ 3 Mekanik Gangguan Penjajah',
            table: {
              headers: ['Mekanik', 'Efek', 'Catatan'],
              rows: [
                ['🔓 Steal', 'Kata valid dirampas, tidak dihitung', 'Skor/giliran/nyawa utuh, timer tetap jalan'],
                ['⛓️ Block', 'Tidak bisa input ~10 detik', 'Timer terus jalan, bisa timeout kalau habis'],
                ['❓ Challenge', 'Soal kuis kemerdekaan (pilihan ganda) ~30 detik', 'Game dijeda; benar +1, salah/timeout -1'],
              ],
            },
          },
          {
            title: '🏅 Kemenangan & "Pengkhianat Perjuangan"',
            items: [
              'Challenge benar ≥3 kali → event **sukses**: reward ×2 Coin & EXP + embed lore penutup.',
              'Challenge salah ≥2 kali → event **gagal** (hard-fail): Penjajah menang, tanpa Coin & EXP.',
              'Survival tunggal (dari ≥2 pemain manusia, tersisa 1) → gelar "Pengkhianat Perjuangan" dengan lore dramatis. Reward pemenang tetap ×2.',
            ],
          },
          {
            title: '📊 Perbandingan Cepat 4 Event',
            table: {
              headers: ['Event', 'Peluang', 'Kesulitan', 'Reward Sukses', 'Reward Gagal'],
              rows: [
                ['🤖 AI Challenger', 'Sering', 'Sedang', '×2 coin/exp', 'Tidak ada'],
                ['📡 Lost Signal', 'Cukup', 'Mudah–Sedang', '×2 coin/exp', 'Tidak ada'],
                ['🧳 Merchant', 'Sering', 'Mudah', 'Item / multiplier', 'Zonk / loss'],
                ['🗡️ Penjajah', 'Jarang–Cukup', 'Sulit', '×2 coin/exp', '×0 (hard-fail)'],
              ],
            },
          },
        ],
        note:
          'Saat intro event, timer dibekukan, manfaatkan untuk baca lore & susun strategi tim. Untuk AI & Lost Signal, kata panjang/langka mempercepat progres. Untuk Penjajah, tetap tenang: fokus jawab Challenge dengan benar karena Steal & Block hanya membuang waktu, bukan hard-fail.',
      },
      {
        id: 'commands',
        title: 'Daftar Command',
        subsections: [
          {
            title: '🎮 Bermain',
            items: [
              '`/sambungkata mode:pvp`: buka lobby PvP.',
              '`/sambungkata mode:pvb kesulitan:...`: lawan bot AI.',
              '`/sambungkata mode:dungeon`: masuk Dungeon (butuh 🗝️).',
            ],
          },
          {
            title: '📊 Progress & Info',
            items: [
              '`/stats`: statistik lengkap & Player ID.',
              '`/leaderboard`: papan peringkat global.',
              '`/class`: pilih class & beli talent.',
              '`/quest`: dashboard quest harian/mingguan.',
              '`/kamus [kata]`: cek apakah kata ada di kamus.',
            ],
          },
          {
            title: '💰 Ekonomi',
            items: [
              '`/claim`: claim boost harian, server reward, & promo.',
              '`/shop`: beli boost & Golden Key.',
              '`/inventory`: lihat boost yang dimiliki.',
            ],
          },
          {
            title: '🛠️ Lainnya',
            items: [
              '`/help`: panduan lengkap di dalam Discord.',
              '`/masukan`: kirim saran atau laporan bug.',
            ],
          },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // VANILLATE GAMES (platform multi-game: Werewolf, Tahu Bulat, Story)
  // ═══════════════════════════════════════════════════════════════════
  'vanillate-games': {
    intro:
      'Vanillate Games adalah platform Discord multi-game berbahasa Indonesia. Tiga game aktif: Werewolf (deduksi sosial dengan katalog hingga 54 role modern), Tahu Bulat (simulasi bisnis idle), dan Vanillate Story (Life Simulation RPG di Kota Vanillate). Undang sekali, mainkan semuanya.',
    quickStart: [
      'Undang Vanillate Games ke server Discord kamu.',
      'Ketik `/gamewerewolf` untuk membuka lobi Werewolf.',
      'Ketik `/gametahu` untuk membuka dashboard Tahu Bulat.',
      'Ketik `/gamestory` untuk memulai perjalananmu di Kota Vanillate.',
      'Butuh panduan singkat? Ketik `/help` di dalam Discord.',
    ],
    sections: [
      {
        id: 'game-tersedia',
        title: 'Game yang Tersedia',
        intro:
          'Tiga game aktif dengan gaya berbeda. Semua dijalankan lewat slash command tunggal. Ketik `/` di channel mana pun untuk melihat daftarnya.',
        subsections: [
          {
            title: 'Tabel Ringkas',
            table: {
              headers: ['Game', 'Command', 'Genre', 'Format', 'Status'],
              rows: [
                ['Werewolf', '`/gamewerewolf`', 'Social Deduction', 'Multiplayer 4–12', 'Aktif · Katalog Lanjutan berkembang'],
                ['Tahu Bulat', '`/gametahu`', 'Idle Business Simulation', 'Solo · Peringkat global', 'Aktif · Modul paling matang'],
                ['Vanillate Story', '`/gamestory`', 'Life Simulation RPG', 'Single Player', 'Aktif · Dunia terus diperluas'],
              ],
            },
          },
          {
            title: 'Werewolf — Deduksi Sosial',
            items: [
              'Command: `/gamewerewolf` — buka lobi, host menekan Mulai setelah minimal 4 pemain masuk.',
              'Alur: fase Malam (peran khusus beraksi) → fase Siang (diskusi & voting).',
              'Menang: Warga menang bila semua serigala tereksekusi; Serigala menang bila jumlahnya menyamai warga.',
              'Mode Klasik (4 role dasar) atau Lanjutan (hingga 54 role modern).',
            ],
          },
          {
            title: 'Tahu Bulat — Simulasi Bisnis Idle',
            items: [
              'Command: `/gametahu` — buka dashboard usaha.',
              'Alur: jual tahu → upgrade → biarkan menghasilkan bahkan saat offline.',
              'Menang: bangun usahamu setinggi mungkin dan kumpulkan Rebirth untuk bonus permanen.',
              'Fondasi ekonomi platform; modul paling matang dan stabil.',
            ],
          },
          {
            title: 'Vanillate Story — Life Simulation RPG',
            items: [
              'Command: `/gamestory` — mulai sebagai perantau di Kota Vanillate dengan beban utang keluarga.',
              'Alur: bekerja, latih skill, jalin hubungan, lunasi utang 3.500.000 dalam 7 minggu.',
              'Menang: lunasi utang tepat waktu; gagal sekali = Game Over dan data direset.',
              'Dunia terbuka: 4 area, 39 lokasi, 63 pekerjaan, 36 NPC dengan jadwal harian.',
            ],
          },
        ],
        note: 'Setiap game jadi modul mandiri. Penambahan game baru tidak mengganggu game lain, dan command baru muncul otomatis di semua server tanpa perlu invite ulang.',
      },
      {
        id: 'platform-arsitektur',
        title: 'Arsitektur Platform',
        intro:
          'Vanillate Games dirancang sebagai platform, bukan sekadar kumpulan bot. Fondasi ini menjaga kualitas tiap game dan mempermudah penambahan game baru di masa depan.',
        subsections: [
          {
            title: 'Modular per Game',
            text: 'Tiap game (Werewolf, Tahu Bulat, Story) ada di modulnya sendiri: konfigurasi, schema data, command, controller, service, dan engine terpisah. Perubahan di satu game tidak menyentuh yang lain.',
          },
          {
            title: 'Data-Driven Engine (Werewolf)',
            text: 'Role Werewolf bukan ditulis sebagai kode khusus per role, melainkan sebagai data yang dibaca engine. Menambah role baru cukup menambah entry data — tanpa mengubah kode engine. Ini juga membuat interaksi antar-role selalu konsisten dan mudah di-tuning.',
          },
          {
            title: 'Satu Invite untuk Semuanya',
            text: 'Undang bot sekali, seluruh koleksi game langsung tersedia. Game berikutnya muncul otomatis sebagai command `/game...` baru di server yang sama.',
          },
          {
            title: 'Progres Terpisah per Game',
            text: 'Statistik Tahu Bulat, riwayat match Werewolf, dan progres Story disimpan terpisah per pemain. Bermain satu game tidak mengganggu progres game lain.',
          },
        ],
      },

      // ── WEREWOLF ─────────────────────────────────────────────
      {
        id: 'werewolf-cara-bermain',
        title: 'Werewolf · Cara Bermain',
        intro:
          'Werewolf adalah game deduksi sosial klasik. Sekawanan serigala bersembunyi di antara warga. Tiap malam ada yang jadi korban; tiap siang desa mengeksekusi satu tersangka. Bertahanlah dan menangkan kubumu.',
        subsections: [
          {
            title: 'Langkah 1 — Buka Lobi',
            text: 'Ketik `/gamewerewolf` di channel. Bot menampilkan lobi dengan tombol Gabung.',
          },
          {
            title: 'Langkah 2 — Kumpulkan Pemain',
            text: 'Butuh 4–12 pemain untuk mode Klasik. Setiap pemain menekan Gabung. Host adalah pemain yang membuka lobi.',
          },
          {
            title: 'Langkah 3 — Host Mulai',
            text: 'Setelah minimal 4 pemain masuk, host menekan Mulai. Peran dibagikan secara acak.',
          },
          {
            title: 'Langkah 4 — Terima Peran',
            text: 'Setiap pemain menekan Lihat Peran untuk melihat perannya secara rahasia. Jangan bocorkan ke pemain lain.',
          },
          {
            title: 'Langkah 5 — Mainkan Malam & Siang',
            text: 'Fase Malam: peran khusus (Serigala, Peramal, Tabib, dan role lain) beraksi diam-diam. Fase Siang: semua pemain hidup berdiskusi lalu voting satu tersangka untuk dieksekusi.',
          },
          {
            title: 'Cara Menang',
            items: [
              'Warga menang bila semua serigala tereksekusi.',
              'Serigala menang bila jumlahnya menyamai jumlah warga.',
              'Setiap kubu berjuang untuk kubunya sendiri; role neutral punya kondisi menang sendiri (lihat matriks kemenangan).',
            ],
          },
        ],
        note: 'Diskusi terjadi langsung di channel Discord kamu — bot hanya mengatur aksi rahasia, timer, dan voting.',
      },
      {
        id: 'werewolf-mode',
        title: 'Werewolf · Mode Klasik & Lanjutan',
        intro:
          'Host memilih mode di lobi sebelum mulai. Durasi timer sama untuk keduanya: aksi 50 detik, diskusi 3 menit, voting 1 menit, semuanya maju otomatis.',
        subsections: [
          {
            title: 'Mode Klasik',
            items: [
              '4 role dasar: Serigala, Peramal, Tabib, Warga.',
              'Sederhana dan cepat dipahami, cocok untuk pemain baru.',
              'Host bisa mempercepat fase kalau semua sudah beraksi.',
              'Komposisi menyesuaikan jumlah pemain: ~1 serigala tiap 5 pemain, Peramal sejak 4 pemain, Tabib sejak 6 pemain.',
            ],
          },
          {
            title: 'Mode Lanjutan',
            items: [
              'Hingga 54 role modern lintas tiga tim (21 Village, 13 Werewolf, 20 Neutral).',
              'Dipandu narator dengan sistem giliran — bot memanggil satu per satu peran malam sesuai prioritas resolusi.',
              'Saat giliranmu tiba, tekan Dashboard untuk beraksi.',
              'Cocok untuk sesi panjang dengan pemain berpengalaman.',
            ],
          },
          {
            title: 'Timer Fase (sama untuk kedua mode)',
            table: {
              headers: ['Fase', 'Durasi', 'Aktivitas'],
              rows: [
                ['Aksi Malam', '50 detik', 'Peran khusus beraksi diam-diam'],
                ['Diskusi Siang', '3 menit', 'Semua pemain hidup berdiskusi di channel'],
                ['Voting', '1 menit', 'Vote tersangka untuk dieksekusi'],
              ],
            },
          },
        ],
        note: 'Host punya tombol mempercepat fase kalau semua pemain sudah selesai beraksi, tidak perlu menunggu timer habis.',
      },
      {
        id: 'werewolf-fase',
        title: 'Werewolf · Fase Malam & Siang',
        intro:
          'Setiap ronde terdiri dari malam dan siang. Yang terjadi di masing-masing fase menentukan siapa yang bertahan dan siapa yang gugur.',
        subsections: [
          {
            title: 'Fase Malam',
            items: [
              'Serigala memilih satu mangsa (suara terbanyak yang dimangsa).',
              'Peramal menyelidiki satu pemain untuk tahu apakah ia serigala.',
              'Tabib melindungi satu pemain dari terkaman malam itu.',
              'Di mode Lanjutan, role tambahan (Investigator, Bodyguard, Vigilante, dll) beraksi sesuai prioritas resolusi.',
              'Host menekan Lanjut ke Siang untuk menyelesaikan malam.',
            ],
          },
          {
            title: 'Fase Siang',
            items: [
              'Semua pemain hidup berdiskusi di channel Discord.',
              'Voting: setiap pemain memilih satu tersangka.',
              'Suara terbanyak dieksekusi; seri = tidak ada eksekusi hari itu.',
              'Host menekan Hitung Suara untuk menutup siang.',
            ],
          },
        ],
        note: 'Malam dan siang bergantian sampai salah satu kubu memenuhi syarat kemenangan.',
      },
      {
        id: 'werewolf-mekanik',
        title: 'Werewolf · Sistem Attack & Defense',
        intro:
          'Semua interaksi serangan/pertahanan di mode Lanjutan menggunakan skala berjenjang 0–3. Serangan berhasil melumpuhkan korban hanya bila Attack > Defense (setelah proteksi malam itu diperhitungkan).',
        subsections: [
          {
            title: 'Skala Attack (kekuatan serangan)',
            table: {
              headers: ['Level', 'Nama', 'Contoh'],
              rows: [
                ['0', 'None', 'Role tanpa kill (Villager, Seer, Doctor)'],
                ['1', 'Basic', 'Werewolf, Vigilante, Serial Killer'],
                ['2', 'Powerful', 'Alpha Wolf, Berserk Wolf, Assassin, Beast Hunter'],
                ['3', 'Unstoppable', 'Jailer Eksekusi, Arsonist, Bomber, Pestilence'],
              ],
            },
          },
          {
            title: 'Skala Defense (ketahanan)',
            table: {
              headers: ['Level', 'Nama', 'Contoh'],
              rows: [
                ['0', 'None', 'Sebagian besar role warga'],
                ['1', 'Basic', 'Doctor menyembuhkan, Wolf Scribe (mantra), Serial Killer pasif'],
                ['2', 'Powerful', 'Priest memberkati, Guardian Angel menaungi, Bodyguard mengawal'],
                ['3', 'Invincible', 'Pestilence (bentuk akhir Plaguebearer)'],
              ],
            },
          },
          {
            title: 'Aturan Interaksi',
            items: [
              'Attack berhasil bila **Attack > Defense** (bukan ≥). Attack 1 vs Defense 1 = korban selamat.',
              'Basic ditahan Doctor Basic; Powerful menembus Doctor; Priest (Powerful) menahan Powerful; Unstoppable menembus semua kecuali Invincible.',
              'Invincible (Pestilence) hanya bisa dikalahkan lewat voting siang.',
            ],
          },
        ],
        note: 'Pendekatan berjenjang ini membuat interaksi antar-role selalu bisa diprediksi. Tuning balancing dilakukan dengan mengubah angka di katalog data, bukan menulis ulang kode.',
      },
      {
        id: 'werewolf-prioritas',
        title: 'Werewolf · Prioritas Resolusi Malam',
        intro:
          'Semua aksi malam diproses engine sesuai urutan prioritas berikut (angka kecil = lebih dulu). Sistem ini menjaga konflik antar-kemampuan selalu diselesaikan secara deterministik.',
        subsections: [
          {
            title: 'Urutan Resolusi',
            table: {
              headers: ['Prioritas', 'Kategori', 'Contoh Aksi'],
              rows: [
                ['10', 'Control / Redirect', 'Wolf Trickster, Witch (belokkan aksi target)'],
                ['20', 'Roleblock / Kurungan', 'Jailer memenjara, Nightmare Wolf melumpuhkan'],
                ['30', 'Investigasi', 'Seer menerawang, Detective, Investigator, Sheriff, Lookout, Tracker'],
                ['40', 'Proteksi', 'Doctor, Priest, Bodyguard, Guardian Angel, Trapper'],
                ['50', 'Serangan', 'Werewolf menerkam, Vigilante menembak, Serial Killer, Assassin'],
                ['60', 'Konversi', 'Alpha Wolf menggigit, Vampire, Cult Leader merekrut'],
                ['70', 'Efek Lain', 'Wolf Shaman memfitnah, dll'],
              ],
            },
          },
          {
            title: 'Kenapa Urutan Ini Penting',
            items: [
              'Control/redirect diproses paling awal — bisa memaksa Doctor melindungi target lain sebelum serangan dihitung.',
              'Roleblock dijalankan sebelum aksi investigasi/proteksi/serangan target — target yang di-roleblock tidak beraksi malam itu.',
              'Proteksi datang sebelum serangan — Doctor sempat menyelamatkan target sebelum terkaman diproses.',
              'Konversi diproses setelah serangan — korban yang mati tak bisa dikonversi.',
            ],
          },
        ],
      },
      {
        id: 'werewolf-peran-dasar',
        title: 'Werewolf · Peran Dasar (Mode Klasik)',
        intro:
          'Empat role dasar yang muncul di mode Klasik. Komposisi disesuaikan otomatis mengikuti jumlah pemain.',
        subsections: [
          {
            title: 'Werewolf (Serigala)',
            text: 'Anggota kawanan. Setiap malam kawanan sepakat memangsa satu warga (suara terbanyak). Menang bila jumlah serigala menyamai jumlah warga.',
          },
          {
            title: 'Seer (Peramal)',
            text: 'Setiap malam boleh menerawang satu pemain — hasilnya SERIGALA atau BUKAN. Peran vital untuk desa, sekaligus target utama serigala. Jangan buka jati diri terlalu cepat.',
          },
          {
            title: 'Doctor (Tabib)',
            text: 'Setiap malam boleh melindungi satu pemain dari terkaman (Defense Basic). Punya obat cadangan untuk self-heal 1× saat genting.',
          },
          {
            title: 'Villager (Warga)',
            text: 'Tanpa kemampuan malam. Andalkan diskusi dan voting siang untuk mengungkap serigala. Suaramu adalah senjatamu.',
          },
          {
            title: 'Komposisi Otomatis',
            items: [
              'Sekitar 1 serigala per 5 pemain (5 pemain = 1 serigala, 10 pemain = 2 serigala).',
              'Peramal aktif sejak 4 pemain.',
              'Tabib aktif sejak 6 pemain.',
              'Sisanya jadi Warga biasa.',
            ],
          },
        ],
        note: 'Mode Lanjutan menyediakan 54 role tambahan — dibahas di section berikutnya.',
      },
      {
        id: 'werewolf-katalog-village',
        title: 'Werewolf · Katalog Peran Village (21)',
        intro:
          'Tim Village menang bila semua serigala dan ancaman neutral pembunuh tereksekusi. Kekuatan mereka: informasi (investigasi), proteksi, dan deduksi kolektif saat voting. Kelemahannya: rentan disinformasi dan kehilangan role kunci.',
        subsections: [
          {
            title: 'Investigasi',
            table: {
              headers: ['Peran', 'Att/Def', 'Kesulitan', 'Kemampuan Utama'],
              rows: [
                ['Seer (Peramal)', '0/0', 'Mudah', 'Terawang: hasilnya SERIGALA atau BUKAN.'],
                ['Detective', '0/0', 'Menengah', 'Selidiki role persis target.'],
                ['Investigator', '0/0', 'Menengah', 'Petunjuk berupa kelompok kemungkinan role.'],
                ['Sheriff', '0/0', 'Mudah', 'Interogasi biner: MENCURIGAKAN atau BERSIH.'],
                ['Psychic', '0/0', 'Menengah', 'Malam ganjil: visi 3 pemain (≥1 jahat). Malam genap: visi 2 pemain (≥1 baik).'],
                ['Medium', '0/0', 'Menengah', 'Berbicara dengan arwah pemain yang telah mati.'],
              ],
            },
          },
          {
            title: 'Pengintai',
            table: {
              headers: ['Peran', 'Att/Def', 'Kesulitan', 'Kemampuan Utama'],
              rows: [
                ['Lookout', '0/0', 'Menengah', 'Lihat semua pengunjung sebuah target malam ini.'],
                ['Tracker', '0/0', 'Menengah', 'Lihat ke mana target pergi malam ini.'],
                ['Spy', '0/0', 'Menengah', 'Tahu pemain mana yang dikunjungi serigala (tanpa identitas serigalanya).'],
              ],
            },
          },
          {
            title: 'Proteksi',
            table: {
              headers: ['Peran', 'Att/Def', 'Kesulitan', 'Kemampuan Utama'],
              rows: [
                ['Doctor (Tabib)', '0/0', 'Mudah', 'Lindungi 1 target (Defense Basic) + obat cadangan 1×.'],
                ['Bodyguard', '2/0', 'Menengah', 'Mengawal; mati bersama penyerang untuk menyelamatkan target.'],
                ['Priest', '0/0', 'Menengah', 'Berkati (Defense Powerful + kebal konversi), jatah 2×.'],
                ['Trapper', '0/0', 'Sulit', 'Pasang jebakan: proteksi + roleblock + mengungkap penyerang pertama.'],
              ],
            },
          },
          {
            title: 'Kendali & Pembunuh',
            table: {
              headers: ['Peran', 'Att/Def', 'Kesulitan', 'Kemampuan Utama'],
              rows: [
                ['Jailer', '3/0', 'Sulit', 'Penjarakan 1 pemain (bungkam + lindungi + opsi eksekusi Unstoppable, jatah 3).'],
                ['Vigilante', '1/0', 'Sulit', 'Tembak malam (3 peluru). Salah tembak warga = bunuh diri karena guilt.'],
                ['Gunner', '1/0', 'Sulit', 'Tembak publik di siang hari (2 peluru). Salah tembak = dieksekusi keesokan harinya.'],
                ['Beast Hunter', '2/1', 'Menengah', 'Buru serigala (efektif hanya bila target Serigala, 2×) + naluri tahan 1 serangan.'],
              ],
            },
          },
          {
            title: 'Dukungan',
            table: {
              headers: ['Peran', 'Att/Def', 'Kesulitan', 'Kemampuan Utama'],
              rows: [
                ['Villager', '0/0', 'Mudah', 'Tulang punggung suara desa; tanpa aksi malam.'],
                ['Mayor', '0/0', 'Menengah', 'Buka jati diri untuk suara bernilai 3 (1×). Tak bisa di-heal setelah reveal.'],
                ['Mason', '0/0', 'Mudah', 'Saling mengenal sesama Mason (blok warga terkonfirmasi).'],
                ['Cupid', '0/0', 'Sulit', 'Malam pertama menautkan sepasang kekasih (hidup-mati bersama).'],
              ],
            },
          },
        ],
        note: 'Seer, Detective, Jailer, Mayor bersifat unik (maksimal 1 per game). Selain itu boleh muncul lebih dari satu tergantung komposisi.',
      },
      {
        id: 'werewolf-katalog-serigala',
        title: 'Werewolf · Katalog Peran Serigala (13)',
        intro:
          'Tim Serigala menang bila jumlah mereka menyamai atau melebihi jumlah non-serigala. Kekuatan: kill kolektif tiap malam, bisik kawanan, dan disinformasi siang. Kelemahan: minoritas di awal, terekspos oleh investigasi. Serigala berbagi satu terkaman kolektif; tiap varian menambah bumbu strategis.',
        subsections: [
          {
            title: 'Serigala Dasar & Pemimpin',
            table: {
              headers: ['Peran', 'Att/Def', 'Kesulitan', 'Kemampuan Utama'],
              rows: [
                ['Werewolf', '1/0', 'Mudah', 'Anggota kawanan; berbagi satu terkaman malam (Basic).'],
                ['Alpha Wolf', '2/0', 'Ahli', 'Terkaman Powerful + gigitan konversi warga jadi serigala (1×). Digagalkan Priest.'],
                ['Wolf Avenger', '2/0', 'Menengah', 'Setiap serigala tewas → terkaman berikutnya jadi Powerful.'],
                ['Berserk Wolf', '2/0', 'Sulit', 'Terkaman kawanan jadi Powerful (menembus Doctor Basic).'],
              ],
            },
          },
          {
            title: 'Info & Manipulasi',
            table: {
              headers: ['Peran', 'Att/Def', 'Kesulitan', 'Kemampuan Utama'],
              rows: [
                ['Wolf Seer', '1/0', 'Menengah', 'Terawang role persis target dan bagikan ke kawanan.'],
                ['Wolf Shaman', '1/0', 'Sulit', 'Fitnah warga (tampak serigala bagi Seer/Sheriff) + jampi lindung serigala 2×.'],
                ['Wolf Scribe', '1/0', 'Menengah', 'Beri serigala Basic defense ATAU terkamannya Powerful (pilih satu).'],
                ['Wolf Trickster', '1/0', 'Ahli', 'Alihkan aksi pemain A ke target B (control).'],
              ],
            },
          },
          {
            title: 'Siluman & Kill Spesial',
            table: {
              headers: ['Peran', 'Att/Def', 'Kesulitan', 'Kemampuan Utama'],
              rows: [
                ['Shadow Wolf', '1/0', 'Menengah', 'Tak terlihat Lookout & Tracker.'],
                ['Nightmare Wolf', '1/0', 'Sulit', 'Roleblock 1 target (Doctor/Jailer/Vigilante jadi tak beraksi).'],
                ['Kitten Wolf', '1/0', 'Menengah', 'Tampak BUKAN serigala di mata Seer & Sheriff (Detective tetap membongkar).'],
                ['Toxic Wolf', '1/0', 'Sulit', 'Racuni target; korban tewas setelah 1 malam kecuali disembuhkan.'],
                ['Lone Wolf', '1/0', 'Ahli', 'Menang bila jadi satu-satunya serigala yang bertahan hingga akhir.'],
              ],
            },
          },
        ],
        note: 'Alpha Wolf, Wolf Seer, Wolf Shaman, Wolf Trickster, Wolf Scribe, Wolf Avenger, Nightmare Wolf, Berserk Wolf, Kitten Wolf, Toxic Wolf, dan Lone Wolf bersifat unik (maks 1 per game). Werewolf & Shadow Wolf boleh muncul lebih dari satu.',
      },
      {
        id: 'werewolf-katalog-neutral',
        title: 'Werewolf · Katalog Peran Neutral (20)',
        intro:
          'Neutral punya kondisi menang sendiri (bukan Village atau Werewolf). Mereka menyeimbangkan game sebagai "faksi ketiga" yang tak bisa dipercaya penuh oleh kubu mana pun.',
        subsections: [
          {
            title: 'Pembunuh Solo',
            table: {
              headers: ['Peran', 'Att/Def', 'Kesulitan', 'Kemampuan & Menang'],
              rows: [
                ['Serial Killer', '1/1', 'Sulit', 'Tikam tiap malam + kebal roleblock (membunuh yang meng-roleblock). Menang: jadi terakhir.'],
                ['Assassin', '2/0', 'Sulit', 'Tikam Powerful, jatah 3. Menang: jadi terakhir.'],
                ['Arsonist', '3/1', 'Sulit', 'Siram bensin (tandai) + bakar (Unstoppable ke semua tersiram). Menang: jadi terakhir.'],
                ['Bomber', '3/0', 'Sulit', 'Pasang bom + ledakkan (Unstoppable ke target + pengunjungnya). Menang: jadi terakhir.'],
              ],
            },
          },
          {
            title: 'Kekacauan',
            table: {
              headers: ['Peran', 'Att/Def', 'Kesulitan', 'Kemampuan & Menang'],
              rows: [
                ['Jester', '0/0', 'Menengah', 'Bertingkah mencurigakan agar dieksekusi voting. Menang bila dilynch + menghantui 1 pemilihnya (Unstoppable).'],
                ['Executioner', '0/1', 'Menengah', 'Punya target wajib digantung. Kebal serangan malam Basic. Bila target mati non-lynch → berubah jadi Jester.'],
              ],
            },
          },
          {
            title: 'Penyintas & Peniru',
            table: {
              headers: ['Peran', 'Att/Def', 'Kesulitan', 'Kemampuan & Menang'],
              rows: [
                ['Survivor', '0/0', 'Mudah', 'Rompi antipeluru (self-protect Basic, 4×). Menang: selamat hingga akhir bersama kubu mana pun.'],
                ['Guardian Angel', '0/0', 'Menengah', 'Menaungi ward (Powerful, 2×). Bila ward mati → jadi Survivor. Menang: ward hidup di akhir.'],
                ['Amnesiac', '0/0', 'Menengah', 'Ingat role pemain mati → jadi role tersebut. Menang sesuai role yang diingat.'],
                ['Doppelganger', '0/0', 'Ahli', 'Malam 1 tandai target; saat target mati → jadi role & tim target. Menang sesuai role yang disalin.'],
              ],
            },
          },
          {
            title: 'Konversi',
            table: {
              headers: ['Peran', 'Att/Def', 'Kesulitan', 'Kemampuan & Menang'],
              rows: [
                ['Vampire', '1/0', 'Sulit', 'Gigit warga jadi vampir (berantai). Menang: vampir menyamai yang hidup.'],
                ['Vampire Hunter', '2/0', 'Menengah', 'Tusuk pancang (Powerful, hanya melukai Vampir). Bila vampir habis → jadi Vigilante.'],
                ['Cult Leader', '0/0', 'Sulit', 'Rekrut warga jadi Cultist (cooldown 1). Menang: semua yang hidup jadi kultus.'],
                ['Cultist', '0/0', 'Menengah', 'Anggota kultus; bisa naik jadi pemimpin bila Cult Leader mati.'],
              ],
            },
          },
          {
            title: 'Wabah, Pemanen & Manipulator',
            table: {
              headers: ['Peran', 'Att/Def', 'Kesulitan', 'Kemampuan & Menang'],
              rows: [
                ['Plaguebearer', '0/0', 'Sulit', 'Tulari via interaksi. Semua tertular → berubah jadi Pestilence.'],
                ['Pestilence', '3/3', 'Ahli', 'Serang Unstoppable + Invincible. Hanya bisa dikalahkan lewat voting. Menang: jadi terakhir.'],
                ['Soul Collector', '3/0', 'Sulit', 'Panen jiwa (Unstoppable, cooldown 1). Menang: kumpulkan 4 jiwa.'],
                ['Necromancer', '1/0', 'Ahli', 'Bangkitkan mayat & pakai kemampuannya sekali. Menang: jadi terakhir.'],
                ['Witch', '0/0', 'Sulit', 'Kendalikan pemain (paksa A beraksi pada B) + kebal saat aktif. Menang: selamat & Village tidak menang.'],
                ['Bandit', '1/0', 'Sulit', 'Rampok target (roleblock + curi kemampuannya semalam). Menang: selamat hingga akhir.'],
              ],
            },
          },
        ],
        note: 'Beberapa neutral (Survivor, Guardian Angel, Amnesiac, kekasih Cupid) dapat menang bersama kubu pemenang. Kondisi spesifik (Jester, Executioner, konversi, transform) dievaluasi saat peristiwanya terjadi.',
      },
      {
        id: 'werewolf-menang',
        title: 'Werewolf · Matriks Kondisi Kemenangan',
        intro:
          'Tidak semua role menang lewat "kubu terakhir yang berdiri". Berikut ringkasan semua kondisi menang yang dikenal engine.',
        subsections: [
          {
            title: 'Ringkasan',
            table: {
              headers: ['Kode Kondisi', 'Role', 'Cara Menang'],
              rows: [
                ['TEAM (Village)', 'Semua role Village (21)', 'Semua Serigala & neutral pembunuh tereliminasi.'],
                ['TEAM (Werewolf)', 'Semua role Werewolf (13) kecuali Lone Wolf', 'Serigala ≥ non-serigala hidup.'],
                ['LONE_WOLF', 'Lone Wolf', 'Menjadi satu-satunya serigala yang bertahan hingga menang.'],
                ['TEAM_OR_LOVERS', 'Cupid', 'Menang bersama Village, atau kekasih yang ditaut jadi dua terakhir.'],
                ['ALONE', 'Serial Killer, Arsonist, Assassin, Bomber, Pestilence, Necromancer, Soul Collector', 'Menjadi pihak terakhir yang berdiri.'],
                ['HAUNT', 'Jester', 'Dieksekusi lewat voting siang.'],
                ['TARGET_LYNCHED', 'Executioner', 'Targetnya dieksekusi voting (jika tidak → jadi Jester).'],
                ['SURVIVE', 'Survivor', 'Hidup saat permainan berakhir (menang bersama siapa pun).'],
                ['PROTECT_TARGET', 'Guardian Angel', 'Ward-nya hidup di akhir (jika ward mati → jadi Survivor).'],
                ['REMEMBERED / COPIED', 'Amnesiac, Doppelganger', 'Menang sesuai role yang diingat/disalin.'],
                ['CONVERT_PARITY', 'Vampire', 'Vampir menyamai yang hidup.'],
                ['CONVERT_ALL', 'Cult Leader, Cultist', 'Semua yang hidup jadi kultus.'],
                ['KILL_VAMPIRES', 'Vampire Hunter', 'Semua vampir musnah (lalu jadi Vigilante).'],
                ['TRANSFORM', 'Plaguebearer', 'Semua tertular → menjadi Pestilence.'],
                ['SURVIVE_EVIL', 'Witch', 'Selamat & Village tidak menang.'],
                ['SURVIVE_ROB', 'Bandit', 'Selamat hingga akhir.'],
              ],
            },
          },
        ],
        note: 'Engine mendukung banyak pemenang dalam satu match. Contoh: Village menang + Survivor selamat = dua entitas menang. Cupid dan kekasihnya bisa membentuk kemenangan sub-tim yang unik.',
      },
      {
        id: 'werewolf-balancing',
        title: 'Werewolf · Balancing & Komposisi',
        intro:
          'Prinsip yang menjaga game tetap seimbang lintas komposisi. Role dan angka bisa di-tuning tanpa mengubah kode engine.',
        subsections: [
          {
            title: 'Prinsip Balancing',
            items: [
              'Skala attack/defense menyatukan semua interaksi bunuh/lindungi → mudah diprediksi dan di-tuning.',
              'Role unik (Seer, Jailer, Alpha, dll) mencegah penumpukan kekuatan sejenis.',
              'Jatah pemakaian & cooldown membatasi role kill/konversi agar tak liar.',
              'Counter tematik disebar merata: Priest melawan konversi, Vampire Hunter melawan Vampire, Beast Hunter melawan Serigala, roleblock-immune melawan Jailer/Nightmare, voting melawan Pestilence.',
              'Neutral menambah faksi ketiga penyeimbang; kondisi menang mereka dirancang sulit agar tidak mendominasi tetapi berdampak besar bila tercapai.',
            ],
          },
          {
            title: 'Rekomendasi Komposisi (Contoh 12 Pemain)',
            items: [
              '7–8 Village: 2–3 investigatif (Seer/Detective/Investigator/Sheriff), 1–2 proteksi (Doctor/Bodyguard/Priest), 0–1 kill (Vigilante/Jailer), sisanya Villager/Mason.',
              '3 Werewolf: 1 pemimpin/varian info (Alpha/Wolf Seer), 1 varian kontrol (Nightmare/Shadow/Berserk), 1 Werewolf dasar.',
              '1–2 Neutral: maksimal 1 pembunuh; sisanya penyintas atau kekacauan (Jester/Survivor).',
            ],
          },
          {
            title: 'Engine Berbasis Data',
            text: 'Role bukan ditulis sebagai kode khusus, melainkan sebagai data yang dibaca engine. Ini membuat penambahan role baru cukup dengan menambah entry data — tanpa mengubah kode engine — dan memastikan interaksi antar-role selalu konsisten.',
          },
        ],
      },
      {
        id: 'werewolf-tips',
        title: 'Werewolf · Tips',
        subsections: [
          {
            title: 'Strategi per Peran Dasar',
            items: [
              'Serigala: berpura-puralah jadi warga, arahkan curiga ke orang lain, dan koordinasi diam-diam sesama serigala.',
              'Peramal: jangan buru-buru buka jati diri — kamu target utama serigala. Bocorkan hasil selidik hanya saat momen kritis.',
              'Tabib: lindungi pemain yang tampak penting (Peramal aktif, atau diri sendiri di saat genting).',
              'Warga: perhatikan pola voting siang. Serigala sering saling melindungi dan menghindari saling menuduh.',
            ],
          },
          {
            title: 'Etika Diskusi',
            items: [
              'Diskusi terjadi di channel Discord kamu, bukan di bot. Semua pemain hidup boleh bicara.',
              'Pemain yang sudah tereliminasi sebaiknya tidak ikut mengarahkan diskusi.',
              'Jangan bocorkan peranmu di channel publik kecuali strategimu memang membutuhkan.',
            ],
          },
        ],
      },

      // ── TAHU BULAT ───────────────────────────────────────────
      {
        id: 'tahu-cara-bermain',
        title: 'Tahu Bulat ·Cara Bermain',
        subsections: [
          {
            title: '📱 Buka Dashboard',
            text: 'Ketik `/gametahu` kapan saja untuk membuka usahamu. Modal awal: 1.000 coin.',
          },
          {
            title: '🥟 Jual Tahu',
            text: 'Tekan tombol Jual Tahu. Kendaraan mulai berjualan selama beberapa detik (cooldown awal 5 detik). Selama menggoreng, semua tombol terkunci, tidak perlu pencet apa pun.',
          },
          {
            title: '✨ Otomatis Masuk',
            text: 'Saat selesai, dashboard update sendiri dan coin langsung bertambah. Tidak perlu refresh manual.',
          },
          {
            title: '🌙 Pendapatan Offline',
            text: 'Saat kamu pergi, tokomu tetap menghasilkan, hingga 8 jam, sekitar 50% dari kecepatan aktif. Buka `/gametahu` lagi untuk mengklaimnya.',
          },
        ],
        note: 'Rumus pendapatan: Base × Kendaraan × Peralatan × Bahan × Promosi × Rebirth.',
      },
      {
        id: 'tahu-kendaraan',
        title: 'Tahu Bulat ·Kendaraan',
        intro:
          'Kendaraan menentukan pendapatan dasar dan bonus. Semakin tinggi tingkatnya, semakin besar cuan. Upgrade lewat `/gametahu` → 🔧 Upgrade → Kendaraan.',
        subsections: [
          {
            table: {
              headers: ['Kendaraan', 'Base', 'Bonus', 'Harga'],
              rows: [
                ['Gerobak Kayu', '100', '+0%', 'Kendaraan awal'],
                ['Motor Tahu', '350', '+25%', '5.000 coin'],
                ['Pick Up Tahu', '1.000', '+75%', '50.000 coin'],
                ['Van Tahu', '4.000', '+150%', '500.000 coin'],
                ['Food Truck', '15.000', '+300%', '5.000.000 coin'],
              ],
            },
          },
        ],
        note: 'Food Truck adalah kendaraan tertinggi dan menjadi syarat Rebirth.',
      },
      {
        id: 'tahu-peralatan',
        title: 'Tahu Bulat ·Peralatan',
        intro:
          'Ada 10 jenis peralatan, masing-masing maksimal Level 5. Setiap upgrade menambah bonus pendapatan. Harga upgrade naik 1.35× tiap level. Upgrade lewat 🔧 Upgrade → Peralatan.',
        subsections: [
          {
            title: '⚙️ Peralatan Spesial',
            items: [
              '🔥 Kompor: memangkas cooldown jualan (Lv1: 5 detik → Lv5: 2 detik). Cooldown lebih cepat = lebih sering jual.',
              '📢 Banner Promosi: memperkuat efek promosi.',
            ],
          },
          {
            title: '📋 Daftar Lengkap',
            text: 'Penggorengan, Kompor, Speaker, Etalase, Mesin Adonan, Mesin Pemotong, Rak Bumbu, Mesin Pengemas, Dekorasi, Banner Promosi.',
          },
        ],
      },
      {
        id: 'tahu-bahan',
        title: 'Tahu Bulat ·Bahan',
        intro:
          'Bahan adalah progres jangka panjang: 30 jenis, masing-masing maksimal Level 50. Tiap level menambah bonus kecil, tapi kalau banyak bahan bertingkat tinggi, pendapatan berlipat ganda.',
        subsections: [
          {
            items: [
              'Harga upgrade naik 1.18× per level.',
              'Semua bahan harus Lv50 untuk bisa Rebirth.',
              'Dipilih lewat menu bertingkat (🔧 Upgrade → Bahan), ada beberapa halaman.',
            ],
          },
        ],
        note: 'Fokus bahan saat sudah kuat. Ini kunci pendapatan besar di late game.',
      },
      {
        id: 'tahu-promosi',
        title: 'Tahu Bulat ·Promosi',
        intro:
          'Promosi memberi bonus pendapatan sementara. Hanya satu promosi aktif dalam satu waktu. Beli lewat `/gametahu` → 📢 Promosi.',
        subsections: [
          {
            table: {
              headers: ['Promosi', 'Bonus', 'Durasi', 'Harga'],
              rows: [
                ['📰 Poster', '+15%', '30 menit', '5.000 coin'],
                ['📻 Radio', '+25%', '45 menit', '12.000 coin'],
                ['📺 Televisi', '+40%', '1 jam', '20.000 coin'],
                ['📱 Media Sosial', '+50%', '1 jam', '25.000 coin'],
              ],
            },
          },
        ],
        note: 'Efek promosi bisa diperkuat dengan menaikkan level Banner Promosi.',
      },
      {
        id: 'tahu-rebirth',
        title: 'Tahu Bulat ·Rebirth',
        intro:
          'Rebirth mengulang usaha dari awal demi bonus permanen +20% setiap kali melakukannya, dan bonusnya menumpuk selamanya.',
        subsections: [
          {
            title: '✅ Syarat Rebirth',
            items: [
              'Kendaraan sudah Food Truck.',
              'Semua peralatan Level 5.',
              'Semua bahan Level 50.',
            ],
          },
          {
            title: '🔄 Apa yang Terjadi',
            items: [
              'Direset: coin, kendaraan, peralatan, bahan, promosi.',
              'Tetap aman: jumlah rebirth, statistik, achievement.',
            ],
          },
        ],
        note: 'Tidak bisa Rebirth saat sedang berjualan.',
      },
      {
        id: 'tahu-misi',
        title: 'Tahu Bulat ·Misi Harian',
        intro:
          'Selesaikan misi setiap hari untuk hadiah coin. Reset otomatis tiap tengah malam WIB. Buka lewat `/gametahu` → 🎯 Misi.',
        subsections: [
          {
            table: {
              headers: ['Misi', 'Target', 'Hadiah'],
              rows: [
                ['🥟 Tukang Jualan', 'Jual tahu 10 kali hari ini', '2.000 coin'],
                ['💰 Pemburu Cuan', 'Kumpulkan 5.000 coin dari penjualan hari ini', '3.000 coin'],
                ['🔧 Rajin Upgrade', 'Lakukan 3 upgrade hari ini', '2.500 coin'],
              ],
            },
          },
        ],
        note: 'Progres tercatat otomatis dari aktivitasmu (jualan & upgrade). Klaim hadiah di menu misi saat sudah selesai.',
      },
      {
        id: 'tahu-peringkat',
        title: 'Tahu Bulat ·Peringkat & Achievement',
        subsections: [
          {
            title: '🏆 Peringkat',
            items: [
              'Bandingkan dirimu dengan pemain lain.',
              'Kategori: 💰 Total Coin Dihasilkan, 🧧 Kekayaan, ♻️ Total Rebirth.',
              'Buka: `/gametahu` → 🏆 Peringkat (bisa ganti kategori di dalamnya).',
            ],
          },
          {
            title: '🎖️ Achievement',
            items: [
              '12 pencapaian yang terbuka otomatis saat mencapai target tertentu (misal: jualan pertama, jutawan, armada lengkap, rebirth).',
              'Notifikasi muncul di dashboard.',
              'Permanen, tidak hilang saat Rebirth.',
              'Buka: `/gametahu` → 🎖️ Achievement.',
            ],
          },
        ],
      },
      {
        id: 'tahu-tips',
        title: 'Tahu Bulat ·Tips & FAQ',
        subsections: [
          {
            title: '💡 Tips',
            items: [
              'Tidak perlu pencet Refresh. Dashboard update sendiri saat jualan selesai.',
              'Malas klik satu-satu? Buka 🔧 Upgrade → ⬆️ Upgrade Semua untuk menaikkan semua peralatan & bahan sekaligus (beli yang termurah dulu).',
              'Pergi lama? Tokomu tetap jualan (pendapatan offline). Rajin buka `/gametahu`.',
              'Prioritaskan Kompor dulu → cooldown cepat → lebih sering jual.',
              'Bahan adalah kunci penghasilan besar; sabar naikkan sedikit demi sedikit.',
              'Kumpulkan untuk Rebirth demi bonus permanen.',
            ],
          },
          {
            title: '❓ FAQ',
            items: [
              'Progresku hilang? Tidak. Semua tersimpan otomatis di server.',
              'Bisa main bareng teman? Bisa; tiap orang punya usaha sendiri, lalu adu di 🏆 Peringkat.',
              'Kenapa tombol terkunci? Sedang menggoreng. Tunggu beberapa detik, nanti terbuka sendiri.',
            ],
          },
        ],
      },
      // ── VANILLATE STORY ─────────────────────────────────────
      {
        id: 'story-sekilas',
        title: 'Vanillate Story · Sekilas',
        intro:
          'Vanillate Story adalah Life Simulation RPG single player berbasis Discord. Kamu perantau yang datang ke Kota Vanillate membawa beban utang keluarga kepada Bang Jul. Dari titik nol — tanpa pekerjaan, tanpa harta, tanpa pengalaman — jalan hidupmu sepenuhnya milikmu.',
        subsections: [
          {
            title: 'Genre & Format',
            items: [
              'Genre: Life Simulation RPG.',
              'Format: single player (dunia bersama; tiap pemain menjalani kisahnya sendiri).',
              'Command: `/gamestory` untuk memulai atau melanjutkan perjalanan.',
              'Tersedia dokumentasi desain (folder `docs/story/`): DECISIONS.md, ROADMAP.md, NPC_SEED_DATA, AREAS_LOCATIONS, JOBS_BY_AREA, dan profil heroine.',
            ],
          },
          {
            title: 'Aktivitas Utama',
            items: [
              'Bekerja untuk menghasilkan uang.',
              'Berlatih untuk meningkatkan skill.',
              'Menjalin hubungan dengan warga Kota Vanillate.',
              'Melunasi utang keluarga sebelum tenggat.',
            ],
          },
        ],
        note: 'Tidak ada jalan yang benar atau salah. Kamu bisa jadi pekerja teladan, pengusaha, petani yang hidup tenang, pemancing legendaris, koki terkenal, atau sekadar menikmati hidup sederhana bersama orang yang kamu sayangi.',
      },
      {
        id: 'story-premis',
        title: 'Vanillate Story · Premis',
        intro:
          'Setiap game Story dimulai dengan premis yang sama: kamu perantau baru di Kota Vanillate dengan beban utang keluarga. Cerita berjalan dari sana.',
        subsections: [
          {
            title: 'Latar Belakang',
            text: 'Kamu datang ke Kota Vanillate sebagai perantau. Keluargamu meninggalkan warisan berupa utang kepada rentenir bernama Bang Jul, dan sekarang tanggung jawab itu ada di pundakmu. Tanpa pekerjaan, tanpa harta, tanpa jaringan — kamu harus membangun kehidupan dari nol.',
          },
          {
            title: 'Tujuan Akhir',
            items: [
              'Bekerja untuk menghasilkan uang.',
              'Meningkatkan kemampuan lewat latihan skill.',
              'Menjalin hubungan dengan warga Kota Vanillate.',
              'Melunasi seluruh utang sebelum tenggat 7 minggu.',
            ],
          },
          {
            title: 'Sifat Progres',
            text: 'Progres terasa nyata: skill yang kamu latih membuka profesi bergaji lebih tinggi, hubungan yang kamu bangun mempermudah interaksi, dan setiap keputusan hari ini memengaruhi peluang besok.',
          },
        ],
      },
      {
        id: 'story-target',
        title: 'Vanillate Story · Target Utama & Tenggat Utang',
        intro:
          'Story punya satu tenggat besar yang menggerakkan seluruh permainan: lunasi utang keluarga sebelum minggu ke-7.',
        subsections: [
          {
            title: 'Angka & Batas Waktu',
            table: {
              headers: ['Aspek', 'Nilai'],
              rows: [
                ['Total utang', '3.500.000 coin'],
                ['Batas waktu', '7 minggu'],
                ['Pembayaran', 'Setiap minggu (mingguan)'],
                ['Konsekuensi gagal bayar sekali', 'Game Over dan data pemain direset'],
              ],
            },
          },
          {
            title: 'Manajemen Cicilan',
            items: [
              'Cicilan wajib dibayar tiap minggu; besaran mingguan disesuaikan sisa utang dan sisa minggu.',
              'Bayar lebih awal atau lebih besar diperbolehkan — mengurangi total utang lebih cepat.',
              'Sisa utang, tenggat minggu berjalan, dan estimasi pembayaran berikutnya ditampilkan di dashboard `/gametahu`… eh, `/gamestory`.',
            ],
          },
          {
            title: 'Kenapa Ada Tenggat',
            text: 'Utang menjadi motor cerita: memaksamu memilih antara kerja lembur demi uang, latihan skill demi masa depan, atau membangun hubungan demi bantuan. Setiap keputusan punya biaya waktu.',
          },
        ],
        note: 'Gagal membayar sekali saja berarti Game Over dan reset data. Rencanakan penghasilan dan pengeluaran minggu ini dengan hati-hati.',
      },
      {
        id: 'story-siklus',
        title: 'Vanillate Story · Siklus Harian',
        intro:
          'Setiap hari punya struktur yang sama: bangun pagi, jalankan aktivitas, tidur untuk mengakhiri hari.',
        subsections: [
          {
            title: 'Alur Hari',
            items: [
              'Hari dimulai pukul 06.00 dengan energi penuh.',
              'Setiap aktivitas mengurangi waktu (jam) dan energi.',
              'Aktivitas tertentu (makan, tidur) memulihkan energi.',
              'Hari berakhir ketika pemain tidur di rumah — waktu tidak "habis otomatis" tanpa tidur.',
              'Pukul reset ke 06.00 keesokan harinya, energi kembali penuh.',
            ],
          },
          {
            title: 'Sumber Daya Utama',
            table: {
              headers: ['Sumber Daya', 'Cara Diperoleh', 'Cara Habis'],
              rows: [
                ['Waktu (jam)', 'Reset 06.00 tiap hari', 'Habis dipakai aktivitas & tidur'],
                ['Energi', 'Reset 06.00 + makan', 'Habis dipakai aktivitas berat (kerja, latihan)'],
                ['Uang (coin)', 'Kerja, jual ikan/item', 'Beli makanan, hadiah, item; bayar cicilan'],
                ['Skill', 'Latihan spesifik', 'Tidak habis (permanen)'],
              ],
            },
          },
        ],
        note: 'Tidur adalah satu-satunya cara mengakhiri hari. Jangan lupa tidur di rumah agar energi & waktu reset dengan benar.',
      },
      {
        id: 'story-aktivitas',
        title: 'Vanillate Story · Daftar Aktivitas',
        intro:
          'Berikut aktivitas yang bisa kamu jalankan dari dashboard `/gamestory`. Semua aktivitas menghabiskan waktu; sebagian juga menghabiskan atau memulihkan energi.',
        subsections: [
          {
            title: 'Aktivitas Utama',
            table: {
              headers: ['Aktivitas', 'Fungsi', 'Catatan'],
              rows: [
                ['Kerja', 'Menghasilkan uang', 'Setiap pekerjaan punya syarat skill minimal.'],
                ['Latihan', 'Meningkatkan skill', '4 skill: Strength, Intelligence, Communication, Luck (maks Lv5).'],
                ['Mancing', 'Menghasilkan ikan atau item', 'Peluang & jenis tangkapan dipengaruhi Luck.'],
                ['Makan', 'Mengembalikan energi', 'Butuh membeli makanan dulu di toko.'],
                ['Ngobrol', 'Berinteraksi dengan NPC, meningkatkan hubungan', 'Perlu NPC ada di lokasi & waktu yang tepat.'],
                ['Memberi hadiah', 'Meningkatkan hubungan lebih cepat', 'Efek besar kalau memberi hadiah favorit NPC.'],
              ],
            },
          },
          {
            title: 'Aktivitas Utilitas',
            table: {
              headers: ['Aktivitas', 'Fungsi'],
              rows: [
                ['Toko', 'Membeli item (makanan, hadiah, umpan, dll)'],
                ['Tas', 'Melihat & mengelola inventory'],
                ['Bank', 'Menyetor, menarik, dan membayar cicilan utang'],
                ['Pindah', 'Berpindah lokasi antar area/tempat di kota'],
                ['Tidur', 'Mengakhiri hari (wajib dilakukan di rumah)'],
                ['Vanillagram', 'Media sosial dalam game — lihat kabar & interaksi warga'],
              ],
            },
          },
        ],
      },
      {
        id: 'story-skill',
        title: 'Vanillate Story · Skill System',
        intro:
          'Empat skill utama yang menentukan pekerjaan apa yang bisa kamu lakoni dan aktivitas apa yang efektif untukmu. Setiap skill bisa dinaikkan hingga Level 5.',
        subsections: [
          {
            title: 'Daftar Skill',
            table: {
              headers: ['Skill', 'Kegunaan Utama'],
              rows: [
                ['Strength', 'Pekerjaan fisik (kuli, tukang, atlet), aktivitas berat.'],
                ['Intelligence', 'Pekerjaan intelektual (guru, dokter, programmer), quest teka-teki.'],
                ['Communication', 'Pekerjaan sosial (pramuniaga, PR), memperlancar interaksi & hubungan.'],
                ['Luck', 'Memengaruhi peluang di aktivitas seperti mancing & event acak.'],
              ],
            },
          },
          {
            title: 'Cara Menaikkan Skill',
            items: [
              'Pilih aktivitas Latihan lalu tentukan skill yang ingin dinaikkan.',
              'Latihan menghabiskan waktu & energi; makin tinggi level, makin lambat naiknya.',
              'Maksimal Level 5 per skill — pilih fokus sesuai jalur karier yang kamu incar.',
            ],
          },
        ],
      },
      {
        id: 'story-dunia',
        title: 'Vanillate Story · Dunia & Pekerjaan',
        intro:
          'Kota Vanillate terdiri dari beberapa area dengan lokasi yang berbeda, dan setiap area menawarkan pekerjaan berbeda pula.',
        subsections: [
          {
            title: 'Angka Dunia',
            table: {
              headers: ['Elemen', 'Jumlah'],
              rows: [
                ['Area', '4'],
                ['Lokasi', '39'],
                ['Pekerjaan', '63'],
                ['NPC', '36'],
              ],
            },
          },
          {
            title: 'Pekerjaan',
            items: [
              'Total 63 pekerjaan tersebar di 4 area kota.',
              'Setiap pekerjaan punya syarat skill berbeda (Strength, Intelligence, Communication, Luck).',
              'Pekerjaan bergaji lebih tinggi biasanya menuntut skill lebih tinggi.',
              'Detail pekerjaan per area terdokumentasi di `docs/story/JOBS_BY_AREA`.',
            ],
          },
          {
            title: 'Berpindah Lokasi',
            text: 'Aktivitas Pindah memungkinkanmu berpindah antar tempat di kota. Sebagian aktivitas hanya tersedia di lokasi tertentu — mancing di pinggir sungai, kerja di kantor, dst. Perpindahan menghabiskan waktu, jadi rencanakan rute harianmu.',
          },
        ],
      },
      {
        id: 'story-npc',
        title: 'Vanillate Story · NPC & Jadwal',
        intro:
          'Kota Vanillate dihuni 36 NPC, masing-masing dengan kepribadian, rutinitas harian, kesukaan, impian, dan cerita hidup sendiri. Mereka tidak selalu berada di tempat yang sama — kamu perlu tahu jadwal mereka.',
        subsections: [
          {
            title: 'Sifat Jadwal NPC',
            items: [
              'NPC bekerja di siang hari — cari mereka di lokasi kerjanya untuk berinteraksi.',
              'NPC berpindah ke tempat pribadi di malam hari (rumah, tempat nongkrong).',
              'Akhir pekan punya jadwal berbeda dari hari kerja.',
              'Tiap NPC punya lokasi favorit di jam tertentu — pelajari polanya.',
            ],
          },
          {
            title: 'Membangun Hubungan',
            items: [
              'Ngobrol dengan NPC di lokasi & waktu yang tepat meningkatkan hubungan sedikit demi sedikit.',
              'Memberi hadiah mempercepat peningkatan hubungan — apalagi bila hadiahnya adalah favorit NPC.',
              'Hubungan yang tinggi membuka dialog baru, quest personal, dan tahapan hubungan lanjutan.',
            ],
          },
        ],
        note: 'Profil NPC lengkap terdokumentasi di `docs/story/NPC_SEED_DATA`. Salah satu heroine (Anggun Safitri) punya profil lengkap tersendiri.',
      },
      {
        id: 'story-percakapan',
        title: 'Vanillate Story · Sistem Percakapan',
        intro:
          'Dialog dengan NPC menggunakan sistem halaman ala visual novel: pemain membaca satu halaman percakapan, menekan tombol Lanjutkan untuk halaman berikutnya. Percakapan panjang terasa terkontrol dan mudah diikuti.',
        subsections: [
          {
            items: [
              'Setiap NPC punya seri percakapan bertahap yang terbuka mengikuti level hubungan.',
              'Percakapan pertama biasanya perkenalan; percakapan berikutnya mengungkap latar belakang, impian, dan cerita personal NPC.',
              'Momen tertentu (naik ke tahap Momen Spesial atau Pacaran) memicu percakapan khusus yang lebih dramatis.',
              'Percakapan penting biasanya dicatat di Vanillagram sebagai kenangan.',
            ],
          },
        ],
      },
      {
        id: 'story-romance',
        title: 'Vanillate Story · Romance & Pernikahan',
        intro:
          'Salah satu fitur terbesar Story adalah sistem romance. Hubungan dengan NPC terpilih bisa berkembang menjadi pertemanan dekat, hubungan romantis, pernikahan, sampai memiliki anak.',
        subsections: [
          {
            title: 'Tahapan Hubungan',
            table: {
              headers: ['Tahap', 'Cara Mencapai', 'Yang Terbuka'],
              rows: [
                ['Teman', 'Ngobrol beberapa kali, hubungan awal', 'Dialog perkenalan, informasi dasar NPC'],
                ['Hubungan Dekat', 'Rutin ngobrol & memberi hadiah', 'Cerita personal NPC, quest bantu-membantu'],
                ['Momen Spesial', 'Trigger event khusus di level hubungan tertentu', 'Adegan romantis awal, konfirmasi ketertarikan'],
                ['Pacaran', 'Pilihan aktif dari pemain setelah Momen Spesial', 'Aktivitas berdua, kencan, kado spesial'],
                ['Menikah', 'Persiapan (rumah, cincin, dsb) + pelamaran', 'Pindah serumah, ritual pernikahan'],
                ['Punya Anak', 'Setelah menikah, dalam alur waktu tertentu', 'Anak sebagai anggota keluarga baru'],
              ],
            },
          },
          {
            title: 'Kandidat Pasangan',
            items: [
              '10 NPC bisa dijadikan pasangan (dating candidates) dari total 36 NPC di kota.',
              'Setiap kandidat punya kepribadian, kesukaan, dan cerita hidup unik — jalur romantis mereka berbeda.',
              'Salah satu heroine (Anggun Safitri) punya profil desain lengkap di `docs/story/HEROINE_ANGGUN_SAFITRI`.',
            ],
          },
        ],
        note: 'Romance bukan syarat menang — kamu bisa fokus melunasi utang tanpa menjalin hubungan romantis. Namun tahapan lanjutan membuka konten cerita yang tidak tersedia di jalur solo.',
      },
      {
        id: 'story-roadmap',
        title: 'Vanillate Story · Roadmap & Dokumentasi',
        intro:
          'Story terus dikembangkan. Rencana pengembangan dan keputusan desain terbuka untuk dibaca lewat folder `docs/story/` di repository.',
        subsections: [
          {
            title: 'Dokumen Kunci',
            table: {
              headers: ['File', 'Isi'],
              rows: [
                ['DECISIONS.md', 'Keputusan desain game (energi, waktu, utang, hubungan).'],
                ['ROADMAP.md', 'Rencana pengembangan fitur berikutnya.'],
                ['NPC_SEED_DATA', 'Rancangan awal 36 NPC.'],
                ['AREAS_LOCATIONS', 'Daftar 4 area dan 39 lokasi.'],
                ['JOBS_BY_AREA', 'Daftar 63 pekerjaan per area.'],
                ['HEROINE_ANGGUN_SAFITRI', 'Profil lengkap salah satu heroine kandidat pasangan.'],
              ],
            },
          },
          {
            title: 'Arah Pengembangan',
            items: [
              'Perluasan area & lokasi baru di Kota Vanillate.',
              'Penambahan NPC dengan kepribadian & jadwal baru.',
              'Konten quest musiman & event khusus.',
              'Penyempurnaan sistem ekonomi & pekerjaan.',
            ],
          },
        ],
        note: 'Ikuti kabar terbaru di server Discord Support kami.',
      },

      {
        id: 'commands',
        title: 'Daftar Command',
        intro: 'Vanillate Games dirancang simpel: satu command utama per game, plus `/help` untuk panduan.',
        subsections: [
          {
            title: 'Bermain',
            items: [
              '`/gamewerewolf`: buka lobi Werewolf (mode Klasik atau Lanjutan, 4–12 pemain untuk Klasik).',
              '`/gametahu`: buka dashboard Tahu Bulat (semua fitur ada di sini: jual, upgrade, promosi, misi, peringkat, achievement).',
              '`/gamestory`: mulai atau lanjutkan perjalananmu di Kota Vanillate.',
            ],
          },
          {
            title: 'Bantuan',
            items: [
              '`/help`: panduan lengkap di dalam Discord (dokumentasi seluruh game).',
            ],
          },
        ],
        note: 'Roadmap: game baru akan ditambahkan sebagai command `/game...` berikutnya di bot yang sama, tidak perlu invite ulang.',
      },
    ],
  },
};
