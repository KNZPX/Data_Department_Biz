import { NextRequest } from "next/server";
import { getSupabaseClient } from "@/lib/db";
import { requireModule, requirePage } from "@/lib/guard";

export const dynamic = "force-dynamic";

const PERMISSION_LEVELS: Record<string, string[]> = {
  workspace: ["Viewer", "Contributor", "Member", "Admin"],
  dataset: ["Read", "Build", "Write", "Owner"],
  report: ["Read", "Edit", "Reshare", "Owner"],
};

// GET ?email=... → one person's grants; no email → every grant (for the Permission view)
export async function GET(request: NextRequest) {
  const g = await requirePage("licenses");
  if (g.deny) return g.deny;
  const email = request.nextUrl.searchParams.get("email");
  const supabase = getSupabaseClient();
  const out: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    let q = supabase.from("powerbi_permissions").select("*").order("workspace_name").order("resource_type").range(from, from + 999);
    if (email) q = q.ilike("email", email);
    const { data, error } = await q;
    if (error) return Response.json({ error: error.message }, { status: 500 });
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return Response.json({ permissions: out, levels: PERMISSION_LEVELS });
}

// POST { action: "upsert" | "delete", ... }
export async function POST(request: NextRequest) {
  const g = await requireModule("licenses.edit");
  if (g.deny) return g.deny;
  const body = await request.json().catch(() => ({}));
  const supabase = getSupabaseClient();
  if (body.action === "delete") {
    const { error } = await supabase.from("powerbi_permissions").delete().eq("id", String(body.id || ""));
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ success: true });
  }
  if (body.action === "upsert") {
    const type = String(body.resource_type || "");
    const level = String(body.permission || "");
    if (!PERMISSION_LEVELS[type]?.includes(level)) return Response.json({ error: "Pick a valid permission level." }, { status: 400 });
    if (!body.email || !body.resource_id) return Response.json({ error: "Email and resource are required." }, { status: 400 });
    const { data, error } = await supabase
      .from("powerbi_permissions")
      .upsert(
        {
          email: String(body.email).toLowerCase(),
          resource_type: type,
          resource_id: String(body.resource_id),
          resource_name: body.resource_name || null,
          workspace_id: body.workspace_id || null,
          workspace_name: body.workspace_name || null,
          permission: level,
          granted_by: g.user.name,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email,resource_type,resource_id" }
      )
      .select("*")
      .single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ permission: data });
  }
  return Response.json({ error: "Unknown action." }, { status: 400 });
}
