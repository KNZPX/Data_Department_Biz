"use client";

import { useMemo, useState, useEffect } from "react";
import {
  AlertCircle,
  BarChart3,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
  Eye,
  Filter,
  Folder,
  FolderOpen,
  FolderTree,
  History,
  Inbox,
  LayoutGrid,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  Settings2,
  SlidersHorizontal,
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
import { siteGroupKeyForWorkspace } from "@/lib/reportCodeSeries";

export function ReportsPage() {
  const { state, refresh } = usePowerBiItems("/api/powerbi/reports");

  const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(null);
  const [selectedSiteFolder, setSelectedSiteFolder] = useState<string | null>(null);
  const [workspaceSearch, setWorkspaceSearch] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [selectedLogItem, setSelectedLogItem] = useState<PowerBiItem | null>(null);
  const [exporting, setExporting] = useState(false);

  // Manage Workspaces Modal & Enabled Workspaces
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [enabledWorkspaces, setEnabledWorkspaces] = useState<Set<string>>(new Set());
  const [hasLoadedSavedWs, setHasLoadedSavedWs] = useState(false);

  // Collapsible Folders in Tree Diagram
  const [expandedSites, setExpandedSites] = useState<Record<string, boolean>>({
    BPK: true,
    BSI: true,
    PKT: true,
    DBK: true,
    Other: true,
  });

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

  // Load / Initialize enabled workspaces
  useEffect(() => {
    if (allWorkspaceNames.length === 0) return;
    const saved = localStorage.getItem("user_enabled_workspaces");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setEnabledWorkspaces(new Set(parsed));
          setHasLoadedSavedWs(true);
          return;
        }
      } catch {}
    }
    // Default to all enabled
    setEnabledWorkspaces(new Set(allWorkspaceNames));
    setHasLoadedSavedWs(true);
  }, [allWorkspaceNames]);

  // Save enabled workspaces to localStorage
  function toggleWorkspaceEnabled(wsName: string) {
    setEnabledWorkspaces((prev) => {
      const next = new Set(prev);
      if (next.has(wsName)) next.delete(wsName);
      else next.add(wsName);
      localStorage.setItem("user_enabled_workspaces", JSON.stringify(Array.from(next)));
      return next;
    });
  }

  function handleSelectAllWorkspaces() {
    setEnabledWorkspaces(new Set(allWorkspaceNames));
    localStorage.setItem("user_enabled_workspaces", JSON.stringify(allWorkspaceNames));
  }

  function handleDeselectAllWorkspaces() {
    setEnabledWorkspaces(new Set());
    localStorage.setItem("user_enabled_workspaces", JSON.stringify([]));
  }

  // Group Workspaces into Folder Sub-diagram (Tree Hierarchy by Site Prefix)
  const folderTree = useMemo(() => {
    const siteGroups: Record<
      string,
      {
        site: string;
        label: string;
        totalReports: number;
        workspaces: Array<{ fullName: string; subName: string; count: number; enabled: boolean }>;
      }
    > = {
      BPK: { site: "BPK", label: "BPK · Bangpakok 9 Hospital", totalReports: 0, workspaces: [] },
      BSI: { site: "BSI", label: "BSI · Bangpakok Samutprakan", totalReports: 0, workspaces: [] },
      PKT: { site: "PKT", label: "PKT · Phuket Hospital Network", totalReports: 0, workspaces: [] },
      DBK: { site: "DBK", label: "DBK · Dhonburi & Network", totalReports: 0, workspaces: [] },
      Other: { site: "Other", label: "Enterprise & Shared Analytics", totalReports: 0, workspaces: [] },
    };

    for (const ws of allWorkspaceNames) {
      const list = workspaceMap.get(ws) || [];
      const siteKey = siteGroupKeyForWorkspace(ws);
      const targetGroup = siteGroups[siteKey] || siteGroups.Other;
      const isEnabled = enabledWorkspaces.has(ws);

      if (isEnabled) {
        targetGroup.totalReports += list.length;
      }

      // Format clean sub name (e.g. "BPK | 01 Strategy (STG)" -> "01 Strategy (STG)")
      let subName = ws;
      if (ws.includes("|")) {
        const parts = ws.split("|");
        subName = parts.slice(1).join("|").trim();
      } else if (ws.startsWith(siteKey)) {
        subName = ws.slice(siteKey.length).trim().replace(/^[-_ ]+/, "");
      }

      targetGroup.workspaces.push({
        fullName: ws,
        subName: subName || ws,
        count: list.length,
        enabled: isEnabled,
      });
    }

    return Object.values(siteGroups).filter((g) => g.workspaces.length > 0);
  }, [allWorkspaceNames, workspaceMap, enabledWorkspaces]);

  // Toggle folder expansion
  function toggleSiteExpand(site: string) {
    setExpandedSites((prev) => ({ ...prev, [site]: !prev[site] }));
  }

  // Selected items: either from a specific workspace, or from an entire site folder
  const displayedItems = useMemo(() => {
    let baseList: PowerBiItem[] = [];
    if (selectedWorkspace) {
      baseList = workspaceMap.get(selectedWorkspace) || [];
    } else if (selectedSiteFolder) {
      const group = folderTree.find((g) => g.site === selectedSiteFolder);
      if (group) {
        group.workspaces.forEach((w) => {
          if (w.enabled) {
            baseList.push(...(workspaceMap.get(w.fullName) || []));
          }
        });
      }
    }

    const q = itemSearch.trim().toLowerCase();
    if (!q) return baseList;
    return baseList.filter(
      (i) =>
        i.reportTitle.toLowerCase().includes(q) ||
        (i.reportCode && i.reportCode.toLowerCase().includes(q)) ||
        (i.responsibleUser && i.responsibleUser.toLowerCase().includes(q))
    );
  }, [selectedWorkspace, selectedSiteFolder, workspaceMap, folderTree, itemSearch]);

  // Set default selection when data loads
  useEffect(() => {
    if (!selectedWorkspace && !selectedSiteFolder && folderTree.length > 0) {
      const firstEnabled = folderTree[0]?.workspaces.find((w) => w.enabled);
      if (firstEnabled) {
        setSelectedWorkspace(firstEnabled.fullName);
      }
    }
  }, [folderTree, selectedWorkspace, selectedSiteFolder]);

  async function handleExport() {
    if (displayedItems.length === 0) return;
    setExporting(true);
    try {
      const res = await fetch("/api/powerbi/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "report", items: displayedItems }),
      });
      if (!res.ok) throw new Error("Failed to export");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const sanitized = (selectedWorkspace || selectedSiteFolder || "catalog").replace(/[^a-zA-Z0-9_-]/g, "_");
      a.download = `powerbi-${sanitized}-reports-${new Date().toISOString().slice(0, 10)}.xlsx`;
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
      {/* Top Action Bar in Ocean Sapphire Styling */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-3xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 shadow-2xs">
            <BarChart3 className="h-4 w-4 text-blue-600" />
            <span className="text-xs font-bold text-blue-700">
              Power BI Reports Catalog ({items.length})
            </span>
          </div>

          <button
            type="button"
            onClick={() => setManageModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 transition"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-blue-600" />
            <span>Manage Workspaces ({enabledWorkspaces.size}/{allWorkspaceNames.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            dense
            onClick={() => refresh()}
            disabled={state.status === "loading"}
          >
            <RefreshCw className={clsx("h-3.5 w-3.5", state.status === "loading" && "animate-spin text-blue-600")} />
            <span>Sync Catalog</span>
          </Button>

          {(selectedWorkspace || selectedSiteFolder) && (
            <Button
              type="button"
              variant="secondary"
              dense
              onClick={handleExport}
              disabled={exporting || displayedItems.length === 0}
            >
              <Download className="h-3.5 w-3.5 text-emerald-600" />
              <span>Export Excel ({displayedItems.length})</span>
            </Button>
          )}
        </div>
      </div>

      {/* Main Mail Inbox 2-Pane Container */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 min-h-[680px]">
        {/* LEFT PANE: Workspace Folder Sub-diagram (Tree Hierarchy) (4 Cols) */}
        <div className="md:col-span-4 lg:col-span-4 flex flex-col rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm">
          {/* Header */}
          <div className="pb-3 border-b border-slate-100 space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <FolderTree className="h-4 w-4 text-blue-600" />
                <span>Workspace Folders</span>
              </h2>
              <span className="text-[11px] text-blue-600 font-mono font-bold bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                {items.length} items
              </span>
            </div>

            {/* Search Filter for Workspaces */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={workspaceSearch}
                onChange={(e) => setWorkspaceSearch(e.target.value)}
                placeholder="Filter workspaces & sub-folders..."
                className="w-full rounded-full border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 outline-none transition"
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
          </div>

          {/* Folder Sub-diagram Tree Stream */}
          <div className="flex-1 overflow-y-auto mt-3 space-y-3 pr-1 max-h-[580px]">
            {folderTree.map((group) => {
              const isExpanded = expandedSites[group.site] ?? true;
              const isSiteSelected = selectedSiteFolder === group.site && !selectedWorkspace;

              // Filter sub-workspaces by search
              const matchingSubWorkspaces = group.workspaces.filter(
                (w) =>
                  w.enabled &&
                  (!workspaceSearch.trim() ||
                    w.fullName.toLowerCase().includes(workspaceSearch.toLowerCase()) ||
                    w.subName.toLowerCase().includes(workspaceSearch.toLowerCase()))
              );

              if (matchingSubWorkspaces.length === 0 && workspaceSearch.trim()) {
                return null;
              }

              return (
                <div key={group.site} className="rounded-2xl border border-slate-100 bg-slate-50/50 p-2 space-y-1">
                  {/* Root Site Folder Header */}
                  <div className="flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={() => toggleSiteExpand(group.site)}
                      className="p-1 hover:bg-slate-200/60 rounded-lg text-slate-500 transition"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-slate-600" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-slate-600" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSiteFolder(group.site);
                        setSelectedWorkspace(null);
                      }}
                      className={clsx(
                        "flex-1 flex items-center justify-between gap-2 px-2 py-1.5 rounded-xl text-left text-xs font-bold transition",
                        isSiteSelected
                          ? "bg-blue-600 text-white shadow-xs"
                          : "text-slate-800 hover:bg-slate-200/60"
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {isSiteSelected ? (
                          <FolderOpen className="h-4 w-4 text-white shrink-0" />
                        ) : (
                          <Folder className="h-4 w-4 text-blue-600 shrink-0" />
                        )}
                        <span className="truncate">{group.label}</span>
                      </div>
                      <span
                        className={clsx(
                          "rounded-full px-2 py-0.2 text-[10px] font-mono font-bold shrink-0",
                          isSiteSelected ? "bg-blue-700 text-white" : "bg-white text-slate-600 border border-slate-200"
                        )}
                      >
                        {group.totalReports}
                      </span>
                    </button>
                  </div>

                  {/* Sub-Workspaces Tree Diagram (Indented with connector) */}
                  {isExpanded && (
                    <div className="ml-4 pl-3 border-l-2 border-slate-200/90 space-y-1 pt-1">
                      {matchingSubWorkspaces.map((ws) => {
                        const isSelected = selectedWorkspace === ws.fullName;
                        return (
                          <button
                            key={ws.fullName}
                            type="button"
                            onClick={() => {
                              setSelectedWorkspace(ws.fullName);
                              setSelectedSiteFolder(null);
                            }}
                            className={clsx(
                              "w-full flex items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-left text-xs transition duration-150",
                              isSelected
                                ? "bg-blue-600 text-white font-bold shadow-xs"
                                : "text-slate-600 hover:bg-white hover:text-blue-700"
                            )}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={clsx("text-[10px]", isSelected ? "text-blue-200" : "text-slate-400")}>
                                └─
                              </span>
                              <span className="truncate font-medium">{ws.subName}</span>
                            </div>
                            <span
                              className={clsx(
                                "rounded-full px-1.5 py-0.2 text-[10px] font-mono shrink-0",
                                isSelected ? "bg-blue-700 text-white font-bold" : "text-slate-400"
                              )}
                            >
                              {ws.count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT PANE: Mail Inbox Reports List (8 Cols) */}
        <div className="md:col-span-8 lg:col-span-8 flex flex-col rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
          {!selectedWorkspace && !selectedSiteFolder ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center my-auto min-h-[400px]">
              <div className="grid h-16 w-16 place-items-center rounded-3xl bg-blue-50 border border-blue-200 text-blue-600 mb-4 shadow-xs">
                <Inbox className="h-8 w-8" />
              </div>
              <h3 className="text-base font-bold text-slate-800">
                Select a Workspace Folder to View Reports
              </h3>
              <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-slate-400">
                Choose an analytics workspace folder or entire hospital branch from the tree diagram on the left to inspect its active reports.
              </p>
            </div>
          ) : (
            <div className="flex flex-col h-full space-y-4">
              {/* Inbox Header with Search */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                    <span>{selectedWorkspace || `${selectedSiteFolder} Network All Workspaces`}</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Showing {displayedItems.length} reports in active selection
                  </p>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    placeholder="Search reports or author..."
                    className="w-full rounded-full border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 outline-none transition"
                  />
                  {itemSearch && (
                    <button
                      type="button"
                      onClick={() => setItemSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Reports List */}
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 max-h-[560px]">
                {displayedItems.length === 0 ? (
                  <EmptyState>
                    <BarChart3 className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-bold text-slate-700">No reports found</p>
                    <p className="text-xs text-slate-400">
                      No reports match your current filter in this workspace
                    </p>
                  </EmptyState>
                ) : (
                  displayedItems.map((item) => {
                    const pubDate = item.lastPublish || item.lastModified;
                    const dateObj = pubDate ? new Date(pubDate) : null;
                    const dateStr = dateObj && !isNaN(dateObj.getTime())
                      ? dateObj.toLocaleDateString("en-US", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "-";

                    return (
                      <div
                        key={item.id}
                        className="group relative rounded-2xl border border-slate-200/80 bg-white p-4 hover:border-blue-300 hover:shadow-xs transition duration-150 flex flex-wrap items-center justify-between gap-3"
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {item.reportCode ? (
                              <span className="rounded-md bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 font-mono text-[10px] font-bold">
                                {item.reportCode}
                              </span>
                            ) : null}
                            <h4 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition truncate">
                              {item.reportTitle || item.name}
                            </h4>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                            {item.workspaceName && (
                              <span className="flex items-center gap-1 font-medium text-slate-500">
                                <Folder className="h-3 w-3 text-slate-400" />
                                <span>{item.workspaceName}</span>
                              </span>
                            )}
                            {item.responsibleUser && (
                              <span className="flex items-center gap-1 text-slate-500">
                                <User className="h-3 w-3 text-slate-400" />
                                <span>{item.responsibleUser}</span>
                              </span>
                            )}
                            <span className="flex items-center gap-1 font-mono text-[11px]">
                              <Clock className="h-3 w-3 text-slate-400" />
                              <span>{dateStr}</span>
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            type="button"
                            variant="secondary"
                            dense
                            onClick={() => setSelectedLogItem(item)}
                            title="Audit & Version History"
                          >
                            <History className="h-3.5 w-3.5 text-blue-600" />
                            <span>History</span>
                          </Button>

                          {item.webUrl && item.webUrl !== "#" ? (
                            <a
                              href={item.webUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-xs font-bold shadow-xs active:scale-95 transition"
                            >
                              <span>Open in Power BI</span>
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          ) : null}
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

      {/* MANAGE WORKSPACES MODAL */}
      {manageModalOpen && (
        <Modal className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-900/50 p-3 backdrop-blur-xs sm:p-6 animate-in fade-in">
          <Panel className="my-auto w-full max-w-xl rounded-3xl bg-white p-5 shadow-2xl border border-slate-200/90 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-50 text-blue-600 border border-blue-200 shadow-xs">
                  <SlidersHorizontal className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 sm:text-lg">
                    Manage Workspaces
                  </h2>
                  <p className="text-xs text-slate-500">
                    Select which workspaces to include in your catalog view
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setManageModalOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <span className="font-semibold text-slate-600">
                {enabledWorkspaces.size} of {allWorkspaceNames.length} workspaces active
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllWorkspaces}
                  className="font-bold text-blue-600 hover:underline"
                >
                  Select All
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={handleDeselectAllWorkspaces}
                  className="font-bold text-slate-500 hover:underline"
                >
                  Deselect All
                </button>
              </div>
            </div>

            {/* Checkboxes List */}
            <div className="max-h-72 overflow-y-auto rounded-2xl border border-slate-200 p-2 space-y-1 text-xs">
              {allWorkspaceNames.map((ws) => {
                const checked = enabledWorkspaces.has(ws);
                const count = (workspaceMap.get(ws) || []).length;
                return (
                  <label
                    key={ws}
                    className={clsx(
                      "flex items-center justify-between gap-3 p-2 rounded-xl cursor-pointer transition",
                      checked ? "bg-blue-50/70 text-blue-900 font-semibold" : "hover:bg-slate-50 text-slate-700"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleWorkspaceEnabled(ws)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="truncate">{ws}</span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 shrink-0">
                      {count} items
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <Button type="button" variant="primary" onClick={() => setManageModalOpen(false)}>
                Done
              </Button>
            </div>
          </Panel>
        </Modal>
      )}

      {/* Dashboard Log Modal */}
      {selectedLogItem && (
        <DashboardLogModal
          item={selectedLogItem}
          onClose={() => setSelectedLogItem(null)}
        />
      )}
    </div>
  );
}