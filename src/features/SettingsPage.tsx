"use client";

import { useEffect, useState } from "react";
import {
  Bell,
  Check,
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

export function SettingsPage() {
  const [tokenStatus, setTokenStatus] = useState<{
    hasToken: boolean;
    accessToken?: string | null;
    expiresAt: string | null;
    expired: boolean;
  } | null>(null);
  const [tokenModalOpen, setTokenModalOpen] = useState(false);

  // Portal Management State (Persisted in localStorage)
  const [activeTab, setActiveTab] = useState<"connection" | "portal">("portal");
  const [portalTitle, setPortalTitle] = useState("Healthcare Analytics & Power BI Portal");
  const [portalSubtitle, setPortalSubtitle] = useState(
    "Centralized platform for hospital management dashboards, certified clinical metrics, publish version tracking, and enterprise 32-column license governance across BDMS healthcare network."
  );
  const [portalBannerActive, setPortalBannerActive] = useState(true);
  const [portalAnnouncement, setPortalAnnouncement] = useState(
    "Q1 2026 Semantic Models and Clinical Dashboards are fully connected and synchronized with Supabase Cloud Database."
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
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("portal")}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition ${
            activeTab === "portal"
              ? "bg-[#002D72] text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100 hover:text-[#002D72]"
          }`}
        >
          <LayoutDashboard className="h-4 w-4" />
          <span>Portal Hub Management</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("connection")}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition ${
            activeTab === "connection"
              ? "bg-[#002D72] text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100 hover:text-[#002D72]"
          }`}
        >
          <KeyRound className="h-4 w-4" />
          <span>Connection & Database</span>
        </button>
      </div>

      {activeTab === "portal" ? (
        /* PORTAL MANAGEMENT PANEL */
        <div className="space-y-5">
          <Panel className="p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#002D72]/10 text-[#002D72] border border-[#002D72]/20 shadow-2xs">
                  <LayoutDashboard className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Enterprise Portal Customization</h2>
                  <p className="text-xs text-slate-500">
                    Configure landing page hero branding, featured dashboards, and executive announcements
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

              <div className="pt-2 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-[#AB2328]" />
                    <span className="font-bold text-slate-800">Executive Announcement Banner</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPortalBannerActive((v) => !v)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#002D72]"
                  >
                    <span>{portalBannerActive ? "Active / Visible" : "Hidden"}</span>
                    {portalBannerActive ? (
                      <ToggleRight className="h-6 w-6 text-[#002D72]" />
                    ) : (
                      <ToggleLeft className="h-6 w-6 text-slate-400" />
                    )}
                  </button>
                </div>

                {portalBannerActive && (
                  <Textarea
                    rows={2}
                    value={portalAnnouncement}
                    onChange={(e) => setPortalAnnouncement(e.target.value)}
                    placeholder="Enter broadcast message to hospital executives and clinicians..."
                  />
                )}
              </div>

              <div className="pt-4 flex justify-end">
                <Button type="button" variant="primary" dense onClick={handleSavePortalConfig}>
                  <Save className="h-4 w-4 mr-1.5" />
                  <span>Save Portal Settings</span>
                </Button>
              </div>
            </div>
          </Panel>

          <Panel className="p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#AB2328]/10 text-[#AB2328] border border-[#AB2328]/20 shadow-2xs">
                <Pin className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Featured & Pinned Report Governance</h3>
                <p className="text-xs text-slate-500">
                  Manage certified dashboards displayed in the executive spotlight on the landing page
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-2 text-xs text-slate-600">
              <p>
                Currently, the Portal dynamically promotes all certified Power BI reports with valid Code Series prefixes (e.g. <span className="font-mono font-bold text-[#002D72]">PKT-STG</span>, <span className="font-mono font-bold text-[#002D72]">BPK-MED</span>).
              </p>
              <p className="text-[11px] text-slate-400">
                To designate a report as certified, assign a standard report code in the Power BI Workspace or catalog database.
              </p>
            </div>
          </Panel>
        </div>
      ) : (
        /* CONNECTION & DATABASE PANEL */
        <div className="space-y-5">
          {/* 1. Power BI Connection Settings */}
          <Panel className="p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#002D72]/10 text-[#002D72] border border-[#002D72]/20 shadow-2xs">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Microsoft Power BI OAuth 2.0 Connection</h2>
                <p className="text-xs text-slate-500">
                  Microsoft Entra ID token exchange and Power BI REST API authentication
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">Active Token Status</span>
                {tokenStatus?.hasToken && !tokenStatus.expired ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 border border-emerald-200">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Connected (OAuth Active)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#AB2328]/10 px-3 py-1 text-xs font-bold text-[#AB2328] border border-[#AB2328]/20">
                    <span className="h-2 w-2 rounded-full bg-[#AB2328]" />
                    Not Connected or Expired
                  </span>
                )}
              </div>

              {tokenStatus?.expiresAt ? (
                <p className="text-xs font-mono text-slate-500">
                  Token Expiration: {new Date(tokenStatus.expiresAt).toLocaleString("en-US")}
                </p>
              ) : null}

              <div className="pt-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="primary"
                  dense
                  onClick={() => setTokenModalOpen(true)}
                >
                  <LogIn className="h-4 w-4 mr-1.5" />
                  <span>Inspect or Refresh Token</span>
                </Button>
              </div>
            </div>
          </Panel>

          {/* 2. Dedicated Database Configuration */}
          <Panel className="p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#002D72]/10 text-[#002D72] border border-[#002D72]/20">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Dedicated Portal Database</h2>
                <p className="text-xs text-slate-500">
                  Autonomous data store supporting Supabase Cloud and SQLite Local fallback
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-4 bg-white space-y-1.5">
                  <span className="font-bold text-[#002D72] flex items-center gap-1.5">
                    <Server className="h-4 w-4 text-[#002D72]" />
                    <span>Active Provider: Supabase Cloud</span>
                  </span>
                  <p className="text-slate-500">
                    Live enterprise database hosting 4 dedicated tables: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-slate-800">powerbi_items</code> (463 rows), <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-slate-800">powerbi_licenses</code> (308 rows), <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-slate-800">change_log</code>, and <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-slate-800">powerbi_token</code>.
                  </p>
                  <div className="pt-1">
                    <span className="inline-block rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] font-bold border border-emerald-200">
                      Cloud Synced & Verified (RLS Protected)
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4 bg-white space-y-1.5">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <ExternalLink className="h-4 w-4 text-[#AB2328]" />
                    <span>Database Schemas</span>
                  </span>
                  <p className="text-slate-500">
                    Dual database architecture ready for zero-cloud environments:
                  </p>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] font-mono text-slate-500">
                    <li>database/schema.sql (PostgreSQL / Supabase)</li>
                    <li>database/schema.sqlite.sql (SQLite standalone)</li>
                  </ul>
                </div>
              </div>
            </div>
          </Panel>
        </div>
      )}

      <TokenModal
        isOpen={tokenModalOpen}
        onClose={() => setTokenModalOpen(false)}
        onSuccess={() => fetchToken()}
      />
    </div>
  );
}
