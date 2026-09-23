"use client";

import { useEffect, useState } from "react";
import {
  Activity,
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
  FolderTree,
  FunctionSquare,
  HelpCircle,
  Info,
  KeyRound,
  Layers,
  Lightbulb,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  RefreshCw,
  Search,
  Server,
  Share2,
  Sparkles,
  Table,
  Terminal,
  X,
  Zap,
} from "lucide-react";
import { clsx } from "clsx";
import { useTheme } from "@/context/ThemeContext";

interface ItemRecord {
  id: string;
  name: string;
  tableName: string;
  type: "Measure" | "Data Column" | "Calculated Column";
  dataType: string;
  description: string;
  expression: string | null;
  formatString: string | null;
  isHidden: boolean;
  modelCode: string;
  modelName: string;
}

interface ModelMeta {
  code: string;
  name: string;
  id: string;
  totalMeasures: number;
  totalColumns: number;
}

export function DaxManagementPage() {
  const { currentTheme } = useTheme();

  // Floating Sidebar state
  const [floatSidebarOpen, setFloatSidebarOpen] = useState(true);

  // Active Model: "PKT-D01" | "PKT-D02"
  const [activeModel, setActiveModel] = useState<string>("PKT-D01");

  // Tab: explorer | api-console
  const [activeTab, setActiveTab] = useState<"explorer" | "api-console">("explorer");

  // Items & Metadata State
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [models, setModels] = useState<ModelMeta[]>([
    {
      code: "PKT-D01",
      name: "PKT-D01 Strategy Semantic Model",
      id: "aa345483-35dc-4a57-a3a8-b09dffeb39e0",
      totalMeasures: 849,
      totalColumns: 1877,
    },
    {
      code: "PKT-D02",
      name: "PKT-D02 Cost & Financial Semantic Model",
      id: "e78dfd10-e9b6-45ac-a74d-14a1f5d1b7fc",
      totalMeasures: 606,
      totalColumns: 1459,
    },
  ]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTable, setSelectedTable] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [meta, setMeta] = useState<any>({
    total: 0,
    totalMeasures: 0,
    totalColumns: 0,
    totalTables: 0,
    tables: [],
    activeModelCode: "PKT-D01",
    activeModelName: "PKT-D01 Strategy Semantic Model",
  });

  // Copied state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Live Query Console
  const [daxQuery, setDaxQuery] = useState("EVALUATE INFO.VIEW.MEASURES()");
  const [executing, setExecuting] = useState(false);
  const [execResult, setExecResult] = useState<any>(null);
  const [execError, setExecError] = useState<string | null>(null);

  useEffect(() => {
    void fetchItems();
  }, [activeModel, selectedTable, selectedType]);

  async function fetchItems() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("model", activeModel);
      if (searchQuery.trim()) params.set("q", searchQuery.trim());
      if (selectedTable !== "all") params.set("table", selectedTable);
      if (selectedType !== "all") params.set("type", selectedType);
      params.set("limit", "150");

      const res = await fetch(`/api/powerbi/dax?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setItems(json.items || []);
        if (json.meta) setMeta(json.meta);
        if (json.models && json.models.length > 0) setModels(json.models);
      }
    } catch (err) {
      console.error("Error fetching DAX items:", err);
    } finally {
      setLoading(false);
    }
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    void fetchItems();
  }

  function copyText(id: string, text: string) {
    void navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function handleExecuteQuery() {
    const currentModelMeta = models.find((m) => m.code === activeModel);
    if (!currentModelMeta?.id || !daxQuery.trim()) return;

    setExecuting(true);
    setExecError(null);
    setExecResult(null);

    try {
      const res = await fetch("/api/powerbi/dax", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datasetId: currentModelMeta.id,
          query: daxQuery.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        setExecError(json.error || "Failed to execute DAX query");
      } else {
        setExecResult(json.result);
      }
    } catch (err: any) {
      setExecError(err.message || "Network error connecting to Power BI API");
    } finally {
      setExecuting(false);
    }
  }

  const currentModelMeta = models.find((m) => m.code === activeModel) || models[0];

  return (
    <div className="h-full w-full overflow-hidden flex flex-col gap-4 font-sans select-none">
      {/* 1. TOP CONTROL BAR */}
      <div className="shrink-0 bg-white rounded-3xl p-4 shadow-xs border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            style={{
              backgroundColor: currentTheme.primaryLight,
              color: currentTheme.primary,
            }}
            className="grid h-10 w-10 place-items-center rounded-2xl shadow-xs"
          >
            <FunctionSquare className="h-5 w-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 tracking-tight">
                DAX & Semantic Model Intelligence
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-extrabold uppercase border border-blue-200">
                Live REST API
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Extracted directly via Power BI REST API &bull; Active: {currentModelMeta.name}
            </p>
          </div>
        </div>

        {/* Tab & Floating Sidebar Toggle */}
        <div className="flex items-center gap-2">
          {/* Floating Sidebar Toggle Button */}
          <button
            type="button"
            onClick={() => setFloatSidebarOpen(!floatSidebarOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
          >
            <Layers className="h-3.5 w-3.5 text-blue-600" />
            <span>{floatSidebarOpen ? "Hide Dataset Sidebar" : "Dataset Sidebar"}</span>
          </button>

          <div className="flex items-center bg-slate-100 p-1 rounded-full text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("explorer")}
              className={clsx(
                "flex items-center gap-1.5 px-4 py-1.5 rounded-full font-bold transition",
                activeTab === "explorer"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Model Explorer</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("api-console")}
              className={clsx(
                "flex items-center gap-1.5 px-4 py-1.5 rounded-full font-bold transition",
                activeTab === "api-console"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Terminal className="h-3.5 w-3.5" />
              <span>Live DAX Console</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. MAIN SPLIT VIEW (With Floating Dataset Sidebar) */}
      <div className="flex-1 min-h-0 flex gap-4 overflow-hidden relative">
        {/* FLOATING DATASET SIDEBAR */}
        {floatSidebarOpen && (
          <aside className="w-72 lg:w-80 shrink-0 h-full bg-white rounded-3xl p-4 shadow-sm border border-slate-200/80 flex flex-col justify-between overflow-hidden animate-in slide-in-from-left duration-200">
            <div className="flex flex-col space-y-4 overflow-hidden min-h-0">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <Database className="h-4 w-4 text-blue-600" />
                  <span>Semantic Models ({models.length})</span>
                </div>
                <button
                  type="button"
                  onClick={() => void fetchItems()}
                  title="Refresh Model Data"
                  className="text-slate-400 hover:text-slate-600"
                >
                  <RefreshCw className={clsx("h-3.5 w-3.5", loading && "animate-spin")} />
                </button>
              </div>

              {/* Models List */}
              <div className="space-y-2.5">
                {models.map((m) => {
                  const isSelected = activeModel === m.code;
                  return (
                    <button
                      key={m.code}
                      type="button"
                      onClick={() => {
                        setActiveModel(m.code);
                        setSelectedTable("all");
                      }}
                      className={clsx(
                        "w-full p-3 rounded-2xl border text-left transition flex flex-col justify-between space-y-2",
                        isSelected
                          ? "border-blue-600 bg-blue-50/50 shadow-xs ring-2 ring-blue-500/20"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={clsx(
                            "px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase",
                            isSelected
                              ? "bg-blue-600 text-white"
                              : "bg-slate-100 text-slate-700"
                          )}
                        >
                          {m.code}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          ID: {m.id.slice(0, 8)}...
                        </span>
                      </div>

                      <div>
                        <p className="text-xs font-bold text-slate-900 leading-tight">
                          {m.name}
                        </p>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100/80">
                        <span className="font-semibold text-blue-700">
                          {m.totalMeasures} Measures
                        </span>
                        <span>{m.totalColumns} Columns</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Table Navigator in Active Model */}
              <div className="flex-1 min-h-0 flex flex-col space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">Tables in Model</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {meta.totalTables} Tables
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                  <button
                    type="button"
                    onClick={() => setSelectedTable("all")}
                    className={clsx(
                      "w-full text-left px-2.5 py-1.5 rounded-xl text-[11px] font-medium transition truncate flex items-center justify-between",
                      selectedTable === "all"
                        ? "bg-slate-900 text-white font-bold"
                        : "text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    <span>All Tables</span>
                    <span className="text-[10px] opacity-75">{meta.total}</span>
                  </button>

                  {(meta.tables || []).map((tbl: string) => {
                    const isSelected = selectedTable.toLowerCase() === tbl.toLowerCase();
                    return (
                      <button
                        key={tbl}
                        type="button"
                        onClick={() => setSelectedTable(tbl)}
                        className={clsx(
                          "w-full text-left px-2.5 py-1.5 rounded-xl text-[11px] font-medium transition truncate flex items-center justify-between",
                          isSelected
                            ? "bg-blue-600 text-white font-bold"
                            : "text-slate-600 hover:bg-slate-100"
                        )}
                      >
                        <span className="truncate">{tbl}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Floating Sidebar Footer */}
            <div className="pt-3 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
              <span>Source: Microsoft Entra ID</span>
              <span className="text-emerald-700 font-bold">&bull; 200 OK</span>
            </div>
          </aside>
        )}

        {/* MAIN VISUAL CONTENT AREA (Scrolls Internally) */}
        <div className="flex-1 h-full min-w-0 bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 flex flex-col overflow-hidden">
          {activeTab === "explorer" ? (
            <div className="h-full flex flex-col space-y-4 overflow-hidden">
              {/* Filter & Search Header */}
              <div className="shrink-0 flex flex-col sm:flex-row gap-3">
                <form onSubmit={handleSearchSubmit} className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search measures, columns, expressions..."
                    className="w-full rounded-full bg-slate-50 pl-10 pr-4 py-2 text-xs text-slate-800 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </form>

                <div className="flex items-center gap-2">
                  <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    className="rounded-full bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 border border-slate-200 focus:outline-none"
                  >
                    <option value="all">All Types</option>
                    <option value="measure">Measures Only ({meta.totalMeasures})</option>
                    <option value="column">Columns Only ({meta.totalColumns})</option>
                  </select>

                  <button
                    type="button"
                    onClick={handleSearchSubmit}
                    className="px-5 py-2 rounded-full text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-xs transition"
                  >
                    Search
                  </button>
                </div>
              </div>

              {/* Status Header */}
              <div className="shrink-0 flex items-center justify-between text-xs text-slate-500 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span>Displaying:</span>
                  <span className="font-bold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-full">
                    {activeModel} &bull; {selectedTable === "all" ? "All Tables" : selectedTable}
                  </span>
                </div>
                <span>Showing {items.length} of {meta.total} results</span>
              </div>

              {/* Internal Scrollable Table List */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-3">
                {loading ? (
                  <div className="py-20 text-center text-xs text-slate-400 animate-pulse">
                    Loading semantic model definitions from Power BI API...
                  </div>
                ) : items.length === 0 ? (
                  <div className="py-20 text-center text-xs text-slate-400">
                    No matching measures or columns found.
                  </div>
                ) : (
                  items.map((it) => (
                    <div
                      key={it.id}
                      className="p-4 rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-xs transition bg-slate-50/40 space-y-2.5"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span
                            className={clsx(
                              "px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase",
                              it.type === "Measure"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-emerald-100 text-emerald-800"
                            )}
                          >
                            {it.type}
                          </span>

                          <span className="font-mono text-xs font-bold text-slate-900">
                            {it.name}
                          </span>

                          <span className="text-[11px] text-slate-400 font-mono">
                            in <span className="font-semibold text-slate-700">{it.tableName}</span>
                          </span>

                          <span className="text-[10px] text-slate-400">
                            Type: {it.dataType}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          {it.isHidden ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400">
                              <EyeOff className="h-3 w-3" />
                              <span>Hidden</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500">
                              <Eye className="h-3 w-3" />
                              <span>Visible</span>
                            </span>
                          )}

                          {it.expression && (
                            <button
                              type="button"
                              onClick={() => copyText(it.id, it.expression!)}
                              className="flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold bg-white border border-slate-200 text-slate-700 hover:border-slate-400 shadow-2xs transition"
                            >
                              {copiedId === it.id ? (
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

                      {/* Description */}
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {it.description}
                      </p>

                      {/* Monospace Code Formula */}
                      {it.expression && (
                        <div className="rounded-xl bg-slate-900 p-3 text-xs text-emerald-400 font-mono overflow-x-auto shadow-inner border border-slate-800">
                          <pre className="whitespace-pre-wrap">{it.expression}</pre>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            /* TAB 2: LIVE DAX API QUERY CONSOLE */
            <div className="h-full flex flex-col space-y-4 overflow-hidden">
              <div className="shrink-0 space-y-1 border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900">
                  Live Power BI REST API Query Console
                </h3>
                <p className="text-xs text-slate-500">
                  Target Dataset: {currentModelMeta.name} ({currentModelMeta.id})
                </p>
              </div>

              {/* Presets */}
              <div className="shrink-0 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700">Query Presets:</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setDaxQuery("EVALUATE INFO.VIEW.MEASURES()")}
                    className="px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-[11px] font-bold text-slate-700 transition"
                  >
                    INFO.VIEW.MEASURES()
                  </button>
                  <button
                    type="button"
                    onClick={() => setDaxQuery("EVALUATE INFO.VIEW.COLUMNS()")}
                    className="px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-[11px] font-bold text-slate-700 transition"
                  >
                    INFO.VIEW.COLUMNS()
                  </button>
                  <button
                    type="button"
                    onClick={() => setDaxQuery("EVALUATE INFO.VIEW.TABLES()")}
                    className="px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-[11px] font-bold text-slate-700 transition"
                  >
                    INFO.VIEW.TABLES()
                  </button>
                  <button
                    type="button"
                    onClick={() => setDaxQuery("EVALUATE COLUMNSTATISTICS()")}
                    className="px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-[11px] font-bold text-slate-700 transition"
                  >
                    COLUMNSTATISTICS()
                  </button>
                </div>
              </div>

              {/* DAX Input */}
              <div className="shrink-0 space-y-2">
                <textarea
                  rows={4}
                  value={daxQuery}
                  onChange={(e) => setDaxQuery(e.target.value)}
                  placeholder="Enter DAX query..."
                  className="w-full rounded-2xl bg-slate-900 p-3.5 font-mono text-xs text-emerald-400 border border-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />

                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-slate-400 font-mono">
                    Endpoint: POST /v1.0/myorg/datasets/{'{id}'}/executeQueries
                  </span>

                  <button
                    type="button"
                    onClick={handleExecuteQuery}
                    disabled={executing || !daxQuery.trim()}
                    className="flex items-center gap-1.5 px-6 py-2 rounded-full text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition shadow-xs disabled:opacity-50"
                  >
                    {executing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-white" />}
                    <span>{executing ? "Executing..." : "Run Query via API"}</span>
                  </button>
                </div>
              </div>

              {/* Execution Output (Internal Scroll) */}
              <div className="flex-1 overflow-y-auto pr-1">
                {execError && (
                  <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                    <p className="font-bold">Execution Error:</p>
                    <pre className="font-mono text-[11px] mt-1 whitespace-pre-wrap">{execError}</pre>
                  </div>
                )}

                {execResult && (
                  <div className="rounded-2xl bg-slate-900 p-4 font-mono text-xs text-slate-200 border border-slate-800">
                    <p className="text-emerald-400 font-bold mb-2">Query Executed Successfully &bull; 200 OK</p>
                    <pre className="whitespace-pre-wrap">{JSON.stringify(execResult, null, 2)}</pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
