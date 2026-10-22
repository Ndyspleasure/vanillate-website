-- ════════════════════════════════════════════════════════════════════════════
--  ROLLBACK supabase/bot-faqs.sql — HANYA bila FAQ Bot benar-benar ditinggalkan.
--  Menghapus tabel beserta isinya (suntingan admin ikut hilang). Bot tetap
--  jalan: tanpa tabel ini ia memakai FAQ terakhir yang tersimpan di databasenya.
--  Fungsi touch_faq_updated_at tidak disentuh (dipakai FAQ website).
-- ════════════════════════════════════════════════════════════════════════════

drop table if exists public.bot_faqs;
