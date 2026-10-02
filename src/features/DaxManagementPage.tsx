"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import {
  ArrowRight,
  Calculator,
  Check,
  CheckCircle2,
  ChevronDown,
  Code2,
  Columns,
  Copy,
  Database,
  Eye,
  EyeOff,
  FunctionSquare,
  Link,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Split as SplitIcon,
  Table as TableIcon,
  Trash2,
  Workflow,
  X,
  Upload,
  Download,
} from "lucide-react";
import { BimImportModal } from "@/components/powerbi/BimImportModal";
import { DaxDiagramBoard } from "@/features/whiteboard/DaxDiagramBoard";
import { DaxScriptModal } from "@/components/powerbi/DaxScriptModal";
import { useAccess } from "@/components/auth/LoginGate";
import { confirmDialog, toast } from "@/components/feedback";
import { clsx } from "clsx";
import { DaxCodeViewer } from "@/components/powerbi/DaxCodeViewer";
import { formatDax } from "@/lib/daxFormatter";
import { PortSide as DiagramPortSide, NodeConnection as DiagramConnection } from "@/features/WhiteboardPage";

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
  updatedAt?: string | null;
  updatedBy?: string | null;
}

interface ModelMeta {
  code: string;
  name: string;
  id: string;
  totalMeasures: number;
  totalColumns: number;
}

export type { DiagramPortSide, DiagramConnection };

export interface DiagramNode {
  id: string;
  title: string;
  category: "source" | "measure_call" | "filter" | "switch" | "relationship" | "calculation" | "output";
  role: string;
  detail: string;
  codeSnippet?: string;
  color?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  connections: DiagramConnection[];
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
            className="bg-amber-200 text-slate-900 font-semibold px-1 rounded-xs"
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
                    className="block mt-1 w-full text-blue-600 font-semibold hover:underline"
                  >
                    Use &ldquo;{filterQuery.trim()}&rdquo;
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
                        ? "bg-blue-600 text-white font-semibold"
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
        connections: [{ targetId: "calc_default", fromSide: "right", toSide: "left" }],
      },
      {
        id: "calc_default",
        title: "Expression Logic",
        category: "calculation",
        role: "DAX Computation",
        detail: "Standard aggregation logic",
        x: 340,
        y: 120,
        connections: [{ targetId: "out_final", fromSide: "right", toSide: "left" }],
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

  // 1. EXTRACT STANDALONE CALLED MEASURES (e.g. [_hn_count], [_net_revenue] - not preceded by table name)
  const standaloneMeasureRegex = /(?:^|[^\w'"])\s*\[([_a-zA-Z0-9% -]+)\]/g;
  const rawMeasureMatches = Array.from(text.matchAll(standaloneMeasureRegex)).map((m) => m[1]);
  const measureMatches = Array.from(new Set(rawMeasureMatches));
  const calledMeasures = measureMatches.filter((m) => m !== measureName && !m.toLowerCase().includes("date"));

  // 2. EXTRACT REFERENCED TABLES (e.g. 'fact_patient_visit', 'fact_refer_out')
  const tableMatches = Array.from(new Set(Array.from(text.matchAll(/'([^']+)'/g)).map((m) => m[1])));
  const primaryTable = tableMatches[0] || tableName || "fact_table";

  // 3. EXTRACT EXCLUDE / FILTER CONDITIONS
  // Matches e.g.:
  // - fact_patient_visit[is_evening_visit] = 1 or 'dim'[col] = 'val'
  // - NOT 'fact_patient_visit'[visit_type_id] IN { 3, 5 }
  // - NOT( ISBLANK(...) )
  // - FILTER(...)
  const excludeMatches: string[] = [];
  const equalityRegex = /(?:(?:'[^']+'|[a-zA-Z0-9_]+)\[[^\]]+\]|\[[^\]]+\])\s*(?:=|<>|!=|>=|<=|>|<|IN)\s*(?:\{[^\}]+\}|[0-9.]+|"[^"]*"|'[^']*')/gi;
  const notBlankRegex = /NOT\s*\(\s*ISBLANK\([^\)]+\)\s*\)/gi;
  const filterRegex = /FILTER\s*\([^,]+,[^\)]+\)/gi;

  let mMatch;
  while ((mMatch = equalityRegex.exec(text)) !== null) {
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

  // Exclude / Not IN / Equality filters
  excludeMatches.forEach((ex, idx) => {
    const fId = `flt_ex_${idx}`;
    let role = "Context Filter";
    let title = "FILTER PREDICATE";
    if (ex.toUpperCase().startsWith("NOT")) {
      title = "EXCLUDE CONDITION";
      role = "Exclusion Logic";
    } else if (ex.includes("=") || ex.includes("<>") || ex.includes("IN") || ex.includes(">") || ex.includes("<")) {
      title = ex.length > 28 ? ex.slice(0, 25) + "..." : ex;
      role = "Filter Predicate";
    }
    nodes.push({
      id: fId,
      title,
      category: "filter",
      role,
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
      connections: [{ targetId: "out_result", fromSide: "right", toSide: "left" }],
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
        connections: [{ targetId: "out_result", fromSide: "right", toSide: "left" }],
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
      connections: [{ targetId: "out_result", fromSide: "right", toSide: "left" }],
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
  // 1. Connect Input Nodes (Called Measures & Tables) to Engine
  inputNodeIds.forEach((inpId) => {
    const inpNode = nodes.find((n) => n.id === inpId);
    if (inpNode) {
      inpNode.connections = [{ targetId: coreNodeId, fromSide: "right", toSide: "left", label: "Inputs" }];
    }
  });

  // 2. Connect Filter & Predicate Nodes to Core Engine
  filterNodeIds.forEach((fltId) => {
    const fltNode = nodes.find((n) => n.id === fltId);
    if (fltNode) {
      fltNode.connections = [{ targetId: coreNodeId, fromSide: "right", toSide: "left", label: "Predicate" }];
    }
  });

  return nodes;
}

export function DaxManagementPage() {
  const { can } = useAccess();
  const [scriptOpen, setScriptOpen] = useState(false);

  // Floating Sidebar state
  const [floatSidebarOpen, setFloatSidebarOpen] = useState(true);

  // Semantic Model Selection Screen Gate (True when model chosen, false to show landing selector)
  const [modelChosen, setModelChosen] = useState<boolean>(false);

  // Active Model: "PKT-D01" | "PKT-D02" | "ALL"
  const [activeModel, setActiveModel] = useState<string>("PKT-D01");

  // .bim import dialog
  const [importOpen, setImportOpen] = useState<boolean>(false);

  // Read URL query parameter for model on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const m = params.get("model");
      if (m && /^(PKT-D\d{2}|ALL)$/.test(m)) {
        // Reading the address bar has to wait for the browser, so this runs after mount.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setActiveModel(m);
        setModelChosen(true);
      }
      const q = params.get("q");
      if (q) {
        setSearchQuery(q);
        if (!m) {
          setActiveModel("ALL");
          setModelChosen(true);
        }
      }
      if (params.get("import") === "1") setImportOpen(true);
      const t = params.get("type");
      if (t) setSelectedType(t);
      const tb = params.get("table");
      if (tb) setSelectedTable(tb);
      const d = params.get("doc");
      if (d === "missing" || d === "documented") setDocFilter(d);
      const it = params.get("item");
      if (it) {
        // Shared link to one measure: open it even if it isn't in the first page of results.
        setModelChosen(true);
        if (!m) setActiveModel("ALL");
        fetch(`/api/powerbi/dax?id=${encodeURIComponent(it)}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((j) => {
            const hit = j?.items?.[0];
            if (hit) {
              pinnedItemId.current = hit.id;
              setSelectedItem(hit);
            } else toast.error("That measure isn't in the dictionary any more");
          })
          .catch(() => {});
      }
    }
  }, []);

  // View Mode: "split" (list + details) | "table" (wide grid)
  const [viewMode, setViewMode] = useState<"table" | "split">("split");
  const [docFilter, setDocFilter] = useState<"all" | "missing" | "documented">("all");
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [formulaEditing, setFormulaEditing] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [copyMenuOpen, setCopyMenuOpen] = useState(false);
  const [detailOpenMobile, setDetailOpenMobile] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  /** Item opened from a shared link: keep it selected even if it's not in the list. */
  const pinnedItemId = useRef<string | null>(null);

  // Items & Metadata State
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [models, setModels] = useState<ModelMeta[]>([
    {
      code: "ALL",
      name: "All Semantic Models (Global)",
      id: "all-models",
      totalMeasures: 1455,
      totalColumns: 3336,
    },
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

  // Sidebox / Split Inline Editing State (Everything Editable)
  const [sideboxForm, setSideboxForm] = useState({
    name: "",
    tableName: "",
    dataType: "Decimal",
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

  // Formula diagrams open on a Whiteboard canvas (DaxDiagramBoard).
  const [wbDiagramOpen, setWbDiagramOpen] = useState(false);
  const [diagramTarget, setDiagramTarget] = useState<ItemRecord | null>(null);
  const [diagramNodes, setDiagramNodes] = useState<DiagramNode[]>([]);

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
  const [fullDaxPasteInput, setFullDaxPasteInput] = useState("");
  const [autoSplitDetected, setAutoSplitDetected] = useState(false);
  const [customDaxTab, setCustomDaxTab] = useState<"edit" | "preview">("edit");
  // Every newly selected item opens with its formula in read-only preview.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFormulaEditing(false);
    setCopyMenuOpen(false);
  }, [selectedItem?.id]);

  // Auto-detect and parse full DAX paste (everything before first '=' is name, after is expression)
  function handleFullDaxPaste(rawText: string) {
    setFullDaxPasteInput(rawText);
    if (!rawText.trim()) return;

    const equalIdx = rawText.indexOf("=");
    if (equalIdx > 0) {
      let parsedName = rawText.slice(0, equalIdx).trim();
      // Strip surrounding brackets [ ] or quotes
      parsedName = parsedName.replace(/^[+|]+$/g, "").trim();
      const parsedExpr = rawText.slice(equalIdx + 1).trim();

      if (parsedName) setCustomName(parsedName);
      if (parsedExpr) setCustomExpression(parsedExpr);

      setAutoSplitDetected(true);
      setTimeout(() => setAutoSplitDetected(false), 3500);
    }
  }

  // Fill the form from the open item: always when another item opens, and when a reload brings
  // a newer copy of this one (only if there's nothing unsaved, so edits are never wiped).
  const formForId = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedItem) return;
    const switched = formForId.current !== selectedItem.id;
    if (!switched && dirtyRef.current) return;
    formForId.current = selectedItem.id;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSideboxForm({
      name: selectedItem.name || "",
      tableName: selectedItem.tableName || "",
      dataType: selectedItem.dataType || "Decimal",
      businessDefinition: selectedItem.businessDefinition || "",
      mathDefinition: selectedItem.mathDefinition || "",
      notes: selectedItem.notes || "",
      expression: selectedItem.expression || "",
    });
    if (switched) setSideboxSaveSuccess(false);
  }, [selectedItem]);

  // Check if Split inspector has unsaved changes across ALL editable fields
  const isSideboxDirty = useMemo(() => {
    if (!selectedItem) return false;
    const origName = selectedItem.name || "";
    const origTable = selectedItem.tableName || "";
    const origType = selectedItem.dataType || "Decimal";
    const origBus = selectedItem.businessDefinition || "";
    const origMath = selectedItem.mathDefinition || "";
    const origNotes = selectedItem.notes || "";
    const origExpr = selectedItem.expression || "";

    const hasNameChanged = sideboxForm.name.trim() !== origName;
    const hasTableChanged = sideboxForm.tableName.trim() !== origTable;
    const hasTypeChanged = sideboxForm.dataType !== origType;
    const hasBusChanged = sideboxForm.businessDefinition !== origBus;
    const hasMathChanged = sideboxForm.mathDefinition !== origMath;
    const hasNotesChanged = sideboxForm.notes !== origNotes;
    const hasExprChanged = sideboxForm.expression !== origExpr;

    return (
      hasNameChanged ||
      hasTableChanged ||
      hasTypeChanged ||
      hasBusChanged ||
      hasMathChanged ||
      hasNotesChanged ||
      hasExprChanged
    );
  }, [selectedItem, sideboxForm]);
  const dirtyRef = useRef(false);
  useEffect(() => {
    dirtyRef.current = isSideboxDirty;
  }, [isSideboxDirty]);

  // Instant Search Debounce Effect (250ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    void fetchItems();
  }, [activeModel, selectedTable, selectedType, searchMode, debouncedQuery, docFilter]);

  // Keep the address bar in step so a view (or one measure) can be shared as a link.
  useEffect(() => {
    if (!modelChosen) return;
    const p = new URLSearchParams();
    p.set("model", activeModel);
    if (debouncedQuery.trim()) p.set("q", debouncedQuery.trim());
    if (selectedType !== "all") p.set("type", selectedType);
    if (selectedTable !== "all") p.set("table", selectedTable);
    if (docFilter !== "all") p.set("doc", docFilter);
    if (selectedItem) p.set("item", selectedItem.id);
    window.history.replaceState(null, "", `/dax?${p.toString()}`);
  }, [modelChosen, activeModel, debouncedQuery, selectedType, selectedTable, docFilter, selectedItem?.id]);

  // Don't lose unsaved edits by closing the tab.
  useEffect(() => {
    if (!isSideboxDirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isSideboxDirty]);

  async function fetchItems(append = false) {
    const nextPage = append ? page + 1 : 1;
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("model", activeModel);
      if (debouncedQuery.trim()) params.set("q", debouncedQuery.trim());
      params.set("searchMode", searchMode);
      if (selectedTable !== "all") params.set("table", selectedTable);
      if (selectedType !== "all") params.set("type", selectedType);
      if (docFilter !== "all") params.set("doc", docFilter);
      params.set("limit", "150");
      params.set("page", String(nextPage));

      const res = await fetch(`/api/powerbi/dax?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        const loadedItems: ItemRecord[] = json.items || [];
        setPage(nextPage);
        if (append) {
          setItems((prev) => [...prev, ...loadedItems]);
          if (json.meta) setMeta(json.meta);
          return;
        }
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

        // Keep the open item if it's still there (or was opened from a link); otherwise the first one.
        setSelectedItem((prev) => {
          if (prev && pinnedItemId.current === prev.id) return prev;
          if (!loadedItems.length) return null;
          if (!prev) return loadedItems[0];
          const fresh = loadedItems.find((i: ItemRecord) => i.id === prev.id);
          // Mid-edit, keep the copy the edit started from so a save still spots someone else's change.
          if (fresh) return dirtyRef.current ? prev : fresh;
          return dirtyRef.current ? prev : loadedItems[0];
        });
      } else {
        toast.error("Couldn't load the dictionary", { body: "Check your connection and try again." });
      }
    } catch (err) {
      console.error("Error fetching DAX items:", err);
      toast.error("Couldn't load the dictionary", { body: "Check your connection and try again." });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  // Handle Item Selection with Unsaved Changes Guard
  function handleSelectItem(item: ItemRecord) {
    setDetailOpenMobile(true);
    if (selectedItem && selectedItem.id === item.id) return;
    pinnedItemId.current = null;
    if (isSideboxDirty) {
      setPendingSelection(item);
      setShowUnsavedModal(true);
    } else {
      setSelectedItem(item);
    }
  }

  // Discard changes and proceed
  async function handleSaveAndProceed() {
    setShowUnsavedModal(false);
    if (await handleSaveSidebox()) handleDiscardAndProceed();
    else setPendingSelection(null);
  }

  function handleDiscardAndProceed() {
    if (pendingSelection) {
      pinnedItemId.current = null;
      setSelectedItem(pendingSelection);
      setPendingSelection(null);
    }
    setShowUnsavedModal(false);
  }

  function handleDiscardEdits() {
    if (!selectedItem) return;
    setSideboxForm({
      name: selectedItem.name || "",
      tableName: selectedItem.tableName || "",
      dataType: selectedItem.dataType || "Decimal",
      businessDefinition: selectedItem.businessDefinition || "",
      mathDefinition: selectedItem.mathDefinition || "",
      notes: selectedItem.notes || "",
      expression: selectedItem.expression || "",
    });
    setFormulaEditing(false);
  }

  // Save Split inspector changes directly (Supports Full Editing of Name, Table, Type, Expression, and Definitions)
  async function handleSaveSidebox(force = false): Promise<boolean> {
    if (!selectedItem) return false;
    setIsSavingSidebox(true);
    setSideboxSaveSuccess(false);
    let saved: { updatedAt?: string; updatedBy?: string } = {};

    try {
      const finalName = sideboxForm.name.trim() || selectedItem.name;
      const finalTable = sideboxForm.tableName.trim() || selectedItem.tableName;
      const finalDataType = sideboxForm.dataType || selectedItem.dataType || "Decimal";
      const finalExpr = sideboxForm.expression;

      // Has structural / code fields changed?
      const isStructureChanged =
        finalName !== selectedItem.name ||
        finalTable !== selectedItem.tableName ||
        finalDataType !== selectedItem.dataType ||
        (selectedItem.expression !== null && finalExpr !== selectedItem.expression);

      if (selectedItem.isCustom || isStructureChanged) {
        const res = await fetch("/api/powerbi/dax", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "save_custom",
            id: selectedItem.id,
            datasetId: selectedItem.modelCode,
            tableName: finalTable,
            name: finalName,
            expression: finalExpr || selectedItem.expression || "",
            dataType: finalDataType,
            mathDefinition: sideboxForm.mathDefinition,
            businessDefinition: sideboxForm.businessDefinition,
            notes: sideboxForm.notes,
            user: "Authorized User",
            baseUpdatedAt: selectedItem.isCustom ? selectedItem.updatedAt ?? null : null,
            force,
          }),
        });
        if (res.status === 409) return resolveConflict(res, force);
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "The server didn't accept the change");
        saved = await res.json();
      } else {
        const res = await fetch("/api/powerbi/dax", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "save_annotation",
            id: selectedItem.id,
            modelCode: selectedItem.modelCode,
            tableName: finalTable,
            objectName: finalName,
            objectType: selectedItem.type,
            mathDefinition: sideboxForm.mathDefinition,
            businessDefinition: sideboxForm.businessDefinition,
            notes: sideboxForm.notes,
            changedBy: "Authorized User",
            baseUpdatedAt: selectedItem.updatedAt ?? null,
            force,
          }),
        });
        if (res.status === 409) return resolveConflict(res, force);
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "The server didn't accept the change");
        saved = await res.json();
      }

      // Update state in memory
      setItems((prev) =>
        prev.map((it) =>
          it.id === selectedItem.id
            ? {
                ...it,
                name: finalName,
                tableName: finalTable,
                dataType: finalDataType,
                businessDefinition: sideboxForm.businessDefinition,
                mathDefinition: sideboxForm.mathDefinition,
                notes: sideboxForm.notes,
                expression: finalExpr,
                isCustom: selectedItem.isCustom || isStructureChanged,
                updatedAt: saved.updatedAt ?? it.updatedAt,
                updatedBy: saved.updatedBy ?? it.updatedBy,
              }
            : it
        )
      );

      setSelectedItem((prev) =>
        prev
          ? {
              ...prev,
              name: finalName,
              tableName: finalTable,
              dataType: finalDataType,
              businessDefinition: sideboxForm.businessDefinition,
              mathDefinition: sideboxForm.mathDefinition,
              notes: sideboxForm.notes,
              expression: finalExpr,
              isCustom: selectedItem.isCustom || isStructureChanged,
              updatedAt: saved.updatedAt ?? prev.updatedAt,
              updatedBy: saved.updatedBy ?? prev.updatedBy,
            }
          : null
      );

      setFormulaEditing(false);
      setSideboxSaveSuccess(true);
      setTimeout(() => setSideboxSaveSuccess(false), 3000);
      toast("Saved", { body: `${finalName} — the team sees it now.` });
      return true;
    } catch (err: any) {
      console.error("Save error:", err);
      toast.error("Couldn't save", { body: err.message || "Unknown error" });
      return false;
    } finally {
      setIsSavingSidebox(false);
    }
  }

  /** Someone else saved this item after we loaded it: let the person choose. */
  async function resolveConflict(res: Response, alreadyForced: boolean): Promise<boolean> {
    const json = await res.json().catch(() => ({}));
    const c = json.conflict || {};
    const who = c.updatedBy || "Someone on the team";
    const when = c.updatedAt ? new Date(c.updatedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "just now";
    setIsSavingSidebox(false);
    if (alreadyForced) {
      toast.error("Couldn't save", { body: "It changed again while saving. Try once more." });
      return false;
    }
    const overwrite = await confirmDialog({
      title: `${who} changed this while you were editing`,
      body:
        `They saved at ${when}.` +
        (c.businessDefinition !== undefined ? `\n\nTheir definition:\n“${c.businessDefinition || "(empty)"}”` : "") +
        `\n\nOverwrite their version with yours, or keep theirs?`,
      confirmLabel: "Overwrite with mine",
      cancelLabel: "Keep theirs",
      danger: true,
    });
    if (overwrite) return handleSaveSidebox(true);
    if (!selectedItem) return false;
    const theirs: Partial<ItemRecord> = {
      updatedAt: c.updatedAt ?? null,
      updatedBy: c.updatedBy ?? null,
      ...(c.businessDefinition !== undefined ? { businessDefinition: c.businessDefinition, mathDefinition: c.mathDefinition, notes: c.notes } : {}),
      ...(c.expression !== undefined ? { expression: c.expression, name: c.name || selectedItem.name } : {}),
    };
    const merged = { ...selectedItem, ...theirs };
    setItems((prev) => prev.map((it) => (it.id === merged.id ? merged : it)));
    setSelectedItem(merged);
    setSideboxForm({
      name: merged.name || "",
      tableName: merged.tableName || "",
      dataType: merged.dataType || "Decimal",
      businessDefinition: merged.businessDefinition || "",
      mathDefinition: merged.mathDefinition || "",
      notes: merged.notes || "",
      expression: merged.expression || "",
    });
    toast.info(`Showing ${who}'s version`);
    return false;
  }

  // Open Interactive Diagram Modal with Deep AST Parsing (Supports Saved Layout & 4-Port System)
  function handleOpenDiagram(item: ItemRecord) {
    if (!can("dax.diagram")) return;
    setDiagramTarget(item);
    if (item.notes && item.notes.startsWith("DIAGRAM_LAYOUT:")) {
      try {
        const rawJson = item.notes.replace("DIAGRAM_LAYOUT:", "");
        const parsed = JSON.parse(rawJson);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const normalized: DiagramNode[] = parsed.map((n: any) => ({
            ...n,
            width: n.width || 230,
            height: n.height || 92,
            connections: (n.connections || []).map((c: any) =>
              typeof c === "string" ? { targetId: c, fromSide: "right", toSide: "left" } : c
            ),
          }));
          setDiagramNodes(normalized);
          setWbDiagramOpen(true);
          return;
        }
      } catch (err) {
        console.error("Failed to parse saved diagram layout", err);
      }
    }
    const parsed = parseDaxToProgrammingAst(item.name, item.expression, item.tableName);
    setDiagramNodes(parsed);
    setWbDiagramOpen(true);
  }

  // Handle Search Input Change with Table Auto-unlock
  // Search stays in the chosen model and filters; the empty state offers "search all models".
  function handleSearchInputChange(val: string) {
    setSearchQuery(val);
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

  /** Full definition as Power BI expects it: `Measure name = formula`. */
  function fullDefinition(name: string, expr: string) {
    return `${name} =\n${expr}`;
  }

  function copyText(id: string, text: string, label = "Copied") {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast(label);
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
    setFullDaxPasteInput("");
    setCustomDaxTab("edit");
    setCustomDaxModalOpen(true);
  }

  const customForce = useRef(false);
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
          baseUpdatedAt: customDaxTarget?.updatedAt ?? null,
          force: customForce.current,
        }),
      });

      const json = await res.json();
      if (res.status === 409 && !customForce.current) {
        const ok = await confirmDialog({
          title: "Someone changed this measure while you were editing",
          body: "Save anyway and replace their version with yours?",
          confirmLabel: "Replace with mine",
          danger: true,
        });
        if (ok) {
          customForce.current = true;
          setIsSavingCustom(false);
          return handleSaveCustomDax(e);
        }
        return;
      }
      if (!res.ok) throw new Error(json.error || "Failed to save custom DAX");

      setCustomDaxModalOpen(false);
      toast(customDaxTarget ? "Team measure updated" : "Team measure added", { body: customName.trim() });
      await fetchItems();
    } catch (err: any) {
      setCustomError(err.message || "Failed to save custom DAX");
    } finally {
      setIsSavingCustom(false);
      customForce.current = false;
    }
  }

  async function handleDeleteCustomDax(id: string) {
    const name = items.find((i) => i.id === id)?.name || selectedItem?.name || "this measure";
    const ok = await confirmDialog({
      title: `Delete ${name}?`,
      body: "It's removed for the whole team. The activity log keeps a copy you can restore.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await fetch("/api/powerbi/dax", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_custom", id, user: "Current User" }),
      });
      if (!res.ok) throw new Error();
      toast("Deleted", { body: name });
      pinnedItemId.current = null;
      await fetchItems();
    } catch {
      toast.error("Couldn't delete", { body: "Try again in a moment." });
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

  // Keyboard: / search, ↑↓ move through the list, Ctrl+S save, Esc closes menus.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      const typing = t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        if (isSideboxDirty) {
          e.preventDefault();
          void handleSaveSidebox();
        }
        return;
      }
      if (e.key === "Escape") {
        setModelMenuOpen(false);
        setMoreOpen(false);
        setCopyMenuOpen(false);
        return;
      }
      if (typing) return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if ((e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "j" || e.key === "k") && items.length) {
        e.preventDefault();
        const i = items.findIndex((x) => x.id === selectedItem?.id);
        const down = e.key === "ArrowDown" || e.key === "j";
        const next = items[Math.max(0, Math.min(items.length - 1, i + (down ? 1 : -1)))];
        if (next) {
          handleSelectItem(next);
          listRef.current?.querySelector(`[data-item="${CSS.escape(next.id)}"]`)?.scrollIntoView({ block: "nearest" });
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const typeMeta = (it: ItemRecord) =>
    it.isCustom
      ? { label: "Team measure", icon: Sparkles, tone: "bg-violet-50 text-violet-600" }
      : it.type === "Measure"
        ? { label: "Measure", icon: FunctionSquare, tone: "bg-blue-50 text-blue-600" }
        : it.type.includes("Calculated")
          ? { label: "Calculated column", icon: Calculator, tone: "bg-amber-50 text-amber-600" }
          : { label: "Column", icon: Columns, tone: "bg-emerald-50 text-emerald-600" };
  const edited = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
  const coverage = (meta.coverage as { documented: number; total: number } | undefined) || null;
  const coveragePct = coverage && coverage.total ? Math.round((coverage.documented / coverage.total) * 100) : 0;
  const filtersActive = selectedType !== "all" || selectedTable !== "all" || docFilter !== "all" || Boolean(searchQuery.trim());
  const clearFilters = () => {
    setSelectedType("all");
    setSelectedTable("all");
    setDocFilter("all");
    setSearchQuery("");
  };

  // =========================================================================
  // VIEW 0: PICK A MODEL
  // =========================================================================
  if (!modelChosen) {
    const realModels = models.filter((m) => m.code !== "ALL");
    const totalMeasures = realModels.reduce((n, m) => n + (m.totalMeasures || 0), 0);
    const totalColumns = realModels.reduce((n, m) => n + (m.totalColumns || 0), 0);
    return (
      <div className="h-full w-full overflow-y-auto">
        <div className="mx-auto max-w-5xl py-4 md:py-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-[28px] font-semibold tracking-tight text-slate-900">Which model are you working in?</h2>
              <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-slate-500">
                {totalMeasures.toLocaleString()} measures and {totalColumns.toLocaleString()}{" "}
                columns, each with its formula and the team&rsquo;s plain-language
                definition.
              </p>
            </div>
            {can("dax.import") && (
              <button
                type="button"
                onClick={() => setImportOpen(true)}
                className="inline-flex items-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <Upload className="h-4 w-4" />
                Update from .bim
              </button>
            )}
          </div>

          <div className="stagger mt-8 grid gap-4 md:grid-cols-2">
            {realModels.map((m) => {
              const mm = m as ModelMeta & { totalRelationships?: number; lastImportedAt?: string; lastImportedBy?: string; sourceFile?: string; documentedMeasures?: number };
              const pct = mm.totalMeasures ? Math.round(((mm.documentedMeasures || 0) / mm.totalMeasures) * 100) : 0;
              return (
                <button
                  key={m.code}
                  type="button"
                  onClick={() => {
                    setActiveModel(m.code);
                    setModelChosen(true);
                  }}
                  className="lift group rounded-xl border border-slate-200/80 bg-white p-6 text-left shadow-[0_1px_2px_rgb(16_24_40/0.04)] hover:border-blue-300"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-mono text-xs text-blue-700">{m.code}</p>
                      <p className="mt-1 text-lg font-medium text-slate-900">{m.name.replace(m.code, "").trim() || m.name}</p>
                    </div>
                    <ArrowRight className="h-5 w-5 -translate-x-1 text-slate-300 transition group-hover:translate-x-0 group-hover:text-blue-600" />
                  </div>
                  <div className="mt-6 flex gap-8">
                    {[
                      [m.totalMeasures, "measures"],
                      [m.totalColumns, "columns"],
                      ...(mm.totalRelationships ? [[mm.totalRelationships, "relationships"]] : []),
                    ].map(([n, label]) => (
                      <div key={label as string}>
                        <p className="text-[26px] font-semibold tabular-nums tracking-tight text-slate-900">{Number(n || 0).toLocaleString()}</p>
                        <p className="text-xs text-slate-500">{label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5">
                    <div className="mb-1 flex justify-between text-[12px] text-slate-500">
                      <span>Measures with a definition</span>
                      <span className="tabular-nums">{pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100">
                      <div className="h-1.5 origin-left rounded-full bg-blue-600 [animation:grow-x_var(--dur-3)_var(--ease-out-soft)_backwards]" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
                    {mm.lastImportedAt
                      ? `Updated${mm.sourceFile ? ` from ${mm.sourceFile}` : ""} on ${new Date(mm.lastImportedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })} by ${mm.lastImportedBy}`
                      : "Not yet updated from a .bim file"}
                  </p>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              setActiveModel("ALL");
              setModelChosen(true);
            }}
            className="mt-4 flex w-full items-center gap-3 rounded-xl border border-dashed border-slate-300 p-5 text-left text-sm text-slate-600 transition hover:border-blue-400 hover:bg-white"
          >
            <Search className="h-5 w-5 text-slate-400" />
            <span>
              <span className="font-medium text-slate-900">Search across all models</span>
              <span className="block text-slate-500">Useful when you know the measure name but not where it lives.</span>
            </span>
          </button>
        </div>
        <BimImportModal open={importOpen} onClose={() => setImportOpen(false)} onImported={() => void fetchItems()} defaultModel={activeModel} />
      </div>
    );
  }

  const TYPE_TABS = [
    { id: "all", label: "All", count: meta.totalMeasures + meta.totalColumns + (meta.totalCustom || 0) },
    { id: "measure", label: "Measures", count: meta.totalMeasures + (meta.totalCustom || 0) },
    { id: "column", label: "Columns", count: null },
    { id: "calculated_column", label: "Calculated", count: null },
    { id: "custom", label: "Team-written", count: meta.totalCustom || 0 },
  ];
  const sel = selectedItem;
  const selMeta = sel ? typeMeta(sel) : null;
  const canEdit = can("dax.edit");
  const isFormulaItem = Boolean(sel && (sel.type === "Measure" || sel.isCustom || sel.expression));
  const tableCounts = (meta.tableCounts as Record<string, number> | undefined) || {};

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(16_24_40/0.04)]">
      {/* ---------- Header: model · search · actions ---------- */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/80 px-3 py-2.5 md:px-4">
        <div className="relative">
          <button
            type="button"
            onClick={() => setModelMenuOpen((v) => !v)}
            className="flex h-10 max-w-[280px] items-center gap-2 rounded-lg px-2.5 text-left transition hover:bg-slate-100"
            aria-haspopup="menu"
            aria-expanded={modelMenuOpen}
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-blue-50 text-blue-600">
              <Database className="h-4 w-4" />
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block font-mono text-[11px] text-blue-700">{activeModel === "ALL" ? "ALL MODELS" : currentModelMeta.code}</span>
              <span className="block truncate text-[13.5px] font-semibold text-slate-900">
                {activeModel === "ALL" ? "Every semantic model" : currentModelMeta.name.replace(currentModelMeta.code, "").trim() || currentModelMeta.name}
              </span>
            </span>
            <ChevronDown className={clsx("h-4 w-4 shrink-0 text-slate-400 transition-transform", modelMenuOpen && "rotate-180")} />
          </button>
          {modelMenuOpen && (
            <div role="menu" className="pop-in absolute left-0 top-12 z-30 w-80 rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_12px_32px_-8px_rgb(16_24_40/0.2)]">
              {[...models.filter((m) => m.code !== "ALL"), { code: "ALL", name: "Every semantic model", totalMeasures: 0, totalColumns: 0, id: "all" }].map((m) => (
                <button
                  key={m.code}
                  type="button"
                  role="menuitemradio"
                  aria-checked={activeModel === m.code}
                  onClick={() => {
                    setActiveModel(m.code);
                    setModelMenuOpen(false);
                  }}
                  className={clsx("flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-slate-50", activeModel === m.code && "bg-blue-50/70")}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-[11px] text-blue-700">{m.code === "ALL" ? "ALL MODELS" : m.code}</span>
                    <span className="block truncate text-[13.5px] text-slate-900">{m.code === "ALL" ? m.name : m.name.replace(m.code, "").trim() || m.name}</span>
                  </span>
                  {m.code !== "ALL" && <span className="text-[12px] tabular-nums text-slate-400">{(m.totalMeasures || 0).toLocaleString()} measures</span>}
                  {activeModel === m.code && <Check className="h-4 w-4 text-blue-600" />}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setModelChosen(false);
                  setModelMenuOpen(false);
                }}
                className="mt-1 w-full rounded-lg border-t border-slate-100 px-2.5 py-2 text-left text-[12.5px] text-slate-500 hover:bg-slate-50"
              >
                Model overview…
              </button>
            </div>
          )}
        </div>

        <label className="group relative order-last flex w-full min-w-[220px] flex-1 items-center md:order-none md:w-auto">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400 group-focus-within:text-blue-600" />
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                handleSearchInputChange("");
                (e.target as HTMLInputElement).blur();
              }
            }}
            placeholder="Search by name, table, formula or meaning"
            className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-28 text-[13.5px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
          />
          <span className="absolute right-2 flex items-center gap-1">
            {searchQuery ? (
              <button type="button" onClick={() => handleSearchInputChange("")} className="grid h-6 w-6 place-items-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-700" aria-label="Clear search">
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <kbd className="rounded border border-slate-200 bg-white px-1.5 py-px font-sans text-[10.5px] text-slate-400">/</kbd>
            )}
            <button
              type="button"
              onClick={() => setSearchMode(searchMode === "exact" ? "partial" : "exact")}
              aria-pressed={searchMode === "exact"}
              title="Only match whole words inside formulas"
              className={clsx(
                "rounded px-1.5 py-0.5 text-[11px] font-medium transition",
                searchMode === "exact" ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              )}
            >
              Whole word
            </button>
          </span>
        </label>

        <div className="ml-auto flex items-center gap-1.5">
          {canEdit && (
            <button
              type="button"
              onClick={() => openCustomDaxModal()}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-[13px] font-medium text-white transition hover:bg-blue-700 active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New measure</span>
            </button>
          )}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              className={clsx("grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50", moreOpen && "bg-slate-100")}
              aria-label="More actions"
              aria-haspopup="menu"
              aria-expanded={moreOpen}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {moreOpen && (
              <div role="menu" className="pop-in absolute right-0 top-11 z-30 w-64 rounded-xl border border-slate-200 bg-white p-1.5 text-[13.5px] shadow-[0_12px_32px_-8px_rgb(16_24_40/0.2)]" onClick={() => setMoreOpen(false)}>
                {can("dax.import") && (
                  <button type="button" role="menuitem" onClick={() => setImportOpen(true)} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-slate-700 hover:bg-slate-50">
                    <Upload className="h-4 w-4 text-slate-400" />
                    <span>
                      Update from .bim
                      <span className="block text-[11.5px] text-slate-400">Bring in the latest model</span>
                    </span>
                  </button>
                )}
                {can("dax.generate") && (
                  <button type="button" role="menuitem" onClick={() => setScriptOpen(true)} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-slate-700 hover:bg-slate-50">
                    <Code2 className="h-4 w-4 text-slate-400" />
                    <span>
                      Generate for Power BI
                      <span className="block text-[11.5px] text-slate-400">Add many measures at once</span>
                    </span>
                  </button>
                )}
                {can("dax.export") && (
                  <a role="menuitem" href={`/api/dax/export?model=${encodeURIComponent(activeModel)}`} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-slate-700 hover:bg-slate-50">
                    <Download className="h-4 w-4 text-slate-400" />
                    <span>
                      Export to Excel
                      <span className="block text-[11.5px] text-slate-400">Whole model as a workbook</span>
                    </span>
                  </a>
                )}
                <button type="button" role="menuitem" onClick={() => void fetchItems()} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-slate-700 hover:bg-slate-50">
                  <RefreshCw className="h-4 w-4 text-slate-400" /> Reload
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ---------- Filters ---------- */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-200/80 px-3 py-2 md:px-4">
        <div className="flex max-w-full overflow-x-auto rounded-lg bg-slate-100 p-0.5 [scrollbar-width:none]" role="tablist" aria-label="Type">
          {TYPE_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={selectedType === t.id}
              onClick={() => setSelectedType(t.id)}
              className={clsx(
                "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-[12.5px] font-medium transition-all duration-200",
                selectedType === t.id ? "bg-white text-slate-900 shadow-[0_1px_2px_rgb(16_24_40/0.1)]" : "text-slate-500 hover:text-slate-900"
              )}
            >
              {t.label}
              {t.count !== null && <span className="tabular-nums text-[11px] text-slate-400">{Number(t.count).toLocaleString()}</span>}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setDocFilter(docFilter === "missing" ? "all" : "missing")}
          aria-pressed={docFilter === "missing"}
          className={clsx(
            "flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12.5px] font-medium transition",
            docFilter === "missing" ? "border-amber-300 bg-amber-50 text-amber-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"
          )}
          title="Show only items nobody has explained yet"
        >
          <span className={clsx("h-2 w-2 rounded-full", docFilter === "missing" ? "bg-amber-500" : "bg-slate-300")} />
          Needs a definition
          {coverage && <span className="tabular-nums text-[11px] opacity-70">{(coverage.total - coverage.documented).toLocaleString()}</span>}
        </button>

        {selectedTable !== "all" && (
          <span className="pop-in flex h-8 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 pl-2.5 pr-1 font-mono text-[12px] text-blue-800">
            {selectedTable}
            <button type="button" onClick={() => setSelectedTable("all")} className="grid h-6 w-6 place-items-center rounded text-blue-500 hover:bg-blue-100" aria-label="Clear table filter">
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        )}
        {filtersActive && (
          <button type="button" onClick={clearFilters} className="text-[12.5px] font-medium text-slate-500 underline-offset-2 hover:text-slate-900 hover:underline">
            Clear all
          </button>
        )}

        <div className="ml-auto flex items-center gap-3">
          {coverage && coverage.total > 0 && (
            <div className="hidden items-center gap-2 lg:flex" title={`${coverage.documented.toLocaleString()} of ${coverage.total.toLocaleString()} have a business definition`}>
              <span className="text-[12px] text-slate-500">Documented</span>
              <span className="h-1.5 w-24 rounded-full bg-slate-100">
                <span className="block h-1.5 rounded-full bg-emerald-500 transition-[width] duration-500" style={{ width: `${coveragePct}%` }} />
              </span>
              <span className="text-[12px] tabular-nums text-slate-700">{coveragePct}%</span>
            </div>
          )}
          <span className="text-[12px] tabular-nums text-slate-500">
            {items.length < meta.total ? `${items.length.toLocaleString()} of ` : ""}
            {Number(meta.total || 0).toLocaleString()} items
          </span>
          <div className="flex rounded-lg border border-slate-200 p-0.5">
            {(
              [
                ["split", SplitIcon, "List and details"],
                ["table", TableIcon, "Table"],
              ] as const
            ).map(([v, Icon, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setViewMode(v)}
                aria-pressed={viewMode === v}
                title={label}
                aria-label={label}
                className={clsx("grid h-7 w-7 place-items-center rounded-md transition", viewMode === v ? "bg-blue-50 text-blue-600" : "text-slate-400 hover:bg-slate-100 hover:text-slate-700")}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ---------- Body ---------- */}
      <div className="flex min-h-0 flex-1">
        {/* Tables rail */}
        <aside className={clsx("hidden shrink-0 flex-col border-r border-slate-200/80 transition-[width] duration-300 lg:flex", floatSidebarOpen ? "w-56" : "w-11")}>
          <div className="flex h-10 items-center justify-between px-2">
            {floatSidebarOpen && <span className="pl-1 text-[11.5px] font-medium uppercase tracking-[0.06em] text-slate-400">Tables</span>}
            <button
              type="button"
              onClick={() => setFloatSidebarOpen(!floatSidebarOpen)}
              className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              title={floatSidebarOpen ? "Hide tables" : "Show tables"}
              aria-label={floatSidebarOpen ? "Hide tables" : "Show tables"}
            >
              {floatSidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </button>
          </div>
          {floatSidebarOpen && (
            <>
              <div className="px-2 pb-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={tableSearchQuery}
                    onChange={(e) => setTableSearchQuery(e.target.value)}
                    placeholder="Find a table"
                    className="h-8 w-full rounded-md border border-slate-200 bg-white pl-8 pr-2 text-[12.5px] outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  />
                </div>
              </div>
              <div className="min-h-0 flex-1 space-y-px overflow-y-auto px-2 pb-3">
                <button
                  type="button"
                  onClick={() => setSelectedTable("all")}
                  className={clsx(
                    "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[12.5px] transition",
                    selectedTable === "all" ? "bg-blue-50 font-medium text-blue-700" : "text-slate-600 hover:bg-slate-50"
                  )}
                >
                  All tables
                </button>
                {filteredTables.map((t: string) => {
                  const n = tableCounts[t] ?? 0;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSelectedTable(t)}
                      title={t}
                      className={clsx(
                        "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left font-mono text-[12px] transition",
                        selectedTable.toLowerCase() === t.toLowerCase() ? "bg-blue-50 font-medium text-blue-700" : n ? "text-slate-600 hover:bg-slate-50" : "text-slate-300 hover:bg-slate-50"
                      )}
                    >
                      <span className="truncate">{t}</span>
                      {n > 0 && <span className="shrink-0 font-sans text-[11px] tabular-nums text-slate-400">{n}</span>}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </aside>

        {/* Results */}
        <div className="flex min-w-0 flex-1">
          <div ref={listRef} className={clsx("min-w-0 flex-1 overflow-y-auto", viewMode === "split" && "border-r border-slate-200/80")}>
            {loading ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="skeleton h-14 rounded-lg" style={{ animationDelay: `${i * 60}ms` }} />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="fade-enter grid h-full place-items-center p-8 text-center">
                <div className="max-w-sm">
                  <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-400">
                    <Search className="h-5 w-5" />
                  </div>
                  <p className="text-[15px] font-medium text-slate-900">{searchQuery ? `Nothing matches "${searchQuery}"` : "Nothing here"}</p>
                  <p className="mt-1 text-[13px] text-slate-500">
                    {docFilter === "missing" ? "Everything in this view already has a definition." : "Try fewer filters or another model."}
                  </p>
                  <div className="mt-4 flex justify-center gap-2">
                    {filtersActive && (
                      <button type="button" onClick={clearFilters} className="h-9 rounded-lg border border-slate-200 px-3 text-[13px] font-medium text-slate-700 hover:bg-slate-50">
                        Clear filters
                      </button>
                    )}
                    {activeModel !== "ALL" && (
                      <button type="button" onClick={() => setActiveModel("ALL")} className="h-9 rounded-lg bg-blue-600 px-3 text-[13px] font-medium text-white hover:bg-blue-700">
                        Search all models
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : viewMode === "table" ? (
              <table className="w-full border-collapse text-left text-[13px]">
                <thead className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 text-[12px] text-slate-500 backdrop-blur">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Name</th>
                    <th className="px-3 py-2.5 font-medium">Table</th>
                    <th className="px-3 py-2.5 font-medium">Type</th>
                    <th className="px-3 py-2.5 font-medium">What it means</th>
                    <th className="px-3 py-2.5 font-medium">Last edited</th>
                    <th className="w-24 px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((it) => {
                    const tm = typeMeta(it);
                    return (
                      <tr
                        key={it.id}
                        data-item={it.id}
                        onClick={() => {
                          handleSelectItem(it);
                          setViewMode("split");
                        }}
                        className="group cursor-pointer transition-colors hover:bg-slate-50"
                      >
                        <td className="max-w-[320px] px-4 py-2.5">
                          <span className="flex items-center gap-2.5">
                            <span className={clsx("grid h-7 w-7 shrink-0 place-items-center rounded-md", tm.tone)}>
                              <tm.icon className="h-3.5 w-3.5" />
                            </span>
                            <span className="truncate font-mono text-[12.5px] font-semibold text-slate-900">
                              <HighlightText text={it.name} match={searchQuery} active={Boolean(searchQuery.trim())} />
                            </span>
                          </span>
                        </td>
                        <td className="max-w-[200px] truncate px-3 py-2.5 font-mono text-[12px] text-slate-500">{it.tableName}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-[12.5px] text-slate-600">{tm.label}</td>
                        <td className="max-w-[360px] px-3 py-2.5">
                          {it.businessDefinition ? (
                            <span className="line-clamp-1 text-slate-700">{it.businessDefinition}</span>
                          ) : (
                            <span className="text-[12.5px] italic text-slate-400">No definition yet</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-[12px] text-slate-500">
                          {it.updatedBy ? `${it.updatedBy.split(/\s+/)[0]}, ` : ""}
                          {it.updatedAt ? new Date(it.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {it.expression && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyText(it.id, fullDefinition(it.name, it.expression!), "Copied name = formula");
                              }}
                              className="rounded-md p-1.5 text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-slate-700 group-hover:opacity-100"
                              title="Copy name = formula"
                            >
                              {copiedId === it.id ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <ul className="divide-y divide-slate-100" role="listbox" aria-label="Dictionary items">
                {items.map((it) => {
                  const tm = typeMeta(it);
                  const active = sel?.id === it.id;
                  return (
                    <li
                      key={it.id}
                      data-item={it.id}
                      role="option"
                      aria-selected={active}
                      onClick={() => handleSelectItem(it)}
                      className={clsx(
                        "relative flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors",
                        active ? "bg-blue-50/70" : "hover:bg-slate-50"
                      )}
                    >
                      {active && <span className="absolute inset-y-0 left-0 w-[3px] bg-blue-600" />}
                      <span className={clsx("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg", tm.tone)} title={tm.label}>
                        <tm.icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-2">
                          <span className={clsx("truncate font-mono text-[13px] font-semibold", active ? "text-blue-900" : "text-slate-900")}>
                            <HighlightText text={it.name} match={searchQuery} active={Boolean(searchQuery.trim())} />
                          </span>
                          {it.isHidden && <EyeOff className="h-3.5 w-3.5 shrink-0 text-slate-300" aria-label="Hidden in reports" />}
                        </span>
                        <span className="mt-0.5 block truncate text-[12px] text-slate-500">
                          <span className="font-mono">{it.tableName}</span>
                          {activeModel === "ALL" && <span> · {it.modelCode}</span>}
                          {it.matchReason && searchQuery && !/Name/.test(it.matchReason) && <span className="text-blue-600"> · {it.matchReason.toLowerCase()}</span>}
                        </span>
                        {it.businessDefinition ? (
                          <span className="mt-1 line-clamp-1 block text-[12.5px] text-slate-600">{it.businessDefinition}</span>
                        ) : (
                          <span className="mt-1 inline-flex items-center gap-1 text-[12px] text-slate-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> No definition yet
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            {!loading && items.length > 0 && items.length < meta.total && (
              <div className="p-3">
                <button
                  type="button"
                  onClick={() => void fetchItems(true)}
                  disabled={loadingMore}
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 text-[13px] font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  {loadingMore && <RefreshCw className="h-4 w-4 animate-spin" />}
                  Show {Math.min(150, meta.total - items.length).toLocaleString()} more
                  <span className="text-slate-400">({(meta.total - items.length).toLocaleString()} left)</span>
                </button>
              </div>
            )}
          </div>

          {/* ---------- Details ---------- */}
          {viewMode === "split" && (
            <section
              className={clsx(
                "flex min-w-0 flex-col bg-white",
                "fixed inset-0 z-40 lg:static lg:z-auto lg:w-[min(48%,620px)] lg:shrink-0",
                detailOpenMobile ? "flex" : "hidden lg:flex"
              )}
              aria-label="Details"
            >
              {!sel || !selMeta ? (
                <div className="grid h-full place-items-center p-8 text-center text-[13px] text-slate-400">Pick something on the left to see what it means.</div>
              ) : (
                <>
                  <div key={sel.id} className="fade-enter min-h-0 flex-1 overflow-y-auto">
                    {/* Title */}
                    <div className="border-b border-slate-100 px-5 pb-4 pt-4">
                      <div className="mb-2 flex items-center gap-2">
                        <button type="button" onClick={() => setDetailOpenMobile(false)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 lg:hidden" aria-label="Back to list">
                          <ArrowRight className="h-4 w-4 rotate-180" />
                        </button>
                        <span className={clsx("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px] font-medium", selMeta.tone)}>
                          <selMeta.icon className="h-3 w-3" />
                          {selMeta.label}
                        </span>
                        <span className="hidden font-mono text-[11.5px] text-slate-400 sm:inline">{sel.modelCode}</span>
                        {sel.isHidden && (
                          <span className="inline-flex items-center gap-1 text-[11.5px] text-slate-400">
                            <EyeOff className="h-3 w-3" /> Hidden in reports
                          </span>
                        )}
                        <div className="ml-auto flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => copyText(`${sel.id}:link`, `${window.location.origin}/dax?model=${sel.modelCode}&item=${encodeURIComponent(sel.id)}`, "Link copied — send it to a teammate")}
                            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                            title="Copy a link to this item"
                            aria-label="Copy link"
                          >
                            {copiedId === `${sel.id}:link` ? <Check className="h-4 w-4 text-emerald-600" /> : <Link className="h-4 w-4" />}
                          </button>
                          {isFormulaItem && can("dax.diagram") && (
                            <button
                              type="button"
                              onClick={() => handleOpenDiagram(sel)}
                              className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[12.5px] font-medium text-slate-700 transition hover:bg-slate-50"
                              title="See how the formula is built"
                            >
                              <Workflow className="h-4 w-4 text-slate-400" /> Diagram
                            </button>
                          )}
                          {(sel.expression || sideboxForm.expression) && (
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setCopyMenuOpen((v) => !v)}
                                className="flex h-8 items-center gap-1 rounded-lg bg-blue-600 pl-2.5 pr-2 text-[12.5px] font-medium text-white transition hover:bg-blue-700"
                                aria-haspopup="menu"
                                aria-expanded={copyMenuOpen}
                              >
                                <Copy className="h-3.5 w-3.5" /> Copy <ChevronDown className="h-3.5 w-3.5 opacity-80" />
                              </button>
                              {copyMenuOpen && (
                                <div role="menu" className="pop-in absolute right-0 top-10 z-30 w-60 rounded-xl border border-slate-200 bg-white p-1.5 text-[13px] shadow-[0_12px_32px_-8px_rgb(16_24_40/0.2)]" onClick={() => setCopyMenuOpen(false)}>
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => copyText(`${sel.id}:full`, fullDefinition(sideboxForm.name || sel.name, sideboxForm.expression || sel.expression || ""), "Copied name = formula")}
                                    className="w-full rounded-lg px-2.5 py-2 text-left hover:bg-slate-50"
                                  >
                                    Name = formula
                                    <span className="block text-[11.5px] text-slate-400">Paste straight into Power BI</span>
                                  </button>
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => copyText(`${sel.id}:expr`, sideboxForm.expression || sel.expression || "", "Copied formula")}
                                    className="w-full rounded-lg px-2.5 py-2 text-left hover:bg-slate-50"
                                  >
                                    Formula only
                                  </button>
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => copyText(`${sel.id}:ref`, `[${sel.name}]`, "Copied reference")}
                                    className="w-full rounded-lg px-2.5 py-2 text-left hover:bg-slate-50"
                                  >
                                    Reference <span className="font-mono text-[12px] text-slate-500">[{sel.name.length > 22 ? sel.name.slice(0, 22) + "…" : sel.name}]</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <h2 className="break-words font-mono text-[18px] font-semibold leading-snug text-slate-900">{sel.name}</h2>
                      <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px]">
                        <div className="flex gap-1.5">
                          <dt className="text-slate-400">Table</dt>
                          <dd>
                            <button type="button" onClick={() => setSelectedTable(sel.tableName)} className="font-mono text-slate-700 hover:text-blue-700 hover:underline" title="Show only this table">
                              {sel.tableName}
                            </button>
                          </dd>
                        </div>
                        <div className="flex gap-1.5">
                          <dt className="text-slate-400">Data type</dt>
                          <dd className="font-mono text-slate-700">{sel.dataType}</dd>
                        </div>
                        {sel.formatString && (
                          <div className="flex gap-1.5">
                            <dt className="text-slate-400">Format</dt>
                            <dd className="font-mono text-slate-700">{sel.formatString}</dd>
                          </div>
                        )}
                      </dl>
                    </div>

                    <div className="space-y-6 px-5 py-5">
                      {/* Team measure identity (editable only for team-written items) */}
                      {sel.isCustom && canEdit && (
                        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_140px]">
                          <label className="block space-y-1">
                            <span className="text-[12px] font-medium text-slate-600">Name</span>
                            <input
                              value={sideboxForm.name}
                              onChange={(e) => setSideboxForm({ ...sideboxForm, name: e.target.value })}
                              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 font-mono text-[12.5px] outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                            />
                          </label>
                          <div className="space-y-1">
                            <span className="text-[12px] font-medium text-slate-600">Table</span>
                            <TableSearchDropdown tables={meta.tables || []} value={sideboxForm.tableName} onChange={(t) => setSideboxForm({ ...sideboxForm, tableName: t })} placeholder="Table" allowAll={false} />
                          </div>
                          <label className="block space-y-1">
                            <span className="text-[12px] font-medium text-slate-600">Data type</span>
                            <select
                              value={sideboxForm.dataType}
                              onChange={(e) => setSideboxForm({ ...sideboxForm, dataType: e.target.value })}
                              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-[12.5px] outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                            >
                              {["Decimal", "Integer", "String", "Currency", "Percentage", "Date", "DateTime", "Boolean"].map((t) => (
                                <option key={t}>{t}</option>
                              ))}
                            </select>
                          </label>
                        </div>
                      )}

                      {/* Meaning */}
                      <section>
                        <div className="mb-1.5 flex items-baseline justify-between">
                          <h3 className="text-[13px] font-semibold text-slate-900">What it means</h3>
                          <span className="hidden text-[11.5px] text-slate-400 sm:inline">In plain words, for anyone reading a report</span>
                        </div>
                        {canEdit ? (
                          <textarea
                            rows={3}
                            value={sideboxForm.businessDefinition}
                            onChange={(e) => setSideboxForm({ ...sideboxForm, businessDefinition: e.target.value })}
                            placeholder="e.g. Net revenue after discounts for inpatient visits, counted on the discharge date."
                            className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13.5px] leading-relaxed text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                          />
                        ) : (
                          <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-slate-700">{sel.businessDefinition || <span className="italic text-slate-400">No definition yet.</span>}</p>
                        )}
                      </section>

                      {/* Formula */}
                      {isFormulaItem && (
                        <section>
                          <div className="mb-1.5 flex items-center justify-between gap-2">
                            <h3 className="text-[13px] font-semibold text-slate-900">Formula</h3>
                            {canEdit &&
                              (formulaEditing ? (
                                <span className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => sideboxForm.expression && setSideboxForm({ ...sideboxForm, expression: formatDax(sideboxForm.expression) })}
                                    className="flex h-7 items-center gap-1 rounded-md px-2 text-[12px] font-medium text-slate-600 hover:bg-slate-100"
                                    title="Indent the formula neatly"
                                  >
                                    <Sparkles className="h-3.5 w-3.5" /> Tidy up
                                  </button>
                                  <button type="button" onClick={() => setFormulaEditing(false)} className="h-7 rounded-md px-2 text-[12px] font-medium text-slate-600 hover:bg-slate-100">
                                    Preview
                                  </button>
                                </span>
                              ) : (
                                <button type="button" onClick={() => setFormulaEditing(true)} className="flex h-7 items-center gap-1 rounded-md px-2 text-[12px] font-medium text-blue-600 hover:bg-blue-50">
                                  <Pencil className="h-3.5 w-3.5" /> Edit formula
                                </button>
                              ))}
                          </div>
                          {formulaEditing ? (
                            <>
                              {!sel.isCustom && (
                                <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] leading-snug text-amber-800">
                                  This formula comes from the model. Saving a change keeps it here as a team version — it doesn&rsquo;t change Power BI.
                                </p>
                              )}
                              <textarea
                                rows={9}
                                value={sideboxForm.expression}
                                onChange={(e) => setSideboxForm({ ...sideboxForm, expression: e.target.value })}
                                spellCheck={false}
                                className="w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[12.5px] leading-relaxed text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                              />
                            </>
                          ) : (
                            <DaxCodeViewer
                              code={sideboxForm.expression || sel.expression || ""}
                              title={sel.name.length > 34 ? sel.name.slice(0, 34) + "…" : sel.name}
                              maxHeight="max-h-72"
                              showLineNumbers
                              allowFormat
                              defaultFormatted
                              theme="light"
                              hideCopy
                            />
                          )}
                        </section>
                      )}

                      {/* Column samples */}
                      {!isFormulaItem && (
                        <section>
                          <div className="mb-1.5 flex items-center justify-between">
                            <h3 className="text-[13px] font-semibold text-slate-900">Example values</h3>
                            <button
                              type="button"
                              onClick={() => handleFetchColumnSamples(sel)}
                              disabled={loadingSamplesId === sel.id}
                              className="flex h-7 items-center gap-1 rounded-md px-2 text-[12px] font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                            >
                              <RefreshCw className={clsx("h-3.5 w-3.5", loadingSamplesId === sel.id && "animate-spin")} />
                              {sampleValuesMap[sel.id]?.length ? "Refresh" : "Load from Power BI"}
                            </button>
                          </div>
                          {sampleValuesMap[sel.id]?.length ? (
                            <div className="flex flex-wrap gap-1.5">
                              {sampleValuesMap[sel.id].slice(0, 10).map((v, i) => (
                                <span key={i} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[12px] text-slate-700">
                                  {String(v)}
                                </span>
                              ))}
                            </div>
                          ) : sampleErrorMap[sel.id] ? (
                            <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800">{sampleErrorMap[sel.id]}</p>
                          ) : (
                            <p className="text-[12.5px] text-slate-400">See a few real values from the model (needs your Power BI connection).</p>
                          )}
                        </section>
                      )}

                      {/* Calculation + notes */}
                      <details className="group rounded-lg border border-slate-200" open={Boolean(sel.mathDefinition || sel.notes)}>
                        <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-[13px] font-semibold text-slate-900">
                          How it&rsquo;s calculated &amp; notes
                          <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
                        </summary>
                        <div className="space-y-3 border-t border-slate-100 px-3 py-3">
                          <label className="block space-y-1">
                            <span className="text-[12px] font-medium text-slate-600">Calculation in short</span>
                            <textarea
                              rows={2}
                              readOnly={!canEdit}
                              value={sideboxForm.mathDefinition}
                              onChange={(e) => setSideboxForm({ ...sideboxForm, mathDefinition: e.target.value })}
                              placeholder="e.g. Net revenue ÷ number of discharged visits"
                              className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-[12.5px] text-slate-800 outline-none transition placeholder:font-sans placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                            />
                          </label>
                          <label className="block space-y-1">
                            <span className="text-[12px] font-medium text-slate-600">Notes for analysts</span>
                            <textarea
                              rows={2}
                              readOnly={!canEdit}
                              value={sideboxForm.notes}
                              onChange={(e) => setSideboxForm({ ...sideboxForm, notes: e.target.value })}
                              placeholder="Filters it depends on, known gotchas, which reports use it"
                              className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                            />
                          </label>
                        </div>
                      </details>

                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 text-[12px] text-slate-500">
                        <span>
                          {sel.updatedAt ? (
                            <>
                              Last edited{sel.updatedBy ? <> by <span className="font-medium text-slate-700">{sel.updatedBy}</span></> : null} · {edited(sel.updatedAt)}
                            </>
                          ) : (
                            "Nobody has documented this yet"
                          )}
                        </span>
                        {sel.isCustom && canEdit && (
                          <button type="button" onClick={() => handleDeleteCustomDax(sel.id)} className="flex items-center gap-1 rounded-md px-2 py-1 font-medium text-rose-600 hover:bg-rose-50">
                            <Trash2 className="h-3.5 w-3.5" /> Delete team measure
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Save bar */}
                  {isSideboxDirty && canEdit && (
                    <div className="pop-in flex items-center justify-between gap-2 border-t border-slate-200 bg-white px-5 py-3 shadow-[0_-8px_16px_-12px_rgb(16_24_40/0.2)]">
                      <span className="flex items-center gap-2 text-[13px] text-slate-600">
                        <span className="h-2 w-2 rounded-full bg-amber-500" /> Unsaved changes
                      </span>
                      <span className="flex items-center gap-2">
                        <button type="button" onClick={handleDiscardEdits} className="h-9 rounded-lg px-3 text-[13px] font-medium text-slate-600 hover:bg-slate-100">
                          Discard
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleSaveSidebox()}
                          disabled={isSavingSidebox}
                          className="flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-4 text-[13px] font-medium text-white transition hover:bg-blue-700 active:scale-[0.98] disabled:opacity-60"
                        >
                          {isSavingSidebox ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          Save
                          <kbd className="rounded bg-white/20 px-1 font-sans text-[10.5px]">Ctrl S</kbd>
                        </button>
                      </span>
                    </div>
                  )}
                  {sideboxSaveSuccess && !isSideboxDirty && (
                    <div className="fade-enter flex items-center gap-2 border-t border-emerald-100 bg-emerald-50 px-5 py-2.5 text-[12.5px] text-emerald-800">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Saved — everyone on the team sees this now.
                    </div>
                  )}
                </>
              )}
            </section>
          )}
        </div>
      </div>

      {/* ================= UNSAVED CHANGES ================= */}
      {showUnsavedModal && (
        <div className="fade-enter fixed inset-0 z-50 grid place-items-center bg-slate-900/35 p-4 backdrop-blur-[2px]">
          <div role="alertdialog" aria-modal="true" aria-labelledby="unsaved-title" className="pop-in w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-600">
                <Pencil className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h3 id="unsaved-title" className="text-[15px] font-semibold text-slate-900">
                  Save your changes first?
                </h3>
                <p className="mt-1 text-[13.5px] leading-relaxed text-slate-600">
                  You edited <span className="font-mono font-medium text-slate-800">{selectedItem?.name}</span> but haven&rsquo;t saved it. If you open{" "}
                  <span className="font-mono font-medium text-slate-800">{pendingSelection?.name || "another item"}</span> now, those edits are lost.
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setShowUnsavedModal(false)} className="h-9 rounded-lg px-3 text-[13.5px] font-medium text-slate-600 hover:bg-slate-100">
                Stay here
              </button>
              <button type="button" onClick={handleDiscardAndProceed} className="h-9 rounded-lg border border-slate-200 px-3 text-[13.5px] font-medium text-rose-600 hover:bg-rose-50">
                Discard edits
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => void handleSaveAndProceed()}
                className="h-9 rounded-lg bg-blue-600 px-4 text-[13.5px] font-medium text-white transition hover:bg-blue-700 active:scale-[0.98]"
              >
                Save &amp; open
              </button>
            </div>
          </div>
        </div>
      )}

      {scriptOpen && <DaxScriptModal model={activeModel} onClose={() => setScriptOpen(false)} />}

      {/* ================= FORMULA DIAGRAM — rendered by the Whiteboard module ================= */}
      {wbDiagramOpen && diagramTarget && (
        <DaxDiagramBoard
          item={{ id: diagramTarget.id, name: diagramTarget.name, tableName: diagramTarget.tableName, modelCode: diagramTarget.modelCode }}
          seedNodes={diagramNodes}
          buildNodes={() => parseDaxToProgrammingAst(diagramTarget.name, diagramTarget.expression, diagramTarget.tableName)}
          onClose={() => setWbDiagramOpen(false)}
        />
      )}

      {/* ================= NEW / EDIT TEAM MEASURE ================= */}
      {customDaxModalOpen && (
        <div className="fade-enter fixed inset-0 z-50 grid place-items-center bg-slate-900/35 p-3 backdrop-blur-[2px] sm:p-6">
          <form
            onSubmit={handleSaveCustomDax}
            role="dialog"
            aria-modal="true"
            aria-labelledby="custom-title"
            onKeyDown={(e) => {
              if (e.key === "Escape") setCustomDaxModalOpen(false);
            }}
            className="pop-in flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div className="min-w-0">
                <h2 id="custom-title" className="text-[16px] font-semibold text-slate-900">
                  {customDaxTarget ? "Edit team measure" : "New team measure"}
                </h2>
                <p className="mt-0.5 text-[12.5px] text-slate-500">
                  Saved in this dictionary for <span className="font-medium text-slate-700">{activeModel === "ALL" ? "every model" : activeModel}</span>{" "}
                  — it doesn&rsquo;t change the Power BI file.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCustomDaxModalOpen(false)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {!customDaxTarget && (
                <div className="mb-4 rounded-lg border border-dashed border-blue-200 bg-blue-50/50 p-3">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <label htmlFor="custom-paste" className="flex items-center gap-1.5 text-[12.5px] font-medium text-blue-900">
                      <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                      Copied it from Power BI? Paste the whole thing here
                    </label>
                    {autoSplitDetected && (
                      <span className="pop-in flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11.5px] font-medium text-emerald-700">
                        <Check className="h-3 w-3" /> Filled in name and formula
                      </span>
                    )}
                  </div>
                  <textarea
                    id="custom-paste"
                    rows={2}
                    value={fullDaxPasteInput}
                    onChange={(e) => handleFullDaxPaste(e.target.value)}
                    spellCheck={false}
                    placeholder="Total Revenue = SUM('fact_sales'[amount])"
                    className="w-full resize-none rounded-md border border-blue-100 bg-white px-2.5 py-2 font-mono text-[12.5px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  />
                  <p className="mt-1 text-[11.5px] text-blue-800/70">Everything before the first &ldquo;=&rdquo; becomes the name; the rest becomes the formula.</p>
                </div>
              )}

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
                {/* Left: identity + meaning */}
                <div className="space-y-3.5">
                  <div>
                    <label htmlFor="custom-name" className="mb-1 block text-[12.5px] font-medium text-slate-700">
                      Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="custom-name"
                      type="text"
                      required
                      autoFocus={!!customDaxTarget}
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="Total Revenue"
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 font-mono text-[13px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <span className="mb-1 block text-[12.5px] font-medium text-slate-700">
                        Table <span className="text-rose-500">*</span>
                      </span>
                      <TableSearchDropdown tables={meta.tables || []} value={customTable} onChange={(t) => setCustomTable(t)} placeholder="Pick a table…" allowAll={false} />
                    </div>
                    <div>
                      <label htmlFor="custom-type" className="mb-1 block text-[12.5px] font-medium text-slate-700">
                        Result type
                      </label>
                      <select
                        id="custom-type"
                        value={customDataType}
                        onChange={(e) => setCustomDataType(e.target.value)}
                        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] text-slate-800 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                      >
                        <option value="Decimal">Decimal number</option>
                        <option value="Integer">Whole number</option>
                        <option value="Currency">Currency</option>
                        <option value="Percentage">Percentage</option>
                        <option value="String">Text</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="custom-business" className="mb-1 block text-[12.5px] font-medium text-slate-700">
                      What it means
                    </label>
                    <textarea
                      id="custom-business"
                      rows={3}
                      value={customBusiness}
                      onChange={(e) => setCustomBusiness(e.target.value)}
                      placeholder="In plain words, for anyone reading a report."
                      className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] leading-relaxed text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>

                  <div>
                    <label htmlFor="custom-math" className="mb-1 block text-[12.5px] font-medium text-slate-700">
                      How it&rsquo;s calculated <span className="font-normal text-slate-400">(optional)</span>
                    </label>
                    <textarea
                      id="custom-math"
                      rows={2}
                      value={customMath}
                      onChange={(e) => setCustomMath(e.target.value)}
                      placeholder="Revenue ÷ number of visits"
                      className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-[12.5px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>

                  <div>
                    <label htmlFor="custom-notes" className="mb-1 block text-[12.5px] font-medium text-slate-700">
                      Notes for the team <span className="font-normal text-slate-400">(optional)</span>
                    </label>
                    <textarea
                      id="custom-notes"
                      rows={2}
                      value={customNotes}
                      onChange={(e) => setCustomNotes(e.target.value)}
                      placeholder="Filters it ignores, where it's used, gotchas…"
                      className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>
                </div>

                {/* Right: formula */}
                <div className="flex min-h-0 flex-col">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-[12.5px] font-medium text-slate-700">
                      Formula <span className="text-rose-500">*</span>
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => customExpression.trim() && setCustomExpression(formatDax(customExpression))}
                        className="flex h-7 items-center gap-1 rounded-md px-2 text-[12px] font-medium text-slate-600 hover:bg-slate-100"
                        title="Indent the formula neatly"
                      >
                        <Sparkles className="h-3.5 w-3.5" /> Tidy up
                      </button>
                      <div className="flex rounded-md bg-slate-100 p-0.5" role="tablist">
                        {(["edit", "preview"] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            role="tab"
                            aria-selected={customDaxTab === t}
                            onClick={() => setCustomDaxTab(t)}
                            className={clsx(
                              "flex h-6 items-center gap-1 rounded px-2 text-[12px] font-medium transition",
                              customDaxTab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                            )}
                          >
                            {t === "edit" ? <Pencil className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                            {t === "edit" ? "Write" : "Preview"}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  {customDaxTab === "edit" ? (
                    <textarea
                      required
                      rows={14}
                      value={customExpression}
                      spellCheck={false}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val.includes("=") && (!customName || customName === "New Measure")) {
                          const eq = val.indexOf("=");
                          const pName = val.slice(0, eq).trim().replace(/^\[+|\]+$/g, "");
                          const pExpr = val.slice(eq + 1).trim();
                          if (pName && pExpr && !/[()'\[]/.test(pName)) {
                            setCustomName(pName);
                            setCustomExpression(pExpr);
                            setAutoSplitDetected(true);
                            setTimeout(() => setAutoSplitDetected(false), 3000);
                            return;
                          }
                        }
                        setCustomExpression(val);
                      }}
                      placeholder={"DIVIDE(\n    SUM('fact_sales'[amount]),\n    DISTINCTCOUNT('fact_sales'[visit_id])\n)"}
                      className="min-h-[300px] w-full flex-1 resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-[12.5px] leading-relaxed text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    />
                  ) : (
                    <div className="min-h-[300px] flex-1">
                      <DaxCodeViewer
                        code={customExpression || "-- Write the formula in the Write tab"}
                        title={customName || "Preview"}
                        maxHeight="max-h-[420px]"
                        showLineNumbers
                        allowFormat={false}
                        theme="light"
                        hideCopy
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
              {customError && (
                <p role="alert" className="mr-auto flex items-center gap-1.5 text-[12.5px] font-medium text-rose-600">
                  <X className="h-3.5 w-3.5" /> {customError}
                </p>
              )}
              <button type="button" onClick={() => setCustomDaxModalOpen(false)} className="h-9 rounded-lg px-4 text-[13.5px] font-medium text-slate-600 hover:bg-slate-100">
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingCustom || !customName.trim() || !customExpression.trim() || !customTable.trim()}
                className="flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-[13.5px] font-medium text-white transition hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSavingCustom ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {customDaxTarget ? "Save changes" : "Add measure"}
              </button>
            </div>
          </form>
        </div>
      )}
      <BimImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => void fetchItems()}
        defaultModel={activeModel}
      />
    </div>
  );
}
