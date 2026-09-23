import { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import type { PowerBiItem, PowerBiKind } from "@/lib/powerbiTypes";

export const dynamic = "force-dynamic";

function safeFileNamePart(value: string) {
  return (value || "powerbi").replace(/[\\/:*?"<>|]/g, "_").trim();
}

const HEADER_FONT = { bold: true };

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { kind?: PowerBiKind; items?: PowerBiItem[] };
    const kind = body.kind === "dashboard" ? "dashboard" : "report";
    const items = Array.isArray(body.items) ? body.items : [];

    const workbook = new ExcelJS.Workbook();
    const sheetName = kind === "dashboard" ? "Dashboards" : "Reports";
    const sheet = workbook.addWorksheet(sheetName);

    sheet.columns = [
      { header: "Workspace", key: "workspaceName", width: 32 },
      { header: "Code", key: "reportCode", width: 20 },
      { header: "Title", key: "reportTitle", width: 48 },
      { header: "Responsible Person", key: "responsibleUser", width: 28 },
      { header: "Last Publish Date", key: "lastPublish", width: 24 },
      { header: "Full name", key: "name", width: 48 },
      { header: "Web URL", key: "webUrl", width: 60 },
    ];
    sheet.getRow(1).font = HEADER_FONT;

    for (const item of items) {
      sheet.addRow({
        workspaceName: item.workspaceName,
        reportCode: item.reportCode,
        reportTitle: item.reportTitle,
        responsibleUser: item.responsibleUser || "-",
        lastPublish: item.lastPublish ? new Date(item.lastPublish).toLocaleString("th-TH") : "-",
        name: item.name,
        webUrl: item.webUrl,
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `powerbi-${kind}s-${safeFileNamePart(new Date().toISOString().slice(0, 10))}.xlsx`;
    const encoded = encodeURIComponent(fileName);
    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encoded}`,
      },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Export failed" }, { status: 500 });
  }
}
