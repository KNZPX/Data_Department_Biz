"use client";

// Target page → Summary: the plan on one page, the way the planning deck shows it.
// The base year (forecast) against the target year for every CoE / SBU, the
// network's alignment vs usual business, a donut of the target, and talking
// points worked out from the numbers. Follows the hospital filter and MB / Baht.
import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { clsx } from "clsx";
import type { Plan } from "@/lib/targetPlan";
import { growthOf, shareOf, summaryInsights, targetSummary, type Figures, type SummaryLine } from "@/lib/targetSummary";

type Unit = "MB" | "THB";

// Office-style palette, as in the planning deck; Usual Business is the light grey.
const PALETTE = ["#4472c4", "#ed7d31", "#a5a5a5", "#ffc000", "#5b9bd5", "#70ad47", "#264478", "#9e480e", "#636363", "#997300", "#255e91", "#43682b"];
const USUAL = "#d4d8de";
const siteLabel = (code: string) => code.replace(" (Premium)", "");

export function TargetSummaryView({ plan, siteFilter, unit, scenarioName }: { plan: Plan; siteFilter: string; unit: Unit; scenarioName: string }) {
  const [lang, setLang] = useState<"th" | "en">("th");
  const [openUsual, setOpenUsual] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const s = useMemo(() => targetSummary(plan, siteFilter), [plan, siteFilter]);
  const Y = plan.targetYear;
  const B = Y - 1;
  const P = Y - 2;
  const am = plan.actualMonths;
  const baseLabel = am > 0 && am < 12 ? `${B} F${am}+${12 - am}` : am === 12 ? `${B} actual` : `${B} Forecast`;
  const scope = siteFilter === "ALL" ? "Phuket" : siteLabel(siteFilter);
  const T = s.totals;

  const fmt = (thb: number) => (unit === "MB" ? `${(thb / 1e6).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MB` : `${Math.round(thb).toLocaleString("en-US")} ฿`);
  const insights = summaryInsights(s, { scope, year: Y, baseLabel, fmt, lang, siteLabel });

  const colors = new Map(s.alignment.map((l, i) => [l.name, PALETTE[i % PALETTE.length]]));
  const slices = [...s.alignment.map((l) => ({ key: l.name, label: l.name, value: l.target, color: colors.get(l.name)! })), { key: "__usual", label: "Usual Business", value: T.usual.target, color: USUAL }].filter((x) => x.value > 0);

  if (!T.all.target && !T.all.base) {
    return <p className="p-6 text-[13px] text-slate-500">Nothing to summarise yet — type {B} and {Y} numbers for the units in the Plan tab.</p>;
  }

  return (
    <div className="@container space-y-4 p-4 md:p-5">
      {/* Title */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[20px] font-semibold leading-tight text-rose-700">{scenarioName}</p>
          <h2 className="text-[19px] font-bold text-[#1f3864] dark:text-blue-200">
            {scope} : Revenue Target {Y} by CoE/SBU
          </h2>
          <p className="text-[12px] italic text-slate-400">Revenue by operation · net revenue target</p>
        </div>
        <p className="text-[12px] text-slate-400">
          {s.sites.map(siteLabel).join(" · ")} · {s.alignment.length + s.usual.length + s.focus.length} units
        </p>
      </div>

      <div className="grid gap-4 @min-[1180px]:grid-cols-[minmax(0,1fr)_340px]">
        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] border-separate border-spacing-0 text-[13px]">
            <colgroup>
              <col />
              <col className="w-[110px]" />
              <col className="w-[80px]" />
              <col className="w-[80px]" />
              <col className="w-[44px]" />
              <col className="w-[110px]" />
              <col className="w-[80px]" />
              <col className="w-[80px]" />
              <col className="w-[104px]" />
            </colgroup>
            <thead>
              <tr className="text-[12.5px] font-semibold text-white">
                <th className="rounded-tl-lg bg-gradient-to-r from-[#b8860b] to-[#d4a017]" />
                <th colSpan={3} className="rounded-tr-lg bg-gradient-to-r from-[#c8960f] to-[#d4a017] py-2 text-center">
                  {baseLabel}
                </th>
                <th className="bg-transparent">
                  <span className="mx-auto grid h-7 w-7 place-items-center rounded-full bg-[#2f5597] text-white shadow" aria-hidden>
                    <ChevronRight className="h-4 w-4" />
                  </span>
                </th>
                <th colSpan={4} className="rounded-t-lg bg-gradient-to-r from-[#2f5597] to-[#4472c4] py-2 text-center">
                  F{Y}
                </th>
              </tr>
              <tr className="text-[12px] font-semibold">
                <th className="border-b border-amber-200 bg-amber-50 dark:bg-amber-950/30" />
                <th className="border-b border-amber-200 bg-amber-50 px-2 py-2 text-right text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">{baseLabel}</th>
                <th className="border-b border-amber-200 bg-amber-50 px-2 py-2 text-right text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">%Portion</th>
                <th className="border-b border-amber-200 bg-amber-50 px-2 py-2 text-right text-amber-800 dark:bg-amber-950/30 dark:text-amber-300" title={`Against ${P}`}>
                  %Growth
                </th>
                <th />
                <th className="border-b border-blue-200 bg-blue-50 px-2 py-2 text-right text-[#1f3864] dark:bg-blue-950/30 dark:text-blue-200">T {Y}</th>
                <th className="border-b border-blue-200 bg-blue-50 px-2 py-2 text-right text-[#1f3864] dark:bg-blue-950/30 dark:text-blue-200">%Portion</th>
                <th className="border-b border-blue-200 bg-blue-50 px-2 py-2 text-right text-[#1f3864] dark:bg-blue-950/30 dark:text-blue-200" title={`Against ${baseLabel}`}>
                  %Growth
                </th>
                <th className="border-b border-violet-300 bg-[#7c4fa3] px-2 py-1 text-right text-white">
                  Plus
                  <span className="block text-[10px] font-normal opacity-80">
                    {B}F→{Y}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {s.alignment.length > 0 && (
                <Row label={`${scope} Alignment`} f={T.alignment} total={T.all} fmt={fmt} strong />
              )}
              {s.alignment.map((l, i) => (
                <Row
                  key={l.name}
                  label={l.name}
                  no={i + 1}
                  f={l}
                  total={T.all}
                  fmt={fmt}
                  color={colors.get(l.name)}
                  hovered={hover === l.name}
                  onHover={(v) => setHover(v ? l.name : null)}
                />
              ))}
              {(s.usual.length > 0 || s.focus.length > 0) && (
                <Row
                  label="Usual Business"
                  f={T.usual}
                  total={T.all}
                  fmt={fmt}
                  strong
                  color={USUAL}
                  hovered={hover === "__usual"}
                  onHover={(v) => setHover(v ? "__usual" : null)}
                  toggle={s.focus.length ? { open: openUsual, onToggle: () => setOpenUsual((v) => !v), hint: `${s.focus.length} Hospital Focus` } : undefined}
                />
              )}
              {openUsual &&
                [...s.usual.map((l) => ({ l, tag: "" })), ...s.focus.map((l) => ({ l, tag: Object.keys(l.bySite).map(siteLabel).join(", ") }))].map(({ l, tag }) => (
                  <Row key={l.name} label={l.name} tag={tag ? `Hospital Focus · ${tag}` : "Usual Business"} f={l} total={T.all} fmt={fmt} sub />
                ))}
              <Row label="Total" f={T.all} total={T.all} fmt={fmt} strong top />
            </tbody>
          </table>
        </div>

        {/* Donut */}
        <div className="@container rounded-xl border border-slate-200/80 p-4">
          <p className="mb-2 text-center text-[14px] font-semibold text-[#1f3864] dark:text-blue-200">Net Revenue F{Y}</p>
          <div className="flex flex-col items-center gap-3 @min-[560px]:flex-row @min-[560px]:justify-center @min-[560px]:gap-8">
            <Donut slices={slices} hover={hover} setHover={setHover} center={{ title: scope, value: fmt(T.all.target), sub: `Growth ${pctText(growthOf(T.all.target, T.all.base))}` }} />
            <div className="grid w-full max-w-[460px] grid-cols-1 gap-x-4 gap-y-1 text-[12px] @min-[440px]:grid-cols-2">
              {slices.map((x) => (
                <button
                  key={x.key}
                  type="button"
                  onMouseEnter={() => setHover(x.key)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(x.key)}
                  onBlur={() => setHover(null)}
                  className={clsx("flex items-center gap-1.5 rounded px-1 text-left transition", hover && hover !== x.key && "opacity-50")}
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: x.color }} />
                  <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-300" title={x.label}>
                    {x.label}
                  </span>
                  <span className="font-semibold tabular-nums" style={{ color: x.key === "__usual" ? undefined : x.color }}>
                    {pctPlain(shareOf(x.value, T.all.target))}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Talking points */}
      <div className="rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50/70 to-slate-50 p-4 dark:border-blue-900/50 dark:from-blue-950/30 dark:to-slate-900/30">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[12px] font-medium uppercase tracking-[0.06em] text-slate-400">Talking points</p>
          <div className="flex rounded-md bg-white/70 p-0.5 text-[11.5px] dark:bg-slate-800/60" role="radiogroup" aria-label="Language">
            {(
              [
                ["th", "ไทย"],
                ["en", "EN"],
              ] as const
            ).map(([v, label]) => (
              <button key={v} type="button" role="radio" aria-checked={lang === v} onClick={() => setLang(v)} className={clsx("rounded px-2 py-0.5 font-medium", lang === v ? "bg-blue-600 text-white" : "text-slate-500")}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <ul className="grid gap-x-8 gap-y-1.5 text-[13.5px] leading-relaxed text-slate-700 lg:grid-cols-2 dark:text-slate-200">
          {insights.lead.map((line, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-slate-500" />
              <Rich text={line} />
            </li>
          ))}
        </ul>
        {insights.focus && (
          <div className="mt-3 text-[13.5px] leading-relaxed text-slate-700 dark:text-slate-200">
            <p className="text-[#1f3864] dark:text-blue-200">
              <Rich text={insights.focus.title} />
            </p>
            <ul className="mt-1 space-y-0.5">
              {insights.focus.sites.map((line, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-slate-500" />
                  <Rich text={line} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <p className="text-right text-[12px] text-slate-500">
        Remark | Scenario by Rev Target: {fmt(T.all.target)} ({scenarioName})
      </p>
    </div>
  );
}

function pctText(g: number | null) {
  return g === null ? "—" : `${g >= 0 ? "+" : "−"}${Math.abs(g * 100).toFixed(1)}%`;
}
function pctPlain(x: number | null) {
  return x === null ? "—" : `${(x * 100).toFixed(1)}%`;
}

function Row({
  label,
  no,
  tag,
  f,
  total,
  fmt,
  strong,
  sub,
  top,
  color,
  hovered,
  onHover,
  toggle,
}: {
  label: string;
  no?: number;
  tag?: string;
  f: Figures | SummaryLine;
  total: Figures;
  fmt: (thb: number) => string;
  strong?: boolean;
  sub?: boolean;
  top?: boolean;
  color?: string;
  hovered?: boolean;
  onHover?: (on: boolean) => void;
  toggle?: { open: boolean; onToggle: () => void; hint: string };
}) {
  const gb = growthOf(f.base, f.prior);
  const gt = growthOf(f.target, f.base);
  const plus = f.target - f.base;
  const cell = clsx("border-b border-slate-100 px-2 tabular-nums text-right dark:border-slate-800", sub ? "py-1 text-[12px]" : "py-1.5", top && "border-t-2 border-t-slate-300");
  const tone = (g: number | null) => (g === null ? "text-slate-400" : g >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600");
  return (
    <tr
      className={clsx("transition-colors", strong && "font-semibold text-slate-900 dark:text-slate-100", hovered && "bg-blue-50/60 dark:bg-blue-950/30", sub && "text-slate-500")}
      onMouseEnter={onHover && (() => onHover(true))}
      onMouseLeave={onHover && (() => onHover(false))}
    >
      <td className={clsx("border-b border-slate-100 py-1.5 pr-2 dark:border-slate-800", top && "border-t-2 border-t-slate-300", sub ? "pl-12 text-[12px]" : no ? "pl-4" : "pl-2")}>
        <span className="flex items-center gap-2">
          {toggle && (
            <button type="button" onClick={toggle.onToggle} className="-ml-1 grid h-5 w-5 place-items-center rounded text-slate-400 hover:bg-slate-100" aria-expanded={toggle.open} aria-label={toggle.open ? "Hide what's inside" : "Show what's inside"} title={toggle.hint}>
              <ChevronDown className={clsx("h-3.5 w-3.5 transition-transform", !toggle.open && "-rotate-90")} />
            </button>
          )}
          {no !== undefined && <span className="w-4 text-right text-[12px] tabular-nums text-slate-400">{no}</span>}
          {color && !strong && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />}
          <span className={clsx("truncate", !strong && !sub && "text-slate-800 dark:text-slate-200")}>{label}</span>
          {tag && <span className="truncate text-[11px] text-slate-400">{tag}</span>}
        </span>
      </td>
      <td className={clsx(cell, "text-slate-800 dark:text-slate-200")}>{fmt(f.base)}</td>
      <td className={clsx(cell, "text-slate-500")}>{pctPlain(shareOf(f.base, total.base))}</td>
      <td className={clsx(cell, tone(gb))}>{pctText(gb)}</td>
      <td className="border-b border-transparent" />
      <td className={clsx(cell, "text-slate-900 dark:text-slate-100")}>{fmt(f.target)}</td>
      <td className={clsx(cell, "text-slate-500")}>{pctPlain(shareOf(f.target, total.target))}</td>
      <td className={clsx(cell, tone(gt))}>{pctText(gt)}</td>
      <td className={clsx(cell, plus >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600")}>
        {plus >= 0 ? "+" : "−"}
        {fmt(Math.abs(plus))}
      </td>
    </tr>
  );
}

/** Text with **bold** parts; a bold "+6.7%" / "−0.2%" is coloured green / red. */
function Rich({ text }: { text: string }) {
  const parts = text.split("**");
  return (
    <span>
      {parts.map((p, i) =>
        i % 2 === 0 ? (
          <Fragment key={i}>{p}</Fragment>
        ) : (
          <strong key={i} className={clsx("font-semibold", /^\+[\d.,]+%$/.test(p) ? "text-emerald-700 dark:text-emerald-400" : /^−[\d.,]+%$/.test(p) ? "text-rose-600" : "text-slate-900 dark:text-white")}>
            {p}
          </strong>
        )
      )}
    </span>
  );
}

function Donut({
  slices,
  hover,
  setHover,
  center,
}: {
  slices: { key: string; label: string; value: number; color: string }[];
  hover: string | null;
  setHover: (k: string | null) => void;
  center: { title: string; value: string; sub: string };
}) {
  const total = slices.reduce((a, x) => a + x.value, 0);
  const R = 70;
  const C = 2 * Math.PI * R;
  const gap = slices.length > 1 ? 1.2 : 0;
  const lens = slices.map((x) => (total > 0 ? (x.value / total) * C : 0));
  const starts = lens.map((_, i) => lens.slice(0, i).reduce((a, b) => a + b, 0));
  return (
    <svg viewBox="0 0 200 200" className="mx-auto block h-[220px] w-[220px]" role="img" aria-label="Share of the target by CoE / SBU">
      {slices.map((x, i) => (
          <circle
            key={x.key}
            cx={100}
            cy={100}
            r={R}
            fill="none"
            stroke={x.color}
            strokeWidth={hover === x.key ? 36 : 30}
            strokeDasharray={`${Math.max(0, lens[i] - gap)} ${C}`}
            strokeDashoffset={-starts[i]}
            transform="rotate(-90 100 100)"
            className="cursor-pointer transition-[stroke-width,opacity] duration-200"
            opacity={hover && hover !== x.key ? 0.45 : 1}
            onMouseEnter={() => setHover(x.key)}
            onMouseLeave={() => setHover(null)}
          >
            <title>{`${x.label}: ${((x.value / total) * 100).toFixed(1)}%`}</title>
          </circle>
      ))}
      <text x={100} y={86} textAnchor="middle" className="fill-slate-400 text-[10px]">
        {center.title}
      </text>
      <text x={100} y={105} textAnchor="middle" className="fill-[#1f3864] text-[15px] font-bold dark:fill-blue-200">
        {center.value}
      </text>
      <text x={100} y={121} textAnchor="middle" className="fill-slate-500 text-[9.5px]">
        {center.sub}
      </text>
    </svg>
  );
}
