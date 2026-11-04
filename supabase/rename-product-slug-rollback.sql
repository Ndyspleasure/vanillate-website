-- Rollback rename-product-slug.sql: slug saja (teks produk tidak dikembalikan).
update public.products set slug = 'sambung-kata', updated_at = now()
 where slug = 'vanillateID' and not exists (select 1 from public.products where slug = 'sambung-kata');
update public.faq_categories set slug = 'sambung-kata', updated_at = now()
 where slug = 'vanillate-id' and not exists (select 1 from public.faq_categories where slug = 'sambung-kata');
