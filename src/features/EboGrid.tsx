"use client";

// EBO key products as a spreadsheet: type or paste straight in. Pasting a block
// copied from Excel (several cells, a whole row or a whole column) fills the
// grid from the cell you're in, adding key products when it runs past the last
// row. Enter / ↑ / ↓ move between rows. Revenue and patients (HN) are separate
// sections: baseline two years back, actual this year so far (can be hidden),
// full-year forecast, then the target year. The hospital split shows as a bar.
import { Fragment, useId, useRef, useState } from "react";
import { ArrowDown, ArrowUp, CornerDownRight, Eye, EyeOff, Plus, Trash2, X } from "lucide-react";
import { clsx } from "clsx";
import { confirmDialog, toast } from "@/components/feedback";
import { HOSPITAL_PROFILES } from "@/data/targetScenarioData";
import {
  HORIZON_IDS,
  HORIZON_META,
  blankItem,
  childrenOf,
  growth,
  horizonFigures,
  itemFigures,
  lineTarget,
  numbered,
  per,
  planFigures,
  periodLabel,
  periodOf,
  runRate,
  splitOf,
  type EboItem,
  type EboPlanData,
  type Figures,
  type HorizonId,
} from "@/lib/ebo";

// ---- view ---------------------------------------------------------------------------------------

/** Each person's choice of what the key-product tables show. */
export type GridView = { mode: "horizon" | "table"; revActual: boolean; hnActual: boolean; split: boolean };
export const DEFAULT_VIEW: GridView = { mode: "horizon", revActual: true, hnActual: true, split: false };

type ColKey = "horizon" | "name" | "type" | "revPrior" | "revActual" | "revBase" | "g1" | "vol" | "avg" | "target" | "g2" | "hnPrior" | "hnActual" | "hnBase" | "gHn" | "perHn" | "split";
const REV: ColKey[] = ["revPrior", "revActual", "revBase", "g1", "vol", "avg", "target", "g2"];
const HN: ColKey[] = ["hnPrior", "hnActual", "hnBase", "gHn", "perHn"];
const NUM_KEYS = new Set<ColKey>(["revPrior", "revActual", "revBase", "vol", "avg", "target", "hnPrior", "hnActual", "hnBase"]);

/** The columns on screen, left to right (pasting follows this order). */
export function gridCols(view: GridView, withHorizon: boolean): ColKey[] {
  return [
    ...(withHorizon ? (["horizon"] as ColKey[]) : []),
    "name",
    "type",
    ...REV.filter((k) => k !== "revActual" || view.revActual),
    ...HN.filter((k) => k !== "hnActual" || view.hnActual),
    ...(view.split ? (["split"] as ColKey[]) : []),
  ];
}

function colLabel(k: ColKey, year: number, period: string): [string, string?] {
  const P = year - 2;
  const B = year - 1;
  switch (k) {
    case "horizon":
      return ["H"];
    case "name":
      return ["Key product"];
    case "type":
      return ["Type"];
    case "revPrior":
    case "hnPrior":
      return [`Baseline ${P}`, "full year"];
    case "revActual":
    case "hnActual":
      return [`Actual ${B}`, period];
    case "revBase":
    case "hnBase":
      return [`Forecast ${B}`, "full year"];
    case "g1":
    case "gHn":
      return ["%Growth", `${B}F vs ${P}`];
    case "vol":
      return [`Cases ${year}`];
    case "avg":
      return ["Avg / case"];
    case "target":
      return [`Target ${year}`];
    case "g2":
      return ["%Growth", `vs ${B}F`];
    case "perHn":
      return ["Rev / HN", `${B}F`];
    case "split":
      return ["Portion by hospital"];
  }
}

// ---- formatting & parsing -------------------------------------------------------------------------

const thb = (v: number | null) => (v === null ? "—" : Math.round(v).toLocaleString("en-US"));
const pct = (g: number | null) => (g === null || !Number.isFinite(g) ? "—" : `${g > 0 ? "+" : ""}${(g * 100).toFixed(1)}%`);
const siteLabel = (code: string) => code.replace(" (Premium)", "");
const SITE_COLORS = ["#2563eb", "#0891b2", "#7c3aed", "#ea580c", "#16a34a"];
const siteColor = (code: string, i: number) => HOSPITAL_PROFILES[code]?.color || SITE_COLORS[i % SITE_COLORS.length];

/** "1,234", "1.5m", "250k", "(3,000)", "-3,000" → number; blank → null; anything else → NaN. */
export function parseNum(raw: string): number | null {
  let s = raw.replace(/[,\s฿ ]/g, "").replace(/−/g, "-").toLowerCase();
  if (!s || s === "-" || s === "—") return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1);
  }
  const m = s.match(/^(-?\d*\.?\d+)(k|m|mb)?$/);
  if (!m) return NaN;
  const n = Number(m[1]) * (m[2] === "k" ? 1e3 : m[2] ? 1e6 : 1);
  return Number.isFinite(n) ? (neg ? -n : n) : NaN;
}

/** More than one cell (a tab or a line break inside), i.e. a block copied from a sheet. */
const isBlock = (text: string) => /[\t\n]/.test(text.replace(/\r?\n$/, ""));

/** Tab-separated text (as Excel and Google Sheets copy it) → rows of cells. Quoted cells may hold line breaks. */
export function parseTsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const t = text.replace(/\r\n?/g, "\n").replace(/\n$/, "");
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (quoted) {
      if (ch === '"' && t[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === "\t") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

function parseHorizon(raw: string | undefined): HorizonId | null {
  const s = (raw || "").trim().toLowerCase();
  if (/^h?1$|^mature/.test(s)) return "H1";
  if (/^h?2$|^growth/.test(s)) return "H2";
  if (/^h?3$|^future/.test(s)) return "H3";
  return null;
}
function parseFlagship(raw: string): boolean | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  if (/^(non|n$|no$|0$|false|-)/.test(s)) return false;
  if (/^(flag|y$|yes|1$|true|✓|x$)/.test(s)) return true;
  return null;
}

// ---- pasting ------------------------------------------------------------------------------------------

type RowRef = { h: HorizonId; id: string };

function locate(d: EboPlanData, id: string) {
  for (const h of HORIZON_IDS) {
    const items = d.horizons[h].items;
    const item = items.find((i) => i.id === id);
    if (item) return { h, items, item };
  }
  return null;
}

/** What one pasted cell changes on a line, or null when that column can't take it. */
function cellPatch(item: EboItem, key: ColKey, raw: string, hasKids: boolean): Partial<EboItem> | null {
  if (key === "name") return raw.trim() ? { name: raw.trim() } : null;
  if (key === "type") {
    const f = item.parentId ? null : parseFlagship(raw);
    return f === null ? null : { flagship: f };
  }
  if (!NUM_KEYS.has(key) || hasKids) return null;
  const v = parseNum(raw);
  if (v !== null && Number.isNaN(v)) return null;
  if (key === "avg") return { avg: v, revTarget: null };
  if (key === "target") return v !== null && item.vol ? { avg: v / item.vol, revTarget: null } : { revTarget: v };
  return { [key]: v } as Partial<EboItem>;
}

/** Apply a pasted block starting at row r0, column c0 (mutates `d`). */
function applyPaste(d: EboPlanData, rows: RowRef[], keys: ColKey[], r0: number, c0: number, block: string[][], fallbackH: HorizonId) {
  let changed = 0;
  let added = 0;
  let lastH = rows[r0]?.h ?? fallbackH;
  const hCol = keys.indexOf("horizon") - c0;
  block.forEach((cells, i) => {
    if (cells.every((c) => !c.trim())) return;
    const ref = rows[r0 + i];
    let id: string;
    if (ref) {
      id = ref.id;
      lastH = ref.h;
    } else {
      const h = (hCol >= 0 && parseHorizon(cells[hCol])) || lastH;
      const it = blankItem();
      d.horizons[h].items.push(it);
      id = it.id;
      lastH = h;
      added++;
    }
    cells.forEach((raw, j) => {
      const key = keys[c0 + j];
      const loc = key ? locate(d, id) : null;
      if (!key || !loc) return;
      if (key === "horizon") {
        const to = parseHorizon(raw);
        if (to && to !== loc.h && !loc.item.parentId) {
          const moving = loc.items.filter((x) => x.id === id || x.parentId === id);
          d.horizons[loc.h].items = loc.items.filter((x) => !moving.includes(x));
          d.horizons[to].items.push(...moving);
          changed++;
        }
        return;
      }
      const patch = cellPatch(loc.item, key, raw, loc.items.some((x) => x.parentId === id));
      if (patch) {
        Object.assign(loc.item, patch);
        changed++;
      }
    });
  });
  return { changed, added };
}

/** The grid as tab-separated text, ready to paste into Excel. */
export function gridTsv(d: EboPlanData, year: number, view: GridView, sites: string[], fallback: Record<string, number>) {
  const keys = gridCols(view, true).filter((k) => k !== "split");
  const period = periodLabel(periodOf(d, year - 1));
  const head = [...keys.map((k) => colLabel(k, year, period).join(" ").replace(/ full year$/, "")), ...(view.split ? sites.map((s) => `${siteLabel(s)} %`) : [])];
  const lines = [head.join("\t")];
  for (const h of HORIZON_IDS) {
    const items = d.horizons[h].items;
    for (const { item, depth } of numbered(items)) {
      const f = itemFigures(items, item);
      const shares = splitOf(items, item, fallback);
      const val = (k: ColKey): string => {
        const n = (v: number | null) => (v === null ? "" : String(Math.round(v * 100) / 100));
        const g = (v: number | null) => (v === null ? "" : `${(v * 100).toFixed(1)}%`);
        switch (k) {
          case "horizon":
            return h;
          case "name":
            return `${depth ? "  " : ""}${item.name}`;
          case "type":
            return depth ? "" : item.flagship ? "Flagship" : "Non-flagship";
          case "g1":
            return g(growth(f.revBase, f.revPrior));
          case "g2":
            return g(growth(f.target, f.revBase));
          case "gHn":
            return g(growth(f.hnBase, f.hnPrior));
          case "perHn":
            return n(per(f.revBase, f.hnBase));
          case "avg":
            return n(per(f.target, f.vol));
          default:
            return n(f[k as keyof Figures] ?? null);
        }
      };
      lines.push([...keys.map(val), ...(view.split ? sites.map((s) => String(Math.round((shares[s] || 0) * 1000) / 10)) : [])].join("\t"));
    }
  }
  return lines.join("\n");
}

// ---- the grid -----------------------------------------------------------------------------------------

const th = "border-b border-slate-200 px-2 py-1.5 text-right text-[11px] font-medium whitespace-nowrap align-bottom";
const td = "border-b border-slate-100 px-1 py-0.5 text-right tabular-nums";
const numCls =
  "h-7 w-full min-w-[92px] rounded-md border border-transparent bg-transparent px-1.5 text-right text-[12.5px] tabular-nums text-slate-800 outline-none transition hover:border-slate-200 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 read-only:hover:border-transparent placeholder:text-slate-300";
const SECTION_START = new Set<ColKey>(["revPrior", "hnPrior", "split"]);
const sectionOf = (k: ColKey) => (REV.includes(k) ? "rev" : HN.includes(k) ? "hn" : k === "split" ? "split" : "product");
const SECTION_TONE = { rev: "bg-blue-50/70 text-blue-900", hn: "bg-teal-50/70 text-teal-900", split: "bg-slate-50 text-slate-600", product: "bg-slate-50 text-slate-500" };

export function EboGrid({
  year,
  data,
  horizons,
  withHorizon,
  view,
  setView,
  sites,
  fallback,
  canEdit,
  update,
}: {
  year: number;
  data: EboPlanData;
  /** The horizons in this grid: one (a horizon's own table) or all three (one table). */
  horizons: HorizonId[];
  withHorizon: boolean;
  view: GridView;
  setView: (v: GridView) => void;
  sites: string[];
  fallback: Record<string, number>;
  canEdit: boolean;
  update?: (f: (d: EboPlanData) => EboPlanData) => void;
}) {
  const gid = useId();
  const ro = !canEdit || !update;
  const keys = gridCols(view, withHorizon);
  const B = year - 1;
  const period = periodOf(data, B);
  const pLabel = periodLabel(period);
  const [splitOpen, setSplitOpen] = useState<string | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  // Every line on screen, in order; r indexes these (group and total rows don't count).
  const rows = horizons.flatMap((h) => numbered(data.horizons[h].items).map((x) => ({ h, ...x })));
  const refs: RowRef[] = rows.map((x) => ({ h: x.h, id: x.item.id }));
  const rowIndex = new Map(rows.map((x, i) => [x.item.id, i]));

  const edit = (f: (d: EboPlanData) => void) =>
    update?.((d) => {
      f(d);
      return d;
    });
  const setItem = (id: string, p: Partial<EboItem>) =>
    edit((d) => {
      const loc = locate(d, id);
      if (loc) Object.assign(loc.item, p);
    });
  const addItem = (h: HorizonId, parentId?: string) =>
    edit((d) => {
      const items = d.horizons[h].items;
      const it = blankItem(parentId);
      if (!parentId) return void items.push(it);
      // Sub-items go right after their parent's last sub-item.
      const kids = childrenOf(items, parentId);
      const after = kids.length ? kids[kids.length - 1].id : parentId;
      items.splice(items.findIndex((i) => i.id === after) + 1, 0, it);
    });
  const removeItem = async (h: HorizonId, it: EboItem) => {
    const kids = childrenOf(data.horizons[h].items, it.id);
    if (kids.length || it.name || lineTarget(it) !== null) {
      const ok = await confirmDialog({
        title: `Remove ${it.name || "this line"}?`,
        body: kids.length ? `Its ${kids.length} sub-item${kids.length > 1 ? "s go" : " goes"} too. You can restore it from the Activity log.` : "You can restore it from the Activity log.",
        confirmLabel: "Remove",
        danger: true,
      });
      if (!ok) return;
    }
    edit((d) => {
      d.horizons[h].items = d.horizons[h].items.filter((i) => i.id !== it.id && i.parentId !== it.id);
    });
  };
  /** Move a line (with its sub-items) one place up or down among its siblings. */
  const move = (h: HorizonId, it: EboItem, dir: -1 | 1) =>
    edit((d) => {
      const x = d.horizons[h];
      const sibs = x.items.filter((i) => (i.parentId || null) === (it.parentId || null));
      const k = sibs.findIndex((i) => i.id === it.id);
      const other = sibs[k + dir];
      if (!other) return;
      if (!it.parentId) {
        const tops = [...sibs];
        [tops[k], tops[k + dir]] = [tops[k + dir], tops[k]];
        x.items = tops.flatMap((tp) => x.items.filter((i) => i.id === tp.id || i.parentId === tp.id));
        return;
      }
      const a = x.items.findIndex((i) => i.id === it.id);
      const b = x.items.findIndex((i) => i.id === other.id);
      [x.items[a], x.items[b]] = [x.items[b], x.items[a]];
    });
  const moveTo = (from: HorizonId, it: EboItem, to: HorizonId) =>
    edit((d) => {
      const moving = d.horizons[from].items.filter((i) => i.id === it.id || i.parentId === it.id);
      d.horizons[from].items = d.horizons[from].items.filter((i) => !moving.includes(i));
      d.horizons[to].items.push(...moving);
    });

  function paste(r: number, c: number, text: string) {
    if (ro) return;
    const block = parseTsv(text);
    const before = data;
    const next = structuredClone(data);
    const { changed, added } = applyPaste(next, refs, keys, r, c, block, horizons[horizons.length - 1]);
    if (!changed && !added) return void toast.info("Nothing to paste there", { body: "Those columns are worked out, or the cells weren't numbers." });
    update!(() => next);
    toast(`Pasted ${block.length} ${block.length === 1 ? "row" : "rows"} × ${Math.max(...block.map((x) => x.length))} ${block[0]?.length === 1 ? "column" : "columns"}`, {
      body: added ? `${added} new key ${added === 1 ? "product" : "products"} added.` : `${changed} ${changed === 1 ? "cell" : "cells"} changed.`,
      action: { label: "Undo", onClick: () => update!(() => structuredClone(before)) },
    });
  }
  function nav(r: number, c: number, dir: 1 | -1) {
    const el = tableRef.current?.querySelector<HTMLElement>(`[data-cell="${r + dir}:${c}"]`);
    if (!el) return;
    el.focus();
  }
  const cellProps = (r: number, key: ColKey) => {
    const c = keys.indexOf(key);
    return { cell: `${r}:${c}`, onPasteBlock: ro ? undefined : (t: string) => paste(r, c, t), onNav: (dir: 1 | -1) => nav(r, c, dir) };
  };

  const fig = (h: HorizonId, it: EboItem) => itemFigures(data.horizons[h].items, it);
  const sectionCls = (k: ColKey) => clsx(SECTION_START.has(k) && "border-l-2 border-l-slate-200");
  const ncols = keys.length + 1;

  const valueCell = (k: ColKey, f: Figures, strong?: boolean) => {
    const g = (v: number | null) => <span className={clsx("block px-1.5 text-[12px]", v === null ? "text-slate-300" : v >= 0 ? "text-emerald-700" : "text-rose-700")}>{pct(v)}</span>;
    const n = (v: number | null) => <span className={clsx("block px-1.5 py-1", strong ? "font-semibold text-slate-900" : "font-medium text-slate-700")}>{v === null ? "—" : thb(v)}</span>;
    switch (k) {
      case "g1":
        return g(growth(f.revBase, f.revPrior));
      case "g2":
        return g(growth(f.target, f.revBase));
      case "gHn":
        return g(growth(f.hnBase, f.hnPrior));
      case "perHn":
        return <span className="block px-1.5 text-slate-600">{thb(per(f.revBase, f.hnBase))}</span>;
      case "avg":
        return n(per(f.target, f.vol));
      default:
        return n((f[k as keyof Figures] as number | null) ?? null);
    }
  };

  const totalRow = (label: string, f: Figures, key: string) => (
    <tr key={key} className="font-semibold">
      {keys.map((k, i) =>
        i === 0 ? (
          <td key={k} colSpan={withHorizon ? 3 : 2} className="sticky left-0 z-[1] border-t border-slate-200 bg-white px-2 py-1.5 text-left text-[12.5px] text-slate-900">
            {label}
          </td>
        ) : k === "name" || k === "type" ? null : (
          <td key={k} className={clsx(td, "border-t border-slate-200", sectionCls(k))}>
            {k === "split" ? null : valueCell(k, f, true)}
          </td>
        )
      )}
      <td className="border-t border-slate-200" />
    </tr>
  );

  return (
    <div className="overflow-x-auto">
      <table ref={tableRef} className="w-full border-separate border-spacing-0 text-[12.5px]" data-grid={gid}>
        <thead>
          <tr>
            {withHorizon && <th rowSpan={2} className={clsx(th, SECTION_TONE.product, "sticky left-0 z-10 w-[52px] min-w-[52px] text-left")}>H</th>}
            <th rowSpan={2} className={clsx(th, SECTION_TONE.product, "sticky z-10 min-w-[250px] text-left", withHorizon ? "left-[52px]" : "left-0")}>
              Key product
            </th>
            <th rowSpan={2} className={clsx(th, SECTION_TONE.product, "text-left")}>
              Type
            </th>
            <th colSpan={keys.filter((k) => sectionOf(k) === "rev").length} className={clsx(th, SECTION_TONE.rev, "border-l-2 border-l-slate-200 text-left text-[12px] font-semibold")}>
              <span className="flex items-center justify-between gap-2">
                Revenue (THB)
                <ActualToggle on={view.revActual} year={B} onClick={() => setView({ ...view, revActual: !view.revActual })} />
              </span>
            </th>
            <th colSpan={keys.filter((k) => sectionOf(k) === "hn").length} className={clsx(th, SECTION_TONE.hn, "border-l-2 border-l-slate-200 text-left text-[12px] font-semibold")}>
              <span className="flex items-center justify-between gap-2">
                Patients (HN)
                <ActualToggle on={view.hnActual} year={B} onClick={() => setView({ ...view, hnActual: !view.hnActual })} />
              </span>
            </th>
            {view.split && (
              <th className={clsx(th, SECTION_TONE.split, "border-l-2 border-l-slate-200 text-left text-[12px] font-semibold")}>
                <span className="flex items-center justify-between gap-2">
                  Hospital split
                  <button type="button" onClick={() => setView({ ...view, split: false })} className="grid h-5 w-5 place-items-center rounded text-slate-400 hover:bg-white hover:text-slate-700" aria-label="Hide the hospital split" title="Hide the hospital split">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              </th>
            )}
            <th rowSpan={2} className={clsx(th, SECTION_TONE.product)} />
          </tr>
          <tr>
            {keys
              .filter((k) => !["horizon", "name", "type"].includes(k))
              .map((k) => {
                const [a, b] = colLabel(k, year, pLabel);
                const s = sectionOf(k);
                return (
                  <th key={k} className={clsx(th, SECTION_TONE[s], sectionCls(k), k === "split" && "text-left", (k === "revActual" || k === "hnActual") && "bg-amber-50/80 text-amber-900")}>
                    {k === "split" ? (
                      <span className="flex flex-wrap gap-x-2 gap-y-0.5 font-normal">
                        {sites.map((x, i) => (
                          <span key={x} className="flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full" style={{ background: siteColor(x, i) }} />
                            {siteLabel(x)}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <>
                        {a}
                        {b && <span className="block text-[10px] font-normal opacity-70">{b}</span>}
                      </>
                    )}
                  </th>
                );
              })}
          </tr>
        </thead>
        {horizons.map((h) => {
          const items = data.horizons[h].items;
          const meta = HORIZON_META[h];
          const list = rows.filter((x) => x.h === h);
          return (
            <tbody key={h}>
              {withHorizon && (
                <tr>
                  <td colSpan={ncols} className="border-b border-slate-200 px-3 py-1.5" style={{ background: `color-mix(in srgb, ${meta.color} 7%, white)` }}>
                    <span className="sticky left-3 flex items-center gap-2">
                      <span className={clsx("rounded-md px-1.5 py-0.5 text-[11.5px] font-bold ring-1", meta.tone)}>{h}</span>
                      <span className="text-[13px] font-semibold text-slate-900">{data.horizons[h].title || meta.title}</span>
                      <span className="text-[12px] text-blue-700">{data.horizons[h].focus || meta.focus}</span>
                      {!ro && (
                        <button type="button" onClick={() => addItem(h)} className="ml-2 flex items-center gap-1 rounded-md px-2 py-0.5 text-[12px] font-medium text-blue-700 hover:bg-white">
                          <Plus className="h-3.5 w-3.5" /> Add to {h}
                        </button>
                      )}
                    </span>
                  </td>
                </tr>
              )}
              {list.map(({ item, no, depth }) => {
                const r = rowIndex.get(item.id)!;
                const parent = childrenOf(items, item.id).length > 0;
                const f = fig(h, item);
                const shares = splitOf(items, item, fallback);
                const inherited = Object.keys(item.split).length === 0;
                return (
                  <Fragment key={item.id}>
                    <tr className={clsx("group", parent && "bg-slate-50/60")}>
                      {keys.map((k) => {
                        const cp = cellProps(r, k);
                        if (k === "horizon")
                          return (
                            <td key={k} className="sticky left-0 z-[1] border-b border-slate-100 bg-white px-1 py-0.5 group-hover:bg-slate-50">
                              {depth === 0 ? (
                                <select
                                  value={h}
                                  disabled={ro}
                                  data-cell={cp.cell}
                                  onChange={(e) => moveTo(h, item, e.target.value as HorizonId)}
                                  aria-label="Horizon"
                                  className={clsx("h-7 w-[44px] rounded-md px-1 text-[11.5px] font-bold outline-none ring-1", meta.tone)}
                                >
                                  {HORIZON_IDS.map((x) => (
                                    <option key={x}>{x}</option>
                                  ))}
                                </select>
                              ) : null}
                            </td>
                          );
                        if (k === "name")
                          return (
                            <td
                              key={k}
                              className={clsx("sticky z-[1] border-b border-slate-100 bg-white px-2 py-0.5 group-hover:bg-slate-50", withHorizon ? "left-[52px]" : "left-0")}
                              style={parent ? { background: "var(--color-slate-50)" } : undefined}
                            >
                              <div className="flex items-center gap-1" style={{ paddingLeft: depth * 18 }}>
                                {depth > 0 && <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />}
                                <span className="w-7 shrink-0 text-[11.5px] tabular-nums text-slate-400">{no}</span>
                                <TextInput
                                  {...cp}
                                  value={item.name}
                                  disabled={ro}
                                  placeholder={depth ? "Sub-item" : "Key product"}
                                  onChange={(v) => setItem(item.id, { name: v })}
                                  className={clsx("h-7 w-full min-w-[160px] rounded-md border border-transparent bg-transparent px-1.5 text-[12.5px] text-slate-900 hover:border-slate-200 focus:border-blue-400 focus:bg-white", !depth && "font-medium")}
                                />
                              </div>
                            </td>
                          );
                        if (k === "type")
                          return (
                            <td key={k} className="border-b border-slate-100 px-1 py-0.5">
                              {depth === 0 && (
                                <button
                                  type="button"
                                  disabled={ro}
                                  data-cell={cp.cell}
                                  onClick={() => setItem(item.id, { flagship: !item.flagship })}
                                  className={clsx("whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 transition", item.flagship ? meta.tone : "bg-slate-50 text-slate-500 ring-slate-200", !ro && "hover:brightness-95")}
                                  title={ro ? undefined : "Switch flagship / non-flagship"}
                                >
                                  {item.flagship ? "Flagship" : "Non-flagship"}
                                </button>
                              )}
                            </td>
                          );
                        if (k === "split")
                          return (
                            <td key={k} className={clsx("border-b border-slate-100 px-2 py-0.5", sectionCls(k))}>
                              <button
                                type="button"
                                onClick={() => setSplitOpen(splitOpen === item.id ? null : item.id)}
                                aria-expanded={splitOpen === item.id}
                                title={`${sites.map((s) => `${siteLabel(s)} ${((shares[s] || 0) * 100).toFixed(1)}%`).join(" · ")}${inherited ? " — follows the CoE's split" : ""}`}
                                className={clsx("block w-full min-w-[150px] rounded-md px-1 py-1 text-left hover:bg-slate-100", inherited && "opacity-55")}
                              >
                                <span className="flex h-2.5 overflow-hidden rounded-full bg-slate-100">
                                  {sites.map((s, i) => (
                                    <span key={s} className="h-full transition-[width] duration-300" style={{ width: `${(shares[s] || 0) * 100}%`, background: siteColor(s, i) }} />
                                  ))}
                                </span>
                                <span className="mt-0.5 block text-[10.5px] tabular-nums text-slate-500">
                                  {sites.map((s) => Math.round((shares[s] || 0) * 100)).join(" · ")}
                                  {inherited && " · CoE split"}
                                </span>
                              </button>
                            </td>
                          );
                        const editable = NUM_KEYS.has(k) && !parent;
                        const actual = k === "revActual" || k === "hnActual";
                        if (!editable)
                          return (
                            <td key={k} className={clsx(td, sectionCls(k), actual && "bg-amber-50/40")}>
                              {valueCell(k, f)}
                            </td>
                          );
                        const value =
                          k === "avg" ? (item.revTarget !== null && item.revTarget !== undefined ? per(item.revTarget, item.vol) : item.avg) : k === "target" ? lineTarget(item) : ((item[k as keyof EboItem] as number | null | undefined) ?? null);
                        // A blank forecast hints at the full year at this year's pace so far.
                        const rr = k === "revBase" ? runRate(item.revActual, period, B) : k === "hnBase" ? runRate(item.hnActual, period, B) : null;
                        return (
                          <td key={k} className={clsx(td, sectionCls(k), actual && "bg-amber-50/40")}>
                            <NumInput
                              {...cp}
                              value={value}
                              disabled={ro}
                              placeholder={rr !== null ? `≈ ${thb(rr)}` : undefined}
                              onChange={(v) => {
                                if (k === "avg") setItem(item.id, { avg: v, revTarget: null });
                                // Typing the total: with cases set, it becomes the average per case; otherwise it's kept as typed.
                                else if (k === "target") setItem(item.id, v !== null && item.vol ? { avg: v / item.vol, revTarget: null } : { revTarget: v });
                                else setItem(item.id, { [k]: v } as Partial<EboItem>);
                              }}
                              className={clsx(numCls, k === "target" && "font-medium")}
                            />
                          </td>
                        );
                      })}
                      <td className="border-b border-slate-100 px-1 py-0.5">
                        {!ro && (
                          <div className="flex items-center justify-end gap-0.5 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                            {depth === 0 && (
                              <IconBtn label="Add a sub-item" onClick={() => addItem(h, item.id)}>
                                <Plus className="h-3.5 w-3.5" />
                              </IconBtn>
                            )}
                            <IconBtn label="Move up" onClick={() => move(h, item, -1)}>
                              <ArrowUp className="h-3.5 w-3.5" />
                            </IconBtn>
                            <IconBtn label="Move down" onClick={() => move(h, item, 1)}>
                              <ArrowDown className="h-3.5 w-3.5" />
                            </IconBtn>
                            <IconBtn label="Remove" danger onClick={() => void removeItem(h, item)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </IconBtn>
                          </div>
                        )}
                      </td>
                    </tr>
                    {view.split && splitOpen === item.id && (
                      <tr>
                        <td colSpan={ncols} className="border-b border-slate-100 bg-slate-50 px-3 py-2">
                          <SplitEditor item={item} sites={sites} fallback={fallback} ro={ro} onChange={(split) => setItem(item.id, { split })} onClose={() => setSplitOpen(null)} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {list.length === 0 && (
                <tr>
                  <td colSpan={ncols} className="px-4 py-5 text-center text-[12.5px] text-slate-400">
                    No key products in {h} yet.{!ro && " Add one, or paste rows copied from Excel into the first one."}
                  </td>
                </tr>
              )}
              {list.length > 0 && totalRow(`Total ${h}`, horizonFigures(data.horizons[h]), `t-${h}`)}
            </tbody>
          );
        })}
        {withHorizon && (
          <tbody>
            {totalRow(
              "Total",
              planFigures(data),
              "grand"
            )}
          </tbody>
        )}
      </table>
    </div>
  );
}

function ActualToggle({ on, year, onClick }: { on: boolean; year: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      title={on ? `Hide actual ${year}` : `Show actual ${year}`}
      className={clsx("flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 transition", on ? "bg-amber-100 text-amber-900 ring-amber-200" : "bg-white text-slate-500 ring-slate-200 hover:text-slate-800")}
    >
      {on ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />} Actual {year}
    </button>
  );
}

function SplitEditor({ item, sites, fallback, ro, onChange, onClose }: { item: EboItem; sites: string[]; fallback: Record<string, number>; ro: boolean; onChange: (s: Record<string, number>) => void; onClose: () => void }) {
  const inherited = Object.keys(item.split).length === 0;
  const total = sites.reduce((a, s) => a + (item.split[s] || 0), 0);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px]">
      <span className="font-medium text-slate-700">{item.name || "This line"} · % by hospital</span>
      {sites.map((s, i) => (
        <label key={s} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: siteColor(s, i) }} />
          {siteLabel(s)}
          <NumInput
            value={inherited ? null : (item.split[s] ?? 0)}
            disabled={ro}
            decimals={1}
            placeholder={item.parentId ? "—" : String(Math.round((fallback[s] || 0) * 100))}
            onChange={(v) => {
              const next = { ...item.split };
              if (v === null) delete next[s];
              else next[s] = v;
              onChange(next);
            }}
            className="h-7 w-16 rounded-md border border-slate-200 bg-white px-1.5 text-right tabular-nums outline-none focus:border-blue-400"
          />
          %
        </label>
      ))}
      <span className={clsx("tabular-nums", inherited ? "text-slate-400" : Math.abs(total - 100) < 0.05 ? "text-emerald-700" : "text-amber-700")}>{inherited ? (item.parentId ? "follows its parent" : "follows the CoE's split") : `Σ ${total.toFixed(1)}% (scaled to 100)`}</span>
      {!ro && !inherited && (
        <button type="button" onClick={() => onChange({})} className="rounded-md px-2 py-0.5 font-medium text-blue-700 hover:bg-white">
          {item.parentId ? "Follow the parent" : "Follow the CoE's split"}
        </button>
      )}
      <button type="button" onClick={onClose} className="ml-auto rounded-md px-2 py-0.5 text-slate-500 hover:bg-white">
        Done
      </button>
    </div>
  );
}

function IconBtn({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={clsx("grid h-6 w-6 place-items-center rounded-md text-slate-400", danger ? "hover:bg-rose-50 hover:text-rose-600" : "hover:bg-slate-100 hover:text-slate-800")}
    >
      {children}
    </button>
  );
}

// ---- inputs that save on blur ---------------------------------------------------------------------------

type CellProps = {
  /** "row:column" in the grid, for moving between rows and pasting blocks. */
  cell?: string;
  /** Called instead of a normal paste when the clipboard holds several cells. */
  onPasteBlock?: (text: string) => void;
  onNav?: (dir: 1 | -1) => void;
};

export function NumInput({
  value,
  onChange,
  disabled,
  placeholder,
  decimals = 0,
  className,
  cell,
  onPasteBlock,
  onNav,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  disabled?: boolean;
  placeholder?: string;
  decimals?: number;
  className?: string;
} & CellProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const cancel = useRef(false);
  const shown = draft ?? (value === null ? "" : value.toLocaleString("en-US", { maximumFractionDigits: decimals }));
  return (
    <input
      inputMode="decimal"
      value={shown}
      readOnly={disabled}
      placeholder={placeholder}
      data-cell={cell}
      onFocus={(e) => {
        if (disabled) return;
        cancel.current = false;
        setDraft(value === null ? "" : String(Math.round(value * 10 ** Math.max(decimals, 2)) / 10 ** Math.max(decimals, 2)));
        const el = e.target;
        requestAnimationFrame(() => el.select());
      }}
      onChange={(e) => setDraft(e.target.value)}
      onPaste={(e) => {
        const text = e.clipboardData.getData("text/plain");
        if (disabled || !onPasteBlock || !isBlock(text)) return;
        e.preventDefault();
        cancel.current = true;
        (e.target as HTMLInputElement).blur();
        onPasteBlock(text);
      }}
      onBlur={() => {
        if (draft !== null && !cancel.current) {
          const v = parseNum(draft);
          const bad = v !== null && Number.isNaN(v);
          if (bad) toast.error("That isn't a number", { body: "Type digits, e.g. 1,250,000 or 1.25m" });
          else if (v !== value) onChange(v);
        }
        setDraft(null);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || ((e.key === "ArrowDown" || e.key === "ArrowUp") && onNav)) {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
          onNav?.(e.key === "ArrowUp" || (e.key === "Enter" && e.shiftKey) ? -1 : 1);
        }
        if (e.key === "Escape") {
          cancel.current = true;
          (e.target as HTMLInputElement).blur();
        }
      }}
      className={className}
    />
  );
}

export function TextInput({
  value,
  onChange,
  disabled,
  placeholder,
  className,
  cell,
  onPasteBlock,
  onNav,
}: { value: string; onChange: (v: string) => void; disabled?: boolean; placeholder?: string; className?: string } & CellProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const cancel = useRef(false);
  return (
    <input
      value={draft ?? value}
      readOnly={disabled}
      placeholder={placeholder}
      data-cell={cell}
      onFocus={() => {
        if (disabled) return;
        cancel.current = false;
        setDraft(value);
      }}
      onChange={(e) => setDraft(e.target.value)}
      onPaste={(e) => {
        const text = e.clipboardData.getData("text/plain");
        if (disabled || !onPasteBlock || !isBlock(text)) return;
        e.preventDefault();
        cancel.current = true;
        (e.target as HTMLInputElement).blur();
        onPasteBlock(text);
      }}
      onBlur={() => {
        if (draft !== null && !cancel.current && draft.trim() !== value) onChange(draft.trim());
        setDraft(null);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || ((e.key === "ArrowDown" || e.key === "ArrowUp") && onNav)) {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
          onNav?.(e.key === "ArrowUp" || (e.key === "Enter" && e.shiftKey) ? -1 : 1);
        }
        if (e.key === "Escape") {
          cancel.current = true;
          (e.target as HTMLInputElement).blur();
        }
      }}
      className={clsx("outline-none transition", className)}
    />
  );
}
