"use client";

import { useEffect, useState, useMemo } from "react";
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
  Columns,
  Copy,
  Cpu,
  Database,
  Edit3,
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
  LayoutGrid,
  Lightbulb,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
  Server,
  Share2,
  Sparkles,
  Table as TableIcon,
  Terminal,
  Trash2,
  User,
  X,
  Zap,
} from "lucide-react";
import { clsx } from "clsx";
import { useTheme } from "@/context/ThemeContext";

interface ItemRecord {
  id: string;
  name: string;
  tableName: string;
  type: string;
  dataType: string;
  description: string;
  expression: string | null;
  formatString: string | null;
  isHidden: boolean;
  modelCode: string;
  modelName: string;
  mathDefinition?: string;
  businessDefinition?: string;
  notes?: string;
  isCustom?: boolean;
  sampleValues?: any[] | null;
}

interface ModelMeta {
  code: string;
  name: string;
  id: string;
  totalMeasures: number;
  totalColumns: number;
}

function HighlightText({
  text,
  match,
  active,
}: {
  text: string;
  match: string;
  active: boolean;
}) {
  if (!active || !match.trim() || !text) return <>{text}</>;
  const query = match.trim();
  const escaped = query.replace(/[.*+?^\$\{}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark
            key={i}
            className="bg-amber-200 text-slate-900 font-bold px-1 rounded-xs"
          >
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

export function DaxManagementPage() {
  const { currentTheme } = useTheme();

  // Floating Sidebar state
  const [floatSidebarOpen, setFloatSidebarOpen] = useState(true);

  // Active Model: "PKT-D01" | "PKT-D02"
  const [activeModel, setActiveModel] = useState<string>("PKT-D01");

  // Tab: explorer | api-console
  const [activeTab, setActiveTab] = useState<"explorer" | "api-console">("explorer");

  // View Mode: "table" | "sidebox" | "split"
  const [viewMode, setViewMode] = useState<"table" | "sidebox" | "split">("table");

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

  // Real-time Instant Search with Debounce
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchMode, setSearchMode] = useState<"partial" | "exact">("partial");
  const [selectedTable, setSelectedTable] = useState("all");
  const [tableSearchQuery, setTableSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("all");

  const [meta, setMeta] = useState<any>({
    total: 0,
    totalMeasures: 0,
    totalColumns: 0,
    totalSemantic: 0,
    totalCustom: 0,
    totalTables: 0,
    tables: [],
    activeModelCode: "PKT-D01",
    activeModelName: "PKT-D01 Strategy Semantic Model",
  });

  // Selected item for Sidebox view & modals
  const [selectedItem, setSelectedItem] = useState<ItemRecord | null>(null);

  // Copied state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Live Query Console
  const [daxQuery, setDaxQuery] = useState("EVALUATE INFO.VIEW.MEASURES()");
  const [executing, setExecuting] = useState(false);
  const [execResult, setExecResult] = useState<any>(null);
  const [execError, setExecError] = useState<string | null>(null);

  // Live Semantic Model Column Sampling State
  const [sampleValuesMap, setSampleValuesMap] = useState<Record<string, any[]>>({});
  const [loadingSamplesId, setLoadingSamplesId] = useState<string | null>(null);

  // Modals state
  const [definitionModalOpen, setDefinitionModalOpen] = useState(false);
  const [definitionTarget, setDefinitionTarget] = useState<ItemRecord | null>(null);
  const [defMath, setDefMath] = useState("");
  const [defBusiness, setDefBusiness] = useState("");
  const [defNotes, setDefNotes] = useState("");
  const [isSavingDef, setIsSavingDef] = useState(false);

  // Custom DAX Modal state
  const [customDaxModalOpen, setCustomDaxModalOpen] = useState(false);
  const [customDaxTarget, setCustomDaxTarget] = useState<ItemRecord | null>(null);
  const [customName, setCustomName] = useState("");
  const [customTable, setCustomTable] = useState("");
  const [customDataType, setCustomDataType] = useState("Decimal");
  const [customExpression, setCustomExpression] = useState("");
  const [customMath, setCustomMath] = useState("");
  const [customBusiness, setCustomBusiness] = useState("");
  const [customNotes, setCustomNotes] = useState("");
  const [isSavingCustom, setIsSavingCustom] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);

  // Instant Search Debounce Effect (250ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    void fetchItems();
  }, [activeModel, selectedTable, selectedType, searchMode, debouncedQuery]);

  async function fetchItems() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("model", activeModel);
      if (debouncedQuery.trim()) params.set("q", debouncedQuery.trim());
      params.set("searchMode", searchMode);
      if (selectedTable !== "all") params.set("table", selectedTable);
      if (selectedType !== "all") params.set("type", selectedType);
      params.set("limit", "150");

      const res = await fetch(`/api/powerbi/dax?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        const loadedItems: ItemRecord[] = json.items || [];
        setItems(loadedItems);
        if (json.meta) setMeta(json.meta);
        if (json.models && json.models.length > 0) setModels(json.models);

        // Pre-populate sample values from Supabase cache
        const sMap: Record<string, any[]> = {};
        for (const it of loadedItems) {
          if (it.sampleValues && it.sampleValues.length > 0) {
            sMap[it.id] = it.sampleValues;
          }
        }
        setSampleValuesMap((prev) => ({ ...prev, ...sMap }));

        // Keep or select first item for sidebox view
        if (loadedItems.length > 0) {
          setSelectedItem((prev) => {
            if (!prev) return loadedItems[0];
            const found = loadedItems.find((i: ItemRecord) => i.id === prev.id);
            return found || loadedItems[0];
          });
        } else {
          setSelectedItem(null);
        }
      }
    } catch (err) {
      console.error("Error fetching DAX items:", err);
    } finally {
      setLoading(false);
    }
  }

  // Real-time Search Input Change (Unlocks table to ALL immediately)
  function handleSearchInputChange(val: string) {
    setSearchQuery(val);
    if (val.trim() && selectedTable !== "all") {
      setSelectedTable("all");
    }
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim() && selectedTable !== "all") {
      setSelectedTable("all");
    }
    setDebouncedQuery(searchQuery);
  }

  function copyText(id: string, text: string) {
    void navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  // Live Semantic Model Column Values Sampling
  async function handleFetchColumnSamples(item: ItemRecord) {
    const currentModelMeta = models.find((m) => m.code === activeModel);
    if (!currentModelMeta?.id) return;

    setLoadingSamplesId(item.id);
    try {
      const res = await fetch("/api/powerbi/dax", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "fetch_column_samples",
          datasetId: currentModelMeta.id,
          tableName: item.tableName,
          columnName: item.name,
          itemId: item.id,
        }),
      });
      const json = await res.json();
      if (json.values) {
        setSampleValuesMap((prev) => ({ ...prev, [item.id]: json.values }));
      }
    } catch (err) {
      console.error("Failed to fetch column samples:", err);
    } finally {
      setLoadingSamplesId(null);
    }
  }

  // Open Edit Definitions Modal
  function openDefinitionModal(item: ItemRecord) {
    setDefinitionTarget(item);
    setDefMath(item.mathDefinition || "");
    setDefBusiness(item.businessDefinition || "");
    setDefNotes(item.notes || "");
    setDefinitionModalOpen(true);
  }

  async function handleSaveDefinitions() {
    if (!definitionTarget) return;
    setIsSavingDef(true);
    try {
      const res = await fetch("/api/powerbi/dax", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_annotation",
          modelCode: activeModel,
          tableName: definitionTarget.tableName,
          objectName: definitionTarget.name,
          objectType: definitionTarget.type,
          id: definitionTarget.id,
          mathDefinition: defMath,
          businessDefinition: defBusiness,
          notes: defNotes,
        }),
      });

      if (res.ok) {
        // Update local item state
        setItems((prev) =>
          prev.map((item) =>
            item.id === definitionTarget.id
              ? {
                  ...item,
                  mathDefinition: defMath,
                  businessDefinition: defBusiness,
                  notes: defNotes,
                }
              : item
          )
        );
        if (selectedItem?.id === definitionTarget.id) {
          setSelectedItem({
            ...selectedItem,
            mathDefinition: defMath,
            businessDefinition: defBusiness,
            notes: defNotes,
          });
        }
        setDefinitionModalOpen(false);
      }
    } catch (err) {
      console.error("Error saving annotations:", err);
    } finally {
      setIsSavingDef(false);
    }
  }

  // Open Custom DAX Modal (new or edit)
  function openCustomDaxModal(item?: ItemRecord) {
    if (item) {
      setCustomDaxTarget(item);
      setCustomName(item.name);
      setCustomTable(item.tableName);
      setCustomDataType(item.dataType || "Decimal");
      setCustomExpression(item.expression || "");
      setCustomMath(item.mathDefinition || "");
      setCustomBusiness(item.businessDefinition || "");
      setCustomNotes(item.notes || "");
    } else {
      setCustomDaxTarget(null);
      setCustomName("");
      setCustomTable(selectedTable !== "all" ? selectedTable : "Custom Metrics");
      setCustomDataType("Decimal");
      setCustomExpression("");
      setCustomMath("");
      setCustomBusiness("");
      setCustomNotes("");
    }
    setCustomError(null);
    setCustomDaxModalOpen(true);
  }

  async function handleSaveCustomDax() {
    if (!customName.trim() || !customTable.trim() || !customExpression.trim()) {
      setCustomError("Name, Table, and DAX Expression are required.");
      return;
    }
    setIsSavingCustom(true);
    setCustomError(null);
    try {
      const res = await fetch("/api/powerbi/dax", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_custom",
          id: customDaxTarget?.id,
          name: customName.trim(),
          tableName: customTable.trim(),
          dataType: customDataType,
          expression: customExpression.trim(),
          mathDefinition: customMath.trim(),
          businessDefinition: customBusiness.trim(),
          notes: customNotes.trim(),
          modelCode: activeModel,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        setCustomError(json.error || "Failed to save Custom DAX");
      } else {
        setCustomDaxModalOpen(false);
        void fetchItems();
      }
    } catch (err: any) {
      setCustomError(err.message || "Network error");
    } finally {
      setIsSavingCustom(false);
    }
  }

  async function handleDeleteCustomDax(id: string) {
    if (!confirm("Are you sure you want to delete this custom DAX measure?")) return;
    try {
      const res = await fetch("/api/powerbi/dax", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_custom",
          id,
        }),
      });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== id));
        if (selectedItem?.id === id) {
          setSelectedItem(null);
        }
      }
    } catch (err) {
      console.error("Error deleting custom DAX:", err);
    }
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

  // Filtered table list for floating sidebar
  const filteredTables = useMemo(() => {
    const all = meta.tables || [];
    if (!tableSearchQuery.trim()) return all;
    const q = tableSearchQuery.toLowerCase();
    return all.filter((t: string) => t.toLowerCase().includes(q));
  }, [meta.tables, tableSearchQuery]);

  const currentModelMeta = models.find((m) => m.code === activeModel) || models[0];

  return (
    <div className="h-full w-full overflow-hidden flex flex-col gap-4 font-sans select-none">
      {/* 1. TOP CONTROL BAR */}
      <div className="shrink-0 bg-white rounded-3xl p-4 shadow-xs border border-slate-200/80 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
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
                Live Supabase + REST API
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Synced to Supabase DB &bull; Active: {currentModelMeta.name}
            </p>
          </div>
        </div>

        {/* View Switcher, Custom DAX Button & Dataset Sidebar Toggle */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Add Custom DAX Button */}
          <button
            type="button"
            onClick={() => openCustomDaxModal()}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition"
          >
            <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
            <span>Add Custom DAX</span>
          </button>

          {/* Floating Sidebar Toggle Button */}
          <button
            type="button"
            onClick={() => setFloatSidebarOpen(!floatSidebarOpen)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
          >
            <Layers className="h-3.5 w-3.5 text-blue-600" />
            <span>{floatSidebarOpen ? "Hide Datasets" : "Show Datasets"}</span>
          </button>

          {/* View Modes (Table | Sidebox | Split) */}
          <div className="flex items-center bg-slate-100 p-1 rounded-full text-xs">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              title="Table View (Full Grid)"
              className={clsx(
                "flex items-center gap-1 px-3 py-1 rounded-full font-bold transition",
                viewMode === "table"
                  ? "bg-white text-blue-600 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <TableIcon className="h-3.5 w-3.5" />
              <span>Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("sidebox")}
              title="Sidebox View (List with Inspector Drawer)"
              className={clsx(
                "flex items-center gap-1 px-3 py-1 rounded-full font-bold transition",
                viewMode === "sidebox"
                  ? "bg-white text-blue-600 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Sidebox</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("split")}
              title="Split View (Card List with Inline DAX)"
              className={clsx(
                "flex items-center gap-1 px-3 py-1 rounded-full font-bold transition",
                viewMode === "split"
                  ? "bg-white text-blue-600 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Columns className="h-3.5 w-3.5" />
              <span>Split</span>
            </button>
          </div>

          {/* Tab: Model Explorer vs Live Console */}
          <div className="flex items-center bg-slate-100 p-1 rounded-full text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("explorer")}
              className={clsx(
                "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-bold transition",
                activeTab === "explorer"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Explorer</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("api-console")}
              className={clsx(
                "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-bold transition",
                activeTab === "api-console"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Terminal className="h-3.5 w-3.5" />
              <span>Console</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. MAIN WORKSPACE (With Floating Dataset Sidebar) */}
      <div className="flex-1 min-h-0 flex gap-4 overflow-hidden relative">
        {/* FLOATING DATASET SIDEBAR */}
        {floatSidebarOpen && (
          <aside className="w-72 lg:w-80 shrink-0 h-full bg-white rounded-3xl p-4 shadow-sm border border-slate-200/80 flex flex-col justify-between overflow-hidden animate-in slide-in-from-left duration-200">
            <div className="flex flex-col space-y-3 overflow-hidden min-h-0">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <Database className="h-4 w-4 text-blue-600" />
                  <span>Semantic Models ({models.length})</span>
                </div>
                <button
                  type="button"
                  onClick={() => void fetchItems()}
                  title="Refresh Model Telemetry"
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition"
                >
                  <RefreshCw className={clsx("h-3.5 w-3.5", loading && "animate-spin")} />
                </button>
              </div>

              {/* Models List */}
              <div className="space-y-2">
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
                        "w-full p-2.5 rounded-2xl border text-left transition flex flex-col justify-between space-y-1.5",
                        isSelected
                          ? "border-blue-600 bg-blue-50/60 shadow-xs ring-2 ring-blue-500/20"
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

                      <p className="text-xs font-bold text-slate-900 leading-tight">
                        {m.name}
                      </p>

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
                    {meta.totalTables} Total
                  </span>
                </div>

                {/* Table Search Input */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                  <input
                    type="text"
                    value={tableSearchQuery}
                    onChange={(e) => setTableSearchQuery(e.target.value)}
                    placeholder="Search tables..."
                    className="w-full rounded-xl bg-slate-50 pl-8 pr-2.5 py-1.5 text-[11px] text-slate-800 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                  {tableSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setTableSearchQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
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

                  {filteredTables.map((tbl: string) => {
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
                  {filteredTables.length === 0 && (
                    <p className="text-[11px] text-slate-400 italic text-center py-4">
                      No tables match "{tableSearchQuery}"
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Floating Sidebar Footer */}
            <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
              <span>Source: Azure Entra ID</span>
              <span className="text-emerald-700 font-bold">&bull; 200 OK</span>
            </div>
          </aside>
        )}

        {/* MAIN VISUAL CONTENT AREA */}
        <div className="flex-1 h-full min-w-0 bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 flex flex-col overflow-hidden">
          {activeTab === "explorer" ? (
            <div className="h-full flex flex-col space-y-3 overflow-hidden">
              {/* Filter & Real-Time Instant Search Header */}
              <div className="shrink-0 flex flex-col lg:flex-row gap-3">
                {/* Search Input with Partial vs Exact Toggle */}
                <form onSubmit={handleSearchSubmit} className="relative flex-1 flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => handleSearchInputChange(e.target.value)}
                      placeholder="Instant search measures, columns, expressions, definitions..."
                      className="w-full rounded-full bg-slate-50 pl-10 pr-4 py-2 text-xs text-slate-800 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => handleSearchInputChange("")}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  {/* Partial vs Exact Toggle */}
                  <div className="flex items-center bg-slate-100 p-0.5 rounded-full text-[11px]">
                    <button
                      type="button"
                      onClick={() => setSearchMode("partial")}
                      className={clsx(
                        "px-2.5 py-1 rounded-full font-bold transition",
                        searchMode === "partial"
                          ? "bg-white text-blue-600 shadow-2xs"
                          : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      Partial
                    </button>
                    <button
                      type="button"
                      onClick={() => setSearchMode("exact")}
                      className={clsx(
                        "px-2.5 py-1 rounded-full font-bold transition",
                        searchMode === "exact"
                          ? "bg-white text-blue-600 shadow-2xs"
                          : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      Exact
                    </button>
                  </div>
                </form>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Source & Type Filter Dropdown (Includes Semantic Model and Custom by User) */}
                  <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    className="rounded-full bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 border border-slate-200 focus:outline-none"
                  >
                    <option value="all">All Items ({meta.total})</option>
                    <option value="semantic">
                      Semantic Model ({meta.totalSemantic || meta.totalMeasures + meta.totalColumns})
                    </option>
                    <option value="custom">
                      Custom by User ({meta.totalCustom || 0})
                    </option>
                    <option value="measure">Measures Only ({meta.totalMeasures})</option>
                    <option value="column">Columns Only ({meta.totalColumns})</option>
                    <option value="calculated_column">Calculated Columns</option>
                  </select>
                </div>
              </div>

              {/* Status Header */}
              <div className="shrink-0 flex items-center justify-between text-xs text-slate-500 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2 flex-wrap">
                  <span>Scope:</span>
                  <span className="font-bold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-full">
                    {activeModel} &bull; {selectedTable === "all" ? "All Tables" : selectedTable}
                  </span>
                  {searchQuery && (
                    <span className="text-[11px] text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full font-semibold">
                      Instant Search: "{searchQuery}" ({searchMode})
                    </span>
                  )}
                </div>
                <span>Showing {items.length} of {meta.total} results</span>
              </div>

              {/* MAIN CONTENT BY VIEW MODE */}
              <div className="flex-1 min-h-0 overflow-hidden">
                {loading ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400 animate-pulse">
                    Querying Supabase and Semantic Model...
                  </div>
                ) : items.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">
                    No matching measures or columns found for "{searchQuery}".
                  </div>
                ) : viewMode === "table" ? (
                  /* ================= 1. TABLE VIEW ================= */
                  <div className="h-full overflow-y-auto border border-slate-200/80 rounded-2xl">
                    <table className="w-full text-left text-xs text-slate-700 border-collapse">
                      <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-xs text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200/80 z-10">
                        <tr>
                          <th className="py-2.5 px-3">Origin & Type</th>
                          <th className="py-2.5 px-3">Name</th>
                          <th className="py-2.5 px-3">Table</th>
                          <th className="py-2.5 px-3">Data Type</th>
                          <th className="py-2.5 px-3">Definitions</th>
                          <th className="py-2.5 px-3">Formula / Samples</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {items.map((it) => (
                          <tr
                            key={it.id}
                            className="hover:bg-blue-50/30 transition group"
                          >
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {it.isCustom ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-purple-100 text-purple-800 border border-purple-200">
                                    <User className="h-2.5 w-2.5" />
                                    <span>Custom by User</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-sky-100 text-sky-800 border border-sky-200">
                                    <Database className="h-2.5 w-2.5" />
                                    <span>Semantic Model</span>
                                  </span>
                                )}

                                <span
                                  className={clsx(
                                    "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                                    it.type === "Measure"
                                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                                      : it.type.includes("Calculated")
                                      ? "bg-amber-50 text-amber-700 border border-amber-200"
                                      : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  )}
                                >
                                  {it.type}
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                              <HighlightText
                                text={it.name}
                                match={searchQuery}
                                active={Boolean(searchQuery.trim())}
                              />
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                              <HighlightText
                                text={it.tableName}
                                match={searchQuery}
                                active={Boolean(searchQuery.trim())}
                              />
                            </td>
                            <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                              {it.dataType}
                            </td>
                            <td className="py-2.5 px-3 max-w-xs">
                              {it.mathDefinition || it.businessDefinition ? (
                                <div className="space-y-0.5">
                                  {it.businessDefinition && (
                                    <p className="text-[11px] text-slate-700 truncate" title={it.businessDefinition}>
                                      <span className="font-semibold text-blue-700">Biz:</span> {it.businessDefinition}
                                    </p>
                                  )}
                                  {it.mathDefinition && (
                                    <p className="text-[10px] font-mono text-slate-500 truncate" title={it.mathDefinition}>
                                      <span className="font-semibold text-purple-700">Math:</span> {it.mathDefinition}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[11px] text-slate-300 italic">None defined</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 max-w-sm truncate font-mono text-[11px] text-slate-600">
                              {it.expression ? (
                                <span className="truncate block font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-800" title={it.expression}>
                                  {it.expression}
                                </span>
                              ) : it.type.includes("Column") ? (
                                <div className="flex items-center gap-1.5">
                                  {sampleValuesMap[it.id] ? (
                                    <div className="flex items-center gap-1">
                                      <span className="text-[10px] font-mono text-emerald-700 truncate">
                                        [{sampleValuesMap[it.id].slice(0, 3).join(", ")}]
                                      </span>
                                      <span className="text-[9px] px-1 bg-emerald-100 text-emerald-800 rounded font-sans font-bold">
                                        DB Saved
                                      </span>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleFetchColumnSamples(it)}
                                      disabled={loadingSamplesId === it.id}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition"
                                    >
                                      {loadingSamplesId === it.id ? (
                                        <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                                      ) : (
                                        <Zap className="h-2.5 w-2.5" />
                                      )}
                                      <span>Fetch Samples</span>
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-300 italic">Direct column</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              {it.isHidden ? (
                                <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                                  <EyeOff className="h-3 w-3" /> Hidden
                                </span>
                              ) : (
                                <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                                  <Eye className="h-3 w-3" /> Visible
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                {it.expression && (
                                  <button
                                    type="button"
                                    onClick={() => copyText(it.id, it.expression!)}
                                    title="Copy DAX Expression"
                                    className="p-1 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition"
                                  >
                                    {copiedId === it.id ? (
                                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                                    ) : (
                                      <Copy className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => openDefinitionModal(it)}
                                  title="Edit Mathematical & Business Definitions"
                                  className="p-1 rounded-lg hover:bg-blue-100 text-blue-600 transition"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                {it.isCustom && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCustomDax(it.id)}
                                    title="Delete Custom DAX"
                                    className="p-1 rounded-lg hover:bg-rose-100 text-rose-600 transition"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : viewMode === "sidebox" ? (
                  /* ================= 2. SIDEBOX VIEW ================= */
                  <div className="h-full flex gap-4 overflow-hidden">
                    {/* Left List of Items */}
                    <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                      {items.map((it) => {
                        const isSelected = selectedItem?.id === it.id;
                        return (
                          <div
                            key={it.id}
                            onClick={() => setSelectedItem(it)}
                            className={clsx(
                              "p-3 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-3",
                              isSelected
                                ? "border-blue-600 bg-blue-50/60 shadow-xs ring-2 ring-blue-500/20"
                                : "border-slate-200/80 hover:border-slate-300 bg-white"
                            )}
                          >
                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {it.isCustom ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-purple-100 text-purple-800 border border-purple-200">
                                    <User className="h-2 w-2" />
                                    <span>Custom</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-sky-100 text-sky-800 border border-sky-200">
                                    <Database className="h-2 w-2" />
                                    <span>Semantic</span>
                                  </span>
                                )}

                                <span
                                  className={clsx(
                                    "px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase",
                                    it.type === "Measure"
                                      ? "bg-blue-50 text-blue-700"
                                      : "bg-emerald-50 text-emerald-700"
                                  )}
                                >
                                  {it.type}
                                </span>

                                <h4 className="font-mono text-xs font-bold text-slate-900 truncate">
                                  <HighlightText
                                    text={it.name}
                                    match={searchQuery}
                                    active={Boolean(searchQuery.trim())}
                                  />
                                </h4>
                              </div>
                              <p className="text-[11px] text-slate-500 font-mono truncate">
                                Table: <span className="font-semibold text-slate-700">{it.tableName}</span> &bull; {it.dataType}
                              </p>
                              {it.businessDefinition && (
                                <p className="text-[11px] text-slate-600 truncate">
                                  {it.businessDefinition}
                                </p>
                              )}
                            </div>

                            <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                          </div>
                        );
                      })}
                    </div>

                    {/* Right Inspector Sidebox */}
                    {selectedItem ? (
                      <div className="w-80 lg:w-96 shrink-0 h-full border border-slate-200/80 rounded-2xl p-4 bg-slate-50/50 flex flex-col justify-between overflow-y-auto">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                            <div>
                              <div className="flex items-center gap-1.5 mb-1">
                                {selectedItem.isCustom ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-purple-100 text-purple-800 border border-purple-200">
                                    <User className="h-2.5 w-2.5" />
                                    <span>Custom by User</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-sky-100 text-sky-800 border border-sky-200">
                                    <Database className="h-2.5 w-2.5" />
                                    <span>Semantic Model</span>
                                  </span>
                                )}
                                <span className="text-[10px] font-bold text-slate-600 uppercase bg-slate-200/70 px-2 py-0.5 rounded-full">
                                  {selectedItem.type}
                                </span>
                              </div>
                              <h3 className="font-mono text-sm font-bold text-slate-900">
                                {selectedItem.name}
                              </h3>
                            </div>
                            <button
                              type="button"
                              onClick={() => openDefinitionModal(selectedItem)}
                              className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-2xs transition"
                            >
                              <Pencil className="h-3 w-3" />
                              <span>Edit</span>
                            </button>
                          </div>

                          {/* Metadata Grid */}
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="p-2.5 rounded-xl bg-white border border-slate-200/70">
                              <span className="text-[10px] text-slate-400 font-bold block">Table</span>
                              <span className="font-mono font-bold text-slate-800 truncate block">
                                {selectedItem.tableName}
                              </span>
                            </div>
                            <div className="p-2.5 rounded-xl bg-white border border-slate-200/70">
                              <span className="text-[10px] text-slate-400 font-bold block">Data Type</span>
                              <span className="font-mono font-bold text-slate-800 truncate block">
                                {selectedItem.dataType}
                              </span>
                            </div>
                          </div>

                          {/* Live Column Samples Section for Columns */}
                          {selectedItem.type.includes("Column") && (
                            <div className="space-y-2 p-3 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <Zap className="h-3.5 w-3.5 text-blue-600" />
                                  <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wide">
                                    Semantic Model Samples
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleFetchColumnSamples(selectedItem)}
                                  disabled={loadingSamplesId === selectedItem.id}
                                  className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition disabled:opacity-50"
                                >
                                  {loadingSamplesId === selectedItem.id ? (
                                    <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                                  ) : (
                                    <Sparkles className="h-2.5 w-2.5" />
                                  )}
                                  <span>{loadingSamplesId === selectedItem.id ? "Querying..." : "Fetch Samples"}</span>
                                </button>
                              </div>

                              {sampleValuesMap[selectedItem.id] ? (
                                <div className="space-y-1.5 pt-1">
                                  <div className="flex flex-wrap gap-1.5">
                                    {sampleValuesMap[selectedItem.id].length > 0 ? (
                                      sampleValuesMap[selectedItem.id].map((val, idx) => (
                                        <span
                                          key={idx}
                                          className="px-2 py-0.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-800 text-[11px] font-mono"
                                        >
                                          {String(val)}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="text-[11px] text-slate-400 italic">No values returned</span>
                                    )}
                                  </div>
                                  <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                    <Check className="h-2.5 w-2.5" /> Persisted in Supabase
                                  </span>
                                </div>
                              ) : (
                                <p className="text-[10px] text-slate-400 leading-relaxed">
                                  Click "Fetch Samples" to execute live DAX query against Power BI REST API and store distinct samples in Supabase.
                                </p>
                              )}
                            </div>
                          )}

                          {/* Business Definition */}
                          <div className="space-y-1">
                            <h5 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                              Business Definition / Meaning
                            </h5>
                            <div className="p-3 rounded-xl bg-white border border-slate-200/70 text-xs text-slate-700 leading-relaxed">
                              {selectedItem.businessDefinition || (
                                <span className="text-slate-400 italic">No business definition provided. Click Edit to add one.</span>
                              )}
                            </div>
                          </div>

                          {/* Mathematical Definition */}
                          <div className="space-y-1">
                            <h5 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                              Mathematical Formulation
                            </h5>
                            <div className="p-3 rounded-xl bg-white border border-slate-200/70 text-xs font-mono text-purple-900 leading-relaxed">
                              {selectedItem.mathDefinition || (
                                <span className="text-slate-400 italic font-sans">No mathematical definition specified.</span>
                              )}
                            </div>
                          </div>

                          {/* Notes */}
                          {selectedItem.notes && (
                            <div className="space-y-1">
                              <h5 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                                Technical Notes
                              </h5>
                              <div className="p-3 rounded-xl bg-white border border-slate-200/70 text-xs text-slate-600">
                                {selectedItem.notes}
                              </div>
                            </div>
                          )}

                          {/* DAX Formula */}
                          {selectedItem.expression && (
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <h5 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                                  DAX Expression
                                </h5>
                                <button
                                  type="button"
                                  onClick={() => copyText(selectedItem.id, selectedItem.expression!)}
                                  className="text-[10px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                >
                                  {copiedId === selectedItem.id ? (
                                    <>
                                      <Check className="h-3 w-3 text-emerald-600" />
                                      <span className="text-emerald-700">Copied!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="h-3 w-3" />
                                      <span>Copy</span>
                                    </>
                                  )}
                                </button>
                              </div>
                              <div className="p-3 rounded-xl bg-slate-900 text-emerald-400 font-mono text-xs overflow-x-auto border border-slate-800 shadow-inner">
                                <pre className="whitespace-pre-wrap">{selectedItem.expression}</pre>
                              </div>
                            </div>
                          )}
                        </div>

                        {selectedItem.isCustom && (
                          <div className="pt-3 border-t border-slate-200 mt-4 flex items-center justify-end">
                            <button
                              type="button"
                              onClick={() => handleDeleteCustomDax(selectedItem.id)}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 transition"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>Delete Custom DAX</span>
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-80 lg:w-96 shrink-0 h-full border border-dashed border-slate-200 rounded-2xl flex items-center justify-center text-xs text-slate-400">
                        Select an item to view inspector details
                      </div>
                    )}
                  </div>
                ) : (
                  /* ================= 3. SPLIT VIEW ================= */
                  <div className="h-full overflow-y-auto pr-1 space-y-3">
                    {items.map((it) => (
                      <div
                        key={it.id}
                        className="p-4 rounded-2xl border border-slate-200/80 hover:border-slate-300 hover:shadow-xs transition bg-slate-50/30 space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {it.isCustom ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-purple-100 text-purple-800 border border-purple-200">
                                <User className="h-2.5 w-2.5" />
                                <span>Custom by User</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-sky-100 text-sky-800 border border-sky-200">
                                <Database className="h-2.5 w-2.5" />
                                <span>Semantic Model</span>
                              </span>
                            )}

                            <span
                              className={clsx(
                                "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                                it.type === "Measure"
                                  ? "bg-blue-50 text-blue-700"
                                  : "bg-emerald-50 text-emerald-700"
                              )}
                            >
                              {it.type}
                            </span>

                            <span className="font-mono text-xs font-bold text-slate-900">
                              <HighlightText
                                text={it.name}
                                match={searchQuery}
                                active={Boolean(searchQuery.trim())}
                              />
                            </span>

                            <span className="text-[11px] text-slate-400 font-mono">
                              in <span className="font-semibold text-slate-700">{it.tableName}</span>
                            </span>

                            <span className="text-[10px] text-slate-400">
                              Type: {it.dataType}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-auto">
                            {it.type.includes("Column") && (
                              <button
                                type="button"
                                onClick={() => handleFetchColumnSamples(it)}
                                disabled={loadingSamplesId === it.id}
                                className="flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold bg-white border border-slate-200 text-blue-600 hover:border-blue-300 shadow-2xs transition disabled:opacity-50"
                              >
                                {loadingSamplesId === it.id ? (
                                  <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                                ) : (
                                  <Zap className="h-2.5 w-2.5" />
                                )}
                                <span>Sample Values</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => openDefinitionModal(it)}
                              className="flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold bg-white border border-slate-200 text-blue-600 hover:border-blue-300 shadow-2xs transition"
                            >
                              <Pencil className="h-3 w-3" />
                              <span>Edit Definitions</span>
                            </button>

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

                            {it.isCustom && (
                              <button
                                type="button"
                                onClick={() => handleDeleteCustomDax(it.id)}
                                className="p-1 rounded-full text-rose-500 hover:bg-rose-50 transition"
                                title="Delete"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Live Column Samples Display */}
                        {sampleValuesMap[it.id] && (
                          <div className="p-2.5 rounded-xl bg-blue-50/50 border border-blue-100 flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-bold text-blue-700 uppercase">Samples:</span>
                            {sampleValuesMap[it.id].map((v, i) => (
                              <span key={i} className="px-2 py-0.5 bg-white border border-blue-200 rounded text-[10px] font-mono text-slate-800">
                                {String(v)}
                              </span>
                            ))}
                            <span className="text-[9px] px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold">
                              Saved in DB
                            </span>
                          </div>
                        )}

                        {/* Mathematical & Business Definitions */}
                        {(it.businessDefinition || it.mathDefinition) && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs bg-white p-3 rounded-xl border border-slate-100">
                            {it.businessDefinition && (
                              <div>
                                <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wide">
                                  Business Definition
                                </span>
                                <p className="text-slate-700 mt-0.5 leading-relaxed">
                                  {it.businessDefinition}
                                </p>
                              </div>
                            )}
                            {it.mathDefinition && (
                              <div>
                                <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wide">
                                  Mathematical Formula
                                </span>
                                <p className="font-mono text-purple-900 mt-0.5 leading-relaxed">
                                  {it.mathDefinition}
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Monospace Code Formula */}
                        {it.expression && (
                          <div className="rounded-xl bg-slate-900 p-3 text-xs text-emerald-400 font-mono overflow-x-auto shadow-inner border border-slate-800">
                            <pre className="whitespace-pre-wrap">{it.expression}</pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
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

      {/* MODAL 1: EDIT DEFINITIONS MODAL */}
      {definitionModalOpen && definitionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-xl bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 flex flex-col space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-blue-100 text-blue-800">
                  {definitionTarget.type}
                </span>
                <h3 className="font-mono text-sm font-bold text-slate-900 mt-1">
                  Edit Definitions: {definitionTarget.name}
                </h3>
                <p className="text-[11px] text-slate-400">
                  Table: <span className="font-semibold text-slate-700">{definitionTarget.tableName}</span> &bull; Model: {activeModel}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDefinitionModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Business Definition / Calculation Logic
                </label>
                <textarea
                  rows={3}
                  value={defBusiness}
                  onChange={(e) => setDefBusiness(e.target.value)}
                  placeholder="Explain the business rationale, metric meaning, KPI significance..."
                  className="w-full rounded-xl bg-slate-50 p-2.5 text-xs text-slate-800 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Mathematical Formulation / Formula Reference
                </label>
                <input
                  type="text"
                  value={defMath}
                  onChange={(e) => setDefMath(e.target.value)}
                  placeholder="e.g. Total Revenue / Total Patient Encounters"
                  className="w-full rounded-xl bg-slate-50 px-3 py-2 text-xs font-mono text-slate-800 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Technical Notes & Governance Constraints
                </label>
                <textarea
                  rows={2}
                  value={defNotes}
                  onChange={(e) => setDefNotes(e.target.value)}
                  placeholder="Filters applied, active relationships, refresh frequency notes..."
                  className="w-full rounded-xl bg-slate-50 p-2.5 text-xs text-slate-800 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDefinitionModalOpen(false)}
                className="px-4 py-2 rounded-full text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveDefinitions}
                disabled={isSavingDef}
                className="px-5 py-2 rounded-full text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-xs transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSavingDef && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                <span>{isSavingDef ? "Saving..." : "Save Definitions"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD / EDIT CUSTOM DAX MODAL */}
      {customDaxModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 flex flex-col space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-purple-100 text-purple-800">
                  Custom DAX Authoring
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  {customDaxTarget ? "Edit Custom DAX Measure" : "Create New Custom DAX Measure"}
                </h3>
                <p className="text-[11px] text-slate-400">
                  Define standalone analytical measures with business logic and formulas
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCustomDaxModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {customError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                {customError}
              </div>
            )}

            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Measure Name *
                  </label>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="e.g. Average Length of Stay (Days)"
                    className="w-full rounded-xl bg-slate-50 px-3 py-2 text-xs font-mono text-slate-800 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Data Type
                  </label>
                  <select
                    value={customDataType}
                    onChange={(e) => setCustomDataType(e.target.value)}
                    className="w-full rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-800 border border-slate-200 focus:outline-none"
                  >
                    <option value="Decimal">Decimal</option>
                    <option value="Whole Number">Whole Number</option>
                    <option value="Currency">Currency</option>
                    <option value="Percentage">Percentage</option>
                    <option value="Text">Text</option>
                    <option value="Boolean">Boolean</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Home Table Name *
                </label>
                <input
                  type="text"
                  value={customTable}
                  onChange={(e) => setCustomTable(e.target.value)}
                  placeholder="e.g. Fact_Inpatient or Key Measures"
                  className="w-full rounded-xl bg-slate-50 px-3 py-2 text-xs font-mono text-slate-800 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  DAX Formula / Expression *
                </label>
                <textarea
                  rows={4}
                  value={customExpression}
                  onChange={(e) => setCustomExpression(e.target.value)}
                  placeholder="e.g. DIVIDE(SUM('Fact_Inpatient'[Total_Stay_Hours]), 24, 0)"
                  className="w-full rounded-xl bg-slate-900 p-3 text-xs font-mono text-emerald-400 border border-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Business Definition
                  </label>
                  <textarea
                    rows={2}
                    value={customBusiness}
                    onChange={(e) => setCustomBusiness(e.target.value)}
                    placeholder="Clinical or operational logic..."
                    className="w-full rounded-xl bg-slate-50 p-2.5 text-xs text-slate-800 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Mathematical Formulation
                  </label>
                  <textarea
                    rows={2}
                    value={customMath}
                    onChange={(e) => setCustomMath(e.target.value)}
                    placeholder="Formula notation (e.g. Sum / Count)..."
                    className="w-full rounded-xl bg-slate-50 p-2.5 text-xs font-mono text-slate-800 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  placeholder="Optional governance or refresh notes..."
                  className="w-full rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-800 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCustomDaxModalOpen(false)}
                className="px-4 py-2 rounded-full text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCustomDax}
                disabled={isSavingCustom}
                className="px-5 py-2 rounded-full text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-xs transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSavingCustom && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                <span>{isSavingCustom ? "Saving..." : "Save Custom DAX"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
