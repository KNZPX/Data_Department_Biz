"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import {
  Bell,
  ChevronDown,
  FunctionSquare,
  History,
  Home,
  KeyRound,
  LayoutGrid,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  TrendingUp,
  Users,
  Workflow,
  X,
  type LucideIcon,
} from "lucide-react";
import { clsx } from "clsx";
import { TokenModal } from "@/components/TokenModal";
import { LoginGate, useAccess, useAuth } from "@/components/auth/LoginGate";
import { pageForPath } from "@/lib/access";
import { useTheme } from "@/context/ThemeContext";
import { PresenceStack, usePresence } from "@/components/layout/Presence";

type NavItem = { href: string; label: string; hint: string; icon: LucideIcon };
type NavGroup = { title: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Overview",
    items: [{ href: "/", label: "Home", hint: "Team activity and model pulse", icon: Home }],
  },
  {
    title: "Catalog",
    items: [
      { href: "/reports", label: "Power BI reports", hint: "Workspaces, reports and publish history", icon: LayoutGrid },
      { href: "/licenses", label: "Team & licenses", hint: "Pro, Premium and security groups", icon: Users },
    ],
  },
  {
    title: "Modeling",
    items: [
      { href: "/dax", label: "DAX dictionary", hint: "Measures and columns of each semantic model", icon: FunctionSquare },
      { href: "/whiteboard", label: "Whiteboard", hint: "Workflow and data-flow canvases", icon: Workflow },
    ],
  },
  {
    title: "Planning",
    items: [{ href: "/target-scenario", label: "Target scenario", hint: "BDMS Phuket 2027 target simulator", icon: TrendingUp }],
  },
  {
    title: "Admin",
    items: [
      { href: "/users", label: "People & access", hint: "Accounts, guests and what each person can open", icon: ShieldCheck },
      { href: "/changelog", label: "Activity log", hint: "Audit trail across the portal", icon: History },
      { href: "/settings", label: "Settings", hint: "Appearance and connections", icon: Settings },
    ],
  },
];

const ALL_NAV = NAV_GROUPS.flatMap((g) => g.items);

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function initials(name?: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}

function AppShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, refreshAuth, isGuest } = useAuth();
  const { canPage } = useAccess();
  const visibleGroups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => {
      const page = pageForPath(i.href);
      return page ? canPage(page.id) : true;
    }),
  })).filter((g) => g.items.length);
  const currentPage = pageForPath(pathname);
  const allowedHere = currentPage ? canPage(currentPage.id) : true;
  const { currentTheme } = useTheme();
  const online = usePresence();

  const [tokenOpen, setTokenOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Notification / Audit Events Popup State
  const [auditPopupOpen, setAuditPopupOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logFilter, setLogFilter] = useState<"all" | "publish" | "update">("all");
  const [logSearch, setLogSearch] = useState("");
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("portal_sidebar_collapsed");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved !== null) setCollapsed(saved === "true");
  }, []);

  function toggleSidebar() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("portal_sidebar_collapsed", String(next));
      return next;
    });
  }

  // ⌘K / Ctrl+K focuses search
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") {
        setUserDropdownOpen(false);
        setAuditPopupOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    void fetchLogs();
    const interval = setInterval(fetchLogs, 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) setAuditPopupOpen(false);
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) setUserDropdownOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
        setUnreadCount(fetchedLogs.filter((l: { id: string }) => !readSet.has(l.id)).length);
      }
    } catch {
    } finally {
      setLoadingLogs(false);
    }
  }

  function handleMarkAllRead() {
    localStorage.setItem("powerbi_read_log_ids", JSON.stringify(logs.map((l) => l.id)));
    setUnreadCount(0);
  }

  const filteredLogs = logs.filter((log) => {
    const matchType =
      logFilter === "all" ||
      (logFilter === "publish" && (log.change_type === "PUBLISH" || log.change_type === "VERSION_UPDATE")) ||
      (logFilter === "update" && log.change_type === "METADATA_UPDATE");
    const q = logSearch.toLowerCase();
    const matchSearch =
      !logSearch.trim() ||
      (log.item_name && log.item_name.toLowerCase().includes(q)) ||
      (log.summary && log.summary.toLowerCase().includes(q)) ||
      (log.responsible_user && log.responsible_user.toLowerCase().includes(q));
    return matchType && matchSearch;
  });
  const publishCount = logs.filter((l) => l.change_type === "PUBLISH" || l.change_type === "VERSION_UPDATE").length;
  const updateCount = logs.filter((l) => l.change_type === "METADATA_UPDATE").length;

  const activeNavItem = ALL_NAV.find((item) => isActive(pathname, item.href)) || ALL_NAV[0];

  function submitSearch() {
    const q = searchQuery.trim();
    if (!q) return;
    // DAX-looking queries go to the dictionary, everything else to the report catalog.
    const looksDax = /^[_%\[]|\(|\bcalculate\b|measure|dax/i.test(q) || pathname.startsWith("/dax");
    router.push(looksDax ? `/dax?model=ALL&q=${encodeURIComponent(q)}` : `/reports?q=${encodeURIComponent(q)}`);
  }

  const sidebar = (
    <aside
      className={clsx(
        "ink-surface h-full z-40 shrink-0 flex flex-col text-slate-300 transition-[width] duration-300 ease-out",
        collapsed ? "w-[76px]" : "w-64",
        mobileOpen ? "fixed inset-y-0 left-0 z-50 w-64 flex" : "hidden md:flex"
      )}
    >
      {/* Brand */}
      <div className={clsx("h-16 shrink-0 flex items-center gap-3", collapsed ? "justify-center px-2" : "px-5")}>
        <Link href="/" className="flex items-center gap-3 min-w-0" onClick={() => setMobileOpen(false)}>
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[13px] font-bold text-white"
            style={{ background: `linear-gradient(140deg, ${currentTheme.gradientFrom}, ${currentTheme.gradientTo})` }}
          >
            BA
          </span>
          {!collapsed && (
            <span className="min-w-0 leading-tight">
              <span className="block text-[15px] font-semibold text-white tracking-tight">Biz-Analytic</span>
              <span className="block text-[11px] text-slate-400">BDMS Phuket data team</span>
            </span>
          )}
        </Link>
        {mobileOpen && (
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="ml-auto grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white/10"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-5" aria-label="Main">
        {visibleGroups.map((group) => (
          <div key={group.title}>
            {!collapsed ? (
              <p className="px-3 pb-1.5 text-[11px] font-medium text-slate-500">{group.title}</p>
            ) : (
              <div className="mx-auto mb-2 h-px w-6 bg-white/10" />
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      title={collapsed ? item.label : item.hint}
                      aria-current={active ? "page" : undefined}
                      className={clsx(
                        "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] transition-colors",
                        active ? "bg-white/[0.09] text-white" : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-100",
                        collapsed && "justify-center px-0"
                      )}
                    >
                      {active && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-blue-400" aria-hidden />
                      )}
                      <Icon className={clsx("h-[18px] w-[18px] shrink-0", active ? "text-blue-300" : "text-slate-500 group-hover:text-slate-300")} />
                      {!collapsed && <span className="truncate font-medium">{item.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Who's here */}
      <div className={clsx("shrink-0 border-t border-white/[0.07] p-3", collapsed && "px-2")}>
        {!collapsed && (
          <div className="mb-3 px-2">
            <p className="text-[11px] text-slate-500 mb-2">
              {online.length <= 1 ? "Only you right now" : `${online.length} people working now`}
            </p>
            <PresenceStack users={online} dark max={6} />
          </div>
        )}
        <div className={clsx("flex items-center gap-1", collapsed ? "flex-col" : "")}>
          <button
            type="button"
            onClick={toggleSidebar}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden md:grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => setTokenOpen(true)}
            title="Your Power BI connection"
            className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <KeyRound className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => logout()}
            title="Sign out"
            className={clsx(
              "flex h-9 items-center gap-2 rounded-lg px-2.5 text-[13px] text-slate-400 hover:bg-coral/15 hover:text-coral",
              collapsed ? "w-9 justify-center px-0" : "ml-auto"
            )}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span>Sign out</span>}
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="h-screen w-screen overflow-hidden bg-paper text-slate-800 flex font-sans">
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-ink/50 backdrop-blur-[2px] md:hidden" onClick={() => setMobileOpen(false)} />
      )}
      {sidebar}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="h-16 shrink-0 border-b border-slate-200/70 bg-white/80 backdrop-blur px-4 md:px-6 flex items-center gap-3 z-30">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="grid md:hidden h-9 w-9 place-items-center rounded-xl bg-ink text-white"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="min-w-0">
            <h1 className="truncate text-[17px] font-semibold tracking-tight text-slate-900">{activeNavItem.label}</h1>
            <p className="hidden sm:block truncate text-xs text-slate-500">{activeNavItem.hint}</p>
          </div>

          <div className="ml-auto flex items-center gap-2 md:gap-3">
            <div className="relative hidden md:flex items-center">
              <Search className="absolute left-3 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                ref={searchRef}
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitSearch()}
                placeholder="Search reports or measures"
                aria-label="Search reports or measures"
                className="w-56 lg:w-80 rounded-xl bg-slate-100/80 pl-9 pr-14 py-2 text-[13px] text-slate-800 border border-transparent placeholder:text-slate-400 focus:bg-white focus:border-slate-200 focus:outline-none transition"
              />
              <kbd className="pointer-events-none absolute right-2.5 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-400">
                Ctrl K
              </kbd>
            </div>

            <div className="hidden lg:block">
              <PresenceStack users={online} max={4} />
            </div>

          {/* Notification Bell (Audit Events Popover Box) */}
          <div className="relative" ref={popupRef}>
            <button
              type="button"
              onClick={() => setAuditPopupOpen(!auditPopupOpen)}
              title="Recent publishes and changes" aria-label="Recent publishes and changes"
              className={clsx(
                "relative h-9 w-9 rounded-xl flex items-center justify-center transition",
                auditPopupOpen
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
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

          {/* User menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="flex items-center gap-2 rounded-xl py-1 pl-1 pr-2 hover:bg-slate-100 transition"
              aria-haspopup="menu"
              aria-expanded={userDropdownOpen}
            >
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-600 text-[12px] font-semibold text-white">
                {initials(user?.name)}
              </span>
              <span className="hidden sm:block max-w-[140px] truncate text-[13px] font-medium text-slate-800">
                {user?.name || "Signed in"}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>
            {userDropdownOpen && (
              <div role="menu" className="absolute right-0 mt-2 w-64 rounded-2xl bg-white p-2 shadow-xl ring-1 ring-slate-200 z-50 text-[13px]">
                <div className="px-3 py-2.5 border-b border-slate-100 mb-1">
                  <p className="font-semibold text-slate-900 truncate">{user?.name}</p>
                  <p className="text-xs text-slate-500 truncate">{isGuest ? `Guest account ${user?.email?.replace("guest:", "")}` : user?.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setUserDropdownOpen(false);
                    setTokenOpen(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-50 text-left"
                >
                  <KeyRound className="h-4 w-4 text-slate-400" />
                  Power BI connection
                </button>
                <Link
                  href="/settings"
                  onClick={() => setUserDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-50"
                >
                  <Settings className="h-4 w-4 text-slate-400" />
                  Settings
                </Link>
                <button
                  type="button"
                  onClick={() => logout()}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-coral hover:bg-coral/10 text-left font-medium"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            )}
          </div>
          </div>
        </header>

        <main key={pathname} className="flex-1 min-h-0 overflow-hidden p-3 md:p-5 page-transition">
          {allowedHere ? (
            children
          ) : (
            <div className="grid h-full place-items-center">
              <div className="max-w-sm text-center">
                <p className="text-lg font-semibold text-slate-900">You don&rsquo;t have access to this page</p>
                <p className="mt-2 text-sm text-slate-500">Ask an admin to add it under People &amp; access.</p>
                <Link href="/" className="mt-4 inline-block rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white">
                  Go to Home
                </Link>
              </div>
            </div>
          )}
        </main>
      </div>

      <TokenModal isOpen={tokenOpen} onClose={() => setTokenOpen(false)} onSuccess={() => refreshAuth()} />
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-paper" />}>
      <LoginGate>
        <AppShellInner>{children}</AppShellInner>
      </LoginGate>
    </Suspense>
  );
}
