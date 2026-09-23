"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  Clock,
  ExternalLink,
  Filter,
  History,
  Loader2,
  RefreshCw,
  Search,
  User,
} from "lucide-react";
import { clsx } from "clsx";
import { Button, EmptyState, Input, Panel, Select, StatCard } from "@/components/ui";
import type { PowerBiChangeLogEntry } from "@/lib/powerbiSync";

export function ChangeLogPage() {
  const [logs, setLogs] = useState<PowerBiChangeLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<"all" | "publish" | "update" | "create">("all");

  useEffect(() => {
    void fetchLogs();
  }, []);

  async function fetchLogs() {
    setLoading(true);
    try {
      const res = await fetch("/api/powerbi/changelog?limit=300", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch logs");
      const json = await res.json();
      setLogs(json.logs || []);

      // Mark all as read
      const ids = (json.logs || []).map((l: { id: string }) => l.id);
      localStorage.setItem("powerbi_read_log_ids", JSON.stringify(ids));
    } catch (err) {
      console.error("Error fetching logs:", err);
    } finally {
      setLoading(false);
    }
  }

  const filteredLogs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter((log) => {
      const isPublish = log.summary.toLowerCase().includes("publish");

      if (actionFilter === "publish" && !isPublish) return false;
      if (actionFilter === "update" && (isPublish || log.action !== "update")) return false;
      if (actionFilter === "create" && log.action !== "create") return false;

      if (!q) return true;
      return (
        log.summary.toLowerCase().includes(q) ||
        (log.changed_by && log.changed_by.toLowerCase().includes(q)) ||
        log.entity_id.toLowerCase().includes(q)
      );
    });
  }, [logs, query, actionFilter]);

  const publishCount = useMemo(
    () =>
      logs.filter((l) => l.summary.toLowerCase().includes("publish")).length,
    [logs]
  );

  return (
    <div className="h-full overflow-y-auto pr-1 space-y-6 pb-12">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Audit Events" value={logs.length} icon={History} tone="blue" />
        <StatCard label="New Version Publishes" value={publishCount} icon={Clock} tone="gold" />
        <StatCard label="Metadata Updates" value={logs.length - publishCount} icon={Filter} tone="default" />
        <StatCard label="Displayed Logs" value={filteredLogs.length} icon={Search} tone="emerald" />
      </div>

      {/* Filter Bar */}
      <Panel className="p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-full bg-slate-100 p-1 border border-slate-200">
            <button
              type="button"
              onClick={() => setActionFilter("all")}
              className={clsx(
                "rounded-full px-4 py-1.5 text-xs font-bold transition",
                actionFilter === "all" ? "bg-[#002D72] text-white shadow-xs" : "text-slate-600 hover:text-[#002D72]"
              )}
            >
              All Events ({logs.length})
            </button>
            <button
              type="button"
              onClick={() => setActionFilter("publish")}
              className={clsx(
                "rounded-full px-4 py-1.5 text-xs font-bold transition",
                actionFilter === "publish" ? "bg-[#D97706] text-white shadow-xs" : "text-slate-600 hover:text-[#D97706]"
              )}
            >
              Publishes Only ({publishCount})
            </button>
            <button
              type="button"
              onClick={() => setActionFilter("update")}
              className={clsx(
                "rounded-full px-4 py-1.5 text-xs font-bold transition",
                actionFilter === "update" ? "bg-[#B45309] text-white shadow-xs" : "text-slate-600 hover:text-[#B45309]"
              )}
            >
              Updates Only ({logs.length - publishCount})
            </button>
          </div>

          <Button type="button" variant="secondary" dense onClick={fetchLogs}>
            <RefreshCw className={clsx("h-3.5 w-3.5", loading && "animate-spin text-[#B45309]")} />
            <span>Refresh Logs</span>
          </Button>
        </div>

        <div>
          <Input
            icon={Search}
            clearable
            onClear={() => setQuery("")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search report title, code, or publisher name..."
          />
        </div>
      </Panel>

      {/* Timeline Stream */}
      {loading ? (
        <div className="grid place-items-center py-16 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-[#B45309] mb-2" />
          <p className="text-sm font-medium">Loading change log stream...</p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <EmptyState>
          <p className="text-base font-semibold text-slate-800">No change log events found</p>
          <p className="mt-1 text-xs text-slate-500">
            Audit logs are recorded automatically when items sync with Power BI REST API
          </p>
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {filteredLogs.map((log) => {
            const isPublish = log.summary.toLowerCase().includes("publish");
            const date = new Date(log.changed_at);
            const dateStr = !isNaN(date.getTime())
              ? date.toLocaleString("en-US", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "-";

            return (
              <Panel key={log.id} className="p-4 sm:p-5 transition hover:border-[#B45309]/30">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-start gap-3 min-w-0">
                    <span
                      className={clsx(
                        "rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase border shrink-0",
                        isPublish
                          ? "bg-[#D97706]/15 text-[#B45309] border-[#D97706]/25"
                          : "bg-[#B45309]/10 text-[#B45309] border-[#B45309]/20"
                      )}
                    >
                      {isPublish ? "PUBLISH" : "UPDATE"}
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 leading-snug">{log.summary}</h4>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                        {log.changed_by ? (
                          <span className="flex items-center gap-1 font-medium text-slate-700">
                            <User className="h-3.5 w-3.5 text-slate-400" />
                            <span>By: {log.changed_by}</span>
                          </span>
                        ) : null}
                        <span className="flex items-center gap-1 font-mono text-[11px]">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          <span>{dateStr}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}
