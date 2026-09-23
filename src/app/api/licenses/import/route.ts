import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { normalizeLicense, type LicenseInput } from "@/lib/licenseTypes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanString(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "object" && val !== null) {
    if ("result" in val) {
      const res = (val as { result?: unknown }).result;
      if (res && typeof res === "object" && "error" in res) return "";
      return cleanString(res);
    }
    if ("text" in val && typeof (val as { text?: unknown }).text === "string") {
      return String((val as { text?: unknown }).text || "").trim();
    }
  }
  return String(val).trim();
}

function parseBoolean(val: unknown): boolean {
  if (typeof val === "boolean") return val;
  const s = cleanString(val).toLowerCase();
  return ["/", "✓", "1", "true", "yes", "y", "active"].includes(s);
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(buffer as any);

    let worksheet = workbook.worksheets.find((ws) =>
      /bpk\+bsi\+dbk|bpk.*bsi.*dbk/i.test(ws.name)
    ) || workbook.worksheets.find((ws) =>
      /license|2026|powers*bi/i.test(ws.name)
    ) || workbook.worksheets[0];

    if (!worksheet) {
      worksheet = workbook.worksheets[0];
    }
    if (!worksheet) {
      return NextResponse.json({ error: "The Excel file contains no worksheets." }, { status: 400 });
    }

    let headerRowIdx = 1;
    let foundHeader = false;

    for (let r = 1; r <= Math.min(15, worksheet.rowCount); r++) {
      const row = worksheet.getRow(r);
      const cellTexts: string[] = [];
      row.eachCell((c) => cellTexts.push(cleanString(c.value).toLowerCase()));

      const hasSite = cellTexts.some((t) => t === "site" || t.includes("โรงพยาบาล"));
      const hasAdAccount = cellTexts.some((t) => t.includes("ad account") || t.includes("email") || t.includes("upn"));
      const hasPerson = cellTexts.some((t) => t.includes("person id") || t.includes("user id") || t.includes("name"));
      const hasLicense = cellTexts.some((t) => t.includes("license") || t.includes("capacity"));

      if ((hasSite && hasAdAccount) || (hasSite && hasPerson) || (hasAdAccount && hasLicense) || (hasPerson && hasLicense)) {
        headerRowIdx = r;
        foundHeader = true;
        break;
      }
    }

    if (!foundHeader) {
      headerRowIdx = 1;
    }

    const colMap: Record<string, number> = {};
    const headerRow = worksheet.getRow(headerRowIdx);
    const prevRow = headerRowIdx > 1 ? worksheet.getRow(headerRowIdx - 1) : null;

    headerRow.eachCell((cell, colNumber) => {
      const text = cleanString(cell.value).toLowerCase().replace(/\s+/g, " ");
      const prevText = prevRow ? cleanString(prevRow.getCell(colNumber).value).toLowerCase() : "";
      const isCreatorSection = prevText.includes("creator") || (colNumber >= 17 && colNumber <= 19);

      if (text === "site" || text.includes("hospital")) {
        colMap.site = colNumber;
      } else if (text.includes("business unit")) {
        colMap.business_unit_code = colNumber;
      } else if (text.includes("person id") || text.includes("staff id") || text.includes("รหัสพนักงาน")) {
        if (isCreatorSection || colMap.person_id) {
          colMap.creator_person_id = colNumber;
        } else {
          colMap.person_id = colNumber;
        }
      } else if (text.includes("user id") || text === "uid") {
        colMap.user_id = colNumber;
      } else if (text.includes("name (th)") || text.includes("ชื่อ (ไทย)") || text.includes("name th")) {
        if (isCreatorSection || colMap.name_th) {
          colMap.creator_name_th = colNumber;
        } else {
          colMap.name_th = colNumber;
        }
      } else if (text.includes("position name (en)") || text.includes("position") || text.includes("ตำแหน่ง")) {
        if (isCreatorSection || colMap.position_en) {
          colMap.creator_position_en = colNumber;
        } else {
          colMap.position_en = colNumber;
        }
      } else if (text.includes("department code") || text.includes("dept code")) {
        colMap.department_code = colNumber;
      } else if (text.includes("department name (en)") || text.includes("dept name (en)")) {
        colMap.department_en = colNumber;
      } else if (text.includes("employee class") || text.includes("class")) {
        colMap.employee_class = colNumber;
      } else if (text.includes("full-time") || text.includes("part-time") || text.includes("employment")) {
        colMap.employment_type = colNumber;
      } else if (text.includes("display name") || text === "name" || text === "ชื่อ") {
        colMap.display_name = colNumber;
      } else if (text.includes("ad account") || text.includes("email") || text.includes("upn") || text.includes("mail")) {
        colMap.ad_account = colNumber;
      } else if (text === "type" || text === "user type") {
        colMap.user_type = colNumber;
      } else if (text === "department name" || text === "department" || text.includes("แผนก")) {
        colMap.department_name = colNumber;
      } else if (text.includes("dept group") || text.includes("department group")) {
        colMap.dept_group = colNumber;
      } else if (text.includes("hod 3site") || text.includes("hod")) {
        colMap.hod_3site = colNumber;
      } else if (text.includes("premium per capacity") || text.includes("capacity")) {
        colMap.pbi_premium_capacity = colNumber;
      } else if (text.includes("pro license")) {
        colMap.pbi_pro_license = colNumber;
      } else if (text.includes("license_type") || text.includes("license type")) {
        colMap.license_type = colNumber;
      }
      else if (text.includes("phuket executive")) {
        colMap.bpk_phuket_executive = colNumber;
      } else if (text.includes("phuket marketing")) {
        colMap.bpk_phuket_marketing = colNumber;
      } else if (text.includes("phuket hod")) {
        colMap.bpk_phuket_hod = colNumber;
      } else if (text.includes("phuket stg")) {
        colMap.bpk_phuket_stg = colNumber;
      } else if (text.includes("phuket admin")) {
        colMap.bpk_phuket_admin = colNumber;
      } else if (text.includes("bpk bi hod") || text === "bpk hod") {
        colMap.bpk_hod = colNumber;
      } else if (text.includes("bsi bi hod") || text === "bsi hod") {
        colMap.bsi_hod = colNumber;
      } else if (text.includes("dbk bi hod") || text === "dbk hod") {
        colMap.dbk_hod = colNumber;
      } else if (text.includes("bpk bi quality") || text.includes("bpk quality")) {
        colMap.bpk_quality = colNumber;
      } else if (text.includes("bsi bi quality") || text.includes("bsi quality")) {
        colMap.bsi_quality = colNumber;
      }
    });

    if (!colMap.ad_account && !colMap.name_th && !colMap.display_name) {
      colMap.site = 1;
      colMap.business_unit_code = 2;
      colMap.person_id = 3;
      colMap.user_id = 4;
      colMap.name_th = 5;
      colMap.position_en = 6;
      colMap.department_code = 7;
      colMap.department_en = 8;
      colMap.employee_class = 9;
      colMap.employment_type = 10;
      colMap.display_name = 11;
      colMap.ad_account = 12;
      colMap.user_type = 13;
      colMap.department_name = 14;
      colMap.dept_group = 15;
      colMap.hod_3site = 16;
      colMap.creator_person_id = 17;
      colMap.creator_name_th = 18;
      colMap.creator_position_en = 19;
      colMap.pbi_premium_capacity = 20;
      colMap.pbi_pro_license = 21;
      colMap.license_type = 22;
      colMap.bpk_phuket_executive = 23;
      colMap.bpk_phuket_marketing = 24;
      colMap.bpk_phuket_hod = 25;
      colMap.bpk_phuket_stg = 26;
      colMap.bpk_phuket_admin = 27;
      colMap.bpk_hod = 28;
      colMap.bsi_hod = 29;
      colMap.dbk_hod = 30;
      colMap.bpk_quality = 31;
      colMap.bsi_quality = 32;
    }

    const rows: LicenseInput[] = [];

    for (let r = headerRowIdx + 1; r <= worksheet.rowCount; r++) {
      const row = worksheet.getRow(r);
      const ad_account = colMap.ad_account ? cleanString(row.getCell(colMap.ad_account).value) : "";
      const display_name = colMap.display_name ? cleanString(row.getCell(colMap.display_name).value) : "";
      const name_th = colMap.name_th ? cleanString(row.getCell(colMap.name_th).value) : "";

      if (!ad_account && !display_name && !name_th) continue;

      const rawLicense = colMap.license_type ? cleanString(row.getCell(colMap.license_type).value) : "";
      const proLicense = colMap.pbi_pro_license ? cleanString(row.getCell(colMap.pbi_pro_license).value) : "";
      const premiumCap = colMap.pbi_premium_capacity ? cleanString(row.getCell(colMap.pbi_premium_capacity).value) : "";

      let resolvedLicenseType = rawLicense;
      if (!resolvedLicenseType) {
        if (proLicense && !proLicense.toLowerCase().includes("no")) {
          resolvedLicenseType = "Power BI Pro";
        } else if (premiumCap && !premiumCap.toLowerCase().includes("no")) {
          resolvedLicenseType = "Power BI Premium per Capacity";
        } else {
          resolvedLicenseType = "Power BI Pro";
        }
      }

      const input: LicenseInput = normalizeLicense({
        site: colMap.site ? cleanString(row.getCell(colMap.site).value) : "PKT",
        business_unit_code: colMap.business_unit_code ? cleanString(row.getCell(colMap.business_unit_code).value) : "",
        person_id: colMap.person_id ? cleanString(row.getCell(colMap.person_id).value) : "",
        user_id: colMap.user_id ? cleanString(row.getCell(colMap.user_id).value) : "",
        name_th: name_th || display_name,
        position_en: colMap.position_en ? cleanString(row.getCell(colMap.position_en).value) : "",
        department_code: colMap.department_code ? cleanString(row.getCell(colMap.department_code).value) : "",
        department_en: colMap.department_en ? cleanString(row.getCell(colMap.department_en).value) : "",
        employee_class: colMap.employee_class ? cleanString(row.getCell(colMap.employee_class).value) : "",
        employment_type: colMap.employment_type ? cleanString(row.getCell(colMap.employment_type).value) : "",
        display_name: display_name || name_th,
        ad_account: ad_account,
        user_type: colMap.user_type ? cleanString(row.getCell(colMap.user_type).value) : "",
        department_name: colMap.department_name ? cleanString(row.getCell(colMap.department_name).value) : "",
        dept_group: colMap.dept_group ? cleanString(row.getCell(colMap.dept_group).value) : "",
        hod_3site: colMap.hod_3site ? cleanString(row.getCell(colMap.hod_3site).value) : "",
        creator_person_id: colMap.creator_person_id ? cleanString(row.getCell(colMap.creator_person_id).value) : "",
        creator_name_th: colMap.creator_name_th ? cleanString(row.getCell(colMap.creator_name_th).value) : "",
        creator_position_en: colMap.creator_position_en ? cleanString(row.getCell(colMap.creator_position_en).value) : "",
        pbi_premium_capacity: premiumCap,
        pbi_pro_license: proLicense,
        license_type: resolvedLicenseType,
        bpk_phuket_executive: colMap.bpk_phuket_executive ? parseBoolean(row.getCell(colMap.bpk_phuket_executive).value) : false,
        bpk_phuket_marketing: colMap.bpk_phuket_marketing ? parseBoolean(row.getCell(colMap.bpk_phuket_marketing).value) : false,
        bpk_phuket_hod: colMap.bpk_phuket_hod ? parseBoolean(row.getCell(colMap.bpk_phuket_hod).value) : false,
        bpk_phuket_stg: colMap.bpk_phuket_stg ? parseBoolean(row.getCell(colMap.bpk_phuket_stg).value) : false,
        bpk_phuket_admin: colMap.bpk_phuket_admin ? parseBoolean(row.getCell(colMap.bpk_phuket_admin).value) : false,
        bpk_hod: colMap.bpk_hod ? parseBoolean(row.getCell(colMap.bpk_hod).value) : false,
        bsi_hod: colMap.bsi_hod ? parseBoolean(row.getCell(colMap.bsi_hod).value) : false,
        dbk_hod: colMap.dbk_hod ? parseBoolean(row.getCell(colMap.dbk_hod).value) : false,
        bpk_quality: colMap.bpk_quality ? parseBoolean(row.getCell(colMap.bpk_quality).value) : false,
        bsi_quality: colMap.bsi_quality ? parseBoolean(row.getCell(colMap.bsi_quality).value) : false,
        status: "active",
        source: "imported",
      });

      rows.push(input);
    }

    return NextResponse.json({
      success: true,
      sheetName: worksheet.name,
      totalRows: rows.length,
      rows,
    });
  } catch (error) {
    console.error("Excel import error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to parse Excel file" },
      { status: 500 }
    );
  }
}
