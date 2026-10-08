// The one-page summary of a Target plan: each CoE / SBU's base year (forecast)
// against the target year, with share of the total and growth, grouped the way
// the planning deck shows it:
//   "Alignment" — the CoE / SBU units the network plans together,
//   "Usual Business" — everything else, including site-only Hospital Focus units.
// Pure functions only, so the numbers are easy to check.
import { childrenOf, type Plan } from "./targetPlan";

/** Groups counted in Usual Business rather than the network's alignment. */
export const OUTSIDE_ALIGNMENT = ["Usual Business", "Hospital Focus"];

export type Figures = { prior: number; base: number; target: number };
export type SummaryLine = Figures & { name: string; group: string; bySite: Record<string, Figures> };
export type TargetSummary = {
  sites: string[];
  /** CoE / SBU units, in the organisation's order. */
  alignment: SummaryLine[];
  /** Usual Business itself (without Hospital Focus). */
  usual: SummaryLine[];
  /** Hospital Focus units: one hospital's own focus, counted inside Usual Business. */
  focus: SummaryLine[];
  totals: { alignment: Figures; usual: Figures; focus: Figures; all: Figures };
};

const zero = (): Figures => ({ prior: 0, base: 0, target: 0 });
const addTo = (a: Figures, b: Figures) => {
  a.prior += b.prior;
  a.base += b.base;
  a.target += b.target;
};
const sum = (list: Figures[]) => list.reduce((acc, f) => (addTo(acc, f), acc), zero());

/** `siteFilter` is "ALL" for the whole network, or one hospital's id. */
export function targetSummary(plan: Plan, siteFilter: string): TargetSummary {
  const sites = siteFilter === "ALL" ? plan.nodes[plan.rootId].children : [siteFilter];
  const lines = new Map<string, SummaryLine>();
  for (const s of sites)
    for (const n of childrenOf(plan, s)) {
      if (n.level !== "coe") continue;
      const l = lines.get(n.name) || { name: n.name, group: n.group || "Other", ...zero(), bySite: {} };
      const f = { prior: n.prior25, base: n.base26, target: n.target };
      addTo(l, f);
      addTo((l.bySite[s] ||= zero()), f);
      lines.set(n.name, l);
    }
  // The organisation's order where the plan carries it, else biggest first.
  const order = plan.blank?.units.map((u) => u.name) || [];
  const rank = (l: SummaryLine) => (order.includes(l.name) ? order.indexOf(l.name) : order.length);
  const all = Array.from(lines.values()).sort((a, b) => rank(a) - rank(b) || b.target - a.target);
  const alignment = all.filter((l) => !OUTSIDE_ALIGNMENT.includes(l.group));
  const usual = all.filter((l) => l.group === "Usual Business");
  const focus = all.filter((l) => l.group === "Hospital Focus");
  const usualAll = sum([...usual, ...focus]);
  return {
    sites,
    alignment,
    usual,
    focus,
    totals: { alignment: sum(alignment), usual: usualAll, focus: sum(focus), all: sum(all) },
  };
}

/** a vs b as a fraction (0.067 = +6.7%), or null when there's nothing to grow from. */
export const growthOf = (a: number, b: number) => (b > 0 ? a / b - 1 : null);
export const shareOf = (a: number, total: number) => (total > 0 ? a / total : null);

export type InsightText = { lead: string[]; focus: { title: string; sites: string[] } | null };

/**
 * The deck's talking points, worked out from the numbers. Bold parts are
 * wrapped in **…**. `fmt` turns THB into text in the person's unit.
 */
export function summaryInsights(
  s: TargetSummary,
  o: { scope: string; year: number; baseLabel: string; fmt: (thb: number) => string; lang: "th" | "en"; siteLabel: (site: string) => string }
): InsightText {
  const th = o.lang === "th";
  const pct = (g: number | null) => (g === null ? "—" : `${g >= 0 ? "+" : "−"}${Math.abs(g * 100).toFixed(1)}%`);
  const plus = (thb: number) => `${thb >= 0 ? "+" : "−"}${o.fmt(Math.abs(thb))}`;
  const share = (a: number) => {
    const x = shareOf(a, s.totals.all.target);
    return x === null ? "—" : `${(x * 100).toFixed(1)}%`;
  };
  const T = s.totals;
  const lead: string[] = [];

  lead.push(
    th
      ? `เป้าหมายรายได้รวม ${o.scope} ปี ${o.year} อยู่ที่ **${o.fmt(T.all.target)}** เติบโต **${pct(growthOf(T.all.target, T.all.base))}** จาก Baseline (${o.baseLabel})`
      : `${o.scope}'s ${o.year} revenue target is **${o.fmt(T.all.target)}**, **${pct(growthOf(T.all.target, T.all.base))}** on the baseline (${o.baseLabel})`
  );
  if (s.alignment.length) {
    const ga = growthOf(T.alignment.target, T.alignment.base);
    const gu = growthOf(T.usual.target, T.usual.base);
    const driver = T.alignment.target - T.alignment.base > T.usual.target - T.usual.base || (ga ?? 0) > (gu ?? 0);
    lead.push(
      th
        ? `${driver ? "ตัวขับเคลื่อนหลักคือกลุ่ม" : "กลุ่ม"} **${o.scope} Alignment** ${o.fmt(T.alignment.target)} (${share(T.alignment.target)} ของยอดรวม) เติบโต **${pct(ga)}** (${plus(T.alignment.target - T.alignment.base)})`
        : `${driver ? "The main driver is " : ""}**${o.scope} Alignment**: ${o.fmt(T.alignment.target)} (${share(T.alignment.target)} of the total), **${pct(ga)}** (${plus(T.alignment.target - T.alignment.base)})`
    );
    const grown = s.alignment.filter((l) => l.base > 0);
    const top = [...grown].sort((a, b) => (growthOf(b.target, b.base) ?? 0) - (growthOf(a.target, a.base) ?? 0))[0];
    if (top)
      lead.push(
        th
          ? `หน่วยที่เติบโตสูงสุดคือ **${top.name}** **${pct(growthOf(top.target, top.base))}** (${o.fmt(top.base)} → ${o.fmt(top.target)}, ${plus(top.target - top.base)})`
          : `Fastest growth: **${top.name}** **${pct(growthOf(top.target, top.base))}** (${o.fmt(top.base)} → ${o.fmt(top.target)}, ${plus(top.target - top.base)})`
      );
    const down = grown.filter((l) => l.target < l.base);
    const low = [...grown].sort((a, b) => (growthOf(a.target, a.base) ?? 0) - (growthOf(b.target, b.base) ?? 0))[0];
    if (!down.length && low)
      lead.push(
        th
          ? `ทุกหน่วยใน CoE/SBU มีเป้าหมายเติบโตเป็นบวกทั้งหมด (ต่ำสุดคือ ${low.name} **${pct(growthOf(low.target, low.base))}**)`
          : `Every CoE / SBU grows (lowest: ${low.name} **${pct(growthOf(low.target, low.base))}**)`
      );
    else if (down.length)
      lead.push(
        th
          ? `มี ${down.length} หน่วยที่เป้าต่ำกว่า ${o.baseLabel}: ${down.map((l) => `${l.name} **${pct(growthOf(l.target, l.base))}**`).join(", ")}`
          : `${down.length} ${down.length === 1 ? "unit is" : "units are"} below ${o.baseLabel}: ${down.map((l) => `${l.name} **${pct(growthOf(l.target, l.base))}**`).join(", ")}`
      );
  }
  if (T.usual.target || T.usual.base) {
    const gu = growthOf(T.usual.target, T.usual.base);
    const hf = s.focus.length ? (th ? " (รวม Hospital Focus)" : " (incl. Hospital Focus)") : "";
    lead.push(
      th
        ? `Usual Business${hf} ${o.fmt(T.usual.target)} (${share(T.usual.target)} ของยอดรวม) **${pct(gu)}** — ${(gu ?? 0) >= 0 ? "สนับสนุนการเติบโตโดยรวมเช่นกัน" : `ลดลงจาก ${o.baseLabel}`}`
        : `Usual Business${hf}: ${o.fmt(T.usual.target)} (${share(T.usual.target)} of the total), **${pct(gu)}** — ${(gu ?? 0) >= 0 ? "also adding to growth" : `down on ${o.baseLabel}`}`
    );
  }

  let focus: InsightText["focus"] = null;
  if (s.focus.length) {
    const gf = growthOf(T.focus.target, T.focus.base);
    const title = th
      ? `**Hospital Focus รายไซต์** (เป้าเฉพาะไซต์ · รวมอยู่ใน Usual Business) — **รวม ${o.fmt(T.focus.target)} ${pct(gf)} (${plus(T.focus.target - T.focus.base)})**`
      : `**Hospital Focus by hospital** (one hospital's own focus · inside Usual Business) — **${o.fmt(T.focus.target)} in all, ${pct(gf)} (${plus(T.focus.target - T.focus.base)})**`;
    const lines = s.sites
      .map((site) => {
        const here = s.focus.filter((l) => l.bySite[site]);
        if (!here.length) return null;
        return `**${o.siteLabel(site)}**: ${here.map((l) => `${l.name} ${o.fmt(l.bySite[site].target)} **${pct(growthOf(l.bySite[site].target, l.bySite[site].base))}**`).join(" · ")}`;
      })
      .filter((x): x is string => !!x);
    focus = { title, sites: lines };
  }
  return { lead, focus };
}
