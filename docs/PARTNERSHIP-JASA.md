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
