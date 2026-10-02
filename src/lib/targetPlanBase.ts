// Builds the starting 2027 plan from the baseline data (TARGET_UNITS) and the
// agreed "Revise 2027 (V2)" numbers: network 7,550 MB, sites 5,140 / 2,035 / 375 MB,
// and each CoE/SBU's MB where it was set. Everything below is split by base.
import { HOSPITAL_PROFILES, TARGET_SITES, TARGET_UNITS, VERIFIED_BASE_CASE } from "../data/targetScenarioData";
import { MB, allocate, buildSettingBranch, type Plan, type PlanNode } from "./targetPlan";

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
  const plan: Plan = { rootId: "PKT", step: DEFAULT_STEP, nodes };
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
