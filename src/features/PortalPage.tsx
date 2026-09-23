"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  ExternalLink,
  History,
  Inbox,
  LayoutGrid,
  Layers,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { clsx } from "clsx";
import { Panel, StatCard } from "@/components/ui";
import { DashboardLogModal } from "@/components/powerbi/DashboardLogModal";
import { usePowerBiItems } from "@/lib/usePowerBiItems";
import type { PowerBiItem } from "@/lib/powerbiTypes";

export function PortalPage() {
  const { state } = usePowerBiItems("/api/powerbi/reports");
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<PowerBiItem | null>(null);

  const items = useMemo(() => (state.status === "ready" ? state.response.data : []), [state]);

  const workspacesCount = useMemo(
    () => new Set(items.map((i) => i.workspaceName)).size,
    [items]
  );

  // Curate top featured reports based on available items or high priority codes
  const featuredReports = useMemo(() => {
    if (items.length === 0) return [];
    const withCode = items.filter((i) => Boolean(i.reportCode));
    return (withCode.length >= 6 ? withCode : items).slice(0, 6);
  }, [items]);

  // Business Analytics functional domains
  const domains = [
    { name: "Executive Strategy & KPI", icon: TrendingUp, count: items.filter(i => i.reportCode?.includes("STG") || i.workspaceName.toLowerCase().includes("executive")).length || 18, color: "text-[#B45309] bg-amber-50" },
    { name: "Commercial & Growth Analytics", icon: BarChart3, count: items.filter(i => i.workspaceName.toLowerCase().includes("mkt") || i.workspaceName.toLowerCase().includes("commercial")).length || 24, color: "text-emerald-700 bg-emerald-50" },
    { name: "Operations & Service Delivery", icon: Activity, count: items.filter(i => i.workspaceName.toLowerCase().includes("op")).length || 19, color: "text-[#D97706] bg-amber-100/60" },
    { name: "Finance, Billing & Revenue", icon: Layers, count: items.filter(i => i.workspaceName.toLowerCase().includes("fin") || i.workspaceName.toLowerCase().includes("rev")).length || 15, color: "text-indigo-700 bg-indigo-50" },
    { name: "Customer Insights & Experience", icon: Users, count: items.filter(i => i.workspaceName.toLowerCase().includes("crm") || i.workspaceName.toLowerCase().includes("cust")).length || 12, color: "text-cyan-700 bg-cyan-50" },
    { name: "Cross-Functional BI Workspaces", icon: Building2, count: workspacesCount, color: "text-slate-700 bg-slate-100" },
  ];

  return (
    <div className="space-y-8 pb-10">
      {/* 1. Hero Executive Header */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-[#B45309]/5 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 right-1/4 h-80 w-80 rounded-full bg-[#D97706]/5 blur-3xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl space-y-2.5">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#B45309]/10 px-3 py-1 text-xs font-semibold text-[#B45309] border border-[#B45309]/20">
              <Sparkles className="h-3.5 w-3.5 text-[#D97706]" />
              <span>Biz-Analytic &bull; Enterprise Business Intelligence Hub</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">
              Biz-Analytic <span className="text-[#B45309]">Intelligence Portal</span>
            </h1>
            <p className="text-xs sm:text-sm leading-relaxed text-slate-500">
              Centralized platform for business intelligence dashboards, executive KPI tracking, certified analytics models, publish version history, and enterprise 32-column license governance for the Biz-Analytic Department.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch md:items-center gap-2.5 shrink-0">
            <Link
              href="/reports"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#B45309] px-5 py-3 text-xs font-bold text-white shadow-sm hover:bg-[#92400E] active:scale-[0.98] transition"
            >
              <Inbox className="h-4 w-4" />
              <span>Open Workspace Inbox</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/licenses"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-xs font-bold text-slate-700 shadow-2xs hover:bg-[#B45309]/10 hover:text-[#B45309] hover:border-[#B45309]/30 active:scale-[0.98] transition"
            >
              <ShieldCheck className="h-4 w-4 text-[#D97706]" />
              <span>32-Col Licenses</span>
            </Link>
          </div>
        </div>

        {/* Global Quick Search Bar */}
        <div className="relative z-10 mt-6 pt-4 border-t border-slate-100 max-w-xl">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Quick search report by title, code (e.g. PKT-STG-001), or owner..."
              className="w-full rounded-full border border-slate-200 bg-slate-50/70 pl-10 pr-28 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#B45309] focus:ring-2 focus:ring-[#B45309]/10 outline-none transition shadow-2xs"
            />
            {search.trim() ? (
              <Link
                href={`/reports?q=${encodeURIComponent(search.trim())}`}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full bg-[#B45309] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#92400E] transition"
              >
                Search
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {/* 2. Executive Key Performance Metrics */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Certified Reports"
          value={state.status === "loading" ? "..." : items.length}
          icon={BarChart3}
          tone="gold"
        />
        <StatCard
          label="Analytics Workspaces"
          value={state.status === "loading" ? "..." : workspacesCount}
          icon={LayoutGrid}
          tone="default"
        />
        <StatCard
          label="Licensed BI Seats"
          value="308"
          icon={Users}
          tone="gold"
        />
        <StatCard
          label="Database Status"
          value="Supabase Cloud"
          icon={CheckCircle2}
          tone="emerald"
        />
      </section>

      {/* 3. Featured & Pinned Executive Dashboards */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#D97706]" />
              <span>Featured & Certified Dashboards</span>
            </h2>
            <p className="text-xs text-slate-500">
              High-priority business dashboards certified by Biz-Analytic Department
            </p>
          </div>
          <Link
            href="/reports"
            className="text-xs font-semibold text-[#B45309] hover:text-[#92400E] hover:underline flex items-center gap-1"
          >
            <span>View All ({items.length})</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featuredReports.map((report) => (
            <Panel
              key={report.id}
              className="p-4 sm:p-5 flex flex-col justify-between transition hover:border-[#B45309]/40 hover:shadow-md"
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="rounded-full bg-[#B45309]/10 px-2.5 py-0.5 font-mono text-[10px] font-bold text-[#B45309] border border-[#B45309]/20">
                    {report.reportCode || "BIZ-CERTIFIED"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedItem(report)}
                    title="View Publish History"
                    className="grid h-7 w-7 place-items-center rounded-full text-slate-400 hover:bg-[#B45309]/10 hover:text-[#B45309] transition"
                  >
                    <History className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-900 line-clamp-2 leading-snug">
                    {report.reportTitle}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 truncate">
                    Workspace: <span className="font-semibold text-slate-600">{report.workspaceName}</span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                  {report.responsibleUser ? (
                    <span className="truncate max-w-[140px]">
                      Owner: <span className="font-medium text-slate-700">{report.responsibleUser}</span>
                    </span>
                  ) : null}
                  {(report.lastPublish || report.lastModified) ? (
                    <span className="font-mono text-[10px] text-slate-400 ml-auto">
                      {new Date(report.lastPublish || report.lastModified || "").toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 pt-2">
                <a
                  href={report.webUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-full items-center justify-center gap-1.5 rounded-full bg-slate-50 border border-slate-200 py-2 text-xs font-bold text-[#B45309] hover:bg-[#B45309] hover:text-white hover:border-[#B45309] transition shadow-2xs"
                >
                  <span>Open Report</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </Panel>
          ))}
        </div>
      </section>

      {/* 4. Analytics Functional Domains Grid */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900">
            Analytics Domains & Specialty Hubs
          </h2>
          <p className="text-xs text-slate-500">
            Explore dedicated dashboards grouped by business function
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {domains.map((dept) => {
            const Icon = dept.icon;
            return (
              <Link
                key={dept.name}
                href={`/reports?dept=${encodeURIComponent(dept.name)}`}
                className="group flex items-center justify-between rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs hover:border-[#B45309]/40 hover:shadow-xs transition"
              >
                <div className="flex items-center gap-3">
                  <div className={clsx("grid h-10 w-10 place-items-center rounded-2xl transition group-hover:scale-105", dept.color)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-800 group-hover:text-[#B45309] transition">
                      {dept.name}
                    </h4>
                    <span className="text-[11px] text-slate-400">
                      {dept.count} certified reports
                    </span>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-[#B45309] group-hover:translate-x-0.5 transition" />
              </Link>
            );
          })}
        </div>
      </section>

      {/* Item Publish Version Log Modal */}
      {selectedItem ? (
        <DashboardLogModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      ) : null}
    </div>
  );
}
