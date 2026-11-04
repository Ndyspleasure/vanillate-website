-- Rollback faqs-vanillate-id-rewrite.sql
delete from public.faqs where slug = 'apa-itu-vanillate-id'
  and category_id = (select id from public.faq_categories where slug = 'vanillate-id');

update public.faqs set answer = $f$### Bermain

- `/game` › **🔤 Sambung Kata** — buka menu semua mode: PvP, PvB (Battle Skill/Klasik), Player vs Server, dan Dungeon, plus tombol **📊 Dashboard** untuk fitur di bawah.
- `/game` — juga berisi game sampingan: Werewolf, Pengacara, UNO, Tebak Lagu, dan Tahu Bulat.
- `/sosial` — buka Social Hub server: Counting dan Streak Harian.

### Progress & info

- **📊 Dashboard › Stats** — statistik lengkap dan Player ID.
- **📊 Dashboard › Leaderboard** — papan peringkat 10 pemain teratas.
- **📊 Dashboard › Class** — pilih class dan beli talent.
- **📊 Dashboard › Quest** — dashboard quest harian & mingguan.
- **📊 Dashboard › Kamus** — lihat daftar kata di kamus berdasarkan 1–3 huruf awal.

### Ekonomi

- **📊 Dashboard › Claim** — klaim boost harian, server reward, dan promo.
- **📊 Dashboard › Shop** — beli boost dan Golden Key.
- **📊 Dashboard › Inventory** — lihat boost yang kamu miliki.

### Bantuan

- `/tutorial` — buka Tutorial Pemain Baru di thread pribadi.
- `/help` — panduan lengkap di dalam Discord. Di bawahnya ada tombol **🛟 Pusat Bantuan** (FAQ, Tanya Asisten, dan hubungi tim support) serta **📬 Kirim Masukan** (saran atau laporan bug).

### Khusus admin server

- `/pengaturan` — tautan ke Vanillate Dashboard untuk mengatur channel khusus tiap game dan channel fitur sosial. Butuh izin Manage Server.$f$
where id = 'c624731f-4636-47e2-97b9-0e2e8d4b8338';
