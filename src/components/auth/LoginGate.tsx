"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useSearchParams, usePathname } from "next/navigation";
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
import { BizAnalyticLogo } from "@/components/brand/BizAnalyticLogo";

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
  const pathname = usePathname();
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
        const userData = data.user || null;
        setUser(userData);
        if (data.dbProvider) setDbProvider(data.dbProvider);

        if (isValid && userData && userData.email) {
          const sessionKey = `login_recorded_${userData.email}`;
          if (!sessionStorage.getItem(sessionKey)) {
            sessionStorage.setItem(sessionKey, "true");
            void fetch("/api/users", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: userData.name || userData.email,
                email: userData.email,
              }),
            });
          }
        }
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
      if (!res.ok) throw new Error(data.error || "Failed to save Token");
      setManualToken("");
      setManualOpen(false);
      await checkAuth();
    } catch (err) {
      setManualError(err instanceof Error ? err.message : "An error occurred while saving Token");
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
            <h3 className="text-base font-bold text-slate-800">Verifying access authorization...</h3>
            <p className="text-xs text-slate-400">Power BI Enterprise Analytics Portal</p>
          </div>
        </div>
      </div>
    );
  }

  // 2. On Landing Page (/), allow rendering so Full-page Vertical Scroll with Login Section 1 is shown
  if (pathname === "/") {
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

  // 3. Unauthenticated on protected routes (/reports, /settings): Show Gatekeeper
  if (!authenticated) {
    return (
      <div className="relative flex min-h-screen flex-col justify-between bg-gradient-to-b from-slate-50 via-white to-amber-50/20 text-slate-800 selection:bg-[#B45309] selection:text-white">
        {/* Brand CI Top Accent Bar - Dark Yellow / Amber */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#B45309] via-[#D97706] to-[#F59E0B]" />

        {/* Ambient Analytics Soft Lighting */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-[#B45309]/5 blur-3xl" />
          <div className="absolute top-1/3 -right-32 h-96 w-96 rounded-full bg-[#D97706]/5 blur-3xl" />
          <div className="absolute -bottom-32 left-1/4 h-96 w-96 rounded-full bg-[#F59E0B]/5 blur-3xl" />
        </div>

        {/* Top Header Branding */}
        <header className="relative z-10 mx-auto w-full max-w-7xl px-6 py-6 sm:px-10">
          <div className="flex items-center justify-between">
            <BizAnalyticLogo size="md" subtext="Enterprise Analytics Portal" />
            <div className="hidden sm:flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-3.5 py-1 text-[11px] font-medium text-slate-600 shadow-2xs backdrop-blur-xs">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Biz-Analytic Department</span>
            </div>
          </div>
        </header>

        {/* Center Main Login Card */}
        <main className="relative z-10 mx-auto my-auto w-full max-w-md px-4 py-8">
          <div className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-7 shadow-xl shadow-slate-200/70 sm:p-9">
            {/* Top decorative stripe inside card */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#B45309] via-[#D97706] to-[#F59E0B]" />

            {/* Analytics Emblem & Title */}
            <div className="text-center pt-2">
              <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#B45309]/10 border border-[#B45309]/20 shadow-2xs">
                <Lock className="h-6 w-6 text-[#B45309]" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-[#B45309] sm:text-2xl">
                Enterprise Sign In
              </h1>
              <p className="mt-1.5 text-xs text-slate-500">
                Biz-Analytic Intelligence & Power BI Portal
              </p>
              <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-[#B45309]/10 px-3 py-0.5 text-[11px] font-semibold text-[#B45309] border border-[#B45309]/20">
                <Sparkles className="h-3 w-3" />
                <span>Enterprise Business Analytics & Intelligence</span>
              </div>
            </div>

            {/* Error Message if redirected back with error */}
            {authError ? (
              <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                  <div>
                    <span className="font-bold">Authentication error:</span>
                    <p className="mt-1 text-[11px] leading-relaxed text-rose-700">{authError}</p>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Primary Action: Sign in with Microsoft */}
            <div className="mt-7 space-y-3.5">
              <a
                href="/api/powerbi/auth/start"
                className="group relative flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-slate-200 bg-white px-5 py-3.5 text-sm font-semibold text-slate-800 shadow-xs hover:border-[#B45309] hover:bg-amber-50/30 hover:text-[#B45309] active:scale-[0.99] transition duration-150"
              >
                {/* Official Microsoft 4-square logo */}
                <svg className="h-5 w-5 shrink-0" viewBox="0 0 21 21">
                  <rect x="1" y="1" width="9" height="9" fill="#F25022" />
                  <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
                  <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
                  <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
                </svg>
                <span>Sign in with Microsoft 365</span>
              </a>

              <div className="flex items-center justify-center gap-1.5 pt-0.5 text-[11px] text-slate-500">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                <span>Secured via Microsoft Entra ID (Single Sign-On)</span>
              </div>
            </div>

            {/* Secondary Option: Manual Token Fallback */}
            <div className="mt-7 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setManualOpen((v) => !v)}
                className="flex w-full items-center justify-between text-xs text-slate-500 hover:text-[#B45309] transition"
              >
                <span className="flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5 text-slate-400" />
                  <span>Administrator Access (Manual Token Fallback)</span>
                </span>
                <ChevronDown className={`h-4 w-4 transition duration-150 ${manualOpen ? "rotate-180" : ""}`} />
              </button>

              {manualOpen ? (
                <div className="mt-3 space-y-2.5 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-xs animate-in fade-in duration-150">
                  <p className="text-[11px] text-slate-600">
                    If Microsoft Online is temporarily unreachable, you may paste a valid Power BI Bearer Token:
                  </p>
                  <Textarea
                    rows={3}
                    placeholder="Paste Bearer eyJhbGciOi..."
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                    className="font-mono text-[11px] bg-white border-slate-200 text-slate-800 placeholder:text-slate-400"
                  />
                  {manualError ? (
                    <p className="text-[11px] text-rose-600 font-medium">{manualError}</p>
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
                      <span>Save Token & Sign In</span>
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>

            {/* System Status Pills */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-slate-50 px-3.5 py-2.5 text-[11px] text-slate-500 border border-slate-200/80">
              <span className="flex items-center gap-1.5">
                <Database className="h-3 w-3 text-[#B45309]" />
                <span>DB:</span>
                <span className="font-semibold text-[#B45309] uppercase font-mono">
                  {dbProvider === "supabase" ? "Supabase Cloud" : "SQLite Local"}
                </span>
              </span>
              <span className="flex items-center gap-1 text-emerald-700 font-medium">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                <span>Connected & Ready</span>
              </span>
            </div>
          </div>
        </main>

        {/* Brand Footer */}
        <footer className="relative z-10 px-6 py-5 text-center text-xs text-slate-400">
          <p>
            Biz-Analytic Department &bull; Enterprise Business Intelligence &bull; Power BI Platform
          </p>
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
