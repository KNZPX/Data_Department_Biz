import { NextResponse } from "next/server";
import { getDbProvider, getSupabaseClient } from "@/lib/db";
import path from "path";

export const dynamic = "force-dynamic";

async function performLogout() {
  const provider = getDbProvider();
  if (provider === "supabase") {
    const supabase = getSupabaseClient();
    await supabase.from("powerbi_token").delete().eq("id", 1);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Database } = require("bun:sqlite");
    const db = new Database(path.resolve(process.cwd(), "powerbi.db"));
    db.query("DELETE FROM powerbi_token WHERE id = 1").run();
  }
}

export async function GET(request: Request) {
  try {
    await performLogout();
  } catch (err) {
    console.error("Logout error:", err);
  }

  const url = new URL("/", request.url);
  const response = NextResponse.redirect(url);
  response.cookies.delete("pbi_oauth_verifier");
  response.cookies.delete("pbi_oauth_state");
  return response;
}

export async function POST(request: Request) {
  try {
    await performLogout();
  } catch (err) {
    console.error("Logout error:", err);
  }

  const url = new URL("/", request.url);
  const response = NextResponse.redirect(url);
  response.cookies.delete("pbi_oauth_verifier");
  response.cookies.delete("pbi_oauth_state");
  return response;
}
