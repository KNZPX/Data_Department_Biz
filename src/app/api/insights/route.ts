import { NextRequest } from "next/server";
import { getSupabaseClient, getDbChangeLogs } from "@/lib/db";
import { requirePage } from "@/lib/guard";
import { canModule } from "@/lib/access";

export const dynamic = "force-dynamic";

type Grain = "day" | "month" | "year";
const TZ_MS = 7 * 3600 * 1000; // Asia/Bangkok

function key(iso: string, grain: Grain) {
  const d = new Date(new Date(iso).getTime() + TZ_MS).toISOString();
  return grain === "year" ? d.slice(0, 4) : grain === "month" ? d.slice(0, 7) : d.slice(0, 10);
}
function nextKey(k: string, grain: Grain) {
  if (grain === "year") return String(Number(k) + 1);
  if (grain === "month") {
    const [y, m] = k.split("-").map(Number);
    return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  }
  const d = new Date(`${k}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
function buckets(first: string | null, grain: Grain) {
  const today = key(new Date().toISOString(), grain);
  if (!first) return [today];
  const out: string[] = [];
  for (let k = key(first, grain); k <= today && out.length < 400; k = nextKey(k, grain)) out.push(k);
  return out;
}

async function all<T>(table: string, cols: string): Promise<T[]> {
  const supabase = getSupabaseClient();
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(cols).order("id").range(from, from + 999);
    if (error) throw error;
    out.push(...((data || []) as T[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

type Item = { id: string; model_code: string; item_type: string; is_custom: boolean; is_deleted: boolean; created_at: string; deleted_at: string | null };
type Lic = { id: string; license_type: string | null; status: string; approved_at: string | null; revoked_at: string | null; site: string | null };

export async function GET(request: NextRequest) {
  const g = await requirePage("home");
  if (g.deny) return g.deny;
  const grain = (["day", "month", "year"].includes(request.nextUrl.searchParams.get("grain") || "") ? request.nextUrl.searchParams.get("grain") : "day") as Grain;
  const access = g.user.access;
  const supabase = getSupabaseClient();
  const out: Record<string, unknown> = { grain };

  // ------------------------------------------------------------ semantic models
  if (canModule(access, "home.semantic")) {
    const [items, models, logs] = await Promise.all([
      all<Item>("dax_dictionary_items", "id, model_code, item_type, is_custom, is_deleted, created_at, deleted_at"),
      supabase.from("dax_models").select("code, name, table_count, relationship_count, last_imported_at, last_imported_by, source_file").order("code"),
      supabase.from("change_log").select("changed_at, action").eq("entity_table", "dax_dictionary_items").eq("action", "update").order("changed_at").limit(10000),
    ]);
    const first = items.reduce<string | null>((m, i) => (!m || i.created_at < m ? i.created_at : m), null);
    const startDay = first ? key(first, "day") : null;
    const isMeasure = (i: Item) => i.item_type === "Measure" || i.is_custom;
    const live = items.filter((i) => !i.is_deleted);
    const atStart = items.filter((i) => startDay && key(i.created_at, "day") === startDay);

    const perModel = (models.data || []).map((m) => {
      const now = live.filter((i) => i.model_code === m.code);
      const base = atStart.filter((i) => i.model_code === m.code);
      const count = (arr: Item[], f: (i: Item) => boolean) => arr.filter(f).length;
      return {
        code: m.code,
        name: m.name,
        tables: m.table_count || 0,
        relationships: m.relationship_count || 0,
        lastImportedAt: m.last_imported_at,
        lastImportedBy: m.last_imported_by,
        sourceFile: m.source_file,
        measures: { now: count(now, (i) => i.item_type === "Measure" && !i.is_custom), start: count(base, (i) => i.item_type === "Measure" && !i.is_custom) },
        columns: { now: count(now, (i) => i.item_type !== "Measure" && !i.is_custom), start: count(base, (i) => i.item_type !== "Measure" && !i.is_custom) },
        custom: { now: count(now, (i) => i.is_custom), start: count(base, (i) => i.is_custom) },
      };
    });

    const keys = buckets(first, grain);
    const series = keys.map((k) => ({ key: k, added: 0, removed: 0, changed: 0, total: 0 }));
    const idx = new Map(keys.map((k, i) => [k, i]));
    for (const i of items) {
      const a = idx.get(key(i.created_at, grain));
      if (a !== undefined && isMeasure(i)) series[a].added++;
      if (i.deleted_at && isMeasure(i)) {
        const r = idx.get(key(i.deleted_at, grain));
        if (r !== undefined) series[r].removed++;
      }
    }
    for (const l of logs.data || []) {
      const c = idx.get(key(l.changed_at, grain));
      if (c !== undefined) series[c].changed++;
    }
    let running = 0;
    for (const s of series) {
      running += s.added - s.removed;
      s.total = running;
    }
    out.semantic = {
      startedAt: first,
      models: perModel,
      totals: {
        measures: live.filter((i) => i.item_type === "Measure" && !i.is_custom).length,
        measuresStart: atStart.filter((i) => i.item_type === "Measure" && !i.is_custom).length,
        columns: live.filter((i) => i.item_type !== "Measure" && !i.is_custom).length,
        columnsStart: atStart.filter((i) => i.item_type !== "Measure" && !i.is_custom).length,
        custom: live.filter((i) => i.is_custom).length,
        formulaChanges: (logs.data || []).length,
      },
      series,
      seriesNote: "Measures (model + team-written) added and removed per period; the line is the running total.",
    };
  }

  // ------------------------------------------------------------ licenses
  if (canModule(access, "home.license")) {
    const lic = await all<Lic>("powerbi_licenses", "id, license_type, status, approved_at, revoked_at, site");
    const kind = (l: Lic) => {
      const t = (l.license_type || "").toLowerCase();
      return t.includes("cancel") ? "Cancelled" : t.includes("pro") ? "Pro" : t.includes("premium") ? "Premium" : "Other";
    };
    const isActive = (l: Lic) => l.status === "active" && kind(l) !== "Cancelled";
    const first = lic.reduce<string | null>((m, l) => (l.approved_at && (!m || l.approved_at < m) ? l.approved_at : m), null);
    const startDay = first ? key(first, "day") : null;
    const activeAtStart = lic.filter((l) => l.approved_at && key(l.approved_at, "day") === startDay && isActive(l)).length;
    const keys = buckets(first, grain);
    const series = keys.map((k) => ({ key: k, added: 0, removed: 0, changed: 0, total: 0 }));
    const idx = new Map(keys.map((k, i) => [k, i]));
    for (const l of lic) {
      if (l.approved_at && kind(l) !== "Cancelled") {
        const a = idx.get(key(l.approved_at, grain));
        if (a !== undefined) series[a].added++;
      }
      if (l.revoked_at) {
        const r = idx.get(key(l.revoked_at, grain));
        if (r !== undefined) series[r].removed++;
      }
    }
    let running = 0;
    for (const s of series) {
      running += s.added - s.removed;
      s.total = running;
    }
    const active = lic.filter(isActive);
    const bySite = new Map<string, number>();
    for (const l of active) {
      const s = /^[A-Z]{3}$/.test(l.site || "") ? (l.site as string) : "Other";
      bySite.set(s, (bySite.get(s) || 0) + 1);
    }
    out.license = {
      startedAt: first,
      totals: {
        active: active.length,
        activeStart: activeAtStart,
        pro: active.filter((l) => kind(l) === "Pro").length,
        premium: active.filter((l) => kind(l) === "Premium").length,
        revoked: lic.filter((l) => l.status === "revoked").length,
        cancelled: lic.filter((l) => kind(l) === "Cancelled").length,
        all: lic.length,
      },
      bySite: Array.from(bySite.entries()).map(([site, n]) => ({ site, n })).sort((a, b) => b.n - a.n),
      series,
      seriesNote: "Licenses approved and revoked per period; the line is the running active total.",
    };
  }

  if (canModule(access, "home.activity")) {
    const logs = await getDbChangeLogs({ entityTable: "all", limit: 14 });
    out.activity = logs.map((l) => ({ id: l.id, action: l.action, summary: l.summary, by: l.changed_by, at: l.changed_at, table: l.entity_table }));
  }

  return Response.json(out);
}
