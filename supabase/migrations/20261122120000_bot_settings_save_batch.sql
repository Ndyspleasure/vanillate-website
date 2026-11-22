-- ════════════════════════════════════════════════════════════════════════════
--  Simpan Kontrol Bot secara atomik: satu panggilan RPC untuk seluruh perubahan.
--  - SECURITY INVOKER: RLS `editor ubah bot_settings` dan trigger audit
--    `trg_bot_settings_audit` tetap berlaku seperti UPDATE biasa.
--  - Semua baris dikunci (FOR UPDATE, urut kunci), diperiksa, lalu ditulis.
--    Satu konflik versi atau nilai tidak sah membatalkan SELURUH batch
--    (tidak ada penulisan sebagian).
--  - Aditif dan idempoten (create or replace). Tidak menyentuh data.
--  Biaya: 1 RPC per tekan Simpan (sebelumnya 1 UPDATE per pengaturan).
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.bot_settings_save_batch(p_changes jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  c        jsonb;
  k        text;
  v        text;
  exp_at   timestamptz;
  cur      public.bot_settings;
  errs     jsonb := '[]'::jsonb;
  seen     text[] := '{}';
  rows_out jsonb := '[]'::jsonb;
  vmin     text;
  vmax     text;
  new_vals jsonb := '{}'::jsonb;
  n        integer;
begin
  if auth.uid() is null or not public.is_admin_editor() then
    raise exception 'Tidak berhak menyimpan pengaturan bot' using errcode = '42501';
  end if;
  if p_changes is null or jsonb_typeof(p_changes) <> 'array' then
    raise exception 'p_changes harus berupa array' using errcode = '22023';
  end if;
  n := jsonb_array_length(p_changes);
  if n = 0 or n > 60 then
    raise exception 'Jumlah perubahan harus 1 sampai 60' using errcode = '22023';
  end if;

  -- Kunci baris dalam urutan kunci tetap (hindari deadlock antar admin).
  for c in
    select e from jsonb_array_elements(p_changes) e order by e->>'key'
  loop
    k := c->>'key';
    v := c->>'value';
    if k is null or v is null or jsonb_typeof(c->'value') <> 'string' then
      errs := errs || jsonb_build_object('key', coalesce(k, ''), 'code', 'tidak_valid', 'message', 'Kunci atau nilai kosong');
      continue;
    end if;
    if k = any (seen) then
      errs := errs || jsonb_build_object('key', k, 'code', 'tidak_valid', 'message', 'Kunci dobel dalam satu batch');
      continue;
    end if;
    seen := seen || k;

    select * into cur from public.bot_settings where key = k for update;
    if not found then
      errs := errs || jsonb_build_object('key', k, 'code', 'tidak_ada', 'message', 'Pengaturan tidak ditemukan atau tidak boleh diubah');
      continue;
    end if;

    begin
      exp_at := (c->>'updated_at')::timestamptz;
    exception when others then
      exp_at := null;
    end;
    if exp_at is null or exp_at is distinct from cur.updated_at then
      errs := errs || jsonb_build_object('key', k, 'code', 'konflik', 'message', 'Versi berubah sejak dimuat');
      continue;
    end if;

    if cur.kind = 'boolean' and v not in ('true', 'false') then
      errs := errs || jsonb_build_object('key', k, 'code', 'tidak_valid', 'message', 'Harus true atau false');
    elsif cur.kind = 'number' then
      if v !~ '^-?[0-9]{1,9}$' then
        errs := errs || jsonb_build_object('key', k, 'code', 'tidak_valid', 'message', 'Harus bilangan bulat');
      elsif (cur.min_value is not null and v::numeric < cur.min_value)
         or (cur.max_value is not null and v::numeric > cur.max_value) then
        errs := errs || jsonb_build_object('key', k, 'code', 'tidak_valid', 'message', 'Di luar rentang yang diizinkan');
      end if;
    elsif cur.kind = 'url' and v <> '' and v !~* '^https://[^[:space:]]+$' then
      errs := errs || jsonb_build_object('key', k, 'code', 'tidak_valid', 'message', 'URL harus diawali https://');
    elsif cur.kind in ('text', 'markdown', 'url') and length(v) > 4000 then
      errs := errs || jsonb_build_object('key', k, 'code', 'tidak_valid', 'message', 'Terlalu panjang');
    end if;
    new_vals := new_vals || jsonb_build_object(k, v);
  end loop;

  -- Aturan lintas field: minimal pemain tidak boleh melebihi maksimal.
  vmin := coalesce(new_vals->>'tunable_min_players', (select value from public.bot_settings where key = 'tunable_min_players'));
  vmax := coalesce(new_vals->>'tunable_max_players', (select value from public.bot_settings where key = 'tunable_max_players'));
  if (new_vals ? 'tunable_min_players' or new_vals ? 'tunable_max_players')
     and vmin ~ '^-?[0-9]{1,9}$' and vmax ~ '^-?[0-9]{1,9}$' and vmin::integer > vmax::integer then
    errs := errs || jsonb_build_object('key', 'tunable_min_players', 'code', 'tidak_valid', 'message', 'Minimal pemain tidak boleh melebihi maksimal pemain');
  end if;

  if jsonb_array_length(errs) > 0 then
    return jsonb_build_object('ok', false, 'errors', errs);
  end if;

  for k, v in select key, value from jsonb_each_text(new_vals) order by key loop
    update public.bot_settings
       set value = v, updated_at = now(), updated_by = auth.uid()
     where key = k
    returning jsonb_build_object('key', key, 'value', value, 'updated_at', updated_at) into c;
    rows_out := rows_out || c;
  end loop;
  return jsonb_build_object('ok', true, 'rows', rows_out);
end;
$$;

revoke all on function public.bot_settings_save_batch(jsonb) from public, anon;
grant execute on function public.bot_settings_save_batch(jsonb) to authenticated;
