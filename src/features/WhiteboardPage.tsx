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
  ChevronRight,
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
  Hash,
  Type,
  Cloud,
  ListTree,
  Folder,
  FolderPlus,
  FolderOpen,
  FolderTree,
  Grid,
  List as ListIcon,
  Palette,
  Eye,
  StickyNote,
  Maximize2,
  RefreshCw,
  MoreVertical,
  Scissors,
  CheckCircle,
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

export type WhiteboardNodeType =
  | "sticky"
  | "process"
  | "decision"
  | "trigger"
  | "database"
  | "dax"
  | "value"
  | "text"
  | "cloud"
  | "queue"
  | "output";

export interface WhiteboardNode {
  id: string;
  type: WhiteboardNodeType;
  title: string;
  description: string;
  color?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  connections: NodeConnection[];
}

export interface WhiteboardFolder {
  id: string;
  name: string;
  color?: string;
}

export interface WhiteboardBoard {
  id: string;
  name: string;
  folderId?: string;
  folderName?: string;
  description?: string;
  updatedAt: string;
  nodes: WhiteboardNode[];
}

export const COLOR_PALETTE_PRESETS = [
  { label: "Ocean Sapphire", hex: "#2563eb" },
  { label: "Deep Indigo", hex: "#4f46e5" },
  { label: "Emerald Green", hex: "#059669" },
  { label: "Amber Gold", hex: "#d97706" },
  { label: "Crimson Rose", hex: "#e11d48" },
  { label: "Teal Turquoise", hex: "#0d9488" },
  { label: "Purple Violet", hex: "#9333ea" },
  { label: "Sticky Yellow", hex: "#fef08a" },
  { label: "Sky Blue", hex: "#bae6fd" },
  { label: "Slate Charcoal", hex: "#475569" },
];

export const DEFAULT_FOLDERS: WhiteboardFolder[] = [
  { id: "folder_clinical", name: "Clinical & Hospital Ops", color: "#0284c7" },
  { id: "folder_financial", name: "Financial & Cost DAX", color: "#7c3aed" },
  { id: "folder_general", name: "General Workflows", color: "#059669" },
];

export const DEFAULT_BOARDS: WhiteboardBoard[] = [
  {
    id: "board_patient_flow",
    name: "Hospital Patient Journey & KPIs",
    folderId: "folder_clinical",
    folderName: "Clinical & Hospital Ops",
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
        width: 230,
        height: 100,
        connections: [{ targetId: "node_2", fromSide: "right", toSide: "left", label: "Registered" }],
      },
      {
        id: "node_2",
        type: "process",
        title: "Triage & Vitals Assessment",
        description: "Nurse screening • Blood pressure, acuity triage score",
        color: "#4f46e5",
        x: 390,
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
        x: 390,
        y: 350,
        width: 220,
        height: 110,
        connections: [],
      },
      {
        id: "node_3",
        type: "decision",
        title: "Requires Lab / Imaging?",
        description: "Doctor orders diagnostic tests or immediate prescription",
        color: "#d97706",
        x: 710,
        y: 180,
        width: 230,
        height: 105,
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
        x: 1030,
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
        x: 1030,
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
        x: 1360,
        y: 180,
        width: 250,
        height: 110,
        connections: [{ targetId: "node_val_1", fromSide: "right", toSide: "left", label: "Metric" }],
      },
      {
        id: "node_val_1",
        type: "value",
        title: "42.5 Mins",
        description: "Average OPD Wait-to-Discharge SLA",
        color: "#059669",
        x: 1690,
        y: 180,
        width: 220,
        height: 100,
        connections: [{ targetId: "node_7", fromSide: "right", toSide: "left", label: "Dashboard" }],
      },
      {
        id: "node_7",
        type: "output",
        title: "Executive Hospital Dashboard",
        description: "Daily Strategy Monitor • Real-time patient volume & SLA metrics",
        color: "#059669",
        x: 1990,
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
    folderId: "folder_financial",
    folderName: "Financial & Cost DAX",
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
        connections: [{ targetId: "rev_val", fromSide: "right", toSide: "left", label: "Value" }],
      },
      {
        id: "rev_val",
        type: "value",
        title: "฿124.8M",
        description: "MTD Gross Patient Revenue",
        color: "#059669",
        x: 1060,
        y: 160,
        width: 220,
        height: 100,
        connections: [{ targetId: "rev_4", fromSide: "right", toSide: "left", label: "Publish" }],
      },
      {
        id: "rev_4",
        type: "output",
        title: "D02 Financial Semantic Model",
        description: "Live Power BI semantic model for budget tracking",
        color: "#059669",
        x: 1360,
        y: 160,
        width: 240,
        height: 100,
        connections: [],
      },
    ],
  },
];

const LOCAL_STORAGE_KEY = "powerbi_whiteboard_boards_v2";
const FOLDERS_STORAGE_KEY = "powerbi_whiteboard_folders_v1";

// Node Template helper
export const NODE_TEMPLATES: Record<
  WhiteboardNodeType,
  { title: string; description: string; color: string; width: number; height: number; icon: any }
> = {
  trigger: {
    title: "Event / User Entry",
    description: "System entry point (e.g. check-in, arrival)",
    color: "#0284c7",
    width: 230,
    height: 95,
    icon: PlayCircle,
  },
  process: {
    title: "Execution Process",
    description: "Clinical or operational workflow task",
    color: "#4f46e5",
    width: 230,
    height: 100,
    icon: Workflow,
  },
  decision: {
    title: "Branching Decision",
    description: "Evaluates condition & routes flow",
    color: "#d97706",
    width: 230,
    height: 105,
    icon: GitBranch,
  },
  database: {
    title: "Data Table / Lake",
    description: "Schema source (e.g. fact_patient_visit)",
    color: "#0d9488",
    width: 230,
    height: 100,
    icon: Database,
  },
  dax: {
    title: "DAX Calculation Metric",
    description: "CALCULATE( SUM('fact'[amt]), 'dim'[flag]=1 )",
    color: "#7c3aed",
    width: 240,
    height: 110,
    icon: FunctionSquare,
  },
  value: {
    title: "98.5%",
    description: "Target KPI / Real-time Metric Value",
    color: "#059669",
    width: 210,
    height: 95,
    icon: Hash,
  },
  text: {
    title: "Canvas Note / Heading",
    description: "Double-click to write section notes or labels",
    color: "#475569",
    width: 240,
    height: 80,
    icon: Type,
  },
  cloud: {
    title: "Cloud Service / API",
    description: "External FHIR, Azure, or REST Gateway",
    color: "#0284c7",
    width: 230,
    height: 95,
    icon: Cloud,
  },
  queue: {
    title: "Event Stream / Queue",
    description: "Kafka message queue or staging buffer",
    color: "#ea580c",
    width: 230,
    height: 95,
    icon: ListTree,
  },
  output: {
    title: "Report / Visual Target",
    description: "Dashboard visual or executive KPI result",
    color: "#059669",
    width: 230,
    height: 100,
    icon: CheckCircle2,
  },
  sticky: {
    title: "Sticky Note",
    description: "Protocol reminder, review comment or memo",
    color: "#fef08a",
    width: 210,
    height: 110,
    icon: StickyNote,
  },
};

// Calculate exact port coordinate given node geometry and side
export function getPortCoordinate(node: WhiteboardNode, side: PortSide = "right"): { x: number; y: number } {
  const width = node.width || 230;
  const height = node.height || 100;
  switch (side) {
    case "top":
      return { x: node.x + width / 2, y: node.y };
    case "right":
      return { x: node.x + width, y: node.y + height / 2 };
    case "bottom":
      return { x: node.x + width / 2, y: node.y + height };
    case "left":
      return { x: node.x, y: node.y + height / 2 };
  }
}

export function WhiteboardPage() {
  const { currentTheme } = useTheme();

  // 1. PAGE VIEW: "list" (Gallery First) vs "canvas" (Interactive Editor)
  const [viewState, setViewState] = useState<"list" | "canvas">("list");
  const [boardSearchQuery, setBoardSearchQuery] = useState("");
  const [galleryView, setGalleryView] = useState<"grid" | "list" | "tree">("grid");

  // Folders State
  const [folders, setFolders] = useState<WhiteboardFolder[]>(DEFAULT_FOLDERS);
  const [selectedFolderFilter, setSelectedFolderFilter] = useState<string>("all");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderNameInput, setNewFolderNameInput] = useState("");

  // Boards State
  const [boards, setBoards] = useState<WhiteboardBoard[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<string>("");
  const [isRenamingBoard, setIsRenamingBoard] = useState(false);
  const [boardTitleInput, setBoardTitleInput] = useState("");
  const [syncStatus, setSyncStatus] = useState<"saved" | "saving" | "offline">("saved");

  // Canvas Viewport State (Zoom & Pan - Unlimited Virtual Space)
  const [zoom, setZoom] = useState<number>(0.8);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 80, y: 80 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Node Drag & Selection
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Copy / Paste Clipboard State
  const [clipboardNode, setClipboardNode] = useState<WhiteboardNode | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Right-Click Context Menu State (Supports both card and empty canvas)
  const [contextMenu, setContextMenu] = useState<
    | { type: "node"; x: number; y: number; node: WhiteboardNode }
    | { type: "canvas"; x: number; y: number; canvasX: number; canvasY: number }
    | null
  >(null);

  // In-Node Direct Double Click Editing State
  const [inlineEditing, setInlineEditing] = useState<{ nodeId: string; field: "title" | "description" } | null>(null);

  // 4-Side Port Interactive Wiring State
  const [connectingSource, setConnectingSource] = useState<{ nodeId: string; fromSide: PortSide } | null>(null);
  const [liveWireEnd, setLiveWireEnd] = useState<{ x: number; y: number } | null>(null);
  const [editingConnection, setEditingConnection] = useState<{ sourceId: string; targetId: string } | null>(null);

  // Connection Drag tracking refs
  const dragStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isWireDragRef = useRef<boolean>(false);
  const connectingSourceRef = useRef<{ nodeId: string; fromSide: PortSide } | null>(null);
  connectingSourceRef.current = connectingSource;

  // Color Palette Popover / State
  const [customHexInput, setCustomHexInput] = useState<string>("#2563eb");
  const [showColorPicker, setShowColorPicker] = useState<boolean>(false);

  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const persistTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2200);
  }, []);

  // Initialize Folders from LocalStorage
  useEffect(() => {
    try {
      const savedFolders = localStorage.getItem(FOLDERS_STORAGE_KEY);
      if (savedFolders) {
        const parsed = JSON.parse(savedFolders);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setFolders(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to load folders from storage", e);
    }
  }, []);

  // Save Folders to LocalStorage
  const persistFolders = useCallback((newFolders: WhiteboardFolder[]) => {
    setFolders(newFolders);
    try {
      localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify(newFolders));
    } catch (e) {}
  }, []);

  // Fetch Boards from Supabase (with fallback to LocalStorage and DEFAULT_BOARDS)
  useEffect(() => {
    let isMounted = true;
    async function loadBoards() {
      try {
        setSyncStatus("saving");
        const res = await fetch("/api/whiteboard");
        const data = await res.json();
        if (data.success && Array.isArray(data.boards) && data.boards.length > 0) {
          const mapped: WhiteboardBoard[] = data.boards.map((b: any) => ({
            id: b.id,
            name: b.name,
            folderId: b.folder_id || "folder_general",
            folderName: b.folder_name || "General Workflows",
            description: b.description || "",
            updatedAt: b.updated_at || new Date().toISOString(),
            nodes: b.nodes || [],
          }));
          if (isMounted) {
            setBoards(mapped);
            setActiveBoardId(mapped[0].id);
            setBoardTitleInput(mapped[0].name);
            setSyncStatus("saved");
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(mapped));
            return;
          }
        }
      } catch (err) {
        console.error("Failed to load boards from Supabase, checking local cache", err);
      }

      // Check LocalStorage
      try {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            if (isMounted) {
              setBoards(parsed);
              setActiveBoardId(parsed[0].id);
              setBoardTitleInput(parsed[0].name);
              setSyncStatus("saved");
              // Sync local boards to Supabase in background
              fetch("/api/whiteboard", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ boards: parsed }),
              }).catch(() => {});
              return;
            }
          }
        }
      } catch (e) {}

      // Seed Default Boards
      if (isMounted) {
        setBoards(DEFAULT_BOARDS);
        setActiveBoardId(DEFAULT_BOARDS[0].id);
        setBoardTitleInput(DEFAULT_BOARDS[0].name);
        setSyncStatus("saved");
        fetch("/api/whiteboard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ boards: DEFAULT_BOARDS }),
        }).catch(() => {});
      }
    }

    loadBoards();
    return () => {
      isMounted = false;
    };
  }, []);

  // Persist Boards to LocalStorage and Supabase
  const persistBoards = useCallback((newBoards: WhiteboardBoard[], changedBoard?: WhiteboardBoard) => {
    setBoards(newBoards);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newBoards));
    } catch (e) {}

    setSyncStatus("saving");
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);

    persistTimerRef.current = setTimeout(async () => {
      try {
        const target = changedBoard || newBoards[0];
        if (target) {
          await fetch("/api/whiteboard", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              board: {
                id: target.id,
                name: target.name,
                folder_id: target.folderId || "folder_general",
                folder_name: target.folderName || "General Workflows",
                description: target.description || "",
                nodes: target.nodes || [],
              },
            }),
          });
          setSyncStatus("saved");
        }
      } catch (err) {
        console.error("Failed to save board to Supabase:", err);
        setSyncStatus("offline");
      }
    }, 500);
  }, []);

  const activeBoard = useMemo(() => {
    return boards.find((b) => b.id === activeBoardId) || boards[0] || null;
  }, [boards, activeBoardId]);

  // Update nodes of active board
  const updateActiveNodes = useCallback(
    (updater: (nodes: WhiteboardNode[]) => WhiteboardNode[]) => {
      if (!activeBoard) return;
      const updatedNodes = updater(activeBoard.nodes);
      const updatedBoard: WhiteboardBoard = {
        ...activeBoard,
        nodes: updatedNodes,
        updatedAt: new Date().toISOString(),
      };
      const updatedBoards = boards.map((b) => (b.id === activeBoard.id ? updatedBoard : b));
      persistBoards(updatedBoards, updatedBoard);
    },
    [activeBoard, boards, persistBoards]
  );

  // =========================================================================
  // KEYBOARD SHORTCUTS: DELETE (Del/Backspace) & COPY / PASTE (Ctrl+C, Ctrl+V)
  // =========================================================================
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }

      // Close context menu on escape
      if (e.key === "Escape") {
        setContextMenu(null);
        setInlineEditing(null);
        setConnectingSource(null);
        return;
      }

      if (viewState !== "canvas") return;

      // DELETE / BACKSPACE
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
          showToast("Element removed");
        }
      }

      // CTRL+C / CMD+C (COPY)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        if (selectedNodeId && activeBoard) {
          const nodeToCopy = activeBoard.nodes.find((n) => n.id === selectedNodeId);
          if (nodeToCopy) {
            e.preventDefault();
            setClipboardNode(nodeToCopy);
            showToast(`Copied "${nodeToCopy.title}" to clipboard`);
          }
        }
      }

      // CTRL+V / CMD+V (PASTE)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
        if (clipboardNode) {
          e.preventDefault();
          const newId = `node_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const pastedNode: WhiteboardNode = {
            ...clipboardNode,
            id: newId,
            x: clipboardNode.x + 40,
            y: clipboardNode.y + 40,
            connections: [],
          };
          updateActiveNodes((nodes) => [...nodes, pastedNode]);
          setSelectedNodeId(newId);
          showToast("Element pasted");
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewState, selectedNodeId, clipboardNode, activeBoard, updateActiveNodes, showToast]);

  // =========================================================================
  // MOUSE WHEEL ZOOM LISTENER
  // =========================================================================
  useEffect(() => {
    const el = canvasContainerRef.current;
    if (!el || viewState !== "canvas") return;

    function handleWheel(e: WheelEvent) {
      e.preventDefault();
      const zoomStep = e.deltaY < 0 ? 0.08 : -0.08;
      setZoom((z) => Math.min(2.5, Math.max(0.2, Number((z + zoomStep).toFixed(2)))));
    }

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [viewState]);

  // Global click listener to close context menu
  useEffect(() => {
    function handleGlobalClick() {
      if (contextMenu) setContextMenu(null);
    }
    window.addEventListener("click", handleGlobalClick);
    return () => window.removeEventListener("click", handleGlobalClick);
  }, [contextMenu]);



  // Open Canvas for specific board
  function handleOpenBoard(boardId: string) {
    setActiveBoardId(boardId);
    setSelectedNodeId(null);
    setConnectingSource(null);
    setZoom(0.8);
    setPan({ x: 80, y: 80 });
    const b = boards.find((x) => x.id === boardId);
    if (b) setBoardTitleInput(b.name);
    setViewState("canvas");
  }

  // Create New Board
  function handleCreateNewBoard(folderId?: string) {
    const newId = `board_${Date.now()}`;
    const folder = folders.find((f) => f.id === folderId) || folders[0] || DEFAULT_FOLDERS[2];
    const newBoard: WhiteboardBoard = {
      id: newId,
      name: `Workflow Board ${boards.length + 1}`,
      folderId: folder.id,
      folderName: folder.name,
      description: "Visual workflow schema drafted on unlimited canvas.",
      updatedAt: new Date().toISOString(),
      nodes: [
        {
          id: `node_${Date.now()}_1`,
          type: "process",
          title: "Initial Step",
          description: "Double click to edit or drag ports to connect",
          color: "#4f46e5",
          x: 200,
          y: 180,
          width: 230,
          height: 100,
          connections: [],
        },
      ],
    };
    const updated = [newBoard, ...boards];
    persistBoards(updated, newBoard);
    setActiveBoardId(newId);
    setBoardTitleInput(newBoard.name);
    setViewState("canvas");
    showToast("Created new board");
  }

  // Rename Current Board
  function handleRenameBoardSubmit() {
    if (!activeBoard || !boardTitleInput.trim()) {
      setIsRenamingBoard(false);
      return;
    }
    const updatedBoard = {
      ...activeBoard,
      name: boardTitleInput.trim(),
      updatedAt: new Date().toISOString(),
    };
    const updated = boards.map((b) => (b.id === activeBoard.id ? updatedBoard : b));
    persistBoards(updated, updatedBoard);
    setIsRenamingBoard(false);
    showToast("Board renamed");
  }

  // Delete Board
  async function handleDeleteBoard(boardId: string, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    if (boards.length <= 1) {
      alert("At least one whiteboard canvas must remain.");
      return;
    }
    const targetBoard = boards.find((b) => b.id === boardId);
    if (!confirm(`Are you sure you want to delete "${targetBoard?.name || "this board"}"?`)) return;

    const remaining = boards.filter((b) => b.id !== boardId);
    persistBoards(remaining);

    // Call Supabase delete
    try {
      await fetch(`/api/whiteboard?id=${boardId}`, { method: "DELETE" });
    } catch (err) {
      console.error("Failed to delete board from Supabase:", err);
    }

    if (activeBoardId === boardId) {
      setActiveBoardId(remaining[0].id);
      setBoardTitleInput(remaining[0].name);
      setViewState("list");
    }
    showToast("Board deleted");
  }

  // Duplicate Board
  function handleDuplicateBoard(boardId: string, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    const sourceBoard = boards.find((b) => b.id === boardId);
    if (!sourceBoard) return;
    const newId = `board_${Date.now()}`;
    const duplicatedBoard: WhiteboardBoard = {
      ...sourceBoard,
      id: newId,
      name: `${sourceBoard.name} (Copy)`,
      updatedAt: new Date().toISOString(),
      nodes: sourceBoard.nodes.map((n) => ({
        ...n,
        id: `node_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      })),
    };
    const updated = [duplicatedBoard, ...boards];
    persistBoards(updated, duplicatedBoard);
    showToast("Board duplicated");
  }

  // Change Board Folder
  function handleChangeBoardFolder(boardId: string, newFolderId: string) {
    const folder = folders.find((f) => f.id === newFolderId);
    if (!folder) return;
    const target = boards.find((b) => b.id === boardId);
    if (!target) return;
    const updatedBoard = {
      ...target,
      folderId: folder.id,
      folderName: folder.name,
      updatedAt: new Date().toISOString(),
    };
    const updated = boards.map((b) => (b.id === boardId ? updatedBoard : b));
    persistBoards(updated, updatedBoard);
    showToast(`Moved to "${folder.name}"`);
  }

  // Create Folder
  function handleCreateFolderSubmit() {
    if (!newFolderNameInput.trim()) {
      setIsCreatingFolder(false);
      return;
    }
    const newFolder: WhiteboardFolder = {
      id: `folder_${Date.now()}`,
      name: newFolderNameInput.trim(),
      color: "#2563eb",
    };
    const updated = [...folders, newFolder];
    persistFolders(updated);
    setNewFolderNameInput("");
    setIsCreatingFolder(false);
    showToast(`Created folder "${newFolder.name}"`);
  }

  // Add Node from Toolbox
  function handleAddNode(type: WhiteboardNodeType, customColor?: string) {
    const newId = `node_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const template = NODE_TEMPLATES[type] || NODE_TEMPLATES.process;

    // Center spawn point based on current pan and zoom
    const spawnX = Math.round((-pan.x + 420) / zoom);
    const spawnY = Math.round((-pan.y + 220) / zoom);

    const newNode: WhiteboardNode = {
      id: newId,
      type,
      title: template.title,
      description: template.description,
      color: customColor || template.color,
      x: spawnX,
      y: spawnY,
      width: template.width,
      height: template.height,
      connections: [],
    };

    updateActiveNodes((nodes) => [...nodes, newNode]);
    setSelectedNodeId(newId);
    showToast(`Added ${type.toUpperCase()} node`);
  }

  // Duplicate Selected Node
  function handleDuplicateNode(node: WhiteboardNode) {
    const newId = `node_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const duplicated: WhiteboardNode = {
      ...node,
      id: newId,
      x: node.x + 40,
      y: node.y + 40,
      connections: [],
    };
    updateActiveNodes((nodes) => [...nodes, duplicated]);
    setSelectedNodeId(newId);
    setContextMenu(null);
    showToast("Node duplicated");
  }

  // Change Node Type
  function handleChangeNodeType(nodeId: string, newType: WhiteboardNodeType) {
    const template = NODE_TEMPLATES[newType];
    updateActiveNodes((nodes) =>
      nodes.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              type: newType,
              color: template ? template.color : n.color,
            }
          : n
      )
    );
    setContextMenu(null);
    showToast(`Changed shape to ${newType}`);
  }

  // Change Node Color
  function handleChangeNodeColor(nodeId: string, newColor: string) {
    updateActiveNodes((nodes) => nodes.map((n) => (n.id === nodeId ? { ...n, color: newColor } : n)));
    showToast("Color updated");
  }

  // Complete connection between two nodes
  const completeConnection = useCallback(
    (sourceId: string, fromSide: PortSide, targetId: string, toSide: PortSide) => {
      if (sourceId === targetId) {
        setConnectingSource(null);
        setLiveWireEnd(null);
        return;
      }

      const srcNode = activeBoard?.nodes.find((n) => n.id === sourceId);
      const tgtNode = activeBoard?.nodes.find((n) => n.id === targetId);

      updateActiveNodes((nodes) =>
        nodes.map((n) => {
          if (n.id === sourceId) {
            const current = n.connections || [];
            if (!current.some((c) => c.targetId === targetId)) {
              return {
                ...n,
                connections: [...current, { targetId, fromSide, toSide, label: "Flow" }],
              };
            }
          }
          return n;
        })
      );

      setConnectingSource(null);
      setLiveWireEnd(null);
      showToast(`Connected: ${srcNode?.title || "Node"} → ${tgtNode?.title || "Node"}`);
    },
    [activeBoard, updateActiveNodes, showToast]
  );

  // Connect directly to a node (auto-selects best entrance port based on relative position)
  const handleConnectToNode = useCallback(
    (targetNodeId: string) => {
      const src = connectingSourceRef.current;
      if (!src || src.nodeId === targetNodeId) return;
      const srcNode = activeBoard?.nodes.find((n) => n.id === src.nodeId);
      const tgtNode = activeBoard?.nodes.find((n) => n.id === targetNodeId);
      let bestSide: PortSide = "left";
      if (srcNode && tgtNode) {
        const dx = tgtNode.x - srcNode.x;
        const dy = tgtNode.y - srcNode.y;
        if (Math.abs(dx) > Math.abs(dy)) {
          bestSide = dx > 0 ? "left" : "right";
        } else {
          bestSide = dy > 0 ? "top" : "bottom";
        }
      }
      completeConnection(src.nodeId, src.fromSide, targetNodeId, bestSide);
    },
    [activeBoard, completeConnection]
  );

  // 4-Side Port Interactive Wiring Handlers
  function handlePortMouseDown(e: React.MouseEvent, nodeId: string, side: PortSide) {
    e.stopPropagation();
    e.preventDefault();

    // If ALREADY connecting from another node, complete the connection immediately!
    const src = connectingSourceRef.current;
    if (src) {
      if (src.nodeId !== nodeId) {
        completeConnection(src.nodeId, src.fromSide, nodeId, side);
        return;
      } else if (src.fromSide === side) {
        // Clicked exact same port -> toggle cancel
        setConnectingSource(null);
        setLiveWireEnd(null);
        return;
      }
      // Clicked different port on same source node -> switch port
      setConnectingSource({ nodeId, fromSide: side });
      const srcNode = activeBoard?.nodes.find((n) => n.id === nodeId);
      if (srcNode) {
        setLiveWireEnd(getPortCoordinate(srcNode, side));
      }
      return;
    }

    // Start new connection / drag
    setConnectingSource({ nodeId, fromSide: side });
    const srcNode = activeBoard?.nodes.find((n) => n.id === nodeId);
    if (srcNode) {
      const coord = getPortCoordinate(srcNode, side);
      setLiveWireEnd(coord);
    }
    dragStartPosRef.current = { x: e.clientX, y: e.clientY };
    isWireDragRef.current = true;
  }

  function handlePortMouseUp(nodeId: string, toSide: PortSide = "left") {
    const src = connectingSourceRef.current;
    if (!src) return;
    if (src.nodeId === nodeId) {
      // Releasing on same node where drag started - do not cancel immediately; let pointerup handle click vs drag
      return;
    }
    completeConnection(src.nodeId, src.fromSide, nodeId, toSide);
  }

  // Global mouse listeners for wire dragging & connecting via elementFromPoint
  useEffect(() => {
    if (viewState !== "canvas") return;

    function handleGlobalMouseMove(e: MouseEvent) {
      if (connectingSourceRef.current && canvasContainerRef.current) {
        const rect = canvasContainerRef.current.getBoundingClientRect();
        const curX = (e.clientX - rect.left - pan.x) / zoom;
        const curY = (e.clientY - rect.top - pan.y) / zoom;
        setLiveWireEnd({ x: curX, y: curY });
      }
    }

    function handleGlobalMouseUp(e: MouseEvent) {
      if (isWireDragRef.current && connectingSourceRef.current) {
        isWireDragRef.current = false;
        const dist = Math.hypot(
          e.clientX - dragStartPosRef.current.x,
          e.clientY - dragStartPosRef.current.y
        );

        // If user actually dragged (> 6px away from starting port)
        if (dist >= 6) {
          const elem = document.elementFromPoint(e.clientX, e.clientY);

          // 1. Target Port directly under pointer?
          const portEl = elem?.closest<HTMLElement>("[data-port-node-id]");
          if (portEl) {
            const tgtNodeId = portEl.getAttribute("data-port-node-id");
            const tgtSide = (portEl.getAttribute("data-port-side") || "left") as PortSide;
            if (tgtNodeId && tgtNodeId !== connectingSourceRef.current.nodeId) {
              completeConnection(
                connectingSourceRef.current.nodeId,
                connectingSourceRef.current.fromSide,
                tgtNodeId,
                tgtSide
              );
              return;
            }
          }

          // 2. Target Node card directly under pointer?
          const nodeEl = elem?.closest<HTMLElement>("[data-node-id]");
          if (nodeEl) {
            const tgtNodeId = nodeEl.getAttribute("data-node-id");
            if (tgtNodeId && tgtNodeId !== connectingSourceRef.current.nodeId) {
              handleConnectToNode(tgtNodeId);
              return;
            }
          }

          // Released on empty space after dragging -> cancel wire
          setConnectingSource(null);
          setLiveWireEnd(null);
        } else {
          // Single Click on port without dragging: enter Click-to-Connect mode!
          showToast("Port active! Click any card or port to connect, or Esc to cancel.");
        }
      }
    }

    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [viewState, pan, zoom, completeConnection, handleConnectToNode, showToast]);

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
    showToast("Wire disconnected");
  }

  // Clear all connections from node
  function handleDisconnectAll(nodeId: string) {
    updateActiveNodes((nodes) =>
      nodes.map((n) => {
        if (n.id === nodeId) {
          return { ...n, connections: [] };
        }
        return {
          ...n,
          connections: (n.connections || []).filter((c) => c.targetId !== nodeId),
        };
      })
    );
    setContextMenu(null);
    showToast("Disconnected all wires");
  }

  // Canvas Mouse Handlers (Unlimited Virtual Pan & Zoom)
  function handleCanvasMouseDown(e: React.MouseEvent) {
    // Empty space click initiates panning (Hand)
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    setSelectedNodeId(null);
    setConnectingSource(null);
    setLiveWireEnd(null);
    setContextMenu(null);
    setInlineEditing(null);
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
        nodes.map((n) => (n.id === draggingNodeId ? { ...n, x: newX, y: newY } : n))
      );
    }
  }

  function handleCanvasMouseUp() {
    setIsPanning(false);
    setDraggingNodeId(null);
  }

  // Node Click & Drag Start (Select & Move)
  function handleNodeMouseDown(e: React.MouseEvent, node: WhiteboardNode) {
    e.stopPropagation();

    // If connecting wire in progress, clicking node finishes connection!
    const src = connectingSourceRef.current;
    if (src && src.nodeId !== node.id) {
      e.preventDefault();
      handleConnectToNode(node.id);
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

  // Node Mouse Up (Handles wire connection dropped onto node)
  function handleNodeMouseUp(e: React.MouseEvent, node: WhiteboardNode) {
    const src = connectingSourceRef.current;
    if (src && src.nodeId !== node.id) {
      e.stopPropagation();
      handleConnectToNode(node.id);
    }
  }

  // Right Click on Node Card
  function handleNodeContextMenu(e: React.MouseEvent, node: WhiteboardNode) {
    e.preventDefault();
    e.stopPropagation();
    setSelectedNodeId(node.id);
    setContextMenu({ type: "node", x: e.clientX, y: e.clientY, node });
  }

  // Right Click on Empty Canvas Space
  function handleCanvasContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!canvasContainerRef.current) return;
    const rect = canvasContainerRef.current.getBoundingClientRect();
    const canvasX = Math.round((e.clientX - rect.left - pan.x) / zoom);
    const canvasY = Math.round((e.clientY - rect.top - pan.y) / zoom);
    setContextMenu({ type: "canvas", x: e.clientX, y: e.clientY, canvasX, canvasY });
  }

  // Paste Element at exact Canvas (X, Y) coordinates
  function handlePasteAt(canvasX: number, canvasY: number) {
    if (!clipboardNode) {
      showToast("Clipboard is empty! Select a card and press Ctrl+C first.");
      return;
    }
    const newNode: WhiteboardNode = {
      ...clipboardNode,
      id: `node-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      x: canvasX,
      y: canvasY,
      connections: [],
    };
    updateActiveNodes((nodes) => [...nodes, newNode]);
    setSelectedNodeId(newNode.id);
    setContextMenu(null);
    showToast(`Pasted "${newNode.title}"`);
  }

  // Quick Add Element at exact Canvas (X, Y) coordinates
  function handleAddNodeAt(type: WhiteboardNode["type"], canvasX: number, canvasY: number) {
    const tmpl = NODE_TEMPLATES[type] || NODE_TEMPLATES.process;
    const newNode: WhiteboardNode = {
      id: `node-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type,
      title: type === "value" ? "KPI Metric" : type === "text" ? "Note Header" : `New ${type.toUpperCase()}`,
      description: type === "value" ? "฿1,250,000" : "Click or double-click to configure...",
      x: canvasX,
      y: canvasY,
      width: tmpl.width,
      height: tmpl.height,
      color: type === "value" ? "#059669" : type === "decision" ? "#d97706" : "#2563eb",
      connections: [],
    };
    updateActiveNodes((nodes) => [...nodes, newNode]);
    setSelectedNodeId(newNode.id);
    setContextMenu(null);
    showToast(`Added ${type} element`);
  }

  // Fit View / Recenter All Elements
  function handleFitToView() {
    if (!activeBoard || activeBoard.nodes.length === 0) {
      setPan({ x: 80, y: 80 });
      setZoom(0.8);
      return;
    }
    const xs = activeBoard.nodes.map((n) => n.x);
    const ys = activeBoard.nodes.map((n) => n.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    setPan({ x: Math.round(-minX * 0.8 + 120), y: Math.round(-minY * 0.8 + 120) });
    setZoom(0.8);
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
    showToast("Downloaded whiteboard JSON");
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
          persistBoards(updated, newBoard);
          setActiveBoardId(newId);
          setBoardTitleInput(newBoard.name);
          setViewState("canvas");
          showToast("Imported board successfully");
        }
      } catch (err) {
        console.error("Failed to parse JSON file", err);
        alert("Invalid whiteboard JSON file format.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  // Filter boards by folder and query
  const filteredBoards = useMemo(() => {
    return boards.filter((b) => {
      const matchesSearch =
        b.name.toLowerCase().includes(boardSearchQuery.toLowerCase()) ||
        (b.description && b.description.toLowerCase().includes(boardSearchQuery.toLowerCase()));
      const matchesFolder = selectedFolderFilter === "all" || b.folderId === selectedFolderFilter;
      return matchesSearch && matchesFolder;
    });
  }, [boards, boardSearchQuery, selectedFolderFilter]);

  // =========================================================================
  // VIEW 1: WORKSPACE BOARDS GALLERY (GRID, LIST, TREE VIEWS + FOLDERS)
  // =========================================================================
  if (viewState === "list") {
    return (
      <div className="flex-1 flex flex-col h-full bg-[#f8fafc] overflow-y-auto">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed top-5 right-5 z-50 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold shadow-xl border border-slate-700 animate-in fade-in slide-in-from-top-2">
            {toastMessage}
          </div>
        )}

        {/* Gallery Header */}
        <header className="shrink-0 bg-white border-b border-slate-200 px-6 py-4">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
                  WORKSPACE BOARDS
                </span>
                <span className="text-xs text-slate-400 font-bold">•</span>
                <span className="text-xs font-semibold text-slate-500">
                  {boards.length} Whiteboards in {folders.length} Folders
                </span>
              </div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Workflow className="h-6 w-6 text-blue-600" />
                <span>Interactive Whiteboard Gallery</span>
              </h1>
            </div>

            {/* Top Actions: Search, View Switcher, Create Board */}
            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={boardSearchQuery}
                  onChange={(e) => setBoardSearchQuery(e.target.value)}
                  placeholder="Search whiteboards..."
                  className="pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 w-48 transition"
                />
              </div>

              {/* View Switcher: Grid | List | Tree */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setGalleryView("grid")}
                  title="Grid Cards View"
                  className={clsx(
                    "flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer",
                    galleryView === "grid"
                      ? "bg-white text-blue-600 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  <Grid className="h-3.5 w-3.5" />
                  <span>Grid</span>
                </button>
                <button
                  type="button"
                  onClick={() => setGalleryView("list")}
                  title="List Table View"
                  className={clsx(
                    "flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer",
                    galleryView === "list"
                      ? "bg-white text-blue-600 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  <ListIcon className="h-3.5 w-3.5" />
                  <span>List</span>
                </button>
                <button
                  type="button"
                  onClick={() => setGalleryView("tree")}
                  title="Folder Tree View"
                  className={clsx(
                    "flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer",
                    galleryView === "tree"
                      ? "bg-white text-blue-600 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  <FolderTree className="h-3.5 w-3.5" />
                  <span>Tree</span>
                </button>
              </div>

              {/* Create Board Button */}
              <button
                type="button"
                onClick={() => handleCreateNewBoard(selectedFolderFilter !== "all" ? selectedFolderFilter : undefined)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>New Whiteboard</span>
              </button>
            </div>
          </div>
        </header>

        {/* Folder Tabs & Management Bar */}
        <div className="bg-white/80 backdrop-blur-xs border-b border-slate-200 px-6 py-2.5">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 overflow-x-auto">
            {/* Folder Filters */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs font-bold text-slate-400 mr-1 flex items-center gap-1">
                <Folder className="h-3.5 w-3.5 text-slate-400" />
                <span>Folders:</span>
              </span>

              <button
                type="button"
                onClick={() => setSelectedFolderFilter("all")}
                className={clsx(
                  "px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer border",
                  selectedFolderFilter === "all"
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                )}
              >
                All Folders ({boards.length})
              </button>

              {folders.map((f) => {
                const count = boards.filter((b) => b.folderId === f.id).length;
                const isSelected = selectedFolderFilter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSelectedFolderFilter(f.id)}
                    className={clsx(
                      "px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer border flex items-center gap-1.5",
                      isSelected
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    )}
                  >
                    <span>{f.name}</span>
                    <span
                      className={clsx(
                        "px-1.5 py-0.2 rounded-full text-[10px]",
                        isSelected ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}

              {/* Inline Create Folder */}
              {isCreatingFolder ? (
                <div className="flex items-center gap-1 ml-2">
                  <input
                    type="text"
                    autoFocus
                    value={newFolderNameInput}
                    onChange={(e) => setNewFolderNameInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreateFolderSubmit()}
                    placeholder="Folder name..."
                    className="px-2.5 py-1 text-xs rounded-lg bg-white border border-blue-500 text-slate-800 w-36 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCreateFolderSubmit}
                    className="p-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCreatingFolder(false)}
                    className="p-1 rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsCreatingFolder(true)}
                  className="px-2.5 py-1 rounded-full text-xs font-bold text-slate-500 hover:text-blue-600 hover:bg-blue-50 border border-dashed border-slate-300 transition cursor-pointer flex items-center gap-1"
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                  <span>New Folder</span>
                </button>
              )}
            </div>

            {/* Cloud Sync Badge */}
            <div className="flex items-center gap-2 shrink-0">
              {syncStatus === "saving" && (
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                  <RefreshCw className="h-3 w-3 animate-spin" /> Saving to Supabase...
                </span>
              )}
              {syncStatus === "saved" && (
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  <Cloud className="h-3 w-3 text-emerald-600" /> Synced to Supabase
                </span>
              )}
              {syncStatus === "offline" && (
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                  Local Cache Active
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Gallery Content Area */}
        <div className="flex-1 max-w-7xl w-full mx-auto p-6">
          {/* ================= VIEW A: GRID CARDS ================= */}
          {galleryView === "grid" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredBoards.map((b) => {
                const totalConnections = b.nodes.reduce((acc, n) => acc + (n.connections?.length || 0), 0);
                const stickyCount = b.nodes.filter((n) => n.type === "sticky").length;

                return (
                  <div
                    key={b.id}
                    onClick={() => handleOpenBoard(b.id)}
                    className="group bg-white rounded-3xl border border-slate-200 p-5 shadow-xs hover:shadow-xl hover:border-blue-400 transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden"
                  >
                    <div className="space-y-3">
                      {/* Top Meta: Folder + Actions */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                          <Folder className="h-3 w-3 text-slate-400" />
                          <span>{b.folderName || "General"}</span>
                        </span>

                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
                          <button
                            type="button"
                            onClick={(e) => handleDuplicateBoard(b.id, e)}
                            title="Duplicate Whiteboard"
                            className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 cursor-pointer"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteBoard(b.id, e)}
                            title="Delete Whiteboard"
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Board Title */}
                      <h3 className="text-base font-extrabold text-slate-900 group-hover:text-blue-600 transition truncate">
                        {b.name}
                      </h3>

                      {/* Description */}
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {b.description || "Visual workflow canvas with elements and port-to-port relationships."}
                      </p>

                      {/* Element Badges */}
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

                    {/* Footer */}
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
          )}

          {/* ================= VIEW B: LIST TABLE ================= */}
          {galleryView === "list" && (
            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-extrabold text-[10px]">
                  <tr>
                    <th className="py-3 px-5">Whiteboard Name</th>
                    <th className="py-3 px-4">Folder</th>
                    <th className="py-3 px-4 text-center">Elements</th>
                    <th className="py-3 px-4 text-center">Wires</th>
                    <th className="py-3 px-4">Last Updated</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredBoards.map((b) => {
                    const totalConnections = b.nodes.reduce((acc, n) => acc + (n.connections?.length || 0), 0);
                    return (
                      <tr
                        key={b.id}
                        onClick={() => handleOpenBoard(b.id)}
                        className="hover:bg-blue-50/50 transition cursor-pointer group"
                      >
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-2">
                            <Workflow className="h-4 w-4 text-blue-600 shrink-0" />
                            <div>
                              <span className="font-bold text-slate-900 group-hover:text-blue-600 transition block">
                                {b.name}
                              </span>
                              <span className="text-[11px] text-slate-400 truncate block max-w-sm">
                                {b.description || "No description"}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={b.folderId || "folder_general"}
                            onChange={(e) => handleChangeBoardFolder(b.id, e.target.value)}
                            className="text-[11px] font-bold px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 focus:outline-none"
                          >
                            {folders.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-slate-700">
                          {b.nodes.length}
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-blue-600">
                          {totalConnections}
                        </td>
                        <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                          {new Date(b.updatedAt).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 px-5 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenBoard(b.id)}
                              className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-bold text-[11px] hover:bg-blue-700 transition cursor-pointer"
                            >
                              Open
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDuplicateBoard(b.id, e)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 transition cursor-pointer"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteBoard(b.id, e)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
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
          )}

          {/* ================= VIEW C: TREE VIEW ================= */}
          {galleryView === "tree" && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-white rounded-3xl border border-slate-200 p-6 shadow-xs min-h-[500px]">
              {/* Left Pane: Hierarchical Tree Navigation */}
              <div className="md:col-span-5 border-r border-slate-100 pr-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                    <FolderTree className="h-4 w-4 text-blue-600" />
                    <span>Workflow Directory</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsCreatingFolder(true)}
                    className="p-1 text-slate-400 hover:text-blue-600 rounded-lg"
                    title="Add Folder"
                  >
                    <FolderPlus className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="space-y-1">
                  {folders.map((f) => {
                    const folderBoards = boards.filter((b) => b.folderId === f.id);
                    const isFolderSelected = selectedFolderFilter === f.id;

                    return (
                      <div key={f.id} className="space-y-0.5">
                        <button
                          type="button"
                          onClick={() => setSelectedFolderFilter(isFolderSelected ? "all" : f.id)}
                          className={clsx(
                            "w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold transition text-left cursor-pointer",
                            isFolderSelected ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <FolderOpen className={clsx("h-4 w-4", isFolderSelected ? "text-blue-600" : "text-amber-500")} />
                            <span>{f.name}</span>
                          </div>
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-600 font-mono">
                            {folderBoards.length}
                          </span>
                        </button>

                        {/* Boards nested in folder */}
                        <div className="pl-6 space-y-0.5">
                          {folderBoards.map((b) => (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => handleOpenBoard(b.id)}
                              className="w-full flex items-center justify-between py-1.5 px-2.5 rounded-lg text-xs font-medium text-slate-600 hover:text-blue-600 hover:bg-slate-50 transition text-left truncate cursor-pointer group"
                            >
                              <div className="flex items-center gap-1.5 truncate">
                                <Workflow className="h-3 w-3 text-slate-400 group-hover:text-blue-500 shrink-0" />
                                <span className="truncate">{b.name}</span>
                              </div>
                              <ArrowRight className="h-3 w-3 text-slate-300 group-hover:text-blue-500 shrink-0" />
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Pane: Selected Folder Overview */}
              <div className="md:col-span-7 pl-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-blue-100 text-blue-800">
                      TREE VIEW EXPLORER
                    </span>
                  </div>
                  <h2 className="text-lg font-black text-slate-900 mb-1">
                    {selectedFolderFilter === "all"
                      ? "All Whiteboard Workspaces"
                      : folders.find((f) => f.id === selectedFolderFilter)?.name || "Folder Overview"}
                  </h2>
                  <p className="text-xs text-slate-500 mb-5">
                    Click any whiteboard item in the tree to launch the unlimited canvas editor.
                  </p>

                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Matching Boards
                      </span>
                      <span className="text-2xl font-black text-slate-900 font-mono">
                        {filteredBoards.length}
                      </span>
                    </div>
                    <div className="p-3 rounded-2xl bg-blue-50 border border-blue-200 text-center">
                      <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider block">
                        Total Elements
                      </span>
                      <span className="text-2xl font-black text-blue-700 font-mono">
                        {filteredBoards.reduce((acc, b) => acc + b.nodes.length, 0)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {filteredBoards.slice(0, 4).map((b) => (
                      <div
                        key={b.id}
                        onClick={() => handleOpenBoard(b.id)}
                        className="p-3 rounded-2xl bg-slate-50 border border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 transition cursor-pointer flex items-center justify-between"
                      >
                        <div>
                          <span className="text-xs font-bold text-slate-900 block">{b.name}</span>
                          <span className="text-[10px] text-slate-400">{b.nodes.length} Elements • Updated {new Date(b.updatedAt).toLocaleDateString()}</span>
                        </div>
                        <button
                          type="button"
                          className="px-3 py-1 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition"
                        >
                          Open Canvas
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    Press <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border text-slate-600 font-mono">Ctrl+C</kbd> / <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border text-slate-600 font-mono">Ctrl+V</kbd> inside canvas to clone elements.
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCreateNewBoard(selectedFolderFilter !== "all" ? selectedFolderFilter : undefined)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                  >
                    <Plus className="h-4 w-4" /> Create Board in this Folder
                  </button>
                </div>
              </div>
            </div>
          )}

          {filteredBoards.length === 0 && (
            <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 p-8 space-y-3">
              <Workflow className="h-8 w-8 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">No Whiteboard Workspaces Found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No boards matched your search or folder filter. Try clearing the filter or create a new board.
              </p>
              <button
                type="button"
                onClick={() => handleCreateNewBoard()}
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
  // VIEW 2: INTERACTIVE UNLIMITED CANVAS VIEW
  // =========================================================================
  return (
    <div className="flex-1 flex flex-col h-full bg-[#f8fafc] overflow-hidden select-none relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold shadow-xl border border-slate-700 animate-in fade-in slide-in-from-top-2">
          {toastMessage}
        </div>
      )}

      {/* ================= TOP CANVAS RIBBON ================= */}
      <header className="h-14 shrink-0 bg-white border-b border-slate-200 px-4 flex items-center justify-between gap-3 shadow-2xs z-30">
        <div className="flex items-center gap-3">
          {/* Back to Gallery */}
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
                  className="p-1 rounded-md text-slate-400 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition cursor-pointer"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>

          {/* Folder Selector Dropdown */}
          {activeBoard && (
            <select
              value={activeBoard.folderId || "folder_general"}
              onChange={(e) => handleChangeBoardFolder(activeBoard.id, e.target.value)}
              className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 focus:outline-none cursor-pointer"
            >
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  📁 {f.name}
                </option>
              ))}
            </select>
          )}

          {/* Sync Status Badge */}
          <div className="flex items-center gap-1">
            {syncStatus === "saving" && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                <RefreshCw className="h-2.5 w-2.5 animate-spin" /> Saving...
              </span>
            )}
            {syncStatus === "saved" && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <Cloud className="h-2.5 w-2.5 text-emerald-600" /> Saved to Supabase
              </span>
            )}
          </div>
        </div>

        {/* Canvas Controls: Zoom, Recenter, Export/Import */}
        <div className="flex items-center gap-2">
          {/* Zoom Controls */}
          <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.2, Number((z - 0.1).toFixed(2))))}
              title="Zoom Out (Scroll Down)"
              className="p-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition cursor-pointer"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="text-[11px] font-mono font-bold w-12 text-center text-slate-700">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(2.5, Number((z + 0.1).toFixed(2))))}
              title="Zoom In (Scroll Up)"
              className="p-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition cursor-pointer"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Fit View / Recenter */}
          <button
            type="button"
            onClick={handleFitToView}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition cursor-pointer shadow-2xs"
            title="Fit to view (Recenter elements)"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            <span>Recenter</span>
          </button>

          {/* Export JSON */}
          <button
            type="button"
            onClick={handleExportJson}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition cursor-pointer shadow-2xs"
            title="Download board backup JSON"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export</span>
          </button>

          {/* Import JSON */}
          <label className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition cursor-pointer shadow-2xs">
            <Upload className="h-3.5 w-3.5" />
            <span>Import</span>
            <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
          </label>

          <div className="h-5 w-px bg-slate-200" />

          {/* Delete Board */}
          <button
            type="button"
            onClick={(e) => activeBoard && handleDeleteBoard(activeBoard.id, e)}
            className="p-1.5 rounded-xl text-rose-500 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 transition cursor-pointer shadow-2xs"
            title="Delete this whiteboard"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* ================= MAIN UNLIMITED WORKSPACE ================= */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* FLOATING WORKFLOW TOOLBOX (LEFT SIDE) */}
        <aside className="absolute left-4 top-4 bottom-4 w-60 z-20 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-xl p-3 flex flex-col gap-3 overflow-y-auto">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800">
              <Boxes className="h-4 w-4 text-blue-600" />
              <span>Canvas Elements</span>
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
                className="h-8 rounded-xl bg-yellow-200 hover:bg-yellow-300 border border-yellow-300 text-yellow-900 text-[10px] font-bold shadow-2xs flex items-center justify-center cursor-pointer transition"
              >
                Yellow
              </button>
              <button
                type="button"
                onClick={() => handleAddNode("sticky", "#bae6fd")}
                className="h-8 rounded-xl bg-sky-200 hover:bg-sky-300 border border-sky-300 text-sky-900 text-[10px] font-bold shadow-2xs flex items-center justify-center cursor-pointer transition"
              >
                Sky Blue
              </button>
              <button
                type="button"
                onClick={() => handleAddNode("sticky", "#bbf7d0")}
                className="h-8 rounded-xl bg-emerald-200 hover:bg-emerald-300 border border-emerald-300 text-emerald-900 text-[10px] font-bold shadow-2xs flex items-center justify-center cursor-pointer transition"
              >
                Green
              </button>
              <button
                type="button"
                onClick={() => handleAddNode("sticky", "#fed7aa")}
                className="h-8 rounded-xl bg-orange-200 hover:bg-orange-300 border border-orange-300 text-orange-900 text-[10px] font-bold shadow-2xs flex items-center justify-center cursor-pointer transition"
              >
                Peach
              </button>
              <button
                type="button"
                onClick={() => handleAddNode("sticky", "#e9d5ff")}
                className="h-8 rounded-xl bg-purple-200 hover:bg-purple-300 border border-purple-300 text-purple-900 text-[10px] font-bold shadow-2xs flex items-center justify-center cursor-pointer transition"
              >
                Purple
              </button>
              <button
                type="button"
                onClick={() => handleAddNode("sticky", "#fecdd3")}
                className="h-8 rounded-xl bg-rose-200 hover:bg-rose-300 border border-rose-300 text-rose-900 text-[10px] font-bold shadow-2xs flex items-center justify-center cursor-pointer transition"
              >
                Rose
              </button>
            </div>
          </div>

          {/* WORKFLOW SHAPES & EXTENDED TYPES */}
          <div className="space-y-1.5 pt-1 border-t border-slate-100">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
              Shapes &amp; Logic
            </span>

            {/* Value KPI Node */}
            <button
              type="button"
              onClick={() => handleAddNode("value")}
              className="w-full flex items-center gap-2 p-2 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-left text-xs font-semibold text-slate-800 transition cursor-pointer shadow-2xs"
            >
              <Hash className="h-4 w-4 text-emerald-600 shrink-0" />
              <div>
                <span className="font-bold block text-[11px]">+ KPI / Value Metric</span>
                <span className="text-[9px] text-slate-400">Large numeric display (e.g. 98.5%)</span>
              </div>
            </button>

            {/* Plain Text / Label Node */}
            <button
              type="button"
              onClick={() => handleAddNode("text")}
              className="w-full flex items-center gap-2 p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 text-left text-xs font-semibold text-slate-800 transition cursor-pointer shadow-2xs"
            >
              <Type className="h-4 w-4 text-slate-600 shrink-0" />
              <div>
                <span className="font-bold block text-[11px]">+ Text Label / Title</span>
                <span className="text-[9px] text-slate-400">Section heading, free annotation</span>
              </div>
            </button>

            {/* Trigger / Event */}
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

            {/* Process Step */}
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

            {/* Decision Branch */}
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

            {/* Cloud Service / API */}
            <button
              type="button"
              onClick={() => handleAddNode("cloud")}
              className="w-full flex items-center gap-2 p-2 rounded-xl bg-slate-50 hover:bg-sky-50 border border-slate-200 hover:border-sky-300 text-left text-xs font-semibold text-slate-800 transition cursor-pointer shadow-2xs"
            >
              <Cloud className="h-4 w-4 text-sky-500 shrink-0" />
              <div>
                <span className="font-bold block text-[11px]">+ Cloud / External API</span>
                <span className="text-[9px] text-slate-400">FHIR, Lakehouse, Gateway</span>
              </div>
            </button>

            {/* Message Queue / Buffer */}
            <button
              type="button"
              onClick={() => handleAddNode("queue")}
              className="w-full flex items-center gap-2 p-2 rounded-xl bg-slate-50 hover:bg-orange-50 border border-slate-200 hover:border-orange-300 text-left text-xs font-semibold text-slate-800 transition cursor-pointer shadow-2xs"
            >
              <ListTree className="h-4 w-4 text-orange-600 shrink-0" />
              <div>
                <span className="font-bold block text-[11px]">+ Event Queue / Buffer</span>
                <span className="text-[9px] text-slate-400">Kafka topic, staging queue</span>
              </div>
            </button>

            {/* Data Table */}
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

            {/* DAX Metric */}
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

            {/* Output Visual */}
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

          {/* Canvas Shortcuts & Helpers */}
          <div className="mt-auto pt-2 border-t border-slate-100 text-[10px] text-slate-400 leading-relaxed">
            <span className="font-bold text-slate-600 block mb-0.5">Quick Actions:</span>
            • <b>Double Click</b>: Direct in-node edit
            <br />• <b>Right Click</b>: Card options menu
            <br />• <b>Ctrl+C / Ctrl+V</b>: Copy &amp; Paste
            <br />• <b>Scroll Wheel</b>: Zoom In / Out
            <br />• <b>Empty Space</b>: Pan canvas (Hand)
            <br />• <b>Del / Backspace</b>: Delete node
          </div>
        </aside>

        {/* ================= INTERACTIVE UNLIMITED CANVAS ================= */}
        <div
          ref={canvasContainerRef}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onContextMenu={handleCanvasContextMenu}
          className={clsx(
            "flex-1 w-full h-full relative overflow-hidden select-none",
            isPanning ? "cursor-grabbing" : "cursor-grab"
          )}
          style={{
            backgroundColor: "#f8fafc",
            backgroundImage: "radial-gradient(#cbd5e1 1.5px, transparent 1.5px)",
            backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`,
          }}
        >
          {/* Virtual Unbounded Workspace Container */}
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "0 0",
              position: "absolute",
              left: 0,
              top: 0,
              width: 0,
              height: 0,
              overflow: "visible",
            }}
          >
            {/* SVG Connecting Curves */}
            <svg
              className="absolute inset-0 pointer-events-none"
              style={{ overflow: "visible", left: 0, top: 0, width: 0, height: 0 }}
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
                <marker
                  id="arrow-whiteboard-live"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#f59e0b" />
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

                  let cp1X = srcCoord.x;
                  let cp1Y = srcCoord.y;
                  if (conn.fromSide === "left") cp1X -= curveDist;
                  else if (conn.fromSide === "top") cp1Y -= curveDist;
                  else if (conn.fromSide === "bottom") cp1Y += curveDist;
                  else cp1X += curveDist;

                  let cp2X = tgtCoord.x;
                  let cp2Y = tgtCoord.y;
                  if (conn.toSide === "right") cp2X += curveDist;
                  else if (conn.toSide === "top") cp2Y -= curveDist;
                  else if (conn.toSide === "bottom") cp2Y += curveDist;
                  else cp2X -= curveDist;

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
                      strokeWidth="3"
                      strokeDasharray="6 4"
                      markerEnd="url(#arrow-whiteboard-live)"
                      className="pointer-events-none"
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
              const template = NODE_TEMPLATES[node.type] || NODE_TEMPLATES.process;
              const IconComp = template.icon;
              const isEditingTitle = inlineEditing?.nodeId === node.id && inlineEditing?.field === "title";
              const isEditingDesc = inlineEditing?.nodeId === node.id && inlineEditing?.field === "description";

              return (
                <div
                  key={node.id}
                  data-node-id={node.id}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId((curr) => (curr === node.id ? null : curr))}
                  onMouseDown={(e) => handleNodeMouseDown(e, node)}
                  onMouseUp={(e) => handleNodeMouseUp(e, node)}
                  onClick={(e) => {
                    if (connectingSourceRef.current && connectingSourceRef.current.nodeId !== node.id) {
                      e.stopPropagation();
                      handleConnectToNode(node.id);
                    }
                  }}
                  onContextMenu={(e) => handleNodeContextMenu(e, node)}
                  style={{
                    position: "absolute",
                    left: `${node.x}px`,
                    top: `${node.y}px`,
                    width: `${node.width}px`,
                    minHeight: `${node.height}px`,
                    backgroundColor: node.type === "sticky" ? node.color || "#fef08a" : node.type === "text" ? "transparent" : "#ffffff",
                    borderColor: node.color || "#e2e8f0",
                    cursor: isConnecting ? "crosshair" : "move",
                  }}
                  className={clsx(
                    "select-none transition-shadow relative flex flex-col justify-between group",
                    node.type === "sticky"
                      ? "p-3 rounded-xl shadow-md border border-black/10 text-slate-900"
                      : node.type === "text"
                      ? "p-2 rounded-xl text-slate-800 border-2 border-dashed border-slate-300 hover:border-blue-400 bg-white/60 backdrop-blur-2xs"
                      : "p-3 rounded-2xl shadow-md border-2 text-slate-800 bg-white",
                    isSelected && "ring-3 ring-blue-600 shadow-2xl",
                    isConnecting && connectingSource?.nodeId !== node.id && "ring-2 ring-emerald-400 bg-emerald-50/20"
                  )}
                >
                  {/* ================= 4 CONNECTION PORTS (TOP, RIGHT, BOTTOM, LEFT) ================= */}
                  {(isHovered || isSelected || isConnecting) && node.type !== "text" && (
                    <>
                      {/* Top Port */}
                      <button
                        type="button"
                        data-port-node-id={node.id}
                        data-port-side="top"
                        onMouseDown={(e) => handlePortMouseDown(e, node.id, "top")}
                        onMouseUp={(e) => {
                          e.stopPropagation();
                          handlePortMouseUp(node.id, "top");
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (connectingSourceRef.current && connectingSourceRef.current.nodeId !== node.id) {
                            completeConnection(connectingSourceRef.current.nodeId, connectingSourceRef.current.fromSide, node.id, "top");
                          }
                        }}
                        title="Top Connection Port"
                        className={clsx(
                          "absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border-2 border-white shadow-md transition cursor-crosshair flex items-center justify-center text-white text-[10px] font-bold select-none",
                          connectingSource?.nodeId === node.id && connectingSource?.fromSide === "top"
                            ? "h-6 w-6 bg-amber-500 ring-4 ring-amber-300 scale-130 z-40"
                            : isConnecting && connectingSource?.nodeId !== node.id
                            ? "h-6 w-6 bg-emerald-500 hover:bg-emerald-600 ring-4 ring-emerald-300 animate-pulse scale-125 z-30"
                            : "h-5 w-5 bg-blue-500 hover:scale-130 hover:bg-blue-600 z-20"
                        )}
                      >
                        +
                      </button>

                      {/* Right Port */}
                      <button
                        type="button"
                        data-port-node-id={node.id}
                        data-port-side="right"
                        onMouseDown={(e) => handlePortMouseDown(e, node.id, "right")}
                        onMouseUp={(e) => {
                          e.stopPropagation();
                          handlePortMouseUp(node.id, "right");
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (connectingSourceRef.current && connectingSourceRef.current.nodeId !== node.id) {
                            completeConnection(connectingSourceRef.current.nodeId, connectingSourceRef.current.fromSide, node.id, "right");
                          }
                        }}
                        title="Right Connection Port"
                        className={clsx(
                          "absolute -right-3 top-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md transition cursor-crosshair flex items-center justify-center text-white text-[10px] font-bold select-none",
                          connectingSource?.nodeId === node.id && connectingSource?.fromSide === "right"
                            ? "h-6 w-6 bg-amber-500 ring-4 ring-amber-300 scale-130 z-40"
                            : isConnecting && connectingSource?.nodeId !== node.id
                            ? "h-6 w-6 bg-emerald-500 hover:bg-emerald-600 ring-4 ring-emerald-300 animate-pulse scale-125 z-30"
                            : "h-5 w-5 bg-blue-500 hover:scale-130 hover:bg-blue-600 z-20"
                        )}
                      >
                        +
                      </button>

                      {/* Bottom Port */}
                      <button
                        type="button"
                        data-port-node-id={node.id}
                        data-port-side="bottom"
                        onMouseDown={(e) => handlePortMouseDown(e, node.id, "bottom")}
                        onMouseUp={(e) => {
                          e.stopPropagation();
                          handlePortMouseUp(node.id, "bottom");
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (connectingSourceRef.current && connectingSourceRef.current.nodeId !== node.id) {
                            completeConnection(connectingSourceRef.current.nodeId, connectingSourceRef.current.fromSide, node.id, "bottom");
                          }
                        }}
                        title="Bottom Connection Port"
                        className={clsx(
                          "absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-full border-2 border-white shadow-md transition cursor-crosshair flex items-center justify-center text-white text-[10px] font-bold select-none",
                          connectingSource?.nodeId === node.id && connectingSource?.fromSide === "bottom"
                            ? "h-6 w-6 bg-amber-500 ring-4 ring-amber-300 scale-130 z-40"
                            : isConnecting && connectingSource?.nodeId !== node.id
                            ? "h-6 w-6 bg-emerald-500 hover:bg-emerald-600 ring-4 ring-emerald-300 animate-pulse scale-125 z-30"
                            : "h-5 w-5 bg-blue-500 hover:scale-130 hover:bg-blue-600 z-20"
                        )}
                      >
                        +
                      </button>

                      {/* Left Port */}
                      <button
                        type="button"
                        data-port-node-id={node.id}
                        data-port-side="left"
                        onMouseDown={(e) => handlePortMouseDown(e, node.id, "left")}
                        onMouseUp={(e) => {
                          e.stopPropagation();
                          handlePortMouseUp(node.id, "left");
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (connectingSourceRef.current && connectingSourceRef.current.nodeId !== node.id) {
                            completeConnection(connectingSourceRef.current.nodeId, connectingSourceRef.current.fromSide, node.id, "left");
                          }
                        }}
                        title="Left Connection Port"
                        className={clsx(
                          "absolute -left-3 top-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md transition cursor-crosshair flex items-center justify-center text-white text-[10px] font-bold select-none",
                          connectingSource?.nodeId === node.id && connectingSource?.fromSide === "left"
                            ? "h-6 w-6 bg-amber-500 ring-4 ring-amber-300 scale-130 z-40"
                            : isConnecting && connectingSource?.nodeId !== node.id
                            ? "h-6 w-6 bg-emerald-500 hover:bg-emerald-600 ring-4 ring-emerald-300 animate-pulse scale-125 z-30"
                            : "h-5 w-5 bg-blue-500 hover:scale-130 hover:bg-blue-600 z-20"
                        )}
                      >
                        +
                      </button>
                    </>
                  )}

                  {/* Header: Node Type Icon + Category Badge + Context Menu Trigger */}
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <div
                        className="p-1 rounded-md text-white flex items-center justify-center shadow-2xs"
                        style={{ backgroundColor: node.color || "#4f46e5" }}
                      >
                        <IconComp className="h-3 w-3 text-white" />
                      </div>
                      <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-mono">
                        {node.type}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleNodeContextMenu(e, node)}
                      className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-black/5 opacity-0 group-hover:opacity-100 transition cursor-pointer"
                      title="Right-click or click for options"
                    >
                      <MoreVertical className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Node Title & Direct Double Click Inline Editing */}
                  {isEditingTitle ? (
                    <input
                      type="text"
                      autoFocus
                      value={node.title}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateActiveNodes((nodes) =>
                          nodes.map((n) => (n.id === node.id ? { ...n, title: val } : n))
                        );
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") setInlineEditing(null);
                      }}
                      onBlur={() => setInlineEditing(null)}
                      className="w-full px-1.5 py-0.5 text-xs font-black rounded-lg bg-white border border-blue-500 text-slate-900 focus:outline-none shadow-inner"
                    />
                  ) : node.type === "value" ? (
                    <div
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setInlineEditing({ nodeId: node.id, field: "title" });
                      }}
                      title="Double-click to edit metric value"
                      className="cursor-text"
                    >
                      <div className="text-2xl font-black font-mono tracking-tight text-slate-900 truncate">
                        {node.title}
                      </div>
                    </div>
                  ) : (
                    <h4
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setInlineEditing({ nodeId: node.id, field: "title" });
                      }}
                      title="Double-click to edit title"
                      className={clsx(
                        "font-extrabold cursor-text truncate leading-snug",
                        node.type === "text" ? "text-sm text-slate-900" : "text-xs text-slate-900"
                      )}
                    >
                      {node.title}
                    </h4>
                  )}

                  {/* Node Description & Direct Double Click Inline Editing */}
                  {isEditingDesc ? (
                    <textarea
                      autoFocus
                      rows={2}
                      value={node.description}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateActiveNodes((nodes) =>
                          nodes.map((n) => (n.id === node.id ? { ...n, description: val } : n))
                        );
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          setInlineEditing(null);
                        }
                      }}
                      onBlur={() => setInlineEditing(null)}
                      className="w-full px-1.5 py-1 text-[11px] rounded-lg bg-white border border-blue-500 text-slate-700 focus:outline-none mt-1 resize-none shadow-inner"
                    />
                  ) : (
                    <p
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setInlineEditing({ nodeId: node.id, field: "description" });
                      }}
                      title="Double-click to edit description"
                      className="text-[10px] text-slate-500 line-clamp-2 leading-tight mt-1 cursor-text"
                    >
                      {node.description || "Double-click to add details..."}
                    </p>
                  )}

                  {/* Wire Count Indicator */}
                  {node.connections && node.connections.length > 0 && (
                    <div className="mt-2 pt-1 border-t border-black/5 flex items-center justify-between text-[9px] text-slate-400 font-mono">
                      <span>{node.connections.length} outgoing</span>
                      <span className="flex items-center gap-0.5 text-blue-600 font-bold">
                        Wired <ArrowRight className="h-2.5 w-2.5" />
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ================= RIGHT-CLICK CARD CONTEXT MENU ================= */}
          {contextMenu && contextMenu.type === "node" && (
            <div
              style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
              onClick={(e) => e.stopPropagation()}
              className="fixed z-50 bg-white rounded-2xl border border-slate-200 shadow-2xl p-2 w-56 flex flex-col gap-1 text-xs animate-in fade-in zoom-in-95"
            >
              <div className="px-2 py-1 pb-1.5 border-b border-slate-100 flex items-center justify-between">
                <span className="font-extrabold text-slate-800 text-[11px] truncate">
                  {contextMenu.node.title}
                </span>
                <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-bold">
                  {contextMenu.node.type}
                </span>
              </div>

              {/* Edit Content */}
              <button
                type="button"
                onClick={() => {
                  setInlineEditing({ nodeId: contextMenu.node.id, field: "title" });
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-700 hover:bg-slate-100 transition cursor-pointer text-left"
              >
                <Pencil className="h-3.5 w-3.5 text-blue-600" />
                <span>Edit Title &amp; Text</span>
              </button>

              {/* Copy (Ctrl+C) */}
              <button
                type="button"
                onClick={() => {
                  setClipboardNode(contextMenu.node);
                  setContextMenu(null);
                  showToast(`Copied "${contextMenu.node.title}"`);
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-slate-700 hover:bg-slate-100 transition cursor-pointer text-left"
              >
                <div className="flex items-center gap-2">
                  <Copy className="h-3.5 w-3.5 text-slate-500" />
                  <span>Copy Element</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">Ctrl+C</span>
              </button>

              {/* Duplicate */}
              <button
                type="button"
                onClick={() => handleDuplicateNode(contextMenu.node)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-700 hover:bg-slate-100 transition cursor-pointer text-left"
              >
                <Scissors className="h-3.5 w-3.5 text-indigo-500" />
                <span>Duplicate Element</span>
              </button>

              {/* Color Palette Sub-Picker */}
              <div className="pt-1 border-t border-slate-100">
                <span className="px-2.5 text-[9px] font-extrabold uppercase text-slate-400 block mb-1">
                  Card Color
                </span>
                <div className="grid grid-cols-5 gap-1 px-2 mb-1.5">
                  {COLOR_PALETTE_PRESETS.map((p) => (
                    <button
                      key={p.hex}
                      type="button"
                      onClick={() => handleChangeNodeColor(contextMenu.node.id, p.hex)}
                      title={p.label}
                      style={{ backgroundColor: p.hex }}
                      className="h-5 w-5 rounded-full border-2 border-white shadow-xs hover:scale-120 transition cursor-pointer"
                    />
                  ))}
                </div>

                {/* Custom HEX Code Input */}
                <div className="px-2 flex items-center gap-1.5">
                  <input
                    type="text"
                    placeholder="#2563eb"
                    defaultValue={contextMenu.node.color || "#2563eb"}
                    onBlur={(e) => {
                      if (e.target.value.trim()) {
                        handleChangeNodeColor(contextMenu.node.id, e.target.value.trim());
                      }
                    }}
                    className="flex-1 px-2 py-0.5 text-[10px] font-mono rounded border border-slate-200 text-slate-800"
                  />
                  <input
                    type="color"
                    defaultValue={contextMenu.node.color || "#2563eb"}
                    onChange={(e) => handleChangeNodeColor(contextMenu.node.id, e.target.value)}
                    className="h-6 w-6 rounded cursor-pointer border-0 p-0"
                    title="Choose custom color"
                  />
                </div>
              </div>

              {/* Change Shape Type */}
              <div className="pt-1 border-t border-slate-100">
                <span className="px-2.5 text-[9px] font-extrabold uppercase text-slate-400 block mb-1">
                  Change Shape Type
                </span>
                <div className="max-h-28 overflow-y-auto space-y-0.5 px-1">
                  {(
                    [
                      "process",
                      "decision",
                      "trigger",
                      "value",
                      "text",
                      "cloud",
                      "queue",
                      "database",
                      "dax",
                      "output",
                      "sticky",
                    ] as WhiteboardNodeType[]
                  ).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleChangeNodeType(contextMenu.node.id, t)}
                      className={clsx(
                        "w-full text-left px-2 py-1 rounded text-[11px] font-semibold flex items-center justify-between",
                        contextMenu.node.type === t
                          ? "bg-blue-50 text-blue-700 font-bold"
                          : "text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      <span className="capitalize">{t}</span>
                      {contextMenu.node.type === t && <Check className="h-3 w-3 text-blue-600" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Disconnect Wires */}
              <button
                type="button"
                onClick={() => handleDisconnectAll(contextMenu.node.id)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition cursor-pointer text-left pt-1 border-t border-slate-100"
              >
                <LinkIcon className="h-3.5 w-3.5 text-slate-400" />
                <span>Disconnect All Wires</span>
              </button>

              {/* Delete Node */}
              <button
                type="button"
                onClick={() => {
                  updateActiveNodes((nodes) =>
                    nodes
                      .filter((n) => n.id !== contextMenu.node.id)
                      .map((n) => ({
                        ...n,
                        connections: (n.connections || []).filter((c) => c.targetId !== contextMenu.node.id),
                      }))
                  );
                  setSelectedNodeId(null);
                  setContextMenu(null);
                  showToast("Element deleted");
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition cursor-pointer text-left font-bold"
              >
                <div className="flex items-center gap-2">
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete Element</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">Del</span>
              </button>
            </div>
          )}

          {/* ================= RIGHT-CLICK CANVAS CONTEXT MENU (EMPTY SPACE) ================= */}
          {contextMenu && contextMenu.type === "canvas" && (
            <div
              style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
              onClick={(e) => e.stopPropagation()}
              className="fixed z-50 bg-white rounded-2xl border border-slate-200 shadow-2xl p-2 w-60 flex flex-col gap-1 text-xs animate-in fade-in zoom-in-95"
            >
              <div className="px-2 py-1 pb-1.5 border-b border-slate-100 flex items-center justify-between">
                <span className="font-extrabold text-slate-800 text-[11px]">Canvas Options</span>
                <span className="text-[9px] font-mono text-slate-400">
                  {contextMenu.canvasX}, {contextMenu.canvasY}
                </span>
              </div>

              {/* Paste from Clipboard (User requested: ก๊อปมาก็วางได้) */}
              <button
                type="button"
                disabled={!clipboardNode}
                onClick={() => handlePasteAt(contextMenu.canvasX, contextMenu.canvasY)}
                className={clsx(
                  "w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl transition cursor-pointer text-left",
                  clipboardNode
                    ? "hover:bg-blue-50 text-blue-700 font-bold"
                    : "text-slate-400 opacity-60 cursor-not-allowed"
                )}
              >
                <div className="flex items-center gap-2">
                  <Copy className="h-3.5 w-3.5" />
                  <span className="truncate">
                    {clipboardNode ? `Paste "${clipboardNode.title}"` : "Paste Element"}
                  </span>
                </div>
                <span className="text-[10px] font-mono">Ctrl+V</span>
              </button>

              {/* Quick Add Elements Submenu */}
              <div className="pt-1.5 border-t border-slate-100 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 block">
                  Add Element Here
                </span>
                <div className="grid grid-cols-2 gap-1 px-1">
                  {(
                    [
                      { type: "process", label: "Process" },
                      { type: "decision", label: "Decision" },
                      { type: "value", label: "Value KPI" },
                      { type: "sticky", label: "Sticky Note" },
                      { type: "text", label: "Text Label" },
                      { type: "database", label: "Database" },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => handleAddNodeAt(item.type, contextMenu.canvasX, contextMenu.canvasY)}
                      className="px-2 py-1 rounded-lg border border-slate-100 hover:bg-slate-50 text-slate-700 text-[10px] font-medium text-left cursor-pointer transition flex items-center gap-1"
                    >
                      <Plus className="h-2.5 w-2.5 text-blue-500" />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Zoom & View Controls */}
              <div className="pt-1.5 border-t border-slate-100 flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => {
                    handleFitToView();
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-slate-100 text-slate-700 text-left transition cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-blue-600" />
                  <span>Fit View (Recenter)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setZoom(1);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-slate-100 text-slate-700 text-left transition cursor-pointer"
                >
                  <ZoomIn className="h-3.5 w-3.5 text-slate-500" />
                  <span>Reset Zoom (100%)</span>
                </button>
              </div>
            </div>
          )}

          {/* Wire Edit / Disconnect Popup */}
          {editingConnection && (
            <div className="absolute top-4 right-4 z-40 bg-white rounded-2xl border border-slate-200 shadow-xl p-3 flex items-center gap-3 animate-in fade-in zoom-in-95">
              <span className="text-xs font-bold text-slate-700">Selected Connection Wire</span>
              <button
                type="button"
                onClick={() =>
                  handleRemoveConnection(editingConnection.sourceId, editingConnection.targetId)
                }
                className="px-2.5 py-1 rounded-xl text-xs font-bold bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 transition cursor-pointer"
              >
                Delete Wire
              </button>
              <button
                type="button"
                onClick={() => setEditingConnection(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
