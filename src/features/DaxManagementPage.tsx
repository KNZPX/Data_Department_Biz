"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import {
  Activity,
  ArrowRight,
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
  Upload,
  Download,
} from "lucide-react";
import { BimImportModal } from "@/components/powerbi/BimImportModal";
import { DaxDiagramBoard } from "@/features/whiteboard/DaxDiagramBoard";
import { DaxScriptModal } from "@/components/powerbi/DaxScriptModal";
import { useAccess } from "@/components/auth/LoginGate";
import { clsx } from "clsx";
import { useTheme } from "@/context/ThemeContext";
import { DaxCodeViewer } from "@/components/powerbi/DaxCodeViewer";
import { formatDax } from "@/lib/daxFormatter";
import {
  PortSide as DiagramPortSide,
  NodeConnection as DiagramConnection,
  WhiteboardNode,
  WhiteboardBoard,
  getPortCoordinate as getDiagramPortCoordinate,
} from "@/features/WhiteboardPage";

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
  const { currentTheme } = useTheme();
  const { can } = useAccess();
  const [scriptOpen, setScriptOpen] = useState(false);

  // Floating Sidebar state
  const [floatSidebarOpen, setFloatSidebarOpen] = useState(true);

  // Resizable Split View Width (drag to resize inspector)
  const [splitWidth, setSplitWidth] = useState<number>(460);
  const [isResizingSplit, setIsResizingSplit] = useState<boolean>(false);

  const handleStartResizeSplit = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingSplit(true);
    const startX = e.clientX;
    const startWidth = splitWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX; // dragging left increases right pane width
      const newWidth = Math.min(850, Math.max(320, startWidth + delta));
      setSplitWidth(newWidth);
    };

    const onMouseUp = () => {
      setIsResizingSplit(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

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
    }
  }, []);

  // View Mode: "table" | "split" (was sidebox) | "list" (was split)
  const [viewMode, setViewMode] = useState<"table" | "split" | "list">("split");

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

  // INTERACTIVE DIAGRAM STATE & TOOLBOX (ALIGNED WITH WHITEBOARD ARCHITECTURE)
  const [diagramModalOpen, setDiagramModalOpen] = useState(false);
  // Diagrams always open in the Whiteboard module (the old diagram engine stays dormant).
  const [wbDiagramOpen, setWbDiagramOpen] = useState(false);
  const [diagramTarget, setDiagramTarget] = useState<ItemRecord | null>(null);
  const [diagramNodes, setDiagramNodes] = useState<DiagramNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [diagramZoom, setDiagramZoom] = useState(0.8);
  const [diagramPan, setDiagramPan] = useState<{ x: number; y: number }>({ x: 60, y: 60 });
  const [isDiagramPanning, setIsDiagramPanning] = useState(false);
  const [diagramPanStart, setDiagramPanStart] = useState({ x: 0, y: 0 });
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [connectingSource, setConnectingSource] = useState<{ nodeId: string; fromSide: DiagramPortSide } | null>(null);
  const [liveWireEnd, setLiveWireEnd] = useState<{ x: number; y: number } | null>(null);
  const [editingConnection, setEditingConnection] = useState<{ sourceId: string; targetId: string } | null>(null);
  const [diagramSaveSuccess, setDiagramSaveSuccess] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Diagram Connection Drag Tracking Refs (aligned with Whiteboard system)
  const diagramDragStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDiagramWireDragRef = useRef<boolean>(false);
  const diagramConnectingSourceRef = useRef<{ nodeId: string; fromSide: DiagramPortSide } | null>(null);
  diagramConnectingSourceRef.current = connectingSource;

  // DELETE KEYBOARD SHORTCUT (Del / Backspace) for Diagram Modal
  useEffect(() => {
    if (!diagramModalOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedNodeId) {
          e.preventDefault();
          setDiagramNodes((prev) =>
            prev
              .filter((n) => n.id !== selectedNodeId)
              .map((n) => ({
                ...n,
                connections: (n.connections || []).filter((c) => c.targetId !== selectedNodeId),
              }))
          );
          setSelectedNodeId(null);
          setConnectingSource(null);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [diagramModalOpen, selectedNodeId]);

  // MOUSE WHEEL ZOOM LISTENER for Diagram Modal
  useEffect(() => {
    const el = canvasRef.current;
    if (!el || !diagramModalOpen) return;

    function handleWheel(e: WheelEvent) {
      e.preventDefault();
      const zoomStep = e.deltaY < 0 ? 0.08 : -0.08;
      setDiagramZoom((z) => Math.min(2.0, Math.max(0.3, Number((z + zoomStep).toFixed(2)))));
    }

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [diagramModalOpen]);

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
  const [sideboxDaxTab, setSideboxDaxTab] = useState<"edit" | "preview">("preview");
  // Every newly selected item opens with its formula in read-only preview.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSideboxDaxTab("preview");
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

  // Synchronize Split Form when selected item changes
  useEffect(() => {
    if (selectedItem) {
      setSideboxForm({
        name: selectedItem.name || "",
        tableName: selectedItem.tableName || "",
        dataType: selectedItem.dataType || "Decimal",
        businessDefinition: selectedItem.businessDefinition || "",
        mathDefinition: selectedItem.mathDefinition || "",
        notes: selectedItem.notes || "",
        expression: selectedItem.expression || "",
      });
      setSideboxSaveSuccess(false);
    }
  }, [selectedItem?.id]);

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

  // Save Split inspector changes directly (Supports Full Editing of Name, Table, Type, Expression, and Definitions)
  async function handleSaveSidebox() {
    if (!selectedItem) return;
    setIsSavingSidebox(true);
    setSideboxSaveSuccess(false);

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
            tableName: finalTable,
            objectName: finalName,
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
                name: finalName,
                tableName: finalTable,
                dataType: finalDataType,
                businessDefinition: sideboxForm.businessDefinition,
                mathDefinition: sideboxForm.mathDefinition,
                notes: sideboxForm.notes,
                expression: finalExpr,
                isCustom: selectedItem.isCustom || isStructureChanged,
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
            }
          : null
      );

      setSideboxSaveSuccess(true);
      setTimeout(() => setSideboxSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error("Save error:", err);
      alert("Error saving: " + (err.message || "Unknown error"));
    } finally {
      setIsSavingSidebox(false);
    }
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
          setSelectedNodeId(normalized[0]?.id || null);
          setDiagramZoom(0.8);
          setDiagramPan({ x: 60, y: 60 });
          setConnectingSource(null);
          setLiveWireEnd(null);
          setDiagramSaveSuccess(false);
          setWbDiagramOpen(true);
          return;
        }
      } catch (err) {
        console.error("Failed to parse saved diagram layout", err);
      }
    }
    const parsed = parseDaxToProgrammingAst(item.name, item.expression, item.tableName);
    setDiagramNodes(parsed);
    setSelectedNodeId(parsed[0]?.id || null);
    setDiagramZoom(0.8);
    setDiagramPan({ x: 60, y: 60 });
    setConnectingSource(null);
    setLiveWireEnd(null);
    setDiagramSaveSuccess(false);
    setWbDiagramOpen(true);
  }

  // Complete connection between two diagram nodes
  const completeDiagramConnection = useCallback(
    (sourceId: string, fromSide: DiagramPortSide, targetId: string, toSide: DiagramPortSide) => {
      if (sourceId === targetId) {
        setConnectingSource(null);
        setLiveWireEnd(null);
        return;
      }

      setDiagramNodes((prev) =>
        prev.map((n) => {
          if (n.id === sourceId) {
            const current = n.connections || [];
            if (!current.some((c) => c.targetId === targetId)) {
              return {
                ...n,
                connections: [...current, { targetId, fromSide, toSide, label: "Evaluate" }],
              };
            }
          }
          return n;
        })
      );

      setConnectingSource(null);
      setLiveWireEnd(null);
    },
    []
  );

  // Connect directly to a diagram node (auto-selects best entrance port using getDiagramPortCoordinate)
  const handleConnectToDiagramNode = useCallback(
    (targetNodeId: string) => {
      const src = diagramConnectingSourceRef.current;
      if (!src || src.nodeId === targetNodeId) return;
      const srcNode = diagramNodes.find((n) => n.id === src.nodeId);
      const tgtNode = diagramNodes.find((n) => n.id === targetNodeId);
      let bestSide: DiagramPortSide = "left";
      if (srcNode && tgtNode) {
        const dx = tgtNode.x - srcNode.x;
        const dy = tgtNode.y - srcNode.y;
        if (Math.abs(dx) > Math.abs(dy)) {
          bestSide = dx > 0 ? "left" : "right";
        } else {
          bestSide = dy > 0 ? "top" : "bottom";
        }
      }
      completeDiagramConnection(src.nodeId, src.fromSide, targetNodeId, bestSide);
    },
    [diagramNodes, completeDiagramConnection]
  );

  // 4-Side Port Mouse Event Handlers with Click-to-Connect and Drag-to-Connect
  function handleDiagramPortMouseDown(e: React.MouseEvent, nodeId: string, side: DiagramPortSide) {
    e.stopPropagation();
    e.preventDefault();

    const src = diagramConnectingSourceRef.current;
    if (src) {
      if (src.nodeId !== nodeId) {
        completeDiagramConnection(src.nodeId, src.fromSide, nodeId, side);
        return;
      } else if (src.fromSide === side) {
        setConnectingSource(null);
        setLiveWireEnd(null);
        return;
      }
      setConnectingSource({ nodeId, fromSide: side });
      const srcNode = diagramNodes.find((n) => n.id === nodeId);
      if (srcNode) {
        setLiveWireEnd(getDiagramPortCoordinate(srcNode as any, side));
      }
      return;
    }

    setConnectingSource({ nodeId, fromSide: side });
    const srcNode = diagramNodes.find((n) => n.id === nodeId);
    if (srcNode) {
      const coord = getDiagramPortCoordinate(srcNode as any, side);
      setLiveWireEnd(coord);
    }
    diagramDragStartPosRef.current = { x: e.clientX, y: e.clientY };
    isDiagramWireDragRef.current = true;
  }

  function handleDiagramPortMouseUp(nodeId: string, toSide: DiagramPortSide = "left") {
    const src = diagramConnectingSourceRef.current;
    if (!src) return;
    if (src.nodeId === nodeId) {
      return;
    }
    completeDiagramConnection(src.nodeId, src.fromSide, nodeId, toSide);
  }

  // Global mouse listeners for Diagram wire dragging & connecting via elementFromPoint
  useEffect(() => {
    if (!diagramModalOpen) return;

    function handleGlobalMouseMove(e: MouseEvent) {
      if (diagramConnectingSourceRef.current && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const curX = (e.clientX - rect.left - diagramPan.x) / diagramZoom;
        const curY = (e.clientY - rect.top - diagramPan.y) / diagramZoom;
        setLiveWireEnd({ x: curX, y: curY });
      }
    }

    function handleGlobalMouseUp(e: MouseEvent) {
      if (isDiagramWireDragRef.current && diagramConnectingSourceRef.current) {
        isDiagramWireDragRef.current = false;
        const dist = Math.hypot(
          e.clientX - diagramDragStartPosRef.current.x,
          e.clientY - diagramDragStartPosRef.current.y
        );

        if (dist >= 6) {
          const elem = document.elementFromPoint(e.clientX, e.clientY);

          const portEl = elem?.closest<HTMLElement>("[data-diagram-port-node-id]");
          if (portEl) {
            const tgtNodeId = portEl.getAttribute("data-diagram-port-node-id");
            const tgtSide = (portEl.getAttribute("data-diagram-port-side") || "left") as DiagramPortSide;
            if (tgtNodeId && tgtNodeId !== diagramConnectingSourceRef.current.nodeId) {
              completeDiagramConnection(
                diagramConnectingSourceRef.current.nodeId,
                diagramConnectingSourceRef.current.fromSide,
                tgtNodeId,
                tgtSide
              );
              return;
            }
          }

          const nodeEl = elem?.closest<HTMLElement>("[data-diagram-node-id]");
          if (nodeEl) {
            const tgtNodeId = nodeEl.getAttribute("data-diagram-node-id");
            if (tgtNodeId && tgtNodeId !== diagramConnectingSourceRef.current.nodeId) {
              handleConnectToDiagramNode(tgtNodeId);
              return;
            }
          }

          setConnectingSource(null);
          setLiveWireEnd(null);
        }
      }
    }

    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [diagramModalOpen, diagramPan, diagramZoom, completeDiagramConnection, handleConnectToDiagramNode]);

  // Export current AST diagram directly to Whiteboard system
  function handleExportToWhiteboard(item: ItemRecord, nodes: DiagramNode[]) {
    try {
      const newBoardId = `board_dax_${Date.now()}`;
      const mappedNodes: WhiteboardNode[] = nodes.map((dn) => {
        let nodeType: any = "process";
        if (dn.category === "source") nodeType = "database";
        else if (dn.category === "measure_call") nodeType = "dax";
        else if (dn.category === "filter") nodeType = "process";
        else if (dn.category === "switch") nodeType = "decision";
        else if (dn.category === "output") nodeType = "output";
        else if (dn.category === "calculation") nodeType = "process";

        return {
          id: dn.id,
          type: nodeType,
          title: dn.title,
          description: `${dn.role} • ${dn.detail}`,
          color: dn.color || "#4f46e5",
          x: dn.x,
          y: dn.y,
          width: dn.width || 230,
          height: dn.height || 92,
          connections: dn.connections.map((c) => ({
            targetId: c.targetId,
            fromSide: c.fromSide as any,
            toSide: c.toSide as any,
            label: c.label,
          })),
        };
      });

      const newBoard: WhiteboardBoard = {
        id: newBoardId,
        name: `DAX AST: [${item.name}]`,
        folderId: "folder_financial",
        folderName: "Financial & Cost DAX",
        description: `Exported programming-grade AST workflow for measure [${item.name}] (${item.tableName})`,
        updatedAt: new Date().toISOString(),
        nodes: mappedNodes,
      };

      const saved = localStorage.getItem("powerbi_whiteboard_boards_v2") || localStorage.getItem("powerbi_whiteboard_boards_v1");
      const currentBoards = saved ? JSON.parse(saved) : [];
      localStorage.setItem("powerbi_whiteboard_boards_v2", JSON.stringify([newBoard, ...currentBoards]));
      localStorage.setItem("powerbi_whiteboard_boards_v1", JSON.stringify([newBoard, ...currentBoards]));

      fetch("/api/whiteboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ board: newBoard }),
      }).catch(() => {});

      window.open(`/whiteboard?boardId=${newBoardId}`, "_blank");
    } catch (err) {
      console.error("Failed to export AST diagram to whiteboard", err);
    }
  }

  function handleRemoveDiagramConnection(srcId: string, targetId: string) {
    setDiagramNodes((prev) =>
      prev.map((n) =>
        n.id === srcId
          ? { ...n, connections: (n.connections || []).filter((c) => c.targetId !== targetId) }
          : n
      )
    );
    setEditingConnection(null);
  }

  // Canvas Mouse Event Handlers (Empty space = Hand/Pan, Node = Select/Move)
  function handleDiagramCanvasMouseDown(e: React.MouseEvent) {
    setIsDiagramPanning(true);
    setDiagramPanStart({ x: e.clientX - diagramPan.x, y: e.clientY - diagramPan.y });
    setSelectedNodeId(null);
    setConnectingSource(null);
    setLiveWireEnd(null);
    setEditingConnection(null);
  }

  function handleDiagramCanvasMouseMove(e: React.MouseEvent) {
    if (isDiagramPanning) {
      setDiagramPan({ x: e.clientX - diagramPanStart.x, y: e.clientY - diagramPanStart.y });
      return;
    }

    if (connectingSource && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const curX = (e.clientX - rect.left - diagramPan.x) / diagramZoom;
      const curY = (e.clientY - rect.top - diagramPan.y) / diagramZoom;
      setLiveWireEnd({ x: curX, y: curY });
      return;
    }

    if (draggingNodeId && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const newX = Math.round((e.clientX - rect.left - diagramPan.x) / diagramZoom - dragOffset.x);
      const newY = Math.round((e.clientY - rect.top - diagramPan.y) / diagramZoom - dragOffset.y);

      setDiagramNodes((prev) =>
        prev.map((n) => (n.id === draggingNodeId ? { ...n, x: Math.max(10, newX), y: Math.max(10, newY) } : n))
      );
    }
  }

  function handleDiagramCanvasMouseUp() {
    setIsDiagramPanning(false);
    setDraggingNodeId(null);
  }

  // Node Click & Drag Start (Visual = Select & Move)
  function handleDiagramNodeMouseDown(e: React.MouseEvent, node: DiagramNode) {
    e.stopPropagation();

    // If connecting wire in progress, clicking node finishes connection!
    const src = diagramConnectingSourceRef.current;
    if (src && src.nodeId !== node.id) {
      e.preventDefault();
      handleConnectToDiagramNode(node.id);
      return;
    }

    setSelectedNodeId(node.id);
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();

    setDraggingNodeId(node.id);
    setDragOffset({
      x: (e.clientX - rect.left - diagramPan.x) / diagramZoom - node.x,
      y: (e.clientY - rect.top - diagramPan.y) / diagramZoom - node.y,
    });
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
    const spawnX = Math.round((-diagramPan.x + 360) / diagramZoom);
    const spawnY = Math.round((-diagramPan.y + 200) / diagramZoom);

    const newNode: DiagramNode = {
      id: newId,
      title: config.title,
      category: type,
      role: config.role,
      detail: config.detail,
      x: Math.max(20, spawnX),
      y: Math.max(20, spawnY),
      width: 230,
      height: 92,
      connections: [],
    };

    setDiagramNodes((prev) => [...prev, newNode]);
    setSelectedNodeId(newId);
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
    setDiagramZoom(0.8);
    setDiagramPan({ x: 60, y: 60 });
    setConnectingSource(null);
    setLiveWireEnd(null);
  }
  // Handle Search Input Change with Table Auto-unlock
  function handleSearchInputChange(val: string) {
    setSearchQuery(val);
    if (val.trim()) {
      if (selectedTable !== "all") setSelectedTable("all");
      if (activeModel !== "ALL") setActiveModel("ALL");
      if (selectedType !== "all") setSelectedType("all");
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

  /** Full definition as Power BI expects it: `Measure name = formula`. */
  function fullDefinition(name: string, expr: string) {
    return `${name} =\n${expr}`;
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
    setCustomDaxTab("edit");
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

  // =========================================================================
  // VIEW 0: PRE-SELECTION LANDING SCREEN (CHOOSE SEMANTIC MODEL BEFORE WORKSPACE)
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
              <h2 className="text-[30px] font-semibold tracking-tight text-slate-900">Which model are you working in?</h2>
              <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-slate-500">
                {totalMeasures.toLocaleString()} measures and {totalColumns.toLocaleString()} columns, each with its formula and
                the team&rsquo;s business definition.
              </p>
            </div>
            {can("dax.import") && <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="inline-flex items-center gap-2 self-start rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 active:scale-[0.98]"
            >
              <Upload className="h-4 w-4" />
              Update from .bim
            </button>}
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {realModels.map((m) => (
              <button
                key={m.code}
                type="button"
                onClick={() => {
                  setActiveModel(m.code);
                  setModelChosen(true);
                }}
                className="group rounded-2xl bg-white p-6 text-left ring-1 ring-slate-200/80 transition hover:ring-blue-400"
              >
                <p className="font-mono text-xs text-blue-700">{m.code}</p>
                <p className="mt-1 text-lg font-medium text-slate-900">{m.name}</p>
                <div className="mt-6 flex gap-8">
                  <div>
                    <p className="text-[26px] font-semibold tabular-nums tracking-tight text-slate-900">
                      {(m.totalMeasures || 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-500">measures</p>
                  </div>
                  <div>
                    <p className="text-[26px] font-semibold tabular-nums tracking-tight text-slate-900">
                      {(m.totalColumns || 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-500">columns</p>
                  </div>
                  {(m as any).totalRelationships ? (
                    <div>
                      <p className="text-[26px] font-semibold tabular-nums tracking-tight text-slate-900">
                        {(m as any).totalRelationships}
                      </p>
                      <p className="text-xs text-slate-500">relationships</p>
                    </div>
                  ) : null}
                </div>
                <p className="mt-5 border-t border-slate-100 pt-3 text-xs text-slate-500">
                  {(m as any).lastImportedAt
                    ? `Updated from ${(m as any).sourceFile} on ${new Date((m as any).lastImportedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })} by ${(m as any).lastImportedBy}`
                    : "Not yet updated from a .bim file"}
                </p>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              setActiveModel("ALL");
              setModelChosen(true);
            }}
            className="mt-4 w-full rounded-2xl border border-dashed border-slate-300 p-5 text-left text-sm text-slate-600 hover:border-blue-400 hover:bg-white"
          >
            <span className="font-medium text-slate-900">Search across all models</span>
            <span className="block text-slate-500">Useful when you know the measure name but not where it lives.</span>
          </button>
        </div>
        <BimImportModal
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onImported={() => void fetchItems()}
          defaultModel={activeModel}
        />
      </div>
    );
  }


  return (
    <div className="h-full w-full overflow-hidden flex flex-col gap-3">
      {/* 1. TOP CONTROL BAR (Views & Global Controls - Console removed as requested) */}
      <div className="shrink-0 bg-white rounded-2xl px-4 py-2.5 ring-1 ring-slate-200/80 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs text-blue-700">{currentModelMeta.code}</p>
          <p className="truncate text-[15px] font-medium text-slate-900">{currentModelMeta.name}</p>
        </div>

        {/* View Switcher: Table | Split (was Sidebox) | List (was Split) & Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Switch Model Button */}
          <button
            type="button"
            onClick={() => setModelChosen(false)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition cursor-pointer"
            title="Switch Semantic Model"
          >
            <RotateCcw className="h-3.5 w-3.5 text-blue-600" />
            <span>Switch Model</span>
          </button>

          {can("dax.export") && (
            <a
              href={`/api/dax/export?model=${encodeURIComponent(activeModel)}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              title="Download the whole dataset as an Excel workbook"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export Excel</span>
            </a>
          )}
          {can("dax.generate") && (
            <button
              type="button"
              onClick={() => setScriptOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
              title="Build a script that adds many measures to Power BI at once"
            >
              <Code2 className="h-3.5 w-3.5" />
              <span>Generate for Power BI</span>
            </button>
          )}

          {/* Update from .bim */}
          {can("dax.import") && <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white transition cursor-pointer"
            title="Update this model from a .bim file"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Update from .bim</span>
          </button>}

          {/* Add Custom DAX Button */}
          {can("dax.edit") && <button
            type="button"
            onClick={() => openCustomDaxModal()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
            <span>Add Custom DAX</span>
          </button>}

          {/* Floating Sidebar Toggle Button */}
          <button
            type="button"
            onClick={() => setFloatSidebarOpen(!floatSidebarOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
          >
            <TableIcon className="h-3.5 w-3.5 text-blue-600" />
            <span>{floatSidebarOpen ? "Hide Tables" : "Show Tables"}</span>
          </button>

          {/* View Modes (Table | Split | List) */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-full text-xs">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              title="Table View (Full Grid)"
              className={clsx(
                "flex items-center gap-1 px-3 py-1 rounded-full font-semibold transition cursor-pointer",
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
                "flex items-center gap-1 px-3 py-1 rounded-full font-semibold transition cursor-pointer",
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
                "flex items-center gap-1 px-3 py-1 rounded-full font-semibold transition cursor-pointer",
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
        {/* TABLES NAVIGATOR SIDEBAR */}
        {floatSidebarOpen && (
          <aside className="w-60 lg:w-64 shrink-0 bg-white rounded-2xl p-3 shadow-xs border border-slate-200/80 flex flex-col gap-2.5 overflow-hidden z-20">
            {/* Header: Tables in Model */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <TableIcon className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-semibold text-slate-800">
                  Tables in Model
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-500 px-1.5 py-0.5 rounded-md bg-slate-100">
                  {meta.tables?.length || 0} Total
                </span>
                <button
                  type="button"
                  onClick={() => fetchItems()}
                  title="Reload Tables & Measures"
                  className="text-slate-400 hover:text-slate-600 transition cursor-pointer p-0.5"
                >
                  <RefreshCw className={clsx("h-3.5 w-3.5", loading && "animate-spin")} />
                </button>
              </div>
            </div>

            {/* Table Filter List with Dedicated Search */}
            <div className="flex-1 min-h-0 flex flex-col gap-2">

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
                      ? "bg-blue-600 text-white font-semibold"
                      : "text-slate-600 hover:bg-slate-100"
                  )}
                >
                  <span className="truncate">All Tables</span>
                  <span className="text-[11px] opacity-75">{meta.total}</span>
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
                          ? "bg-blue-600 text-white font-semibold"
                          : "text-slate-600 hover:bg-slate-100"
                      )}
                    >
                      <span className="truncate">{t}</span>
                    </button>
                  );
                })}
              </div>
            </div>

          </aside>
        )}

        {/* MAIN PANEL CONTENT */}
        <main className="flex-1 min-w-0 bg-white rounded-2xl p-3.5 shadow-xs border border-slate-200/80 flex flex-col gap-3 overflow-hidden">
          {/* BULLET FILTERS ROW (POSITIONED DIRECTLY UNDER VIEWS AS REQUESTED) */}
          <div className="shrink-0 flex items-center justify-between gap-2 flex-wrap border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-1 flex-wrap" role="group" aria-label="Filter by type">
              {[
                { id: "all", label: "Everything", count: meta.total, dotColor: "" },
                { id: "measure", label: "Measures", count: meta.totalMeasures, dotColor: "" },
                { id: "column", label: "Columns", count: meta.totalColumns, dotColor: "" },
                { id: "calculated_column", label: "Calculated columns", count: null, dotColor: "" },
                { id: "semantic", label: "From the model", count: meta.totalSemantic || (meta.totalMeasures + meta.totalColumns), dotColor: "" },
                { id: "custom", label: "Written by the team", count: meta.totalCustom || 0, dotColor: "" },
              ].map((pill) => {
                const isSelected = selectedType === pill.id;
                return (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setSelectedType(pill.id)}
                    aria-pressed={isSelected}
                    className={clsx(
                      "relative inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[13px] transition cursor-pointer",
                      isSelected ? "text-slate-900 font-medium" : "text-slate-500 hover:text-slate-800"
                    )}
                  >
                    <span>{pill.label}</span>
                    {pill.count !== null && (
                      <span className="tabular-nums text-xs text-slate-400">{Number(pill.count).toLocaleString()}</span>
                    )}
                    {isSelected && <span className="absolute inset-x-2 -bottom-[11px] h-[2px] rounded-full bg-blue-600" />}
                  </button>
                );
              })}
            </div>

            {/* Results Counter */}
            <span className="text-[11px] font-medium text-slate-500">
              Showing <span className="font-semibold text-slate-900">{items.length}</span> of {meta.total} results
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
                    "px-2.5 py-0.5 rounded-full font-semibold transition cursor-pointer",
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
                    "px-2.5 py-0.5 rounded-full font-semibold transition cursor-pointer",
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
              <span className="font-semibold text-slate-800 bg-slate-100 px-2 py-0.2 rounded-full text-[11px]">
                {activeModel} &bull; {selectedTable === "all" ? "All Tables" : selectedTable}
              </span>
              {searchQuery && (
                <span className="text-[11px] text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.2 rounded-full font-semibold">
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
                  <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-xs text-[11px] font-semibold text-slate-500 border-b border-slate-200/80 z-10">
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
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[11px] font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                                <User className="h-2.5 w-2.5" />
                                <span>Custom</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[11px] font-semibold bg-sky-100 text-sky-800 border border-sky-200">
                                <Database className="h-2.5 w-2.5" />
                                <span>Semantic</span>
                              </span>
                            )}

                            <span
                              className={clsx(
                                "px-1.5 py-0.2 rounded-full text-[11px] font-semibold",
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
                        <td className="py-2 px-3 font-mono font-semibold text-slate-900 whitespace-nowrap">
                          <div>
                            <HighlightText
                              text={it.name}
                              match={searchQuery}
                              active={Boolean(searchQuery.trim())}
                            />
                            {it.matchReason && it.matchReason !== "Exact Name Match" && it.matchReason !== "Name Match" && it.matchReason !== "Name Prefix Match" && (
                              <span className="block text-[11px] text-blue-600 font-sans font-normal mt-0.5">
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
                                    className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 text-[11px] font-mono"
                                  >
                                    {String(val)}
                                  </span>
                                ))
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleFetchColumnSamples(it)}
                                  disabled={loadingSamplesId === it.id}
                                  className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
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
                            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                              <EyeOff className="h-3 w-3" /> Hidden
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600">
                              <Eye className="h-3 w-3" /> Visible
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {(it.type === "Measure" || it.isCustom) && (
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
                                onClick={() => copyText(it.id, fullDefinition(it.name, it.expression!))}
                                title="Copy name = formula"
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
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[11px] font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                                <User className="h-2 w-2" />
                                <span>Custom</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[11px] font-semibold bg-sky-100 text-sky-800 border border-sky-200">
                                <Database className="h-2 w-2" />
                                <span>Semantic</span>
                              </span>
                            )}

                            <span
                              className={clsx(
                                "px-1.5 py-0.2 rounded-full text-[11px] font-semibold",
                                it.type === "Measure"
                                  ? "bg-blue-50 text-blue-700"
                                  : "bg-emerald-50 text-emerald-700"
                              )}
                            >
                              {it.type}
                            </span>

                            <h4 className="font-mono text-xs font-semibold text-slate-900 break-words leading-tight">
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

                {/* Resizable Divider Handle (Drag left/right to resize inspector) */}
                {selectedItem && (
                  <div
                    onMouseDown={handleStartResizeSplit}
                    className={clsx(
                      "w-2 hover:w-3 cursor-col-resize self-stretch my-1 rounded-full transition-all shrink-0 flex items-center justify-center group relative z-20",
                      isResizingSplit ? "bg-blue-600" : "bg-slate-200/80 hover:bg-blue-400"
                    )}
                    title="Drag left/right to adjust Split View inspector width"
                  >
                    <div className="h-8 w-1 rounded-full bg-slate-400 group-hover:bg-white" />
                  </div>
                )}

                {/* Right Compact Inspector Pane (RESIZABLE) */}
                {selectedItem ? (
                  <div
                    style={{ width: `${splitWidth}px` }}
                    className="shrink-0 h-full border border-slate-200/80 rounded-2xl p-3.5 bg-slate-50/50 flex flex-col justify-between overflow-y-auto transition-[width] duration-75"
                  >
                    <div className="space-y-3">
                      {/* Header with Save Changes & Diagram Button */}
                      <div className="flex items-start justify-between pb-2 border-b border-slate-200 gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                            {selectedItem.isCustom ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[11px] font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                                <User className="h-2 w-2" />
                                <span>Custom</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[11px] font-semibold bg-sky-100 text-sky-800 border border-sky-200">
                                <Database className="h-2 w-2" />
                                <span>Semantic</span>
                              </span>
                            )}
                            <span className="text-[11px] font-semibold text-slate-600 bg-slate-200/70 px-1.5 py-0.2 rounded-full">
                              {selectedItem.type}
                            </span>
                          </div>
                          {/* Measure / Column Name (Fully Editable) */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <label
                                className={clsx(
                                  "text-[11px] font-semibold block",
                                  selectedItem.isCustom ? "text-purple-800" : "text-slate-700"
                                )}
                              >
                                {selectedItem.isCustom ? "Custom Measure Name" : "Measure / Column Name"}
                              </label>
                              <span
                                className={clsx(
                                  "text-[11px] font-semibold px-1.5 py-0.2 rounded-md border",
                                  selectedItem.isCustom
                                    ? "text-purple-600 bg-purple-50 border-purple-200"
                                    : "text-blue-600 bg-blue-50 border-blue-200"
                                )}
                              >
                                Editable
                              </span>
                            </div>
                            <input
                              type="text"
                              value={sideboxForm.name}
                              onChange={(e) => setSideboxForm({ ...sideboxForm, name: e.target.value })}
                              placeholder="Name..."
                              className={clsx(
                                "w-full px-2.5 py-1 text-xs font-mono font-semibold rounded-xl border focus:outline-none focus:ring-2 shadow-inner",
                                selectedItem.isCustom
                                  ? "bg-purple-50/40 border-purple-300 text-purple-950 focus:ring-purple-400"
                                  : "bg-slate-50 border-slate-300 text-slate-900 focus:ring-blue-400"
                              )}
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Formula Diagram Button */}
                          {selectedItem.type === "Measure" && (
                            <button
                              type="button"
                              onClick={() => handleOpenDiagram(selectedItem)}
                              title="View Flow Diagram"
                              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition cursor-pointer"
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
                              "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition shadow-xs cursor-pointer",
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
                        <div className="p-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold flex items-center justify-between">
                          <span>Unsaved edits</span>
                          <span className="text-amber-600 underline cursor-pointer font-semibold" onClick={handleSaveSidebox}>
                            Save
                          </span>
                        </div>
                      )}

                      {/* Fully Editable Metadata Grid: Table Name & Data Type */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-semibold text-slate-500 block">
                              Table Name
                            </label>
                            <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-1 py-0.2 rounded border border-blue-200">
                              Editable
                            </span>
                          </div>
                          <TableSearchDropdown
                            tables={meta.tables || []}
                            value={sideboxForm.tableName}
                            onChange={(t) => setSideboxForm({ ...sideboxForm, tableName: t })}
                            placeholder="Select table..."
                            allowAll={false}
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-semibold text-slate-500 block">
                              Data Type
                            </label>
                            <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-1 py-0.2 rounded border border-blue-200">
                              Editable
                            </span>
                          </div>
                          <select
                            value={sideboxForm.dataType}
                            onChange={(e) => setSideboxForm({ ...sideboxForm, dataType: e.target.value })}
                            className="w-full px-2.5 py-1.5 text-xs rounded-xl bg-white border border-slate-200 text-slate-800 font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
                          >
                            <option value="Decimal">Decimal</option>
                            <option value="Integer">Integer</option>
                            <option value="String">String</option>
                            <option value="Currency">Currency</option>
                            <option value="Percentage">Percentage</option>
                            <option value="Date">Date</option>
                            <option value="DateTime">DateTime</option>
                            <option value="Boolean">Boolean</option>
                          </select>
                        </div>
                      </div>

                      {/* Live Column Samples Section */}
                      {selectedItem.type.includes("Column") && (
                        <div className="space-y-1.5 p-2.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              <Zap className="h-3 w-3 text-blue-600" />
                              <span className="text-[11px] font-semibold text-slate-800">
                                Samples (5-10)
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleFetchColumnSamples(selectedItem)}
                              disabled={loadingSamplesId === selectedItem.id}
                              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition disabled:opacity-50 cursor-pointer"
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
                                    className="px-1.5 py-0.2 rounded bg-slate-100 border border-slate-200 text-slate-800 text-[11px] font-mono"
                                  >
                                    {String(val)}
                                  </span>
                                ))}
                              </div>
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded-full border border-emerald-200">
                                <Check className="h-2 w-2" /> In Supabase
                              </span>
                            </div>
                          ) : sampleErrorMap[selectedItem.id] ? (
                            <p className="text-[11px] text-amber-700 bg-amber-50 p-1.5 rounded-xl border border-amber-200 leading-tight">
                              {sampleErrorMap[selectedItem.id]}
                            </p>
                          ) : (
                            <p className="text-[11px] text-slate-400 leading-tight">
                              Click "Fetch" to query distinct samples from Power BI and persist to Supabase.
                            </p>
                          )}
                        </div>
                      )}

                      {/* DAX Formula with Full Syntax Highlighting & Auto-Indentation (Fully Editable) */}
                      {selectedItem.type === "Measure" || selectedItem.expression ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-semibold text-purple-800 block">
                              {selectedItem.isCustom ? "Custom DAX Expression" : "DAX Expression"}
                            </label>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {/* Edit vs Preview Toggle */}
                              <div className="flex items-center bg-purple-50 border border-purple-200 rounded-lg p-0.5 shadow-2xs">
                                <button
                                  type="button"
                                  onClick={() => setSideboxDaxTab("edit")}
                                  className={clsx(
                                    "px-2 py-0.5 rounded-md text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer",
                                    sideboxDaxTab === "edit"
                                      ? "bg-white text-purple-900 shadow-xs"
                                      : "text-purple-600 hover:text-purple-900"
                                  )}
                                >
                                  <Pencil className="h-2 w-2" />
                                  <span>Edit</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSideboxDaxTab("preview")}
                                  className={clsx(
                                    "px-2 py-0.5 rounded-md text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer",
                                    sideboxDaxTab === "preview"
                                      ? "bg-white text-purple-900 shadow-xs"
                                      : "text-purple-600 hover:text-purple-900"
                                  )}
                                >
                                  <Eye className="h-2 w-2" />
                                  <span>Preview</span>
                                </button>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  if (sideboxForm.expression) {
                                    setSideboxForm({
                                      ...sideboxForm,
                                      expression: formatDax(sideboxForm.expression),
                                    });
                                  }
                                }}
                                className="text-[11px] font-semibold text-purple-700 hover:text-purple-800 bg-purple-100 hover:bg-purple-200 border border-purple-300 px-2 py-0.5 rounded-lg flex items-center gap-1 transition cursor-pointer"
                                title="Auto-indent & format DAX syntax"
                              >
                                <Sparkles className="h-2.5 w-2.5 text-purple-600" />
                                <span>Format</span>
                              </button>
                              <button
                                type="button"
                                title="Copy the full definition: name = formula"
                                onClick={() =>
                                  copyText(
                                    `${selectedItem.id}:full`,
                                    fullDefinition(sideboxForm.name || selectedItem.name, sideboxForm.expression || selectedItem.expression || "")
                                  )
                                }
                                className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 cursor-pointer"
                              >
                                {copiedId === `${selectedItem.id}:full` ? <Check className="h-2.5 w-2.5 text-emerald-600" /> : <Copy className="h-2.5 w-2.5" />}
                                <span>{copiedId === `${selectedItem.id}:full` ? "Copied" : "Copy"}</span>
                              </button>
                              <button
                                type="button"
                                title="Copy only the formula (after =)"
                                onClick={() => copyText(`${selectedItem.id}:expr`, sideboxForm.expression || selectedItem.expression || "")}
                                className="text-[11px] font-semibold text-slate-600 hover:text-slate-800 flex items-center gap-0.5 cursor-pointer"
                              >
                                {copiedId === `${selectedItem.id}:expr` ? <Check className="h-2.5 w-2.5 text-emerald-600" /> : <Copy className="h-2.5 w-2.5" />}
                                <span>{copiedId === `${selectedItem.id}:expr` ? "Copied" : "Copy formula"}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenDiagram(selectedItem)}
                                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-0.5 cursor-pointer"
                              >
                                <Workflow className="h-2.5 w-2.5" />
                                <span>Diagram</span>
                              </button>
                            </div>
                          </div>
                          {sideboxDaxTab === "edit" ? (
                            <textarea
                              rows={6}
                              value={sideboxForm.expression}
                              onChange={(e) =>
                                setSideboxForm({ ...sideboxForm, expression: e.target.value })
                              }
                              placeholder="e.g. CALCULATE(COUNTROWS(...), ...)"
                              className="w-full p-2.5 rounded-xl bg-slate-900 text-emerald-400 font-mono text-xs border border-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500 resize-y shadow-inner leading-relaxed"
                            />
                          ) : (
                            <DaxCodeViewer
                              code={sideboxForm.expression || selectedItem.expression || "-- No expression"}
                              title="Live Preview"
                              maxHeight="max-h-60"
                              showLineNumbers={true}
                              allowFormat={false}
                            />
                          )}
                        </div>
                      ) : null}

                      {/* Business Definition (Compact Textarea) */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-700 block">
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
                        <label className="text-[11px] font-semibold text-slate-700 block">
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
                        <label className="text-[11px] font-semibold text-slate-700 block">
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

                    </div>

                    {selectedItem.isCustom && (
                      <div className="pt-2 border-t border-slate-200 mt-3 flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomDax(selectedItem.id)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 transition cursor-pointer"
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
                          <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[11px] font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                            <User className="h-2 w-2" />
                            <span>Custom</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[11px] font-semibold bg-sky-100 text-sky-800 border border-sky-200">
                            <Database className="h-2 w-2" />
                            <span>Semantic</span>
                          </span>
                        )}

                        <span
                          className={clsx(
                            "px-2 py-0.2 rounded-full text-[11px] font-semibold",
                            it.type === "Measure"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-emerald-50 text-emerald-700"
                          )}
                        >
                          {it.type}
                        </span>

                        <span className="font-mono text-xs font-semibold text-slate-900">
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
                        {it.expression && (
                          <button
                            type="button"
                            onClick={() => copyText(it.id, fullDefinition(it.name, it.expression!))}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-white text-blue-700 hover:bg-blue-50 border border-blue-200 transition cursor-pointer"
                          >
                            {copiedId === it.id ? (
                              <Check className="h-3 w-3 text-emerald-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                            <span>{copiedId === it.id ? "Copied" : "Copy DAX"}</span>
                          </button>
                        )}
                        {(it.type === "Measure" || it.isCustom) && (
                          <button
                            type="button"
                            onClick={() => handleOpenDiagram(it)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition cursor-pointer"
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
                          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 transition cursor-pointer"
                        >
                          <Pencil className="h-3 w-3" />
                          <span>Edit</span>
                        </button>
                      </div>
                    </div>

                    {it.businessDefinition && (
                      <div className="p-2 rounded-xl bg-white border border-slate-200/80 text-xs text-slate-700">
                        <span className="font-semibold text-slate-400 text-[11px] block mb-0.5">
                          Business Meaning
                        </span>
                        {it.businessDefinition}
                      </div>
                    )}

                    {it.expression && (
                      <div className="mt-2">
                        <DaxCodeViewer
                          code={it.expression}
                          title={it.name}
                          maxHeight="max-h-44"
                          showLineNumbers={true}
                          allowFormat={true}
                          defaultFormatted={true}
                          onCopy={() => copyText(it.id, it.expression!)}
                        />
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
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 flex flex-col gap-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-amber-100 text-amber-700 grid place-items-center shrink-0">
                <HelpCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Unsaved Changes</h3>
                <p className="text-xs text-slate-500">
                  You have unsaved edits on{" "}
                  <span className="font-mono font-semibold text-slate-800">
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
                className="px-4 py-2 rounded-full text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={handleDiscardAndProceed}
                className="px-4 py-2 rounded-full text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition cursor-pointer"
              >
                Discard & Switch
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

      {/* ================= CUSTOM DAX MODAL (SPLIT-STYLED WITH FULL DAX AUTO-SPLIT) ================= */}
      {customDaxModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-5xl bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 flex flex-col gap-4 animate-in fade-in zoom-in-95 my-auto max-h-[92vh] overflow-y-auto">
            {/* Header matching Split style */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                  <User className="h-3 w-3" />
                  <span>CUSTOM</span>
                </span>
                <span className="text-[11px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full border border-slate-200">
                  CUSTOM DAX AUTHORING
                </span>
              </div>
              <button
                type="button"
                onClick={() => setCustomDaxModalOpen(false)}
                className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 grid place-items-center transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {customError && (
              <div className="p-2.5 rounded-xl bg-rose-50 text-rose-700 text-xs font-semibold border border-rose-200">
                {customError}
              </div>
            )}

            {/* FULL DAX AUTO-SPLIT PASTE CARD */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-purple-50 via-indigo-50/50 to-blue-50 border border-purple-200/80 space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-purple-900 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                  <span>Paste Entire DAX Definition (Auto-Splits Name &amp; Expression)</span>
                </label>
                {autoSplitDetected && (
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                    <Check className="h-3 w-3" /> Auto-split applied!
                  </span>
                )}
              </div>
              <textarea
                rows={2}
                value={fullDaxPasteInput}
                onChange={(e) => handleFullDaxPaste(e.target.value)}
                placeholder="Paste whole DAX here, e.g. day_remaining = VAR _year = MAX('dim_date'[Year]) ... RETURN ..."
                className="w-full p-2.5 text-xs rounded-xl bg-white border border-purple-200 text-slate-800 font-mono placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-400 shadow-inner resize-none"
              />
              <span className="text-[11px] text-purple-700/80 block">
                Everything before the first "=" becomes the <b>Measure Name</b>, and everything after becomes the <b>Expression</b>.
              </span>
            </div>

            <form onSubmit={handleSaveCustomDax} className="space-y-4">
              {/* DUAL-COLUMN GRID TO FIT ON SCREEN WITHOUT VERTICAL SCROLLBAR */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* LEFT COLUMN: METADATA & DESCRIPTIONS */}
                <div className="space-y-2.5">
                  {/* Measure Name */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-700 block">
                      Measure Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="e.g. day_remaining"
                      className="w-full px-3 py-1.5 text-xs font-mono font-semibold rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                    />
                  </div>

                  {/* Table & Type */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-700 block">
                        Table Name *
                      </label>
                      <TableSearchDropdown
                        tables={meta.tables || []}
                        value={customTable}
                        onChange={(t) => setCustomTable(t)}
                        placeholder="Select table..."
                        allowAll={false}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-700 block">
                        Data Type
                      </label>
                      <select
                        value={customDataType}
                        onChange={(e) => setCustomDataType(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-mono font-semibold"
                      >
                        <option value="Decimal">Decimal</option>
                        <option value="Integer">Integer</option>
                        <option value="String">String</option>
                        <option value="Currency">Currency</option>
                        <option value="Percentage">Percentage</option>
                      </select>
                    </div>
                  </div>

                  {/* Business Definition */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-700 block">
                      Business Definition / Meaning
                    </label>
                    <textarea
                      rows={2}
                      value={customBusiness}
                      onChange={(e) => setCustomBusiness(e.target.value)}
                      placeholder="Business rationale, definition..."
                      className="w-full p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none shadow-2xs"
                    />
                  </div>

                  {/* Mathematical Formulation */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-700 block">
                      Mathematical Formulation
                    </label>
                    <textarea
                      rows={2}
                      value={customMath}
                      onChange={(e) => setCustomMath(e.target.value)}
                      placeholder="Formula notation (e.g. SUM(A)/COUNT(B))..."
                      className="w-full p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono resize-none shadow-2xs"
                    />
                  </div>

                  {/* Technical Notes */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-700 block">
                      Technical Notes
                    </label>
                    <textarea
                      rows={2}
                      value={customNotes}
                      onChange={(e) => setCustomNotes(e.target.value)}
                      placeholder="Filter context notes, dependencies..."
                      className="w-full p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none shadow-2xs"
                    />
                  </div>
                </div>

                {/* RIGHT COLUMN: SINGLE-CONTAINER DAX EDITOR WITH EDIT / PREVIEW TABS (NO DOUBLE SCROLLBARS) */}
                <div className="space-y-2 flex flex-col justify-between">
                  <div className="space-y-1 flex-1 flex flex-col">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-semibold text-purple-800 block">
                        Custom DAX Expression *
                      </label>
                      <div className="flex items-center gap-2">
                        {/* Segmented View Mode Tabs: Edit vs Preview */}
                        <div className="flex items-center bg-purple-50 border border-purple-200 rounded-lg p-0.5 shadow-2xs">
                          <button
                            type="button"
                            onClick={() => setCustomDaxTab("edit")}
                            className={clsx(
                              "px-2.5 py-0.5 rounded-md text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer",
                              customDaxTab === "edit"
                                ? "bg-white text-purple-900 shadow-xs"
                                : "text-purple-600 hover:text-purple-900"
                            )}
                          >
                            <Pencil className="h-2.5 w-2.5" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setCustomDaxTab("preview")}
                            className={clsx(
                              "px-2.5 py-0.5 rounded-md text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer",
                              customDaxTab === "preview"
                                ? "bg-white text-purple-900 shadow-xs"
                                : "text-purple-600 hover:text-purple-900"
                            )}
                          >
                            <Eye className="h-2.5 w-2.5" />
                            <span>Preview</span>
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (customExpression.trim()) {
                              setCustomExpression(formatDax(customExpression));
                            }
                          }}
                          className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-800 text-[11px] font-semibold border border-purple-300 transition cursor-pointer"
                          title="Auto-indent & format DAX syntax"
                        >
                          <Sparkles className="h-2.5 w-2.5 text-purple-600" />
                          <span>Auto-Format</span>
                        </button>
                      </div>
                    </div>

                    {/* Single Clean Editor Container */}
                    {customDaxTab === "edit" ? (
                      <textarea
                        required
                        rows={11}
                        value={customExpression}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val.includes("=") && (!customName || customName === "New Measure")) {
                            const eq = val.indexOf("=");
                            const pName = val.slice(0, eq).trim().replace(/^\[+|\]+$/g, "");
                            const pExpr = val.slice(eq + 1).trim();
                            if (pName && pExpr) {
                              setCustomName(pName);
                              setCustomExpression(pExpr);
                              setAutoSplitDetected(true);
                              setTimeout(() => setAutoSplitDetected(false), 3000);
                              return;
                            }
                          }
                          setCustomExpression(val);
                        }}
                        placeholder="e.g. DIVIDE(SUM('fact_patient_visit'[total_hours]), 24, 0)"
                        className="w-full p-3 text-xs rounded-xl bg-slate-900 font-mono text-emerald-400 border border-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none shadow-inner leading-relaxed min-h-[260px]"
                      />
                    ) : (
                      <div className="flex-1 min-h-[260px]">
                        <DaxCodeViewer
                          code={customExpression || "-- Type or paste DAX in Edit tab to preview"}
                          title="Syntax Preview"
                          maxHeight="max-h-[300px]"
                          showLineNumbers={true}
                          allowFormat={false}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCustomDaxModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingCustom || !customName.trim() || !customExpression.trim()}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isSavingCustom ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  <span>Save Custom DAX</span>
                </button>
              </div>
            </form>
          </div>
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
