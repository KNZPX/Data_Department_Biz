import { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { requireModule } from "@/lib/guard";
import { getSupabaseClient } from "@/lib/db";
import { getDaxModels, getDaxRows } from "@/lib/daxStore";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function fetchAll(table: string, model: string | null) {
  const supabase = getSupabaseClient();
  const out: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    let q = supabase.from(table).select("*").eq("is_deleted", false).order("id").range(from, from + 999);
    if (model) q = q.eq("model_code", model);
    const { data, error } = await q;
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

// GET ?model=PKT-D01|ALL → .xlsx with the whole semantic model as tables
export async function GET(request: NextRequest) {
  const g = await requireModule("dax.export");
  if (g.deny) return g.deny;
  const model = (request.nextUrl.searchParams.get("model") || "ALL").toUpperCase();
  const scope = model === "ALL" ? null : model;

  const [rows, models, tables, rels] = await Promise.all([
    getDaxRows(),
    getDaxModels(),
    fetchAll("dax_model_tables", scope),
    fetchAll("dax_model_relationships", scope),
  ]);
  const items = rows.filter((r) => !scope || r.model_code === scope);

  const wb = new ExcelJS.Workbook();
  wb.creator = g.user.name;
  wb.created = new Date();

  function sheet(name: string, columns: { header: string; key: string; width: number }[], data: Record<string, unknown>[]) {
    const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = columns;
    ws.addRows(data);
    const header = ws.getRow(1);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0E1B2E" } };
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
    ws.getColumn("expression")?.eachCell?.((c, i) => {
      if (i > 1) c.alignment = { wrapText: true, vertical: "top" };
    });
  }

  const itemCols = [
    { header: "Model", key: "model_code", width: 10 },
    { header: "Table", key: "table_name", width: 30 },
    { header: "Name", key: "name", width: 40 },
    { header: "Type", key: "item_type", width: 20 },
    { header: "Data type", key: "data_type", width: 12 },
    { header: "Format", key: "format_string", width: 16 },
    { header: "Display folder", key: "display_folder", width: 20 },
    { header: "Hidden", key: "is_hidden", width: 8 },
    { header: "Expression", key: "expression", width: 80 },
    { header: "Business definition", key: "business_definition", width: 40 },
    { header: "Math definition", key: "math_definition", width: 30 },
    { header: "Notes", key: "notes", width: 30 },
  ];
  const plain = (r: Record<string, unknown>) => ({ ...r, is_hidden: r.is_hidden ? "Yes" : "" });

  sheet("Measures", itemCols, items.filter((r) => !r.is_custom && r.item_type === "Measure").map(plain));
  sheet("Columns", itemCols, items.filter((r) => !r.is_custom && r.item_type !== "Measure").map(plain));
  sheet(
    "Team DAX",
    itemCols,
    rows.filter((r) => r.is_custom && (!scope || r.model_code === scope || r.model_code === "ALL")).map(plain)
  );
  sheet(
    "Tables",
    [
      { header: "Model", key: "model_code", width: 10 },
      { header: "Table", key: "name", width: 34 },
      { header: "Source", key: "source_type", width: 12 },
      { header: "Measures", key: "measure_count", width: 10 },
      { header: "Columns", key: "column_count", width: 10 },
      { header: "Hidden", key: "is_hidden", width: 8 },
      { header: "Source expression (M / DAX)", key: "expression", width: 90 },
    ],
    tables.map((t) => ({ ...t, expression: t.source_expression, is_hidden: t.is_hidden ? "Yes" : "" }))
  );
  sheet(
    "Relationships",
    [
      { header: "Model", key: "model_code", width: 10 },
      { header: "From table", key: "from_table", width: 30 },
      { header: "From column", key: "from_column", width: 26 },
      { header: "To table", key: "to_table", width: 30 },
      { header: "To column", key: "to_column", width: 26 },
      { header: "Cardinality", key: "card", width: 14 },
      { header: "Cross filter", key: "cross_filter", width: 16 },
      { header: "Active", key: "active", width: 8 },
    ],
    rels.map((r) => ({ ...r, card: `${r.from_cardinality || "many"} : ${r.to_cardinality || "one"}`, active: r.is_active === false ? "No" : "Yes" }))
  );
  sheet(
    "Models",
    [
      { header: "Code", key: "code", width: 10 },
      { header: "Name", key: "name", width: 40 },
      { header: "Measures", key: "measure_count", width: 10 },
      { header: "Columns", key: "column_count", width: 10 },
      { header: "Tables", key: "table_count", width: 10 },
      { header: "Relationships", key: "relationship_count", width: 14 },
      { header: "Last .bim import", key: "last_imported_at", width: 22 },
      { header: "Imported by", key: "last_imported_by", width: 24 },
      { header: "Source file", key: "source_file", width: 30 },
    ],
    models.filter((m) => !scope || m.code === scope) as unknown as Record<string, unknown>[]
  );

  const buf = await wb.xlsx.writeBuffer();
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${model}_semantic_model_${stamp}.xlsx"`,
    },
  });
}
