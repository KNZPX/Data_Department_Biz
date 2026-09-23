"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import {
  Activity,
  Binary,
  BookOpen,
  Boxes,
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
  GitBranch,
  GitFork,
  HelpCircle,
  Info,
  KeyRound,
  Layers,
  LayoutGrid,
  Lightbulb,
  Link,
  List as ListIcon,
  Maximize2,
  Minimize2,
  Move,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Server,
  Share2,
  ShieldAlert,
  Sparkles,
  Split as SplitIcon,
  Table as TableIcon,
  Trash2,
  Unlink,
  User,
  Workflow,
  X,
  Zap,
  ZoomIn,
  ZoomOut,
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
  matchReason?: string;
}

interface ModelMeta {
  code: string;
  name: string;
  id: string;
  totalMeasures: number;
  totalColumns: number;
}

interface DiagramNode {
  id: string;
  title: string;
  category: "source" | "measure_call" | "filter" | "switch" | "relationship" | "calculation" | "output";
  role: string;
  detail: string;
  codeSnippet?: string;
  x: number;
  y: number;
  connections: string[];
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
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

// Searchable Table Dropdown Component
function TableSearchDropdown({
  tables,
  value,
  onChange,
  placeholder = "Select or search table...",
  allowAll = false,
}: {
  tables: string[];
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  allowAll?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    const list = allowAll ? ["all", ...tables] : tables;
    if (!filterQuery.trim()) return list;
    return list.filter((t) => t.toLowerCase().includes(filterQuery.toLowerCase()));
  }, [tables, filterQuery, allowAll]);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 font-mono text-slate-800 hover:bg-slate-100/80 transition text-left focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
      >
        <span className="truncate font-semibold">
          {value === "all" ? "All Tables" : value || placeholder}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0 ml-2" />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-2 flex flex-col gap-1.5 max-h-64 overflow-hidden animate-in fade-in zoom-in-95">
          <div className="relative shrink-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
            <input
              type="text"
              autoFocus
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Search tables in model..."
              className="w-full pl-7 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none text-slate-800"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-0.5 pr-1 max-h-48">
            {filtered.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-400">
                No matching tables found.
                {filterQuery.trim() && (
                  <button
                    type="button"
                    onClick={() => {
                      onChange(filterQuery.trim());
                      setIsOpen(false);
                    }}
                    className="block mt-1 w-full text-blue-600 font-bold hover:underline"
                  >
                    Use "{filterQuery.trim()}"
                  </button>
                )}
              </div>
            ) : (
              filtered.map((t) => {
                const isSelected = value === t;
                const displayName = t === "all" ? "All Tables (Default)" : t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      onChange(t);
                      setIsOpen(false);
                    }}
                    className={clsx(
                      "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono transition text-left",
                      isSelected
                        ? "bg-blue-600 text-white font-bold"
                        : "text-slate-700 hover:bg-slate-100"
                    )}
                  >
                    <span className="truncate">{displayName}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 shrink-0 ml-1" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// PROGRAMMING-GRADE DAX AST FLOW PARSER
function parseDaxToProgrammingAst(measureName: string, formula: string | null, tableName: string): DiagramNode[] {
  if (!formula || !formula.trim()) {
    return [
      {
        id: "src_default",
        title: tableName || "Source Table",
        category: "source",
        role: "Data Foundation",
        detail: `Table: ${tableName}`,
        x: 40,
        y: 120,
        connections: ["calc_default"],
      },
      {
        id: "calc_default",
        title: "Expression Logic",
        category: "calculation",
        role: "DAX Computation",
        detail: "Standard aggregation logic",
        x: 340,
        y: 120,
        connections: ["out_final"],
      },
      {
        id: "out_final",
        title: `[${measureName}]`,
        category: "output",
        role: "Result Measure",
        detail: "Evaluated metric value",
        x: 640,
        y: 120,
        connections: [],
      },
    ];
  }

  const nodes: DiagramNode[] = [];
  const text = formula;

  // 1. EXTRACT CALLED MEASURES (e.g. [_hn_count], [_net_revenue], [_ipd_admit])
  const measureMatches = Array.from(new Set(Array.from(text.matchAll(/\[([_a-zA-Z0-9% -]+)\]/g)).map((m) => m[1])));
  const calledMeasures = measureMatches.filter((m) => m !== measureName && !m.toLowerCase().includes("date"));

  // 2. EXTRACT REFERENCED TABLES (e.g. 'fact_patient_visit', 'fact_refer_out')
  const tableMatches = Array.from(new Set(Array.from(text.matchAll(/'([^']+)'/g)).map((m) => m[1])));
  const primaryTable = tableMatches[0] || tableName || "fact_table";

  // 3. EXTRACT EXCLUDE / FILTER CONDITIONS
  // Matches e.g.: NOT 'fact_patient_visit'[visit_type_id] IN { 3, 5 } or NOT( ISBLANK(...) )
  const excludeMatches: string[] = [];
  const notInRegex = /NOT\s*(?:'[^']+'\[[^\]]+\]|[a-zA-Z0-9_]+)s*INs*\{[^\}]+\}/gi;
  const notBlankRegex = /NOT\s*\(\s*ISBLANK\([^\)]+\)\s*\)/gi;
  const filterRegex = /FILTER\s*\([^,]+,[^\)]+\)/gi;

  let mMatch;
  while ((mMatch = notInRegex.exec(text)) !== null) {
    excludeMatches.push(mMatch[0]);
  }
  while ((mMatch = notBlankRegex.exec(text)) !== null) {
    excludeMatches.push(mMatch[0]);
  }
  while ((mMatch = filterRegex.exec(text)) !== null) {
    excludeMatches.push(mMatch[0]);
  }

  // 4. DETECT SWITCH / BRANCHING
  const hasSwitch = /SWITCH\s*\(/i.test(text);
  const switchBranches: { caseVal: string; targetMeasure: string }[] = [];
  if (hasSwitch) {
    const branchRegex = /"([^"]+)"\s*,\s*\[([^\]]+)\]/g;
    let bMatch;
    while ((bMatch = branchRegex.exec(text)) !== null) {
      switchBranches.push({ caseVal: bMatch[1], targetMeasure: bMatch[2] });
    }
  }

  // 5. DETECT USERELATIONSHIP
  const relMatches = Array.from(text.matchAll(/USERELATIONSHIP\s*\(\s*'([^']+)'\[([^\]]+)\]\s*,\s*'([^']+)'\[([^\]]+)\]\s*\)/gi));

  // BUILD DIAGRAM NODES ACCORDING TO ACTUAL PROGRAMMING ARCHITECTURE

  // COLUMN 1: Inputs & Dependencies (x = 40)
  let yInput = 40;
  const inputNodeIds: string[] = [];

  // Add primary & secondary tables
  tableMatches.slice(0, 3).forEach((tbl, idx) => {
    const tId = `src_tbl_${idx}`;
    nodes.push({
      id: tId,
      title: `'${tbl}'`,
      category: "source",
      role: idx === 0 ? "Primary Fact Table" : "Related Dimension",
      detail: idx === 0 ? "Provides baseline row/filter context" : "Lookup/attribute table",
      x: 40,
      y: yInput,
      connections: [],
    });
    inputNodeIds.push(tId);
    yInput += 120;
  });

  // Add called measures
  calledMeasures.slice(0, 4).forEach((meas, idx) => {
    const mId = `dep_meas_${idx}`;
    nodes.push({
      id: mId,
      title: `[${meas}]`,
      category: "measure_call",
      role: "Called Sub-Measure",
      detail: "Evaluated in modified filter context",
      codeSnippet: `Dependency: [${meas}]`,
      x: 40,
      y: yInput,
      connections: [],
    });
    inputNodeIds.push(mId);
    yInput += 120;
  });

  // COLUMN 2: Filters, Exclusions & Relationship Contexts (x = 340)
  let yFilter = 40;
  const filterNodeIds: string[] = [];

  // Exclude / Not IN filters
  excludeMatches.forEach((ex, idx) => {
    const fId = `flt_ex_${idx}`;
    nodes.push({
      id: fId,
      title: ex.startsWith("NOT") ? "EXCLUDE CONDITION" : "FILTER PREDICATE",
      category: "filter",
      role: "Context Filter",
      detail: ex,
      codeSnippet: ex,
      x: 340,
      y: yFilter,
      connections: [],
    });
    filterNodeIds.push(fId);
    yFilter += 130;
  });

  // Relationships
  relMatches.forEach((rel, idx) => {
    const rId = `rel_ctx_${idx}`;
    nodes.push({
      id: rId,
      title: "USERELATIONSHIP",
      category: "relationship",
      role: "Inactive Link Activation",
      detail: `${rel[1]}[${rel[2]}] <-> ${rel[3]}[${rel[4]}]`,
      codeSnippet: `Join: ${rel[1]} <-> ${rel[3]}`,
      x: 340,
      y: yFilter,
      connections: [],
    });
    filterNodeIds.push(rId);
    yFilter += 130;
  });

  // SUMMARIZE grouping
  const hasSummarize = /SUMMARIZE/i.test(text);
  if (hasSummarize) {
    const sumId = "op_summarize";
    nodes.push({
      id: sumId,
      title: "SUMMARIZE( ... )",
      category: "calculation",
      role: "Granularity Grouping",
      detail: "Groups distinct entity keys before row count",
      x: 340,
      y: yFilter,
      connections: [],
    });
    filterNodeIds.push(sumId);
    yFilter += 130;
  }

  // COLUMN 3: Branching (SWITCH) or Core Calculation Engine (x = 640)
  let coreNodeId = "engine_calculate";
  if (hasSwitch && switchBranches.length > 0) {
    coreNodeId = "engine_switch";
    nodes.push({
      id: "engine_switch",
      title: "SWITCH( Selector )",
      category: "switch",
      role: "Dynamic Measure Dispatcher",
      detail: `Routes ${switchBranches.length} metric cases (e.g. ${switchBranches.slice(0, 3).map((b) => b.caseVal).join(", ")})`,
      x: 640,
      y: 100,
      connections: ["out_result"],
    });

    // Add branch child nodes
    switchBranches.slice(0, 4).forEach((b, idx) => {
      const bId = `switch_case_${idx}`;
      nodes.push({
        id: bId,
        title: `Case "${b.caseVal}"`,
        category: "switch",
        role: "Branch Evaluation",
        detail: `Dispatches -> [${b.targetMeasure}]`,
        x: 920,
        y: 40 + idx * 110,
        connections: ["out_result"],
      });
    });
  } else {
    const hasCalculate = /CALCULATE/i.test(text);
    const hasCountRows = /COUNTROWS/i.test(text);
    const hasSum = /SUM\(/i.test(text);
    const hasDivide = /DIVIDE\(/i.test(text);

    let engineTitle = "CALCULATE Engine";
    let engineDetail = "Applies context transition & merges filter predicates";

    if (hasCountRows) {
      engineTitle = "COUNTROWS + CALCULATE";
      engineDetail = "Counts records satisfying all filter & relationship predicates";
    } else if (hasDivide) {
      engineTitle = "DIVIDE( Numerator, Denominator )";
      engineDetail = "Safe mathematical division with zero-check";
    } else if (hasSum) {
      engineTitle = "SUM( Column )";
      engineDetail = "Column aggregation under active filter context";
    }

    nodes.push({
      id: "engine_calculate",
      title: engineTitle,
      category: "calculation",
      role: "Context Evaluation",
      detail: engineDetail,
      x: 640,
      y: 120,
      connections: ["out_result"],
    });
  }

  // COLUMN 4: Final Evaluated Output Measure (x = hasSwitch ? 1200 : 940)
  nodes.push({
    id: "out_result",
    title: `[${measureName}]`,
    category: "output",
    role: "Evaluated Output Measure",
    detail: "Final KPI metric returned to visuals",
    x: hasSwitch ? 1200 : 940,
    y: 120,
    connections: [],
  });

  // WIRE LOGICAL CONNECTIONS:
  // 1. Connect Input Nodes to Filters or Engine
  inputNodeIds.forEach((inpId) => {
    const inpNode = nodes.find((n) => n.id === inpId);
    if (inpNode) {
      if (filterNodeIds.length > 0) {
        inpNode.connections = [filterNodeIds[0]];
      } else {
        inpNode.connections = [coreNodeId];
      }
    }
  });

  // 2. Connect Filter Nodes to Core Engine
  filterNodeIds.forEach((fltId) => {
    const fltNode = nodes.find((n) => n.id === fltId);
    if (fltNode) {
      fltNode.connections = [coreNodeId];
    }
  });

  return nodes;
}

export function DaxManagementPage() {
  const { currentTheme } = useTheme();

  // Floating Sidebar state
  const [floatSidebarOpen, setFloatSidebarOpen] = useState(true);

  // Active Model: "PKT-D01" | "PKT-D02"
  const [activeModel, setActiveModel] = useState<string>("PKT-D01");

  // View Mode: "table" | "split" (was sidebox) | "list" (was split)
  const [viewMode, setViewMode] = useState<"table" | "split" | "list">("split");

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

  // Selected item for Split view & inspector
  const [selectedItem, setSelectedItem] = useState<ItemRecord | null>(null);

  // Copied state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Live Semantic Model Column Sampling State
  const [sampleValuesMap, setSampleValuesMap] = useState<Record<string, any[]>>({});
  const [loadingSamplesId, setLoadingSamplesId] = useState<string | null>(null);
  const [sampleErrorMap, setSampleErrorMap] = useState<Record<string, string>>({});

  // Sidebox / Split Inline Editing State
  const [sideboxForm, setSideboxForm] = useState({
    businessDefinition: "",
    mathDefinition: "",
    notes: "",
    expression: "",
  });
  const [isSavingSidebox, setIsSavingSidebox] = useState(false);
  const [sideboxSaveSuccess, setSideboxSaveSuccess] = useState(false);

  // Unsaved Changes Confirmation Modal
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [pendingSelection, setPendingSelection] = useState<ItemRecord | null>(null);

  // INTERACTIVE DIAGRAM STATE & TOOLBOX
  const [diagramModalOpen, setDiagramModalOpen] = useState(false);
  const [diagramTarget, setDiagramTarget] = useState<ItemRecord | null>(null);
  const [diagramNodes, setDiagramNodes] = useState<DiagramNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [diagramZoom, setDiagramZoom] = useState(1);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);
  const [diagramSaveSuccess, setDiagramSaveSuccess] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

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

  // Synchronize Split Form when selected item changes
  useEffect(() => {
    if (selectedItem) {
      setSideboxForm({
        businessDefinition: selectedItem.businessDefinition || "",
        mathDefinition: selectedItem.mathDefinition || "",
        notes: selectedItem.notes || "",
        expression: selectedItem.expression || "",
      });
      setSideboxSaveSuccess(false);
    }
  }, [selectedItem?.id]);

  // Check if Split inspector has unsaved changes
  const isSideboxDirty = useMemo(() => {
    if (!selectedItem) return false;
    const origBus = selectedItem.businessDefinition || "";
    const origMath = selectedItem.mathDefinition || "";
    const origNotes = selectedItem.notes || "";
    const origExpr = selectedItem.expression || "";

    const hasBusChanged = sideboxForm.businessDefinition !== origBus;
    const hasMathChanged = sideboxForm.mathDefinition !== origMath;
    const hasNotesChanged = sideboxForm.notes !== origNotes;
    const hasExprChanged = selectedItem.isCustom && sideboxForm.expression !== origExpr;

    return hasBusChanged || hasMathChanged || hasNotesChanged || hasExprChanged;
  }, [selectedItem, sideboxForm]);

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

        // Keep or select first item for split view
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

  // Handle Item Selection with Unsaved Changes Guard
  function handleSelectItem(item: ItemRecord) {
    if (selectedItem && selectedItem.id === item.id) return;
    if (isSideboxDirty) {
      setPendingSelection(item);
      setShowUnsavedModal(true);
    } else {
      setSelectedItem(item);
    }
  }

  // Discard changes and proceed
  function handleDiscardAndProceed() {
    if (pendingSelection) {
      setSelectedItem(pendingSelection);
      setPendingSelection(null);
    }
    setShowUnsavedModal(false);
  }

  // Save Split inspector changes directly
  async function handleSaveSidebox() {
    if (!selectedItem) return;
    setIsSavingSidebox(true);
    setSideboxSaveSuccess(false);

    try {
      if (selectedItem.isCustom) {
        const res = await fetch("/api/powerbi/dax", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "save_custom",
            id: selectedItem.id,
            datasetId: selectedItem.modelCode,
            tableName: selectedItem.tableName,
            name: selectedItem.name,
            expression: sideboxForm.expression,
            dataType: selectedItem.dataType,
            mathDefinition: sideboxForm.mathDefinition,
            businessDefinition: sideboxForm.businessDefinition,
            notes: sideboxForm.notes,
            user: "Authorized User",
          }),
        });
        if (!res.ok) throw new Error("Failed to save custom DAX");
      } else {
        const res = await fetch("/api/powerbi/dax", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "save_annotation",
            id: selectedItem.id,
            modelCode: selectedItem.modelCode,
            tableName: selectedItem.tableName,
            objectName: selectedItem.name,
            objectType: selectedItem.type,
            mathDefinition: sideboxForm.mathDefinition,
            businessDefinition: sideboxForm.businessDefinition,
            notes: sideboxForm.notes,
            changedBy: "Authorized User",
          }),
        });
        if (!res.ok) throw new Error("Failed to save definitions");
      }

      // Update state in memory
      setItems((prev) =>
        prev.map((it) =>
          it.id === selectedItem.id
            ? {
                ...it,
                businessDefinition: sideboxForm.businessDefinition,
                mathDefinition: sideboxForm.mathDefinition,
                notes: sideboxForm.notes,
                expression: selectedItem.isCustom ? sideboxForm.expression : it.expression,
              }
            : it
        )
      );

      setSelectedItem((prev) =>
        prev
          ? {
              ...prev,
              businessDefinition: sideboxForm.businessDefinition,
              mathDefinition: sideboxForm.mathDefinition,
              notes: sideboxForm.notes,
              expression: selectedItem.isCustom ? sideboxForm.expression : prev.expression,
            }
          : null
      );

      setSideboxSaveSuccess(true);
      setTimeout(() => setSideboxSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error("Save error:", err);
      alert("Error saving definitions: " + (err.message || "Unknown error"));
    } finally {
      setIsSavingSidebox(false);
    }
  }

  // Open Interactive Diagram Modal with Deep AST Parsing
  function handleOpenDiagram(item: ItemRecord) {
    setDiagramTarget(item);
    const parsed = parseDaxToProgrammingAst(item.name, item.expression, item.tableName);
    setDiagramNodes(parsed);
    setSelectedNodeId(parsed[0]?.id || null);
    setDiagramZoom(1);
    setConnectingSourceId(null);
    setDiagramSaveSuccess(false);
    setDiagramModalOpen(true);
  }

  // Dragging logic for Diagram nodes
  function handleNodeMouseDown(e: React.MouseEvent, nodeId: string) {
    e.stopPropagation();
    const node = diagramNodes.find((n) => n.id === nodeId);
    if (!node || !canvasRef.current) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    setDraggingNodeId(nodeId);
    setSelectedNodeId(nodeId);
    setDragOffset({
      x: (e.clientX - canvasRect.left) / diagramZoom - node.x,
      y: (e.clientY - canvasRect.top) / diagramZoom - node.y,
    });
  }

  function handleCanvasMouseMove(e: React.MouseEvent) {
    if (!draggingNodeId || !canvasRef.current) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const newX = Math.max(10, Math.round((e.clientX - canvasRect.left) / diagramZoom - dragOffset.x));
    const newY = Math.max(10, Math.round((e.clientY - canvasRect.top) / diagramZoom - dragOffset.y));

    setDiagramNodes((prev) =>
      prev.map((n) => (n.id === draggingNodeId ? { ...n, x: newX, y: newY } : n))
    );
  }

  function handleCanvasMouseUp() {
    setDraggingNodeId(null);
  }

  // TOOLBOX: Add specific programming node types
  function handleAddToolboxNode(type: "source" | "measure_call" | "filter" | "switch" | "calculation" | "output") {
    const newId = `node_${type}_${Date.now().toString().slice(-4)}`;
    const defaultConfigs: Record<string, { title: string; role: string; detail: string }> = {
      source: { title: "'fact_table'", role: "Source Table / Column", detail: "Scans records for computation" },
      measure_call: { title: "[_called_measure]", role: "Measure Dependency", detail: "Calls external metric" },
      filter: { title: "NOT IN / FILTER", role: "Exclude / Predicate", detail: "Filters rows or applies boolean condition" },
      switch: { title: "SWITCH Case", role: "Conditional Branch", detail: "Evaluates branch condition" },
      calculation: { title: "AGGREGATE / CALCULATE", role: "Context Evaluator", detail: "Applies transformation & math logic" },
      output: { title: "[Target_Result]", role: "Output Metric", detail: "Final computed result" },
    };

    const config = defaultConfigs[type] || defaultConfigs.calculation;
    const newNode: DiagramNode = {
      id: newId,
      title: config.title,
      category: type,
      role: config.role,
      detail: config.detail,
      x: 380,
      y: 160,
      connections: [],
    };

    setDiagramNodes((prev) => [...prev, newNode]);
    setSelectedNodeId(newId);
  }

  // Handle Connecting Nodes (Port to Port wiring)
  function handleToggleConnect(nodeId: string) {
    if (!connectingSourceId) {
      setConnectingSourceId(nodeId);
    } else if (connectingSourceId === nodeId) {
      setConnectingSourceId(null);
    } else {
      // Connect connectingSourceId -> nodeId
      setDiagramNodes((prev) =>
        prev.map((n) => {
          if (n.id === connectingSourceId) {
            const current = n.connections || [];
            if (!current.includes(nodeId)) {
              return { ...n, connections: [...current, nodeId] };
            }
          }
          return n;
        })
      );
      setConnectingSourceId(null);
    }
  }

  // Save Diagram to Database
  async function handleSaveDiagram() {
    if (!diagramTarget) return;
    try {
      const diagramPayload = JSON.stringify(diagramNodes);
      await fetch("/api/powerbi/dax", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_annotation",
          id: diagramTarget.id,
          modelCode: diagramTarget.modelCode,
          tableName: diagramTarget.tableName,
          objectName: diagramTarget.name,
          objectType: diagramTarget.type,
          notes: `DIAGRAM_LAYOUT:${diagramPayload}`,
          changedBy: "Diagram Editor",
        }),
      });
      setDiagramSaveSuccess(true);
      setTimeout(() => setDiagramSaveSuccess(false), 2500);
    } catch (err) {
      console.error("Save diagram error:", err);
    }
  }

  function handleResetDiagramLayout() {
    if (!diagramTarget) return;
    const parsed = parseDaxToProgrammingAst(diagramTarget.name, diagramTarget.expression, diagramTarget.tableName);
    setDiagramNodes(parsed);
    setDiagramZoom(1);
    setConnectingSourceId(null);
  }

  // Handle Search Input Change with Table Auto-unlock
  function handleSearchInputChange(val: string) {
    setSearchQuery(val);
    if (val.trim() && selectedTable !== "all") {
      setSelectedTable("all");
    }
  }

  // Handle Fetching Column Samples (limit 5-10)
  async function handleFetchColumnSamples(item: ItemRecord) {
    setLoadingSamplesId(item.id);
    setSampleErrorMap((prev) => {
      const copy = { ...prev };
      delete copy[item.id];
      return copy;
    });

    try {
      const res = await fetch("/api/powerbi/dax", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "fetch_column_samples",
          datasetId: item.modelCode,
          tableName: item.tableName,
          columnName: item.name,
          itemId: item.id,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setSampleValuesMap((prev) => ({
          ...prev,
          [item.id]: json.values || [],
        }));
      } else {
        setSampleErrorMap((prev) => ({
          ...prev,
          [item.id]: json.error || "Sampling unsupported for this column.",
        }));
      }
    } catch (err: any) {
      setSampleErrorMap((prev) => ({
        ...prev,
        [item.id]: "Failed to connect to Power BI REST API",
      }));
    } finally {
      setLoadingSamplesId(null);
    }
  }

  function copyText(id: string, text: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  // Custom DAX handlers
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
      setCustomTable(selectedTable !== "all" ? selectedTable : (meta.tables?.[0] || "fact_patient_visit"));
      setCustomDataType("Decimal");
      setCustomExpression("");
      setCustomMath("");
      setCustomBusiness("");
      setCustomNotes("");
    }
    setCustomError(null);
    setCustomDaxModalOpen(true);
  }

  async function handleSaveCustomDax(e: React.FormEvent) {
    e.preventDefault();
    if (!customName.trim() || !customExpression.trim()) {
      setCustomError("Measure Name and DAX Expression are required.");
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
          datasetId: activeModel,
          tableName: customTable.trim(),
          name: customName.trim(),
          expression: customExpression.trim(),
          dataType: customDataType,
          mathDefinition: customMath.trim(),
          businessDefinition: customBusiness.trim(),
          notes: customNotes.trim(),
          user: "Current User",
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save custom DAX");

      setCustomDaxModalOpen(false);
      await fetchItems();
    } catch (err: any) {
      setCustomError(err.message || "Failed to save custom DAX");
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
        body: JSON.stringify({ action: "delete_custom", id, user: "Current User" }),
      });
      if (res.ok) {
        await fetchItems();
      }
    } catch (err) {
      console.error("Delete error:", err);
    }
  }

  const currentModelMeta = models.find((m) => m.code === activeModel) || models[0];

  const filteredTables = useMemo(() => {
    if (!meta.tables) return [];
    if (!tableSearchQuery.trim()) return meta.tables;
    return meta.tables.filter((t: string) =>
      t.toLowerCase().includes(tableSearchQuery.toLowerCase())
    );
  }, [meta.tables, tableSearchQuery]);

  return (
    <div className="h-full w-full overflow-hidden flex flex-col gap-3 font-sans select-none">
      {/* 1. TOP CONTROL BAR (Views & Global Controls - Console removed as requested) */}
      <div className="shrink-0 bg-white rounded-3xl p-3 px-4 shadow-xs border border-slate-200/80 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            style={{
              backgroundColor: currentTheme.primaryLight,
              color: currentTheme.primary,
            }}
            className="grid h-9 w-9 place-items-center rounded-2xl shadow-xs shrink-0"
          >
            <FunctionSquare className="h-4.5 w-4.5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-slate-900 tracking-tight">
                DAX & Semantic Model Intelligence
              </h1>
              <span className="px-2 py-0.2 rounded-full bg-blue-50 text-blue-700 text-[10px] font-extrabold uppercase border border-blue-200">
                Live Supabase + REST API
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Synced to Supabase DB &bull; Active: {currentModelMeta.name}
            </p>
          </div>
        </div>

        {/* View Switcher: Table | Split (was Sidebox) | List (was Split) & Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Add Custom DAX Button */}
          <button
            type="button"
            onClick={() => openCustomDaxModal()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
            <span>Add Custom DAX</span>
          </button>

          {/* Floating Sidebar Toggle Button */}
          <button
            type="button"
            onClick={() => setFloatSidebarOpen(!floatSidebarOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
          >
            <Layers className="h-3.5 w-3.5 text-blue-600" />
            <span>{floatSidebarOpen ? "Hide Datasets" : "Show Datasets"}</span>
          </button>

          {/* View Modes (Table | Split | List) */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-full text-xs">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              title="Table View (Full Grid)"
              className={clsx(
                "flex items-center gap-1 px-3 py-1 rounded-full font-bold transition cursor-pointer",
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
              onClick={() => setViewMode("split")}
              title="Split View (List + Editable Inspector)"
              className={clsx(
                "flex items-center gap-1 px-3 py-1 rounded-full font-bold transition cursor-pointer",
                viewMode === "split"
                  ? "bg-white text-blue-600 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <SplitIcon className="h-3.5 w-3.5" />
              <span>Split</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              title="List View (Full Stacked Cards)"
              className={clsx(
                "flex items-center gap-1 px-3 py-1 rounded-full font-bold transition cursor-pointer",
                viewMode === "list"
                  ? "bg-white text-blue-600 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <ListIcon className="h-3.5 w-3.5" />
              <span>List</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. BODY CONTENT */}
      <div className="flex-1 min-h-0 flex gap-3 overflow-hidden relative">
        {/* FLOAT DATASET SIDEBAR */}
        {floatSidebarOpen && (
          <aside className="w-60 lg:w-64 shrink-0 bg-white rounded-3xl p-3 shadow-xs border border-slate-200/80 flex flex-col gap-3 overflow-hidden z-20">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-bold text-slate-800">
                  Semantic Models ({models.length})
                </span>
              </div>
              <button
                type="button"
                onClick={() => fetchItems()}
                title="Reload Models"
                className="text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <RefreshCw className={clsx("h-3.5 w-3.5", loading && "animate-spin")} />
              </button>
            </div>

            {/* Model Selector Cards */}
            <div className="space-y-1.5">
              {models.map((m) => {
                const isActive = activeModel === m.code;
                return (
                  <div
                    key={m.code}
                    onClick={() => {
                      if (isSideboxDirty) {
                        alert("Please save or discard your changes in Split view before switching models.");
                        return;
                      }
                      setActiveModel(m.code);
                      setSelectedTable("all");
                    }}
                    className={clsx(
                      "p-2.5 rounded-2xl border transition cursor-pointer flex flex-col gap-1 text-left",
                      isActive
                        ? "border-blue-600 bg-blue-50/70 shadow-xs ring-2 ring-blue-500/20"
                        : "border-slate-200/80 hover:border-slate-300 bg-slate-50/50"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="inline-block px-1.5 py-0.2 rounded-full text-[9px] font-extrabold uppercase bg-blue-600 text-white">
                        {m.code}
                      </span>
                      <span className="text-[9px] text-slate-400 font-mono">
                        ID: {m.id.slice(0, 8)}...
                      </span>
                    </div>
                    <h3 className="text-xs font-bold text-slate-900 leading-snug line-clamp-1">
                      {m.name}
                    </h3>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-200/50">
                      <span className="text-blue-700 font-semibold">{m.totalMeasures} Measures</span>
                      <span>{m.totalColumns} Columns</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Table Filter List with Dedicated Search */}
            <div className="flex-1 min-h-0 flex flex-col gap-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Tables in Model</span>
                <span className="text-[10px] text-slate-400">
                  {meta.tables?.length || 0} Total
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
                  className="w-full pl-7 pr-3 py-1 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
                />
              </div>

              <div className="flex-1 overflow-y-auto space-y-0.5 pr-1">
                <button
                  type="button"
                  onClick={() => setSelectedTable("all")}
                  className={clsx(
                    "w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition text-left cursor-pointer",
                    selectedTable === "all"
                      ? "bg-slate-900 text-white font-bold"
                      : "text-slate-600 hover:bg-slate-100"
                  )}
                >
                  <span className="truncate">All Tables</span>
                  <span className="text-[10px] opacity-75">{meta.total}</span>
                </button>
                {filteredTables.map((t: string) => {
                  const isSel = selectedTable === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSelectedTable(t)}
                      className={clsx(
                        "w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-mono transition text-left truncate cursor-pointer",
                        isSel
                          ? "bg-blue-600 text-white font-bold"
                          : "text-slate-600 hover:bg-slate-100"
                      )}
                    >
                      <span className="truncate">{t}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="shrink-0 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
              <span>Source: Azure Entra ID</span>
              <span className="text-emerald-600 font-bold">&bull; 200 OK</span>
            </div>
          </aside>
        )}

        {/* MAIN PANEL CONTENT */}
        <main className="flex-1 min-w-0 bg-white rounded-3xl p-3.5 shadow-xs border border-slate-200/80 flex flex-col gap-3 overflow-hidden">
          {/* BULLET FILTERS ROW (POSITIONED DIRECTLY UNDER VIEWS AS REQUESTED) */}
          <div className="shrink-0 flex items-center justify-between gap-2 flex-wrap border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: "all", label: "All Items", count: meta.total, dotColor: "bg-slate-400" },
                { id: "semantic", label: "Semantic Model", count: meta.totalSemantic || (meta.totalMeasures + meta.totalColumns), dotColor: "bg-sky-500" },
                { id: "custom", label: "Custom by User", count: meta.totalCustom || 0, dotColor: "bg-purple-500" },
                { id: "measure", label: "Measures Only", count: meta.totalMeasures, dotColor: "bg-blue-500" },
                { id: "column", label: "Columns Only", count: meta.totalColumns, dotColor: "bg-emerald-500" },
                { id: "calculated_column", label: "Calculated Columns", count: null, dotColor: "bg-amber-500" },
              ].map((pill) => {
                const isSelected = selectedType === pill.id;
                return (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setSelectedType(pill.id)}
                    className={clsx(
                      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition shadow-xs cursor-pointer select-none",
                      isSelected
                        ? "bg-blue-600 text-white shadow-blue-500/25 ring-2 ring-blue-500/30"
                        : "bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200/70"
                    )}
                  >
                    <span
                      className={clsx(
                        "h-2 w-2 rounded-full shrink-0",
                        isSelected ? "bg-white ring-2 ring-white/40" : pill.dotColor
                      )}
                    />
                    <span>{pill.label}</span>
                    {pill.count !== null && (
                      <span
                        className={clsx(
                          "px-1.5 py-0.2 rounded-full text-[10px] font-extrabold font-mono",
                          isSelected ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"
                        )}
                      >
                        {pill.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Results Counter */}
            <span className="text-[11px] font-medium text-slate-500">
              Showing <span className="font-bold text-slate-900">{items.length}</span> of {meta.total} results
            </span>
          </div>

          {/* SEARCH & QUICK TABLE BAR */}
          <div className="shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            {/* Search Input with Mode Toggle */}
            <div className="relative flex-1 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchInputChange(e.target.value)}
                  placeholder="Instant search by name, table, formula, or business meaning..."
                  className="w-full pl-9 pr-8 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => handleSearchInputChange("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Partial vs Exact Toggle */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-full text-[11px] shrink-0">
                <button
                  type="button"
                  onClick={() => setSearchMode("partial")}
                  className={clsx(
                    "px-2.5 py-0.5 rounded-full font-bold transition cursor-pointer",
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
                    "px-2.5 py-0.5 rounded-full font-bold transition cursor-pointer",
                    searchMode === "exact"
                      ? "bg-white text-blue-600 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  Exact
                </button>
              </div>
            </div>

            {/* Quick Table Search Dropdown */}
            <div className="w-52 shrink-0">
              <TableSearchDropdown
                tables={meta.tables || []}
                value={selectedTable}
                onChange={(t) => setSelectedTable(t)}
                allowAll={true}
              />
            </div>
          </div>

          {/* Scope Indicator Line */}
          <div className="shrink-0 flex items-center justify-between text-xs text-slate-500 pb-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span>Scope:</span>
              <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.2 rounded-full text-[11px]">
                {activeModel} &bull; {selectedTable === "all" ? "All Tables" : selectedTable}
              </span>
              {searchQuery && (
                <span className="text-[10px] text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.2 rounded-full font-semibold">
                  Search: "{searchQuery}" ({searchMode}) &bull; Ranked by Relevance
                </span>
              )}
            </div>
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
                      <th className="py-2 px-3">Origin & Type</th>
                      <th className="py-2 px-3">Name</th>
                      <th className="py-2 px-3">Table</th>
                      <th className="py-2 px-3">Data Type</th>
                      <th className="py-2 px-3">Definitions</th>
                      <th className="py-2 px-3">Formula / Samples</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((it) => (
                      <tr
                        key={it.id}
                        className="hover:bg-blue-50/30 transition group"
                      >
                        <td className="py-2 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {it.isCustom ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-extrabold uppercase bg-purple-100 text-purple-800 border border-purple-200">
                                <User className="h-2.5 w-2.5" />
                                <span>Custom</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-extrabold uppercase bg-sky-100 text-sky-800 border border-sky-200">
                                <Database className="h-2.5 w-2.5" />
                                <span>Semantic</span>
                              </span>
                            )}

                            <span
                              className={clsx(
                                "px-1.5 py-0.2 rounded-full text-[9px] font-bold uppercase",
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
                        <td className="py-2 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                          <div>
                            <HighlightText
                              text={it.name}
                              match={searchQuery}
                              active={Boolean(searchQuery.trim())}
                            />
                            {it.matchReason && it.matchReason !== "Exact Name Match" && it.matchReason !== "Name Match" && it.matchReason !== "Name Prefix Match" && (
                              <span className="block text-[9px] text-blue-600 font-sans font-normal mt-0.5">
                                &bull; {it.matchReason}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                          <HighlightText
                            text={it.tableName}
                            match={searchQuery}
                            active={Boolean(searchQuery.trim())}
                          />
                        </td>
                        <td className="py-2 px-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                          {it.dataType}
                        </td>
                        <td className="py-2 px-3 max-w-[200px]">
                          {it.businessDefinition ? (
                            <p className="truncate text-slate-700" title={it.businessDefinition}>
                              {it.businessDefinition}
                            </p>
                          ) : it.mathDefinition ? (
                            <p className="truncate font-mono text-purple-800 text-[11px]" title={it.mathDefinition}>
                              {it.mathDefinition}
                            </p>
                          ) : (
                            <span className="text-slate-300 italic text-[11px]">None defined</span>
                          )}
                        </td>
                        <td className="py-2 px-3 max-w-[240px] font-mono text-[11px]">
                          {it.type === "Measure" || it.type.includes("Calculated") ? (
                            <span className="truncate block text-slate-600" title={it.expression || ""}>
                              {it.expression || "No formula"}
                            </span>
                          ) : (
                            <div className="flex items-center gap-1 flex-wrap">
                              {sampleValuesMap[it.id] && sampleValuesMap[it.id].length > 0 ? (
                                sampleValuesMap[it.id].slice(0, 3).map((val, idx) => (
                                  <span
                                    key={idx}
                                    className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 text-[10px] font-mono"
                                  >
                                    {String(val)}
                                  </span>
                                ))
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleFetchColumnSamples(it)}
                                  disabled={loadingSamplesId === it.id}
                                  className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                                >
                                  {loadingSamplesId === it.id ? (
                                    <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                                  ) : (
                                    <Sparkles className="h-2.5 w-2.5" />
                                  )}
                                  <span>Sample</span>
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          {it.isHidden ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                              <EyeOff className="h-3 w-3" /> Hidden
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600">
                              <Eye className="h-3 w-3" /> Visible
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {it.type === "Measure" && (
                              <button
                                type="button"
                                onClick={() => handleOpenDiagram(it)}
                                title="View Calculation Diagram"
                                className="p-1 rounded-lg text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
                              >
                                <Workflow className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {it.expression && (
                              <button
                                type="button"
                                onClick={() => copyText(it.id, it.expression!)}
                                title="Copy Formula"
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
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
                              onClick={() => {
                                handleSelectItem(it);
                                setViewMode("split");
                              }}
                              title="Edit in Split View"
                              className="p-1 rounded-lg text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : viewMode === "split" ? (
              /* ================= 2. SPLIT VIEW (WAS SIDEBOX) ================= */
              <div className="h-full flex gap-3 overflow-hidden">
                {/* Left List of Items */}
                <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                  {items.map((it) => {
                    const isSelected = selectedItem?.id === it.id;
                    return (
                      <div
                        key={it.id}
                        onClick={() => handleSelectItem(it)}
                        className={clsx(
                          "p-2.5 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-2.5",
                          isSelected
                            ? "border-blue-600 bg-blue-50/60 shadow-xs ring-2 ring-blue-500/20"
                            : "border-slate-200/80 hover:border-slate-300 bg-white"
                        )}
                      >
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {it.isCustom ? (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-extrabold uppercase bg-purple-100 text-purple-800 border border-purple-200">
                                <User className="h-2 w-2" />
                                <span>Custom</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-extrabold uppercase bg-sky-100 text-sky-800 border border-sky-200">
                                <Database className="h-2 w-2" />
                                <span>Semantic</span>
                              </span>
                            )}

                            <span
                              className={clsx(
                                "px-1.5 py-0.2 rounded-full text-[9px] font-bold uppercase",
                                it.type === "Measure"
                                  ? "bg-blue-50 text-blue-700"
                                  : "bg-emerald-50 text-emerald-700"
                              )}
                            >
                              {it.type}
                            </span>

                            <h4 className="font-mono text-xs font-bold text-slate-900 break-words leading-tight">
                              <HighlightText
                                text={it.name}
                                match={searchQuery}
                                active={Boolean(searchQuery.trim())}
                              />
                            </h4>
                          </div>

                          <p className="text-[11px] text-slate-500 font-mono truncate">
                            Table: <span className="font-semibold text-slate-700">{it.tableName}</span> &bull; {it.dataType}
                            {it.matchReason && it.matchReason !== "Exact Name Match" && it.matchReason !== "Name Match" && it.matchReason !== "Name Prefix Match" && (
                              <span className="ml-2 text-blue-600 font-sans font-medium">
                                ({it.matchReason})
                              </span>
                            )}
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

                {/* Right Compact Inspector Pane (COMPACT & CLEAN AS REQUESTED) */}
                {selectedItem ? (
                  <div className="w-80 lg:w-92 shrink-0 h-full border border-slate-200/80 rounded-2xl p-3.5 bg-slate-50/50 flex flex-col justify-between overflow-y-auto">
                    <div className="space-y-3">
                      {/* Header with Save Changes & Diagram Button */}
                      <div className="flex items-start justify-between pb-2 border-b border-slate-200 gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                            {selectedItem.isCustom ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-extrabold uppercase bg-purple-100 text-purple-800 border border-purple-200">
                                <User className="h-2 w-2" />
                                <span>Custom</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-extrabold uppercase bg-sky-100 text-sky-800 border border-sky-200">
                                <Database className="h-2 w-2" />
                                <span>Semantic</span>
                              </span>
                            )}
                            <span className="text-[9px] font-bold text-slate-600 uppercase bg-slate-200/70 px-1.5 py-0.2 rounded-full">
                              {selectedItem.type}
                            </span>
                          </div>
                          {/* COMPACT CLEAN TITLE: break-words rather than break-all */}
                          <h3 className="font-mono text-sm font-bold text-slate-900 break-words leading-tight">
                            {selectedItem.name}
                          </h3>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Formula Diagram Button */}
                          {selectedItem.type === "Measure" && (
                            <button
                              type="button"
                              onClick={() => handleOpenDiagram(selectedItem)}
                              title="View Flow Diagram"
                              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition cursor-pointer"
                            >
                              <Workflow className="h-3 w-3" />
                              <span>Diagram</span>
                            </button>
                          )}

                          {/* Save Changes Button */}
                          <button
                            type="button"
                            onClick={handleSaveSidebox}
                            disabled={isSavingSidebox || !isSideboxDirty}
                            className={clsx(
                              "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition shadow-xs cursor-pointer",
                              isSideboxDirty
                                ? "bg-blue-600 text-white hover:bg-blue-700 ring-2 ring-blue-400/40"
                                : "bg-slate-200 text-slate-400 cursor-not-allowed"
                            )}
                          >
                            {isSavingSidebox ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : (
                              <Save className="h-3 w-3" />
                            )}
                            <span>Save</span>
                          </button>
                        </div>
                      </div>

                      {/* Save Success Banner */}
                      {sideboxSaveSuccess && (
                        <div className="p-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          <span>Saved successfully to Supabase!</span>
                        </div>
                      )}

                      {/* Unsaved indicator badge */}
                      {isSideboxDirty && (
                        <div className="p-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-semibold flex items-center justify-between">
                          <span>Unsaved edits</span>
                          <span className="text-amber-600 underline cursor-pointer font-bold" onClick={handleSaveSidebox}>
                            Save
                          </span>
                        </div>
                      )}

                      {/* Compact Metadata Grid */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 rounded-xl bg-white border border-slate-200/70">
                          <span className="text-[9px] text-slate-400 font-bold block uppercase">Table</span>
                          <span className="font-mono font-bold text-slate-800 truncate block text-[11px]">
                            {selectedItem.tableName}
                          </span>
                        </div>
                        <div className="p-2 rounded-xl bg-white border border-slate-200/70">
                          <span className="text-[9px] text-slate-400 font-bold block uppercase">Data Type</span>
                          <span className="font-mono font-bold text-slate-800 truncate block text-[11px]">
                            {selectedItem.dataType}
                          </span>
                        </div>
                      </div>

                      {/* Live Column Samples Section */}
                      {selectedItem.type.includes("Column") && (
                        <div className="space-y-1.5 p-2.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              <Zap className="h-3 w-3 text-blue-600" />
                              <span className="text-[10px] font-bold text-slate-800 uppercase tracking-wide">
                                Samples (5-10)
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleFetchColumnSamples(selectedItem)}
                              disabled={loadingSamplesId === selectedItem.id}
                              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition disabled:opacity-50 cursor-pointer"
                            >
                              {loadingSamplesId === selectedItem.id ? (
                                <RefreshCw className="h-2 w-2 animate-spin" />
                              ) : (
                                <Sparkles className="h-2 w-2" />
                              )}
                              <span>{loadingSamplesId === selectedItem.id ? "Querying..." : "Fetch"}</span>
                            </button>
                          </div>

                          {sampleValuesMap[selectedItem.id] && sampleValuesMap[selectedItem.id].length > 0 ? (
                            <div className="space-y-1">
                              <div className="flex flex-wrap gap-1">
                                {sampleValuesMap[selectedItem.id].slice(0, 10).map((val, idx) => (
                                  <span
                                    key={idx}
                                    className="px-1.5 py-0.2 rounded bg-slate-100 border border-slate-200 text-slate-800 text-[10px] font-mono"
                                  >
                                    {String(val)}
                                  </span>
                                ))}
                              </div>
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded-full border border-emerald-200">
                                <Check className="h-2 w-2" /> In Supabase
                              </span>
                            </div>
                          ) : sampleErrorMap[selectedItem.id] ? (
                            <p className="text-[10px] text-amber-700 bg-amber-50 p-1.5 rounded-xl border border-amber-200 leading-tight">
                              {sampleErrorMap[selectedItem.id]}
                            </p>
                          ) : (
                            <p className="text-[10px] text-slate-400 leading-tight">
                              Click "Fetch" to query distinct samples from Power BI and persist to Supabase.
                            </p>
                          )}
                        </div>
                      )}

                      {/* Business Definition (Compact Textarea) */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block">
                          Business Definition / Meaning
                        </label>
                        <textarea
                          rows={2}
                          value={sideboxForm.businessDefinition}
                          onChange={(e) =>
                            setSideboxForm({ ...sideboxForm, businessDefinition: e.target.value })
                          }
                          placeholder="Business rationale, definition..."
                          className="w-full p-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 transition resize-y font-sans leading-tight shadow-2xs"
                        />
                      </div>

                      {/* Mathematical Formulation (Compact Textarea) */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block">
                          Mathematical Formulation
                        </label>
                        <textarea
                          rows={2}
                          value={sideboxForm.mathDefinition}
                          onChange={(e) =>
                            setSideboxForm({ ...sideboxForm, mathDefinition: e.target.value })
                          }
                          placeholder="Formula notation (e.g. SUM(A)/COUNT(B))..."
                          className="w-full p-2 rounded-xl bg-white border border-slate-200 text-xs font-mono text-purple-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-500 transition resize-y leading-tight shadow-2xs"
                        />
                      </div>

                      {/* Technical Notes (Compact Textarea) */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block">
                          Technical Notes
                        </label>
                        <textarea
                          rows={2}
                          value={sideboxForm.notes}
                          onChange={(e) =>
                            setSideboxForm({ ...sideboxForm, notes: e.target.value })
                          }
                          placeholder="Filter context notes, dependencies..."
                          className="w-full p-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 transition resize-y leading-tight shadow-2xs"
                        />
                      </div>

                      {/* DAX Formula */}
                      {selectedItem.isCustom ? (
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-purple-800 uppercase tracking-wider block">
                            Custom DAX Expression
                          </label>
                          <textarea
                            rows={3}
                            value={sideboxForm.expression}
                            onChange={(e) =>
                              setSideboxForm({ ...sideboxForm, expression: e.target.value })
                            }
                            className="w-full p-2 rounded-xl bg-slate-900 text-emerald-400 font-mono text-xs border border-slate-800 focus:outline-none resize-y"
                          />
                        </div>
                      ) : selectedItem.expression ? (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <h5 className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                              DAX Expression
                            </h5>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenDiagram(selectedItem)}
                                className="text-[9px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-0.5 cursor-pointer"
                              >
                                <Workflow className="h-2.5 w-2.5" />
                                <span>Diagram</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => copyText(selectedItem.id, selectedItem.expression!)}
                                className="text-[9px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 cursor-pointer"
                              >
                                {copiedId === selectedItem.id ? (
                                  <>
                                    <Check className="h-2.5 w-2.5 text-emerald-600" />
                                    <span className="text-emerald-700">Copied!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-2.5 w-2.5" />
                                    <span>Copy</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                          <div className="p-2.5 rounded-xl bg-slate-900 text-emerald-400 font-mono text-[11px] overflow-x-auto border border-slate-800 shadow-inner max-h-36">
                            <pre className="whitespace-pre-wrap">{selectedItem.expression}</pre>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    {selectedItem.isCustom && (
                      <div className="pt-2 border-t border-slate-200 mt-3 flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomDax(selectedItem.id)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 transition cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span>Delete Custom DAX</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-80 lg:w-92 shrink-0 h-full border border-dashed border-slate-200 rounded-2xl flex items-center justify-center text-xs text-slate-400">
                    Select an item to view inspector details
                  </div>
                )}
              </div>
            ) : (
              /* ================= 3. LIST VIEW (WAS SPLIT) ================= */
              <div className="h-full overflow-y-auto pr-1 space-y-2.5">
                {items.map((it) => (
                  <div
                    key={it.id}
                    className="p-3.5 rounded-2xl border border-slate-200/80 hover:border-slate-300 hover:shadow-xs transition bg-slate-50/30 space-y-2"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {it.isCustom ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[9px] font-extrabold uppercase bg-purple-100 text-purple-800 border border-purple-200">
                            <User className="h-2 w-2" />
                            <span>Custom</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[9px] font-extrabold uppercase bg-sky-100 text-sky-800 border border-sky-200">
                            <Database className="h-2 w-2" />
                            <span>Semantic</span>
                          </span>
                        )}

                        <span
                          className={clsx(
                            "px-2 py-0.2 rounded-full text-[9px] font-bold uppercase",
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

                        <span className="text-slate-400 text-xs font-mono">&bull;</span>
                        <span className="text-slate-500 font-mono text-xs">{it.tableName}</span>
                        <span className="text-slate-400 text-xs font-mono">&bull;</span>
                        <span className="text-slate-500 font-mono text-xs">{it.dataType}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {it.type === "Measure" && (
                          <button
                            type="button"
                            onClick={() => handleOpenDiagram(it)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition cursor-pointer"
                          >
                            <Workflow className="h-3 w-3" />
                            <span>Diagram</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            handleSelectItem(it);
                            setViewMode("split");
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 transition cursor-pointer"
                        >
                          <Pencil className="h-3 w-3" />
                          <span>Edit</span>
                        </button>
                      </div>
                    </div>

                    {it.businessDefinition && (
                      <div className="p-2 rounded-xl bg-white border border-slate-200/80 text-xs text-slate-700">
                        <span className="font-bold text-slate-400 text-[9px] uppercase block mb-0.5">
                          Business Meaning
                        </span>
                        {it.businessDefinition}
                      </div>
                    )}

                    {it.expression && (
                      <div className="p-2.5 rounded-xl bg-slate-900 text-emerald-400 font-mono text-xs border border-slate-800 overflow-x-auto shadow-inner">
                        <pre className="whitespace-pre-wrap">{it.expression}</pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ================= UNSAVED CHANGES MODAL ================= */}
      {showUnsavedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 flex flex-col gap-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-amber-100 text-amber-700 grid place-items-center shrink-0">
                <HelpCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Unsaved Changes</h3>
                <p className="text-xs text-slate-500">
                  You have unsaved edits on{" "}
                  <span className="font-mono font-bold text-slate-800">
                    {selectedItem?.name}
                  </span>
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              If you switch now, your modifications will be discarded. Would you like to discard them or stay and save?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowUnsavedModal(false)}
                className="px-4 py-2 rounded-full text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={handleDiscardAndProceed}
                className="px-4 py-2 rounded-full text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition cursor-pointer"
              >
                Discard & Switch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= PROGRAMMING-GRADE FORMULA DIAGRAM MODAL WITH TOOLBOX & WIRING ================= */}
      {diagramModalOpen && diagramTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 lg:p-6">
          <div className="w-full max-w-7xl h-[92vh] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="shrink-0 p-3.5 px-5 border-b border-slate-200 flex items-center justify-between gap-3 bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-2xl bg-indigo-600 text-white grid place-items-center shadow-xs">
                  <Workflow className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-slate-900">
                      Formula Logic AST:{" "}
                      <span className="font-mono text-indigo-700">[{diagramTarget.name}]</span>
                    </h2>
                    <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-extrabold uppercase">
                      DAX Execution Pipeline
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Dependencies &bull; Exclude/Filters &bull; Switches &bull; Context Transition &bull; Click "Connect" to wire nodes
                  </p>
                </div>
              </div>

              {/* Toolbar */}
              <div className="flex items-center gap-2">
                {/* Save Diagram Success Toast */}
                {diagramSaveSuccess && (
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                    <Check className="h-3 w-3" /> Saved!
                  </span>
                )}

                {/* Connecting Mode Banner */}
                {connectingSourceId && (
                  <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 animate-pulse">
                    Click target node to connect...
                  </span>
                )}

                {/* Zoom Controls */}
                <div className="flex items-center bg-white border border-slate-200 rounded-full px-2 py-0.5 gap-1 text-xs text-slate-600">
                  <button
                    type="button"
                    onClick={() => setDiagramZoom((z) => Math.max(0.5, z - 0.1))}
                    title="Zoom Out"
                    className="p-1 hover:text-slate-900 cursor-pointer"
                  >
                    <ZoomOut className="h-3.5 w-3.5" />
                  </button>
                  <span className="text-[10px] font-mono font-bold w-9 text-center">
                    {Math.round(diagramZoom * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setDiagramZoom((z) => Math.min(1.5, z + 0.1))}
                    title="Zoom In"
                    className="p-1 hover:text-slate-900 cursor-pointer"
                  >
                    <ZoomIn className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Save Diagram Button */}
                <button
                  type="button"
                  onClick={handleSaveDiagram}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition cursor-pointer"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>Save Diagram</span>
                </button>

                {/* Reset Layout */}
                <button
                  type="button"
                  onClick={handleResetDiagramLayout}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 transition cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reset</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDiagramModalOpen(false)}
                  className="h-8 w-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 grid place-items-center transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Formula Expression Code Ribbon */}
            <div className="shrink-0 px-5 py-2 bg-slate-900 text-emerald-400 font-mono text-[11px] overflow-x-auto border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 truncate">
                <span className="text-slate-400 font-bold shrink-0">DAX:</span>
                <span className="truncate">{diagramTarget.expression || "No DAX expression"}</span>
              </div>
              <button
                type="button"
                onClick={() => copyText("diagram_expr", diagramTarget.expression || "")}
                className="text-slate-400 hover:text-white flex items-center gap-1 text-[10px] shrink-0 ml-4 cursor-pointer"
              >
                <Copy className="h-3 w-3" /> Copy
              </button>
            </div>

            {/* Diagram Body: TOOLBOX on left + CANVAS on right */}
            <div className="flex-1 flex overflow-hidden">
              {/* TOOLBOX (Allows adding AST nodes) */}
              <div className="w-56 shrink-0 bg-slate-50 border-r border-slate-200 p-3 flex flex-col gap-2.5 overflow-y-auto">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <Boxes className="h-4 w-4 text-indigo-600" />
                  <span>Node Toolbox</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  Click to add programming elements to the canvas:
                </p>

                <div className="space-y-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => handleAddToolboxNode("measure_call")}
                    className="w-full flex items-center gap-2 p-2 rounded-xl bg-white border border-purple-200 hover:bg-purple-50 text-left text-xs font-medium text-purple-900 transition cursor-pointer shadow-2xs"
                  >
                    <FunctionSquare className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                    <div>
                      <span className="font-bold block text-[11px]">+ Measure Dependency</span>
                      <span className="text-[9px] text-slate-400">e.g. [_hn_count]</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAddToolboxNode("filter")}
                    className="w-full flex items-center gap-2 p-2 rounded-xl bg-white border border-amber-200 hover:bg-amber-50 text-left text-xs font-medium text-amber-900 transition cursor-pointer shadow-2xs"
                  >
                    <Filter className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                    <div>
                      <span className="font-bold block text-[11px]">+ Exclude / Filter</span>
                      <span className="text-[9px] text-slate-400">NOT IN, ISBLANK</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAddToolboxNode("switch")}
                    className="w-full flex items-center gap-2 p-2 rounded-xl bg-white border border-teal-200 hover:bg-teal-50 text-left text-xs font-medium text-teal-900 transition cursor-pointer shadow-2xs"
                  >
                    <GitBranch className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                    <div>
                      <span className="font-bold block text-[11px]">+ Switch Branch</span>
                      <span className="text-[9px] text-slate-400">Condition &rarr; Case</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAddToolboxNode("source")}
                    className="w-full flex items-center gap-2 p-2 rounded-xl bg-white border border-sky-200 hover:bg-sky-50 text-left text-xs font-medium text-sky-900 transition cursor-pointer shadow-2xs"
                  >
                    <Database className="h-3.5 w-3.5 text-sky-600 shrink-0" />
                    <div>
                      <span className="font-bold block text-[11px]">+ Table / Column</span>
                      <span className="text-[9px] text-slate-400">Data source</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAddToolboxNode("calculation")}
                    className="w-full flex items-center gap-2 p-2 rounded-xl bg-white border border-indigo-200 hover:bg-indigo-50 text-left text-xs font-medium text-indigo-900 transition cursor-pointer shadow-2xs"
                  >
                    <Calculator className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                    <div>
                      <span className="font-bold block text-[11px]">+ Calculation Engine</span>
                      <span className="text-[9px] text-slate-400">CALCULATE, SUM</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAddToolboxNode("output")}
                    className="w-full flex items-center gap-2 p-2 rounded-xl bg-white border border-emerald-200 hover:bg-emerald-50 text-left text-xs font-medium text-emerald-900 transition cursor-pointer shadow-2xs"
                  >
                    <Zap className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <div>
                      <span className="font-bold block text-[11px]">+ Output Metric</span>
                      <span className="text-[9px] text-slate-400">Final evaluated result</span>
                    </div>
                  </button>
                </div>

                <div className="pt-2 border-t border-slate-200 mt-auto text-[10px] text-slate-400 space-y-1">
                  <span className="font-bold block text-slate-600">Wiring Tips:</span>
                  <p>&bull; Click <Link className="h-2.5 w-2.5 inline" /> on a node, then click target node to create a line.</p>
                  <p>&bull; Drag nodes across canvas.</p>
                </div>
              </div>

              {/* CANVAS (Draggable 2D Workspace with Dynamic Curved SVG Connectors) */}
              <div
                ref={canvasRef}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                className="flex-1 relative bg-radial from-slate-100 via-slate-50 to-slate-100 overflow-hidden select-none"
                style={{
                  backgroundImage: "radial-gradient(#cbd5e1 1.2px, transparent 1.2px)",
                  backgroundSize: "24px 24px",
                }}
              >
                {/* SVG Connecting Lines with Arrowheads */}
                <svg
                  className="absolute inset-0 w-full h-full pointer-events-none z-10"
                  style={{
                    transform: `scale(${diagramZoom})`,
                    transformOrigin: "top left",
                  }}
                >
                  <defs>
                    <linearGradient id="astLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.85" />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity="0.85" />
                    </linearGradient>
                    <marker
                      id="astArrow"
                      markerWidth="9"
                      markerHeight="7"
                      refX="8"
                      refY="3.5"
                      orient="auto"
                    >
                      <polygon points="0 0, 9 3.5, 0 7" fill="#2563eb" />
                    </marker>
                  </defs>

                  {diagramNodes.map((node) => {
                    return (node.connections || []).map((targetId) => {
                      const target = diagramNodes.find((t) => t.id === targetId);
                      if (!target) return null;

                      const nodeW = 230;
                      const nodeH = 92;

                      // Source output port (right center)
                      const startX = node.x + nodeW;
                      const startY = node.y + nodeH / 2;

                      // Target input port (left center)
                      const endX = target.x;
                      const endY = target.y + nodeH / 2;

                      const deltaX = Math.max(40, Math.abs(endX - startX) * 0.5);
                      const pathData = `M ${startX} ${startY} C ${startX + deltaX} ${startY}, ${endX - deltaX} ${endY}, ${endX} ${endY}`;

                      return (
                        <g key={`${node.id}->${targetId}`}>
                          <path
                            d={pathData}
                            fill="none"
                            stroke="url(#astLineGradient)"
                            strokeWidth="2.5"
                            markerEnd="url(#astArrow)"
                            strokeDasharray="5 3"
                          />
                        </g>
                      );
                    });
                  })}
                </svg>

                {/* Draggable Node Cards */}
                <div
                  className="absolute inset-0"
                  style={{
                    transform: `scale(${diagramZoom})`,
                    transformOrigin: "top left",
                  }}
                >
                  {diagramNodes.map((node) => {
                    const isSelected = selectedNodeId === node.id;
                    const isDragging = draggingNodeId === node.id;
                    const isConnectingSource = connectingSourceId === node.id;

                    const colorStyles =
                      node.category === "source"
                        ? "border-sky-300 bg-sky-50/95 text-sky-900"
                        : node.category === "measure_call"
                        ? "border-purple-300 bg-purple-50/95 text-purple-900 ring-1 ring-purple-400/30"
                        : node.category === "filter"
                        ? "border-amber-300 bg-amber-50/95 text-amber-900 ring-1 ring-amber-400/30"
                        : node.category === "switch"
                        ? "border-teal-300 bg-teal-50/95 text-teal-900"
                        : node.category === "relationship"
                        ? "border-pink-300 bg-pink-50/95 text-pink-900"
                        : node.category === "output"
                        ? "border-emerald-400 bg-emerald-50/95 text-emerald-900 ring-2 ring-emerald-500/20"
                        : "border-indigo-300 bg-indigo-50/95 text-indigo-900";

                    return (
                      <div
                        key={node.id}
                        style={{
                          position: "absolute",
                          left: `${node.x}px`,
                          top: `${node.y}px`,
                          width: "230px",
                          cursor: isDragging ? "grabbing" : "grab",
                          zIndex: isSelected ? 30 : 20,
                        }}
                        onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                        onClick={() => {
                          if (connectingSourceId && connectingSourceId !== node.id) {
                            handleToggleConnect(node.id);
                          } else {
                            setSelectedNodeId(node.id);
                          }
                        }}
                        className={clsx(
                          "rounded-2xl border p-2.5 shadow-md backdrop-blur-xs transition-shadow flex flex-col gap-1 select-none",
                          colorStyles,
                          isSelected && "ring-2 ring-blue-600 shadow-xl",
                          isConnectingSource && "ring-2 ring-amber-500 animate-pulse"
                        )}
                      >
                        {/* Header: Category Badge + Action Buttons (Connect / Move) */}
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded-full bg-white/80 border border-slate-200">
                            {node.category}
                          </span>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleConnect(node.id);
                              }}
                              title={isConnectingSource ? "Cancel Connection" : "Connect to another node"}
                              className={clsx(
                                "p-0.5 rounded text-[10px] transition cursor-pointer",
                                isConnectingSource ? "bg-amber-500 text-white" : "hover:bg-black/10 text-slate-600"
                              )}
                            >
                              <Link className="h-3 w-3" />
                            </button>
                            <Move className="h-3 w-3 opacity-40 shrink-0" />
                          </div>
                        </div>

                        {/* Title */}
                        <h4 className="font-mono text-xs font-bold truncate">
                          {node.title}
                        </h4>

                        {/* Role & Details */}
                        <p className="text-[10px] font-semibold opacity-85 truncate">
                          {node.role}
                        </p>
                        <p className="text-[10px] opacity-75 line-clamp-2 leading-tight">
                          {node.detail}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Selected Node Editor Bar at Bottom */}
            {selectedNodeId && (
              <div className="shrink-0 p-3 px-5 border-t border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 z-30">
                {(() => {
                  const node = diagramNodes.find((n) => n.id === selectedNodeId);
                  if (!node) return null;
                  return (
                    <>
                      <div className="flex items-center gap-2 flex-1 w-full flex-wrap">
                        <span className="text-xs font-bold text-slate-700 shrink-0">
                          Edit Selected Node:
                        </span>
                        <input
                          type="text"
                          value={node.title}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDiagramNodes((prev) =>
                              prev.map((n) => (n.id === node.id ? { ...n, title: val } : n))
                            );
                          }}
                          placeholder="Node Title / Identifier"
                          className="px-2.5 py-1 text-xs rounded-xl bg-slate-50 border border-slate-200 font-mono font-bold text-slate-800 w-44"
                        />
                        <input
                          type="text"
                          value={node.detail}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDiagramNodes((prev) =>
                              prev.map((n) => (n.id === node.id ? { ...n, detail: val } : n))
                            );
                          }}
                          placeholder="Node description / filter logic..."
                          className="flex-1 min-w-[200px] px-2.5 py-1 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-700"
                        />
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {node.connections && node.connections.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setDiagramNodes((prev) =>
                                prev.map((n) => (n.id === node.id ? { ...n, connections: [] } : n))
                              );
                            }}
                            className="px-2.5 py-1 rounded-full text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 transition cursor-pointer"
                          >
                            Disconnect
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setDiagramNodes((prev) => prev.filter((n) => n.id !== node.id));
                            setSelectedNodeId(null);
                          }}
                          className="px-2.5 py-1 rounded-full text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 transition cursor-pointer"
                        >
                          Remove Node
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= CUSTOM DAX MODAL WITH SEARCHABLE TABLE DROPDOWN ================= */}
      {customDaxModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 flex flex-col gap-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-blue-600" />
                <div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-purple-100 text-purple-800 border border-purple-200 block w-fit mb-0.5">
                    CUSTOM DAX AUTHORING
                  </span>
                  <h3 className="text-sm font-bold text-slate-900">
                    {customDaxTarget ? "Edit Custom DAX Measure" : "Create New Custom DAX Measure"}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCustomDaxModalOpen(false)}
                className="h-7 w-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 grid place-items-center transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {customError && (
              <div className="p-2.5 rounded-xl bg-rose-50 text-rose-700 text-xs font-semibold border border-rose-200">
                {customError}
              </div>
            )}

            <form onSubmit={handleSaveCustomDax} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Measure Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="e.g. Average Length of Stay (Days)"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Data Type
                  </label>
                  <select
                    value={customDataType}
                    onChange={(e) => setCustomDataType(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
                  >
                    <option value="Decimal">Decimal</option>
                    <option value="Integer">Integer</option>
                    <option value="String">String</option>
                    <option value="Currency">Currency</option>
                    <option value="Percentage">Percentage</option>
                  </select>
                </div>
              </div>

              {/* Searchable Table Dropdown in Custom DAX Modal */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Home Table Name *
                </label>
                <TableSearchDropdown
                  tables={meta.tables || []}
                  value={customTable}
                  onChange={(t) => setCustomTable(t)}
                  placeholder="Select or search existing table in model..."
                  allowAll={false}
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Select an existing table from the model, or type a custom name.
                </span>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  DAX Formula / Expression *
                </label>
                <textarea
                  required
                  rows={4}
                  value={customExpression}
                  onChange={(e) => setCustomExpression(e.target.value)}
                  placeholder="e.g. DIVIDE(SUM('Fact_Inpatient'[Total_Stay_Hours]), 24, 0)"
                  className="w-full p-3 text-xs rounded-xl bg-slate-900 font-mono text-emerald-400 border border-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-y shadow-inner"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Business Definition
                  </label>
                  <textarea
                    rows={2}
                    value={customBusiness}
                    onChange={(e) => setCustomBusiness(e.target.value)}
                    placeholder="Clinical or operational logic..."
                    className="w-full p-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none shadow-2xs"
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
                    className="w-full p-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 font-mono text-purple-900 focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none shadow-2xs"
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
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCustomDaxModalOpen(false)}
                  className="px-4 py-2 rounded-full text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingCustom}
                  className="px-5 py-2 rounded-full text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition disabled:opacity-50 cursor-pointer"
                >
                  {isSavingCustom ? "Saving..." : "Save Custom DAX"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
