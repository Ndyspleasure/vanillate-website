-- ════════════════════════════════════════════════════════════════════════════
--  Ganti slug publik produk utama: sambung-kata → vanillateID, dan kategori
--  FAQ-nya: sambung-kata → vanillate-id. Aditif & idempoten (aman diulang).
--
--  Yang DIUBAH  : products.slug, faq_categories.slug, teks produk/kategori.
--  Yang TIDAK   : kolom bot_slug di tabel bot_* / guild_* / share_* (kunci
--                 internal yang masih dibaca bot, tetap 'sambung-kata').
--  Rollback     : supabase/rename-product-slug-rollback.sql
--  Setelah ini  : jalankan sinkron konten (workflow sync-content) agar
--                 src/data/synced/*.json mengikuti database.
-- ════════════════════════════════════════════════════════════════════════════

update public.products
   set slug = 'vanillateID',
       tagline = 'Satu bot Discord untuk game, sosial, dan pengelolaan server.',
       category = 'Bot Serbaguna',
       description = 'Vanillate.ID adalah bot Discord Bahasa Indonesia yang merangkum tiga hal dalam satu tempat. Game untuk seru-seruan bareng member, mulai dari Sambung Kata sampai permainan sosial lain di satu pusat permainan. Sosial untuk menjaga obrolan tetap hidup dan membuat komunitas saling kenal. Server untuk membantu admin menyambut member baru, menjaga keamanan, dan mengatur semuanya dari satu Dashboard di website. Gratis, tanpa langganan, dan cukup ditambahkan sekali ke servermu.',
       seo_title = 'Vanillate.ID, Bot Discord untuk Game, Sosial, dan Server',
       seo_description = 'Vanillate.ID adalah bot Discord serbaguna berbahasa Indonesia untuk game, sosial, dan pengelolaan server. Satu bot untuk menghidupkan komunitas, diatur dari Dashboard di website. Gratis tanpa langganan.',
       updated_at = now()
 where slug = 'sambung-kata'
   and not exists (select 1 from public.products where slug = 'vanillateID');

update public.faq_categories
   set slug = 'vanillate-id',
       description = 'Pengenalan Vanillate.ID untuk game, sosial, dan server, termasuk cara bermain Sambung Kata dan daftar command.',
       updated_at = now()
 where slug = 'sambung-kata'
   and not exists (select 1 from public.faq_categories where slug = 'vanillate-id');
