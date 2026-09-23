export type LicenseStatus = "active" | "pending" | "revoked" | "inactive";

export type PowerBiLicense = {
  id: string;

  // 1-16: Employee & Organizational Profile
  site: string;                    // 1. Site
  business_unit_code: string;      // 2. Business Unit Code
  person_id: string;               // 3. Person ID
  user_id: string;                 // 4. User ID
  name_th: string;                 // 5. Name (TH)
  position_en: string;             // 6. Position Name (EN)
  department_code: string;         // 7. Department Code
  department_en: string;           // 8. Department Name (EN)
  employee_class: string;          // 9. Employee Class
  employment_type: string;         // 10. Full-time/Part-time
  display_name: string;            // 11. Display Name
  ad_account: string;              // 12. Ad Account (Email)
  user_type: string;               // 13. Type
  department_name: string;         // 14. Department Name
  dept_group: string;              // 15. Dept group
  hod_3site: string;               // 16. HOD 3Site

  // 17-19: Creator Info
  creator_person_id: string;       // 17. Creator Person ID
  creator_name_th: string;         // 18. Creator Name (TH)
  creator_position_en: string;     // 19. Creator Position Name (EN)

  // 20-22: License & Capacity
  pbi_premium_capacity: string;    // 20. Power BI Premium per Capacity
  pbi_pro_license: string;         // 21. Power BI Pro License
  license_type: string;            // 22. License_type

  // 23-27: Phuket Security Groups
  bpk_phuket_executive: boolean;   // 23. BPK BI Phuket Executive Group
  bpk_phuket_marketing: boolean;   // 24. BPK BI Phuket Marketing Group
  bpk_phuket_hod: boolean;         // 25. BPK BI Phuket HOD Group
  bpk_phuket_stg: boolean;         // 26. BPK BI Phuket STG Group
  bpk_phuket_admin: boolean;       // 27. BPK BI Phuket Admin Group

  // 28-32: Site Security Groups
  bpk_hod: boolean;                // 28. BPK BI HOD Group
  bsi_hod: boolean;                // 29. BSI BI HOD Group
  dbk_hod: boolean;                // 30. DBK BI HOD Group
  bpk_quality: boolean;            // 31. BPK BI Quality Group
  bsi_quality: boolean;            // 32. BSI BI Quality Group

  // Backwards-compatible aliases
  name: string;
  email: string;
  hospital: string;
  department: string | null;
  position: string | null;
  employee_id: string | null;

  // Metadata / Status
  status: LicenseStatus;
  request_date?: string | null;
  purpose?: string | null;
  notes?: string | null;
  source: "imported" | "manual";
  created_at?: string;
  updated_at?: string;
};

export type LicenseInput = Partial<PowerBiLicense> & {
  id?: string;
  name?: string;
  email?: string;
  hospital?: string;
  license_type?: string;
};

export type ColumnGroupKey = "overview" | "all" | "org" | "creator" | "license" | "security";

export interface ColumnDefinition {
  key: keyof PowerBiLicense;
  header: string;
  category: "General" | "Creator" | "Capacity" | "Phuket" | "Site";
  type: "text" | "boolean";
  width?: number;
}

export const POWER_BI_32_COLUMNS: ColumnDefinition[] = [
  // 1-16
  { key: "site", header: "Site", category: "General", type: "text", width: 10 },
  { key: "business_unit_code", header: "Business Unit Code", category: "General", type: "text", width: 16 },
  { key: "person_id", header: "Person ID", category: "General", type: "text", width: 14 },
  { key: "user_id", header: "User ID", category: "General", type: "text", width: 14 },
  { key: "name_th", header: "Name (TH)", category: "General", type: "text", width: 26 },
  { key: "position_en", header: "Position Name (EN)", category: "General", type: "text", width: 24 },
  { key: "department_code", header: "Department Code", category: "General", type: "text", width: 16 },
  { key: "department_en", header: "Department Name (EN)", category: "General", type: "text", width: 24 },
  { key: "employee_class", header: "Employee Class", category: "General", type: "text", width: 15 },
  { key: "employment_type", header: "Full-time/Part-time", category: "General", type: "text", width: 16 },
  { key: "display_name", header: "Display Name", category: "General", type: "text", width: 26 },
  { key: "ad_account", header: "Ad Account", category: "General", type: "text", width: 28 },
  { key: "user_type", header: "Type", category: "General", type: "text", width: 12 },
  { key: "department_name", header: "Department Name", category: "General", type: "text", width: 22 },
  { key: "dept_group", header: "Dept group", category: "General", type: "text", width: 16 },
  { key: "hod_3site", header: "HOD 3Site", category: "General", type: "text", width: 14 },

  // 17-19: Creator
  { key: "creator_person_id", header: "Person ID", category: "Creator", type: "text", width: 14 },
  { key: "creator_name_th", header: "Name (TH)", category: "Creator", type: "text", width: 24 },
  { key: "creator_position_en", header: "Position Name (EN)", category: "Creator", type: "text", width: 24 },

  // 20-22: License & Capacity
  { key: "pbi_premium_capacity", header: "Power BI Premium per Capacity", category: "Capacity", type: "text", width: 24 },
  { key: "pbi_pro_license", header: "Power BI Pro License", category: "Capacity", type: "text", width: 20 },
  { key: "license_type", header: "License_type", category: "Capacity", type: "text", width: 18 },

  // 23-27: Phuket Security Groups
  { key: "bpk_phuket_executive", header: "BPK BI Phuket Executive Group", category: "Phuket", type: "boolean", width: 26 },
  { key: "bpk_phuket_marketing", header: "BPK BI Phuket Marketing Group", category: "Phuket", type: "boolean", width: 26 },
  { key: "bpk_phuket_hod", header: "BPK BI Phuket HOD Group", category: "Phuket", type: "boolean", width: 24 },
  { key: "bpk_phuket_stg", header: "BPK BI Phuket STG Group", category: "Phuket", type: "boolean", width: 24 },
  { key: "bpk_phuket_admin", header: "BPK BI Phuket Admin Group", category: "Phuket", type: "boolean", width: 24 },

  // 28-32: Site Security Groups
  { key: "bpk_hod", header: "BPK BI HOD Group", category: "Site", type: "boolean", width: 20 },
  { key: "bsi_hod", header: "BSI BI HOD Group", category: "Site", type: "boolean", width: 20 },
  { key: "dbk_hod", header: "DBK BI HOD Group", category: "Site", type: "boolean", width: 20 },
  { key: "bpk_quality", header: "BPK BI Quality Group", category: "Site", type: "boolean", width: 22 },
  { key: "bsi_quality", header: "BSI BI Quality Group", category: "Site", type: "boolean", width: 22 },
];

export const SECURITY_GROUPS_LIST = [
  { key: "bpk_phuket_executive", label: "BPK BI Phuket Executive Group", category: "Phuket" },
  { key: "bpk_phuket_marketing", label: "BPK BI Phuket Marketing Group", category: "Phuket" },
  { key: "bpk_phuket_hod", label: "BPK BI Phuket HOD Group", category: "Phuket" },
  { key: "bpk_phuket_stg", label: "BPK BI Phuket STG Group", category: "Phuket" },
  { key: "bpk_phuket_admin", label: "BPK BI Phuket Admin Group", category: "Phuket" },
  { key: "bpk_hod", label: "BPK BI HOD Group", category: "Site" },
  { key: "bsi_hod", label: "BSI BI HOD Group", category: "Site" },
  { key: "dbk_hod", label: "DBK BI HOD Group", category: "Site" },
  { key: "bpk_quality", label: "BPK BI Quality Group", category: "Site" },
  { key: "bsi_quality", label: "BSI BI Quality Group", category: "Site" },
] as const;

export function normalizeLicense(input: Partial<PowerBiLicense>): PowerBiLicense {
  const name_th = (input.name_th || "").trim();
  const display_name = (input.display_name || input.name || name_th).trim();
  const ad_account = (input.ad_account || input.email || "").trim();
  const site = (input.site || input.hospital || "PKT").trim();
  const department_name = (input.department_name || input.department || "").trim();
  const department_en = (input.department_en || department_name).trim();
  const position_en = (input.position_en || input.position || "").trim();
  const person_id = (input.person_id || input.employee_id || "").trim();
  const user_id = (input.user_id || person_id).trim();

  return {
    id: input.id || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "lic_" + Math.random().toString(36).slice(2, 9)),
    site,
    business_unit_code: (input.business_unit_code || "").trim(),
    person_id,
    user_id,
    name_th: name_th || display_name,
    position_en,
    department_code: (input.department_code || "").trim(),
    department_en,
    employee_class: (input.employee_class || "").trim(),
    employment_type: (input.employment_type || "").trim(),
    display_name,
    ad_account,
    user_type: (input.user_type || "").trim(),
    department_name,
    dept_group: (input.dept_group || "").trim(),
    hod_3site: (input.hod_3site || "").trim(),

    creator_person_id: (input.creator_person_id || "").trim(),
    creator_name_th: (input.creator_name_th || "").trim(),
    creator_position_en: (input.creator_position_en || "").trim(),

    pbi_premium_capacity: (input.pbi_premium_capacity || "").trim(),
    pbi_pro_license: (input.pbi_pro_license || "").trim(),
    license_type: (input.license_type || "Power BI Pro").trim(),

    bpk_phuket_executive: Boolean(input.bpk_phuket_executive),
    bpk_phuket_marketing: Boolean(input.bpk_phuket_marketing),
    bpk_phuket_hod: Boolean(input.bpk_phuket_hod),
    bpk_phuket_stg: Boolean(input.bpk_phuket_stg),
    bpk_phuket_admin: Boolean(input.bpk_phuket_admin),

    bpk_hod: Boolean(input.bpk_hod),
    bsi_hod: Boolean(input.bsi_hod),
    dbk_hod: Boolean(input.dbk_hod),
    bpk_quality: Boolean(input.bpk_quality),
    bsi_quality: Boolean(input.bsi_quality),

    // Aliases
    name: display_name || name_th,
    email: ad_account,
    hospital: site,
    department: department_name || department_en,
    position: position_en,
    employee_id: person_id,

    status: input.status || "active",
    request_date: input.request_date || null,
    purpose: input.purpose ? String(input.purpose).trim() : null,
    notes: input.notes ? String(input.notes).trim() : null,
    source: input.source || "manual",
    created_at: input.created_at,
    updated_at: input.updated_at,
  };
}

export const COMMON_HOSPITALS = ["PKT", "BPK", "DBK", "BSI", "Other"] as const;

export const COMMON_LICENSE_TYPES = [
  "Power BI Pro",
  "Power BI Premium Per User (PPU)",
  "Microsoft Fabric",
  "Power BI Free",
] as const;

export function getAccessibleWorkspaces(license: PowerBiLicense): string[] {
  const workspaces: string[] = [];
  const site = (license.site || license.hospital || "").trim();

  if (site && site !== "-") {
    workspaces.push(`${site} Workspace`);
  }

  if (license.bpk_phuket_executive) workspaces.push("BDMS Executive Workspace", "Phuket Executive Hub");
  if (license.bpk_phuket_marketing) workspaces.push("Phuket Marketing Hub");
  if (license.bpk_phuket_hod) workspaces.push("Phuket HOD Reports");
  if (license.bpk_phuket_stg) workspaces.push("Phuket Strategic Planning");
  if (license.bpk_phuket_admin) workspaces.push("Phuket BI Admin & Governance");
  if (license.bpk_hod) workspaces.push("BPK HOD Workspace");
  if (license.bsi_hod) workspaces.push("BSI HOD Workspace");
  if (license.dbk_hod) workspaces.push("DBK HOD Workspace");
  if (license.bpk_quality) workspaces.push("BPK Quality & Clinical Hub");
  if (license.bsi_quality) workspaces.push("BSI Quality & Clinical Hub");

  if (workspaces.length === 0) {
    workspaces.push(`${site || "Site"} General Reports`);
  }

  return Array.from(new Set(workspaces));
}

export function getGrantedPermissions(license: PowerBiLicense): { code: string; label: string; tone: string }[] {
  const perms: { code: string; label: string; tone: string }[] = [];

  if (license.bpk_phuket_executive) perms.push({ code: "EXEC", label: "Executive", tone: "bg-purple-50 text-purple-700 border-purple-200" });
  if (license.bpk_phuket_marketing) perms.push({ code: "MKT", label: "Marketing", tone: "bg-pink-50 text-pink-700 border-pink-200" });
  if (license.bpk_phuket_hod) perms.push({ code: "PKT-HOD", label: "PKT HOD", tone: "bg-blue-50 text-blue-700 border-blue-200" });
  if (license.bpk_phuket_stg) perms.push({ code: "STG", label: "STG Group", tone: "bg-amber-50 text-amber-700 border-amber-200" });
  if (license.bpk_phuket_admin) perms.push({ code: "ADMIN", label: "BI Admin", tone: "bg-red-50 text-red-700 border-red-200" });
  if (license.bpk_hod) perms.push({ code: "BPK-HOD", label: "BPK HOD", tone: "bg-indigo-50 text-indigo-700 border-indigo-200" });
  if (license.bsi_hod) perms.push({ code: "BSI-HOD", label: "BSI HOD", tone: "bg-teal-50 text-teal-700 border-teal-200" });
  if (license.dbk_hod) perms.push({ code: "DBK-HOD", label: "DBK HOD", tone: "bg-cyan-50 text-cyan-700 border-cyan-200" });
  if (license.bpk_quality) perms.push({ code: "BPK-QC", label: "BPK Quality", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" });
  if (license.bsi_quality) perms.push({ code: "BSI-QC", label: "BSI Quality", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" });
  if (license.hod_3site && license.hod_3site !== "-") perms.push({ code: "3SITE", label: "HOD 3Site", tone: "bg-violet-50 text-violet-700 border-violet-200" });

  return perms;
}
