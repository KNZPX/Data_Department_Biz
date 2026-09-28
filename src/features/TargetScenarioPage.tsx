"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  TrendingUp,
  Building2,
  Sparkles,
  Save,
  Download,
  RotateCcw,
  Search,
  CheckCircle2,
  Sliders,
  ChevronDown,
  Calendar,
  DollarSign,
  Users,
  Target,
  PieChart,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Trash2,
  Plus,
  Activity,
  HeartPulse,
  Globe,
  Smartphone,
  ShieldCheck,
  Share2,
  FileSpreadsheet,
  Check,
  Clock,
  Layers,
  Award,
  Stethoscope,
  Briefcase,
  Crosshair,
  Percent,
} from "lucide-react";
import { clsx } from "clsx";
import {
  TARGET_META,
  TARGET_UNITS,
  TARGET_PLAN_BASE,
  TARGET_PLAN_MARKET_BASE,
  TARGET_REF_BASE,
  TARGET_REF_MKT_BASE,
  TARGET_DIG_BASE,
  TARGET_DIG_MKT_BASE,
  TARGET_MED_BASE,
  TARGET_MED_MKT_BASE,
  TARGET_NH_BASE,
  TARGET_NH_MONTH,
  VERIFIED_BASE_CASE,
  EMBEDDED_SCENARIOS,
  TARGET_SITES,
  HOSPITAL_PROFILES,
  UnitRecord,
  TargetScenarioItem,
} from "@/data/targetScenarioData";

// Helper for formatting currency in Millions THB
function formatMB(val: number, decimals = 1): string {
  if (isNaN(val) || val === null || val === undefined) return "0.0";
  return (val / 1_000_000).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// Helper for raw numbers with commas
function formatInt(val: number): string {
  if (isNaN(val) || val === null || val === undefined) return "0";
  return Math.round(val).toLocaleString("en-US");
}

function formatPct(val: number, decimals = 1): string {
  if (isNaN(val) || val === null || val === undefined) return "+0.0%";
  const sign = val > 0 ? "+" : "";
  return `${sign}${val.toFixed(decimals)}%`;
}

export function TargetScenarioPage() {
  // 1. Navigation Tabs
  const [activeTab, setActiveTab] = useState<
    "overview" | "coe" | "budget" | "channels" | "newhn" | "scenarios"
  >("overview");

  // 2. Hospital Filter: "ALL" | "BPK" | "BSI" | "DBK (Premium)"
  const [selectedSite, setSelectedSite] = useState<string>("ALL");

  // 3. Supabase Scenarios state
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [activeScenarioName, setActiveScenarioName] = useState<string>("2027 Base Case (Verified)");
  const [syncStatus, setSyncStatus] = useState<"synced" | "saving" | "offline">("synced");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 4. Scenario Save Modal
  const [showSaveModal, setShowSaveModal] = useState<boolean>(false);
  const [newScenarioName, setNewScenarioName] = useState<string>("");
  const [newScenarioDesc, setNewScenarioDesc] = useState<string>("");

  // 5. CoE / SBU Growth Overrides: key = `${site}||${coe}`, value = growth %
  const [coeGrowthOverrides, setCoeGrowthOverrides] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    if (VERIFIED_BASE_CASE?.snap?.rev?.unit) {
      Object.entries(VERIFIED_BASE_CASE.snap.rev.unit).forEach(([key, val]: any) => {
        initial[key] = parseFloat(val.value) || 0;
      });
    }
    return initial;
  });

  // CoE category filter & search
  const [coeCategoryFilter, setCoeCategoryFilter] = useState<string>("ALL");
  const [coeSearchQuery, setCoeSearchQuery] = useState<string>("");

  // 6. Finance & Operation Budget parameters
  const [bgForecast, setBgForecast] = useState<Record<string, number>>({
    BPK: 4698,
    BSI: 1886,
    DBK: 425,
  });
  const [bgFinancePct, setBgFinancePct] = useState<Record<string, number>>({
    BPK: 12.0,
    BSI: 12.0,
    DBK: 18.0,
  });
  const [dbkPortionPremium, setDbkPortionPremium] = useState<number>(75);
  const [bgOpInc, setBgOpInc] = useState<Record<string, number>>({
    BPK: 1.2,
    BSI: 0.8,
    DBKP: 5.0,
    DBKS: 0.0,
  });

  // 7. Strategic Channel sub-tab
  const [channelSubTab, setChannelSubTab] = useState<"plan" | "refer" | "digital" | "meditour">("plan");

  // Strategic Channel Growth % Overrides
  const [planGrowth, setPlanGrowth] = useState<Record<string, number>>({
    Checkup: 8.5,
    Government: 5.0,
    "Inter Contract": 12.0,
    "Inter Insurance": 15.0,
    "Local Contract": 6.0,
    "Local Insurance": 10.0,
    "Self Pay": 7.0,
  });

  const [refGrowth, setRefGrowth] = useState<Record<string, number>>({
    Hosp: 10.0,
    Clinic: 12.0,
    "Hosp BDMS": 8.0,
    "Pub Rescues": 5.0,
    Outreach: 14.0,
    "Travel Agency": 9.0,
  });

  const [digitalGrowth, setDigitalGrowth] = useState<Record<string, number>>({
    "Digital Marketing": 20.0,
    "Digital PPSI": 25.0,
  });

  const [meditourGrowth, setMeditourGrowth] = useState<Record<string, number>>({
    "Medtour - Agent": 15.0,
    "Medtour - Non Agent": 18.0,
  });

  const [newHnGrowth, setNewHnGrowth] = useState<Record<string, number>>({
    Thai: 6.0,
    Expat: 8.0,
    "Fly-in": 12.0,
  });

  // Toast notification helper
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  }, []);

  // Fetch scenarios from Supabase on mount
  useEffect(() => {
    async function loadScenarios() {
      try {
        const res = await fetch("/api/target-scenario");
        const json = await res.json();
        if (json.success && json.scenarios) {
          setScenarios(json.scenarios);
        }
      } catch (err) {
        console.error("Error loading scenarios from Supabase:", err);
      }
    }
    loadScenarios();
  }, []);

  // =========================================================================
  // CALCULATIONS
  // =========================================================================

  // 1. CoE / SBU Calculation
  const coeCalculations = useMemo(() => {
    let totalBaseRev = 0;
    let totalTargetRev = 0;
    let totalBaseVisits = 0;
    let totalTargetVisits = 0;

    const unitResults = TARGET_UNITS.map((u) => {
      const key = `${u.site}||${u.coe}`;
      const growthPct = coeGrowthOverrides[key] ?? 10.0;
      const targetRev = u.base_rev * (1 + growthPct / 100);

      // Estimate visits based on average ticket growth (assume slight price realization)
      const visitGrowthPct = Math.max(0, growthPct * 0.55);
      const targetVisits = u.base_visit * (1 + visitGrowthPct / 100);

      const revDiff = targetRev - u.base_rev;
      const visitDiff = targetVisits - u.base_visit;

      totalBaseRev += u.base_rev;
      totalTargetRev += targetRev;
      totalBaseVisits += u.base_visit;
      totalTargetVisits += targetVisits;

      return {
        ...u,
        key,
        growthPct,
        targetRev,
        targetVisits,
        revDiff,
        visitDiff,
      };
    });

    // Breakdown by Site
    const siteBreakdown: Record<string, { baseRev: number; targetRev: number; baseVisits: number; targetVisits: number }> = {
      BPK: { baseRev: 0, targetRev: 0, baseVisits: 0, targetVisits: 0 },
      BSI: { baseRev: 0, targetRev: 0, baseVisits: 0, targetVisits: 0 },
      "DBK (Premium)": { baseRev: 0, targetRev: 0, baseVisits: 0, targetVisits: 0 },
    };

    // Breakdown by Category
    const categoryBreakdown: Record<string, { baseRev: number; targetRev: number; count: number }> = {
      CoE: { baseRev: 0, targetRev: 0, count: 0 },
      SBU: { baseRev: 0, targetRev: 0, count: 0 },
      "Hospital Focus": { baseRev: 0, targetRev: 0, count: 0 },
      "Usual Business": { baseRev: 0, targetRev: 0, count: 0 },
    };

    unitResults.forEach((r) => {
      if (siteBreakdown[r.site]) {
        siteBreakdown[r.site].baseRev += r.base_rev;
        siteBreakdown[r.site].targetRev += r.targetRev;
        siteBreakdown[r.site].baseVisits += r.base_visit;
        siteBreakdown[r.site].targetVisits += r.targetVisits;
      }
      if (categoryBreakdown[r.group]) {
        categoryBreakdown[r.group].baseRev += r.base_rev;
        categoryBreakdown[r.group].targetRev += r.targetRev;
        categoryBreakdown[r.group].count += 1;
      }
    });

    return {
      units: unitResults,
      totalBaseRev,
      totalTargetRev,
      totalRevDiff: totalTargetRev - totalBaseRev,
      totalGrowthPct: totalBaseRev > 0 ? ((totalTargetRev - totalBaseRev) / totalBaseRev) * 100 : 0,
      totalBaseVisits,
      totalTargetVisits,
      siteBreakdown,
      categoryBreakdown,
    };
  }, [coeGrowthOverrides]);

  // 2. Budget Calculation
  const budgetCalculations = useMemo(() => {
    const bpkFin = bgForecast.BPK * (1 + bgFinancePct.BPK / 100);
    const bsiFin = bgForecast.BSI * (1 + bgFinancePct.BSI / 100);
    const dbkFin = bgForecast.DBK * (1 + bgFinancePct.DBK / 100);

    const dbkPremiumFin = dbkFin * (dbkPortionPremium / 100);
    const dbkSsoFin = dbkFin * ((100 - dbkPortionPremium) / 100);

    const bpkOp = bpkFin * (1 + bgOpInc.BPK / 100);
    const bsiOp = bsiFin * (1 + bgOpInc.BSI / 100);
    const dbkPremiumOp = dbkPremiumFin * (1 + bgOpInc.DBKP / 100);
    const dbkSsoOp = dbkSsoFin * (1 + bgOpInc.DBKS / 100);
    const dbkTotalOp = dbkPremiumOp + dbkSsoOp;

    const totalForecast = bgForecast.BPK + bgForecast.BSI + bgForecast.DBK;
    const totalFinance = bpkFin + bsiFin + dbkFin;
    const totalOp = bpkOp + bsiOp + dbkTotalOp;

    return {
      totalForecast,
      totalFinance,
      totalOp,
      totalFinGrowthPct: ((totalFinance - totalForecast) / totalForecast) * 100,
      totalOpGrowthPct: ((totalOp - totalForecast) / totalForecast) * 100,
      sites: {
        BPK: { fc: bgForecast.BPK, finPct: bgFinancePct.BPK, fin: bpkFin, opInc: bgOpInc.BPK, op: bpkOp },
        BSI: { fc: bgForecast.BSI, finPct: bgFinancePct.BSI, fin: bsiFin, opInc: bgOpInc.BSI, op: bsiOp },
        DBK: { fc: bgForecast.DBK, finPct: bgFinancePct.DBK, fin: dbkFin, opInc: bgOpInc.DBKP, op: dbkTotalOp },
        DBK_Premium: { fc: bgForecast.DBK * (dbkPortionPremium / 100), fin: dbkPremiumFin, op: dbkPremiumOp },
        DBK_SSO: { fc: bgForecast.DBK * ((100 - dbkPortionPremium) / 100), fin: dbkSsoFin, op: dbkSsoOp },
      },
    };
  }, [bgForecast, bgFinancePct, bgOpInc, dbkPortionPremium]);

  // 3. Strategic Channels Calculation
  const planCalculations = useMemo(() => {
    let baseTotal = 0;
    let targetTotal = 0;
    const planRows: any[] = [];

    const planKeys = [
      "Checkup",
      "Government",
      "Inter Contract",
      "Inter Insurance",
      "Local Contract",
      "Local Insurance",
      "Self Pay",
    ];

    planKeys.forEach((key) => {
      let planBase = 0;
      TARGET_SITES.forEach((s) => {
        const b = TARGET_PLAN_BASE[s]?.[key]?.b26 || 0;
        planBase += b;
      });
      const gPct = planGrowth[key] ?? 10.0;
      const target = planBase * (1 + gPct / 100);
      baseTotal += planBase;
      targetTotal += target;
      planRows.push({
        key,
        planBase,
        target,
        gPct,
        diff: target - planBase,
      });
    });

    return { rows: planRows, baseTotal, targetTotal, growthPct: ((targetTotal - baseTotal) / baseTotal) * 100 };
  }, [planGrowth]);

  const referralCalculations = useMemo(() => {
    let baseTotal = 0;
    let targetTotal = 0;
    const refRows: any[] = [];

    const refKeys = ["Hosp", "Clinic", "Hosp BDMS", "Pub Rescues", "Outreach", "Travel Agency"];

    refKeys.forEach((key) => {
      let refBase = 0;
      TARGET_SITES.forEach((s) => {
        const b = TARGET_REF_BASE[s]?.[key]?.b26 || 0;
        refBase += b;
      });
      const gPct = refGrowth[key] ?? 10.0;
      const target = refBase * (1 + gPct / 100);
      baseTotal += refBase;
      targetTotal += target;
      refRows.push({
        key,
        refBase,
        target,
        gPct,
        diff: target - refBase,
      });
    });

    return { rows: refRows, baseTotal, targetTotal, growthPct: ((targetTotal - baseTotal) / baseTotal) * 100 };
  }, [refGrowth]);

  const digitalCalculations = useMemo(() => {
    let baseMarketing = 0;
    let basePpsi = 0;

    TARGET_SITES.forEach((s) => {
      baseMarketing += TARGET_DIG_MKT_BASE[s]?.Digital?.["Digital Marketing"]?.b26 || 0;
      basePpsi += TARGET_DIG_MKT_BASE[s]?.Digital?.["Digital PPSI"]?.b26 || 0;
    });

    const tgtMarketing = baseMarketing * (1 + (digitalGrowth["Digital Marketing"] || 20) / 100);
    const tgtPpsi = basePpsi * (1 + (digitalGrowth["Digital PPSI"] || 25) / 100);

    const baseTotal = baseMarketing + basePpsi;
    const targetTotal = tgtMarketing + tgtPpsi;

    return {
      baseMarketing,
      tgtMarketing,
      basePpsi,
      tgtPpsi,
      baseTotal,
      targetTotal,
      diff: targetTotal - baseTotal,
      growthPct: ((targetTotal - baseTotal) / baseTotal) * 100,
    };
  }, [digitalGrowth]);

  const meditourCalculations = useMemo(() => {
    let baseAgent = 0;
    let baseNonAgent = 0;

    TARGET_SITES.forEach((s) => {
      baseAgent += TARGET_MED_MKT_BASE[s]?.Meditour?.["Medtour - Agent"]?.b26 || 0;
      baseNonAgent += TARGET_MED_MKT_BASE[s]?.Meditour?.["Medtour - Non Agent"]?.b26 || 0;
    });

    const tgtAgent = baseAgent * (1 + (meditourGrowth["Medtour - Agent"] || 15) / 100);
    const tgtNonAgent = baseNonAgent * (1 + (meditourGrowth["Medtour - Non Agent"] || 18) / 100);

    const baseTotal = baseAgent + baseNonAgent;
    const targetTotal = tgtAgent + tgtNonAgent;

    return {
      baseAgent,
      tgtAgent,
      baseNonAgent,
      tgtNonAgent,
      baseTotal,
      targetTotal,
      diff: targetTotal - baseTotal,
      growthPct: ((targetTotal - baseTotal) / baseTotal) * 100,
    };
  }, [meditourGrowth]);

  const newHnCalculations = useMemo(() => {
    let baseThai = 0;
    let baseExpat = 0;
    let baseFlyIn = 0;

    TARGET_SITES.forEach((s) => {
      baseThai += TARGET_NH_BASE[s]?.Thai?.b26 || 0;
      baseExpat += TARGET_NH_BASE[s]?.Expat?.b26 || 0;
      baseFlyIn += TARGET_NH_BASE[s]?.["Fly-in"]?.b26 || 0;
    });

    const tgtThai = baseThai * (1 + (newHnGrowth.Thai || 6) / 100);
    const tgtExpat = baseExpat * (1 + (newHnGrowth.Expat || 8) / 100);
    const tgtFlyIn = baseFlyIn * (1 + (newHnGrowth["Fly-in"] || 12) / 100);

    const baseTotal = baseThai + baseExpat + baseFlyIn;
    const targetTotal = tgtThai + tgtExpat + tgtFlyIn;

    return {
      baseThai,
      tgtThai,
      baseExpat,
      tgtExpat,
      baseFlyIn,
      tgtFlyIn,
      baseTotal,
      targetTotal,
      diff: targetTotal - baseTotal,
      growthPct: ((targetTotal - baseTotal) / baseTotal) * 100,
    };
  }, [newHnGrowth]);

  // Filtered CoE list by site and search
  const filteredCoeUnits = useMemo(() => {
    return coeCalculations.units.filter((u) => {
      const matchSite = selectedSite === "ALL" || u.site === selectedSite;
      const matchCat = coeCategoryFilter === "ALL" || u.group === coeCategoryFilter;
      const matchSearch =
        !coeSearchQuery.trim() ||
        u.coe.toLowerCase().includes(coeSearchQuery.toLowerCase()) ||
        u.site.toLowerCase().includes(coeSearchQuery.toLowerCase());
      return matchSite && matchCat && matchSearch;
    });
  }, [coeCalculations.units, selectedSite, coeCategoryFilter, coeSearchQuery]);

  // Reset to Verified Base Case
  function handleResetBaseCase() {
    if (VERIFIED_BASE_CASE?.snap?.rev?.unit) {
      const reset: Record<string, number> = {};
      Object.entries(VERIFIED_BASE_CASE.snap.rev.unit).forEach(([key, val]: any) => {
        reset[key] = parseFloat(val.value) || 0;
      });
      setCoeGrowthOverrides(reset);
    }
    setActiveScenarioName("2027 Base Case (Verified)");
    showToast("Reset all parameters to 2027 Base Case");
  }

  // Load a scenario from Supabase
  function handleSelectScenario(sc: any) {
    if (!sc || !sc.snapshot) {
      showToast(`Selected "${sc?.name || "Scenario"}"`);
      return;
    }
    const snap = sc.snapshot.snap || sc.snapshot;

    if (snap.rev?.unit) {
      const loaded: Record<string, number> = {};
      Object.entries(snap.rev.unit).forEach(([k, v]: any) => {
        loaded[k] = parseFloat(v.value) || 0;
      });
      setCoeGrowthOverrides(loaded);
    }

    setActiveScenarioName(sc.name);
    showToast(`Loaded scenario "${sc.name}" from Supabase`);
  }

  // Save Current Simulation to Supabase
  async function handleSaveScenarioSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newScenarioName.trim()) return;

    setSyncStatus("saving");
    try {
      const payload = {
        name: newScenarioName.trim(),
        description: newScenarioDesc.trim(),
        store_key: "targetScenarioStep2Favorites_v1",
        store_label: "Rev Target",
        snapshot: {
          name: newScenarioName.trim(),
          ts: new Date().toLocaleString("th-TH"),
          revTgt: coeCalculations.totalTargetRev,
          revBase: coeCalculations.totalBaseRev,
          visitTgt: coeCalculations.totalTargetVisits,
          visitBase: coeCalculations.totalBaseVisits,
          snap: {
            rev: {
              unit: Object.fromEntries(
                Object.entries(coeGrowthOverrides).map(([k, v]) => [
                  k,
                  { mode: "growth", value: v.toString(), unit: "MB", touched: true },
                ])
              ),
            },
            budget: budgetCalculations,
            channels: {
              plan: planGrowth,
              refer: refGrowth,
              digital: digitalGrowth,
              meditour: meditourGrowth,
              newhn: newHnGrowth,
            },
          },
        },
      };

      const res = await fetch("/api/target-scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const resJson = await res.json();
      if (resJson.success) {
        setScenarios((prev) => [resJson.scenario, ...prev]);
        setActiveScenarioName(newScenarioName.trim());
        setSyncStatus("synced");
        setShowSaveModal(false);
        setNewScenarioName("");
        setNewScenarioDesc("");
        showToast(`Saved "${newScenarioName}" to Supabase!`);
      } else {
        alert(resJson.error || "Failed to save scenario");
        setSyncStatus("offline");
      }
    } catch (err: any) {
      console.error("Save scenario error:", err);
      alert("Error saving to Supabase: " + err.message);
      setSyncStatus("offline");
    }
  }

  // Delete Scenario from Supabase
  async function handleDeleteScenario(id: string, name: string) {
    if (!confirm(`Are you sure you want to delete scenario "${name}" from Supabase?`)) return;

    try {
      const res = await fetch(`/api/target-scenario?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        setScenarios((prev) => prev.filter((s) => s.id !== id));
        showToast(`Deleted "${name}"`);
      }
    } catch (err) {
      console.error("Delete scenario error:", err);
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f8fafc] overflow-y-auto select-none">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold shadow-xl border border-slate-700 animate-in fade-in slide-in-from-top-2 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TOP HEADER & COMMAND CENTER RIBBON */}
      {/* ========================================================================= */}
      <header className="shrink-0 bg-white border-b border-slate-200 px-6 py-4 shadow-2xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
                BDMS PHUKET NETWORK
              </span>
              <span className="text-xs text-slate-400 font-bold">•</span>
              <span className="text-xs font-semibold text-slate-500">
                Target Year 2027 Simulator (Base: 2026 / Prior: 2025)
              </span>
              <span className="text-xs text-slate-400 font-bold">•</span>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                <Check className="h-3 w-3" />
                <span>Supabase Live Cloud Sync</span>
              </div>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <TrendingUp className="h-7 w-7 text-blue-600" />
              <span>Target Scenario Calculator 2027</span>
            </h1>
          </div>

          {/* Quick Actions: Scenario Switcher, Save to Cloud, Reset */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Active Scenario Badge */}
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-slate-500 font-medium">Active:</span>
              <span className="font-bold text-slate-800 max-w-[160px] truncate">{activeScenarioName}</span>
            </div>

            {/* Reset to Base Case */}
            <button
              type="button"
              onClick={handleResetBaseCase}
              className="px-3 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition cursor-pointer shadow-2xs inline-flex items-center gap-1.5"
              title="Reset all inputs back to 2027 Base Case"
            >
              <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
              <span>Reset Base Case</span>
            </button>

            {/* Save to Supabase Button */}
            <button
              type="button"
              onClick={() => {
                setNewScenarioName(`Scenario ${new Date().toLocaleDateString("en-GB")}`);
                setShowSaveModal(true);
              }}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition cursor-pointer shadow-xs inline-flex items-center gap-1.5"
            >
              <Save className="h-4 w-4" />
              <span>Save Scenario</span>
            </button>
          </div>
        </div>

        {/* Hospital Switcher Pills */}
        <div className="max-w-7xl mx-auto mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <span className="text-xs font-bold text-slate-400 mr-2 flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5" /> Hospital:
            </span>
            <button
              type="button"
              onClick={() => setSelectedSite("ALL")}
              className={clsx(
                "px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer",
                selectedSite === "ALL"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              All Network (3 Sites)
            </button>
            {TARGET_SITES.map((site) => {
              const prof = HOSPITAL_PROFILES[site] || HOSPITAL_PROFILES["BPK"];
              const isSel = selectedSite === site;
              return (
                <button
                  key={site}
                  type="button"
                  onClick={() => setSelectedSite(site)}
                  className={clsx(
                    "px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5 border",
                    isSel
                      ? `${prof.badgeBg} ${prof.textColor} ${prof.badgeBorder} shadow-2xs font-black`
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  )}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: prof.color }} />
                  <span>{prof.name}</span>
                </button>
              );
            })}
          </div>

          {/* Quick Stats Pill */}
          <div className="text-xs font-medium text-slate-500">
            Network Target: <span className="font-extrabold text-blue-600">{formatMB(coeCalculations.totalTargetRev)} MB</span> ({formatPct(coeCalculations.totalGrowthPct)})
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* EXECUTIVE SCORECARD (4 TOP METRIC CARDS) */}
      {/* ========================================================================= */}
      <div className="max-w-7xl mx-auto w-full px-6 pt-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. 2027 Projected Network Revenue */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between hover:shadow-md transition">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
              <span>Projected Revenue 2027</span>
              <span className="p-1 rounded-lg bg-blue-50 text-blue-600">
                <DollarSign className="h-4 w-4" />
              </span>
            </div>
            <div className="text-2xl font-black text-slate-900 tracking-tight my-1">
              ฿{formatMB(coeCalculations.totalTargetRev)} <span className="text-xs font-semibold text-slate-500">MB</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
              <span className="text-slate-400">Base: ฿{formatMB(coeCalculations.totalBaseRev)} MB</span>
              <span className={clsx("font-black inline-flex items-center gap-0.5", coeCalculations.totalGrowthPct >= 0 ? "text-emerald-600" : "text-rose-600")}>
                <ArrowUpRight className="h-3 w-3" />
                {formatPct(coeCalculations.totalGrowthPct)}
              </span>
            </div>
          </div>

          {/* 2. Projected Patient Visits */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between hover:shadow-md transition">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
              <span>Projected Visits 2027</span>
              <span className="p-1 rounded-lg bg-cyan-50 text-cyan-600">
                <Users className="h-4 w-4" />
              </span>
            </div>
            <div className="text-2xl font-black text-slate-900 tracking-tight my-1">
              {formatInt(coeCalculations.totalTargetVisits)} <span className="text-xs font-semibold text-slate-500">Visits</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
              <span className="text-slate-400">Base: {formatInt(coeCalculations.totalBaseVisits)}</span>
              <span className="font-black text-emerald-600 inline-flex items-center gap-0.5">
                <ArrowUpRight className="h-3 w-3" />
                +{formatInt(coeCalculations.totalTargetVisits - coeCalculations.totalBaseVisits)}
              </span>
            </div>
          </div>

          {/* 3. Finance Budget 2027 */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between hover:shadow-md transition">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
              <span>Finance Budget 2027</span>
              <span className="p-1 rounded-lg bg-indigo-50 text-indigo-600">
                <Target className="h-4 w-4" />
              </span>
            </div>
            <div className="text-2xl font-black text-slate-900 tracking-tight my-1">
              ฿{budgetCalculations.totalFinance.toLocaleString("en-US", { maximumFractionDigits: 1 })} <span className="text-xs font-semibold text-slate-500">MB</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
              <span className="text-slate-400">2026 FC: ฿{budgetCalculations.totalForecast} MB</span>
              <span className="font-black text-indigo-600 inline-flex items-center gap-0.5">
                <ArrowUpRight className="h-3 w-3" />
                {formatPct(budgetCalculations.totalFinGrowthPct)}
              </span>
            </div>
          </div>

          {/* 4. Strategic Operation Target */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between hover:shadow-md transition">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
              <span>Operation Target 2027</span>
              <span className="p-1 rounded-lg bg-purple-50 text-purple-600">
                <Sparkles className="h-4 w-4" />
              </span>
            </div>
            <div className="text-2xl font-black text-purple-700 tracking-tight my-1">
              ฿{budgetCalculations.totalOp.toLocaleString("en-US", { maximumFractionDigits: 1 })} <span className="text-xs font-semibold text-purple-400">MB</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
              <span className="text-slate-400">Op Increment: +฿{(budgetCalculations.totalOp - budgetCalculations.totalFinance).toFixed(1)} MB</span>
              <span className="font-black text-purple-600 inline-flex items-center gap-0.5">
                <ArrowUpRight className="h-3 w-3" />
                {formatPct(budgetCalculations.totalOpGrowthPct)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MAIN NAVIGATION TABS */}
      {/* ========================================================================= */}
      <div className="max-w-7xl mx-auto w-full px-6 mt-6">
        <div className="flex items-center gap-2 border-b border-slate-200 pb-px overflow-x-auto">
          {[
            { id: "overview", label: "Executive Overview", icon: BarChart3 },
            { id: "coe", label: "Center of Excellence & SBU", icon: HeartPulse },
            { id: "budget", label: "Finance & Op Budget", icon: Target },
            { id: "channels", label: "Strategic Channels", icon: Layers },
            { id: "newhn", label: "New Patient Target (HN)", icon: Users },
            { id: "scenarios", label: `Saved Scenarios (${scenarios.length})`, icon: Clock },
          ].map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id as any)}
                className={clsx(
                  "flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition cursor-pointer whitespace-nowrap",
                  active
                    ? "border-blue-600 text-blue-600 bg-white rounded-t-xl shadow-2xs font-black"
                    : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
                )}
              >
                <Icon className={clsx("h-4 w-4", active ? "text-blue-600" : "text-slate-400")} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB CONTENT PANELS */}
      {/* ========================================================================= */}
      <div className="max-w-7xl mx-auto w-full px-6 py-6 space-y-6">
        {/* ================= TAB 1: EXECUTIVE OVERVIEW ================= */}
        {activeTab === "overview" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Hospital Breakdown Comparison Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {TARGET_SITES.map((site) => {
                const prof = HOSPITAL_PROFILES[site] || HOSPITAL_PROFILES["BPK"];
                const data = coeCalculations.siteBreakdown[site] || { baseRev: 0, targetRev: 0, baseVisits: 0, targetVisits: 0 };
                const growth = data.baseRev > 0 ? ((data.targetRev - data.baseRev) / data.baseRev) * 100 : 0;
                const visitGrowth = data.baseVisits > 0 ? ((data.targetVisits - data.baseVisits) / data.baseVisits) * 100 : 0;

                return (
                  <div
                    key={site}
                    className="p-5 rounded-3xl bg-white border border-slate-200/90 shadow-sm flex flex-col justify-between relative overflow-hidden"
                  >
                    <div
                      className="absolute top-0 left-0 right-0 h-1.5"
                      style={{ backgroundColor: prof.color }}
                    />
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className={clsx("px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase", prof.badgeBg, prof.textColor, prof.badgeBorder, "border")}>
                          {site}
                        </span>
                        <span className="text-xs font-bold text-slate-400">2027 Projections</span>
                      </div>
                      <h3 className="text-base font-black text-slate-900">{prof.fullName}</h3>

                      {/* Revenue Tile */}
                      <div className="mt-4 p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Target Revenue</span>
                        <div className="flex items-baseline justify-between">
                          <span className="text-xl font-black text-slate-900">฿{formatMB(data.targetRev)} MB</span>
                          <span className="text-xs font-black text-emerald-600 inline-flex items-center">
                            <ArrowUpRight className="h-3 w-3" /> {formatPct(growth)}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Base 2026: ฿{formatMB(data.baseRev)} MB (Δ +฿{formatMB(data.targetRev - data.baseRev)} MB)
                        </div>
                      </div>

                      {/* Visits Tile */}
                      <div className="mt-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Target Patient Visits</span>
                        <div className="flex items-baseline justify-between">
                          <span className="text-xl font-black text-slate-900">{formatInt(data.targetVisits)}</span>
                          <span className="text-xs font-black text-cyan-600 inline-flex items-center">
                            <ArrowUpRight className="h-3 w-3" /> {formatPct(visitGrowth)}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Base 2026: {formatInt(data.baseVisits)} visits
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSite(site);
                          setActiveTab("coe");
                        }}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 transition inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>View CoE breakdown</span>
                        <ChevronDown className="h-3.5 w-3.5 -rotate-90" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Strategic Category Contribution */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight">Revenue Breakdown by Clinical Category</h3>
                  <p className="text-xs text-slate-500">Distribution across Center of Excellence, SBU, Hospital Focus, and Usual Business</p>
                </div>
                <span className="px-3 py-1 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  Total: ฿{formatMB(coeCalculations.totalTargetRev)} MB
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                {Object.entries(coeCalculations.categoryBreakdown).map(([cat, info]) => {
                  const share = coeCalculations.totalTargetRev > 0 ? (info.targetRev / coeCalculations.totalTargetRev) * 100 : 0;
                  const gPct = info.baseRev > 0 ? ((info.targetRev - info.baseRev) / info.baseRev) * 100 : 0;

                  return (
                    <div key={cat} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                        <span>{cat}</span>
                        <span className="text-blue-600 font-black">{share.toFixed(1)}% Share</span>
                      </div>
                      <div className="text-lg font-black text-slate-900">฿{formatMB(info.targetRev)} MB</div>
                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div className="bg-blue-600 h-full rounded-full" style={{ width: `${share}%` }} />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                        <span>{info.count} Specialties</span>
                        <span className="font-bold text-emerald-600">{formatPct(gPct)} YoY</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: CENTER OF EXCELLENCE & SBU ================= */}
        {activeTab === "coe" && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Filter Bar */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Search */}
                <div className="relative min-w-[220px]">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={coeSearchQuery}
                    onChange={(e) => setCoeSearchQuery(e.target.value)}
                    placeholder="Search CoE or specialty..."
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                  />
                </div>

                {/* Category Filter */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                  {["ALL", "CoE", "SBU", "Hospital Focus", "Usual Business"].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCoeCategoryFilter(cat)}
                      className={clsx(
                        "px-2.5 py-1 rounded-lg transition cursor-pointer",
                        coeCategoryFilter === cat ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="text-xs font-medium text-slate-500">
                Showing <b>{filteredCoeUnits.length}</b> specialties
              </div>
            </div>

            {/* Specialties Table */}
            <div className="rounded-2xl bg-white border border-slate-200/90 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Hospital & Specialty</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4 text-right">2026 Base Rev</th>
                      <th className="py-3 px-4 text-center w-48">2027 Growth Slider</th>
                      <th className="py-3 px-4 text-right">2027 Target Rev</th>
                      <th className="py-3 px-4 text-right">Target Visits</th>
                      <th className="py-3 px-4 text-right">Net Growth (Δ)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCoeUnits.map((u) => {
                      const prof = HOSPITAL_PROFILES[u.site] || HOSPITAL_PROFILES["BPK"];
                      return (
                        <tr key={u.key} className="hover:bg-slate-50/80 transition">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className={clsx("px-2 py-0.5 rounded-md text-[9px] font-black uppercase", prof.badgeBg, prof.textColor, prof.badgeBorder, "border")}>
                                {u.site}
                              </span>
                              <span className="font-bold text-slate-900">{u.coe}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-semibold">
                              {u.group}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-slate-500">
                            ฿{formatMB(u.base_rev)} MB
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <input
                                type="range"
                                min="-10"
                                max="100"
                                step="0.5"
                                value={u.growthPct}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setCoeGrowthOverrides((prev) => ({ ...prev, [u.key]: val }));
                                }}
                                className="w-24 accent-blue-600 cursor-pointer"
                              />
                              <div className="relative w-16">
                                <input
                                  type="number"
                                  step="0.1"
                                  value={u.growthPct}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setCoeGrowthOverrides((prev) => ({ ...prev, [u.key]: val }));
                                  }}
                                  className="w-full text-center px-1 py-0.5 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-md focus:outline-none"
                                />
                              </div>
                              <span className="text-[10px] text-slate-400 font-bold">%</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-black text-slate-900">
                            ฿{formatMB(u.targetRev)} MB
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-slate-600">
                            {formatInt(u.targetVisits)}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-600">
                            +฿{formatMB(u.revDiff)} MB
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 3: FINANCE & OP BUDGET ================= */}
        {activeTab === "budget" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight">Finance Budget &amp; Operation Target Calibration</h3>
                  <p className="text-xs text-slate-500">Calculate 2027 Financial Budget from 2026 Forecast, and apply Operational stretch increment</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500">DBK Premium Portion:</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={dbkPortionPremium}
                    onChange={(e) => setDbkPortionPremium(parseFloat(e.target.value) || 75)}
                    className="w-14 px-2 py-1 text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200 rounded-lg text-center"
                  />
                  <span className="text-xs text-slate-400">%</span>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Hospital Entity</th>
                      <th className="py-3 px-4 text-right">2026 Forecast (MB)</th>
                      <th className="py-3 px-4 text-center">Finance Growth %</th>
                      <th className="py-3 px-4 text-right">2027 Finance Budget</th>
                      <th className="py-3 px-4 text-center">Op Stretch Increment</th>
                      <th className="py-3 px-4 text-right">2027 Operation Target</th>
                      <th className="py-3 px-4 text-right">Total Growth YoY</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {/* BPK */}
                    <tr>
                      <td className="py-3 px-4 font-bold text-blue-700">Bangkok Hospital Phuket (BPK)</td>
                      <td className="py-3 px-4 text-right">
                        <input
                          type="number"
                          value={bgForecast.BPK}
                          onChange={(e) => setBgForecast((prev) => ({ ...prev, BPK: parseFloat(e.target.value) || 0 }))}
                          className="w-20 px-2 py-0.5 text-right font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded"
                        />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <input
                          type="number"
                          value={bgFinancePct.BPK}
                          onChange={(e) => setBgFinancePct((prev) => ({ ...prev, BPK: parseFloat(e.target.value) || 0 }))}
                          className="w-16 px-2 py-0.5 text-center font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded"
                        />
                        <span className="text-[10px] text-slate-400 ml-1">%</span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        ฿{budgetCalculations.sites.BPK.fin.toFixed(1)} MB
                      </td>
                      <td className="py-3 px-4 text-center">
                        <input
                          type="number"
                          value={bgOpInc.BPK}
                          onChange={(e) => setBgOpInc((prev) => ({ ...prev, BPK: parseFloat(e.target.value) || 0 }))}
                          className="w-16 px-2 py-0.5 text-center font-bold text-purple-700 bg-purple-50 border border-purple-200 rounded"
                        />
                        <span className="text-[10px] text-slate-400 ml-1">%</span>
                      </td>
                      <td className="py-3 px-4 text-right font-black text-purple-700">
                        ฿{budgetCalculations.sites.BPK.op.toFixed(1)} MB
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600">
                        +{((budgetCalculations.sites.BPK.op - bgForecast.BPK) / bgForecast.BPK * 100).toFixed(1)}%
                      </td>
                    </tr>

                    {/* BSI */}
                    <tr>
                      <td className="py-3 px-4 font-bold text-cyan-700">Bangkok Hospital Siriroj (BSI)</td>
                      <td className="py-3 px-4 text-right">
                        <input
                          type="number"
                          value={bgForecast.BSI}
                          onChange={(e) => setBgForecast((prev) => ({ ...prev, BSI: parseFloat(e.target.value) || 0 }))}
                          className="w-20 px-2 py-0.5 text-right font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded"
                        />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <input
                          type="number"
                          value={bgFinancePct.BSI}
                          onChange={(e) => setBgFinancePct((prev) => ({ ...prev, BSI: parseFloat(e.target.value) || 0 }))}
                          className="w-16 px-2 py-0.5 text-center font-bold text-cyan-700 bg-cyan-50 border border-cyan-200 rounded"
                        />
                        <span className="text-[10px] text-slate-400 ml-1">%</span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        ฿{budgetCalculations.sites.BSI.fin.toFixed(1)} MB
                      </td>
                      <td className="py-3 px-4 text-center">
                        <input
                          type="number"
                          value={bgOpInc.BSI}
                          onChange={(e) => setBgOpInc((prev) => ({ ...prev, BSI: parseFloat(e.target.value) || 0 }))}
                          className="w-16 px-2 py-0.5 text-center font-bold text-purple-700 bg-purple-50 border border-purple-200 rounded"
                        />
                        <span className="text-[10px] text-slate-400 ml-1">%</span>
                      </td>
                      <td className="py-3 px-4 text-right font-black text-purple-700">
                        ฿{budgetCalculations.sites.BSI.op.toFixed(1)} MB
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600">
                        +{((budgetCalculations.sites.BSI.op - bgForecast.BSI) / bgForecast.BSI * 100).toFixed(1)}%
                      </td>
                    </tr>

                    {/* DBK Total */}
                    <tr>
                      <td className="py-3 px-4 font-bold text-purple-700">Dibuk Hospital (DBK)</td>
                      <td className="py-3 px-4 text-right">
                        <input
                          type="number"
                          value={bgForecast.DBK}
                          onChange={(e) => setBgForecast((prev) => ({ ...prev, DBK: parseFloat(e.target.value) || 0 }))}
                          className="w-20 px-2 py-0.5 text-right font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded"
                        />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <input
                          type="number"
                          value={bgFinancePct.DBK}
                          onChange={(e) => setBgFinancePct((prev) => ({ ...prev, DBK: parseFloat(e.target.value) || 0 }))}
                          className="w-16 px-2 py-0.5 text-center font-bold text-purple-700 bg-purple-50 border border-purple-200 rounded"
                        />
                        <span className="text-[10px] text-slate-400 ml-1">%</span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        ฿{budgetCalculations.sites.DBK.fin.toFixed(1)} MB
                      </td>
                      <td className="py-3 px-4 text-center">
                        <input
                          type="number"
                          value={bgOpInc.DBKP}
                          onChange={(e) => setBgOpInc((prev) => ({ ...prev, DBKP: parseFloat(e.target.value) || 0 }))}
                          className="w-16 px-2 py-0.5 text-center font-bold text-purple-700 bg-purple-50 border border-purple-200 rounded"
                        />
                        <span className="text-[10px] text-slate-400 ml-1">%</span>
                      </td>
                      <td className="py-3 px-4 text-right font-black text-purple-700">
                        ฿{budgetCalculations.sites.DBK.op.toFixed(1)} MB
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600">
                        +{((budgetCalculations.sites.DBK.op - bgForecast.DBK) / bgForecast.DBK * 100).toFixed(1)}%
                      </td>
                    </tr>

                    {/* Network Consolidated Total */}
                    <tr className="bg-slate-100/80 font-black text-sm">
                      <td className="py-3.5 px-4 text-slate-900 uppercase tracking-tight">Consolidated Network Target</td>
                      <td className="py-3.5 px-4 text-right">฿{budgetCalculations.totalForecast.toFixed(1)} MB</td>
                      <td className="py-3.5 px-4 text-center text-blue-700">+{budgetCalculations.totalFinGrowthPct.toFixed(1)}%</td>
                      <td className="py-3.5 px-4 text-right text-slate-900">฿{budgetCalculations.totalFinance.toFixed(1)} MB</td>
                      <td className="py-3.5 px-4 text-center text-purple-700">+฿{(budgetCalculations.totalOp - budgetCalculations.totalFinance).toFixed(1)} MB</td>
                      <td className="py-3.5 px-4 text-right text-purple-700">฿{budgetCalculations.totalOp.toFixed(1)} MB</td>
                      <td className="py-3.5 px-4 text-right text-emerald-600">+{budgetCalculations.totalOpGrowthPct.toFixed(1)}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 4: STRATEGIC CHANNELS ================= */}
        {activeTab === "channels" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Sub-channel switcher */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
              {[
                { id: "plan", label: "Insurance & Plan Breakdown", icon: ShieldCheck },
                { id: "refer", label: "Referral Network (Inbound)", icon: Share2 },
                { id: "digital", label: "Digital Acquisition", icon: Smartphone },
                { id: "meditour", label: "Medical Tourism (Meditour)", icon: Globe },
              ].map((c) => {
                const Icon = c.icon;
                const active = channelSubTab === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setChannelSubTab(c.id as any)}
                    className={clsx(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer",
                      active
                        ? "bg-blue-600 text-white shadow-xs"
                        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{c.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Sub-panel 1: Plan */}
            {channelSubTab === "plan" && (
              <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-black text-slate-900">Health Insurance &amp; Payment Plan Targets</h3>
                    <p className="text-xs text-slate-500">Calibrate growth across International Insurance, Local Contract, Government, and Self Pay</p>
                  </div>
                  <span className="text-xs font-bold text-blue-600">
                    Total: ฿{formatMB(planCalculations.targetTotal)} MB ({formatPct(planCalculations.growthPct)})
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="py-2.5 px-4">Plan Name</th>
                        <th className="py-2.5 px-4 text-right">Base 2026</th>
                        <th className="py-2.5 px-4 text-center w-40">Growth % Override</th>
                        <th className="py-2.5 px-4 text-right">Projected 2027</th>
                        <th className="py-2.5 px-4 text-right">Net Increase (Δ)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {planCalculations.rows.map((r: any) => (
                        <tr key={r.key} className="hover:bg-slate-50/80 transition">
                          <td className="py-3 px-4 font-bold text-slate-800">{r.key}</td>
                          <td className="py-3 px-4 text-right text-slate-500">฿{formatMB(r.planBase)} MB</td>
                          <td className="py-3 px-4 text-center">
                            <input
                              type="number"
                              step="0.5"
                              value={r.gPct}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value) || 0;
                                setPlanGrowth((prev) => ({ ...prev, [r.key]: v }));
                              }}
                              className="w-16 px-2 py-0.5 text-center font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded"
                            />
                            <span className="text-[10px] text-slate-400 ml-1">%</span>
                          </td>
                          <td className="py-3 px-4 text-right font-black text-slate-900">฿{formatMB(r.target)} MB</td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-600">+฿{formatMB(r.diff)} MB</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Sub-panel 2: Refer */}
            {channelSubTab === "refer" && (
              <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-black text-slate-900">Inbound Referral Partner Targets</h3>
                    <p className="text-xs text-slate-500">Partner Hospitals, Clinics, BDMS Network, and Rescue Foundation Inflows</p>
                  </div>
                  <span className="text-xs font-bold text-blue-600">
                    Total: ฿{formatMB(referralCalculations.targetTotal)} MB ({formatPct(referralCalculations.growthPct)})
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="py-2.5 px-4">Partner Source</th>
                        <th className="py-2.5 px-4 text-right">Base 2026</th>
                        <th className="py-2.5 px-4 text-center w-40">Growth % Override</th>
                        <th className="py-2.5 px-4 text-right">Projected 2027</th>
                        <th className="py-2.5 px-4 text-right">Net Increase (Δ)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {referralCalculations.rows.map((r: any) => (
                        <tr key={r.key} className="hover:bg-slate-50/80 transition">
                          <td className="py-3 px-4 font-bold text-slate-800">{r.key}</td>
                          <td className="py-3 px-4 text-right text-slate-500">฿{formatMB(r.refBase)} MB</td>
                          <td className="py-3 px-4 text-center">
                            <input
                              type="number"
                              step="0.5"
                              value={r.gPct}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value) || 0;
                                setRefGrowth((prev) => ({ ...prev, [r.key]: v }));
                              }}
                              className="w-16 px-2 py-0.5 text-center font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded"
                            />
                            <span className="text-[10px] text-slate-400 ml-1">%</span>
                          </td>
                          <td className="py-3 px-4 text-right font-black text-slate-900">฿{formatMB(r.target)} MB</td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-600">+฿{formatMB(r.diff)} MB</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Sub-panel 3: Digital */}
            {channelSubTab === "digital" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-4">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-5 w-5 text-blue-600" />
                    <h3 className="text-base font-black text-slate-900">Digital Marketing</h3>
                  </div>
                  <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100 space-y-2">
                    <div className="text-xs text-slate-500">Base Revenue 2026: <b>฿{formatMB(digitalCalculations.baseMarketing)} MB</b></div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-700">Target Growth:</span>
                      <input
                        type="number"
                        value={digitalGrowth["Digital Marketing"] || 20}
                        onChange={(e) => setDigitalGrowth((p) => ({ ...p, "Digital Marketing": parseFloat(e.target.value) || 0 }))}
                        className="w-16 px-2 py-0.5 text-center font-bold text-blue-700 bg-white border border-blue-300 rounded"
                      />
                      <span className="text-xs font-bold text-blue-700">%</span>
                    </div>
                    <div className="text-lg font-black text-blue-900 pt-1">
                      Projected 2027: ฿{formatMB(digitalCalculations.tgtMarketing)} MB
                    </div>
                  </div>
                </div>

                <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-purple-600" />
                    <h3 className="text-base font-black text-slate-900">Digital PPSI (Plastic Surgery)</h3>
                  </div>
                  <div className="p-4 rounded-2xl bg-purple-50/50 border border-purple-100 space-y-2">
                    <div className="text-xs text-slate-500">Base Revenue 2026: <b>฿{formatMB(digitalCalculations.basePpsi)} MB</b></div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-700">Target Growth:</span>
                      <input
                        type="number"
                        value={digitalGrowth["Digital PPSI"] || 25}
                        onChange={(e) => setDigitalGrowth((p) => ({ ...p, "Digital PPSI": parseFloat(e.target.value) || 0 }))}
                        className="w-16 px-2 py-0.5 text-center font-bold text-purple-700 bg-white border border-purple-300 rounded"
                      />
                      <span className="text-xs font-bold text-purple-700">%</span>
                    </div>
                    <div className="text-lg font-black text-purple-900 pt-1">
                      Projected 2027: ฿{formatMB(digitalCalculations.tgtPpsi)} MB
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-panel 4: Meditour */}
            {channelSubTab === "meditour" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-4">
                  <div className="flex items-center gap-2">
                    <Globe className="h-5 w-5 text-cyan-600" />
                    <h3 className="text-base font-black text-slate-900">Meditour — Agent Sourced</h3>
                  </div>
                  <div className="p-4 rounded-2xl bg-cyan-50/50 border border-cyan-100 space-y-2">
                    <div className="text-xs text-slate-500">Base Revenue 2026: <b>฿{formatMB(meditourCalculations.baseAgent)} MB</b></div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-700">Target Growth:</span>
                      <input
                        type="number"
                        value={meditourGrowth["Medtour - Agent"] || 15}
                        onChange={(e) => setMeditourGrowth((p) => ({ ...p, "Medtour - Agent": parseFloat(e.target.value) || 0 }))}
                        className="w-16 px-2 py-0.5 text-center font-bold text-cyan-700 bg-white border border-cyan-300 rounded"
                      />
                      <span className="text-xs font-bold text-cyan-700">%</span>
                    </div>
                    <div className="text-lg font-black text-cyan-900 pt-1">
                      Projected 2027: ฿{formatMB(meditourCalculations.tgtAgent)} MB
                    </div>
                  </div>
                </div>

                <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-emerald-600" />
                    <h3 className="text-base font-black text-slate-900">Meditour — Direct (Non-Agent)</h3>
                  </div>
                  <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100 space-y-2">
                    <div className="text-xs text-slate-500">Base Revenue 2026: <b>฿{formatMB(meditourCalculations.baseNonAgent)} MB</b></div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-700">Target Growth:</span>
                      <input
                        type="number"
                        value={meditourGrowth["Medtour - Non Agent"] || 18}
                        onChange={(e) => setMeditourGrowth((p) => ({ ...p, "Medtour - Non Agent": parseFloat(e.target.value) || 0 }))}
                        className="w-16 px-2 py-0.5 text-center font-bold text-emerald-700 bg-white border border-emerald-300 rounded"
                      />
                      <span className="text-xs font-bold text-emerald-700">%</span>
                    </div>
                    <div className="text-lg font-black text-emerald-900 pt-1">
                      Projected 2027: ฿{formatMB(meditourCalculations.tgtNonAgent)} MB
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 5: NEW PATIENT TARGET (HN) ================= */}
        {activeTab === "newhn" && (
          <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-6 animate-in fade-in duration-200">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-base font-black text-slate-900 tracking-tight">New Patient Acquisition Target (New HN 2027)</h3>
                <p className="text-xs text-slate-500">Patient acquisition target by residency segment across Thai, Expat, and International Fly-in</p>
              </div>
              <span className="text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1 rounded-xl">
                Total Target: {formatInt(newHnCalculations.targetTotal)} New HNs ({formatPct(newHnCalculations.growthPct)})
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Thai */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Thai Patients</span>
                <div className="text-2xl font-black text-slate-900">{formatInt(newHnCalculations.tgtThai)}</div>
                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200">
                  <span className="text-slate-400">Base 2026: {formatInt(newHnCalculations.baseThai)}</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={newHnGrowth.Thai}
                      onChange={(e) => setNewHnGrowth((p) => ({ ...p, Thai: parseFloat(e.target.value) || 0 }))}
                      className="w-14 px-1 text-center font-bold text-blue-700 bg-white border rounded"
                    />
                    <span className="font-bold text-slate-400">%</span>
                  </div>
                </div>
              </div>

              {/* Expat */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Expat Residents</span>
                <div className="text-2xl font-black text-slate-900">{formatInt(newHnCalculations.tgtExpat)}</div>
                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200">
                  <span className="text-slate-400">Base 2026: {formatInt(newHnCalculations.baseExpat)}</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={newHnGrowth.Expat}
                      onChange={(e) => setNewHnGrowth((p) => ({ ...p, Expat: parseFloat(e.target.value) || 0 }))}
                      className="w-14 px-1 text-center font-bold text-blue-700 bg-white border rounded"
                    />
                    <span className="font-bold text-slate-400">%</span>
                  </div>
                </div>
              </div>

              {/* Fly-in */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Fly-in Medical Travelers</span>
                <div className="text-2xl font-black text-slate-900">{formatInt(newHnCalculations.tgtFlyIn)}</div>
                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200">
                  <span className="text-slate-400">Base 2026: {formatInt(newHnCalculations.baseFlyIn)}</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={newHnGrowth["Fly-in"]}
                      onChange={(e) => setNewHnGrowth((p) => ({ ...p, "Fly-in": parseFloat(e.target.value) || 0 }))}
                      className="w-14 px-1 text-center font-bold text-blue-700 bg-white border rounded"
                    />
                    <span className="font-bold text-slate-400">%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 6: SAVED SCENARIOS & SUPABASE ================= */}
        {activeTab === "scenarios" && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight">Supabase Scenario Vault</h3>
                  <p className="text-xs text-slate-500">Live cloud scenarios synchronized across the hospital executive team</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSaveModal(true)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  <span>Save Current Simulation</span>
                </button>
              </div>

              {/* Scenarios Table */}
              <div className="rounded-2xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Scenario Name</th>
                      <th className="py-3 px-4">Domain / Store</th>
                      <th className="py-3 px-4">Saved Timestamp</th>
                      <th className="py-3 px-4 text-right">Target Revenue</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {scenarios.map((sc) => {
                      const isActive = activeScenarioName === sc.name;
                      const snap = sc.snapshot?.snap || sc.snapshot;
                      const rev = sc.snapshot?.revTgt || snap?.revTgt || 0;

                      return (
                        <tr key={sc.id} className={clsx("hover:bg-slate-50/80 transition", isActive && "bg-blue-50/40")}>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900 flex items-center gap-2">
                              <span>{sc.name}</span>
                              {isActive && (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-blue-600 text-white">
                                  ACTIVE
                                </span>
                              )}
                            </div>
                            {sc.description && <div className="text-[11px] text-slate-400 mt-0.5">{sc.description}</div>}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[10px]">
                              {sc.store_label || sc.store_key}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                            {sc.saved_at_label || new Date(sc.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 text-right font-black text-slate-900">
                            {rev > 0 ? `฿${formatMB(rev)} MB` : "—"}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                              <CheckCircle2 className="h-3 w-3" /> Supabase
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleSelectScenario(sc)}
                                className="px-2.5 py-1 rounded-lg text-xs font-bold text-blue-600 hover:bg-blue-50 border border-blue-200 transition cursor-pointer"
                              >
                                Load
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteScenario(sc.id, sc.name)}
                                className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                title="Delete from Supabase"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SAVE SCENARIO MODAL */}
      {/* ========================================================================= */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <Save className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Save Scenario to Supabase</h3>
                  <p className="text-xs text-slate-500">Persist full parameters &amp; calculations to cloud</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveScenarioSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Scenario Name *</label>
                <input
                  type="text"
                  required
                  value={newScenarioName}
                  onChange={(e) => setNewScenarioName(e.target.value)}
                  placeholder="e.g. Aggressive CoE Expansion 2027"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  value={newScenarioDesc}
                  onChange={(e) => setNewScenarioDesc(e.target.value)}
                  placeholder="e.g. Higher growth on Trauma, Cardiovascular & Digital PPSI"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1">
                <div className="flex justify-between text-slate-600">
                  <span>Projected Revenue:</span>
                  <span className="font-black text-slate-900">฿{formatMB(coeCalculations.totalTargetRev)} MB</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>YoY Growth:</span>
                  <span className="font-bold text-emerald-600">{formatPct(coeCalculations.totalGrowthPct)}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSaveModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={syncStatus === "saving"}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                >
                  <Save className="h-4 w-4" />
                  <span>{syncStatus === "saving" ? "Saving..." : "Save to Cloud"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
