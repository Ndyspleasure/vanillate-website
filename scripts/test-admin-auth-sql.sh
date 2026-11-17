#!/usr/bin/env bash
set -eu
pg="${PGBIN:-$(pg_config --bindir)}"
cd "$(dirname "$0")/.."
base=$(mktemp -d /tmp/cms-auth.XXXXXX)
trap '"$pg/pg_ctl" -D "$base/data" -m immediate stop >/dev/null 2>&1; rm -rf "$base"' EXIT
"$pg/initdb" -D "$base/data" -U postgres -A trust >/dev/null
"$pg/pg_ctl" -D "$base/data" -o "-k $base -c listen_addresses=''" -l "$base/log" -w start >/dev/null
psql=("$pg/psql" -X -v ON_ERROR_STOP=1 -h "$base" -U postgres)
"${psql[@]}" <<'SQL'
create role anon; create role authenticated;
create table bot_stats(id bigint, bot_slug text, captured_at timestamptz, guild_count integer);
create table admin_users(id int primary key,username text,role text,last_login_at timestamptz);
grant all on admin_users to authenticated;
insert into admin_users values(1,'viewer','viewer',null);
create function resolve_admin_login(text) returns text language sql as $$ select 'private@example.invalid'::text $$;
SQL
"${psql[@]}" -f supabase/migrations/20261116144645_admin_auth_hardening.sql
"${psql[@]}" <<'SQL'
set role authenticated;
update admin_users set last_login_at=now() where id=1;
do $$ begin
 begin
  update admin_users set role='owner' where id=1;
  raise exception 'FAIL role escalation allowed';
 exception when insufficient_privilege then null; end;
 if has_function_privilege('anon','resolve_admin_login(text)','execute') then raise exception 'FAIL anonymous resolver'; end if;
end $$;
reset role;
insert into bot_stats select n,'vanillateID',now()-n*interval '1 minute',n from generate_series(1,1500)n;
alter table bot_stats enable row level security;
grant select on bot_stats to authenticated;
create policy stats_admin on bot_stats for select to authenticated using (current_setting('test.admin',true) = 'yes');
set role authenticated;
do $$ begin
 if exists(select 1 from admin_stats_series(7)) then raise exception 'RLS bypass'; end if;
 if has_function_privilege('anon','admin_stats_series(integer)','execute') then raise exception 'Anon RPC exposed'; end if;
end $$;
set test.admin='yes';
do $$ begin
 if (select count(*) from admin_stats_series(7)) <> 400 then raise exception 'Sample bound failed'; end if;
 if not exists(select 1 from admin_stats_series(7) where id=1) then raise exception 'Latest missing'; end if;
end $$;
reset role;
SQL
"${psql[@]}" -f supabase/admin-auth-hardening-rollback.sql
"${psql[@]}" -c "select count(*) from admin_users where role='viewer' and last_login_at is not null;"
