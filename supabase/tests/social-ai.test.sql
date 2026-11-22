-- Tes sakelar Vani (supabase/social-ai.sql): bawaan mati, baseline kosong, idempoten, tidak menimpa nilai.
\set ON_ERROR_STOP on
set client_min_messages = notice;

do $$
begin
  if (select value from public.bot_settings where key = 'social_ai_enabled') is distinct from 'false' then
    raise exception 'GAGAL: social_ai_enabled harus bawaan false';
  end if;
  if (select kind from public.bot_settings where key = 'social_ai_enabled') <> 'boolean' then
    raise exception 'GAGAL: social_ai_enabled harus boolean';
  end if;
  if (select value from public.bot_settings where key = 'social_ai_baseline') is not null then
    raise exception 'GAGAL: social_ai_baseline harus kosong';
  end if;
  if (select category from public.bot_settings where key = 'social_ai_baseline') <> 'sosial' then
    raise exception 'GAGAL: kategori harus sosial';
  end if;
  update public.bot_settings set value = 'true' where key = 'social_ai_enabled';
end $$;

\i supabase/social-ai.sql

do $$
begin
  if (select value from public.bot_settings where key = 'social_ai_enabled') <> 'true' then
    raise exception 'GAGAL: pemasangan ulang tidak boleh menimpa nilai';
  end if;
  if (select count(*) from public.bot_settings where key in ('social_ai_enabled','social_ai_baseline')) <> 2 then
    raise exception 'GAGAL: harus tepat dua baris';
  end if;
  raise notice 'LULUS: sakelar Vani';
end $$;
