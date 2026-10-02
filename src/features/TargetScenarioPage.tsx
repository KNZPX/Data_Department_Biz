"use client";

import { Fragment, createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CalendarRange,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Download,
  FolderOpen,
  Layers,
  Lock,
  MoreHorizontal,
  Network,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  Trash2,
  Undo2,
  Unlock,
  Users,
  X,
} from "lucide-react";
import { clsx } from "clsx";
import { useAccess } from "@/components/auth/LoginGate";
import { confirmDialog, promptDialog, toast } from "@/components/feedback";
import {
  MB,
  actualOf,
  addSub,
  changeStep,
  childrenOf,
  fairShare,
  findIssues,
  fromSnapshot,
  growthPct,
  maxFor,
  monthsOf,
  removeSub,
  renameSub,
  rollForward,
  setActual,
  setActualMonths,
  setPrior,
  setLocked,
  setTarget,
  spreadEvenGrowth,
  targetVisits,
  toSnapshot,
  walk,
  type ChangeReport,
  type Plan,
  type PlanNode,
  type PlanSnapshot,
} from "@/lib/targetPlan";
import { DEFAULT_STEP, buildBasePlan, legacyToTargets } from "@/lib/targetPlanBase";
import { HOSPITAL_PROFILES, TARGET_META } from "@/data/targetScenarioData";
import { useT } from "@/lib/i18n";
import { usePersonalPref } from "@/lib/usePersonalPref";

// =============================================================================
// 2027 target planner. Set a number at any level; the level above never moves
// and the levels below are re-split so everything always adds up.
// =============================================================================

type SavedScenario = {
  id: string;
  name: string;
  updated_at: string;
  created_by?: string | null;
  saved_at_label?: string | null;
  snapshot: { revTgt?: number; plan?: PlanSnapshot; snap?: unknown } & Record<string, unknown>;
};
type Tab = "plan" | "coe" | "months" | "segments";

const LEVEL_LABEL: Record<PlanNode["level"], string> = {
  network: "Network",
  site: "Hospital",
  coe: "CoE / SBU",
  sub: "Sub-unit",
  setting: "Setting",
  market: "Segment",
};
const STEPS = [
  { v: 0.01 * MB, label: "0.01 MB" },
  { v: 0.1 * MB, label: "0.1 MB" },
  { v: 1 * MB, label: "1 MB" },
];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SEGMENTS = ["Thai", "Expat", "Fly-in"] as const;
const DEPTH: Record<PlanNode["level"], number> = { network: 0, site: 1, coe: 2, sub: 3, setting: 4, market: 5 };

function decimalsFor(step: number) {
  return step >= MB ? 0 : step >= 0.1 * MB ? 1 : 2;
}
function fmtMB(thb: number, step: number) {
  const d = decimalsFor(step);
  return (thb / MB).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}
type Unit = "MB" | "THB";
const UnitContext = createContext<Unit>("MB");
/** THB → text in the person's unit (MB with the step's decimals, or whole Baht). */
function fmtU(thb: number, step: number, unit: Unit) {
  return unit === "MB" ? fmtMB(thb, step) : Math.round(thb).toLocaleString("en-US");
}
const unitDiv = (unit: Unit) => (unit === "MB" ? MB : 1);
const unitDecimals = (unit: Unit, step: number) => (unit === "MB" ? decimalsFor(step) : 0);
const unitLabel = (unit: Unit) => (unit === "MB" ? "MB" : "฿");

function fmtPct(p: number) {
  if (!Number.isFinite(p)) return "—";
  return `${p > 0 ? "+" : ""}${p.toFixed(1)}%`;
}
function siteColor(site: string) {
  return HOSPITAL_PROFILES[site]?.color || "#2563eb";
}
function pathOf(plan: Plan, id: string): string {
  const parts: string[] = [];
  let n: PlanNode | undefined = plan.nodes[id];
  while (n && n.parentId) {
    parts.unshift(n.name);
    n = plan.nodes[n.parentId];
  }
  return parts.join(" › ");
}

type Agg = { prior: number; base: number; target: number; visits: number; bySite: Record<string, number> };

/** CoE / SBU totals across hospitals (in the site filter), grouped by CoE / SBU / Hospital Focus / Usual Business. */
function coeTotals(plan: Plan, siteFilter: string) {
  const sites = siteFilter === "ALL" ? plan.nodes[plan.rootId].children : [siteFilter];
  const map = new Map<string, Agg & { name: string; group: string; units: string[] }>();
  for (const s of sites)
    for (const c of plan.nodes[s].children) {
      const n = plan.nodes[c];
      const key = n.name;
      const a = map.get(key) || { name: n.name, group: n.group || "Other", prior: 0, base: 0, target: 0, visits: 0, bySite: {}, units: [] };
      a.prior += n.prior25;
      a.base += n.base26;
      a.target += n.target;
      a.visits += targetVisits(n);
      a.bySite[s] = (a.bySite[s] || 0) + n.target;
      a.units.push(n.id);
      map.set(key, a);
    }
  const order = ["CoE", "SBU", "Hospital Focus", "Usual Business"];
  return { sites, rows: Array.from(map.values()).sort((a, b) => (order.indexOf(a.group) + 1 || 9) - (order.indexOf(b.group) + 1 || 9) || b.target - a.target) };
}

/** The node the By-month view follows: the selected row when it's inside the filter, else the filter itself. */
function monthScope(plan: Plan, siteFilter: string, selectedId: string): PlanNode {
  const scopeId = siteFilter === "ALL" ? plan.rootId : siteFilter;
  const n: PlanNode | undefined = plan.nodes[selectedId];
  let inside = false;
  for (let p: PlanNode | undefined = n; p; p = p.parentId ? plan.nodes[p.parentId] : undefined) if (p.id === scopeId) inside = true;
  return n && inside ? n : plan.nodes[scopeId];
}

function emptyReport(n: PlanNode): ChangeReport {
  return { nodeId: n.id, from: n.target, to: n.target, requested: n.target, clamped: false, siblings: [], scaledLocked: [], autoUnlocked: null };
}

function loadScenario(base: Plan, s: SavedScenario): Plan {
  const snap = s.snapshot || {};
  if (snap.plan?.version === 2) return fromSnapshot(base, snap.plan as PlanSnapshot);
  const targets = legacyToTargets(base, snap);
  if (!targets) return base;
  return fromSnapshot(base, { version: 2, step: DEFAULT_STEP, targets, locked: [], subs: [] });
}

export function TargetScenarioPage() {
  const { can } = useAccess();
  const t = useT();
  const canEdit = can("target.edit");
  const basePlan = useMemo(() => buildBasePlan(), []);

  const [plan, setPlan] = useState<Plan>(basePlan);
  const [past, setPast] = useState<Plan[]>([]);
  const [future, setFuture] = useState<Plan[]>([]);
  const [report, setReport] = useState<(ChangeReport & { label: string }) | null>(null);
  const [showMoved, setShowMoved] = useState(false);

  const [unitPref, saveUnit] = usePersonalPref<Unit>("targetUnit", "target:unit");
  const unit: Unit = unitPref === "THB" ? "THB" : "MB";
  const div = unitDiv(unit);
  const dec = unitDecimals(unit, plan.step);
  const [tab, setTab] = useState<Tab>("plan");
  const [siteFilter, setSiteFilter] = useState<string>("ALL");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(["PKT", ...basePlan.nodes.PKT.children]));
  const [selectedId, setSelectedId] = useState<string>("PKT");
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const [scenarios, setScenarios] = useState<SavedScenario[]>([]);
  const [current, setCurrent] = useState<{ id: string | null; name: string; updatedAt: string | null; savedBy: string | null }>({
    id: null,
    name: "Agreed plan · Revise 2027 (V2)",
    updatedAt: null,
    savedBy: null,
  });
  const [savedSig, setSavedSig] = useState(() => JSON.stringify(toSnapshot(basePlan)));
  const [scenarioMenu, setScenarioMenu] = useState(false);
  const [saving, setSaving] = useState(false);

  const issues = useMemo(() => findIssues(plan), [plan]);
  // The three years on screen: actual two years back, the base year, the year being planned.
  const Y = plan.targetYear;
  const B = Y - 1;
  const P = Y - 2;
  const dirty = useMemo(() => JSON.stringify(toSnapshot(plan)) !== savedSig, [plan, savedSig]);
  const root = plan.nodes[plan.rootId];

  // ---- data ------------------------------------------------------------------
  useEffect(() => {
    fetch("/api/target-scenario?only=scenarios", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j?.scenarios && setScenarios(j.scenarios))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // ---- history ---------------------------------------------------------------
  function commit(next: Plan, r?: ChangeReport & { label: string }) {
    setPast((p) => [...p.slice(-49), plan]);
    setFuture([]);
    setPlan(next);
    setReport(r || null);
    setShowMoved(false);
  }
  function undo() {
    if (!past.length) return;
    setFuture((f) => [plan, ...f]);
    setPlan(past[past.length - 1]);
    setPast(past.slice(0, -1));
    setReport(null);
  }
  function redo() {
    if (!future.length) return;
    setPast((p) => [...p, plan]);
    setPlan(future[0]);
    setFuture(future.slice(1));
    setReport(null);
  }

  const undoRef = useRef(undo);
  const redoRef = useRef(redo);
  useEffect(() => {
    undoRef.current = undo;
    redoRef.current = redo;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redoRef.current();
        else undoRef.current();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redoRef.current();
      } else if (e.key === "Escape") setMenuFor(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ---- edits -----------------------------------------------------------------
  function applyTarget(id: string, thb: number, label?: string) {
    if (!canEdit) return;
    const { plan: next, report: r } = setTarget(plan, id, thb);
    commit(next, { ...r, label: label || `${plan.nodes[id].name} set to ${fmtU(r.to, plan.step, unit)} ${unitLabel(unit)}` });
    if (r.clamped) toast.info("Capped at what's left", { body: `The most ${plan.nodes[id].name} can take is ${fmtU(r.to, plan.step, unit)} ${unitLabel(unit)} without going over ${plan.nodes[plan.nodes[id].parentId!].name}.` });
  }
  function toggleLock(id: string) {
    const n = plan.nodes[id];
    commit(setLocked(plan, id, !n.locked), {
      nodeId: id,
      from: n.target,
      to: n.target,
      requested: n.target,
      clamped: false,
      siblings: [],
      scaledLocked: [],
      autoUnlocked: null,
      label: n.locked ? `${n.name} is automatic again` : `${n.name} pinned at ${fmtU(n.target, plan.step, unit)} ${unitLabel(unit)}`,
    });
  }
  async function addSubUnit(coeId: string) {
    const name = await promptDialog({
      title: `Add a sub-unit to ${plan.nodes[coeId].name}`,
      body: "It starts at 0 MB. Give it a target and the rest of the CoE adjusts — the CoE total stays the same.",
      label: "Sub-unit name",
      placeholder: "e.g. Sports Medicine",
      confirmLabel: "Add",
    });
    if (!name) return;
    const { plan: next, subId } = addSub(plan, coeId, name);
    commit(next);
    setExpanded((s) => new Set([...s, coeId]));
    setSelectedId(subId);
    toast(`${name} added`, { body: `Click its ${plan.targetYear} target to give it a share of the CoE.` });
  }
  async function renameSubUnit(id: string) {
    const name = await promptDialog({ title: "Rename sub-unit", defaultValue: plan.nodes[id].name, confirmLabel: "Rename" });
    if (name) commit(renameSub(plan, id, name));
  }
  async function removeSubUnit(id: string) {
    const ok = await confirmDialog({
      title: `Remove ${plan.nodes[id].name}?`,
      body: "Its target goes back to the rest of the CoE. You can undo this.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (ok) commit(removeSub(plan, id));
  }

  // ---- scenarios ---------------------------------------------------------------
  function open(s: SavedScenario | null) {
    const next = s ? loadScenario(basePlan, s) : basePlan;
    setPlan(next);
    setPast([]);
    setFuture([]);
    setReport(null);
    setSavedSig(JSON.stringify(toSnapshot(next)));
    setCurrent(s ? { id: s.id, name: s.name, updatedAt: s.updated_at, savedBy: s.created_by || null } : { id: null, name: "Agreed plan · Revise 2027 (V2)", updatedAt: null, savedBy: null });
    setScenarioMenu(false);
    if (s && findIssues(next).length === 0 && !s.snapshot?.plan) toast.info("Opened an older scenario", { body: "Its numbers were re-split so every level adds up." });
  }
  async function switchTo(s: SavedScenario | null) {
    if (dirty) {
      const ok = await confirmDialog({ title: "Discard unsaved changes?", body: `You have changes to “${current.name}” that aren't saved.`, confirmLabel: "Discard", danger: true });
      if (!ok) return;
    }
    open(s);
  }

  async function save(asNew: boolean, force = false): Promise<void> {
    if (!canEdit) return;
    let name = current.name;
    if (asNew || !current.id) {
      const n = await promptDialog({
        title: asNew && current.id ? "Save as a new scenario" : "Save scenario",
        label: "Scenario name",
        defaultValue: current.id ? `${current.name} (copy)` : `${plan.targetYear} plan · ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
        confirmLabel: "Save",
      });
      if (!n) return;
      name = n;
    }
    setSaving(true);
    try {
      const snapshot = {
        name,
        ts: new Date().toLocaleString("th-TH"),
        revTgt: root.target,
        revBase: root.base26,
        growthPct: growthPct(root),
        plan: toSnapshot(plan),
      };
      const res = await fetch("/api/target-scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: asNew ? undefined : current.id || undefined,
          name,
          store_key: "targetPlan_v2",
          store_label: `${plan.targetYear} plan`,
          snapshot,
          baseUpdatedAt: asNew ? null : current.updatedAt,
          force,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 409) {
        setSaving(false);
        const c = json.conflict || {};
        const ok = await confirmDialog({
          title: `${c.updatedBy || "Someone"} saved this scenario after you opened it`,
          body: `Their save: ${c.updatedAt ? new Date(c.updatedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "just now"}.\n\nReplace their version with yours, or save yours as a new scenario?`,
          confirmLabel: "Replace theirs",
          cancelLabel: "Save as new",
          danger: true,
        });
        return ok ? save(false, true) : save(true);
      }
      if (!res.ok || !json.success) throw new Error(json.error || "The server didn't accept it");
      const rec: SavedScenario = json.scenario;
      setScenarios((prev) => [rec, ...prev.filter((s) => s.id !== rec.id)]);
      setCurrent({ id: rec.id, name: rec.name, updatedAt: rec.updated_at, savedBy: rec.created_by || null });
      setSavedSig(JSON.stringify(toSnapshot(plan)));
      toast("Scenario saved", { body: `${rec.name} — the team can open it now.` });
    } catch (e) {
      toast.error("Couldn't save the scenario", { body: e instanceof Error ? e.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  async function removeScenario(s: SavedScenario) {
    const ok = await confirmDialog({ title: `Delete “${s.name}”?`, body: "It's removed for everyone on the team.", confirmLabel: "Delete", danger: true });
    if (!ok) return;
    const res = await fetch(`/api/target-scenario?id=${encodeURIComponent(s.id)}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) return void toast.error("Couldn't delete the scenario");
    setScenarios((prev) => prev.filter((x) => x.id !== s.id));
    if (current.id === s.id) open(null);
    toast(`Deleted ${s.name}`);
  }

  const [exporting, setExporting] = useState(false);
  async function exportExcel() {
    setExporting(true);
    try {
      const v = (thb: number) => (unit === "MB" ? Math.round((thb / MB) * 100) / 100 : Math.round(thb));
      const nf = unit === "MB" ? "#,##0.00" : "#,##0";
      const u = unitLabel(unit) === "฿" ? "Baht" : "MB";
      const hasAct = plan.actualMonths > 0;
      // 1. Plan tree
      const planRows: Record<string, string | number | null>[] = [];
      const levels: number[] = [];
      const bold: boolean[] = [];
      const start = siteFilter === "ALL" ? plan.rootId : siteFilter;
      walk(plan, start, (n, d) => {
        planRows.push({
          unit: n.name,
          level: LEVEL_LABEL[n.level],
          group: n.group || "",
          site: n.site === "PKT" ? "Network" : n.site,
          prior: v(n.prior25),
          ...(hasAct ? { actual: v(actualOf(plan, n.id)) } : {}),
          base: v(n.base26),
          target: v(n.target),
          growth: Math.round(growthPct(n) * 10) / 10,
          plus: v(n.target - n.base26),
          share: n.parentId && plan.nodes[n.parentId].target > 0 ? Math.round((n.target / plan.nodes[n.parentId].target) * 1000) / 10 : 100,
          visits: Math.round(targetVisits(n)),
          pinned: n.locked ? "pinned" : "",
        });
        levels.push(d);
        bold.push(d <= 1);
      });
      const planCols = [
        { header: "Unit", key: "unit", width: 38 },
        { header: "Level", key: "level", width: 12 },
        { header: "Group", key: "group", width: 14 },
        { header: "Hospital", key: "site", width: 14 },
        { header: `${P} actual (${u})`, key: "prior", width: 16, numFmt: nf },
        ...(hasAct ? [{ header: `${B} actual ${MONTHS[0]}–${MONTHS[plan.actualMonths - 1]} (${u})`, key: "actual", width: 18, numFmt: nf }] : []),
        { header: `${B} full year (${u})`, key: "base", width: 16, numFmt: nf },
        { header: `${Y} target (${u})`, key: "target", width: 16, numFmt: nf },
        { header: "Growth %", key: "growth", width: 10, numFmt: "0.0" },
        { header: `+ vs ${B} (${u})`, key: "plus", width: 16, numFmt: nf },
        { header: "Share of parent %", key: "share", width: 12, numFmt: "0.0" },
        { header: `Visits ${Y}`, key: "visits", width: 12, numFmt: "#,##0" },
        { header: "Pinned", key: "pinned", width: 9 },
      ];
      // 2. By CoE / SBU
      const ct = coeTotals(plan, siteFilter);
      const coeCols = [
        { header: "CoE / SBU", key: "name", width: 30 },
        { header: "Group", key: "group", width: 16 },
        { header: `${P} actual (${u})`, key: "prior", width: 16, numFmt: nf },
        { header: `${B} full year (${u})`, key: "base", width: 16, numFmt: nf },
        { header: `${Y} target (${u})`, key: "target", width: 16, numFmt: nf },
        { header: "Growth %", key: "growth", width: 10, numFmt: "0.0" },
        ...ct.sites.map((sid) => ({ header: `${plan.nodes[sid].name} (${u})`, key: `s_${sid}`, width: 16, numFmt: nf })),
      ];
      const coeRows = ct.rows.map((r) => ({
        name: r.name,
        group: r.group,
        prior: v(r.prior),
        base: v(r.base),
        target: v(r.target),
        growth: r.base > 0 ? Math.round(((r.target - r.base) / r.base) * 1000) / 10 : 0,
        ...Object.fromEntries(ct.sites.map((sid) => [`s_${sid}`, v(r.bySite[sid] || 0)])),
      }));
      // 3. By month: every hospital and unit in the filter
      const monthRows: Record<string, string | number | null>[] = [];
      const monthLevels: number[] = [];
      walk(plan, start, (n, d) => {
        if (n.level === "setting" || n.level === "market") return;
        const w = monthsOf(plan, n.id);
        monthRows.push({ unit: n.name, ...Object.fromEntries(MONTHS.map((m, i) => [m, v(w[i] * n.target)])), year: v(n.target) });
        monthLevels.push(d);
      });
      const monthCols = [{ header: `${Y} target (${u})`, key: "unit", width: 34 }, ...MONTHS.map((m) => ({ header: m, key: m, width: 11, numFmt: nf })), { header: "Year", key: "year", width: 13, numFmt: nf }];
      // 4. By segment
      const segRows: Record<string, string | number | null>[] = [];
      for (const sid of siteFilter === "ALL" ? plan.nodes[plan.rootId].children : [siteFilter]) {
        const acc: Record<string, { t: number; b: number }> = {};
        walk(plan, sid, (n) => {
          if (n.level === "market" || n.level === "setting") {
            const k = n.name;
            acc[k] = acc[k] || { t: 0, b: 0 };
            acc[k].t += n.target;
            acc[k].b += n.base26;
          }
        });
        for (const k of [...SEGMENTS, "OPD", "IPD"]) if (acc[k]) segRows.push({ site: plan.nodes[sid].name, segment: k, base: v(acc[k].b), target: v(acc[k].t), growth: acc[k].b > 0 ? Math.round(((acc[k].t - acc[k].b) / acc[k].b) * 1000) / 10 : 0 });
      }
      const segCols = [
        { header: "Hospital", key: "site", width: 20 },
        { header: "Segment / setting", key: "segment", width: 18 },
        { header: `${B} full year (${u})`, key: "base", width: 16, numFmt: nf },
        { header: `${Y} target (${u})`, key: "target", width: 16, numFmt: nf },
        { header: "Growth %", key: "growth", width: 10, numFmt: "0.0" },
      ];
      const res = await fetch("/api/target-scenario/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: `target-${Y}-${current.name}`,
          sheets: [
            { name: "Plan", columns: planCols, rows: planRows, levels, bold },
            { name: "By CoE-SBU", columns: coeCols, rows: coeRows },
            { name: "By segment", columns: segCols, rows: segRows },
            { name: "By month", columns: monthCols, rows: monthRows, levels: monthLevels },
          ],
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Export failed");
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `target-${Y}-${current.name.replace(/[^\w-]+/g, "_")}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error("Couldn't export to Excel", { body: e instanceof Error ? e.message : undefined });
    } finally {
      setExporting(false);
    }
  }

  // ---- new plan for any year ----------------------------------------------------
  const [newPlanOpen, setNewPlanOpen] = useState(false);
  async function createPlan(year: number, from: "current" | "agreed", growth: number) {
    if (dirty) {
      const ok = await confirmDialog({ title: "Discard unsaved changes?", body: `You have changes to “${current.name}” that aren't saved.`, confirmLabel: "Discard", danger: true });
      if (!ok) return;
    }
    let next = from === "agreed" ? basePlan : plan;
    if (year < next.targetYear) return void toast.error(`Pick ${next.targetYear} or later`);
    while (next.targetYear < year) next = rollForward(next, growth);
    setPlan(next);
    setPast([]);
    setFuture([]);
    setReport(null);
    setSavedSig("");
    setCurrent({ id: null, name: `${year} plan`, updatedAt: null, savedBy: null });
    setNewPlanOpen(false);
    setScenarioMenu(false);
    toast(`${year} plan ready`, { body: `${year - 2} and ${year - 1} come from ${from === "agreed" ? "the agreed data" : `“${current.name}”`}. Save it to share with the team.` });
  }

  // ---- visible rows ------------------------------------------------------------
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out: { node: PlanNode; depth: number }[] = [];
    const startIds = siteFilter === "ALL" ? [plan.rootId] : [siteFilter];
    if (q) {
      const keep = new Set<string>();
      for (const id of startIds)
        walk(plan, id, (n) => {
          if (n.name.toLowerCase().includes(q) || (n.group || "").toLowerCase().includes(q)) {
            let p: PlanNode | undefined = n;
            while (p) {
              keep.add(p.id);
              p = p.parentId ? plan.nodes[p.parentId] : undefined;
            }
          }
        });
      for (const id of startIds) walk(plan, id, (n, d) => keep.has(n.id) && out.push({ node: n, depth: d }));
      return out;
    }
    const visit = (id: string, depth: number) => {
      const n = plan.nodes[id];
      out.push({ node: n, depth });
      if (expanded.has(id)) for (const c of n.children) visit(c, depth + 1);
    };
    for (const id of startIds) visit(id, 0);
    return out;
  }, [plan, expanded, siteFilter, query]);

  function toggle(id: string) {
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function expandTo(level: PlanNode["level"]) {
    const s = new Set<string>();
    walk(plan, plan.rootId, (n) => DEPTH[n.level] < DEPTH[level] && s.add(n.id));
    setExpanded(s);
  }

  const selected = monthScope(plan, siteFilter, selectedId);

  // ---- render --------------------------------------------------------------------
  return (
    <UnitContext.Provider value={unit}>
    <div className="flex h-full flex-col gap-3 overflow-y-auto lg:overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 shadow-[0_1px_2px_rgb(16_24_40/0.04)] md:px-4">
        <div className="relative">
          <button
            type="button"
            onClick={() => setScenarioMenu((v) => !v)}
            className="flex h-10 max-w-[340px] items-center gap-2 rounded-lg px-2.5 text-left transition hover:bg-slate-100"
            aria-haspopup="menu"
            aria-expanded={scenarioMenu}
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-blue-50 text-blue-600">
              <FolderOpen className="h-4 w-4" />
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block text-[11px] text-slate-400">
                {Y} {t("target plan")}
                {dirty && <span className="ml-1.5 text-amber-600">· unsaved</span>}
              </span>
              <span className="block truncate text-[13.5px] font-semibold text-slate-900">{current.name}</span>
            </span>
            <ChevronDown className={clsx("h-4 w-4 shrink-0 text-slate-400 transition-transform", scenarioMenu && "rotate-180")} />
          </button>
          {scenarioMenu && (
            <div role="menu" className="pop-in absolute left-0 top-12 z-30 w-[min(92vw,380px)] rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_12px_32px_-8px_rgb(16_24_40/0.2)]">
              <button type="button" onClick={() => void switchTo(null)} className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-slate-50">
                <Sparkles className="mt-0.5 h-4 w-4 text-blue-600" />
                <span>
                  <span className="block text-[13px] font-medium text-slate-900">{t("Start from the agreed plan")}</span>
                  <span className="block text-[12px] text-slate-500">Revise 2027 (V2): 7,550 MB · BPK 5,140 · BSI 2,035 · DBK 375</span>
                </span>
              </button>
              {canEdit && (
                <button type="button" onClick={() => setNewPlanOpen(true)} className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-slate-50">
                  <Plus className="mt-0.5 h-4 w-4 text-blue-600" />
                  <span>
                    <span className="block text-[13px] font-medium text-slate-900">{t("New plan for another year…")}</span>
                    <span className="block text-[12px] text-slate-500">{t("Roll this plan forward, or start again from the agreed data")}</span>
                  </span>
                </button>
              )}
              <p className="px-2.5 pb-1 pt-2 text-[11px] font-medium uppercase tracking-[0.06em] text-slate-400">{t("Saved by the team")}</p>
              <div className="max-h-72 overflow-y-auto">
                {scenarios.length === 0 && <p className="px-2.5 py-3 text-[12.5px] text-slate-400">{t("Nothing saved yet.")}</p>}
                {scenarios.map((s) => (
                  <div key={s.id} className={clsx("group flex items-center gap-1 rounded-lg", current.id === s.id ? "bg-blue-50" : "hover:bg-slate-50")}>
                    <button type="button" onClick={() => void switchTo(s)} className="min-w-0 flex-1 px-2.5 py-2 text-left">
                      <span className="flex items-center gap-1.5">
                        <span className="shrink-0 rounded bg-blue-50 px-1.5 text-[10.5px] font-semibold tabular-nums text-blue-700">{s.snapshot?.plan?.targetYear ?? TARGET_META.target_year}</span>
                        <span className="truncate text-[13px] font-medium text-slate-900">{s.name}</span>
                      </span>
                      <span className="block truncate text-[11.5px] text-slate-500">
                        {s.snapshot?.revTgt ? `${fmtU(s.snapshot.revTgt, 0.1 * MB, unit)} ${unitLabel(unit)} · ` : ""}
                        {s.created_by ? `${s.created_by} · ` : ""}
                        {new Date(s.updated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </button>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => void removeScenario(s)}
                        className="mr-1 grid h-7 w-7 place-items-center rounded-md text-slate-400 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
                        aria-label={`Delete ${s.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <span
          className={clsx(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium",
            issues.length ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700"
          )}
          title={issues.length ? "Some levels don't add up" : "Every level adds up to the one above"}
        >
          {issues.length ? <AlertTriangle className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
          {issues.length ? `${issues.length} levels don't add up` : t("Every level adds up")}
        </span>
        {current.savedBy && current.updatedAt && (
          <span className="hidden text-[12px] text-slate-400 2xl:inline">
            Saved by {current.savedBy} · {new Date(current.updatedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
          </span>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <div className="flex rounded-lg border border-slate-200 p-0.5">
            <button type="button" onClick={undo} disabled={!past.length} className="grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30" title="Undo (Ctrl Z)" aria-label="Undo">
              <Undo2 className="h-4 w-4" />
            </button>
            <button type="button" onClick={redo} disabled={!future.length} className="grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30" title="Redo (Ctrl Y)" aria-label="Redo">
              <Redo2 className="h-4 w-4" />
            </button>
          </div>
          <div className="flex h-9 items-center rounded-lg border border-slate-200 p-0.5 text-[12.5px]" role="radiogroup" aria-label="Unit">
            {(["MB", "THB"] as const).map((u) => (
              <button
                key={u}
                type="button"
                role="radio"
                aria-checked={unit === u}
                onClick={() => saveUnit(u)}
                className={clsx("h-full rounded-md px-2.5 font-medium transition", unit === u ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:text-slate-800")}
              >
                {u === "MB" ? t("Million ฿") : t("Baht")}
              </button>
            ))}
          </div>
          <label className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[12.5px] text-slate-600" title="How many months of the base year are actual. The rest of the year is estimated from each unit's usual monthly pattern.">
            {t("{y} actual", { y: B })}
            <select
              value={plan.actualMonths}
              disabled={!canEdit}
              onChange={(e) => commit(setActualMonths(plan, Number(e.target.value)), undefined)}
              className="bg-transparent font-medium text-slate-900 outline-none"
            >
              {Array.from({ length: 13 }, (_, i) => (
                <option key={i} value={i}>
                  {i === 0 ? t("none (estimate)") : `${i} ${t("months")} (${MONTHS[0]}–${MONTHS[i - 1]})`}
                </option>
              ))}
            </select>
          </label>
          <label className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[12.5px] text-slate-600" title="Every target is rounded to this, and the levels still add up">
            {t("Round to")}
            <select
              value={plan.step}
              disabled={!canEdit}
              onChange={(e) => commit(changeStep(plan, Number(e.target.value)), undefined)}
              className="bg-transparent font-medium text-slate-900 outline-none"
            >
              {STEPS.map((s) => (
                <option key={s.v} value={s.v}>
                  {unit === "MB" ? s.label : `${s.v.toLocaleString("en-US")} ฿`}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => void exportExcel()} disabled={exporting} className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-[13px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <Download className={clsx("h-4 w-4", exporting && "animate-bounce")} /> Excel
          </button>
          {canEdit && (
            <>
              {current.id && (
                <button type="button" onClick={() => void save(true)} className="h-9 rounded-lg border border-slate-200 px-3 text-[13px] font-medium text-slate-700 hover:bg-slate-50">
                  {t("Save as new")}
                </button>
              )}
              <button
                type="button"
                onClick={() => void save(false)}
                disabled={saving || (!dirty && !!current.id)}
                className="flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-[13px] font-medium text-white transition hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50"
              >
                <Save className="h-4 w-4" /> {current.id ? t("Save") : t("Save scenario")}
              </button>
            </>
          )}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid shrink-0 grid-cols-2 gap-2 lg:grid-cols-4">
        <KpiCard
          title={t("Phuket network")}
          node={root}
          step={plan.step}
          active={siteFilter === "ALL"}
          onClick={() => setSiteFilter("ALL")}
          editable={canEdit}
          onCommit={(v) => applyTarget(root.id, v, `Network target set to ${fmtU(v, plan.step, unit)} ${unitLabel(unit)}`)}
          color="#2563eb"
          baseYear={B}
          icon={<Network className="h-4 w-4" />}
        />
        {root.children.map((sid) => (
          <KpiCard
            key={sid}
            title={plan.nodes[sid].name}
            node={plan.nodes[sid]}
            step={plan.step}
            share={root.target > 0 ? plan.nodes[sid].target / root.target : 0}
            active={siteFilter === sid}
            onClick={() => setSiteFilter(siteFilter === sid ? "ALL" : sid)}
            editable={canEdit}
            max={maxFor(plan, sid)}
            onCommit={(v) => applyTarget(sid, v)}
            color={siteColor(sid)}
            baseYear={B}
          />
        ))}
      </div>

      {/* Body */}
      <div className="flex min-h-[560px] flex-1 flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(16_24_40/0.04)] lg:min-h-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/80 px-3 py-2 md:px-4">
          <div className="flex rounded-lg bg-slate-100 p-0.5" role="tablist">
            {(
              [
                ["plan", t("Plan"), Network],
                ["coe", t("By CoE / SBU"), Layers],
                ["segments", t("By segment"), Users],
                ["months", t("By month"), CalendarRange],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={clsx(
                  "flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-[12.5px] font-medium transition",
                  tab === id ? "bg-white text-slate-900 shadow-[0_1px_2px_rgb(16_24_40/0.1)]" : "text-slate-500 hover:text-slate-900"
                )}
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>
          {tab === "plan" && (
            <>
              <label className="relative flex min-w-[180px] flex-1 items-center md:max-w-xs">
                <Search className="pointer-events-none absolute left-2.5 h-4 w-4 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("Find a unit…")}
                  className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-2 text-[13px] outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </label>
              <div className="hidden items-center gap-1 whitespace-nowrap text-[12.5px] text-slate-500 md:flex">
                {t("Show down to")}
                {(["site", "coe", "setting", "market"] as const).map((l) => (
                  <button key={l} type="button" onClick={() => expandTo(l)} className="rounded-md px-2 py-1 font-medium text-slate-600 hover:bg-slate-100">
                    {t(LEVEL_LABEL[l])}
                  </button>
                ))}
                <button type="button" onClick={() => setExpanded(new Set(["PKT"]))} className="grid h-7 w-7 place-items-center rounded-md hover:bg-slate-100" title="Collapse all" aria-label="Collapse all">
                  <ChevronsDownUp className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => expandTo("market")} className="grid h-7 w-7 place-items-center rounded-md hover:bg-slate-100" title="Expand all" aria-label="Expand all">
                  <ChevronsUpDown className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
          {tab === "months" && (
            <span className="text-[12.5px] text-slate-500">
              {t("Showing")} <span className="font-medium text-slate-800">{pathOf(plan, selected.id) || selected.name}</span> — {t("follows the hospital filter; click a row below to go deeper")}
            </span>
          )}
        </div>

        {/* What just moved */}
        {report && tab === "plan" && (
          <div className="fade-enter border-b border-blue-100 bg-blue-50/70 px-3 py-2 text-[12.5px] text-blue-950 md:px-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Sparkles className="h-4 w-4 shrink-0 text-blue-600" />
              <span className="font-medium">{report.label}.</span>
              {report.siblings.length > 0 && plan.nodes[report.nodeId]?.parentId && (
                <span>
                  To keep {plan.nodes[plan.nodes[report.nodeId].parentId!].name} at {fmtU(plan.nodes[plan.nodes[report.nodeId].parentId!].target, plan.step, unit)} {unitLabel(unit)},{" "}
                  {report.siblings.length} other {report.siblings.length === 1 ? "unit" : "units"} moved by{" "}
                  <span className="font-medium tabular-nums">{fmtU(report.siblings.reduce((a, s) => a + s.to - s.from, 0), plan.step, unit)} {unitLabel(unit)}</span>.
                </span>
              )}
              {report.autoUnlocked && <span>{plan.nodes[report.autoUnlocked]?.name} switched to automatic to take the rest.</span>}
              {report.scaledLocked.length > 0 && <span className="text-amber-800">{report.scaledLocked.length} pinned values were scaled down to fit.</span>}
              <span className="ml-auto flex items-center gap-1">
                {report.siblings.length > 0 && (
                  <button type="button" onClick={() => setShowMoved((v) => !v)} className="rounded-md px-2 py-0.5 font-medium text-blue-700 hover:bg-blue-100">
                    {showMoved ? t("Hide") : t("What moved")}
                  </button>
                )}
                <button type="button" onClick={undo} className="flex items-center gap-1 rounded-md px-2 py-0.5 font-medium text-blue-700 hover:bg-blue-100">
                  <Undo2 className="h-3.5 w-3.5" /> {t("Undo")}
                </button>
                <button type="button" onClick={() => setReport(null)} className="grid h-6 w-6 place-items-center rounded-md hover:bg-blue-100" aria-label="Dismiss">
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            </div>
            {showMoved && (
              <div className="pop-in mt-2 grid gap-x-6 gap-y-0.5 pl-7 sm:grid-cols-2 xl:grid-cols-3">
                {report.siblings.map((s) => (
                  <div key={s.id} className="flex justify-between gap-2 tabular-nums">
                    <span className="truncate text-blue-900/80">{plan.nodes[s.id]?.name}</span>
                    <span>
                      {fmtU(s.from, plan.step, unit)} → <span className="font-medium">{fmtU(s.to, plan.step, unit)}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-auto">
          {tab === "plan" && (
            <table className="w-full min-w-[1180px] border-separate border-spacing-0 text-[13px]">
              <thead className="sticky top-0 z-10 bg-white/95 backdrop-blur">
                <tr className="text-left text-[11.5px] font-medium text-slate-500">
                  <th className="border-b border-slate-200 py-2 pl-4 pr-2 font-medium">{t("Unit")}</th>
                  <th className="border-b border-slate-200 px-2 py-2 text-right font-medium" title="Typed values on a CoE / sub-unit replace the data">{t("{y} actual", { y: P })}</th>
                  {plan.actualMonths > 0 && (
                    <th className="border-b border-slate-200 px-2 py-2 text-right font-medium" title={`Typed actuals for a CoE / sub-unit set its ${B} full year`}>
                      {t("{y} actual", { y: B })} <span className="font-normal text-slate-400">{MONTHS[0]}–{MONTHS[plan.actualMonths - 1]}</span>
                    </th>
                  )}
                  <th className="border-b border-slate-200 px-2 py-2 text-right font-medium" title={plan.actualMonths > 0 ? `${plan.actualMonths} months actual + ${12 - plan.actualMonths} estimated` : "Estimate"}>
                    {t("{y} full year", { y: B })}
                  </th>
                  <th className="w-[170px] border-b border-slate-200 px-2 py-2 text-right font-medium text-slate-800">{t("{y} target", { y: Y })} ({unitLabel(unit)})</th>
                  <th className="w-[100px] border-b border-slate-200 px-2 py-2 text-right font-medium">{t("Growth")} %</th>
                  <th className="w-[140px] border-b border-slate-200 px-2 py-2 text-right font-medium">{t("+ vs {y}", { y: B })}</th>
                  <th className="w-[150px] border-b border-slate-200 px-2 py-2 font-medium">{t("Share of parent")}</th>
                  <th className="border-b border-slate-200 px-2 py-2 text-right font-medium">{t("Visits {y}", { y: Y })}</th>
                  <th className="w-[76px] border-b border-slate-200 py-2 pl-2 pr-4" />
                </tr>
              </thead>
              <tbody>
                {rows.map(({ node: n, depth }) => {
                  const parent = n.parentId ? plan.nodes[n.parentId] : null;
                  const share = parent && parent.target > 0 ? n.target / parent.target : 1;
                  const g = growthPct(n);
                  const isOpen = expanded.has(n.id) || !!query.trim();
                  return (
                    <tr
                      key={n.id}
                      onClick={() => setSelectedId(n.id)}
                      className={clsx("group", selectedId === n.id ? "bg-blue-50/60" : "hover:bg-slate-50", DEPTH[n.level] <= 1 && "font-medium")}
                    >
                      <td className="border-b border-slate-100 py-1.5 pl-4 pr-2">
                        <div className="flex items-center gap-1.5" style={{ paddingLeft: depth * 18 }}>
                          {n.children.length ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggle(n.id);
                              }}
                              className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-slate-200/60 hover:text-slate-700"
                              aria-label={isOpen ? "Collapse" : "Expand"}
                            >
                              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                          ) : (
                            <span className="w-6 shrink-0" />
                          )}
                          {n.level === "site" && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: siteColor(n.site) }} />}
                          <span className={clsx("truncate", n.level === "market" || n.level === "setting" ? "text-slate-600" : "text-slate-900")}>{n.name}</span>
                          {n.level === "coe" && n.group && <span className="shrink-0 rounded bg-slate-100 px-1.5 py-px text-[10.5px] font-medium text-slate-500">{n.group}</span>}
                          {n.custom && <span className="shrink-0 rounded bg-violet-50 px-1.5 py-px text-[10.5px] font-medium text-violet-700">added</span>}
                        </div>
                      </td>
                      <td className="border-b border-slate-100 px-2 py-1" onClick={(e) => e.stopPropagation()}>
                        {n.level === "coe" || n.level === "sub" ? (
                          <NumberCell
                            value={n.prior25 / div}
                            decimals={dec}
                            disabled={!canEdit}
                            pinned={n.priorTyped !== undefined}
                            muted={n.priorTyped === undefined}
                            title={n.priorTyped === undefined ? `${P} actual from the data — click to type your own` : "Typed — clear it to go back to the data"}
                            onCommit={(v) => commit(setPrior(plan, n.id, v * div), { ...emptyReport(n), label: `${n.name}: ${P} actual set to ${fmtU(v * div, plan.step, unit)} ${unitLabel(unit)}` })}
                            onClear={n.priorTyped !== undefined ? () => commit(setPrior(plan, n.id, null)) : undefined}
                          />
                        ) : (
                          <span className="block px-2 text-right tabular-nums text-slate-400">{n.prior25 ? fmtU(n.prior25, plan.step, unit) : "—"}</span>
                        )}
                      </td>
                      {plan.actualMonths > 0 && (
                        <td className="border-b border-slate-100 px-2 py-1" onClick={(e) => e.stopPropagation()}>
                          {n.level === "coe" || n.level === "sub" ? (
                            <NumberCell
                              value={actualOf(plan, n.id) / div}
                              decimals={dec}
                              disabled={!canEdit}
                              pinned={n.actual !== undefined}
                              muted={n.actual === undefined}
                              title={n.actual === undefined ? `Estimated from the ${B} full year — click to type the real actual` : "Typed actual — clear it to go back to the data"}
                              onCommit={(v) => commit(setActual(plan, n.id, v * div), { ...emptyReport(n), label: `${n.name}: ${B} actual set to ${fmtU(v * div, plan.step, unit)} ${unitLabel(unit)}` })}
                              onClear={n.actual !== undefined ? () => commit(setActual(plan, n.id, null)) : undefined}
                            />
                          ) : (
                            <span className="block px-2 text-right tabular-nums text-slate-400">{fmtU(actualOf(plan, n.id), plan.step, unit)}</span>
                          )}
                        </td>
                      )}
                      <td className="border-b border-slate-100 px-2 py-1.5 text-right tabular-nums text-slate-500">{n.base26 ? fmtU(n.base26, plan.step, unit) : "—"}</td>
                      <td className="border-b border-slate-100 px-2 py-1" onClick={(e) => e.stopPropagation()}>
                        <NumberCell
                          value={n.target / div}
                          decimals={dec}
                          disabled={!canEdit}
                          pinned={n.locked}
                          hint={
                            parent
                              ? {
                                  max: maxFor(plan, n.id) / div,
                                  fair: fairShare(plan, n.id) / div,
                                  parentName: parent.name,
                                }
                              : undefined
                          }
                          onCommit={(v) => applyTarget(n.id, v * div)}
                        />
                      </td>
                      <td className="border-b border-slate-100 px-2 py-1" onClick={(e) => e.stopPropagation()}>
                        <NumberCell
                          value={g}
                          decimals={1}
                          suffix="%"
                          tone={g >= 0 ? "pos" : "neg"}
                          disabled={!canEdit || n.base26 <= 0}
                          onCommit={(pct) => applyTarget(n.id, n.base26 * (1 + pct / 100), `${n.name} set to ${fmtPct(pct)} growth`)}
                        />
                      </td>
                      <td className="border-b border-slate-100 px-2 py-1" onClick={(e) => e.stopPropagation()}>
                        <NumberCell
                          value={(n.target - n.base26) / div}
                          decimals={dec}
                          signed
                          tone={n.target >= n.base26 ? "pos" : "neg"}
                          disabled={!canEdit}
                          title={`Add this much on top of the ${B} full year`}
                          onCommit={(v) => applyTarget(n.id, n.base26 + v * div, `${n.name} set to ${B} ${v >= 0 ? "+" : "−"}${fmtU(Math.abs(v * div), plan.step, unit)} ${unitLabel(unit)}`)}
                        />
                      </td>
                      <td className="border-b border-slate-100 px-2 py-1.5">
                        {parent ? (
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                              <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${Math.min(100, share * 100)}%`, background: siteColor(n.site) }} />
                            </div>
                            <span className="w-11 text-right text-[12px] tabular-nums text-slate-500">{(share * 100).toFixed(1)}%</span>
                          </div>
                        ) : (
                          <span className="text-[12px] text-slate-400">—</span>
                        )}
                      </td>
                      <td className="border-b border-slate-100 px-2 py-1.5 text-right text-[12px] tabular-nums text-slate-500">
                        {n.baseVisits26 ? Math.round(targetVisits(n)).toLocaleString("en-US") : "—"}
                      </td>
                      <td className="border-b border-slate-100 py-1 pl-2 pr-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-0.5">
                          {parent && (
                            <button
                              type="button"
                              disabled={!canEdit}
                              onClick={() => toggleLock(n.id)}
                              className={clsx(
                                "grid h-7 w-7 place-items-center rounded-md transition",
                                n.locked ? "text-blue-600 hover:bg-blue-50" : "text-slate-300 opacity-0 hover:bg-slate-100 hover:text-slate-600 group-hover:opacity-100"
                              )}
                              title={n.locked ? "Pinned — click to make it automatic again" : "Automatic — click to pin this value"}
                              aria-label={n.locked ? "Unpin" : "Pin"}
                            >
                              {n.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                            </button>
                          )}
                          {canEdit && (
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setMenuFor(menuFor === n.id ? null : n.id)}
                                className="grid h-7 w-7 place-items-center rounded-md text-slate-400 opacity-60 hover:bg-slate-100 hover:text-slate-800 group-hover:opacity-100"
                                aria-label="More"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                              {menuFor === n.id && (
                                <RowMenu
                                  node={n}
                                  onClose={() => setMenuFor(null)}
                                  onFair={parent ? () => applyTarget(n.id, fairShare(plan, n.id), `${n.name} set to its fair share`) : undefined}
                                  onEven={
                                    n.children.length
                                      ? () =>
                                          commit(spreadEvenGrowth(plan, n.id), {
                                            nodeId: n.id,
                                            from: n.target,
                                            to: n.target,
                                            requested: n.target,
                                            clamped: false,
                                            siblings: [],
                                            scaledLocked: [],
                                            autoUnlocked: null,
                                            label: `Everything under ${n.name} now grows ${fmtPct(g)} like the total`,
                                          })
                                      : undefined
                                  }
                                  onAddSub={n.level === "coe" ? () => void addSubUnit(n.id) : undefined}
                                  onRename={n.custom ? () => void renameSubUnit(n.id) : undefined}
                                  onRemove={n.custom ? () => void removeSubUnit(n.id) : undefined}
                                />
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-400">
                      Nothing matches “{query}”.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {tab === "segments" && <SegmentsView plan={plan} siteFilter={siteFilter} />}
          {tab === "months" && <MonthsView plan={plan} node={selected} onPick={setSelectedId} />}
          {tab === "coe" && <CoeView plan={plan} siteFilter={siteFilter} />}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 bg-slate-50/60 px-4 py-2 text-[11.5px] text-slate-500">
          <span className="flex items-center gap-1">
            <Lock className="h-3 w-3 text-blue-600" /> {t("Pinned: kept when other units are rebalanced")}
          </span>
          <span>Set a target three ways — an amount, a growth %, or + on top of {B} — in Baht or million Baht. The level above never changes; the rest of its units share what&rsquo;s left.</span>
          {!canEdit && <span className="ml-auto font-medium text-slate-600">View only — ask an admin for “Save scenarios” to edit.</span>}
        </div>
      </div>
      {newPlanOpen && <NewPlanDialog fromYear={plan.targetYear} currentName={current.name} onCreate={(y, f, g) => void createPlan(y, f, g)} onClose={() => setNewPlanOpen(false)} />}
    </div>
    </UnitContext.Provider>
  );
}

// ---------------------------------------------------------------------------

function KpiCard({
  title,
  node,
  step,
  share,
  active,
  onClick,
  editable,
  max,
  onCommit,
  color,
  icon,
  baseYear,
}: {
  baseYear: number;
  title: string;
  node: PlanNode;
  step: number;
  share?: number;
  active: boolean;
  onClick: () => void;
  editable: boolean;
  max?: number;
  onCommit: (thb: number) => void;
  color: string;
  icon?: ReactNode;
}) {
  const g = growthPct(node);
  const unit = useContext(UnitContext);
  const div = unitDiv(unit);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && e.target === e.currentTarget && onClick()}
      className={clsx(
        "lift cursor-pointer rounded-xl border bg-white px-3.5 py-3 text-left transition",
        active ? "border-blue-300 ring-4 ring-blue-50" : "border-slate-200/80 hover:border-slate-300"
      )}
    >
      <div className="flex items-center gap-2 text-[12.5px] text-slate-500">
        {icon || <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />}
        <span className="truncate font-medium text-slate-700">{title}</span>
        {node.locked && <Lock className="h-3 w-3 text-blue-600" />}
        <span className={clsx("ml-auto text-[12px] font-medium tabular-nums", g >= 0 ? "text-emerald-600" : "text-rose-600")}>{fmtPct(g)}</span>
      </div>
      <div className="mt-1 flex items-baseline gap-1" onClick={(e) => e.stopPropagation()}>
        <NumberCell
          value={node.target / div}
          decimals={unitDecimals(unit, step)}
          disabled={!editable}
          big
          hint={max !== undefined && Number.isFinite(max) ? { max: max / div, parentName: "the network" } : undefined}
          onCommit={(v) => onCommit(v * div)}
        />
        <span className="text-[12px] text-slate-400">{unitLabel(unit)}</span>
      </div>
      <div className="mt-1.5 flex items-center gap-2 text-[11.5px] text-slate-400">
        <span className="tabular-nums">
          {baseYear} {fmtU(node.base26, step, unit)}
        </span>
        {share !== undefined && (
          <>
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${share * 100}%`, background: color }} />
            </div>
            <span className="tabular-nums">{(share * 100).toFixed(1)}%</span>
          </>
        )}
      </div>
    </div>
  );
}

/** A number that turns into an input on click. Enter or leaving the field commits; Esc cancels. */
function NumberCell({
  value,
  decimals,
  onCommit,
  disabled,
  suffix,
  tone,
  pinned,
  big,
  hint,
  muted,
  signed,
  title,
  onClear,
}: {
  value: number;
  decimals: number;
  onCommit: (v: number) => void;
  disabled?: boolean;
  suffix?: string;
  tone?: "pos" | "neg";
  pinned?: boolean;
  big?: boolean;
  muted?: boolean;
  signed?: boolean;
  title?: string;
  onClear?: () => void;
  hint?: { max?: number; fair?: number; parentName: string };
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const text = suffix === "%" || signed ? `${value > 0 ? "+" : ""}${shown}${suffix || ""}` : shown;

  function finish(v: string | null) {
    setDraft(null);
    if (v === null) return;
    const num = parseFloat(v.replace(/[,%\s+]/g, "").replace(/^−/, "-"));
    if (!Number.isFinite(num)) return;
    if (Math.abs(num - value) < Math.pow(10, -decimals) / 2) return;
    onCommit(num);
  }

  if (draft === null) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setDraft(value.toFixed(decimals))}
        className={clsx(
          "w-full rounded-md text-right tabular-nums transition",
          big ? "px-0 text-left text-[22px] font-semibold tracking-tight text-slate-900" : "px-2 py-1",
          !big && (disabled ? "" : "hover:bg-white hover:ring-1 hover:ring-slate-300"),
          !big && pinned && "bg-blue-50 font-semibold text-blue-800",
          !big && !pinned && (muted ? "text-slate-400" : tone === "pos" ? "text-emerald-700" : tone === "neg" ? "text-rose-600" : "text-slate-900"),
          disabled ? "cursor-default" : "cursor-text"
        )}
        title={disabled ? undefined : title || "Click to change"}
      >
        {text}
      </button>
    );
  }
  const over = hint?.max !== undefined && parseFloat(draft.replace(/,/g, "")) > hint.max + 1e-9;
  return (
    <div className="relative">
      <input
        autoFocus
        value={draft}
        inputMode="decimal"
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => finish(draft)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setDraft(null);
        }}
        className={clsx(
          "no-focus-outline w-full rounded-md border bg-white text-right tabular-nums outline-none ring-4",
          big ? "px-2 py-0.5 text-left text-[20px] font-semibold" : "px-2 py-1 text-[13px]",
          over ? "border-amber-400 ring-amber-100" : "border-blue-400 ring-blue-100"
        )}
      />
      {(hint || onClear) && (
        <div className="pop-in absolute right-0 top-full z-20 mt-1 w-60 rounded-lg border border-slate-200 bg-white p-2 text-left text-[12px] font-normal text-slate-600 shadow-[0_12px_32px_-8px_rgb(16_24_40/0.2)]">
          {hint?.max !== undefined && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                finish(String(hint.max!));
              }}
              className={clsx("flex w-full justify-between rounded px-1.5 py-1 hover:bg-slate-50", over && "text-amber-700")}
            >
              <span>Most it can take</span>
              <span className="font-medium tabular-nums">{hint.max!.toLocaleString("en-US", { maximumFractionDigits: decimals })}</span>
            </button>
          )}
          {hint?.fair !== undefined && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                finish(String(hint.fair!));
              }}
              className="flex w-full justify-between rounded px-1.5 py-1 text-blue-700 hover:bg-blue-50"
            >
              <span className="flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Suggested (same growth as {hint.parentName})
              </span>
              <span className="font-medium tabular-nums">{hint.fair!.toLocaleString("en-US", { maximumFractionDigits: decimals })}</span>
            </button>
          )}
          {onClear && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                setDraft(null);
                onClear();
              }}
              className="flex w-full rounded px-1.5 py-1 text-slate-600 hover:bg-slate-50"
            >
              Use the data again
            </button>
          )}
          {hint && <p className="mt-1 border-t border-slate-100 px-1.5 pt-1 text-[11px] text-slate-400">
            {over ? `Above that, it's capped so ${hint.parentName} doesn't go over.` : `The rest of ${hint.parentName} rebalances automatically.`}
          </p>}
        </div>
      )}
    </div>
  );
}

function RowMenu({
  node,
  onClose,
  onFair,
  onEven,
  onAddSub,
  onRename,
  onRemove,
}: {
  node: PlanNode;
  onClose: () => void;
  onFair?: () => void;
  onEven?: () => void;
  onAddSub?: () => void;
  onRename?: () => void;
  onRemove?: () => void;
}) {
  const item = "flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left hover:bg-slate-50";
  const run = (f?: () => void) => () => {
    onClose();
    f?.();
  };
  return (
    <div role="menu" className="pop-in absolute right-0 top-8 z-30 w-64 rounded-xl border border-slate-200 bg-white p-1.5 text-[13px] font-normal text-slate-800 shadow-[0_12px_32px_-8px_rgb(16_24_40/0.2)]">
      {onFair && (
        <button type="button" className={item} onClick={run(onFair)}>
          <Sparkles className="mt-0.5 h-4 w-4 text-blue-600" />
          <span>
            Use suggested target
            <span className="block text-[11.5px] text-slate-500">Same growth as the level above</span>
          </span>
        </button>
      )}
      {onEven && (
        <button type="button" className={item} onClick={run(onEven)}>
          <RotateCcw className="mt-0.5 h-4 w-4 text-slate-400" />
          <span>
            Even growth below
            <span className="block text-[11.5px] text-slate-500">Re-split everything under {node.name} by base, clear pins</span>
          </span>
        </button>
      )}
      {onAddSub && (
        <button type="button" className={item} onClick={run(onAddSub)}>
          <Plus className="mt-0.5 h-4 w-4 text-slate-400" />
          <span>
            Add a sub-unit
            <span className="block text-[11.5px] text-slate-500">Split this CoE further (e.g. a new clinic line)</span>
          </span>
        </button>
      )}
      {onRename && (
        <button type="button" className={item} onClick={run(onRename)}>
          <span className="mt-0.5 h-4 w-4" /> Rename sub-unit
        </button>
      )}
      {onRemove && (
        <button type="button" className={clsx(item, "text-rose-600 hover:bg-rose-50")} onClick={run(onRemove)}>
          <Trash2 className="mt-0.5 h-4 w-4" /> Remove sub-unit
        </button>
      )}
    </div>
  );
}

function SegmentsView({ plan, siteFilter }: { plan: Plan; siteFilter: string }) {
  const unit = useContext(UnitContext);
  const sites = siteFilter === "ALL" ? plan.nodes[plan.rootId].children : [siteFilter];
  type Cell = { t: number; b: number };
  const empty = (): Record<string, Cell> => Object.fromEntries(SEGMENTS.map((s) => [s, { t: 0, b: 0 }]));
  const bySite: Record<string, { seg: Record<string, Cell>; opd: Cell; ipd: Cell }> = {};
  const total = { seg: empty(), opd: { t: 0, b: 0 }, ipd: { t: 0, b: 0 } };
  for (const s of sites) {
    bySite[s] = { seg: empty(), opd: { t: 0, b: 0 }, ipd: { t: 0, b: 0 } };
    walk(plan, s, (n) => {
      if (n.level === "market") {
        bySite[s].seg[n.name].t += n.target;
        bySite[s].seg[n.name].b += n.base26;
        total.seg[n.name].t += n.target;
        total.seg[n.name].b += n.base26;
      }
      if (n.level === "setting") {
        const k = n.name === "OPD" ? "opd" : "ipd";
        bySite[s][k].t += n.target;
        bySite[s][k].b += n.base26;
        total[k].t += n.target;
        total[k].b += n.base26;
      }
    });
  }
  const cell = (c: Cell) => (
    <td className="border-b border-slate-100 px-3 py-2.5 text-right">
      <div className="tabular-nums text-slate-900">{fmtU(c.t, plan.step, unit)}</div>
      <div className={clsx("text-[11.5px] tabular-nums", c.t >= c.b ? "text-emerald-600" : "text-rose-600")}>{fmtPct(c.b > 0 ? ((c.t - c.b) / c.b) * 100 : 0)}</div>
    </td>
  );
  const rowsData = [...sites.map((s) => ({ id: s, label: plan.nodes[s].name, d: bySite[s] })), ...(sites.length > 1 ? [{ id: "total", label: "Network", d: total }] : [])];
  return (
    <div className="p-4">
      <p className="mb-3 text-[12.5px] text-slate-500">
        {plan.targetYear} target ({unitLabel(unit)}) and growth vs {plan.targetYear - 1}, added up from every unit&rsquo;s segments. Change them in the Plan tab.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr className="text-[11.5px] text-slate-500">
              <th className="border-b border-slate-200 px-3 py-2 text-left font-medium">Hospital</th>
              {SEGMENTS.map((s) => (
                <th key={s} className="border-b border-slate-200 px-3 py-2 text-right font-medium">
                  {s}
                </th>
              ))}
              <th className="border-b border-slate-200 px-3 py-2 text-right font-medium">OPD</th>
              <th className="border-b border-slate-200 px-3 py-2 text-right font-medium">IPD</th>
            </tr>
          </thead>
          <tbody>
            {rowsData.map((r) => (
              <tr key={r.id} className={r.id === "total" ? "bg-slate-50 font-semibold" : ""}>
                <td className="border-b border-slate-100 px-3 py-2.5">
                  <span className="flex items-center gap-2">
                    {r.id !== "total" && <span className="h-2.5 w-2.5 rounded-full" style={{ background: siteColor(r.id) }} />}
                    {r.label}
                  </span>
                </td>
                {SEGMENTS.map((s) => (
                  <Fragment key={s}>{cell(r.d.seg[s])}</Fragment>
                ))}
                {cell(r.d.opd)}
                {cell(r.d.ipd)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MonthsView({ plan, node, onPick }: { plan: Plan; node: PlanNode; onPick: (id: string) => void }) {
  const unit = useContext(UnitContext);
  const w = monthsOf(plan, node.id);
  const target = w.map((x) => x * node.target);
  const base = w.map((x) => x * node.base26);
  const max = Math.max(...target, ...base, 1);
  const kids = childrenOf(plan, node.id);
  return (
    <div className="p-4">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h3 className="text-[15px] font-semibold text-slate-900">{node.name}</h3>
        <span className="text-[12.5px] text-slate-500">
          {fmtU(node.target, plan.step, unit)} {unitLabel(unit)} for {plan.targetYear}, phased like {plan.targetYear - 1}&rsquo;s monthly revenue
        </span>
      </div>
      <div className="grid grid-cols-12 items-end gap-1.5 rounded-xl border border-slate-100 p-3" style={{ height: 180 }}>
        {target.map((t, i) => (
          <div key={i} className="flex h-full flex-col justify-end gap-1" title={`${MONTHS[i]}: ${fmtU(t, plan.step, unit)} ${unitLabel(unit)} (${plan.targetYear - 1} ${fmtU(base[i], plan.step, unit)})`}>
            <div className="flex flex-1 items-end gap-0.5">
              <div className="w-1/2 rounded-t bg-slate-200" style={{ height: `${(base[i] / max) * 100}%` }} />
              <div className="w-1/2 origin-bottom rounded-t bg-blue-600 [animation:grow-y_var(--dur-3)_var(--ease-out-soft)_backwards]" style={{ height: `${(t / max) * 100}%` }} />
            </div>
            <span className="text-center text-[10.5px] text-slate-400">{MONTHS[i]}</span>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-4 text-[11.5px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-slate-200" /> {plan.targetYear - 1}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-blue-600" /> {plan.targetYear} target
        </span>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[900px] border-separate border-spacing-0 text-[12.5px]">
          <thead>
            <tr className="text-[11.5px] text-slate-500">
              <th className="border-b border-slate-200 px-2 py-2 text-left font-medium">{unitLabel(unit)}</th>
              {MONTHS.map((m) => (
                <th key={m} className="border-b border-slate-200 px-2 py-2 text-right font-medium">
                  {m}
                </th>
              ))}
              <th className="border-b border-slate-200 px-2 py-2 text-right font-medium">Year</th>
            </tr>
          </thead>
          <tbody>
            {[node, ...kids].map((n, idx) => {
              const ww = monthsOf(plan, n.id);
              return (
                <tr
                  key={n.id}
                  onClick={idx > 0 && n.children.length ? () => onPick(n.id) : undefined}
                  className={clsx(idx === 0 ? "font-semibold" : n.children.length ? "cursor-pointer hover:bg-slate-50" : "")}
                >
                  <td className="border-b border-slate-100 px-2 py-1.5 text-slate-800">
                    {idx === 0 ? (
                      <span className="flex items-center gap-2">
                        Total
                        {node.parentId && (
                          <button type="button" onClick={() => onPick(node.parentId!)} className="rounded px-1.5 text-[11.5px] font-normal text-blue-600 hover:bg-blue-50">
                            ↑ {plan.nodes[node.parentId].name}
                          </button>
                        )}
                      </span>
                    ) : (
                      <span className={clsx(n.children.length && "text-blue-700 underline-offset-2 hover:underline")}>{n.name}</span>
                    )}
                  </td>
                  {ww.map((x, i) => (
                    <td key={i} className="border-b border-slate-100 px-2 py-1.5 text-right tabular-nums text-slate-700">
                      {fmtU(x * n.target, plan.step, unit)}
                    </td>
                  ))}
                  <td className="border-b border-slate-100 px-2 py-1.5 text-right tabular-nums text-slate-900">{fmtU(n.target, plan.step, unit)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CoeView({ plan, siteFilter }: { plan: Plan; siteFilter: string }) {
  const unit = useContext(UnitContext);
  const t = useT();
  const { sites, rows } = coeTotals(plan, siteFilter);
  const Y = plan.targetYear;
  const groups = Array.from(new Set(rows.map((r) => r.group)));
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const total = { prior: sum(rows.map((r) => r.prior)), base: sum(rows.map((r) => r.base)), target: sum(rows.map((r) => r.target)) };
  const g = (b: number, tg: number) => (b > 0 ? ((tg - b) / b) * 100 : 0);
  const max = Math.max(...rows.map((r) => r.target), 1);
  return (
    <div className="p-4">
      <p className="mb-3 text-[12.5px] text-slate-500">
        {t("Each CoE / SBU added up across hospitals")} ({sites.map((s) => plan.nodes[s].name).join(", ")}). {t("Change targets in the Plan tab.")}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr className="text-[11.5px] text-slate-500">
              <th className="border-b border-slate-200 px-3 py-2 text-left font-medium">CoE / SBU</th>
              <th className="border-b border-slate-200 px-3 py-2 text-right font-medium">{t("{y} actual", { y: Y - 2 })}</th>
              <th className="border-b border-slate-200 px-3 py-2 text-right font-medium">{t("{y} full year", { y: Y - 1 })}</th>
              <th className="border-b border-slate-200 px-3 py-2 text-right font-medium text-slate-800">
                {t("{y} target", { y: Y })} ({unitLabel(unit)})
              </th>
              <th className="border-b border-slate-200 px-3 py-2 text-right font-medium">{t("Growth")} %</th>
              {sites.length > 1 &&
                sites.map((sid) => (
                  <th key={sid} className="border-b border-slate-200 px-3 py-2 text-right font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: siteColor(sid) }} />
                      {sid.replace(" (Premium)", "")}
                    </span>
                  </th>
                ))}
              <th className="w-[160px] border-b border-slate-200 px-3 py-2 font-medium">{t("Share of total")}</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((grp) => {
              const list = rows.filter((r) => r.group === grp);
              const gt = { prior: sum(list.map((r) => r.prior)), base: sum(list.map((r) => r.base)), target: sum(list.map((r) => r.target)) };
              return (
                <Fragment key={grp}>
                  <tr className="bg-slate-50 font-semibold">
                    <td className="border-b border-slate-100 px-3 py-2 text-slate-900">{grp}</td>
                    <td className="border-b border-slate-100 px-3 py-2 text-right tabular-nums text-slate-500">{fmtU(gt.prior, plan.step, unit)}</td>
                    <td className="border-b border-slate-100 px-3 py-2 text-right tabular-nums text-slate-600">{fmtU(gt.base, plan.step, unit)}</td>
                    <td className="border-b border-slate-100 px-3 py-2 text-right tabular-nums text-slate-900">{fmtU(gt.target, plan.step, unit)}</td>
                    <td className={clsx("border-b border-slate-100 px-3 py-2 text-right tabular-nums", gt.target >= gt.base ? "text-emerald-700" : "text-rose-600")}>{fmtPct(g(gt.base, gt.target))}</td>
                    {sites.length > 1 &&
                      sites.map((sid) => (
                        <td key={sid} className="border-b border-slate-100 px-3 py-2 text-right tabular-nums text-slate-600">
                          {fmtU(sum(list.map((r) => r.bySite[sid] || 0)), plan.step, unit)}
                        </td>
                      ))}
                    <td className="border-b border-slate-100 px-3 py-2 text-[12px] tabular-nums text-slate-500">{total.target > 0 ? ((gt.target / total.target) * 100).toFixed(1) : "0"}%</td>
                  </tr>
                  {list.map((r) => (
                    <tr key={r.name} className="hover:bg-slate-50">
                      <td className="border-b border-slate-100 py-2 pl-7 pr-3 text-slate-800">{r.name}</td>
                      <td className="border-b border-slate-100 px-3 py-2 text-right tabular-nums text-slate-400">{fmtU(r.prior, plan.step, unit)}</td>
                      <td className="border-b border-slate-100 px-3 py-2 text-right tabular-nums text-slate-500">{fmtU(r.base, plan.step, unit)}</td>
                      <td className="border-b border-slate-100 px-3 py-2 text-right tabular-nums text-slate-900">{fmtU(r.target, plan.step, unit)}</td>
                      <td className={clsx("border-b border-slate-100 px-3 py-2 text-right tabular-nums", r.target >= r.base ? "text-emerald-700" : "text-rose-600")}>{fmtPct(g(r.base, r.target))}</td>
                      {sites.length > 1 &&
                        sites.map((sid) => (
                          <td key={sid} className="border-b border-slate-100 px-3 py-2 text-right tabular-nums text-slate-600">
                            {r.bySite[sid] ? fmtU(r.bySite[sid], plan.step, unit) : <span className="text-slate-300">—</span>}
                          </td>
                        ))}
                      <td className="border-b border-slate-100 px-3 py-2">
                        <div className="flex h-2 overflow-hidden rounded-full bg-slate-100" title={sites.map((sid) => `${sid}: ${fmtU(r.bySite[sid] || 0, plan.step, unit)}`).join(" · ")}>
                          {sites.map((sid) => (
                            <div key={sid} className="h-full transition-[width] duration-300" style={{ width: `${((r.bySite[sid] || 0) / max) * 100}%`, background: siteColor(sid) }} />
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </Fragment>
              );
            })}
            <tr className="font-semibold">
              <td className="px-3 py-2.5 text-slate-900">{t("Total")}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">{fmtU(total.prior, plan.step, unit)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{fmtU(total.base, plan.step, unit)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-slate-900">{fmtU(total.target, plan.step, unit)}</td>
              <td className={clsx("px-3 py-2.5 text-right tabular-nums", total.target >= total.base ? "text-emerald-700" : "text-rose-600")}>{fmtPct(g(total.base, total.target))}</td>
              {sites.length > 1 &&
                sites.map((sid) => (
                  <td key={sid} className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                    {fmtU(sum(rows.map((r) => r.bySite[sid] || 0)), plan.step, unit)}
                  </td>
                ))}
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NewPlanDialog({ fromYear, currentName, onCreate, onClose }: { fromYear: number; currentName: string; onCreate: (year: number, from: "current" | "agreed", growth: number) => void; onClose: () => void }) {
  const t = useT();
  const agreedYear = TARGET_META.target_year;
  const [year, setYear] = useState(String(fromYear + 1));
  const [from, setFrom] = useState<"current" | "agreed">("current");
  const [growth, setGrowth] = useState("0");
  const y = parseInt(year, 10);
  const minYear = from === "agreed" ? agreedYear : fromYear;
  const ok = Number.isFinite(y) && y >= minYear && y <= minYear + 20;
  return (
    <div className="fade-enter fixed inset-0 z-[70] grid place-items-center bg-slate-900/35 p-4 backdrop-blur-[2px]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="newplan-title"
        onSubmit={(e) => {
          e.preventDefault();
          if (ok) onCreate(y, from, parseFloat(growth) || 0);
        }}
        className="pop-in w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl"
      >
        <h3 id="newplan-title" className="text-[15px] font-semibold text-slate-900">
          {t("New plan")}
        </h3>
        <p className="mt-1 text-[13px] text-slate-500">{t("Every plan shows three years: the actual two years back, the year before, and the year you plan.")}</p>
        <label className="mt-4 block">
          <span className="mb-1 block text-[12.5px] font-medium text-slate-700">{t("Plan for year")}</span>
          <input
            autoFocus
            inputMode="numeric"
            value={year}
            onChange={(e) => setYear(e.target.value.replace(/[^\d]/g, "").slice(0, 4))}
            className="no-focus-outline h-10 w-32 rounded-lg border border-slate-200 bg-white px-3 text-[15px] font-semibold tabular-nums text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          />
          {Number.isFinite(y) && <span className="ml-3 text-[12.5px] text-slate-500">{`${y - 2} actual · ${y - 1} full year · ${y} target`}</span>}
        </label>
        <fieldset className="mt-4">
          <legend className="mb-1 text-[12.5px] font-medium text-slate-700">{t("Start from")}</legend>
          {(
            [
              ["current", `“${currentName}” (${fromYear})`, `Its ${fromYear} targets become the base year; units and sub-units carry over.`],
              ["agreed", `Agreed data (${agreedYear})`, `The original ${agreedYear - 2}/${agreedYear - 1} data and Revise ${agreedYear} (V2) targets.`],
            ] as const
          ).map(([id, label, hint]) => (
            <label key={id} className={clsx("mb-1.5 flex cursor-pointer gap-2.5 rounded-lg border p-2.5", from === id ? "border-blue-300 bg-blue-50/50" : "border-slate-200 hover:bg-slate-50")}>
              <input type="radio" name="from" checked={from === id} onChange={() => setFrom(id)} className="mt-1 accent-blue-600" />
              <span>
                <span className="block text-[13px] font-medium text-slate-900">{label}</span>
                <span className="block text-[12px] text-slate-500">{hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <label className="mt-3 block">
          <span className="mb-1 block text-[12.5px] font-medium text-slate-700">{t("Starting growth per year %")}</span>
          <input
            inputMode="decimal"
            value={growth}
            onChange={(e) => setGrowth(e.target.value)}
            className="no-focus-outline h-9 w-28 rounded-lg border border-slate-200 bg-white px-3 text-[14px] tabular-nums text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          />
          <span className="ml-3 text-[12px] text-slate-500">{t("Every unit starts with this growth; adjust afterwards.")}</span>
        </label>
        {!ok && <p className="mt-2 text-[12.5px] text-rose-600">{`Pick a year from ${minYear} to ${minYear + 20}.`}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-9 rounded-lg border border-slate-200 px-4 text-[13.5px] font-medium text-slate-700 hover:bg-slate-50">
            {t("Cancel")}
          </button>
          <button type="submit" disabled={!ok} className="h-9 rounded-lg bg-blue-600 px-4 text-[13.5px] font-medium text-white transition hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50">
            {t("Create plan")}
          </button>
        </div>
      </form>
    </div>
  );
}
