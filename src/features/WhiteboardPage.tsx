"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
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
  Sparkles,
  Boxes,
  Database,
  GitBranch,
  FunctionSquare,
  PlayCircle,
  CheckCircle2,
  MousePointer,
  Hand,
} from "lucide-react";
import { clsx } from "clsx";
import { useTheme } from "@/context/ThemeContext";

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
  connections: { targetId: string; label?: string }[];
}

export interface WhiteboardBoard {
  id: string;
  name: string;
  updatedAt: string;
  nodes: WhiteboardNode[];
}

const DEFAULT_BOARDS: WhiteboardBoard[] = [
  {
    id: "board_patient_flow",
    name: "Hospital Patient Journey & KPIs",
    updatedAt: new Date().toISOString(),
    nodes: [
      {
        id: "node_1",
        type: "trigger",
        title: "Patient Check-in / Registration",
        description: "Arrival at OPD Desk • Captures Visit Time, HN & Market Type",
        color: "#0284c7",
        x: 60,
        y: 160,
        width: 220,
        height: 100,
        connections: [{ targetId: "node_2", label: "Registered" }],
      },
      {
        id: "node_2",
        type: "process",
        title: "Triage & Vitals Assessment",
        description: "Nurse screening • Blood pressure, acuity triage score",
        color: "#4f46e5",
        x: 350,
        y: 160,
        width: 230,
        height: 100,
        connections: [
          { targetId: "node_3", label: "Standard Flow" },
          { targetId: "node_sticky_1", label: "Note" },
        ],
      },
      {
        id: "node_sticky_1",
        type: "sticky",
        title: "SLA Alert Target",
        description: "Triage must complete under 15 minutes for Tier 1 ER cases.",
        color: "#fef08a",
        x: 350,
        y: 310,
        width: 200,
        height: 110,
        connections: [],
      },
      {
        id: "node_3",
        type: "decision",
        title: "Requires Lab / Imaging?",
        description: "Doctor orders diagnostic tests or immediate prescription",
        color: "#d97706",
        x: 660,
        y: 160,
        width: 220,
        height: 110,
        connections: [
          { targetId: "node_4", label: "Yes (Lab / X-Ray)" },
          { targetId: "node_5", label: "No (Direct Rx)" },
        ],
      },
      {
        id: "node_4",
        type: "database",
        title: "fact_patient_visit & Orders",
        description: "Logs order timestamps, lab turnaround times & item charges",
        color: "#0d9488",
        x: 960,
        y: 80,
        width: 230,
        height: 100,
        connections: [{ targetId: "node_6", label: "Aggregated" }],
      },
      {
        id: "node_5",
        type: "process",
        title: "Cashier & Pharmacy Dispensing",
        description: "Settlement via insurance or self-pay • Medication delivery",
        color: "#4f46e5",
        x: 960,
        y: 260,
        width: 230,
        height: 100,
        connections: [{ targetId: "node_6", label: "Final Billing" }],
      },
      {
        id: "node_6",
        type: "dax",
        title: "DAX: [_avg_opd_turnaround_time]",
        description: "CALCULATE( AVERAGE(fact_visit[minutes]), fact_visit[is_complete]=1 )",
        color: "#7c3aed",
        x: 1270,
        y: 160,
        width: 250,
        height: 110,
        connections: [{ targetId: "node_7", label: "Evaluated KPI" }],
      },
      {
        id: "node_7",
        type: "output",
        title: "Executive Hospital Dashboard",
        description: "Daily Strategy Monitor • Real-time patient volume & SLA metrics",
        color: "#059669",
        x: 1600,
        y: 160,
        width: 230,
        height: 100,
        connections: [],
      },
    ],
  },
  {
    id: "board_revenue_pipeline",
    name: "Revenue & Billing Pipeline",
    updatedAt: new Date().toISOString(),
    nodes: [
      {
        id: "rev_1",
        type: "database",
        title: "fact_patient_bill",
        description: "Raw billing receipts, net revenue, discount splits",
        color: "#0d9488",
        x: 80,
        y: 140,
        width: 230,
        height: 100,
        connections: [{ targetId: "rev_2", label: "Extract" }],
      },
      {
        id: "rev_2",
        type: "process",
        title: "Payor Segmentation ETL",
        description: "Classifies: SSO, Thai Private Ins, Expat, Inter Ins",
        color: "#4f46e5",
        x: 380,
        y: 140,
        width: 230,
        height: 100,
        connections: [{ targetId: "rev_3", label: "Apply Logic" }],
      },
      {
        id: "rev_3",
        type: "dax",
        title: "DAX: [_net_revenue]",
        description: "SUM( fact_patient_bill[net_amount] )",
        color: "#7c3aed",
        x: 690,
        y: 140,
        width: 240,
        height: 100,
        connections: [{ targetId: "rev_4", label: "Publish" }],
      },
      {
        id: "rev_4",
        type: "output",
        title: "D02 Financial Semantic Model",
        description: "Live Power BI semantic model for budget tracking",
        color: "#059669",
        x: 1010,
        y: 140,
        width: 240,
        height: 100,
        connections: [],
      },
    ],
  },
];

const LOCAL_STORAGE_KEY = "powerbi_whiteboard_boards_v1";

export function WhiteboardPage() {
  const { currentTheme } = useTheme();

  // Boards State
  const [boards, setBoards] = useState<WhiteboardBoard[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<string>("");
  const [isRenamingBoard, setIsRenamingBoard] = useState(false);
  const [boardTitleInput, setBoardTitleInput] = useState("");

  // Canvas Viewport State (Zoom & Pan)
  const [zoom, setZoom] = useState<number>(0.8); // 80% default zoom as requested!
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 40, y: 40 });
  const [toolMode, setToolMode] = useState<"select" | "pan">("select");
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Selected Node & Connect Mode
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);
  const [editingConnection, setEditingConnection] = useState<{ sourceId: string; targetId: string } | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);

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

  function persistBoards(newBoards: WhiteboardBoard[]) {
    setBoards(newBoards);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newBoards));
    } catch (e) {
      console.error("Failed to persist boards", e);
    }
  }

  const activeBoard = useMemo(() => {
    return boards.find((b) => b.id === activeBoardId) || boards[0] || null;
  }, [boards, activeBoardId]);

  function handleSelectBoard(boardId: string) {
    setActiveBoardId(boardId);
    setSelectedNodeId(null);
    setConnectingSourceId(null);
    const b = boards.find((x) => x.id === boardId);
    if (b) setBoardTitleInput(b.name);
  }

  function handleCreateNewBoard() {
    const newId = `board_${Date.now()}`;
    const newBoard: WhiteboardBoard = {
      id: newId,
      name: `Untitled Workflow ${boards.length + 1}`,
      updatedAt: new Date().toISOString(),
      nodes: [
        {
          id: `node_${Date.now()}_1`,
          type: "process",
          title: "New Process Step",
          description: "Click to edit title & describe workflow logic",
          color: "#4f46e5",
          x: 200,
          y: 160,
          width: 220,
          height: 100,
          connections: [],
        },
      ],
    };
    const updated = [...boards, newBoard];
    persistBoards(updated);
    setActiveBoardId(newId);
    setBoardTitleInput(newBoard.name);
  }

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

  function handleDeleteBoard() {
    if (boards.length <= 1) {
      alert("At least one whiteboard must remain.");
      return;
    }
    if (!confirm(`Are you sure you want to delete "${activeBoard?.name}"?`)) return;
    const remaining = boards.filter((b) => b.id !== activeBoard?.id);
    persistBoards(remaining);
    setActiveBoardId(remaining[0].id);
    setBoardTitleInput(remaining[0].name);
  }

  function handleDuplicateBoard() {
    if (!activeBoard) return;
    const newId = `board_${Date.now()}`;
    const duplicated: WhiteboardBoard = {
      ...activeBoard,
      id: newId,
      name: `${activeBoard.name} (Copy)`,
      updatedAt: new Date().toISOString(),
      nodes: JSON.parse(JSON.stringify(activeBoard.nodes)),
    };
    const updated = [...boards, duplicated];
    persistBoards(updated);
    setActiveBoardId(newId);
    setBoardTitleInput(duplicated.name);
  }

  function updateActiveNodes(updater: (nodes: WhiteboardNode[]) => WhiteboardNode[]) {
    if (!activeBoard) return;
    const updatedNodes = updater(activeBoard.nodes);
    const updatedBoards = boards.map((b) =>
      b.id === activeBoard.id ? { ...b, nodes: updatedNodes, updatedAt: new Date().toISOString() } : b
    );
    persistBoards(updatedBoards);
  }

  function handleAddNode(type: WhiteboardNode["type"], stickyColor?: string) {
    if (!activeBoard) return;
    const newId = `node_${Date.now().toString().slice(-5)}`;

    const nodeTemplates: Record<
      WhiteboardNode["type"],
      { title: string; description: string; color: string; width: number; height: number }
    > = {
      sticky: {
        title: "Idea / Note",
        description: "Jot down team decisions, clinical edge-cases, or calculation rules",
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
    const spawnX = Math.round((-pan.x + 320) / zoom);
    const spawnY = Math.round((-pan.y + 200) / zoom);

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

  function handleToggleConnect(nodeId: string) {
    if (!connectingSourceId) {
      setConnectingSourceId(nodeId);
    } else if (connectingSourceId === nodeId) {
      setConnectingSourceId(null);
    } else {
      const srcId = connectingSourceId;
      updateActiveNodes((nodes) =>
        nodes.map((n) => {
          if (n.id === srcId) {
            const current = n.connections || [];
            if (!current.some((c) => c.targetId === nodeId)) {
              return { ...n, connections: [...current, { targetId: nodeId, label: "Flow" }] };
            }
          }
          return n;
        })
      );
      setConnectingSourceId(null);
    }
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

  function handleMouseDownCanvas(e: React.MouseEvent) {
    if (toolMode === "pan" || e.button === 1 || e.buttons === 4) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    } else if (e.target === canvasRef.current) {
      setSelectedNodeId(null);
      setConnectingSourceId(null);
    }
  }

  function handleMouseMoveCanvas(e: React.MouseEvent) {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      return;
    }

    if (draggingNodeId && canvasRef.current) {
      const canvasRect = canvasRef.current.getBoundingClientRect();
      const newX = Math.round((e.clientX - canvasRect.left - pan.x) / zoom - dragOffset.x);
      const newY = Math.round((e.clientY - canvasRect.top - pan.y) / zoom - dragOffset.y);

      updateActiveNodes((nodes) =>
        nodes.map((n) => (n.id === draggingNodeId ? { ...n, x: Math.max(10, newX), y: Math.max(10, newY) } : n))
      );
    }
  }

  function handleMouseUpCanvas() {
    setIsPanning(false);
    setDraggingNodeId(null);
  }

  function handleNodeMouseDown(e: React.MouseEvent, node: WhiteboardNode) {
    e.stopPropagation();
    if (toolMode === "pan") return;

    if (connectingSourceId && connectingSourceId !== node.id) {
      handleToggleConnect(node.id);
      return;
    }

    setSelectedNodeId(node.id);
    if (!canvasRef.current) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();

    setDraggingNodeId(node.id);
    setDragOffset({
      x: (e.clientX - canvasRect.left - pan.x) / zoom - node.x,
      y: (e.clientY - canvasRect.top - pan.y) / zoom - node.y,
    });
  }

  function handleResetView() {
    setZoom(0.8);
    setPan({ x: 60, y: 60 });
  }

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
          const updated = [...boards, newBoard];
          persistBoards(updated);
          setActiveBoardId(newId);
          setBoardTitleInput(newBoard.name);
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

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f8fafc] overflow-hidden select-none relative">
      {/* ================= TOP MIRO CONTROL BAR ================= */}
      <header className="h-14 shrink-0 bg-white border-b border-slate-200 px-4 flex items-center justify-between gap-3 shadow-2xs z-30">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 grid place-items-center shrink-0">
            <Workflow className="h-5 w-5" />
          </div>

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

            <div className="relative group ml-1">
              <select
                value={activeBoardId}
                onChange={(e) => handleSelectBoard(e.target.value)}
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

            <button
              type="button"
              onClick={handleCreateNewBoard}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-white text-blue-600 border border-blue-200 hover:bg-blue-50 transition cursor-pointer shadow-2xs"
              title="Create New Workflow Board"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Board</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {connectingSourceId && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-300 text-amber-800 text-xs font-bold animate-pulse shadow-xs">
              <LinkIcon className="h-3.5 w-3.5 text-amber-600" />
              <span>Click target node to connect wire</span>
              <button
                type="button"
                onClick={() => setConnectingSourceId(null)}
                className="ml-1 text-amber-600 hover:text-amber-900 cursor-pointer"
              >
                &times;
              </button>
            </div>
          )}

          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setToolMode("select")}
              className={clsx(
                "flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer",
                toolMode === "select" ? "bg-white text-blue-600 shadow-2xs" : "text-slate-600 hover:text-slate-900"
              )}
            >
              <MousePointer className="h-3.5 w-3.5" />
              <span>Select</span>
            </button>
            <button
              type="button"
              onClick={() => setToolMode("pan")}
              className={clsx(
                "flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer",
                toolMode === "pan" ? "bg-white text-blue-600 shadow-2xs" : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Hand className="h-3.5 w-3.5" />
              <span>Hand</span>
            </button>
          </div>

          <div className="flex items-center bg-white border border-slate-200 rounded-xl px-2 py-0.5 gap-1 text-xs text-slate-600 shadow-2xs">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.4, Number((z - 0.1).toFixed(1))))}
              title="Zoom Out"
              className="p-1 hover:text-slate-900 cursor-pointer"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="text-[11px] font-mono font-bold w-10 text-center text-slate-800">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(1.8, Number((z + 0.1).toFixed(1))))}
              title="Zoom In"
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

            <label
              title="Import Board from JSON"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition cursor-pointer shadow-2xs"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Import</span>
              <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
            </label>

            <button
              type="button"
              onClick={handleDuplicateBoard}
              title="Duplicate Board"
              className="p-1.5 rounded-xl bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 transition cursor-pointer shadow-2xs"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={handleDeleteBoard}
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

          <div className="mt-auto pt-2 border-t border-slate-100 text-[10px] text-slate-400 leading-relaxed">
            <span className="font-bold text-slate-600 block mb-0.5">Miro Tips:</span>
            • Click Link icon on any node to wire connectors.
            <br />• Drag nodes freely across the infinite dot canvas.
            <br />• Select Hand tool to pan the entire workspace.
          </div>
        </aside>

        {/* ================= INTERACTIVE CANVAS ================= */}
        <div
          ref={canvasRef}
          onMouseDown={handleMouseDownCanvas}
          onMouseMove={handleMouseMoveCanvas}
          onMouseUp={handleMouseUpCanvas}
          className={clsx(
            "flex-1 w-full h-full relative overflow-hidden",
            toolMode === "pan" ? "cursor-grab active:cursor-grabbing" : "cursor-default"
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
              width: "4000px",
              height: "3000px",
            }}
          >
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

              {activeBoard?.nodes.map((node) => {
                if (!node.connections || node.connections.length === 0) return null;
                const srcX = node.x + node.width;
                const srcY = node.y + node.height / 2;

                return node.connections.map((conn) => {
                  const targetNode = activeBoard.nodes.find((n) => n.id === conn.targetId);
                  if (!targetNode) return null;

                  const tgtX = targetNode.x;
                  const tgtY = targetNode.y + targetNode.height / 2;

                  const dx = tgtX - srcX;
                  const curvature = Math.max(40, Math.min(180, Math.abs(dx) * 0.5));
                  const cp1X = srcX + curvature;
                  const cp1Y = srcY;
                  const cp2X = tgtX - curvature;
                  const cp2Y = tgtY;

                  const pathD = `M ${srcX} ${srcY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${tgtX} ${tgtY}`;
                  const midX = (srcX + tgtX) / 2;
                  const midY = (srcY + tgtY) / 2;

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
                            x="-30"
                            y="-10"
                            width="60"
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
            </svg>

            {activeBoard?.nodes.map((node) => {
              const isSelected = selectedNodeId === node.id;
              const isConnectingSource = connectingSourceId === node.id;

              if (node.type === "sticky") {
                return (
                  <div
                    key={node.id}
                    onMouseDown={(e) => handleNodeMouseDown(e, node)}
                    style={{
                      position: "absolute",
                      left: `${node.x}px`,
                      top: `${node.y}px`,
                      width: `${node.width}px`,
                      minHeight: `${node.height}px`,
                      backgroundColor: node.color || "#fef08a",
                    }}
                    className={clsx(
                      "p-3 rounded-xl shadow-lg border border-black/10 select-none flex flex-col justify-between transition-shadow cursor-grab active:cursor-grabbing",
                      isSelected && "ring-3 ring-blue-600 shadow-2xl",
                      isConnectingSource && "ring-3 ring-amber-500 animate-pulse"
                    )}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[10px] font-extrabold text-black/60 uppercase tracking-wider">
                        Sticky Note
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleConnect(node.id);
                        }}
                        title={isConnectingSource ? "Cancel" : "Connect to node"}
                        className={clsx(
                          "p-1 rounded text-black/70 hover:bg-black/10 cursor-pointer transition",
                          isConnectingSource && "bg-amber-500 text-white"
                        )}
                      >
                        <LinkIcon className="h-3 w-3" />
                      </button>
                    </div>

                    <h4 className="text-xs font-bold text-slate-900 leading-snug line-clamp-1 mb-1">
                      {node.title}
                    </h4>
                    <p className="text-[11px] text-slate-800 leading-relaxed whitespace-pre-wrap">
                      {node.description}
                    </p>
                  </div>
                );
              }

              return (
                <div
                  key={node.id}
                  onMouseDown={(e) => handleNodeMouseDown(e, node)}
                  style={{
                    position: "absolute",
                    left: `${node.x}px`,
                    top: `${node.y}px`,
                    width: `${node.width}px`,
                    minHeight: `${node.height}px`,
                  }}
                  className={clsx(
                    "p-3 rounded-2xl bg-white shadow-md border border-slate-200 select-none flex flex-col justify-between transition-shadow cursor-grab active:cursor-grabbing",
                    isSelected && "ring-3 ring-blue-600 shadow-2xl",
                    isConnectingSource && "ring-3 ring-amber-500 animate-pulse"
                  )}
                >
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: node.color || "#4f46e5" }}
                      />
                      <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500">
                        {node.type}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleConnect(node.id);
                        }}
                        title={isConnectingSource ? "Cancel" : "Connect Wire to another node"}
                        className={clsx(
                          "p-1 rounded-md transition cursor-pointer",
                          isConnectingSource
                            ? "bg-amber-500 text-white"
                            : "hover:bg-slate-100 text-slate-600"
                        )}
                      >
                        <LinkIcon className="h-3 w-3" />
                      </button>
                      <Move className="h-3 w-3 text-slate-300" />
                    </div>
                  </div>

                  <h4 className="text-xs font-bold font-mono text-slate-900 leading-snug line-clamp-1 mb-1">
                    {node.title}
                  </h4>

                  <p className="text-[10px] text-slate-600 leading-relaxed line-clamp-2">
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
            <button
              type="button"
              onClick={() => handleToggleConnect(selectedNode.id)}
              className={clsx(
                "flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition cursor-pointer shadow-2xs",
                connectingSourceId === selectedNode.id
                  ? "bg-amber-500 text-white"
                  : "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
              )}
            >
              <LinkIcon className="h-3 w-3" />
              <span>{connectingSourceId === selectedNode.id ? "Cancel Wire" : "Connect Wire"}</span>
            </button>

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
              title="Delete Node"
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
                Wire Label (e.g. Yes, No, Filter)
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
