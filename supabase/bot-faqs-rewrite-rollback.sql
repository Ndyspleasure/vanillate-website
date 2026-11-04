-- Rollback supabase/bot-faqs-rewrite.sql: pulihkan teks lama dari salinan
-- public.bot_faqs_backup_20261104 dan hapus FAQ pengantar yang ditambahkan.
update public.bot_faqs f
   set question = b.question, answer = b.answer
  from public.bot_faqs_backup_20261104 b
 where f.id = b.id
   and f.id in (
     'ad39f749-a283-4674-820c-03b204e9c148', 'e8c6ac16-0d44-4a52-96a5-722c51eb9d87',
     'cdf8cea0-50cf-498f-a39b-a9fc0e907a56', 'cd6de44c-a26d-41a2-96a3-db12f45a8862',
     '8ccc0514-156f-4077-a9ed-35777a89a9ca', '6348fac9-a119-47d3-b69a-80fa34a7c468');

delete from public.bot_faqs
 where bot_slug = 'sambung-kata' and sort = 5 and question like '%Apa itu Vanillate.ID%';

-- Setelah yakin tidak dipakai lagi:
-- drop table if exists public.bot_faqs_backup_20261104;
