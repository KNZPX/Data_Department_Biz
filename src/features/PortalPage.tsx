"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  HeartPulse,
  History,
  Inbox,
  LayoutGrid,
  Layers,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TrendingUp,
  Users,
} from "lucide-react";
import { clsx } from "clsx";
import { Button, Input, Panel, StatCard } from "@/components/ui";
import { TicketLinkButton } from "@/components/powerbi/TicketLinkButton";
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
    // Prioritize items with reportCode or well-known clinical/executive prefixes
    const withCode = items.filter((i) => Boolean(i.reportCode));
    return (withCode.length >= 6 ? withCode : items).slice(0, 6);
  }, [items]);

  // Department shortcuts
  const departments = [
    { name: "Executive & Strategy", icon: TrendingUp, count: items.filter(i => i.reportCode?.includes("STG") || i.workspaceName.toLowerCase().includes("executive")).length || 18, color: "text-[#002D72] bg-[#002D72]/10" },
    { name: "Clinical & Inpatient", icon: Stethoscope, count: items.filter(i => i.workspaceName.toLowerCase().includes("clinic") || i.workspaceName.toLowerCase().includes("med")).length || 24, color: "text-emerald-700 bg-emerald-100" },
    { name: "Emergency & Critical Care", icon: HeartPulse, count: items.filter(i => i.workspaceName.toLowerCase().includes("er") || i.reportTitle.toLowerCase().includes("emergency")).length || 12, color: "text-[#AB2328] bg-[#AB2328]/10" },
    { name: "Operations & Facilities", icon: Activity, count: items.filter(i => i.workspaceName.toLowerCase().includes("op")).length || 19, color: "text-blue-700 bg-blue-100" },
    { name: "Pharmacy & Diagnostics", icon: Layers, count: items.filter(i => i.workspaceName.toLowerCase().includes("lab") || i.workspaceName.toLowerCase().includes("phar")).length || 15, color: "text-purple-700 bg-purple-100" },
    { name: "Network & Site Branches", icon: Building2, count: workspacesCount, color: "text-amber-800 bg-amber-100" },
  ];

  return (
    <div className="space-y-8 pb-10">
      {/* 1. Hero Executive Header */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-[#002D72]/5 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 right-1/4 h-80 w-80 rounded-full bg-[#AB2328]/5 blur-3xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl space-y-2.5">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#002D72]/5 px-3 py-1 text-xs font-semibold text-[#002D72] border border-[#002D72]/15">
              <Sparkles className="h-3.5 w-3.5 text-[#AB2328]" />
              <span>Bangkok Hospital &bull; Enterprise Healthcare Intelligence</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-[#002D72] sm:text-3xl lg:text-4xl">
              Healthcare Analytics & Power BI Portal
            </h1>
            <p className="text-xs sm:text-sm leading-relaxed text-slate-500">
              Centralized platform for hospital management dashboards, certified clinical metrics, publish version tracking, and enterprise 32-column license governance across BDMS healthcare network.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch md:items-center gap-2.5 shrink-0">
            <Link
              href="/reports"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#002D72] px-5 py-3 text-xs font-bold text-white shadow-sm hover:bg-[#001f52] active:scale-[0.98] transition"
            >
              <Inbox className="h-4 w-4" />
              <span>Open Workspace Inbox</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/licenses"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-xs font-bold text-slate-700 shadow-2xs hover:bg-[#002D72]/5 hover:text-[#002D72] hover:border-[#002D72]/30 active:scale-[0.98] transition"
            >
              <ShieldCheck className="h-4 w-4 text-[#AB2328]" />
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
              placeholder="Quick search report by title, code (e.g. PKT-STG-001), or clinical owner..."
              className="w-full rounded-full border border-slate-200 bg-slate-50/70 pl-10 pr-28 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#002D72] focus:ring-2 focus:ring-[#002D72]/10 outline-none transition shadow-2xs"
            />
            {search.trim() ? (
              <Link
                href={`/reports?q=${encodeURIComponent(search.trim())}`}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full bg-[#002D72] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#001f52] transition"
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
          tone="blue"
        />
        <StatCard
          label="Hospital Workspaces"
          value={state.status === "loading" ? "..." : workspacesCount}
          icon={LayoutGrid}
          tone="default"
        />
        <StatCard
          label="Licensed Hospital Users"
          value="308"
          icon={Users}
          tone="gold"
        />
        <StatCard
          label="Data Synchronization"
          value="Supabase Cloud"
          icon={CheckCircle2}
          tone="emerald"
        />
      </section>

      {/* 3. Featured & Pinned Executive Dashboards */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[#002D72] flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#AB2328]" />
              <span>Featured & Certified Dashboards</span>
            </h2>
            <p className="text-xs text-slate-500">
              High-priority enterprise dashboards certified by BDMS Data Department
            </p>
          </div>
          <Link
            href="/reports"
            className="text-xs font-semibold text-[#002D72] hover:text-[#001f52] hover:underline flex items-center gap-1"
          >
            <span>View All ({items.length})</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featuredReports.map((report) => (
            <Panel
              key={report.id}
              className="p-4 sm:p-5 flex flex-col justify-between transition hover:border-[#002D72]/40 hover:shadow-md"
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="rounded-full bg-[#002D72]/10 px-2.5 py-0.5 font-mono text-[10px] font-bold text-[#002D72] border border-[#002D72]/20">
                    {report.reportCode || "PBI-CERTIFIED"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedItem(report)}
                    title="View Publish History"
                    className="grid h-7 w-7 place-items-center rounded-full text-slate-400 hover:bg-[#002D72]/10 hover:text-[#002D72] transition"
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
                  className="flex w-full items-center justify-center gap-1.5 rounded-full bg-slate-50 border border-slate-200 py-2 text-xs font-bold text-[#002D72] hover:bg-[#002D72] hover:text-white hover:border-[#002D72] transition shadow-2xs"
                >
                  <span>Open Report</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </Panel>
          ))}
        </div>
      </section>

      {/* 4. Healthcare Department Portals Grid */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-[#002D72]">
            Hospital Operational Domains & Specialty Hubs
          </h2>
          <p className="text-xs text-slate-500">
            Explore dedicated analytics grouped by hospital service functions
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {departments.map((dept) => {
            const Icon = dept.icon;
            return (
              <Link
                key={dept.name}
                href={`/reports?dept=${encodeURIComponent(dept.name)}`}
                className="group flex items-center justify-between rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs hover:border-[#002D72]/40 hover:shadow-xs transition"
              >
                <div className="flex items-center gap-3">
                  <div className={clsx("grid h-10 w-10 place-items-center rounded-2xl transition group-hover:scale-105", dept.color)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-800 group-hover:text-[#002D72] transition">
                      {dept.name}
                    </h4>
                    <span className="text-[11px] text-slate-400">
                      {dept.count} certified reports
                    </span>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-[#002D72] group-hover:translate-x-0.5 transition" />
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
