# Partnership: hub, Campaign, dan Jasa

| URL | Isi | Sumber isi |
|---|---|---|
| `/partnership` | Hub: filosofi kerja sama dan pengarah ke dua jalur, tanpa fitur dan harga | Teks di `src/pages/partnership.astro` (tanpa database) |
| `/partnership/campaign` | Campaign: broadcast DM dan Lobby (dulu halaman `/partnership`) | CMS `/admin/partnership/products` dan `/settings`, tabel `partnership_*` |
| `/partnership/jasa` | Jasa: hosting bot dan pembuatan bot | CMS `/admin/partnership/jasa`, tabel `partnership_jasa_page` |
| `/partnership/masuk`, `/partnership/dashboard` | Portal Partner, tidak berubah (rencana: satu dashboard untuk Campaign dan Jasa) | `docs/PARTNER-PORTAL.md` |

## Jasa

- Skema: `supabase/partnership-jasa.sql` (aditif, idempoten, satu baris jsonb), rollback `partnership-jasa-rollback.sql`, tes `supabase/tests/partnership-jasa.test.sql`. Terapkan lewat Supabase MCP `apply_migration` ke proyek CMS.
- Paket jasa **tidak** dimasukkan ke `partnership_products`: tabel itu dibaca bot untuk Dashboard Partnership (broadcast) dan punya `check (channel in ('dm','lobby'))`, jadi paket jasa akan bocor ke Discord.
- Alur data: `scripts/sync-content.mjs` (`syncJasa`) menarik satu baris ke `src/data/synced/partnership-jasa.json`, `src/data/partnership-jasa.ts` menormalkan dan membersihkannya (tes `tests/partnership-jasa.test.ts`), halaman dirender statis. Tombol pesan membuka WhatsApp official, tanpa harga di pesan.

## Biaya database (tujuan utama: hemat sumber daya)

- Pengunjung: nol query (HTML statis).
- Build: satu GET satu baris per sinkron.
- Admin: satu SELECT saat halaman editor dibuka, satu UPSERT saat Simpan. Tanpa polling, tanpa snapshot dari bot.

## Setelah merge

1. Terapkan `supabase/partnership-jasa.sql` ke proyek CMS, lalu jalankan sinkron konten / build ulang agar isi dari CMS menggantikan isi awal di repo.
2. Bila perlu, ubah **Partnership URL** di `/admin/partnership/settings` (tombol Partnership di broadcast bot). Bawaannya `https://vanillate.id/partnership`, kini halaman hub. Untuk langsung ke halaman paket, isi `https://vanillate.id/partnership/campaign`.

## Pemantauan layanan partner (Lobby dan Hosting Bot)

Satu sistem untuk semua layanan berbatas waktu: `supabase/partner-services.sql` (+ rollback + tes `supabase/tests/partner-services.test.sql`).

| Bagian | Peran |
|---|---|
| `partner_accounts.contact_email` | Email asli partner untuk pengingat. Diisi partner saat mengganti kredensial pertama kali (wajib), atau lewat bagian "Layanan saya" di dashboard (Edge Function `partner-admin`, aksi `email`). Login tetap memakai email sintetis. |
| `partner_services` | Layanan: `lobby`, `hosting_bot`, `lainnya`, dengan `starts_on` dan `ends_on` (hari aktif terakhir, inklusif). Lobby dibuat **otomatis** oleh trigger saat pesanan bersatuan Hari berubah ke `berjalan` (selesai = mulai + jumlah hari - 1). Hosting Bot dicatat di `/admin/partnership/layanan`. |
| `partner_service_notices` | Outbox email. Unik per (layanan, jenis, `ends_on`), jadi pemeriksa idempoten dan perpanjangan memicu pengingat baru. Partner tanpa email dicatat `skipped` dan terlihat di CMS. |
| `partner_services_tick()` | Pemeriksa harian (pg_cron `partner-services-tick`, 01.05 UTC = 08.05 WIB, tanggal WIB): layanan lewat masa menjadi `habis`, antre email H-5 dan email habis, lalu memanggil Edge Function lewat pg_net **hanya bila ada email menunggu**. |
| Edge Function `partner-reminders` | Mengirim email lewat Resend (maks. 50 per panggilan, 3 percobaan). `verify_jwt = false`. Secret: `RESEND_API_KEY`, opsional `PARTNER_FROM_EMAIL`, `PARTNER_SITE_URL`, `PARTNER_WHATSAPP_URL`, `PARTNER_REMINDER_SECRET` (dibaca pemeriksa dari Vault `partner_reminder_secret` bila ada). Tanpa `RESEND_API_KEY` email dibiarkan menunggu. |
| `/admin/partnership/layanan` | Monitor: ringkasan, tabel dengan sisa hari dan status email, catat layanan, perpanjang, hentikan, hapus, tombol "Periksa sekarang" (`partner_services_check_now()`, khusus editor). |
| Dashboard partner | Bagian "Layanan saya" (satu SELECT, RLS: hanya miliknya) dan form email pengingat. |

Biaya database: pemeriksa satu UPDATE dan dua INSERT berindeks per hari; nol panggilan HTTP pada hari tanpa email menunggu. Tanpa polling dan tanpa snapshot dari bot. CMS dua SELECT berbatas (300 layanan, notices layanan yang tampil) saat halaman dibuka. Teks email tanpa tanda pisah dan semua nilai di-escape.

Belum ada: laporan ke Discord lewat bot (butuh handler baru di repo bot).
