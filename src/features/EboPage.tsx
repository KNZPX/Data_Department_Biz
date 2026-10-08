"use client";

// EBO (Emerging Business Opportunity) for each CoE / SBU, set against the
// unit's target from the Target page. Each unit lists its key products in three
// horizons (mature, growth, future business): revenue in the two years before,
// and the target year as cases × average revenue per case. The page shows how
// much of the target the products cover, per hospital too, and draws the
// three-horizon chart. Saves automatically; the team sees changes.
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, ExternalLink, Flag, LayoutGrid, Link2, Loader2, Plus, Search } from "lucide-react";
import { clsx } from "clsx";
import { useAccess } from "@/components/auth/LoginGate";
import { confirmDialog, toast } from "@/components/feedback";
import { useOrgStructure } from "@/lib/useOrgStructure";
import { useT } from "@/lib/i18n";
import { type UnitNumbers } from "@/lib/targetPlanBase";
import { useTargetLink } from "@/lib/useTargetLink";
import { usePersonalPref } from "@/lib/usePersonalPref";
import { DEFAULT_VIEW, EboGrid, NumInput, TextInput, gridTsv, type GridView } from "./EboGrid";
import { normalizePlan as normalizeOkr, objectiveProgress, okrId, type Objective, type OkrPlanRow } from "@/lib/okr";
import {
  HORIZON_IDS,
  HORIZON_META,
  blankItem,
  childrenOf,
  eboId,
  emptyEbo,
  growth,
  horizonFigures,
  itemFigures,
  normalizeEbo,
  numbered,
  per,
  periodLabel,
  periodOf,
  planFigures,
  productNames,
  resolveTarget,
  runRate,
  siteAllocation,
  topItems,
  type EboHorizon,
  type EboPlanData,
  type EboPlanRow,
  type Figures,
  type HorizonId,
  type ResolvedTarget,
} from "@/lib/ebo";

type Saved = { data: EboPlanData; updatedAt: string | null; updatedBy: string | null };
type Unit = { id: string; name: string; group: string; lead?: string; sites: string[] };

// ---- formatting ----------------------------------------------------------------
const thb = (v: number | null) => (v === null ? "—" : Math.round(v).toLocaleString("en-US"));
const mb = (v: number | null, d = 1) => (v === null ? "—" : (v / 1e6).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }));
const pct = (g: number | null, sign = true) => (g === null || !Number.isFinite(g) ? "—" : `${sign && g > 0 ? "+" : ""}${(g * 100).toFixed(1)}%`);
const share = (x: number | null) => (x === null || !Number.isFinite(x) ? "—" : `${(x * 100).toFixed(1)}%`);
const siteLabel = (code: string) => code.replace(" (Premium)", "");

function coverTone(c: number | null) {
  if (c === null) return { bar: "bg-slate-300", text: "text-slate-500" };
  if (c >= 1) return { bar: "bg-emerald-500", text: "text-emerald-700" };
  if (c >= 0.9) return { bar: "bg-amber-500", text: "text-amber-700" };
  return { bar: "bg-rose-500", text: "text-rose-700" };
}

/** Fired after an EBO plan is saved, so the OKR tab (which shows it) can reload. */
export const EBO_SAVED = "ebo-plan-saved";

/** Shared with the OKR tab: year, open unit, the tab switch, and the scenario a link asked for. */
export type TabProps = {
  year: number;
  setYear: (f: (y: number) => number) => void;
  unitName: string | null;
  setUnitName: (n: string | null) => void;
  tabs: React.ReactNode;
  preferScenario: string | null;
  onOtherTab: () => void;
};

export function EboPage({ year, setYear, unitName, setUnitName, tabs, preferScenario, onOtherTab }: TabProps) {
  const t = useT();
  const { can } = useAccess();
  const canEdit = can("ebo.edit");
  // What the key-product tables show (each person's own choice).
  const [viewPref, saveView] = usePersonalPref<GridView>("eboGridView", "ebo:gridView");
  const view: GridView = { ...DEFAULT_VIEW, ...(viewPref || {}) };
  const { org } = useOrgStructure(year);
  const [query, setQuery] = useState("");
  const [plans, setPlans] = useState<Record<string, Saved>>({});
  const [okr, setOkr] = useState<Record<string, Objective[]>>({});
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const link = useTargetLink(year, preferScenario);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const plansRef = useRef(plans);
  useEffect(() => {
    plansRef.current = plans;
  }, [plans]);

  const units: Unit[] = useMemo(
    () => org.units.filter((u) => u.active && (!query.trim() || u.name.toLowerCase().includes(query.trim().toLowerCase()))),
    [org, query]
  );
  const groups = Array.from(new Set(units.map((u) => u.group)));
  const unit = units.find((u) => u.name === unitName) || org.units.find((u) => u.name === unitName && u.active) || null;
  const keyOf = useCallback((name: string) => eboId(year, name), [year]);

  // ---- data ----------------------------------------------------------------------
  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetch(`/api/ebo?year=${year}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { plans: [] }))
      .then((j: { plans: EboPlanRow[] }) => {
        if (!alive) return;
        const map: Record<string, Saved> = {};
        for (const p of j.plans || []) map[p.id] = { data: normalizeEbo(p.data), updatedAt: p.updated_at, updatedBy: p.updated_by };
        setPlans(map);
        setLoading(false);
      })
      .catch(() => alive && setLoading(false));
    // Each unit's network-wide OKRs, to show next to the horizons they serve.
    fetch(`/api/okr?year=${year}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { plans: [] }))
      .then((j: { plans: OkrPlanRow[] }) => {
        if (!alive) return;
        const map: Record<string, Objective[]> = {};
        for (const p of j.plans || []) if (p.id === okrId(year, p.unit, "ALL")) map[p.unit] = normalizeOkr(p.data).objectives;
        setOkr(map);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [year]);

  // ---- the Target plan this year's EBO is measured against ----------------------------
  const { yearScenarios, linkedId, linked } = link;
  const numbersOf = (name: string): UnitNumbers | null => linked?.numbers[name] || null;

  // ---- saving --------------------------------------------------------------------------
  const persist = useCallback(
    async (name: string, key: string) => {
      let force = false;
      for (;;) {
        const p = plansRef.current[key];
        if (!p) return;
        setSaveState("saving");
        try {
          const res = await fetch("/api/ebo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ year, unit: name, data: p.data, baseUpdatedAt: p.updatedAt, force }),
          });
          const json = await res.json().catch(() => ({}));
          if (res.status === 409) {
            setSaveState("idle");
            const c = json.conflict || {};
            const mine = await confirmDialog({
              title: `${c.updatedBy || "Someone"} changed ${name}'s EBO too`,
              body: "Keep your version (replaces theirs), or load theirs (your last edits are dropped)?",
              confirmLabel: "Keep mine",
              cancelLabel: "Load theirs",
              danger: true,
            });
            if (mine) {
              force = true;
              continue;
            }
            setPlans((prev) => ({ ...prev, [key]: { data: normalizeEbo(c.data), updatedAt: c.updatedAt, updatedBy: c.updatedBy } }));
            return;
          }
          if (!res.ok) throw new Error(json.error || "The server didn't accept it");
          setPlans((prev) => ({ ...prev, [key]: { ...prev[key], updatedAt: json.updatedAt, updatedBy: json.updatedBy } }));
          setSaveState("saved");
          // The OKR tab shows the same plan; let it reload.
          window.dispatchEvent(new CustomEvent(EBO_SAVED, { detail: { year } }));
        } catch (e) {
          setSaveState("error");
          toast.error("Couldn't save the EBO plan", { body: e instanceof Error ? e.message : undefined });
        }
        return;
      }
    },
    [year]
  );

  /** Change the open unit's plan and save a moment later. */
  function update(f: (d: EboPlanData) => EboPlanData) {
    if (!unit || !canEdit) return;
    const key = keyOf(unit.name);
    const base = plans[key] || { data: emptyEbo(), updatedAt: null, updatedBy: null };
    setPlans((prev) => ({ ...prev, [key]: { ...base, data: f(structuredClone(base.data)) } }));
    setSaveState("saving");
    clearTimeout(timers.current[key]);
    const name = unit.name;
    timers.current[key] = setTimeout(() => {
      delete timers.current[key];
      void persist(name, key);
    }, 900);
  }
  // Leaving the tab (e.g. for OKR): save what's still waiting right away.
  const persistRef = useRef(persist);
  useEffect(() => {
    persistRef.current = persist;
  }, [persist]);
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const [key, id] of Object.entries(pending)) {
        clearTimeout(id);
        delete pending[key];
        void persistRef.current(key.slice(key.indexOf("::") + 2), key);
      }
    };
  }, []);

  const current: Saved | null = unit ? plans[keyOf(unit.name)] || { data: emptyEbo(), updatedAt: null, updatedBy: null } : null;

  /** The unit's target: the linked Target plan's, or the one typed on this page when chosen. */
  const targetOf = useCallback((name: string, d?: EboPlanData) => resolveTarget(linked?.numbers[name]?.target, d), [linked]);

  // ---- export --------------------------------------------------------------------------
  async function exportExcel() {
    const rows: Record<string, string | number | null>[] = [];
    const levels: number[] = [];
    const bold: boolean[] = [];
    const summary: Record<string, string | number | null>[] = [];
    for (const u of units) {
      const d = plans[keyOf(u.name)]?.data;
      if (!d) continue;
      const tgt = targetOf(u.name, d).value;
      const tot = planFigures(d);
      summary.push({
        unit: u.name,
        group: u.group,
        prior: numbersOf(u.name)?.prior ?? null,
        base: numbersOf(u.name)?.base ?? null,
        target: tgt,
        ebo: tot.target,
        cover: tgt && tot.target !== null ? tot.target / tgt : null,
        gap: tgt !== null && tot.target !== null ? tot.target - tgt : null,
        h1: horizonFigures(d.horizons.H1).target,
        h2: horizonFigures(d.horizons.H2).target,
        h3: horizonFigures(d.horizons.H3).target,
      });
      for (const h of HORIZON_IDS) {
        const hz = d.horizons[h];
        if (!hz.items.length) continue;
        const hf = horizonFigures(hz);
        const period = periodLabel(periodOf(d, year - 1));
        rows.push({ unit: u.name, horizon: h, no: "", name: `${h} · ${hz.title}`, type: hz.focus ? `Focus: ${hz.focus}` : "", period, prior: hf.revPrior, actual: hf.revActual, base: hf.revBase, g1: growth(hf.revBase, hf.revPrior), vol: hf.vol, avg: per(hf.target, hf.vol), target: hf.target, g2: growth(hf.target, hf.revBase), hnP: hf.hnPrior, hnA: hf.hnActual, hnB: hf.hnBase, gHn: growth(hf.hnBase, hf.hnPrior), perB: per(hf.revBase, hf.hnBase), perP: per(hf.revPrior, hf.hnPrior) });
        levels.push(0);
        bold.push(true);
        for (const { item, no, depth } of numbered(hz.items)) {
          const f = itemFigures(hz.items, item);
          rows.push({
            unit: u.name,
            horizon: h,
            no,
            name: item.name,
            type: depth ? "" : item.flagship ? "Flagship" : "Non-flagship",
            period,
            prior: f.revPrior,
            actual: f.revActual,
            base: f.revBase,
            g1: growth(f.revBase, f.revPrior),
            vol: f.vol,
            avg: per(f.target, f.vol),
            target: f.target,
            g2: growth(f.target, f.revBase),
            hnP: f.hnPrior,
            hnA: f.hnActual,
            hnB: f.hnBase,
            gHn: growth(f.hnBase, f.hnPrior),
            perB: per(f.revBase, f.hnBase),
            perP: per(f.revPrior, f.hnPrior),
          });
          levels.push(depth + 1);
          bold.push(depth === 0 && childrenOf(hz.items, item.id).length > 0);
        }
      }
    }
    const P = year - 2;
    const B = year - 1;
    const money = "#,##0";
    const pc = "0.0%";
    const res = await fetch("/api/export/xlsx", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: `EBO-${year}`,
        sheets: [
          {
            name: "Summary",
            columns: [
              { header: "CoE / SBU", key: "unit", width: 26 },
              { header: "Group", key: "group", width: 14 },
              { header: `Revenue ${P}`, key: "prior", width: 16, numFmt: money },
              { header: `Revenue ${B}`, key: "base", width: 16, numFmt: money },
              { header: `Target ${year}`, key: "target", width: 16, numFmt: money },
              { header: "EBO planned", key: "ebo", width: 16, numFmt: money },
              { header: "Covers target", key: "cover", width: 12, numFmt: pc },
              { header: "Over / short", key: "gap", width: 16, numFmt: money },
              { header: "H1", key: "h1", width: 16, numFmt: money },
              { header: "H2", key: "h2", width: 16, numFmt: money },
              { header: "H3", key: "h3", width: 16, numFmt: money },
            ],
            rows: summary,
          },
          {
            name: "Key products",
            columns: [
              { header: "CoE / SBU", key: "unit", width: 24 },
              { header: "Horizon", key: "horizon", width: 8 },
              { header: "No.", key: "no", width: 6 },
              { header: "Key product", key: "name", width: 40 },
              { header: "Type", key: "type", width: 16 },
              { header: `Rev baseline ${P}`, key: "prior", width: 16, numFmt: money },
              { header: `Rev actual ${B}`, key: "actual", width: 16, numFmt: money },
              { header: "Actual covers", key: "period", width: 15 },
              { header: `Rev forecast ${B}`, key: "base", width: 16, numFmt: money },
              { header: `Growth ${B}F`, key: "g1", width: 10, numFmt: pc },
              { header: `Cases ${year}`, key: "vol", width: 10, numFmt: money },
              { header: "Avg rev / case", key: "avg", width: 14, numFmt: money },
              { header: `Target ${year}`, key: "target", width: 15, numFmt: money },
              { header: `Growth ${year}`, key: "g2", width: 10, numFmt: pc },
              { header: `HN baseline ${P}`, key: "hnP", width: 12, numFmt: money },
              { header: `HN actual ${B}`, key: "hnA", width: 12, numFmt: money },
              { header: `HN forecast ${B}`, key: "hnB", width: 12, numFmt: money },
              { header: `HN growth ${B}F`, key: "gHn", width: 10, numFmt: pc },
              { header: `Rev / HN ${B}F`, key: "perB", width: 14, numFmt: money },
              { header: `Rev / HN ${P}`, key: "perP", width: 14, numFmt: money },
            ],
            rows,
            levels,
            bold,
          },
        ],
      }),
    }).catch(() => null);
    if (!res?.ok) return void toast.error("Couldn't export to Excel");
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = `EBO-${year}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const summary = useMemo(() => {
    // Coverage counts only the units that have an EBO plan, against their own targets.
    let target = 0;
    let ebo = 0;
    let planned = 0;
    for (const u of units) {
      const d = plans[keyOf(u.name)]?.data;
      const f = d ? planFigures(d).target : null;
      if (f === null) continue;
      ebo += f;
      planned++;
      target += targetOf(u.name, d).value || 0;
    }
    return { target, ebo, planned };
  }, [units, plans, keyOf, targetOf]);

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto lg:overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 md:px-4">
        {tabs}
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-0.5">
          <button type="button" onClick={() => setYear((y) => y - 1)} className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100" aria-label="Previous year">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-2 text-[15px] font-semibold tabular-nums text-slate-900">{year}</span>
          <button type="button" onClick={() => setYear((y) => y + 1)} className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100" aria-label="Next year">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <label className="flex min-w-0 items-center gap-1.5 rounded-lg border border-slate-200 py-0.5 pl-2.5 pr-1 text-[12.5px]">
          <Link2 className="h-3.5 w-3.5 shrink-0 text-blue-600" />
          <span className="shrink-0 text-slate-500">Target plan</span>
          {link.loading ? (
            <Loader2 className="mx-2 h-3.5 w-3.5 animate-spin text-slate-400" />
          ) : yearScenarios.length ? (
            <select
              aria-label="Target plan to measure against"
              value={linkedId || ""}
              onChange={(e) => link.choose(e.target.value)}
              className="h-7 max-w-[220px] truncate rounded-md bg-transparent pr-1 font-medium text-slate-900 outline-none hover:bg-slate-50"
            >
              {yearScenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="px-1.5 text-slate-400">none saved for {year}</span>
          )}
          <Link href="/target-scenario" className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Open the Target page">
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </label>
        <span className="hidden text-[12.5px] text-slate-500 md:inline">
          {summary.planned}/{units.length} units planned
          {summary.planned > 0 && (
            <>
              {" "}
              · EBO {mb(summary.ebo)} MB vs their {mb(summary.target)} MB target
              {summary.target > 0 && <span className={clsx("ml-1 font-medium", coverTone(summary.ebo / summary.target).text)}>({share(summary.ebo / summary.target)})</span>}
            </>
          )}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {unit && (
            <span className="text-[12px] text-slate-400" aria-live="polite">
              {saveState === "saving" ? (
                <span className="flex items-center gap-1">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
                </span>
              ) : current?.updatedBy && current.updatedAt ? (
                `Saved · ${current.updatedBy} · ${new Date(current.updatedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}`
              ) : null}
            </span>
          )}
          <button
            type="button"
            onClick={() => void exportExcel()}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" /> Excel
          </button>
        </div>
      </div>

      <div className="flex min-h-[560px] flex-1 overflow-hidden rounded-xl border border-slate-200/80 bg-white lg:min-h-0">
        {/* Units */}
        <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200/80 md:flex">
          <div className="border-b border-slate-100 p-2.5">
            <label className="relative flex items-center">
              <Search className="pointer-events-none absolute left-2.5 h-4 w-4 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a CoE / SBU"
                className="h-8 w-full rounded-md border border-slate-200 bg-slate-50 pl-8 pr-2 text-[13px] outline-none focus:border-blue-400 focus:bg-white"
              />
            </label>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
            <button
              type="button"
              onClick={() => setUnitName(null)}
              className={clsx("mb-1 flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px]", !unit ? "bg-blue-50 font-medium text-blue-800" : "text-slate-700 hover:bg-slate-50")}
            >
              <LayoutGrid className="h-4 w-4" /> {t("Overview")}
            </button>
            {groups.map((g) => (
              <div key={g} className="mb-1">
                <p className="px-2.5 pb-1 pt-2 text-[11px] font-medium uppercase tracking-[0.06em] text-slate-400">{g}</p>
                {units
                  .filter((u) => u.group === g)
                  .map((u) => {
                    const d = plans[keyOf(u.name)]?.data;
                    const tg = targetOf(u.name, d).value;
                    const e = d ? planFigures(d).target : null;
                    const c = tg && e !== null ? e / tg : null;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => setUnitName(u.name)}
                        className={clsx("flex w-full flex-col gap-1 rounded-md px-2.5 py-1.5 text-left", unit?.name === u.name ? "bg-blue-50" : "hover:bg-slate-50")}
                      >
                        <span className={clsx("truncate text-[13px]", unit?.name === u.name ? "font-medium text-blue-800" : "text-slate-800")}>{u.name}</span>
                        <span className="flex items-center gap-2">
                          <span className="h-1 flex-1 overflow-hidden rounded-full bg-slate-100">
                            <span className={clsx("block h-full rounded-full transition-[width] duration-500", coverTone(c).bar)} style={{ width: `${Math.min(100, (c || 0) * 100)}%` }} />
                          </span>
                          <span className="w-10 text-right text-[10.5px] tabular-nums text-slate-400">{c === null ? "—" : `${Math.round(c * 100)}%`}</span>
                        </span>
                      </button>
                    );
                  })}
              </div>
            ))}
          </div>
        </aside>

        <section className="min-w-0 flex-1 overflow-y-auto">
          {loading ? (
            <div className="grid h-full place-items-center text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
          ) : !unit ? (
            <Overview units={units} plans={plans} keyOf={keyOf} onOpen={setUnitName} year={year} targetOf={targetOf} forecastOf={(n) => linked?.numbers[n]?.base ?? null} linkedName={linked?.scenario.name || null} />
          ) : (
            <UnitEbo
              key={keyOf(unit.name)}
              unit={unit}
              year={year}
              data={current!.data}
              canEdit={canEdit}
              update={update}
              numbers={numbersOf(unit.name)}
              target={targetOf(unit.name, current!.data)}
              linkedName={linked?.scenario.name || null}
              onPickUnit={setUnitName}
              units={units}
              objectives={okr[unit.name] || []}
              onOpenOkr={onOtherTab}
              view={view}
              setView={saveView}
            />
          )}
        </section>
      </div>
    </div>
  );
}

// ---- overview -----------------------------------------------------------------------------

function Overview({
  units,
  plans,
  keyOf,
  onOpen,
  year,
  targetOf,
  forecastOf,
  linkedName,
}: {
  units: Unit[];
  plans: Record<string, Saved>;
  keyOf: (n: string) => string;
  onOpen: (n: string) => void;
  year: number;
  targetOf: (name: string, d?: EboPlanData) => { value: number | null; from: "plan" | "manual" | "none" };
  forecastOf: (name: string) => number | null;
  linkedName: string | null;
}) {
  return (
    <div className="p-4 md:p-5">
      <h2 className="text-[18px] font-semibold text-slate-900">{year} Emerging business opportunities</h2>
      <p className="mb-4 text-[13px] text-slate-500">
        Each CoE / SBU&rsquo;s key products in three horizons, against its target{linkedName ? ` from “${linkedName}”` : ""}. Pick one to plan it.
      </p>
      <div className="stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-entering="">
        {units.map((u) => {
          const s = plans[keyOf(u.name)];
          const d = s?.data;
          const tg = targetOf(u.name, d);
          const tot = d ? planFigures(d).target : null;
          const c = tg.value && tot !== null ? tot / tg.value : null;
          const hs = HORIZON_IDS.map((h) => ({ h, v: d ? horizonFigures(d.horizons[h]).target || 0 : 0 }));
          const hsum = hs.reduce((a, x) => a + Math.max(0, x.v), 0);
          return (
            <button key={u.id} type="button" onClick={() => onOpen(u.name)} className="lift rounded-xl border border-slate-200/80 bg-white p-4 text-left hover:border-blue-300">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-slate-900">{u.name}</p>
                  <p className="text-[11.5px] text-slate-500">
                    {u.group}
                    {u.lead ? ` · ${u.lead}` : ""}
                  </p>
                </div>
                <span className={clsx("shrink-0 text-[18px] font-semibold tabular-nums", coverTone(c).text)}>{c === null ? "—" : `${Math.round(c * 100)}%`}</span>
              </div>
              <div className="mt-3 flex items-baseline justify-between text-[12px] text-slate-500">
                <span>
                  EBO <span className="font-semibold text-slate-900">{mb(tot)}</span> MB
                </span>
                <span>
                  Target <span className="font-semibold text-slate-900">{mb(tg.value)}</span> MB{tg.from === "manual" && " (typed)"}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className={clsx("h-full rounded-full transition-[width] duration-700", coverTone(c).bar)} style={{ width: `${Math.min(100, (c || 0) * 100)}%` }} />
              </div>
              {(() => {
                // The key products' revenue this year against this year's forecast (from the Target plan).
                const f = forecastOf(u.name);
                const kp = d ? planFigures(d).revBase : null;
                if (kp === null || !f) return null;
                const df = kp - f;
                return (
                  <p className={clsx("mt-1.5 text-[12px] font-medium tabular-nums", df >= 0 ? "text-emerald-700" : "text-rose-700")}>
                    Key products vs Forecast {year - 1} {df >= 0 ? "+" : "−"}
                    {thb(Math.abs(df))} THB ({pct(kp / f - 1)})
                  </p>
                );
              })()}
              <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-slate-100" aria-label="Split by horizon">
                {hsum > 0 && hs.map(({ h, v }) => <div key={h} title={`${h} ${mb(v)} MB`} style={{ width: `${(Math.max(0, v) / hsum) * 100}%`, background: HORIZON_META[h].color }} />)}
              </div>
              <div className="mt-1.5 flex gap-3 text-[11px] text-slate-500">
                {hs.map(({ h, v }) => (
                  <span key={h} className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full" style={{ background: HORIZON_META[h].color }} />
                    {h} {hsum > 0 ? `${Math.round((Math.max(0, v) / hsum) * 100)}%` : "—"}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-[11.5px] text-slate-400">
                {s?.updatedAt ? `Updated ${new Date(s.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} by ${s.updatedBy}` : "Not planned yet"}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---- one unit -------------------------------------------------------------------------------

function UnitEbo({
  unit,
  year,
  data,
  canEdit,
  update,
  numbers,
  target,
  linkedName,
  units,
  onPickUnit,
  objectives,
  onOpenOkr,
  view,
  setView,
}: {
  unit: Unit;
  year: number;
  data: EboPlanData;
  canEdit: boolean;
  update: (f: (d: EboPlanData) => EboPlanData) => void;
  numbers: UnitNumbers | null;
  target: ResolvedTarget;
  linkedName: string | null;
  units: Unit[];
  onPickUnit: (n: string) => void;
  objectives: Objective[];
  onOpenOkr: () => void;
  view: GridView;
  setView: (v: GridView) => void;
}) {
  const P = year - 2;
  const B = year - 1;
  const total = planFigures(data);
  const hf = Object.fromEntries(HORIZON_IDS.map((h) => [h, horizonFigures(data.horizons[h])])) as Record<HorizonId, Figures>;
  const tgt = target.value;
  const cover = tgt && total.target !== null ? total.target / tgt : null;
  const gap = tgt !== null && total.target !== null ? total.target - tgt : null;

  // Hospitals: the unit's own, plus any the Target plan has numbers for.
  const sites = Array.from(new Set([...unit.sites, ...Object.keys(numbers?.sites || {})]));
  // The CoE's own split across hospitals in the Target plan (even, if it has none).
  const fallback: Record<string, number> = (() => {
    const ns = numbers?.sites || {};
    const tot = sites.reduce((a, s) => a + (ns[s]?.target || 0), 0);
    if (tot > 0) return Object.fromEntries(sites.map((s) => [s, (ns[s]?.target || 0) / tot]));
    return Object.fromEntries(sites.map((s) => [s, 1 / Math.max(1, sites.length)]));
  })();
  const alloc = siteAllocation(data, fallback);


  return (
    <div className="space-y-4 p-4 md:p-5">
      {/* Title + unit switcher for small screens */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-[18px] font-semibold text-slate-900">
            {unit.name} <span className="font-normal text-slate-400">· EBO {year}</span>
          </h2>
          <p className="text-[12.5px] text-slate-500">
            {unit.group}
            {unit.lead ? ` · ${unit.lead}` : ""} · {sites.map(siteLabel).join(", ") || "no hospitals"}
          </p>
        </div>
        <select value={unit.name} onChange={(e) => onPickUnit(e.target.value)} className="h-8 rounded-md border border-slate-200 bg-white px-2 text-[13px] md:hidden" aria-label="CoE / SBU">
          {units.map((u) => (
            <option key={u.id}>{u.name}</option>
          ))}
        </select>
      </div>

      {/* Against the target */}
      <div className="grid gap-3 2xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="rounded-xl border border-slate-200/80 p-4">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
            <Stat label={`Revenue ${P}`} value={mb(numbers?.prior ?? null)} unit="MB" hint="From the Target plan" />
            <Stat label={`Forecast ${B}`} value={mb(numbers?.base ?? null)} unit="MB" hint="Actual + estimate" />
            <div>
              <p className="text-[11.5px] text-slate-500">Target {year}</p>
              {target.from === "plan" ? (
                <p className="text-[20px] font-semibold tabular-nums text-slate-900">
                  {mb(tgt)} <span className="text-[12px] font-normal text-slate-400">MB</span>
                </p>
              ) : (
                <NumInput
                  value={data.manualTarget ?? null}
                  disabled={!canEdit}
                  placeholder="Type a target (THB)"
                  onChange={(v) => update((d) => ({ ...d, manualTarget: v }))}
                  className="h-8 w-full rounded-md border border-slate-200 px-2 text-[14px] font-semibold tabular-nums"
                />
              )}
              <p className="text-[11px] leading-snug text-slate-400">
                {target.from === "plan" && (
                  <>
                    <span className="block truncate" title={linkedName || undefined}>
                      From “{linkedName}”
                    </span>
                    {canEdit && (
                      <button type="button" onClick={() => update((d) => ({ ...d, targetSource: "manual" }))} className="text-blue-600 hover:underline">
                        Use a typed target{target.manual !== null ? ` (${mb(target.manual)} MB)` : ""}
                      </button>
                    )}
                  </>
                )}
                {target.from === "manual" && (
                  <>
                    Typed here
                    {target.plan !== null && (
                      <>
                        {" · "}
                        {canEdit ? (
                          <button type="button" onClick={() => update((d) => ({ ...d, targetSource: undefined }))} className="text-blue-600 hover:underline">
                            use the Target plan ({mb(target.plan)} MB)
                          </button>
                        ) : (
                          `Target plan says ${mb(target.plan)} MB`
                        )}
                      </>
                    )}
                  </>
                )}
                {target.from === "none" && (linkedName ? "Not in the linked Target plan — type it" : "No Target plan for this year — type it")}
              </p>
            </div>
            <Stat label={`Growth vs ${B}`} value={pct(growth(tgt, numbers?.base ?? null))} hint="Target against the base year" />
          </div>
          <DiffTable year={year} products={total.revBase} byHorizon={HORIZON_IDS.map((h) => ({ h, title: data.horizons[h].title || HORIZON_META[h].title, amount: hf[h].revBase }))} forecast={numbers?.base ?? null} />
          <div className="mt-4 border-t border-slate-100 pt-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-[13px]">
              <span className="text-slate-600">
                EBO planned <span className="text-[16px] font-semibold tabular-nums text-slate-900">{mb(total.target)}</span> MB
                <span className="ml-2 text-slate-400">({thb(total.target)} THB)</span>
              </span>
              <span className={clsx("font-semibold tabular-nums", coverTone(cover).text)}>
                {cover === null ? "Covers —" : `Covers ${share(cover)}`}
                {gap !== null && <span className="ml-2 font-normal">{gap >= 0 ? `over by ${mb(gap, 2)} MB` : `short by ${mb(-gap, 2)} MB`}</span>}
              </span>
            </div>
            <div className="relative mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
              {total.target !== null &&
                tgt !== null &&
                (() => {
                  const max = Math.max(tgt, total.target);
                  let x = 0;
                  return HORIZON_IDS.map((h) => {
                    const w = Math.max(0, hf[h].target || 0) / max;
                    const el = <div key={h} className="absolute inset-y-0 transition-[width,left] duration-700" title={`${h} ${mb(hf[h].target)} MB`} style={{ left: `${x * 100}%`, width: `${w * 100}%`, background: HORIZON_META[h].color }} />;
                    x += w;
                    return el;
                  });
                })()}
              {tgt !== null && total.target !== null && total.target > tgt && <div className="absolute inset-y-0 w-0.5 bg-slate-900" style={{ left: `${(tgt / total.target) * 100}%` }} title="Target" />}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-slate-500">
              {HORIZON_IDS.map((h) => (
                <span key={h} className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: HORIZON_META[h].color }} />
                  {h} {mb(hf[h].target)} MB · {tgt ? share((hf[h].target || 0) / tgt) : "—"} of target
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Per hospital */}
        <div className="rounded-xl border border-slate-200/80 p-4">
          <p className="mb-2 text-[13px] font-semibold text-slate-900">By hospital</p>
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-[11px] text-slate-500">
                <th className="pb-1 font-medium">Hospital</th>
                <th className="pb-1 text-right font-medium">Target</th>
                <th className="pb-1 text-right font-medium">EBO</th>
                <th className="pb-1 text-right font-medium">Over / short</th>
              </tr>
            </thead>
            <tbody>
              {sites.map((s) => {
                // A typed target is split by the CoE's shares in the Target plan, so the rows add up to it.
                const st = target.from === "manual" ? (tgt ? tgt * (fallback[s] || 0) : null) : (numbers?.sites[s]?.target ?? null);
                const e = alloc[s] ?? null;
                const g = st !== null && e !== null ? e - st : null;
                return (
                  <tr key={s} className="border-t border-slate-100">
                    <td className="py-1.5 font-medium text-slate-800">{siteLabel(s)}</td>
                    <td className="py-1.5 text-right tabular-nums text-slate-700">{mb(st)}</td>
                    <td className="py-1.5 text-right tabular-nums text-slate-700">{mb(e)}</td>
                    <td className={clsx("py-1.5 text-right tabular-nums", g === null ? "text-slate-400" : g >= 0 ? "text-emerald-700" : "text-rose-700")}>{g === null ? "—" : `${g >= 0 ? "+" : "−"}${mb(Math.abs(g))}`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] leading-snug text-slate-400">MB. Each product splits by its hospital % (blank = the CoE&rsquo;s split in the Target plan).</p>
        </div>
      </div>

      <HorizonChart unit={unit.name} year={year} data={data} hf={hf} target={tgt} total={total.target} canEdit={canEdit} onMilestone={(v) => update((d) => ({ ...d, milestone: v || undefined }))} />

      <KeyProductsBar year={year} data={data} view={view} setView={setView} canEdit={canEdit} update={update} sites={sites} fallback={fallback} />
      {view.mode === "table" ? (
        <div className="overflow-hidden rounded-xl border border-slate-200/80">
          <EboGrid year={year} data={data} horizons={HORIZON_IDS} withHorizon view={view} setView={setView} sites={sites} fallback={fallback} canEdit={canEdit} update={update} />
        </div>
      ) : (
        HORIZON_IDS.map((h) => (
          <HorizonTable
            key={h}
            h={h}
            data={data}
            f={hf[h]}
            year={year}
            target={tgt}
            sites={sites}
            fallback={fallback}
            canEdit={canEdit}
            update={update}
            view={view}
            setView={setView}
            objectives={objectives.filter((o) => o.horizon === h)}
            onOpenOkr={onOpenOkr}
          />
        ))
      )}
    </div>
  );
}

/** Above the key-product tables: one table or one per horizon, what "actual" covers, and what's shown. */
function KeyProductsBar({
  year,
  data,
  view,
  setView,
  canEdit,
  update,
  sites,
  fallback,
}: {
  year: number;
  data: EboPlanData;
  view: GridView;
  setView: (v: GridView) => void;
  canEdit: boolean;
  update: (f: (d: EboPlanData) => EboPlanData) => void;
  sites: string[];
  fallback: Record<string, number>;
}) {
  const B = year - 1;
  const p = periodOf(data, B);
  // Lines with an actual but no full-year forecast yet.
  const blanks = HORIZON_IDS.flatMap((h) => data.horizons[h].items.filter((i) => !childrenOf(data.horizons[h].items, i.id).length)).filter(
    (i) => (i.revBase === null && i.revActual != null) || (i.hnBase === null && i.hnActual != null)
  ).length;
  const chip = (on: boolean, label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={clsx("flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium ring-1 transition", on ? "bg-blue-50 text-blue-700 ring-blue-200" : "bg-white text-slate-500 ring-slate-200 hover:text-slate-800")}
    >
      <span className={clsx("h-2 w-2 rounded-full", on ? "bg-blue-600" : "bg-slate-300")} />
      {label}
    </button>
  );
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3 py-2">
      <span className="mr-1 text-[14px] font-semibold text-slate-900">Key products</span>
      <div className="flex rounded-lg bg-slate-100 p-0.5 text-[12.5px]" role="radiogroup" aria-label="Layout">
        {(
          [
            ["horizon", "By horizon"],
            ["table", "One table"],
          ] as const
        ).map(([m, label]) => (
          <button key={m} type="button" role="radio" aria-checked={view.mode === m} onClick={() => setView({ ...view, mode: m })} className={clsx("rounded-md px-2.5 py-1 font-medium", view.mode === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}>
            {label}
          </button>
        ))}
      </div>
      <label className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[12.5px] text-slate-600" title={`How much of ${B} the actual columns cover`}>
        Actual {B} covers
        <select
          value={p.unit === "months" ? String(p.n) : "days"}
          disabled={!canEdit}
          onChange={(e) => update((d) => ({ ...d, actualPeriod: e.target.value === "days" ? { unit: "days", n: p.unit === "days" ? p.n : Math.round(p.n * 30.4) } : { unit: "months", n: Number(e.target.value) } }))}
          className="bg-transparent font-medium text-slate-900 outline-none"
          aria-label={`Actual ${B} covers`}
        >
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {periodLabel({ unit: "months", n: i + 1 })}
            </option>
          ))}
          <option value="days">Days…</option>
        </select>
        {p.unit === "days" && (
          <>
            <NumInput value={p.n} disabled={!canEdit} onChange={(v) => v && update((d) => ({ ...d, actualPeriod: { unit: "days", n: Math.max(1, Math.min(366, Math.round(v))) } }))} className="h-6 w-14 rounded border border-slate-200 px-1 text-right tabular-nums" />
            days
          </>
        )}
      </label>
      {chip(view.revActual, `Actual ${B} · revenue`, () => setView({ ...view, revActual: !view.revActual }))}
      {chip(view.hnActual, `Actual ${B} · HN`, () => setView({ ...view, hnActual: !view.hnActual }))}
      {chip(view.split, "Hospital split", () => setView({ ...view, split: !view.split }))}
      <span className="ml-auto flex items-center gap-1.5">
        {canEdit && blanks > 0 && (
          <button
            type="button"
            onClick={() => {
              update((d) => {
                for (const h of HORIZON_IDS)
                  for (const i of d.horizons[h].items) {
                    if (childrenOf(d.horizons[h].items, i.id).length) continue;
                    if (i.revBase === null && i.revActual != null) i.revBase = Math.round(runRate(i.revActual, p, B) ?? 0);
                    if (i.hnBase === null && i.hnActual != null) i.hnBase = Math.round(runRate(i.hnActual, p, B) ?? 0);
                  }
                return d;
              });
              toast(`Filled ${blanks} forecast${blanks === 1 ? "" : "s"} from the actual so far`, { body: `${periodLabel(p)} scaled to the full year.` });
            }}
            className="h-8 rounded-lg border border-slate-200 px-2.5 text-[12.5px] font-medium text-slate-700 hover:bg-slate-50"
            title="Blank full-year forecasts get the actual so far, scaled to 12 months"
          >
            Fill {blanks} forecast{blanks === 1 ? "" : "s"} from actual
          </button>
        )}
        <button
          type="button"
          onClick={() =>
            void navigator.clipboard
              .writeText(gridTsv(data, year, view, sites, fallback))
              .then(() => toast("Table copied", { body: "Paste it into Excel or Google Sheets." }))
              .catch(() => toast.error("Couldn't copy"))
          }
          className="h-8 rounded-lg border border-slate-200 px-2.5 text-[12.5px] font-medium text-slate-700 hover:bg-slate-50"
          title="Copy every key product as a table, to paste into Excel"
        >
          Copy table
        </button>
      </span>
      {canEdit && <p className="w-full text-[11.5px] text-slate-400">Tip: paste cells copied from Excel into any cell — a row, a column or a whole block. Rows past the end become new key products. Enter / ↑ / ↓ move between rows.</p>}
    </div>
  );
}

/**
 * How far the key products' revenue this year is from the unit's forecast for
 * this year (the Target plan's base year: actual + estimate), in THB and %:
 * whether the product list covers the whole business, horizon by horizon.
 */
function DiffTable({ year, products, byHorizon, forecast }: { year: number; products: number | null; byHorizon: { h: HorizonId; title: string; amount: number | null }[]; forecast: number | null }) {
  const B = year - 1;
  const d = products !== null && forecast ? { thb: products - forecast, pct: products / forecast - 1 } : null;
  return (
    <div className="mt-4 border-t border-slate-100 pt-3">
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-[13px] font-semibold text-slate-900">
          Diff: Key products {B} vs Forecast {B}{" "}
          <span className="font-normal text-slate-400">({forecast ? "forecast = actual + estimate, from the Target plan" : `no ${B} forecast for this unit in the linked Target plan`})</span>
        </p>
        {d && (
          <p className={clsx("text-[15px] font-semibold tabular-nums", d.thb >= 0 ? "text-emerald-700" : "text-rose-700")}>
            {d.thb >= 0 ? "+" : "−"}
            {thb(Math.abs(d.thb))} THB <span className="text-[13px]">({pct(d.pct)})</span>
          </p>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-[12.5px]">
          <thead>
            <tr className="text-left text-[11px] text-slate-500">
              <th className="pb-1 pr-3 font-medium" />
              <th className="px-3 pb-1 text-right font-medium">Revenue {B} (THB)</th>
              <th className="px-3 pb-1 text-right font-medium">Share of forecast</th>
              <th className="px-3 pb-1 text-right font-medium">Diff vs forecast (THB)</th>
              <th className="pb-1 pl-3 text-right font-medium">Diff %</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-slate-100">
              <td className="py-1.5 pr-3">
                <span className="font-medium text-slate-800">Forecast {B}</span>
                <span className="block text-[11px] text-slate-400">The whole CoE / SBU, from the Target plan</span>
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">{thb(forecast)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums text-slate-400">{forecast ? "100.0%" : "—"}</td>
              <td className="px-3 py-1.5 text-right text-slate-300">—</td>
              <td className="py-1.5 pl-3 text-right text-slate-300">—</td>
            </tr>
            <tr className="border-t border-slate-100 bg-slate-50/70">
              <td className="py-1.5 pr-3">
                <span className="font-semibold text-slate-900">Key products {B}</span>
                <span className="block text-[11px] text-slate-400">{products === null ? `No ${B} revenue typed yet` : "All horizons, their revenue this year"}</span>
              </td>
              <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-slate-900">{thb(products)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums text-slate-600">{products !== null && forecast ? share(products / forecast) : "—"}</td>
              <td className={clsx("px-3 py-1.5 text-right font-semibold tabular-nums", !d ? "text-slate-400" : d.thb >= 0 ? "text-emerald-700" : "text-rose-700")}>{d ? `${d.thb >= 0 ? "+" : "−"}${thb(Math.abs(d.thb))}` : "—"}</td>
              <td className={clsx("py-1.5 pl-3 text-right font-semibold tabular-nums", !d ? "text-slate-400" : d.pct >= 0 ? "text-emerald-700" : "text-rose-700")}>{d ? pct(d.pct) : "—"}</td>
            </tr>
            {byHorizon.map((x) => (
              <tr key={x.h} className="border-t border-slate-100 text-slate-500">
                <td className="py-1 pl-4 pr-3">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: HORIZON_META[x.h].color }} />
                    {x.h} {x.title}
                  </span>
                </td>
                <td className="px-3 py-1 text-right tabular-nums">{thb(x.amount)}</td>
                <td className="px-3 py-1 text-right tabular-nums">{x.amount !== null && forecast ? share(x.amount / forecast) : "—"}</td>
                <td />
                <td />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * The unit's EBO plan as the OKR tab shows it: the same horizons, titles, focus
 * and key products as the EBO tab (read-only), with the OKR objectives tagged
 * to each horizon. Editing happens on the EBO tab.
 */
export function EboReadOnly({ year, data, target, objectives, canEdit, onEdit }: { year: number; data: EboPlanData | null; target: number | null; objectives: Objective[]; canEdit: boolean; onEdit: () => void }) {
  const [closed, setClosed] = useState<Set<HorizonId>>(() => new Set());
  // Same columns as the EBO tab (the person's own choice there), without the hospital split.
  const [viewPref, saveView] = usePersonalPref<GridView>("eboGridView", "ebo:gridView");
  const view: GridView = { ...DEFAULT_VIEW, ...(viewPref || {}), split: false };
  const has = !!data && HORIZON_IDS.some((h) => data.horizons[h].items.length);
  if (!data || !has)
    return (
      <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-[13px] text-slate-500">
        No key products for {year} yet. What you set on the EBO tab shows up here.
        <button type="button" onClick={onEdit} className="ml-2 font-medium text-blue-600 hover:underline">
          {canEdit ? "Start on the EBO tab" : "Open the EBO tab"}
        </button>
      </div>
    );
  return (
    <div className="space-y-2">
      {HORIZON_IDS.map((h) => {
        const hz = data.horizons[h];
        const meta = HORIZON_META[h];
        const f = horizonFigures(hz);
        const open = !closed.has(h);
        const objs = objectives.filter((o) => o.horizon === h);
        return (
          <div key={h} className="overflow-hidden rounded-xl border border-slate-200/80 bg-white">
            <button
              type="button"
              onClick={() =>
                setClosed((prev) => {
                  const n = new Set(prev);
                  if (n.has(h)) n.delete(h);
                  else n.add(h);
                  return n;
                })
              }
              aria-expanded={open}
              className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-left transition hover:brightness-[0.98]"
              style={{ background: `color-mix(in srgb, ${meta.color} 6%, white)` }}
            >
              <ChevronRight className={clsx("h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200", open && "rotate-90")} />
              <span className={clsx("rounded-md px-1.5 py-0.5 text-[12px] font-bold ring-1", meta.tone)}>{h}</span>
              <span className="min-w-0">
                <span className="block text-[13.5px] font-semibold text-slate-900">{hz.title || meta.title}</span>
                <span className="block truncate text-[12px] text-blue-700">{hz.focus || meta.focus}</span>
              </span>
              <span className="ml-auto flex flex-wrap items-baseline gap-x-4 gap-y-0.5 text-[12px] text-slate-500">
                <span>
                  Target <span className="text-[14px] font-semibold tabular-nums text-slate-900">{mb(f.target)}</span> MB
                </span>
                <span>
                  Portion <span className="font-semibold tabular-nums text-slate-900">{target ? share((f.target || 0) / target) : "—"}</span>
                </span>
                <span>
                  Growth <span className={clsx("font-semibold tabular-nums", (growth(f.target, f.revBase) ?? 0) >= 0 ? "text-emerald-700" : "text-rose-700")}>{pct(growth(f.target, f.revBase))}</span>
                </span>
                <span>
                  {topItems(hz.items).length} key products · {objs.length} {objs.length === 1 ? "objective" : "objectives"}
                </span>
              </span>
            </button>
            <div className={clsx("grid transition-[grid-template-rows] duration-300 ease-out", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
              <div className="min-h-0 overflow-hidden border-t border-slate-100">
                <EboGrid year={year} data={data} horizons={[h]} withHorizon={false} view={view} setView={saveView} sites={[]} fallback={{}} canEdit={false} />
                {objs.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 px-3 py-2 text-[12px] text-slate-500">
                    <Flag className="h-3.5 w-3.5 text-slate-400" /> OKR for {h}:
                    {objs.map((o) => (
                      <span key={o.id} className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                        {o.title || "Untitled objective"} · {Math.round(objectiveProgress(o) * 100)}%
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Stat({ label, value, unit, hint }: { label: string; value: string; unit?: string; hint?: string }) {
  return (
    <div>
      <p className="text-[11.5px] text-slate-500">{label}</p>
      <p className="text-[20px] font-semibold tabular-nums text-slate-900">
        {value} {unit && <span className="text-[12px] font-normal text-slate-400">{unit}</span>}
      </p>
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

// ---- the three-horizon chart -------------------------------------------------------------------

/** "+6.0% growth", or "New business" when there's no base-year revenue to grow from. */
function growthText(f: Figures) {
  const g = growth(f.target, f.revBase);
  if (g !== null) return `${pct(g)} growth`;
  return f.target ? "New business" : "No target yet";
}

// Three S-curves, each starting above the one before and never crossing it:
// H1 rises and levels off low, H2 starts above H1 and levels off higher, H3 above H2.
const CURVES: Record<HorizonId, string> = {
  H1: "M44 566 C 110 505, 230 476, 470 470 S 860 474, 985 486",
  H2: "M215 440 C 255 360, 335 326, 530 314 S 860 300, 985 296",
  H3: "M480 282 C 520 215, 600 185, 730 176 S 900 166, 985 162",
};

function HorizonChart({
  unit,
  year,
  data,
  hf,
  target,
  total,
  canEdit,
  onMilestone,
}: {
  unit: string;
  year: number;
  data: EboPlanData;
  hf: Record<HorizonId, Figures>;
  target: number | null;
  total: number | null;
  canEdit: boolean;
  onMilestone: (v: string) => void;
}) {
  const block = (h: HorizonId, style: React.CSSProperties) => {
    const hz = data.horizons[h];
    const names = productNames(hz);
    // At most four names (flagship first), one line each, so the text stays clear of the curves.
    const fl = names.flagship.slice(0, 4);
    const ot = names.other.slice(0, 4 - fl.length);
    const more = names.flagship.length + names.other.length - fl.length - ot.length;
    const list = (xs: string[]) => (
      <ul className="leading-snug">
        {xs.map((n) => (
          <li key={n} className="truncate" title={n}>
            - {n}
          </li>
        ))}
      </ul>
    );
    return (
      <div className="absolute text-[11.5px] text-slate-700" style={style}>
        <p className="truncate text-[13px] font-semibold" style={{ color: HORIZON_META[h].color }}>
          {hz.title || HORIZON_META[h].title}
        </p>
        {fl.length > 0 && (
          <>
            <p className="font-semibold" style={{ color: HORIZON_META[h].color }}>
              Flagship
            </p>
            {list(fl)}
          </>
        )}
        {ot.length > 0 && (
          <>
            <p className="font-semibold" style={{ color: HORIZON_META[h].color }}>
              Non-flagship
            </p>
            {list(ot)}
          </>
        )}
        {more > 0 && <p className="text-slate-400">+{more} more</p>}
        {!names.flagship.length && !names.other.length && <p className="text-slate-400">No key products yet</p>}
      </div>
    );
  };
  const stats = (h: HorizonId, style: React.CSSProperties) => (
    <div className="absolute text-[11.5px] leading-snug" style={style}>
      <p className="font-semibold" style={{ color: HORIZON_META[h].color }}>
        {h} · {mb(hf[h].target)} MB{" "}
        <span className="font-normal">({target ? share((hf[h].target || 0) / target) : "—"} portion)</span>
      </p>
      <p className="text-slate-700">{growthText(hf[h])}</p>
      {data.horizons[h].focus && <p className="italic text-slate-400">*Focus: {data.horizons[h].focus}</p>}
    </div>
  );
  return (
    <div className="rounded-xl border border-slate-200/80 p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="rounded-md bg-blue-600 px-3 py-1.5 text-[14px] font-semibold text-white">
          {unit} : Emerging Business Opportunity Y{year}
        </h3>
        <label className="flex items-center gap-2 text-[12px] text-slate-500">
          Milestone
          <TextInput
            value={data.milestone || ""}
            disabled={!canEdit}
            placeholder="e.g. Brain Health & Neuro-Prevention (2028)"
            onChange={onMilestone}
            className="h-8 w-72 rounded-md border border-slate-200 px-2 text-[12.5px] text-slate-800"
          />
        </label>
      </div>
      <div className="overflow-x-auto">
        <div className="relative min-w-[860px]" style={{ aspectRatio: "1000 / 600" }}>
          <svg viewBox="0 0 1000 600" className="absolute inset-0 h-full w-full" aria-hidden>
            <path d="M40 8 V570 H992" fill="none" stroke="var(--color-slate-300)" strokeWidth={2} />
            {HORIZON_IDS.map((h, i) => (
              <path key={h} d={CURVES[h]} pathLength={1} fill="none" stroke={HORIZON_META[h].color} strokeWidth={4} strokeLinecap="round" className={clsx("ebo-curve", i === 1 && "ebo-curve-2", i === 2 && "ebo-curve-3")} />
            ))}
          </svg>
          <span className="absolute left-[4.6%] top-0 text-[11px] text-slate-400">Revenue / HN</span>
          {data.milestone && <div className="absolute right-[1%] top-[1%] max-w-[24%] rounded-md bg-blue-700 px-2.5 py-1 text-[11.5px] font-medium text-white">Milestone: {data.milestone}</div>}
          {/* Text sits in the open space between the curves, never on them. */}
          {block("H3", { left: "48%", top: "1%", width: "26%" })}
          {stats("H3", { left: "68%", top: "33%", width: "30%" })}
          {block("H2", { left: "21%", top: "14%", width: "25%" })}
          {stats("H2", { left: "55%", top: "57%", width: "40%" })}
          {block("H1", { left: "5%", top: "42%", width: "15%" })}
          {stats("H1", { left: "49%", top: "84%", width: "48%" })}
          <span className="absolute bottom-0 right-[1%] text-[11px] text-slate-400">Time</span>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[12px]">
        <span className="rounded-md border border-rose-300 px-2.5 py-1 font-medium text-rose-600">
          Target {mb(target)} MB · EBO {mb(total)} MB
        </span>
        <span className="text-slate-400">
          H1: {year - 2} · H2: {year - 1} · H3: {year}
        </span>
      </div>
    </div>
  );
}

// ---- one horizon's key products -----------------------------------------------------------------

function HorizonTable({
  h,
  data,
  f,
  year,
  target,
  sites,
  fallback,
  canEdit,
  update,
  view,
  setView,
  objectives,
  onOpenOkr,
}: {
  h: HorizonId;
  data: EboPlanData;
  f: Figures;
  year: number;
  target: number | null;
  sites: string[];
  fallback: Record<string, number>;
  canEdit: boolean;
  update: (f: (d: EboPlanData) => EboPlanData) => void;
  view: GridView;
  setView: (v: GridView) => void;
  objectives: Objective[];
  onOpenOkr: () => void;
}) {
  const meta = HORIZON_META[h];
  const hz = data.horizons[h];
  const ro = !canEdit;
  const setH = (p: Partial<EboHorizon>) => update((d) => ({ ...d, horizons: { ...d.horizons, [h]: { ...d.horizons[h], ...p } } }));
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-200/80 px-4 py-3" style={{ background: `color-mix(in srgb, ${meta.color} 6%, transparent)` }}>
        <span className={clsx("rounded-md px-2 py-0.5 text-[12px] font-bold ring-1", meta.tone)}>{h}</span>
        <TextInput value={hz.title} disabled={ro} onChange={(v) => setH({ title: v })} placeholder={meta.title} className="h-8 w-48 rounded-md border border-transparent bg-transparent px-1.5 text-[14px] font-semibold text-slate-900 hover:border-slate-200 focus:border-blue-400 focus:bg-white" />
        <label className="flex min-w-[220px] flex-1 items-center gap-1.5 text-[12px] text-slate-500">
          Focus
          <TextInput value={hz.focus} disabled={ro} onChange={(v) => setH({ focus: v })} placeholder={meta.focus} className="h-8 w-full rounded-md border border-transparent bg-transparent px-1.5 text-[12.5px] text-blue-700 hover:border-slate-200 focus:border-blue-400 focus:bg-white" />
        </label>
        <div className="flex items-baseline gap-4 text-[12px] text-slate-500">
          <span>
            Target <span className="text-[15px] font-semibold tabular-nums text-slate-900">{mb(f.target)}</span> MB
          </span>
          <span>
            Portion <span className="font-semibold tabular-nums text-slate-900">{target ? share((f.target || 0) / target) : "—"}</span>
          </span>
          <span>
            Growth <span className={clsx("font-semibold tabular-nums", (growth(f.target, f.revBase) ?? 0) >= 0 ? "text-emerald-700" : "text-rose-700")}>{pct(growth(f.target, f.revBase))}</span>
          </span>
        </div>
        <button
          type="button"
          onClick={onOpenOkr}
          title={objectives.length ? objectives.map((o) => o.title || "Untitled objective").join("\n") : `Tag an objective with ${h} on the OKR tab to see it here`}
          className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[12px] font-medium text-slate-600 ring-1 ring-slate-200 transition hover:text-blue-700 hover:ring-blue-300"
        >
          <Flag className="h-3.5 w-3.5" />
          {objectives.length
            ? `${objectives.length} OKR ${objectives.length === 1 ? "objective" : "objectives"} · ${Math.round((objectives.reduce((a, o) => a + objectiveProgress(o), 0) / objectives.length) * 100)}% done`
            : "Add OKR"}
        </button>
      </div>
      <EboGrid year={year} data={data} horizons={[h]} withHorizon={false} view={view} setView={setView} sites={sites} fallback={fallback} canEdit={canEdit} update={update} />
      {!ro && (
        <div className="border-t border-slate-100 px-3 py-2">
          <button
            type="button"
            onClick={() => update((d) => ({ ...d, horizons: { ...d.horizons, [h]: { ...d.horizons[h], items: [...d.horizons[h].items, blankItem()] } } }))}
            className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium text-blue-700 hover:bg-blue-50"
          >
            <Plus className="h-4 w-4" /> Add key product to {h}
          </button>
        </div>
      )}
    </div>
  );
}
