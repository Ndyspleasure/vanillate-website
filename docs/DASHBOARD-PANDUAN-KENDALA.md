# 🧭 Panduan Kendala Vanillate Dashboard (pop up, lencana, teks)

Acuan teks dan perilaku saat admin atau owner server menemui kendala di
`/dashboard/server/`. Disetujui pemilik pada 2026-11-28 (semua usulan, termasuk
tiga keputusan di §5).

| Berkas | Isi |
|---|---|
| `src/lib/dashboard/issue-guide.ts` | **Satu sumber teks**: tingkat, judul, penyebab, langkah, tombol per kode kendala; nama izin dua bahasa; penggabungan dan urutan; kendala tingkat halaman |
| `src/lib/dashboard/server-page.ts` | Pop up kendala dan lencana (`currentGuides`, `issuePanelHtml`, `issueBadgeHtml`) |
| `tests/dashboard-issue-guide.test.ts` | Penjaga: setiap kode punya judul, penyebab, 1 sampai 4 langkah, tanpa tanda pisah, kartu merah punya tombol; kasus khusus Administrator dan role integrasi |

## 1. Tingkat dan bentuk tampilan

| Tingkat | Arti | Tampil sebagai |
|---|---|---|
| 🔴 Merah | Fitur tidak jalan | Pop up, lalu lencana |
| 🟡 Kuning | Perlu dicek | Lencana (dan isi pop up bila dibuka) |
| ⚪ Info | Salah isi form | Hanya di kartu fitur |

Kartu 🔴 selalu mendapat tombol tambahan **Masih bingung? Hubungi tim**
(WhatsApp dengan pesan berisi Server ID, judul, kode kendala, dan nama fitur;
tanpa data pemain).

## 2. Perilaku pop up

- **Pop up** berupa panel samping di desktop dan panel bawah di HP. Tidak
  mengunci halaman (`aria-modal="false"`), jadi admin tetap bisa mengatur fitur.
- **X, Nanti saja, dan Escape hanya mengecilkan** pop up menjadi lencana
  `⚠ N kendala` di pojok kanan atas. Lencana tidak bisa ditutup selama masih ada
  kendala 🔴 atau 🟡. Saat pertama dikecilkan muncul catatan "Pengingat
  dipindah ke sini" selama 6 detik.
- **Animasi** (Web Animations API, tanpa pustaka): salinan pop up "terbang" ke
  lencana (isi memudar, menyusut jadi kapsul, melengkung naik), lalu lencana
  mendarat dengan pantulan, goyang kecil, dan dua cincin. Membuka lagi dari
  lencana memakai kebalikannya (pop up tumbuh dari lencana). Semua animasi
  dilewati bila sistem meminta `prefers-reduced-motion`.
- **Nama fitur di kartu adalah tautan**: menekan "Counting →" membuka tab
  fiturnya (menunggu modul tab dimuat), menggulir ke kartu fitur, memberi fokus,
  dan menyorot kartu itu sebentar. Di HP pop up dikecilkan dulu supaya kartunya
  terlihat.
- **Pop up terbuka lagi** bila ada kendala 🔴 yang belum pernah dilihat di sesi
  ini (sidik kendala disimpan di `sessionStorage` `vn-issues-seen-<guild>`,
  maks. 200). Sesi browser baru berarti pop up muncul lagi untuk kendala lama.
  Kendala 🟡 baru tidak membuka pop up.
- **Perbaiki sekarang** menjalankan tombol pertama dari kendala teratas.
- **Cek lagi** (dulu "Refresh Discord Data") meminta bot mengirim ulang data
  Discord. Setelah data baru tiba, kendala yang masih ada diberi catatan
  "Sudah dicek ulang, kendala ini masih ada". Bila semua beres, muncul
  "Semua kendala sudah beres" dan lencana hilang sendiri.
- **Kembali dari tautan undangan**: setelah admin membuka tautan undang
  ulang dan kembali ke tab dashboard, halaman menjalankan **satu** Cek lagi
  otomatis (event `visibilitychange`, sekali per klik tautan, bukan polling).
- Pesan kendala di kartu fitur, Ringkasan, dan Peta Channel tetap ada sebagai
  cadangan. Teksnya dibuat dari buku panduan yang sama (`describeIssue`).

**Biaya sumber daya**: nol query baru, nol polling baru. Semua kendala
dihitung dari data yang sudah dimuat halaman. Cek lagi memakai RPC
`guild_dashboard_request_refresh` yang sudah ada, satu kali per aksi admin.

## 3. Aturan diagnosis

- **Izin channel kurang** dipilah dengan `permissionFix()`:
  - `reinvite`: role bot belum punya izin yang diminta tautan undangan.
  - `channel`: role bot sudah punya izinnya, pengaturan channel menolak.
  - `stale` (**baru**): bot memegang Administrator. Administrator tidak bisa
    ditolak channel, jadi data Discord dianggap lama. Saran: Cek lagi.
  - `unknown`: belum bisa dipastikan. Satu jalur bertahap (undang ulang lalu
    Cek lagi); setelah data baru tiba, diagnosis berpindah otomatis.
- **Role tidak bisa diberikan** (`ROLE_UNUSABLE`) dipilah dengan `roleReason()`:
  `reason_code` dari bot bila ada (`MANAGE_ROLES_MISSING`, `ROLE_TOO_LOW`,
  `ROLE_MANAGED`, `EVERYONE`, `NOT_MENTIONABLE`), atau kalimat `reason` bot lama
  sebagai cadangan. "Seret role bot ke atas" hanya untuk `ROLE_TOO_LOW`.
- Izin sama yang kurang di beberapa channel **digabung** jadi satu kartu
  ("Bot kurang izin Send Messages (Kirim Pesan) di 3 channel").
- Urutan: tingkat (🔴, 🟡, ⚪), lalu gagal diterapkan, diubah admin lain, izin,
  role, channel atau role hilang, lainnya.

## 4. Teks per kode

`{fitur}`, `{channel}`, `{izin}`, `{role}`, `{setelan}` diisi otomatis.
Nama menu Discord ditulis dua bahasa.

### A. Izin bot

| Kode (cabang) | Tingkat | Judul | Tombol |
|---|---|---|---|
| `MISSING_PERMISSIONS` (reinvite) | 🔴 | Bot kurang izin di {channel} | Undang ulang dengan izin lengkap · Cek lagi |
| `MISSING_PERMISSIONS` (channel) | 🔴 | Channel {channel} menolak izin bot | Buka channel di Discord · Pilih channel lain · Cek lagi |
| `MISSING_PERMISSIONS` (stale) | 🟡 | Data izin bot perlu diperbarui | Cek lagi · Hubungi tim |
| `MISSING_PERMISSIONS` (unknown) | 🔴 | Bot kurang izin di {channel} | Undang ulang dengan izin lengkap · Cek lagi |
| `MISSING_GUILD_PERMISSIONS` (reinvite, unknown) | 🔴 | Bot kurang izin server {izin} | Undang ulang dengan izin lengkap · Cek lagi |
| `MISSING_GUILD_PERMISSIONS` (channel: izin di luar tautan undangan) | 🔴 | Bot kurang izin server {izin} | Cek lagi |

### B. Channel

| Kode | Tingkat | Judul | Tombol |
|---|---|---|---|
| `CHANNEL_NOT_FOUND` | 🟡 (🔴 bila ditolak bot) | Channel {fitur} tidak ditemukan | Pilih channel lain · Cek lagi |
| `CHANNEL_TYPE_INVALID` | ⚪ | Jenis channel tidak cocok | Pilih channel lain |
| `CHANNEL_REQUIRED` | ⚪ | {fitur} belum punya channel | Pilih channel |
| `CHANNEL_CONFLICT` | ⚪ | Satu channel dipakai dua fitur | Pilih channel lain |

### C. Role

| Kode (penyebab) | Tingkat | Judul | Tombol |
|---|---|---|---|
| `ROLE_NOT_FOUND` | 🟡 (🔴 bila ditolak bot) | Role tidak ditemukan | Pilih role lain · Cek lagi |
| `ROLE_UNUSABLE` (`MANAGE_ROLES_MISSING`) | 🔴 | Bot belum boleh memberi role | Undang ulang dengan izin lengkap · Cek lagi |
| `ROLE_UNUSABLE` (`ROLE_TOO_LOW`) | 🔴 | Role bot terlalu rendah | Cek lagi |
| `ROLE_UNUSABLE` (`ROLE_MANAGED`) | 🔴 | Role ini tidak bisa diberikan | Pilih role lain |
| `ROLE_UNUSABLE` (`EVERYONE`) | ⚪ | @everyone tidak bisa jadi penerima | Pilih role lain |
| `ROLE_UNUSABLE` (`NOT_MENTIONABLE`) | 🟡 | Role tidak bisa di-mention bot | Cek lagi · Pilih role lain |
| `ROLE_UNUSABLE` (penyebab baru) | 🔴 | Role tidak bisa diberikan bot | Cek lagi · Pilih role lain |
| `ROLE_CONFLICT` (3 varian) | ⚪ | Role yang sama dipakai dua kali / Role ini milik Verification | Pilih role lain |

### D. Isian setelan (semua ⚪)

`SETTING_REQUIRED` ({setelan} belum diisi), `SETTING_OUT_OF_RANGE` (Nilai di
luar batas), `SETTING_INVALID` (Nilai tidak bisa dipakai), `REWARD_LIMIT`
(Terlalu banyak hadiah level), `REWARD_DUPLICATE` (Dua hadiah di level yang sama).

### E. Bot dan sinkronisasi

| Kode | Tingkat | Judul | Tombol |
|---|---|---|---|
| `BOT_NOT_IN_GUILD` / bot belum diundang | 🔴 | Bot tidak ada di server ini | Undang bot |
| `NO_DISCORD_DATA` | 🟡 | Daftar channel belum dimuat | Cek lagi |
| `ACTOR_FORBIDDEN` | 🔴 | Perubahan terakhir ditahan bot | Lihat perubahan · Terapkan perubahan ini |
| `APPLY_FAILED` | 🔴 | Bot gagal menerapkan pengaturan | Coba terapkan lagi · Hubungi tim |
| `SYNC_TIMEOUT` | 🟡 | Bot belum menerapkan perubahan | Coba terapkan lagi |
| Bot offline | 🟡 | Bot sedang offline | tidak ada |
| Diubah admin lain | 🔴 | Ada perubahan dari admin lain | Muat versi terbaru |

### F. Cadangan

`UNKNOWN_FEATURE` (🟡 Fitur belum dikenal bot), `UNKNOWN_PURPOSE`,
`INVALID_CHANNEL`, `INVALID_PAYLOAD`, `SETTINGS_INVALID` (🟡 Data pengaturan
tidak terbaca), dan kode lain yang belum punya panduan (🟡 {fitur} mengalami
kendala, dengan penjelasan bot bila ada, plus Cek lagi dan Hubungi tim).
Tidak ada kendala yang hilang tanpa penjelasan.

Kalimat lengkap (penyebab dan langkah) ada di `issue-guide.ts` dan dites.

## 5. Keputusan pemilik (2026-11-28)

1. Tombol **Refresh Discord Data** diganti **Cek lagi** di semua tempat.
2. Tombol **Retry Sync** diganti **Coba terapkan lagi**; untuk
   `ACTOR_FORBIDDEN` menjadi **Terapkan perubahan ini**. Riwayat memakai
   "Meminta bot menerapkan ulang" dan "Menyetujui revisi tertunda".
3. **Diubah admin lain** naik ke 🔴 (pop up), supaya perubahan admin lain tidak
   tertimpa.

## 6. Menambah kode kendala baru

1. Tambah cabang di `body()` pada `issue-guide.ts`: tingkat, judul, penyebab,
   1 sampai 4 langkah, tombol.
2. Tambah contoh di `SAMPLES` pada `tests/dashboard-issue-guide.test.ts`.
3. Teks tanpa tanda pisah; nama menu Discord dua bahasa.
4. Izin Discord baru: tambah di `PERMISSION_BITS` (`model.ts`) **dan**
   `PERMISSION_ID` (`issue-guide.ts`); tes menolak izin tanpa terjemahan.

## 7. Masih perlu dicek pemilik

Terjemahan nama izin dan menu di kolom Indonesia (Peran, Izin, Saluran,
Otorisasi, Kirim Pesan, dst.) ditulis dari ingatan, belum dicocokkan dengan
Discord berbahasa Indonesia. Bila ada yang beda, cukup ubah `PERMISSION_ID`
dan konstanta `MENU_*` di `issue-guide.ts`.
