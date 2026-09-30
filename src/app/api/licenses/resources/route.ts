import { getSupabaseClient } from "@/lib/db";
import { requirePage } from "@/lib/guard";

export const dynamic = "force-dynamic";

// Workspaces and reports come from the cached Power BI catalog; datasets from the
// semantic models registered in the DAX dictionary.
export async function GET() {
  const g = await requirePage("licenses");
  if (g.deny) return g.deny;
  const supabase = getSupabaseClient();
  const items: { id: string; name: string; report_title: string | null; report_code: string | null; workspace_id: string; workspace_name: string; kind: string }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("powerbi_items")
      .select("id, name, report_title, report_code, workspace_id, workspace_name, kind")
      .order("workspace_name")
      .range(from, from + 999);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    items.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  const { data: models } = await supabase.from("dax_models").select("code, name, dataset_id");
  const ws = new Map<string, { id: string; name: string; reports: number }>();
  for (const i of items) {
    const w = ws.get(i.workspace_id) || { id: i.workspace_id, name: i.workspace_name, reports: 0 };
    w.reports++;
    ws.set(i.workspace_id, w);
  }
  return Response.json({
    workspaces: Array.from(ws.values()).sort((a, b) => a.name.localeCompare(b.name)),
    reports: items
      .filter((i) => i.kind === "report")
      .map((i) => ({ id: i.id, name: i.report_code ? `${i.report_code} ${i.report_title || i.name}` : i.name, workspace_id: i.workspace_id, workspace_name: i.workspace_name })),
    datasets: (models || []).map((m) => ({ id: m.dataset_id || m.code, name: `${m.code} ${m.name.replace(m.code, "").trim()}`.trim() })),
  });
}
