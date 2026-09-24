-- ==============================================================================
-- Power BI Standalone Portal Database Schema (PostgreSQL / Supabase)
-- ==============================================================================

-- 1. Power BI OAuth & Access Token
create table if not exists public.powerbi_token (
  id integer primary key default 1,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

-- 2. Power BI Items (Reports & Dashboards catalog cache)
create table if not exists public.powerbi_items (
  id text primary key,
  kind text not null default 'report',
  workspace_id text not null,
  workspace_name text not null,
  name text not null,
  report_code text,
  report_title text,
  web_url text,
  description text,
  last_modified timestamptz,
  last_publish timestamptz,
  responsible_user text,
  responsible_email text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists powerbi_items_workspace_idx on public.powerbi_items (workspace_id);
create index if not exists powerbi_items_kind_idx on public.powerbi_items (kind);
create index if not exists powerbi_items_code_idx on public.powerbi_items (report_code);

-- 3. Change Log / Publish History & Audit Trail
create table if not exists public.change_log (
  id uuid primary key default gen_random_uuid(),
  entity_table text not null,
  entity_id text not null,
  action text not null,
  before jsonb,
  after jsonb,
  summary text not null,
  changed_by text,
  changed_at timestamptz not null default now()
);

create index if not exists change_log_entity_idx on public.change_log (entity_table, entity_id);
create index if not exists change_log_time_idx on public.change_log (changed_at desc);

-- 4. Power BI Licenses & Capacity (32 Columns + Metadata)
create table if not exists public.powerbi_licenses (
  id text primary key,
  
  -- 1-16: Employee & Organizational Profile
  site text,
  business_unit_code text,
  person_id text,
  user_id text,
  name_th text,
  position_en text,
  department_code text,
  department_en text,
  employee_class text,
  employment_type text,
  display_name text,
  ad_account text,
  user_type text,
  department_name text,
  dept_group text,
  hod_3site text,

  -- 17-19: Creator Info
  creator_person_id text,
  creator_name_th text,
  creator_position_en text,

  -- 20-22: License & Capacity
  pbi_premium_capacity text,
  pbi_pro_license text,
  license_type text,

  -- 23-27: Phuket Security Groups
  bpk_phuket_executive boolean default false,
  bpk_phuket_marketing boolean default false,
  bpk_phuket_hod boolean default false,
  bpk_phuket_stg boolean default false,
  bpk_phuket_admin boolean default false,

  -- 28-32: Site Security Groups
  bpk_hod boolean default false,
  bsi_hod boolean default false,
  dbk_hod boolean default false,
  bpk_quality boolean default false,
  bsi_quality boolean default false,

  -- Standard aliases & metadata
  name text not null,
  email text,
  hospital text,
  department text,
  position text,
  employee_id text,
  status text not null default 'active',
  request_date timestamptz,
  purpose text,
  notes text,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists powerbi_licenses_hospital_idx on public.powerbi_licenses (hospital);
create index if not exists powerbi_licenses_email_idx on public.powerbi_licenses (email);

-- 5. Whiteboard Boards (Visual workflow canvases with folders)
create table if not exists public.whiteboard_boards (
  id text primary key,
  name text not null,
  folder_id text not null default 'folder_general',
  folder_name text not null default 'General Workflows',
  description text,
  nodes jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists whiteboard_boards_folder_idx on public.whiteboard_boards (folder_id);
create index if not exists whiteboard_boards_updated_idx on public.whiteboard_boards (updated_at desc);

-- Row Level Security (RLS) policies for Supabase anon client
alter table public.powerbi_token enable row level security;
alter table public.powerbi_items enable row level security;
alter table public.change_log enable row level security;
alter table public.powerbi_licenses enable row level security;
alter table public.whiteboard_boards enable row level security;

-- Open policies for anon access (Internal Portal usage)
create policy "powerbi_token open all" on public.powerbi_token for all to anon using (true) with check (true);
create policy "powerbi_items open all" on public.powerbi_items for all to anon using (true) with check (true);
create policy "change_log open all" on public.change_log for all to anon using (true) with check (true);
create policy "powerbi_licenses open all" on public.powerbi_licenses for all to anon using (true) with check (true);
create policy "whiteboard_boards open all" on public.whiteboard_boards for all to anon using (true) with check (true);

