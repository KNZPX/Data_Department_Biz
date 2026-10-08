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

// ---- per year -------------------------------------------------------------------
// CoE / SBU units can change from year to year (a new CoE, a unit dropped, a
// hospital added to one). What's stored: the hospitals (shared by every year),
// a default unit list, and each year's own list where the team set one. A year
// without its own list carries on the closest earlier year's, else the default.

export type OrgStore = OrgStructure & { years: Record<string, OrgUnit[]> };

export function normalizeOrgStore(raw: unknown): OrgStore {
  const base = normalizeOrg(raw);
  const r = raw as { years?: Record<string, unknown> } | null;
  const years: Record<string, OrgUnit[]> = {};
  if (r?.years && typeof r.years === "object")
    for (const [y, list] of Object.entries(r.years)) if (/^\d{4}$/.test(y) && Array.isArray(list)) years[y] = normalizeOrg({ sites: base.sites, units: list }).units;
  return { ...base, years };
}

export const ownYears = (store: OrgStore) =>
  Object.keys(store.years)
    .map(Number)
    .sort((a, b) => a - b);

/** The year whose list `year` uses: itself, the closest earlier year with a list, or null for the default list. */
export function orgSourceYear(store: OrgStore, year: number): number | null {
  const ys = ownYears(store).filter((y) => y <= year);
  return ys.length ? ys[ys.length - 1] : null;
}

/** The organisation for one year. */
export function orgForYear(store: OrgStore, year: number): OrgStructure {
  const from = orgSourceYear(store, year);
  return { sites: store.sites, units: from === null ? store.units : store.years[String(from)] };
}

/**
 * Give `year` its own unit list (hospitals are shared by every year). Years
 * between it and the next year with its own list used to carry on an older
 * list; they keep that list, so changing one year never reshapes another.
 */
export function setOrgYear(store: OrgStore, year: number, org: OrgStructure): OrgStore {
  const years = { ...store.years };
  const next = ownYears(store).find((y) => y > year);
  if (next !== undefined && !(String(year) in years)) for (let y = year + 1; y < next; y++) years[String(y)] = orgForYear(store, y).units;
  years[String(year)] = structuredClone(org.units);
  return { sites: org.sites, units: store.units, years };
}

/** Drop `year`'s own list so it carries on the year before it. */
export function clearOrgYear(store: OrgStore, year: number): OrgStore {
  const years = { ...store.years };
  delete years[String(year)];
  return { ...store, years };
}

/** What changed from one year's organisation to another's, in words. */
export function orgChanges(from: OrgStructure, to: OrgStructure): string[] {
  const out: string[] = [];
  const site = (c: string) => c.replace(" (Premium)", "");
  const was = new Map(from.units.filter((u) => u.active).map((u) => [u.id, u]));
  const now = new Map(to.units.filter((u) => u.active).map((u) => [u.id, u]));
  for (const [id, u] of now) if (!was.has(id)) out.push(`+ ${u.name}${u.sites.length ? ` (${u.sites.map(site).join(", ")})` : ""}`);
  for (const [id, u] of was) if (!now.has(id)) out.push(`− ${u.name}`);
  for (const [id, u] of now) {
    const p = was.get(id);
    if (!p) continue;
    if (p.name !== u.name) out.push(`${p.name} → ${u.name}`);
    if (p.group !== u.group) out.push(`${u.name}: ${p.group} → ${u.group}`);
    const add = u.sites.filter((s) => !p.sites.includes(s));
    const drop = p.sites.filter((s) => !u.sites.includes(s));
    if (add.length) out.push(`${u.name} + ${add.map(site).join(", ")}`);
    if (drop.length) out.push(`${u.name} − ${drop.map(site).join(", ")}`);
  }
  return out;
}
