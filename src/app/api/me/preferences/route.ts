import { NextRequest } from "next/server";
import { getSupabaseClient } from "@/lib/db";
import { hashSecret, readSessionSecret } from "@/lib/session";

export const dynamic = "force-dynamic";

// The signed-in person's own UI preferences (appearance). The database
// functions resolve the person from the session hash, so nobody can read or
// change someone else's.
export async function GET() {
  const secret = await readSessionSecret();
  if (!secret) return Response.json({ error: "Sign in first." }, { status: 401 });
  const { data, error } = await getSupabaseClient().rpc("user_prefs_get", { p_session: hashSecret(secret) });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (data === null) return Response.json({ error: "Sign in first." }, { status: 401 });
  return Response.json({ prefs: data });
}

export async function PUT(request: NextRequest) {
  const secret = await readSessionSecret();
  if (!secret) return Response.json({ error: "Sign in first." }, { status: 401 });
  let body: { prefs?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send { prefs }." }, { status: 400 });
  }
  const prefs = body.prefs;
  if (!prefs || typeof prefs !== "object" || Array.isArray(prefs)) {
    return Response.json({ error: "prefs must be an object." }, { status: 400 });
  }
  const { error } = await getSupabaseClient().rpc("user_prefs_set", { p_session: hashSecret(secret), p_prefs: prefs });
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ ok: true });
}
