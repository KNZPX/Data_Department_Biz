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
import { resolveAccess, type Access, type AccessPolicy, type Permissions } from "./access";

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

export function hashSecret(secret: string): string {
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

// ---------------------------------------------------------------------------
// Roles & access
// ---------------------------------------------------------------------------
export type CurrentUser = SessionUser & { access: Access; isGuest: boolean };

/** Who is calling, with their resolved page/module access (null when signed out or disabled). */
// The team's page policy changes rarely; keep it for a short while per server instance.
let policyCache: { at: number; value: AccessPolicy | null } | null = null;
export async function getAccessPolicy(): Promise<AccessPolicy | null> {
  if (policyCache && Date.now() - policyCache.at < 30_000) return policyCache.value;
  const secret = await readSessionSecret().catch(() => null);
  if (!secret) return policyCache?.value ?? null;
  const { data } = await getSupabaseClient().rpc("app_settings_get", { p_session: hashSecret(secret), p_key: "access_policy" });
  const value = (data && (data as { value?: AccessPolicy }).value) || null;
  policyCache = { at: Date.now(), value };
  return value;
}
export function clearAccessPolicyCache() {
  policyCache = null;
}

export async function getCurrentAccess(): Promise<CurrentUser | null> {
  const s = await getCurrentSession().catch(() => null);
  if (!s) return null;
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from("app_users")
    .select("email, name, role, permissions, is_active, is_guest")
    .eq("email", s.userEmail.toLowerCase())
    .maybeSingle();
  if (data && data.is_active === false) return null;
  const access = resolveAccess(data?.role || "member", (data?.permissions as Permissions) || null, await getAccessPolicy());
  return { email: s.userEmail, name: data?.name || s.userName, access, isGuest: Boolean(data?.is_guest) };
}

export async function recordSessionLogin(secret: string, ip?: string | null, ua?: string | null) {
  const supabase = getSupabaseClient();
  await supabase.rpc("user_record_login", { p_session: hashSecret(secret), p_ip: ip || null, p_ua: ua || null });
}

/** Guest accounts have no Power BI token; the session just carries their identity. */
export async function saveGuestSession(secret: string, user: { email: string; name: string }, ua?: string | null) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc("session_upsert", {
    p_id: hashSecret(secret),
    p_email: user.email,
    p_name: user.name,
    p_access: "",
    p_refresh: null,
    p_expires: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    p_ua: ua || null,
  });
  if (error) throw error;
}

/** Calls an admin-only database function with the caller's session (the DB checks the role). */
export async function adminRpc(fn: string, args: Record<string, unknown>) {
  const secret = await readSessionSecret();
  if (!secret) throw new Error("Sign in first.");
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc(fn, { p_session: hashSecret(secret), ...args });
  if (error) throw new Error(error.message);
}
