"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  BarChart3,
  Database,
  History,
  KeyRound,
  LogOut,
  Settings,
  ShieldCheck,
  User,
} from "lucide-react";
import { clsx } from "clsx";
import { BangkokHospitalLogo } from "@/components/brand/BangkokHospitalLogo";
import { TokenModal } from "@/components/TokenModal";
import { LoginGate, useAuth } from "@/components/auth/LoginGate";

function AppShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, dbProvider, logout, refreshAuth } = useAuth();
  const [tokenOpen, setTokenOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);

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
    { href: "/", label: "รายงาน & แดชบอร์ด", icon: BarChart3, exact: true },
    { href: "/licenses", label: "จัดการไลเซนส์ (32 Columns)", icon: ShieldCheck },
    { href: "/changelog", label: "ประวัติการเผยแพร่", icon: History, count: unreadCount },
    { href: "/settings", label: "ตั้งค่า & ฐานข้อมูล", icon: Settings },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      {/* Brand CI Top Accent Bar */}
      <div className="h-1 bg-gradient-to-r from-[#002D72] via-[#002D72] to-[#AB2328]" />

      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="group transition hover:opacity-90">
              <BangkokHospitalLogo size="md" subtext="Data Department · Power BI Portal" />
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition duration-150 active:scale-95",
                    active
                      ? "bg-[#002D72] text-white shadow-xs"
                      : "text-slate-600 hover:bg-[#002D72]/5 hover:text-[#002D72]"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{item.label}</span>
                  {item.count && item.count > 0 ? (
                    <span className="ml-1 rounded-full bg-[#AB2328] px-1.5 py-0.2 text-[10px] font-bold text-white shadow-2xs">
                      {item.count}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          {/* User Profile & Quick Status Tools */}
          <div className="flex items-center gap-2">
            {/* Database Engine Pill */}
            <div className="hidden lg:flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-600 border border-slate-200/80">
              <Database className="h-3 w-3 text-[#002D72]" />
              <span>DB:</span>
              <span className="font-bold text-[#002D72] uppercase font-mono">
                {dbProvider === "supabase" ? "Supabase (Cloud)" : "SQLite (Local)"}
              </span>
            </div>

            {/* Authenticated Microsoft User Badge */}
            {user ? (
              <div
                title={user.email}
                className="hidden sm:flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-700 shadow-2xs"
              >
                <div className="grid h-5 w-5 place-items-center rounded-full bg-[#002D72] text-[10px] font-bold text-white">
                  {user.name ? user.name.slice(0, 1).toUpperCase() : <User className="h-3 w-3" />}
                </div>
                <div className="flex flex-col text-left leading-tight">
                  <span className="font-bold text-[#002D72] max-w-[140px] truncate">{user.name}</span>
                  <span className="text-[9px] text-slate-400 max-w-[140px] truncate font-mono">{user.email}</span>
                </div>
              </div>
            ) : null}

            {/* Token details button */}
            <button
              type="button"
              onClick={() => setTokenOpen(true)}
              title="ตรวจสอบหรือคัดลอก Access Token"
              className="grid h-8 w-8 place-items-center rounded-full text-slate-500 hover:bg-[#002D72]/10 hover:text-[#002D72] transition border border-transparent hover:border-slate-200"
            >
              <KeyRound className="h-4 w-4" />
            </button>

            {/* Sign Out Button */}
            <button
              type="button"
              onClick={() => logout()}
              title="ออกจากระบบ"
              className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 hover:border-[#AB2328]/40 hover:bg-[#AB2328]/5 hover:text-[#AB2328] transition shadow-2xs active:scale-95"
            >
              <LogOut className="h-3.5 w-3.5 text-slate-400 group-hover:text-[#AB2328]" />
              <span className="hidden sm:inline">ออกจากระบบ</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="flex md:hidden border-t border-slate-100 px-4 py-2 gap-1 overflow-x-auto bg-white">
          {navItems.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap transition",
                  active
                    ? "bg-[#002D72] text-white"
                    : "text-slate-600 hover:bg-[#002D72]/5 hover:text-[#002D72]"
                )}
              >
                <Icon className="h-3 w-3" />
                <span>{item.label}</span>
                {item.count && item.count > 0 ? (
                  <span className="rounded-full bg-[#AB2328] px-1.5 py-0.2 text-[9px] font-bold text-white">
                    {item.count}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto flex-1 w-full max-w-7xl px-4 py-6 sm:px-6">{children}</main>

      {/* Bangkok Hospital Brand Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#002D72]">BANGKOK HOSPITAL</span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-500 font-medium">พัฒนาไม่หยุด สู่ขีดสุดการดูแล</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <span>BDMS Data Department · Power BI Portal</span>
            <span>•</span>
            <span>Healthcare Analytics Platform</span>
          </div>
        </div>
      </footer>

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
