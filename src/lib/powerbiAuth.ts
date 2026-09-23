import { createHash, randomBytes } from "node:crypto";

const AUTHORITY_BASE = "https://login.microsoftonline.com";
const TENANT_SEGMENT = process.env.AZURE_TENANT_ID || "organizations";
const AUTHORIZE_ENDPOINT = `${AUTHORITY_BASE}/${TENANT_SEGMENT}/oauth2/v2.0/authorize`;
const TOKEN_ENDPOINT = `${AUTHORITY_BASE}/${TENANT_SEGMENT}/oauth2/v2.0/token`;

const SCOPES = [
  "openid",
  "profile",
  "offline_access",
  "https://analysis.windows.net/powerbi/api/Workspace.Read.All",
  "https://analysis.windows.net/powerbi/api/Report.Read.All",
  "https://analysis.windows.net/powerbi/api/Dashboard.Read.All",
  "https://analysis.windows.net/powerbi/api/Dataset.Read.All",
  "https://analysis.windows.net/powerbi/api/Item.Read.All",
  "https://analysis.windows.net/powerbi/api/ItemMetadata.Read.All",
].join(" ");

function requireClientId(): string {
  const clientId = process.env.AZURE_CLIENT_ID;
  if (!clientId) {
    throw new Error("Missing AZURE_CLIENT_ID. Please set AZURE_CLIENT_ID in your .env.local file.");
  }
  return clientId;
}

function base64url(input: Buffer): string {
  return input.toString("base64url");
}

export function generateCodeVerifier(): string {
  return base64url(randomBytes(32));
}

export function generateState(): string {
  return base64url(randomBytes(16));
}

export function codeChallengeFromVerifier(verifier: string): string {
  return base64url(createHash("sha256").update(verifier).digest());
}

export function buildAuthorizeUrl(opts: { redirectUri: string; state: string; codeChallenge: string }): string {
  const params = new URLSearchParams({
    client_id: requireClientId(),
    response_type: "code",
    redirect_uri: opts.redirectUri,
    response_mode: "query",
    scope: SCOPES,
    state: opts.state,
    code_challenge: opts.codeChallenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return `${AUTHORIZE_ENDPOINT}?${params.toString()}`;
}

export type OAuthTokens = { accessToken: string; refreshToken: string; expiresIn: number };

async function requestTokens(body: URLSearchParams): Promise<OAuthTokens> {
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  if (clientSecret) {
    body.set("client_secret", clientSecret);
  }

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`Azure AD token request failed (${res.status}): ${detail.slice(0, 500)}`);
  }
  const json = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
  if (!json.refresh_token) {
    throw new Error("Azure AD didn't return a refresh token. Check that the app registration requests the offline_access scope.");
  }
  return { accessToken: json.access_token, refreshToken: json.refresh_token, expiresIn: json.expires_in };
}

export async function exchangeCodeForTokens(opts: { code: string; codeVerifier: string; redirectUri: string }): Promise<OAuthTokens> {
  return requestTokens(
    new URLSearchParams({
      client_id: requireClientId(),
      grant_type: "authorization_code",
      code: opts.code,
      redirect_uri: opts.redirectUri,
      code_verifier: opts.codeVerifier,
      scope: SCOPES,
    }),
  );
}

export async function refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
  return requestTokens(
    new URLSearchParams({
      client_id: requireClientId(),
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: SCOPES,
    }),
  );
}
