-- ════════════════════════════════════════════════════════════════════════════
--  Peralihan bot_slug 'sambung-kata' -> 'vanillateID' di proyek CMS
--  (lvfwopnvvqncopvathop). BELUM diterapkan: jalankan pada langkah 2 di
--  docs/ADMIN-CMS.md "Peralihan bot_slug", tepat sebelum bot di-restart dengan
--  WEBSITE_BOT_SLUG=vanillateID. Database Bot (ggsshrnpgnfqvlhzxnoq) dimiliki
--  repo bot dan TIDAK disentuh di sini.
--
--  Aditif dan idempoten. Tidak menghapus data kecuali baris snapshot lama yang
--  kuncinya sudah punya padanan slug baru (primary key bot_slug, key).
--  Rollback: supabase/rename-bot-slug-rollback.sql
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare
  t text;
  tabel text[] := array[
    'bot_commands', 'bot_faqs', 'bot_logs', 'bot_stats', 'bot_guilds', 'bot_players',
    'bot_settings', 'bot_games', 'bot_promos', 'bot_word_queue', 'bot_songs'
  ];
begin
  -- Snapshot: PK (bot_slug, key). Bila bot sudah menulis padanan baru, buang yang lama.
  delete from public.bot_panel_snapshots o
   where o.bot_slug = 'sambung-kata'
     and exists (select 1 from public.bot_panel_snapshots n
                  where n.bot_slug = 'vanillateID' and n.key = o.key);
  update public.bot_panel_snapshots set bot_slug = 'vanillateID' where bot_slug = 'sambung-kata';

  foreach t in array tabel loop
    if to_regclass('public.' || t) is not null then
      execute format('update public.%I set bot_slug = %L where bot_slug = %L', t, 'vanillateID', 'sambung-kata');
      execute format('alter table public.%I alter column bot_slug set default %L', t, 'vanillateID');
    end if;
  end loop;

  alter table public.bot_panel_snapshots alter column bot_slug set default 'vanillateID';
end $$;
