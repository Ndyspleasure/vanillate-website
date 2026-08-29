// ════════════════════════════════════════════════════════════════════════════
// ISI AWAL FAQ — HASIL MIGRASI DOKUMENTASI LAMA
//
// Sebelum FAQ terpusat, panduan tersebar di dua tempat yang saling menyalin:
//   • src/data/docs.ts  → dokumentasi per produk (halaman /docs/<slug>)
//   • src/data/faq.ts   → daftar FAQ per produk + FAQ umum
// Keduanya sudah dihapus. Seluruh isinya dipindahkan ke berkas ini, lalu
// dipakai scripts/build-faq-seed.mjs untuk menghasilkan DUA keluaran:
//   • supabase/seed-faq.sql        → isi awal tabel faq_categories & faqs
//   • src/data/synced/faq.json     → snapshot yang dipakai build sebelum
//                                    sinkronisasi pertama berjalan
//
// PENTING: berkas ini TIDAK diimpor oleh website. Ia hanya benih. Setelah
// dijalankan sekali, CMS (/admin/faq) adalah sumber kebenaran — mengedit
// berkas ini tidak akan mengubah apa pun di situs sampai seed dijalankan ulang.
//
// Catatan migrasi: pada beberapa angka, dokumentasi lama dan daftar FAQ lama
// saling bertentangan (mis. EXP per kata dan EXP per level). Yang dipakai di
// sini adalah angka dari dokumentasi, karena FAQ lama memang ditulis untuk
// mengikuti dokumentasi dan sempat tertinggal. Duplikasi itulah yang dihapus
// oleh FAQ terpusat.
//
// Jawaban ditulis dalam Markdown ringan (lihat src/utils/markdown.ts).
// Token {{shop-table}} diganti tabel harga shop yang tersinkron otomatis dari
// repo bot, supaya harga tidak perlu disalin ulang setiap kali berubah.
// ════════════════════════════════════════════════════════════════════════════

/** Kategori FAQ. `productSlug` memetakan kategori ke produk di katalog. */
export const categories = [
  {
    slug: 'sambung-kata',
    name: 'Vanillate Sambung Kata',
    description: 'Cara bermain, mode, progression, event, dan daftar command Vanillate Sambung Kata.',
    icon: 'sparkles',
    sortOrder: 10,
    productSlug: 'sambung-kata',
  },
  {
    slug: 'umum',
    name: 'Umum & Produk',
    description: 'Pertanyaan seputar produk Vanillate secara umum: cara mulai, biaya, dan pembaruan.',
    icon: 'circle-help',
    sortOrder: 20,
    productSlug: null,
  },
  {
    slug: 'akun-data',
    name: 'Akun & Data',
    description: 'Izin yang diminta, keamanan data, dan bagaimana progres berpindah antar komunitas.',
    icon: 'shield',
    sortOrder: 30,
    productSlug: null,
  },
  {
    slug: 'bantuan',
    name: 'Bantuan & Troubleshooting',
    description: 'Langkah pertama saat ada kendala, dan cara mengirim laporan bug atau masukan.',
    icon: 'life-buoy',
    sortOrder: 40,
    productSlug: null,
  },
];

/**
 * Pertanyaan FAQ. `aliases` memuat slug lama supaya tautan yang sudah tersebar
 * (termasuk anchor dokumentasi lama) tetap sampai ke halaman yang benar.
 */
export const faqs = [
  // ═══════════════════════════════════════════════════════════════════
  // VANILLATE SAMBUNG KATA
  // ═══════════════════════════════════════════════════════════════════
  {
    category: 'sambung-kata',
    slug: 'cara-mulai-bermain',
    question: 'Bagaimana cara mulai bermain Sambung Kata?',
    sortOrder: 10,
    answer: `Vanillate Sambung Kata adalah bot game kata berantai Bahasa Indonesia dengan progresi mendalam: Class, Quest, Boost, sampai Dungeon Mode. Lima langkah untuk mulai:

1. Undang bot ke server Discord kamu.
2. Ketik \`/sambungkata\` untuk membuka dashboard, lalu pilih mode: PvP, PvB, Player vs Server, atau Dungeon.
3. Jawab dengan kata yang diawali huruf yang ditentukan. Kata harus ada di kamus.
4. Kumpulkan EXP & Coin, buka Class di Level 3, dan taklukkan Dungeon.
5. Ingin variasi? Ketik \`/game\` untuk game sampingan Werewolf & Pengacara.

Tidak perlu menghafal apa pun sebelum mulai. Semua mode dibuka dari satu command lewat tombol di dashboard.`,
  },
  {
    category: 'sambung-kata',
    slug: 'cara-bermain',
    question: 'Apa aturan dasar permainan Sambung Kata?',
    sortOrder: 20,
    answer: `Sambung Kata adalah permainan kata berantai. Setiap pemain menyebut kata yang diawali huruf terakhir dari kata sebelumnya. Contoh: dari kata \`MAKAN\` huruf berikutnya adalah \`N\`, jadi jawaban yang valid antara lain \`NASI\`, \`NAMA\`, atau \`NILAI\`.

### Aturan dasar

- Kata harus diawali dari huruf yang ditentukan.
- Kata harus ada di kamus Bahasa Indonesia (25.000+ kata).
- Kata yang sudah pernah dipakai tidak boleh diulang.
- Hanya 1 kata per giliran (tanpa spasi).
- Kata minimum 2 huruf.

### Waktu per giliran

- Setiap pemain punya waktu terbatas untuk menjawab.
- Waktu habis berarti kehilangan 1 nyawa dan giliran pindah.
- Jawab dalam ≤5 detik untuk dihitung ke quest **Kilat Kata**.
- Gunakan boost **Extra Time** untuk menambah waktu giliran.

### Sistem nyawa

- Setiap pemain mulai dengan 5 nyawa.
- Jawaban salah atau waktu habis mengurangi 1 kesempatan.
- Setelah 5 kesempatan gagal, kamu kehilangan 1 nyawa dan giliran pindah.
- Nyawa habis berarti eliminasi dari permainan.

### Cara menang

- **PvP/PvB:** jadilah pemain terakhir yang bertahan.
- **Dungeon:** tumbangkan Guardian sampai wave 5.
- Jika skor seri saat voting stop, Balapan Ayam menentukan pemenang.

### Voting perhentian

Pemain bisa mengajukan voting untuk menghentikan game. Semua pemain aktif punya 30 detik untuk vote. Mayoritas memilih Hentikan berarti game berakhir lebih awal; mayoritas Lanjutkan atau seri berarti game diteruskan.

### Kata istimewa

- Kata ≥8 huruf memberi bonus EXP dan damage besar di Dungeon.
- Kata berakhiran huruf langka (X, Q, Z, V) memberi bonus Coin dan damage tertinggi.`,
  },
  {
    category: 'sambung-kata',
    slug: 'mode-permainan',
    question: 'Mode permainan apa saja yang tersedia?',
    sortOrder: 30,
    answer: `Semua mode dimulai dari satu command \`/sambungkata\` yang membuka dashboard interaktif. Pilih mode lewat tombol, tanpa perlu menghafal opsi. Dashboard aktif 2 menit dan me-reset timer setiap interaksi.

### Player vs Player (PvP)

- Minimal 2 pemain manusia, maksimal 10 pemain per room.
- \`/sambungkata\` → **Player vs Player**.
- Host membuka lobby, pemain bergabung, lalu host memulai.
- Lobby otomatis tutup dalam 2 menit jika tidak dimulai.

### Player vs Bot — Mode Lanjutan (Battle Skill)

- Duel strategis satu tim melawan Bot dengan HP, Mana, dan Skill (bisa solo).
- \`/sambungkata\` → **Player vs Bot** → **Mode Lanjutan** → lobby (pemain lain bisa bergabung).
- HP Bot menyesuaikan jumlah pemain; serangan Bot mengenai semua anggota tim.
- Mana penuh (100) membuka Skill: Attack, Recovery, Defense, Mana, Buff, Debuff, Cleanse.
- Belum ada pemenang di ronde 100 berarti Overtime (damage 2×). Boost tidak berlaku di mode ini, hanya Skill.

### Player vs Bot — Mode Normal (Klasik)

Sambung kata biasa melawan Bot dengan tingkat kesulitan pilihan — duel solo 1v1, dan boost tetap berlaku. Buka lewat \`/sambungkata\` → **Player vs Bot** → **Mode Normal**, lalu pilih kesulitan:

| Kesulitan | Perilaku bot |
| --- | --- |
| Mudah | Memilih kata acak |
| Normal | Menghindari huruf sulit |
| Sulit | Menjebak dengan huruf sulit |
| Impossible | Memilih kata terburuk untukmu |

### Player vs Server (Global)

- Bertanding melawan pemain dari server lain.
- \`/sambungkata\` → **Player vs Server**.
- Buka lobby, pemain server yang sama bergabung, lalu bot mempertemukan dengan lobby server lain secara otomatis.
- 2–10 pemain gabungan, dengan rating global terpisah (lihat \`/stats\`).
- Lobby otomatis bubar jika tidak mendapat lawan dalam 6 jam.

### Dungeon Mode

Mode solo menantang: kamu melawan Dungeon Guardian selama 5 wave, dan butuh Golden Key untuk masuk.

### Fase Pre-Match (30 detik)

Sebelum game ada 30 detik fase persiapan. Di sinilah boost Pre-Match diaktifkan: **Extra Life** (+1 nyawa), **Shield** (proteksi 1 kesalahan), dan **Extra Time** (tambah waktu per giliran). Beli boost di \`/shop\` atau klaim di \`/claim\`.

### Win Streak

Menang berturut-turut membangun Win Streak. Milestone tertentu memberi bonus Coin dan reward. Streak hilang jika kalah atau tidak menang. Cek streak kamu di \`/stats\`.`,
  },
  {
    category: 'sambung-kata',
    slug: 'boost',
    question: 'Apa itu Boost dan bagaimana cara mendapatkannya?',
    sortOrder: 40,
    answer: `Boost adalah item spesial yang membantu kamu dalam permainan. Ada dua jenis berdasarkan waktu pemakaiannya.

### Pre-Match Boost

- **Extra Life** (Legendary): tambah 1 nyawa ekstra sebelum game.
- **Shield** (Epic): proteksi dari 1 kesalahan dalam game.
- **Extra Time** (Common): tambah +5 detik per giliran.

### In-Game Boost

- **Hint** (Common): tampilkan 1 kata valid sebagai jawaban.
- **Reroll** (Rare): ganti huruf awalan dengan huruf lain.

### Rarity

| Rarity | Boost | Peluang |
| --- | --- | --- |
| Common | Hint, Extra Time | Tertinggi |
| Rare | Reroll | Sedang |
| Epic | Shield | Rendah |
| Legendary | Extra Life | Terendah |

### Cara mendapatkan boost

- \`/claim\` — boost gratis setiap 24 jam (class tertentu mendapat bonus).
- \`/claim\` — reward member Server Support (reset 24 jam).
- \`/claim\` — redeem Promo Code jika ada kode aktif.
- \`/shop\` — beli boost dengan Coin.
- **Mystery Box** — boost acak dari shop (500 Coin).
- **Quest** — reward dari daily & weekly quest.

Lihat semua boost yang kamu miliki dengan \`/inventory\`. Boost otomatis muncul di tombol pre-match setelah kamu klaim atau beli.`,
  },
  {
    category: 'sambung-kata',
    slug: 'progression-exp-coin',
    question: 'Bagaimana sistem level, EXP, dan Coin bekerja?',
    sortOrder: 50,
    answer: `### Account Level

Semua pemain mendapat Account EXP dari setiap match dan quest. Satu level butuh 300 EXP, dan Level 3 membuka Class System. Cek progres kamu di \`/stats\`.

### EXP per match

- +2 EXP per kata valid.
- +15 EXP menyelesaikan pertandingan.
- +25 EXP menang, +10 EXP MVP.

EXP masuk ke Account (semua pemain) dan ke Class aktif jika kamu sudah memilih class.

### Coin

- +5 Coin selesai pertandingan.
- +10 Coin menang pertandingan, +5 Coin MVP.
- +1 Coin per 10 kata valid.
- +1 Coin untuk kata ≥8 huruf.
- +2 Coin untuk kata berakhiran huruf langka (X/Q/Z/V).
- Bonus tambahan dari quest, win streak, dan passive class.`,
  },
  {
    category: 'sambung-kata',
    slug: 'class-dan-talent',
    question: 'Apa itu Class, kapan terbuka, dan bisakah diganti?',
    sortOrder: 60,
    answer: `Class System terbuka di Account Level 3. Tersedia 9 class, dan masing-masing punya passive nyata: bonus reward, boost harian ekstra, peluang selamat dari eliminasi, damage ekstra di Dungeon, dan lainnya.

- Tersedia dari Level 3: Scholar, Speedster, Guardian, Lucky, Hunter.
- Terbuka bertahap di Level 8, 12, 16, dan 20: Gambler, Alchemist, Linguist, Berserker.
- Pilihan class pertama **gratis**; ganti class berikutnya seharga 750 Coin.
- Lihat daftar lengkapnya dengan \`/class list\`.

### Talent Tree

Setiap class punya talent eksklusif yang memberi bonus pasif saat bermain. Talent dibeli dengan Coin lewat \`/class\` → tombol talent. Cek talent yang tersedia dengan \`/class info [nama_class]\`.`,
  },
  {
    category: 'sambung-kata',
    slug: 'quest',
    question: 'Bagaimana sistem Quest harian dan mingguan?',
    sortOrder: 70,
    answer: `Buka dashboard quest dengan \`/quest\`. Ada dua jenis quest yang berjalan bersamaan:

- **4 Daily Quest** — reset tengah malam.
- **6 Weekly Quest** — reset setiap Senin.

Salah satu weekly quest, **Kilat Kata**, meminta 20 jawaban dalam ≤5 detik dan hadiahnya sebuah Golden Key. Menyelesaikan semua quest memberi Bonus Chest berisi Coin dan Mystery Box.

Quest yang selesai diumumkan di akhir match — jangan lupa diklaim.`,
  },
  {
    category: 'sambung-kata',
    slug: 'shop',
    question: 'Apa saja yang dijual di Shop dan berapa harganya?',
    sortOrder: 80,
    answer: `Buka toko dengan \`/shop\` dan bayar memakai Coin yang kamu kumpulkan dari bermain.

{{shop-table}}

Harga di tabel ini mengikuti data shop yang berlaku di bot, jadi ikut berubah sendiri saat harga di dalam game diperbarui.`,
  },
  {
    category: 'sambung-kata',
    slug: 'promo-code',
    question: 'Bagaimana cara menukarkan Promo Code?',
    sortOrder: 90,
    answer: `Jalankan \`/claim\`, lalu tekan tombol **Redeem Promo Code**.

- Kode promo dibagikan lewat pengumuman resmi.
- Setiap kode hanya bisa diklaim satu kali per pemain.
- Reward bervariasi: Coin, EXP, atau Boost.`,
  },
  {
    category: 'sambung-kata',
    slug: 'dungeon',
    question: 'Apa itu Dungeon Mode dan bagaimana cara masuknya?',
    sortOrder: 100,
    answer: `Dungeon adalah mode solo paling menantang: kamu melawan Dungeon Guardian sepanjang 5 wave. Masuk lewat \`/sambungkata\` → **Dungeon Mode**, dan butuh satu Golden Key yang habis dipakai setiap kali masuk.

### Aturan Dungeon

- Solo: kamu melawan Dungeon Guardian, total 5 wave.
- Damage kata: dasar 2, kata ≥6 huruf +1, kata ≥8 huruf +1, akhiran langka +2.
- Guardian membalas 4–8 kata per giliran, dan bertambah tiap wave.
- Waktu berpikir menyusut tiap wave. Nyawa habis berarti Game Over.
- Perk class aktif di sini: Guardian mendapat +1 nyawa, Hunter dan Berserker mendapat damage ekstra.

### Reward

- Semua reward match digandakan (×2).
- Bonus tamat: +100 Coin, plus 30 Coin per wave (tamat 5 wave berarti +250 Coin).
- Tamat memberi drop pasti: Extra Life, boost acak, dan Dungeon Trophy.`,
  },
  {
    category: 'sambung-kata',
    slug: 'golden-key',
    question: 'Bagaimana cara mendapatkan Golden Key?',
    sortOrder: 110,
    answer: `Ada tiga cara mendapatkan Golden Key:

1. **Shop** — beli langsung seharga 350 Coin lewat \`/shop\`.
2. **Weekly quest Kilat Kata** — 20 jawaban dalam ≤5 detik memberi kunci gratis.
3. **Traveling Merchant** — sering menjualnya dengan harga diskon (250 Coin).

Kunci habis dipakai setiap kali masuk Dungeon, dan kamu maksimal memegang 1 kunci.`,
  },
  {
    category: 'sambung-kata',
    slug: 'event-spesial',
    question: 'Event spesial apa saja yang bisa muncul saat main PvP?',
    sortOrder: 120,
    answer: `Di ronde 20–30 mode PvP, ada peluang salah satu dari **4 event spesial** muncul secara acak dan mengubah jalannya pertandingan. Saat intro event, timer dibekukan — manfaatkan untuk membaca lore dan menyusun strategi.

| Event | Peluang | Kesulitan | Reward sukses | Jika gagal |
| --- | --- | --- | --- | --- |
| AI Challenger | Sering | Sedang | ×2 coin/exp | Tidak ada |
| Lost Signal | Cukup | Mudah–Sedang | ×2 coin/exp | Tidak ada |
| Traveling Merchant | Sering | Mudah | Item / multiplier | Zonk / rugi |
| Penjajah (Invader) | Jarang–Cukup | Sulit | ×2 coin/exp | ×0 (hard-fail) |

Untuk AI Challenger dan Lost Signal, kata panjang atau berakhiran langka mempercepat progres. Untuk Penjajah, tetap tenang dan fokus menjawab Challenge dengan benar.

Detail tiap event ada di FAQ terpisah pada kategori ini.`,
  },
  {
    category: 'sambung-kata',
    slug: 'event-ai-challenger',
    question: 'Bagaimana cara mengalahkan AI Challenger?',
    sortOrder: 130,
    answer: `Boss AI muncul di tengah match untuk menantang semua pemain sekaligus. Tidak ada kompetisi antarpemain di sini — semua bekerja sama menghajar boss sebelum match berakhir.

- Intro 15 detik: game dijeda dan embed dramatis mengumumkan kedatangan boss.
- HP boss: \`200 + (jumlah pemain × 20)\`. Contoh, 3 pemain berarti boss punya 260 HP.
- Setiap kata valid melukai boss. Kamu menang jika HP boss habis sebelum match berakhir.
- Match berakhir tanpa boss tumbang berarti tidak ada reward, tapi juga tanpa penalti.
- Embed penutup menampilkan leaderboard kontribusi damage tiap pemain.

### Sistem damage

Semakin panjang dan langka katamu, semakin sakit untuk boss. Contoh: \`KOMPLEKS\` (panjang, akhiran S) menghasilkan 2 damage.

| Jenis kata | Damage |
| --- | --- |
| Kata biasa (3–7 huruf) | 1 |
| Kata panjang (≥8 huruf) | 2 |
| Berakhir huruf langka (X / Z / Q / V) | +1 tambahan |`,
  },
  {
    category: 'sambung-kata',
    slug: 'event-lost-signal',
    question: 'Bagaimana cara menyelesaikan event Lost Signal?',
    sortOrder: 140,
    answer: `Language Core tidak stabil dan sinyalnya pecah menjadi 5 fragmen (A–E). Kumpulkan kelimanya sebelum match berakhir untuk memulihkan sistem dan mendapat reward.

- Intro 15 detik dengan embed sistematis: "Language Core tidak stabil, fragmen terpecah".
- Setiap kata valid punya peluang menjatuhkan fragmen — tidak dijamin setiap kata.
- Kata panjang (≥6 huruf) menaikkan peluang drop.
- Sistem memprioritaskan fragmen yang belum terkumpul, jadi tidak ada yang mubazir.
- Menang bila semua 5 fragmen terkumpul. Kurang dari 5 saat match usai berarti gagal, tanpa penalti.
- Embed mencatat progres tiap fragmen: siapa mendapat apa, dari kata apa.`,
  },
  {
    category: 'sambung-kata',
    slug: 'event-traveling-merchant',
    question: 'Apa yang dijual Traveling Merchant?',
    sortOrder: 150,
    answer: `Merchant musafir membuka toko pop-up berisi item langka dengan harga spesial. Toko hanya aktif 5 menit lalu merchant pergi. Kamu membayar dengan Coin milikmu sendiri, bukan pool match, dan ini bukan musuh sehingga tidak ada menang atau kalah.

- Klik tombol item di embed toko; Coin langsung dipotong dari akunmu.
- Item "unknown" baru di-roll saat dibeli.
- Toko tutup otomatis setelah 5 menit atau saat match berakhir, mana yang lebih dulu.

### Barang merchant (4–5 item acak per kunjungan)

| Item | Harga | Efek | Rarity |
| --- | --- | --- | --- |
| Unknown Package | 100 Coin | Drop acak: Hint, Reroll, Extra Time, atau ZONK | Common |
| Merchant Box | 300 Coin | Drop pasti: Shield, Extra Life, Reroll, atau Hint | Rare |
| Contract | 500 Coin | HIGH RISK 50/50: reward akhir ×2 atau ×0 | Epic |
| Rewind Ticket | 400 Coin | Pulihkan 1 nyawa. Maks 1× per match per pemain | Rare |
| Golden Key | 250 Coin | Buka Dungeon Mode (muncul sesekali, langka) | Epic |

### Strategi belanja

- **Unknown Package:** judi murah. Bagus kalau hoki dapat boost, apes kalau zonk.
- **Merchant Box:** lebih pasti daripada Package, tapi lebih mahal.
- **Contract:** taruhan tinggi, beli hanya kalau yakin menang. Hanya pembeli yang terpengaruh; pemain lain tetap normal.
- **Rewind Ticket:** asuransi, beli saat nyawa tinggal 1 dan kamu khawatir gugur.
- **Golden Key:** jalur alternatif kalau ingin akses Dungeon Mode sekarang.`,
  },
  {
    category: 'sambung-kata',
    slug: 'event-penjajah',
    question: 'Apa itu event Penjajah (Invader)?',
    sortOrder: 160,
    answer: `Penjajah adalah event paling kompleks sekaligus event musiman untuk memperingati Hari Kemerdekaan Indonesia (17 Agustus). Boss "Penjajah" hadir dengan tiga mekanik gangguan yang berjalan paralel dan terus menekan pemain. Intro berlangsung sekitar 50 detik dengan monolog Penjajah; game dijeda dan timer dibekukan.

- **Menang:** menangkan cukup banyak Challenge (≥3 jawaban benar). Penjajah diusir dan match berlanjut.
- **Kalah:** terlalu banyak Challenge salah (≥2 salah). Penjajah menang dan match berakhir.
- Steal dan Block bukan hard-fail, hanya membuang waktu. Skor, giliran, nyawa, dan huruf target tetap utuh.

### Tiga mekanik gangguan

| Mekanik | Efek | Catatan |
| --- | --- | --- |
| Steal | Kata valid dirampas, tidak dihitung | Skor/giliran/nyawa utuh, timer tetap jalan |
| Block | Tidak bisa input sekitar 10 detik | Timer terus jalan, bisa timeout kalau habis |
| Challenge | Soal kuis kemerdekaan (pilihan ganda) sekitar 30 detik | Game dijeda; benar +1, salah/timeout -1 |

### Kemenangan & "Pengkhianat Perjuangan"

- Challenge benar ≥3 kali berarti event **sukses**: reward ×2 Coin & EXP plus embed lore penutup.
- Challenge salah ≥2 kali berarti event **gagal** (hard-fail): Penjajah menang, tanpa Coin & EXP.
- Survival tunggal (dari ≥2 pemain manusia, tersisa 1) memberi gelar "Pengkhianat Perjuangan" dengan lore dramatis. Reward pemenang tetap ×2.`,
  },
  {
    category: 'sambung-kata',
    slug: 'game-sampingan',
    question: 'Game sampingan apa saja yang bisa dimainkan?',
    sortOrder: 170,
    answer: `Selain Sambung Kata, Vanillate punya game sampingan yang bisa dimainkan bareng teman se-channel lewat \`/game\`. Game sampingan bersifat santai: tidak menyimpan progres, Coin, EXP, maupun inventory.

### Werewolf Klasik

- Deduksi sosial warga melawan serigala, dalam mode ringkas dan cepat.
- 4 peran: Serigala, Peramal, Tabib, Warga.
- 4–30 pemain per sesi.

### Werewolf Lanjutan

- Mode lengkap dengan 54 peran (Warga, Serigala, dan Netral).
- Investigasi, proteksi, konversi, pembunuh solo, sampai kekacauan.
- Hingga 100 pemain.

### Pengacara (Persidangan)

- Persidangan roleplay untuk mengungkap siapa yang bersalah.
- Hakim manusia memimpin sidang: bukti, saksi, keberatan, dan vonis.
- Sistem bukti dinamis dengan puluhan skenario kasus unik.
- 8–25 pemain dengan peran Hakim, Jaksa, Pengacara, Tersangka, dan Saksi.

### UNO

Kartu klasik adu warna dan angka — sedang dikembangkan, segera hadir.

Buka dashboard game sampingan dengan \`/game\`, pilih game, lalu lobby dibuka di channel untuk mengajak yang lain bermain.`,
  },
  {
    category: 'sambung-kata',
    slug: 'daftar-command',
    question: 'Apa saja command yang tersedia?',
    sortOrder: 180,
    answer: `### Bermain

- \`/sambungkata\` — buka dashboard untuk semua mode: PvP, PvB (Battle Skill/Klasik), Player vs Server, dan Dungeon.
- \`/game\` — buka dashboard game sampingan: Werewolf & Pengacara.

### Progress & info

- \`/stats\` — statistik lengkap dan Player ID.
- \`/leaderboard\` — papan peringkat global.
- \`/class\` — pilih class dan beli talent.
- \`/quest\` — dashboard quest harian & mingguan.
- \`/kamus [kata]\` — cek apakah sebuah kata ada di kamus.

### Ekonomi

- \`/claim\` — klaim boost harian, server reward, dan promo.
- \`/shop\` — beli boost dan Golden Key.
- \`/inventory\` — lihat boost yang kamu miliki.

### Lainnya

- \`/help\` — panduan lengkap di dalam Discord.
- \`/masukan\` — kirim saran atau laporan bug.`,
  },
  {
    category: 'sambung-kata',
    slug: 'kamus-dan-validasi-kata',
    question: 'Seberapa besar kamusnya, dan bagaimana kata dinilai?',
    sortOrder: 190,
    answer: `Kamusnya berisi 25.000+ kata Bahasa Indonesia dengan validasi otomatis. Sebuah kata dianggap valid bila:

- diawali huruf yang ditentukan,
- ada di kamus,
- minimal 2 huruf, dan
- belum pernah dipakai di ronde itu.

Kamu bisa mengecek sebuah kata kapan saja dengan \`/kamus [kata]\`.`,
  },
  {
    category: 'sambung-kata',
    slug: 'main-di-banyak-server',
    question: 'Bisa main di berapa server?',
    sortOrder: 200,
    answer: `Tidak terbatas. Progres, statistik, dan leaderboard bersifat global per pemain, jadi capaianmu terbawa ke server mana pun kamu bermain. Tidak ada biaya tambahan untuk memakainya di banyak server.`,
  },

  // ═══════════════════════════════════════════════════════════════════
  // UMUM & PRODUK
  // ═══════════════════════════════════════════════════════════════════
  {
    category: 'umum',
    slug: 'menghidupkan-komunitas',
    question: 'Apakah produk Vanillate bisa membantu menghidupkan komunitas yang sepi?',
    sortOrder: 10,
    answer: `Bisa, dan itu memang salah satu kekuatannya. Produk kami dirancang mengajak banyak anggota ikut berinteraksi sekaligus, sehingga obrolan yang tadinya sepi cepat kembali ramai.

Contohnya, satu sesi Vanillate Sambung Kata di Discord bisa mendongkrak jumlah pesan sampai ratusan, sekaligus membantu anggota naik level di komunitas yang memakai sistem keaktifan.`,
  },
  {
    category: 'umum',
    slug: 'apakah-gratis',
    question: 'Apakah produk Vanillate gratis?',
    sortOrder: 20,
    answer: `Ya. Inti setiap produk kami bisa dipakai tanpa langganan wajib. Fitur Premium opsional hanya menambah kenyamanan, bukan syarat untuk menikmati bagian utamanya.`,
  },
  {
    category: 'umum',
    slug: 'cara-mulai-memakai',
    question: 'Bagaimana cara mulai memakai produknya?',
    sortOrder: 30,
    answer: `Buka halaman produk yang kamu inginkan, lalu ikuti tombol utamanya. Caranya menyesuaikan jenis produk: ada yang diundang ke komunitasmu, ada yang diunduh sebagai aplikasi, ada pula yang langsung dibuka lewat web. Setiap halaman produk menjelaskan langkahnya.`,
  },
  {
    category: 'umum',
    slug: 'seberapa-sering-diperbarui',
    question: 'Seberapa sering produknya diperbarui?',
    sortOrder: 40,
    answer: `Rutin. Kami merilis perbaikan bug, penyempurnaan pengalaman, dan fitur baru secara berkala, sering kali setiap pekan.

Bagi kami rilis adalah garis start, bukan garis finis, jadi produk terus dirawat setelah diluncurkan.`,
  },

  // ═══════════════════════════════════════════════════════════════════
  // AKUN & DATA
  // ═══════════════════════════════════════════════════════════════════
  {
    category: 'akun-data',
    slug: 'izin-yang-dibutuhkan',
    question: 'Izin atau akses apa yang dibutuhkan?',
    sortOrder: 10,
    answer: `Kami hanya meminta akses yang benar-benar diperlukan agar produk berfungsi, dan tidak pernah meminta hak administratif yang tidak perlu.

Untuk produk komunitas seperti Sambung Kata di Discord, izinnya sebatas mengirim pesan, menyematkan embed, membaca jawaban di channel permainan, dan mengelola komponen interaktif.`,
  },
  {
    category: 'akun-data',
    slug: 'keamanan-data',
    question: 'Apakah progres dan data saya aman?',
    sortOrder: 20,
    answer: `Aman. Data tersimpan otomatis di infrastruktur kami, tidak ada penghapusan berkala, dan tidak ada data yang dijual ke pihak ketiga.

Detail lengkapnya bisa kamu baca di halaman [Kebijakan Privasi](/privacy).`,
  },
  {
    category: 'akun-data',
    slug: 'progres-antar-komunitas',
    question: 'Apakah progres saya terbawa antar komunitas atau perangkat?',
    sortOrder: 30,
    answer: `Ya. Progres, statistik, dan peringkat bersifat global per pengguna, jadi capaianmu terbawa ke mana pun kamu memakainya. Kamu juga bebas memakainya di sebanyak mungkin komunitas tanpa biaya.`,
  },
  {
    category: 'akun-data',
    slug: 'progres-hilang',
    question: 'Apakah progres saya bisa hilang?',
    sortOrder: 40,
    answer: `Tidak. Semua progres tersimpan otomatis di server dan tidak ada wipe berkala. Statistik, Class, dan inventory kamu tetap aman.`,
  },

  // ═══════════════════════════════════════════════════════════════════
  // BANTUAN & TROUBLESHOOTING
  // ═══════════════════════════════════════════════════════════════════
  {
    category: 'bantuan',
    slug: 'produk-tidak-merespons',
    question: 'Produknya tidak merespons, apa yang harus dilakukan?',
    sortOrder: 10,
    answer: `Coba beberapa hal ini dulu:

1. Pastikan produk punya izin yang diperlukan di tempat kamu memakainya.
2. Ulangi aksinya dari awal.
3. Tunggu beberapa detik bila platformnya sedang lambat.

Kalau masih bermasalah, laporkan lewat [Support Center](/support) kami, dan orang yang menulis kodenya akan langsung membantu.`,
  },
  {
    category: 'bantuan',
    slug: 'lapor-bug-dan-masukan',
    question: 'Bagaimana cara memberi masukan atau melaporkan bug?',
    sortOrder: 20,
    answer: `Kirim lewat [Support Center](/support) di situs ini, atau gabung ke komunitas kami dan sampaikan di channel yang sesuai.

Khusus Sambung Kata, kamu juga bisa memakai command \`/masukan\` langsung di dalam produknya, lalu pilih kategori: Bug, Saran, Pertanyaan, atau Lainnya. Laporan bisa dikirim anonim atau dengan nama, dan langsung diterima tim developer.

Kami membaca semua laporan, dan banyak fitur kami justru lahir dari usulan komunitas.`,
  },
];
