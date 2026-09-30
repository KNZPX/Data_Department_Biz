// Server-only: Power BI token storage, scoped to the signed-in browser session.
import { getDbProvider, getDbToken, saveDbToken, type StoredToken } from "./db";
import type { OAuthTokens } from "./powerbiAuth";
import {
  decodeJwtPayload,
  getSessionBySecret,
  readSessionSecret,
  saveSession,
  type SessionUser,
} from "./session";

export type StoredPowerBiToken = StoredToken & { user?: SessionUser | null };

function useSessions() {
  return getDbProvider() === "supabase";
}

/** Token of the person making the current request (null when not signed in). */
export async function getStoredPowerBiToken(): Promise<StoredPowerBiToken | null> {
  if (!useSessions()) return getDbToken();
  const session = await getSessionBySecret(await readSessionSecret());
  if (!session) return null;
  return {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresAt: session.expiresAt,
    user: { email: session.userEmail, name: session.userName },
  };
}

function expiryFromJwt(token: string): string {
  const p = decodeJwtPayload(token);
  const exp = p && typeof p.exp === "number" ? p.exp : null;
  if (!exp) throw new Error("That doesn't look like a valid access token (couldn't read its expiry claim).");
  return new Date(exp * 1000).toISOString();
}

/** Manual token paste (admin fallback). `secret` is the session cookie value to bind it to. */
export async function savePowerBiToken(rawToken: string, secret: string): Promise<StoredPowerBiToken> {
  const accessToken = rawToken.trim().replace(/^Bearer\s+/i, "");
  if (!accessToken) throw new Error("Paste an access token first.");
  const expiresAt = expiryFromJwt(accessToken);
  if (!useSessions()) return saveDbToken({ accessToken, refreshToken: null, expiresAt });
  const user = await saveSession(secret, { accessToken, refreshToken: null, expiresAt });
  return { accessToken, refreshToken: null, expiresAt, user };
}

/** OAuth result. When `secret` is omitted the current request's session cookie is used (token refresh). */
export async function saveOAuthTokens(
  tokens: OAuthTokens,
  secret?: string,
  userAgent?: string | null
): Promise<StoredPowerBiToken> {
  const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000).toISOString();
  const payload = { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresAt };
  if (!useSessions()) return saveDbToken(payload);
  const sid = secret || (await readSessionSecret());
  if (!sid) throw new Error("No session to store the Power BI token in.");
  const user = await saveSession(sid, { ...payload, userAgent });
  return { ...payload, user };
}
