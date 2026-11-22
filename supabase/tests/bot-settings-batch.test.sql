\set ON_ERROR_STOP on
set role authenticated;
set test.uid = '00000000-0000-0000-0000-0000000000a1';

-- 1. sukses: dua perubahan + nilai NULL ("menunggu sinkronisasi") boleh ditetapkan.
do $$ declare r jsonb; begin
  r := public.bot_settings_save_batch('[
    {"key":"f_bool","value":"false","updated_at":"2026-01-01T00:00:00Z"},
    {"key":"f_waiting","value":"true","updated_at":"2026-01-01T00:00:00Z"}]');
  if not (r->>'ok')::boolean then raise exception 'GAGAL sukses: %', r; end if;
  if (select count(*) from public.bot_settings_audit) <> 2 then raise exception 'GAGAL audit tidak 2'; end if;
  if (select updated_by from public.bot_settings where key='f_bool') <> auth.uid() then raise exception 'GAGAL updated_by'; end if;
end $$;

-- 2. satu konflik membatalkan seluruh batch.
do $$ declare r jsonb; begin
  r := public.bot_settings_save_batch('[
    {"key":"tunable_max_players","value":"8","updated_at":"2026-01-01T00:00:00Z"},
    {"key":"f_bool","value":"true","updated_at":"2026-01-01T00:00:00Z"}]');
  if (r->>'ok')::boolean then raise exception 'GAGAL konflik lolos'; end if;
  if r->'errors'->0->>'code' <> 'konflik' or r->'errors'->0->>'key' <> 'f_bool' then raise exception 'GAGAL kode konflik: %', r; end if;
  if (select value from public.bot_settings where key='tunable_max_players') <> '6' then raise exception 'GAGAL penulisan sebagian'; end if;
  if (select count(*) from public.bot_settings_audit) <> 2 then raise exception 'GAGAL audit bertambah'; end if;
end $$;

-- 3. validasi nilai, rentang, URL, dan aturan lintas field membatalkan batch.
do $$ declare r jsonb; begin
  r := public.bot_settings_save_batch('[{"key":"tunable_min_players","value":"9","updated_at":"2026-01-01T00:00:00Z"}]');
  if (r->>'ok')::boolean then raise exception 'GAGAL min>max lolos'; end if;
  r := public.bot_settings_save_batch('[{"key":"tunable_max_players","value":"11","updated_at":"2026-01-01T00:00:00Z"}]');
  if (r->>'ok')::boolean then raise exception 'GAGAL di luar rentang lolos'; end if;
  r := public.bot_settings_save_batch('[{"key":"f_url","value":"http://x.test","updated_at":"2026-01-01T00:00:00Z"}]');
  if (r->>'ok')::boolean then raise exception 'GAGAL url http lolos'; end if;
  r := public.bot_settings_save_batch('[{"key":"f_bool","value":"ya","updated_at":"2026-01-01T00:00:00Z"}]');
  if (r->>'ok')::boolean then raise exception 'GAGAL boolean tak sah lolos'; end if;
  r := public.bot_settings_save_batch('[{"key":"nope","value":"x","updated_at":"2026-01-01T00:00:00Z"}]');
  if r->'errors'->0->>'code' <> 'tidak_ada' then raise exception 'GAGAL kunci tak ada: %', r; end if;
end $$;

-- 4. pemakai tanpa hak ubah ditolak; anon tidak punya hak panggil.
set test.uid = '00000000-0000-0000-0000-0000000000b2';
do $$ begin
  begin
    perform public.bot_settings_save_batch('[{"key":"f_bool","value":"true","updated_at":"2026-01-01T00:00:00Z"}]');
    raise exception 'GAGAL viewer boleh menyimpan';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  if has_function_privilege('anon','public.bot_settings_save_batch(jsonb)','execute') then raise exception 'GAGAL anon bisa panggil'; end if;
end $$;
\echo ok - batch atomik
