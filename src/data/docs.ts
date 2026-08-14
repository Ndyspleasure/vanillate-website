// Konten dokumentasi per bot.
// Update dokumentasi? Cukup edit file ini. Halaman /docs/[slug] akan render otomatis.
// Bot baru tanpa entry di sini akan menampilkan placeholder default.

import { sambungKataEvents, type GameEvent } from './events';
import shopData from './synced/shop.json';

// Tabel harga shop di-generate dari data tersinkron (src/data/synced/shop.json)
// yang ditarik otomatis dari repo bot. Ubah harga di repo bot → tabel ini ikut
// berubah setelah sinkronisasi berikutnya. Diurutkan berdasarkan harga naik.
const shopTableRows: string[][] = [...shopData.items]
  .sort((a, b) => a.harga - b.harga)
  .map((i) => [i.nama, `${i.harga}🪙`]);

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
      'Vanillate Sambung Kata adalah bot game kata berantai dalam Bahasa Indonesia. Setiap pemain menyambung kata dari huruf yang ditentukan, dengan sistem progresi mendalam mulai dari Class, Quest, Boost, sampai Dungeon Mode. Tersedia juga game sampingan seperti Werewolf & Pengacara lewat `/game`.',
    quickStart: [
      'Undang bot ke server Discord kamu.',
      'Ketik `/sambungkata` untuk membuka dashboard, lalu pilih mode: PvP, PvB, Player vs Server, atau Dungeon.',
      'Jawab dengan kata yang diawali huruf yang ditentukan. Kata harus ada di kamus.',
      'Kumpulkan EXP & Coin, buka Class di Level 3, dan taklukkan Dungeon!',
      'Ingin variasi? Ketik `/game` untuk game sampingan Werewolf & Pengacara.',
    ],
    sections: [
      {
        id: 'cara-bermain',
        title: 'Cara Bermain',
        intro:
          'Vanillate Sambung Kata adalah permainan kata berantai. Setiap pemain harus menyebut kata yang diawali huruf yang ditentukan dari kata sebelumnya. Sebagai contoh, dari kata `MAKAN` huruf berikutnya adalah `N`, jadi jawaban yang valid antara lain `NASI`, `NAMA`, `NILAI`, dan seterusnya.',
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
            title: '🎮 Command: `/sambungkata`',
            text:
              'Semua mode dimulai dari satu command `/sambungkata` yang membuka Dashboard interaktif. Pilih mode lewat tombol — tidak perlu menghafal opsi. Dashboard aktif 2 menit dan me-reset timer setiap interaksi.',
          },
          {
            title: '👥 Player vs Player (PvP)',
            items: [
              'Minimal 2 pemain manusia, maksimal 10 pemain per room.',
              '`/sambungkata` → 👥 Player vs Player.',
              'Host buka lobby → pemain join → host mulai.',
              'Lobby otomatis tutup dalam 2 menit jika tidak dimulai.',
            ],
          },
          {
            title: '⚔️ Player vs Bot — Mode Lanjutan (Battle Skill)',
            items: [
              'Duel strategis satu tim melawan Bot dengan HP, Mana & Skill (bisa solo).',
              '`/sambungkata` → 🤖 Player vs Bot → ⚔️ Mode Lanjutan → lobby (pemain lain bisa bergabung).',
              'HP Bot menyesuaikan jumlah pemain; serangan Bot mengenai semua anggota tim.',
              'Mana penuh (100) → lepaskan Skill: ⚔️ Attack, ❤️ Recovery, 🛡️ Defense, 🔷 Mana, 💫 Buff, ☠️ Debuff, 🧹 Cleanse.',
              'Belum ada pemenang di ronde 100 → Overtime (damage 2×). Catatan: boost tidak berlaku, hanya Skill.',
            ],
          },
          {
            title: '🤖 Player vs Bot — Mode Normal (Klasik)',
            items: [
              'Sambung kata biasa melawan Bot dengan tingkat kesulitan — duel solo 1v1, boost tetap berlaku.',
              '`/sambungkata` → 🤖 Player vs Bot → 📖 Mode Normal, lalu pilih kesulitan.',
              '🟢 Mudah: bot memilih kata acak.',
              '🟡 Normal: bot menghindari huruf sulit.',
              '🔴 Sulit: bot menjebak dengan huruf sulit.',
              '⚫ Impossible: bot memilih kata terburuk untukmu.',
            ],
          },
          {
            title: '🌐 Player vs Server (Global)',
            items: [
              'Bertanding melawan pemain dari server lain!',
              '`/sambungkata` → 🌐 Player vs Server.',
              'Buka lobby → pemain server yang sama join → bot mempertemukan dengan lobby server lain otomatis.',
              '2–10 pemain gabungan • rating global terpisah (lihat `/stats`).',
              'Lobby otomatis bubar jika tak dapat lawan dalam 6 jam.',
            ],
          },
          {
            title: '🏰 Dungeon Mode',
            items: [
              'Mode solo menantang: kamu vs Dungeon Guardian, 5 wave.',
              '`/sambungkata` → 🏰 Dungeon Mode (butuh 🗝️ Golden Key).',
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
              'Butuh 300 EXP per level.',
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
              '+2 EXP per kata valid.',
              '+15 EXP menyelesaikan pertandingan.',
              '+25 EXP menang, +10 EXP MVP.',
              'EXP masuk ke Account (semua pemain) dan Class aktif (jika ada).',
            ],
          },
          {
            title: '🪙 Coin Economy',
            items: [
              '+5 Coin selesai pertandingan.',
              '+10 Coin menang pertandingan, +5 Coin MVP.',
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
              rows: shopTableRows,
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
        id: 'game-sampingan',
        title: 'Game Sampingan',
        intro:
          'Selain Sambung Kata, Vanillate punya game sampingan yang bisa dimainkan bareng teman se-channel lewat `/game`. Game sampingan bersifat santai — tidak menyimpan progres, Coin, EXP, atau inventory.',
        subsections: [
          {
            title: '🐺 Werewolf Klasik',
            items: [
              'Deduksi sosial: warga vs serigala — mode ringkas & cepat.',
              '4 peran: 🐺 Serigala, 🔮 Peramal, 💉 Tabib, 👳 Warga.',
              '4–30 pemain per sesi.',
            ],
          },
          {
            title: '🌕 Werewolf Lanjutan',
            items: [
              'Mode lengkap dengan 54 peran (Warga · Serigala · Netral).',
              'Investigasi, proteksi, konversi, pembunuh solo, hingga kekacauan.',
              'Hingga 100 pemain — deduksi sosial paling seru.',
            ],
          },
          {
            title: '⚖️ Pengacara (Persidangan)',
            items: [
              'Persidangan roleplay: ungkap siapa yang bersalah.',
              'Hakim manusia memimpin sidang — bukti, saksi, keberatan, & vonis.',
              'Sistem bukti dinamis dengan puluhan skenario kasus unik.',
              '8–25 pemain dengan peran Hakim, Jaksa, Pengacara, Tersangka, Saksi.',
            ],
          },
          {
            title: '🃏 UNO',
            items: [
              'Kartu klasik adu warna & angka — sedang dikembangkan, segera hadir!',
            ],
          },
        ],
        note:
          'Buka dashboard game sampingan dengan `/game`, pilih game, lalu lobby dibuka di channel untuk diajak bermain bersama.',
      },
      {
        id: 'commands',
        title: 'Daftar Command',
        subsections: [
          {
            title: '🎮 Bermain',
            items: [
              '`/sambungkata`: buka Dashboard untuk semua mode — PvP, PvB (Battle Skill/Klasik), Player vs Server, & Dungeon.',
              '`/game`: buka Dashboard game sampingan — 🐺 Werewolf & ⚖️ Pengacara.',
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
};
