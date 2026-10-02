import { NextRequest } from "next/server";
import { requireModule, requirePage } from "@/lib/guard";
import { addComment, deleteComment, getItemCollab, listPeople, setReview, setWatching } from "@/lib/collab";

export const dynamic = "force-dynamic";

// Comments, review status and watching for one DAX item.
export async function GET(request: NextRequest) {
  const g = await requirePage("dax");
  if (g.deny) return g.deny;
  const sp = request.nextUrl.searchParams;
  try {
    if (sp.get("people") === "1") return Response.json({ people: await listPeople() });
    const itemId = sp.get("item");
    if (!itemId) return Response.json({ error: "Missing item." }, { status: 400 });
    return Response.json(await getItemCollab(itemId, g.user.email));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const g = await requirePage("dax");
  if (g.deny) return g.deny;
  const me = { email: g.user.email, name: g.user.name || g.user.email };
  let body: { action?: string; itemId?: string; itemName?: string; modelCode?: string | null; text?: string; id?: string; status?: string; on?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send JSON." }, { status: 400 });
  }
  const itemId = String(body.itemId || "");
  const itemName = String(body.itemName || itemId).slice(0, 200);
  try {
    switch (body.action) {
      case "comment": {
        const text = String(body.text || "").trim();
        if (!itemId || !text) return Response.json({ error: "Write something first." }, { status: 400 });
        if (text.length > 4000) return Response.json({ error: "Keep it under 4,000 characters." }, { status: 400 });
        const row = await addComment({ itemId, itemName, modelCode: body.modelCode || null, body: text, me });
        return Response.json({ ok: true, id: row.id });
      }
      case "delete_comment": {
        await deleteComment(String(body.id || ""), me, g.user.access.role === "admin");
        return Response.json({ ok: true });
      }
      case "review": {
        // Reviewing a definition is an edit, so it needs dax.edit.
        const e = await requireModule("dax.edit");
        if (e.deny) return e.deny;
        if (body.status !== "reviewed" && body.status !== "draft") return Response.json({ error: "Unknown status." }, { status: 400 });
        const review = await setReview({ itemId, itemName, modelCode: body.modelCode || null, status: body.status, me });
        return Response.json({ ok: true, review });
      }
      case "watch": {
        await setWatching(itemId, me.email, Boolean(body.on));
        return Response.json({ ok: true });
      }
      default:
        return Response.json({ error: "Unknown action." }, { status: 400 });
    }
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
