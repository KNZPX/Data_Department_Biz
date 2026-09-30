"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, FileUp, GitCommitHorizontal, LogIn, PencilLine, Plus, Trash2, type LucideIcon } from "lucide-react";
import { clsx } from "clsx";
import { useAccess, useAuth } from "@/components/auth/LoginGate";
import { initialsOf, toneFor, usePresence } from "@/components/layout/Presence";
import { TrendChart, type Point } from "@/components/TrendChart";

type Grain = "day" | "month" | "year";
type Delta = { now: number; start: number };
type Insights = {
  semantic?: {
    startedAt: string | null;
    models: { code: string; name: string; tables: number; relationships: number; lastImportedAt: string | null; lastImportedBy: string | null; sourceFile: string | null; measures: Delta; columns: Delta; custom: Delta }[];
    totals: { measures: number; measuresStart: number; columns: number; columnsStart: number; custom: number; formulaChanges: number };
    series: Point[];
  };
  license?: {
    startedAt: string | null;
    totals: { active: number; activeStart: number; pro: number; premium: number; revoked: number; cancelled: number; all: number };
    bySite: { site: string; n: number }[];
    series: Point[];
  };
  activity?: { id: string; action: string; summary: string; by: string | null; at: string; table: string }[];
};

const ACTION_ICON: Record<string, LucideIcon> = { login: LogIn, create: Plus, update: PencilLine, delete: Trash2, import: FileUp };

function rel(iso?: string | null) {
  if (!iso) return "";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d < 30 ? `${d} d ago` : new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function since(iso?: string | null) {
  return iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "the start";
}

/** ▲ green for increases, ▼ red for decreases. */
function Change({ now, start, suffix = "since start" }: { now: number; start: number; suffix?: string }) {
  const d = now - start;
  if (d === 0) return <span className="text-xs text-slate-400">No change {suffix}</span>;
  return (
    <span className={clsx("text-xs tabular-nums", d > 0 ? "text-[#0B7F72]" : "text-coral")}>
      {d > 0 ? "▲ +" : "▼ −"}
      {Math.abs(d).toLocaleString()} {suffix}
    </span>
  );
}

function Kpi({ label, value, children }: { label: string; value: number; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/80">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-[28px] font-semibold leading-tight tabular-nums tracking-tight text-slate-900">{value.toLocaleString()}</p>
      <div className="mt-1 min-h-[16px]">{children}</div>
    </div>
  );
}

export function HomePage() {
  const { user } = useAuth();
  const { can } = useAccess();
  const online = usePresence();
  const [grain, setGrain] = useState<Grain>("day");
  const [data, setData] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetch(`/api/insights?grain=${grain}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => alive && setData(j))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [grain]);

  const firstName = (user?.name || "").split(/\s+/)[0] || "there";
  const s = data?.semantic;
  const l = data?.license;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-7xl space-y-6 pb-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm text-slate-500">{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
            <h2 className="mt-1 text-[32px] font-semibold leading-tight tracking-tight text-slate-900">Hello, {firstName}.</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {online.slice(0, 5).map((u) => (
                  <span key={u.email} title={u.name} className="grid h-8 w-8 place-items-center rounded-full text-[11px] font-semibold text-white ring-2 ring-paper" style={{ background: toneFor(u.email) }}>
                    {initialsOf(u.name)}
                  </span>
                ))}
              </div>
              <span className="text-xs text-slate-500">{online.length <= 1 ? "Only you online" : `${online.length} online`}</span>
            </div>
            <div role="tablist" aria-label="Trend period" className="flex rounded-xl bg-white p-1 ring-1 ring-slate-200">
              {(["day", "month", "year"] as Grain[]).map((g) => (
                <button
                  key={g}
                  role="tab"
                  aria-selected={grain === g}
                  type="button"
                  onClick={() => setGrain(g)}
                  className={clsx("rounded-lg px-3.5 py-1.5 text-sm", grain === g ? "bg-ink text-white" : "text-slate-600 hover:bg-slate-50")}
                >
                  {g === "day" ? "Daily" : g === "month" ? "Monthly" : "Yearly"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {can("home.semantic") && (
          <section aria-labelledby="sem-h" className="space-y-3">
            <div className="flex items-end justify-between">
              <h3 id="sem-h" className="text-[18px] font-semibold text-slate-900">
                Semantic models <span className="text-sm font-normal text-slate-500">since {since(s?.startedAt)}</span>
              </h3>
              <Link href="/dax" className="text-sm text-blue-600 hover:underline">
                Open DAX dictionary
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi label="Model measures" value={s?.totals.measures || 0}>{s && <Change now={s.totals.measures} start={s.totals.measuresStart} />}</Kpi>
              <Kpi label="Columns" value={s?.totals.columns || 0}>{s && <Change now={s.totals.columns} start={s.totals.columnsStart} />}</Kpi>
              <Kpi label="Written by the team" value={s?.totals.custom || 0}>
                <span className="text-xs text-slate-400">Custom DAX measures</span>
              </Kpi>
              <Kpi label="Formula changes" value={s?.totals.formulaChanges || 0}>
                <span className="text-xs text-slate-400">Detected across .bim updates</span>
              </Kpi>
            </div>
            <div className="grid gap-3 lg:grid-cols-[1.6fr_1fr]">
              <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/80">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-900">Measures over time</p>
                  <p className="flex gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-blue-600" /> Total</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-teal-live" /> Added</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-coral" /> Removed</span>
                  </p>
                </div>
                {loading && !s ? <div className="h-60 animate-pulse rounded-xl bg-slate-50" /> : <TrendChart data={s?.series || []} totalLabel="Measures" changedLabel="Formula changes" />}
              </div>
              <div className="space-y-3">
                {s?.models.map((m) => (
                  <Link key={m.code} href={`/dax?model=${m.code}`} className="group block rounded-2xl bg-white p-4 ring-1 ring-slate-200/80 transition hover:ring-blue-300">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <p className="font-mono text-xs text-blue-700">{m.code}</p>
                        <p className="truncate text-[15px] font-medium text-slate-900">{m.name.replace(m.code, "").trim() || m.name}</p>
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-slate-300 group-hover:text-blue-600" />
                    </div>
                    <dl className="mt-3 grid grid-cols-4 gap-2">
                      {(
                        [
                          ["Measures", m.measures],
                          ["Columns", m.columns],
                          ["Team DAX", m.custom],
                        ] as [string, Delta][]
                      ).map(([label, d]) => (
                        <div key={label}>
                          <dd className="text-lg font-semibold tabular-nums text-slate-900">{d.now.toLocaleString()}</dd>
                          <dt className="text-[11px] text-slate-500">{label}</dt>
                          <Change now={d.now} start={d.start} suffix="" />
                        </div>
                      ))}
                      <div>
                        <dd className="text-lg font-semibold tabular-nums text-slate-900">{m.tables}</dd>
                        <dt className="text-[11px] text-slate-500">Tables</dt>
                        <span className="text-[11px] text-slate-400">{m.relationships} links</span>
                      </div>
                    </dl>
                    <p className="mt-3 border-t border-slate-100 pt-2 text-xs text-slate-500">
                      {m.lastImportedAt ? `Updated ${rel(m.lastImportedAt)} by ${m.lastImportedBy}` : "Not yet updated from a .bim file"}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {can("home.license") && (
          <section aria-labelledby="lic-h" className="space-y-3">
            <div className="flex items-end justify-between">
              <h3 id="lic-h" className="text-[18px] font-semibold text-slate-900">
                Power BI licenses <span className="text-sm font-normal text-slate-500">since {since(l?.startedAt)}</span>
              </h3>
              <Link href="/licenses" className="text-sm text-blue-600 hover:underline">
                Open licenses
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi label="Active licenses" value={l?.totals.active || 0}>{l && <Change now={l.totals.active} start={l.totals.activeStart} />}</Kpi>
              <Kpi label="Pro" value={l?.totals.pro || 0}>
                <span className="text-xs text-slate-400">{l ? Math.round((l.totals.pro / Math.max(1, l.totals.active)) * 100) : 0}% of active</span>
              </Kpi>
              <Kpi label="Premium per capacity" value={l?.totals.premium || 0}>
                <span className="text-xs text-slate-400">{l ? Math.round((l.totals.premium / Math.max(1, l.totals.active)) * 100) : 0}% of active</span>
              </Kpi>
              <Kpi label="Revoked or cancelled" value={(l?.totals.revoked || 0) + (l?.totals.cancelled || 0)}>
                <span className="text-xs text-slate-400">of {l?.totals.all || 0} records</span>
              </Kpi>
            </div>
            <div className="grid gap-3 lg:grid-cols-[1.6fr_1fr]">
              <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/80">
                <p className="mb-2 text-sm font-medium text-slate-900">Active licenses over time</p>
                {loading && !l ? <div className="h-60 animate-pulse rounded-xl bg-slate-50" /> : <TrendChart data={l?.series || []} totalLabel="Active" addedLabel="Approved" removedLabel="Revoked" />}
              </div>
              <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/80">
                <p className="mb-3 text-sm font-medium text-slate-900">Active by site</p>
                <ul className="space-y-2.5">
                  {l?.bySite.map((b) => (
                    <li key={b.site}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="text-slate-700">{b.site}</span>
                        <span className="tabular-nums text-slate-900">{b.n}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100">
                        <div className="h-2 rounded-full bg-blue-600" style={{ width: `${(b.n / Math.max(1, l.totals.active)) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        )}

        {can("home.activity") && (
          <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/80">
            <div className="mb-2 flex items-end justify-between">
              <h3 className="text-[18px] font-semibold text-slate-900">Recent activity</h3>
              <Link href="/changelog" className="text-sm text-blue-600 hover:underline">
                Full activity log
              </Link>
            </div>
            <ol className="grid md:grid-cols-2 md:gap-x-8">
              {!loading && !(data?.activity || []).length && <li className="py-4 text-sm text-slate-400">Nothing has changed yet.</li>}
              {(data?.activity || []).map((a) => {
                const Icon = ACTION_ICON[a.action] || GitCommitHorizontal;
                return (
                  <li key={a.id} className="flex gap-3 border-b border-slate-100 py-3">
                    <span className={clsx("mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg", a.action === "import" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500")}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-sm leading-snug text-slate-800">{a.summary}</p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {a.by || "System"}, {rel(a.at)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        )}
      </div>
    </div>
  );
}
