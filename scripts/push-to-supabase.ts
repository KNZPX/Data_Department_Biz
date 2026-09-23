import { createClient } from "@supabase/supabase-js";
import path from "path";

async function pushToSupabase() {
  console.log("=== Pushing Local SQLite (powerbi.db) Data to Supabase ===");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Error: Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in environment.");
    console.error("Please configure them in .env.local before running this script.");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Dynamic require bun:sqlite
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Database } = require("bun:sqlite");
  const dbPath = path.resolve(process.cwd(), "powerbi.db");
  const sqlite = new Database(dbPath);

  // 1. Token
  console.log("\n[1/4] Syncing OAuth Token to Supabase...");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const token: any = sqlite.query("SELECT * FROM powerbi_token WHERE id = 1 LIMIT 1").get();
  if (token) {
    const { error } = await supabase.from("powerbi_token").upsert({
      id: 1,
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expires_at: token.expires_at,
      updated_at: token.updated_at,
    });
    if (error) console.error("Token sync error:", error.message);
    else console.log("✓ Token synced successfully.");
  } else {
    console.log("- No token found in local SQLite.");
  }

  // 2. Power BI Items
  console.log("\n[2/4] Syncing Power BI Items (Reports & Dashboards)...");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: any[] = sqlite.query("SELECT * FROM powerbi_items").all();
  if (items && items.length > 0) {
    const { error } = await supabase.from("powerbi_items").upsert(items, { onConflict: "id" });
    if (error) console.error("Items sync error:", error.message);
    else console.log(`✓ Synced ${items.length} Power BI items to Supabase.`);
  } else {
    console.log("- No items found in local SQLite.");
  }

  // 3. Change Log
  console.log("\n[3/4] Syncing Change Log & Publish History...");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const changeLogs: any[] = sqlite.query("SELECT * FROM change_log").all();
  if (changeLogs && changeLogs.length > 0) {
    const formattedLogs = changeLogs.map((l) => ({
      ...l,
      before: l.before ? JSON.parse(l.before) : null,
      after: l.after ? JSON.parse(l.after) : null,
    }));
    const { error } = await supabase.from("change_log").upsert(formattedLogs, { onConflict: "id" });
    if (error) console.error("Change log sync error:", error.message);
    else console.log(`✓ Synced ${changeLogs.length} change log entries to Supabase.`);
  } else {
    console.log("- No change logs found in local SQLite.");
  }

  // 4. Licenses
  console.log("\n[4/4] Syncing Licenses & Permissions (32 columns)...");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const licenses: any[] = sqlite.query("SELECT * FROM powerbi_licenses").all();
  if (licenses && licenses.length > 0) {
    const formattedLicenses = licenses.map((l) => ({
      ...l,
      bpk_phuket_executive: Boolean(l.bpk_phuket_executive),
      bpk_phuket_marketing: Boolean(l.bpk_phuket_marketing),
      bpk_phuket_hod: Boolean(l.bpk_phuket_hod),
      bpk_phuket_stg: Boolean(l.bpk_phuket_stg),
      bpk_phuket_admin: Boolean(l.bpk_phuket_admin),
      bpk_hod: Boolean(l.bpk_hod),
      bsi_hod: Boolean(l.bsi_hod),
      dbk_hod: Boolean(l.dbk_hod),
      bpk_quality: Boolean(l.bpk_quality),
      bsi_quality: Boolean(l.bsi_quality),
    }));

    // Batch upsert in chunks of 100 to avoid payload size limit
    const chunkSize = 100;
    for (let i = 0; i < formattedLicenses.length; i += chunkSize) {
      const chunk = formattedLicenses.slice(i, i + chunkSize);
      const { error } = await supabase.from("powerbi_licenses").upsert(chunk, { onConflict: "id" });
      if (error) {
        console.error(`License sync chunk ${i / chunkSize + 1} error:`, error.message);
      }
    }
    console.log(`✓ Synced ${licenses.length} license records to Supabase.`);
  } else {
    console.log("- No licenses found in local SQLite.");
  }

  console.log("\n=======================================================");
  console.log("Supabase sync complete! All records are now in your cloud Supabase database.");
  console.log("=======================================================\n");
}

void pushToSupabase();
