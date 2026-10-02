// The organisation the planning pages are built on: hospitals (sites) and the
// CoE / SBU units in each. Admins maintain it in Settings → Organisation; it's
// stored team-wide in app_settings ("org_structure").
import { HOSPITAL_PROFILES, TARGET_SITES, TARGET_UNITS } from "@/data/targetScenarioData";

export const UNIT_GROUPS = ["CoE", "SBU", "Hospital Focus", "Usual Business"] as const;
export type UnitGroup = (typeof UNIT_GROUPS)[number] | string;

export type OrgSite = { code: string; name: string; fullName: string; color: string; active: boolean };
export type OrgUnit = {
  id: string; // stable key, e.g. "coe-trauma"
  name: string; // shown everywhere, e.g. "CoE Trauma"
  group: UnitGroup;
  sites: string[]; // site codes this unit runs in
  lead?: string;
  description?: string;
  active: boolean;
};
export type OrgStructure = { sites: OrgSite[]; units: OrgUnit[] };

export const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9ก-๙]+/g, "-")
    .replace(/^-|-$/g, "") || "unit";


/** The structure in the original planning file, used until an admin saves their own. */
export function defaultOrgStructure(): OrgStructure {
  const sites: OrgSite[] = TARGET_SITES.map((code) => ({
    code,
    name: HOSPITAL_PROFILES[code]?.name || code,
    fullName: HOSPITAL_PROFILES[code]?.fullName || code,
    color: HOSPITAL_PROFILES[code]?.color || "#2563eb",
    active: true,
  }));
  const byName = new Map<string, OrgUnit>();
  for (const u of TARGET_UNITS) {
    const cur = byName.get(u.coe) || { id: slug(u.coe), name: u.coe, group: u.group, sites: [], active: true };
    if (!cur.sites.includes(u.site)) cur.sites.push(u.site);
    byName.set(u.coe, cur);
  }
  return { sites, units: Array.from(byName.values()) };
}

/** Clean up whatever came back from storage. */
export function normalizeOrg(raw: unknown): OrgStructure {
  const r = raw as Partial<OrgStructure> | null;
  if (!r || !Array.isArray(r.sites) || !Array.isArray(r.units)) return defaultOrgStructure();
  const sites = r.sites
    .filter((s) => s && typeof s.code === "string" && s.code.trim())
    .map((s) => ({ code: s.code.trim(), name: String(s.name || s.code), fullName: String(s.fullName || s.name || s.code), color: /^#[0-9a-f]{6}$/i.test(s.color) ? s.color : "#2563eb", active: s.active !== false }));
  const codes = new Set(sites.map((s) => s.code));
  const units = r.units
    .filter((u) => u && typeof u.name === "string" && u.name.trim())
    .map((u) => ({
      id: String(u.id || slug(u.name)),
      name: u.name.trim(),
      group: String(u.group || "CoE"),
      sites: (Array.isArray(u.sites) ? u.sites : []).filter((c) => codes.has(c)),
      lead: u.lead ? String(u.lead) : undefined,
      description: u.description ? String(u.description) : undefined,
      active: u.active !== false,
    }));
  return { sites, units };
}
