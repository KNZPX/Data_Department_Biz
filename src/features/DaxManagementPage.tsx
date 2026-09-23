"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Binary,
  BookOpen,
  Calculator,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  Cpu,
  Database,
  ExternalLink,
  Eye,
  EyeOff,
  Filter,
  FileCode,
  FunctionSquare,
  HelpCircle,
  Info,
  KeyRound,
  Layers,
  Lightbulb,
  Play,
  RefreshCw,
  Search,
  Server,
  Share2,
  Sparkles,
  Table,
  Terminal,
  Zap,
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

interface DictionaryItem {
  Table_Name: string;
  Object_Name: string;
  Description: string;
  Definition: string;
  Object_Type: string;
  DAX_Formula: string;
  Status: string;
}

export function DaxManagementPage() {
  const { currentTheme, currentCanvas } = useTheme();

  // Tab: dictionary | api-console
  const [activeTab, setActiveTab] = useState<"dictionary" | "api-console">("dictionary");

  // Dictionary state
  const [items, setItems] = useState<DictionaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTable, setSelectedTable] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [meta, setMeta] = useState<any>({
    totalMeasures: 843,
    totalDataColumns: 1568,
    totalCalcColumns: 72,
    totalTables: 187,
    tables: [],
  });

  // Copied state
  const [copiedName, setCopiedName] = useState<string | null>(null);

  // API Execution Console State
  const [datasets, setDatasets] = useState<any[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState("");
  const [daxQuery, setDaxQuery] = useState("EVALUATE INFO.VIEW.MEASURES()");
  const [executing, setExecuting] = useState(false);
  const [execResult, setExecResult] = useState<any>(null);
  const [execError, setExecError] = useState<string | null>(null);

  useEffect(() => {
    void fetchDictionary();
  }, [selectedTable, selectedType]);

  async function fetchDictionary() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set("q", searchQuery.trim());
      if (selectedTable !== "all") params.set("table", selectedTable);
      if (selectedType !== "all") params.set("type", selectedType);
      params.set("limit", "100");

      const res = await fetch(`/api/powerbi/dax?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setItems(json.items || []);
        if (json.meta) setMeta(json.meta);
        if (json.datasets) {
          setDatasets(json.datasets);
          if (json.datasets.length > 0 && !selectedDatasetId) {
            setSelectedDatasetId(json.datasets[0].id);
          }
        }
      }
    } catch (err) {
      console.error("Error fetching dictionary:", err);
    } finally {
      setLoading(false);
    }
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    void fetchDictionary();
  }

  function copyDax(name: string, formula: string) {
    void navigator.clipboard.writeText(formula);
    setCopiedName(name);
    setTimeout(() => setCopiedName(null), 2000);
  }

  async function handleExecuteQuery() {
    if (!selectedDatasetId || !daxQuery.trim()) return;
    setExecuting(true);
    setExecError(null);
    setExecResult(null);

    try {
      const res = await fetch("/api/powerbi/dax", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datasetId: selectedDatasetId,
          query: daxQuery.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        setExecError(json.error || "Failed to execute query");
      } else {
        setExecResult(json.result);
      }
    } catch (err: any) {
      setExecError(err.message || "Network error while connecting to Power BI API");
    } finally {
      setExecuting(false);
    }
  }

  return (
    <div className="space-y-7 pb-16 max-w-7xl mx-auto">
      {/* 1. HERO HEADER */}
      <div className="squircle-card p-6 sm:p-8 bg-white space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3.5">
            <div
              style={{
                backgroundColor: currentTheme.primaryLight,
                color: currentTheme.primary,
              }}
              className="grid h-12 w-12 place-items-center rounded-2xl shadow-xs"
            >
              <FunctionSquare className="h-6 w-6 stroke-[2.2]" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                DAX & Semantic Model Management
              </h1>
              <p className="text-xs text-slate-500">
                Centralized metadata dictionary, business calculation logic, and direct Power BI REST API extractor
              </p>
            </div>
          </div>

          {/* Navigation Pill Switcher */}
          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-full self-start md:self-auto">
            <button
              type="button"
              onClick={() => setActiveTab("dictionary")}
              style={{
                backgroundColor: activeTab === "dictionary" ? currentTheme.primary : "transparent",
                color: activeTab === "dictionary" ? "#ffffff" : "#475569",
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition shadow-xs"
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Measure Dictionary (2,483)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("api-console")}
              style={{
                backgroundColor: activeTab === "api-console" ? currentTheme.primary : "transparent",
                color: activeTab === "api-console" ? "#ffffff" : "#475569",
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition shadow-xs"
            >
              <Terminal className="h-3.5 w-3.5" />
              <span>Power BI API Extractor</span>
            </button>
          </div>
        </div>

        {/* 4 SUMMARY KPI CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 pt-1">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Certified Measures</span>
              <FunctionSquare className="h-4 w-4" style={{ color: currentTheme.primary }} />
            </div>
            <p className="text-2xl font-black text-slate-900">{meta.totalMeasures || 843}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Verified DAX calculations</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Data Columns</span>
              <Table className="h-4 w-4 text-sky-500" />
            </div>
            <p className="text-2xl font-black text-slate-900">{meta.totalDataColumns || 1568}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Physical dataset fields</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Tables in Model</span>
              <Layers className="h-4 w-4 text-amber-500" />
            </div>
            <p className="text-2xl font-black text-slate-900">{meta.totalTables || 187}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Fact & Dim tables</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Calculated Columns</span>
              <Code2 className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-black text-slate-900">{meta.totalCalcColumns || 72}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Model-computed attributes</p>
          </div>
        </div>
      </div>

      {/* TAB 1: MEASURE & COLUMN DICTIONARY */}
      {activeTab === "dictionary" && (
        <div className="squircle-card p-6 sm:p-8 bg-white space-y-6">
          {/* Search & Filter Bar */}
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search measures, formulas, Thai business definitions, or columns..."
                className="w-full rounded-full bg-slate-50 pl-11 pr-5 py-2.5 text-xs text-slate-800 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>

            {/* Table Dropdown */}
            <select
              value={selectedTable}
              onChange={(e) => setSelectedTable(e.target.value)}
              className="rounded-full bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-700 border border-slate-200 focus:outline-none"
            >
              <option value="all">All Tables (187)</option>
              {(meta.tables || []).map((t: string) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            {/* Type Dropdown */}
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="rounded-full bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-700 border border-slate-200 focus:outline-none"
            >
              <option value="all">All Object Types</option>
              <option value="Measure">Measures Only</option>
              <option value="Data Column">Data Columns Only</option>
              <option value="Calculated Column">Calculated Columns</option>
            </select>

            <button
              type="submit"
              style={{
                backgroundColor: currentTheme.primary,
                boxShadow: `0 8px 16px -2px ${currentTheme.primaryGlow}`,
              }}
              className="px-6 py-2.5 rounded-full text-xs font-bold text-white transition hover:opacity-90 shrink-0"
            >
              Search
            </button>
          </form>

          {/* Dictionary Items List */}
          {loading ? (
            <div className="py-16 text-center text-xs text-slate-400 animate-pulse">
              Loading dictionary definitions...
            </div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400">
              No matching measures or columns found. Try a different keyword or reset filters.
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item, idx) => (
                <div
                  key={`${item.Table_Name}-${item.Object_Name}-${idx}`}
                  className="p-5 rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-xs transition bg-slate-50/50 space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span
                        style={{
                          backgroundColor:
                            item.Object_Type === "Measure"
                              ? currentTheme.primaryLight
                              : item.Object_Type === "Calculated Column"
                              ? "#ecfdf5"
                              : "#f0f9ff",
                          color:
                            item.Object_Type === "Measure"
                              ? currentTheme.primary
                              : item.Object_Type === "Calculated Column"
                              ? "#047857"
                              : "#0369a1",
                        }}
                        className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                      >
                        {item.Object_Type}
                      </span>

                      <span className="font-mono text-xs font-bold text-slate-800">
                        {item.Object_Name}
                      </span>

                      <span className="text-[11px] text-slate-400 font-mono">
                        in <span className="font-semibold text-slate-600">{item.Table_Name}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      {item.Status === "Visible" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500">
                          <Eye className="h-3 w-3" />
                          <span>Visible</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400">
                          <EyeOff className="h-3 w-3" />
                          <span>Hidden</span>
                        </span>
                      )}

                      {item.DAX_Formula && (
                        <button
                          type="button"
                          onClick={() => copyDax(item.Object_Name, item.DAX_Formula)}
                          className="flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold bg-white border border-slate-200 text-slate-700 hover:border-slate-400 shadow-2xs transition"
                        >
                          {copiedName === item.Object_Name ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-600" />
                              <span className="text-emerald-700">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3 text-slate-400" />
                              <span>Copy DAX</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Thai Business Logic & Definition */}
                  {(item.Description || item.Definition) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                      {item.Description && (
                        <div className="p-3 rounded-xl bg-white border border-slate-100">
                          <span className="font-bold text-slate-500 text-[10px] uppercase block mb-0.5">
                            หลักการ (Business Context)
                          </span>
                          <p className="text-slate-800 leading-relaxed">{item.Description}</p>
                        </div>
                      )}

                      {item.Definition && (
                        <div className="p-3 rounded-xl bg-white border border-slate-100">
                          <span className="font-bold text-slate-500 text-[10px] uppercase block mb-0.5">
                            วิธีคำนวณ (Calculation Logic)
                          </span>
                          <p className="text-slate-800 leading-relaxed">{item.Definition}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Monospace DAX Formula */}
                  {item.DAX_Formula && (
                    <div className="mt-2 rounded-xl bg-slate-900 p-3.5 text-xs text-emerald-400 font-mono overflow-x-auto shadow-inner border border-slate-800">
                      <div className="flex justify-between items-center text-slate-400 text-[10px] mb-1.5 border-b border-slate-800 pb-1">
                        <span className="uppercase tracking-wider">DAX Expression</span>
                      </div>
                      <pre className="whitespace-pre-wrap">{item.DAX_Formula}</pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: POWER BI REST API & LIVE QUERY CONSOLE */}
      {activeTab === "api-console" && (
        <div className="space-y-6">
          {/* TECHNICAL ANSWER & GUIDE CARD */}
          <div className="squircle-card p-6 sm:p-8 bg-white space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div
                style={{
                  backgroundColor: currentTheme.primaryLight,
                  color: currentTheme.primary,
                }}
                className="grid h-10 w-10 place-items-center rounded-2xl shadow-xs"
              >
                <HelpCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Power BI API: ดึง Column + Measure ทั้งหมดจาก Semantic Model ได้อย่างไร?
                </h3>
                <p className="text-xs text-slate-500">
                  คำตอบ: เข้าถึงได้ 100% ผ่าน 3 วิธีมาตรฐานของ Microsoft Power BI & Fabric
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-purple-50/50 border border-purple-100 space-y-2">
                <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-bold uppercase">
                  วิธีที่ 1 (แนะนำที่สุด)
                </span>
                <h4 className="font-bold text-slate-900">Execute Queries REST API</h4>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  ใช้ Endpoint <code>POST /v1.0/myorg/datasets/{'{datasetId}'}/executeQueries</code> พร้อมรันคำสั่ง DAX:
                </p>
                <div className="p-2 rounded-lg bg-slate-900 text-emerald-400 font-mono text-[10px]">
                  EVALUATE INFO.VIEW.MEASURES()
                  <br />
                  EVALUATE INFO.VIEW.COLUMNS()
                </div>
                <p className="text-[10px] text-purple-700">
                  &bull; ใช้งานได้ทั้ง Power BI Pro, PPU และ Premium
                  <br />
                  &bull; ส่งคืนทั้งชื่อสูตร, Table, Data Type, Description
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-100 space-y-2">
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold uppercase">
                  วิธีที่ 2 (Enterprise)
                </span>
                <h4 className="font-bold text-slate-900">XMLA Endpoint (TOM / AMO)</h4>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  เชื่อมต่อผ่าน Analysis Services (เช่น <code>powerbi://api.powerbi.com/...</code>)
                </p>
                <div className="p-2 rounded-lg bg-slate-900 text-amber-300 font-mono text-[10px]">
                  SELECT * FROM $SYSTEM.TMSCHEMA_MEASURES
                </div>
                <p className="text-[10px] text-amber-800">
                  &bull; ต้องเปิด XMLA Read-Write บน Premium/Fabric
                  <br />
                  &bull; ดึงความสัมพันธ์ (Relationships), Calculation Groups ได้ลึกที่สุด
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100 space-y-2">
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase">
                  วิธีที่ 3 (Modern Fabric)
                </span>
                <h4 className="font-bold text-slate-900">Fabric TMDL Definition API</h4>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  ดึงคำจำกัดความโมเดลในรูปแบบ TMDL (Tabular Model Definition Language)
                </p>
                <div className="p-2 rounded-lg bg-slate-900 text-emerald-300 font-mono text-[10px]">
                  POST /semanticModels/{'{id}'}/getDefinition
                </div>
                <p className="text-[10px] text-emerald-800">
                  &bull; โครงสร้างแบบ Git/Code-first
                  <br />
                  &bull; จัดเก็บโค้ด DAX ใน Text file แยกตาม Table
                </p>
              </div>
            </div>
          </div>

          {/* INTERACTIVE LIVE DAX QUERY CONSOLE */}
          <div className="squircle-card p-6 sm:p-8 bg-white space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div
                  style={{
                    backgroundColor: currentTheme.primaryLight,
                    color: currentTheme.primary,
                  }}
                  className="grid h-10 w-10 place-items-center rounded-2xl shadow-xs"
                >
                  <Terminal className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Live DAX Query Console (Power BI REST API)
                  </h3>
                  <p className="text-xs text-slate-500">
                    ทดสอบส่งคำสั่ง DAX และดึง Schema / Measures จาก Semantic Model จริง
                  </p>
                </div>
              </div>

              {/* Dataset Selection */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-600">Dataset:</label>
                <select
                  value={selectedDatasetId}
                  onChange={(e) => setSelectedDatasetId(e.target.value)}
                  className="rounded-full bg-slate-50 px-3.5 py-1.5 text-xs font-semibold text-slate-800 border border-slate-200"
                >
                  {datasets.length > 0 ? (
                    datasets.map((d: any) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.id.slice(0, 8)}...)
                      </option>
                    ))
                  ) : (
                    <option value="active-model">Healthcare Semantic Model (Default)</option>
                  )}
                </select>
              </div>
            </div>

            {/* Presets and Query Editor */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Quick DAX Query Presets:</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setDaxQuery("EVALUATE INFO.VIEW.MEASURES()")}
                    className="px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-[11px] font-bold text-slate-700 transition"
                  >
                    All Measures (INFO.VIEW)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDaxQuery("EVALUATE INFO.VIEW.COLUMNS()")}
                    className="px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-[11px] font-bold text-slate-700 transition"
                  >
                    All Columns (INFO.VIEW)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDaxQuery("EVALUATE INFO.VIEW.TABLES()")}
                    className="px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-[11px] font-bold text-slate-700 transition"
                  >
                    All Tables (INFO.VIEW)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDaxQuery("EVALUATE COLUMNSTATISTICS()")}
                    className="px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-[11px] font-bold text-slate-700 transition"
                  >
                    Column Statistics
                  </button>
                </div>
              </div>

              <textarea
                rows={4}
                value={daxQuery}
                onChange={(e) => setDaxQuery(e.target.value)}
                placeholder="Enter DAX query (e.g. EVALUATE INFO.VIEW.MEASURES())..."
                className="w-full rounded-2xl bg-slate-900 p-4 font-mono text-xs text-emerald-400 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-400"
              />

              <div className="flex justify-between items-center pt-1">
                <span className="text-[11px] text-slate-400">
                  Sends payload to <code>/api/powerbi/dax</code> &rarr; Power BI REST API <code>executeQueries</code>
                </span>

                <button
                  type="button"
                  onClick={handleExecuteQuery}
                  disabled={executing || !daxQuery.trim()}
                  style={{
                    backgroundColor: currentTheme.primary,
                    boxShadow: `0 8px 16px -2px ${currentTheme.primaryGlow}`,
                  }}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {executing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-white" />}
                  <span>{executing ? "Executing Query..." : "Run DAX via API"}</span>
                </button>
              </div>
            </div>

            {/* Execution Result Area */}
            {execError && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-1">
                <p className="font-bold">Execution Error:</p>
                <pre className="font-mono text-[11px] whitespace-pre-wrap">{execError}</pre>
                <p className="text-[10px] text-rose-600 mt-2">
                  Tip: Make sure the Microsoft 365 token has <code>Dataset.Read.All</code> permissions and the selected dataset is available.
                </p>
              </div>
            )}

            {execResult && (
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">API Response Results:</span>
                  <span className="text-[11px] font-bold text-emerald-600">Query Successful &bull; Status 200 OK</span>
                </div>

                <div className="rounded-2xl bg-slate-900 p-4 font-mono text-xs text-slate-200 max-h-96 overflow-auto border border-slate-800">
                  <pre className="whitespace-pre-wrap">{JSON.stringify(execResult, null, 2)}</pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
