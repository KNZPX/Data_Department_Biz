import { requireModule } from "@/lib/guard";
import { getCurrentAccess } from "@/lib/session";
import { getDbChangeLogs, isRestorable, restoreChangeLog } from "@/lib/db";
import { canModule } from "@/lib/access";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Which permission lets someone undo a change in each area.
const RESTORE_MODULE: Record<string, string> = {
  custom_dax_items: "dax.edit",
  dax_dictionary_items: "dax.edit",
  dax_annotations: "dax.edit",
  powerbi_licenses: "licenses.edit",
  whiteboard_boards: "whiteboard.edit",
  target_scenarios: "target.edit",
};

export async function GET(request: NextRequest) {
  const me = await getCurrentAccess();
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  try {
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get("itemId") || undefined;
    const entityTable = searchParams.get("table") || undefined;
    const limit = Math.min(parseInt(searchParams.get("limit") || "150", 10) || 150, 1000);
    const logs = await getDbChangeLogs({ itemId, entityTable, limit });
    return NextResponse.json({
      logs: logs.map((l) => {
        const mod = RESTORE_MODULE[l.entity_table];
        return { ...l, restorable: isRestorable(l as never), canRestore: Boolean(mod && canModule(me.access, mod)) };
      }),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch change logs" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const me = await getCurrentAccess();
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  try {
    const { action, id } = await request.json();
    if (action !== "restore" || !id) return NextResponse.json({ error: "Send { action: 'restore', id }." }, { status: 400 });
    const log = (await getDbChangeLogs({ limit: 1000 })).find((l) => l.id === id);
    if (!log) return NextResponse.json({ error: "That entry isn't in the activity log." }, { status: 404 });
    const mod = RESTORE_MODULE[log.entity_table];
    if (!mod) return NextResponse.json({ error: "This kind of change can't be restored." }, { status: 400 });
    const g = await requireModule(mod);
    if (g.deny) return g.deny;
    if (!isRestorable(log as never)) return NextResponse.json({ error: "Already restored, or there's nothing to put back." }, { status: 409 });
    const result = await restoreChangeLog(id, me.name || me.email);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to restore" }, { status: 500 });
  }
}
