"use client";

import { useEffect, useState } from "react";
import {
  Bell,
  Check,
  CheckCircle2,
  Copy,
  Database,
  ExternalLink,
  KeyRound,
  LayoutDashboard,
  LogIn,
  Pin,
  RefreshCw,
  Save,
  Server,
  ShieldAlert,
  Sparkles,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { Button, Input, Panel, Textarea } from "@/components/ui";
import { TokenModal } from "@/components/TokenModal";
import { useTheme } from "@/context/ThemeContext";

export function SettingsPage() {
  const [tokenStatus, setTokenStatus] = useState<{
    hasToken: boolean;
    accessToken?: string | null;
    expiresAt: string | null;
    expired: boolean;
  } | null>(null);
  const [tokenModalOpen, setTokenModalOpen] = useState(false);

  // Tabs: portal | connection
  const [activeTab, setActiveTab] = useState<"portal" | "connection">("portal");

  // Theme Context (Ocean Sapphire)
  const { currentTheme } = useTheme();

  // Portal Management State (Persisted in localStorage)
  const [portalTitle, setPortalTitle] = useState("Biz-Analytic Intelligence Platform");
  const [portalSubtitle, setPortalSubtitle] = useState(
    "Centralized enterprise business intelligence portal, executive KPI metrics, certified Power BI semantic models, version audit logs, and governance."
  );
  const [portalBannerActive, setPortalBannerActive] = useState(true);
  const [portalAnnouncement, setPortalAnnouncement] = useState(
    "Q1 2026 Semantic Models and Enterprise Dashboards are active and synchronized with Supabase Database."
  );
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    void fetchToken();
    loadPortalConfig();
  }, []);

  async function fetchToken() {
    try {
      const res = await fetch("/api/powerbi/token", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setTokenStatus(json);
      }
    } catch {}
  }

  function loadPortalConfig() {
    const saved = localStorage.getItem("portal_hub_settings");
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.portalTitle) setPortalTitle(data.portalTitle);
        if (data.portalSubtitle) setPortalSubtitle(data.portalSubtitle);
        if (data.portalBannerActive !== undefined) setPortalBannerActive(data.portalBannerActive);
        if (data.portalAnnouncement) setPortalAnnouncement(data.portalAnnouncement);
      } catch {}
    }
  }

  function handleSavePortalConfig() {
    const data = {
      portalTitle,
      portalSubtitle,
      portalBannerActive,
      portalAnnouncement,
    };
    localStorage.setItem("portal_hub_settings", JSON.stringify(data));
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  }

  return (
    <div className="h-full overflow-y-auto space-y-6 max-w-5xl mx-auto pb-12 pr-1">
      {/* Navigation Tabs Header */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/80 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("portal")}
          style={{
            backgroundColor: activeTab === "portal" ? currentTheme.primary : "transparent",
            color: activeTab === "portal" ? "#ffffff" : "#475569",
          }}
          className="flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold transition shadow-xs hover:opacity-90"
        >
          <LayoutDashboard className="h-4 w-4" />
          <span>Portal Hub Customization</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("connection")}
          style={{
            backgroundColor: activeTab === "connection" ? currentTheme.primary : "transparent",
            color: activeTab === "connection" ? "#ffffff" : "#475569",
          }}
          className="flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold transition shadow-xs hover:opacity-90"
        >
          <KeyRound className="h-4 w-4" />
          <span>Connection & Database</span>
        </button>
      </div>

      {/* 1. PORTAL MANAGEMENT TAB */}
      {activeTab === "portal" && (
        <div className="space-y-5">
          <div className="squircle-card p-6 md:p-8 space-y-6 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div
                  style={{
                    backgroundColor: currentTheme.primaryLight,
                    color: currentTheme.primary,
                  }}
                  className="grid h-12 w-12 place-items-center rounded-2xl shadow-xs"
                >
                  <LayoutDashboard className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Portal Content & Headlines</h2>
                  <p className="text-xs text-slate-500">
                    Configure welcome hero messages, broadcast banners, and portal descriptions
                  </p>
                </div>
              </div>

              {savedSuccess && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 border border-emerald-200 animate-in fade-in">
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Saved Successfully!</span>
                </span>
              )}
            </div>

            <div className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">Portal Hero Headline</label>
                <Input
                  value={portalTitle}
                  onChange={(e) => setPortalTitle(e.target.value)}
                  placeholder="Enter main portal title..."
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">Portal Description Subtitle</label>
                <Textarea
                  rows={2}
                  value={portalSubtitle}
                  onChange={(e) => setPortalSubtitle(e.target.value)}
                  placeholder="Enter description..."
                />
              </div>

              <div className="border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="font-bold text-slate-700">Broadcast Banner Announcement</label>
                    <p className="text-[11px] text-slate-500">
                      Display an executive notice bar across the top of the portal
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPortalBannerActive(!portalBannerActive)}
                    className="text-slate-500 hover:text-slate-800 transition"
                  >
                    {portalBannerActive ? (
                      <ToggleRight
                        style={{ color: currentTheme.primary }}
                        className="h-7 w-7"
                      />
                    ) : (
                      <ToggleLeft className="h-7 w-7 text-slate-300" />
                    )}
                  </button>
                </div>

                {portalBannerActive && (
                  <div className="mt-2.5">
                    <Input
                      value={portalAnnouncement}
                      onChange={(e) => setPortalAnnouncement(e.target.value)}
                      placeholder="e.g. Q1 2026 Semantic Models are synchronized..."
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-3">
                <button
                  type="button"
                  onClick={handleSavePortalConfig}
                  style={{
                    backgroundColor: currentTheme.primary,
                    boxShadow: `0 8px 16px -2px ${currentTheme.primaryGlow}`,
                  }}
                  className="flex items-center gap-2 rounded-full px-6 py-2.5 text-xs font-bold text-white transition hover:opacity-90"
                >
                  <Save className="h-4 w-4" />
                  <span>Save Portal Settings</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. CONNECTION & DATABASE TAB */}
      {activeTab === "connection" && (
        <div className="space-y-5">
          <div className="squircle-card p-6 md:p-8 space-y-5 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div
                  style={{
                    backgroundColor: currentTheme.primaryLight,
                    color: currentTheme.primary,
                  }}
                  className="grid h-12 w-12 place-items-center rounded-2xl shadow-xs"
                >
                  <KeyRound className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Microsoft 365 OAuth & Database Status</h2>
                  <p className="text-xs text-slate-500">
                    Live connection status for Power BI REST API, Microsoft Entra ID, and Supabase Database
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setTokenModalOpen(true)}
                style={{
                  backgroundColor: currentTheme.primary,
                  boxShadow: `0 8px 16px -2px ${currentTheme.primaryGlow}`,
                }}
                className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold text-white transition hover:opacity-90"
              >
                <KeyRound className="h-3.5 w-3.5" />
                <span>Update Token</span>
              </button>
            </div>

            {tokenStatus?.hasToken ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 text-xs space-y-2">
                <div className="flex items-center gap-2 text-emerald-800 font-bold">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Microsoft 365 Access Token Active</span>
                </div>
                <p className="text-[11px] text-emerald-700">
                  Token Expiry: {tokenStatus.expiresAt ? new Date(tokenStatus.expiresAt).toLocaleString() : "Active Session"}
                </p>
                <div className="flex items-center gap-2 pt-1 text-[11px] text-emerald-800 font-mono">
                  <span>Scope: Dataset.Read.All, Report.Read.All, Group.Read.All</span>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-xs">
                <div className="flex items-center gap-2 text-amber-800 font-bold mb-1">
                  <ShieldAlert className="h-4 w-4 text-amber-600" />
                  <span>No Active OAuth Token</span>
                </div>
                <p className="text-[11px] text-amber-700">
                  Please authenticate with your Microsoft Entra ID work account to synchronize reports and execute queries.
                </p>
              </div>
            )}

            {/* Supabase Database Connection Details */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <Database className="h-4 w-4 text-blue-600" />
                <span>Supabase PostgreSQL Cloud Storage</span>
              </div>
              <p className="text-[11px] text-slate-500">
                465 Power BI reports and dashboards, change logs, and license entries are persistently stored in Supabase cloud database.
              </p>
            </div>
          </div>
        </div>
      )}

      <TokenModal
        isOpen={tokenModalOpen}
        onClose={() => setTokenModalOpen(false)}
        onSuccess={() => void fetchToken()}
      />
    </div>
  );
}
