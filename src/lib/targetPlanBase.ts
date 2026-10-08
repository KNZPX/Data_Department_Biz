// Builds the starting 2027 plan from the baseline data (TARGET_UNITS) and the
// agreed "Revise 2027 (V2)" numbers: network 7,550 MB, sites 5,140 / 2,035 / 375 MB,
// and each CoE/SBU's MB where it was set. Everything below is split by base.
import { HOSPITAL_PROFILES, TARGET_META, TARGET_SITES, TARGET_UNITS, VERIFIED_BASE_CASE } from "../data/targetScenarioData";
import { MB, allocate, buildSettingBranch, fromSnapshot, type BlankStructure, type Plan, type PlanNode, type PlanSnapshot } from "./targetPlan";

// Share of a unit's revenue that is OPD (the rest IPD), by specialty.
const OPD_RATIO: Record<string, number> = {
  "CoE Trauma": 0.45,
  "CoE Cardiovascular": 0.4,
  "CoE Neurology": 0.5,
  "CoE Orthopedic": 0.45,
  "CoE Cancer": 0.35,
  "SBU Women's Health": 0.6,
  "SBU Child": 0.8,
  "Outreach Clinic & BTL": 0.95,
  "SBU PPSI": 0.55,
  "SBU Wellness": 0.9,
  "SBU Urology": 0.7,
  "Elective Surgery": 0.3,
  "Usual Business": 0.65,
};

// Market segment mix by hospital.
const SEGMENT_MIX: Record<string, { Thai: number; Expat: number; "Fly-in": number }> = {
  BPK: { Thai: 0.48, Expat: 0.24, "Fly-in": 0.28 },
  BSI: { Thai: 0.52, Expat: 0.2, "Fly-in": 0.28 },
  "DBK (Premium)": { Thai: 0.7, Expat: 0.18, "Fly-in": 0.12 },
};

export const DEFAULT_NETWORK_TARGET_MB = 7550;
export const DEFAULT_STEP = 0.1 * MB;

type Cfg = { mode?: string; value?: string };

function cfgTarget(cfg: Cfg | undefined, base: number): number | null {
  if (!cfg?.value) return null;
  const v = parseFloat(cfg.value);
  if (!Number.isFinite(v)) return null;
  if (cfg.mode === "amount") return v * MB;
  if (cfg.mode === "growth") return base * (1 + v / 100);
  return null;
}

export function buildBasePlan(): Plan {
  const nodes: Record<string, PlanNode> = {};
  // Months of the base year that are actual: everything before the data's as-of month.
  const asOf = new Date(TARGET_META.as_of_date);
  const plan: Plan = { rootId: "PKT", targetYear: TARGET_META.target_year, step: DEFAULT_STEP, actualMonths: Number.isNaN(asOf.getTime()) ? 8 : asOf.getMonth(), nodes };
  const snap = (VERIFIED_BASE_CASE?.snap || {}) as { siteCfg?: Record<string, Cfg>; rev?: { unit?: Record<string, Cfg> } };

  nodes.PKT = {
    id: "PKT",
    parentId: null,
    level: "network",
    name: "BDMS Phuket network",
    site: "PKT",
    children: [],
    base26: 0,
    prior25: 0,
    baseVisits26: 0,
    target: DEFAULT_NETWORK_TARGET_MB * MB,
    locked: false,
  };

  for (const site of TARGET_SITES) {
    const units = TARGET_UNITS.filter((u) => u.site === site);
    const siteNode: PlanNode = {
      id: site,
      parentId: "PKT",
      level: "site",
      name: HOSPITAL_PROFILES[site]?.name || site,
      site,
      children: [],
      base26: 0,
      prior25: 0,
      baseVisits26: 0,
      target: 0,
      locked: false,
    };
    nodes[site] = siteNode;
    nodes.PKT.children.push(site);

    for (const u of units) {
      const id = `${site}||${u.coe}`;
      const prior = u.months.reduce((a, m) => a + (m.rev25 || 0), 0);
      const months = u.months.map((m) => m.rp || 0);
      const mSum = months.reduce((a, b) => a + b, 0);
      nodes[id] = {
        id,
        parentId: site,
        level: "coe",
        name: u.coe,
        site,
        group: u.group,
        children: [],
        base26: u.base_rev,
        prior25: prior,
        baseVisits26: u.base_visit,
        target: 0,
        locked: false,
        months: mSum > 0 ? months.map((m) => m / mSum) : undefined,
      };
      siteNode.children.push(id);
      siteNode.base26 += u.base_rev;
      siteNode.prior25 += prior;
      siteNode.baseVisits26 += u.base_visit;
      buildSettingBranch(plan, id, { opd: OPD_RATIO[u.coe] ?? 0.55, market: SEGMENT_MIX[site] || { Thai: 0.5, Expat: 0.25, "Fly-in": 0.25 } });
    }
    nodes.PKT.base26 += siteNode.base26;
    nodes.PKT.prior25 += siteNode.prior25;
    nodes.PKT.baseVisits26 += siteNode.baseVisits26;
  }

  // Network-wide monthly profile = revenue-weighted average of the units.
  const netMonths = new Array(12).fill(0);
  for (const n of Object.values(nodes)) if (n.level === "coe" && n.months) n.months.forEach((m, i) => (netMonths[i] += m * n.base26));
  const nm = netMonths.reduce((a, b) => a + b, 0);
  if (nm > 0) {
    nodes.PKT.months = netMonths.map((m) => m / nm);
    for (const site of TARGET_SITES) {
      const sm = new Array(12).fill(0);
      for (const c of nodes[site].children) nodes[c].months?.forEach((m, i) => (sm[i] += m * nodes[c].base26));
      const t = sm.reduce((a, b) => a + b, 0);
      nodes[site].months = t > 0 ? sm.map((m) => m / t) : nodes.PKT.months;
    }
  }

  // Agreed targets as weights: network → sites → units, then everything below by base.
  const root = nodes.PKT;
  const siteWeights = root.children.map((s) => cfgTarget(snap.siteCfg?.[s], nodes[s].base26) ?? nodes[s].base26);
  allocate(root.target, siteWeights, plan.step).forEach((v, i) => (nodes[root.children[i]].target = v));
  for (const s of root.children) {
    const site = nodes[s];
    const w = site.children.map((c) => cfgTarget(snap.rev?.unit?.[c], nodes[c].base26) ?? nodes[c].base26 * (site.base26 > 0 ? site.target / site.base26 : 1));
    allocate(site.target, w, plan.step).forEach((v, i) => (nodes[site.children[i]].target = v));
    for (const c of site.children) splitByBase(plan, c);
  }
  return plan;
}

function splitByBase(plan: Plan, id: string) {
  const n = plan.nodes[id];
  if (!n.children.length) return;
  const kids = n.children.map((c) => plan.nodes[c]);
  allocate(n.target, kids.map((k) => k.base26), plan.step).forEach((v, i) => (kids[i].target = v));
  for (const k of kids) splitByBase(plan, k.id);
}

/**
 * Older saved scenarios: { snap: { treeNodes: { id: { targetRev } } } } from the
 * previous page, or { snap: { siteCfg, rev: { unit } } } from the original tool.
 * Turn either into a v2 snapshot (targets only; structure is today's).
 */
export function legacyToTargets(base: Plan, snapshot: unknown): Record<string, number> | null {
  const s = snapshot as { snap?: { treeNodes?: Record<string, { targetRev?: number }>; siteCfg?: Record<string, Cfg>; rev?: { unit?: Record<string, Cfg>; site?: Record<string, Cfg> } }; revTgt?: number };
  const snap = s?.snap;
  if (!snap) return null;
  const out: Record<string, number> = {};
  if (snap.treeNodes) {
    for (const [id, v] of Object.entries(snap.treeNodes)) if (typeof v?.targetRev === "number") out[id] = v.targetRev;
    return Object.keys(out).length ? out : null;
  }
  const siteCfg = snap.rev?.site || snap.siteCfg;
  let total = 0;
  for (const site of base.nodes.PKT.children) {
    const t = cfgTarget(siteCfg?.[site], base.nodes[site].base26);
    if (t !== null) {
      out[site] = t;
      total += t;
    }
  }
  for (const [id, cfg] of Object.entries(snap.rev?.unit || {})) {
    const n = base.nodes[id];
    const t = n ? cfgTarget(cfg, n.base26) : null;
    if (t !== null) out[id] = t;
  }
  if (total > 0) out.PKT = typeof s.revTgt === "number" && s.revTgt > 0 ? s.revTgt : total;
  return Object.keys(out).length ? out : null;
}

/** The organisation in the shape a blank plan keeps with itself. */
export function blankFromOrg(org: { sites: { code: string; name: string; color?: string; active?: boolean }[]; units: { name: string; group: string; sites: string[]; active?: boolean }[] }): BlankStructure {
  const sites = org.sites.filter((s) => s.active !== false).map((s) => ({ code: s.code, name: s.name, color: s.color }));
  const codes = new Set(sites.map((s) => s.code));
  return {
    sites,
    units: org.units
      .filter((u) => u.active !== false)
      .map((u) => ({ name: u.name, group: u.group, sites: u.sites.filter((c) => codes.has(c)) }))
      .filter((u) => u.sites.length),
  };
}

/**
 * A plan with every number at zero, on the team's organisation, for any year.
 * People type the actuals, the base year and the targets themselves; totals
 * add up from the units (bottom-up) until someone switches to top-down.
 */
export function buildBlankPlan(structure: BlankStructure, targetYear: number): Plan {
  const nodes: Record<string, PlanNode> = {};
  const plan: Plan = { rootId: "PKT", targetYear, step: DEFAULT_STEP, actualMonths: 0, nodes, rolled: true, bottomUp: true, blank: structure };
  const zero = { base26: 0, prior25: 0, baseVisits26: 0, target: 0, locked: false };
  nodes.PKT = { id: "PKT", parentId: null, level: "network", name: "Phuket network", site: "PKT", children: [], ...zero };
  for (const s of structure.sites) {
    nodes[s.code] = { id: s.code, parentId: "PKT", level: "site", name: s.name || s.code, site: s.code, children: [], ...zero };
    nodes.PKT.children.push(s.code);
    for (const u of structure.units.filter((x) => x.sites.includes(s.code))) {
      const id = `${s.code}||${u.name}`;
      nodes[id] = { id, parentId: s.code, level: "coe", name: u.name, site: s.code, group: u.group, children: [], ...zero };
      nodes[s.code].children.push(id);
      // Every number starts at zero; OPD/IPD and segments are typed on the Target page.
      buildSettingBranch(plan, id, { opd: 0.5, market: SEGMENT_MIX[s.code] || { Thai: 0.5, Expat: 0.25, "Fly-in": 0.25 } });
    }
  }
  return plan;
}

// ---- saved scenarios, read by other pages ---------------------------------------

/** What a saved Target scenario keeps (v2 plans, or older snapshots from earlier tools). */
export type SavedTargetSnapshot = { plan?: PlanSnapshot; snap?: unknown } & Record<string, unknown>;

/** The year a saved scenario plans for. */
export function savedPlanYear(snapshot: SavedTargetSnapshot | null | undefined): number {
  return snapshot?.plan?.targetYear ?? TARGET_META.target_year;
}

/** Rebuild a saved scenario's plan (same rules the Target page uses to open it). */
export function planFromSaved(snapshot: SavedTargetSnapshot | null | undefined, base?: () => Plan): Plan {
  const snap = snapshot || {};
  if (snap.plan?.version === 2 && snap.plan.blank) return fromSnapshot(buildBlankPlan(snap.plan.blank, snap.plan.targetYear || TARGET_META.target_year), snap.plan);
  const b = base ? base() : buildBasePlan();
  if (snap.plan?.version === 2) return fromSnapshot(b, snap.plan);
  const targets = legacyToTargets(b, snap);
  if (!targets) return b;
  return fromSnapshot(b, { version: 2, step: DEFAULT_STEP, targets, locked: [], subs: [] });
}

export type UnitNumbers = { target: number; base: number; prior: number; sites: Record<string, { target: number; base: number; prior: number }> };

/** Each CoE / SBU's target, base year and prior year, network-wide and per hospital. */
export function unitNumbers(plan: Plan): Record<string, UnitNumbers> {
  const out: Record<string, UnitNumbers> = {};
  for (const n of Object.values(plan.nodes)) {
    if (n.level !== "coe") continue;
    const u = (out[n.name] ||= { target: 0, base: 0, prior: 0, sites: {} });
    u.target += n.target;
    u.base += n.base26;
    u.prior += n.prior25;
    const s = (u.sites[n.site] ||= { target: 0, base: 0, prior: 0 });
    s.target += n.target;
    s.base += n.base26;
    s.prior += n.prior25;
  }
  return out;
}
