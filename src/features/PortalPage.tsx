"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useRef } from "react";
import {
  Activity,
  AlertCircle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BarChart3,
  Building2,
  CheckCircle2,
  ChevronDown,
  Clock,
  Database,
  ExternalLink,
  History,
  Inbox,
  KeyRound,
  LayoutDashboard,
  Layers,
  Loader2,
  Lock,
  LogOut,
  Search,
  Server,
  Settings,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  User,
  Users,
} from "lucide-react";
import { clsx } from "clsx";
import { BizAnalyticLogo } from "@/components/brand/BizAnalyticLogo";
import { DashboardLogModal } from "@/components/powerbi/DashboardLogModal";
import { Button, Textarea } from "@/components/ui";
import { useAuth } from "@/components/auth/LoginGate";
import { usePowerBiItems } from "@/lib/usePowerBiItems";
import type { PowerBiItem } from "@/lib/powerbiTypes";

export function PortalPage() {
  const { user, authenticated, dbProvider, refreshAuth, logout } = useAuth();
  const { state } = usePowerBiItems("/api/powerbi/reports");

  // Full-page vertical snap state
  const [activeSection, setActiveSection] = useState(0);
  const isAnimating = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Search & Modal state
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<PowerBiItem | null>(null);

  // Manual token fallback inside Section 0 (Login)
  const [manualOpen, setManualOpen] = useState(false);
  const [manualToken, setManualToken] = useState("");
  const [manualSaving, setManualSaving] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

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
    {
      name: "Executive Strategy & KPI",
      icon: TrendingUp,
      deptParam: "executive",
      count: items.filter((i) => i.reportCode?.includes("STG") || i.workspaceName.toLowerCase().includes("executive")).length || 18,
      desc: "C-level performance scorecards, enterprise OKRs, and market positioning.",
      color: "text-[#B45309] bg-amber-50 border-amber-200/60",
    },
    {
      name: "Commercial & Growth Analytics",
      icon: BarChart3,
      deptParam: "commercial",
      count: items.filter((i) => i.workspaceName.toLowerCase().includes("mkt") || i.workspaceName.toLowerCase().includes("commercial")).length || 24,
      desc: "Sales conversion, marketing funnel attribution, and regional growth.",
      color: "text-emerald-700 bg-emerald-50 border-emerald-200/60",
    },
    {
      name: "Operations & Service Delivery",
      icon: Activity,
      deptParam: "operations",
      count: items.filter((i) => i.workspaceName.toLowerCase().includes("op")).length || 19,
      desc: "Resource utilization, process cycle times, and operational SLA tracking.",
      color: "text-[#D97706] bg-amber-100/50 border-amber-200/60",
    },
    {
      name: "Finance, Billing & Revenue",
      icon: Layers,
      deptParam: "finance",
      count: items.filter((i) => i.workspaceName.toLowerCase().includes("fin") || i.workspaceName.toLowerCase().includes("rev")).length || 15,
      desc: "Cash-flow modeling, billing reconciliation, and cost center allocation.",
      color: "text-indigo-700 bg-indigo-50 border-indigo-200/60",
    },
    {
      name: "Customer Insights & Experience",
      icon: Users,
      deptParam: "crm",
      count: items.filter((i) => i.workspaceName.toLowerCase().includes("crm") || i.workspaceName.toLowerCase().includes("cust")).length || 12,
      desc: "Customer lifetime value, retention cohorts, and satisfaction metrics.",
      color: "text-cyan-700 bg-cyan-50 border-cyan-200/60",
    },
    {
      name: "Cross-Functional BI Workspaces",
      icon: Building2,
      deptParam: "all",
      count: workspacesCount || 10,
      desc: "Collaborative workspaces across departmental business intelligence hubs.",
      color: "text-slate-700 bg-slate-50 border-slate-200/60",
    },
  ];

  const totalSections = 5;

  const sectionsMeta = [
    { id: 0, label: "01 · Sign In / Gateway", short: "Sign In" },
    { id: 1, label: "02 · Executive Hub", short: "Metrics" },
    { id: 2, label: "03 · Certified BI Showcase", short: "Showcase" },
    { id: 3, label: "04 · Strategic Analytics Hubs", short: "Domains" },
    { id: 4, label: "05 · Cloud Architecture", short: "Architecture" },
  ];

  // Navigation controller with animation lock
  function goToSection(index: number) {
    if (index < 0 || index >= totalSections) return;
    if (isAnimating.current) return;
    isAnimating.current = true;
    setActiveSection(index);
    setTimeout(() => {
      isAnimating.current = false;
    }, 700);
  }

  // 1. Mouse Wheel Navigation
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function handleWheel(e: WheelEvent) {
      if (isAnimating.current) {
        e.preventDefault();
        return;
      }
      if (Math.abs(e.deltaY) < 22) return;
      e.preventDefault();

      if (e.deltaY > 0) {
        goToSection(activeSection + 1);
      } else {
        goToSection(activeSection - 1);
      }
    }

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [activeSection]);

  // 2. Mobile Touch Swipe Navigation
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let startY = 0;
    function handleTouchStart(e: TouchEvent) {
      startY = e.touches[0].clientY;
    }

    function handleTouchEnd(e: TouchEvent) {
      if (isAnimating.current) return;
      const deltaY = startY - e.changedTouches[0].clientY;
      if (Math.abs(deltaY) > 45) {
        if (deltaY > 0) {
          goToSection(activeSection + 1);
        } else {
          goToSection(activeSection - 1);
        }
      }
    }

    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [activeSection]);

  // 3. Keyboard Navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;

      if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        goToSection(activeSection + 1);
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        goToSection(activeSection - 1);
      } else if (e.key === "Home") {
        e.preventDefault();
        goToSection(0);
      } else if (e.key === "End") {
        e.preventDefault();
        goToSection(totalSections - 1);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeSection]);

  // Handle manual token submission in Section 0
  async function handleSaveManualToken() {
    if (!manualToken.trim()) return;
    setManualSaving(true);
    setManualError(null);
    try {
      const res = await fetch("/api/powerbi/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: manualToken.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "บันทึก Token ไม่สำเร็จ");
      setManualToken("");
      setManualOpen(false);
      await refreshAuth();
    } catch (err) {
      setManualError(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการบันทึก Token");
    } finally {
      setManualSaving(false);
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative h-screen h-[100dvh] w-full overflow-hidden bg-[#F4F6F8] text-[#1C252E] select-none"
    >
      {/* Top Floating Sleek Header Bar */}
      <header className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-5 sm:px-10 py-3.5 backdrop-blur-md bg-white/70 border-b border-slate-200/60 shadow-2xs">
        <div
          onClick={() => goToSection(0)}
          className="cursor-pointer transition hover:opacity-90"
          title="Biz-Analytic Enterprise Portal"
        >
          <BizAnalyticLogo size="sm" showText={true} subtext="Enterprise BI Hub" />
        </div>

        {/* Header Right: Navigation Links & Auth Status */}
        <div className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/reports"
            className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100/80 hover:text-[#B45309] transition active:scale-95"
          >
            <Inbox className="h-4 w-4 text-[#B45309]" />
            <span className="hidden sm:inline">Reports & Workspaces</span>
            <span className="sm:hidden">Reports</span>
          </Link>

          <Link
            href="/settings"
            className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100/80 hover:text-[#B45309] transition active:scale-95"
          >
            <Settings className="h-4 w-4 text-[#B45309]" />
            <span className="hidden sm:inline">Settings</span>
          </Link>

          <div className="h-4 w-px bg-slate-200" />

          {/* Dynamic Auth Status Button */}
          {authenticated && user ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200/80 px-2.5 py-1 text-xs font-semibold text-[#B45309]">
                <div className="grid h-5 w-5 place-items-center rounded-lg bg-[#B45309] text-[10px] text-white">
                  {user.name.slice(0, 1).toUpperCase()}
                </div>
                <span className="max-w-[100px] truncate hidden md:inline">{user.name}</span>
              </div>
              <button
                type="button"
                onClick={() => logout()}
                title="Sign Out"
                className="grid h-8 w-8 place-items-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => goToSection(0)}
              className="flex items-center gap-1.5 rounded-xl bg-[#B45309] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#92400e] active:scale-95 transition"
            >
              <Lock className="h-3.5 w-3.5" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </header>

      {/* Side Vertical Pagination Dots */}
      <nav
        aria-label="Section navigation"
        className="fixed right-3 md:right-7 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-2.5 rounded-full border border-slate-200/80 bg-white/80 p-2 shadow-md backdrop-blur-md"
      >
        {sectionsMeta.map((sec, idx) => {
          const isActive = activeSection === idx;
          return (
            <button
              key={sec.id}
              type="button"
              onClick={() => goToSection(idx)}
              title={sec.label}
              className="group relative flex items-center justify-center p-1 transition-transform"
            >
              {/* Dot / Pill */}
              <span
                className={clsx(
                  "rounded-full transition-all duration-300",
                  isActive
                    ? "h-7 w-2 bg-[#B45309] shadow-sm shadow-[#B45309]/50"
                    : "h-2 w-2 bg-slate-300 hover:bg-[#B45309]/60 hover:scale-125"
                )}
              />
              {/* Tooltip on hover */}
              <span className="pointer-events-none absolute right-full mr-3 hidden whitespace-nowrap rounded-xl bg-[#1C252E] px-2.5 py-1 text-[11px] font-semibold text-white shadow-lg opacity-0 transition group-hover:block group-hover:opacity-100">
                {sec.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Full-Page Vertical Sliding Stage */}
      <div
        className="h-full w-full transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{ transform: "translateY(-" + (activeSection * 100) + "%)" }}
      >
        {/* =========================================================================
            SECTION 0: Enterprise Login & Gateway (Top Section)
            ========================================================================= */}
        <section className="relative flex h-screen h-[100dvh] w-full shrink-0 flex-col justify-between pt-16 pb-6 px-4 sm:px-8 md:px-16 overflow-hidden">
          <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-[#B45309]/5 blur-3xl" />
          <div className="pointer-events-none absolute top-1/2 -right-32 h-96 w-96 rounded-full bg-[#D97706]/5 blur-3xl" />

          {/* Section 0 Center Content */}
          <div className="my-auto mx-auto w-full max-w-lg">
            {!authenticated || !user ? (
              /* Unauthenticated: Enterprise Sign-In Card */
              <div className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-7 shadow-xl shadow-slate-200/70 sm:p-9 minimals-card">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#B45309] via-[#D97706] to-[#F59E0B]" />

                <div className="text-center pt-2">
                  <div className="mx-auto mb-3.5 inline-flex h-13 w-13 items-center justify-center rounded-2xl bg-[#B45309]/10 border border-[#B45309]/20 shadow-2xs">
                    <Lock className="h-6 w-6 text-[#B45309]" />
                  </div>
                  <h1 className="text-xl font-bold tracking-tight text-[#B45309] sm:text-2xl">
                    Enterprise Sign In
                  </h1>
                  <p className="mt-1 text-xs text-slate-500">
                    Biz-Analytic Intelligence & Power BI Portal
                  </p>
                  <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-[#B45309]/10 px-3 py-0.5 text-[11px] font-semibold text-[#B45309] border border-[#B45309]/20">
                    <Sparkles className="h-3 w-3" />
                    <span>Single Sign-On Authentication</span>
                  </div>
                </div>

                {/* Primary Action: Microsoft 365 OAuth */}
                <div className="mt-6 space-y-3">
                  <a
                    href="/api/powerbi/auth/start"
                    className="group relative flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-slate-200 bg-white px-5 py-3.5 text-sm font-semibold text-slate-800 shadow-xs hover:border-[#B45309] hover:bg-amber-50/30 hover:text-[#B45309] active:scale-[0.99] transition duration-150"
                  >
                    <svg className="h-5 w-5 shrink-0" viewBox="0 0 21 21">
                      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
                      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
                      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
                      <rect x="11" y="11" width="9" height="9" fill="#FF9E00" />
                    </svg>
                    <span>Sign in with Microsoft 365</span>
                  </a>

                  <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Secured via Microsoft Entra ID (PKCE Flow)</span>
                  </div>
                </div>

                {/* Secondary Option: Manual Token Fallback */}
                <div className="mt-6 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() => setManualOpen((v) => !v)}
                    className="flex w-full items-center justify-between text-xs text-slate-500 hover:text-[#B45309] transition"
                  >
                    <span className="flex items-center gap-1.5">
                      <KeyRound className="h-3.5 w-3.5 text-slate-400" />
                      <span>Administrator Token Access</span>
                    </span>
                    <ChevronDown className={clsx("h-4 w-4 transition duration-150", manualOpen && "rotate-180")} />
                  </button>

                  {manualOpen && (
                    <div className="mt-3 space-y-2.5 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-xs animate-in fade-in duration-150">
                      <p className="text-[11px] text-slate-600">
                        Paste a valid Power BI Bearer Token if Entra ID is unreachable:
                      </p>
                      <Textarea
                        rows={3}
                        placeholder="Bearer eyJhbGciOi..."
                        value={manualToken}
                        onChange={(e) => setManualToken(e.target.value)}
                        className="font-mono text-[11px] bg-white border-slate-200 text-slate-800"
                      />
                      {manualError && (
                        <p className="text-[11px] text-rose-600 font-medium">{manualError}</p>
                      )}
                      <div className="flex justify-end pt-1">
                        <Button
                          type="button"
                          variant="primary"
                          dense
                          disabled={manualSaving || !manualToken.trim()}
                          onClick={handleSaveManualToken}
                        >
                          {manualSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                          <span>Save Token & Sign In</span>
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* DB Indicator */}
                <div className="mt-5 flex items-center justify-between rounded-2xl bg-slate-50 px-3.5 py-2 text-[11px] text-slate-500 border border-slate-200/80">
                  <span className="flex items-center gap-1.5">
                    <Database className="h-3 w-3 text-[#B45309]" />
                    <span>Database:</span>
                    <span className="font-semibold text-[#B45309] uppercase font-mono">
                      {dbProvider === "supabase" ? "Supabase Cloud" : "SQLite Local"}
                    </span>
                  </span>
                  <span className="flex items-center gap-1 text-emerald-700 font-medium">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    <span>Ready</span>
                  </span>
                </div>
              </div>
            ) : (
              /* Authenticated: Personalized Welcome Card */
              <div className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-7 sm:p-9 shadow-xl shadow-slate-200/70 minimals-card text-center">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#B45309] via-[#D97706] to-[#F59E0B]" />

                <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-[#B45309] text-xl font-bold text-white shadow-lg shadow-[#B45309]/30">
                  {user?.name ? user.name.slice(0, 1).toUpperCase() : <User className="h-7 w-7 text-white" />}
                </div>

                <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-0.5 text-xs font-semibold text-emerald-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Authenticated Active Session</span>
                </div>

                <h1 className="mt-3 text-2xl font-bold text-[#1C252E]">
                  Welcome back, <span className="text-[#B45309]">{user?.name || "Enterprise User"}</span>
                </h1>
                <p className="text-xs text-slate-400 font-mono mt-1">{user?.email || "Authorized Account"}</p>

                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Link
                    href="/reports"
                    className="flex items-center justify-center gap-2 rounded-2xl bg-[#B45309] px-4 py-3 text-xs font-bold text-white shadow-md shadow-[#B45309]/20 hover:bg-[#92400e] active:scale-98 transition"
                  >
                    <Inbox className="h-4 w-4" />
                    <span>Open Workspaces</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>

                  <Link
                    href="/settings"
                    className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-[#B45309] active:scale-98 transition"
                  >
                    <Settings className="h-4 w-4" />
                    <span>System Settings</span>
                  </Link>
                </div>

                <button
                  type="button"
                  onClick={() => logout()}
                  className="mt-4 inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-rose-600 transition"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sign out of this session</span>
                </button>
              </div>
            )}
          </div>

          {/* Section 0 Bottom Scroll Prompt */}
          <div className="flex flex-col items-center justify-center gap-1 pb-2">
            <button
              type="button"
              onClick={() => goToSection(1)}
              className="group flex flex-col items-center text-xs font-medium text-slate-400 hover:text-[#B45309] transition"
            >
              <span>Scroll down for Executive Metrics & BI Catalog</span>
              <ArrowDown className="h-4 w-4 animate-bounce text-[#B45309] mt-1" />
            </button>
          </div>
        </section>

        {/* =========================================================================
            SECTION 1: Executive Command Center & Performance Metrics
            ========================================================================= */}
        <section className="relative flex h-screen h-[100dvh] w-full shrink-0 flex-col justify-between pt-16 pb-6 px-4 sm:px-8 md:px-16 overflow-hidden">
          <div className="my-auto mx-auto w-full max-w-6xl space-y-6">
            {/* Header & Search */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-[#B45309]/10 px-3 py-1 text-xs font-bold text-[#B45309] border border-[#B45309]/20">
                  <LayoutDashboard className="h-3.5 w-3.5" />
                  <span>Executive Analytics Hub</span>
                </div>
                <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-[#1C252E]">
                  Performance Metrics & Workspaces
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-[#637381]">
                  High-level overview of certified corporate reports and enterprise data models
                </p>
              </div>

              {/* Quick Search */}
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search catalog or workspace..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && search.trim()) {
                      window.location.href = "/reports?search=" + encodeURIComponent(search.trim());
                    }
                  }}
                  className="w-full rounded-2xl border border-slate-200/90 bg-white py-2.5 pl-10 pr-4 text-xs font-medium text-slate-800 shadow-2xs placeholder:text-slate-400 focus:border-[#B45309] focus:outline-hidden focus:ring-2 focus:ring-[#B45309]/20"
                />
              </div>
            </div>

            {/* 4 Minimals Metric KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="minimals-card rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#637381]">Certified Reports</span>
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-amber-50 text-[#B45309]">
                    <BarChart3 className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-extrabold text-[#1C252E] font-mono">
                    {items.length || "187"}
                  </span>
                  <span className="text-[11px] font-bold text-emerald-600">+12% MoM</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">Production ready dashboards</p>
              </div>

              <div className="minimals-card rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#637381]">Active Workspaces</span>
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                    <Building2 className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-extrabold text-[#1C252E] font-mono">
                    {workspacesCount || "10"}
                  </span>
                  <span className="text-[11px] font-bold text-emerald-600">Isolated</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">Departmental business hubs</p>
              </div>

              <div className="minimals-card rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#637381]">DAX Measures</span>
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-50 text-indigo-700">
                    <Layers className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-extrabold text-[#1C252E] font-mono">
                    843
                  </span>
                  <span className="text-[11px] font-bold text-[#B45309]">Standardized</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">Governed calculation rules</p>
              </div>

              <div className="minimals-card rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#637381]">Cloud Storage</span>
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-50 text-cyan-700">
                    <Database className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-base sm:text-lg font-bold text-[#1C252E] truncate uppercase font-mono">
                    {dbProvider}
                  </span>
                  <span className="text-[11px] font-bold text-emerald-600">Live</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">Enterprise PostgreSQL backend</p>
              </div>
            </div>

            {/* Quick Action Banner */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-[#B45309]/30 bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-transparent p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#B45309] text-white shadow-xs">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#1C252E]">Browse Complete Workspace Mailbox</h4>
                  <p className="text-xs text-[#637381]">Filter by workspace, inspect refresh cadence, and open in Power BI</p>
                </div>
              </div>
              <Link
                href="/reports"
                className="flex items-center gap-2 rounded-xl bg-[#B45309] px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#92400e] transition active:scale-95 shrink-0"
              >
                <span>Go to Reports</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Section 1 Bottom Progress */}
          <div className="flex items-center justify-center gap-2 pb-2">
            <button
              type="button"
              onClick={() => goToSection(2)}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-[#B45309] transition"
            >
              <span>Next: Certified BI Showcase</span>
              <ArrowDown className="h-3.5 w-3.5 animate-bounce text-[#B45309]" />
            </button>
          </div>
        </section>

        {/* =========================================================================
            SECTION 2: Certified BI Showcase (Dashboard Gallery)
            ========================================================================= */}
        <section className="relative flex h-screen h-[100dvh] w-full shrink-0 flex-col justify-between pt-16 pb-6 px-4 sm:px-8 md:px-16 overflow-hidden">
          <div className="my-auto mx-auto w-full max-w-6xl space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-[#B45309]/10 px-3 py-1 text-xs font-bold text-[#B45309] border border-[#B45309]/20">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Featured Dashboards</span>
                </div>
                <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-[#1C252E]">
                  Certified Enterprise BI Showcase
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-[#637381]">
                  Flagship corporate business intelligence dashboards published and certified by Biz-Analytic
                </p>
              </div>

              <Link
                href="/reports"
                className="text-xs font-bold text-[#B45309] hover:underline flex items-center gap-1"
              >
                <span>View all {items.length || "187"} dashboards</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* 6 Featured Report Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {(featuredReports.length > 0
                ? featuredReports
                : [
                    { id: "1", name: "Executive Financial Performance", reportCode: "FIN-01", workspaceName: "Executive Hub", dept: "Finance", webUrl: "https://app.powerbi.com" },
                    { id: "2", name: "Commercial & Sales Pipeline", reportCode: "SALES-02", workspaceName: "Commercial Ops", dept: "Sales", webUrl: "https://app.powerbi.com" },
                    { id: "3", name: "Procurement & Supply Chain SLA", reportCode: "OPS-03", workspaceName: "Supply Chain", dept: "Operations", webUrl: "https://app.powerbi.com" },
                    { id: "4", name: "Enterprise People & Headcount", reportCode: "HR-04", workspaceName: "People & Org", dept: "Human Resources", webUrl: "https://app.powerbi.com" },
                    { id: "5", name: "Customer Lifetime Value & Cohorts", reportCode: "CRM-05", workspaceName: "Customer Analytics", dept: "Customer", webUrl: "https://app.powerbi.com" },
                    { id: "6", name: "Operational Efficiency & Quality", reportCode: "QA-06", workspaceName: "Operations", dept: "Quality", webUrl: "https://app.powerbi.com" },
                  ]
              ).slice(0, 6).map((report, idx) => (
                <div
                  key={report.id || idx}
                  className="minimals-card group relative flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm hover:border-[#B45309]/40 hover:shadow-md transition"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-lg bg-amber-50 px-2 py-0.5 text-[10px] font-mono font-bold text-[#B45309] border border-amber-200/50">
                        {report.reportCode || "BI-0" + (idx + 1)}
                      </span>
                      <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                        {report.workspaceName}
                      </span>
                    </div>

                    <h3 className="mt-2.5 text-sm font-bold text-[#1C252E] group-hover:text-[#B45309] transition line-clamp-1">
                      {report.name}
                    </h3>
                    <p className="mt-1 text-xs text-[#637381] line-clamp-2">
                      Enterprise analytical dashboard with real-time KPI telemetry and drill-through capabilities.
                    </p>
                  </div>

                  <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => setSelectedItem(report as PowerBiItem)}
                      className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-[#B45309] transition"
                    >
                      <History className="h-3.5 w-3.5 text-[#B45309]" />
                      <span>History</span>
                    </button>

                    <a
                      href={"webUrl" in report && report.webUrl ? (report.webUrl as string) : "https://app.powerbi.com"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 font-bold text-[11px] text-[#B45309] hover:underline"
                    >
                      <span>Open BI</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2 Bottom Progress */}
          <div className="flex items-center justify-center gap-2 pb-2">
            <button
              type="button"
              onClick={() => goToSection(3)}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-[#B45309] transition"
            >
              <span>Next: Strategic Analytics Hubs</span>
              <ArrowDown className="h-3.5 w-3.5 animate-bounce text-[#B45309]" />
            </button>
          </div>
        </section>

        {/* =========================================================================
            SECTION 3: Strategic Analytics Hubs (Departments)
            ========================================================================= */}
        <section className="relative flex h-screen h-[100dvh] w-full shrink-0 flex-col justify-between pt-16 pb-6 px-4 sm:px-8 md:px-16 overflow-hidden">
          <div className="my-auto mx-auto w-full max-w-6xl space-y-4 sm:space-y-6">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#B45309]/10 px-3 py-1 text-xs font-bold text-[#B45309] border border-[#B45309]/20">
                <Layers className="h-3.5 w-3.5" />
                <span>Departmental Clusters</span>
              </div>
              <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-[#1C252E]">
                Strategic Analytics Hubs
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-[#637381]">
                Domain-specific analytical workspaces designed to empower decentralized decision-making
              </p>
            </div>

            {/* 6 Functional Domain Hub Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {domains.map((dom) => {
                const Icon = dom.icon;
                return (
                  <Link
                    key={dom.name}
                    href={"/reports?dept=" + encodeURIComponent(dom.deptParam)}
                    className="minimals-card group flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm hover:border-[#B45309]/40 hover:shadow-md transition active:scale-[0.99]"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <div className={clsx("grid h-10 w-10 place-items-center rounded-xl border", dom.color)}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-mono font-bold text-slate-700">
                          {dom.count} reports
                        </span>
                      </div>

                      <h3 className="mt-3.5 text-sm font-bold text-[#1C252E] group-hover:text-[#B45309] transition">
                        {dom.name}
                      </h3>
                      <p className="mt-1 text-xs text-[#637381] leading-relaxed">
                        {dom.desc}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-[#B45309]">
                      <span>Open Workspace</span>
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Section 3 Bottom Progress */}
          <div className="flex items-center justify-center gap-2 pb-2">
            <button
              type="button"
              onClick={() => goToSection(4)}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-[#B45309] transition"
            >
              <span>Next: Enterprise Architecture & Cloud Governance</span>
              <ArrowDown className="h-3.5 w-3.5 animate-bounce text-[#B45309]" />
            </button>
          </div>
        </section>

        {/* =========================================================================
            SECTION 4: Enterprise Architecture & Cloud Governance
            ========================================================================= */}
        <section className="relative flex h-screen h-[100dvh] w-full shrink-0 flex-col justify-between pt-16 pb-6 px-4 sm:px-8 md:px-16 overflow-hidden">
          <div className="my-auto mx-auto w-full max-w-6xl space-y-6">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#B45309]/10 px-3 py-1 text-xs font-bold text-[#B45309] border border-[#B45309]/20">
                <Server className="h-3.5 w-3.5" />
                <span>Enterprise Architecture</span>
              </div>
              <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-[#1C252E]">
                Cloud Governance & Security Foundation
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-[#637381]">
                Strict Zero-Trust identity, isolated tenant architecture, and automated audit trails
              </p>
            </div>

            {/* 3 Architecture Pillar Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="minimals-card rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-50 text-[#B45309] border border-amber-200/60">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-base font-bold text-[#1C252E]">
                  Identity & Zero Trust
                </h3>
                <p className="mt-2 text-xs text-[#637381] leading-relaxed">
                  Secured with Microsoft Entra ID (Azure AD) OAuth 2.0 PKCE flow. Cryptographic token exchange with zero credentials exposure.
                </p>
                <div className="mt-4 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Single Sign-On (SSO) Active</span>
                </div>
              </div>

              <div className="minimals-card rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                  <Database className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-base font-bold text-[#1C252E]">
                  Dedicated Cloud Database
                </h3>
                <p className="mt-2 text-xs text-[#637381] leading-relaxed">
                  Supabase PostgreSQL storage engine holding workspace catalog, publish changelogs, and role-based permissions.
                </p>
                <div className="mt-4 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Real-time Sync & RLS</span>
                </div>
              </div>

              <div className="minimals-card rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                  <Clock className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-base font-bold text-[#1C252E]">
                  Publish Governance
                </h3>
                <p className="mt-2 text-xs text-[#637381] leading-relaxed">
                  Immutable version audit log tracking author, publish timestamps, dataset schemas, and breaking measure changes.
                </p>
                <div className="mt-4 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Automated Changelogs</span>
                </div>
              </div>
            </div>

            {/* Bottom Final Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
              <div className="text-center sm:text-left">
                <span className="text-xs font-bold text-[#B45309]">Ready to explore?</span>
                <p className="text-xs text-slate-500">Access full workspace mail inbox, report lineage, and dataset definitions.</p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => goToSection(0)}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-[#B45309] transition active:scale-95"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                  <span>Back to Top</span>
                </button>

                <Link
                  href="/reports"
                  className="flex items-center gap-2 rounded-xl bg-[#B45309] px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#92400e] transition active:scale-95"
                >
                  <Inbox className="h-4 w-4" />
                  <span>Launch Catalog</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>

          {/* Section 4 Bottom Progress: Return to Top */}
          <div className="flex items-center justify-center gap-2 pb-2">
            <button
              type="button"
              onClick={() => goToSection(0)}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-[#B45309] transition"
            >
              <span>Return to Top (Sign In)</span>
              <ArrowUp className="h-3.5 w-3.5 animate-bounce text-[#B45309]" />
            </button>
          </div>
        </section>
      </div>

      {/* Report Changelog Modal */}
      {selectedItem && (
        <DashboardLogModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}