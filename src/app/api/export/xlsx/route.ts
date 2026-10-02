import { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { getCurrentAccess } from "@/lib/session";

export const dynamic = "force-dynamic";

type Col = { header: string; key: string; width?: number; numFmt?: string };
type Sheet = { name: string; columns: Col[]; rows: Record<string, string | number | null>[]; levels?: number[]; bold?: boolean[] };

// POST { fileName, sheets } → .xlsx. Pages send the rows they show (already
// formatted the way the person sees them), so the file matches the screen.
export async function POST(request: NextRequest) {
  const me = await getCurrentAccess();
  if (!me) return Response.json({ error: "Sign in first." }, { status: 401 });
  const g = { user: me };
  let body: { fileName?: string; title?: string; sheets?: Sheet[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send JSON." }, { status: 400 });
  }
  const sheets = (body.sheets || []).slice(0, 10);
  if (!sheets.length) return Response.json({ error: "Nothing to export." }, { status: 400 });

  const wb = new ExcelJS.Workbook();
  wb.creator = g.user.name || g.user.email;
  wb.created = new Date();
  for (const sh of sheets) {
    const ws = wb.addWorksheet(String(sh.name || "Sheet").slice(0, 31).replace(/[\\/?*[\]:]/g, " "), {
      views: [{ state: "frozen", ySplit: 1, xSplit: 1 }],
      properties: { outlineLevelRow: 6 },
    });
    ws.columns = sh.columns.slice(0, 60).map((c) => ({ header: c.header, key: c.key, width: c.width || 14, style: c.numFmt ? { numFmt: c.numFmt } : undefined }));
    sh.rows.slice(0, 20000).forEach((r, i) => {
      const row = ws.addRow(r);
      const lvl = sh.levels?.[i] || 0;
      if (lvl) {
        row.outlineLevel = Math.min(7, lvl);
        row.getCell(1).alignment = { indent: Math.min(15, lvl * 2) };
      }
      if (sh.bold?.[i]) row.font = { bold: true };
    });
    const header = ws.getRow(1);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } };
    header.alignment = { vertical: "middle", wrapText: true };
    header.height = 30;
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sh.columns.length } };
  }
  const buf = await wb.xlsx.writeBuffer();
  const name = String(body.fileName || "target-plan").replace(/[^\w.-]+/g, "_").slice(0, 80);
  return new Response(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}.xlsx"`,
    },
  });
}
