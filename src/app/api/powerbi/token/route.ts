import { NextRequest } from "next/server";
import { getStoredPowerBiToken, savePowerBiToken } from "@/lib/powerbiToken";

import { getDbProvider } from "@/lib/db";

export const dynamic = "force-dynamic";

function extractUserFromToken(token: string) {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const json = Buffer.from(parts[1], "base64").toString("utf-8");
    const payload = JSON.parse(json);
    return {
      name: (payload.name as string) || "Microsoft User",
      email: (payload.upn as string) || (payload.unique_name as string) || (payload.email as string) || "",
    };
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const provider = getDbProvider();
    const stored = await getStoredPowerBiToken();
    if (!stored) {
      return Response.json({
        hasToken: false,
        accessToken: null,
        expiresAt: null,
        expired: true,
        user: null,
        dbProvider: provider,
      });
    }
    const expired = new Date(stored.expiresAt).getTime() - Date.now() < 5_000;
    const user = extractUserFromToken(stored.accessToken);
    return Response.json({
      hasToken: true,
      accessToken: stored.accessToken,
      expiresAt: stored.expiresAt,
      expired,
      user,
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
    const saved = await savePowerBiToken(raw);
    return Response.json({ expiresAt: saved.expiresAt });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Failed to save token" }, { status: 400 });
  }
}
