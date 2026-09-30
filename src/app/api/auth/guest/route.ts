import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/db";
import { attachSessionCookie, newSessionSecret, saveGuestSession } from "@/lib/session";

export const dynamic = "force-dynamic";

// Guest sign-in with a username/password created by an admin. The password is
// checked inside the database (bcrypt); the API never sees the stored hash.
export async function POST(request: NextRequest) {
  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send username and password." }, { status: 400 });
  }
  const username = String(body.username || "").trim();
  const password = String(body.password || "");
  if (!username || !password) return NextResponse.json({ error: "Enter your username and password." }, { status: 400 });

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("guest_login", { p_username: username, p_password: password });
  const row = Array.isArray(data) ? data[0] : null;
  if (error || !row) {
    // Same message for unknown user / wrong password / disabled account.
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: "Username or password is incorrect." }, { status: 401 });
  }
  const secret = newSessionSecret();
  await saveGuestSession(secret, { email: row.email, name: row.name }, request.headers.get("user-agent"));
  const res = NextResponse.json({ ok: true, user: { email: row.email, name: row.name } });
  attachSessionCookie(res, secret);
  return res;
}
