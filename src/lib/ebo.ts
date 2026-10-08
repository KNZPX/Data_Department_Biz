// EBO (Emerging Business Opportunity) plan for one CoE / SBU in one target year.
//
// The unit's business is split into three horizons:
//   H1 mature business (today's core), H2 growth business, H3 future business.
// Each horizon lists key products (flagship or not, with optional sub-items):
// revenue and patients (HN) as a baseline two years back, this year's actual
// so far (for a stated number of months or days) and full-year forecast, the
// target-year plan as cases × average revenue per case, and how the target
// splits across hospitals. The CoE's own target comes from the saved
// Target plan, so the page shows how far the products cover it.
// Pure functions only — no React — so the numbers are easy to check.

export type HorizonId = "H1" | "H2" | "H3";
export const HORIZON_IDS: HorizonId[] = ["H1", "H2", "H3"];

export const HORIZON_META: Record<HorizonId, { title: string; focus: string; color: string; tone: string }> = {
  H1: { title: "Mature business", focus: "Improve medical competency and efficiency", color: "#16a34a", tone: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  H2: { title: "Growth business", focus: "Market expansion", color: "#c026d3", tone: "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200" },
  H3: { title: "Future business", focus: "Market penetration", color: "#2563eb", tone: "bg-blue-50 text-blue-700 ring-blue-200" },
};

export type EboItem = {
  id: string;
  name: string;
  /** Set on a sub-item (1.1 under 1.); a parent's numbers add up from its sub-items. */
  parentId?: string;
  flagship: boolean;
  revPrior: number | null; // THB, two years before the target year (baseline)
  /** THB, this year's actual so far (the plan's actualPeriod). */
  revActual?: number | null;
  revBase: number | null; // THB, this year's full-year forecast (actual + estimate)
  vol: number | null; // target-year cases
  avg: number | null; // target-year average revenue per case
  /** Target revenue typed directly when there's no case count to multiply. */
  revTarget?: number | null;
  hnBase: number | null; // patients (HN), this year's full-year forecast
  /** Patients (HN) this year so far. */
  hnActual?: number | null;
  hnPrior: number | null; // patients (HN) two years back (baseline)
  /** % of the target per hospital code; empty = follow the CoE's split in the Target plan. */
  split: Record<string, number>;
  note?: string;
};
export type EboHorizon = { title: string; focus: string; items: EboItem[] };
/** How much of this year the actual columns cover: N months from January, or N days. */
export type ActualPeriod = { unit: "months" | "days"; n: number };
export type EboPlanData = {
  horizons: Record<HorizonId, EboHorizon>;
  milestone?: string;
  /** A target typed on this page (e.g. the CoE's own sheet). */
  manualTarget?: number | null;
  /** Which target the plan is measured against: the linked Target plan (default) or the typed one. */
  targetSource?: "plan" | "manual";
  /** What the actual-this-year columns cover. */
  actualPeriod?: ActualPeriod;
  notes?: string;
};
export type EboPlanRow = { id: string; year: number; unit: string; data: EboPlanData; updated_by: string | null; updated_at: string };

export const eboId = (year: number, unit: string) => `${year}::${unit}`.slice(0, 200);
export const newId = (p = "it") => `${p}_${Math.random().toString(36).slice(2, 9)}`;

export function emptyEbo(): EboPlanData {
  return {
    horizons: {
      H1: { title: HORIZON_META.H1.title, focus: HORIZON_META.H1.focus, items: [] },
      H2: { title: HORIZON_META.H2.title, focus: HORIZON_META.H2.focus, items: [] },
      H3: { title: HORIZON_META.H3.title, focus: HORIZON_META.H3.focus, items: [] },
    },
  };
}

export function blankItem(parentId?: string): EboItem {
  return { id: newId(), name: "", parentId, flagship: !parentId, revPrior: null, revActual: null, revBase: null, vol: null, avg: null, hnBase: null, hnActual: null, hnPrior: null, split: {} };
}

const numOrNull = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Clean up whatever came back from storage. */
export function normalizeEbo(raw: unknown): EboPlanData {
  const r = raw as Partial<EboPlanData> | null;
  const base = emptyEbo();
  for (const h of HORIZON_IDS) {
    const src = r?.horizons?.[h];
    if (!src) continue;
    const items = Array.isArray(src.items) ? src.items : [];
    const ids = new Set(items.map((i) => i?.id));
    base.horizons[h] = {
      title: typeof src.title === "string" ? src.title : HORIZON_META[h].title,
      focus: typeof src.focus === "string" ? src.focus : HORIZON_META[h].focus,
      items: items
        .filter((i) => i && typeof i.id === "string")
        .map((i) => ({
          id: i.id,
          name: String(i.name || ""),
          // A sub-item whose parent is gone becomes a top-level item.
          parentId: i.parentId && ids.has(i.parentId) ? i.parentId : undefined,
          flagship: Boolean(i.flagship),
          revPrior: numOrNull(i.revPrior),
          revActual: numOrNull(i.revActual),
          revBase: numOrNull(i.revBase),
          vol: numOrNull(i.vol),
          avg: numOrNull(i.avg),
          revTarget: numOrNull(i.revTarget),
          hnBase: numOrNull(i.hnBase),
          hnActual: numOrNull(i.hnActual),
          hnPrior: numOrNull(i.hnPrior),
          split: Object.fromEntries(Object.entries(i.split || {}).filter(([, v]) => typeof v === "number" && Number.isFinite(v))),
          note: i.note ? String(i.note) : undefined,
        })),
    };
  }
  return {
    ...base,
    milestone: typeof r?.milestone === "string" ? r.milestone : undefined,
    manualTarget: numOrNull(r?.manualTarget),
    targetSource: r?.targetSource === "manual" ? "manual" : undefined,
    actualPeriod: normalizePeriod(r?.actualPeriod),
    notes: typeof r?.notes === "string" ? r.notes : undefined,
  };
}

// ---- numbers ------------------------------------------------------------------

/** One line's figures; null where nothing is known yet. */
export type Figures = {
  revPrior: number | null;
  revActual: number | null;
  revBase: number | null;
  vol: number | null;
  target: number | null;
  hnBase: number | null;
  hnActual: number | null;
  hnPrior: number | null;
};

const add = (a: number | null, b: number | null) => (a === null ? b : b === null ? a : a + b);

function sumFigures(list: Figures[]): Figures {
  return list.reduce<Figures>(
    (acc, f) => ({
      revPrior: add(acc.revPrior, f.revPrior),
      revActual: add(acc.revActual, f.revActual),
      revBase: add(acc.revBase, f.revBase),
      vol: add(acc.vol, f.vol),
      target: add(acc.target, f.target),
      hnBase: add(acc.hnBase, f.hnBase),
      hnActual: add(acc.hnActual, f.hnActual),
      hnPrior: add(acc.hnPrior, f.hnPrior),
    }),
    { revPrior: null, revActual: null, revBase: null, vol: null, target: null, hnBase: null, hnActual: null, hnPrior: null }
  );
}

/** Target revenue of a single line: cases × average, or the amount typed. */
export function lineTarget(it: Pick<EboItem, "vol" | "avg" | "revTarget">): number | null {
  if (it.revTarget !== null && it.revTarget !== undefined) return it.revTarget;
  if (it.vol !== null && it.avg !== null) return it.vol * it.avg;
  return null;
}

export const childrenOf = (items: EboItem[], id: string) => items.filter((i) => i.parentId === id);
export const topItems = (items: EboItem[]) => items.filter((i) => !i.parentId);

/** An item's figures; an item with sub-items adds them up. */
export function itemFigures(items: EboItem[], it: EboItem): Figures {
  const kids = childrenOf(items, it.id);
  if (kids.length) return sumFigures(kids.map((k) => itemFigures(items, k)));
  return { revPrior: it.revPrior, revActual: it.revActual ?? null, revBase: it.revBase, vol: it.vol, target: lineTarget(it), hnBase: it.hnBase, hnActual: it.hnActual ?? null, hnPrior: it.hnPrior };
}

export function horizonFigures(h: EboHorizon): Figures {
  return sumFigures(topItems(h.items).map((it) => itemFigures(h.items, it)));
}

export function planFigures(d: EboPlanData): Figures {
  return sumFigures(HORIZON_IDS.map((h) => horizonFigures(d.horizons[h])));
}

/** b → a growth as a fraction (0.12 = +12%), or null when it can't be worked out. */
export function growth(a: number | null, b: number | null): number | null {
  if (a === null || b === null || b === 0) return null;
  return a / b - 1;
}

export const per = (rev: number | null, n: number | null) => (rev === null || n === null || n === 0 ? null : rev / n);

/** Every line with its number ("1.", "1.1") in display order. */
export function numbered(items: EboItem[]): { item: EboItem; no: string; depth: number }[] {
  const out: { item: EboItem; no: string; depth: number }[] = [];
  topItems(items).forEach((it, i) => {
    out.push({ item: it, no: `${i + 1}.`, depth: 0 });
    childrenOf(items, it.id).forEach((k, j) => out.push({ item: k, no: `${i + 1}.${j + 1}`, depth: 1 }));
  });
  return out;
}

/** A line's hospital split as fractions (adds to 1), falling back to its parent, then to `fallback`. */
export function splitOf(items: EboItem[], it: EboItem, fallback: Record<string, number>): Record<string, number> {
  const own = Object.entries(it.split).filter(([, v]) => v > 0);
  if (own.length) {
    const tot = own.reduce((a, [, v]) => a + v, 0);
    return Object.fromEntries(own.map(([k, v]) => [k, v / tot]));
  }
  const parent = it.parentId ? items.find((i) => i.id === it.parentId) : undefined;
  return parent ? splitOf(items, parent, fallback) : fallback;
}

/** The plan's target revenue per hospital: each leaf line split by its own (or inherited) shares. */
export function siteAllocation(d: EboPlanData, fallback: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const h of HORIZON_IDS) {
    const items = d.horizons[h].items;
    for (const it of items) {
      if (childrenOf(items, it.id).length) continue;
      const t = lineTarget(it);
      if (t === null) continue;
      for (const [site, share] of Object.entries(splitOf(items, it, fallback))) out[site] = (out[site] || 0) + t * share;
    }
  }
  return out;
}

/** Product names for the horizon chart: flagship and non-flagship top-level items. */
export function productNames(h: EboHorizon) {
  const tops = topItems(h.items).filter((i) => i.name.trim());
  return { flagship: tops.filter((i) => i.flagship).map((i) => i.name.trim()), other: tops.filter((i) => !i.flagship).map((i) => i.name.trim()) };
}

export type ResolvedTarget = { value: number | null; from: "plan" | "manual" | "none"; plan: number | null; manual: number | null };

/** The target a unit is measured against: the Target plan's, unless the typed one is chosen (or the plan has none). */
export function resolveTarget(planTarget: number | null | undefined, d?: EboPlanData | null): ResolvedTarget {
  const plan = planTarget && planTarget > 0 ? planTarget : null;
  const manual = d?.manualTarget ?? null;
  if (d?.targetSource === "manual" || (plan === null && manual !== null)) return { value: manual, from: "manual", plan, manual };
  if (plan !== null) return { value: plan, from: "plan", plan, manual };
  return { value: null, from: "none", plan, manual };
}

/** How far `amount` is from `target`: THB (negative = short) and as a share of the target. */
export function diffTo(target: number | null, amount: number | null) {
  if (target === null || target === 0) return null;
  const a = amount ?? 0;
  return { thb: a - target, pct: (a - target) / target, needed: target - a, neededPct: a ? target / a - 1 : null };
}

// ---- this year's actual so far ------------------------------------------------------

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function normalizePeriod(raw: unknown): ActualPeriod | undefined {
  const r = raw as Partial<ActualPeriod> | null;
  if (!r || (r.unit !== "months" && r.unit !== "days") || typeof r.n !== "number" || !Number.isFinite(r.n)) return undefined;
  const n = Math.round(r.n);
  return r.unit === "months" ? { unit: "months", n: Math.max(1, Math.min(12, n)) } : { unit: "days", n: Math.max(1, Math.min(366, n)) };
}

/** Until someone says otherwise: the whole months of `year` that are over by `today`. */
export function defaultPeriod(year: number, today = new Date()): ActualPeriod {
  if (year < today.getFullYear()) return { unit: "months", n: 12 };
  if (year > today.getFullYear()) return { unit: "months", n: 1 };
  return { unit: "months", n: Math.max(1, today.getMonth()) };
}

export const periodOf = (d: Pick<EboPlanData, "actualPeriod">, year: number) => d.actualPeriod ?? defaultPeriod(year);

/** "Jan–Sep · 9 mo" or "273 days". */
export function periodLabel(p: ActualPeriod) {
  if (p.unit === "days") return `${p.n} days`;
  return p.n === 1 ? "Jan · 1 mo" : `Jan–${MONTHS[p.n - 1]} · ${p.n} mo`;
}

const daysIn = (year: number) => (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 366 : 365);

/** The full year at the pace of the actual so far (the run-rate), or null. */
export function runRate(actual: number | null | undefined, p: ActualPeriod, year: number): number | null {
  if (actual === null || actual === undefined || p.n <= 0) return null;
  return p.unit === "months" ? (actual * 12) / p.n : (actual * daysIn(year)) / p.n;
}
