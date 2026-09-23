import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { normalizeLicense, type PowerBiLicense } from "@/lib/licenseTypes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawLicenses: Partial<PowerBiLicense>[] = body.licenses || [];
    const licenses = rawLicenses.map(normalizeLicense);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Power BI Portal - Standalone";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet("Power BI Licenses 2026", {
      views: [{ showGridLines: true, state: "frozen", ySplit: 2 }],
    });

    const categoryRow = worksheet.getRow(1);
    categoryRow.height = 24;

    worksheet.mergeCells("A1:P1");
    worksheet.getCell("A1").value = "Employee & Organizational Profile";
    
    worksheet.mergeCells("Q1:S1");
    worksheet.getCell("Q1").value = "Creator";

    worksheet.mergeCells("T1:V1");
    worksheet.getCell("T1").value = "License & Capacity";

    worksheet.mergeCells("W1:AA1");
    worksheet.getCell("W1").value = "Phuket";

    worksheet.mergeCells("AB1:AF1");
    worksheet.getCell("AB1").value = "Site";

    categoryRow.eachCell({ includeEmpty: false }, (cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "0F172A" },
      };
      cell.font = {
        name: "Segoe UI",
        bold: true,
        color: { argb: "FFFFFF" },
        size: 11,
      };
      cell.alignment = { vertical: "middle", horizontal: "center" };
    });

    const headers = [
      "Site", "Business Unit Code", "Person ID", "User ID", "Name (TH)",
      "Position Name (EN)", "Department Code", "Department Name (EN)", "Employee Class",
      "Full-time/Part-time", "Display Name", "Ad Account", "Type", "Department Name",
      "Dept group", "HOD 3Site", "Person ID", "Name (TH)", "Position Name (EN)",
      "Power BI Premium per Capacity", "Power BI Pro License", "License_type",
      "BPK BI Phuket Executive Group", "BPK BI Phuket Marketing Group", "BPK BI Phuket HOD Group",
      "BPK BI Phuket STG Group", "BPK BI Phuket Admin Group", "BPK BI HOD Group",
      "BSI BI HOD Group", "DBK BI HOD Group", "BPK BI Quality Group", "BSI BI Quality Group",
    ];

    const colWidths = [
      12, 18, 14, 14, 28, 26, 16, 26, 16, 18, 28, 30, 12, 24, 18, 14,
      14, 26, 26, 28, 22, 20, 28, 28, 26, 26, 26, 22, 22, 22, 24, 24,
    ];

    const headerRow = worksheet.getRow(2);
    headerRow.height = 30;
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      worksheet.getColumn(i + 1).width = colWidths[i] || 18;

      let bgColor = "334155";
      if (i >= 16 && i <= 18) bgColor = "1E3A8A";
      else if (i >= 19 && i <= 21) bgColor = "065F46";
      else if (i >= 22 && i <= 26) bgColor = "701A75";
      else if (i >= 27 && i <= 31) bgColor = "4C1D95";

      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: bgColor },
      };
      cell.font = {
        name: "Segoe UI",
        bold: true,
        color: { argb: "FFFFFF" },
        size: 10,
      };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      cell.border = {
        top: { style: "thin", color: { argb: "CBD5E1" } },
        bottom: { style: "medium", color: { argb: "0F172A" } },
        left: { style: "thin", color: { argb: "475569" } },
        right: { style: "thin", color: { argb: "475569" } },
      };
    });

    licenses.forEach((item, idx) => {
      const row = worksheet.addRow([
        item.site || "PKT",
        item.business_unit_code || "",
        item.person_id || "",
        item.user_id || "",
        item.name_th || "",
        item.position_en || "",
        item.department_code || "",
        item.department_en || "",
        item.employee_class || "",
        item.employment_type || "",
        item.display_name || "",
        item.ad_account || "",
        item.user_type || "",
        item.department_name || "",
        item.dept_group || "",
        item.hod_3site || "",
        item.creator_person_id || "",
        item.creator_name_th || "",
        item.creator_position_en || "",
        item.pbi_premium_capacity || "",
        item.pbi_pro_license || "",
        item.license_type || "Power BI Pro",
        item.bpk_phuket_executive ? "1" : "",
        item.bpk_phuket_marketing ? "1" : "",
        item.bpk_phuket_hod ? "1" : "",
        item.bpk_phuket_stg ? "1" : "",
        item.bpk_phuket_admin ? "1" : "",
        item.bpk_hod ? "1" : "",
        item.bsi_hod ? "1" : "",
        item.dbk_hod ? "1" : "",
        item.bpk_quality ? "1" : "",
        item.bsi_quality ? "1" : "",
      ]);

      row.height = 22;
      const isEven = idx % 2 === 0;

      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.font = { name: "Segoe UI", size: 10 };
        const isCenter = [1, 2, 3, 4, 7, 9, 10, 13, 16, 17, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32].includes(colNumber);
        cell.alignment = {
          vertical: "middle",
          horizontal: isCenter ? "center" : "left",
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: isEven ? "FFFFFF" : "F8FAFC" },
        };
        cell.border = {
          bottom: { style: "thin", color: { argb: "E2E8F0" } },
          right: { style: "thin", color: { argb: "F1F5F9" } },
        };
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="2026_List_Power_BI_License_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Excel export error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to export Excel file" },
      { status: 500 }
    );
  }
}
