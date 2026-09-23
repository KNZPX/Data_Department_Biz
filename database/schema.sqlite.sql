-- ==============================================================================
-- Power BI Standalone Portal Database Schema (SQLite)
-- ==============================================================================

-- 1. Power BI OAuth & Access Token
CREATE TABLE IF NOT EXISTS powerbi_token (
  id INTEGER PRIMARY KEY DEFAULT 1,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 2. Power BI Items (Reports & Dashboards catalog cache)
CREATE TABLE IF NOT EXISTS powerbi_items (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'report',
  workspace_id TEXT NOT NULL,
  workspace_name TEXT NOT NULL,
  name TEXT NOT NULL,
  report_code TEXT,
  report_title TEXT,
  web_url TEXT,
  description TEXT,
  last_modified TEXT,
  last_publish TEXT,
  responsible_user TEXT,
  responsible_email TEXT,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS powerbi_items_workspace_idx ON powerbi_items (workspace_id);
CREATE INDEX IF NOT EXISTS powerbi_items_kind_idx ON powerbi_items (kind);
CREATE INDEX IF NOT EXISTS powerbi_items_code_idx ON powerbi_items (report_code);

-- 3. Change Log / Publish History & Audit Trail
CREATE TABLE IF NOT EXISTS change_log (
  id TEXT PRIMARY KEY,
  entity_table TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  before TEXT, -- JSON stringified
  after TEXT,  -- JSON stringified
  summary TEXT NOT NULL,
  changed_by TEXT,
  changed_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS change_log_entity_idx ON change_log (entity_table, entity_id);
CREATE INDEX IF NOT EXISTS change_log_time_idx ON change_log (changed_at DESC);

-- 4. Power BI Licenses & Capacity (32 Columns + Metadata)
CREATE TABLE IF NOT EXISTS powerbi_licenses (
  id TEXT PRIMARY KEY,
  
  -- 1-16: Employee & Organizational Profile
  site TEXT,
  business_unit_code TEXT,
  person_id TEXT,
  user_id TEXT,
  name_th TEXT,
  position_en TEXT,
  department_code TEXT,
  department_en TEXT,
  employee_class TEXT,
  employment_type TEXT,
  display_name TEXT,
  ad_account TEXT,
  user_type TEXT,
  department_name TEXT,
  dept_group TEXT,
  hod_3site TEXT,

  -- 17-19: Creator Info
  creator_person_id TEXT,
  creator_name_th TEXT,
  creator_position_en TEXT,

  -- 20-22: License & Capacity
  pbi_premium_capacity TEXT,
  pbi_pro_license TEXT,
  license_type TEXT,

  -- 23-27: Phuket Security Groups
  bpk_phuket_executive INTEGER DEFAULT 0,
  bpk_phuket_marketing INTEGER DEFAULT 0,
  bpk_phuket_hod INTEGER DEFAULT 0,
  bpk_phuket_stg INTEGER DEFAULT 0,
  bpk_phuket_admin INTEGER DEFAULT 0,

  -- 28-32: Site Security Groups
  bpk_hod INTEGER DEFAULT 0,
  bsi_hod INTEGER DEFAULT 0,
  dbk_hod INTEGER DEFAULT 0,
  bpk_quality INTEGER DEFAULT 0,
  bsi_quality INTEGER DEFAULT 0,

  -- Standard aliases & metadata
  name TEXT NOT NULL,
  email TEXT,
  hospital TEXT,
  department TEXT,
  position TEXT,
  employee_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  request_date TEXT,
  purpose TEXT,
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS powerbi_licenses_hospital_idx ON powerbi_licenses (hospital);
CREATE INDEX IF NOT EXISTS powerbi_licenses_email_idx ON powerbi_licenses (email);
