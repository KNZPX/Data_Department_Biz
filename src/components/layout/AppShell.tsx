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
  Palette,
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
      { href: "/settings", label: "Settings", hint: "Your appearance, portal content and connections", icon: Settings },
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

/** The routed page. `data-entering` is on for the first moments so its sections stagger in. */
function PageFrame({ children }: { children: React.ReactNode }) {
  const [entering, setEntering] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setEntering(false), 800);
    return () => clearTimeout(t);
  }, []);
  return (
    <main className="page-enter flex-1 min-h-0 overflow-hidden p-3 md:p-5" data-entering={entering ? "" : undefined}>
      {children}
    </main>
  );
}

function AppShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, refreshAuth, isGuest } = useAuth();
  const { canPage } = useAccess();
  const { appearance, setAppearance, loadFor } = useTheme();
  const visibleGroups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => {
      const page = pageForPath(i.href);
      return page ? canPage(page.id) : true;
    }),
  })).filter((g) => g.items.length);
  const currentPage = pageForPath(pathname);
  const allowedHere = currentPage ? canPage(currentPage.id) : true;
  const online = usePresence();
  const collapsed = appearance.sidebarCollapsed;

  const [tokenOpen, setTokenOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const [pill, setPill] = useState<{ top: number; height: number } | null>(null);

  // Notification / audit events popup
  const [auditPopupOpen, setAuditPopupOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logFilter, setLogFilter] = useState<"all" | "publish" | "update">("all");
  const [logSearch, setLogSearch] = useState("");
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const popupRef = useRef<HTMLDivElement>(null);

  // Load this person's saved appearance once we know who they are.
  useEffect(() => {
    loadFor(user?.email || null);
  }, [user?.email, loadFor]);

  function toggleSidebar() {
    setAppearance({ sidebarCollapsed: !collapsed });
  }

  // Slide the active-page highlight to the current nav item.
  const navSig = visibleGroups.map((g) => g.items.length).join(",");
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const measure = () => {
      const el = nav.querySelector<HTMLElement>('[aria-current="page"]');
      if (!el) return setPill(null);
      // Measured against the nav box (offsetTop would be relative to a group while it animates in).
      const top = el.getBoundingClientRect().top - nav.getBoundingClientRect().top + nav.scrollTop;
      setPill({ top, height: el.offsetHeight });
    };
    const raf = requestAnimationFrame(measure);
    const ro = new ResizeObserver(() => measure());
    ro.observe(nav);
    nav.addEventListener("animationend", measure);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      nav.removeEventListener("animationend", measure);
    };
  }, [pathname, collapsed, navSig]);

  // ⌘K / Ctrl+K focuses search
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (appearance.sidebarCollapsed) setAppearance({ sidebarCollapsed: false });
        setTimeout(() => searchRef.current?.focus(), 0);
      }
      if (e.key === "Escape") {
        setUserDropdownOpen(false);
        setAuditPopupOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [appearance.sidebarCollapsed, setAppearance]);

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
  const activeGroup = NAV_GROUPS.find((g) => g.items.includes(activeNavItem));

  function submitSearch() {
    const q = searchQuery.trim();
    if (!q) return;
    // DAX-looking queries go to the dictionary, everything else to the report catalog.
    const looksDax = /^[_%\[]|\(|\bcalculate\b|measure|dax/i.test(q) || pathname.startsWith("/dax");
    router.push(looksDax ? `/dax?model=ALL&q=${encodeURIComponent(q)}` : `/reports?q=${encodeURIComponent(q)}`);
  }

  const narrow = collapsed && !mobileOpen;

  const sidebar = (
    <aside
      className={clsx(
        "h-full z-40 shrink-0 flex flex-col border-r border-slate-200/80 bg-white transition-[width] duration-300 ease-[cubic-bezier(.16,1,.3,1)]",
        narrow ? "w-[68px]" : "w-[248px]",
        mobileOpen ? "fixed inset-y-0 left-0 z-50 flex w-[248px] shadow-2xl [animation:slide-in-left_var(--dur-2)_var(--ease-out-soft)_backwards]" : "hidden md:flex"
      )}
    >
      {/* Workspace */}
      <div className={clsx("h-14 shrink-0 flex items-center gap-2.5", narrow ? "justify-center px-2" : "px-4")}>
        <Link href="/" className="group flex min-w-0 items-center gap-2.5" onClick={() => setMobileOpen(false)}>
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-600 text-[12px] font-bold text-white shadow-[0_1px_2px_rgb(16_24_40/0.1)] transition-transform duration-300 group-hover:rotate-[-6deg] group-hover:scale-105">
            BA
          </span>
          {!narrow && (
            <span className="min-w-0 leading-tight fade-enter">
              <span className="block truncate text-[14.5px] font-semibold tracking-tight text-slate-900">Biz-Analytic</span>
              <span className="block truncate text-[11.5px] text-slate-500">Data &amp; Business Analysis</span>
            </span>
          )}
        </Link>
        {mobileOpen ? (
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="ml-auto grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          !narrow && (
            <button
              type="button"
              onClick={toggleSidebar}
              title="Collapse sidebar"
              className="ml-auto hidden md:grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )
        )}
      </div>

      {/* Search */}
      <div className={clsx("shrink-0 pb-3", narrow ? "px-3" : "px-3")}>
        {narrow ? (
          <button
            type="button"
            onClick={() => {
              setAppearance({ sidebarCollapsed: false });
              setTimeout(() => searchRef.current?.focus(), 50);
            }}
            title="Search (Ctrl K)"
            className="grid h-9 w-full place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          >
            <Search className="h-[18px] w-[18px]" />
          </button>
        ) : (
          <label className="group relative flex items-center">
            <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400 transition-colors group-focus-within:text-blue-600" />
            <input
              ref={searchRef}
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  submitSearch();
                  setMobileOpen(false);
                }
              }}
              placeholder="Search…"
              aria-label="Search reports or measures"
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-12 text-[13px] text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
            <kbd className="pointer-events-none absolute right-2 rounded border border-slate-200 bg-white px-1.5 py-px font-sans text-[10px] text-slate-400">
              Ctrl K
            </kbd>
          </label>
        )}
      </div>

      {/* Nav */}
      <nav ref={navRef} className="relative flex-1 overflow-y-auto overflow-x-hidden px-3 pb-4 stagger" aria-label="Main">
        {pill && (
          <span
            aria-hidden
            className="pointer-events-none absolute left-3 right-3 rounded-lg bg-blue-50 ring-1 ring-inset ring-blue-100 transition-[transform,height] duration-[380ms] ease-[cubic-bezier(.16,1,.3,1)]"
            style={{ top: 0, height: pill.height, transform: `translateY(${pill.top}px)` }}
          />
        )}
        {visibleGroups.map((group, gi) => (
          <div key={group.title} className={clsx(gi > 0 && "mt-4")}>
            {!narrow ? (
              <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-[0.06em] text-slate-400">{group.title}</p>
            ) : (
              gi > 0 && <div className="mx-auto mb-3 h-px w-6 bg-slate-200" />
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
                      title={narrow ? item.label : item.hint}
                      aria-current={active ? "page" : undefined}
                      className={clsx(
                        "group relative z-[1] flex h-9 items-center gap-3 rounded-lg px-3 text-[13.5px] transition-colors duration-200",
                        active ? "font-semibold text-blue-700" : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900",
                        narrow && "justify-center px-0"
                      )}
                    >
                      <Icon
                        className={clsx(
                          "h-[18px] w-[18px] shrink-0 transition-transform duration-300 ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-110",
                          active ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"
                        )}
                        strokeWidth={active ? 2.1 : 1.8}
                      />
                      {!narrow && <span className="truncate transition-transform duration-300 group-hover:translate-x-0.5">{item.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className={clsx("shrink-0 border-t border-slate-200/80 p-3", narrow && "px-2")}>
        {!narrow && (
          <div className="mb-2.5 flex items-center justify-between px-1">
            <p className="text-[11.5px] text-slate-500">
              {online.length <= 1 ? "Only you right now" : `${online.length} people working now`}
            </p>
            <PresenceStack users={online} max={4} />
          </div>
        )}
        <div className={clsx("flex items-center gap-1", narrow && "flex-col")}>
          {narrow && (
            <button
              type="button"
              onClick={toggleSidebar}
              title="Expand sidebar"
              className="hidden md:grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setTokenOpen(true)}
            title="Your Power BI connection"
            className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <KeyRound className="h-4 w-4" />
          </button>
          <Link
            href="/settings?tab=appearance"
            onClick={() => setMobileOpen(false)}
            title="Appearance"
            className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <Palette className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={() => logout()}
            title="Sign out"
            className={clsx(
              "flex h-9 items-center gap-2 rounded-lg px-2.5 text-[13px] text-slate-500 transition hover:bg-coral/10 hover:text-coral",
              narrow ? "w-9 justify-center px-0" : "ml-auto"
            )}
          >
            <LogOut className="h-4 w-4" />
            {!narrow && <span>Sign out</span>}
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="h-screen w-screen overflow-hidden bg-paper text-slate-800 flex font-sans">
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-[2px] md:hidden fade-enter" onClick={() => setMobileOpen(false)} />
      )}
      {sidebar}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="h-14 shrink-0 border-b border-slate-200/80 bg-white/90 backdrop-blur px-3 md:px-5 flex items-center gap-3 z-30">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="grid md:hidden h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-700"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div key={pathname} className="min-w-0 fade-enter">
            <div className="flex items-center gap-1.5 text-[12px] text-slate-400">
              <span className="hidden sm:inline">{activeGroup?.title}</span>
              <span className="hidden sm:inline">/</span>
              <h1 className="truncate text-[15px] font-semibold tracking-tight text-slate-900">{activeNavItem.label}</h1>
            </div>
            <p className="hidden sm:block truncate text-[12px] leading-tight text-slate-500">{activeNavItem.hint}</p>
          </div>

          <div className="ml-auto flex items-center gap-1.5 md:gap-2">
            <div className="hidden lg:block mr-1">
              <PresenceStack users={online} max={4} />
            </div>

            {/* Recent publishes and changes */}
            <div className="relative" ref={popupRef}>
              <button
                type="button"
                onClick={() => setAuditPopupOpen(!auditPopupOpen)}
                title="Recent publishes and changes"
                aria-label="Recent publishes and changes"
                className={clsx(
                  "relative grid h-9 w-9 place-items-center rounded-lg transition",
                  auditPopupOpen ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                <Bell className={clsx("h-[18px] w-[18px]", unreadCount > 0 && "origin-top [animation:bell_1.8s_ease-in-out_1]")} />
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full border-2 border-white bg-blue-600 px-1 text-[9px] font-bold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {auditPopupOpen && (
                <div className="pop-in absolute right-0 top-11 z-50 flex max-h-[520px] w-80 flex-col rounded-xl border border-slate-200 bg-white shadow-[0_12px_32px_-8px_rgb(16_24_40/0.2)] sm:w-96 md:w-[420px]">
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <div>
                      <h4 className="text-[13px] font-semibold text-slate-900">Publishes and changes</h4>
                      <p className="text-[11.5px] text-slate-500">
                        {logs.length} events · {unreadCount} unread
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {unreadCount > 0 && (
                        <button type="button" onClick={handleMarkAllRead} className="rounded-md px-2 py-1 text-[12px] font-medium text-blue-600 hover:bg-blue-50">
                          Mark all read
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setAuditPopupOpen(false)}
                        className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        aria-label="Close"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 border-b border-slate-100 px-3 py-2.5">
                    <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5 text-[12px]">
                      {(
                        [
                          ["all", `All ${logs.length}`],
                          ["publish", `Publishes ${publishCount}`],
                          ["update", `Updates ${updateCount}`],
                        ] as const
                      ).map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setLogFilter(id)}
                          className={clsx(
                            "flex-1 rounded-md px-2 py-1 font-medium transition",
                            logFilter === id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={logSearch}
                        onChange={(e) => setLogSearch(e.target.value)}
                        placeholder="Search by report or person"
                        className="h-8 w-full rounded-md border border-slate-200 bg-white pl-8 pr-3 text-[12.5px] text-slate-700 outline-none focus:border-blue-400"
                      />
                    </div>
                  </div>

                  <div className="max-h-72 flex-1 divide-y divide-slate-100 overflow-y-auto px-2 py-1">
                    {loadingLogs && logs.length === 0 ? (
                      <div className="space-y-2 p-2">
                        {[0, 1, 2].map((i) => (
                          <div key={i} className="skeleton h-12 rounded-md" />
                        ))}
                      </div>
                    ) : filteredLogs.length === 0 ? (
                      <div className="py-8 text-center text-[12.5px] text-slate-400">Nothing here yet.</div>
                    ) : (
                      filteredLogs.map((log) => {
                        const isPublish = log.change_type === "PUBLISH" || log.change_type === "VERSION_UPDATE";
                        return (
                          <div key={log.id} className="space-y-1 rounded-md px-2 py-2.5 transition hover:bg-slate-50">
                            <div className="flex items-center justify-between">
                              <span
                                className={clsx(
                                  "rounded px-1.5 py-px text-[10.5px] font-medium",
                                  isPublish ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                                )}
                              >
                                {isPublish ? "Publish" : "Update"}
                              </span>
                              <span className="text-[11px] tabular-nums text-slate-400">
                                {new Date(log.created_at).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                            <p className="line-clamp-2 text-[12.5px] font-medium leading-snug text-slate-800">{log.summary || log.item_name}</p>
                            <p className="text-[11.5px] text-slate-500">{log.responsible_user || "Automated sync"}</p>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5 text-[12px]">
                    <button type="button" onClick={() => void fetchLogs()} className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800">
                      <RefreshCw className={clsx("h-3.5 w-3.5", loadingLogs && "animate-spin")} />
                      Refresh
                    </button>
                    <Link href="/changelog" onClick={() => setAuditPopupOpen(false)} className="font-medium text-blue-600 hover:underline">
                      Open activity log
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* User menu */}
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition hover:bg-slate-100"
                aria-haspopup="menu"
                aria-expanded={userDropdownOpen}
              >
                <span className="grid h-8 w-8 place-items-center rounded-full bg-blue-600 text-[12px] font-semibold text-white">{initials(user?.name)}</span>
                <span className="hidden max-w-[140px] truncate text-[13px] font-medium text-slate-800 sm:block">{user?.name || "Signed in"}</span>
                <ChevronDown className={clsx("h-3.5 w-3.5 text-slate-400 transition-transform duration-200", userDropdownOpen && "rotate-180")} />
              </button>
              {userDropdownOpen && (
                <div role="menu" className="pop-in absolute right-0 z-50 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-1.5 text-[13px] shadow-[0_12px_32px_-8px_rgb(16_24_40/0.2)]">
                  <div className="mb-1 flex items-center gap-2.5 border-b border-slate-100 px-2.5 pb-2.5 pt-1.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-600 text-[12px] font-semibold text-white">{initials(user?.name)}</span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-slate-900">{user?.name}</span>
                      <span className="block truncate text-[12px] text-slate-500">
                        {isGuest ? `Guest ${user?.email?.replace("guest:", "")}` : user?.email}
                      </span>
                    </span>
                  </div>
                  <Link
                    href="/settings?tab=appearance"
                    onClick={() => setUserDropdownOpen(false)}
                    className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-slate-700 hover:bg-slate-50"
                  >
                    <Palette className="h-4 w-4 text-slate-400" />
                    Appearance
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setUserDropdownOpen(false);
                      setTokenOpen(true);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-slate-700 hover:bg-slate-50"
                  >
                    <KeyRound className="h-4 w-4 text-slate-400" />
                    Power BI connection
                  </button>
                  <Link
                    href="/settings"
                    onClick={() => setUserDropdownOpen(false)}
                    className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-slate-700 hover:bg-slate-50"
                  >
                    <Settings className="h-4 w-4 text-slate-400" />
                    Settings
                  </Link>
                  <button
                    type="button"
                    onClick={() => logout()}
                    className="mt-1 flex w-full items-center gap-2.5 rounded-lg border-t border-slate-100 px-2.5 py-2 text-left font-medium text-coral hover:bg-coral/10"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <PageFrame key={pathname}>
          {allowedHere ? (
            children
          ) : (
            <div className="grid h-full place-items-center">
              <div className="max-w-sm text-center">
                <p className="text-lg font-semibold text-slate-900">You don&rsquo;t have access to this page</p>
                <p className="mt-2 text-sm text-slate-500">Ask an admin to add it under People &amp; access.</p>
                <Link href="/" className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white">
                  Go to Home
                </Link>
              </div>
            </div>
          )}
        </PageFrame>
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
