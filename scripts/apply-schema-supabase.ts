import { Client } from "pg";
import fs from "fs";
import path from "path";

async function applySchema() {
  console.log("=== Applying schema.sql to Supabase PostgreSQL ===");
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

  const sqlPath = path.resolve(process.cwd(), "database", "schema.sql");
  const sql = fs.readFileSync(sqlPath, "utf-8");

  console.log("Executing schema.sql...");
  await client.query(sql);
  console.log("✓ schema.sql executed successfully!");

  // Verify created tables
  const res = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);

  console.log("\nCreated tables in public schema:");
  for (const row of res.rows) {
    console.log(` - ${row.table_name}`);
  }

  await client.end();
}

applySchema().catch((err) => {
  console.error("Error executing schema:", err);
  process.exit(1);
});
