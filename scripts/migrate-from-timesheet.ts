import { createClient } from "@supabase/supabase-js";
import { saveDbToken, upsertDbItems, insertDbChangeLogs, batchImportDbLicenses } from "../src/lib/db";
import { normalizeLicense } from "../src/lib/licenseTypes";

async function runMigration() {
  console.log("=== Power BI Data Migration from Timesheet Supabase ===");

  const timesheetUrl = process.env.TIMESHEET_SUPABASE_URL;
  const timesheetKey = process.env.TIMESHEET_SUPABASE_ANON_KEY;

  if (!timesheetUrl || !timesheetKey) {
    console.error("Missing TIMESHEET_SUPABASE_URL or TIMESHEET_SUPABASE_ANON_KEY in environment.");
    process.exit(1);
  }

  const timesheetClient = createClient(timesheetUrl, timesheetKey);

  // 1. Migrate Token
  console.log("\n[1/4] Migrating Power BI OAuth Token...");
  try {
    const { data: tokenRow, error: tokenErr } = await timesheetClient
      .from("powerbi_token")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (tokenErr) {
      console.warn("Could not fetch token:", tokenErr.message);
    } else if (tokenRow) {
      await saveDbToken({
        accessToken: tokenRow.access_token,
        refreshToken: tokenRow.refresh_token,
        expiresAt: tokenRow.expires_at,
      });
      console.log("✓ Successfully migrated Power BI OAuth token.");
    } else {
      console.log("- No token found in Timesheet database.");
    }
  } catch (err) {
    console.error("Token migration error:", err);
  }

  // 2. Migrate Power BI Items
  console.log("\n[2/4] Migrating Power BI Items (Reports & Dashboards)...");
  try {
    const { data: items, error: itemsErr } = await timesheetClient
      .from("powerbi_items")
      .select("*");

    if (itemsErr) {
      console.warn("Could not fetch powerbi_items:", itemsErr.message);
    } else if (items && items.length > 0) {
      await upsertDbItems(items);
      console.log(`✓ Successfully migrated ${items.length} Power BI items.`);
    } else {
      console.log("- No items found in Timesheet database.");
    }
  } catch (err) {
    console.error("Items migration error:", err);
  }

  // 3. Migrate Change Log
  console.log("\n[3/4] Migrating Change Log & Publish History...");
  try {
    const { data: logs, error: logsErr } = await timesheetClient
      .from("change_log")
      .select("*")
      .eq("entity_table", "powerbi_items");

    if (logsErr) {
      console.warn("Could not fetch change_log:", logsErr.message);
    } else if (logs && logs.length > 0) {
      await insertDbChangeLogs(logs);
      console.log(`✓ Successfully migrated ${logs.length} change log entries.`);
    } else {
      console.log("- No change logs found in Timesheet database.");
    }
  } catch (err) {
    console.error("Change log migration error:", err);
  }

  // 4. Migrate Licenses
  console.log("\n[4/4] Migrating Power BI Licenses (32 Columns)...");
  try {
    const { data: licenses, error: licErr } = await timesheetClient
      .from("powerbi_licenses")
      .select("*");

    if (licErr) {
      console.warn("Could not fetch powerbi_licenses:", licErr.message);
    } else if (licenses && licenses.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const normalized = licenses.map((l: any) => normalizeLicense(l));
      await batchImportDbLicenses(normalized);
      console.log(`✓ Successfully migrated ${licenses.length} license records.`);
    } else {
      console.log("- No licenses found in Timesheet database.");
    }
  } catch (err) {
    console.error("License migration error:", err);
  }

  console.log("\n=======================================================");
  console.log("Migration complete! Data has been successfully written to the dedicated database.");
  console.log("=======================================================\n");
}

void runMigration();
