import { NextRequest } from "next/server";
import { requireModule, requirePage } from "@/lib/guard";
import { getSupabaseClient, insertDbChangeLogs } from "@/lib/db";
import { eboId, normalizeEbo } from "@/lib/ebo";

export const dynamic = "force-dynamic";

// GET ?year=2027 → every unit's EBO plan that year.
export async function GET(request: NextRequest) {
  const g = await requirePage("ebo");
  if (g.deny) return g.deny;
  const year = parseInt(request.nextUrl.searchParams.get("year") || "", 10);
  if (!Number.isFinite(year)) return Response.json({ error: "Pick a year." }, { status: 400 });
  const { data, error } = await getSupabaseClient().from("ebo_plans").select("*").eq("year", year);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ plans: (data || []).map((r) => ({ ...r, data: normalizeEbo(r.data) })) });
}

// POST { year, unit, data, baseUpdatedAt?, force? } → save one unit's plan (409 if someone saved in between).
export async function POST(request: NextRequest) {
  const g = await requireModule("ebo.edit");
  if (g.deny) return g.deny;
  const body = (await request.json().catch(() => ({}))) as { year?: number; unit?: string; data?: unknown; baseUpdatedAt?: string | null; force?: boolean };
  const year = Number(body.year);
  const unit = String(body.unit || "").trim();
  if (!Number.isFinite(year) || !unit) return Response.json({ error: "Send year and unit." }, { status: 400 });
  const data = normalizeEbo(body.data);
  if (JSON.stringify(data).length > 300_000) return Response.json({ error: "That plan is too big to save." }, { status: 400 });
  const id = eboId(year, unit);
  const sb = getSupabaseClient();
  const { data: cur } = await sb.from("ebo_plans").select("*").eq("id", id).maybeSingle();
  if (cur && !body.force && body.baseUpdatedAt !== undefined && new Date(cur.updated_at).getTime() !== new Date(body.baseUpdatedAt || 0).getTime()) {
    return Response.json({ error: "conflict", conflict: { updatedBy: cur.updated_by, updatedAt: cur.updated_at, data: normalizeEbo(cur.data) } }, { status: 409 });
  }
  const now = new Date().toISOString();
  const who = g.user.name || g.user.email;
  const row = { id, year, unit, data, updated_by: who, updated_at: now, ...(cur ? {} : { created_at: now }) };
  const { error } = await sb.from("ebo_plans").upsert(row, { onConflict: "id" });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  await insertDbChangeLogs([
    {
      id: crypto.randomUUID(),
      entity_table: "ebo_plans",
      entity_id: id,
      action: cur ? "update" : "create",
      summary: `${cur ? "Updated" : "Started"} the ${year} EBO plan for ${unit}`,
      changed_by: who,
      changed_at: now,
      before: cur ? { data: cur.data } : null,
      after: { data },
    },
  ]).catch(() => {});
  return Response.json({ ok: true, updatedAt: now, updatedBy: who });
}
