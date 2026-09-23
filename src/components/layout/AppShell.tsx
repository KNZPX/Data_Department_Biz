"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Database,
  History,
  Inbox,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShieldCheck,
  User,
  X,
} from "lucide-react";
import { clsx } from "clsx";
import { BizAnalyticLogo } from "@/components/brand/BizAnalyticLogo";
import { TokenModal } from "@/components/TokenModal";
import { LoginGate, useAuth } from "@/components/auth/LoginGate";

function AppShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, dbProvider, logout, refreshAuth } = useAuth();
  const [tokenOpen, setTokenOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);

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
    { href: "/", label: "Portal Hub", icon: LayoutDashboard, exact: true },
    { href: "/reports", label: "Reports & Workspaces", icon: Inbox },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="flex min-h-screen bg-[#F4F6F8] text-[#1C252E] selection:bg-[#B45309] selection:text-white">
      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs md:hidden transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={clsx(
          "fixed top-0 bottom-0 left-0 z-50 flex flex-col border-r border-slate-200/70 bg-white transition-all duration-300 ease-in-out md:translate-x-0 shadow-xs",
          collapsed ? "w-20" : "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Brand Top Accent Stripe - Dark Yellow / Amber Gradient */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#B45309] via-[#D97706] to-[#F59E0B]" />

        {/* Sidebar Header & Brand */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-slate-100">
          <Link
            href="/"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-2 overflow-hidden py-1 transition hover:opacity-90"
            title="Biz-Analytic Enterprise Portal"
          >
            {collapsed ? (
              <BizAnalyticLogo size="md" showText={false} />
            ) : (
              <BizAnalyticLogo size="sm" showText={true} subtext="Enterprise BI Hub" />
            )}
          </Link>

          {/* Expand / Collapse Button for Desktop */}
          <button
            type="button"
            onClick={toggleSidebar}
            title={collapsed ? "Expand sidebar" : "Hide / Collapse sidebar"}
            className="hidden md:grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-[#B45309] transition"
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>

          {/* Close Button for Mobile */}
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="grid md:hidden h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5">
          {navItems.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? item.label : undefined}
                className={clsx(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition duration-150 active:scale-[0.98]",
                  active
                    ? "bg-[#B45309]/10 text-[#B45309] font-bold"
                    : "text-[#637381] hover:bg-slate-100/80 hover:text-[#1C252E]",
                  collapsed && "justify-center px-0"
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-[#B45309]" />
                )}
                <Icon className={clsx("h-4.5 w-4.5 shrink-0 transition-transform group-hover:scale-110", active ? "text-[#B45309]" : "text-[#637381] group-hover:text-[#1C252E]")} />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer: User profile, DB Indicator, Sign Out */}
        <div className="border-t border-slate-100 bg-slate-50/60 p-3 space-y-2">
          {/* User Profile Card */}
          {user ? (
            <div
              title={user.email}
              className={clsx(
                "flex items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white p-2 text-xs shadow-2xs",
                collapsed ? "justify-center p-1.5" : ""
              )}
            >
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-[#B45309] text-xs font-bold text-white shadow-xs">
                {user.name ? user.name.slice(0, 1).toUpperCase() : <User className="h-3.5 w-3.5" />}
              </div>
              {!collapsed && (
                <div className="flex flex-col min-w-0 flex-1 leading-tight">
                  <span className="font-bold text-[#B45309] truncate">{user.name}</span>
                  <span className="text-[10px] text-slate-400 truncate font-mono">{user.email}</span>
                </div>
              )}
            </div>
          ) : null}

          {/* Database & Quick Action Buttons */}
          <div className={clsx("flex items-center gap-1.5", collapsed ? "flex-col" : "justify-between")}>
            {/* DB Indicator */}
            {!collapsed && (
              <div className="flex items-center gap-1.5 px-1 text-[10px] font-mono text-slate-500">
                <Database className="h-3 w-3 text-[#B45309]" />
                <span className="font-semibold text-slate-700 uppercase">
                  {dbProvider === "supabase" ? "Supabase Cloud" : "SQLite Local"}
                </span>
              </div>
            )}

            <div className="flex items-center gap-1">
              {/* Access Token Inspector */}
              <button
                type="button"
                onClick={() => setTokenOpen(true)}
                title="Inspect or Copy Access Token"
                className="grid h-8 w-8 place-items-center rounded-xl text-slate-400 hover:bg-[#B45309]/10 hover:text-[#B45309] transition"
              >
                <KeyRound className="h-4 w-4" />
              </button>

              {/* Sign Out */}
              <button
                type="button"
                onClick={() => logout()}
                title="Sign out of Microsoft 365"
                className="grid h-8 w-8 place-items-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Layout */}
      <div
        className={clsx(
          "flex min-h-screen flex-1 flex-col transition-all duration-300 ease-in-out",
          collapsed ? "md:pl-20" : "md:pl-64"
        )}
      >
        {/* Top Header Bar for Mobile & Breadcrumbs */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200/70 bg-white/80 px-4 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger Button */}
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="grid md:hidden h-8 w-8 place-items-center rounded-xl text-slate-600 hover:bg-slate-100"
              aria-label="Open sidebar menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Breadcrumb / Title */}
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-[#B45309]">BIZ-ANALYTIC</span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-600 font-medium">
                {pathname === "/"
                  ? "Portal Hub"
                  : pathname.startsWith("/reports")
                  ? "Reports & Workspaces"
                  : "Settings"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-[#B45309]/10 px-2.5 py-0.5 text-[10px] font-semibold text-[#B45309] border border-[#B45309]/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Biz-Analytic Ready</span>
            </span>
          </div>
        </header>

        {/* Page Content Body */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>

        {/* Global Footer */}
        <footer className="border-t border-slate-200/80 bg-white py-4 text-center text-xs text-slate-400">
          <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px]">
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#B45309]">BIZ-ANALYTIC</span>
              <span>&bull;</span>
              <span>Enterprise Business Analytics & Intelligence Hub</span>
            </div>
            <div>
              <span>Biz-Analytic Department &bull; Power BI Governance Platform</span>
            </div>
          </div>
        </footer>
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
    <Suspense fallback={null}>
      <LoginGate>
        <AppShellInner>{children}</AppShellInner>
      </LoginGate>
    </Suspense>
  );
}
