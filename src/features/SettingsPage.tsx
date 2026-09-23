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
  Palette,
  Pin,
  RefreshCw,
  Save,
  Server,
  ShieldAlert,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Sliders,
  Sun,
  Moon,
  Laptop,
} from "lucide-react";
import { Button, Input, Panel, Textarea } from "@/components/ui";
import { TokenModal } from "@/components/TokenModal";
import {
  useTheme,
  COLOR_PRESETS,
  CANVAS_PRESETS,
  ColorPresetId,
  CanvasPresetId,
  RadiusPresetId,
} from "@/context/ThemeContext";

export function SettingsPage() {
  const [tokenStatus, setTokenStatus] = useState<{
    hasToken: boolean;
    accessToken?: string | null;
    expiresAt: string | null;
    expired: boolean;
  } | null>(null);
  const [tokenModalOpen, setTokenModalOpen] = useState(false);

  // Tabs: appearance | portal | connection
  const [activeTab, setActiveTab] = useState<"appearance" | "portal" | "connection">("appearance");

  // Theme Context
  const {
    colorPreset,
    setColorPreset,
    canvasPreset,
    setCanvasPreset,
    radiusPreset,
    setRadiusPreset,
    currentTheme,
    currentCanvas,
  } = useTheme();

  // Portal Management State (Persisted in localStorage)
  const [portalTitle, setPortalTitle] = useState("Biz-Analytic Intelligence Portal");
  const [portalSubtitle, setPortalSubtitle] = useState(
    "Centralized platform for business intelligence dashboards, executive KPI tracking, certified analytics models, publish version tracking, and enterprise license governance."
  );
  const [portalBannerActive, setPortalBannerActive] = useState(true);
  const [portalAnnouncement, setPortalAnnouncement] = useState(
    "Q1 2026 Semantic Models and Business Dashboards are fully connected and synchronized with Supabase Cloud Database."
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
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Navigation Tabs Header */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/80 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("appearance")}
          style={{
            backgroundColor: activeTab === "appearance" ? currentTheme.primary : "transparent",
            color: activeTab === "appearance" ? "#ffffff" : "#475569",
          }}
          className="flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold transition shadow-xs hover:opacity-90"
        >
          <Palette className="h-4 w-4" />
          <span>Appearance & Theme</span>
        </button>

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

      {/* 1. APPEARANCE SETTINGS TAB */}
      {activeTab === "appearance" && (
        <div className="space-y-6">
          <div className="squircle-card p-6 md:p-8 space-y-7 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div
                  style={{
                    backgroundColor: currentTheme.primaryLight,
                    color: currentTheme.primary,
                  }}
                  className="grid h-12 w-12 place-items-center rounded-2xl shadow-xs"
                >
                  <Palette className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Appearance & Brand Identity</h2>
                  <p className="text-xs text-slate-500">
                    Customize the signature sidebar, active tabs, buttons, and canvas styling for the Biz-Analytic portal
                  </p>
                </div>
              </div>
            </div>

            {/* Accent Theme Color Presets */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-800 tracking-wide uppercase">
                1. Primary Theme Accent Color
              </label>
              <p className="text-xs text-slate-500">
                Determines the floating sidebar tone, active glowing cards, dials, and interactive widgets.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-2">
                {Object.values(COLOR_PRESETS).map((preset) => {
                  const isSelected = colorPreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setColorPreset(preset.id as ColorPresetId)}
                      className={`group relative flex flex-col items-center justify-center p-3.5 rounded-2xl border-2 transition text-center ${
                        isSelected
                          ? "border-slate-800 shadow-md scale-105"
                          : "border-slate-200 hover:border-slate-400 bg-white"
                      }`}
                    >
                      <div
                        style={{ backgroundColor: preset.primary }}
                        className="h-10 w-10 rounded-full shadow-md flex items-center justify-center text-white mb-2 transition group-hover:scale-110"
                      >
                        {isSelected && <Check className="h-5 w-5 stroke-[3]" />}
                      </div>
                      <span className="text-xs font-bold text-slate-800">{preset.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Canvas Background Tint */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <label className="text-xs font-bold text-slate-800 tracking-wide uppercase">
                2. Page Canvas Atmosphere
              </label>
              <p className="text-xs text-slate-500">
                Choose the background canvas tone that blends seamlessly with the active sidebar cutout.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                {Object.values(CANVAS_PRESETS).map((canvas) => {
                  const isSelected = canvasPreset === canvas.id;
                  return (
                    <button
                      key={canvas.id}
                      type="button"
                      onClick={() => setCanvasPreset(canvas.id as CanvasPresetId)}
                      className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition text-left ${
                        isSelected
                          ? "border-slate-800 bg-white shadow-md"
                          : "border-slate-200 hover:border-slate-300 bg-slate-50"
                      }`}
                    >
                      <div
                        style={{ backgroundColor: canvas.bg }}
                        className="h-9 w-9 rounded-xl border border-slate-300 shadow-inner shrink-0"
                      />
                      <div>
                        <p className="text-xs font-bold text-slate-900">{canvas.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{canvas.bg}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Corner Radius Style */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <label className="text-xs font-bold text-slate-800 tracking-wide uppercase">
                3. Card Corner Radius
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setRadiusPreset("squircle")}
                  className={`flex items-center gap-3 p-4 rounded-3xl border-2 transition text-left ${
                    radiusPreset === "squircle"
                      ? "border-slate-800 bg-white shadow-md"
                      : "border-slate-200 hover:border-slate-300 bg-slate-50"
                  }`}
                >
                  <div className="h-9 w-9 rounded-[18px] bg-slate-800 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-slate-900">Squircle Soft (28px)</p>
                    <p className="text-[11px] text-slate-500">Curved modern aesthetic matching the reference UI</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setRadiusPreset("standard")}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 transition text-left ${
                    radiusPreset === "standard"
                      ? "border-slate-800 bg-white shadow-md"
                      : "border-slate-200 hover:border-slate-300 bg-slate-50"
                  }`}
                >
                  <div className="h-9 w-9 rounded-lg bg-slate-800 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-slate-900">Standard Modern (16px)</p>
                    <p className="text-[11px] text-slate-500">Balanced corporate enterprise rounded radius</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Live Interactive Preview Box */}
            <div className="pt-6 border-t border-slate-100">
              <label className="text-xs font-bold text-slate-800 tracking-wide uppercase block mb-3">
                Live Widget Preview
              </label>

              <div
                style={{ backgroundColor: currentCanvas.bg }}
                className="p-6 rounded-3xl border border-slate-200 transition-all flex flex-wrap items-center justify-around gap-4"
              >
                {/* Mini Active Toggle Card */}
                <div
                  style={{
                    backgroundColor: currentTheme.primary,
                    boxShadow: `0 12px 24px -4px ${currentTheme.primaryGlow}`,
                  }}
                  className="w-48 p-4 rounded-2xl text-white transition-all transform hover:scale-105"
                >
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider">Active</span>
                    <span className="h-5 w-9 rounded-full bg-white/30 p-0.5 flex items-center justify-end">
                      <span className="h-4 w-4 rounded-full bg-white shadow-sm" />
                    </span>
                  </div>
                  <Sparkles className="h-5 w-5 mb-1 text-white" />
                  <p className="text-xs font-bold">Scheduled Auto-Sync</p>
                  <p className="text-[10px] text-white/80">Continuous SLA</p>
                </div>

                {/* Inactive Card */}
                <div className="w-48 p-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">OFF</span>
                    <span className="h-5 w-9 rounded-full bg-slate-200 p-0.5 flex items-center">
                      <span className="h-4 w-4 rounded-full bg-white shadow-sm" />
                    </span>
                  </div>
                  <Database
                    style={{ color: currentTheme.primary }}
                    className="h-5 w-5 mb-1"
                  />
                  <p className="text-xs font-bold text-slate-800">Capacity Sentinel</p>
                  <p className="text-[10px] text-slate-400">Ready</p>
                </div>

                {/* Primary Button */}
                <button
                  type="button"
                  style={{
                    backgroundColor: currentTheme.primary,
                    boxShadow: `0 8px 16px -2px ${currentTheme.primaryGlow}`,
                  }}
                  className="px-6 py-3 rounded-full text-xs font-bold text-white shadow-md transition hover:opacity-90"
                >
                  Primary Action Button
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. PORTAL MANAGEMENT TAB */}
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
                  <h2 className="text-base font-bold text-slate-900">Portal Hub Content</h2>
                  <p className="text-xs text-slate-500">
                    Configure welcome hero messages, announcements, and subtitles
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

      {/* 3. CONNECTION & DATABASE TAB */}
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
                  <h2 className="text-base font-bold text-slate-900">Microsoft 365 OAuth Token</h2>
                  <p className="text-xs text-slate-500">
                    Live connection status for Power BI REST API and Microsoft Graph
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
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 text-xs">
                <div className="flex items-center gap-2 text-emerald-800 font-bold mb-1">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Microsoft 365 Access Token Active</span>
                </div>
                <p className="text-[11px] text-emerald-700">
                  Expires at: {tokenStatus.expiresAt ? new Date(tokenStatus.expiresAt).toLocaleString() : "Active Session"}
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-xs">
                <div className="flex items-center gap-2 text-amber-800 font-bold mb-1">
                  <ShieldAlert className="h-4 w-4 text-amber-600" />
                  <span>No Active OAuth Token</span>
                </div>
                <p className="text-[11px] text-amber-700">
                  Please authenticate with your Microsoft Entra ID work account to synchronize reports.
                </p>
              </div>
            )}
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
