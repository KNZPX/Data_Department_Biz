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
  Palette,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Users,
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

  // Navigation Items: Home, Catalog, DAX Management, Licenses, Settings
  const navItems = [
    { href: "/", label: "Home Dashboard", icon: Home, exact: true },
    { href: "/reports", label: "Power BI Catalog", icon: LayoutGrid },
    { href: "/dax", label: "DAX Management", icon: FunctionSquare },
    { href: "/licenses", label: "Team & Licenses", icon: Users },
    { href: "/settings", label: "Appearance & Settings", icon: Settings },
  ];

  return (
    <div
      style={{ backgroundColor: currentCanvas.bg }}
      className="min-h-screen text-[#1C252E] flex flex-col transition-colors duration-300"
    >
      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs md:hidden transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="flex flex-1 min-h-screen">
        {/* SIGNATURE CURVED LEFT SIDEBAR (Desktop) */}
        <aside
          className={clsx(
            "fixed top-0 bottom-0 left-0 z-40 transition-all duration-300 ease-in-out md:translate-x-0",
            mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
            "w-20 flex flex-col justify-between py-6 px-0 text-white shadow-2xl"
          )}
          style={{
            background: `linear-gradient(180deg, ${currentTheme.gradientFrom} 0%, ${currentTheme.gradientTo} 100%)`,
            borderTopRightRadius: "36px",
            borderBottomRightRadius: "36px",
          }}
        >
          {/* Top Navigation Items */}
          <div className="w-full flex flex-col items-center space-y-4">
            {navItems.map((item) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              const Icon = item.icon;

              return (
                <div key={item.href} className="w-full relative flex items-center justify-end">
                  {/* PERFECT MATHEMATICAL CONCAVE SCOOP CUTOUT */}
                  {active && (
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-full h-15 pointer-events-none z-0">
                      {/* Top concave scoop */}
                      <div
                        style={{ backgroundColor: currentCanvas.bg }}
                        className="absolute -top-4 right-0 w-4 h-4 overflow-hidden"
                      >
                        <div
                          style={{
                            background: `linear-gradient(180deg, ${currentTheme.gradientFrom} 0%, ${currentTheme.gradientTo} 100%)`,
                          }}
                          className="w-full h-full rounded-br-2xl"
                        />
                      </div>

                      {/* Center active tab card */}
                      <div
                        style={{ backgroundColor: currentCanvas.bg }}
                        className="w-full h-full rounded-l-3xl shadow-xs"
                      />

                      {/* Bottom concave scoop */}
                      <div
                        style={{ backgroundColor: currentCanvas.bg }}
                        className="absolute -bottom-4 right-0 w-4 h-4 overflow-hidden"
                      >
                        <div
                          style={{
                            background: `linear-gradient(180deg, ${currentTheme.gradientFrom} 0%, ${currentTheme.gradientTo} 100%)`,
                          }}
                          className="w-full h-full rounded-tr-2xl"
                        />
                      </div>
                    </div>
                  )}

                  {/* Tab Icon and Link */}
                  <Link
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    title={item.label}
                    className={clsx(
                      "relative z-10 w-full h-15 flex items-center justify-center transition-transform duration-200",
                      active ? "scale-105" : "text-white/80 hover:text-white hover:scale-110"
                    )}
                  >
                    <Icon
                      style={{
                        color: active ? currentTheme.primary : "currentColor",
                      }}
                      className={clsx(
                        "transition-all",
                        active ? "h-6 w-6 stroke-[2.4]" : "h-5 w-5 opacity-90 hover:opacity-100"
                      )}
                    />
                  </Link>
                </div>
              );
            })}
          </div>

          {/* Bottom Actions: Token Key & Logout */}
          <div className="w-full flex flex-col items-center space-y-3 pt-4 border-t border-white/15">
            <button
              type="button"
              onClick={() => setTokenOpen(true)}
              title="Microsoft 365 OAuth Token Status"
              className="h-10 w-10 rounded-2xl flex items-center justify-center text-white/75 hover:text-white hover:bg-white/10 transition"
            >
              <KeyRound className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => logout()}
              title="Sign Out"
              className="h-10 w-10 rounded-2xl flex items-center justify-center text-white/75 hover:text-white hover:bg-white/15 transition active:scale-95"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </aside>

        {/* MAIN APPLICATION CANVAS */}
        <div className="flex-1 flex flex-col min-w-0 md:pl-24 transition-all">
          {/* TOP HEADER BAR */}
          <header className="sticky top-0 z-30 px-4 md:px-8 py-3.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {/* Mobile Hamburger Menu */}
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                style={{ backgroundColor: currentTheme.primary }}
                className="grid md:hidden h-10 w-10 place-items-center rounded-2xl text-white shadow-sm"
              >
                <Menu className="h-5 w-5" />
              </button>

              {/* Floating Pill Search Bar */}
              <div className="relative flex items-center">
                <Search className="absolute left-4 h-4 w-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && searchQuery.trim()) {
                      router.push(`/reports?q=${encodeURIComponent(searchQuery.trim())}`);
                    }
                  }}
                  placeholder="Search reports, semantic models, metrics..."
                  className="w-56 sm:w-80 md:w-96 rounded-full bg-white pl-11 pr-5 py-2.5 text-xs text-slate-700 shadow-sm border border-slate-200/70 focus:outline-none focus:ring-2 focus:ring-purple-400/40 transition placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Right Action Icons: Settings, Notification Bell (with Audit Popup), User Avatar */}
            <div className="flex items-center gap-2.5 sm:gap-4 relative" ref={popupRef}>
              {/* Settings / Appearance Link */}
              <Link
                href="/settings"
                title="Appearance & Settings"
                className="h-10 w-10 rounded-full bg-white shadow-xs border border-slate-200/60 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:shadow-sm transition"
              >
                <Settings className="h-4.5 w-4.5 text-slate-600" />
              </Link>

              {/* Notification Bell Button (Toggles Audit Events Popup) */}
              <button
                type="button"
                onClick={() => setAuditPopupOpen(!auditPopupOpen)}
                title="Audit & Publish Events"
                className={clsx(
                  "relative h-10 w-10 rounded-full bg-white shadow-xs border flex items-center justify-center transition",
                  auditPopupOpen
                    ? "border-slate-800 text-slate-900 shadow-md scale-105"
                    : "border-slate-200/60 text-slate-600 hover:text-slate-900 hover:shadow-sm"
                )}
              >
                <Bell className="h-4.5 w-4.5" />
                {unreadCount > 0 && (
                  <span
                    style={{ backgroundColor: currentTheme.primary }}
                    className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center border-2 border-white shadow-xs animate-pulse"
                  >
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {/* AUDIT EVENTS POPUP BOX (As Requested) */}
              {auditPopupOpen && (
                <div className="absolute right-12 top-12 w-80 sm:w-96 md:w-[420px] max-h-[580px] rounded-3xl bg-white shadow-2xl border border-slate-100 z-50 flex flex-col animate-in fade-in slide-in-from-top-2 duration-200">
                  {/* Popup Header */}
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        style={{
                          backgroundColor: currentTheme.primaryLight,
                          color: currentTheme.primary,
                        }}
                        className="grid h-8 w-8 place-items-center rounded-xl"
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
                          className="text-[10px] font-bold text-purple-600 hover:underline"
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
                  <div className="p-3 bg-slate-50/60 border-b border-slate-100 space-y-2">
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
                        placeholder="Search event title or publisher..."
                        className="w-full rounded-full bg-white pl-7 pr-3 py-1.5 text-[11px] text-slate-700 border border-slate-200 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Scrollable Event List */}
                  <div className="flex-1 overflow-y-auto max-h-80 p-2 divide-y divide-slate-100">
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
                              <span>โดย: {log.responsible_user || "ไม่ระบุ"}</span>
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
                      <span>Refresh</span>
                    </button>
                    <span className="text-slate-400">Live Entra ID Stream</span>
                  </div>
                </div>
              )}

              {/* User Profile Pill */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center gap-2 rounded-full bg-white pl-1 pr-3 py-1 shadow-xs border border-slate-200/60 hover:shadow-sm transition"
                >
                  <div
                    style={{
                      backgroundColor: currentTheme.primary,
                      boxShadow: `0 4px 8px -2px ${currentTheme.primaryGlow}`,
                    }}
                    className="h-8 w-8 rounded-full text-white font-bold text-xs flex items-center justify-center"
                  >
                    {user?.name ? user.name.slice(0, 1).toUpperCase() : "S"}
                  </div>
                  <span className="text-xs font-bold text-slate-800 max-w-[100px] truncate hidden sm:inline">
                    {user?.name || "Scarlett"}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                </button>

                {/* Dropdown Menu */}
                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white p-2 shadow-xl border border-slate-100 z-50 text-xs animate-in fade-in">
                    <div className="px-3 py-2 border-b border-slate-100">
                      <p className="font-bold text-slate-800 truncate">{user?.name || "Scarlett (Admin)"}</p>
                      <p className="text-[10px] text-slate-400 truncate font-mono">{user?.email || "admin@bizanalytic.com"}</p>
                    </div>
                    <Link
                      href="/settings"
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-50 transition"
                    >
                      <Palette className="h-4 w-4" style={{ color: currentTheme.primary }} />
                      <span>Change Appearance</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setUserDropdownOpen(false);
                        setTokenOpen(true);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-50 transition text-left"
                    >
                      <KeyRound className="h-4 w-4 text-amber-600" />
                      <span>Token Inspector</span>
                    </button>
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

          {/* PAGE CONTENT CONTAINER WITH SMOOTH ANIMATION */}
          <main key={pathname} className="flex-1 px-4 md:px-8 pb-12 pt-2 page-transition">
            {children}
          </main>
        </div>
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
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <LoginGate>
        <AppShellInner>{children}</AppShellInner>
      </LoginGate>
    </Suspense>
  );
}
