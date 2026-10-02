import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import type { PowerBiItem, PowerBiKind } from "./powerbiTypes";
import type { PowerBiLicense } from "./licenseTypes";

export type StoredToken = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string;
};

export type ChangeLogEntry = {
  id: string;
  entity_table: string;
  entity_id: string;
  action: "create" | "update" | "delete" | "login" | string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  summary: string;
  changed_by: string | null;
  changed_at: string;
};

const DEFAULT_SUPABASE_URL = "https://wwnzwsjquostxfpjerla.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3bnp3c2pxdW9zdHhmcGplcmxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxMzYxOTgsImV4cCI6MjEwNTcxMjE5OH0.j_M4ShyvxrqN8o_RCAP4IMFjBOVpdiL69_YkkfJsR7I";

// Check configured provider
export function getDbProvider(): "sqlite" | "supabase" {
  // If running on Vercel or in cloud production, always use Supabase
  if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    return "supabase";
  }
  if (process.env.DATABASE_PROVIDER === "supabase") {
    return "supabase";
  }
  if (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL) {
    return "supabase";
  }
  return "sqlite";
}

// -----------------------------------------------------------------------------
// Supabase Client Helper
// -----------------------------------------------------------------------------
// Row-level security only lets a request through when it carries the hash of a
// live sign-in session (x-app-session). On the server we read it from the
// request's session cookie; the sign-in route passes the brand-new session
// explicitly because the cookie isn't set yet. The anon key on its own reads
// and writes nothing.
const SESSION_COOKIE_NAME = "biz_sid";

async function sessionHashForRequest(explicitSecret?: string): Promise<string | null> {
  let secret = explicitSecret || null;
  if (!secret) {
    try {
      const { cookies } = await import("next/headers");
      secret = (await cookies()).get(SESSION_COOKIE_NAME)?.value || null;
    } catch {
      secret = null; // outside a request (build, scripts)
    }
  }
  if (!secret) return null;
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(secret).digest("hex");
}

export function getSupabaseClient(sessionSecret?: string) {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    DEFAULT_SUPABASE_URL;

  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    DEFAULT_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Supabase is not configured (missing URL or Key)");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        const hash = await sessionHashForRequest(sessionSecret);
        if (!hash) return fetch(input, init);
        const headers = new Headers(init?.headers);
        headers.set("x-app-session", hash);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

// -----------------------------------------------------------------------------
// SQLite Engine Helper (Uses bun:sqlite when available)
// -----------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sqliteInstance: any = null;

function getSqliteDb() {
  if (sqliteInstance) return sqliteInstance;

  const dbPath = path.resolve(process.cwd(), "powerbi.db");
  const schemaPath = path.resolve(process.cwd(), "database", "schema.sqlite.sql");

  try {
    // Dynamic require for bun:sqlite
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Database } = require("bun:sqlite");
    const db = new Database(dbPath);
    db.run("PRAGMA journal_mode = WAL;");

    // Initialize schema if newly created or table missing
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, "utf-8");
      db.run(sql);
    }
    sqliteInstance = db;
    return db;
  } catch (err) {
    console.error("Failed to initialize bun:sqlite, falling back or error:", err);
    throw err;
  }
}

// =============================================================================
// UNIFIED DATA ACCESS INTERFACE
// =============================================================================

// 1. TOKEN REPOSITORY
export async function getDbToken(): Promise<StoredToken | null> {
  const provider = getDbProvider();
  if (provider === "supabase") {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from("powerbi_token").select("*").eq("id", 1).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: data.expires_at };
  }

  const db = getSqliteDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row: any = db.query("SELECT * FROM powerbi_token WHERE id = 1 LIMIT 1").get();
  if (!row) return null;
  return {
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    expiresAt: row.expires_at,
  };
}

export async function saveDbToken(token: {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string;
}): Promise<StoredToken> {
  const provider = getDbProvider();
  const nowIso = new Date().toISOString();

  if (provider === "supabase") {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("powerbi_token").upsert(
      {
        id: 1,
        access_token: token.accessToken,
        refresh_token: token.refreshToken,
        expires_at: token.expiresAt,
        updated_at: nowIso,
      },
      { onConflict: "id" }
    );
    if (error) throw error;
    return token;
  }

  const db = getSqliteDb();
  const query = db.query(`
    INSERT INTO powerbi_token (id, access_token, refresh_token, expires_at, updated_at)
    VALUES (1, $access, $refresh, $expires, $updated)
    ON CONFLICT(id) DO UPDATE SET
      access_token = excluded.access_token,
      refresh_token = excluded.refresh_token,
      expires_at = excluded.expires_at,
      updated_at = excluded.updated_at
  `);
  query.run({
    $access: token.accessToken,
    $refresh: token.refreshToken,
    $expires: token.expiresAt,
    $updated: nowIso,
  });

  return token;
}

// 2. POWER BI ITEMS (REPORTS & DASHBOARDS)
export async function getDbItems(kind: PowerBiKind = "report"): Promise<PowerBiItem[]> {
  const provider = getDbProvider();
  if (provider === "supabase") {
    const supabase = getSupabaseClient();
    const { data: rows, error } = await supabase
      .from("powerbi_items")
      .select("*")
      .eq("kind", kind)
      .order("report_code", { ascending: true, nullsFirst: false });

    if (error || !rows) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return rows.map((row: any) => ({
      id: row.id,
      kind: row.kind as PowerBiKind,
      workspaceId: row.workspace_id,
      workspaceName: row.workspace_name,
      name: row.name,
      reportCode: row.report_code || "",
      reportTitle: row.report_title || row.name,
      webUrl: row.web_url || "",
      description: row.description || undefined,
      lastModified: row.last_modified || undefined,
      lastPublish: row.last_publish || undefined,
      responsibleUser: row.responsible_user || undefined,
      responsibleEmail: row.responsible_email || undefined,
    }));
  }

  const db = getSqliteDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = db
    .query("SELECT * FROM powerbi_items WHERE kind = $kind ORDER BY report_code ASC")
    .all({ $kind: kind });

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind as PowerBiKind,
    workspaceId: row.workspace_id,
    workspaceName: row.workspace_name,
    name: row.name,
    reportCode: row.report_code || "",
    reportTitle: row.report_title || row.name,
    webUrl: row.web_url || "",
    description: row.description || undefined,
    lastModified: row.last_modified || undefined,
    lastPublish: row.last_publish || undefined,
    responsibleUser: row.responsible_user || undefined,
    responsibleEmail: row.responsible_email || undefined,
  }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function upsertDbItems(items: any[]): Promise<void> {
  if (!items || items.length === 0) return;
  const provider = getDbProvider();

  if (provider === "supabase") {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("powerbi_items").upsert(items, { onConflict: "id" });
    if (error) console.error("Supabase upsert items error:", error);
    return;
  }

  const db = getSqliteDb();
  const stmt = db.query(`
    INSERT INTO powerbi_items (
      id, kind, workspace_id, workspace_name, name, report_code, report_title,
      web_url, description, last_modified, last_publish, responsible_user,
      responsible_email, first_seen_at, last_seen_at, updated_at
    ) VALUES (
      $id, $kind, $workspace_id, $workspace_name, $name, $report_code, $report_title,
      $web_url, $description, $last_modified, $last_publish, $responsible_user,
      $responsible_email, $first_seen_at, $last_seen_at, $updated_at
    ) ON CONFLICT(id) DO UPDATE SET
      kind = excluded.kind,
      workspace_id = excluded.workspace_id,
      workspace_name = excluded.workspace_name,
      name = excluded.name,
      report_code = excluded.report_code,
      report_title = excluded.report_title,
      web_url = excluded.web_url,
      description = excluded.description,
      last_modified = excluded.last_modified,
      last_publish = excluded.last_publish,
      responsible_user = excluded.responsible_user,
      responsible_email = excluded.responsible_email,
      last_seen_at = excluded.last_seen_at,
      updated_at = excluded.updated_at
  `);

  const tx = db.transaction((rows: typeof items) => {
    for (const r of rows) {
      stmt.run({
        $id: r.id,
        $kind: r.kind || "report",
        $workspace_id: r.workspace_id,
        $workspace_name: r.workspace_name,
        $name: r.name,
        $report_code: r.report_code || null,
        $report_title: r.report_title || null,
        $web_url: r.web_url || null,
        $description: r.description || null,
        $last_modified: r.last_modified || null,
        $last_publish: r.last_publish || null,
        $responsible_user: r.responsible_user || null,
        $responsible_email: r.responsible_email || null,
        $first_seen_at: r.first_seen_at,
        $last_seen_at: r.last_seen_at,
        $updated_at: r.updated_at,
      });
    }
  });
  tx(items);
}

// 3. CHANGE LOG REPOSITORY
export async function getDbChangeLogs(options: {
  itemId?: string;
  entityTable?: string;
  limit?: number;
} = {}): Promise<ChangeLogEntry[]> {
  const { itemId, entityTable, limit = 150 } = options;
  const provider = getDbProvider();

  if (provider === "supabase") {
    const supabase = getSupabaseClient();
    let query = supabase
      .from("change_log")
      .select("*")
      .order("changed_at", { ascending: false })
      .limit(limit);

    if (entityTable && entityTable !== "all") {
      query = query.eq("entity_table", entityTable);
    }
    if (itemId) query = query.eq("entity_id", itemId);
    const { data, error } = await query;
    if (error) {
      console.error("Failed to query change_log from Supabase:", error);
      return [];
    }
    return (data || []) as ChangeLogEntry[];
  }

  const db = getSqliteDb();
  let sql = `
    SELECT id, entity_table, entity_id, action, before, after, summary, changed_by, changed_at
    FROM change_log
    WHERE 1=1
  `;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params: Record<string, any> = { $limit: limit };

  if (entityTable && entityTable !== "all") {
    sql += " AND entity_table = $entityTable";
    params.$entityTable = entityTable;
  }
  if (itemId) {
    sql += " AND entity_id = $itemId";
    params.$itemId = itemId;
  }
  sql += " ORDER BY changed_at DESC LIMIT $limit";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = db.query(sql).all(params);
  return rows.map((r) => ({
    id: r.id,
    entity_table: r.entity_table,
    entity_id: r.entity_id,
    action: r.action,
    before: r.before ? JSON.parse(r.before) : null,
    after: r.after ? JSON.parse(r.after) : null,
    summary: r.summary,
    changed_by: r.changed_by,
    changed_at: r.changed_at,
  }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function insertDbChangeLogs(logs: any[], sessionSecret?: string): Promise<void> {
  if (!logs || logs.length === 0) return;
  const provider = getDbProvider();

  if (provider === "supabase") {
    const supabase = getSupabaseClient(sessionSecret);
    const { error } = await supabase.from("change_log").insert(logs);
    if (error) console.error("Supabase insert change_log error:", error);
    return;
  }

  const db = getSqliteDb();
  const stmt = db.query(`
    INSERT INTO change_log (id, entity_table, entity_id, action, before, after, summary, changed_by, changed_at)
    VALUES ($id, $table, $entity_id, $action, $before, $after, $summary, $changed_by, $changed_at)
  `);

  const tx = db.transaction((entries: typeof logs) => {
    for (const l of entries) {
      stmt.run({
        $id: l.id || crypto.randomUUID(),
        $table: l.entity_table,
        $entity_id: l.entity_id,
        $action: l.action,
        $before: l.before ? JSON.stringify(l.before) : null,
        $after: l.after ? JSON.stringify(l.after) : null,
        $summary: l.summary,
        $changed_by: l.changed_by || null,
        $changed_at: l.changed_at || new Date().toISOString(),
      });
    }
  });
  tx(logs);
}

// 4. POWER BI LICENSES REPOSITORY
export async function getDbLicenses(): Promise<PowerBiLicense[]> {
  const provider = getDbProvider();
  if (provider === "supabase") {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("powerbi_licenses")
      .select("*")
      .order("hospital", { ascending: true })
      .order("name", { ascending: true });

    if (error) throw error;
    return (data || []) as PowerBiLicense[];
  }

  const db = getSqliteDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = db.query("SELECT * FROM powerbi_licenses ORDER BY hospital ASC, name ASC").all();
  return rows.map((r) => ({
    ...r,
    bpk_phuket_executive: Boolean(r.bpk_phuket_executive),
    bpk_phuket_marketing: Boolean(r.bpk_phuket_marketing),
    bpk_phuket_hod: Boolean(r.bpk_phuket_hod),
    bpk_phuket_stg: Boolean(r.bpk_phuket_stg),
    bpk_phuket_admin: Boolean(r.bpk_phuket_admin),
    bpk_hod: Boolean(r.bpk_hod),
    bsi_hod: Boolean(r.bsi_hod),
    dbk_hod: Boolean(r.dbk_hod),
    bpk_quality: Boolean(r.bpk_quality),
    bsi_quality: Boolean(r.bsi_quality),
  }));
}

export async function saveDbLicense(license: PowerBiLicense): Promise<PowerBiLicense> {
  const provider = getDbProvider();
  const now = new Date().toISOString();
  const record = {
    ...license,
    created_at: license.created_at || now,
    updated_at: now,
  };

  if (provider === "supabase") {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from("powerbi_licenses").upsert(record).select("*").single();
    if (error) throw error;
    return data as PowerBiLicense;
  }

  const db = getSqliteDb();
  const stmt = db.query(`
    INSERT INTO powerbi_licenses (
      id, site, business_unit_code, person_id, user_id, name_th, position_en,
      department_code, department_en, employee_class, employment_type, display_name,
      ad_account, user_type, department_name, dept_group, hod_3site, creator_person_id,
      creator_name_th, creator_position_en, pbi_premium_capacity, pbi_pro_license,
      license_type, bpk_phuket_executive, bpk_phuket_marketing, bpk_phuket_hod,
      bpk_phuket_stg, bpk_phuket_admin, bpk_hod, bsi_hod, dbk_hod, bpk_quality,
      bsi_quality, name, email, hospital, department, position, employee_id,
      status, request_date, purpose, notes, source, created_at, updated_at
    ) VALUES (
      $id, $site, $business_unit_code, $person_id, $user_id, $name_th, $position_en,
      $department_code, $department_en, $employee_class, $employment_type, $display_name,
      $ad_account, $user_type, $department_name, $dept_group, $hod_3site, $creator_person_id,
      $creator_name_th, $creator_position_en, $pbi_premium_capacity, $pbi_pro_license,
      $license_type, $bpk_phuket_executive, $bpk_phuket_marketing, $bpk_phuket_hod,
      $bpk_phuket_stg, $bpk_phuket_admin, $bpk_hod, $bsi_hod, $dbk_hod, $bpk_quality,
      $bsi_quality, $name, $email, $hospital, $department, $position, $employee_id,
      $status, $request_date, $purpose, $notes, $source, $created_at, $updated_at
    ) ON CONFLICT(id) DO UPDATE SET
      site = excluded.site,
      business_unit_code = excluded.business_unit_code,
      person_id = excluded.person_id,
      user_id = excluded.user_id,
      name_th = excluded.name_th,
      position_en = excluded.position_en,
      department_code = excluded.department_code,
      department_en = excluded.department_en,
      employee_class = excluded.employee_class,
      employment_type = excluded.employment_type,
      display_name = excluded.display_name,
      ad_account = excluded.ad_account,
      user_type = excluded.user_type,
      department_name = excluded.department_name,
      dept_group = excluded.dept_group,
      hod_3site = excluded.hod_3site,
      creator_person_id = excluded.creator_person_id,
      creator_name_th = excluded.creator_name_th,
      creator_position_en = excluded.creator_position_en,
      pbi_premium_capacity = excluded.pbi_premium_capacity,
      pbi_pro_license = excluded.pbi_pro_license,
      license_type = excluded.license_type,
      bpk_phuket_executive = excluded.bpk_phuket_executive,
      bpk_phuket_marketing = excluded.bpk_phuket_marketing,
      bpk_phuket_hod = excluded.bpk_phuket_hod,
      bpk_phuket_stg = excluded.bpk_phuket_stg,
      bpk_phuket_admin = excluded.bpk_phuket_admin,
      bpk_hod = excluded.bpk_hod,
      bsi_hod = excluded.bsi_hod,
      dbk_hod = excluded.dbk_hod,
      bpk_quality = excluded.bpk_quality,
      bsi_quality = excluded.bsi_quality,
      name = excluded.name,
      email = excluded.email,
      hospital = excluded.hospital,
      department = excluded.department,
      position = excluded.position,
      employee_id = excluded.employee_id,
      status = excluded.status,
      request_date = excluded.request_date,
      purpose = excluded.purpose,
      notes = excluded.notes,
      source = excluded.source,
      updated_at = excluded.updated_at
  `);

  stmt.run({
    $id: record.id,
    $site: record.site,
    $business_unit_code: record.business_unit_code,
    $person_id: record.person_id,
    $user_id: record.user_id,
    $name_th: record.name_th,
    $position_en: record.position_en,
    $department_code: record.department_code,
    $department_en: record.department_en,
    $employee_class: record.employee_class,
    $employment_type: record.employment_type,
    $display_name: record.display_name,
    $ad_account: record.ad_account,
    $user_type: record.user_type,
    $department_name: record.department_name,
    $dept_group: record.dept_group,
    $hod_3site: record.hod_3site,
    $creator_person_id: record.creator_person_id,
    $creator_name_th: record.creator_name_th,
    $creator_position_en: record.creator_position_en,
    $pbi_premium_capacity: record.pbi_premium_capacity,
    $pbi_pro_license: record.pbi_pro_license,
    $license_type: record.license_type,
    $bpk_phuket_executive: record.bpk_phuket_executive ? 1 : 0,
    $bpk_phuket_marketing: record.bpk_phuket_marketing ? 1 : 0,
    $bpk_phuket_hod: record.bpk_phuket_hod ? 1 : 0,
    $bpk_phuket_stg: record.bpk_phuket_stg ? 1 : 0,
    $bpk_phuket_admin: record.bpk_phuket_admin ? 1 : 0,
    $bpk_hod: record.bpk_hod ? 1 : 0,
    $bsi_hod: record.bsi_hod ? 1 : 0,
    $dbk_hod: record.dbk_hod ? 1 : 0,
    $bpk_quality: record.bpk_quality ? 1 : 0,
    $bsi_quality: record.bsi_quality ? 1 : 0,
    $name: record.name,
    $email: record.email,
    $hospital: record.hospital,
    $department: record.department,
    $position: record.position,
    $employee_id: record.employee_id,
    $status: record.status,
    $request_date: record.request_date || null,
    $purpose: record.purpose || null,
    $notes: record.notes || null,
    $source: record.source,
    $created_at: record.created_at,
    $updated_at: record.updated_at,
  });

  return record;
}

export async function deleteDbLicense(id: string, deletedBy = "Unknown"): Promise<boolean> {
  const provider = getDbProvider();
  if (provider === "supabase") {
    const supabase = getSupabaseClient();
    // Keep the row in the activity log so it can be restored from there.
    const { data: before } = await supabase.from("powerbi_licenses").select("*").eq("id", id).maybeSingle();
    const { error } = await supabase.from("powerbi_licenses").delete().eq("id", id);
    if (error) throw error;
    if (before) {
      await insertDbChangeLogs([
        {
          id: crypto.randomUUID(),
          entity_table: "powerbi_licenses",
          entity_id: id,
          action: "delete",
          summary: `Deleted license for ${before.display_name || before.name_th || before.ad_account || id}`,
          changed_by: deletedBy,
          changed_at: new Date().toISOString(),
          before,
          after: null,
        },
      ]).catch((e) => console.error("Couldn't log license delete", e));
    }
    return true;
  }

  const db = getSqliteDb();
  db.query("DELETE FROM powerbi_licenses WHERE id = $id").run({ $id: id });
  return true;
}

export async function batchImportDbLicenses(licenses: PowerBiLicense[]): Promise<{ imported: number }> {
  for (const lic of licenses) {
    await saveDbLicense(lic);
  }
  return { imported: licenses.length };
}

// =============================================================================
// 5. USER SESSIONS & ACTIVITY AUDIT
// =============================================================================
export type AppUserSummary = {
  email: string;
  name: string;
  lastLoginAt: string;
  loginCount: number;
  recentLogins: Array<{ date: string; userAgent?: string; ip?: string }>;
};

export async function recordUserLogin(
  user: {
    email: string;
    name: string;
    userAgent?: string;
    ip?: string;
  },
  sessionSecret?: string
): Promise<void> {
  const now = new Date().toISOString();
  const provider = getDbProvider();

  // app_users is written only through the user_record_login database function
  // (called by the sign-in route); here we just keep the audit trail.
  void provider;
  // 2. Always record in change_log for full audit stream
  await insertDbChangeLogs([
    {
      id: crypto.randomUUID(),
      entity_table: "app_users",
      entity_id: user.email.toLowerCase(),
      action: "login",
      summary: `User ${user.name} (${user.email}) signed in`,
      changed_by: user.name,
      changed_at: now,
      before: null,
      after: {
        email: user.email.toLowerCase(),
        name: user.name,
        userAgent: user.userAgent || "",
        ip: user.ip || "",
        login_at: now,
      },
    },
  ], sessionSecret);
}

export async function getAppUsers(): Promise<AppUserSummary[]> {
  const provider = getDbProvider();
  if (provider === "supabase") {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("app_users")
        .select("*")
        .order("last_login_at", { ascending: false });

      if (!error && data && data.length > 0) {
        return data.map((u: any) => ({
          email: u.email,
          name: u.name,
          lastLoginAt: u.last_login_at || u.created_at,
          loginCount: u.login_count || 1,
          recentLogins: [
            {
              date: u.last_login_at || u.created_at,
              userAgent: u.last_user_agent || undefined,
              ip: u.last_ip || undefined,
            },
          ],
        }));
      }
    } catch (err) {
      console.error("Failed to query app_users table:", err);
    }
  }

  // Fallback to logs
  const logs = await getDbChangeLogs({ entityTable: "app_users", limit: 500 });
  const map = new Map<string, AppUserSummary>();

  for (const log of logs) {
    if (log.action !== "login") continue;
    const email = log.entity_id.toLowerCase();
    const existing = map.get(email);
    const afterData = (log.after as Record<string, unknown>) || {};
    const name = (afterData.name as string) || log.changed_by || email.split("@")[0];
    const userAgent = (afterData.userAgent as string) || "";
    const ip = (afterData.ip as string) || "";

    if (!existing) {
      map.set(email, {
        email,
        name,
        lastLoginAt: log.changed_at,
        loginCount: 1,
        recentLogins: [{ date: log.changed_at, userAgent, ip }],
      });
    } else {
      existing.loginCount += 1;
      if (new Date(log.changed_at).getTime() > new Date(existing.lastLoginAt).getTime()) {
        existing.lastLoginAt = log.changed_at;
      }
      if (existing.recentLogins.length < 10) {
        existing.recentLogins.push({ date: log.changed_at, userAgent, ip });
      }
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.lastLoginAt).getTime() - new Date(a.lastLoginAt).getTime()
  );
}

// Generic system activity logger
export async function logSystemActivity(entry: {
  entityTable: string;
  entityId: string;
  action: "create" | "update" | "delete" | "login" | string;
  summary: string;
  changedBy?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}): Promise<void> {
  const now = new Date().toISOString();
  await insertDbChangeLogs([
    {
      id: crypto.randomUUID(),
      entity_table: entry.entityTable,
      entity_id: entry.entityId,
      action: entry.action,
      summary: entry.summary,
      changed_by: entry.changedBy || "System",
      changed_at: now,
      before: entry.before || null,
      after: entry.after || null,
    },
  ]);
}

// =============================================================================
// 6. DAX ANNOTATIONS (MATH & BUSINESS DEFINITIONS) & CUSTOM DAX
// =============================================================================
export type DaxAnnotation = {
  id: string; // e.g. "D01_ms_Net_Revenue" or custom ID
  mathDefinition?: string;
  businessDefinition?: string;
  notes?: string;
  updatedAt?: string;
  updatedBy?: string;
};

/** What's stored now for one dictionary item — used to spot edits made by someone else meanwhile. */
export async function getDaxEditState(id: string): Promise<{
  annotation: { updatedAt: string | null; updatedBy: string | null; businessDefinition: string; mathDefinition: string; notes: string } | null;
  row: { updatedAt: string | null; isCustom: boolean; name: string; expression: string | null } | null;
}> {
  const supabase = getSupabaseClient();
  const [a, r] = await Promise.all([
    supabase.from("dax_annotations").select("updated_at, changed_by, business_definition, math_definition, notes").eq("id", id).maybeSingle(),
    supabase.from("dax_dictionary_items").select("updated_at, is_custom, name, expression").eq("id", id).maybeSingle(),
  ]);
  if (a.error) throw a.error;
  if (r.error) throw r.error;
  return {
    annotation: a.data
      ? {
          updatedAt: a.data.updated_at,
          updatedBy: a.data.changed_by,
          businessDefinition: a.data.business_definition || "",
          mathDefinition: a.data.math_definition || "",
          notes: a.data.notes || "",
        }
      : null,
    row: r.data ? { updatedAt: r.data.updated_at, isCustom: Boolean(r.data.is_custom), name: r.data.name, expression: r.data.expression } : null,
  };
}

export async function saveDaxAnnotation(item: DaxAnnotation & {
  changedBy?: string;
  modelCode?: string;
  tableName?: string;
  objectName?: string;
  objectType?: string;
}): Promise<string> {
  const now = new Date().toISOString();
  const provider = getDbProvider();

  let beforeState: Record<string, unknown> | null = null;

  if (provider === "supabase") {
    // Errors are thrown (not just logged) so the caller can tell the person it didn't save.
    const supabase = getSupabaseClient();
    // Fetch previous state for Restore capability
    const { data: current, error: readError } = await supabase
      .from("dax_annotations")
      .select("*")
      .eq("id", item.id)
      .maybeSingle();
    if (readError) throw readError;

    beforeState = current || null;

    {
      // 1. Upsert into dax_annotations table
      const { error: upsertError } = await supabase.from("dax_annotations").upsert({
        id: item.id,
        model_code: item.modelCode || "PKT-D01",
        table_name: item.tableName || "",
        object_name: item.objectName || "",
        object_type: item.objectType || "Measure",
        math_definition: item.mathDefinition || "",
        business_definition: item.businessDefinition || "",
        notes: item.notes || "",
        changed_by: item.changedBy || "Analyst",
        updated_at: now,
      });
      if (upsertError) throw upsertError;

      // 2. Also update dax_dictionary_items if present
      const { error: itemError } = await supabase
        .from("dax_dictionary_items")
        .update({
          math_definition: item.mathDefinition || "",
          business_definition: item.businessDefinition || "",
          notes: item.notes || "",
          updated_at: now,
        })
        .eq("id", item.id);
      if (itemError) throw itemError;
    }
  }

  // 3. Log into change_log with before and after state
  await insertDbChangeLogs([
    {
      id: crypto.randomUUID(),
      entity_table: "dax_annotations",
      entity_id: item.id,
      action: "update",
      summary: `Updated definitions of [${item.objectName || item.id}]${item.tableName ? ` in ${item.tableName}` : ""}${item.modelCode ? ` (${item.modelCode})` : ""}`,
      changed_by: item.changedBy || "Analyst",
      changed_at: now,
      before: beforeState,
      after: {
        id: item.id,
        mathDefinition: item.mathDefinition || "",
        businessDefinition: item.businessDefinition || "",
        notes: item.notes || "",
        updatedAt: now,
      },
    },
  ]);
  return now;
}

export async function getAllDaxAnnotations(): Promise<Record<string, DaxAnnotation>> {
  const provider = getDbProvider();
  if (provider === "supabase") {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.from("dax_annotations").select("*");
      if (!error && data) {
        const map: Record<string, DaxAnnotation> = {};
        for (const row of data) {
          map[row.id] = {
            id: row.id,
            mathDefinition: row.math_definition || "",
            businessDefinition: row.business_definition || "",
            notes: row.notes || "",
            updatedAt: row.updated_at,
            updatedBy: row.changed_by || undefined,
          };
        }
        return map;
      }
    } catch (err) {
      console.error("Error querying dax_annotations in Supabase:", err);
    }
  }

  // Fallback to change_log
  const logs = await getDbChangeLogs({ entityTable: "dax_annotations", limit: 1000 });
  const map: Record<string, DaxAnnotation> = {};
  const sorted = [...logs].sort((a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime());
  for (const log of sorted) {
    const after = (log.after as Record<string, unknown>) || {};
    if (log.entity_id) {
      map[log.entity_id] = {
        id: log.entity_id,
        mathDefinition: (after.mathDefinition as string) || "",
        businessDefinition: (after.businessDefinition as string) || "",
        notes: (after.notes as string) || "",
        updatedAt: log.changed_at,
      };
    }
  }
  return map;
}

export type CustomDaxItem = {
  id: string;
  datasetId: string;
  tableName: string;
  name: string;
  expression: string;
  formatString?: string;
  dataType?: string;
  itemType: "measure" | "column" | "calculated_column" | "custom_dax" | string;
  mathDefinition?: string;
  businessDefinition?: string;
  notes?: string;
  createdBy?: string;
  createdAt?: string;
};

export async function saveCustomDaxItem(item: CustomDaxItem): Promise<string> {
  const now = new Date().toISOString();
  const provider = getDbProvider();

  let beforeState: Record<string, unknown> | null = null;

  if (provider === "supabase") {
    const supabase = getSupabaseClient();
    const { data: current, error: readError } = await supabase
      .from("dax_dictionary_items")
      .select("*")
      .eq("id", item.id)
      .maybeSingle();
    if (readError) throw readError;

    beforeState = current || null;

    {
      // Upsert into dax_dictionary_items
      const { error: upsertError } = await supabase.from("dax_dictionary_items").upsert({
        id: item.id,
        model_code: item.datasetId || "PKT-D01",
        table_name: item.tableName,
        name: item.name,
        item_type: "Custom DAX",
        data_type: item.dataType || "Decimal",
        expression: item.expression,
        format_string: item.formatString || null,
        math_definition: item.mathDefinition || "",
        business_definition: item.businessDefinition || "",
        notes: item.notes || "",
        is_custom: true,
        updated_at: now,
      });
      if (upsertError) throw upsertError;
    }
  }

  await insertDbChangeLogs([
    {
      id: crypto.randomUUID(),
      entity_table: "custom_dax_items",
      entity_id: item.id,
      action: beforeState ? "update" : "create",
      summary: beforeState
        ? `Updated custom DAX measure [${item.name}] in ${item.tableName}`
        : `Created custom DAX measure [${item.name}] in ${item.tableName}`,
      changed_by: item.createdBy || "Analyst",
      changed_at: now,
      before: beforeState,
      after: { ...item, createdAt: item.createdAt || now, updatedAt: now },
    },
  ]);
  return now;
}

export async function deleteCustomDaxItem(id: string, user: string = "Analyst"): Promise<void> {
  const now = new Date().toISOString();
  const provider = getDbProvider();

  let beforeState: Record<string, unknown> | null = null;

  if (provider === "supabase") {
    try {
      const supabase = getSupabaseClient();
      const { data: current } = await supabase
        .from("dax_dictionary_items")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      beforeState = current || null;

      await supabase.from("dax_dictionary_items").delete().eq("id", id);
    } catch (err) {
      console.error("Error deleting custom DAX from Supabase:", err);
    }
  }

  await insertDbChangeLogs([
    {
      id: crypto.randomUUID(),
      entity_table: "custom_dax_items",
      entity_id: id,
      action: "delete",
      summary: `Deleted custom DAX measure ID: ${id}`,
      changed_by: user,
      changed_at: now,
      before: beforeState,
      after: null,
    },
  ]);
}

export async function getAllCustomDaxItems(): Promise<CustomDaxItem[]> {
  const provider = getDbProvider();
  if (provider === "supabase") {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("dax_dictionary_items")
        .select("*")
        .eq("is_custom", true);

      if (!error && data) {
        return data.map((row: any) => ({
          id: row.id,
          datasetId: row.model_code,
          tableName: row.table_name,
          name: row.name,
          expression: row.expression || "",
          formatString: row.format_string || undefined,
          dataType: row.data_type || "Decimal",
          itemType: "custom_dax",
          mathDefinition: row.math_definition || "",
          businessDefinition: row.business_definition || "",
          notes: row.notes || "",
          createdAt: row.created_at,
        }));
      }
    } catch (err) {
      console.error("Error reading custom DAX from Supabase:", err);
    }
  }

  // Fallback to change_log
  const logs = await getDbChangeLogs({ entityTable: "custom_dax_items", limit: 500 });
  const map = new Map<string, CustomDaxItem>();
  const sorted = [...logs].sort((a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime());
  for (const log of sorted) {
    if (log.action === "delete") {
      map.delete(log.entity_id);
    } else if (log.action === "create" || log.action === "update") {
      if (log.after) {
        map.set(log.entity_id, log.after as unknown as CustomDaxItem);
      }
    }
  }
  return Array.from(map.values());
}

// =============================================================================
// 7. RESTORE / ROLLBACK SYSTEM AUDIT EVENTS
// =============================================================================
export async function restoreChangeLog(
  logId: string,
  restoredBy: string = "Admin"
): Promise<{ success: boolean; message: string }> {
  const provider = getDbProvider();
  const supabase = provider === "supabase" ? getSupabaseClient() : null;

  // 1. Fetch the log entry
  let logEntry: any = null;
  if (supabase) {
    const { data } = await supabase.from("change_log").select("*").eq("id", logId).maybeSingle();
    logEntry = data;
  } else {
    const logs = await getDbChangeLogs({ limit: 1000 });
    logEntry = logs.find((l) => l.id === logId);
  }

  if (!logEntry) {
    throw new Error(`Audit log entry #${logId} not found`);
  }

  const { entity_table, entity_id, action, before, after } = logEntry;
  const beforeObj = typeof before === "string" ? JSON.parse(before) : before;
  const afterObj = typeof after === "string" ? JSON.parse(after) : after;
  const now = new Date().toISOString();

  // 2. Perform restoration based on entity and previous action
  if (entity_table === "custom_dax_items" || entity_table === "dax_dictionary_items") {
    if (action === "delete" && beforeObj) {
      // Re-insert the deleted custom item
      if (supabase) {
        await supabase.from("dax_dictionary_items").upsert({
          id: entity_id,
          model_code: beforeObj.model_code || beforeObj.datasetId || "PKT-D01",
          table_name: beforeObj.table_name || beforeObj.tableName || "Custom",
          name: beforeObj.name,
          item_type: "Custom DAX",
          data_type: beforeObj.data_type || beforeObj.dataType || "Decimal",
          expression: beforeObj.expression,
          math_definition: beforeObj.math_definition || beforeObj.mathDefinition || "",
          business_definition: beforeObj.business_definition || beforeObj.businessDefinition || "",
          notes: beforeObj.notes || "",
          is_custom: true,
          updated_at: now,
        });
      }
    } else if (action === "create") {
      // Rollback creation by deleting the item
      if (supabase) {
        await supabase.from("dax_dictionary_items").delete().eq("id", entity_id);
      }
    } else if (action === "update" && beforeObj) {
      // Rollback update by restoring previous definitions
      if (supabase) {
        await supabase
          .from("dax_dictionary_items")
          .update({
            expression: beforeObj.expression,
            math_definition: beforeObj.math_definition || beforeObj.mathDefinition,
            business_definition: beforeObj.business_definition || beforeObj.businessDefinition,
            notes: beforeObj.notes,
            updated_at: now,
          })
          .eq("id", entity_id);
      }
    }
  } else if (entity_table === "dax_annotations" && beforeObj) {
    if (supabase) {
      await supabase.from("dax_annotations").upsert({
        ...beforeObj,
        updated_at: now,
      });
      await supabase
        .from("dax_dictionary_items")
        .update({
          math_definition: beforeObj.math_definition || beforeObj.mathDefinition,
          business_definition: beforeObj.business_definition || beforeObj.businessDefinition,
          notes: beforeObj.notes,
          updated_at: now,
        })
        .eq("id", entity_id);
    }
  } else if (entity_table === "powerbi_licenses") {
    if (action === "delete" && beforeObj) {
      if (supabase) {
        await supabase.from("powerbi_licenses").upsert(beforeObj);
      }
    } else if (action === "update" && beforeObj) {
      if (supabase) {
        await supabase.from("powerbi_licenses").upsert(beforeObj);
      }
    }
  }

  // 3. Mark the log as restored
  if (supabase) {
    await supabase.from("change_log").update({ is_restored: true }).eq("id", logId);
  }

  // 4. Log a RESTORE audit event
  await insertDbChangeLogs([
    {
      id: crypto.randomUUID(),
      entity_table,
      entity_id,
      action: "restore",
      summary: `Restored ${entity_table} (${entity_id}) from log #${logId.slice(0, 8)}`,
      changed_by: restoredBy,
      changed_at: now,
      before: afterObj,
      after: beforeObj,
    },
  ]);

  return { success: true, message: `Successfully restored ${entity_table} record #${entity_id}` };
}

// =============================================================================
// 8. WHITEBOARD BOARDS REPOSITORY (SUPABASE + SQLITE)
// =============================================================================
export interface WhiteboardBoardDb {
  id: string;
  name: string;
  folder_id: string;
  folder_name: string;
  description?: string;
  nodes: any[];
  updated_at: string;
  created_at?: string;
  created_by?: string | null;
  updated_by?: string | null;
}

export async function getDbWhiteboardBoards(): Promise<WhiteboardBoardDb[]> {
  const provider = getDbProvider();
  if (provider === "supabase") {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("whiteboard_boards")
        .select("*")
        .order("updated_at", { ascending: false });

      if (error) {
        console.error("Supabase get whiteboard boards error:", error);
        return [];
      }
      return (data || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        folder_id: row.folder_id || "folder_general",
        folder_name: row.folder_name || "General Workflows",
        description: row.description || "",
        nodes: typeof row.nodes === "string" ? JSON.parse(row.nodes) : row.nodes || [],
        updated_at: row.updated_at,
        created_at: row.created_at,
        created_by: row.created_by ?? null,
        updated_by: row.updated_by ?? null,
      }));
    } catch (err) {
      console.error("Error reading whiteboard boards from Supabase:", err);
      return [];
    }
  }

  try {
    const db = getSqliteDb();
    const rows: any[] = db
      .query("SELECT * FROM whiteboard_boards ORDER BY updated_at DESC")
      .all();
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      folder_id: row.folder_id || "folder_general",
      folder_name: row.folder_name || "General Workflows",
      description: row.description || "",
      nodes: typeof row.nodes === "string" ? JSON.parse(row.nodes) : row.nodes || [],
      updated_at: row.updated_at,
      created_at: row.created_at,
    }));
  } catch (err) {
    console.error("Error reading whiteboard boards from SQLite:", err);
    return [];
  }
}

export async function saveDbWhiteboardBoard(board: {
  id: string;
  name: string;
  folder_id?: string;
  folder_name?: string;
  description?: string;
  nodes: any[];
  /** Display name of the person saving (set by the API from the session). */
  updated_by?: string | null;
}): Promise<void> {
  const provider = getDbProvider();
  const now = new Date().toISOString();
  const folder_id = board.folder_id || "folder_general";
  const folder_name = board.folder_name || "General Workflows";

  if (provider === "supabase") {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("whiteboard_boards").upsert(
      {
        id: board.id,
        name: board.name,
        folder_id,
        folder_name,
        description: board.description || "",
        nodes: board.nodes || [],
        updated_at: now,
        ...(board.updated_by ? { updated_by: board.updated_by } : {}),
      },
      { onConflict: "id" }
    );
    if (error) {
      console.error("Supabase upsert whiteboard board error:", error);
      throw error;
    }
    return;
  }

  const db = getSqliteDb();
  const stmt = db.query(`
    INSERT INTO whiteboard_boards (id, name, folder_id, folder_name, description, nodes, updated_at, created_at)
    VALUES ($id, $name, $folder_id, $folder_name, $description, $nodes, $updated_at, $created_at)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      folder_id = excluded.folder_id,
      folder_name = excluded.folder_name,
      description = excluded.description,
      nodes = excluded.nodes,
      updated_at = excluded.updated_at
  `);
  stmt.run({
    $id: board.id,
    $name: board.name,
    $folder_id: folder_id,
    $folder_name: folder_name,
    $description: board.description || "",
    $nodes: JSON.stringify(board.nodes || []),
    $updated_at: now,
    $created_at: now,
  });
}

export async function deleteDbWhiteboardBoard(boardId: string): Promise<void> {
  const provider = getDbProvider();
  if (provider === "supabase") {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("whiteboard_boards").delete().eq("id", boardId);
    if (error) throw error;
    return;
  }

  const db = getSqliteDb();
  db.query("DELETE FROM whiteboard_boards WHERE id = $id").run({ $id: boardId });
}

// ==============================================================================
// 9. TARGET SCENARIOS REPOSITORY (SUPABASE + SQLITE)
// ==============================================================================

export interface TargetScenarioDbRecord {
  id: string;
  store_key: string;
  store_label: string;
  name: string;
  saved_at_label?: string | null;
  sort_order?: number;
  snapshot: any;
  is_deleted?: boolean;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
}

export async function getDbTargetScenarios(): Promise<TargetScenarioDbRecord[]> {
  const provider = getDbProvider();
  if (provider === "supabase") {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("target_scenarios")
        .select("*")
        .eq("is_deleted", false)
        .order("sort_order", { ascending: true })
        .order("updated_at", { ascending: false });

      if (error) {
        console.error("Supabase get target_scenarios error:", error);
      } else if (data) {
        return data.map((s: any) => ({
          ...s,
          snapshot: typeof s.snapshot === "string" ? JSON.parse(s.snapshot) : s.snapshot,
          is_deleted: Boolean(s.is_deleted),
        }));
      }
    } catch (err) {
      console.error("Error reading target_scenarios from Supabase:", err);
    }
  }

  try {
    const db = getSqliteDb();
    const rows = db
      .query("SELECT * FROM target_scenarios WHERE is_deleted = 0 ORDER BY sort_order ASC, updated_at DESC")
      .all() as any[];
    return rows.map((r) => ({
      ...r,
      snapshot: typeof r.snapshot === "string" ? JSON.parse(r.snapshot) : r.snapshot,
      is_deleted: Boolean(r.is_deleted),
    }));
  } catch (err) {
    console.error("Error reading target_scenarios from SQLite:", err);
    return [];
  }
}

export async function saveDbTargetScenario(scenario: {
  id?: string;
  store_key?: string;
  store_label?: string;
  name: string;
  saved_at_label?: string | null;
  sort_order?: number;
  snapshot: any;
  created_by?: string | null;
}): Promise<TargetScenarioDbRecord> {
  const now = new Date().toISOString();
  const id = scenario.id || `scn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const store_key = scenario.store_key || "targetScenarioStep2Favorites_v1";
  const store_label = scenario.store_label || "Rev Target";
  const sort_order = scenario.sort_order ?? 0;

  const record: TargetScenarioDbRecord = {
    id,
    store_key,
    store_label,
    name: scenario.name,
    saved_at_label: scenario.saved_at_label || new Date().toLocaleString("th-TH"),
    sort_order,
    snapshot: scenario.snapshot,
    is_deleted: false,
    created_by: scenario.created_by || "web_user",
    created_at: now,
    updated_at: now,
  };

  const provider = getDbProvider();
  if (provider === "supabase") {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from("target_scenarios").upsert(
        {
          id: record.id,
          store_key: record.store_key,
          store_label: record.store_label,
          name: record.name,
          saved_at_label: record.saved_at_label,
          sort_order: record.sort_order,
          snapshot: record.snapshot,
          is_deleted: false,
          created_by: record.created_by,
          updated_at: now,
        },
        { onConflict: "id" }
      );
      if (error) {
        console.error("Supabase upsert target_scenario error:", error);
      } else {
        return record;
      }
    } catch (err) {
      console.error("Supabase error in saveDbTargetScenario:", err);
    }
  }

  const db = getSqliteDb();
  const stmt = db.query(`
    INSERT INTO target_scenarios (id, store_key, store_label, name, saved_at_label, sort_order, snapshot, is_deleted, created_by, updated_at, created_at)
    VALUES ($id, $store_key, $store_label, $name, $saved_at_label, $sort_order, $snapshot, 0, $created_by, $updated_at, $created_at)
    ON CONFLICT(id) DO UPDATE SET
      store_key = excluded.store_key,
      store_label = excluded.store_label,
      name = excluded.name,
      saved_at_label = excluded.saved_at_label,
      sort_order = excluded.sort_order,
      snapshot = excluded.snapshot,
      is_deleted = 0,
      updated_at = excluded.updated_at
  `);
  stmt.run({
    $id: record.id,
    $store_key: record.store_key,
    $store_label: record.store_label,
    $name: record.name,
    $saved_at_label: record.saved_at_label,
    $sort_order: record.sort_order,
    $snapshot: JSON.stringify(record.snapshot),
    $created_by: record.created_by,
    $updated_at: now,
    $created_at: now,
  });

  return record;
}

export async function deleteDbTargetScenario(scenarioId: string): Promise<void> {
  const provider = getDbProvider();
  if (provider === "supabase") {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from("target_scenarios")
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq("id", scenarioId);
      if (!error) return;
    } catch (err) {
      console.error("Supabase delete target_scenario error:", err);
    }
  }

  const db = getSqliteDb();
  db.query("UPDATE target_scenarios SET is_deleted = 1, deleted_at = datetime('now') WHERE id = $id").run({ $id: scenarioId });
}


