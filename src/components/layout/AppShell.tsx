"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Database,
  History,
  KeyRound,
  Layers,
  Settings,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { clsx } from "clsx";
import { TokenModal } from "@/components/TokenModal";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [tokenOpen, setTokenOpen] = useState(false);
  const [tokenActive, setTokenActive] = useState(false);
  const [dbProvider, setDbProvider] = useState<string>("sqlite");
  const [unreadCount, setUnreadCount] = useState<number>(0);

  useEffect(() => {
    void checkStatus();
    const interval = setInterval(checkStatus, 30_000);
    return () => clearInterval(interval);
  }, []);

  async function checkStatus() {
    try {
      const res = await fetch("/api/powerbi/token", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setTokenActive(Boolean(json.hasToken && !json.expired));
      }
    } catch {}

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
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="grid h-9 w-9 place-items-center rounded-2xl bg-amber-400 text-slate-950 shadow-xs group-hover:scale-105 transition">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-black tracking-tight text-slate-900 text-base sm:text-lg">Power BI</span>
                  <span className="rounded-full bg-amber-100 px-2 py-0.2 font-mono text-[10px] font-bold text-amber-800 border border-amber-200">
                    PORTAL
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 -mt-0.5">Standalone Catalog & License Manager</p>
              </div>
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
                      ? "bg-slate-900 text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{item.label}</span>
                  {item.count && item.count > 0 ? (
                    <span className="ml-1 rounded-full bg-rose-500 px-1.5 py-0.2 text-[10px] font-bold text-white">
                      {item.count}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          {/* Quick Status Tools */}
          <div className="flex items-center gap-2">
            {/* Database Engine Pill */}
            <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-600 border border-slate-200/80">
              <Database className="h-3 w-3 text-slate-500" />
              <span>DB:</span>
              <span className="font-bold text-slate-800 uppercase font-mono">SQLite (Local)</span>
            </div>

            {/* Token / OAuth Status Button */}
            <button
              type="button"
              onClick={() => setTokenOpen(true)}
              className={clsx(
                "flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold border transition shadow-2xs active:scale-95",
                tokenActive
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                  : "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
              )}
            >
              <KeyRound className={clsx("h-3 w-3", tokenActive ? "text-emerald-600" : "text-amber-600")} />
              <span>{tokenActive ? "MS OAuth เชื่อมต่อแล้ว" : "ต่อกับ Microsoft"}</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="flex md:hidden border-t border-slate-100 px-4 py-2 gap-1 overflow-x-auto">
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
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                )}
              >
                <Icon className="h-3 w-3" />
                <span>{item.label}</span>
                {item.count && item.count > 0 ? (
                  <span className="rounded-full bg-rose-500 px-1.5 py-0.2 text-[9px] font-bold text-white">
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

      <TokenModal
        isOpen={tokenOpen}
        onClose={() => setTokenOpen(false)}
        onSuccess={() => checkStatus()}
      />
    </div>
  );
}
