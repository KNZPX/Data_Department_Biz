"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  Calendar,
  Check,
  Clock,
  Download,
  ExternalLink,
  Folder,
  FolderOpen,
  History,
  Inbox,
  LayoutGrid,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  Sparkles,
  Ticket,
  User,
  X,
} from "lucide-react";
import { clsx } from "clsx";
import { Button, EmptyState, Input, Modal, Panel } from "@/components/ui";
import { DashboardLogModal } from "@/components/powerbi/DashboardLogModal";
import { TicketLinkButton } from "@/components/powerbi/TicketLinkButton";
import { usePowerBiItems } from "@/lib/usePowerBiItems";
import type { PowerBiItem } from "@/lib/powerbiTypes";
import {
  groupByCodeSeries,
  groupBySiteGroup,
  groupByWorkspace,
  padCodeNumber,
  SITE_GROUP_KEYS,
  siteGroupKeyForWorkspace,
  type CodeSeriesGroup,
  type SiteGroupKey,
} from "@/lib/reportCodeSeries";

export function ReportsPage() {
  const [kind, setKind] = useState<"report" | "dashboard">("report");
  const endpoint = kind === "report" ? "/api/powerbi/reports" : "/api/powerbi/dashboards";
  const { state, refresh } = usePowerBiItems(endpoint);

  const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(null);
  const [workspaceSearch, setWorkspaceSearch] = useState("");
  const [siteFilter, setSiteFilter] = useState<string>("All");
  const [itemSearch, setItemSearch] = useState("");
  const [selectedLogItem, setSelectedLogItem] = useState<PowerBiItem | null>(null);
  const [exporting, setExporting] = useState(false);

  const items = useMemo(() => (state.status === "ready" ? state.response.data : []), [state]);

  // Extract all distinct workspaces with counts
  const workspaceMap = useMemo(() => {
    const map = new Map<string, PowerBiItem[]>();
    for (const item of items) {
      const ws = item.workspaceName || "Default Workspace";
      if (!map.has(ws)) map.set(ws, []);
      map.get(ws)!.push(item);
    }
    return map;
  }, [items]);

  const allWorkspaceNames = useMemo(
    () => Array.from(workspaceMap.keys()).sort((a, b) => a.localeCompare(b)),
    [workspaceMap]
  );

  // Filter workspaces in left pane
  const filteredWorkspaces = useMemo(() => {
    const q = workspaceSearch.trim().toLowerCase();
    return allWorkspaceNames.filter((ws) => {
      const matchQuery = !q || ws.toLowerCase().includes(q);
      if (!matchQuery) return false;
      if (siteFilter === "All") return true;
      const key = siteGroupKeyForWorkspace(ws);
      if (siteFilter === "Other") return key === "Other";
      return key === siteFilter || ws.toUpperCase().includes(siteFilter);
    });
  }, [allWorkspaceNames, workspaceSearch, siteFilter]);

  // Selected workspace items filtered by query
  const workspaceItems = useMemo(() => {
    if (!selectedWorkspace) return [];
    const list = workspaceMap.get(selectedWorkspace) || [];
    const q = itemSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (i) =>
        i.reportTitle.toLowerCase().includes(q) ||
        (i.reportCode && i.reportCode.toLowerCase().includes(q)) ||
        (i.responsibleUser && i.responsibleUser.toLowerCase().includes(q))
    );
  }, [workspaceMap, selectedWorkspace, itemSearch]);

  async function handleExport() {
    if (!selectedWorkspace || workspaceItems.length === 0) return;
    setExporting(true);
    try {
      const res = await fetch("/api/powerbi/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, items: workspaceItems }),
      });
      if (!res.ok) throw new Error("Failed to export");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const sanitized = selectedWorkspace.replace(/[^a-zA-Z0-9_-]/g, "_");
      a.download = `powerbi-${sanitized}-${kind}s-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto pr-1 space-y-4 pb-12">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-3xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-2">
          {/* Entity Kind Toggle */}
          <div className="inline-flex rounded-full bg-slate-100 p-1 border border-slate-200">
            <button
              type="button"
              onClick={() => setKind("report")}
              className={clsx(
                "rounded-full px-4 py-1.5 text-xs font-bold transition",
                kind === "report" ? "bg-[#B45309] text-white shadow-xs" : "text-slate-600 hover:text-[#B45309]"
              )}
            >
              Reports ({items.length})
            </button>
            <button
              type="button"
              onClick={() => setKind("dashboard")}
              className={clsx(
                "rounded-full px-4 py-1.5 text-xs font-bold transition",
                kind === "dashboard" ? "bg-[#B45309] text-white shadow-xs" : "text-slate-600 hover:text-[#B45309]"
              )}
            >
              Dashboards
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            dense
            onClick={() => refresh()}
            disabled={state.status === "loading"}
          >
            <RefreshCw className={clsx("h-3.5 w-3.5", state.status === "loading" && "animate-spin text-[#B45309]")} />
            <span>Sync Catalog</span>
          </Button>

          {selectedWorkspace && (
            <Button
              type="button"
              variant="secondary"
              dense
              onClick={handleExport}
              disabled={exporting || workspaceItems.length === 0}
            >
              <Download className="h-3.5 w-3.5 text-emerald-600" />
              <span>Export Workspace Excel</span>
            </Button>
          )}
        </div>
      </div>

      {/* Main Mail Inbox 2-Pane Container */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 min-h-[680px]">
        {/* LEFT PANE: Workspace Mailbox Folders (4 Cols) */}
        <div className="md:col-span-4 lg:col-span-4 flex flex-col rounded-2xl border border-slate-200/70 bg-white p-4 minimals-card">
          {/* Folder Header */}
          <div className="pb-3 border-b border-slate-100 space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Folder className="h-4 w-4 text-[#B45309]" />
                <span>Workspaces ({allWorkspaceNames.length})</span>
              </h2>
              <span className="text-[11px] text-slate-400 font-mono">
                {items.length} items
              </span>
            </div>

            {/* Search Workspace Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={workspaceSearch}
                onChange={(e) => setWorkspaceSearch(e.target.value)}
                placeholder="Filter workspaces..."
                className="w-full rounded-full border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#B45309] focus:ring-1 focus:ring-[#B45309]/20 outline-none"
              />
              {workspaceSearch && (
                <button
                  type="button"
                  onClick={() => setWorkspaceSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Quick Site Filter Chips */}
            <div className="flex flex-wrap items-center gap-1 pt-0.5">
              {(["All", "PKT", "BPK", "BSI", "DBK", "Other"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setSiteFilter(k)}
                  className={clsx(
                    "rounded-full px-2.5 py-0.5 text-[10px] font-bold transition border",
                    siteFilter === k
                      ? "bg-[#B45309] text-white border-[#B45309]"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  )}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>

          {/* Workspace Folders List */}
          <div className="flex-1 overflow-y-auto mt-2 space-y-1 pr-1 max-h-[560px]">
            {filteredWorkspaces.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No matching workspace found
              </div>
            ) : (
              filteredWorkspaces.map((ws) => {
                const count = (workspaceMap.get(ws) || []).length;
                const isSelected = selectedWorkspace === ws;
                return (
                  <button
                    key={ws}
                    type="button"
                    onClick={() => setSelectedWorkspace(ws)}
                    className={clsx(
                      "w-full flex items-center justify-between gap-2 rounded-2xl px-3 py-2.5 text-left text-xs transition duration-150 active:scale-[0.99]",
                      isSelected
                        ? "bg-[#B45309] text-white font-bold shadow-xs"
                        : "text-slate-700 hover:bg-slate-100 hover:text-[#B45309]"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isSelected ? (
                        <FolderOpen className="h-4 w-4 shrink-0 text-white" />
                      ) : (
                        <Folder className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-[#B45309]" />
                      )}
                      <span className="truncate">{ws}</span>
                    </div>
                    <span
                      className={clsx(
                        "rounded-full px-2 py-0.2 text-[10px] font-mono font-bold shrink-0",
                        isSelected
                          ? "bg-[#D97706] text-white"
                          : "bg-slate-100 text-slate-500"
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT PANE: Mail Inbox Reports List (8 Cols) */}
        <div className="md:col-span-8 lg:col-span-8 flex flex-col rounded-2xl border border-slate-200/70 bg-white p-5 minimals-card">
          {!selectedWorkspace ? (
            /* Empty State: Prompt User to Select Workspace */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center my-auto min-h-[400px]">
              <div className="grid h-16 w-16 place-items-center rounded-3xl bg-[#B45309]/10 border border-[#B45309]/20 text-[#B45309] mb-4 shadow-sm">
                <Inbox className="h-8 w-8" />
              </div>
              <h3 className="text-base font-bold text-slate-800">
                Select a Workspace to view reports
              </h3>
              <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-slate-400">
                Please select an analytics department or workspace folder from the left pane to display its reports and dashboards in inbox view.
              </p>
            </div>
          ) : (
            /* Selected Workspace Content */
            <div className="flex flex-col h-full space-y-4">
              {/* Inbox Workspace Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-[#B45309] truncate max-w-md">
                      {selectedWorkspace}
                    </h3>
                    <span className="rounded-full bg-[#B45309]/10 px-2 py-0.5 text-[10px] font-bold text-[#B45309] border border-[#B45309]/20">
                      {workspaceItems.length} {kind === "report" ? "reports" : "dashboards"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Viewing certified analytics inside workspace
                  </p>
                </div>

                {/* Filter within workspace */}
                <div className="w-full sm:w-64">
                  <Input
                    icon={Search}
                    clearable
                    onClear={() => setItemSearch("")}
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    placeholder="Search in this workspace..."
                    dense
                  />
                </div>
              </div>

              {/* Mail Thread Style Report Items */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                {workspaceItems.length === 0 ? (
                  <div className="py-16 text-center text-xs text-slate-400">
                    No reports match your search in this workspace.
                  </div>
                ) : (
                  workspaceItems.map((item) => {
                    const pubDate = item.lastPublish || item.lastModified;
                    const dateFormatted = pubDate
                      ? new Date(pubDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "-";

                    return (
                      <div
                        key={item.id}
                        className="py-3 px-2 flex items-start sm:items-center justify-between gap-3 group hover:bg-[#B45309]/5 rounded-2xl transition duration-150"
                      >
                        {/* Left: Code badge & Subject/Title */}
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {item.reportCode ? (
                              <span className="rounded-full bg-[#B45309]/10 px-2.5 py-0.5 font-mono text-[10px] font-bold text-[#B45309] border border-[#B45309]/20">
                                {item.reportCode}
                              </span>
                            ) : null}
                            <span className="text-xs sm:text-sm font-semibold text-slate-900 group-hover:text-[#B45309] transition">
                              {item.reportTitle}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                            {item.responsibleUser ? (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3 text-slate-400" />
                                <span>{item.responsibleUser}</span>
                              </span>
                            ) : null}
                            {pubDate ? (
                              <span className="flex items-center gap-1 font-mono text-[10px] text-slate-400">
                                <Calendar className="h-3 w-3 text-slate-400" />
                                <span>{dateFormatted}</span>
                              </span>
                            ) : null}
                          </div>
                        </div>

                        {/* Right: Quick Launch & Version History Actions */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => setSelectedLogItem(item)}
                            title="View Publish Version History"
                            className="grid h-8 w-8 place-items-center rounded-xl text-slate-400 hover:bg-slate-200/60 hover:text-slate-800 transition"
                          >
                            <History className="h-4 w-4" />
                          </button>

                          <TicketLinkButton url={item.webUrl} dense />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Item Publish Version Log Modal */}
      {selectedLogItem ? (
        <DashboardLogModal item={selectedLogItem} onClose={() => setSelectedLogItem(null)} />
      ) : null}
    </div>
  );
}
