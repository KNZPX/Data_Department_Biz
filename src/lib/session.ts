// Server-only: per-user sessions.
//
// Each browser gets its own random session id in an httpOnly cookie. Only a
// SHA-256 hash of that id is stored in Supabase (public.app_sessions), and the
// table itself is not readable with the anon key — it is reached exclusively
// through SECURITY DEFINER RPCs that require the exact hash. This replaces the
// old single global `powerbi_token` row, where the last person to sign in
// became everyone's identity.
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { getSupabaseClient } from "./db";

export const SESSION_COOKIE = "biz_sid";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days (refresh token keeps access alive)

export type SessionUser = { email: string; name: string };

export type SessionRecord = {
  id: string;
  userEmail: string;
  userName: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string;
  lastSeenAt: string;
};

export function newSessionSecret(): string {
  return randomBytes(32).toString("base64url");
}

function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export function attachSessionCookie(response: NextResponse, secret: string) {
  response.cookies.set(SESSION_COOKIE, secret, sessionCookieOptions());
}

export async function readSessionSecret(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value || null;
}

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const json = Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function userFromAccessToken(token: string): SessionUser | null {
  const p = decodeJwtPayload(token);
  if (!p) return null;
  const email = String(p.upn || p.unique_name || p.email || p.preferred_username || "").toLowerCase();
  if (!email) return null;
  return { email, name: String(p.name || email.split("@")[0]) };
}

export async function getSessionBySecret(secret: string | null): Promise<SessionRecord | null> {
  if (!secret) return null;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("session_get", { p_id: hashSecret(secret) });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return null;
  return {
    id: row.id,
    userEmail: row.user_email,
    userName: row.user_name || row.user_email,
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    expiresAt: row.expires_at,
    lastSeenAt: row.last_seen_at,
  };
}

export async function getCurrentSession(): Promise<SessionRecord | null> {
  return getSessionBySecret(await readSessionSecret());
}

/** Identity of the person making this request, for audit fields like changed_by. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  try {
    const s = await getCurrentSession();
    return s ? { email: s.userEmail, name: s.userName } : null;
  } catch {
    return null;
  }
}

export async function saveSession(
  secret: string,
  data: { accessToken: string; refreshToken: string | null; expiresAt: string; userAgent?: string | null }
): Promise<SessionUser> {
  const user = userFromAccessToken(data.accessToken) || { email: "unknown@local", name: "Unknown user" };
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc("session_upsert", {
    p_id: hashSecret(secret),
    p_email: user.email,
    p_name: user.name,
    p_access: data.accessToken,
    p_refresh: data.refreshToken,
    p_expires: data.expiresAt,
    p_ua: data.userAgent || null,
  });
  if (error) throw error;
  return user;
}

export async function touchSession(secret: string | null) {
  if (!secret) return;
  const supabase = getSupabaseClient();
  await supabase.rpc("session_touch", { p_id: hashSecret(secret) });
}

export async function deleteSession(secret: string | null) {
  if (!secret) return;
  const supabase = getSupabaseClient();
  await supabase.rpc("session_delete", { p_id: hashSecret(secret) });
}

export async function getOnlineUsers(minutes = 10): Promise<{ email: string; name: string; lastSeenAt: string }[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("sessions_online", { p_minutes: minutes });
  if (error || !Array.isArray(data)) return [];
  return data
    .map((r: { user_email: string; user_name: string | null; last_seen_at: string }) => ({
      email: r.user_email,
      name: r.user_name || r.user_email,
      lastSeenAt: r.last_seen_at,
    }))
    .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
}
