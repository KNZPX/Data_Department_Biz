"use client";

import { clsx } from "clsx";
import { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  Clock,
  ExternalLink,
  FileCode,
  History,
  List,
  Loader2,
  Mail,
  Table,
  Ticket,
  User,
  X,
} from "lucide-react";
import { Button, Modal, Panel } from "@/components/ui";
import type { PowerBiChangeLogEntry } from "@/lib/powerbiSync";
import type { PowerBiItem } from "@/lib/powerbiTypes";

export function DashboardLogModal({
  item,
  onClose,
}: {
  item: PowerBiItem;
  onClose: () => void;
}) {
  const [logs, setLogs] = useState<PowerBiChangeLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    let active = true;
    fetch(`/api/powerbi/changelog?itemId=${encodeURIComponent(item.id)}&limit=50`)
      .then((res) => res.json())
      .then((json: { logs?: PowerBiChangeLogEntry[]; data?: PowerBiChangeLogEntry[] }) => {
        if (active) {
          const loaded = json.logs || json.data || [];
          setLogs(loaded);
        }
      })
      .catch((err) => {
        console.error("Failed to load logs for item:", err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [item.id]);

  const [viewMode, setViewMode] = useState<"table" | "timeline">("table");

  const publishDate = item.lastPublish || item.lastModified;
  const publishDateObj = publishDate ? new Date(publishDate) : null;
  const isValidPublishDate = publishDateObj && !isNaN(publishDateObj.getTime());
  const publishDateStr = isValidPublishDate
    ? publishDateObj.toLocaleDateString("th-TH", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

  type VersionEntry = {
    id: string;
    versionLabel: string;
    versionNumber: number;
    date: Date;
    dateStr: string;
    author: string;
    activity: string;
    summary: string;
    isPublish: boolean;
    isInitial: boolean;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
  };

  const allVersions = useMemo<VersionEntry[]>(() => {
    const list: VersionEntry[] = [];

    if (logs.length === 0) {
      if (item.lastPublish || item.lastModified) {
        const d = new Date(item.lastPublish || item.lastModified || "");
        list.push({
          id: "v1-baseline",
          versionLabel: "v1",
          versionNumber: 1,
          date: d,
          dateStr: publishDateStr,
          author: item.responsibleUser || "Unspecified",
          activity: "Initial Publish",
          summary: `Baseline version (Active version on Power BI Service)`,
          isPublish: true,
          isInitial: true,
        });
      }
      return list;
    }

    const sorted = [...logs].sort(
      (a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime()
    );

    const firstLog = sorted[0];
    let vCounter = 1;

    if (firstLog && firstLog.action === "update" && firstLog.before) {
      const b = firstLog.before as Record<string, unknown>;
      const initialDateRaw = (b.last_publish || b.first_seen_at || b.last_modified) as string | undefined;
      const initialDate = initialDateRaw ? new Date(initialDateRaw) : new Date(firstLog.changed_at);
      const initialDateStr = !isNaN(initialDate.getTime())
        ? initialDate.toLocaleDateString("en-US", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "-";

      const author = (b.responsible_user || b.responsible_email) as string | undefined;

      list.push({
        id: `v${vCounter}-initial`,
        versionLabel: `v${vCounter}`,
        versionNumber: vCounter,
        date: initialDate,
        dateStr: initialDateStr,
        author: author || item.responsibleUser || "Unspecified",
        activity: "Initial Publish",
        summary: `Baseline version (Recorded from initial publish on Power BI Service)`,
        isPublish: true,
        isInitial: true,
      });
      vCounter++;
    }

    for (const log of sorted) {
      const isCreate = log.action === "create";
      const isPublish =
        log.summary.toLowerCase().includes("publish") ||
        isCreate;
      const author =
        log.changed_by ||
        (log.after && typeof (log.after as Record<string, unknown>).responsible_user === "string"
          ? ((log.after as Record<string, unknown>).responsible_user as string)
          : null) ||
        item.responsibleUser ||
        "Unspecified";
      const date = new Date(log.changed_at);
      const dateStr = !isNaN(date.getTime())
        ? date.toLocaleDateString("en-US", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "-";

      list.push({
        id: log.id,
        versionLabel: `v${vCounter}`,
        versionNumber: vCounter,
        date,
        dateStr,
        author,
        activity: isCreate ? "Initial Publish" : isPublish ? "Update Version" : "Edit Details",
        summary: log.summary,
        isPublish,
        isInitial: isCreate,
        before: log.before,
        after: log.after,
      });
      vCounter++;
    }

    return list;
  }, [logs, item, publishDateStr]);

  const totalPublishes = allVersions.length > 0 ? allVersions.length : (item.lastPublish ? 1 : 0);
  const firstPublishDateStr = allVersions.length > 0 ? allVersions[0].dateStr : publishDateStr;
  const latestPublishDateStr = allVersions.length > 0 ? allVersions[allVersions.length - 1].dateStr : publishDateStr;

  return (
    <Modal className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-900/50 p-3 backdrop-blur-xs sm:p-6 animate-in fade-in duration-150">
      <Panel className="my-auto w-full max-w-3xl rounded-3xl bg-white p-5 shadow-2xl border border-slate-200/90 sm:p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-700 border border-amber-200/80 shadow-xs">
              <History className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                {item.reportCode ? (
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 font-mono text-xs font-bold text-blue-700 border border-blue-200/80">
                    {item.reportCode}
                  </span>
                ) : null}
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                  {item.workspaceName}
                </span>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 uppercase">
                  {item.kind}
                </span>
              </div>
              <h2 className="mt-1 text-base font-bold text-slate-900 break-words sm:text-lg">
                {item.reportTitle}
              </h2>
              {item.description ? (
                <p className="mt-0.5 text-xs text-slate-500 italic line-clamp-2">
                  {item.description}
                </p>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Item Metadata Quick Card */}
        <div className="mt-4 grid grid-cols-1 gap-2.5 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3.5 text-xs sm:grid-cols-2">
          <div className="flex items-center gap-2 text-slate-700">
            <User className="h-4 w-4 shrink-0 text-slate-400" />
            <div className="min-w-0 truncate">
              <span className="text-slate-400">Responsible Owner: </span>
              <span className="font-semibold text-slate-800">
                {item.responsibleUser || "Unassigned"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-slate-700">
            <Mail className="h-4 w-4 shrink-0 text-slate-400" />
            <div className="min-w-0 truncate font-mono text-[11px]">
              <span className="text-slate-400 font-sans">Email: </span>
              <span className="text-slate-700">{item.responsibleEmail || "-"}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-slate-700">
            <Calendar className="h-4 w-4 shrink-0 text-slate-400" />
            <div className="min-w-0 truncate">
              <span className="text-slate-400">Last Published: </span>
              <span className="font-semibold text-slate-800">
                {publishDateStr}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-slate-700">
            <FileCode className="h-4 w-4 shrink-0 text-slate-400" />
            <div className="min-w-0 truncate font-mono text-[11px] text-slate-500" title={item.id}>
              <span className="text-slate-400 font-sans">Report ID: </span>
              <span>{item.id}</span>
            </div>
          </div>
        </div>

        {/* Quick KPI Stats Summary */}
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <div className="rounded-2xl border border-[#002D72]/20 bg-[#002D72]/5 p-2.5 text-center">
            <div className="text-[10px] font-bold text-[#002D72] uppercase">Total Publishes</div>
            <div className="mt-0.5 text-base font-black text-[#002D72]">{totalPublishes} times</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2.5 text-center">
            <div className="text-[10px] font-bold text-slate-500 uppercase">First Published</div>
            <div className="mt-0.5 text-[11px] font-bold text-slate-800 truncate">{firstPublishDateStr}</div>
          </div>
          <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/40 p-2.5 text-center">
            <div className="text-[10px] font-bold text-emerald-600 uppercase">Latest Version</div>
            <div className="mt-0.5 text-[11px] font-bold text-emerald-900 truncate">{latestPublishDateStr}</div>
          </div>
          <div className="rounded-2xl border border-[#B45309]/20 bg-[#B45309]/5 p-2.5 text-center">
            <div className="text-[10px] font-bold text-[#B45309] uppercase">Audit Database</div>
            <div className="mt-0.5 text-[11px] font-bold text-[#B45309]">Biz-Analytic Cloud</div>
          </div>
        </div>

        {/* Change Log History Timeline & Table */}
        <div className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-slate-500" />
              <span>Publish Version History</span>
            </h3>

            <div className="flex items-center gap-1 rounded-full bg-slate-100 p-0.5 border border-slate-200/80">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={clsx(
                  "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold transition",
                  viewMode === "table"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-900"
                )}
              >
                <Table className="h-3 w-3" />
                <span>Table</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("timeline")}
                className={clsx(
                  "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold transition",
                  viewMode === "timeline"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-900"
                )}
              >
                <List className="h-3 w-3" />
                <span>Timeline</span>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="grid place-items-center py-8 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin mb-1 text-slate-500" />
              <span className="text-xs">Loading version changes...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50/40 p-5 text-xs text-slate-600 space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <span className="inline-flex items-center justify-center rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700 border border-purple-200">
                  CURRENT VERSION
                </span>
                <span>Active Production Version</span>
              </div>
              <div className="grid grid-cols-1 gap-1 text-[11px] sm:grid-cols-2 text-slate-600 bg-white/70 p-3 rounded-2xl border border-slate-200/60">
                <div>
                  <span className="text-slate-400">Last Published: </span>
                  <span className="font-semibold text-slate-900">{publishDateStr}</span>
                </div>
                <div>
                  <span className="text-slate-400">By: </span>
                  <span className="font-semibold text-slate-900">{item.responsibleUser || "Unassigned"}</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400">
                Audit logs are recorded automatically when new report publishes are detected.
              </p>
            </div>
          ) : viewMode === "table" ? (
            <div className="mt-2 overflow-x-auto rounded-2xl border border-slate-200/90 shadow-2xs">
              <table className="table table-zebra table-sm w-full text-left text-xs">
                <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 whitespace-nowrap">Version</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Publish Timestamp</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Published By</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Activity</th>
                    <th className="py-2.5 px-3">Summary of Changes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {allVersions.map((v) => {
                    const isLatest = v.versionNumber === allVersions.length;

                    return (
                      <tr key={v.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-2.5 px-3 whitespace-nowrap font-mono">
                          <span
                            className={clsx(
                              "rounded-full px-2 py-0.5 text-[10px] font-bold border",
                              isLatest
                                ? "bg-purple-50 text-purple-700 border-purple-200"
                                : "bg-blue-50 text-blue-700 border-blue-200"
                            )}
                          >
                            {v.versionLabel}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap font-medium text-slate-900 font-mono text-[11px]">
                          {v.dateStr}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap font-semibold text-slate-800">
                          <div className="flex items-center gap-1.5">
                            <User className="h-3 w-3 text-slate-400" />
                            <span>{v.author}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={clsx(
                              "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                              v.isInitial
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-purple-100/70 text-purple-800"
                            )}
                          >
                            {v.activity}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 text-[11px] leading-relaxed">
                          {v.summary}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-2 max-h-64 overflow-y-auto space-y-2.5 pr-1">
              {[...allVersions].reverse().map((v) => {
                const isLatest = v.versionNumber === allVersions.length;

                return (
                  <div
                    key={v.id}
                    className="relative flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-2xs text-xs transition hover:border-slate-300"
                  >
                    <div
                      className={clsx(
                        "grid h-7 w-auto min-w-[50px] px-1.5 shrink-0 place-items-center rounded-full text-[10px] font-bold uppercase border font-mono",
                        isLatest
                          ? "bg-purple-50 text-purple-700 border-purple-200"
                          : "bg-blue-50 text-blue-700 border-blue-200"
                      )}
                    >
                      {v.versionLabel}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-900 leading-snug">
                            {v.summary}
                          </span>
                          {isLatest ? (
                            <span className="rounded-full bg-purple-50 px-1.5 py-0.2 text-[9px] font-bold text-purple-700 border border-purple-200">
                              CURRENT
                            </span>
                          ) : null}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono shrink-0">
                          {v.dateStr}
                        </span>
                      </div>

                      {v.author ? (
                        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                          <User className="h-3 w-3 text-slate-400" />
                          <span>Published / Action By:</span>
                          <span className="font-semibold text-slate-700">{v.author}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3.5">
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>

          {item.webUrl ? (
            <a
              href={item.webUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-[#B45309] text-white px-4 py-2 text-xs font-bold hover:bg-[#92400E] transition shadow-xs"
            >
              <Ticket className="h-4 w-4 text-[#FEF3C7]" />
              <span>Open on Power BI Service</span>
              <ExternalLink className="h-3.5 w-3.5 opacity-90" />
            </a>
          ) : null}
        </div>
      </Panel>
    </Modal>
  );
}
