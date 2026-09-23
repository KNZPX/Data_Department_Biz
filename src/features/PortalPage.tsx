"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useRef } from "react";
import {
  Activity,
  AlertCircle,
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  CheckCircle2,
  ChevronDown,
  Clock,
  Command,
  Database,
  ExternalLink,
  Filter,
  History,
  Inbox,
  KeyRound,
  Layers,
  Lock,
  LogOut,
  RefreshCw,
  Search,
  Server,
  Settings,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  User,
  Zap,
} from "lucide-react";
import { clsx } from "clsx";
import { BizAnalyticLogo } from "@/components/brand/BizAnalyticLogo";
import { SpotlightCard } from "@/components/SpotlightCard";
import { useAuth } from "@/components/auth/LoginGate";
import { usePowerBiItems } from "@/lib/usePowerBiItems";
import type { PowerBiItem } from "@/lib/powerbiTypes";

// ----------------------------------------------------------------------------
// Hook: Smooth Number Count-Up Animation (Linear / Vercel style)
// ----------------------------------------------------------------------------
function useCountUp(target: number, duration: number = 1100, decimals: number = 0) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number | null = null;
    let animationFrameId: number;

    function step(timestamp: number) {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      // EaseOutExpo curve
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = ease * target;
      setCount(current);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      }
    }

    animationFrameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrameId);
  }, [target, duration]);

  return decimals > 0 ? count.toFixed(decimals) : Math.round(count).toLocaleString();
}

// ----------------------------------------------------------------------------
// Mock Time-Series Datasets for Different Time Ranges
// ----------------------------------------------------------------------------
const TIME_SERIES_DATA: Record<string, { label: string; req: number; latency: number }[]> = {
  "1h": [
    { label: "14:00", req: 1840, latency: 38 },
    { label: "14:10", req: 2150, latency: 41 },
    { label: "14:20", req: 2940, latency: 45 },
    { label: "14:30", req: 3410, latency: 42 },
    { label: "14:40", req: 2890, latency: 39 },
    { label: "14:50", req: 3820, latency: 44 },
    { label: "15:00", req: 4120, latency: 40 },
  ],
  "24h": [
    { label: "00:00", req: 12000, latency: 36 },
    { label: "04:00", req: 8400, latency: 34 },
    { label: "08:00", req: 45000, latency: 48 },
    { label: "12:00", req: 89000, latency: 52 },
    { label: "16:00", req: 98000, latency: 46 },
    { label: "20:00", req: 54000, latency: 41 },
    { label: "Now", req: 114000, latency: 42 },
  ],
  "7d": [
    { label: "Mon", req: 380000, latency: 44 },
    { label: "Tue", req: 420000, latency: 43 },
    { label: "Wed", req: 510000, latency: 41 },
    { label: "Thu", req: 490000, latency: 42 },
    { label: "Fri", req: 560000, latency: 46 },
    { label: "Sat", req: 210000, latency: 38 },
    { label: "Sun", req: 275000, latency: 39 },
  ],
  "30d": [
    { label: "W1", req: 1850000, latency: 42 },
    { label: "W2", req: 2100000, latency: 45 },
    { label: "W3", req: 2350000, latency: 41 },
    { label: "W4", req: 2845920, latency: 42 },
  ],
};

export function PortalPage() {
  const { user, authenticated, dbProvider, logout } = useAuth();
  const { state } = usePowerBiItems("/api/powerbi/reports");

  // Controls
  const [timeRange, setTimeRange] = useState<"1h" | "24h" | "7d" | "30d">("24h");
  const [search, setSearch] = useState("");
  const [logFilter, setLogFilter] = useState("ALL");

  // Interactive Chart Tooltip State
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const chartSvgRef = useRef<SVGSVGElement>(null);

  const items = useMemo(() => (state.status === "ready" ? state.response.data : []), [state]);
  const workspacesCount = useMemo(() => new Set(items.map((i) => i.workspaceName)).size || 10, [items]);

  // Animated KPI numbers
  const animatedRequests = useCountUp(2845920, 1200);
  const animatedLatency = useCountUp(42, 900);
  const animatedErrorRate = useCountUp(0.04, 1000, 2);
  const animatedWorkspaces = useCountUp(workspacesCount || 10, 800);

  // Chart dataset for current range
  const chartData = TIME_SERIES_DATA[timeRange];
  const maxReq = Math.max(...chartData.map((d) => d.req));
  const minReq = Math.min(...chartData.map((d) => d.req));

  // Generate SVG Path for Area Chart
  const chartPoints = useMemo(() => {
    const width = 680;
    const height = 180;
    const padding = 20;
    const innerWidth = width - padding * 2;
    const innerHeight = height - padding * 2;

    return chartData.map((d, i) => {
      const x = padding + (i / (chartData.length - 1)) * innerWidth;
      const normalizedY = (d.req - minReq) / (maxReq - minReq || 1);
      const y = height - padding - normalizedY * innerHeight;
      return { x, y, data: d };
    });
  }, [chartData, maxReq, minReq]);

  // SVG smooth line path string
  const linePath = useMemo(() => {
    if (chartPoints.length === 0) return "";
    return chartPoints.reduce((acc, pt, i, arr) => {
      if (i === 0) return "M " + pt.x + " " + pt.y;
      const prev = arr[i - 1];
      const cx = (prev.x + pt.x) / 2;
      return acc + " C " + cx + " " + prev.y + ", " + cx + " " + pt.y + ", " + pt.x + " " + pt.y;
    }, "");
  }, [chartPoints]);

  // SVG closed area path string
  const areaPath = useMemo(() => {
    if (chartPoints.length === 0) return "";
    const first = chartPoints[0];
    const last = chartPoints[chartPoints.length - 1];
    return linePath + " L " + last.x + " 170 L " + first.x + " 170 Z";
  }, [chartPoints, linePath]);

  // Chart hover listener
  function handleChartMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!chartSvgRef.current) return;
    const rect = chartSvgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    setMousePos({ x: mouseX, y: mouseY });

    // Find nearest point along X
    let nearestIdx = 0;
    let minDiff = Infinity;
    chartPoints.forEach((pt, idx) => {
      const diff = Math.abs(pt.x - mouseX);
      if (diff < minDiff) {
        minDiff = diff;
        nearestIdx = idx;
      }
    });
    setHoverIndex(nearestIdx);
  }

  // Departmental breakdown for Bar Chart
  const departmentWorkload = [
    { name: "Executive Suite", share: 34, color: "bg-[#B45309]", code: "EXEC" },
    { name: "Commercial & Sales", share: 26, color: "bg-amber-600", code: "COMM" },
    { name: "Operations & Supply", share: 18, color: "bg-emerald-600", code: "OPS" },
    { name: "Finance & Accounting", share: 14, color: "bg-indigo-600", code: "FIN" },
    { name: "People & Org (HR)", share: 8, color: "bg-slate-500", code: "HR" },
  ];

  // System activity & audit logs
  const systemLogs = [
    { id: "LOG-9821", time: "14:52:18", event: "DAX_QUERY_EXEC", target: "STG-EXEC-01 (Executive KPI)", latency: "28ms", status: "SUCCESS" },
    { id: "LOG-9820", time: "14:50:02", event: "TOKEN_PKCE_REFRESH", target: "Microsoft Entra ID (Single Sign-On)", latency: "114ms", status: "SUCCESS" },
    { id: "LOG-9819", time: "14:46:31", event: "DATASET_REFRESH", target: "FIN-REV-04 (Revenue Reconciliation)", latency: "342ms", status: "SYNCING" },
    { id: "LOG-9818", time: "14:41:19", event: "METRIC_CACHE_HIT", target: "843 Governed DAX Measures", latency: "4ms", status: "CACHED" },
    { id: "LOG-9817", time: "14:38:05", event: "CATALOG_HEARTBEAT", target: "Supabase Cloud PostgreSQL DB", latency: "19ms", status: "SUCCESS" },
    { id: "LOG-9816", time: "14:30:44", event: "WORKSPACE_AUDIT", target: "Commercial & Regional Sales Ops", latency: "42ms", status: "SUCCESS" },
  ];

  const filteredLogs = systemLogs.filter((log) => {
    if (logFilter !== "ALL" && log.status !== logFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return log.target.toLowerCase().includes(q) || log.event.toLowerCase().includes(q) || log.id.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] selection:bg-[#B45309] selection:text-white">
      {/* =========================================================================
          1. TOP MINIMAL HEADER BAR (Linear / Vercel Aesthetic)
          ========================================================================= */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Left: Brand Logo & Live System Status Dot */}
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition">
              <BizAnalyticLogo size="sm" showText={true} subtext="Internal Intelligence" />
            </Link>

            <div className="h-4 w-px bg-slate-200 hidden sm:block" />

            {/* Live Status Pill with Pulsing Green Dot */}
            <div className="hidden sm:inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50/70 px-2.5 py-1 text-xs font-medium text-emerald-800">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-[11px] font-semibold">Systems Online · 99.98% SLA</span>
            </div>
          </div>

          {/* Center: Minimalist Search Bar with Keyboard Shortcut */}
          <div className="hidden md:flex relative w-80 items-center">
            <Search className="absolute left-3.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search metrics, reports, audit logs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200/90 bg-slate-50/80 py-1.5 pl-9 pr-9 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#B45309] focus:bg-white focus:outline-hidden transition"
            />
            <span className="absolute right-2.5 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-mono text-slate-400">
              ⌘K
            </span>
          </div>

          {/* Right: Time Range Selector & Navigation Shortcuts */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Time Range Pills */}
            <div className="flex items-center rounded-xl border border-slate-200/80 bg-slate-100/80 p-0.5 text-xs font-semibold">
              {(["1h", "24h", "7d", "30d"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setTimeRange(r)}
                  className={clsx(
                    "rounded-lg px-2.5 py-1 text-[11px] transition-all",
                    timeRange === r
                      ? "bg-white text-[#B45309] font-bold shadow-2xs"
                      : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  {r}
                </button>
              ))}
            </div>

            <div className="h-4 w-px bg-slate-200" />

            {/* Quick Navigation to Reports & Settings */}
            <Link
              href="/reports"
              className="flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-[#B45309] hover:text-[#B45309] transition active:scale-95 shadow-2xs"
            >
              <Inbox className="h-3.5 w-3.5 text-[#B45309]" />
              <span className="hidden sm:inline">Reports</span>
            </Link>

            <Link
              href="/settings"
              title="System Settings"
              className="grid h-8 w-8 place-items-center rounded-xl border border-slate-200/90 bg-white text-slate-500 hover:border-[#B45309] hover:text-[#B45309] transition active:scale-95 shadow-2xs"
            >
              <Settings className="h-3.5 w-3.5" />
            </Link>

            {/* Auth Indicator */}
            {authenticated && user ? (
              <button
                type="button"
                onClick={() => logout()}
                title={"Signed in as " + user.email + " · Click to Sign Out"}
                className="flex items-center gap-1.5 rounded-xl bg-amber-50 border border-amber-200 px-2 py-1 text-xs font-bold text-[#B45309] hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition"
              >
                <div className="grid h-5 w-5 place-items-center rounded-md bg-[#B45309] text-[10px] text-white">
                  {user.name.slice(0, 1).toUpperCase()}
                </div>
                <LogOut className="h-3 w-3" />
              </button>
            ) : (
              <a
                href="/api/powerbi/auth/start"
                className="flex items-center gap-1.5 rounded-xl bg-[#B45309] px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-[#92400e] active:scale-95 transition"
              >
                <Lock className="h-3 w-3" />
                <span>Sign In</span>
              </a>
            )}
          </div>
        </div>
      </header>

      {/* =========================================================================
          MAIN DASHBOARD BODY (Generous White-space & Responsive Grid)
          ========================================================================= */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Section Heading & Refresh Timestamp */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-5">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0F172A]">
              System Telemetry & Analytics Dashboard
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-500">
              Real-time service health, query workload latency, and internal corporate reporting telemetry.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Clock className="h-3.5 w-3.5" />
            <span>Updated just now</span>
            <span className="text-slate-300">&bull;</span>
            <span className="font-mono text-slate-600 font-semibold uppercase">{dbProvider}</span>
          </div>
        </div>

        {/* =======================================================================
            ROW 1: 4 KPI CARDS WITH SPOTLIGHT EFFECT & MINI SPARKLINES
            ======================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* KPI 1: Total Requests */}
          <SpotlightCard className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Total API Throughput</span>
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-amber-50 text-[#B45309]">
                <Zap className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 font-mono">
                {animatedRequests}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-0.5">
                <ArrowUpRight className="h-3 w-3" />
                <span>+14.2% MoM</span>
              </span>
              {/* Mini Sparkline SVG */}
              <svg className="h-5 w-20 overflow-visible" viewBox="0 0 80 20">
                <path
                  d="M 0 16 Q 20 18, 40 8 T 80 4"
                  fill="none"
                  stroke="#B45309"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </SpotlightCard>

          {/* KPI 2: Average Latency */}
          <SpotlightCard className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Avg Query Latency</span>
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                <Activity className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 font-mono">
                {animatedLatency}ms
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-0.5">
                <ArrowDown className="h-3 w-3" />
                <span>-8.4% faster</span>
              </span>
              {/* Mini Sparkline SVG */}
              <svg className="h-5 w-20 overflow-visible" viewBox="0 0 80 20">
                <path
                  d="M 0 6 Q 25 18, 50 14 T 80 16"
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </SpotlightCard>

          {/* KPI 3: Error Rate */}
          <SpotlightCard className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">System Error Rate</span>
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-50 text-indigo-700">
                <ShieldCheck className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 font-mono">
                {animatedErrorRate}%
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500">
                <span>99.96% Uptime</span>
              </span>
              {/* Mini Sparkline SVG */}
              <svg className="h-5 w-20 overflow-visible" viewBox="0 0 80 20">
                <path
                  d="M 0 16 L 30 16 L 35 8 L 40 16 L 80 16"
                  fill="none"
                  stroke="#6366F1"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </SpotlightCard>

          {/* KPI 4: Active Workspaces */}
          <SpotlightCard className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Active BI Workspaces</span>
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-cyan-50 text-cyan-700">
                <Building2 className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 font-mono">
                {animatedWorkspaces}
              </span>
              <span className="text-xs font-medium text-slate-400">isolated</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-0.5">
                <CheckCircle2 className="h-3 w-3" />
                <span>All Synced</span>
              </span>
              {/* Mini Sparkline SVG */}
              <svg className="h-5 w-20 overflow-visible" viewBox="0 0 80 20">
                <path
                  d="M 0 15 Q 30 12, 55 7 T 80 4"
                  fill="none"
                  stroke="#06B6D4"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </SpotlightCard>
        </div>

        {/* =======================================================================
            ROW 2: MAIN AREA CHART & DEPARTMENT RESOURCE DISTRIBUTION
            ======================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Main Workload Trends Area Chart */} 
          <SpotlightCard className="lg:col-span-2 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Workload Query Throughput</h2>
                <p className="text-xs text-slate-500">API queries and Power BI telemetry over time ({timeRange})</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                  <span className="h-2 w-2 rounded-full bg-[#B45309]" />
                  <span>Requests / Time</span>
                </span>
              </div>
            </div>

            {/* Interactive SVG Chart Canvas with Crosshair */} 
            <div className="relative mt-4 h-56 w-full select-none">
              <svg
                ref={chartSvgRef}
                viewBox="0 0 680 180"
                preserveAspectRatio="none"
                onMouseMove={handleChartMouseMove}
                onMouseLeave={() => setHoverIndex(null)}
                className="h-full w-full overflow-visible cursor-crosshair"
              >
                <defs>
                  {/* Area Fill Gradient */} 
                  <linearGradient id="areaGlow" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#B45309" stopOpacity="0.25" />
                    <stop offset="60%" stopColor="#B45309" stopOpacity="0.05" />
                    <stop offset="100%" stopColor="#B45309" stopOpacity="0.00" />
                  </linearGradient>
                </defs>

                {/* Background Horizontal Grid Lines */} 
                <line x1="20" y1="40" x2="660" y2="40" stroke="#F1F5F9" strokeWidth="1" />
                <line x1="20" y1="90" x2="660" y2="90" stroke="#F1F5F9" strokeWidth="1" />
                <line x1="20" y1="140" x2="660" y2="140" stroke="#F1F5F9" strokeWidth="1" />

                {/* Filled Gradient Area */} 
                <path d={areaPath} fill="url(#areaGlow)" />

                {/* Smooth Bézier Stroke Line */} 
                <path
                  d={linePath}
                  fill="none"
                  stroke="#B45309"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  className="transition-all duration-300"
                />

                {/* Crosshair Dotted Guideline & Point Highlight */} 
                {hoverIndex !== null && chartPoints[hoverIndex] && (
                  <g>
                    {/* Vertical guideline */} 
                    <line
                      x1={chartPoints[hoverIndex].x}
                      y1="20"
                      x2={chartPoints[hoverIndex].x}
                      y2="170"
                      stroke="#94A3B8"
                      strokeWidth="1.2"
                      strokeDasharray="3 3"
                    />
                    {/* Outer pulse circle */} 
                    <circle
                      cx={chartPoints[hoverIndex].x}
                      cy={chartPoints[hoverIndex].y}
                      r="6"
                      fill="#B45309"
                      opacity="0.3"
                    />
                    {/* Inner solid circle */} 
                    <circle
                      cx={chartPoints[hoverIndex].x}
                      cy={chartPoints[hoverIndex].y}
                      r="3.5"
                      fill="#FFFFFF"
                      stroke="#B45309"
                      strokeWidth="2"
                    />
                  </g>
                )}
              </svg>

              {/* Dynamic Floating Crosshair Tooltip */} 
              {hoverIndex !== null && chartPoints[hoverIndex] && (
                <div
                  className="pointer-events-none absolute -top-2 z-20 -translate-x-1/2 -translate-y-full rounded-xl bg-slate-900 px-3 py-2 text-white shadow-xl"
                  style={{ left: (chartPoints[hoverIndex].x / 680) * 100 + "%" }}
                >
                  <div className="text-[10px] font-mono text-slate-400">{chartPoints[hoverIndex].data.label}</div>
                  <div className="mt-0.5 text-xs font-bold font-mono text-amber-400">
                    {chartPoints[hoverIndex].data.req.toLocaleString()} reqs
                  </div>
                  <div className="text-[10px] text-emerald-400 font-mono">
                    Latency: {chartPoints[hoverIndex].data.latency}ms
                  </div>
                </div>
              )}
            </div>

            {/* X-Axis Labels */} 
            <div className="mt-2 flex justify-between px-4 text-[10px] font-mono text-slate-400 border-t border-slate-100 pt-2">
              {chartData.map((d) => (
                <span key={d.label}>{d.label}</span>
              ))}
            </div>
          </SpotlightCard>

          {/* Right 1 Col: Department Distribution Bar Chart */} 
          <SpotlightCard className="p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Departmental Workload</h2>
                  <p className="text-xs text-slate-500">Resource distribution across functional units</p>
                </div>
                <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-mono font-bold text-slate-600">
                  100%
                </span>
              </div>

              {/* Horizontal Breakdown Bars */} 
              <div className="mt-5 space-y-4">
                {departmentWorkload.map((dept) => (
                  <div key={dept.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">{dept.name}</span>
                      <span className="font-mono font-bold text-slate-900">{dept.share}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={"h-full rounded-full transition-all duration-700 " + dept.color}
                        style={{ width: dept.share + "%" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Action Button */} 
            <div className="pt-4 border-t border-slate-100 mt-6">
              <Link
                href="/reports"
                className="flex items-center justify-between text-xs font-bold text-[#B45309] hover:underline"
              >
                <span>Open Complete Workspace Catalog</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </SpotlightCard>
        </div>

        {/* =======================================================================
            ROW 3: RECENT ACTIVITY & AUDIT LOGS TABLE
            ======================================================================= */}
        <SpotlightCard className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Recent System Activity & Audit Logs</h2>
              <p className="text-xs text-slate-500">Live transaction logs, published reports, and identity auth events</p>
            </div>

            {/* Status Filters */} 
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <span className="text-slate-400 text-[11px] mr-1">Filter:</span>
              {(["ALL", "SUCCESS", "SYNCING", "CACHED"] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setLogFilter(filter)}
                  className={clsx(
                    "rounded-lg px-2.5 py-1 text-[11px] transition",
                    logFilter === filter
                      ? "bg-slate-900 text-white font-bold"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {/* Modern Monospace Logs Table */} 
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Transaction ID</th>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Action Event</th>
                  <th className="py-2.5 px-3">Target / Object</th>
                  <th className="py-2.5 px-3">Latency</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {filteredLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-slate-50/70 transition-colors duration-150"
                  >
                    <td className="py-3 px-3 font-bold text-slate-900">{log.id}</td>
                    <td className="py-3 px-3 text-slate-500">{log.time}</td>
                    <td className="py-3 px-3 font-semibold text-[#B45309]">
                      {log.event}
                    </td>
                    <td className="py-3 px-3 font-sans text-slate-700 font-medium">
                      {log.target}
                    </td>
                    <td className="py-3 px-3 text-slate-600">{log.latency}</td>
                    <td className="py-3 px-3 text-right">
                      <span
                        className={clsx(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold font-sans",
                          log.status === "SUCCESS" && "bg-emerald-50 text-emerald-700 border border-emerald-200",
                          log.status === "SYNCING" && "bg-blue-50 text-blue-700 border border-blue-200",
                          log.status === "CACHED" && "bg-amber-50 text-[#B45309] border border-amber-200"
                        )}
                      >
                        <span
                          className={clsx(
                            "h-1.5 w-1.5 rounded-full",
                            log.status === "SUCCESS" && "bg-emerald-500",
                            log.status === "SYNCING" && "bg-blue-500 animate-pulse",
                            log.status === "CACHED" && "bg-amber-500"
                          )}
                        />
                        <span>{log.status}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SpotlightCard>
      </main>

      {/* Global Clean Modern SaaS Footer */} 
      <footer className="mt-12 border-t border-slate-200/80 bg-white py-6 text-xs text-slate-400">
        <div className="mx-auto flex max-w-7xl flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#B45309]">BIZ-ANALYTIC</span>
            <span>&bull;</span>
            <span>Enterprise Internal Analytics & Admin Dashboard</span>
          </div>
          <div className="flex items-center gap-4 text-slate-500">
            <Link href="/reports" className="hover:text-[#B45309] transition">Workspaces</Link>
            <Link href="/settings" className="hover:text-[#B45309] transition">Settings</Link>
            <span>PostgreSQL Engine Live</span>
          </div>
        </div>
      </footer>
    </div>
  );
}