"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  FileUp,
  FunctionSquare,
  GitCommitHorizontal,
  LayoutGrid,
  LogIn,
  PencilLine,
  Plus,
  Trash2,
  TrendingUp,
  Upload,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { clsx } from "clsx";
import { useAuth } from "@/components/auth/LoginGate";
import { initialsOf, toneFor, usePresence } from "@/components/layout/Presence";

type ModelMeta = {
  code: string;
  name: string;
  totalMeasures: number;
  totalColumns: number;
  totalTables?: number;
  totalRelationships?: number;
  lastImportedAt?: string | null;
  lastImportedBy?: string | null;
  sourceFile?: string | null;
};

type LogRow = {
  id: string;
  entity_table: string;
  action: string;
  summary: string;
  changed_by: string | null;
  changed_at: string;
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function relTime(iso?: string | null) {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const ACTION_ICON: Record<string, LucideIcon> = {
  login: LogIn,
  create: Plus,
  update: PencilLine,
  delete: Trash2,
  import: FileUp,
};

const SHORTCUTS: { href: string; label: string; body: string; icon: LucideIcon }[] = [
  { href: "/reports", label: "Find a report", body: "Browse every Phuket workspace", icon: LayoutGrid },
  { href: "/dax", label: "Look up a measure", body: "Formulas with business definitions", icon: FunctionSquare },
  { href: "/whiteboard", label: "Sketch a data flow", body: "Shared canvases for the team", icon: Workflow },
  { href: "/target-scenario", label: "Model 2027 targets", body: "Cascade targets site by site", icon: TrendingUp },
];

export function HomePage() {
  const { user } = useAuth();
  const online = usePresence();
  const [models, setModels] = useState<ModelMeta[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [daxRes, logRes] = await Promise.all([
          fetch("/api/powerbi/dax?model=ALL&limit=1", { cache: "no-store" }),
          fetch("/api/users?includeLogs=true", { cache: "no-store" }),
        ]);
        if (!alive) return;
        if (daxRes.ok) setModels(((await daxRes.json()).models || []) as ModelMeta[]);
        if (logRes.ok) setLogs((((await logRes.json()).logs || []) as LogRow[]).slice(0, 10));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const firstName = (user?.name || "").split(/\s+/)[0] || "there";
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const others = online.filter((u) => u.email !== user?.email?.toLowerCase());

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-5 pb-10">
        {/* Hero */}
        <section className="model-grid relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
          <div className="grid gap-8 p-6 md:grid-cols-[1.3fr_1fr] md:p-9">
            <div>
              <p className="text-sm text-slate-500">{today}</p>
              <h2 className="mt-2 text-[34px] leading-tight font-semibold tracking-tight text-slate-900 md:text-[42px]">
                {greeting()}, {firstName}.
              </h2>
              <p className="mt-3 max-w-md text-[15px] leading-relaxed text-slate-600">
                {others.length === 0
                  ? "You're the only one here right now. Everything you change is saved under your name."
                  : `${others.length === 1 ? others[0].name.split(/\s+/)[0] + " is" : others.length + " teammates are"} working in the portal with you.`}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white/90 p-4 backdrop-blur">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-900">Working now</p>
                <span className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="presence-dot h-2 w-2 rounded-full bg-teal-live" />
                  last 10 minutes
                </span>
              </div>
              <ul className="mt-3 space-y-2.5">
                {online.length === 0 && <li className="text-sm text-slate-400">Loading…</li>}
                {online.slice(0, 5).map((u) => (
                  <li key={u.email} className="flex items-center gap-3">
                    <span
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white"
                      style={{ backgroundColor: toneFor(u.email) }}
                    >
                      {initialsOf(u.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-slate-800">
                        {u.name}
                        {u.email === user?.email?.toLowerCase() && <span className="text-slate-400"> (you)</span>}
                      </p>
                      <p className="truncate text-xs text-slate-400">{u.email}</p>
                    </div>
                    <span className="text-xs text-slate-400">{relTime(u.lastSeenAt)}</span>
                  </li>
                ))}
                {online.length > 5 && <li className="text-xs text-slate-500">and {online.length - 5} more</li>}
              </ul>
            </div>
          </div>
        </section>

        {/* Model pulse */}
        <section aria-labelledby="models-h">
          <div className="mb-3 flex items-end justify-between">
            <h3 id="models-h" className="text-[17px] font-semibold text-slate-900">Semantic models</h3>
            <Link href="/dax" className="text-sm text-blue-600 hover:underline">
              Open DAX dictionary
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {loading &&
              [0, 1].map((i) => <div key={i} className="h-44 animate-pulse rounded-2xl bg-white ring-1 ring-slate-200/80" />)}
            {models.map((m) => (
              <Link
                key={m.code}
                href={`/dax?model=${m.code}`}
                className="group rounded-2xl bg-white p-5 ring-1 ring-slate-200/80 transition hover:ring-blue-300"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-blue-700">{m.code}</p>
                    <p className="mt-1 truncate text-[15px] font-medium text-slate-900">{m.name.replace(m.code, "").trim() || m.name}</p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-blue-600" />
                </div>
                <dl className="mt-5 grid grid-cols-3 gap-2">
                  {[
                    ["Measures", m.totalMeasures],
                    ["Columns", m.totalColumns],
                    ["Tables", m.totalTables || 0],
                  ].map(([label, value]) => (
                    <div key={label as string}>
                      <dd className="text-[22px] font-semibold tabular-nums tracking-tight text-slate-900">
                        {Number(value).toLocaleString()}
                      </dd>
                      <dt className="text-xs text-slate-500">{label}</dt>
                    </div>
                  ))}
                </dl>
                <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
                  {m.lastImportedAt
                    ? `Updated from ${m.sourceFile || ".bim"} ${relTime(m.lastImportedAt)} by ${m.lastImportedBy || "someone"}`
                    : "Not yet updated from a .bim file"}
                </p>
              </Link>
            ))}
            {!loading && (
              <Link
                href="/dax?import=1"
                className="flex flex-col justify-between rounded-2xl border border-dashed border-slate-300 p-5 text-slate-600 transition hover:border-blue-400 hover:bg-blue-50/40"
              >
                <Upload className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-[15px] font-medium text-slate-900">Update a model from .bim</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-500">
                    Drop the file exported from Tabular Editor. You&rsquo;ll see what changed before anything is saved.
                  </p>
                </div>
              </Link>
            )}
          </div>
        </section>

        {/* Activity + shortcuts */}
        <section className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/80">
            <div className="mb-3 flex items-end justify-between">
              <h3 className="text-[17px] font-semibold text-slate-900">Recent changes</h3>
              <Link href="/changelog" className="text-sm text-blue-600 hover:underline">
                Full activity log
              </Link>
            </div>
            <ol className="divide-y divide-slate-100">
              {!loading && logs.length === 0 && <li className="py-6 text-sm text-slate-400">Nothing has changed yet.</li>}
              {logs.map((l) => {
                const Icon = ACTION_ICON[l.action] || GitCommitHorizontal;
                return (
                  <li key={l.id} className="flex gap-3 py-3">
                    <span
                      className={clsx(
                        "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg",
                        l.action === "import" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug text-slate-800 line-clamp-2">{l.summary}</p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {l.changed_by || "System"}, {relTime(l.changed_at)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/80">
            <h3 className="mb-3 text-[17px] font-semibold text-slate-900">Jump to</h3>
            <ul className="space-y-1">
              {SHORTCUTS.map(({ href, label, body, icon: Icon }) => (
                <li key={href}>
                  <Link href={href} className="flex items-center gap-3 rounded-xl p-2.5 hover:bg-slate-50">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ink text-blue-300">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-900">{label}</span>
                      <span className="block truncate text-xs text-slate-500">{body}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
