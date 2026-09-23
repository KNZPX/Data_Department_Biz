"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  Workflow,
  Plus,
  Trash2,
  Copy,
  Download,
  Upload,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Move,
  Link as LinkIcon,
  Pencil,
  Check,
  ChevronDown,
  ChevronLeft,
  Sparkles,
  Boxes,
  Database,
  GitBranch,
  FunctionSquare,
  PlayCircle,
  CheckCircle2,
  Search,
  Calendar,
  Layers,
  ArrowRight,
  HelpCircle,
  X,
} from "lucide-react";
import { clsx } from "clsx";
import { useTheme } from "@/context/ThemeContext";

export type PortSide = "top" | "right" | "bottom" | "left";

export interface NodeConnection {
  targetId: string;
  fromSide?: PortSide;
  toSide?: PortSide;
  label?: string;
}

export interface WhiteboardNode {
  id: string;
  type: "sticky" | "process" | "decision" | "trigger" | "database" | "dax" | "output";
  title: string;
  description: string;
  color?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  connections: NodeConnection[];
}

export interface WhiteboardBoard {
  id: string;
  name: string;
  description?: string;
  updatedAt: string;
  nodes: WhiteboardNode[];
}

const DEFAULT_BOARDS: WhiteboardBoard[] = [
  {
    id: "board_patient_flow",
    name: "Hospital Patient Journey & KPIs",
    description: "End-to-end clinical workflow from OPD check-in to triage, diagnostics, billing, and executive dashboard.",
    updatedAt: new Date().toISOString(),
    nodes: [
      {
        id: "node_1",
        type: "trigger",
        title: "Patient Check-in / Registration",
        description: "Arrival at OPD Desk • Captures Visit Time, HN & Market Type",
        color: "#0284c7",
        x: 80,
        y: 180,
        width: 220,
        height: 100,
        connections: [{ targetId: "node_2", fromSide: "right", toSide: "left", label: "Registered" }],
      },
      {
        id: "node_2",
        type: "process",
        title: "Triage & Vitals Assessment",
        description: "Nurse screening • Blood pressure, acuity triage score",
        color: "#4f46e5",
        x: 380,
        y: 180,
        width: 230,
        height: 100,
        connections: [
          { targetId: "node_3", fromSide: "right", toSide: "left", label: "Standard Flow" },
          { targetId: "node_sticky_1", fromSide: "bottom", toSide: "top", label: "Protocol" },
        ],
      },
      {
        id: "node_sticky_1",
        type: "sticky",
        title: "SLA Alert Target",
        description: "Triage must complete under 15 minutes for Tier 1 ER cases.",
        color: "#fef08a",
        x: 380,
        y: 350,
        width: 210,
        height: 110,
        connections: [],
      },
      {
        id: "node_3",
        type: "decision",
        title: "Requires Lab / Imaging?",
        description: "Doctor orders diagnostic tests or immediate prescription",
        color: "#d97706",
        x: 700,
        y: 180,
        width: 220,
        height: 110,
        connections: [
          { targetId: "node_4", fromSide: "top", toSide: "left", label: "Yes (Lab/X-Ray)" },
          { targetId: "node_5", fromSide: "bottom", toSide: "left", label: "No (Direct Rx)" },
        ],
      },
      {
        id: "node_4",
        type: "database",
        title: "fact_patient_visit & Orders",
        description: "Logs order timestamps, lab turnaround times & item charges",
        color: "#0d9488",
        x: 1020,
        y: 80,
        width: 230,
        height: 100,
        connections: [{ targetId: "node_6", fromSide: "right", toSide: "top", label: "Aggregated" }],
      },
      {
        id: "node_5",
        type: "process",
        title: "Cashier & Pharmacy Dispensing",
        description: "Settlement via insurance or self-pay • Medication delivery",
        color: "#4f46e5",
        x: 1020,
        y: 280,
        width: 230,
        height: 100,
        connections: [{ targetId: "node_6", fromSide: "right", toSide: "bottom", label: "Final Billing" }],
      },
      {
        id: "node_6",
        type: "dax",
        title: "DAX: [_avg_opd_turnaround_time]",
        description: "CALCULATE( AVERAGE(fact_visit[minutes]), fact_visit[is_complete]=1 )",
        color: "#7c3aed",
        x: 1350,
        y: 180,
        width: 250,
        height: 110,
        connections: [{ targetId: "node_7", fromSide: "right", toSide: "left", label: "Evaluated KPI" }],
      },
      {
        id: "node_7",
        type: "output",
        title: "Executive Hospital Dashboard",
        description: "Daily Strategy Monitor • Real-time patient volume & SLA metrics",
        color: "#059669",
        x: 1690,
        y: 180,
        width: 230,
        height: 100,
        connections: [],
      },
    ],
  },
  {
    id: "board_revenue_pipeline",
    name: "Revenue & Billing Pipeline",
    description: "Data pipeline flow aggregating patient invoices, insurance segmentation, and monthly budget measures.",
    updatedAt: new Date().toISOString(),
    nodes: [
      {
        id: "rev_1",
        type: "database",
        title: "fact_patient_bill",
        description: "Raw billing receipts, net revenue, discount splits",
        color: "#0d9488",
        x: 100,
        y: 160,
        width: 230,
        height: 100,
        connections: [{ targetId: "rev_2", fromSide: "right", toSide: "left", label: "Extract" }],
      },
      {
        id: "rev_2",
        type: "process",
        title: "Payor Segmentation ETL",
        description: "Classifies: SSO, Thai Private Ins, Expat, Inter Ins",
        color: "#4f46e5",
        x: 420,
        y: 160,
        width: 230,
        height: 100,
        connections: [{ targetId: "rev_3", fromSide: "right", toSide: "left", label: "Apply Logic" }],
      },
      {
        id: "rev_3",
        type: "dax",
        title: "DAX: [_net_revenue]",
        description: "SUM( fact_patient_bill[net_amount] )",
        color: "#7c3aed",
        x: 740,
        y: 160,
        width: 240,
        height: 100,
        connections: [{ targetId: "rev_4", fromSide: "right", toSide: "left", label: "Publish" }],
      },
      {
        id: "rev_4",
        type: "output",
        title: "D02 Financial Semantic Model",
        description: "Live Power BI semantic model for budget tracking",
        color: "#059669",
        x: 1070,
        y: 160,
        width: 240,
        height: 100,
        connections: [],
      },
    ],
  },
];

const LOCAL_STORAGE_KEY = "powerbi_whiteboard_boards_v1";

// Calculate exact port coordinate given node geometry and side
export function getPortCoordinate(node: WhiteboardNode, side: PortSide = "right"): { x: number; y: number } {
  switch (side) {
    case "top":
      return { x: node.x + node.width / 2, y: node.y };
    case "right":
      return { x: node.x + node.width, y: node.y + node.height / 2 };
    case "bottom":
      return { x: node.x + node.width / 2, y: node.y + node.height };
    case "left":
      return { x: node.x, y: node.y + node.height / 2 };
  }
}

export function WhiteboardPage() {
  const { currentTheme } = useTheme();

  // 1. PAGE VIEW: "list" (Gallery First) vs "canvas" (Interactive Editor)
  const [viewState, setViewState] = useState<"list" | "canvas">("list");
  const [boardSearchQuery, setBoardSearchQuery] = useState("");

  // Boards State
  const [boards, setBoards] = useState<WhiteboardBoard[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<string>("");
  const [isRenamingBoard, setIsRenamingBoard] = useState(false);
  const [boardTitleInput, setBoardTitleInput] = useState("");

  // Canvas Viewport State (Zoom & Pan)
  const [zoom, setZoom] = useState<number>(0.8); // 80% Default Zoom
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 60, y: 60 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Node Drag & Selection
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // 4-Side Port Interactive Wiring State
  const [connectingSource, setConnectingSource] = useState<{ nodeId: string; fromSide: PortSide } | null>(null);
  const [liveWireEnd, setLiveWireEnd] = useState<{ x: number; y: number } | null>(null);
  const [editingConnection, setEditingConnection] = useState<{ sourceId: string; targetId: string } | null>(null);

  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // Initialize from LocalStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setBoards(parsed);
          setActiveBoardId(parsed[0].id);
          setBoardTitleInput(parsed[0].name);
          return;
        }
      }
    } catch (e) {
      console.error("Failed to load boards from localStorage", e);
    }
    setBoards(DEFAULT_BOARDS);
    setActiveBoardId(DEFAULT_BOARDS[0].id);
    setBoardTitleInput(DEFAULT_BOARDS[0].name);
  }, []);

  // Persist to LocalStorage
  const persistBoards = useCallback((newBoards: WhiteboardBoard[]) => {
    setBoards(newBoards);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newBoards));
    } catch (e) {
      console.error("Failed to persist boards", e);
    }
  }, []);

  const activeBoard = useMemo(() => {
    return boards.find((b) => b.id === activeBoardId) || boards[0] || null;
  }, [boards, activeBoardId]);

  // Update nodes of active board
  const updateActiveNodes = useCallback(
    (updater: (nodes: WhiteboardNode[]) => WhiteboardNode[]) => {
      if (!activeBoard) return;
      const updatedNodes = updater(activeBoard.nodes);
      const updatedBoards = boards.map((b) =>
        b.id === activeBoard.id ? { ...b, nodes: updatedNodes, updatedAt: new Date().toISOString() } : b
      );
      persistBoards(updatedBoards);
    },
    [activeBoard, boards, persistBoards]
  );

  // 2. DELETE KEYBOARD SHORTCUT (Del / Backspace)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (viewState !== "canvas") return;
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedNodeId) {
          e.preventDefault();
          updateActiveNodes((nodes) =>
            nodes
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
  }, [viewState, selectedNodeId, updateActiveNodes]);

  // 3. MOUSE WHEEL ZOOM LISTENER
  useEffect(() => {
    const el = canvasContainerRef.current;
    if (!el || viewState !== "canvas") return;

    function handleWheel(e: WheelEvent) {
      e.preventDefault();
      const zoomStep = e.deltaY < 0 ? 0.08 : -0.08;
      setZoom((z) => Math.min(2.0, Math.max(0.3, Number((z + zoomStep).toFixed(2)))));
    }

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [viewState]);

  // Open Canvas for specific board
  function handleOpenBoard(boardId: string) {
    setActiveBoardId(boardId);
    setSelectedNodeId(null);
    setConnectingSource(null);
    setZoom(0.8);
    setPan({ x: 60, y: 60 });
    const b = boards.find((x) => x.id === boardId);
    if (b) setBoardTitleInput(b.name);
    setViewState("canvas");
  }

  // Create New Board
  function handleCreateNewBoard() {
    const newId = `board_${Date.now()}`;
    const newBoard: WhiteboardBoard = {
      id: newId,
      name: `Workflow Board ${boards.length + 1}`,
      description: "Custom visual workflow schema drafted on interactive canvas.",
      updatedAt: new Date().toISOString(),
      nodes: [
        {
          id: `node_${Date.now()}_1`,
          type: "process",
          title: "Initial Step",
          description: "Click to edit title or drag from 4 ports to connect",
          color: "#4f46e5",
          x: 200,
          y: 180,
          width: 220,
          height: 100,
          connections: [],
        },
      ],
    };
    const updated = [newBoard, ...boards];
    persistBoards(updated);
    setActiveBoardId(newId);
    setBoardTitleInput(newBoard.name);
    setViewState("canvas");
  }

  // Rename Current Board
  function handleRenameBoardSubmit() {
    if (!activeBoard || !boardTitleInput.trim()) {
      setIsRenamingBoard(false);
      return;
    }
    const updated = boards.map((b) =>
      b.id === activeBoard.id ? { ...b, name: boardTitleInput.trim(), updatedAt: new Date().toISOString() } : b
    );
    persistBoards(updated);
    setIsRenamingBoard(false);
  }

  // Delete Board
  function handleDeleteBoard(boardId: string, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    if (boards.length <= 1) {
      alert("At least one whiteboard must remain.");
      return;
    }
    const targetBoard = boards.find((b) => b.id === boardId);
    if (!confirm(`Are you sure you want to delete "${targetBoard?.name || "this board"}"?`)) return;
    const remaining = boards.filter((b) => b.id !== boardId);
    persistBoards(remaining);
    if (activeBoardId === boardId) {
      setActiveBoardId(remaining[0].id);
      setBoardTitleInput(remaining[0].name);
      setViewState("list");
    }
  }

  // Duplicate Board
  function handleDuplicateBoard(boardId: string, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    const target = boards.find((b) => b.id === boardId);
    if (!target) return;
    const newId = `board_${Date.now()}`;
    const duplicated: WhiteboardBoard = {
      ...target,
      id: newId,
      name: `${target.name} (Copy)`,
      updatedAt: new Date().toISOString(),
      nodes: JSON.parse(JSON.stringify(target.nodes)),
    };
    const updated = [duplicated, ...boards];
    persistBoards(updated);
  }

  // Add Element from Palette
  function handleAddNode(type: WhiteboardNode["type"], stickyColor?: string) {
    if (!activeBoard) return;
    const newId = `node_${Date.now().toString().slice(-5)}`;

    const nodeTemplates: Record<
      WhiteboardNode["type"],
      { title: string; description: string; color: string; width: number; height: number }
    > = {
      sticky: {
        title: "Idea / Note",
        description: "Jot down team decisions, business logic, or governance rules",
        color: stickyColor || "#fef08a",
        width: 200,
        height: 120,
      },
      process: {
        title: "Process Step",
        description: "Transformation or operational procedure",
        color: "#4f46e5",
        width: 220,
        height: 100,
      },
      decision: {
        title: "Decision / Gateway",
        description: "Conditional branch (Yes / No criteria)",
        color: "#d97706",
        width: 220,
        height: 110,
      },
      trigger: {
        title: "Trigger / Event",
        description: "Initiates workflow execution or user action",
        color: "#0284c7",
        width: 220,
        height: 95,
      },
      database: {
        title: "Data Table / Warehouse",
        description: "Source schema (e.g. fact_patient_visit, dim_date)",
        color: "#0d9488",
        width: 230,
        height: 100,
      },
      dax: {
        title: "DAX Calculation Metric",
        description: "CALCULATE( SUM('fact'[amt]), 'dim'[flag]=1 )",
        color: "#7c3aed",
        width: 240,
        height: 110,
      },
      output: {
        title: "KPI / Report Visual",
        description: "Final evaluated target in executive report",
        color: "#059669",
        width: 230,
        height: 100,
      },
    };

    const template = nodeTemplates[type];
    const spawnX = Math.round((-pan.x + 360) / zoom);
    const spawnY = Math.round((-pan.y + 220) / zoom);

    const newNode: WhiteboardNode = {
      id: newId,
      type,
      title: template.title,
      description: template.description,
      color: template.color,
      x: Math.max(20, spawnX),
      y: Math.max(20, spawnY),
      width: template.width,
      height: template.height,
      connections: [],
    };

    updateActiveNodes((nodes) => [...nodes, newNode]);
    setSelectedNodeId(newId);
  }

  // 4. PORT CLICK OR DRAG START
  function handlePortMouseDown(e: React.MouseEvent, nodeId: string, side: PortSide) {
    e.stopPropagation();
    setConnectingSource({ nodeId, fromSide: side });
    const srcNode = activeBoard?.nodes.find((n) => n.id === nodeId);
    if (srcNode) {
      const coord = getPortCoordinate(srcNode, side);
      setLiveWireEnd(coord);
    }
  }

  // Complete Connection on target node or target port
  function handlePortMouseUp(nodeId: string, toSide: PortSide = "left") {
    if (!connectingSource) return;
    if (connectingSource.nodeId === nodeId) {
      setConnectingSource(null);
      setLiveWireEnd(null);
      return;
    }

    const { nodeId: srcId, fromSide } = connectingSource;
    updateActiveNodes((nodes) =>
      nodes.map((n) => {
        if (n.id === srcId) {
          const current = n.connections || [];
          if (!current.some((c) => c.targetId === nodeId)) {
            return {
              ...n,
              connections: [...current, { targetId: nodeId, fromSide, toSide, label: "Flow" }],
            };
          }
        }
        return n;
      })
    );

    setConnectingSource(null);
    setLiveWireEnd(null);
  }

  function handleRemoveConnection(srcId: string, targetId: string) {
    updateActiveNodes((nodes) =>
      nodes.map((n) => {
        if (n.id === srcId) {
          return {
            ...n,
            connections: (n.connections || []).filter((c) => c.targetId !== targetId),
          };
        }
        return n;
      })
    );
    setEditingConnection(null);
  }

  // 5. CANVAS MOUSE HANDLERS (EMPTY SPACE = HAND/PAN, NODE = SELECT/MOVE)
  function handleCanvasMouseDown(e: React.MouseEvent) {
    // If user clicked directly on canvas background (empty space), initiate PAN
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    setSelectedNodeId(null);
    setConnectingSource(null);
    setLiveWireEnd(null);
  }

  function handleCanvasMouseMove(e: React.MouseEvent) {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      return;
    }

    if (connectingSource && canvasContainerRef.current) {
      const rect = canvasContainerRef.current.getBoundingClientRect();
      const curX = (e.clientX - rect.left - pan.x) / zoom;
      const curY = (e.clientY - rect.top - pan.y) / zoom;
      setLiveWireEnd({ x: curX, y: curY });
      return;
    }

    if (draggingNodeId && canvasContainerRef.current) {
      const rect = canvasContainerRef.current.getBoundingClientRect();
      const newX = Math.round((e.clientX - rect.left - pan.x) / zoom - dragOffset.x);
      const newY = Math.round((e.clientY - rect.top - pan.y) / zoom - dragOffset.y);

      updateActiveNodes((nodes) =>
        nodes.map((n) => (n.id === draggingNodeId ? { ...n, x: Math.max(10, newX), y: Math.max(10, newY) } : n))
      );
    }
  }

  function handleCanvasMouseUp() {
    setIsPanning(false);
    setDraggingNodeId(null);
    if (connectingSource) {
      setConnectingSource(null);
      setLiveWireEnd(null);
    }
  }

  // NODE CLICK & DRAG START (VISUAL = SELECT & MOVE)
  function handleNodeMouseDown(e: React.MouseEvent, node: WhiteboardNode) {
    e.stopPropagation();

    // If connecting wire in progress, clicking node finishes connection to its default port
    if (connectingSource && connectingSource.nodeId !== node.id) {
      handlePortMouseUp(node.id, "left");
      return;
    }

    setSelectedNodeId(node.id);
    if (!canvasContainerRef.current) return;
    const rect = canvasContainerRef.current.getBoundingClientRect();

    setDraggingNodeId(node.id);
    setDragOffset({
      x: (e.clientX - rect.left - pan.x) / zoom - node.x,
      y: (e.clientY - rect.top - pan.y) / zoom - node.y,
    });
  }

  function handleResetView() {
    setZoom(0.8);
    setPan({ x: 60, y: 60 });
  }

  // Export board as JSON
  function handleExportJson() {
    if (!activeBoard) return;
    const blob = new Blob([JSON.stringify(activeBoard, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeBoard.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.whiteboard.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Import board from JSON
  function handleImportJson(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (imported.name && Array.isArray(imported.nodes)) {
          const newId = `board_${Date.now()}`;
          const newBoard: WhiteboardBoard = {
            ...imported,
            id: newId,
            name: `${imported.name} (Imported)`,
            updatedAt: new Date().toISOString(),
          };
          const updated = [newBoard, ...boards];
          persistBoards(updated);
          setActiveBoardId(newId);
          setBoardTitleInput(newBoard.name);
          setViewState("canvas");
          alert(`Successfully imported "${newBoard.name}"!`);
        } else {
          alert("Invalid whiteboard JSON format.");
        }
      } catch (err) {
        alert("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  const selectedNode = useMemo(() => {
    return activeBoard?.nodes.find((n) => n.id === selectedNodeId) || null;
  }, [activeBoard, selectedNodeId]);

  // Filtered boards for List view
  const filteredBoards = useMemo(() => {
    if (!boardSearchQuery.trim()) return boards;
    const q = boardSearchQuery.toLowerCase();
    return boards.filter(
      (b) => b.name.toLowerCase().includes(q) || (b.description && b.description.toLowerCase().includes(q))
    );
  }, [boards, boardSearchQuery]);

  // =========================================================================
  // VIEW 1: BOARD GALLERY / LIST VIEW (INITIAL LANDING PAGE)
  // =========================================================================
  if (viewState === "list") {
    return (
      <div className="flex-1 flex flex-col h-full bg-[#f8fafc] overflow-y-auto select-none p-6 md:p-8">
        {/* Top Header & Search / Create Controls */}
        <div className="max-w-6xl w-full mx-auto space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="h-8 w-8 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 grid place-items-center">
                  <Workflow className="h-4 w-4" />
                </div>
                <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                  Whiteboard Workspaces
                </h1>
              </div>
              <p className="text-xs text-slate-500">
                Draft visual workflow architectures, measure dependency graphs, and clinical data pipelines.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Search input */}
              <div className="relative">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={boardSearchQuery}
                  onChange={(e) => setBoardSearchQuery(e.target.value)}
                  placeholder="Search boards..."
                  className="pl-9 pr-3 py-2 text-xs rounded-xl bg-white border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs w-56"
                />
              </div>

              {/* Import Board */}
              <label
                title="Import Board from JSON"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition cursor-pointer shadow-2xs"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Import</span>
                <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
              </label>

              {/* Create Board Button */}
              <button
                type="button"
                onClick={handleCreateNewBoard}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition cursor-pointer shadow-xs"
              >
                <Plus className="h-4 w-4" />
                <span>New Board</span>
              </button>
            </div>
          </div>

          {/* Boards Gallery Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredBoards.map((b) => {
              const stickyCount = b.nodes.filter((n) => n.type === "sticky").length;
              const processCount = b.nodes.filter((n) => n.type !== "sticky").length;
              const totalConnections = b.nodes.reduce((acc, n) => acc + (n.connections?.length || 0), 0);

              return (
                <div
                  key={b.id}
                  onClick={() => handleOpenBoard(b.id)}
                  className="group bg-white rounded-2xl border border-slate-200/90 hover:border-blue-400 hover:shadow-xl transition-all p-5 flex flex-col justify-between cursor-pointer shadow-xs relative"
                >
                  <div className="space-y-3">
                    {/* Header with Title & Action Menu */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="h-2 w-2 rounded-full bg-blue-600" />
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Workflow Schema
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition truncate">
                          {b.name}
                        </h3>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button
                          type="button"
                          onClick={(e) => handleDuplicateBoard(b.id, e)}
                          title="Duplicate Board"
                          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteBoard(b.id, e)}
                          title="Delete Board"
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {b.description || "Interactive whiteboard canvas with visual nodes and port-to-port wire relationships."}
                    </p>

                    {/* Node Breakdown Badges */}
                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        <Layers className="h-3 w-3 text-slate-500" />
                        <span>{b.nodes.length} Elements</span>
                      </span>

                      {totalConnections > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          <LinkIcon className="h-3 w-3 text-blue-500" />
                          <span>{totalConnections} Wires</span>
                        </span>
                      )}

                      {stickyCount > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-50 text-yellow-800 border border-yellow-200">
                          <span>{stickyCount} Notes</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Footer: Last Updated + Open Arrow */}
                  <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>{new Date(b.updatedAt).toLocaleDateString()}</span>
                    </div>

                    <span className="flex items-center gap-1 font-bold text-blue-600 group-hover:translate-x-1 transition-transform">
                      Open Canvas <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredBoards.length === 0 && (
            <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 p-8 space-y-3">
              <Workflow className="h-8 w-8 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">No Whiteboard Workspaces Found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No boards matched your search query. Try clearing the filter or create a new board.
              </p>
              <button
                type="button"
                onClick={handleCreateNewBoard}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 cursor-pointer shadow-xs inline-flex items-center gap-1.5"
              >
                <Plus className="h-4 w-4" /> Create New Board
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: INTERACTIVE CANVAS VIEW (WITH 4-PORT CONNECTIONS & PAN/ZOOM)
  // =========================================================================
  return (
    <div className="flex-1 flex flex-col h-full bg-[#f8fafc] overflow-hidden select-none relative">
      {/* ================= TOP CANVAS RIBBON ================= */}
      <header className="h-14 shrink-0 bg-white border-b border-slate-200 px-4 flex items-center justify-between gap-3 shadow-2xs z-30">
        <div className="flex items-center gap-3">
          {/* Back to Board Gallery Button */}
          <button
            type="button"
            onClick={() => setViewState("list")}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition cursor-pointer shadow-2xs"
            title="Return to Board Gallery"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Boards</span>
          </button>

          <div className="h-5 w-px bg-slate-200" />

          {/* Board Title & Inline Rename */}
          <div className="flex items-center gap-2">
            {isRenamingBoard ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={boardTitleInput}
                  onChange={(e) => setBoardTitleInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleRenameBoardSubmit()}
                  autoFocus
                  className="px-2.5 py-1 text-xs font-bold font-mono rounded-lg bg-slate-50 border border-blue-500 focus:outline-none text-slate-800 w-64 shadow-inner"
                />
                <button
                  type="button"
                  onClick={handleRenameBoardSubmit}
                  className="p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 cursor-pointer transition shadow-2xs"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 group">
                <h1
                  onClick={() => setIsRenamingBoard(true)}
                  title="Click to rename board"
                  className="text-sm font-extrabold text-slate-900 cursor-pointer hover:text-blue-600 transition truncate max-w-[280px]"
                >
                  {activeBoard?.name || "Untitled Board"}
                </h1>
                <button
                  type="button"
                  onClick={() => setIsRenamingBoard(true)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-700 transition cursor-pointer"
                  title="Rename Board"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </div>
            )}

            {/* Quick Switch Dropdown */}
            <div className="relative group ml-1">
              <select
                value={activeBoardId}
                onChange={(e) => handleOpenBoard(e.target.value)}
                className="text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg px-2.5 py-1 cursor-pointer pr-6 appearance-none focus:outline-none transition"
              >
                {boards.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.nodes.length} nodes)
                  </option>
                ))}
              </select>
              <ChevronDown className="h-3 w-3 text-slate-400 absolute right-2 top-2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Center / Right Canvas Controls */}
        <div className="flex items-center gap-2">
          {/* Active Connector Banner */}
          {connectingSource && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-300 text-amber-800 text-xs font-bold animate-pulse shadow-xs">
              <LinkIcon className="h-3.5 w-3.5 text-amber-600" />
              <span>Drag to any node port (Top, Right, Bottom, Left) to connect</span>
              <button
                type="button"
                onClick={() => {
                  setConnectingSource(null);
                  setLiveWireEnd(null);
                }}
                className="ml-1 text-amber-600 hover:text-amber-900 cursor-pointer"
              >
                &times;
              </button>
            </div>
          )}

          {/* Zoom Controls (Scrollwheel Enabled, Default 80%) */}
          <div className="flex items-center bg-white border border-slate-200 rounded-xl px-2 py-0.5 gap-1 text-xs text-slate-600 shadow-2xs">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.3, Number((z - 0.1).toFixed(1))))}
              title="Zoom Out (or use Mouse Wheel)"
              className="p-1 hover:text-slate-900 cursor-pointer"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="text-[11px] font-mono font-bold w-10 text-center text-slate-800">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(2.0, Number((z + 0.1).toFixed(1))))}
              title="Zoom In (or use Mouse Wheel)"
              className="p-1 hover:text-slate-900 cursor-pointer"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <div className="h-3 w-px bg-slate-200 mx-0.5" />
            <button
              type="button"
              onClick={handleResetView}
              title="Reset View (80%)"
              className="p-1 hover:text-blue-600 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Export / Actions */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleExportJson}
              title="Export Board as JSON"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition cursor-pointer shadow-2xs"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export</span>
            </button>

            <button
              type="button"
              onClick={() => handleDeleteBoard(activeBoardId)}
              title="Delete Current Board"
              className="p-1.5 rounded-xl bg-white text-rose-600 border border-rose-200 hover:bg-rose-50 transition cursor-pointer shadow-2xs"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ================= MAIN MIRO WORKSPACE ================= */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* FLOATING MIRO TOOLBOX (LEFT SIDE) */}
        <aside className="absolute left-4 top-4 bottom-4 w-60 z-20 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-xl p-3 flex flex-col gap-3 overflow-y-auto">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800">
              <Boxes className="h-4 w-4 text-blue-600" />
              <span>Miro Elements</span>
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {activeBoard?.nodes.length || 0} Nodes
            </span>
          </div>

          {/* STICKY NOTES SECTION */}
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1.5">
              Sticky Notes
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => handleAddNode("sticky", "#fef08a")}
                className="h-9 rounded-xl bg-yellow-200 hover:bg-yellow-300 border border-yellow-300 text-yellow-900 text-[10px] font-bold shadow-2xs flex flex-col items-center justify-center cursor-pointer transition"
              >
                Yellow
              </button>
              <button
                type="button"
                onClick={() => handleAddNode("sticky", "#bae6fd")}
                className="h-9 rounded-xl bg-sky-200 hover:bg-sky-300 border border-sky-300 text-sky-900 text-[10px] font-bold shadow-2xs flex flex-col items-center justify-center cursor-pointer transition"
              >
                Sky Blue
              </button>
              <button
                type="button"
                onClick={() => handleAddNode("sticky", "#bbf7d0")}
                className="h-9 rounded-xl bg-emerald-200 hover:bg-emerald-300 border border-emerald-300 text-emerald-900 text-[10px] font-bold shadow-2xs flex flex-col items-center justify-center cursor-pointer transition"
              >
                Green
              </button>
              <button
                type="button"
                onClick={() => handleAddNode("sticky", "#fed7aa")}
                className="h-9 rounded-xl bg-orange-200 hover:bg-orange-300 border border-orange-300 text-orange-900 text-[10px] font-bold shadow-2xs flex flex-col items-center justify-center cursor-pointer transition"
              >
                Peach
              </button>
              <button
                type="button"
                onClick={() => handleAddNode("sticky", "#e9d5ff")}
                className="h-9 rounded-xl bg-purple-200 hover:bg-purple-300 border border-purple-300 text-purple-900 text-[10px] font-bold shadow-2xs flex flex-col items-center justify-center cursor-pointer transition"
              >
                Purple
              </button>
              <button
                type="button"
                onClick={() => handleAddNode("sticky", "#fecdd3")}
                className="h-9 rounded-xl bg-rose-200 hover:bg-rose-300 border border-rose-300 text-rose-900 text-[10px] font-bold shadow-2xs flex flex-col items-center justify-center cursor-pointer transition"
              >
                Rose
              </button>
            </div>
          </div>

          {/* WORKFLOW SHAPES */}
          <div className="space-y-1.5 pt-1 border-t border-slate-100">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
              Workflow Shapes
            </span>

            <button
              type="button"
              onClick={() => handleAddNode("trigger")}
              className="w-full flex items-center gap-2 p-2 rounded-xl bg-slate-50 hover:bg-sky-50 border border-slate-200 hover:border-sky-300 text-left text-xs font-semibold text-slate-800 transition cursor-pointer shadow-2xs"
            >
              <PlayCircle className="h-4 w-4 text-sky-600 shrink-0" />
              <div>
                <span className="font-bold block text-[11px]">+ Trigger / Event</span>
                <span className="text-[9px] text-slate-400">Entry point, user arrival</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleAddNode("process")}
              className="w-full flex items-center gap-2 p-2 rounded-xl bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-left text-xs font-semibold text-slate-800 transition cursor-pointer shadow-2xs"
            >
              <Workflow className="h-4 w-4 text-indigo-600 shrink-0" />
              <div>
                <span className="font-bold block text-[11px]">+ Process Step</span>
                <span className="text-[9px] text-slate-400">Clinical or ops execution</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleAddNode("decision")}
              className="w-full flex items-center gap-2 p-2 rounded-xl bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-300 text-left text-xs font-semibold text-slate-800 transition cursor-pointer shadow-2xs"
            >
              <GitBranch className="h-4 w-4 text-amber-600 shrink-0" />
              <div>
                <span className="font-bold block text-[11px]">+ Decision / Branch</span>
                <span className="text-[9px] text-slate-400">Condition &rarr; Yes / No</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleAddNode("database")}
              className="w-full flex items-center gap-2 p-2 rounded-xl bg-slate-50 hover:bg-teal-50 border border-slate-200 hover:border-teal-300 text-left text-xs font-semibold text-slate-800 transition cursor-pointer shadow-2xs"
            >
              <Database className="h-4 w-4 text-teal-600 shrink-0" />
              <div>
                <span className="font-bold block text-[11px]">+ Data Table / Lake</span>
                <span className="text-[9px] text-slate-400">Fact or dimension schema</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleAddNode("dax")}
              className="w-full flex items-center gap-2 p-2 rounded-xl bg-slate-50 hover:bg-purple-50 border border-slate-200 hover:border-purple-300 text-left text-xs font-semibold text-slate-800 transition cursor-pointer shadow-2xs"
            >
              <FunctionSquare className="h-4 w-4 text-purple-600 shrink-0" />
              <div>
                <span className="font-bold block text-[11px]">+ DAX Metric</span>
                <span className="text-[9px] text-slate-400">Calculated measure or KPI</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleAddNode("output")}
              className="w-full flex items-center gap-2 p-2 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-left text-xs font-semibold text-slate-800 transition cursor-pointer shadow-2xs"
            >
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <div>
                <span className="font-bold block text-[11px]">+ Output / Report</span>
                <span className="text-[9px] text-slate-400">Dashboard visual, KPI result</span>
              </div>
            </button>
          </div>

          {/* Miro Shortcuts & Helpers */}
          <div className="mt-auto pt-2 border-t border-slate-100 text-[10px] text-slate-400 leading-relaxed">
            <span className="font-bold text-slate-600 block mb-0.5">Canvas Shortcuts:</span>
            • <b>Scroll Wheel</b>: Zoom In / Out
            <br />• <b>Empty Space</b>: Click &amp; drag to Pan (Hand)
            <br />• <b>Visual</b>: Click &amp; drag to Select / Move
            <br />• <b>4 Ports</b>: Drag from any port dot to wire
            <br />• <b>Del / Backspace</b>: Delete selected element
          </div>
        </aside>

        {/* ================= INTERACTIVE CANVAS ================= */}
        {/* Empty canvas space automatically acts as Hand / Pan! */}
        <div
          ref={canvasContainerRef}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          className={clsx(
            "flex-1 w-full h-full relative overflow-hidden",
            isPanning ? "cursor-grabbing" : "cursor-grab"
          )}
          style={{
            backgroundColor: "#f8fafc",
            backgroundImage: "radial-gradient(#cbd5e1 1.5px, transparent 1.5px)",
            backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`,
          }}
        >
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "0 0",
              position: "absolute",
              left: 0,
              top: 0,
              width: "5000px",
              height: "4000px",
            }}
          >
            {/* SVG Connecting Curves */}
            <svg
              className="absolute inset-0 pointer-events-none w-full h-full"
              style={{ overflow: "visible" }}
            >
              <defs>
                <marker
                  id="arrow-whiteboard"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#3b82f6" />
                </marker>
              </defs>

              {/* RENDER EXISTING WIRES */}
              {activeBoard?.nodes.map((node) => {
                if (!node.connections || node.connections.length === 0) return null;

                return node.connections.map((conn) => {
                  const targetNode = activeBoard.nodes.find((n) => n.id === conn.targetId);
                  if (!targetNode) return null;

                  const srcCoord = getPortCoordinate(node, conn.fromSide || "right");
                  const tgtCoord = getPortCoordinate(targetNode, conn.toSide || "left");

                  const dx = tgtCoord.x - srcCoord.x;
                  const dy = tgtCoord.y - srcCoord.y;
                  const dist = Math.sqrt(dx * dx + dy * dy);
                  const curveDist = Math.max(40, Math.min(160, dist * 0.4));

                  // Calibrate tangent handles based on side
                  let cp1X = srcCoord.x;
                  let cp1Y = srcCoord.y;
                  if (conn.fromSide === "left") cp1X -= curveDist;
                  else if (conn.fromSide === "top") cp1Y -= curveDist;
                  else if (conn.fromSide === "bottom") cp1Y += curveDist;
                  else cp1X += curveDist; // default right

                  let cp2X = tgtCoord.x;
                  let cp2Y = tgtCoord.y;
                  if (conn.toSide === "right") cp2X += curveDist;
                  else if (conn.toSide === "top") cp2Y -= curveDist;
                  else if (conn.toSide === "bottom") cp2Y += curveDist;
                  else cp2X -= curveDist; // default left

                  const pathD = `M ${srcCoord.x} ${srcCoord.y} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${tgtCoord.x} ${tgtCoord.y}`;
                  const midX = (srcCoord.x + tgtCoord.x) / 2;
                  const midY = (srcCoord.y + tgtCoord.y) / 2;

                  return (
                    <g key={`${node.id}->${conn.targetId}`}>
                      <path
                        d={pathD}
                        fill="none"
                        stroke="transparent"
                        strokeWidth="16"
                        className="pointer-events-auto cursor-pointer"
                        onClick={() => setEditingConnection({ sourceId: node.id, targetId: conn.targetId })}
                      />
                      <path
                        d={pathD}
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth="2.5"
                        strokeDasharray={node.type === "sticky" ? "4 4" : undefined}
                        markerEnd="url(#arrow-whiteboard)"
                      />
                      {conn.label && (
                        <g
                          transform={`translate(${midX}, ${midY})`}
                          className="pointer-events-auto cursor-pointer"
                          onClick={() => setEditingConnection({ sourceId: node.id, targetId: conn.targetId })}
                        >
                          <rect
                            x="-32"
                            y="-10"
                            width="64"
                            height="20"
                            rx="10"
                            fill="#ffffff"
                            stroke="#bfdbfe"
                            strokeWidth="1.5"
                            className="shadow-2xs"
                          />
                          <text
                            x="0"
                            y="4"
                            textAnchor="middle"
                            fill="#1e40af"
                            fontSize="9"
                            fontFamily="monospace"
                            fontWeight="bold"
                          >
                            {conn.label}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                });
              })}

              {/* LIVE DRAGGING WIRE PREVIEW */}
              {connectingSource && liveWireEnd && (
                (() => {
                  const srcNode = activeBoard?.nodes.find((n) => n.id === connectingSource.nodeId);
                  if (!srcNode) return null;
                  const srcCoord = getPortCoordinate(srcNode, connectingSource.fromSide);
                  return (
                    <path
                      d={`M ${srcCoord.x} ${srcCoord.y} Q ${(srcCoord.x + liveWireEnd.x) / 2} ${(srcCoord.y + liveWireEnd.y) / 2 - 30}, ${liveWireEnd.x} ${liveWireEnd.y}`}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="2.5"
                      strokeDasharray="5 5"
                      markerEnd="url(#arrow-whiteboard)"
                    />
                  );
                })()
              )}
            </svg>

            {/* NODES RENDERING */}
            {activeBoard?.nodes.map((node) => {
              const isSelected = selectedNodeId === node.id;
              const isHovered = hoveredNodeId === node.id;
              const isConnecting = Boolean(connectingSource);

              return (
                <div
                  key={node.id}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId((curr) => (curr === node.id ? null : curr))}
                  onMouseDown={(e) => handleNodeMouseDown(e, node)}
                  style={{
                    position: "absolute",
                    left: `${node.x}px`,
                    top: `${node.y}px`,
                    width: `${node.width}px`,
                    minHeight: `${node.height}px`,
                    backgroundColor: node.type === "sticky" ? node.color || "#fef08a" : "#ffffff",
                    cursor: "move",
                  }}
                  className={clsx(
                    "select-none transition-shadow relative flex flex-col justify-between group",
                    node.type === "sticky"
                      ? "p-3 rounded-xl shadow-md border border-black/10 text-slate-900"
                      : "p-3 rounded-2xl shadow-md border border-slate-200 text-slate-800",
                    isSelected && "ring-3 ring-blue-600 shadow-2xl",
                    isConnecting && connectingSource?.nodeId !== node.id && "hover:ring-2 hover:ring-amber-500"
                  )}
                >
                  {/* ================= 4 CONNECTION PORTS (TOP, RIGHT, BOTTOM, LEFT) ================= */}
                  {(isHovered || isSelected || isConnecting) && (
                    <>
                      {/* Top Port */}
                      <button
                        type="button"
                        onMouseDown={(e) => handlePortMouseDown(e, node.id, "top")}
                        onMouseUp={(e) => {
                          e.stopPropagation();
                          handlePortMouseUp(node.id, "top");
                        }}
                        title="Top Connection Port"
                        className="absolute -top-2 left-1/2 -translate-x-1/2 h-4 w-4 rounded-full bg-blue-500 border-2 border-white shadow-md hover:scale-130 hover:bg-blue-600 transition cursor-crosshair z-30 flex items-center justify-center text-white text-[8px]"
                      >
                        +
                      </button>

                      {/* Right Port */}
                      <button
                        type="button"
                        onMouseDown={(e) => handlePortMouseDown(e, node.id, "right")}
                        onMouseUp={(e) => {
                          e.stopPropagation();
                          handlePortMouseUp(node.id, "right");
                        }}
                        title="Right Connection Port"
                        className="absolute -right-2 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-blue-500 border-2 border-white shadow-md hover:scale-130 hover:bg-blue-600 transition cursor-crosshair z-30 flex items-center justify-center text-white text-[8px]"
                      >
                        +
                      </button>

                      {/* Bottom Port */}
                      <button
                        type="button"
                        onMouseDown={(e) => handlePortMouseDown(e, node.id, "bottom")}
                        onMouseUp={(e) => {
                          e.stopPropagation();
                          handlePortMouseUp(node.id, "bottom");
                        }}
                        title="Bottom Connection Port"
                        className="absolute -bottom-2 left-1/2 -translate-x-1/2 h-4 w-4 rounded-full bg-blue-500 border-2 border-white shadow-md hover:scale-130 hover:bg-blue-600 transition cursor-crosshair z-30 flex items-center justify-center text-white text-[8px]"
                      >
                        +
                      </button>

                      {/* Left Port */}
                      <button
                        type="button"
                        onMouseDown={(e) => handlePortMouseDown(e, node.id, "left")}
                        onMouseUp={(e) => {
                          e.stopPropagation();
                          handlePortMouseUp(node.id, "left");
                        }}
                        title="Left Connection Port"
                        className="absolute -left-2 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-blue-500 border-2 border-white shadow-md hover:scale-130 hover:bg-blue-600 transition cursor-crosshair z-30 flex items-center justify-center text-white text-[8px]"
                      >
                        +
                      </button>
                    </>
                  )}

                  {/* Header with Type & Actions */}
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: node.color || "#4f46e5" }}
                      />
                      <span className="text-[9px] font-extrabold uppercase tracking-wider opacity-60">
                        {node.type}
                      </span>
                    </div>

                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePortMouseDown(e, node.id, "right");
                        }}
                        title="Drag or click wire to connect"
                        className="p-1 rounded hover:bg-black/10 text-slate-600 cursor-crosshair transition"
                      >
                        <LinkIcon className="h-3 w-3" />
                      </button>
                      <Move className="h-3 w-3 opacity-30" />
                    </div>
                  </div>

                  {/* Title */}
                  <h4 className="text-xs font-bold font-mono leading-snug line-clamp-1 mb-1 text-slate-900">
                    {node.title}
                  </h4>

                  {/* Description */}
                  <p className="text-[10px] opacity-80 leading-relaxed line-clamp-2">
                    {node.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ================= BOTTOM SELECTED NODE INSPECTOR BAR ================= */}
      {selectedNode && (
        <footer className="shrink-0 h-14 bg-white border-t border-slate-200 px-5 flex items-center justify-between gap-4 shadow-lg z-30 animate-in slide-in-from-bottom-2">
          <div className="flex items-center gap-3 flex-1 flex-wrap">
            <span className="text-xs font-bold text-slate-500 shrink-0">Selected Node:</span>

            <input
              type="text"
              value={selectedNode.title}
              onChange={(e) => {
                const val = e.target.value;
                updateActiveNodes((nodes) =>
                  nodes.map((n) => (n.id === selectedNode.id ? { ...n, title: val } : n))
                );
              }}
              placeholder="Node Title..."
              className="px-3 py-1.5 text-xs font-bold font-mono rounded-xl bg-slate-50 border border-slate-200 text-slate-900 w-56 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
            />

            <input
              type="text"
              value={selectedNode.description}
              onChange={(e) => {
                const val = e.target.value;
                updateActiveNodes((nodes) =>
                  nodes.map((n) => (n.id === selectedNode.id ? { ...n, description: val } : n))
                );
              }}
              placeholder="Description / DAX formula / business context..."
              className="flex-1 min-w-[240px] px-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Quick delete instruction reminder */}
            <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
              Press <b>Del</b> to remove
            </span>

            {/* Duplicate Node */}
            <button
              type="button"
              onClick={() => {
                const dupId = `node_${Date.now().toString().slice(-5)}`;
                const dupNode: WhiteboardNode = {
                  ...selectedNode,
                  id: dupId,
                  title: `${selectedNode.title} (Copy)`,
                  x: selectedNode.x + 40,
                  y: selectedNode.y + 40,
                  connections: [],
                };
                updateActiveNodes((nodes) => [...nodes, dupNode]);
                setSelectedNodeId(dupId);
              }}
              className="p-1.5 rounded-full text-slate-600 hover:bg-slate-100 border border-slate-200 transition cursor-pointer"
              title="Duplicate Node"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>

            {/* Delete Node */}
            <button
              type="button"
              onClick={() => {
                updateActiveNodes((nodes) =>
                  nodes
                    .filter((n) => n.id !== selectedNode.id)
                    .map((n) => ({
                      ...n,
                      connections: (n.connections || []).filter((c) => c.targetId !== selectedNode.id),
                    }))
                );
                setSelectedNodeId(null);
              }}
              className="p-1.5 rounded-full text-rose-600 hover:bg-rose-50 border border-rose-200 transition cursor-pointer"
              title="Delete Selected Node (Del)"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </footer>
      )}

      {/* ================= CONNECTION MODAL (EDIT OR REMOVE WIRE) ================= */}
      {editingConnection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-2xs p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-slate-200 flex flex-col gap-3">
            <h3 className="text-sm font-bold text-slate-900">Edit Connection Wire</h3>
            <p className="text-xs text-slate-500">
              Customize connector label or disconnect this relationship.
            </p>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Wire Label (e.g. Yes, No, Filter, Registered)
              </label>
              <input
                type="text"
                defaultValue={
                  activeBoard?.nodes
                    .find((n) => n.id === editingConnection.sourceId)
                    ?.connections.find((c) => c.targetId === editingConnection.targetId)?.label || ""
                }
                onChange={(e) => {
                  const val = e.target.value;
                  updateActiveNodes((nodes) =>
                    nodes.map((n) => {
                      if (n.id === editingConnection.sourceId) {
                        return {
                          ...n,
                          connections: n.connections.map((c) =>
                            c.targetId === editingConnection.targetId ? { ...c, label: val } : c
                          ),
                        };
                      }
                      return n;
                    })
                  );
                }}
                className="w-full px-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() =>
                  handleRemoveConnection(editingConnection.sourceId, editingConnection.targetId)
                }
                className="flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-700 cursor-pointer"
              >
                <Trash2 className="h-3 w-3" /> Disconnect Wire
              </button>
              <button
                type="button"
                onClick={() => setEditingConnection(null)}
                className="px-4 py-1.5 rounded-full text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 cursor-pointer shadow-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
