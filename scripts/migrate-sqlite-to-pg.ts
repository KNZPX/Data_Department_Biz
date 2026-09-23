import { Client } from "pg";
import path from "path";

async function migrateData() {
  console.log("=== Migrating Data from SQLite to Supabase PostgreSQL ===");

  const client = new Client({
    host: "db.wwnzwsjquostxfpjerla.supabase.co",
    port: 5432,
    user: "postgres",
    password: process.env.SUPABASE_DB_PASSWORD || process.env.PGPASSWORD,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log("✓ Connected to Supabase PostgreSQL.");

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Database } = require("bun:sqlite");
  const sqlite = new Database(path.resolve(process.cwd(), "powerbi.db"));

  // 1. Token
  console.log("\n[1/4] Migrating OAuth Token...");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const token: any = sqlite.query("SELECT * FROM powerbi_token WHERE id = 1 LIMIT 1").get();
  if (token) {
    await client.query(`
      INSERT INTO powerbi_token (id, access_token, refresh_token, expires_at, updated_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        expires_at = EXCLUDED.expires_at,
        updated_at = EXCLUDED.updated_at;
    `, [token.id, token.access_token, token.refresh_token, token.expires_at, token.updated_at]);
    console.log("✓ OAuth Token migrated.");
  }

  // 2. Power BI Items
  console.log("\n[2/4] Migrating Power BI Items...");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: any[] = sqlite.query("SELECT * FROM powerbi_items").all();
  for (const item of items) {
    await client.query(`
      INSERT INTO powerbi_items (
        id, kind, workspace_id, workspace_name, name, report_code, report_title,
        web_url, description, last_modified, last_publish, responsible_user,
        responsible_email, first_seen_at, last_seen_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
      ) ON CONFLICT (id) DO UPDATE SET
        kind = EXCLUDED.kind,
        workspace_id = EXCLUDED.workspace_id,
        workspace_name = EXCLUDED.workspace_name,
        name = EXCLUDED.name,
        report_code = EXCLUDED.report_code,
        report_title = EXCLUDED.report_title,
        web_url = EXCLUDED.web_url,
        description = EXCLUDED.description,
        last_modified = EXCLUDED.last_modified,
        last_publish = EXCLUDED.last_publish,
        responsible_user = EXCLUDED.responsible_user,
        responsible_email = EXCLUDED.responsible_email,
        last_seen_at = EXCLUDED.last_seen_at,
        updated_at = EXCLUDED.updated_at;
    `, [
      item.id, item.kind, item.workspace_id, item.workspace_name, item.name,
      item.report_code, item.report_title, item.web_url, item.description,
      item.last_modified, item.last_publish, item.responsible_user,
      item.responsible_email, item.first_seen_at, item.last_seen_at, item.updated_at,
    ]);
  }
  console.log(`✓ Migrated ${items.length} Power BI items.`);

  // 3. Change Log
  console.log("\n[3/4] Migrating Change Log...");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const logs: any[] = sqlite.query("SELECT * FROM change_log").all();
  for (const log of logs) {
    await client.query(`
      INSERT INTO change_log (
        id, entity_table, entity_id, action, before, after, summary, changed_by, changed_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9
      ) ON CONFLICT (id) DO NOTHING;
    `, [
      log.id, log.entity_table, log.entity_id, log.action,
      log.before ? JSON.parse(log.before) : null,
      log.after ? JSON.parse(log.after) : null,
      log.summary, log.changed_by, log.changed_at,
    ]);
  }
  console.log(`✓ Migrated ${logs.length} change log entries.`);

  // 4. Licenses
  console.log("\n[4/4] Migrating Licenses...");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const licenses: any[] = sqlite.query("SELECT * FROM powerbi_licenses").all();
  for (const lic of licenses) {
    await client.query(`
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
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
        $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34,
        $35, $36, $37, $38, $39, $40, $41, $42, $43, $44, $45, $46
      ) ON CONFLICT (id) DO UPDATE SET
        site = EXCLUDED.site,
        business_unit_code = EXCLUDED.business_unit_code,
        person_id = EXCLUDED.person_id,
        user_id = EXCLUDED.user_id,
        name_th = EXCLUDED.name_th,
        position_en = EXCLUDED.position_en,
        department_code = EXCLUDED.department_code,
        department_en = EXCLUDED.department_en,
        employee_class = EXCLUDED.employee_class,
        employment_type = EXCLUDED.employment_type,
        display_name = EXCLUDED.display_name,
        ad_account = EXCLUDED.ad_account,
        user_type = EXCLUDED.user_type,
        department_name = EXCLUDED.department_name,
        dept_group = EXCLUDED.dept_group,
        hod_3site = EXCLUDED.hod_3site,
        creator_person_id = EXCLUDED.creator_person_id,
        creator_name_th = EXCLUDED.creator_name_th,
        creator_position_en = EXCLUDED.creator_position_en,
        pbi_premium_capacity = EXCLUDED.pbi_premium_capacity,
        pbi_pro_license = EXCLUDED.pbi_pro_license,
        license_type = EXCLUDED.license_type,
        bpk_phuket_executive = EXCLUDED.bpk_phuket_executive,
        bpk_phuket_marketing = EXCLUDED.bpk_phuket_marketing,
        bpk_phuket_hod = EXCLUDED.bpk_phuket_hod,
        bpk_phuket_stg = EXCLUDED.bpk_phuket_stg,
        bpk_phuket_admin = EXCLUDED.bpk_phuket_admin,
        bpk_hod = EXCLUDED.bpk_hod,
        bsi_hod = EXCLUDED.bsi_hod,
        dbk_hod = EXCLUDED.dbk_hod,
        bpk_quality = EXCLUDED.bpk_quality,
        bsi_quality = EXCLUDED.bsi_quality,
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        hospital = EXCLUDED.hospital,
        department = EXCLUDED.department,
        position = EXCLUDED.position,
        employee_id = EXCLUDED.employee_id,
        status = EXCLUDED.status,
        request_date = EXCLUDED.request_date,
        purpose = EXCLUDED.purpose,
        notes = EXCLUDED.notes,
        source = EXCLUDED.source,
        updated_at = EXCLUDED.updated_at;
    `, [
      lic.id, lic.site, lic.business_unit_code, lic.person_id, lic.user_id, lic.name_th, lic.position_en,
      lic.department_code, lic.department_en, lic.employee_class, lic.employment_type, lic.display_name,
      lic.ad_account, lic.user_type, lic.department_name, lic.dept_group, lic.hod_3site, lic.creator_person_id,
      lic.creator_name_th, lic.creator_position_en, lic.pbi_premium_capacity, lic.pbi_pro_license,
      lic.license_type, Boolean(lic.bpk_phuket_executive), Boolean(lic.bpk_phuket_marketing), Boolean(lic.bpk_phuket_hod),
      Boolean(lic.bpk_phuket_stg), Boolean(lic.bpk_phuket_admin), Boolean(lic.bpk_hod), Boolean(lic.bsi_hod),
      Boolean(lic.dbk_hod), Boolean(lic.bpk_quality), Boolean(lic.bsi_quality), lic.name, lic.email,
      lic.hospital, lic.department, lic.position, lic.employee_id, lic.status, lic.request_date,
      lic.purpose, lic.notes, lic.source, lic.created_at, lic.updated_at,
    ]);
  }
  console.log(`✓ Migrated ${licenses.length} licenses.`);

  // Counts verification
  const countItems = await client.query("SELECT COUNT(*) FROM powerbi_items");
  const countLicenses = await client.query("SELECT COUNT(*) FROM powerbi_licenses");
  const countLogs = await client.query("SELECT COUNT(*) FROM change_log");
  const countTokens = await client.query("SELECT COUNT(*) FROM powerbi_token");

  console.log("\n=== Migration Summary on Supabase ===");
  console.log(`Power BI Items: ${countItems.rows[0].count}`);
  console.log(`Licenses: ${countLicenses.rows[0].count}`);
  console.log(`Change Logs: ${countLogs.rows[0].count}`);
  console.log(`Tokens: ${countTokens.rows[0].count}`);

  await client.end();
}

migrateData().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
