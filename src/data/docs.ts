// Konten dokumentasi per bot.
// Update dokumentasi? Cukup edit file ini — halaman /docs/[slug] akan render otomatis.
// Bot baru tanpa entry di sini akan menampilkan placeholder default.

export type DocSubsection = {
  title?: string;                                    // Judul kecil, boleh dengan emoji
  text?: string;                                     // Paragraf biasa
  items?: string[];                                  // Bullet list
  table?: { headers: string[]; rows: string[][] };   // Tabel data
};

export type DocSection = {
  id: string;          // Anchor untuk sidebar TOC
  title: string;       // Judul section
  intro?: string;      // Paragraf pembuka section
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
      'Jawab dengan kata yang diawali huruf yang ditentukan — kata harus ada di kamus.',
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
              'Kata harus ada di kamus Bahasa Indonesia (21.000+ kata).',
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
              '🟢 Easy — bot lambat, sering salah.',
              '🟡 Normal — bot seimbang.',
              '🔴 Hard — bot cepat, jarang salah.',
              '☠️ Impossible — bot hampir tidak pernah kalah.',
            ],
          },
          {
            title: '🏰 Dungeon Mode',
            items: [
              'Mode solo menantang: kamu vs Dungeon Guardian, 5 wave.',
              'Command: `/sambungkata mode:dungeon` (butuh 🗝️ Golden Key).',
              'Guardian membalas beberapa kata per giliran — makin cepat tiap wave.',
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
              '❤️ Extra Life (Legendary) — tambah 1 nyawa ekstra sebelum game.',
              '🛡️ Shield (Epic) — proteksi dari 1 kesalahan dalam game.',
              '⏳ Extra Time (Common) — tambah +5 detik per giliran.',
            ],
          },
          {
            title: '⚡ In-Game Boost',
            items: [
              '💡 Hint (Common) — tampilkan 1 kata valid sebagai jawaban.',
              '🔄 Reroll (Rare) — ganti huruf awalan dengan huruf lain.',
            ],
          },
          {
            title: '⭐ Rarity System',
            items: [
              '⚪ Common — Hint, Extra Time (peluang tertinggi).',
              '🔵 Rare — Reroll.',
              '🟣 Epic — Shield.',
              '🟡 Legendary — Extra Life (peluang terendah).',
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
              'Pilih pertama GRATIS — ganti class 750🪙.',
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
              '4 Daily Quest — reset tengah malam.',
              '6 Weekly Quest — reset setiap Senin.',
              '⚡ Kilat Kata (weekly): 20 jawaban ≤5 detik → hadiah 🗝️ Golden Key!',
              'Selesaikan semua → Bonus Chest (Coin + Mystery Box).',
              'Quest yang selesai diumumkan di akhir match — jangan lupa klaim!',
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
            title: '🗝️ Golden Key — 3 Cara Mendapatkan',
            items: [
              '🏪 `/shop` → beli langsung 350🪙.',
              '📆 Weekly quest ⚡ Kilat Kata → 20 jawaban ≤5 detik = kunci gratis.',
              '🧳 Traveling Merchant → sering menjual dengan harga diskon (250🪙).',
              'Kunci habis dipakai setiap masuk Dungeon — maksimal pegang 1.',
            ],
          },
          {
            title: '🏰 Aturan Dungeon',
            items: [
              'Solo: kamu vs Dungeon Guardian, total 5 wave.',
              'Damage kata: dasar 2 | ≥6 huruf +1 | ≥8 huruf +1 | akhiran langka +2.',
              'Guardian membalas 4–8 kata per giliran (bertambah tiap wave).',
              'Waktu berpikir menyusut tiap wave — nyawa habis = Game Over.',
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
            title: '🎲 In-Game Events (muncul acak di PvP/PvB)',
            items: [
              '🤖 AI Challenger — AI menantang seisi room; kalahkan untuk reward x2.',
              '🧳 Traveling Merchant — toko dadakan berisi item diskon & langka.',
              '📡 Lost Signal — kumpulkan fragmen untuk hadiah misterius.',
              'Event muncul di tengah match dan hanya menjeda game sebentar.',
            ],
          },
        ],
      },
      {
        id: 'commands',
        title: 'Daftar Command',
        subsections: [
          {
            title: '🎮 Bermain',
            items: [
              '`/sambungkata mode:pvp` — buka lobby PvP.',
              '`/sambungkata mode:pvb kesulitan:...` — lawan bot AI.',
              '`/sambungkata mode:dungeon` — masuk Dungeon (butuh 🗝️).',
            ],
          },
          {
            title: '📊 Progress & Info',
            items: [
              '`/stats` — statistik lengkap & Player ID.',
              '`/leaderboard` — papan peringkat global.',
              '`/class` — pilih class & beli talent.',
              '`/quest` — dashboard quest harian/mingguan.',
              '`/kamus [kata]` — cek apakah kata ada di kamus.',
            ],
          },
          {
            title: '💰 Ekonomi',
            items: [
              '`/claim` — claim boost harian, server reward, & promo.',
              '`/shop` — beli boost & Golden Key.',
              '`/inventory` — lihat boost yang dimiliki.',
            ],
          },
          {
            title: '🛠️ Lainnya',
            items: [
              '`/help` — panduan lengkap di dalam Discord.',
              '`/masukan` — kirim saran atau laporan bug.',
            ],
          },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // VANILLATE TAHU BULAT
  // ═══════════════════════════════════════════════════════════════════
  'tahu-bulat': {
    intro:
      'Tahu Bulat adalah game simulasi bisnis idle. Kembangkan usahamu dari gerobak kecil hingga jadi sultan tahu — bahkan saat kamu sedang tidak bermain, tokomu tetap menghasilkan.',
    quickStart: [
      'Ketik `/tahu` untuk membuka dashboard.',
      'Tekan 🥟 Jual Tahu untuk berjualan.',
      'Tunggu 5 detik — coin masuk otomatis.',
      'Pakai coin untuk 🔧 Upgrade biar makin cuan.',
    ],
    sections: [
      {
        id: 'cara-bermain',
        title: 'Cara Bermain',
        subsections: [
          {
            title: '📱 Buka Dashboard',
            text: 'Ketik `/tahu` kapan saja untuk membuka usahamu. Modal awal: 1.000 coin.',
          },
          {
            title: '🥟 Jual Tahu',
            text: 'Tekan tombol Jual Tahu. Kendaraan mulai berjualan selama beberapa detik (cooldown awal 5 detik). Selama menggoreng, semua tombol terkunci — tidak perlu pencet apa pun.',
          },
          {
            title: '✨ Otomatis Masuk',
            text: 'Saat selesai, dashboard update sendiri dan coin langsung bertambah. Tidak perlu refresh manual.',
          },
          {
            title: '🌙 Pendapatan Offline',
            text: 'Saat kamu pergi, tokomu tetap menghasilkan — hingga 8 jam, sekitar 50% dari kecepatan aktif. Buka `/tahu` lagi untuk mengklaimnya.',
          },
        ],
        note: 'Rumus pendapatan: Base × Kendaraan × Peralatan × Bahan × Promosi × Rebirth.',
      },
      {
        id: 'kendaraan',
        title: 'Kendaraan',
        intro:
          'Kendaraan menentukan pendapatan dasar dan bonus. Semakin tinggi tingkatnya, semakin besar cuan. Upgrade lewat `/tahu` → 🔧 Upgrade → Kendaraan.',
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
        id: 'peralatan',
        title: 'Peralatan',
        intro:
          'Ada 10 jenis peralatan, masing-masing maksimal Level 5. Setiap upgrade menambah bonus pendapatan. Harga upgrade naik 1.35× tiap level. Upgrade lewat 🔧 Upgrade → Peralatan.',
        subsections: [
          {
            title: '⚙️ Peralatan Spesial',
            items: [
              '🔥 Kompor — memangkas cooldown jualan (Lv1: 5 detik → Lv5: 2 detik). Cooldown lebih cepat = lebih sering jual.',
              '📢 Banner Promosi — memperkuat efek promosi.',
            ],
          },
          {
            title: '📋 Daftar Lengkap',
            text: 'Penggorengan, Kompor, Speaker, Etalase, Mesin Adonan, Mesin Pemotong, Rak Bumbu, Mesin Pengemas, Dekorasi, Banner Promosi.',
          },
        ],
      },
      {
        id: 'bahan',
        title: 'Bahan',
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
        note: 'Fokus bahan saat sudah kuat — ini kunci pendapatan besar di late game.',
      },
      {
        id: 'promosi',
        title: 'Promosi',
        intro:
          'Promosi memberi bonus pendapatan sementara. Hanya satu promosi aktif dalam satu waktu. Beli lewat `/tahu` → 📢 Promosi.',
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
        id: 'rebirth',
        title: 'Rebirth',
        intro:
          'Rebirth mengulang usaha dari awal demi bonus permanen +20% setiap kali melakukannya — dan bonusnya menumpuk selamanya.',
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
        id: 'misi-harian',
        title: 'Misi Harian',
        intro:
          'Selesaikan misi setiap hari untuk hadiah coin. Reset otomatis tiap tengah malam WIB. Buka lewat `/tahu` → 🎯 Misi.',
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
        id: 'peringkat-achievement',
        title: 'Peringkat & Achievement',
        subsections: [
          {
            title: '🏆 Peringkat',
            items: [
              'Bandingkan dirimu dengan pemain lain.',
              'Kategori: 💰 Total Coin Dihasilkan, 🧧 Kekayaan, ♻️ Total Rebirth.',
              'Buka: `/tahu` → 🏆 Peringkat (bisa ganti kategori di dalamnya).',
            ],
          },
          {
            title: '🎖️ Achievement',
            items: [
              '12 pencapaian yang terbuka otomatis saat mencapai target tertentu (misal: jualan pertama, jutawan, armada lengkap, rebirth).',
              'Notifikasi muncul di dashboard.',
              'Permanen — tidak hilang saat Rebirth.',
              'Buka: `/tahu` → 🎖️ Achievement.',
            ],
          },
        ],
      },
      {
        id: 'tips-faq',
        title: 'Tips & FAQ',
        subsections: [
          {
            title: '💡 Tips',
            items: [
              'Tidak perlu pencet Refresh — dashboard update sendiri saat jualan selesai.',
              'Malas klik satu-satu? Buka 🔧 Upgrade → ⬆️ Upgrade Semua untuk menaikkan semua peralatan & bahan sekaligus (beli yang termurah dulu).',
              'Pergi lama? Tokomu tetap jualan (pendapatan offline) — rajin buka `/tahu`.',
              'Prioritaskan Kompor dulu → cooldown cepat → lebih sering jual.',
              'Bahan adalah kunci penghasilan besar; sabar naikkan sedikit demi sedikit.',
              'Kumpulkan untuk Rebirth demi bonus permanen.',
            ],
          },
          {
            title: '❓ FAQ',
            items: [
              'Progresku hilang? Tidak — semua tersimpan otomatis di server.',
              'Bisa main bareng teman? Bisa; tiap orang punya usaha sendiri, lalu adu di 🏆 Peringkat.',
              'Kenapa tombol terkunci? Sedang menggoreng — tunggu beberapa detik, nanti terbuka sendiri.',
            ],
          },
        ],
      },
      {
        id: 'commands',
        title: 'Daftar Command',
        intro: 'Tahu Bulat dirancang simpel — hanya 2 command:',
        subsections: [
          {
            items: [
              '`/tahu` — buka dashboard usaha (semua fitur ada di sini: jual, upgrade, promosi, misi, peringkat, achievement).',
              '`/help` — panduan lengkap di dalam Discord.',
            ],
          },
        ],
      },
    ],
  },
};
