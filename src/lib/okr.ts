// EBO & OKR plan for one CoE / SBU in one year.
//  - EBO (expected business outcomes): the measurable results the unit commits to.
//  - Objectives, each with key results (metric from → to, current, owner, due) and
//    initiatives (the work that moves the key results).

export type Status = "not_started" | "on_track" | "at_risk" | "off_track" | "done";
export type Horizon = "H1" | "H2" | "H3";
/** Three horizons: today's core business, emerging growth, and future options. */
export const HORIZONS: { id: Horizon; label: string; hint: string; tone: string }[] = [
  { id: "H1", label: "Core business", hint: "Defend and grow today's business", tone: "bg-blue-50 text-blue-700 ring-blue-200" },
  { id: "H2", label: "Emerging growth", hint: "Build the next growth engines (1–3 years)", tone: "bg-violet-50 text-violet-700 ring-violet-200" },
  { id: "H3", label: "Future options", hint: "Seed new opportunities (3+ years)", tone: "bg-amber-50 text-amber-800 ring-amber-200" },
];
export type Ebo = { id: string; horizon?: Horizon; outcome: string; measure: string; unit: string; baseline: number | null; target: number | null; actual: number | null; owner: string; note?: string };
export type KeyResult = { id: string; text: string; unit: string; start: number | null; target: number | null; current: number | null; owner: string; due: string; status: Status };
export type Initiative = { id: string; text: string; owner: string; due: string; status: Status };
/** horizon: which EBO horizon (H1 / H2 / H3) the objective serves, so the EBO tab can show it. */
export type Objective = { id: string; title: string; owner: string; horizon?: Horizon; keyResults: KeyResult[]; initiatives: Initiative[] };
export type OkrPlanData = { ebos: Ebo[]; objectives: Objective[]; notes?: string };
export type OkrPlanRow = { id: string; year: number; unit: string; site: string; data: OkrPlanData; updated_by: string | null; updated_at: string };

export const STATUS: { id: Status; label: string; tone: string }[] = [
  { id: "not_started", label: "Not started", tone: "bg-slate-100 text-slate-600" },
  { id: "on_track", label: "On track", tone: "bg-emerald-50 text-emerald-700" },
  { id: "at_risk", label: "At risk", tone: "bg-amber-50 text-amber-800" },
  { id: "off_track", label: "Off track", tone: "bg-rose-50 text-rose-700" },
  { id: "done", label: "Done", tone: "bg-blue-50 text-blue-700" },
];

export const okrId = (year: number, unit: string, site: string) => `${year}::${site}::${unit}`.slice(0, 200);
export const newId = (p: string) => `${p}_${Math.random().toString(36).slice(2, 9)}`;

export function emptyPlan(): OkrPlanData {
  return { ebos: [], objectives: [] };
}

/** 0–1 progress of a key result from start to target (works for "lower is better" too). */
export function krProgress(kr: Pick<KeyResult, "start" | "target" | "current" | "status">): number {
  if (kr.status === "done") return 1;
  if (kr.start === null || kr.target === null || kr.current === null || kr.target === kr.start) return 0;
  return Math.max(0, Math.min(1, (kr.current - kr.start) / (kr.target - kr.start)));
}

export function objectiveProgress(o: Objective): number {
  if (!o.keyResults.length) return 0;
  return o.keyResults.reduce((a, k) => a + krProgress(k), 0) / o.keyResults.length;
}

export function planProgress(d: OkrPlanData): number {
  const krs = d.objectives.flatMap((o) => o.keyResults);
  return krs.length ? krs.reduce((a, k) => a + krProgress(k), 0) / krs.length : 0;
}

export function normalizePlan(raw: unknown): OkrPlanData {
  const r = raw as Partial<OkrPlanData> | null;
  return {
    ebos: Array.isArray(r?.ebos) ? r!.ebos.map((e) => ({ ...e, horizon: e.horizon === "H2" || e.horizon === "H3" ? e.horizon : "H1" })) : [],
    objectives: Array.isArray(r?.objectives) ? r!.objectives.map((o) => ({ ...o, keyResults: o.keyResults || [], initiatives: o.initiatives || [] })) : [],
    notes: r?.notes,
  };
}
