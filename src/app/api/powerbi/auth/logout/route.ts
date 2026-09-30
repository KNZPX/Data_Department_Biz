import { NextResponse } from "next/server";
import { getDbProvider, getSupabaseClient } from "@/lib/db";
import { SESSION_COOKIE, deleteSession, readSessionSecret } from "@/lib/session";
import path from "path";

export const dynamic = "force-dynamic";

// Signs out only the caller's own session — other people stay signed in.
async function performLogout() {
  if (getDbProvider() === "supabase") {
    await deleteSession(await readSessionSecret());
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Database } = require("bun:sqlite");
  const db = new Database(path.resolve(process.cwd(), "powerbi.db"));
  db.query("DELETE FROM powerbi_token WHERE id = 1").run();
  void getSupabaseClient;
}

async function handle(request: Request) {
  try {
    await performLogout();
  } catch (err) {
    console.error("Logout error:", err);
  }
  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.delete(SESSION_COOKIE);
  response.cookies.delete("pbi_oauth_verifier");
  response.cookies.delete("pbi_oauth_state");
  return response;
}

export const GET = handle;
export const POST = handle;
