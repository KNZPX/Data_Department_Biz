import { getPowerBiChangeLogs } from "@/lib/powerbiSync";
import { restoreChangeLog } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get("itemId") || undefined;
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 500) : 150;

    const logs = await getPowerBiChangeLogs({ itemId, limit });
    return NextResponse.json({ logs });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch change logs" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, id, restoredBy } = body;

    if (action === "restore") {
      if (!id) {
        return NextResponse.json({ error: "Log ID is required" }, { status: 400 });
      }
      const result = await restoreChangeLog(id, restoredBy || "Admin");
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to process restore request" },
      { status: 500 }
    );
  }
}
