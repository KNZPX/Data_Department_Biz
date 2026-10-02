import { NextRequest } from "next/server";
import { getSupabaseClient } from "@/lib/db";
import { hashSecret, readSessionSecret } from "@/lib/session";

export const dynamic = "force-dynamic";

// Team-wide settings (e.g. the announcement banner). Everyone signed in can
// read them; the database only lets admins change them.
const KEYS = new Set(["announcement"]);

export async function GET(request: NextRequest) {
  const secret = await readSessionSecret();
  if (!secret) return Response.json({ error: "Sign in first." }, { status: 401 });
  const key = new URL(request.url).searchParams.get("key") || "";
  if (!KEYS.has(key)) return Response.json({ error: "Unknown setting." }, { status: 400 });
  const { data, error } = await getSupabaseClient().rpc("app_settings_get", { p_session: hashSecret(secret), p_key: key });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (data === null) return Response.json({ error: "Sign in first." }, { status: 401 });
  return Response.json({ value: data.value ?? null, updatedBy: data.updatedBy ?? null, updatedAt: data.updatedAt ?? null });
}

export async function PUT(request: NextRequest) {
  const secret = await readSessionSecret();
  if (!secret) return Response.json({ error: "Sign in first." }, { status: 401 });
  let body: { key?: string; value?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send { key, value }." }, { status: 400 });
  }
  if (!body.key || !KEYS.has(body.key)) return Response.json({ error: "Unknown setting." }, { status: 400 });
  if (!body.value || typeof body.value !== "object" || Array.isArray(body.value)) {
    return Response.json({ error: "value must be an object." }, { status: 400 });
  }
  const { data, error } = await getSupabaseClient().rpc("app_settings_set", {
    p_session: hashSecret(secret),
    p_key: body.key,
    p_value: body.value,
  });
  if (error) return Response.json({ error: error.message }, { status: error.code === "42501" ? 403 : 400 });
  return Response.json(data);
}
