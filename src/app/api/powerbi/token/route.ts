import { NextRequest } from "next/server";
import { getStoredPowerBiToken, savePowerBiToken } from "@/lib/powerbiToken";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const stored = await getStoredPowerBiToken();
    if (!stored) {
      return Response.json({ hasToken: false, accessToken: null, expiresAt: null, expired: true });
    }
    const expired = new Date(stored.expiresAt).getTime() - Date.now() < 5_000;
    return Response.json({ hasToken: true, accessToken: stored.accessToken, expiresAt: stored.expiresAt, expired });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Failed to read token status" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { token?: string };
    const raw = typeof body.token === "string" ? body.token : "";
    const saved = await savePowerBiToken(raw);
    return Response.json({ expiresAt: saved.expiresAt });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Failed to save token" }, { status: 400 });
  }
}
