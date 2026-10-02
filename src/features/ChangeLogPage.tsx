"use client";

// Everything the team changed, newest first — and a way to put a change back.
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, FunctionSquare, History, KeyRound, LayoutGrid, Loader2, LogIn, RefreshCw, RotateCcw, Search, Target, Users, Workflow } from "lucide-react";
import { clsx } from "clsx";
import { confirmDialog, toast } from "@/components/feedback";
import { useT } from "@/lib/i18n";

type Log = {
  id: string;
  entity_table: string;
  entity_id: string;
  action: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  summary: string;
  changed_by: string | null;
  changed_at: string;
  is_restored?: boolean;
  restorable?: boolean;
  canRestore?: boolean;
};

const AREAS: { id: string; label: string; icon: typeof History; tables: string[] }[] = [
  { id: "all", label: "Everything", icon: History, tables: [] },
  { id: "dax", label: "DAX dictionary", icon: FunctionSquare, tables: ["dax_dictionary_items", "custom_dax_items", "dax_annotations", "dax_models"] },
  { id: "reports", label: "Power BI reports", icon: LayoutGrid, tables: ["powerbi_items"] },
  { id: "licenses", label: "Licenses", icon: Users, tables: ["powerbi_licenses"] },
  { id: "boards", label: "Whiteboard", icon: Workflow, tables: ["whiteboard_boards"] },
  { id: "targets", label: "Targets", icon: Target, tables: ["target_scenarios"] },
  { id: "people", label: "Sign-ins & people", icon: LogIn, tables: ["app_users"] },
];
const areaOf = (table: string) => AREAS.find((a) => a.tables.includes(table)) || { id: "other", label: "Other", icon: KeyRound, tables: [] };

const ACTION_TONE: Record<string, string> = {
  create: "bg-emerald-50 text-emerald-700",
  update: "bg-blue-50 text-blue-700",
  delete: "bg-rose-50 text-rose-700",
  restore: "bg-violet-50 text-violet-700",
  login: "bg-slate-100 text-slate-600",
  import: "bg-amber-50 text-amber-800",
};

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date(today);
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

/** Fields that differ between before and after (skipping noisy timestamps). */
function diff(before: Record<string, unknown> | null, after: Record<string, unknown> | null) {
  const skip = new Set(["updated_at", "created_at", "last_imported_at", "last_import_id"]);
  const keys = Array.from(new Set([...Object.keys(before || {}), ...Object.keys(after || {})])).filter((k) => !skip.has(k));
  return keys
    .map((k) => ({ key: k, from: before?.[k], to: after?.[k] }))
    .filter((d) => JSON.stringify(d.from ?? null) !== JSON.stringify(d.to ?? null))
    .slice(0, 12);
}
const show = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v).slice(0, 300) : String(v).slice(0, 600));

export function ChangeLogPage() {
  const t = useT();
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("all");
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/powerbi/changelog?limit=600", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setLogs(json.logs || []);
      try {
        localStorage.setItem("powerbi_read_log_ids", JSON.stringify((json.logs || []).map((l: Log) => l.id)));
      } catch {}
    } catch {
      toast.error("Couldn't load the activity log");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    fetch("/api/powerbi/changelog?limit=600", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive) return;
        setLogs(j?.logs || []);
        setLoading(false);
      })
      .catch(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: logs.length };
    for (const l of logs) {
      const a = areaOf(l.entity_table).id;
      c[a] = (c[a] || 0) + 1;
    }
    return c;
  }, [logs]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter((l) => {
      if (area !== "all" && areaOf(l.entity_table).id !== area) return false;
      if (!q) return true;
      return `${l.summary} ${l.changed_by || ""} ${l.entity_id}`.toLowerCase().includes(q);
    });
  }, [logs, area, query]);

  const days = useMemo(() => {
    const out: { day: string; items: Log[] }[] = [];
    for (const l of shown) {
      const d = dayLabel(l.changed_at);
      if (!out.length || out[out.length - 1].day !== d) out.push({ day: d, items: [] });
      out[out.length - 1].items.push(l);
    }
    return out;
  }, [shown]);

  async function restore(l: Log) {
    const what = l.action === "delete" ? "bring it back" : l.action === "create" ? "remove it again" : "put the previous version back";
    const ok = await confirmDialog({
      title: "Restore this change?",
      body: `“${l.summary}”\n\nThis will ${what}. The restore itself is recorded here too.`,
      confirmLabel: "Restore",
    });
    if (!ok) return;
    setBusy(l.id);
    try {
      const res = await fetch("/api/powerbi/changelog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore", id: l.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "The server didn't accept it");
      toast("Restored", { body: l.summary });
      await load();
    } catch (e) {
      toast.error("Couldn't restore", { body: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="h-full overflow-y-auto pr-1">
      <div className="mx-auto max-w-5xl space-y-4 pb-12">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[22px] font-semibold tracking-tight text-slate-900">{t("Activity log")}</h2>
            <p className="text-[13.5px] text-slate-500">Every change the team made, with who and when. Restore puts a change back.</p>
          </div>
          <button type="button" onClick={() => void load()} className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 hover:bg-slate-50">
            <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin text-blue-600")} /> {t("Reload")}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200/80 bg-white p-2.5">
          <div className="flex max-w-full flex-wrap gap-1">
            {AREAS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setArea(a.id)}
                className={clsx(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium transition",
                  area === a.id ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100"
                )}
              >
                <a.icon className="h-3.5 w-3.5" />
                {a.label}
                <span className="tabular-nums text-[11px] opacity-60">{counts[a.id] || 0}</span>
              </button>
            ))}
          </div>
          <label className="relative ml-auto flex min-w-[200px] flex-1 items-center sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search what changed or who…"
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-2 text-[13px] outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
          </label>
        </div>

        {loading && !logs.length ? (
          <div className="grid place-items-center py-16 text-slate-400">
            <Loader2 className="mb-2 h-7 w-7 animate-spin text-blue-600" />
          </div>
        ) : shown.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white py-14 text-center text-[13px] text-slate-400">Nothing here yet.</div>
        ) : (
          <div className="stagger space-y-5" data-entering="">
            {days.map((d) => (
              <section key={d.day}>
                <h3 className="mb-2 text-[11.5px] font-medium uppercase tracking-[0.06em] text-slate-400">{d.day}</h3>
                <ol className="overflow-hidden rounded-xl border border-slate-200/80 bg-white">
                  {d.items.map((l) => {
                    const a = areaOf(l.entity_table);
                    const changes = diff(l.before, l.after);
                    const isOpen = open === l.id;
                    return (
                      <li key={l.id} className="border-b border-slate-100 last:border-0">
                        <div className="flex items-start gap-3 px-4 py-3">
                          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
                            <a.icon className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[13.5px] font-medium leading-snug text-slate-900">{l.summary}</p>
                            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-slate-500">
                              <span className={clsx("rounded px-1.5 py-px text-[11px] font-medium", ACTION_TONE[l.action] || "bg-slate-100 text-slate-600")}>{l.action}</span>
                              <span>{a.label}</span>
                              {l.changed_by && <span>· {l.changed_by}</span>}
                              <span>· {new Date(l.changed_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                              {l.is_restored && <span className="rounded bg-violet-50 px-1.5 py-px text-[11px] font-medium text-violet-700">restored</span>}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            {changes.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setOpen(isOpen ? null : l.id)}
                                className="flex h-8 items-center gap-1 rounded-lg px-2 text-[12.5px] font-medium text-slate-600 hover:bg-slate-100"
                                aria-expanded={isOpen}
                              >
                                What changed <ChevronDown className={clsx("h-3.5 w-3.5 transition-transform", isOpen && "rotate-180")} />
                              </button>
                            )}
                            {l.restorable && l.canRestore && (
                              <button
                                type="button"
                                disabled={busy === l.id}
                                onClick={() => void restore(l)}
                                className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[12.5px] font-medium text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
                              >
                                {busy === l.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                                Restore
                              </button>
                            )}
                          </div>
                        </div>
                        {isOpen && (
                          <div className="pop-in mx-4 mb-3 overflow-hidden rounded-lg border border-slate-100">
                            <table className="w-full text-[12.5px]">
                              <thead className="bg-slate-50 text-[11.5px] text-slate-500">
                                <tr>
                                  <th className="px-3 py-1.5 text-left font-medium">Field</th>
                                  <th className="px-3 py-1.5 text-left font-medium">Before</th>
                                  <th className="px-3 py-1.5 text-left font-medium">After</th>
                                </tr>
                              </thead>
                              <tbody>
                                {changes.map((c) => (
                                  <tr key={c.key} className="border-t border-slate-100 align-top">
                                    <td className="px-3 py-1.5 font-mono text-[11.5px] text-slate-500">{c.key}</td>
                                    <td className="whitespace-pre-wrap break-words px-3 py-1.5 text-rose-700/90">{show(c.from)}</td>
                                    <td className="whitespace-pre-wrap break-words px-3 py-1.5 text-emerald-700">{show(c.to)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
