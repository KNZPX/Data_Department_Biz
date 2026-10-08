"use client";

// EBO & OKR planning for each CoE / SBU: the business outcomes a unit commits to
// for the year (EBO), and the objectives and key results that get it there,
// with the initiatives behind them. Saves automatically; the team sees changes.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronsDownUp, ChevronsUpDown, CircleDot, Download, Flag, LayoutGrid, Loader2, Plus, Rocket, Search, Target, Trash2 } from "lucide-react";
import { clsx } from "clsx";
import { useAccess } from "@/components/auth/LoginGate";
import { confirmDialog, toast } from "@/components/feedback";
import { useOrgStructure } from "@/lib/useOrgStructure";
import { useT } from "@/lib/i18n";
import { useTargetLink } from "@/lib/useTargetLink";
import { HORIZON_IDS, HORIZON_META, eboId, horizonFigures, normalizeEbo, planFigures, resolveTarget, type EboPlanData, type EboPlanRow } from "@/lib/ebo";
import type { TabProps } from "./EboPage";
import {
  HORIZONS,
  STATUS,
  emptyPlan,
  krProgress,
  newId,
  normalizePlan,
  objectiveProgress,
  okrId,
  planProgress,
  type Ebo,
  type Horizon,
  type Initiative,
  type KeyResult,
  type Objective,
  type OkrPlanData,
  type OkrPlanRow,
  type Status,
} from "@/lib/okr";

type Saved = {
  data: OkrPlanData;
  updatedAt: string | null;
  updatedBy: string | null;
};
const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];

const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(/,/g, "")));
const showNum = (v: number | null) => (v === null || v === undefined || Number.isNaN(v) ? "" : String(v));
const pct = (x: number) => `${Math.round(x * 100)}%`;

export function OkrPage({ year, setYear, unitName, setUnitName, tabs, preferScenario, onOtherTab }: TabProps) {
  const t = useT();
  const { can } = useAccess();
  const canEdit = can("okr.edit");
  const { org } = useOrgStructure(year);
  const [site, setSite] = useState<string>("ALL");
  const [query, setQuery] = useState("");
  const link = useTargetLink(year, preferScenario);
  // Each unit's EBO plan (read-only here), to show its target gap next to the OKRs.
  const [ebo, setEbo] = useState<Record<string, EboPlanData>>({});
  useEffect(() => {
    let alive = true;
    fetch(`/api/ebo?year=${year}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { plans: [] }))
      .then((j: { plans: EboPlanRow[] }) => {
        if (!alive) return;
        const m: Record<string, EboPlanData> = {};
        for (const p of j.plans || []) if (p.id === eboId(year, p.unit)) m[p.unit] = normalizeEbo(p.data);
        setEbo(m);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [year]);
  const [plans, setPlans] = useState<Record<string, Saved>>({});
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const plansRef = useRef(plans);
  useEffect(() => {
    plansRef.current = plans;
  }, [plans]);

  const units = useMemo(
    () =>
      org.units.filter(
        (u) => u.active && (site === "ALL" || u.sites.includes(site)) && (!query.trim() || u.name.toLowerCase().includes(query.trim().toLowerCase()))
      ),
    [org, site, query]
  );
  const groups = Array.from(new Set(units.map((u) => u.group)));
  const unit = units.find((u) => u.name === unitName) || null;
  const keyOf = useCallback((name: string) => okrId(year, name, site), [year, site]);

  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetch(`/api/okr?year=${year}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { plans: [] }))
      .then((j: { plans: OkrPlanRow[] }) => {
        if (!alive) return;
        const map: Record<string, Saved> = {};
        for (const p of j.plans || [])
          map[p.id] = {
            data: normalizePlan(p.data),
            updatedAt: p.updated_at,
            updatedBy: p.updated_by,
          };
        setPlans(map);
        setLoading(false);
      })
      .catch(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [year]);

  const current: Saved | null = unit
    ? plans[keyOf(unit.name)] || {
        data: emptyPlan(),
        updatedAt: null,
        updatedBy: null,
      }
    : null;

  const persist = useCallback(
    async (name: string, key: string) => {
      let force = false;
      for (;;) {
        const p = plansRef.current[key];
        if (!p) return;
        setSaveState("saving");
        try {
          const res = await fetch("/api/okr", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              year,
              unit: name,
              site,
              data: p.data,
              baseUpdatedAt: p.updatedAt,
              force,
            }),
          });
          const json = await res.json().catch(() => ({}));
          if (res.status === 409) {
            setSaveState("idle");
            const c = json.conflict || {};
            const mine = await confirmDialog({
              title: `${c.updatedBy || "Someone"} changed ${name}'s plan too`,
              body: "Keep your version (replaces theirs), or load theirs (your last edits are dropped)?",
              confirmLabel: "Keep mine",
              cancelLabel: "Load theirs",
              danger: true,
            });
            if (mine) {
              force = true;
              continue;
            }
            setPlans((prev) => ({
              ...prev,
              [key]: {
                data: normalizePlan(c.data),
                updatedAt: c.updatedAt,
                updatedBy: c.updatedBy,
              },
            }));
            return;
          }
          if (!res.ok) throw new Error(json.error || "The server didn't accept it");
          setPlans((prev) => ({
            ...prev,
            [key]: {
              ...prev[key],
              updatedAt: json.updatedAt,
              updatedBy: json.updatedBy,
            },
          }));
          setSaveState("saved");
        } catch (e) {
          setSaveState("error");
          toast.error("Couldn't save the plan", {
            body: e instanceof Error ? e.message : undefined,
          });
        }
        return;
      }
    },
    [year, site]
  );

  /** Change the open unit's plan and save a moment later. */
  function update(f: (d: OkrPlanData) => OkrPlanData) {
    if (!unit || !canEdit) return;
    const key = keyOf(unit.name);
    const base = plans[key] || {
      data: emptyPlan(),
      updatedAt: null,
      updatedBy: null,
    };
    setPlans((prev) => ({
      ...prev,
      [key]: { ...base, data: f(structuredClone(base.data)) },
    }));
    setSaveState("saving");
    clearTimeout(timers.current[key]);
    const name = unit.name;
    timers.current[key] = setTimeout(() => void persist(name, key), 900);
  }

  async function exportExcel() {
    const ebos: Record<string, string | number | null>[] = [];
    const krs: Record<string, string | number | null>[] = [];
    const inits: Record<string, string | number | null>[] = [];
    for (const u of units) {
      const d = plans[keyOf(u.name)]?.data;
      if (!d) continue;
      for (const e of d.ebos)
        ebos.push({
          unit: u.name,
          group: u.group,
          horizon: e.horizon || "H1",
          outcome: e.outcome,
          measure: e.measure,
          u: e.unit,
          baseline: e.baseline,
          target: e.target,
          actual: e.actual,
          owner: e.owner,
        });
      for (const o of d.objectives) {
        for (const k of o.keyResults)
          krs.push({
            unit: u.name,
            objective: o.title,
            kr: k.text,
            u: k.unit,
            start: k.start,
            target: k.target,
            current: k.current,
            progress: Math.round(krProgress(k) * 100),
            status: STATUS.find((s) => s.id === k.status)?.label || "",
            owner: k.owner,
            due: k.due,
          });
        for (const i of o.initiatives)
          inits.push({
            unit: u.name,
            objective: o.title,
            initiative: i.text,
            owner: i.owner,
            due: i.due,
            status: STATUS.find((s) => s.id === i.status)?.label || "",
          });
      }
    }
    const res = await fetch("/api/export/xlsx", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: `EBO-OKR-${year}${site !== "ALL" ? `-${site}` : ""}`,
        sheets: [
          {
            name: "EBO",
            columns: [
              { header: "CoE / SBU", key: "unit", width: 26 },
              { header: "Group", key: "group", width: 14 },
              { header: "Horizon", key: "horizon", width: 10 },
              { header: "Outcome", key: "outcome", width: 40 },
              { header: "Measure", key: "measure", width: 26 },
              { header: "Unit", key: "u", width: 10 },
              {
                header: `Baseline ${year - 1}`,
                key: "baseline",
                width: 14,
                numFmt: "#,##0.##",
              },
              {
                header: `Target ${year}`,
                key: "target",
                width: 14,
                numFmt: "#,##0.##",
              },
              {
                header: "Actual",
                key: "actual",
                width: 12,
                numFmt: "#,##0.##",
              },
              { header: "Owner", key: "owner", width: 18 },
            ],
            rows: ebos,
          },
          {
            name: "OKR",
            columns: [
              { header: "CoE / SBU", key: "unit", width: 26 },
              { header: "Objective", key: "objective", width: 36 },
              { header: "Key result", key: "kr", width: 44 },
              { header: "Unit", key: "u", width: 10 },
              { header: "Start", key: "start", width: 11, numFmt: "#,##0.##" },
              {
                header: "Target",
                key: "target",
                width: 11,
                numFmt: "#,##0.##",
              },
              {
                header: "Current",
                key: "current",
                width: 11,
                numFmt: "#,##0.##",
              },
              { header: "Progress %", key: "progress", width: 11 },
              { header: "Status", key: "status", width: 12 },
              { header: "Owner", key: "owner", width: 18 },
              { header: "Due", key: "due", width: 9 },
            ],
            rows: krs,
          },
          {
            name: "Initiatives",
            columns: [
              { header: "CoE / SBU", key: "unit", width: 26 },
              { header: "Objective", key: "objective", width: 36 },
              { header: "Initiative", key: "initiative", width: 48 },
              { header: "Owner", key: "owner", width: 18 },
              { header: "Due", key: "due", width: 9 },
              { header: "Status", key: "status", width: 12 },
            ],
            rows: inits,
          },
        ],
      }),
    }).catch(() => null);
    if (!res?.ok) return void toast.error("Couldn't export to Excel");
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = `EBO-OKR-${year}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const summary = useMemo(() => {
    const withPlan = units.filter((u) => plans[keyOf(u.name)]?.data.objectives.length || plans[keyOf(u.name)]?.data.ebos.length);
    const krs = units.flatMap((u) => plans[keyOf(u.name)]?.data.objectives.flatMap((o) => o.keyResults) || []);
    return {
      withPlan: withPlan.length,
      progress: krs.length ? krs.reduce((a, k) => a + krProgress(k), 0) / krs.length : 0,
      atRisk: krs.filter((k) => k.status === "at_risk" || k.status === "off_track").length,
      krs: krs.length,
    };
  }, [units, plans, keyOf]);

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto lg:overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 md:px-4">
        {tabs}
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-0.5">
          <button
            type="button"
            onClick={() => setYear((y) => y - 1)}
            className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100"
            aria-label="Previous year"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-2 text-[15px] font-semibold tabular-nums text-slate-900">{year}</span>
          <button
            type="button"
            onClick={() => setYear((y) => y + 1)}
            className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100"
            aria-label="Next year"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex max-w-full overflow-x-auto rounded-lg bg-slate-100 p-0.5 text-[12.5px]">
          {[{ code: "ALL", name: "Network" }, ...org.sites.filter((s) => s.active)].map((s) => (
            <button
              key={s.code}
              type="button"
              onClick={() => setSite(s.code)}
              className={clsx(
                "shrink-0 whitespace-nowrap rounded-md px-2.5 py-1 font-medium transition",
                site === s.code ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
              )}
            >
              {s.code === "ALL" ? t("Network") : s.code.replace(" (Premium)", "")}
            </button>
          ))}
        </div>
        <span className="hidden text-[12.5px] text-slate-500 md:inline">
          {summary.withPlan}/{units.length} units planned · {summary.krs} key results · {pct(summary.progress)} done
          {summary.atRisk > 0 && <span className="ml-1 font-medium text-amber-700">· {summary.atRisk} at risk</span>}
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
              className={clsx(
                "mb-1 flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px]",
                !unit ? "bg-blue-50 font-medium text-blue-800" : "text-slate-700 hover:bg-slate-50"
              )}
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
                    const p = d ? planProgress(d) : 0;
                    const has = !!(d && (d.objectives.length || d.ebos.length));
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => setUnitName(u.name)}
                        className={clsx(
                          "flex w-full flex-col gap-1 rounded-md px-2.5 py-1.5 text-left",
                          unit?.name === u.name ? "bg-blue-50" : "hover:bg-slate-50"
                        )}
                      >
                        <span className={clsx("truncate text-[13px]", unit?.name === u.name ? "font-medium text-blue-800" : "text-slate-800")}>{u.name}</span>
                        <span className="flex items-center gap-2">
                          <span className="h-1 flex-1 overflow-hidden rounded-full bg-slate-100">
                            <span className="block h-full rounded-full bg-blue-600 transition-[width] duration-500" style={{ width: pct(p) }} />
                          </span>
                          <span className="w-8 text-right text-[10.5px] tabular-nums text-slate-400">{has ? pct(p) : "—"}</span>
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
            <Overview units={units} plans={plans} keyOf={keyOf} onOpen={setUnitName} year={year} />
          ) : (
            <UnitPlan
              key={keyOf(unit.name)}
              unit={unit}
              year={year}
              data={current!.data}
              canEdit={canEdit}
              update={update}
              eboStrip={
                <EboStrip
                  year={year}
                  data={ebo[unit.name] || null}
                  planTarget={link.linked?.numbers[unit.name]?.target ?? null}
                  forecast={link.linked?.numbers[unit.name]?.base ?? null}
                  planName={link.linked?.scenario.name || null}
                  onOpen={onOtherTab}
                />
              }
            />
          )}
        </section>
      </div>
    </div>
  );
}

function Overview({
  units,
  plans,
  keyOf,
  onOpen,
  year,
}: {
  units: {
    id: string;
    name: string;
    group: string;
    lead?: string;
    sites: string[];
  }[];
  plans: Record<string, Saved>;
  keyOf: (n: string) => string;
  onOpen: (n: string) => void;
  year: number;
}) {
  return (
    <div className="p-4 md:p-5">
      <h2 className="text-[18px] font-semibold text-slate-900">{year} EBO &amp; OKR</h2>
      <p className="mb-4 text-[13px] text-slate-500">
        Each CoE / SBU&rsquo;s business outcomes and key results. Pick one to plan it; the list comes from Settings → Organisation.
      </p>
      <div className="stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-entering="">
        {units.map((u) => {
          const s = plans[keyOf(u.name)];
          const d = s?.data;
          const krs = d?.objectives.flatMap((o) => o.keyResults) || [];
          const p = d ? planProgress(d) : 0;
          const risk = krs.filter((k) => k.status === "at_risk" || k.status === "off_track").length;
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => onOpen(u.name)}
              className="lift rounded-xl border border-slate-200/80 bg-white p-4 text-left hover:border-blue-300"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-slate-900">{u.name}</p>
                  <p className="text-[11.5px] text-slate-500">
                    {u.group}
                    {u.lead ? ` · ${u.lead}` : ""}
                  </p>
                </div>
                <Ring value={p} empty={!krs.length} />
              </div>
              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-slate-500">
                <span>
                  <span className="font-medium text-slate-800">{d?.ebos.length || 0}</span> outcomes
                </span>
                <span>
                  <span className="font-medium text-slate-800">{d?.objectives.length || 0}</span> objectives
                </span>
                <span>
                  <span className="font-medium text-slate-800">{krs.length}</span> key results
                </span>
                {risk > 0 && <span className="font-medium text-amber-700">{risk} at risk</span>}
              </div>
              <p className="mt-2 text-[11.5px] text-slate-400">
                {s?.updatedAt
                  ? `Updated ${new Date(s.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} by ${s.updatedBy}`
                  : "Not planned yet"}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Ring({ value, empty }: { value: number; empty?: boolean }) {
  const r = 16;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 40 40" className="h-11 w-11 shrink-0 -rotate-90" aria-label={empty ? "No key results yet" : `${pct(value)} done`}>
      <circle cx="20" cy="20" r={r} fill="none" stroke="var(--color-slate-100)" strokeWidth="5" />
      {!empty && (
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke="var(--color-blue-600)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value)}
          className="transition-[stroke-dashoffset] duration-700"
        />
      )}
      <text x="20" y="20" transform="rotate(90 20 20)" textAnchor="middle" dominantBaseline="central" className="fill-slate-700 text-[10px] font-semibold">
        {empty ? "—" : pct(value)}
      </text>
    </svg>
  );
}

const cell =
  "h-8 w-full rounded-md border border-transparent bg-transparent px-2 text-[13px] text-slate-800 outline-none transition hover:border-slate-200 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 read-only:hover:border-transparent";

function UnitPlan({
  unit,
  year,
  data,
  canEdit,
  update,
  eboStrip,
}: {
  unit: {
    name: string;
    group: string;
    lead?: string;
    sites: string[];
    description?: string;
  };
  year: number;
  data: OkrPlanData;
  canEdit: boolean;
  update: (f: (d: OkrPlanData) => OkrPlanData) => void;
  eboStrip: React.ReactNode;
}) {
  const ro = !canEdit;
  // Horizon groups start collapsed.
  const [openH, setOpenH] = useState<Set<Horizon>>(() => new Set());
  const toggleH = (h: Horizon) =>
    setOpenH((prev) => {
      const n = new Set(prev);
      if (n.has(h)) n.delete(h);
      else n.add(h);
      return n;
    });
  const setEbo = (id: string, p: Partial<Ebo>) =>
    update((d) => ({
      ...d,
      ebos: d.ebos.map((e) => (e.id === id ? { ...e, ...p } : e)),
    }));
  const setObj = (id: string, f: (o: Objective) => Objective) =>
    update((d) => ({
      ...d,
      objectives: d.objectives.map((o) => (o.id === id ? f(o) : o)),
    }));
  const setKr = (oid: string, id: string, p: Partial<KeyResult>) =>
    setObj(oid, (o) => ({
      ...o,
      keyResults: o.keyResults.map((k) => (k.id === id ? { ...k, ...p } : k)),
    }));
  const setIni = (oid: string, id: string, p: Partial<Initiative>) =>
    setObj(oid, (o) => ({
      ...o,
      initiatives: o.initiatives.map((k) => (k.id === id ? { ...k, ...p } : k)),
    }));

  return (
    <div className="fade-enter mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div>
        <p className="text-[12px] text-slate-500">
          {unit.group} · {unit.sites.map((s) => s.replace(" (Premium)", "")).join(", ")}
          {unit.lead ? ` · Lead: ${unit.lead}` : ""}
        </p>
        <h2 className="text-[22px] font-semibold tracking-tight text-slate-900">{unit.name}</h2>
        {unit.description && <p className="mt-1 text-[13px] text-slate-500">{unit.description}</p>}
        <div className="mt-3 flex items-center gap-3">
          <div className="h-2 w-64 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-blue-600 transition-[width] duration-700" style={{ width: pct(planProgress(data)) }} />
          </div>
          <span className="text-[12.5px] text-slate-500">{pct(planProgress(data))} of key results done</span>
        </div>
      </div>

      {eboStrip}

      {/* EBO, grouped by horizon */}
      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
            <Target className="h-4 w-4 text-blue-600" /> Outcomes — what the unit commits to, by horizon
          </h3>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setOpenH(new Set(HORIZONS.map((h) => h.id)))}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[12.5px] font-medium text-slate-600 hover:bg-slate-100"
            >
              <ChevronsUpDown className="h-3.5 w-3.5" /> Expand all
            </button>
            <button
              type="button"
              onClick={() => setOpenH(new Set())}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[12.5px] font-medium text-slate-600 hover:bg-slate-100"
            >
              <ChevronsDownUp className="h-3.5 w-3.5" /> Collapse all
            </button>
          </div>
        </div>
        <div className="space-y-2">
          {HORIZONS.map((h) => {
            const list = data.ebos.filter((e) => (e.horizon || "H1") === h.id);
            const open = openH.has(h.id);
            const withTarget = list.filter((e) => e.target !== null).length;
            return (
              <div key={h.id} className="overflow-hidden rounded-xl border border-slate-200/80 bg-white">
                <button
                  type="button"
                  onClick={() => toggleH(h.id)}
                  aria-expanded={open}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-slate-50"
                >
                  <ChevronRight className={clsx("h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200", open && "rotate-90")} />
                  <span className={clsx("rounded-md px-1.5 py-0.5 text-[12px] font-bold ring-1 ring-inset", h.tone)}>{h.id}</span>
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-semibold text-slate-900">{h.label}</span>
                    <span className="block truncate text-[12px] text-slate-500">{h.hint}</span>
                  </span>
                  <span className="ml-auto shrink-0 text-[12px] text-slate-500">
                    {list.length} {list.length === 1 ? "outcome" : "outcomes"}
                    {list.length > 0 && <span className="text-slate-400"> · {withTarget} with a target</span>}
                  </span>
                </button>
                <div className={clsx("grid transition-[grid-template-rows] duration-300 ease-out", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                  <div className="min-h-0 overflow-hidden">
                    <div className="overflow-x-auto border-t border-slate-100">
                      <table className="w-full min-w-[960px] border-separate border-spacing-0 text-[13px]">
                        <thead className="bg-slate-50 text-[11.5px] text-slate-500">
                          <tr>
                            <th className="min-w-[220px] px-2 py-2 text-left font-medium">Outcome</th>
                            <th className="min-w-[150px] px-2 py-2 text-left font-medium">Measure</th>
                            <th className="w-20 px-2 py-2 text-left font-medium">Unit</th>
                            <th className="w-28 px-2 py-2 text-right font-medium">{year - 1} baseline</th>
                            <th className="w-28 px-2 py-2 text-right font-medium">{year} target</th>
                            <th className="w-28 px-2 py-2 text-right font-medium">Actual</th>
                            <th className="w-32 px-2 py-2 text-left font-medium">Owner</th>
                            <th className="w-16 px-2 py-2 text-left font-medium">Horizon</th>
                            <th className="w-9" />
                          </tr>
                        </thead>
                        <tbody>
                          {list.length === 0 && (
                            <tr>
                              <td colSpan={9} className="px-3 py-4 text-center text-[12.5px] text-slate-400">
                                No {h.id} outcomes yet{h.id === "H1" ? <> — e.g. &ldquo;Grow trauma revenue&rdquo;, measure &ldquo;Net revenue&rdquo;, unit &ldquo;MB&rdquo;.</> : "."}
                              </td>
                            </tr>
                          )}
                          {list.map((e) => (
                            <tr key={e.id} className="group">
                              <td className="border-t border-slate-100 px-1 py-1">
                                <input readOnly={ro} value={e.outcome} onChange={(x) => setEbo(e.id, { outcome: x.target.value })} placeholder="What the unit will achieve" className={clsx(cell, "font-medium")} />
                              </td>
                              <td className="border-t border-slate-100 px-1 py-1">
                                <input readOnly={ro} value={e.measure} onChange={(x) => setEbo(e.id, { measure: x.target.value })} placeholder="How it's measured" className={cell} />
                              </td>
                              <td className="border-t border-slate-100 px-1 py-1">
                                <input readOnly={ro} value={e.unit} onChange={(x) => setEbo(e.id, { unit: x.target.value })} placeholder="MB, %, cases" className={cell} />
                              </td>
                              {(["baseline", "target", "actual"] as const).map((k) => (
                                <td key={k} className="border-t border-slate-100 px-1 py-1">
                                  <input
                                    readOnly={ro}
                                    inputMode="decimal"
                                    value={showNum(e[k])}
                                    onChange={(x) => setEbo(e.id, { [k]: num(x.target.value) })}
                                    placeholder="–"
                                    className={clsx(cell, "text-right tabular-nums")}
                                  />
                                </td>
                              ))}
                              <td className="border-t border-slate-100 px-1 py-1">
                                <input readOnly={ro} value={e.owner} onChange={(x) => setEbo(e.id, { owner: x.target.value })} placeholder="Owner" className={cell} />
                              </td>
                              <td className="border-t border-slate-100 px-1 py-1">
                                <select
                                  disabled={ro}
                                  value={e.horizon || "H1"}
                                  onChange={(x) => {
                                    const to = x.target.value as Horizon;
                                    setEbo(e.id, { horizon: to });
                                    setOpenH((prev) => new Set(prev).add(to));
                                  }}
                                  className="h-8 w-full rounded-md border border-transparent bg-transparent px-1 text-[12.5px] text-slate-700 outline-none hover:border-slate-200 focus:border-blue-400"
                                  aria-label="Horizon"
                                >
                                  {HORIZONS.map((o) => (
                                    <option key={o.id} value={o.id}>
                                      {o.id}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="border-t border-slate-100 px-1 py-1">
                                {!ro && (
                                  <button
                                    type="button"
                                    onClick={() => update((d) => ({ ...d, ebos: d.ebos.filter((x) => x.id !== e.id) }))}
                                    className="grid h-7 w-7 place-items-center rounded-md text-slate-300 opacity-0 hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
                                    aria-label="Remove outcome"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {!ro && (
                      <div className="border-t border-slate-100 px-2 py-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            update((d) => ({
                              ...d,
                              ebos: [...d.ebos, { id: newId("ebo"), horizon: h.id, outcome: "", measure: "", unit: "", baseline: null, target: null, actual: null, owner: "" }],
                            }))
                          }
                          className="flex items-center gap-1 rounded-md px-2 py-1 text-[12.5px] font-medium text-blue-600 hover:bg-blue-50"
                        >
                          <Plus className="h-3.5 w-3.5" /> Add {h.id} outcome
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* OKRs */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
            <Flag className="h-4 w-4 text-blue-600" /> OKR — objectives &amp; key results
          </h3>
          {!ro && (
            <button
              type="button"
              onClick={() =>
                update((d) => ({
                  ...d,
                  objectives: [
                    ...d.objectives,
                    {
                      id: newId("obj"),
                      title: "",
                      owner: "",
                      keyResults: [],
                      initiatives: [],
                    },
                  ],
                }))
              }
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[12.5px] font-medium text-blue-600 hover:bg-blue-50"
            >
              <Plus className="h-3.5 w-3.5" /> Add objective
            </button>
          )}
        </div>
        {data.objectives.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-[12.5px] text-slate-400">No objectives yet.</p>
        )}
        <div className="space-y-4">
          {data.objectives.map((o, oi) => (
            <div key={o.id} className="pop-in rounded-xl border border-slate-200/80 bg-white">
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2.5">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-blue-50 text-[12px] font-semibold text-blue-700">O{oi + 1}</span>
                <input
                  readOnly={ro}
                  value={o.title}
                  onChange={(x) => setObj(o.id, (y) => ({ ...y, title: x.target.value }))}
                  placeholder="Objective — what you want to achieve"
                  className={clsx(cell, "min-w-[240px] flex-1 text-[14px] font-semibold")}
                />
                <input
                  readOnly={ro}
                  value={o.owner}
                  onChange={(x) => setObj(o.id, (y) => ({ ...y, owner: x.target.value }))}
                  placeholder="Owner"
                  className={clsx(cell, "w-36")}
                />
                <select
                  disabled={ro}
                  value={o.horizon || ""}
                  onChange={(x) => setObj(o.id, (y) => ({ ...y, horizon: (x.target.value || undefined) as Horizon | undefined }))}
                  title="Which EBO horizon this objective serves (shown on the EBO tab)"
                  aria-label="EBO horizon"
                  className={clsx(
                    "h-7 rounded-full border-0 px-2 text-[11.5px] font-semibold outline-none ring-1",
                    o.horizon ? HORIZON_META[o.horizon].tone : "bg-white text-slate-400 ring-slate-200"
                  )}
                >
                  <option value="">No horizon</option>
                  {HORIZON_IDS.map((h) => (
                    <option key={h} value={h}>
                      {h} · {HORIZON_META[h].title}
                    </option>
                  ))}
                </select>
                <span className="flex items-center gap-2 text-[12px] text-slate-500">
                  <span className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                    <span className="block h-full rounded-full bg-blue-600 transition-[width] duration-500" style={{ width: pct(objectiveProgress(o)) }} />
                  </span>
                  {pct(objectiveProgress(o))}
                </span>
                {!ro && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (
                        await confirmDialog({
                          title: "Remove this objective?",
                          body: "Its key results and initiatives go too. The activity log keeps the previous version.",
                          confirmLabel: "Remove",
                          danger: true,
                        })
                      )
                        update((d) => ({
                          ...d,
                          objectives: d.objectives.filter((x) => x.id !== o.id),
                        }));
                    }}
                    className="grid h-7 w-7 place-items-center rounded-md text-slate-300 hover:bg-rose-50 hover:text-rose-600"
                    aria-label="Remove objective"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] border-separate border-spacing-0 text-[13px]">
                  <thead className="text-[11px] text-slate-400">
                    <tr>
                      <th className="px-3 pt-2 text-left font-medium">Key result</th>
                      <th className="w-16 px-1 pt-2 text-left font-medium">Unit</th>
                      <th className="w-20 px-1 pt-2 text-right font-medium">Start</th>
                      <th className="w-20 px-1 pt-2 text-right font-medium">Target</th>
                      <th className="w-20 px-1 pt-2 text-right font-medium">Current</th>
                      <th className="w-24 px-1 pt-2 text-left font-medium">Progress</th>
                      <th className="w-28 px-1 pt-2 text-left font-medium">Status</th>
                      <th className="w-28 px-1 pt-2 text-left font-medium">Owner</th>
                      <th className="w-16 px-1 pt-2 text-left font-medium">Due</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {o.keyResults.map((k, ki) => (
                      <tr key={k.id} className="group">
                        <td className="px-2 py-0.5">
                          <span className="flex items-center gap-1">
                            <span className="w-7 shrink-0 text-[11px] font-medium text-slate-400">KR{ki + 1}</span>
                            <input
                              readOnly={ro}
                              value={k.text}
                              onChange={(x) => setKr(o.id, k.id, { text: x.target.value })}
                              placeholder="Measurable result"
                              className={cell}
                            />
                          </span>
                        </td>
                        <td className="px-1 py-0.5">
                          <input readOnly={ro} value={k.unit} onChange={(x) => setKr(o.id, k.id, { unit: x.target.value })} className={cell} />
                        </td>
                        {(["start", "target", "current"] as const).map((f) => (
                          <td key={f} className="px-1 py-0.5">
                            <input
                              readOnly={ro}
                              inputMode="decimal"
                              value={showNum(k[f])}
                              onChange={(x) => setKr(o.id, k.id, { [f]: num(x.target.value) })}
                              placeholder="–"
                              className={clsx(cell, "text-right tabular-nums")}
                            />
                          </td>
                        ))}
                        <td className="px-1 py-0.5">
                          <span className="flex items-center gap-1.5">
                            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                              <span className="block h-full rounded-full bg-blue-600 transition-[width] duration-500" style={{ width: pct(krProgress(k)) }} />
                            </span>
                            <span className="w-8 text-right text-[11px] tabular-nums text-slate-500">{pct(krProgress(k))}</span>
                          </span>
                        </td>
                        <td className="px-1 py-0.5">
                          <StatusSelect value={k.status} disabled={ro} onChange={(s) => setKr(o.id, k.id, { status: s })} />
                        </td>
                        <td className="px-1 py-0.5">
                          <input readOnly={ro} value={k.owner} onChange={(x) => setKr(o.id, k.id, { owner: x.target.value })} className={cell} />
                        </td>
                        <td className="px-1 py-0.5">
                          <select
                            disabled={ro}
                            value={k.due}
                            onChange={(x) => setKr(o.id, k.id, { due: x.target.value })}
                            className="h-8 w-full rounded-md border border-transparent bg-transparent text-[12.5px] outline-none hover:border-slate-200"
                          >
                            <option value="">—</option>
                            {QUARTERS.map((q) => (
                              <option key={q}>{q}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-1 py-0.5">
                          {!ro && (
                            <button
                              type="button"
                              onClick={() =>
                                setObj(o.id, (y) => ({
                                  ...y,
                                  keyResults: y.keyResults.filter((x) => x.id !== k.id),
                                }))
                              }
                              className="grid h-7 w-7 place-items-center rounded-md text-slate-300 opacity-0 hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
                              aria-label="Remove key result"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!ro && (
                <button
                  type="button"
                  onClick={() =>
                    setObj(o.id, (y) => ({
                      ...y,
                      keyResults: [
                        ...y.keyResults,
                        {
                          id: newId("kr"),
                          text: "",
                          unit: "",
                          start: null,
                          target: null,
                          current: null,
                          owner: "",
                          due: "",
                          status: "not_started",
                        },
                      ],
                    }))
                  }
                  className="ml-3 mt-1 flex items-center gap-1 rounded-md px-2 py-1 text-[12.5px] font-medium text-blue-600 hover:bg-blue-50"
                >
                  <Plus className="h-3.5 w-3.5" /> Add key result
                </button>
              )}

              <div className="mx-3 mb-3 mt-2 rounded-lg bg-slate-50/80 p-2.5">
                <p className="mb-1 flex items-center gap-1.5 text-[11.5px] font-medium uppercase tracking-[0.05em] text-slate-500">
                  <CircleDot className="h-3.5 w-3.5" /> Initiatives
                </p>
                {o.initiatives.length === 0 && <p className="px-1 text-[12px] text-slate-400">The projects or actions that move these key results.</p>}
                {o.initiatives.map((i) => (
                  <div key={i.id} className="group grid items-center gap-1 sm:grid-cols-[1fr_130px_70px_120px_28px]">
                    <input
                      readOnly={ro}
                      value={i.text}
                      onChange={(x) => setIni(o.id, i.id, { text: x.target.value })}
                      placeholder="Initiative"
                      className={cell}
                    />
                    <input readOnly={ro} value={i.owner} onChange={(x) => setIni(o.id, i.id, { owner: x.target.value })} placeholder="Owner" className={cell} />
                    <select
                      disabled={ro}
                      value={i.due}
                      onChange={(x) => setIni(o.id, i.id, { due: x.target.value })}
                      className="h-8 rounded-md border border-transparent bg-transparent text-[12.5px] outline-none hover:border-slate-200"
                    >
                      <option value="">Due</option>
                      {QUARTERS.map((q) => (
                        <option key={q}>{q}</option>
                      ))}
                    </select>
                    <StatusSelect value={i.status} disabled={ro} onChange={(s) => setIni(o.id, i.id, { status: s })} />
                    {!ro ? (
                      <button
                        type="button"
                        onClick={() =>
                          setObj(o.id, (y) => ({
                            ...y,
                            initiatives: y.initiatives.filter((x) => x.id !== i.id),
                          }))
                        }
                        className="grid h-7 w-7 place-items-center rounded-md text-slate-300 opacity-0 hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
                        aria-label="Remove initiative"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <span />
                    )}
                  </div>
                ))}
                {!ro && (
                  <button
                    type="button"
                    onClick={() =>
                      setObj(o.id, (y) => ({
                        ...y,
                        initiatives: [
                          ...y.initiatives,
                          {
                            id: newId("ini"),
                            text: "",
                            owner: "",
                            due: "",
                            status: "not_started",
                          },
                        ],
                      }))
                    }
                    className="mt-1 flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] font-medium text-blue-600 hover:bg-blue-50"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add initiative
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-1.5 text-[13px] font-semibold text-slate-900">Notes</h3>
        <textarea
          readOnly={ro}
          rows={3}
          value={data.notes || ""}
          onChange={(x) => update((d) => ({ ...d, notes: x.target.value }))}
          placeholder="Assumptions, dependencies, risks…"
          className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
        />
      </section>
    </div>
  );
}

/** The unit's EBO and next year's target against this year's forecast, with a jump to the EBO tab. */
function EboStrip({ year, data, planTarget, forecast, planName, onOpen }: { year: number; data: EboPlanData | null; planTarget: number | null; forecast: number | null; planName: string | null; onOpen: () => void }) {
  const target = resolveTarget(planTarget, data);
  const tot = data ? planFigures(data) : null;
  const d = target.value !== null && forecast ? { thb: target.value - forecast, pct: target.value / forecast - 1 } : null;
  const mb = (v: number | null) => (v === null ? "—" : (v / 1e6).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
  const thb = (v: number) => Math.round(Math.abs(v)).toLocaleString("en-US");
  return (
    <section className="rounded-xl border border-slate-200/80 bg-gradient-to-r from-emerald-50/50 via-fuchsia-50/40 to-blue-50/50 p-3.5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <span className="flex items-center gap-2 text-[13.5px] font-semibold text-slate-900">
          <Rocket className="h-4 w-4 text-blue-600" /> EBO {year}
        </span>
        <span className="text-[12.5px] text-slate-600">
          Target <span className="font-semibold tabular-nums text-slate-900">{mb(target.value)}</span> MB
          <span className="text-slate-400"> · {target.from === "plan" ? `“${planName}”` : target.from === "manual" ? "typed on the EBO tab" : "no target yet"}</span>
        </span>
        <span className="text-[12.5px] text-slate-600">
          Planned <span className="font-semibold tabular-nums text-slate-900">{mb(tot?.target ?? null)}</span> MB
        </span>
        {d && (
          <span className={clsx("text-[12.5px] font-semibold tabular-nums", d.thb >= 0 ? "text-emerald-700" : "text-rose-700")} title={`Target ${year} against the ${year - 1} forecast (${mb(forecast)} MB) in the Target plan`}>
            vs Forecast {year - 1} {d.thb >= 0 ? "+" : "−"}
            {thb(d.thb)} THB ({d.pct >= 0 ? "+" : ""}
            {(d.pct * 100).toFixed(1)}%)
          </span>
        )}
        <span className="flex gap-2 text-[11.5px] text-slate-500">
          {HORIZON_IDS.map((h) => (
            <span key={h} className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ background: HORIZON_META[h].color }} />
              {h} {data ? mb(horizonFigures(data.horizons[h]).target) : "—"}
            </span>
          ))}
        </span>
        <button type="button" onClick={onOpen} className="ml-auto flex h-8 items-center gap-1.5 rounded-lg bg-white px-3 text-[12.5px] font-medium text-blue-700 ring-1 ring-blue-200 hover:bg-blue-50">
          {data ? "Open EBO" : "Start the EBO plan"} <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </section>
  );
}

function StatusSelect({ value, onChange, disabled }: { value: Status; onChange: (s: Status) => void; disabled?: boolean }) {
  const s = STATUS.find((x) => x.id === value) || STATUS[0];
  return (
    <select
      disabled={disabled}
      value={value}
      onChange={(e) => onChange(e.target.value as Status)}
      className={clsx("h-7 w-full cursor-pointer rounded-full border-0 px-2 text-[11.5px] font-medium outline-none", s.tone, disabled && "cursor-default")}
    >
      {STATUS.map((x) => (
        <option key={x.id} value={x.id}>
          {x.label}
        </option>
      ))}
    </select>
  );
}
