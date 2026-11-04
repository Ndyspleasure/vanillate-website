-- FAQ website kategori vanillate-id: tambah FAQ pengantar tiga pilar dan
-- selaraskan daftar command. Aditif, aman diulang. Rollback:
-- supabase/faqs-vanillate-id-rewrite-rollback.sql
insert into public.faqs (category_id, question, slug, answer, enabled, sort)
select fc.id, 'Apa itu Vanillate.ID dan apa saja yang bisa dilakukan?', 'apa-itu-vanillate-id',
$f$Vanillate.ID adalah bot Discord serbaguna untuk komunitas Indonesia. Fungsinya terbagi dalam tiga hal.

### Game

Tempat member bermain bersama teman di server. Semua game dibuka lewat `/game`, dari permainan kata sampai game santai untuk ramai-ramai. Game utamanya punya progres dan hadiah.

### Sosial

Kegiatan ringan yang membuat server terasa hidup setiap hari dan membuat member saling berinteraksi. Dibuka lewat `/sosial` dan baru aktif setelah admin memilihnya di dashboard.

### Server

Alat bantu untuk owner dan admin agar server tertata, aman, dan ramah pendatang baru. Semuanya diatur dari [Vanillate Dashboard](https://vanillate.id/dashboard/) tanpa mengetik command.

Pemain baru cukup menjalankan `/tutorial`, lalu `/help` kapan saja untuk panduan.$f$,
true, 5
from public.faq_categories fc
where fc.slug = 'vanillate-id'
  and not exists (select 1 from public.faqs f where f.category_id = fc.id and f.slug = 'apa-itu-vanillate-id');

update public.faqs set answer = $f$### Game

- `/game`: pusat semua game. Pilih **🔤 Sambung Kata** untuk mode PvP, PvB, Player vs Server, dan Dungeon, plus tombol **📊 Dashboard** untuk Kamus, Stats, Leaderboard, Class, Quest, Shop, Inventory, dan Claim.
- `/game` juga berisi Werewolf, Pengacara, UNO, Tebak Lagu, dan Tahu Bulat.
- `/rank`: lihat level dan peringkat aktivitasmu di server.

### Sosial

- `/sosial`: pusat kegiatan komunitas server dan status pribadimu.

### Server

- `/pengaturan`: tautan ke Vanillate Dashboard untuk mengatur server. Butuh izin Manage Server.

### Bantuan

- `/tutorial`: Tutorial Pemain Baru.
- `/help`: panduan lengkap di dalam Discord. Di bawahnya ada tombol **🛟 Pusat Bantuan** (FAQ, Tanya Asisten, dan hubungi tim support) serta **📬 Kirim Masukan** (saran atau laporan bug).$f$
where id = 'c624731f-4636-47e2-97b9-0e2e8d4b8338';
