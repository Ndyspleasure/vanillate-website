-- ═══════════════════════════════════════════════════════════════════════════
--  Vanillate Workspace — Skema Config CMS
--  Namespace TERPISAH dari Sambung Kata: semua tabel berprefiks `workspace_*`.
--  Jalankan SETELAH supabase/schema.sql (memakai admin_users, is_admin(),
--  is_admin_editor()). Jalankan di Supabase Dashboard → SQL Editor → New query.
--  Aman dijalankan ulang (idempoten).
--
--  MODEL PERAN (sama seperti bot_settings):
--    • Browser admin  → hanya anon key; RLS yang menjaga (tanpa JWT = 0 baris).
--    • Panel /admin   → owner/admin menulis KONFIGURASI di sini.
--    • Bot workspace  → service_role (bypass RLS), HANYA MEMBACA, lalu men-sync
--                       ke cache file lokal. service_role TIDAK PERNAH di browser.
--
--  BATAS CAKUPAN (yang ADA di sini = KONFIGURASI saja):
--    role & izin, tim (definisi), jadwal kerja, welcome/onboarding,
--    feature toggle, automation (definisi), eskalasi, reminder/toleransi/
--    daily-brief. Data OPERASIONAL (absensi, status tugas, persetujuan,
--    notifikasi, assignment member→role/tim, runCount automation) TETAP di bot.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- 0. (OPSIONAL) AKSES ADMIN PER-PRODUK
-- ───────────────────────────────────────────────────────────────────────────
-- Membatasi admin tertentu ke produk tertentu. Additif & aman: default memberi
-- akses ke kedua produk supaya admin lama tidak kehilangan akses.
-- Aktifkan blok ini bila ingin memisahkan siapa yang boleh mengedit tiap produk.
--
-- alter table public.admin_users
--   add column if not exists products text[] not null
--     default array['sambung-kata','vanillate-workspace'];
--
-- create or replace function public.is_workspace_editor()
-- returns boolean language sql stable security definer set search_path = '' as $$
--   select exists (
--     select 1 from public.admin_users
--     where id = auth.uid()
--       and role in ('owner','admin')
--       and 'vanillate-workspace' = any(products)
--   );
-- $$;
-- grant execute on function public.is_workspace_editor() to authenticated;
--
-- Bila diaktifkan, ganti `public.is_admin_editor()` pada policy di bawah dengan
-- `public.is_workspace_editor()`. Draft ini memakai is_admin_editor() dulu.


-- ───────────────────────────────────────────────────────────────────────────
-- 1. ROLE & IZIN  (workspace_roles)
-- ───────────────────────────────────────────────────────────────────────────
-- id memakai format id bot ('ROLE-XXXXXX') supaya assignment member→role di bot
-- (members.roleIds) TIDAK perlu migrasi. Nama role bebas diubah; hanya KUNCI
-- izin yang jadi kontrak internal. permissions = ['*'] artinya super-admin.
create table if not exists public.workspace_roles (
  id           text primary key,
  name         text not null,
  description  text,
  permissions  jsonb   not null default '[]'::jsonb,  -- array kunci Permission, atau ["*"]
  scopes       jsonb   not null default '{}'::jsonb,   -- { "<permission>": "own|team|project|workspace" }
  rank         integer not null default 100,           -- angka besar = lebih tinggi
  color        integer,
  is_system    boolean not null default false,         -- role bawaan: tak bisa dihapus (izin tetap bisa diubah)
  sort         integer not null default 100,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  updated_by   uuid references public.admin_users(id) on delete set null
);
comment on table public.workspace_roles is
  'Definisi role & izin workspace (SSoT). Bot membaca via service_role lalu sync ke cache lokal. Assignment member→role tetap di bot.';
create index if not exists workspace_roles_sort_idx on public.workspace_roles (sort, rank desc);


-- ───────────────────────────────────────────────────────────────────────────
-- 2. TIM  (workspace_teams)
-- ───────────────────────────────────────────────────────────────────────────
-- Definisi tim saja (nama, deskripsi, ketua). Keanggotaan tim (members.teamIds)
-- OPERASIONAL → tetap dikelola bot. lead_discord_id = Discord user id ketua.
create table if not exists public.workspace_teams (
  id              text primary key,            -- 'TEAM-XXXXXX'
  name            text not null,
  description     text,
  lead_discord_id text,
  sort            integer not null default 100,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.admin_users(id) on delete set null
);
comment on table public.workspace_teams is
  'Definisi tim workspace. Keanggotaan (member→tim) tetap operasional di bot.';


-- ───────────────────────────────────────────────────────────────────────────
-- 3. JADWAL KERJA  (workspace_schedules)
-- ───────────────────────────────────────────────────────────────────────────
-- Template shift. days = array 7 entri (index 0=Senin .. 6=Minggu), tiap entri
-- { start, end, breakStart, breakEnd } dengan null = libur.
create table if not exists public.workspace_schedules (
  id                     text primary key,     -- 'SCH-XXXXXX'
  name                   text not null,
  description            text,
  days                   jsonb not null default '[]'::jsonb,
  late_tolerance_minutes integer not null default 10,
  sort                   integer not null default 100,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  updated_by             uuid references public.admin_users(id) on delete set null
);
comment on table public.workspace_schedules is
  'Template jadwal kerja (shift). Penetapan template→member tetap operasional di bot.';


-- ───────────────────────────────────────────────────────────────────────────
-- 4. WELCOME & ONBOARDING  (workspace_welcome) — singleton
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.workspace_welcome (
  id               text primary key default 'workspace',
  enabled          boolean not null default false,
  target_status    text    not null default 'active',
  target_team_ids  jsonb   not null default '[]'::jsonb,
  send_dm          boolean not null default true,
  send_channel     boolean not null default false,
  channel_id       text,
  title            text    not null default '',
  body             text    not null default '',
  onboarding_steps jsonb   not null default '[]'::jsonb,
  first_task_title text,
  updated_at       timestamptz not null default now(),
  updated_by       uuid references public.admin_users(id) on delete set null,
  constraint workspace_welcome_singleton check (id = 'workspace')
);
comment on table public.workspace_welcome is
  'Konfigurasi Staff Welcome & Onboarding (singleton). Pengiriman welcome tetap operasional di bot.';

insert into public.workspace_welcome (id, enabled, title, body, onboarding_steps)
values (
  'workspace', false,
  'Selamat Datang, {display_name}! 🎉',
  'Halo {mention}, selamat bergabung di **{workspace}**!',
  '["Baca peraturan staff","Baca SOP / dokumentasi","Konfirmasi ketersediaan jadwal","Selesaikan pekerjaan pertama"]'::jsonb
)
on conflict (id) do nothing;


-- ───────────────────────────────────────────────────────────────────────────
-- 5. FEATURE TOGGLE  (workspace_features)
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.workspace_features (
  key        text primary key,
  label      text not null,
  state      text not null default 'on' check (state in ('on','off','maintenance')),
  sort       integer not null default 100,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.admin_users(id) on delete set null
);
comment on table public.workspace_features is
  'Feature toggle workspace (on/off/maintenance). Bot menegakkannya; nilai di-sync ke cache lokal.';

insert into public.workspace_features (key, label, state, sort) values
  ('tasks',          'Pekerjaan',          'on', 10),
  ('absolute_tasks', 'Pekerjaan Absolute', 'on', 20),
  ('routine_tasks',  'Pekerjaan Rutin',    'on', 30),
  ('attendance',     'Absensi',            'on', 40),
  ('leave',          'Cuti / Izin',        'on', 50),
  ('projects',       'Proyek',             'on', 60),
  ('okr',            'Target / OKR',       'on', 70),
  ('documents',      'Dokumen',            'on', 80),
  ('calendar',       'Kalender',           'on', 90),
  ('reports',        'Laporan',            'on', 100),
  ('welcome',        'Staff Welcome',      'on', 110),
  ('automation',     'Automation',         'on', 120),
  ('daily_brief',    'Daily Brief',        'on', 130)
on conflict (key) do nothing;


-- ───────────────────────────────────────────────────────────────────────────
-- 6. AUTOMATION (definisi)  (workspace_automation)
-- ───────────────────────────────────────────────────────────────────────────
-- Hanya DEFINISI rule. Statistik eksekusi (runCount, lastRunAt) OPERASIONAL →
-- tetap di bot.
create table if not exists public.workspace_automation (
  id          text primary key,           -- 'AUT-XXXXXX'
  name        text not null,
  trigger     text not null,              -- mis. 'staff.activated','task.completed'
  conditions  jsonb   not null default '{}'::jsonb,
  actions     jsonb   not null default '[]'::jsonb,  -- array AutomationAction
  params      jsonb   not null default '{}'::jsonb,
  enabled     boolean not null default true,
  is_system   boolean not null default false,
  sort        integer not null default 100,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.admin_users(id) on delete set null
);
comment on table public.workspace_automation is
  'Definisi rule automation. Statistik eksekusi (runCount/lastRunAt) tetap operasional di bot.';


-- ───────────────────────────────────────────────────────────────────────────
-- 7. KONFIGURASI SISTEM  (workspace_settings) — singleton
-- ───────────────────────────────────────────────────────────────────────────
-- Eskalasi, reminder, toleransi, daily-brief, channel pengumuman. `features` &
-- `welcome` sudah punya tabel sendiri. `setupDone` tetap operasional di bot.
create table if not exists public.workspace_settings (
  id                             text primary key default 'workspace',
  owner_discord_id               text,
  default_reminder_offsets       jsonb   not null default '[1440,180,60]'::jsonb, -- menit
  escalation_rules               jsonb   not null default '[]'::jsonb,            -- [{afterMinutes,notify[],message?}]
  mandatory_notification_types   jsonb   not null default '[]'::jsonb,
  default_late_tolerance_minutes integer not null default 10,
  attendance_reminder_offsets    jsonb   not null default '[30,15]'::jsonb,
  daily_brief_time               text    not null default '08:00',
  announce_channel_id            text,
  updated_at                     timestamptz not null default now(),
  updated_by                     uuid references public.admin_users(id) on delete set null,
  constraint workspace_settings_singleton check (id = 'workspace')
);
comment on table public.workspace_settings is
  'Konfigurasi sistem workspace (eskalasi, reminder, toleransi, daily brief). Singleton.';

insert into public.workspace_settings (
  id, default_reminder_offsets, escalation_rules, mandatory_notification_types,
  default_late_tolerance_minutes, attendance_reminder_offsets, daily_brief_time
) values (
  'workspace',
  '[1440,180,60]'::jsonb,
  '[{"afterMinutes":0,"notify":["responsible"]},{"afterMinutes":60,"notify":["manager"]},{"afterMinutes":240,"notify":["coordinator"]}]'::jsonb,
  '["penugasan_baru","eskalasi","permintaan_persetujuan"]'::jsonb,
  10,
  '[30,15]'::jsonb,
  '08:00'
)
on conflict (id) do nothing;


-- ───────────────────────────────────────────────────────────────────────────
-- 8. AUDIT — siapa mengubah config apa, kapan (workspace_settings_audit)
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.workspace_settings_audit (
  id         bigint generated always as identity primary key,
  table_name text not null,
  row_id     text,
  action     text not null,           -- insert | update | delete
  old_data   jsonb,
  new_data   jsonb,
  changed_by uuid references public.admin_users(id) on delete set null,
  changed_at timestamptz not null default now()
);
create index if not exists workspace_settings_audit_idx
  on public.workspace_settings_audit (changed_at desc);

-- Trigger generik: PK bisa `id` atau `key`, jadi diambil dari to_jsonb.
create or replace function public.log_workspace_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  v_old jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_row text := coalesce(v_new->>'id', v_new->>'key', v_old->>'id', v_old->>'key');
  v_by  uuid := nullif(coalesce(v_new->>'updated_by', v_old->>'updated_by'), '')::uuid;
begin
  -- Untuk UPDATE, lewati bila tak ada perubahan berarti.
  if tg_op = 'UPDATE' and v_new - 'updated_at' = v_old - 'updated_at' then
    return new;
  end if;
  insert into public.workspace_settings_audit (table_name, row_id, action, old_data, new_data, changed_by)
  values (tg_table_name, v_row, lower(tg_op), v_old, v_new, v_by);
  return coalesce(new, old);
end;
$$;

-- Trigger function tak perlu dapat dipanggil langsung via RPC (trigger tetap
-- berjalan internal). Revoke menghilangkan temuan advisor SECURITY DEFINER.
revoke execute on function public.log_workspace_change() from anon, authenticated;

-- Pasang trigger di tiap tabel config.
do $$
declare t text;
begin
  foreach t in array array[
    'workspace_roles','workspace_teams','workspace_schedules','workspace_welcome',
    'workspace_features','workspace_automation','workspace_settings'
  ] loop
    execute format('drop trigger if exists trg_%1$s_audit on public.%1$s;', t);
    execute format(
      'create trigger trg_%1$s_audit after insert or update or delete on public.%1$s
         for each row execute function public.log_workspace_change();', t);
  end loop;
end $$;


-- ───────────────────────────────────────────────────────────────────────────
-- 9. ROW LEVEL SECURITY
-- ───────────────────────────────────────────────────────────────────────────
-- Pola sama dgn bot_settings: admin baca, editor tulis, bot service_role bypass.
alter table public.workspace_roles           enable row level security;
alter table public.workspace_teams           enable row level security;
alter table public.workspace_schedules       enable row level security;
alter table public.workspace_welcome         enable row level security;
alter table public.workspace_features        enable row level security;
alter table public.workspace_automation      enable row level security;
alter table public.workspace_settings        enable row level security;
alter table public.workspace_settings_audit  enable row level security;

-- Tabel LIST (roles/teams/schedules/automation): baca admin, tulis penuh editor.
do $$
declare t text;
begin
  foreach t in array array[
    'workspace_roles','workspace_teams','workspace_schedules','workspace_automation'
  ] loop
    execute format('drop policy if exists "ws admin baca %1$s" on public.%1$s;', t);
    execute format('create policy "ws admin baca %1$s" on public.%1$s
                      for select to authenticated using (public.is_admin());', t);
    execute format('drop policy if exists "ws editor kelola %1$s" on public.%1$s;', t);
    execute format('create policy "ws editor kelola %1$s" on public.%1$s
                      for all to authenticated
                      using (public.is_admin_editor())
                      with check (public.is_admin_editor());', t);
  end loop;
end $$;

-- Tabel SINGLETON / KV (welcome/features/settings): baca admin, update editor.
-- (insert benih lewat schema/bootstrap; authenticated cukup update.)
do $$
declare t text;
begin
  foreach t in array array['workspace_welcome','workspace_features','workspace_settings'] loop
    execute format('drop policy if exists "ws admin baca %1$s" on public.%1$s;', t);
    execute format('create policy "ws admin baca %1$s" on public.%1$s
                      for select to authenticated using (public.is_admin());', t);
    execute format('drop policy if exists "ws editor ubah %1$s" on public.%1$s;', t);
    execute format('create policy "ws editor ubah %1$s" on public.%1$s
                      for update to authenticated
                      using (public.is_admin_editor())
                      with check (public.is_admin_editor());', t);
  end loop;
end $$;
-- Catatan: workspace_features boleh dianggap "list" bila admin perlu menambah
-- fitur baru dari panel — bila ya, pindahkan ke blok LIST (for all).

-- Audit: baca-saja untuk admin (ditulis oleh trigger security definer).
drop policy if exists "ws admin baca audit" on public.workspace_settings_audit;
create policy "ws admin baca audit" on public.workspace_settings_audit
  for select to authenticated using (public.is_admin());
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- 10. KATALOG KAPABILITAS (workspace_catalog) — DITERBITKAN BOT, dibaca CMS
-- ───────────────────────────────────────────────────────────────────────────
-- Agar CMS TIDAK meng-hardcode daftar (Permission, scope, trigger/action
-- automation, status staff, jenis notifikasi, kunci fitur), bot menerbitkan
-- katalog kapabilitasnya ke tabel ini saat startup (service_role, satu arah
-- bot -> CMS). CMS membacanya untuk membangun dropdown/checklist, jadi daftar
-- selalu SINKRON dengan bot dan tak pernah basi. Menambah kapabilitas BARU tetap
-- butuh dukungan kode bot; INSTANCE (role/tim/jadwal/automation/fitur) dikelola
-- di tabel workspace_* masing-masing dan bebas ditambah/dihapus admin.
create table if not exists public.workspace_catalog (
  kind       text not null,   -- 'permission' | 'permission_category' | 'scope'
                              -- | 'automation_trigger' | 'automation_action'
                              -- | 'staff_status' | 'notification_type' | 'feature'
  value      text not null,
  label      text,
  meta       jsonb   not null default '{}'::jsonb,  -- mis. {category, scoped, icon}
  sort       integer not null default 100,
  updated_at timestamptz not null default now(),
  primary key (kind, value)
);
comment on table public.workspace_catalog is
  'Katalog kapabilitas bot Vanillate Workspace, diterbitkan bot (service_role) & dibaca CMS agar tak ada daftar hardcoded di website.';
create index if not exists workspace_catalog_kind_idx on public.workspace_catalog (kind, sort);

alter table public.workspace_catalog enable row level security;
drop policy if exists "ws admin baca catalog" on public.workspace_catalog;
create policy "ws admin baca catalog" on public.workspace_catalog
  for select to authenticated using (public.is_admin());
-- (Bot menulis via service_role -> bypass RLS. Tak ada policy tulis utk authenticated.)


-- ───────────────────────────────────────────────────────────────────────────
-- 11. FITUR: jadikan LIST penuh (admin boleh tambah/hapus dari CMS)
-- ───────────────────────────────────────────────────────────────────────────
-- Selain update state, editor kini boleh INSERT/DELETE baris fitur.
drop policy if exists "ws editor tambah workspace_features" on public.workspace_features;
create policy "ws editor tambah workspace_features" on public.workspace_features
  for insert to authenticated with check (public.is_admin_editor());

drop policy if exists "ws editor hapus workspace_features" on public.workspace_features;
create policy "ws editor hapus workspace_features" on public.workspace_features
  for delete to authenticated using (public.is_admin_editor());
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- 12. OPERASIONAL TUGAS — MIRROR (bot→CMS) + ANTREAN PERINTAH (CMS→bot)
-- ───────────────────────────────────────────────────────────────────────────
-- Pembuatan & penugasan tugas dilakukan dari CMS, TAPI bot tetap "mesin tugas"
-- (reminder, eskalasi, transisi status). Polanya sama seperti bot_settings +
-- bot_commands milik Sambung Kata:
--   • workspace_members / workspace_tasks = CERMIN yang diterbitkan bot
--     (service_role) agar CMS bisa menampilkan & memilih target penugasan.
--   • workspace_task_commands = ANTREAN perintah CMS→bot. Admin meng-INSERT
--     status 'pending'; bot (service_role) mengeksekusi lalu menulis status.
-- Keamanan sama: browser hanya anon key + RLS; service_role hanya di server bot.

-- 12a. Cermin anggota (untuk memilih penerima tugas di CMS).
create table if not exists public.workspace_members (
  discord_id      text primary key,
  display_name    text,
  role_ids        jsonb   not null default '[]'::jsonb,
  team_ids        jsonb   not null default '[]'::jsonb,
  primary_team_id text,
  staff_status    text,
  active          boolean not null default true,
  updated_at      timestamptz not null default now()
);
comment on table public.workspace_members is
  'Cermin anggota Discord yang diterbitkan bot (service_role) agar CMS bisa menugaskan. Sumber kebenaran tetap di bot.';
create index if not exists workspace_members_active_idx on public.workspace_members (active, display_name);

-- 12b. Cermin tugas (untuk menampilkan & mengelola dari CMS).
create table if not exists public.workspace_tasks (
  id            text primary key,
  code          text,
  title         text,
  description   text,
  type          text,
  status        text,
  priority      text,
  creator_id    text,
  responsible_id text,
  assignee_ids  jsonb   not null default '[]'::jsonb,
  team_id       text,
  project_id    text,
  labels        jsonb   not null default '[]'::jsonb,
  start_at      timestamptz,
  due_at        timestamptz,
  completed_at  timestamptz,
  archived      boolean not null default false,
  created_at    timestamptz,
  updated_at    timestamptz not null default now()
);
comment on table public.workspace_tasks is
  'Cermin tugas yang diterbitkan bot (service_role). CMS membacanya; perubahan tugas lewat workspace_task_commands. SSoT tetap di bot.';
create index if not exists workspace_tasks_status_idx on public.workspace_tasks (archived, status, due_at);

-- 12c. Antrean perintah CMS→bot (buat/tugaskan/kelola tugas).
create table if not exists public.workspace_task_commands (
  id           bigint generated always as identity primary key,
  type         text not null,          -- 'task.create' | 'task.assign' | 'task.set_deadline'
                                        -- | 'task.set_priority' | 'task.set_status' | 'task.cancel' | 'task.delete'
  payload      jsonb not null default '{}'::jsonb,
  status       text not null default 'pending'
                 check (status in ('pending', 'processing', 'done', 'error')),
  result       jsonb,
  error        text,
  created_by   uuid references public.admin_users(id) on delete set null,
  created_at   timestamptz not null default now(),
  processed_at timestamptz
);
comment on table public.workspace_task_commands is
  'Antrean perintah dari CMS ke bot untuk tugas. Admin meng-INSERT pending; bot (service_role) mengeksekusi & menulis status/result. Bot memvalidasi setiap payload.';
create index if not exists workspace_task_commands_status_idx on public.workspace_task_commands (status, created_at);
create index if not exists workspace_task_commands_recent_idx on public.workspace_task_commands (created_at desc);

-- 12d. RLS
alter table public.workspace_members       enable row level security;
alter table public.workspace_tasks         enable row level security;
alter table public.workspace_task_commands enable row level security;

-- Cermin: baca-saja untuk admin (ditulis bot service_role).
drop policy if exists "ws admin baca members" on public.workspace_members;
create policy "ws admin baca members" on public.workspace_members
  for select to authenticated using (public.is_admin());

drop policy if exists "ws admin baca tasks" on public.workspace_tasks;
create policy "ws admin baca tasks" on public.workspace_tasks
  for select to authenticated using (public.is_admin());

-- Antrean: admin baca riwayat; editor menaruh perintah baru (pending, atas nama sendiri).
-- Status/result hanya ditulis bot (service_role) → tak ada policy UPDATE/DELETE utk authenticated.
drop policy if exists "ws admin baca task_commands" on public.workspace_task_commands;
create policy "ws admin baca task_commands" on public.workspace_task_commands
  for select to authenticated using (public.is_admin());

drop policy if exists "ws editor tambah task_commands" on public.workspace_task_commands;
create policy "ws editor tambah task_commands" on public.workspace_task_commands
  for insert to authenticated
  with check (public.is_admin_editor() and created_by = auth.uid() and status = 'pending');
-- ═══════════════════════════════════════════════════════════════════════════
