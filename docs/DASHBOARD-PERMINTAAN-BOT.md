# Permintaan Dashboard untuk repo bot

Daftar hal yang dibutuhkan Vanillate Dashboard (`/dashboard`) tetapi **tidak bisa
dikerjakan dari repo website**, karena skema dan RPC proyek Database Bot dimiliki
repo bot (`migrations/`). Website hanya memanggil 7 RPC yang sudah ada. Setiap
butir memuat alasan dan perkiraan biaya supaya bisa dinilai sebelum dikerjakan.

Status: **P1 dan P2 sudah dikerjakan** (repo bot `migrations/0029_dashboard_light_poll.sql`,
website `src/lib/dashboard/api.ts`), berlaku setelah bot di-Update dan Restart.
P3 sampai P5 belum dikerjakan. Dashboard berjalan dengan atau tanpa butir ini.

Angka ukuran di bawah diukur 2026-11-17 dari Database Bot (hanya `octet_length`
agregat, tanpa membaca isi): `guild_feature_registry` 17 baris, total sekitar
47 KB sebagai JSON. `guild_discord_snapshot` 902 baris, median 3,6 KB, rata-rata
6,2 KB, terbesar 59,6 KB.

## P1. Registry tidak dikirim ulang di setiap `guild_dashboard_get` (SELESAI, migration 0029)

**Masalah.** `guild_dashboard_get` mengembalikan seluruh registry (sekitar 47 KB)
di setiap panggilan, padahal registry hanya berubah saat bot dirilis. Registry
adalah bagian terbesar respons: kira-kira 85 sampai 90 persen untuk server
berukuran median. Setiap poll dashboard mengunduh ulang data yang sama.

**Permintaan.** Parameter opsional baru di RPC yang sudah ada (tanpa RPC baru):

```
guild_dashboard_get(p_guild_id text, p_bot_slug text, p_registry_version text default null)
```

- Respons selalu memuat `registry_version` (mis. `md5` dari isi registry, atau
  `max(updated_at)` tabel registry).
- Bila `p_registry_version` sama dengan versi saat ini, `registry` dikembalikan
  `null`. Website memakai registry yang sudah dipegangnya.
- Bila parameter tidak dikirim (website lama), perilaku sama seperti sekarang.

**Biaya.** Tidak ada tabel atau query tambahan (satu agregat ringan atas 17 baris).
Menghemat sekitar 47 KB egress per poll. Dengan pola poll sekarang (15 poll per
jam saat halaman terbuka dan diam) itu sekitar 0,7 MB per jam per tab terbuka.

**Sisi website bila tersedia.** Simpan `registry` dan `registry_version` terakhir
di memori halaman, kirim versinya di poll berikutnya. Perubahan kecil di
`src/lib/dashboard/api.ts` dan `server-page.ts`.

> Yang dibangun: overload `guild_dashboard_get(p_guild_id, p_bot_slug, p_registry_version, p_fields default 'full')`.
> Fungsi dua argumen tidak disentuh. Hasil memuat `registry_version` dan `version`
> (md5 isi yang ditampilkan). Website yang bertemu database lama (PGRST202) memakai
> fungsi lama dan mencoba lagi setelah 6 jam.

## P2. Respons ringan untuk poll status (SELESAI, migration 0029)

**Masalah.** Saat menunggu bot menerapkan revisi, dashboard hanya butuh `config`
dan `bot`, tetapi tetap menerima `snapshot` (channel, role, statistik) dan `state`.

**Permintaan.** Parameter opsional `p_fields text default 'full'` pada
`guild_dashboard_get`, dengan nilai `'status'` yang hanya mengembalikan `bot`,
`config`, `server_time`, `registry_version`, dan `snapshot.refreshed_at`.
Website memuat ulang versi `full` hanya bila `config.revision`,
`config.applied_revision`, atau `refreshed_at` berubah.

**Biaya.** Tanpa tabel baru. Respons poll turun ke kira-kira 1 KB. Bila P1 sudah
ada, P2 menghemat sisa 4 sampai 6 KB per poll (lebih besar untuk server dengan
banyak channel), jadi kerjakan P1 lebih dulu.

> Yang dibangun: `p_fields = 'status'` mengembalikan `{ version, registry_version,
> server_time }` (sekitar 150 byte). Poll mengunduh hasil penuh hanya bila `version`
> berubah. Fixture: sejam diam 172.650 B menjadi 13.583 B.

## P3. Isi revisi lengkap untuk "Kembalikan ke revisi" (prioritas rendah)

**Keadaan sekarang.** Tombol "Kembalikan ke sebelum ini" di Riwayat memuat nilai
lama dari **satu** catatan (`changed_fields[].from`) ke draft. Itu cukup untuk
membatalkan satu perubahan, tetapi tidak bisa memulihkan keadaan utuh pada revisi
tertentu bila sudah ada beberapa perubahan sesudahnya.

**Permintaan.** Salah satu dari:
1. `guild_config_audit_list` menerima `p_include_state boolean default false` dan,
   bila true, menyertakan `state` hasil revisi itu (hanya untuk aksi `config.*`), atau
2. RPC baca `guild_config_revision_get(p_guild_id, p_bot_slug, p_revision)` yang
   mengembalikan `state` revisi tersebut (cek akses sama dengan RPC lain).

**Biaya.** Butuh penyimpanan snapshot `state` per revisi (kolom JSONB baru di
`guild_config_audit`, sekitar 1 sampai 8 KB per simpan). Usul batas: simpan hanya
20 revisi terakhir per server. Dibaca hanya saat admin menekan tombol.
Karena ada biaya simpan, ini perlu keputusan pemilik.

## P4. Saring Riwayat di server (prioritas rendah)

**Keadaan sekarang.** Saring dan cari Riwayat bekerja pada catatan yang sudah
dimuat di browser (20 per halaman). Untuk server dengan riwayat panjang, admin
harus menekan "Muat lebih banyak" berkali-kali.

**Permintaan.** `guild_config_audit_list` menerima `p_action_prefix text default
null` (`'config.'` atau `'sync.'`). Catatan `sync.*` biasanya separuh isi riwayat.

**Biaya.** Tanpa tabel baru, memakai indeks yang ada. Mengurangi jumlah halaman
yang diminta saat admin mencari perubahan pengaturan.

## P5. Waktu perubahan ringkasan yang stabil (catatan, bukan permintaan mendesak)

Dashboard mengembalikan jeda poll ke rapat (30 detik) setiap kali isi respons
berubah. Bila bot menulis ulang `security_summary` atau `stats_summary` secara
berkala walau angkanya sama (hanya `updated_at` yang berubah), penghematan poll
di sisi website berkurang. Mohon ringkasan hanya ditulis ulang saat diminta atau
saat angkanya berubah. Seberapa sering ini terjadi di produksi **belum diukur**.

## Bukan permintaan (sudah cukup dengan RPC yang ada)

Tinjau perubahan sebelum simpan, saring dan ekspor Riwayat, langkah awal, Peta
Channel, dan polling hemat semuanya dihitung di browser dari data yang sudah
dimuat. Tidak ada RPC, kolom, atau tabel baru yang dipakai.
