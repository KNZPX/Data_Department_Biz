import { NextRequest } from "next/server";
import { getCurrentAccess } from "@/lib/session";
import { listNotifications, markRead } from "@/lib/collab";

export const dynamic = "force-dynamic";

// The signed-in person's own notifications (mentions, comments on watched items, reviews, formula changes).
export async function GET() {
  const me = await getCurrentAccess();
  if (!me) return Response.json({ error: "Sign in first." }, { status: 401 });
  try {
    const items = await listNotifications(me.email);
    return Response.json({ items, unread: items.filter((n) => !n.readAt).length });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const me = await getCurrentAccess();
  if (!me) return Response.json({ error: "Sign in first." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { ids?: string[]; all?: boolean };
  try {
    await markRead(me.email, body.all ? "all" : Array.isArray(body.ids) ? body.ids.map(String) : []);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
