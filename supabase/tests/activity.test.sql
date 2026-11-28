-- Tes sakelar Vanillate Activity (supabase/activity.sql): bawaan mati, idempoten, tidak menimpa nilai, rollback bersih.
\set ON_ERROR_STOP on
set client_min_messages = notice;

do $$
begin
  if (select value from public.bot_settings where key = 'activity_enabled') is distinct from 'false' then
    raise exception 'GAGAL: activity_enabled harus bawaan false';
  end if;
  if (select kind from public.bot_settings where key = 'activity_enabled') <> 'boolean' then
    raise exception 'GAGAL: activity_enabled harus boolean';
  end if;
  if (select category from public.bot_settings where key = 'activity_enabled') <> 'activity' then
    raise exception 'GAGAL: kategori harus activity';
  end if;
  if not exists (select 1 from public.bot_setting_categories where key = 'activity') then
    raise exception 'GAGAL: kategori activity belum ada';
  end if;
  update public.bot_settings set value = 'true' where key = 'activity_enabled';
end $$;

\i supabase/activity.sql

do $$
begin
  if (select value from public.bot_settings where key = 'activity_enabled') <> 'true' then
    raise exception 'GAGAL: pemasangan ulang tidak boleh menimpa nilai';
  end if;
  if (select count(*) from public.bot_settings where key = 'activity_enabled') <> 1 then
    raise exception 'GAGAL: harus tepat satu baris';
  end if;
end $$;

\i supabase/activity-rollback.sql

do $$
begin
  if exists (select 1 from public.bot_settings where key = 'activity_enabled')
     or exists (select 1 from public.bot_setting_categories where key = 'activity') then
    raise exception 'GAGAL: rollback harus menghapus baris dan kategori';
  end if;
  raise notice 'LULUS: sakelar Vanillate Activity';
end $$;

\i supabase/activity.sql
