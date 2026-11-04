-- Rollback rename-bot-slug.sql: kembalikan ke 'sambung-kata'.
-- Snapshot yang sudah ditulis ulang bot akan dibuat ulang bot sendiri.
do $$
declare
  t text;
  tabel text[] := array[
    'bot_commands', 'bot_faqs', 'bot_logs', 'bot_stats', 'bot_guilds', 'bot_players',
    'bot_settings', 'bot_games', 'bot_promos', 'bot_word_queue', 'bot_songs',
    'bot_panel_snapshots'
  ];
begin
  delete from public.bot_panel_snapshots o
   where o.bot_slug = 'vanillateID'
     and exists (select 1 from public.bot_panel_snapshots n
                  where n.bot_slug = 'sambung-kata' and n.key = o.key);
  foreach t in array tabel loop
    if to_regclass('public.' || t) is not null then
      execute format('update public.%I set bot_slug = %L where bot_slug = %L', t, 'sambung-kata', 'vanillateID');
      execute format('alter table public.%I alter column bot_slug set default %L', t, 'sambung-kata');
    end if;
  end loop;
end $$;
