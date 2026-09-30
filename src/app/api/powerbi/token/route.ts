import { NextRequest, NextResponse } from "next/server";
import { getStoredPowerBiToken, savePowerBiToken } from "@/lib/powerbiToken";
import { getDbProvider } from "@/lib/db";
import {
  getCurrentAccess,
  attachSessionCookie,
  newSessionSecret,
  readSessionSecret,
  touchSession,
  userFromAccessToken,
} from "@/lib/session";

export const dynamic = "force-dynamic";

// Returns the status of the *caller's own* session. The token is only ever
// returned to the browser that owns it (used by the Token Inspector).
export async function GET() {
  try {
    const provider = getDbProvider();
    const stored = await getStoredPowerBiToken();
    if (!stored) {
      return Response.json({ hasToken: false, accessToken: null, expiresAt: null, expired: true, user: null, dbProvider: provider });
    }
    void touchSession(await readSessionSecret()).catch(() => {});
    const current = await getCurrentAccess();
    if (!current) {
      // Account disabled by an admin.
      return Response.json({ hasToken: false, accessToken: null, expiresAt: null, expired: true, user: null, disabled: true, dbProvider: provider });
    }
    const expired = new Date(stored.expiresAt).getTime() - Date.now() < 5_000;
    // A session with a refresh token can silently renew, so it is still usable.
    const usable = !expired || Boolean(stored.refreshToken);
    return Response.json({
      hasToken: true,
      accessToken: stored.accessToken,
      expiresAt: stored.expiresAt,
      expired: !usable,
      canRefresh: Boolean(stored.refreshToken),
      user: stored.user || userFromAccessToken(stored.accessToken),
      access: current.access,
      isGuest: current.isGuest,
      dbProvider: provider,
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Failed to read token status" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { token?: string };
    const raw = typeof body.token === "string" ? body.token : "";
    const existing = await readSessionSecret();
    const secret = existing || newSessionSecret();
    const saved = await savePowerBiToken(raw, secret);
    const response = NextResponse.json({ expiresAt: saved.expiresAt, user: saved.user || null });
    if (!existing) attachSessionCookie(response, secret);
    return response;
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Failed to save token" }, { status: 400 });
  }
}
