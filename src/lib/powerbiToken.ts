import { getDbToken, saveDbToken, type StoredToken } from "./db";
import type { OAuthTokens } from "./powerbiAuth";

export type StoredPowerBiToken = StoredToken;

export async function getStoredPowerBiToken(): Promise<StoredPowerBiToken | null> {
  return getDbToken();
}

function decodeJwtExpiry(token: string): number | null {
  const payloadPart = token.split(".")[1];
  if (!payloadPart) return null;
  try {
    const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(base64, "base64").toString("utf-8");
    const payload = JSON.parse(json) as { exp?: unknown };
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

export async function savePowerBiToken(rawToken: string): Promise<StoredPowerBiToken> {
  const accessToken = rawToken.trim().replace(/^Bearer\s+/i, "");
  if (!accessToken) throw new Error("Paste an access token first.");
  const exp = decodeJwtExpiry(accessToken);
  if (!exp) throw new Error("That doesn't look like a valid access token (couldn't read its expiry claim).");
  const expiresAt = new Date(exp * 1000).toISOString();

  return saveDbToken({
    accessToken,
    refreshToken: null,
    expiresAt,
  });
}

export async function saveOAuthTokens(tokens: OAuthTokens): Promise<StoredPowerBiToken> {
  const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000).toISOString();
  return saveDbToken({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt,
  });
}
