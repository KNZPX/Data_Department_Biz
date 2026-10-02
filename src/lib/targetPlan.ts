// ==============================================================================
// Target plan engine (2027): top-down delegation where every level adds up.
//
//   Network → Site → CoE / SBU → (CoE sub, optional) → Setting (OPD/IPD) → Segment (Thai/Expat/Fly-in)
//
// Rules
//  1. A parent's target is the ceiling for its children: the children always add
//     up to exactly the parent (to the rounding step).
//  2. Typing a target on a node pins it ("locked"). Its unpinned siblings share
//     what's left of the parent, in proportion to their current targets, so the
//     parent never moves. A pinned value can't go above what the parent has left.
//  3. Changing a node re-splits everything under it the same way (pinned children
//     keep their value when it fits; otherwise they're scaled down to fit).
//  4. Everything is rounded to the plan's step (e.g. 0.1 MB) with largest-remainder
//     rounding, so rounding never breaks rule 1.
// Pure functions only — no React, no data imports — so it's easy to test.
// ==============================================================================

export type PlanLevel = "network" | "site" | "coe" | "sub" | "setting" | "market";

export interface PlanNode {
  id: string;
  parentId: string | null;
  level: PlanLevel;
  name: string;
  site: string;
  group?: string;
  children: string[];
  base26: number; // THB, 2026 base (estimate)
  prior25: number; // THB, 2025 actual
  baseVisits26: number;
  target: number; // THB, 2027 target
  locked: boolean; // set by a person; kept when siblings are rebalanced
  custom?: boolean; // a CoE sub someone added
  months?: number[]; // 12 revenue-phasing weights (sum 1), inherited from the unit
  actual?: number; // THB actual so far this year, typed by a person (CoE / sub-unit only)
  dataBase26?: number; // the base26 from the data, kept when an actual overrides it
  priorTyped?: number; // THB prior-year actual typed by a person (CoE / sub-unit only)
  dataPrior25?: number; // the prior25 from the data, kept when a typed value overrides it
}

// Field names keep the first plan's years (prior25 / base26), but they mean
// "two years before the target" and "the year before the target" for any plan.
export interface Plan {
  rootId: string;
  targetYear: number; // the year being planned; prior = targetYear − 2, base = targetYear − 1
  rolled?: boolean; // base / prior come from an earlier plan, not the data
  bottomUp?: boolean; // totals add up from the units, instead of being fixed from the top
  blank?: BlankStructure; // a plan typed from scratch on the team's organisation
  step: number; // THB rounding step
  actualMonths: number; // how many months of the base year are actual (0–12); the rest is estimate
  nodes: Record<string, PlanNode>;
}

export type Adjustment = { id: string; from: number; to: number };

export interface ChangeReport {
  nodeId: string;
  from: number;
  to: number;
  requested: number;
  clamped: boolean; // asked for more than the parent had left
  siblings: Adjustment[]; // siblings moved to keep the parent whole
  scaledLocked: string[]; // pinned nodes that had to shrink to fit
  autoUnlocked: string | null; // sibling switched to auto to absorb the remainder
}

export const MB = 1_000_000;

/** The organisation a blank plan was built on (kept with the plan so it reopens the same). */
export type BlankStructure = {
  sites: { code: string; name: string; color?: string }[];
  units: { name: string; group: string; sites: string[] }[];
};

// ---- small helpers -----------------------------------------------------------

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function clonePlan(plan: Plan): Plan {
  const nodes: Record<string, PlanNode> = {};
  for (const [k, n] of Object.entries(plan.nodes)) nodes[k] = { ...n, children: [...n.children] };
  return { ...plan, nodes };
}

export function growthPct(n: Pick<PlanNode, "base26" | "target">) {
  return n.base26 > 0 ? ((n.target - n.base26) / n.base26) * 100 : n.target > 0 ? 100 : 0;
}

/** Visits move about half as fast as revenue (same rule the previous model used). */
export function targetVisits(n: PlanNode) {
  const g = Math.max(-20, growthPct(n) * 0.55);
  return n.baseVisits26 * (1 + g / 100);
}

export function roundTo(value: number, step: number) {
  return Math.round(value / step) * step;
}

/**
 * Split `total` into parts proportional to `weights`, each a multiple of `step`
 * (largest remainder), adding up to `total` exactly. Any sub-step leftover from a
 * total that isn't itself a multiple of `step` goes to the biggest part.
 */
export function allocate(total: number, weights: number[], step: number): number[] {
  const n = weights.length;
  if (n === 0) return [];
  if (total <= 0) return weights.map(() => 0);
  let w = weights.map((x) => (Number.isFinite(x) && x > 0 ? x : 0));
  if (sum(w) <= 0) w = weights.map(() => 1);
  const W = sum(w);
  const units = Math.floor(total / step + 1e-9);
  const exact = w.map((x) => (x / W) * units);
  const parts = exact.map(Math.floor);
  let left = units - sum(parts);
  const order = exact.map((x, i) => [x - Math.floor(x), i] as const).sort((a, b) => b[0] - a[0] || w[b[1]] - w[a[1]]);
  for (let k = 0; left > 0; k = (k + 1) % n, left--) parts[order[k][1]]++;
  const out = parts.map((p) => p * step);
  const residual = total - units * step;
  if (Math.abs(residual) > 1e-6) {
    let big = 0;
    for (let i = 1; i < n; i++) if (out[i] > out[big] || (out[i] === out[big] && w[i] > w[big])) big = i;
    out[big] += residual;
  }
  return out;
}

// ---- reading the plan --------------------------------------------------------

export function childrenOf(plan: Plan, id: string) {
  return (plan.nodes[id]?.children || []).map((c) => plan.nodes[c]).filter(Boolean);
}

export function siblingsOf(plan: Plan, id: string) {
  const p = plan.nodes[id]?.parentId;
  return p ? childrenOf(plan, p).filter((n) => n.id !== id) : [];
}

/** The most this node can take without pushing its parent over: parent − pinned siblings. */
export function maxFor(plan: Plan, id: string): number {
  const n = plan.nodes[id];
  if (!n?.parentId) return Infinity;
  const parent = plan.nodes[n.parentId];
  return Math.max(0, parent.target - sum(siblingsOf(plan, id).filter((s) => s.locked).map((s) => s.target)));
}

/** Fair share: the same growth as the parent, applied to this node's base. */
export function fairShare(plan: Plan, id: string): number {
  const n = plan.nodes[id];
  if (!n?.parentId) return n?.target || 0;
  const p = plan.nodes[n.parentId];
  const kids = childrenOf(plan, p.id);
  const baseSum = sum(kids.map((k) => k.base26));
  const raw = baseSum > 0 ? (n.base26 / baseSum) * p.target : p.target / kids.length;
  return Math.min(roundTo(raw, plan.step), maxFor(plan, id));
}

export type Issue = { id: string; gap: number };

/** Parents whose children don't add up (should be empty; guards saved/imported plans). */
export function findIssues(plan: Plan): Issue[] {
  const out: Issue[] = [];
  for (const n of Object.values(plan.nodes)) {
    if (!n.children.length) continue;
    const gap = n.target - sum(childrenOf(plan, n.id).map((c) => c.target));
    if (Math.abs(gap) > Math.max(1, plan.step / 100)) out.push({ id: n.id, gap });
  }
  return out;
}

export function walk(plan: Plan, id: string, visit: (n: PlanNode, depth: number) => void, depth = 0) {
  const n = plan.nodes[id];
  if (!n) return;
  visit(n, depth);
  for (const c of n.children) walk(plan, c, visit, depth + 1);
}

// ---- changing the plan -------------------------------------------------------

/**
 * Re-split a node's target among its children and on down the tree.
 * Pinned children keep their value if it fits; if the pinned ones alone are more
 * than the parent, they're scaled down together (and reported).
 */
function splitDown(plan: Plan, id: string, scaledLocked: string[]) {
  const node = plan.nodes[id];
  const kids = childrenOf(plan, id);
  if (!kids.length) return;
  const locked = kids.filter((k) => k.locked);
  const free = kids.filter((k) => !k.locked);
  const lockedSum = sum(locked.map((k) => k.target));

  if (lockedSum > node.target + 1e-6 || (!free.length && Math.abs(lockedSum - node.target) > 1e-6)) {
    // Pinned values don't fit (or there's nobody else to take the rest): scale them all.
    const parts = allocate(node.target, kids.map((k) => k.target || k.base26), plan.step);
    kids.forEach((k, i) => {
      if (k.locked && Math.abs(parts[i] - k.target) > 1e-6) scaledLocked.push(k.id);
      plan.nodes[k.id] = { ...k, target: parts[i] };
    });
  } else {
    const weights = free.map((k) => k.target);
    const parts = allocate(node.target - lockedSum, sum(weights) > 0 ? weights : free.map((k) => k.base26), plan.step);
    free.forEach((k, i) => (plan.nodes[k.id] = { ...k, target: parts[i] }));
  }
  for (const k of kids) splitDown(plan, k.id, scaledLocked);
}

/**
 * Set one node's target. Returns the new plan and a report of what else moved.
 * - root: changes the total and re-splits everything below.
 * - other nodes: clamp to what the parent has left, pin, rebalance unpinned siblings.
 */
export function setTarget(input: Plan, id: string, requestedTHB: number, opts: { lock?: boolean } = {}): { plan: Plan; report: ChangeReport } {
  const plan = clonePlan(input);
  const node = plan.nodes[id];
  const before = new Map(Object.values(plan.nodes).map((n) => [n.id, n.target]));
  const requested = Math.max(0, requestedTHB);
  const report: ChangeReport = { nodeId: id, from: node.target, to: node.target, requested, clamped: false, siblings: [], scaledLocked: [], autoUnlocked: null };

  if (!node.parentId) {
    plan.nodes[id] = { ...node, target: roundTo(requested, plan.step) };
    splitDown(plan, id, report.scaledLocked);
  } else if (plan.bottomUp) {
    // Totals follow the units: set this one, re-split below it, add up above it.
    plan.nodes[id] = { ...node, target: roundTo(requested, plan.step), locked: opts.lock ?? true };
    splitDown(plan, id, report.scaledLocked);
    for (let p: string | null = node.parentId; p; p = plan.nodes[p].parentId) {
      plan.nodes[p] = { ...plan.nodes[p], target: sum(childrenOf(plan, p).map((k) => k.target)) };
    }
  } else {
    const max = maxFor(plan, id);
    let value = roundTo(requested, plan.step);
    if (value > max + 1e-6) {
      value = max;
      report.clamped = true;
    }
    plan.nodes[id] = { ...node, target: value, locked: opts.lock ?? true };

    const parent = plan.nodes[node.parentId];
    let free = siblingsOf(plan, id).filter((s) => !s.locked);
    const lockedSum = sum(siblingsOf(plan, id).filter((s) => s.locked).map((s) => s.target));
    let remainder = parent.target - lockedSum - value;
    if (!free.length && Math.abs(remainder) > 1e-6) {
      // Everyone else is pinned: let the biggest sibling take the remainder.
      const sibs = siblingsOf(plan, id);
      if (sibs.length) {
        const biggest = sibs.reduce((a, b) => (b.target > a.target ? b : a));
        plan.nodes[biggest.id] = { ...biggest, locked: false };
        report.autoUnlocked = biggest.id;
        free = [plan.nodes[biggest.id]];
        remainder += biggest.target;
      } else {
        // An only child always equals its parent.
        plan.nodes[id] = { ...plan.nodes[id], target: parent.target };
      }
    }
    if (free.length) {
      const weights = free.map((s) => s.target);
      const parts = allocate(Math.max(0, remainder), sum(weights) > 0 ? weights : free.map((s) => s.base26), plan.step);
      free.forEach((s, i) => (plan.nodes[s.id] = { ...plan.nodes[s.id], target: parts[i] }));
      for (const s of free) splitDown(plan, s.id, report.scaledLocked);
    }
    splitDown(plan, id, report.scaledLocked);
  }

  report.to = plan.nodes[id].target;
  for (const s of siblingsOf(plan, id)) {
    const was = before.get(s.id) ?? 0;
    if (Math.abs(was - s.target) > 1e-6) report.siblings.push({ id: s.id, from: was, to: s.target });
  }
  return { plan, report };
}

/** Pin or unpin a node. Unpinning hands it back to automatic sharing with its unpinned siblings. */
export function setLocked(input: Plan, id: string, locked: boolean): Plan {
  const plan = clonePlan(input);
  plan.nodes[id] = { ...plan.nodes[id], locked };
  if (!locked && plan.nodes[id].parentId) {
    // Re-share among the unpinned siblings by base so the freed node returns to a fair share.
    const parentId = plan.nodes[id].parentId!;
    const free = childrenOf(plan, parentId).filter((k) => !k.locked);
    const lockedSum = sum(childrenOf(plan, parentId).filter((k) => k.locked).map((k) => k.target));
    const parent = plan.nodes[parentId];
    const parts = allocate(Math.max(0, parent.target - lockedSum), free.map((k) => (parent.base26 > 0 ? k.base26 : k.target)), plan.step);
    free.forEach((k, i) => (plan.nodes[k.id] = { ...k, target: parts[i] }));
    const scaled: string[] = [];
    for (const k of free) splitDown(plan, k.id, scaled);
  }
  return plan;
}

/** Same growth for every child of a node (spread by base), clearing pins underneath it. */
export function spreadEvenGrowth(input: Plan, id: string): Plan {
  const plan = clonePlan(input);
  const go = (pid: string) => {
    const kids = childrenOf(plan, pid);
    const parts = allocate(plan.nodes[pid].target, kids.map((k) => k.base26), plan.step);
    kids.forEach((k, i) => (plan.nodes[k.id] = { ...k, target: parts[i], locked: false }));
    kids.forEach((k) => go(k.id));
  };
  go(id);
  return plan;
}

/**
 * Grow a unit and everything under it by the same % on top of the base-year
 * full year (e.g. 25 → every unit's target is its 2026 full year × 1.25).
 * Bottom-up plans add the new figures up to the levels above; top-down plans
 * treat it like typing the amount, so the level above keeps its total.
 */
export function applyGrowth(input: Plan, id: string, pct: number): { plan: Plan; report: ChangeReport } {
  const factor = Math.max(0, 1 + pct / 100);
  const node = input.nodes[id];
  const { plan, report } = setTarget(input, id, node.base26 * factor);
  const spread = spreadEvenGrowth(plan, id);
  if (spread.bottomUp || !node.parentId) {
    for (let p: string | null = node.parentId; p; p = spread.nodes[p].parentId) {
      spread.nodes[p] = { ...spread.nodes[p], target: sum(childrenOf(spread, p).map((k) => k.target)) };
    }
  }
  return { plan: spread, report: { ...report, to: spread.nodes[id].target } };
}

/** Change the rounding step and re-round the whole tree without moving the total by more than one step. */
export function changeStep(input: Plan, step: number): Plan {
  const plan = clonePlan(input);
  plan.step = step;
  for (const n of Object.values(plan.nodes)) if (n.locked) plan.nodes[n.id] = { ...n, target: roundTo(n.target, step) };
  const root = plan.nodes[plan.rootId];
  plan.nodes[root.id] = { ...root, target: roundTo(root.target, step) };
  splitDown(plan, root.id, []);
  return plan;
}

// ---- base year: actual months + estimate ----------------------------------------

/** 12 monthly weights for a node (its own, else the nearest parent's, else even). */
export function monthsOf(plan: Plan, id: string): number[] {
  let n: PlanNode | undefined = plan.nodes[id];
  while (n) {
    if (n.months?.length === 12) return n.months;
    n = n.parentId ? plan.nodes[n.parentId] : undefined;
  }
  return new Array(12).fill(1 / 12);
}

/** Share of the year covered by the first `n` months, by this node's phasing. */
export function cumShare(plan: Plan, id: string, n = plan.actualMonths): number {
  return sum(monthsOf(plan, id).slice(0, Math.max(0, Math.min(12, n))));
}

/** Actual so far: what someone typed, else the base split by phasing; parents add up their children. */
export function actualOf(plan: Plan, id: string): number {
  const n = plan.nodes[id];
  if (!n) return 0;
  if (n.actual !== undefined) return n.actual;
  if ((n.level === "network" || n.level === "site" || n.level === "coe" || n.level === "sub") && n.children.length && n.children.some((c) => hasActualBelow(plan, c)))
    return sum(n.children.map((c) => actualOf(plan, c)));
  return n.base26 * cumShare(plan, id);
}
function hasActualBelow(plan: Plan, id: string): boolean {
  const n = plan.nodes[id];
  if (!n) return false;
  if (n.actual !== undefined) return true;
  return n.children.some((c) => hasActualBelow(plan, c));
}

type Amount = "base26" | "prior25";

function rollUpBase(plan: Plan, id: string | null, field: Amount = "base26") {
  while (id) {
    const n = plan.nodes[id];
    const b = sum(childrenOf(plan, id).map((k) => k[field]));
    plan.nodes[id] = { ...n, [field]: b };
    id = n.parentId;
  }
}

/**
 * After a unit below changed, the units above are plain sums again: drop any
 * actual / prior-year figure typed on them, so the clear button doesn't bring
 * back a number that no longer adds up.
 */
function clearTypedAbove(plan: Plan, id: string | null, field: Amount) {
  while (id) {
    const n = plan.nodes[id];
    plan.nodes[id] =
      field === "prior25" ? { ...n, priorTyped: undefined, dataPrior25: undefined } : { ...n, actual: undefined, dataBase26: undefined };
    id = n.parentId;
  }
}

function rescaleBase(plan: Plan, id: string, newValue: number, field: Amount = "base26") {
  const n = plan.nodes[id];
  const kids = childrenOf(plan, id);
  // A figure typed lower down is replaced by its share of the new total.
  const untyped = field === "prior25" ? { priorTyped: undefined, dataPrior25: undefined } : { actual: undefined, dataBase26: undefined };
  plan.nodes[id] = { ...n, ...untyped, [field]: newValue };
  if (!kids.length) return;
  const old = sum(kids.map((k) => k[field]));
  const weights = old > 0 ? kids.map((k) => k[field]) : kids.map((k) => k.base26 || k.target || 1);
  const W = sum(weights);
  kids.forEach((k, i) => rescaleBase(plan, k.id, W > 0 ? (newValue * weights[i]) / W : newValue / kids.length, field));
}

/** Type the prior-year actual for a CoE / sub-unit (null = back to the data); totals above add up again. */
export function setPrior(input: Plan, id: string, priorTHB: number | null): Plan {
  const plan = clonePlan(input);
  const n = plan.nodes[id];
  const dataPrior = n.dataPrior25 ?? n.prior25;
  rescaleBase(plan, id, priorTHB === null ? dataPrior : Math.max(0, priorTHB), "prior25");
  plan.nodes[id] = {
    ...plan.nodes[id],
    priorTyped: priorTHB === null ? undefined : Math.max(0, priorTHB),
    dataPrior25: priorTHB === null ? undefined : dataPrior,
  };
  rollUpBase(plan, n.parentId, "prior25");
  clearTypedAbove(plan, n.parentId, "prior25");
  return plan;
}

/**
 * Start next year's plan from this one: this year's full year becomes the
 * prior year, this plan's targets become the base, and every unit starts at
 * `growth` % on top (pins, typed actuals and actual months reset).
 */
export function rollForward(input: Plan, growth = 0): Plan {
  const plan = clonePlan(input);
  for (const n of Object.values(plan.nodes)) {
    plan.nodes[n.id] = {
      ...n,
      prior25: n.base26,
      base26: n.target,
      baseVisits26: targetVisits(n),
      locked: false,
      actual: undefined,
      dataBase26: undefined,
      priorTyped: undefined,
      dataPrior25: undefined,
    };
  }
  plan.targetYear = input.targetYear + 1;
  plan.actualMonths = 0;
  plan.rolled = true;
  const root = plan.nodes[plan.rootId];
  plan.nodes[root.id] = { ...root, target: roundTo(root.base26 * (1 + growth / 100), plan.step) };
  return spreadEvenGrowth(plan, root.id);
}

/**
 * Type the actual so far for a CoE / sub-unit. Its full-year base becomes
 * actual ÷ (share of the year those months usually make up), and the bases above
 * it add up again. `null` goes back to the base from the data. Targets don't move.
 */
export function setActual(input: Plan, id: string, actualTHB: number | null): Plan {
  const plan = clonePlan(input);
  const n = plan.nodes[id];
  const dataBase = n.dataBase26 ?? n.base26;
  let base = dataBase;
  if (actualTHB !== null) {
    const share = cumShare(plan, id);
    base = share > 0 ? Math.max(0, actualTHB) / share : dataBase;
  }
  rescaleBase(plan, id, base);
  plan.nodes[id] = { ...plan.nodes[id], actual: actualTHB === null ? undefined : Math.max(0, actualTHB), dataBase26: actualTHB === null ? undefined : dataBase };
  rollUpBase(plan, n.parentId);
  clearTypedAbove(plan, n.parentId, "base26");
  return plan;
}

/** Type the base year's full year for a unit (CoE / sub / OPD-IPD / segment) directly (clears a typed actual). */
export function setBase(input: Plan, id: string, baseTHB: number): Plan {
  const plan = clonePlan(input);
  const n = plan.nodes[id];
  rescaleBase(plan, id, Math.max(0, baseTHB));
  plan.nodes[id] = { ...plan.nodes[id], actual: undefined, dataBase26: Math.max(0, baseTHB) };
  rollUpBase(plan, n.parentId);
  clearTypedAbove(plan, n.parentId, "base26");
  return plan;
}

/** Switch between totals fixed from the top and totals that add up from the units. */
export function setBottomUp(input: Plan, on: boolean): Plan {
  const plan = clonePlan(input);
  plan.bottomUp = on;
  return plan;
}

/** Change how many months are actual; typed actuals are re-annualised with the new split. */
export function setActualMonths(input: Plan, months: number): Plan {
  let plan = clonePlan(input);
  plan.actualMonths = Math.max(0, Math.min(12, Math.round(months)));
  for (const n of Object.values(plan.nodes)) if (n.actual !== undefined) plan = setActual(plan, n.id, plan.actualMonths > 0 ? n.actual : null);
  return plan;
}

// ---- CoE subs ------------------------------------------------------------------

const SEGMENTS = ["Thai", "Expat", "Fly-in"] as const;

/** Build OPD/IPD → segment children under `parentId` using the given ratios (base split). */
export function buildSettingBranch(
  plan: Plan,
  parentId: string,
  ratios: { opd: number; market: Record<(typeof SEGMENTS)[number], number> }
) {
  const parent = plan.nodes[parentId];
  parent.children = [];
  (["OPD", "IPD"] as const).forEach((setting) => {
    const sr = setting === "OPD" ? ratios.opd : 1 - ratios.opd;
    const sid = `${parentId}||${setting}`;
    plan.nodes[sid] = {
      id: sid,
      parentId,
      level: "setting",
      name: setting,
      site: parent.site,
      group: parent.group,
      children: [],
      base26: parent.base26 * sr,
      prior25: parent.prior25 * sr,
      baseVisits26: parent.baseVisits26 * (setting === "OPD" ? 0.85 : 0.15),
      target: 0,
      locked: false,
      months: parent.months,
    };
    parent.children.push(sid);
    for (const seg of SEGMENTS) {
      const r = ratios.market[seg];
      const mid = `${sid}||${seg}`;
      plan.nodes[mid] = {
        id: mid,
        parentId: sid,
        level: "market",
        name: seg,
        site: parent.site,
        group: parent.group,
        children: [],
        base26: plan.nodes[sid].base26 * r,
        prior25: plan.nodes[sid].prior25 * r,
        baseVisits26: plan.nodes[sid].baseVisits26 * r,
        target: 0,
        locked: false,
        months: parent.months,
      };
      plan.nodes[sid].children.push(mid);
    }
  });
}

/** Ratios currently used under a CoE/sub (so a new sub starts with the same OPD/IPD and segment mix). */
function ratiosUnder(plan: Plan, id: string) {
  const n = plan.nodes[id];
  const opd = plan.nodes[`${id}||OPD`];
  const opdRatio = opd && n.base26 > 0 ? opd.base26 / n.base26 : 0.55;
  const market = { Thai: 0.5, Expat: 0.25, "Fly-in": 0.25 } as Record<(typeof SEGMENTS)[number], number>;
  if (opd && opd.base26 > 0) for (const seg of SEGMENTS) market[seg] = (plan.nodes[`${opd.id}||${seg}`]?.base26 || 0) / opd.base26;
  return { opd: opdRatio, market };
}

/**
 * Add a sub-unit under a CoE/SBU. The first time, the CoE's current OPD/IPD
 * branch moves into a "Main" sub so nothing is lost; the new sub starts at 0
 * (pinned) and takes budget only when someone gives it a target.
 */
export function addSub(input: Plan, coeId: string, name: string): { plan: Plan; subId: string } {
  const plan = clonePlan(input);
  const coe = plan.nodes[coeId];
  const ratios = ratiosUnder(plan, coe.children[0]?.endsWith("||OPD") ? coeId : coe.children[0] || coeId);
  if (!coe.children.some((c) => plan.nodes[c]?.level === "sub")) {
    // Move the existing branch under "<CoE> · Main".
    const mainId = `${coeId}##main`;
    plan.nodes[mainId] = {
      id: mainId,
      parentId: coeId,
      level: "sub",
      name: "Main",
      site: coe.site,
      group: coe.group,
      children: [],
      base26: coe.base26,
      prior25: coe.prior25,
      baseVisits26: coe.baseVisits26,
      target: coe.target,
      locked: false,
      months: coe.months,
    };
    // Re-key the old branch under the main sub.
    const moveBranch = (oldId: string, newParent: string): string => {
      const old = plan.nodes[oldId];
      const newId = `${newParent}||${old.name}`;
      const moved: PlanNode = { ...old, id: newId, parentId: newParent, children: [] };
      delete plan.nodes[oldId];
      plan.nodes[newId] = moved;
      moved.children = old.children.map((c) => moveBranch(c, newId));
      return newId;
    };
    plan.nodes[mainId].children = coe.children.map((c) => moveBranch(c, mainId));
    coe.children = [mainId];
  }
  const slug = name.trim().replace(/[|#]+/g, " ").slice(0, 40) || "Sub";
  let subId = `${coeId}##${slug}`;
  for (let i = 2; plan.nodes[subId]; i++) subId = `${coeId}##${slug} ${i}`;
  plan.nodes[subId] = {
    id: subId,
    parentId: coeId,
    level: "sub",
    name: slug,
    site: coe.site,
    group: coe.group,
    children: [],
    base26: 0,
    prior25: 0,
    baseVisits26: 0,
    target: 0,
    locked: true,
    custom: true,
    months: coe.months,
  };
  buildSettingBranch(plan, subId, ratios);
  coe.children.push(subId);
  return { plan, subId };
}

export function renameSub(input: Plan, subId: string, name: string): Plan {
  const plan = clonePlan(input);
  plan.nodes[subId] = { ...plan.nodes[subId], name: name.trim().slice(0, 40) || plan.nodes[subId].name };
  return plan;
}

/** Remove a sub; its target goes back to the other subs. The last custom sub collapses "Main" back. */
export function removeSub(input: Plan, subId: string): Plan {
  let plan = clonePlan(input);
  const sub = plan.nodes[subId];
  const coeId = sub.parentId!;
  // Hand its budget back first, so the CoE total stays put.
  plan = setTarget(plan, subId, 0, { lock: true }).plan;
  walk(plan, subId, (n) => delete plan.nodes[n.id]);
  const coe = plan.nodes[coeId];
  coe.children = coe.children.filter((c) => c !== subId);
  const remaining = childrenOf(plan, coeId);
  if (remaining.length === 1 && remaining[0].id === `${coeId}##main`) {
    // Only "Main" is left: put its branch straight back under the CoE.
    const main = remaining[0];
    const moveBranch = (oldId: string, newParent: string): string => {
      const old = plan.nodes[oldId];
      const newId = `${newParent}||${old.name}`;
      const moved: PlanNode = { ...old, id: newId, parentId: newParent, children: [] };
      delete plan.nodes[oldId];
      plan.nodes[newId] = moved;
      moved.children = old.children.map((c) => moveBranch(c, newId));
      return newId;
    };
    coe.children = main.children.map((c) => moveBranch(c, coeId));
    delete plan.nodes[main.id];
  }
  const scaled: string[] = [];
  splitDown(plan, coeId, scaled);
  return plan;
}

// ---- saving --------------------------------------------------------------------

export interface PlanSnapshot {
  version: 2;
  step: number;
  targetYear?: number;
  bottomUp?: boolean;
  blank?: BlankStructure;
  // Plans rolled forward from another plan carry their own base / prior years.
  bases?: Record<string, number>;
  priors?: Record<string, number>;
  visits?: Record<string, number>;
  priorTyped?: Record<string, number>;
  actualMonths?: number;
  actuals?: Record<string, number>; // THB actual so far, per CoE / sub-unit
  targets: Record<string, number>; // THB per node id
  locked: string[];
  subs: { coeId: string; name: string }[];
}

export function toSnapshot(plan: Plan): PlanSnapshot {
  const targets: Record<string, number> = {};
  const locked: string[] = [];
  const subs: PlanSnapshot["subs"] = [];
  const actuals: Record<string, number> = {};
  const priorTyped: Record<string, number> = {};
  const rolled = plan.rolled;
  const bases: Record<string, number> = {};
  const priors: Record<string, number> = {};
  const visits: Record<string, number> = {};
  for (const n of Object.values(plan.nodes)) {
    if (n.actual !== undefined) actuals[n.id] = Math.round(n.actual);
    if (n.priorTyped !== undefined) priorTyped[n.id] = Math.round(n.priorTyped);
    if (rolled) {
      bases[n.id] = Math.round(n.dataBase26 ?? n.base26);
      priors[n.id] = Math.round(n.dataPrior25 ?? n.prior25);
      visits[n.id] = Math.round(n.baseVisits26);
    }
    targets[n.id] = Math.round(n.target);
    if (n.locked) locked.push(n.id);
    if (n.custom && n.level === "sub") subs.push({ coeId: n.parentId!, name: n.name });
  }
  return {
    version: 2,
    step: plan.step,
    targetYear: plan.targetYear,
    bottomUp: plan.bottomUp,
    blank: plan.blank,
    actualMonths: plan.actualMonths,
    actuals,
    priorTyped,
    ...(rolled ? { bases, priors, visits } : {}),
    targets,
    locked,
    subs,
  };
}

/**
 * Rebuild a saved plan on top of today's base tree: add the saved subs, then apply
 * targets top-down (each level re-split so the sums always hold, even if the
 * saved numbers were from an older structure).
 */
export function fromSnapshot(base: Plan, snap: PlanSnapshot): Plan {
  let plan = clonePlan(base);
  if (snap.step) plan.step = snap.step;
  for (const s of snap.subs || []) if (plan.nodes[s.coeId]) plan = addSub(plan, s.coeId, s.name).plan;
  if (typeof snap.targetYear === "number") plan.targetYear = snap.targetYear;
  if (snap.bottomUp) plan.bottomUp = true;
  if (snap.bases) {
    // A rolled-forward plan: its own base and prior years replace the data's.
    plan.rolled = true;
    for (const n of Object.values(plan.nodes)) {
      plan.nodes[n.id] = {
        ...n,
        base26: snap.bases[n.id] ?? n.base26,
        prior25: snap.priors?.[n.id] ?? n.prior25,
        baseVisits26: snap.visits?.[n.id] ?? n.baseVisits26,
      };
    }
  }
  if (typeof snap.actualMonths === "number") plan.actualMonths = snap.actualMonths;
  for (const [id, v] of Object.entries(snap.priorTyped || {})) if (plan.nodes[id]) plan = setPrior(plan, id, v);
  for (const [id, a] of Object.entries(snap.actuals || {})) if (plan.nodes[id]) plan = setActual(plan, id, a);
  const locked = new Set(snap.locked || []);
  const t = snap.targets || {};
  // Use saved targets as weights, level by level.
  const apply = (id: string) => {
    const n = plan.nodes[id];
    if (!n) return;
    const kids = childrenOf(plan, id);
    if (!kids.length) return;
    const given = kids.filter((k) => t[k.id] !== undefined);
    const givenSum = sum(given.map((k) => roundTo(t[k.id], plan.step)));
    let parts: number[];
    if (given.length && given.length < kids.length && givenSum <= n.target) {
      // Only some were saved (older scenarios): keep those exactly, the rest share what's left.
      const rest = kids.filter((k) => t[k.id] === undefined);
      const restParts = allocate(n.target - givenSum, rest.map((k) => k.target || k.base26), plan.step);
      parts = kids.map((k) => (t[k.id] !== undefined ? roundTo(t[k.id], plan.step) : restParts[rest.indexOf(k)]));
    } else {
      parts = allocate(n.target, kids.map((k) => (t[k.id] !== undefined ? t[k.id] : k.target || k.base26)), plan.step);
    }
    kids.forEach((k, i) => (plan.nodes[k.id] = { ...k, target: parts[i], locked: locked.has(k.id) }));
    kids.forEach((k) => apply(k.id));
  };
  const root = plan.nodes[plan.rootId];
  plan.nodes[root.id] = { ...root, target: roundTo(t[root.id] ?? root.target, plan.step) };
  apply(root.id);
  return plan;
}
