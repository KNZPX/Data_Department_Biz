// EBO (Emerging Business Opportunity) plan for one CoE / SBU in one target year.
//
// The unit's business is split into three horizons:
//   H1 mature business (today's core), H2 growth business, H3 future business.
// Each horizon lists key products (flagship or not, with optional sub-items):
// revenue two years back and the base year, the target-year plan as
// cases × average revenue per case, patients (HN) per year, and how the
// target splits across hospitals. The CoE's own target comes from the saved
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
  revPrior: number | null; // THB, two years before the target year
  revBase: number | null; // THB, the year before (actual + forecast)
  vol: number | null; // target-year cases
  avg: number | null; // target-year average revenue per case
  /** Target revenue typed directly when there's no case count to multiply. */
  revTarget?: number | null;
  hnBase: number | null; // patients (HN) in the base year
  hnPrior: number | null; // patients (HN) two years back
  /** % of the target per hospital code; empty = follow the CoE's split in the Target plan. */
  split: Record<string, number>;
  note?: string;
};
export type EboHorizon = { title: string; focus: string; items: EboItem[] };
export type EboPlanData = {
  horizons: Record<HorizonId, EboHorizon>;
  milestone?: string;
  /** Used only when no Target plan covers this unit yet. */
  manualTarget?: number | null;
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
  return { id: newId(), name: "", parentId, flagship: !parentId, revPrior: null, revBase: null, vol: null, avg: null, hnBase: null, hnPrior: null, split: {} };
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
          revBase: numOrNull(i.revBase),
          vol: numOrNull(i.vol),
          avg: numOrNull(i.avg),
          revTarget: numOrNull(i.revTarget),
          hnBase: numOrNull(i.hnBase),
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
    notes: typeof r?.notes === "string" ? r.notes : undefined,
  };
}

// ---- numbers ------------------------------------------------------------------

/** One line's figures; null where nothing is known yet. */
export type Figures = {
  revPrior: number | null;
  revBase: number | null;
  vol: number | null;
  target: number | null;
  hnBase: number | null;
  hnPrior: number | null;
};

const add = (a: number | null, b: number | null) => (a === null ? b : b === null ? a : a + b);

function sumFigures(list: Figures[]): Figures {
  return list.reduce<Figures>(
    (acc, f) => ({
      revPrior: add(acc.revPrior, f.revPrior),
      revBase: add(acc.revBase, f.revBase),
      vol: add(acc.vol, f.vol),
      target: add(acc.target, f.target),
      hnBase: add(acc.hnBase, f.hnBase),
      hnPrior: add(acc.hnPrior, f.hnPrior),
    }),
    { revPrior: null, revBase: null, vol: null, target: null, hnBase: null, hnPrior: null }
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
  return { revPrior: it.revPrior, revBase: it.revBase, vol: it.vol, target: lineTarget(it), hnBase: it.hnBase, hnPrior: it.hnPrior };
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
