"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  Check,
  Download,
  ExternalLink,
  History,
  LayoutGrid,
  List,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Table,
  User,
  X,
} from "lucide-react";
import { clsx } from "clsx";
import { Button, EmptyState, Input, Modal, Panel, Select, StatCard } from "@/components/ui";
import { DashboardLogModal } from "@/components/powerbi/DashboardLogModal";
import { TicketLinkButton } from "@/components/powerbi/TicketLinkButton";
import { usePowerBiItems } from "@/lib/usePowerBiItems";
import type { PowerBiItem } from "@/lib/powerbiTypes";
import {
  formatNumberRanges,
  groupByCodeSeries,
  groupBySiteGroup,
  groupByWorkspace,
  padCodeNumber,
  siteGroupKeyForWorkspace,
  SITE_GROUP_KEYS,
  type CodeSeriesGroup,
  type SiteGroupKey,
} from "@/lib/reportCodeSeries";

function SeriesAvailabilityLine({
  series,
  onShowAvailable,
}: {
  series: CodeSeriesGroup;
  onShowAvailable: (series: CodeSeriesGroup) => void;
}) {
  const tailFrom = series.max + 1;
  const hasTail = tailFrom <= series.rangeMax;
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] leading-relaxed text-slate-500">
      <span className="rounded-full bg-blue-50 px-2 py-0.5 font-mono font-semibold text-blue-700 border border-blue-200">
        {series.prefix}
      </span>
      <span>
        last <span className="font-mono font-semibold text-slate-900">{padCodeNumber(series.max, series.numberWidth)}</span>
      </span>
      {series.gaps.length ? (
        <>
          <span>&middot;</span>
          <button
            type="button"
            onClick={() => onShowAvailable(series)}
            className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-800 border border-amber-200 underline decoration-dotted transition hover:bg-amber-100"
          >
            ว่าง ({series.gaps.length})
          </button>
        </>
      ) : null}
      {hasTail ? (
        <>
          <span>&middot;</span>
          <span className="font-semibold text-emerald-700">
            ยังไม่ใช้ {padCodeNumber(tailFrom, series.numberWidth)}
          </span>
        </>
      ) : null}
    </div>
  );
}

export function ReportsPage() {
  const [kind, setKind] = useState<"report" | "dashboard">("report");
  const endpoint = kind === "report" ? "/api/powerbi/reports" : "/api/powerbi/dashboards";
  const { state, refresh } = usePowerBiItems(endpoint);

  const [query, setQuery] = useState("");
  const [siteFilter, setSiteFilter] = useState<SiteGroupKey | "All">("All");
  const [workspaceFilter, setWorkspaceFilter] = useState("All");
  const [viewMode, setViewMode] = useState<"grouped" | "table">("grouped");
  const [selectedLogItem, setSelectedLogItem] = useState<PowerBiItem | null>(null);
  const [availablePopupSeries, setAvailablePopupSeries] = useState<CodeSeriesGroup | null>(null);
  const [exporting, setExporting] = useState(false);

  const items = useMemo(() => (state.status === "ready" ? state.response.data : []), [state]);

  const workspaces = useMemo(
    () => Array.from(new Set(items.map((i) => i.workspaceName))).sort((a, b) => a.localeCompare(b)),
    [items]
  );

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (siteFilter !== "All" && siteGroupKeyForWorkspace(item.workspaceName) !== siteFilter) return false;
      if (workspaceFilter !== "All" && item.workspaceName !== workspaceFilter) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.reportCode.toLowerCase().includes(q) ||
        item.reportTitle.toLowerCase().includes(q) ||
        item.workspaceName.toLowerCase().includes(q) ||
        (item.responsibleUser && item.responsibleUser.toLowerCase().includes(q))
      );
    });
  }, [items, query, siteFilter, workspaceFilter]);

  const siteCounts = useMemo(() => {
    const counts = new Map<SiteGroupKey, number>();
    for (const item of items) {
      const key = siteGroupKeyForWorkspace(item.workspaceName);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [items]);

  const workspaceGroups = useMemo(() => groupByWorkspace(filteredItems), [filteredItems]);
  const siteGroups = useMemo(() => groupBySiteGroup(workspaceGroups), [workspaceGroups]);

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch("/api/powerbi/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, items: filteredItems }),
      });
      if (!res.ok) throw new Error("Failed to export");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `powerbi-${kind}s-${new Date().toISOString().slice(0, 10)}.xlsx`;
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
    <div className="space-y-6">
      {/* Top Banner / KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="รายการทั้งหมด"
          value={state.status === "loading" ? "..." : items.length}
          icon={BarChart3}
          tone="gold"
        />
        <StatCard
          label="มีรหัสมาตรฐาน (Code)"
          value={state.status === "loading" ? "..." : items.filter((i) => i.reportCode).length}
          icon={Sparkles}
          tone="blue"
        />
        <StatCard
          label="จำนวน Workspaces"
          value={state.status === "loading" ? "..." : workspaces.length}
          icon={LayoutGrid}
          tone="default"
        />
        <StatCard
          label="แสดงอยู่บนหน้าจอ"
          value={filteredItems.length}
          icon={List}
          tone="emerald"
        />
      </div>

      {/* Main Filter & Action Controls */}
      <Panel className="p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Entity Kind Toggle */}
          <div className="inline-flex rounded-full bg-slate-100 p-1 border border-slate-200">
            <button
              type="button"
              onClick={() => setKind("report")}
              className={clsx(
                "rounded-full px-4 py-1.5 text-xs font-bold transition",
                kind === "report" ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
              )}
            >
              รายงาน (Reports)
            </button>
            <button
              type="button"
              onClick={() => setKind("dashboard")}
              className={clsx(
                "rounded-full px-4 py-1.5 text-xs font-bold transition",
                kind === "dashboard" ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
              )}
            >
              แดชบอร์ด (Dashboards)
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
              <RefreshCw className={clsx("h-3.5 w-3.5", state.status === "loading" && "animate-spin")} />
              <span>ซิงค์ข้อมูลสด (Sync)</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              dense
              onClick={handleExport}
              disabled={exporting || filteredItems.length === 0}
            >
              <Download className="h-3.5 w-3.5 text-emerald-600" />
              <span>ส่งออก Excel</span>
            </Button>
          </div>
        </div>

        {/* Site Group Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
          <span className="text-xs font-semibold text-slate-500 mr-1">กลุ่มสาขา (Sites):</span>
          <button
            type="button"
            onClick={() => setSiteFilter("All")}
            className={clsx(
              "rounded-full px-3 py-1 text-xs font-semibold transition border",
              siteFilter === "All"
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            )}
          >
            ทั้งหมด ({items.length})
          </button>
          {SITE_GROUP_KEYS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setSiteFilter(k)}
              className={clsx(
                "rounded-full px-3 py-1 text-xs font-semibold transition border",
                siteFilter === k
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              )}
            >
              {k} ({siteCounts.get(k) || 0})
            </button>
          ))}
        </div>

        {/* Search & Workspace Filter */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Input
              icon={Search}
              clearable
              onClear={() => setQuery("")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาตามรหัส (เช่น PKT-STG-001), ชื่อรายงาน, หรือชื่อผู้รับผิดชอบ..."
            />
          </div>
          <div>
            <Select value={workspaceFilter} onChange={(e) => setWorkspaceFilter(e.target.value)}>
              <option value="All">ทุก Workspaces ({workspaces.length})</option>
              {workspaces.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Panel>

      {/* Content Rendering */}
      {state.status === "loading" ? (
        <div className="grid place-items-center py-16 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500 mb-2" />
          <p className="text-sm font-medium">กำลังโหลดข้อมูลแคตตาล็อก Power BI...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <EmptyState>
          <p className="text-base font-semibold text-slate-800">ไม่พบรายงานที่ตรงกับเงื่อนไขการค้นหา</p>
          <p className="mt-1 text-xs text-slate-500">ลองล้างตัวกรองหรือคำค้นหาเพื่อดูข้อมูลทั้งหมด</p>
        </EmptyState>
      ) : (
        <div className="space-y-6">
          {siteGroups.map((site) => (
            <div key={site.key} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-slate-900 text-white px-3 py-0.5 text-xs font-bold font-mono">
                  {site.key}
                </span>
                <h3 className="text-sm font-bold text-slate-800">
                  {site.key === "Other" ? "Workspaces อื่นๆ" : `กลุ่มรายงานสาขา ${site.key}`}
                </h3>
                <span className="text-xs text-slate-400">({site.itemCount} รายการ)</span>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {site.workspaces.map((wg) => (
                  <Panel key={wg.workspaceId} className="p-4 sm:p-5 flex flex-col justify-between">
                    <div>
                      {/* Workspace Header */}
                      <div className="border-b border-slate-100 pb-2.5">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-slate-900 truncate" title={wg.workspaceName}>
                            {wg.workspaceName}
                          </h4>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                            {wg.items.length} รายการ
                          </span>
                        </div>

                        {/* Series Gap Analysis summary */}
                        {wg.seriesGroups.length > 0 ? (
                          <div className="mt-2 space-y-1">
                            {wg.seriesGroups.map((sg) => (
                              <SeriesAvailabilityLine
                                key={sg.prefix}
                                series={sg}
                                onShowAvailable={(series) => setAvailablePopupSeries(series)}
                              />
                            ))}
                          </div>
                        ) : null}
                      </div>

                      {/* Items List */}
                      <div className="mt-3 divide-y divide-slate-100">
                        {wg.items.map((item) => {
                          const pubDate = item.lastPublish || item.lastModified;
                          return (
                            <div
                              key={item.id}
                              className="py-2.5 flex items-start justify-between gap-2 group hover:bg-slate-50/60 rounded-xl px-2 -mx-2 transition"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {item.reportCode ? (
                                    <span className="rounded-full bg-blue-50 px-2 py-0.2 font-mono text-[11px] font-bold text-blue-700 border border-blue-200">
                                      {item.reportCode}
                                    </span>
                                  ) : null}
                                  <span className="text-xs font-semibold text-slate-900 leading-snug">
                                    {item.reportTitle}
                                  </span>
                                </div>

                                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                                  {item.responsibleUser ? (
                                    <span className="flex items-center gap-1">
                                      <User className="h-3 w-3 text-slate-400" />
                                      <span>{item.responsibleUser}</span>
                                    </span>
                                  ) : null}
                                  {pubDate ? (
                                    <span className="flex items-center gap-1 font-mono text-[10px]">
                                      <Calendar className="h-3 w-3 text-slate-400" />
                                      <span>{new Date(pubDate).toLocaleDateString("th-TH")}</span>
                                    </span>
                                  ) : null}
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0 self-center">
                                <button
                                  type="button"
                                  onClick={() => setSelectedLogItem(item)}
                                  className="grid h-7 w-7 place-items-center rounded-full text-slate-400 hover:bg-slate-200/60 hover:text-slate-800 transition"
                                  title="ดูประวัติการ Publish / Version History"
                                >
                                  <History className="h-3.5 w-3.5" />
                                </button>
                                <TicketLinkButton url={item.webUrl} dense />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </Panel>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Available Codes Gap Popup Modal */}
      {availablePopupSeries ? (
        <Modal className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <Panel className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  รหัสที่ยังว่าง ({availablePopupSeries.prefix})
                </h3>
                <p className="text-xs text-slate-500">
                  สามารถนำรหัสเหล่านี้ไปตั้งชื่อรายงานใหม่ได้
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAvailablePopupSeries(null)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 max-h-60 overflow-y-auto font-mono text-xs">
              <div className="flex flex-wrap gap-1.5">
                {availablePopupSeries.gaps.map((n) => (
                  <span
                    key={n}
                    className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-900 font-bold border border-amber-200"
                  >
                    {availablePopupSeries.prefix}-{padCodeNumber(n, availablePopupSeries.numberWidth)}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button type="button" variant="secondary" dense onClick={() => setAvailablePopupSeries(null)}>
                ปิด
              </Button>
            </div>
          </Panel>
        </Modal>
      ) : null}

      {/* Item Publish Version Log Modal */}
      {selectedLogItem ? (
        <DashboardLogModal item={selectedLogItem} onClose={() => setSelectedLogItem(null)} />
      ) : null}
    </div>
  );
}
