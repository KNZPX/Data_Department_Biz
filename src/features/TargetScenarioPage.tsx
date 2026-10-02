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
  ChevronRight,
  DollarSign,
  Users,
  Target,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Trash2,
  Plus,
  HeartPulse,
  Globe,
  Smartphone,
  ShieldCheck,
  Share2,
  FileSpreadsheet,
  Check,
  Clock,
  Layers,
  Percent,
  GitBranch,
  Split,
  Workflow,
  Copy,
  AlertTriangle,
  ArrowRight,
  Filter,
  X,
} from "lucide-react";
import { clsx } from "clsx";
import {
  TARGET_META,
  TARGET_SITES,
  HOSPITAL_PROFILES,
  VERIFIED_BASE_CASE,
} from "@/data/targetScenarioData";
import {
  TargetTreeNode,
  TargetMethod,
  HierarchyLevel,
  buildInitialTargetTree,
  recalculateTargetTree,
  delegateTargetDown,
  DelegationMode,
} from "@/lib/targetScenarioEngine";

// Helper for formatting Millions THB
function formatMB(val: number, decimals = 1): string {
  if (isNaN(val) || val === null || val === undefined) return "0.0";
  return (val / 1_000_000).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// Helper for integers
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
  // 1. Hierarchical Target Tree State (All 5 Levels: PKT -> Site -> CoE/SBU -> OPD/IPD -> Market)
  const [tree, setTree] = useState<Record<string, TargetTreeNode>>(() => buildInitialTargetTree());

  // 2. Active Tab View
  const [activeTab, setActiveTab] = useState<
    "tree" | "flow" | "matrix" | "scenarios"
  >("tree");

  // 3. Filters
  const [siteFilter, setSiteFilter] = useState<string>("ALL"); // "ALL", "BPK", "BSI", "DBK (Premium)"
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [levelDepthFilter, setLevelDepthFilter] = useState<number>(4); // 1 = Site, 2 = CoE, 3 = Setting, 4 = Market

  // 4. Expanded Nodes Set
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() => {
    // Expand PKT and 3 Sites by default
    return new Set(["PKT", "BPK", "BSI", "DBK (Premium)"]);
  });

  // 5. Scenarios State from Supabase
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [activeScenarioId, setActiveScenarioId] = useState<string>("base_case");
  const [activeScenarioName, setActiveScenarioName] = useState<string>("Revise 2027 (V2)");
  const [syncStatus, setSyncStatus] = useState<"synced" | "saving" | "offline">("synced");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 6. Save Scenario Modal
  const [showSaveModal, setShowSaveModal] = useState<boolean>(false);
  const [newScenarioName, setNewScenarioName] = useState<string>("");
  const [newScenarioDesc, setNewScenarioDesc] = useState<string>("");

  // 7. Target Delegation Modal
  const [delegateModalNodeId, setDelegateModalNodeId] = useState<string | null>(null);
  const [selectedDelegationMode, setSelectedDelegationMode] = useState<DelegationMode>("scaled_profile");

  // Toast Helper
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  }, []);

  // Fetch saved scenarios from Supabase on mount
  useEffect(() => {
    async function fetchScenarios() {
      try {
        const res = await fetch("/api/target-scenario");
        const json = await res.json();
        if (json.success && json.scenarios) {
          setScenarios(json.scenarios);
        }
      } catch (err) {
        console.error("Failed to load scenarios from Supabase", err);
      }
    }
    fetchScenarios();
  }, []);

  // Toggle node expand/collapse
  function toggleNodeExpand(nodeId: string) {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }

  function handleExpandAll() {
    setExpandedNodes(new Set(Object.keys(tree)));
  }

  function handleCollapseAll() {
    setExpandedNodes(new Set(["PKT"]));
  }

  // Update a single node's target method or input value
  function handleUpdateNode(nodeId: string, updates: Partial<TargetTreeNode>) {
    setTree((prev) => {
      const node = prev[nodeId];
      if (!node) return prev;
      const updatedNode = { ...node, ...updates, isOverridden: true };
      const nextTree = { ...prev, [nodeId]: updatedNode };
      return recalculateTargetTree(nextTree);
    });
  }

  // Open delegation modal
  function handleOpenDelegateModal(nodeId: string) {
    setDelegateModalNodeId(nodeId);
    setSelectedDelegationMode("scaled_profile");
  }

  // Execute delegation with selected method
  function handleExecuteDelegation(nodeId: string, mode: DelegationMode) {
    setTree((prev) => {
      const updated = delegateTargetDown(prev, nodeId, mode);
      const labels: Record<string, string> = {
        scaled_profile: "Preserved Strategic Profile (สัดส่วนกลยุทธ์เดิม)",
        tiered_weighted: "Strategic Tiered Weights (CoE 1.5x / SBU 1.0x / Usual 0.5x)",
        plug_usual: "Core Lock + Plug to Usual Business",
        flat_base: "Historical Base Proportional",
      };
      showToast(`Delegated ${prev[nodeId]?.name || nodeId} (${labels[mode] || mode})`);
      return updated;
    });
    setDelegateModalNodeId(null);
  }

  // Reset entire tree to verified base case
  function handleResetBaseCase() {
    setTree(buildInitialTargetTree());
    setActiveScenarioId("base_case");
    setActiveScenarioName("Revise 2027 (V2)");
    showToast("Reset all targets to 2027 Base Case");
  }

  // Load a scenario from Supabase
  function handleLoadScenario(sc: any) {
    if (!sc) return;
    const snap = sc.snapshot?.snap || sc.snapshot;

    if (snap && snap.treeNodes) {
      // Restore full hierarchical tree snapshot
      const restored: Record<string, TargetTreeNode> = {};
      const baseTree = buildInitialTargetTree();

      Object.entries(baseTree).forEach(([k, defaultNode]) => {
        const saved = snap.treeNodes[k];
        if (saved) {
          restored[k] = {
            ...defaultNode,
            method: saved.method || defaultNode.method,
            inputVal: saved.inputVal !== undefined ? saved.inputVal : defaultNode.inputVal,
            isOverridden: saved.isOverridden ?? defaultNode.isOverridden,
          };
        } else {
          restored[k] = defaultNode;
        }
      });

      setTree(recalculateTargetTree(restored));
    } else if (snap && snap.rev?.unit) {
      // Compatible with legacy CoE growth overrides
      const baseTree = buildInitialTargetTree();
      Object.entries(snap.rev.unit).forEach(([key, val]: any) => {
        if (baseTree[key]) {
          baseTree[key].method = "growth_pct";
          baseTree[key].inputVal = parseFloat(val.value) || 0;
          baseTree[key].isOverridden = true;
        }
      });
      setTree(recalculateTargetTree(baseTree));
    }

    setActiveScenarioId(sc.id);
    setActiveScenarioName(sc.name);
    showToast(`Loaded scenario "${sc.name}" from Supabase`);
  }

  // Save current tree configuration to Supabase
  async function handleSaveScenarioSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newScenarioName.trim()) return;

    setSyncStatus("saving");
    try {
      const pkt = tree["PKT"];

      // Package lightweight representation of tree nodes (inputs & methods)
      const treeNodesPayload: Record<string, { method: TargetMethod; inputVal: number; isOverridden: boolean; targetRev: number }> = {};
      Object.entries(tree).forEach(([k, n]) => {
        treeNodesPayload[k] = {
          method: n.method,
          inputVal: n.inputVal,
          isOverridden: n.isOverridden,
          targetRev: n.targetRev27,
        };
      });

      const payload = {
        name: newScenarioName.trim(),
        description: newScenarioDesc.trim(),
        store_key: "targetScenarioStep2Favorites_v1",
        store_label: "Cascading Target",
        snapshot: {
          name: newScenarioName.trim(),
          ts: new Date().toLocaleString("th-TH"),
          revTgt: pkt?.targetRev27 || 0,
          revBase: pkt?.baseRev26 || 0,
          growthPct: pkt?.growthRevPct || 0,
          snap: {
            treeNodes: treeNodesPayload,
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
        setActiveScenarioId(resJson.scenario.id);
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
      alert("Error saving scenario: " + err.message);
      setSyncStatus("offline");
    }
  }

  // Delete scenario from Supabase
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

  // Get Top-level PKT summary metrics
  const pktNode = tree["PKT"];
  const bpkNode = tree["BPK"];
  const bsiNode = tree["BSI"];
  const dbkNode = tree["DBK (Premium)"];

  // Filtered rows for Tree Table view
  const visibleTreeRows = useMemo(() => {
    const list: TargetTreeNode[] = [];

    function traverse(nodeId: string, currentDepth: number) {
      const node = tree[nodeId];
      if (!node) return;

      // Filter by Hospital Site (if selected)
      if (siteFilter !== "ALL" && node.level !== "pkt" && node.site !== siteFilter) {
        return;
      }

      // Filter by Search Query
      const matchesSearch =
        !searchQuery.trim() ||
        node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        node.code.toLowerCase().includes(searchQuery.toLowerCase());

      // Depth filter
      const depthMap: Record<HierarchyLevel, number> = {
        pkt: 0,
        site: 1,
        coe: 2,
        setting: 3,
        market: 4,
      };

      if (depthMap[node.level] <= levelDepthFilter) {
        if (matchesSearch || node.childrenKeys.length > 0) {
          list.push(node);
        }
      }

      // If expanded, traverse children
      if (expandedNodes.has(nodeId) && node.childrenKeys) {
        node.childrenKeys.forEach((ck) => traverse(ck, currentDepth + 1));
      }
    }

    traverse("PKT", 0);
    return list;
  }, [tree, siteFilter, searchQuery, levelDepthFilter, expandedNodes]);

  // Cross-tab Matrix Calculations (Hospital & CoE by Thai, Expat, Fly-in & OPD/IPD)
  const matrixData = useMemo(() => {
    const coeNodes = Object.values(tree).filter((n) => n.level === "coe");
    return coeNodes.map((coe) => {
      const opdThai = tree[`${coe.id}||OPD||Thai`]?.targetRev27 || 0;
      const opdExpat = tree[`${coe.id}||OPD||Expat`]?.targetRev27 || 0;
      const opdFlyIn = tree[`${coe.id}||OPD||Fly-in`]?.targetRev27 || 0;

      const ipdThai = tree[`${coe.id}||IPD||Thai`]?.targetRev27 || 0;
      const ipdExpat = tree[`${coe.id}||IPD||Expat`]?.targetRev27 || 0;
      const ipdFlyIn = tree[`${coe.id}||IPD||Fly-in`]?.targetRev27 || 0;

      const totalThai = opdThai + ipdThai;
      const totalExpat = opdExpat + ipdExpat;
      const totalFlyIn = opdFlyIn + ipdFlyIn;

      return {
        id: coe.id,
        site: coe.site,
        name: coe.name,
        group: coe.group,
        baseRev: coe.baseRev26,
        targetRev: coe.targetRev27,
        growthPct: coe.growthRevPct,
        opd: { thai: opdThai, expat: opdExpat, flyIn: opdFlyIn, total: opdThai + opdExpat + opdFlyIn },
        ipd: { thai: ipdThai, expat: ipdExpat, flyIn: ipdFlyIn, total: ipdThai + ipdExpat + ipdFlyIn },
        market: { thai: totalThai, expat: totalExpat, flyIn: totalFlyIn },
      };
    });
  }, [tree]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f8fafc] overflow-y-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold shadow-xl border border-slate-700 animate-in fade-in slide-in-from-top-2 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* HEADER & SCENARIO COMMAND RIBBON */}
      {/* ========================================================================= */}
      <header className="shrink-0 bg-white border-b border-slate-200 px-6 py-4 shadow-2xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                TARGET DELEGATION SYSTEM
              </span>
              <span className="text-xs text-slate-400 font-semibold">•</span>
              <span className="text-xs font-semibold text-slate-500">
                Cascading Breakdown: PKT ➔ Site ➔ CoE/SBU ➔ OPD/IPD ➔ Market Segment
              </span>
              <span className="text-xs text-slate-400 font-semibold">•</span>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[11px] font-semibold border border-emerald-200">
                <Check className="h-3 w-3" />
                <span>Supabase Cloud Synced</span>
              </div>
            </div>
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight flex items-center gap-2.5">
              <TrendingUp className="h-7 w-7 text-blue-600" />
              <span>Target Scenario Calculator 2027</span>
            </h1>
          </div>

          {/* Scenario Selector & Cloud Actions */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Live Scenario Selector Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-slate-500 font-semibold">Scenario:</span>
              <select
                value={activeScenarioId}
                onChange={(e) => {
                  const sel = scenarios.find((s) => s.id === e.target.value);
                  if (sel) handleLoadScenario(sel);
                  else if (e.target.value === "base_case") handleResetBaseCase();
                }}
                className="bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer max-w-[180px] truncate"
              >
                <option value="base_case">Revise 2027 (V2) - 7,550 MB</option>
                {scenarios.map((sc) => (
                  <option key={sc.id} value={sc.id}>
                    {sc.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Reset Base Case */}
            <button
              type="button"
              onClick={handleResetBaseCase}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition cursor-pointer shadow-2xs inline-flex items-center gap-1.5"
              title="Reset all inputs back to 2027 Base Case"
            >
              <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
              <span>Reset</span>
            </button>

            {/* Save to Supabase */}
            <button
              type="button"
              onClick={() => {
                setNewScenarioName(`Scenario ${new Date().toLocaleDateString("en-GB")}`);
                setShowSaveModal(true);
              }}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition cursor-pointer shadow-xs inline-flex items-center gap-1.5"
            >
              <Save className="h-4 w-4" />
              <span>Save Scenario</span>
            </button>
          </div>
        </div>

        {/* Hospital Scope Selector Pills */}
        <div className="max-w-7xl mx-auto mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <span className="text-xs font-semibold text-slate-400 mr-2 flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5" /> Scope:
            </span>
            <button
              type="button"
              onClick={() => setSiteFilter("ALL")}
              className={clsx(
                "px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer",
                siteFilter === "ALL"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              All Network (PKT 3 Sites)
            </button>
            {TARGET_SITES.map((site) => {
              const prof = HOSPITAL_PROFILES[site] || HOSPITAL_PROFILES["BPK"];
              const isSel = siteFilter === site;
              return (
                <button
                  key={site}
                  type="button"
                  onClick={() => setSiteFilter(site)}
                  className={clsx(
                    "px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer inline-flex items-center gap-1.5 border",
                    isSel
                      ? `${prof.badgeBg} ${prof.textColor} ${prof.badgeBorder} shadow-2xs font-semibold`
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  )}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: prof.color }} />
                  <span>{prof.name}</span>
                </button>
              );
            })}
          </div>

          {/* Depth Expander Pills */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <span className="text-[11px] text-slate-400 px-1.5">Depth:</span>
            {[
              { depth: 1, label: "Sites" },
              { depth: 2, label: "CoE/SBU" },
              { depth: 3, label: "OPD/IPD" },
              { depth: 4, label: "Market" },
            ].map((d) => (
              <button
                key={d.depth}
                type="button"
                onClick={() => {
                  setLevelDepthFilter(d.depth);
                  if (d.depth === 1) handleCollapseAll();
                  else handleExpandAll();
                }}
                className={clsx(
                  "px-2.5 py-0.5 rounded-lg transition cursor-pointer text-[11px]",
                  levelDepthFilter === d.depth ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                )}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* TOP DELEGATION RECONCILIATION SCORECARD */}
      {/* ========================================================================= */}
      <div className="max-w-7xl mx-auto w-full px-6 pt-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Central PKT Target */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between hover:shadow-md transition">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
              <span className="flex items-center gap-1.5">
                <Target className="h-4 w-4 text-blue-600" />
                <span>PKT Central Target 2027</span>
              </span>
              <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[11px] font-semibold">
                {pktNode?.method === "growth_pct" ? `${pktNode.inputVal}% YoY` : `${pktNode.inputVal} MB`}
              </span>
            </div>
            <div className="text-2xl font-semibold text-slate-900 tracking-tight my-1">
              ฿{formatMB(pktNode?.targetRev27 || 0)} <span className="text-xs font-semibold text-slate-500">MB</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
              <span className="text-slate-400">Base: ฿{formatMB(pktNode?.baseRev26 || 0)} MB</span>
              <span className="font-semibold text-emerald-600 inline-flex items-center gap-0.5">
                <ArrowUpRight className="h-3 w-3" />
                {formatPct(pktNode?.growthRevPct || 0)}
              </span>
            </div>
          </div>

          {/* Card 2: Delegated to 3 Sites */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between hover:shadow-md transition">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
              <span className="flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-cyan-600" />
                <span>Delegated (3 Sites Sum)</span>
              </span>
              <span className="text-[11px] text-slate-400 font-semibold">BPK + BSI + DBK</span>
            </div>
            <div className="text-2xl font-semibold text-slate-900 tracking-tight my-1">
              ฿{formatMB(pktNode?.delegatedChildrenRev || 0)} <span className="text-xs font-semibold text-slate-500">MB</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
              <span className="text-slate-400">
                BPK: {formatMB(bpkNode?.targetRev27 || 0)} | BSI: {formatMB(bsiNode?.targetRev27 || 0)}
              </span>
            </div>
          </div>

          {/* Card 3: Allocation Balance Gap */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between hover:shadow-md transition">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
              <span className="flex items-center gap-1.5">
                <GitBranch className="h-4 w-4 text-purple-600" />
                <span>Delegation Balance Gap</span>
              </span>
              <button
                type="button"
                onClick={() => handleOpenDelegateModal("PKT")}
                className="text-[11px] text-blue-600 hover:underline font-semibold"
              >
                Auto-Balance
              </button>
            </div>
            <div className="flex items-baseline gap-2 my-1">
              {Math.abs(pktNode?.allocationGap || 0) < 1000 ? (
                <div className="text-xl font-semibold text-emerald-600 flex items-center gap-1.5">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>100% Balanced</span>
                </div>
              ) : (
                <div className="text-xl font-semibold text-amber-600 flex items-center gap-1.5">
                  <AlertTriangle className="h-5 w-5" />
                  <span>Gap: ฿{formatMB(pktNode?.allocationGap || 0)} MB</span>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-400">
              <span>{Math.abs(pktNode?.allocationGap || 0) < 1000 ? "Central target equals site allocations" : "Unallocated difference pending delegation"}</span>
            </div>
          </div>

          {/* Card 4: Total Projected Visits */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between hover:shadow-md transition">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
              <span className="flex items-center gap-1.5">
                <Users className="h-4 w-4 text-indigo-600" />
                <span>Projected Total Visits</span>
              </span>
              <span className="text-[11px] text-slate-400 font-semibold">2027 E</span>
            </div>
            <div className="text-2xl font-semibold text-slate-900 tracking-tight my-1">
              {formatInt(pktNode?.targetVisits27 || 0)} <span className="text-xs font-semibold text-slate-500">Visits</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
              <span className="text-slate-400">Base: {formatInt(pktNode?.baseVisits26 || 0)}</span>
              <span className="font-semibold text-indigo-600 inline-flex items-center gap-0.5">
                <ArrowUpRight className="h-3 w-3" />
                +{formatInt((pktNode?.targetVisits27 || 0) - (pktNode?.baseVisits26 || 0))}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TABS NAVIGATION */}
      {/* ========================================================================= */}
      <div className="max-w-7xl mx-auto w-full px-6 mt-6">
        <div className="flex items-center justify-between border-b border-slate-200 pb-px flex-wrap gap-2">
          <div className="flex items-center gap-2 overflow-x-auto">
            {[
              { id: "tree", label: "Hierarchical Cascading Tree", icon: Layers },
              { id: "flow", label: "Visual Waterfall Delegation", icon: Workflow },
              { id: "matrix", label: "Market Segment Matrix (OPD/IPD)", icon: BarChart3 },
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
                    "flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition cursor-pointer whitespace-nowrap",
                    active
                      ? "border-blue-600 text-blue-600 bg-white rounded-t-xl shadow-2xs font-semibold"
                      : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
                  )}
                >
                  <Icon className={clsx("h-4 w-4", active ? "text-blue-600" : "text-slate-400")} />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* Quick Collapse/Expand All Buttons */}
          {activeTab === "tree" && (
            <div className="flex items-center gap-2 pb-2">
              <button
                type="button"
                onClick={handleExpandAll}
                className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200 cursor-pointer"
              >
                Expand All
              </button>
              <button
                type="button"
                onClick={handleCollapseAll}
                className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200 cursor-pointer"
              >
                Collapse All
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB CONTENT PANELS */}
      {/* ========================================================================= */}
      <div className="max-w-7xl mx-auto w-full px-6 py-6 space-y-6">
        {/* ================= TAB 1: HIERARCHICAL CASCADING TREE ================= */}
        {activeTab === "tree" && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Search & Actions Bar */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 flex-1">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search specialty, site, OPD/IPD, or market..."
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                  />
                </div>
              </div>

              <div className="text-xs text-slate-500">
                Displaying <b>{visibleTreeRows.length}</b> nodes in hierarchy
              </div>
            </div>

            {/* Tree Table */}
            <div className="rounded-2xl bg-white border border-slate-200/90 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                    <tr>
                      <th className="py-3 px-4 min-w-[260px]">Hierarchy Node &amp; Level</th>
                      <th className="py-3 px-3 text-right">2026 Base Rev</th>
                      <th className="py-3 px-3 text-center">Target Method</th>
                      <th className="py-3 px-3 text-center w-36">Input Setting</th>
                      <th className="py-3 px-3 text-right">2027 Target</th>
                      <th className="py-3 px-3 text-right">YoY %</th>
                      <th className="py-3 px-3 text-center min-w-[140px]">Delegation Status</th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visibleTreeRows.map((node) => {
                      const hasChildren = node.childrenKeys && node.childrenKeys.length > 0;
                      const isExpanded = expandedNodes.has(node.id);

                      // Depth indent padding
                      const depth =
                        node.level === "pkt"
                          ? 0
                          : node.level === "site"
                          ? 1
                          : node.level === "coe"
                          ? 2
                          : node.level === "setting"
                          ? 3
                          : 4;

                      // Level badge styling
                      const levelBadge = {
                        pkt: { bg: "bg-slate-900", text: "text-white", label: "PKT HQ" },
                        site: { bg: "bg-blue-600", text: "text-white", label: "SITE" },
                        coe: { bg: "bg-indigo-50 text-indigo-700 border border-indigo-200", text: "", label: "CoE/SBU" },
                        setting: { bg: "bg-cyan-50 text-cyan-700 border border-cyan-200", text: "", label: "CARE" },
                        market: { bg: "bg-slate-100 text-slate-600", text: "", label: "MKT" },
                      }[node.level];

                      return (
                        <tr
                          key={node.id}
                          className={clsx(
                            "hover:bg-slate-50/80 transition",
                            node.level === "pkt" && "bg-slate-50/60 font-semibold",
                            node.level === "site" && "bg-blue-50/20 font-semibold"
                          )}
                        >
                          {/* Node Name with Indentation & Collapse Caret */}
                          <td className="py-2.5 px-4" style={{ paddingLeft: `${depth * 20 + 16}px` }}>
                            <div className="flex items-center gap-2">
                              {hasChildren ? (
                                <button
                                  type="button"
                                  onClick={() => toggleNodeExpand(node.id)}
                                  className="p-1 hover:bg-slate-200/80 rounded transition cursor-pointer text-slate-500"
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="h-3.5 w-3.5" />
                                  ) : (
                                    <ChevronRight className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              ) : (
                                <span className="w-5" />
                              )}

                              <span
                                className={clsx(
                                  "px-1.5 py-0.5 rounded text-[11px] font-semibold",
                                  levelBadge.bg,
                                  levelBadge.text
                                )}
                              >
                                {levelBadge.label}
                              </span>

                              <span className="text-slate-900 font-semibold truncate max-w-[240px]">
                                {node.name}
                              </span>
                            </div>
                          </td>

                          {/* 2026 Base Revenue */}
                          <td className="py-2.5 px-3 text-right font-medium text-slate-500">
                            ฿{formatMB(node.baseRev26)} MB
                          </td>

                          {/* Method Selector */}
                          <td className="py-2.5 px-3 text-center">
                            <select
                              value={node.method}
                              onChange={(e) =>
                                handleUpdateNode(node.id, {
                                  method: e.target.value as TargetMethod,
                                })
                              }
                              className="px-2 py-1 text-[11px] font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none"
                            >
                              <option value="growth_pct">Growth % YoY</option>
                              <option value="fixed_amount">Fixed Amount (MB)</option>
                              <option value="increment_amount">Increment (+Δ MB)</option>
                              {node.level !== "pkt" && <option value="portion_share">Portion of Parent (%)</option>}
                            </select>
                          </td>

                          {/* Input Value */}
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="number"
                                step={node.method === "growth_pct" ? "0.1" : "1"}
                                value={node.inputVal}
                                onChange={(e) =>
                                  handleUpdateNode(node.id, {
                                    inputVal: parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="w-20 px-2 py-0.5 text-center text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg focus:outline-none"
                              />
                              <span className="text-[11px] text-slate-400 font-semibold">
                                {node.method === "growth_pct" || node.method === "portion_share" ? "%" : "MB"}
                              </span>
                            </div>
                          </td>

                          {/* 2027 Calculated Target */}
                          <td className="py-2.5 px-3 text-right font-semibold text-slate-900">
                            ฿{formatMB(node.targetRev27)} MB
                          </td>

                          {/* YoY % */}
                          <td className="py-2.5 px-3 text-right">
                            <span
                              className={clsx(
                                "font-semibold text-xs inline-flex items-center gap-0.5",
                                node.growthRevPct >= 0 ? "text-emerald-600" : "text-rose-600"
                              )}
                            >
                              {formatPct(node.growthRevPct)}
                            </span>
                          </td>

                          {/* Delegation Gap & Status */}
                          <td className="py-2.5 px-3 text-center">
                            {hasChildren ? (
                              node.allocationStatus === "balanced" ? (
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                                  <Check className="h-3 w-3" /> Balanced
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" /> Δ ฿{formatMB(node.allocationGap)} MB
                                </span>
                              )
                            ) : (
                              <span className="text-slate-300 text-[11px]">—</span>
                            )}
                          </td>

                          {/* Action Button: Delegate to children */}
                          <td className="py-2.5 px-4 text-center">
                            {hasChildren && (
                              <button
                                type="button"
                                onClick={() => handleOpenDelegateModal(node.id)}
                                className="px-2 py-1 rounded-md text-[11px] font-semibold text-blue-600 hover:bg-blue-50 border border-blue-200 transition cursor-pointer"
                                title="Distribute target down to child nodes based on 2026 proportions"
                              >
                                Delegate ↓
                              </button>
                            )}
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

        {/* ================= TAB 2: VISUAL WATERFALL DELEGATION ================= */}
        {activeTab === "flow" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-sm space-y-6">
              <div>
                <h3 className="text-base font-semibold text-slate-900 tracking-tight">Cascading Target Flow Diagram</h3>
                <p className="text-xs text-slate-500">Visual cascading pipeline from Central HQ Target down to Clinical CoEs, Settings, and Market Segments</p>
              </div>

              {/* 4 Cascading Columns */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Column 1: Central PKT */}
                <div className="p-4 rounded-2xl bg-blue-600 text-white space-y-3 flex flex-col justify-between">
                  <div>
                    <span className="text-[11px] font-semibold text-blue-100 block">Level 0: Network HQ</span>
                    <h4 className="text-lg font-semibold text-white mt-1">PKT Consolidated</h4>
                    <div className="text-2xl font-semibold text-white mt-2">
                      ฿{formatMB(pktNode?.targetRev27 || 0)} MB
                    </div>
                    <div className="text-xs text-blue-100 mt-1">
                      YoY Growth: <span className="text-white font-semibold">{formatPct(pktNode?.growthRevPct || 0)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenDelegateModal("PKT")}
                    className="w-full py-2 bg-white hover:bg-blue-50 text-blue-700 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span>Delegate to 3 Sites</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Column 2: 3 Sites */}
                <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-100 space-y-3">
                  <span className="text-[11px] font-semibold text-blue-700 block">Level 1: Hospital Sites</span>
                  <div className="space-y-2">
                    {TARGET_SITES.map((site) => {
                      const sNode = tree[site];
                      const prof = HOSPITAL_PROFILES[site] || HOSPITAL_PROFILES["BPK"];
                      return (
                        <div key={site} className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
                          <div className="flex items-center justify-between text-xs font-semibold">
                            <span style={{ color: prof.color }}>{site}</span>
                            <span className="text-slate-900 font-semibold">฿{formatMB(sNode?.targetRev27 || 0)} MB</span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-400">
                            <span>{formatPct(sNode?.growthRevPct || 0)} YoY</span>
                            <button
                              type="button"
                              onClick={() => handleOpenDelegateModal(site)}
                              className="text-blue-600 hover:underline font-semibold text-[11px]"
                            >
                              Delegate to CoE ↓
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Column 3: Care Setting (OPD vs IPD) */}
                <div className="p-4 rounded-2xl bg-cyan-50/60 border border-cyan-100 space-y-3">
                  <span className="text-[11px] font-semibold text-cyan-800 block">Level 3: Care Setting</span>
                  {(() => {
                    let opdTotal = 0;
                    let ipdTotal = 0;
                    Object.values(tree)
                      .filter((n) => n.level === "setting")
                      .forEach((n) => {
                        if (n.code === "OPD") opdTotal += n.targetRev27;
                        else if (n.code === "IPD") ipdTotal += n.targetRev27;
                      });

                    return (
                      <div className="space-y-3">
                        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
                          <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                            <span>OPD (Outpatient)</span>
                            <span className="font-semibold text-cyan-700">฿{formatMB(opdTotal)} MB</span>
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Share: {((opdTotal / (opdTotal + ipdTotal)) * 100).toFixed(1)}% of Revenue
                          </div>
                        </div>

                        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
                          <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                            <span>IPD (Inpatient)</span>
                            <span className="font-semibold text-cyan-700">฿{formatMB(ipdTotal)} MB</span>
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Share: {((ipdTotal / (opdTotal + ipdTotal)) * 100).toFixed(1)}% of Revenue
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Column 4: Market Segments */}
                <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-100 space-y-3">
                  <span className="text-[11px] font-semibold text-purple-800 block">Level 4: Market Segments</span>
                  {(() => {
                    let thaiTotal = 0;
                    let expatTotal = 0;
                    let flyInTotal = 0;

                    Object.values(tree)
                      .filter((n) => n.level === "market")
                      .forEach((n) => {
                        if (n.code === "Thai") thaiTotal += n.targetRev27;
                        else if (n.code === "Expat") expatTotal += n.targetRev27;
                        else if (n.code === "Fly-in") flyInTotal += n.targetRev27;
                      });

                    const grandMkt = thaiTotal + expatTotal + flyInTotal;

                    return (
                      <div className="space-y-2">
                        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
                          <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                            <span>Thai Patients</span>
                            <span className="font-semibold text-slate-900">฿{formatMB(thaiTotal)} MB</span>
                          </div>
                          <div className="text-[11px] text-slate-400">{((thaiTotal / grandMkt) * 100).toFixed(1)}% share</div>
                        </div>

                        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
                          <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                            <span>Expat Residents</span>
                            <span className="font-semibold text-slate-900">฿{formatMB(expatTotal)} MB</span>
                          </div>
                          <div className="text-[11px] text-slate-400">{((expatTotal / grandMkt) * 100).toFixed(1)}% share</div>
                        </div>

                        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
                          <div className="flex items-center justify-between text-xs font-semibold text-purple-700">
                            <span>Fly-in (International)</span>
                            <span className="font-semibold text-purple-700">฿{formatMB(flyInTotal)} MB</span>
                          </div>
                          <div className="text-[11px] text-purple-400">{((flyInTotal / grandMkt) * 100).toFixed(1)}% share</div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 3: MARKET SEGMENT CROSS-TAB MATRIX ================= */}
        {activeTab === "matrix" && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-sm space-y-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900 tracking-tight">Market Segment &amp; Setting Matrix (2027 Projections)</h3>
                <p className="text-xs text-slate-500">Cross-tabulation breakdown of clinical specialties across Thai, Expat, and International Fly-in patients</p>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                    <tr>
                      <th className="py-3 px-4 min-w-[200px]">Hospital &amp; Specialty</th>
                      <th className="py-3 px-3 text-right">Base 2026</th>
                      <th className="py-3 px-3 text-right text-blue-700 bg-blue-50/50">Thai OPD</th>
                      <th className="py-3 px-3 text-right text-blue-700 bg-blue-50/50">Thai IPD</th>
                      <th className="py-3 px-3 text-right text-cyan-700 bg-cyan-50/50">Expat OPD</th>
                      <th className="py-3 px-3 text-right text-cyan-700 bg-cyan-50/50">Expat IPD</th>
                      <th className="py-3 px-3 text-right text-purple-700 bg-purple-50/50">Fly-in OPD</th>
                      <th className="py-3 px-3 text-right text-purple-700 bg-purple-50/50">Fly-in IPD</th>
                      <th className="py-3 px-4 text-right font-semibold text-slate-900">Total 2027</th>
                      <th className="py-3 px-3 text-right font-semibold text-emerald-600">YoY %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {matrixData.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
                              {row.site}
                            </span>
                            <span className="font-semibold text-slate-900">{row.name}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-500">฿{formatMB(row.baseRev)}</td>
                        <td className="py-2.5 px-3 text-right text-slate-700 font-mono">฿{formatMB(row.opd.thai)}</td>
                        <td className="py-2.5 px-3 text-right text-slate-700 font-mono">฿{formatMB(row.ipd.thai)}</td>
                        <td className="py-2.5 px-3 text-right text-slate-700 font-mono">฿{formatMB(row.opd.expat)}</td>
                        <td className="py-2.5 px-3 text-right text-slate-700 font-mono">฿{formatMB(row.ipd.expat)}</td>
                        <td className="py-2.5 px-3 text-right text-purple-700 font-mono font-semibold">฿{formatMB(row.opd.flyIn)}</td>
                        <td className="py-2.5 px-3 text-right text-purple-700 font-mono font-semibold">฿{formatMB(row.ipd.flyIn)}</td>
                        <td className="py-2.5 px-4 text-right font-semibold text-slate-900">฿{formatMB(row.targetRev)}</td>
                        <td className="py-2.5 px-3 text-right font-semibold text-emerald-600">{formatPct(row.growthPct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 4: SAVED SCENARIOS & SUPABASE ================= */}
        {activeTab === "scenarios" && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-sm space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900 tracking-tight">Supabase Scenario Vault</h3>
                  <p className="text-xs text-slate-500">Persisted target scenarios with full cascading parameters stored in Supabase</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSaveModal(true)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  <span>Save New Scenario</span>
                </button>
              </div>

              {/* Scenarios Table */}
              <div className="rounded-2xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Scenario Name</th>
                      <th className="py-3 px-4">Domain / Category</th>
                      <th className="py-3 px-4">Saved Timestamp</th>
                      <th className="py-3 px-4 text-right">Target Revenue</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {scenarios.map((sc) => {
                      const isActive = activeScenarioId === sc.id || activeScenarioName === sc.name;
                      const snap = sc.snapshot?.snap || sc.snapshot;
                      const rev = sc.snapshot?.revTgt || snap?.revTgt || 0;

                      return (
                        <tr key={sc.id} className={clsx("hover:bg-slate-50/80 transition", isActive && "bg-blue-50/40")}>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900 flex items-center gap-2">
                              <span>{sc.name}</span>
                              {isActive && (
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-600 text-white">
                                  ACTIVE
                                </span>
                              )}
                            </div>
                            {sc.description && <div className="text-[11px] text-slate-400 mt-0.5">{sc.description}</div>}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[11px]">
                              {sc.store_label || sc.store_key}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                            {sc.saved_at_label || new Date(sc.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-slate-900">
                            {rev > 0 ? `฿${formatMB(rev)} MB` : "—"}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                              <CheckCircle2 className="h-3 w-3" /> Supabase
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleLoadScenario(sc)}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold text-blue-600 hover:bg-blue-50 border border-blue-200 transition cursor-pointer"
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
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <Save className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Save Scenario to Supabase</h3>
                  <p className="text-xs text-slate-500">Persist full 5-tier cascading parameters to cloud</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveScenarioSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Scenario Name *</label>
                <input
                  type="text"
                  required
                  value={newScenarioName}
                  onChange={(e) => setNewScenarioName(e.target.value)}
                  placeholder="e.g. HQ Directed 8,000 MB Target"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  value={newScenarioDesc}
                  onChange={(e) => setNewScenarioDesc(e.target.value)}
                  placeholder="e.g. Top-down proportional delegation across BPK, BSI, DBK with international focus"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1">
                <div className="flex justify-between text-slate-600">
                  <span>PKT Central Target:</span>
                  <span className="font-semibold text-slate-900">฿{formatMB(pktNode?.targetRev27 || 0)} MB</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>YoY Growth:</span>
                  <span className="font-semibold text-emerald-600">{formatPct(pktNode?.growthRevPct || 0)}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSaveModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 border transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={syncStatus === "saving"}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                >
                  <Save className="h-4 w-4" />
                  <span>{syncStatus === "saving" ? "Saving..." : "Save to Cloud"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: TARGET DELEGATION METHOD SELECTOR ================= */}
      {delegateModalNodeId && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <GitBranch className="h-5 w-5 text-blue-600" />
                  <span>กระจายเป้าหมาย (Target Delegation)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  โหนด: <span className="font-semibold text-slate-800">{tree[delegateModalNodeId]?.name}</span> • เป้าหมาย: <span className="font-semibold text-blue-700">฿{formatMB(tree[delegateModalNodeId]?.targetRev27 || 0)} MB</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDelegateModalNodeId(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-700 font-semibold mb-3">
              เลือกวิธีกระจายเป้าหมายสู่หน่วยงานย่อย ({tree[delegateModalNodeId]?.childrenKeys.length || 0} หน่วย):
            </p>

            <div className="space-y-2.5 mb-5 max-h-[60vh] overflow-y-auto pr-1">
              {/* Method 1: scaled_profile */}
              <label
                onClick={() => setSelectedDelegationMode("scaled_profile")}
                className={clsx(
                  "p-3 rounded-xl border text-left cursor-pointer flex items-start gap-3 transition",
                  selectedDelegationMode === "scaled_profile"
                    ? "bg-blue-50/80 border-blue-400 ring-2 ring-blue-100"
                    : "bg-white border-slate-200 hover:bg-slate-50"
                )}
              >
                <input
                  type="radio"
                  name="delegation_mode"
                  checked={selectedDelegationMode === "scaled_profile"}
                  onChange={() => setSelectedDelegationMode("scaled_profile")}
                  className="mt-0.5 text-blue-600 cursor-pointer"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-900">
                      1. Preserved Strategic Profile (สัดส่วนกลยุทธ์เดิม)
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      แนะนำมาตรฐาน
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    ขยาย/ลดตามเป้ากลยุทธ์เดิมของแต่ละแผนก (Scaling Ratio) <strong>รักษาความแตกต่างของ CoE เติบโตสูง (เช่น Trauma, Cancer, Elective Surgery, DBK)</strong> ไม่ให้เลขแบนราบเหมือนกันหมด
                  </p>
                </div>
              </label>

              {/* Method 2: tiered_weighted */}
              <label
                onClick={() => setSelectedDelegationMode("tiered_weighted")}
                className={clsx(
                  "p-3 rounded-xl border text-left cursor-pointer flex items-start gap-3 transition",
                  selectedDelegationMode === "tiered_weighted"
                    ? "bg-blue-50/80 border-blue-400 ring-2 ring-blue-100"
                    : "bg-white border-slate-200 hover:bg-slate-50"
                )}
              >
                <input
                  type="radio"
                  name="delegation_mode"
                  checked={selectedDelegationMode === "tiered_weighted"}
                  onChange={() => setSelectedDelegationMode("tiered_weighted")}
                  className="mt-0.5 text-blue-600 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-semibold text-slate-900">
                    2. Strategic Tiered Weighted (แบ่งน้ำหนักตามระดับกลยุทธ์)
                  </span>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    ให้โควตาการเติบโตตามระดับความสำคัญ: <strong>CoE ขับเคลื่อนการเติบโต (1.5x)</strong> ➔ <strong>SBU กลุ่มหลัก (1.0x)</strong> ➔ <strong>Usual Business ทรงตัว (0.5x)</strong>
                  </p>
                </div>
              </label>

              {/* Method 3: plug_usual */}
              <label
                onClick={() => setSelectedDelegationMode("plug_usual")}
                className={clsx(
                  "p-3 rounded-xl border text-left cursor-pointer flex items-start gap-3 transition",
                  selectedDelegationMode === "plug_usual"
                    ? "bg-blue-50/80 border-blue-400 ring-2 ring-blue-100"
                    : "bg-white border-slate-200 hover:bg-slate-50"
                )}
              >
                <input
                  type="radio"
                  name="delegation_mode"
                  checked={selectedDelegationMode === "plug_usual"}
                  onChange={() => setSelectedDelegationMode("plug_usual")}
                  className="mt-0.5 text-blue-600 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-semibold text-slate-900">
                    3. Core Lock + Plug to Usual (ล็อคเป้า CoE แล้วให้ Usual รับส่วนต่าง)
                  </span>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    ตรึงเป้าหมาย CoE และ SBU ทั้งหมดตามที่แพทย์/แผนกกำหนด ส่วนต่างทั้งหมด (Surplus/Deficit) จะถูกส่งไปปรับที่ <strong>Usual Business</strong> เป็นตัวปรับดุล
                  </p>
                </div>
              </label>

              {/* Method 4: flat_base */}
              <label
                onClick={() => setSelectedDelegationMode("flat_base")}
                className={clsx(
                  "p-3 rounded-xl border text-left cursor-pointer flex items-start gap-3 transition",
                  selectedDelegationMode === "flat_base"
                    ? "bg-blue-50/80 border-blue-400 ring-2 ring-blue-100"
                    : "bg-white border-slate-200 hover:bg-slate-50"
                )}
              >
                <input
                  type="radio"
                  name="delegation_mode"
                  checked={selectedDelegationMode === "flat_base"}
                  onChange={() => setSelectedDelegationMode("flat_base")}
                  className="mt-0.5 text-blue-600 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-semibold text-slate-900">
                    4. Historical Base Proportional (ตามสัดส่วนฐานจริงเดิมปี 2026)
                  </span>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    แจกตามสัดส่วนยอดจริงเดิม (ทำให้ทุกแผนกเติบโตด้วย Growth % เดียวกันทั้งหมด — เป็นวิธีเดิมที่เคยทำให้ตัวเลขดูแปลก)
                  </p>
                </div>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDelegateModalNodeId(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 transition cursor-pointer"
              >
                ยกเลิก (Cancel)
              </button>
              <button
                type="button"
                onClick={() => handleExecuteDelegation(delegateModalNodeId, selectedDelegationMode)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-xs transition cursor-pointer inline-flex items-center gap-1.5"
              >
                <Check className="h-4 w-4" />
                <span>ยืนยันการกระจายเป้า (Apply)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
