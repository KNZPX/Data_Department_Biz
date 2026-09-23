"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import {
  Activity,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Database,
  ExternalLink,
  Filter,
  FunctionSquare,
  History,
  Home,
  Inbox,
  KeyRound,
  LayoutGrid,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import { clsx } from "clsx";
import { TokenModal } from "@/components/TokenModal";
import { LoginGate, useAuth } from "@/components/auth/LoginGate";
import { useTheme } from "@/context/ThemeContext";

function AppShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, dbProvider, logout, refreshAuth } = useAuth();
  const { currentTheme, currentCanvas } = useTheme();

  const [tokenOpen, setTokenOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  // Notification / Audit Events Popup State
  const [auditPopupOpen, setAuditPopupOpen] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logFilter, setLogFilter] = useState<"all" | "publish" | "update">("all");
  const [logSearch, setLogSearch] = useState("");
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const popupRef = useRef<HTMLDivElement>(null);

  // Load saved sidebar state
  useEffect(() => {
    const saved = localStorage.getItem("portal_sidebar_collapsed");
    if (saved !== null) {
      setCollapsed(saved === "true");
    }
  }, []);

  function toggleSidebar() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("portal_sidebar_collapsed", String(next));
      return next;
    });
  }

  useEffect(() => {
    void fetchLogs();
    const interval = setInterval(fetchLogs, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Close popup when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setAuditPopupOpen(false);
      }
    }
    if (auditPopupOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [auditPopupOpen]);

  async function fetchLogs() {
    setLoadingLogs(true);
    try {
      const logRes = await fetch("/api/powerbi/changelog?limit=40", { cache: "no-store" });
      if (logRes.ok) {
        const logJson = await logRes.json();
        const fetchedLogs = logJson.logs || [];
        setLogs(fetchedLogs);

        const saved = localStorage.getItem("powerbi_read_log_ids");
        const readSet = new Set(saved ? JSON.parse(saved) : []);
        const unread = fetchedLogs.filter((l: { id: string }) => !readSet.has(l.id)).length;
        setUnreadCount(unread);
      }
    } catch {
    } finally {
      setLoadingLogs(false);
    }
  }

  function handleMarkAllRead() {
    const allIds = logs.map((l) => l.id);
    localStorage.setItem("powerbi_read_log_ids", JSON.stringify(allIds));
    setUnreadCount(0);
  }

  // Filtered logs inside popup
  const filteredLogs = logs.filter((log) => {
    const matchType =
      logFilter === "all" ||
      (logFilter === "publish" && (log.change_type === "PUBLISH" || log.change_type === "VERSION_UPDATE")) ||
      (logFilter === "update" && log.change_type === "METADATA_UPDATE");
    const matchSearch =
      !logSearch.trim() ||
      (log.item_name && log.item_name.toLowerCase().includes(logSearch.toLowerCase())) ||
      (log.summary && log.summary.toLowerCase().includes(logSearch.toLowerCase())) ||
      (log.responsible_user && log.responsible_user.toLowerCase().includes(logSearch.toLowerCase()));
    return matchType && matchSearch;
  });

  const publishCount = logs.filter(
    (l) => l.change_type === "PUBLISH" || l.change_type === "VERSION_UPDATE"
  ).length;
  const updateCount = logs.filter((l) => l.change_type === "METADATA_UPDATE").length;

  // Navigation Items with Page Names and Subtitles
  const navItems = [
    { href: "/reports", label: "Power BI Catalog", sub: "465 Workspaces & Reports", icon: LayoutGrid },
    { href: "/dax", label: "DAX Management", sub: "D01 & D02 Semantic Models", icon: FunctionSquare },
    { href: "/whiteboard", label: "Whiteboard", sub: "Miro-Style Workflow Canvas", icon: Workflow },
    { href: "/licenses", label: "Team & Licenses", sub: "Capacity & Group Governance", icon: Users },
    { href: "/users", label: "User Management", sub: "Login Activity & Audit Logs", icon: ShieldCheck },
    { href: "/settings", label: "System Settings", sub: "Database & OAuth Config", icon: Settings },
  ];

  // Current active page name
  const activeNavItem = navItems.find((item) =>
    pathname === "/" ? item.href === "/reports" : pathname.startsWith(item.href)
  ) || navItems[0];

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#F4F6FB] text-slate-800 flex flex-col font-sans select-none">
      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs md:hidden transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* TOP HEADER OF THE WEBSITE */}
      <header className="h-16 shrink-0 bg-white border-b border-slate-200/80 px-4 md:px-6 flex items-center justify-between gap-4 z-30 shadow-2xs">
        <div className="flex items-center gap-3 md:gap-5">
          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            style={{ backgroundColor: currentTheme.primary }}
            className="grid md:hidden h-9 w-9 place-items-center rounded-xl text-white shadow-xs"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Brand Logo & Name */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div
              style={{
                background: `linear-gradient(135deg, ${currentTheme.gradientFrom} 0%, ${currentTheme.gradientTo} 100%)`,
                boxShadow: `0 4px 10px -2px ${currentTheme.primaryGlow}`,
              }}
              className="h-9 w-9 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-xs"
            >
              BA
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="font-extrabold text-xs text-slate-900 tracking-tight leading-tight">
                BIZ-ANALYTIC
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Enterprise BI Portal</span>
            </div>
          </Link>

          {/* Active Page Name Breadcrumb */}
          <div className="hidden lg:flex items-center gap-2 border-l border-slate-200 pl-4 text-xs">
            <span className="text-slate-400 font-medium">Platform</span>
            <span className="text-slate-300">/</span>
            <span className="font-bold text-slate-900">{activeNavItem.label}</span>
            <span className="text-[11px] text-slate-400 hidden xl:inline">({activeNavItem.sub})</span>
          </div>

          {/* Operational Status Pill */}
          <div className="hidden xl:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-800">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Operational &bull; 465 Reports Cached in Supabase</span>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-3">
          {/* Global Search Pill */}
          <div className="relative hidden md:flex items-center">
            <Search className="absolute left-3.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && searchQuery.trim()) {
                  router.push(`/reports?q=${encodeURIComponent(searchQuery.trim())}`);
                }
              }}
              placeholder="Search reports, metrics, DAX..."
              className="w-52 lg:w-72 rounded-full bg-slate-50 pl-9 pr-4 py-1.5 text-xs text-slate-700 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-400 transition"
            />
          </div>

          {/* Notification Bell (Audit Events Popover Box) */}
          <div className="relative" ref={popupRef}>
            <button
              type="button"
              onClick={() => setAuditPopupOpen(!auditPopupOpen)}
              title="Audit & Version Events"
              className={clsx(
                "relative h-9 w-9 rounded-full bg-slate-50 border flex items-center justify-center transition",
                auditPopupOpen
                  ? "border-slate-800 text-slate-900 bg-white shadow-sm"
                  : "border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              )}
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span
                  style={{ backgroundColor: currentTheme.primary }}
                  className="absolute -top-1 -right-1 h-4.5 min-w-4.5 px-1 rounded-full text-[9px] font-bold text-white flex items-center justify-center border-2 border-white shadow-xs animate-pulse"
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {/* AUDIT EVENTS POPUP BOX (100% English) */}
            {auditPopupOpen && (
              <div className="absolute right-0 top-11 w-80 sm:w-96 md:w-[420px] max-h-[520px] rounded-3xl bg-white shadow-2xl border border-slate-200 z-50 flex flex-col animate-in fade-in slide-in-from-top-2 duration-200">
                {/* Popup Header */}
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      style={{
                        backgroundColor: currentTheme.primaryLight,
                        color: currentTheme.primary,
                      }}
                      className="grid h-8 w-8 place-items-center rounded-xl font-bold"
                    >
                      <History className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Audit & Version Events</h4>
                      <p className="text-[10px] text-slate-400">
                        {logs.length} Total Events &bull; {unreadCount} Unread
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        className="text-[10px] font-bold text-blue-600 hover:underline"
                      >
                        Mark all read
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setAuditPopupOpen(false)}
                      className="h-7 w-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-400"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Filter Tabs & Search */}
                <div className="p-3 bg-slate-50/70 border-b border-slate-100 space-y-2">
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setLogFilter("all")}
                      className={clsx(
                        "px-3 py-1 rounded-full font-bold transition",
                        logFilter === "all"
                          ? "bg-slate-900 text-white shadow-xs"
                          : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                      )}
                    >
                      All ({logs.length})
                    </button>

                    <button
                      type="button"
                      onClick={() => setLogFilter("publish")}
                      className={clsx(
                        "px-3 py-1 rounded-full font-bold transition",
                        logFilter === "publish"
                          ? "bg-emerald-700 text-white shadow-xs"
                          : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                      )}
                    >
                      Publishes ({publishCount})
                    </button>

                    <button
                      type="button"
                      onClick={() => setLogFilter("update")}
                      className={clsx(
                        "px-3 py-1 rounded-full font-bold transition",
                        logFilter === "update"
                          ? "bg-amber-600 text-white shadow-xs"
                          : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                      )}
                    >
                      Updates ({updateCount})
                    </button>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                    <input
                      type="text"
                      value={logSearch}
                      onChange={(e) => setLogSearch(e.target.value)}
                      placeholder="Search event title or author..."
                      className="w-full rounded-full bg-white pl-7 pr-3 py-1.5 text-[11px] text-slate-700 border border-slate-200 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Scrollable Event List */}
                <div className="flex-1 overflow-y-auto max-h-72 p-2 divide-y divide-slate-100">
                  {loadingLogs ? (
                    <div className="py-8 text-center text-xs text-slate-400">Loading events...</div>
                  ) : filteredLogs.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">No events found.</div>
                  ) : (
                    filteredLogs.map((log) => {
                      const isPublish =
                        log.change_type === "PUBLISH" || log.change_type === "VERSION_UPDATE";
                      return (
                        <div
                          key={log.id}
                          className="p-2.5 rounded-2xl hover:bg-slate-50 transition space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className={clsx(
                                "px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase",
                                isPublish
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-amber-100 text-amber-800"
                              )}
                            >
                              {isPublish ? "PUBLISH" : "UPDATE"}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {new Date(log.created_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>

                          <p className="text-xs font-bold text-slate-800 leading-snug line-clamp-2">
                            {log.summary || log.item_name}
                          </p>

                          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                            <span>Author: {log.responsible_user || "Automated Pipeline"}</span>
                            <span className="font-mono">
                              {new Date(log.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Popup Footer */}
                <div className="p-3 border-t border-slate-100 bg-slate-50/50 rounded-b-3xl flex items-center justify-between text-[11px]">
                  <button
                    type="button"
                    onClick={() => void fetchLogs()}
                    className="flex items-center gap-1 text-slate-500 hover:text-slate-800"
                  >
                    <RefreshCw className={clsx("h-3 w-3", loadingLogs && "animate-spin")} />
                    <span>Refresh Feed</span>
                  </button>
                  <span className="text-slate-400">Live Microsoft Entra ID Stream</span>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Pill with Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="flex items-center gap-2 rounded-full bg-slate-50 pl-1 pr-3 py-1 border border-slate-200 hover:bg-slate-100 transition"
            >
              <div
                style={{
                  backgroundColor: currentTheme.primary,
                  boxShadow: `0 4px 8px -2px ${currentTheme.primaryGlow}`,
                }}
                className="h-7 w-7 rounded-full text-white font-bold text-xs flex items-center justify-center"
              >
                {user?.name ? user.name.slice(0, 1).toUpperCase() : "A"}
              </div>
              <span className="text-xs font-bold text-slate-800 max-w-[100px] truncate hidden sm:inline">
                {user?.name || "Analyst"}
              </span>
              <ChevronDown className="h-3 w-3 text-slate-400" />
            </button>

            {/* Dropdown Menu */}
            {userDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white p-2 shadow-xl border border-slate-100 z-50 text-xs animate-in fade-in">
                <div className="px-3 py-2 border-b border-slate-100">
                  <p className="font-bold text-slate-800 truncate">{user?.name || "Biz Analyst"}</p>
                  <p className="text-[10px] text-slate-400 truncate font-mono">{user?.email || "analyst@bizanalytic.com"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setUserDropdownOpen(false);
                    setTokenOpen(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-50 transition text-left"
                >
                  <KeyRound className="h-4 w-4 text-blue-600" />
                  <span>Inspect OAuth Token</span>
                </button>
                <Link
                  href="/settings"
                  onClick={() => setUserDropdownOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-50 transition"
                >
                  <Settings className="h-4 w-4 text-slate-500" />
                  <span>System Settings</span>
                </Link>
                <button
                  type="button"
                  onClick={() => logout()}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 transition text-left font-semibold"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* BODY VIEWPORT (Fixed Fullscreen, No Outer Vertical Scrollbar) */}
      <div className="flex flex-1 overflow-hidden min-h-0 relative">
        {/* EXPANDABLE LEFT NAVBAR SIDEBAR */}
        <aside
          className={clsx(
            "h-full z-40 bg-white border-r border-slate-200/80 transition-all duration-300 ease-in-out shrink-0 flex flex-col justify-between py-4 shadow-xs",
            collapsed ? "w-20" : "w-64",
            mobileOpen ? "fixed inset-y-0 left-0 z-50" : "hidden md:flex"
          )}
        >
          {/* Top Section: Expand Toggle and Nav Links */}
          <div className="flex flex-col space-y-4">
            {/* Expand / Collapse Control Button */}
            <div className={clsx("flex items-center px-4", collapsed ? "justify-center" : "justify-between")}>
              {!collapsed && (
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Navigation
                </span>
              )}
              <button
                type="button"
                onClick={toggleSidebar}
                title={collapsed ? "Expand sidebar (Reveal Page Names)" : "Collapse sidebar"}
                className="h-8 w-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition"
              >
                {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              </button>
            </div>

            {/* Nav Items List */}
            <nav className="flex flex-col space-y-1.5 px-3">
              {navItems.map((item) => {
                const active = pathname === "/" ? item.href === "/reports" : pathname.startsWith(item.href);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    title={collapsed ? `${item.label} (${item.sub})` : undefined}
                    className={clsx(
                      "flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-all duration-150",
                      active
                        ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                      collapsed && "justify-center px-0"
                    )}
                  >
                    <Icon className={clsx("h-5 w-5 shrink-0", active ? "text-white stroke-[2.4]" : "text-slate-500")} />

                    {!collapsed && (
                      <div className="flex flex-col min-w-0 leading-tight">
                        <span className="text-xs font-bold truncate">{item.label}</span>
                        <span className={clsx("text-[10px] truncate", active ? "text-blue-100 font-normal" : "text-slate-400")}>
                          {item.sub}
                        </span>
                      </div>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Bottom Actions: Token Inspector & Sign Out */}
          <div className="border-t border-slate-100 pt-3 px-3 space-y-2">
            {!collapsed && (
              <div className="flex items-center gap-2 px-2 text-[10px] text-slate-400 font-mono">
                <Database className="h-3 w-3 text-blue-600 shrink-0" />
                <span className="truncate">Database: Supabase Cloud</span>
              </div>
            )}

            <div className={clsx("flex items-center gap-2", collapsed ? "flex-col" : "justify-between")}>
              <button
                type="button"
                onClick={() => setTokenOpen(true)}
                title="Inspect OAuth Token"
                className={clsx(
                  "h-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 transition",
                  collapsed ? "w-9" : "flex-1 gap-2 text-xs font-bold px-3 bg-slate-50 border border-slate-200"
                )}
              >
                <KeyRound className="h-4 w-4 text-blue-600" />
                {!collapsed && <span>Token Inspector</span>}
              </button>

              <button
                type="button"
                onClick={() => logout()}
                title="Sign Out"
                className="h-9 w-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition shrink-0"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </aside>

        {/* MAIN CANVAS VIEWPORT (No Outer Vertical Scrollbar, Visuals Scroll Internally) */}
        <main
          key={pathname}
          className="flex-1 h-full overflow-hidden p-4 md:p-6 page-transition"
        >
          {children}
        </main>
      </div>

      <TokenModal
        isOpen={tokenOpen}
        onClose={() => setTokenOpen(false)}
        onSuccess={() => refreshAuth()}
      />
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-slate-50" />}>
      <LoginGate>
        <AppShellInner>{children}</AppShellInner>
      </LoginGate>
    </Suspense>
  );
}
