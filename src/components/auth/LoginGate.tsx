"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, ChevronDown, FunctionSquare, LayoutGrid, Loader2, Users } from "lucide-react";
import { Button, Textarea } from "@/components/ui";
import { canModule, canPage, type Access } from "@/lib/access";

export type AuthUser = {
  name: string;
  email: string;
};

export type AuthContextType = {
  authenticated: boolean;
  user: AuthUser | null;
  dbProvider: string;
  access: Access | null;
  isGuest: boolean;
  refreshAuth: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  authenticated: false,
  user: null,
  dbProvider: "supabase",
  access: null,
  isGuest: false,
  refreshAuth: async () => {},
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

/** can("dax.import") / canPage("licenses") for hiding UI the user isn't allowed to use. */
export function useAccess() {
  const { access } = useContext(AuthContext);
  return {
    access,
    can: (moduleId: string) => canModule(access, moduleId),
    canPage: (pageId: string) => canPage(access, pageId),
    isAdmin: access?.role === "admin",
  };
}

function MicrosoftMark() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 21 21" aria-hidden>
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

const PROMISES = [
  { icon: LayoutGrid, title: "Every Power BI report in one place", body: "Search 465+ reports across all Phuket workspaces and see who published what." },
  { icon: FunctionSquare, title: "One DAX dictionary for the team", body: "Formulas, definitions and notes for PKT-D01 and PKT-D02, updated from each model release." },
  { icon: Users, title: "Your own session", body: "Each person signs in with their own Microsoft account and sees only their own Power BI access." },
];

export function LoginGate({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [dbProvider, setDbProvider] = useState<string>("supabase");
  const [access, setAccess] = useState<Access | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [guestOpen, setGuestOpen] = useState(false);
  const [guestUser, setGuestUser] = useState("");
  const [guestPass, setGuestPass] = useState("");
  const [guestBusy, setGuestBusy] = useState(false);
  const [guestError, setGuestError] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualToken, setManualToken] = useState("");
  const [manualSaving, setManualSaving] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  // Leaving for Microsoft's sign-in page takes a moment: show it's on its way.
  const [redirecting, setRedirecting] = useState(false);
  useEffect(() => {
    // Coming back with the browser's Back button restores this page from cache.
    const onShow = (e: PageTransitionEvent) => e.persisted && setRedirecting(false);
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  const authError = searchParams.get("powerbi_auth_error");

  useEffect(() => {
    void checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const res = await fetch("/api/powerbi/token", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setAuthenticated(Boolean(data.hasToken && !data.expired));
        setUser(data.user || null);
        setAccess(data.access || null);
        setIsGuest(Boolean(data.isGuest));
        setDisabled(Boolean(data.disabled));
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

  async function handleGuestLogin(e: React.FormEvent) {
    e.preventDefault();
    setGuestBusy(true);
    setGuestError(null);
    try {
      const res = await fetch("/api/auth/guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: guestUser.trim(), password: guestPass }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sign-in failed.");
      setGuestPass("");
      await checkAuth();
    } catch (err) {
      setGuestError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setGuestBusy(false);
    }
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
      if (!res.ok) throw new Error(data.error || "The token could not be saved.");
      setManualToken("");
      setManualOpen(false);
      await checkAuth();
    } catch (err) {
      setManualError(err instanceof Error ? err.message : "The token could not be saved.");
    } finally {
      setManualSaving(false);
    }
  }

  if (loading) return <SigningIn label="Signing in" note="Checking your session" />;
  if (redirecting) return <SigningIn label="Signing in" note="Taking you to Microsoft" />;

  if (authenticated) {
    return (
      <AuthContext.Provider value={{ authenticated, user, dbProvider, access, isGuest, refreshAuth: checkAuth, logout: handleLogout }}>
        {children}
      </AuthContext.Provider>
    );
  }

  return (
    <div className="app-viewport grid overflow-y-auto lg:grid-cols-[1.05fr_1fr] bg-white">
      {/* Left: what this place is */}
      <section className="relative hidden flex-col justify-between overflow-hidden border-r border-slate-200/80 bg-slate-50 p-12 lg:flex">
        <div className="model-grid absolute inset-0" aria-hidden />
        <div
          className="absolute -right-24 -top-24 h-80 w-80 rounded-full opacity-60 blur-3xl"
          style={{ background: "radial-gradient(circle, color-mix(in oklab, var(--accent) 22%, transparent), transparent 70%)" }}
          aria-hidden
        />
        <div className="relative flex items-center gap-3 fade-enter">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-blue-600 text-sm font-bold text-white">BA</span>
          <div className="leading-tight">
            <p className="text-[15px] font-semibold text-slate-900">Biz-Analytic</p>
            <p className="text-xs text-slate-500">Data &amp; Business Analysis · BDMS Phuket</p>
          </div>
        </div>

        <div className="relative max-w-lg">
          <h2 className="page-enter text-[38px] font-semibold leading-[1.1] tracking-tight text-slate-900">
            The data team&rsquo;s workbench for <span className="text-blue-600">Power BI</span>.
          </h2>
          <ul className="stagger mt-10 space-y-5">
            {PROMISES.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-blue-600 shadow-[0_1px_2px_rgb(16_24_40/0.05)]">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <div>
                  <p className="text-[15px] font-medium text-slate-900">{title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-500">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-slate-400">For Bangkok Hospital Phuket, Siriroj and Dibuk</p>
      </section>

      {/* Right: sign in */}
      <section className="flex flex-col justify-center px-6 py-12 sm:px-16">
        <div className="page-enter mx-auto w-full max-w-sm">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-sm font-bold text-white">BA</span>
            <p className="text-[15px] font-semibold text-slate-900">Biz-Analytic</p>
          </div>

          <h1 className="text-[28px] font-semibold tracking-tight text-slate-900">Sign in</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-slate-500">
            Use your hospital Microsoft 365 account. Your Power BI permissions come with you.
          </p>

          {authError && (
            <div role="alert" className="mt-6 flex gap-3 rounded-xl border border-coral/30 bg-coral/[0.06] p-4 text-sm text-slate-800">
              <AlertCircle className="h-5 w-5 shrink-0 text-coral" />
              <div>
                <p className="font-medium">Sign-in didn&rsquo;t finish</p>
                <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{authError}</p>
              </div>
            </div>
          )}

          <a
            href="/api/powerbi/auth/start"
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
              setRedirecting(true);
            }}
            className="mt-8 flex w-full items-center justify-center gap-3 rounded-lg bg-blue-600 px-5 py-3 text-[15px] font-medium text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.99]"
          >
            <MicrosoftMark />
            Continue with Microsoft
          </a>

          <p className="mt-4 text-[13px] leading-relaxed text-slate-500">
            Signing in on this device doesn&rsquo;t sign anyone else in or out.
          </p>

          {disabled && (
            <p role="alert" className="mt-4 rounded-xl bg-coral/[0.06] p-3 text-sm text-slate-700">
              This account has been turned off. Ask an admin to turn it back on.
            </p>
          )}

          <div className="mt-8 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setGuestOpen(!guestOpen)}
              aria-expanded={guestOpen}
              className="flex w-full items-center justify-between px-4 py-3 text-[14px] font-medium text-slate-800"
            >
              Sign in with a guest account
              <ChevronDown className={`h-4 w-4 text-slate-400 transition ${guestOpen ? "rotate-180" : ""}`} />
            </button>
            {guestOpen && (
              <form onSubmit={handleGuestLogin} className="pop-in space-y-3 border-t border-slate-100 p-4">
                <label className="block text-[13px] text-slate-600">
                  Username
                  <input
                    value={guestUser}
                    onChange={(e) => setGuestUser(e.target.value)}
                    autoComplete="username"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  />
                </label>
                <label className="block text-[13px] text-slate-600">
                  Password
                  <input
                    type="password"
                    value={guestPass}
                    onChange={(e) => setGuestPass(e.target.value)}
                    autoComplete="current-password"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  />
                </label>
                {guestError && <p className="text-[13px] text-coral">{guestError}</p>}
                <button
                  type="submit"
                  disabled={guestBusy || !guestUser.trim() || !guestPass}
                  className={`w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 ${guestBusy ? "cursor-wait" : "disabled:opacity-50"}`}
                >
                  {guestBusy ? <BusyLabel text="Signing in" /> : "Sign in as guest"}
                </button>
                <p className="text-xs text-slate-400">Guest accounts are created by an admin and see only the pages they&rsquo;re given.</p>
              </form>
            )}
          </div>

          <div className="mt-8 border-t border-slate-200 pt-5">
            <button
              type="button"
              onClick={() => setManualOpen(!manualOpen)}
              className="flex w-full items-center justify-between text-[13px] text-slate-500 hover:text-slate-800"
              aria-expanded={manualOpen}
            >
              Paste an access token instead
              <ChevronDown className={`h-4 w-4 transition ${manualOpen ? "rotate-180" : ""}`} />
            </button>
            {manualOpen && (
              <div className="mt-3 space-y-3">
                <Textarea
                  dense
                  rows={4}
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  placeholder="eyJ0eXAiOiJKV1Qi..."
                  className="font-mono text-xs"
                />
                {manualError && <p className="text-xs text-coral">{manualError}</p>}
                <Button dense onClick={handleSaveManualToken} disabled={manualSaving || !manualToken.trim()}>
                  {manualSaving ? <BusyLabel text="Signing in" /> : "Sign in with token"}
                </Button>
                <p className="text-xs leading-relaxed text-slate-400">
                  For admins when Microsoft sign-in is unavailable. Tokens expire after about an hour.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

/** Animated "Signing in..." dots. */
function Dots() {
  return (
    <span className="signin-dots ml-0.5 inline-flex" aria-hidden>
      <span>.</span>
      <span>.</span>
      <span>.</span>
    </span>
  );
}

function BusyLabel({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center justify-center gap-2">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>
        {text}
        <Dots />
      </span>
    </span>
  );
}

/** Full-screen sign-in loader: the logo breathes inside a spinning ring, with a sliding progress bar. */
function SigningIn({ label, note }: { label: string; note: string }) {
  return (
    <div className="app-viewport fade-enter flex items-center justify-center bg-paper" role="status" aria-live="polite">
      <div className="flex flex-col items-center">
        <div className="relative grid h-20 w-20 place-items-center">
          <span className="signin-ring absolute inset-0 rounded-full" aria-hidden />
          <span className="signin-logo grid h-12 w-12 place-items-center rounded-xl bg-blue-600 text-[15px] font-bold text-white shadow-[0_8px_24px_-8px_rgb(37_99_235/0.6)]">BA</span>
        </div>
        <p className="mt-6 text-[17px] font-semibold tracking-tight text-slate-900">
          {label}
          <Dots />
        </p>
        <p className="mt-1 text-[13px] text-slate-500">{note}</p>
        <div className="mt-5 h-1 w-44 overflow-hidden rounded-full bg-slate-200/80">
          <div className="signin-bar h-full w-1/3 rounded-full bg-blue-600" />
        </div>
      </div>
    </div>
  );
}
