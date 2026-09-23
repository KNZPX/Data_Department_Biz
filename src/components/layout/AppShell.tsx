"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  Bell,
  ChevronDown,
  Compass,
  Database,
  FileText,
  History,
  Home,
  Inbox,
  KeyRound,
  LayoutDashboard,
  LayoutGrid,
  Layers,
  Lock,
  LogOut,
  Menu,
  Palette,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  User,
  Users,
  X,
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
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  useEffect(() => {
    void checkUnreadLogs();
    const interval = setInterval(checkUnreadLogs, 30_000);
    return () => clearInterval(interval);
  }, []);

  async function checkUnreadLogs() {
    try {
      const logRes = await fetch("/api/powerbi/changelog?limit=50", { cache: "no-store" });
      if (logRes.ok) {
        const logJson = await logRes.json();
        const logs = logJson.logs || [];
        const saved = localStorage.getItem("powerbi_read_log_ids");
        const readSet = new Set(saved ? JSON.parse(saved) : []);
        const unread = logs.filter((l: { id: string }) => !readSet.has(l.id)).length;
        setUnreadCount(unread);
      }
    } catch {}
  }

  const navItems = [
    { href: "/", label: "Home Dashboard", icon: Home, exact: true },
    { href: "/reports", label: "Power BI Catalog", icon: LayoutGrid },
    { href: "/changelog", label: "Publish Logs", icon: History },
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
            "fixed top-0 bottom-0 left-0 z-50 transition-all duration-300 ease-in-out md:translate-x-0",
            mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
            "p-3 md:p-4 flex flex-col"
          )}
        >
          <div
            style={{
              background: `linear-gradient(180deg, ${currentTheme.gradientFrom} 0%, ${currentTheme.gradientTo} 100%)`,
              boxShadow: `0 20px 40px -10px ${currentTheme.primaryGlow}`,
            }}
            className="w-20 flex-1 rounded-[32px] flex flex-col items-center justify-between py-6 px-0 text-white relative shadow-2xl transition-all"
          >
            {/* Top Navigation Items */}
            <div className="w-full flex flex-col items-center space-y-4">
              {navItems.map((item) => {
                const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
                const Icon = item.icon;

                return (
                  <div key={item.href} className="w-full flex justify-end">
                    <Link
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      title={item.label}
                      className={clsx(
                        "group relative flex items-center justify-center transition-all duration-200",
                        active
                          ? "curved-tab-active w-[calc(100%-8px)] h-14 shadow-xs"
                          : "w-full h-12 text-white/80 hover:text-white hover:scale-110"
                      )}
                    >
                      <Icon
                        style={{
                          color: active ? currentTheme.primary : "currentColor",
                        }}
                        className={clsx(
                          "transition-transform",
                          active ? "h-6 w-6 stroke-[2.2]" : "h-5 w-5 opacity-90 group-hover:opacity-100"
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
          </div>
        </aside>

        {/* MAIN APPLICATION CANVAS */}
        <div className="flex-1 flex flex-col min-w-0 md:pl-28 transition-all">
          {/* TOP HEADER BAR (Inspired by Screenshot) */}
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

            {/* Right Action Icons: Appearance Gear, Notification Bell, User Avatar */}
            <div className="flex items-center gap-2.5 sm:gap-4">
              {/* Settings / Appearance Link */}
              <Link
                href="/settings"
                title="Appearance & Settings"
                className="h-10 w-10 rounded-full bg-white shadow-xs border border-slate-200/60 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:shadow-sm transition"
              >
                <Settings className="h-4.5 w-4.5 text-slate-600" />
              </Link>

              {/* Notification Bell */}
              <Link
                href="/changelog"
                title="Publish & Change Logs"
                className="relative h-10 w-10 rounded-full bg-white shadow-xs border border-slate-200/60 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:shadow-sm transition"
              >
                <Bell className="h-4.5 w-4.5 text-slate-600" />
                {unreadCount > 0 && (
                  <span
                    style={{ backgroundColor: currentTheme.primary }}
                    className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center border-2 border-white shadow-xs animate-pulse"
                  >
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>

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

          {/* PAGE CONTENT CONTAINER */}
          <main className="flex-1 px-4 md:px-8 pb-12 pt-2">
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
