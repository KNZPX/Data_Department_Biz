"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Database,
  KeyRound,
  Loader2,
  Lock,
  LogIn,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button, Textarea } from "@/components/ui";

export type AuthUser = {
  name: string;
  email: string;
};

export type AuthContextType = {
  authenticated: boolean;
  user: AuthUser | null;
  dbProvider: string;
  refreshAuth: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  authenticated: false,
  user: null,
  dbProvider: "supabase",
  refreshAuth: async () => {},
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function LoginGate({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [dbProvider, setDbProvider] = useState<string>("supabase");
  const [manualOpen, setManualOpen] = useState(false);
  const [manualToken, setManualToken] = useState("");
  const [manualSaving, setManualSaving] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  const authError = searchParams.get("powerbi_auth_error");

  useEffect(() => {
    void checkAuth();
  }, []);

  async function checkAuth() {
    try {
      setLoading(true);
      const res = await fetch("/api/powerbi/token", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        const isValid = Boolean(data.hasToken && !data.expired);
        setAuthenticated(isValid);
        setUser(data.user || null);
        if (data.dbProvider) setDbProvider(data.dbProvider);
      } else {
        setAuthenticated(false);
      }
    } catch {
      setAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await fetch("/api/powerbi/auth/logout", { method: "POST" });
    } catch {}
    setAuthenticated(false);
    setUser(null);
    window.location.href = "/";
  }

  async function handleSaveManualToken() {
    if (!manualToken.trim()) return;
    setManualSaving(true);
    setManualError(null);
    try {
      const res = await fetch("/api/powerbi/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: manualToken.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "บันทึก Token ไม่สำเร็จ");
      setManualToken("");
      setManualOpen(false);
      await checkAuth();
    } catch (err) {
      setManualError(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการบันทึก Token");
    } finally {
      setManualSaving(false);
    }
  }

  // 1. Loading State
  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="relative">
            <div className="grid h-16 w-16 place-items-center rounded-3xl bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/20 animate-pulse">
              <BarChart3 className="h-8 w-8" />
            </div>
            <div className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-slate-900 text-white shadow-xs">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" />
            </div>
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">กำลังตรวจสอบสิทธิ์การเข้าใช้งาน...</h3>
            <p className="text-xs text-slate-400">Power BI Enterprise Portal</p>
          </div>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated: Show Microsoft Login Gatekeeper
  if (!authenticated) {
    return (
      <div className="relative flex min-h-screen flex-col justify-between bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-slate-100 selection:bg-amber-400 selection:text-slate-950">
        {/* Subtle decorative background glow */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl" />
          <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
        </div>

        {/* Top Minimal Branding */}
        <header className="relative z-10 px-6 py-6 sm:px-10">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black tracking-tight text-white">Power BI</span>
                <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-400/30 font-mono">
                  PORTAL
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Enterprise Analytics & License Manager</p>
            </div>
          </div>
        </header>

        {/* Center Main Card */}
        <main className="relative z-10 mx-auto my-auto w-full max-w-md px-4 py-8">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
            {/* Header Icon & Title */}
            <div className="text-center">
              <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800 border border-slate-700/80 shadow-inner">
                <Lock className="h-7 w-7 text-amber-400" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                เข้าสู่ระบบเพื่อเข้าใช้งาน
              </h1>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                ยืนยันตัวตนด้วยบัญชี <span className="font-semibold text-slate-200">Microsoft 365 องค์กร</span> เพื่อเข้าถึงรายงาน Power BI, แดชบอร์ด และข้อมูลสิทธิ์
              </p>
            </div>

            {/* Error Message if redirected back with error */}
            {authError ? (
              <div className="mt-5 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                  <div>
                    <span className="font-bold">เกิดข้อผิดพลาดในการเข้าสู่ระบบ:</span>
                    <p className="mt-1 text-[11px] leading-relaxed text-rose-200/90">{authError}</p>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Primary Action: Sign in with Microsoft */}
            <div className="mt-7 space-y-3">
              <a
                href="/api/powerbi/auth/start"
                className="group relative flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-5 py-3.5 text-sm font-semibold text-slate-900 shadow-md hover:bg-slate-100 active:scale-[0.99] transition duration-150"
              >
                {/* Official Microsoft 4-square logo */}
                <svg className="h-5 w-5 shrink-0" viewBox="0 0 21 21">
                  <rect x="1" y="1" width="9" height="9" fill="#F25022" />
                  <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
                  <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
                  <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
                </svg>
                <span>เข้าสู่ระบบด้วย Microsoft 365</span>
              </a>

              <div className="flex items-center justify-center gap-2 pt-1 text-[11px] text-slate-400">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span>ยืนยันตัวตนอย่างปลอดภัยผ่าน Microsoft Entra ID</span>
              </div>
            </div>

            {/* Secondary Option: Manual Token Fallback */}
            <div className="mt-8 border-t border-slate-800/80 pt-4">
              <button
                type="button"
                onClick={() => setManualOpen((v) => !v)}
                className="flex w-full items-center justify-between text-xs text-slate-400 hover:text-slate-200 transition"
              >
                <span className="flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5 text-slate-500" />
                  <span>ตัวเลือกผู้ดูแลระบบ (Manual Token Fallback)</span>
                </span>
                <ChevronDown className={`h-4 w-4 transition duration-150 ${manualOpen ? "rotate-180" : ""}`} />
              </button>

              {manualOpen ? (
                <div className="mt-3 space-y-2.5 rounded-2xl border border-slate-800 bg-slate-950/60 p-3.5 text-xs animate-in fade-in duration-150">
                  <p className="text-[11px] text-slate-400">
                    กรณีไม่สามารถเชื่อมต่อ Microsoft Online ได้ชั่วคราว สามารถวาง Access Token (Bearer) เพื่อเข้าใช้งาน:
                  </p>
                  <Textarea
                    rows={3}
                    placeholder="วาง Bearer eyJhbGciOi..."
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                    className="font-mono text-[11px] bg-slate-900 border-slate-700 text-slate-200 placeholder:text-slate-600"
                  />
                  {manualError ? (
                    <p className="text-[11px] text-rose-400 font-medium">{manualError}</p>
                  ) : null}
                  <div className="flex justify-end pt-1">
                    <Button
                      type="button"
                      variant="primary"
                      dense
                      disabled={manualSaving || !manualToken.trim()}
                      onClick={handleSaveManualToken}
                    >
                      {manualSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                      <span>บันทึก Token เข้าสู่ระบบ</span>
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>

            {/* System Status Pills */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-slate-950/40 px-3.5 py-2.5 text-[11px] text-slate-400 border border-slate-800/60">
              <span className="flex items-center gap-1.5">
                <Database className="h-3 w-3 text-emerald-400" />
                <span>DB:</span>
                <span className="font-semibold text-slate-200 uppercase font-mono">
                  {dbProvider === "supabase" ? "Supabase Cloud" : "SQLite Local"}
                </span>
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                <span>พร้อมใช้งาน</span>
              </span>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="relative z-10 px-6 py-4 text-center text-xs text-slate-400">
          <p>Power BI Analytics Portal &bull; Enterprise Hospital Data Management</p>
        </footer>
      </div>
    );
  }

  // 3. Authenticated: Render Full Portal App
  return (
    <AuthContext.Provider
      value={{
        authenticated,
        user,
        dbProvider,
        refreshAuth: checkAuth,
        logout: handleLogout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
