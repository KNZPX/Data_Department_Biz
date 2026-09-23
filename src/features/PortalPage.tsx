"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Compass,
  Cpu,
  Database,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  Flame,
  Globe,
  HardDrive,
  Inbox,
  Info,
  KeyRound,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  LifeBuoy,
  Lightbulb,
  Maximize2,
  Minus,
  MinusCircle,
  MoreVertical,
  Plus,
  PlusCircle,
  Radio,
  RefreshCw,
  Search,
  Server,
  Share2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Thermometer,
  Tv,
  Users,
  Wifi,
  Wind,
  X,
  Zap,
} from "lucide-react";
import { useAuth } from "@/components/auth/LoginGate";
import { useTheme } from "@/context/ThemeContext";
import { DashboardLogModal } from "@/components/powerbi/DashboardLogModal";
import type { PowerBiItem } from "@/lib/powerbiTypes";

export function PortalPage() {
  const { user, dbProvider } = useAuth();
  const { currentTheme, currentCanvas, radiusPreset } = useTheme();

  // Data states
  const [items, setItems] = useState<PowerBiItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLogItem, setSelectedLogItem] = useState<PowerBiItem | null>(null);
  const [activeDrawerItem, setActiveDrawerItem] = useState<PowerBiItem | null>(null);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>("all");
  const [searchFilter, setSearchFilter] = useState<string>("");

  // Interactive Quick Controls (Toggles) matching reference screenshot
  const [toggles, setToggles] = useState({
    pipeline: true,
    scheduledSync: true,
    alerts: false,
    auditLogs: false,
  });

  // Interactive Dial / Gauge Widget State matching reference screenshot
  const [dialValue, setDialValue] = useState<number>(25);
  const [dialActive, setDialActive] = useState<boolean>(true);

  // My Devices / Workspaces Toggles in 2x2 grid
  const [deviceToggles, setDeviceToggles] = useState({
    kpi: true,
    finance: true,
    supply: true,
    crm: true,
  });

  useEffect(() => {
    void fetchReports();
  }, []);

  async function fetchReports() {
    setLoading(true);
    try {
      const res = await fetch("/api/powerbi/reports", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        const rawList = json.data || json.reports || [];
        const reports: PowerBiItem[] = rawList.map((r: any) => ({
          id: r.id,
          kind: "report",
          reportCode: r.reportCode || "",
          reportTitle: r.reportTitle || r.name || "",
          name: r.name || "",
          workspaceId: r.workspaceId || "ws-biz-prod",
          workspaceName: r.workspaceName || "Production BI",
          webUrl: r.webUrl || "#",
          lastPublish: r.lastPublish || r.lastModified || new Date().toISOString(),
        }));
        setItems(reports);
      }
    } catch {
      // Fallback sample items if offline
      setItems([
        {
          id: "rep-01",
          kind: "report",
          reportCode: "FIN-01",
          reportTitle: "Executive Financial & Revenue Overview",
          name: "Executive Financial & Revenue Overview",
          workspaceId: "ws-exec",
          workspaceName: "Executive & Finance",
          webUrl: "#",
          lastPublish: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        },
        {
          id: "rep-02",
          kind: "report",
          reportCode: "CLN-02",
          reportTitle: "Hospital Clinical Operations & Patient Journey",
          name: "Hospital Clinical Operations & Patient Journey",
          workspaceId: "ws-prod",
          workspaceName: "Clinical Operations",
          webUrl: "#",
          lastPublish: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
        },
        {
          id: "rep-03",
          kind: "report",
          reportCode: "LOG-03",
          reportTitle: "Supply Chain & Medical Equipment Inventory",
          name: "Supply Chain & Medical Equipment Inventory",
          workspaceId: "ws-logistics",
          workspaceName: "Logistics & Supply",
          webUrl: "#",
          lastPublish: new Date(Date.now() - 1000 * 60 * 600).toISOString(),
        },
        {
          id: "rep-04",
          kind: "report",
          reportCode: "PHM-04",
          reportTitle: "Pharmacy Dispensing & Medicine Consumption",
          name: "Pharmacy Dispensing & Medicine Consumption",
          workspaceId: "ws-pharmacy",
          workspaceName: "Pharmacy & Labs",
          webUrl: "#",
          lastPublish: new Date(Date.now() - 1000 * 60 * 1440).toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  // Workspaces list
  const workspaces = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    items.forEach((it) => {
      const existing = map.get(it.workspaceId);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(it.workspaceId, {
          id: it.workspaceId,
          name: it.workspaceName || it.workspaceId,
          count: 1,
        });
      }
    });
    return Array.from(map.values());
  }, [items]);

  // Filtered reports
  const filteredReports = useMemo(() => {
    return items.filter((item) => {
      const matchWs = selectedWorkspace === "all" || item.workspaceId === selectedWorkspace;
      const matchSearch =
        !searchFilter.trim() ||
        item.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        item.workspaceName.toLowerCase().includes(searchFilter.toLowerCase());
      return matchWs && matchSearch;
    });
  }, [items, selectedWorkspace, searchFilter]);

  // Dial calculations
  const dialMin = 5;
  const dialMax = 60;
  const dialAngle = ((dialValue - dialMin) / (dialMax - dialMin)) * 260 - 130; // -130deg to +130deg

  const handleDecreaseDial = () => {
    setDialValue((prev) => Math.max(dialMin, prev - 5));
  };

  const handleIncreaseDial = () => {
    setDialValue((prev) => Math.min(dialMax, prev + 5));
  };

  // Team members list
  const members = [
    { name: "Scarlett", role: "Admin", avatar: "S", color: "#6C5CE7" },
    { name: "Noriya", role: "Full Access", avatar: "N", color: "#F59E0B" },
    { name: "Riya", role: "Full Access", avatar: "R", color: "#EC4899" },
    { name: "David", role: "Lead", avatar: "D", color: "#3B82F6" },
    { name: "Elena", role: "Analyst", avatar: "E", color: "#10B981" },
  ];

  return (
    <div className="h-full overflow-y-auto pr-1 space-y-7 pb-16 max-w-7xl mx-auto">
      {/* 2-COLUMN MAIN DASHBOARD (Inspired by Reference Image) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT / CENTER COLUMN (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* 1. GREETING HERO BANNER (Warm Pastel Gradient with Character Illustration) */}
          <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-r from-[#FFF5EB] via-[#FFF0E0] to-[#FFE5CC] p-6 sm:p-8 shadow-xs border border-amber-200/50">
            {/* Background Decorative Rings */}
            <div className="absolute -right-10 -bottom-10 h-48 w-48 rounded-full bg-amber-300/20 blur-2xl pointer-events-none" />
            <div className="absolute left-1/3 top-0 h-32 w-32 rounded-full bg-orange-200/30 blur-xl pointer-events-none" />

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
              <div className="space-y-3 max-w-md">
                <h1 className="text-2xl sm:text-3xl font-bold text-amber-950 font-serif tracking-tight">
                  Hello, {user?.name || "Scarlett"}!
                </h1>
                <p className="text-xs sm:text-sm text-amber-900/80 leading-relaxed font-sans">
                  Welcome to Biz-Analytic Intelligence Portal! All enterprise semantic models, Power BI datasets, and automated refresh pipelines are operational today.
                </p>

                {/* Sub-status pills matching screenshot */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900 bg-white/70 px-3.5 py-1.5 rounded-full shadow-2xs border border-amber-200/60 backdrop-blur-xs">
                    <Thermometer className="h-4 w-4 text-amber-700" />
                    <span>+28°C Bangkok HQ</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900 bg-white/70 px-3.5 py-1.5 rounded-full shadow-2xs border border-amber-200/60 backdrop-blur-xs">
                    <Zap className="h-4 w-4 text-amber-700" />
                    <span>100% Operational Data Sync</span>
                  </div>
                </div>
              </div>

              {/* Friendly Vector Graphic / Illustration */}
              <div className="hidden sm:flex shrink-0 items-center justify-center">
                <div className="relative h-32 w-36 flex items-center justify-center">
                  {/* Decorative Cloud & Sun */}
                  <div className="absolute -top-1 right-2 h-10 w-10 rounded-full bg-amber-400/40 blur-xs" />
                  <div className="relative z-10 flex flex-col items-center">
                    <div
                      style={{
                        backgroundColor: currentTheme.primary,
                        boxShadow: `0 12px 24px -4px ${currentTheme.primaryGlow}`,
                      }}
                      className="h-16 w-16 rounded-3xl flex items-center justify-center text-white text-2xl font-bold shadow-lg transform -rotate-3 hover:rotate-0 transition duration-300"
                    >
                      <Sparkles className="h-8 w-8 text-white animate-pulse" />
                    </div>
                    <span className="mt-2 text-[10px] font-bold text-amber-900/70 tracking-wider uppercase font-mono">
                      Biz-Analytic v2
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. CONTROL SECTION ("Scarlett's Home" -> "Biz-Analytic Control & Workspaces") */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                Biz-Analytic Control & Workspaces
              </h2>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                  <Flame className="h-3.5 w-3.5 text-sky-500" />
                  <span>35% SLA</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                  <Thermometer className="h-3.5 w-3.5 text-amber-500" />
                  <span>15°C Server</span>
                </div>

                {/* Workspace Selector Dropdown */}
                <select
                  value={selectedWorkspace}
                  onChange={(e) => setSelectedWorkspace(e.target.value)}
                  className="rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs border border-slate-200/80 focus:outline-none focus:ring-1 focus:ring-purple-400"
                >
                  <option value="all">All Workspaces</option>
                  {workspaces.map((ws) => (
                    <option key={ws.id} value={ws.id}>
                      {ws.name} ({ws.count})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row of 4 Toggle Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              {/* Card 1: Production Pipeline (Inactive White Card, ON Toggle) */}
              <div className="squircle-card p-4 bg-white flex flex-col justify-between h-32 hover:scale-[1.02] transition">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {toggles.pipeline ? "ON" : "OFF"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setToggles((prev) => ({ ...prev, pipeline: !prev.pipeline }))}
                    className="focus:outline-none"
                  >
                    <div
                      style={{
                        backgroundColor: toggles.pipeline ? currentTheme.primary : "#e2e8f0",
                      }}
                      className="w-10 h-5.5 rounded-full p-0.5 flex items-center transition-colors"
                    >
                      <div
                        className={`w-4.5 h-4.5 rounded-full bg-white shadow-xs transform transition-transform ${
                          toggles.pipeline ? "translate-x-4.5" : "translate-x-0"
                        }`}
                      />
                    </div>
                  </button>
                </div>
                <div>
                  <Database
                    style={{ color: currentTheme.primary }}
                    className="h-6 w-6 mb-1"
                  />
                  <p className="text-xs font-bold text-slate-800">Production Pipeline</p>
                </div>
              </div>

              {/* Card 2: Scheduled Auto-Sync (HIGHLIGHTED VIVID THEME CARD with Glow!) */}
              <div
                style={{
                  background: `linear-gradient(135deg, ${currentTheme.gradientFrom} 0%, ${currentTheme.gradientTo} 100%)`,
                  boxShadow: `0 16px 32px -6px ${currentTheme.primaryGlow}`,
                }}
                className="squircle-card p-4 text-white flex flex-col justify-between h-32 transform -translate-y-1 hover:scale-[1.03] transition duration-200 border-0"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-white/90 uppercase tracking-wider">
                    {toggles.scheduledSync ? "ON" : "OFF"}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setToggles((prev) => ({ ...prev, scheduledSync: !prev.scheduledSync }))
                    }
                    className="focus:outline-none"
                  >
                    <div className="w-10 h-5.5 rounded-full p-0.5 bg-white/30 flex items-center transition-colors">
                      <div
                        className={`w-4.5 h-4.5 rounded-full bg-white shadow-xs transform transition-transform ${
                          toggles.scheduledSync ? "translate-x-4.5" : "translate-x-0"
                        }`}
                      />
                    </div>
                  </button>
                </div>
                <div>
                  <Zap className="h-6 w-6 mb-1 text-white stroke-[2.5]" />
                  <p className="text-xs font-bold text-white">Scheduled Sync</p>
                  <p className="text-[10px] text-white/80">Active Realtime</p>
                </div>
              </div>

              {/* Card 3: Governance Alerts (White Card, OFF Toggle) */}
              <div className="squircle-card p-4 bg-white flex flex-col justify-between h-32 hover:scale-[1.02] transition">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {toggles.alerts ? "ON" : "OFF"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setToggles((prev) => ({ ...prev, alerts: !prev.alerts }))}
                    className="focus:outline-none"
                  >
                    <div
                      style={{
                        backgroundColor: toggles.alerts ? currentTheme.primary : "#e2e8f0",
                      }}
                      className="w-10 h-5.5 rounded-full p-0.5 flex items-center transition-colors"
                    >
                      <div
                        className={`w-4.5 h-4.5 rounded-full bg-white shadow-xs transform transition-transform ${
                          toggles.alerts ? "translate-x-4.5" : "translate-x-0"
                        }`}
                      />
                    </div>
                  </button>
                </div>
                <div>
                  <ShieldCheck className="h-6 w-6 mb-1 text-slate-400" />
                  <p className="text-xs font-bold text-slate-700">Governance Alerts</p>
                </div>
              </div>

              {/* Card 4: Audit Logs (White Card, OFF Toggle) */}
              <div className="squircle-card p-4 bg-white flex flex-col justify-between h-32 hover:scale-[1.02] transition">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {toggles.auditLogs ? "ON" : "OFF"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setToggles((prev) => ({ ...prev, auditLogs: !prev.auditLogs }))}
                    className="focus:outline-none"
                  >
                    <div
                      style={{
                        backgroundColor: toggles.auditLogs ? currentTheme.primary : "#e2e8f0",
                      }}
                      className="w-10 h-5.5 rounded-full p-0.5 flex items-center transition-colors"
                    >
                      <div
                        className={`w-4.5 h-4.5 rounded-full bg-white shadow-xs transform transition-transform ${
                          toggles.auditLogs ? "translate-x-4.5" : "translate-x-0"
                        }`}
                      />
                    </div>
                  </button>
                </div>
                <div>
                  <Activity className="h-6 w-6 mb-1 text-slate-400" />
                  <p className="text-xs font-bold text-slate-700">Audit Stream</p>
                </div>
              </div>
            </div>
          </div>

          {/* 3. INTERACTIVE CIRCULAR DIAL WIDGET ("Living Room Temperature" -> "Refresh Cadence & SLA Gauge") */}
          <div className="squircle-card p-6 sm:p-8 bg-white space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div
                  style={{
                    backgroundColor: currentTheme.primaryLight,
                    color: currentTheme.primary,
                  }}
                  className="grid h-9 w-9 place-items-center rounded-xl"
                >
                  <Zap className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Refresh Cadence & SLA Dial
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Adjust target automated refresh frequency for active Power BI semantic models
                  </p>
                </div>
              </div>

              {/* Master Dial Switch */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600 uppercase">
                  {dialActive ? "ON" : "OFF"}
                </span>
                <button
                  type="button"
                  onClick={() => setDialActive(!dialActive)}
                  className="focus:outline-none"
                >
                  <div
                    style={{
                      backgroundColor: dialActive ? currentTheme.primary : "#e2e8f0",
                    }}
                    className="w-11 h-6 rounded-full p-0.5 flex items-center transition-colors"
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-xs transform transition-transform ${
                        dialActive ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </div>
                </button>
              </div>
            </div>

            {/* Circular Gauge Representation */}
            <div className="flex flex-col sm:flex-row items-center justify-around gap-6 pt-2">
              {/* Minus Button */}
              <button
                type="button"
                onClick={handleDecreaseDial}
                disabled={!dialActive || dialValue <= dialMin}
                className="h-12 w-12 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center transition active:scale-95 disabled:opacity-40"
              >
                <Minus className="h-5 w-5" />
              </button>

              {/* Circular Dial Body */}
              <div className="relative flex flex-col items-center justify-center">
                {/* Dial SVG Ring */}
                <div className="relative h-56 w-56 flex items-center justify-center">
                  <svg className="h-full w-full -rotate-90" viewBox="0 0 200 200">
                    {/* Background Arc */}
                    <circle
                      cx="100"
                      cy="100"
                      r="80"
                      fill="none"
                      stroke="#f1f5f9"
                      strokeWidth="12"
                      strokeDasharray="360 140"
                      strokeLinecap="round"
                    />
                    {/* Active Gradient Arc */}
                    <circle
                      cx="100"
                      cy="100"
                      r="80"
                      fill="none"
                      stroke={currentTheme.primary}
                      strokeWidth="12"
                      strokeDasharray="502"
                      strokeDashoffset={502 - (502 * (dialValue - dialMin)) / (dialMax - dialMin) * 0.72}
                      strokeLinecap="round"
                      className="transition-all duration-300"
                    />
                  </svg>

                  {/* Inner Circular Card with Shadow */}
                  <div className="absolute inset-8 rounded-full bg-white shadow-xl flex flex-col items-center justify-center text-center p-4 border border-slate-100">
                    <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                      {dialValue} min
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">
                      Target Cadence
                    </span>
                  </div>
                </div>

                {/* Range Labels */}
                <div className="w-full flex justify-between px-2 text-[11px] font-bold text-slate-400 mt-2">
                  <span>05 min</span>
                  <span className="text-slate-600">15 min</span>
                  <span style={{ color: currentTheme.primary }}>{dialValue} min (Active)</span>
                  <span>60 min</span>
                </div>
              </div>

              {/* Plus Button in Theme Color */}
              <button
                type="button"
                onClick={handleIncreaseDial}
                disabled={!dialActive || dialValue >= dialMax}
                style={{
                  backgroundColor: currentTheme.primary,
                  boxShadow: `0 10px 20px -4px ${currentTheme.primaryGlow}`,
                }}
                className="h-12 w-12 rounded-2xl text-white font-bold flex items-center justify-center transition active:scale-95 disabled:opacity-40"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (4 cols) matching reference image */}
        <div className="lg:col-span-4 space-y-6">
          {/* 1. MY WORKSPACES / ITEMS (2x2 Colorful Grid) */}
          <div className="squircle-card p-5 bg-white space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">My Workspaces</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                  ON
                </span>
                <ChevronRight className="h-4 w-4 text-slate-400 cursor-pointer" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Violet Card */}
              <div
                style={{
                  backgroundColor: "#6C5CE7",
                  boxShadow: "0 8px 16px -2px rgba(108, 92, 231, 0.3)",
                }}
                className="p-3.5 rounded-2xl text-white flex flex-col justify-between h-28"
              >
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider">ON</span>
                  <span className="h-4 w-7 rounded-full bg-white/30 p-0.5 flex items-center justify-end">
                    <span className="h-3 w-3 rounded-full bg-white" />
                  </span>
                </div>
                <div>
                  <BarChart3 className="h-5 w-5 mb-1" />
                  <p className="text-xs font-bold leading-tight truncate">Executive KPI</p>
                </div>
              </div>

              {/* Yellow/Gold Card */}
              <div
                style={{
                  backgroundColor: "#F59E0B",
                  boxShadow: "0 8px 16px -2px rgba(245, 158, 11, 0.3)",
                }}
                className="p-3.5 rounded-2xl text-white flex flex-col justify-between h-28"
              >
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider">ON</span>
                  <span className="h-4 w-7 rounded-full bg-white/30 p-0.5 flex items-center justify-end">
                    <span className="h-3 w-3 rounded-full bg-white" />
                  </span>
                </div>
                <div>
                  <Flame className="h-5 w-5 mb-1" />
                  <p className="text-xs font-bold leading-tight truncate">Revenue BI</p>
                </div>
              </div>

              {/* Orange/Coral Card */}
              <div
                style={{
                  backgroundColor: "#FB7185",
                  boxShadow: "0 8px 16px -2px rgba(251, 113, 133, 0.3)",
                }}
                className="p-3.5 rounded-2xl text-white flex flex-col justify-between h-28"
              >
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider">ON</span>
                  <span className="h-4 w-7 rounded-full bg-white/30 p-0.5 flex items-center justify-end">
                    <span className="h-3 w-3 rounded-full bg-white" />
                  </span>
                </div>
                <div>
                  <Layers className="h-5 w-5 mb-1" />
                  <p className="text-xs font-bold leading-tight truncate">Supply Chain</p>
                </div>
              </div>

              {/* Cyan Card */}
              <div
                style={{
                  backgroundColor: "#06B6D4",
                  boxShadow: "0 8px 16px -2px rgba(6, 182, 212, 0.3)",
                }}
                className="p-3.5 rounded-2xl text-white flex flex-col justify-between h-28"
              >
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider">ON</span>
                  <span className="h-4 w-7 rounded-full bg-white/30 p-0.5 flex items-center justify-end">
                    <span className="h-3 w-3 rounded-full bg-white" />
                  </span>
                </div>
                <div>
                  <Users className="h-5 w-5 mb-1" />
                  <p className="text-xs font-bold leading-tight truncate">Customer CRM</p>
                </div>
              </div>
            </div>
          </div>

          {/* 2. MEMBERS CARD */}
          <div className="squircle-card p-5 bg-white space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Members & Stewards</h3>
              <Link href="/licenses" className="text-slate-400 hover:text-slate-600 transition">
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="flex items-center justify-between gap-1 overflow-x-auto py-1">
              {members.map((m) => (
                <div key={m.name} className="flex flex-col items-center space-y-1 shrink-0">
                  <div
                    style={{ backgroundColor: m.color }}
                    className="h-10 w-10 rounded-full text-white font-bold text-xs flex items-center justify-center shadow-xs"
                  >
                    {m.avatar}
                  </div>
                  <span className="text-[11px] font-bold text-slate-800">{m.name}</span>
                  <span className="text-[9px] text-slate-400 font-medium">{m.role}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 3. POWER CONSERVED / WORKLOAD BEZIER AREA CHART */}
          <div className="squircle-card p-5 bg-white space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Analytics Workload</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>Month</span>
                  <ChevronDown className="h-3 w-3" />
                </span>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                <span
                  style={{ backgroundColor: currentTheme.primary }}
                  className="h-2.5 w-2.5 rounded-full inline-block"
                />
                <span>Daily Queries</span>
              </span>
              <span className="font-bold text-slate-900">73% Velocity</span>
            </div>

            {/* Smooth Bezier SVG Area Chart */}
            <div className="h-36 w-full pt-2">
              <svg className="h-full w-full overflow-visible" viewBox="0 0 300 120">
                <defs>
                  <linearGradient id="workloadGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={currentTheme.primary} stopOpacity="0.35" />
                    <stop offset="100%" stopColor={currentTheme.primary} stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Grid guidelines */}
                <line x1="0" y1="30" x2="300" y2="30" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="0" y1="60" x2="300" y2="60" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="0" y1="90" x2="300" y2="90" stroke="#f1f5f9" strokeWidth="1" />

                {/* Filled Area */}
                <path
                  d="M 10 95 C 40 70, 60 85, 90 60 C 120 40, 140 75, 170 45 C 200 20, 220 50, 250 15 C 270 30, 285 45, 290 55 L 290 110 L 10 110 Z"
                  fill="url(#workloadGrad)"
                />

                {/* Line Path */}
                <path
                  d="M 10 95 C 40 70, 60 85, 90 60 C 120 40, 140 75, 170 45 C 200 20, 220 50, 250 15 C 270 30, 285 45, 290 55"
                  fill="none"
                  stroke={currentTheme.primary}
                  strokeWidth="3"
                  strokeLinecap="round"
                />

                {/* Peak Dot */}
                <circle
                  cx="250"
                  cy="15"
                  r="5"
                  fill="#ffffff"
                  stroke={currentTheme.primary}
                  strokeWidth="3"
                />
              </svg>

              {/* Month Labels */}
              <div className="flex justify-between text-[10px] text-slate-400 pt-2 font-mono">
                <span>Jan</span>
                <span>Feb</span>
                <span>Mar</span>
                <span>Apr</span>
                <span>May</span>
                <span>Jun</span>
                <span>Jul</span>
                <span>Aug</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* LOWER SECTION: POWER BI REPORTS CATALOG & MAIL INBOX */}
      <div className="squircle-card p-6 sm:p-8 bg-white space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3">
            <div
              style={{
                backgroundColor: currentTheme.primaryLight,
                color: currentTheme.primary,
              }}
              className="grid h-10 w-10 place-items-center rounded-2xl shadow-xs"
            >
              <Inbox className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Power BI Certified Reports Catalog
              </h3>
              <p className="text-xs text-slate-500">
                Showing {filteredReports.length} reports synchronized with Microsoft 365
              </p>
            </div>
          </div>

          {/* Search Input inside Catalog */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filter by report title..."
              className="w-full sm:w-64 rounded-full bg-slate-50 pl-9 pr-4 py-2 text-xs text-slate-700 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-400"
            />
          </div>
        </div>

        {/* Reports List */}
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400 animate-pulse">
            Loading synchronized reports...
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            No reports found matching the selected filter.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredReports.map((report) => (
              <div
                key={report.id}
                onClick={() => setActiveDrawerItem(report)}
                className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3.5 px-3 rounded-2xl hover:bg-slate-50/80 transition cursor-pointer"
              >
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                  <div
                    style={{
                      backgroundColor: currentTheme.primaryLight,
                      color: currentTheme.primary,
                    }}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-xl font-bold text-xs"
                  >
                    BI
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 group-hover:text-purple-600 transition truncate">
                      {report.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                      <span>{report.workspaceName}</span>
                      <span>&bull;</span>
                      <span className="font-mono">
                        {report.lastPublish ? new Date(report.lastPublish).toLocaleDateString() : "Active"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 self-end sm:self-center">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Certified</span>
                  </span>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedLogItem(report);
                    }}
                    className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-semibold text-slate-700 transition"
                  >
                    Logs
                  </button>

                  <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-600 transition" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SLIDE-OUT DETAIL DRAWER */}
      {activeDrawerItem && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setActiveDrawerItem(null)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-white shadow-2xl p-6 flex flex-col justify-between animate-in slide-in-from-right duration-300">
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2.5">
                    <div
                      style={{
                        backgroundColor: currentTheme.primaryLight,
                        color: currentTheme.primary,
                      }}
                      className="grid h-10 w-10 place-items-center rounded-2xl font-bold text-sm"
                    >
                      BI
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{activeDrawerItem.name}</h4>
                      <p className="text-[11px] text-slate-400">{activeDrawerItem.workspaceName}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveDrawerItem(null)}
                    className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-4 text-xs">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                    <p className="font-bold text-slate-800">Report Metadata</p>
                    <div className="space-y-1.5 text-[11px] text-slate-600">
                      <p>
                        <span className="text-slate-400 font-mono">ID:</span>{" "}
                        <span className="font-mono">{activeDrawerItem.id}</span>
                      </p>
                      <p>
                        <span className="text-slate-400 font-mono">Workspace:</span>{" "}
                        {activeDrawerItem.workspaceName}
                      </p>
                      <p>
                        <span className="text-slate-400 font-mono">Endorsement:</span>{" "}
                        <span className="font-semibold text-emerald-600">Certified Model</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 flex gap-3">
                <a
                  href={activeDrawerItem.webUrl || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    backgroundColor: currentTheme.primary,
                    boxShadow: `0 8px 16px -2px ${currentTheme.primaryGlow}`,
                  }}
                  className="flex-1 py-3 rounded-full text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md transition hover:opacity-90"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>Open in Power BI</span>
                </a>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedLogItem(activeDrawerItem);
                    setActiveDrawerItem(null);
                  }}
                  className="px-5 py-3 rounded-full bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition"
                >
                  Logs
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DASHBOARD LOG MODAL */}
      {selectedLogItem && (
        <DashboardLogModal
          item={selectedLogItem}
          onClose={() => setSelectedLogItem(null)}
        />
      )}
    </div>
  );
}
