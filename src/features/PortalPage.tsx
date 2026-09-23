"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useRef } from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  History,
  Inbox,
  LayoutDashboard,
  LayoutGrid,
  Layers,
  Lock,
  Pause,
  Play,
  Search,
  Server,
  Settings,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { clsx } from "clsx";
import { DashboardLogModal } from "@/components/powerbi/DashboardLogModal";
import { usePowerBiItems } from "@/lib/usePowerBiItems";
import type { PowerBiItem } from "@/lib/powerbiTypes";

export function PortalPage() {
  const { state } = usePowerBiItems("/api/powerbi/reports");
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<PowerBiItem | null>(null);

  // Slide state
  const [currentSlide, setCurrentSlide] = useState(0);
  const [autoPlay, setAutoPlay] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const items = useMemo(() => (state.status === "ready" ? state.response.data : []), [state]);

  const workspacesCount = useMemo(
    () => new Set(items.map((i) => i.workspaceName)).size,
    [items]
  );

  // Curate top featured reports
  const featuredReports = useMemo(() => {
    if (items.length === 0) return [];
    const withCode = items.filter((i) => Boolean(i.reportCode));
    return (withCode.length >= 6 ? withCode : items).slice(0, 6);
  }, [items]);

  // Business Analytics functional domains
  const domains = [
    { name: "Executive Strategy & KPI", icon: TrendingUp, count: items.filter(i => i.reportCode?.includes("STG") || i.workspaceName.toLowerCase().includes("executive")).length || 18, desc: "C-level performance scorecards, enterprise OKRs, and market positioning.", color: "text-[#B45309] bg-amber-50 border-amber-200/60" },
    { name: "Commercial & Growth Analytics", icon: BarChart3, count: items.filter(i => i.workspaceName.toLowerCase().includes("mkt") || i.workspaceName.toLowerCase().includes("commercial")).length || 24, desc: "Sales conversion, marketing funnel attribution, and regional growth.", color: "text-emerald-700 bg-emerald-50 border-emerald-200/60" },
    { name: "Operations & Service Delivery", icon: Activity, count: items.filter(i => i.workspaceName.toLowerCase().includes("op")).length || 19, desc: "Resource utilization, process cycle times, and operational SLA tracking.", color: "text-[#D97706] bg-amber-100/50 border-amber-200/60" },
    { name: "Finance, Billing & Revenue", icon: Layers, count: items.filter(i => i.workspaceName.toLowerCase().includes("fin") || i.workspaceName.toLowerCase().includes("rev")).length || 15, desc: "Cash-flow modeling, billing reconciliation, and cost center allocation.", color: "text-indigo-700 bg-indigo-50 border-indigo-200/60" },
    { name: "Customer Insights & Experience", icon: Users, count: items.filter(i => i.workspaceName.toLowerCase().includes("crm") || i.workspaceName.toLowerCase().includes("cust")).length || 12, desc: "Customer lifetime value, retention cohorts, and satisfaction metrics.", color: "text-cyan-700 bg-cyan-50 border-cyan-200/60" },
    { name: "Cross-Functional BI Workspaces", icon: Building2, count: workspacesCount, desc: "Collaborative workspaces across departmental business intelligence hubs.", color: "text-slate-700 bg-slate-50 border-slate-200/60" },
  ];

  const totalSlides = 4;

  const slideTabs = [
    { id: 0, title: "01 Executive Hub", icon: LayoutDashboard },
    { id: 1, title: "02 BI Showcase", icon: Sparkles },
    { id: 2, title: "03 Analytics Hubs", icon: Layers },
    { id: 3, title: "04 Architecture", icon: Server },
  ];

  function nextSlide() {
    setCurrentSlide((prev) => (prev + 1) % totalSlides);
  }

  function prevSlide() {
    setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides);
  }

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowRight") nextSlide();
      if (e.key === "ArrowLeft") prevSlide();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Auto play timer
  useEffect(() => {
    if (!autoPlay) return;
    const timer = setInterval(nextSlide, 7000);
    return () => clearInterval(timer);
  }, [autoPlay]);

  // Touch Swipe for Mobile
  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const diffX = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diffX) > 50) {
      if (diffX > 0) nextSlide();
      else prevSlide();
    }
    touchStartX.current = null;
  }

  return (
    <div
      className="space-y-6 pb-12"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Minimals.cc Floating Slide Controller */}
      <div className="sticky top-16 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/90 p-2.5 shadow-sm border border-slate-200/70 backdrop-blur-md">
        {/* Slide Segment Tabs */}
        <div className="flex flex-wrap items-center gap-1">
          {slideTabs.map((tab) => {
            const Icon = tab.icon;
            const active = currentSlide === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCurrentSlide(tab.id)}
                className={clsx(
                  "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition duration-200 active:scale-95",
                  active
                    ? "bg-[#B45309] text-white shadow-xs"
                    : "text-[#637381] hover:bg-slate-100 hover:text-[#1C252E]"
                )}
              >
                <Icon className={clsx("h-3.5 w-3.5", active ? "text-white" : "text-slate-400")} />
                <span>{tab.title}</span>
              </button>
            );
          })}
        </div>

        {/* Prev / Next & Autoplay Buttons */}
        <div className="flex items-center gap-1.5 ml-auto">
          <button
            type="button"
            onClick={() => setAutoPlay((v) => !v)}
            title={autoPlay ? "Pause Auto Slide" : "Start Auto Slide"}
            className="grid h-8 w-8 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            {autoPlay ? <Pause className="h-3.5 w-3.5 text-[#B45309]" /> : <Play className="h-3.5 w-3.5" />}
          </button>

          <div className="h-4 w-px bg-slate-200 mx-0.5" />

          <button
            type="button"
            onClick={prevSlide}
            title="Previous Slide (or Left Arrow)"
            className="grid h-8 w-8 place-items-center rounded-xl border border-slate-200/80 bg-white text-slate-600 hover:bg-slate-50 hover:text-[#B45309] active:scale-90 transition shadow-2xs"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs font-mono font-bold text-slate-600 px-1">
            {currentSlide + 1} / {totalSlides}
          </span>
          <button
            type="button"
            onClick={nextSlide}
            title="Next Slide (or Right Arrow)"
            className="grid h-8 w-8 place-items-center rounded-xl border border-slate-200/80 bg-white text-slate-600 hover:bg-slate-50 hover:text-[#B45309] active:scale-90 transition shadow-2xs"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Single Page Slide Carousel Window */}
      <div className="relative overflow-hidden rounded-3xl min-h-[580px]">
        {/* SLIDE 0: Executive Command Center & Overview */}
        <div
          className={clsx(
            "transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
            currentSlide === 0
              ? "opacity-100 translate-y-0 relative pointer-events-auto"
              : "opacity-0 translate-y-6 absolute inset-0 pointer-events-none"
          )}
        >
          <div className="space-y-6">
            {/* Hero Banner */}
            <div className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white p-6 sm:p-10 shadow-sm minimals-card">
              <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-[#B45309]/5 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-24 right-1/4 h-96 w-96 rounded-full bg-[#D97706]/5 blur-3xl" />

              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="max-w-2xl space-y-3">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-[#B45309]/10 px-3.5 py-1 text-xs font-bold text-[#B45309] border border-[#B45309]/20 shadow-2xs">
                    <Sparkles className="h-3.5 w-3.5 text-[#D97706]" />
                    <span>Biz-Analytic &bull; Executive Intelligence Command Center</span>
                  </div>
                  <h1 className="text-3xl font-black tracking-tight text-[#1C252E] sm:text-4xl lg:text-5xl leading-tight">
                    Power BI Analytics <span className="text-[#B45309]">&amp; BI Governance</span>
                  </h1>
                  <p className="text-xs sm:text-sm leading-relaxed text-[#637381]">
                    Centralized platform for enterprise Power BI reports, semantic dataset catalogs, automated publish tracking, and cross-functional intelligence for the Biz-Analytic Department.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch md:items-center gap-3 shrink-0">
                  <Link
                    href="/reports"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#B45309] px-6 py-3.5 text-xs font-bold text-white shadow-[0_8px_16px_0_rgba(180,83,9,0.24)] hover:bg-[#92400E] active:scale-[0.98] transition"
                  >
                    <Inbox className="h-4 w-4" />
                    <span>Open Reports &amp; Workspaces</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/settings"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-xs font-bold text-[#1C252E] shadow-2xs hover:bg-slate-50 hover:text-[#B45309] hover:border-[#B45309]/30 active:scale-[0.98] transition"
                  >
                    <Settings className="h-4 w-4 text-[#D97706]" />
                    <span>Settings</span>
                  </Link>
                </div>
              </div>

              {/* Quick Search */}
              <div className="relative z-10 mt-8 pt-5 border-t border-slate-100 max-w-xl">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search certified reports, code (e.g. PKT-STG-001), or owner..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/80 pl-10 pr-28 py-3 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#B45309] focus:ring-2 focus:ring-[#B45309]/10 outline-none transition shadow-2xs"
                  />
                  {search.trim() ? (
                    <Link
                      href={`/reports?q=${encodeURIComponent(search.trim())}`}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg bg-[#B45309] px-3.5 py-1.5 text-[11px] font-bold text-white hover:bg-[#92400E] transition"
                    >
                      Search
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Minimals 4-Metric Grid */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-2xl border border-slate-200/70 bg-white p-5 minimals-card">
                <div className="flex items-center justify-between text-xs font-semibold text-[#637381]">
                  <span>Certified Reports</span>
                  <div className="grid h-8 w-8 place-items-center rounded-xl bg-amber-50 text-[#B45309]">
                    <BarChart3 className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2 text-2xl font-bold font-mono text-[#1C252E]">
                  {state.status === "loading" ? "..." : items.length}
                </div>
                <div className="mt-1 text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>Verified Models</span>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/70 bg-white p-5 minimals-card">
                <div className="flex items-center justify-between text-xs font-semibold text-[#637381]">
                  <span>Workspaces</span>
                  <div className="grid h-8 w-8 place-items-center rounded-xl bg-slate-100 text-slate-700">
                    <LayoutGrid className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2 text-2xl font-bold font-mono text-[#1C252E]">
                  {state.status === "loading" ? "..." : workspacesCount}
                </div>
                <div className="mt-1 text-[11px] text-slate-400 font-medium">
                  Active Department Hubs
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/70 bg-white p-5 minimals-card">
                <div className="flex items-center justify-between text-xs font-semibold text-[#637381]">
                  <span>Licensed Seats</span>
                  <div className="grid h-8 w-8 place-items-center rounded-xl bg-amber-50 text-[#D97706]">
                    <Users className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2 text-2xl font-bold font-mono text-[#1C252E]">308</div>
                <div className="mt-1 text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  <span>32-Col Matrix Ready</span>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/70 bg-white p-5 minimals-card">
                <div className="flex items-center justify-between text-xs font-semibold text-[#637381]">
                  <span>Cloud Database</span>
                  <div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                    <Server className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2 text-base font-bold font-mono text-[#1C252E] truncate">
                  Supabase Cloud
                </div>
                <div className="mt-1 text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>Active &amp; RLS Verified</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SLIDE 1: Certified BI Showcase */}
        <div
          className={clsx(
            "transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
            currentSlide === 1
              ? "opacity-100 translate-y-0 relative pointer-events-auto"
              : "opacity-0 translate-y-6 absolute inset-0 pointer-events-none"
          )}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-[#1C252E] flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-[#D97706]" />
                  <span>Featured &amp; Certified Dashboards</span>
                </h2>
                <p className="text-xs text-[#637381]">
                  High-priority enterprise Power BI dashboards certified by the Biz-Analytic Department
                </p>
              </div>
              <Link
                href="/reports"
                className="text-xs font-semibold text-[#B45309] hover:text-[#92400E] flex items-center gap-1"
              >
                <span>View All ({items.length})</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featuredReports.map((report) => (
                <div
                  key={report.id}
                  className="rounded-2xl border border-slate-200/70 bg-white p-5 minimals-card flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="rounded-full bg-[#B45309]/10 px-2.5 py-0.5 font-mono text-[10px] font-bold text-[#B45309] border border-[#B45309]/20">
                        {report.reportCode || "BIZ-CERTIFIED"}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedItem(report)}
                        title="View Publish History"
                        className="grid h-7 w-7 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-[#B45309] transition"
                      >
                        <History className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-[#1C252E] line-clamp-2 leading-snug">
                        {report.reportTitle}
                      </h3>
                      <p className="text-xs text-[#637381] mt-1 truncate">
                        Workspace: <span className="font-semibold text-slate-700">{report.workspaceName}</span>
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#637381] pt-1.5 border-t border-slate-100">
                      {report.responsibleUser ? (
                        <span className="truncate max-w-[140px]">
                          Owner: <span className="font-medium text-[#1C252E]">{report.responsibleUser}</span>
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
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-50 border border-slate-200 py-2.5 text-xs font-bold text-[#B45309] hover:bg-[#B45309] hover:text-white hover:border-[#B45309] transition shadow-2xs"
                    >
                      <span>Open Report</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* SLIDE 2: Strategic Functional Hubs */}
        <div
          className={clsx(
            "transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
            currentSlide === 2
              ? "opacity-100 translate-y-0 relative pointer-events-auto"
              : "opacity-0 translate-y-6 absolute inset-0 pointer-events-none"
          )}
        >
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-[#1C252E] flex items-center gap-2">
                <Layers className="h-5 w-5 text-[#B45309]" />
                <span>Analytics Domains &amp; Specialized Hubs</span>
              </h2>
              <p className="text-xs text-[#637381]">
                Explore dedicated decision-making workspaces grouped by business functional domain
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {domains.map((dept) => {
                const Icon = dept.icon;
                return (
                  <Link
                    key={dept.name}
                    href={`/reports?dept=${encodeURIComponent(dept.name)}`}
                    className="group rounded-2xl border border-slate-200/70 bg-white p-5 minimals-card flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className={clsx("grid h-11 w-11 place-items-center rounded-2xl border transition group-hover:scale-105", dept.color)}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600 font-mono">
                          {dept.count} reports
                        </span>
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-[#1C252E] group-hover:text-[#B45309] transition">
                          {dept.name}
                        </h4>
                        <p className="text-xs text-[#637381] mt-1 line-clamp-2 leading-relaxed">
                          {dept.desc}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-[#B45309]">
                      <span>Explore Domain</span>
                      <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* SLIDE 3: Architecture & Governance */}
        <div
          className={clsx(
            "transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
            currentSlide === 3
              ? "opacity-100 translate-y-0 relative pointer-events-auto"
              : "opacity-0 translate-y-6 absolute inset-0 pointer-events-none"
          )}
        >
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-bold text-[#1C252E] flex items-center gap-2">
                <Server className="h-5 w-5 text-[#B45309]" />
                <span>Enterprise Architecture &amp; Governance</span>
              </h2>
              <p className="text-xs text-[#637381]">
                Robust, compliant infrastructure designed for autonomous Power BI operations
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {/* Card 1: Auth */}
              <div className="rounded-2xl border border-slate-200/70 bg-white p-6 minimals-card space-y-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-50 text-[#B45309] border border-amber-200/60">
                  <Lock className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-[#1C252E]">Microsoft Entra ID</h3>
                <p className="text-xs leading-relaxed text-[#637381]">
                  OAuth 2.0 PKCE authentication flow connecting to Microsoft 365, ensuring single sign-on security and token encryption.
                </p>
                <div className="pt-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>SSO Gatekeeper Active</span>
                  </span>
                </div>
              </div>

              {/* Card 2: Database */}
              <div className="rounded-2xl border border-slate-200/70 bg-white p-6 minimals-card space-y-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                  <Server className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-[#1C252E]">Supabase Dedicated Cloud</h3>
                <p className="text-xs leading-relaxed text-[#637381]">
                  Dedicated PostgreSQL cloud project with automated Row Level Security (RLS) hosting catalog items, licenses, and changelogs.
                </p>
                <div className="pt-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>4 Tables Online</span>
                  </span>
                </div>
              </div>

              {/* Card 3: Changelog */}
              <div className="rounded-2xl border border-slate-200/70 bg-white p-6 minimals-card space-y-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                  <Clock className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-[#1C252E]">Automated Audit History</h3>
                <p className="text-xs leading-relaxed text-[#637381]">
                  Continuous tracking of dataset publish updates, schema version logs, and report code series governance across workspaces.
                </p>
                <div className="pt-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-200">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Audit Ready</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Action to Settings */}
            <div className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-[#B45309] uppercase tracking-wide">
                  Need to inspect connection tokens or configure database?
                </h4>
                <p className="text-xs text-slate-600">
                  Access the dedicated Settings console to view token expiration, OAuth scopes, and database schemas.
                </p>
              </div>
              <Link
                href="/settings"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#B45309] px-4 py-2 text-xs font-bold text-white hover:bg-[#92400E] active:scale-95 transition shrink-0 shadow-xs"
              >
                <Settings className="h-3.5 w-3.5" />
                <span>Go to Settings</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Item Publish Version Log Modal */}
      {selectedItem ? (
        <DashboardLogModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      ) : null}
    </div>
  );
}
