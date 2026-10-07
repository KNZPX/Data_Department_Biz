"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AlignCenter,
  AlignCenterHorizontal,
  AlignLeft,
  AlignRight,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  ArrowLeft,
  ArrowRight,
  BringToFront,
  ChevronDown,
  ChevronLeft,
  CircleHelp,
  ClipboardPaste,
  Cloud,
  CloudOff,
  Copy,
  Crosshair,
  Download,
  Ellipsis,
  Frame as FrameIcon,
  Group,
  Hand,
  Eraser,
  Highlighter,
  Loader2,
  Lock,
  Map as MapIcon,
  Maximize,
  Minus,
  MousePointer2,
  MoveUpRight,
  Pen,
  Maximize2,
  Minimize2,
  Pencil,
  Plus,
  Redo2,
  SendToBack,
  Shapes,
  SquarePlus,
  StickyNote,
  Trash2,
  Type,
  Undo2,
  Ungroup,
  Unlock,
  UserPlus,
  X,
  type LucideIcon,
  SlidersHorizontal,
  PanelLeft,
  PanelRight,
  PanelTop,
} from "lucide-react";
import { clsx } from "clsx";
import {
  BLOCKS,
  MIRO_BLUE,
  MIRO_COLORS,
  STICKY_COLORS,
  anchor,
  boundsOf,
  connectorPath,
  contains,
  fmtOf,
  fmtStyle,
  intersects,
  isBox,
  nearestSide,
  readableOn,
  uid,
  type BoardMeta,
  type BoxEl,
  type Camera,
  type ConnectorEl,
  type DrawEl,
  type El,
  type Rect,
  type ShapeKind,
  type Side,
  type TextFmt,
} from "./model";
import { fitShape, recognizeShape, type Recognized } from "./recognize";
import { useBoardRealtime, type Ops } from "./useRealtime";
import { initialsOf } from "@/components/layout/Presence";

type Tool = "select" | "hand" | "sticky" | "shape" | "text" | "frame" | "connector" | "pen" | "eraser";
type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

type Interaction =
  | { type: "pan"; sx: number; sy: number; cam: Camera }
  // Two fingers on a touch screen: zoom and pan together.
  | { type: "pinch" }
  // Right button: pans once dragged past a few px, otherwise opens the menu on release.
  | { type: "rpan"; sx: number; sy: number; cam: Camera; moved: boolean }
  | {
      type: "move";
      start: { x: number; y: number };
      orig: Map<string, BoxEl>;
      ids: string[];
      snapshot: El[];
      lastSend: number;
      /** Item to start editing if this turns out to be a click on the already-selected item. */
      editOnClick?: string;
      /** Alt+drag: the selection that was copied, restored if the pointer didn't move. */
      dupOf?: string[];
    }
  | { type: "marquee"; start: { x: number; y: number }; cur: { x: number; y: number }; additive: string[] }
  | { type: "resize"; id: string; handle: Handle; orig: BoxEl; start: { x: number; y: number }; snapshot: El[] }
  | {
      type: "connect";
      from: { id?: string; side?: Side; x: number; y: number };
      cur: { x: number; y: number };
      /** Started on a "+" dot; `down` is where the press began (screen px), to tell a click from a drag. */
      fromPort?: boolean;
      down?: { x: number; y: number };
    }
  | { type: "endpoint"; id: string; end: "from" | "to"; snapshot: El[] }
  | { type: "create"; tool: Tool; start: { x: number; y: number }; cur: { x: number; y: number } }
  | { type: "draw"; points: [number, number][]; snap?: Recognized }
  | { type: "erase"; hit: string[] };

const SHAPES: { kind: ShapeKind; label: string }[] = [
  { kind: "round", label: "Rounded" },
  { kind: "rect", label: "Rectangle" },
  { kind: "pill", label: "Pill" },
  { kind: "ellipse", label: "Ellipse" },
  { kind: "diamond", label: "Decision" },
  { kind: "triangle", label: "Triangle" },
  { kind: "pentagon", label: "Pentagon" },
  { kind: "hexagon", label: "Hexagon" },
  { kind: "octagon", label: "Octagon" },
  { kind: "parallelogram", label: "Input / output" },
  { kind: "cylinder", label: "Database" },
  { kind: "document", label: "Document" },
  { kind: "callout", label: "Speech bubble" },
  { kind: "cloud", label: "Cloud" },
  { kind: "star", label: "Star" },
  { kind: "heart", label: "Heart" },
  { kind: "arrow", label: "Arrow" },
  { kind: "chevron", label: "Chevron" },
  { kind: "plus", label: "Plus" },
];

/** New shapes start as clean white cards (white outline, soft shadow); recolour from the context bar. */
const SHAPE_LOOK = { fill: "#FFFFFF", stroke: "#FFFFFF" };
const SHAPE_TEXT = "#1C1C1E";

/** Starting size: round-ish shapes start square. */
function shapeSize(kind: ShapeKind) {
  if (kind === "star" || kind === "heart" || kind === "plus" || kind === "octagon" || kind === "pentagon") return { w: 140, h: 140 };
  if (kind === "diamond" || kind === "cylinder" || kind === "cloud" || kind === "callout") return { w: 200, h: 130 };
  if (kind === "pill") return { w: 200, h: 80 };
  return { w: 200, h: 100 };
}


type MenuAction =
  | "edit" | "label" | "duplicate" | "copy" | "connect" | "front" | "back" | "lock" | "delete" | "group" | "ungroup"
  | "paste" | "text" | "blocks" | "selectAll" | "fit" | "convert";

const WIRE_DIR: Record<Side, [number, number]> = { top: [0, -1], right: [1, 0], bottom: [0, 1], left: [-1, 0] };

const HANDLES: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

// Miro look: grey canvas, floating white panels, #4262FF accent, near-black ink.
const INK = "#1A1A1A";
/** A pen stroke as a smooth curve through its points (midpoint quadratic smoothing). */
function strokePath(pts: [number, number][]): string {
  if (!pts.length) return "";
  if (pts.length < 3) return `M${pts[0][0]},${pts[0][1]} ` + pts.slice(1).map((q) => `L${q[0]},${q[1]}`).join(" ") + (pts.length === 1 ? ` L${pts[0][0] + 0.01},${pts[0][1]}` : "");
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    d += ` Q${x1},${y1} ${(x1 + x2) / 2},${(y1 + y2) / 2}`;
  }
  const l = pts[pts.length - 1];
  return d + ` L${l[0]},${l[1]}`;
}

/** Drop points closer together than `min` (world units) so long strokes stay light. */
function thinPoints(pts: [number, number][], min: number): [number, number][] {
  const out: [number, number][] = [];
  for (const q of pts) {
    const l = out[out.length - 1];
    if (!l || Math.hypot(q[0] - l[0], q[1] - l[1]) >= min) out.push(q);
  }
  const last = pts[pts.length - 1];
  if (last && out[out.length - 1] !== last) out.push(last);
  return out;
}

type TbPos = "left" | "right" | "top";
type TbPrefs = { pos: TbPos; style: "compact" | "detailed"; autoShapes: boolean };
const TB_KEY = "wb_toolbar";
function readToolbarPref(): TbPrefs {
  try {
    const v = JSON.parse(localStorage.getItem(TB_KEY) || "{}");
    return { pos: v.pos === "right" || v.pos === "top" ? v.pos : "left", style: v.style === "detailed" ? "detailed" : "compact", autoShapes: v.autoShapes === true };
  } catch {
    return { pos: "left", style: "compact", autoShapes: false };
  }
}

const PENCIL_KEY = "wb_pencil_draws";
function readPencilPref() {
  try {
    return localStorage.getItem(PENCIL_KEY) !== "0";
  } catch {
    return true;
  }
}

/** The app's motion setting (Settings → Appearance) or the OS asks for less movement. */
function reducedMotion() {
  if (typeof window === "undefined") return true;
  const m = document.documentElement.dataset.motion;
  return m === "off" || m === "reduced" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const PANEL = "rounded-lg bg-white shadow-[0_0_0_1px_rgba(34,36,40,.05),0_2px_8px_rgba(34,36,40,.14)]";
const POPOVER = "wb-pop rounded-lg bg-white shadow-[0_0_0_1px_rgba(34,36,40,.06),0_6px_24px_rgba(34,36,40,.18)]";
const ICON_BTN = "wb-btn grid h-10 w-10 place-items-center rounded-md text-[#1C1C1E] hover:bg-[#F1F2F5]";
const ACTIVE_BTN = "bg-[#E6EAFF] text-[#4262FF] hover:bg-[#E6EAFF]";
const PEN_COLORS = ["#1A1A1A", "#F24726", "#FAC710", "#8FD14F", "#2D9BF0", "#652CB3", "#808080", "#FFFFFF"];
const PEN_WIDTHS = [2, 4, 8];
const HIGHLIGHT = { opacity: 0.35, scale: 5 };
const STICKY_SIZES = [12, 14, 18, 24, 32, 48, 64];
const SHORTCUTS: [string, string][] = [
  ["Select", "V"],
  ["Hand / pan", "H, hold Space, or right-drag"],
  ["Sticky note", "N"],
  ["Shape", "S"],
  ["Rectangle / Oval", "R / O"],
  ["Text", "T"],
  ["Connection line", "L"],
  ["Pen / Eraser", "P / E"],
  ["Frame", "F"],
  ["More blocks", "B"],
  ["Edit selected", "Enter, type, or click again"],
  ["Next sticky (while typing)", "Tab / Shift+Tab"],
  ["Duplicate", "Ctrl+D or Alt+drag"],
  ["Copy / Paste", "Ctrl+C / Ctrl+V"],
  ["Group / Ungroup", "Ctrl+G / Ctrl+Shift+G"],
  ["Lock / Unlock", "Ctrl+Shift+L"],
  ["Bring to front / back", "PgUp / PgDn"],
  ["Undo / Redo", "Ctrl+Z / Ctrl+Shift+Z"],
  ["Zoom in / out", "Ctrl + / Ctrl −"],
  ["Zoom to fit / selection", "Shift+1 / Shift+2"],
  ["Zoom to 100%", "Shift+0"],
  ["Nudge", "Arrows (Shift = 10px)"],
];
const MIN_ZOOM = 0.08;
const MAX_ZOOM = 4;

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len ? clamp(((px - ax) * dx + (py - ay) * dy) / len, 0, 1) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

const OPPOSITE: Record<Side, Side> = { top: "bottom", right: "left", bottom: "top", left: "right" };

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

/** A polygon with softly rounded corners (radius clipped to half of each edge). */
function roundedPoly(pts: [number, number][], r: number) {
  const n = pts.length;
  let d = "";
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const a = pts[(i - 1 + n) % n];
    const b = pts[(i + 1) % n];
    const la = Math.hypot(a[0] - p[0], a[1] - p[1]) || 1;
    const lb = Math.hypot(b[0] - p[0], b[1] - p[1]) || 1;
    const ra = Math.min(r, la / 2);
    const rb = Math.min(r, lb / 2);
    const s0 = [p[0] + ((a[0] - p[0]) * ra) / la, p[1] + ((a[1] - p[1]) * ra) / la];
    const s1 = [p[0] + ((b[0] - p[0]) * rb) / lb, p[1] + ((b[1] - p[1]) * rb) / lb];
    d += `${i === 0 ? "M" : "L"}${s0[0]},${s0[1]} Q${p[0]},${p[1]} ${s1[0]},${s1[1]} `;
  }
  return d + "Z";
}

function shapePath(kind: ShapeKind, w: number, h: number): string {
  const W = w - 1;
  const H = h - 1;
  const soft = Math.max(3, Math.min(12, Math.min(w, h) * 0.1));
  switch (kind) {
    case "rect":
      return roundedPoly([[1, 1], [W, 1], [W, H], [1, H]], 3);
    case "round":
      return roundedPoly([[1, 1], [W, 1], [W, H], [1, H]], Math.min(18, w / 4, h / 4));
    case "pill":
      return roundedPoly([[1, 1], [W, 1], [W, H], [1, H]], Math.min(w, h) / 2);
    case "ellipse":
      return `M${w / 2},1 A${w / 2 - 1},${h / 2 - 1} 0 1 1 ${w / 2 - 0.01},1 Z`;
    case "diamond":
      return roundedPoly([[w / 2, 1], [W, h / 2], [w / 2, H], [1, h / 2]], soft);
    case "triangle":
      return roundedPoly([[w / 2, 1], [W, H], [1, H]], soft);
    case "pentagon":
      return roundedPoly([[w / 2, 1], [W, h * 0.38], [w * 0.81, H], [w * 0.19, H], [1, h * 0.38]], soft);
    case "hexagon": {
      const k = Math.min(w * 0.22, h / 2);
      return roundedPoly([[k, 1], [w - k, 1], [W, h / 2], [w - k, H], [k, H], [1, h / 2]], soft);
    }
    case "octagon": {
      const kx = w * 0.29;
      const ky = h * 0.29;
      return roundedPoly([[kx, 1], [w - kx, 1], [W, ky], [W, h - ky], [w - kx, H], [kx, H], [1, h - ky], [1, ky]], soft * 0.6);
    }
    case "cylinder": {
      const e = Math.min(18, h / 5);
      return `M1,${e} A${w / 2 - 1},${e} 0 0 1 ${W},${e} V${h - e} A${w / 2 - 1},${e} 0 0 1 1,${h - e} Z M1,${e} A${w / 2 - 1},${e} 0 0 0 ${W},${e}`;
    }
    case "parallelogram": {
      const k = Math.min(w * 0.18, 40);
      return roundedPoly([[k, 1], [W, 1], [w - k, H], [1, H]], soft);
    }
    case "document":
      return `M${soft},1 H${w - soft} Q${W},1 ${W},${soft} V${h * 0.84} C${w * 0.72},${h * 0.68} ${w * 0.5},${h * 1.02} ${w * 0.25},${h * 0.9} C${w * 0.14},${h * 0.85} ${w * 0.06},${h * 0.84} 1,${h * 0.87} V${soft} Q1,1 ${soft},1 Z`;
    case "callout": {
      const bh = h * 0.8;
      const r = Math.min(16, w / 5, bh / 3);
      return `M${r},1 H${w - r} Q${W},1 ${W},${r} V${bh - r} Q${W},${bh} ${w - r},${bh} H${w * 0.4} Q${w * 0.3},${h * 0.9} ${w * 0.2},${H} Q${w * 0.25},${h * 0.9} ${w * 0.25},${bh} H${r} Q1,${bh} 1,${bh - r} V${r} Q1,1 ${r},1 Z`;
    }
    case "cloud":
      return `M${w * 0.26},${H} C${w * 0.08},${H} 1,${h * 0.78} ${w * 0.04},${h * 0.62} C${w * 0.0},${h * 0.42} ${w * 0.14},${h * 0.3} ${w * 0.27},${h * 0.33} C${w * 0.3},${h * 0.1} ${w * 0.5},${h * 0.0} ${w * 0.62},${h * 0.12} C${w * 0.72},${h * 0.04} ${w * 0.9},${h * 0.14} ${w * 0.88},${h * 0.34} C${w * 1.0},${h * 0.4} ${W},${h * 0.7} ${w * 0.9},${h * 0.85} C${w * 0.86},${h * 0.95} ${w * 0.8},${H} ${w * 0.72},${H} Z`;
    case "heart":
      return `M${w / 2},${H} C${w * 0.3},${h * 0.82} 1,${h * 0.6} 1,${h * 0.32} C1,${h * 0.12} ${w * 0.16},1 ${w * 0.3},1 C${w * 0.4},1 ${w * 0.47},${h * 0.07} ${w / 2},${h * 0.18} C${w * 0.53},${h * 0.07} ${w * 0.6},1 ${w * 0.7},1 C${w * 0.84},1 ${W},${h * 0.12} ${W},${h * 0.32} C${W},${h * 0.6} ${w * 0.7},${h * 0.82} ${w / 2},${H} Z`;
    case "star": {
      const pts: [number, number][] = [];
      for (let i = 0; i < 10; i++) {
        const ang = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 === 0 ? 1 : 0.46;
        pts.push([w / 2 + Math.cos(ang) * rr * (w / 2 - 1), h * 0.53 + Math.sin(ang) * rr * (h * 0.53 - 1)]);
      }
      return roundedPoly(pts, soft * 0.5);
    }
    case "arrow":
      return roundedPoly([[1, h * 0.28], [w * 0.62, h * 0.28], [w * 0.62, 1], [W, h / 2], [w * 0.62, H], [w * 0.62, h * 0.72], [1, h * 0.72]], soft * 0.5);
    case "chevron":
      return roundedPoly([[1, 1], [w * 0.75, 1], [W, h / 2], [w * 0.75, H], [1, H], [w * 0.25, h / 2]], soft * 0.6);
    case "plus": {
      const tx = w * 0.33;
      const ty = h * 0.33;
      return roundedPoly(
        [[tx, 1], [w - tx, 1], [w - tx, ty], [W, ty], [W, h - ty], [w - tx, h - ty], [w - tx, H], [tx, H], [tx, h - ty], [1, h - ty], [1, ty], [tx, ty]],
        soft * 0.5
      );
    }
  }
}

/** Keep the label inside the part of the shape that has room for it. */
function shapeTextPad(kind: ShapeKind, h: number): React.CSSProperties | undefined {
  if (kind === "cylinder") return { paddingTop: 16 };
  if (kind === "triangle") return { paddingTop: h * 0.35 };
  if (kind === "callout") return { paddingBottom: h * 0.2 };
  if (kind === "document") return { paddingBottom: h * 0.12 };
  if (kind === "heart") return { paddingBottom: h * 0.12 };
  return undefined;
}

/** Grow a centred textarea to its content so the text sits in the middle, like Miro. */
function fitTextarea(t: HTMLTextAreaElement) {
  t.style.height = "auto";
  t.style.height = `${t.scrollHeight}px`;
}

function stickyFont(text: string) {
  const n = text.length;
  return n < 30 ? 22 : n < 70 ? 18 : n < 140 ? 15 : 13;
}

function textOf(el: El): string {
  switch (el.kind) {
    case "sticky":
    case "shape":
    case "text":
      return el.text;
    case "card":
      return el.body ? `${el.title}\n${el.body}` : el.title;
    case "frame":
      return el.title;
    default:
      return "";
  }
}

function withText(el: El, text: string): El {
  switch (el.kind) {
    case "sticky":
    case "shape":
    case "text":
      return { ...el, text };
    case "card": {
      const [title, ...rest] = text.split("\n");
      return { ...el, title, body: rest.join("\n") };
    }
    case "frame":
      return { ...el, title: text };
    default:
      return el;
  }
}

export function BoardCanvas({
  meta,
  initial,
  onBack,
  onMetaChange,
  extraActions,
  onChange,
  backLabel = "All boards",
  onEscapeIdle,
  readOnly = false,
}: {
  meta: BoardMeta;
  initial: El[];
  onBack: () => void;
  onMetaChange: (m: BoardMeta) => void;
  /** Extra buttons shown in the top-right bar (used by the DAX diagram view). */
  extraActions?: React.ReactNode;
  /** Called after every local change with the full element list. */
  onChange?: (els: El[]) => void;
  backLabel?: string;
  /** Esc pressed while nothing is selected or open (used to close embedded views). */
  onEscapeIdle?: () => void;
  /** View-only: no tools, no edits, no saves. */
  readOnly?: boolean;
}) {
  const [elements, setElements] = useState<El[]>(initial);
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 1 });
  const [selection, setSelection] = useState<string[]>([]);
  const [tool, setTool] = useState<Tool>("select");
  // iPad / touch: Apple Pencil draws, fingers move the board (Freeform-style).
  const [pencilDraws, setPencilDrawsState] = useState(readPencilPref);
  const setPencilDraws = (on: boolean) => {
    setPencilDrawsState(on);
    try {
      localStorage.setItem(PENCIL_KEY, on ? "1" : "0");
    } catch {}
  };
  // Toolbar: where it sits (left / right / top), icons only or with labels, and
  // whether finished pen strokes that look like shapes become shapes.
  const [tb, setTbState] = useState<TbPrefs>(readToolbarPref);
  const setTb = (patch: Partial<TbPrefs>) => {
    const next = { ...tb, ...patch };
    setTbState(next);
    try {
      localStorage.setItem(TB_KEY, JSON.stringify(next));
    } catch {}
  };
  const [tbMenu, setTbMenu] = useState(false);
  // Draw-and-hold: keeping the pen still for a moment snaps the stroke to a shape.
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdAnchor = useRef<{ x: number; y: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number; type: string }>());
  const pinch = useRef<{ d0: number; cam0: Camera; wx: number; wy: number } | null>(null);
  const penDown = useRef(false);
  const penSeen = useRef(false);
  const longPress = useRef<{ timer: ReturnType<typeof setTimeout>; x: number; y: number; id: number } | null>(null);
  // Board fills the whole screen (hides the app's menus) — handy on an iPad.
  const [focusMode, setFocusMode] = useState(false);
  const focusRef = useRef(false);
  const [shapeKind, setShapeKind] = useState<ShapeKind>("round");
  const [shapeMenu, setShapeMenu] = useState(false);
  const [stickyColor, setStickyColor] = useState(STICKY_COLORS[0]);
  const [penColor, setPenColor] = useState(INK);
  const [penWidth, setPenWidth] = useState(PEN_WIDTHS[0]);
  const [penMode, setPenMode] = useState<"pen" | "highlighter">("pen");
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const [hoverLine, setHoverLine] = useState<string | null>(null);
  const [framesOpen, setFramesOpen] = useState(false);
  const [zoomMenu, setZoomMenu] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [interaction, setInteraction] = useState<Interaction | null>(null);
  const [guides, setGuides] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] });
  const [spaceDown, setSpaceDown] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [name, setName] = useState(meta.name);
  const [toast, setToast] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number; world: { x: number; y: number }; onElement: boolean } | null>(null);
  const [connectHover, setConnectHover] = useState<string | null>(null);
  const [editSeed, setEditSeed] = useState<string | null>(null);
  const [labelEditId, setLabelEditId] = useState<string | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  // Canvas size in state (not read from the ref during render) for placing menus and the toolbar.
  const [view, setView] = useState({ w: 800, h: 600 });
  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const ro = new ResizeObserver(() => setView({ w: node.clientWidth, h: node.clientHeight }));
    ro.observe(node);
    return () => ro.disconnect();
  }, []);
  const elRef = useRef(elements);
  const camRef = useRef(camera);
  const selRef = useRef(selection);
  const past = useRef<El[][]>([]);
  const future = useRef<El[][]>([]);
  const clipboard = useRef<El[]>([]);
  /** Text put on the system clipboard by our last copy; null if that write failed. */
  const copiedText = useRef<string | null>(null);
  const lastPointer = useRef<{ x: number; y: number } | null>(null);
  const lastRightDown = useRef(-1e9);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interRef = useRef<Interaction | null>(null);
  // Magnet target while dragging a connector or endpoint.
  const snapRef = useRef<{ id: string; side: Side; x: number; y: number } | null>(null);
  const [snap, setSnap] = useState<{ id: string; side: Side } | null>(null);
  const escIdleRef = useRef(onEscapeIdle);
  const openUi = useRef(false);
  const [hasClip, setHasClip] = useState(false);

  // Mirror the latest state into refs for event handlers. Handlers that change
  // elements also write elRef directly, so it's never stale mid-gesture.
  useLayoutEffect(() => {
    escIdleRef.current = onEscapeIdle;
    focusRef.current = focusMode;
    elRef.current = elements;
    camRef.current = camera;
    selRef.current = selection;
    interRef.current = interaction;
    openUi.current = Boolean(menu || libraryOpen || shapeMenu || helpOpen || tbMenu || tool !== "select");
  });

  const byId = useMemo(() => new Map(elements.map((e) => [e.id, e])), [elements]);

  // ------------------------------------------------------------------ realtime
  const applyRemote = useCallback((ops: Ops) => {
    setElements((prev) => {
      let next = prev;
      if (ops.remove?.length) {
        const rm = new Set(ops.remove);
        next = next.filter((e) => !rm.has(e.id));
      }
      if (ops.upsert?.length) {
        const map = new Map(next.map((e) => [e.id, e] as const));
        for (const u of ops.upsert) map.set(u.id, u);
        next = Array.from(map.values());
      }
      return next;
    });
  }, []);
  const rt = useBoardRealtime(meta.id, applyRemote);
  // Other tabs signed in as the same person aren't "someone else" — hide them.
  const peers = useMemo(() => {
    const seen = new Set<string>();
    return rt.peers.filter((p) => {
      if (rt.me && p.email.toLowerCase() === rt.me.email.toLowerCase()) return false;
      if (seen.has(p.email)) return false;
      seen.add(p.email);
      return true;
    });
  }, [rt.peers, rt.me]);

  // ---------------------------------------------------------------- persistence
  const save = useCallback(
    async (els: El[], nm = name) => {
      setSaveState("saving");
      try {
        const res = await fetch("/api/whiteboard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            board: { id: meta.id, name: nm, folder_id: meta.folder_id, folder_name: meta.folder_name, description: meta.description, nodes: els },
          }),
        });
        setSaveState(res.ok ? "saved" : "error");
      } catch {
        setSaveState("error");
      }
    },
    [meta.id, meta.folder_id, meta.folder_name, meta.description, name]
  );

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState("saving");
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      void save(elRef.current);
    }, 900);
  }, [save]);

  const metaRef = useRef(meta);
  const nameRef = useRef(name);
  useLayoutEffect(() => {
    metaRef.current = meta;
    nameRef.current = name;
  });
  useEffect(() => {
    // Send a pending save before the page closes or the board unmounts.
    const flush = () => {
      if (!saveTimer.current) return;
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      const m = metaRef.current;
      const body = JSON.stringify({
        board: { id: m.id, name: nameRef.current, folder_id: m.folder_id, folder_name: m.folder_name, description: m.description, nodes: elRef.current },
      });
      navigator.sendBeacon?.("/api/whiteboard", new Blob([body], { type: "application/json" }));
    };
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      flush();
    };
  }, []);

  // ------------------------------------------------------------------- commit
  /** Apply a new element list: history, broadcast diff, autosave. */
  const commit = useCallback(
    (next: El[], opts: { from?: El[]; history?: boolean } = {}) => {
      if (readOnly) {
        // Revert any local drag preview.
        const back = opts.from || elRef.current;
        elRef.current = back;
        setElements(back);
        return;
      }
      const prev = opts.from || elRef.current;
      if (opts.history !== false) {
        past.current.push(prev);
        if (past.current.length > 120) past.current.shift();
        future.current = [];
      }
      const prevMap = new Map(prev.map((e) => [e.id, e]));
      const nextIds = new Set(next.map((e) => e.id));
      const upsert = next.filter((e) => prevMap.get(e.id) !== e);
      const remove = prev.filter((e) => !nextIds.has(e.id)).map((e) => e.id);
      elRef.current = next;
      setElements(next);
      rt.sendOps({ upsert, remove });
      scheduleSave();
      onChange?.(next);
    },
    [rt, scheduleSave, onChange, readOnly]
  );

  const update = useCallback(
    (ids: string[], fn: (el: El) => El) => {
      const set = new Set(ids);
      commit(elRef.current.map((e) => (set.has(e.id) ? fn(e) : e)));
    },
    [commit]
  );

  function undo() {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(elRef.current);
    commit(prev, { history: false });
    setSelection([]);
  }
  function redo() {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(elRef.current);
    commit(next, { history: false });
  }

  // ------------------------------------------------------------------- camera
  const toWorld = useCallback((sx: number, sy: number) => {
    const r = rootRef.current!.getBoundingClientRect();
    const c = camRef.current;
    return { x: (sx - r.left - c.x) / c.zoom, y: (sy - r.top - c.y) / c.zoom };
  }, []);

  // Items pop in when they appear (added, pasted, undone, or from a teammate)
  // and fade out when they go. On first open they arrive in a quick stagger.
  const worldRef = useRef<HTMLDivElement>(null);
  const animNodes = useRef<Map<string, Element> | null>(null);
  useLayoutEffect(() => {
    const world = worldRef.current;
    if (!world) return;
    const now = new Map<string, Element>();
    world.querySelectorAll("[data-anim]").forEach((n) => now.set(n.getAttribute("data-anim")!, n));
    const prev = animNodes.current;
    animNodes.current = now;
    if (reducedMotion()) return;
    let i = 0;
    for (const [id, n] of now) {
      if (prev?.get(id) === n) continue;
      const svg = n instanceof SVGElement;
      // A new line draws itself from its start to its end.
      const wire = prev ? n.querySelector<SVGPathElement>("path[data-wire]") : null;
      if (wire && !wire.getAttribute("stroke-dasharray")) {
        const len = wire.getTotalLength();
        wire.animate([{ strokeDasharray: `${len}`, strokeDashoffset: `${len}` }, { strokeDasharray: `${len}`, strokeDashoffset: "0" }], {
          duration: Math.min(520, 220 + len * 0.6),
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        });
        continue;
      }
      n.animate(svg ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, scale: "0.85" }, { opacity: 1, scale: "1" }], {
        duration: svg ? 220 : 300,
        delay: prev ? 0 : 80 + Math.min(i++, 30) * 16,
        easing: svg ? "ease-out" : "cubic-bezier(0.34, 1.4, 0.64, 1)",
        fill: "backwards",
      });
    }
    if (!prev) return;
    for (const [id, n] of prev) {
      if (now.has(id)) continue;
      const parent = n instanceof SVGElement ? world.querySelector("svg") : world.querySelector("[data-leave]");
      if (!parent) continue;
      const ghost = n.cloneNode(true) as HTMLElement | SVGElement;
      ghost.removeAttribute("data-anim");
      ghost.removeAttribute("data-box");
      ghost.querySelectorAll("[data-box],[data-anim]").forEach((c) => {
        c.removeAttribute("data-box");
        c.removeAttribute("data-anim");
      });
      ghost.style.pointerEvents = "none";
      parent.appendChild(ghost);
      const svg = ghost instanceof SVGElement;
      ghost.animate(svg ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 1, scale: "1" }, { opacity: 0, scale: "0.9" }], {
        duration: 180,
        easing: "ease-in",
        fill: "forwards",
      }).onfinish = () => ghost.remove();
    }
  }, [elements]);

  // Glide: button, keyboard and minimap moves ease the camera instead of
  // jumping. Wheel and drag stay direct (they cancel a glide in progress).
  const glideRef = useRef<{ raf: number; to: Camera } | null>(null);
  const stopGlide = useCallback(() => {
    if (glideRef.current) cancelAnimationFrame(glideRef.current.raf);
    glideRef.current = null;
  }, []);
  const glideTo = useCallback(
    (to: Camera) => {
      stopGlide();
      const r = rootRef.current?.getBoundingClientRect();
      if (!r || reducedMotion()) {
        setCamera(to);
        return;
      }
      const from = camRef.current;
      // Ease the world point at the centre of the view and the zoom (in log
      // space), so zooming feels even and the view doesn't swing sideways.
      const cx = r.width / 2;
      const cy = r.height / 2;
      const a = { x: (cx - from.x) / from.zoom, y: (cy - from.y) / from.zoom, z: Math.log(from.zoom) };
      const b = { x: (cx - to.x) / to.zoom, y: (cy - to.y) / to.zoom, z: Math.log(to.zoom) };
      const t0 = performance.now();
      const duration = 320;
      const tick = (now: number) => {
        const t = Math.min(1, (now - t0) / duration);
        const e = 1 - Math.pow(1 - t, 3);
        if (t >= 1) {
          glideRef.current = null;
          setCamera(to);
          return;
        }
        const zoom = Math.exp(a.z + (b.z - a.z) * e);
        setCamera({ zoom, x: cx - (a.x + (b.x - a.x) * e) * zoom, y: cy - (a.y + (b.y - a.y) * e) * zoom });
        glideRef.current = { raf: requestAnimationFrame(tick), to };
      };
      glideRef.current = { raf: requestAnimationFrame(tick), to };
    },
    [stopGlide]
  );
  useEffect(() => stopGlide, [stopGlide]);

  const zoomAt = useCallback(
    (factor: number, sx?: number, sy?: number, smooth = false) => {
      const r = rootRef.current!.getBoundingClientRect();
      const px = sx ?? r.left + r.width / 2;
      const py = sy ?? r.top + r.height / 2;
      const next = (c: Camera): Camera => {
        const zoom = clamp(c.zoom * factor, MIN_ZOOM, MAX_ZOOM);
        const wx = (px - r.left - c.x) / c.zoom;
        const wy = (py - r.top - c.y) / c.zoom;
        return { zoom, x: px - r.left - wx * zoom, y: py - r.top - wy * zoom };
      };
      if (smooth) {
        // Repeated clicks build on where the glide is heading.
        glideTo(next(glideRef.current?.to ?? camRef.current));
        return;
      }
      stopGlide();
      setCamera(next);
    },
    [glideTo, stopGlide]
  );

  const fitTo = useCallback(
    (els: El[], instant = false) => {
      const r = rootRef.current?.getBoundingClientRect();
      if (!r) return;
      const b = boundsOf(els, new Map(elRef.current.map((e) => [e.id, e])));
      const pad = 120;
      const zoom = b ? clamp(Math.min((r.width - pad) / Math.max(b.w, 1), (r.height - pad) / Math.max(b.h, 1)), MIN_ZOOM, 1.2) : 1;
      const to = b ? { zoom, x: r.width / 2 - (b.x + b.w / 2) * zoom, y: r.height / 2 - (b.y + b.h / 2) * zoom } : { x: r.width / 2, y: r.height / 2, zoom: 1 };
      if (instant) setCamera(to);
      else glideTo(to);
    },
    [glideTo]
  );

  useEffect(() => {
    fitTo(initial, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wheel: pinch / ctrl = zoom, mouse wheel notches = zoom, trackpad scroll = pan
  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    function onWheel(e: WheelEvent) {
      if ((e.target as HTMLElement).closest("[data-scrollable]")) return;
      e.preventDefault();
      const notch = e.deltaMode === 1 || (e.deltaX === 0 && Math.abs(e.deltaY) >= 50 && Number.isInteger(e.deltaY));
      if (e.ctrlKey || e.metaKey || notch) {
        const intensity = e.ctrlKey ? 0.012 : 0.0015;
        zoomAt(Math.exp(-e.deltaY * intensity), e.clientX, e.clientY);
      } else {
        stopGlide();
        setCamera((c) => ({ ...c, x: c.x - e.deltaX, y: c.y - e.deltaY }));
      }
    }
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [zoomAt, stopGlide]);

  // ------------------------------------------------------------------ helpers
  const maxZ = () => elRef.current.reduce((m, e) => Math.max(m, e.z), 0);
  const minZ = () => elRef.current.reduce((m, e) => Math.min(m, e.z), 0);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  }

  function makeElement(kind: Tool, at: { x: number; y: number }, size?: Rect): BoxEl | null {
    const z = maxZ() + 1;
    switch (kind) {
      case "sticky":
        return { id: uid(), kind: "sticky", x: at.x - 90, y: at.y - 90, w: 180, h: 180, z, text: "", color: stickyColor };
      case "shape": {
        const d = shapeSize(shapeKind);
        const r = size || { x: at.x - d.w / 2, y: at.y - d.h / 2, ...d };
        return { id: uid(), kind: "shape", shape: shapeKind, ...r, z, text: "", ...SHAPE_LOOK, textColor: SHAPE_TEXT, fontSize: 16 };
      }
      case "text":
        return { id: uid(), kind: "text", x: at.x, y: at.y - 16, w: 260, h: 40, z, text: "", color: INK, fontSize: 22 };
      case "frame": {
        const r = size || { x: at.x - 300, y: at.y - 200, w: 600, h: 400 };
        return { id: uid("fr"), kind: "frame", ...r, z: minZ() - 1, title: "Frame", fill: "#FFFFFF" };
      }
      default:
        return null;
    }
  }

  function deleteSelection() {
    const ids = new Set(selRef.current);
    if (!ids.size) return;
    const next = elRef.current.filter(
      (e) => !ids.has(e.id) && !(e.kind === "connector" && ((e.from.id && ids.has(e.from.id)) || (e.to.id && ids.has(e.to.id))))
    );
    commit(next);
    setSelection([]);
  }

  /** Copies of `els` moved by (dx, dy) with fresh ids. Lines come along only when
   * both their ends are copied too; groups inside the copy get a new group id. */
  function cloneSet(els: El[], dx: number, dy: number): El[] {
    const ids = new Map<string, string>();
    const groups = new Map<string, string>();
    for (const e of els) if (isBox(e)) ids.set(e.id, uid());
    const keep = (ep: ConnectorEl["from"]) => !ep.id || ids.has(ep.id);
    for (const e of els) if (e.kind === "connector" && keep(e.from) && keep(e.to)) ids.set(e.id, uid("cx"));
    let z = maxZ();
    const out: El[] = [];
    for (const e of els) {
      const id = ids.get(e.id);
      if (!id) continue;
      if (e.kind === "connector") {
        out.push({
          ...e,
          id,
          z: ++z,
          from: { ...e.from, id: e.from.id && ids.get(e.from.id), x: e.from.x + dx, y: e.from.y + dy },
          to: { ...e.to, id: e.to.id && ids.get(e.to.id), x: e.to.x + dx, y: e.to.y + dy },
        });
        continue;
      }
      let groupId = e.groupId;
      if (groupId) {
        if (!groups.has(groupId)) groups.set(groupId, uid("grp"));
        groupId = groups.get(groupId);
      }
      out.push({ ...e, id, x: e.x + dx, y: e.y + dy, z: e.kind === "frame" ? e.z : ++z, groupId });
    }
    return out;
  }

  function duplicate(els: El[], offset = 24) {
    const clones = cloneSet(els, offset, offset);
    if (!clones.length) return;
    commit([...elRef.current, ...clones]);
    setSelection(clones.map((c) => c.id));
  }

  /** `ids` plus every other member of the groups they belong to. */
  function withGroups(ids: string[]): string[] {
    const gids = new Set<string>();
    for (const el of elRef.current) if (ids.includes(el.id) && isBox(el) && el.groupId) gids.add(el.groupId);
    if (!gids.size) return ids;
    const out = new Set(ids);
    for (const el of elRef.current) if (isBox(el) && el.groupId && gids.has(el.groupId)) out.add(el.id);
    return Array.from(out);
  }

  function selectedEls() {
    const sel = selRef.current;
    return elRef.current.filter((x) => sel.includes(x.id));
  }

  function groupSelection() {
    const boxes = selectedEls().filter(isBox);
    if (boxes.length < 2) return;
    const gid = uid("grp");
    const ids = new Set(boxes.map((b) => b.id));
    commit(elRef.current.map((el) => (ids.has(el.id) && isBox(el) ? { ...el, groupId: gid } : el)));
    flash("Grouped");
  }

  function ungroupSelection() {
    const ids = new Set(selRef.current);
    if (!selectedEls().some((el) => isBox(el) && el.groupId)) return;
    commit(elRef.current.map((el) => (ids.has(el.id) && isBox(el) && el.groupId ? { ...el, groupId: undefined } : el)));
    flash("Ungrouped");
  }

  function toggleLock() {
    const chosen = selectedEls();
    if (!chosen.length) return;
    const lock = !chosen.every((x) => x.locked);
    update(selRef.current, (el) => ({ ...el, locked: lock }));
  }

  function bringFront() {
    let z = maxZ();
    update(selRef.current, (el) => (el.kind === "frame" ? el : { ...el, z: ++z }));
  }

  function sendBack() {
    let z = minZ();
    update(selRef.current, (el) => (el.kind === "frame" ? { ...el, z: --z } : { ...el, z: Math.max(1, minZ() + 1) }));
  }

  function zoomToSelection() {
    const chosen = selectedEls();
    fitTo(chosen.length ? chosen : elRef.current);
  }

  function zoomTo(z: number) {
    zoomAt(z / (glideRef.current?.to ?? camRef.current).zoom, undefined, undefined, true);
  }

  /** An empty copy of `src` at (x, y): same kind, size and colours, no text. */
  function blankCopy(src: BoxEl, x: number, y: number): BoxEl {
    const twin = { ...src, id: uid(), z: maxZ() + 1, x, y, groupId: undefined, locked: undefined } as BoxEl;
    if (twin.kind === "sticky" || twin.kind === "shape" || twin.kind === "text") twin.text = "";
    if (twin.kind === "card") {
      twin.title = "";
      twin.body = "";
    }
    return twin;
  }

  function newConnector(from: ConnectorEl["from"], to: ConnectorEl["to"]): ConnectorEl {
    return { id: uid("cx"), kind: "connector", z: maxZ() + 1, from, to, route: "curve", stroke: INK, width: 2, arrowEnd: true, arrowStart: false };
  }

  /** Miro's "+" on a side: add the next item on that side and start typing in it.
   * Stickies get a plain neighbour; shapes and cards get a connected one. */
  function quickCreate(srcId: string, side: Side) {
    const src = elRef.current.find((x) => x.id === srcId);
    if (!src || !isBox(src) || src.kind === "draw" || src.kind === "frame") return;
    const sticky = src.kind === "sticky";
    const gap = sticky ? 24 : 96;
    const [ux, uy] = { top: [0, -1], right: [1, 0], bottom: [0, 1], left: [-1, 0] }[side];
    let x = src.x + ux * (src.w + gap);
    let y = src.y + uy * (src.h + gap);
    const others = elRef.current.filter((e): e is BoxEl => isBox(e) && e.kind !== "frame" && e.kind !== "draw");
    // Step sideways past anything already in that spot.
    for (let i = 0; i < 12 && others.some((o) => intersects(o, { x: x + 1, y: y + 1, w: src.w - 2, h: src.h - 2 })); i++) {
      if (ux) y += src.h + gap;
      else x += src.w + gap;
    }
    const twin = blankCopy(src, x, y);
    const add: El[] = [twin];
    if (!sticky) {
      const back = OPPOSITE[side];
      add.push(newConnector({ id: src.id, side, ...anchor(src, side) }, { id: twin.id, side: back, ...anchor(twin, back) }));
    }
    commit([...elRef.current, ...add]);
    setSelection([twin.id]);
    setEditingId(twin.id);
  }

  // ------------------------------------------------------------------ keyboard
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (e.code === "Space") {
        setSpaceDown(true);
        e.preventDefault();
        return;
      }
      if (mod && k === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && k === "y") {
        e.preventDefault();
        redo();
      } else if (mod && k === "c") {
        if (selRef.current.length) copySelected();
      } else if (mod && k === "g") {
        e.preventDefault();
        if (e.shiftKey) ungroupSelection();
        else groupSelection();
      } else if (mod && e.shiftKey && k === "l") {
        e.preventDefault();
        toggleLock();
      } else if (k === "pageup" && selRef.current.length) {
        e.preventDefault();
        bringFront();
      } else if (k === "pagedown" && selRef.current.length) {
        e.preventDefault();
        sendBack();
      } else if (mod && k === "d") {
        e.preventDefault();
        duplicate(elRef.current.filter((x) => selRef.current.includes(x.id)));
      } else if (mod && k === "a") {
        e.preventDefault();
        setSelection(elRef.current.map((x) => x.id));
      } else if (k === "delete" || k === "backspace") {
        deleteSelection();
      } else if (k === "escape") {
        // Esc peels back one layer at a time: menus, then selection/tool, then the view itself.
        if (!openUi.current && selRef.current.length === 0) {
          if (focusRef.current) {
            setFocusMode(false);
            return;
          }
          escIdleRef.current?.();
          return;
        }
        setSelection([]);
        setTool("select");
        setShapeMenu(false);
        setMenu(null);
        setLibraryOpen(false);
        setHelpOpen(false);
        setFramesOpen(false);
        setZoomMenu(false);
        setTbMenu(false);
      } else if (e.shiftKey && !mod && k === "s" && !readOnly && elRef.current.some((x) => selRef.current.includes(x.id) && x.kind === "draw")) {
        e.preventDefault();
        convertSelectionToShapes();
      } else if (e.shiftKey && !mod && e.code === "Digit1") {
        fitTo(elRef.current);
      } else if (e.shiftKey && !mod && e.code === "Digit2") {
        zoomToSelection();
      } else if (e.shiftKey && !mod && e.code === "Digit0") {
        zoomTo(1);
      } else if (mod && (k === "=" || k === "+")) {
        e.preventDefault();
        zoomAt(1.2, undefined, undefined, true);
      } else if (mod && k === "-") {
        e.preventDefault();
        zoomAt(1 / 1.2, undefined, undefined, true);
      } else if (k.startsWith("arrow") && selRef.current.length) {
        e.preventDefault();
        const d = e.shiftKey ? 10 : 1;
        const dx = k === "arrowleft" ? -d : k === "arrowright" ? d : 0;
        const dy = k === "arrowup" ? -d : k === "arrowdown" ? d : 0;
        update(selRef.current, (el) => (isBox(el) && !el.locked ? { ...el, x: el.x + dx, y: el.y + dy } : el));
      } else if (!mod && e.key.length === 1 && e.key !== " " && selRef.current.length === 1 && (() => {
        const el = elRef.current.find((x) => x.id === selRef.current[0]);
        return Boolean(el && (el.kind === "sticky" || el.kind === "shape" || el.kind === "text") && !el.locked);
      })()) {
        // Miro-style: start typing on a selected sticky/shape to edit it.
        e.preventDefault();
        const el = elRef.current.find((x) => x.id === selRef.current[0])!;
        setEditSeed(textOf(el) + e.key);
        setEditingId(el.id);
      } else if (k === "enter" && selRef.current.length === 1 && elRef.current.find((x) => x.id === selRef.current[0])?.kind === "connector") {
        e.preventDefault();
        setLabelEditId(selRef.current[0]);
      } else if (k === "enter" && selRef.current.length === 1) {
        const el = elRef.current.find((x) => x.id === selRef.current[0]);
        if (el && isBox(el) && el.kind !== "draw" && !el.locked) {
          e.preventDefault();
          setEditingId(el.id);
        }
      } else if (!mod) {
        if (k === "b") setLibraryOpen((v) => !v);
        const map: Record<string, Tool> = { v: "select", h: "hand", n: "sticky", s: "shape", r: "shape", t: "text", f: "frame", l: "connector", p: "pen", e: "eraser" };
        if (map[k]) {
          setTool(map[k]);
          if (map[k] !== "select" && map[k] !== "hand") setSelection([]);
          if (k === "r") setShapeKind("rect");
        }
        if (k === "o") {
          setTool("shape");
          setSelection([]);
          setShapeKind("ellipse");
        }
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === "Space") setSpaceDown(false);
    }
    // Paste: our own items when they're what was last copied, otherwise text from other apps.
    function onPaste(e: ClipboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (readOnly) return;
      const text = e.clipboardData?.getData("text/plain") ?? "";
      const ours = clipboard.current.length > 0 && (!text || copiedText.current === null || text === copiedText.current);
      if (ours) {
        e.preventDefault();
        duplicate(clipboard.current, 40);
      } else if (text.trim()) {
        e.preventDefault();
        pasteText(text);
      }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("paste", onPaste);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commit, fitTo, zoomAt, update, readOnly]);

  useEffect(() => {
    rt.sendCursor(null, selection);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection]);

  // ------------------------------------------------------------------ pointer
  function hitBoxAt(clientX: number, clientY: number, exclude?: Set<string>): BoxEl | null {
    const nodes = document.elementsFromPoint(clientX, clientY);
    for (const n of nodes) {
      const host = (n as HTMLElement).closest?.("[data-box]") as HTMLElement | null;
      if (host) {
        const el = byId.get(host.dataset.box!);
        if (el && isBox(el) && !exclude?.has(el.id) && el.kind !== "draw") return el;
      }
    }
    return null;
  }

  /** Nearest connection point within ~32px on screen; inside a node, its nearest side. */
  function magnetAt(p: { x: number; y: number }, clientX: number, clientY: number, exclude?: string) {
    const radius = 32 / camRef.current.zoom;
    let best: { id: string; side: Side; x: number; y: number; d: number } | null = null;
    for (const el of elRef.current) {
      if (!isBox(el) || el.kind === "draw" || el.kind === "frame" || el.id === exclude) continue;
      for (const side of ["top", "right", "bottom", "left"] as Side[]) {
        const a = anchor(el, side);
        const d = Math.hypot(a.x - p.x, a.y - p.y);
        if (d < radius && (!best || d < best.d)) best = { id: el.id, side, ...a, d };
      }
    }
    if (best) return best;
    const hit = hitBoxAt(clientX, clientY, exclude ? new Set([exclude]) : undefined);
    if (hit) {
      const side = nearestSide(hit, p);
      return { id: hit.id, side, ...anchor(hit, side), d: 0 };
    }
    return null;
  }

  function setMagnet(m: { id: string; side: Side; x: number; y: number } | null) {
    snapRef.current = m;
    setSnap((prev) => (prev?.id === m?.id && prev?.side === m?.side ? prev : m ? { id: m.id, side: m.side } : null));
    setConnectHover(m ? m.id : null);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (editingId) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-ui]")) return;
    setShapeMenu(false);
    setMenu(null);
    setHelpOpen(false);
    setFramesOpen(false);
    setZoomMenu(false);
    setTbMenu(false);
    const pt = e.pointerType;
    // Palm rejection: while the Pencil is on the glass, ignore the hand.
    if (pt === "touch" && penDown.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, type: pt });
    if (pt === "pen") penDown.current = penSeen.current = true;
    rootRef.current?.setPointerCapture(e.pointerId);
    if (pt === "touch") {
      const touches = [...pointers.current.values()].filter((q) => q.type === "touch");
      if (touches.length >= 2) {
        startPinch();
        return;
      }
    }
    const p = toWorld(e.clientX, e.clientY);
    if (pt === "touch") armLongPress(e);

    // Apple Pencil: draws straight away (or erases with a stylus eraser button).
    if (pt === "pen" && !readOnly && (e.buttons & 32) === 32) {
      setInteraction({ type: "erase", hit: inkAt(p) });
      return;
    }
    if (pt === "pen" && !readOnly && pencilDraws && (tool === "select" || tool === "hand")) {
      setTool("pen");
      setSelection([]);
      setInteraction({ type: "draw", points: [[p.x, p.y]] });
      return;
    }
    // Once a Pencil has been used, a finger in the pen tools moves the board instead of drawing.
    if (pt === "touch" && penSeen.current && (tool === "pen" || tool === "eraser")) {
      setInteraction({ type: "pan", sx: e.clientX, sy: e.clientY, cam: camRef.current });
      return;
    }

    // Right button (or Ctrl+click on a Mac): drag pans, a plain click opens the menu on release.
    const macCtrlClick = e.button === 0 && e.ctrlKey && /Mac/.test(navigator.platform);
    if (e.button === 2 || macCtrlClick) {
      lastRightDown.current = e.timeStamp;
      setInteraction({ type: "rpan", sx: e.clientX, sy: e.clientY, cam: camRef.current, moved: false });
      return;
    }
    if (e.button === 1 || spaceDown || tool === "hand") {
      setInteraction({ type: "pan", sx: e.clientX, sy: e.clientY, cam: camRef.current });
      return;
    }

    const port = target.closest("[data-port]") as HTMLElement | null;
    if (port) {
      const el = byId.get(port.dataset.owner!) as BoxEl;
      const side = port.dataset.port as Side;
      setInteraction({ type: "connect", from: { id: el.id, side, ...anchor(el, side) }, cur: p, fromPort: true, down: { x: e.clientX, y: e.clientY } });
      return;
    }
    const handle = target.closest("[data-handle]") as HTMLElement | null;
    if (handle && selection.length === 1) {
      const el = byId.get(selection[0]);
      if (el && isBox(el) && !el.locked) {
        setInteraction({ type: "resize", id: el.id, handle: handle.dataset.handle as Handle, orig: el, start: p, snapshot: elRef.current });
        return;
      }
    }
    const endpoint = target.closest("[data-endpoint]") as HTMLElement | null;
    if (endpoint) {
      setInteraction({ type: "endpoint", id: endpoint.dataset.owner!, end: endpoint.dataset.endpoint as "from" | "to", snapshot: elRef.current });
      return;
    }

    if (tool === "pen") {
      setInteraction({ type: "draw", points: [[p.x, p.y]] });
      return;
    }
    if (tool === "eraser") {
      setInteraction({ type: "erase", hit: inkAt(p) });
      return;
    }
    if (tool === "connector") {
      const hit = hitBoxAt(e.clientX, e.clientY);
      setInteraction({
        type: "connect",
        from: hit ? { id: hit.id, side: nearestSide(hit, p), ...anchor(hit, nearestSide(hit, p)) } : { x: p.x, y: p.y },
        cur: p,
      });
      return;
    }
    if (tool === "sticky" || tool === "shape" || tool === "text" || tool === "frame") {
      setGhost(null);
      setInteraction({ type: "create", tool, start: p, cur: p });
      return;
    }

    // select tool
    const boxHost = target.closest("[data-box]") as HTMLElement | null;
    const lineHost = target.closest("[data-line]") as HTMLElement | null;
    const hitId = boxHost?.dataset.box || lineHost?.dataset.line || null;
    if (hitId) {
      // Clicking any member of a group picks up the whole group.
      const unit = withGroups([hitId]);
      let ids = selection;
      if (e.shiftKey) {
        ids = selection.includes(hitId) ? selection.filter((i) => !unit.includes(i)) : Array.from(new Set([...selection, ...unit]));
      } else if (!selection.includes(hitId)) {
        ids = unit;
      }
      // Miro: clicking the item that's already selected starts typing in it.
      const hitEl = byId.get(hitId);
      const editOnClick =
        !readOnly && !e.shiftKey && !e.altKey && selection.length === 1 && selection[0] === hitId && hitEl && !hitEl.locked &&
        (hitEl.kind === "sticky" || hitEl.kind === "shape" || hitEl.kind === "text" || hitEl.kind === "card")
          ? hitId
          : undefined;
      setSelection(ids);
      const movable = ids.map((i) => byId.get(i)).filter((x): x is BoxEl => Boolean(x && isBox(x) && !x.locked));
      if (!movable.length) return;
      // Frames carry what's inside them.
      const carry = new Map<string, BoxEl>(movable.map((m) => [m.id, m]));
      for (const f of movable.filter((m) => m.kind === "frame")) {
        for (const el of elRef.current) if (isBox(el) && el.kind !== "frame" && !el.locked && contains(f, el)) carry.set(el.id, el);
      }
      if (e.altKey && !readOnly) {
        // Alt+drag: leave the originals and drag copies (lines between them come too).
        const before = elRef.current;
        const inSet = new Set(carry.keys());
        const lines = before.filter((c) => c.kind === "connector" && c.from.id && c.to.id && inSet.has(c.from.id) && inSet.has(c.to.id));
        const clones = cloneSet([...carry.values(), ...lines], 0, 0);
        const boxClones = clones.filter(isBox);
        const next = [...before, ...clones];
        elRef.current = next;
        setElements(next);
        setSelection(clones.map((c) => c.id));
        setInteraction({ type: "move", start: p, orig: new Map(boxClones.map((c) => [c.id, c])), ids: boxClones.map((c) => c.id), snapshot: before, lastSend: 0, dupOf: ids });
        return;
      }
      setInteraction({ type: "move", start: p, orig: carry, ids: Array.from(carry.keys()), snapshot: elRef.current, lastSend: 0, editOnClick });
      return;
    }
    // A finger on empty board moves the board (box-select stays a mouse / Pencil thing).
    if (pt === "touch") {
      setSelection([]);
      setInteraction({ type: "pan", sx: e.clientX, sy: e.clientY, cam: camRef.current });
      return;
    }
    setInteraction({ type: "marquee", start: p, cur: p, additive: e.shiftKey ? selection : [] });
    if (!e.shiftKey) setSelection([]);
  }

  function cancelLongPress() {
    if (longPress.current) clearTimeout(longPress.current.timer);
    longPress.current = null;
  }

  /** Touch and hold opens the menu (iPad has no right click). */
  function armLongPress(e: React.PointerEvent) {
    cancelLongPress();
    const { clientX: x, clientY: y, pointerId: id } = e;
    longPress.current = {
      id,
      x,
      y,
      timer: setTimeout(() => {
        longPress.current = null;
        if (!pointers.current.has(id)) return;
        const it = interRef.current;
        if (it?.type === "move") {
          elRef.current = it.snapshot;
          setElements(it.snapshot);
        }
        interRef.current = null;
        setInteraction(null);
        // Same path as the keyboard's menu key: the board's own context-menu handler.
        rootRef.current?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: x, clientY: y }));
      }, 550),
    };
  }

  /** Two fingers down: drop whatever the first finger started and zoom/pan with both. */
  function startPinch() {
    cancelLongPress();
    const it = interRef.current;
    if (it?.type === "move" || it?.type === "resize") {
      elRef.current = it.snapshot;
      setElements(it.snapshot);
    }
    const [a, b] = [...pointers.current.values()].filter((q) => q.type === "touch");
    const r = rootRef.current!.getBoundingClientRect();
    const c = camRef.current;
    const mx = (a.x + b.x) / 2 - r.left;
    const my = (a.y + b.y) / 2 - r.top;
    pinch.current = { d0: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), cam0: c, wx: (mx - c.x) / c.zoom, wy: (my - c.y) / c.zoom };
    stopGlide();
    interRef.current = { type: "pinch" };
    setInteraction({ type: "pinch" });
    setGhost(null);
  }

  /** The pen has stayed still: if the stroke looks like a shape, show it snapped. */
  function snapHeldStroke() {
    holdTimer.current = null;
    const it = interRef.current;
    if (it?.type !== "draw" || it.snap) return;
    const r = recognizeShape(it.points);
    if (!r) return;
    const next: Interaction = { ...it, snap: r };
    interRef.current = next;
    setInteraction(next);
  }

  /** The board item a recognised stroke becomes, in the pen's colour. */
  function shapeFromStroke(r: Recognized, color = penColor, width = penWidth, z = maxZ() + 1): El {
    if (r.kind === "line")
      return { id: uid("cx"), kind: "connector", z, from: { x: r.a.x, y: r.a.y }, to: { x: r.b.x, y: r.b.y }, route: "straight", stroke: color, width: Math.max(2, Math.min(width, 6)), arrowEnd: false, arrowStart: false };
    return { id: uid(), kind: "shape", shape: r.kind, x: r.x, y: r.y, w: Math.max(r.w, 12), h: Math.max(r.h, 12), z, text: "", fill: "transparent", stroke: color, textColor: SHAPE_TEXT, fontSize: 16 };
  }

  /**
   * A line whose ends were drawn on (or right next to) a shape gets hooked to
   * that shape's nearest side, so it follows the shape like any connection.
   */
  function attachEnds(c: ConnectorEl, els: El[]): ConnectorEl {
    const pad = 28 / camRef.current.zoom;
    const near = (p: { x: number; y: number }, other?: string) => {
      let best: BoxEl | null = null;
      let bestD = Infinity;
      for (const e of els) {
        if (!isBox(e) || e.kind === "draw" || e.kind === "frame" || e.id === other) continue;
        if (p.x < e.x - pad || p.x > e.x + e.w + pad || p.y < e.y - pad || p.y > e.y + e.h + pad) continue;
        const d = Math.hypot(p.x - (e.x + e.w / 2), p.y - (e.y + e.h / 2));
        if (d < bestD) {
          bestD = d;
          best = e;
        }
      }
      return best;
    };
    const a = near(c.from);
    const b = near(c.to, a?.id);
    const end = (box: BoxEl | null, p: { x: number; y: number }) => {
      if (!box) return { x: p.x, y: p.y };
      const side = nearestSide(box, p);
      return { id: box.id, side, ...anchor(box, side) };
    };
    return { ...c, from: end(a, c.from), to: end(b, c.to), route: a && b ? "elbow" : c.route, arrowEnd: Boolean(a && b) || c.arrowEnd };
  }

  /** Turn selected pen strokes into real shapes (with connection dots) and lines into connections. */
  function convertSelectionToShapes(ids = selRef.current) {
    const pick = new Set(ids);
    const strokes = elRef.current.filter((e): e is DrawEl => pick.has(e.id) && e.kind === "draw" && !e.locked);
    if (!strokes.length) return;
    const made = new Map<string, El>();
    for (const s of strokes) {
      const r = fitShape(s.points.map(([px, py]) => [px + s.x, py + s.y]));
      if (r) made.set(s.id, shapeFromStroke(r, s.stroke, s.width, s.z));
    }
    if (!made.size) {
      flash("Those strokes are too small to turn into shapes");
      return;
    }
    let next = elRef.current.map((e) => made.get(e.id) ?? e);
    // Lines go last so they can hook onto the shapes just made too.
    next = next.map((e) => (e.kind === "connector" && [...made.values()].includes(e) ? attachEnds(e, next) : e));
    commit(next);
    setSelection([...made.values()].map((e) => e.id));
    const left = strokes.length - made.size;
    flash(`Converted ${made.size} ${made.size === 1 ? "stroke" : "strokes"} to shapes${left ? ` · ${left} left as ink` : ""}`);
  }

  function movePinch() {
    const pz = pinch.current;
    if (!pz) return;
    const touches = [...pointers.current.values()].filter((q) => q.type === "touch");
    if (touches.length < 2) return;
    const [a, b] = touches;
    const r = rootRef.current!.getBoundingClientRect();
    const zoom = clamp(pz.cam0.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / pz.d0), MIN_ZOOM, MAX_ZOOM);
    const mx = (a.x + b.x) / 2 - r.left;
    const my = (a.y + b.y) / 2 - r.top;
    setCamera({ zoom, x: mx - pz.wx * zoom, y: my - pz.wy * zoom });
  }

  /** Ink strokes passing within a few screen px of `p`. */
  function inkAt(p: { x: number; y: number }): string[] {
    const tol = 8 / camRef.current.zoom;
    const out: string[] = [];
    for (const el of elRef.current) {
      if (el.kind !== "draw" || el.locked) continue;
      const r = tol + el.width / 2;
      if (p.x < el.x - r || p.x > el.x + el.w + r || p.y < el.y - r || p.y > el.y + el.h + r) continue;
      const pts = el.points;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[Math.min(i + 1, pts.length - 1)];
        if (distToSegment(p.x - el.x, p.y - el.y, a[0], a[1], b[0], b[1]) <= r) {
          out.push(el.id);
          break;
        }
      }
    }
    return out;
  }

  function onPointerMove(e: React.PointerEvent) {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
    const lp = longPress.current;
    if (lp && lp.id === e.pointerId && Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > 10) cancelLongPress();
    if (pinch.current) {
      movePinch();
      return;
    }
    if (e.pointerType === "touch" && penDown.current) return;
    const p = toWorld(e.clientX, e.clientY);
    lastPointer.current = p;
    rt.sendCursor(p);
    const it = interRef.current;
    if (!it) {
      if (tool === "sticky") setGhost(p);
      else if (ghost) setGhost(null);
      return;
    }
    switch (it.type) {
      case "pan":
        stopGlide();
        setCamera({ ...it.cam, x: it.cam.x + e.clientX - it.sx, y: it.cam.y + e.clientY - it.sy });
        break;
      case "rpan": {
        const dx = e.clientX - it.sx;
        const dy = e.clientY - it.sy;
        if (!it.moved && Math.hypot(dx, dy) < 4) break;
        it.moved = true;
        stopGlide();
        setCamera({ ...it.cam, x: it.cam.x + dx, y: it.cam.y + dy });
        break;
      }
      case "move": {
        let dx = p.x - it.start.x;
        let dy = p.y - it.start.y;
        // Smart guides: snap the moving group's edges/centres to other boxes.
        const moved = Array.from(it.orig.values()).map((o) => ({ ...o, x: o.x + dx, y: o.y + dy }));
        const b = boundsOf(moved, byId)!;
        const thr = 6 / camRef.current.zoom;
        const xs = [b.x, b.x + b.w / 2, b.x + b.w];
        const ys = [b.y, b.y + b.h / 2, b.y + b.h];
        let bestX: { d: number; line: number } | null = null;
        let bestY: { d: number; line: number } | null = null;
        for (const o of elRef.current) {
          if (!isBox(o) || it.orig.has(o.id) || o.kind === "draw") continue;
          for (const lx of [o.x, o.x + o.w / 2, o.x + o.w])
            for (const x of xs) if (Math.abs(lx - x) < thr && (!bestX || Math.abs(lx - x) < Math.abs(bestX.d))) bestX = { d: lx - x, line: lx };
          for (const ly of [o.y, o.y + o.h / 2, o.y + o.h])
            for (const y of ys) if (Math.abs(ly - y) < thr && (!bestY || Math.abs(ly - y) < Math.abs(bestY.d))) bestY = { d: ly - y, line: ly };
        }
        if (bestX) dx += bestX.d;
        if (bestY) dy += bestY.d;
        setGuides({ v: bestX ? [bestX.line] : [], h: bestY ? [bestY.line] : [] });
        const next = elRef.current.map((el) => {
          const o = it.orig.get(el.id);
          return o ? { ...o, x: o.x + dx, y: o.y + dy } : el;
        });
        elRef.current = next;
        setElements(next);
        const now = e.timeStamp;
        if (now - it.lastSend > 50) {
          it.lastSend = now;
          rt.sendOps({ upsert: next.filter((x) => it.orig.has(x.id)) });
        }
        break;
      }
      case "resize": {
        const o = it.orig;
        const dx = p.x - it.start.x;
        const dy = p.y - it.start.y;
        let { x, y, w, h } = o;
        if (it.handle.includes("e")) w = o.w + dx;
        if (it.handle.includes("s")) h = o.h + dy;
        if (it.handle.includes("w")) {
          w = o.w - dx;
          x = o.x + dx;
        }
        if (it.handle.includes("n")) {
          h = o.h - dy;
          y = o.y + dy;
        }
        if ((e.shiftKey || o.kind === "sticky") && it.handle.length === 2) {
          const ratio = o.w / o.h;
          if (w / h > ratio) w = h * ratio;
          else h = w / ratio;
          if (it.handle.includes("w")) x = o.x + o.w - w;
          if (it.handle.includes("n")) y = o.y + o.h - h;
        }
        w = Math.max(24, w);
        h = Math.max(24, h);
        const next = elRef.current.map((el) => (el.id === o.id ? ({ ...o, x, y, w, h } as El) : el));
        elRef.current = next;
        setElements(next);
        break;
      }
      case "endpoint": {
        const cx = elRef.current.find((x) => x.id === it.id) as ConnectorEl | undefined;
        const otherId = cx ? (it.end === "from" ? cx.to.id : cx.from.id) : undefined;
        const m = magnetAt(p, e.clientX, e.clientY, otherId);
        setMagnet(m);
        const pt = m ? { x: m.x, y: m.y } : p;
        const next = elRef.current.map((el) =>
          el.id === it.id && el.kind === "connector" ? { ...el, [it.end]: { x: pt.x, y: pt.y } } : el
        );
        elRef.current = next;
        setElements(next);
        break;
      }
      case "connect": {
        const m = magnetAt(p, e.clientX, e.clientY, it.from.id);
        setMagnet(m);
        setInteraction({ ...it, cur: m ? { x: m.x, y: m.y } : p });
        break;
      }
      case "marquee":
        setInteraction({ ...it, cur: p });
        break;
      case "create": {
        let cur = p;
        if (e.shiftKey) {
          // Shift keeps shapes and frames square.
          const d = Math.max(Math.abs(p.x - it.start.x), Math.abs(p.y - it.start.y));
          cur = { x: it.start.x + (p.x < it.start.x ? -d : d), y: it.start.y + (p.y < it.start.y ? -d : d) };
        }
        setInteraction({ ...it, cur });
        break;
      }
      case "draw": {
        // A Pencil reports far more often than the screen redraws: keep every sample.
        const evs = typeof e.nativeEvent.getCoalescedEvents === "function" ? e.nativeEvent.getCoalescedEvents() : [];
        const add: [number, number][] = evs.length ? evs.map((ev) => {
          const q = toWorld(ev.clientX, ev.clientY);
          return [q.x, q.y];
        }) : [[p.x, p.y]];
        const next: Interaction = { type: "draw", points: [...it.points, ...add] };
        // Draw-and-hold: moving on drops a snapped shape and restarts the hold clock.
        const anchor = holdAnchor.current;
        if (!anchor || Math.hypot(e.clientX - anchor.x, e.clientY - anchor.y) > 5) {
          holdAnchor.current = { x: e.clientX, y: e.clientY };
          if (holdTimer.current) clearTimeout(holdTimer.current);
          holdTimer.current = penMode === "pen" ? setTimeout(snapHeldStroke, 450) : null;
        } else if (it.snap) next.snap = it.snap;
        interRef.current = next;
        setInteraction(next);
        break;
      }
      case "erase": {
        const add = inkAt(p).filter((id) => !it.hit.includes(id));
        if (add.length) setInteraction({ type: "erase", hit: [...it.hit, ...add] });
        break;
      }
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    const had = pointers.current.delete(e.pointerId);
    if (e.pointerType === "pen") penDown.current = false;
    if (longPress.current?.id === e.pointerId) cancelLongPress();
    if (pinch.current) {
      // Lifting a finger ends the pinch; the other finger does nothing until lifted.
      if ([...pointers.current.values()].filter((q) => q.type === "touch").length < 2) {
        pinch.current = null;
        interRef.current = null;
        setInteraction(null);
      }
      return;
    }
    if (!had && e.pointerType === "touch") return;
    const it = interRef.current;
    setInteraction(null);
    setGuides({ v: [], h: [] });
    setConnectHover(null);
    const magnet = snapRef.current;
    snapRef.current = null;
    setSnap(null);
    if (!it) return;
    const p = toWorld(e.clientX, e.clientY);

    if (it.type === "rpan") {
      if (!it.moved) openMenuAt(e.clientX, e.clientY);
    } else if (it.type === "move") {
      // Under ~3 screen px counts as a click, not a drag.
      const movedAny = Math.hypot(p.x - it.start.x, p.y - it.start.y) * camRef.current.zoom >= 3;
      if (movedAny) {
        commit(elRef.current, { from: it.snapshot });
      } else {
        const back = it.dupOf ? it.snapshot : elRef.current.map((el) => it.orig.get(el.id) ?? el);
        elRef.current = back;
        setElements(back);
        if (it.dupOf) setSelection(it.dupOf);
        else if (it.editOnClick) setEditingId(it.editOnClick);
      }
    } else if (it.type === "resize") {
      commit(elRef.current, { from: it.snapshot });
    } else if (it.type === "endpoint") {
      const next = elRef.current.map((el) =>
        el.id === it.id && el.kind === "connector"
          ? { ...el, [it.end]: magnet ? { id: magnet.id, side: magnet.side, x: magnet.x, y: magnet.y } : { x: p.x, y: p.y } }
          : el
      );
      commit(next, { from: it.snapshot });
    } else if (it.type === "marquee") {
      const r = {
        x: Math.min(it.start.x, it.cur.x),
        y: Math.min(it.start.y, it.cur.y),
        w: Math.abs(it.cur.x - it.start.x),
        h: Math.abs(it.cur.y - it.start.y),
      };
      if (r.w > 3 || r.h > 3) {
        const hits = elRef.current
          .filter((el) => {
            if (el.kind === "connector") {
              const pa = connectorPath(el, byId);
              return intersects(r, { x: Math.min(pa.a.x, pa.b.x), y: Math.min(pa.a.y, pa.b.y), w: Math.abs(pa.a.x - pa.b.x) + 1, h: Math.abs(pa.a.y - pa.b.y) + 1 });
            }
            return el.kind === "frame" ? contains(r, el) : intersects(r, el);
          })
          .map((el) => el.id);
        setSelection(withGroups(Array.from(new Set([...it.additive, ...hits]))));
      }
    } else if (it.type === "connect") {
      const src = it.from.id ? (byId.get(it.from.id) as BoxEl | undefined) : undefined;
      if (it.fromPort && it.down && Math.hypot(e.clientX - it.down.x, e.clientY - it.down.y) < 5) {
        // A click (not a drag) on a "+" dot adds the next item on that side.
        if (it.from.id && it.from.side) quickCreate(it.from.id, it.from.side);
        return;
      }
      const dist = Math.hypot(p.x - it.from.x, p.y - it.from.y);
      if (dist < 12 && !magnet) return;
      const additions: El[] = [];
      let toEp: ConnectorEl["to"] = { x: p.x, y: p.y };
      if (magnet) {
        toEp = { id: magnet.id, side: magnet.side, x: magnet.x, y: magnet.y };
      } else if (src && tool !== "connector") {
        // Miro-style: dragging a port into empty space creates a connected twin.
        const twin = blankCopy(src, p.x - src.w / 2, p.y - src.h / 2);
        additions.push(twin);
        toEp = { id: twin.id, x: p.x, y: p.y };
        setTimeout(() => {
          setSelection([twin.id]);
          setEditingId(twin.id);
        }, 0);
      }
      const cx = newConnector(it.from, toEp);
      commit([...elRef.current, ...additions, cx]);
      if (!additions.length) setSelection([cx.id]);
    } else if (it.type === "create") {
      const r = {
        x: Math.min(it.start.x, it.cur.x),
        y: Math.min(it.start.y, it.cur.y),
        w: Math.abs(it.cur.x - it.start.x),
        h: Math.abs(it.cur.y - it.start.y),
      };
      const sized = r.w > 12 && r.h > 12 && (it.tool === "shape" || it.tool === "frame") ? r : undefined;
      const el = makeElement(it.tool, it.start, sized);
      if (el) {
        commit([...elRef.current, el]);
        setSelection([el.id]);
        if (el.kind !== "frame") setEditingId(el.id);
      }
      setTool("select");
    } else if (it.type === "draw") {
      if (holdTimer.current) clearTimeout(holdTimer.current);
      holdTimer.current = null;
      holdAnchor.current = null;
      if (it.points.length < 2) return;
      const shape = penMode === "pen" ? (it.snap ?? (tb.autoShapes ? recognizeShape(it.points) : null)) : null;
      if (shape) {
        const made = shapeFromStroke(shape);
        commit([...elRef.current, made.kind === "connector" ? attachEnds(made, elRef.current) : made]);
        return;
      }
      const xs = it.points.map((q) => q[0]);
      const ys = it.points.map((q) => q[1]);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      const marker = penMode === "highlighter";
      const el: El = {
        id: uid("ink"),
        kind: "draw",
        x,
        y,
        w: Math.max(...xs) - x || 1,
        h: Math.max(...ys) - y || 1,
        z: maxZ() + 1,
        points: thinPoints(it.points, 0.6 / camRef.current.zoom).map(([px, py]) => [Math.round((px - x) * 10) / 10, Math.round((py - y) * 10) / 10]),
        stroke: penColor,
        width: marker ? penWidth * HIGHLIGHT.scale : penWidth,
        opacity: marker ? HIGHLIGHT.opacity : undefined,
      };
      commit([...elRef.current, el]);
    } else if (it.type === "erase") {
      if (it.hit.length) {
        const gone = new Set(it.hit);
        commit(elRef.current.filter((x) => !gone.has(x.id)));
      }
    }
  }

  function runMenuAction(action: MenuAction, world: { x: number; y: number }) {
    const sel = selRef.current;
    const chosen = elRef.current.filter((x) => sel.includes(x.id));
    const one = chosen.length === 1 ? chosen[0] : null;
    switch (action) {
      case "edit":
        if (one) setEditingId(one.id);
        break;
      case "label":
        if (one) setLabelEditId(one.id);
        break;
      case "duplicate":
        duplicate(chosen);
        break;
      case "copy":
        copySelected();
        break;
      case "connect":
        setTool("connector");
        break;
      case "front":
        bringFront();
        break;
      case "back":
        sendBack();
        break;
      case "lock":
        toggleLock();
        break;
      case "group":
        groupSelection();
        break;
      case "convert":
        convertSelectionToShapes();
        break;
      case "ungroup":
        ungroupSelection();
        break;
      case "delete":
        deleteSelection();
        break;
      case "paste":
        pasteAt(world);
        break;
      case "text":
        addBlock("n-text", world);
        break;
      case "blocks":
        setLibraryOpen(true);
        break;
      case "selectAll":
        setSelection(elRef.current.map((x) => x.id));
        break;
      case "fit":
        fitTo(elRef.current);
        break;
    }
  }

  function copySelected() {
    const chosen = selectedEls();
    clipboard.current = chosen;
    setHasClip(chosen.length > 0);
    if (!chosen.length) return;
    // Mirror the text to the system clipboard so it pastes into other apps too.
    const text = chosen.map(textOf).filter(Boolean).join("\n") || `${chosen.length} whiteboard item${chosen.length > 1 ? "s" : ""}`;
    copiedText.current = text;
    navigator.clipboard?.writeText(text).catch(() => {
      copiedText.current = null;
    });
    flash(`Copied ${chosen.length}`);
  }

  /** Text pasted from another app becomes a text item where the mouse last was. */
  function pasteText(raw: string) {
    const text = raw.replace(/\r\n?/g, "\n").trim();
    const at = lastPointer.current || viewCenter();
    const lines = text.split("\n");
    const fontSize = 18;
    const w = clamp(Math.max(...lines.map((l) => l.length)) * fontSize * 0.56 + 8, 80, 640);
    const perLine = Math.max(1, Math.floor(w / (fontSize * 0.56)));
    const rows = lines.reduce((n, l) => n + Math.max(1, Math.ceil(l.length / perLine)), 0);
    const h = Math.max(32, rows * fontSize * 1.3 + 8);
    const el: BoxEl = { id: uid(), kind: "text", x: at.x - w / 2, y: at.y - h / 2, w, h, z: maxZ() + 1, text, color: INK, fontSize };
    commit([...elRef.current, el]);
    setSelection([el.id]);
    setTool("select");
  }

  function saveLabel(id: string, label: string) {
    update([id], (x) => ({ ...(x as ConnectorEl), label: label || undefined }));
  }

  function viewCenter() {
    const r = rootRef.current!.getBoundingClientRect();
    return toWorld(r.left + r.width / 2, r.top + r.height / 2);
  }

  function addBlock(blockId: string, at?: { x: number; y: number }) {
    const def = BLOCKS.find((b) => b.id === blockId);
    if (!def) return;
    const p = at || viewCenter();
    const el = def.make(p.x, p.y, maxZ() + 1);
    commit([...elRef.current, el]);
    setSelection([el.id]);
    setTool("select");
  }

  function openMenuAt(clientX: number, clientY: number) {
    if (hostAt(clientX, clientY, "[data-ui]")) return;
    const host = hostAt(clientX, clientY, "[data-box], [data-line]");
    const id = host?.dataset.box || host?.dataset.line;
    if (id && !selRef.current.includes(id)) setSelection(withGroups([id]));
    const r = rootRef.current!.getBoundingClientRect();
    setMenu({ x: clientX - r.left, y: clientY - r.top, world: toWorld(clientX, clientY), onElement: Boolean(id) });
  }

  function onContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    // Mouse right-clicks are handled on pointer release (so right-drag can pan);
    // this only opens the menu for the keyboard's menu key.
    if (e.timeStamp - lastRightDown.current < 1500) return;
    openMenuAt(e.clientX, e.clientY);
  }

  function pasteAt(world: { x: number; y: number }) {
    const src = clipboard.current;
    if (!src.length) return;
    const b = boundsOf(src, new Map(src.map((x) => [x.id, x])));
    if (!b) return;
    const map = new Map<string, string>();
    for (const e2 of src) map.set(e2.id, uid(e2.kind === "connector" ? "cx" : "el"));
    const dx = world.x - b.x;
    const dy = world.y - b.y;
    let z = maxZ();
    const clones: El[] = src.map((e2) =>
      e2.kind === "connector"
        ? { ...e2, id: map.get(e2.id)!, z: ++z, from: { ...e2.from, id: e2.from.id && map.get(e2.from.id), x: e2.from.x + dx, y: e2.from.y + dy }, to: { ...e2.to, id: e2.to.id && map.get(e2.to.id), x: e2.to.x + dx, y: e2.to.y + dy } }
        : { ...e2, id: map.get(e2.id)!, x: e2.x + dx, y: e2.y + dy, z: ++z }
    );
    commit([...elRef.current, ...clones]);
    setSelection(clones.map((c) => c.id));
  }

  /** Topmost element under the cursor matching `sel`. The canvas holds pointer capture,
   * so click/dblclick targets are the canvas itself, not what's under the mouse. */
  function hostAt(clientX: number, clientY: number, sel: string): HTMLElement | null {
    for (const n of document.elementsFromPoint(clientX, clientY)) {
      const h = (n as HTMLElement).closest?.(sel) as HTMLElement | null;
      if (h) return h;
    }
    return null;
  }

  function onDoubleClick(e: React.MouseEvent) {
    if (readOnly) return;
    if (hostAt(e.clientX, e.clientY, "[data-ui]")) return;
    const host = hostAt(e.clientX, e.clientY, "[data-box]");
    if (host) {
      const el = byId.get(host.dataset.box!);
      if (el && isBox(el) && el.kind !== "draw" && !el.locked) setEditingId(el.id);
      return;
    }
    const line = hostAt(e.clientX, e.clientY, "[data-line]");
    if (line) {
      setSelection([line.dataset.line!]);
      setLabelEditId(line.dataset.line!);
      return;
    }
    const p = toWorld(e.clientX, e.clientY);
    const el = makeElement("sticky", p);
    if (el) {
      commit([...elRef.current, el]);
      setSelection([el.id]);
      setEditingId(el.id);
    }
  }

  // -------------------------------------------------------------- derived
  const sorted = useMemo(() => [...elements].sort((a, b) => a.z - b.z), [elements]);
  const frames = sorted.filter((e): e is Extract<El, { kind: "frame" }> => e.kind === "frame");
  const boxes = sorted.filter((e): e is BoxEl => isBox(e) && e.kind !== "frame" && e.kind !== "draw");
  const drawings = sorted.filter((e): e is Extract<El, { kind: "draw" }> => e.kind === "draw");
  const connectors = sorted.filter((e): e is ConnectorEl => e.kind === "connector");
  const selected = selection.map((id) => byId.get(id)).filter((x): x is El => Boolean(x));
  const selBounds = selected.length ? boundsOf(selected, byId) : null;
  const single = selected.length === 1 ? selected[0] : null;
  const erasing = new Set(interaction?.type === "erase" ? interaction.hit : []);
  const grouping = (() => {
    const boxes = selected.filter(isBox);
    const gids = new Set(boxes.map((b) => b.groupId));
    const grouped = boxes.some((b) => b.groupId);
    const oneGroup = boxes.length > 1 && gids.size === 1 && grouped;
    return { grouped, canGroup: boxes.length > 1 && !oneGroup };
  })();
  const labelEdit = (() => {
    const cx = labelEditId ? byId.get(labelEditId) : undefined;
    if (!cx || cx.kind !== "connector") return null;
    const mid = connectorPath(cx, byId).mid;
    return { id: cx.id, label: cx.label, at: { x: mid.x * camera.zoom + camera.x, y: mid.y * camera.zoom + camera.y } };
  })();

  const toScreen = (x: number, y: number) => ({ x: x * camera.zoom + camera.x, y: y * camera.zoom + camera.y });
  const gridSize = 24 * camera.zoom * (camera.zoom < 0.35 ? 4 : camera.zoom < 0.7 ? 2 : 1);

  function exportJson() {
    const blob = new Blob([JSON.stringify({ ...meta, name, elements }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${name.replace(/[^\w\-ก-๙ ]+/g, "_")}.board.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function align(mode: "left" | "hcenter" | "top" | "right") {
    if (!selBounds) return;
    update(selection, (el) => {
      if (!isBox(el) || el.locked) return el;
      if (mode === "left") return { ...el, x: selBounds.x };
      if (mode === "right") return { ...el, x: selBounds.x + selBounds.w - el.w };
      if (mode === "top") return { ...el, y: selBounds.y };
      return { ...el, x: selBounds.x + selBounds.w / 2 - el.w / 2 };
    });
  }

  // -------------------------------------------------------------- render bits
  function renderBox(el: BoxEl) {
    const isSel = selection.includes(el.id);
    const editing = editingId === el.id;
    const common = {
      "data-box": el.id,
      "data-anim": el.id,
      onPointerEnter: () => setHoverId(el.id),
      onPointerLeave: () => setHoverId((h) => (h === el.id ? null : h)),
      style: { left: el.x, top: el.y, width: el.w, height: el.h, zIndex: el.z } as React.CSSProperties,
    };
    const fmt = fmtStyle(fmtOf(el));
    let inner: React.ReactNode = null;
    if (el.kind === "sticky") {
      inner = (
        <div
          className="flex h-full w-full items-center p-4 leading-snug"
          style={{
            background: el.color,
            color: readableOn(el.color),
            fontSize: el.fontSize ?? stickyFont(el.text),
            boxShadow: "0 1px 2px rgba(0,0,0,.08), 0 10px 14px -10px rgba(0,0,0,.30)",
          }}
        >
          {!editing && (
            <div className="max-h-full w-full overflow-hidden whitespace-pre-wrap break-words" style={{ ...fmt, textAlign: fmt.textAlign || "center" }}>
              {el.text}
            </div>
          )}
        </div>
      );
    } else if (el.kind === "shape") {
      inner = (
        <>
          <svg className="wb-shape absolute inset-0 overflow-visible" width={el.w} height={el.h}>
            <path d={shapePath(el.shape, el.w, el.h)} fill={el.fill} stroke={el.stroke} strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
          {!editing && (
            <div
              className="absolute inset-0 flex items-center px-4 leading-snug"
              style={{ color: el.textColor, fontSize: el.fontSize, ...shapeTextPad(el.shape, el.h) }}
            >
              <div className="w-full whitespace-pre-wrap break-words" style={{ ...fmt, textAlign: fmt.textAlign || "center" }}>
                {el.text}
              </div>
            </div>
          )}
        </>
      );
    } else if (el.kind === "text") {
      inner = !editing ? (
        <div
          className="whitespace-pre-wrap break-words leading-tight"
          style={{ color: el.color, fontSize: el.fontSize, ...fmt }}
        >
          {el.text || <span className="text-slate-400">Text</span>}
        </div>
      ) : null;
    } else if (el.kind === "card") {
      inner = (
        <div className="h-full w-full overflow-hidden rounded-xl bg-white ring-1 ring-slate-200 shadow-[0_8px_20px_-12px_rgba(14,27,46,.35)]">
          <div className="h-1.5" style={{ background: el.accent }} />
          {!editing && (
            <div className="p-3">
              {el.tag && <p className="mb-1 text-[11px] text-slate-400">{el.tag}</p>}
              <p className="text-[15px] font-semibold leading-snug text-slate-900">{el.title}</p>
              {el.body && <p className="mt-1 text-[13px] leading-snug text-slate-500 line-clamp-4">{el.body}</p>}
            </div>
          )}
        </div>
      );
    }
    const hovered = !isSel && hoverId === el.id && tool === "select" && !interaction && !readOnly;
    return (
      <div key={el.id} {...common} className={clsx("absolute", el.kind === "sticky" && "rounded-[2px]", isSel && "cursor-move")}>
        {inner}
        {hovered && <div className="wb-fade pointer-events-none absolute -inset-px rounded-[2px]" style={{ boxShadow: `0 0 0 ${1.5 / camera.zoom}px ${MIRO_BLUE}` }} />}
        {editing && el.kind === "card" && (
          <div
            className="absolute inset-0 z-10 flex min-h-full flex-col gap-1.5 rounded-xl bg-white p-3 pt-4 shadow-lg ring-2 ring-[#4262FF]"
            style={{ height: "auto", minHeight: el.h }}
            onPointerDown={(e) => e.stopPropagation()}
            onBlur={(e) => {
              if (e.currentTarget.contains(e.relatedTarget as Node)) return;
              const f = e.currentTarget;
              const tag = (f.querySelector("[data-f=tag]") as HTMLInputElement).value;
              const title = (f.querySelector("[data-f=title]") as HTMLInputElement).value;
              const body = (f.querySelector("[data-f=body]") as HTMLTextAreaElement).value;
              setEditingId(null);
              setEditSeed(null);
              if (title !== el.title || body !== el.body || tag !== (el.tag || "")) {
                const need = Math.max(el.h, 56 + Math.ceil(body.length / 34) * 18);
                update([el.id], (x) => ({ ...(x as typeof el), title, body, tag: tag || undefined, h: need }));
              }
            }}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey))) (document.activeElement as HTMLElement)?.blur();
            }}
          >
            <input data-f="tag" defaultValue={el.tag || ""} placeholder="Label (optional)" className="text-[11px] text-slate-500 outline-none placeholder:text-slate-300" />
            <input data-f="title" autoFocus defaultValue={el.title} placeholder="Header" className="text-[15px] font-semibold text-slate-900 outline-none placeholder:text-slate-300" />
            <textarea data-f="body" defaultValue={el.body} placeholder="Details" rows={3} className="flex-1 resize-none text-[13px] leading-snug text-slate-600 outline-none placeholder:text-slate-300" />
          </div>
        )}
        {editing && el.kind !== "card" && (
          <div className={clsx("absolute inset-0", el.kind !== "text" && "flex items-center p-4")}>
          <textarea
            autoFocus
            rows={1}
            defaultValue={editSeed ?? textOf(el)}
            ref={(t) => {
              if (t && el.kind !== "text") fitTextarea(t);
            }}
            onInput={(e) => el.kind !== "text" && fitTextarea(e.currentTarget)}
            onFocus={(e) => {
              const t = e.target;
              t.setSelectionRange(t.value.length, t.value.length);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onBlur={(e) => {
              const v = e.target.value;
              setEditingId(null);
              setEditSeed(null);
              if (v !== textOf(el)) {
                const next = withText(el, v) as BoxEl;
                if (next.kind === "text") {
                  next.h = Math.max(next.h, e.target.scrollHeight);
                }
                update([el.id], () => next);
              }
            }}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey))) (e.target as HTMLTextAreaElement).blur();
              else if (e.key === "Tab" && el.kind === "sticky") {
                // Tab / Shift+Tab: save this sticky and start the next one to the right / below.
                e.preventDefault();
                (e.target as HTMLTextAreaElement).blur();
                quickCreate(el.id, e.shiftKey ? "bottom" : "right");
              }
            }}
            className={clsx(
              "resize-none bg-transparent outline-none caret-[#4262FF]",
              el.kind === "text" ? "absolute inset-0 p-0 leading-tight" : "max-h-full w-full overflow-hidden p-0 text-center leading-snug",
            )}
            style={{
              outline: "none",
              ...fmt,
              textAlign: fmt.textAlign || (el.kind === "text" ? "left" : "center"),
              fontSize: el.kind === "sticky" ? (el.fontSize ?? stickyFont(textOf(el))) : el.kind === "shape" || el.kind === "text" ? el.fontSize : undefined,
              color: el.kind === "text" ? el.color : el.kind === "shape" ? el.textColor : el.kind === "sticky" ? readableOn(el.color) : INK,
            }}
          />
          </div>
        )}
      </div>
    );
  }

  // Toolbar geometry for the chosen layout.
  const tbVertical = tb.pos !== "top";
  const tbDetailed = tb.style === "detailed";
  const tbPanel = tbDetailed ? 60 : 48; // panel thickness incl. padding
  const tbReserve = tbPanel + 24;
  const toolBtn = (active: boolean) =>
    tbDetailed
      ? clsx("wb-btn flex h-[52px] w-[56px] flex-col items-center justify-center gap-1 rounded-md text-[#1C1C1E] hover:bg-[#F1F2F5]", active && ACTIVE_BTN)
      : clsx(ICON_BTN, active && ACTIVE_BTN);
  const flyPos = tb.pos === "left" ? "left-[calc(100%+8px)] top-0" : tb.pos === "right" ? "right-[calc(100%+8px)] top-0" : "left-0 top-[calc(100%+8px)]";
  const libraryPos: React.CSSProperties =
    tb.pos === "left" ? { left: 12 + tbPanel + 8, top: 72 } : tb.pos === "right" ? { right: 12 + tbPanel + 8, top: 72 } : { top: 72 + tbPanel + 8 };

  const showPorts = (id: string) =>
    !readOnly &&
    (tool === "select" || tool === "connector") &&
    !interaction &&
    !editingId &&
    (hoverId === id || (selection.length === 1 && selection[0] === id));

  // ------------------------------------------------------------------ render
  const cursor =
    interaction?.type === "pan" || (interaction?.type === "rpan" && interaction.moved)
      ? "grabbing"
      : spaceDown || tool === "hand"
        ? "grab"
        : tool === "select"
          ? "default"
          : tool === "sticky"
            ? "none"
            : "crosshair";

  return (
    <div
      className={clsx(
        "zoom-native wb-board-in overflow-hidden bg-[#F2F2F2] text-[#1C1C1E] select-none [-webkit-touch-callout:none]",
        focusMode ? "fixed inset-0 z-[70]" : "relative h-full w-full rounded-xl"
      )}
    >
      <div
        ref={rootRef}
        className="absolute inset-0 touch-none"
        style={{
          cursor,
          backgroundImage: `radial-gradient(circle, rgba(28,28,30,.22) ${Math.max(0.75, Math.min(1.25, camera.zoom))}px, transparent ${Math.max(0.75, Math.min(1.25, camera.zoom)) + 0.5}px)`,
          backgroundSize: `${gridSize}px ${gridSize}px`,
          backgroundPosition: `${camera.x}px ${camera.y}px`,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => {
          rt.sendCursor(null);
          setGhost(null);
        }}
        onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenu}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("application/x-wb-block")) e.preventDefault();
        }}
        onDrop={(e) => {
          const id = e.dataTransfer.getData("application/x-wb-block");
          if (!id) return;
          e.preventDefault();
          addBlock(id, toWorld(e.clientX, e.clientY));
        }}
      >
        {/* World */}
        <div
          ref={worldRef}
          className="absolute left-0 top-0 origin-top-left"
          style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})` }}
        >
          {frames.map((f) => (
            <div
              key={f.id}
              data-box={f.id}
              data-anim={f.id}
              className="absolute"
              style={{ left: f.x, top: f.y, width: f.w, height: f.h, background: f.fill, boxShadow: `0 0 0 ${1 / camera.zoom}px rgba(0,0,0,.08)` }}
              onPointerEnter={() => setHoverId(f.id)}
              onPointerLeave={() => setHoverId((h) => (h === f.id ? null : h))}
            >
              {editingId === f.id ? (
                <input
                  autoFocus
                  defaultValue={f.title}
                  onPointerDown={(e) => e.stopPropagation()}
                  onBlur={(e) => {
                    setEditingId(null);
                    if (e.target.value !== f.title) update([f.id], (x) => ({ ...x, title: e.target.value }) as El);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLInputElement).blur();
                    e.stopPropagation();
                  }}
                  className="absolute left-0 rounded-[3px] bg-white px-1 text-[#1C1C1E] outline-none"
                  style={{ fontSize: 14 / camera.zoom, top: -26 / camera.zoom, boxShadow: `0 0 0 ${1.5 / camera.zoom}px ${MIRO_BLUE}`, outline: "none" }}
                />
              ) : (
                <span
                  className="absolute left-0 whitespace-nowrap"
                  style={{ fontSize: 14 / camera.zoom, top: -22 / camera.zoom, color: selection.includes(f.id) ? MIRO_BLUE : "#656B81" }}
                >
                  {f.title}
                </span>
              )}
            </div>
          ))}

          <svg className="absolute left-0 top-0 overflow-visible" width="1" height="1" style={{ zIndex: 1 }}>
            <defs>
              {connectors.map((c) => (
                <marker key={c.id} id={`ah-${c.id}`} viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill={c.stroke} />
                </marker>
              ))}
            </defs>
            {drawings.map((d) => (
              <g key={d.id} data-anim={d.id} transform={`translate(${d.x},${d.y})`}>
                <path
                  data-box={d.id}
                  d={strokePath(d.points)}
                  fill="none"
                  stroke={d.stroke}
                  strokeWidth={d.width}
                  strokeOpacity={(d.opacity ?? 1) * (erasing.has(d.id) ? 0.2 : 1)}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ pointerEvents: "stroke" }}
                />
                {selection.includes(d.id) && <rect x={-4} y={-4} width={d.w + 8} height={d.h + 8} fill="none" stroke={MIRO_BLUE} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />}
              </g>
            ))}
            {connectors.map((c) => {
              const pth = connectorPath(c, byId);
              const sel = selection.includes(c.id);
              return (
                <g key={c.id} data-anim={c.id}>
                  {hoverLine === c.id && !sel && !interaction && (
                    <path d={pth.d} fill="none" stroke={MIRO_BLUE} strokeOpacity={0.35} strokeWidth={c.width + 6 / camera.zoom} strokeLinecap="round" style={{ pointerEvents: "none" }} />
                  )}
                  <path
                    d={pth.d}
                    data-line={c.id}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={14 / camera.zoom}
                    style={{ pointerEvents: "stroke", cursor: "pointer" }}
                    onPointerEnter={() => setHoverLine(c.id)}
                    onPointerLeave={() => setHoverLine((h) => (h === c.id ? null : h))}
                  />
                  <path
                    data-wire=""
                    d={pth.d}
                    fill="none"
                    stroke={sel ? MIRO_BLUE : c.stroke}
                    strokeWidth={c.width}
                    strokeDasharray={c.dashed ? "7 6" : undefined}
                    markerEnd={c.arrowEnd ? `url(#ah-${c.id})` : undefined}
                    markerStart={c.arrowStart ? `url(#ah-${c.id})` : undefined}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ pointerEvents: "none" }}
                  />
                  {c.label && labelEditId !== c.id && (
                    <foreignObject x={pth.mid.x - 80} y={pth.mid.y - 14} width={160} height={28} style={{ overflow: "visible", pointerEvents: "none" }}>
                      <div className="flex justify-center">
                        <span className="rounded-[3px] bg-[#F2F2F2] px-1.5 py-0.5 text-[13px] leading-tight text-[#1C1C1E]">{c.label}</span>
                      </div>
                    </foreignObject>
                  )}
                </g>
              );
            })}
            {interaction?.type === "connect" &&
              (() => {
                // A soft, bendy wire while dragging: it leaves the box along its side,
                // marches toward the pointer, and settles solid when it finds a target.
                const a = interaction.from;
                const target = snap ? byId.get(snap.id) : undefined;
                const b = snap && target && isBox(target) ? anchor(target, snap.side) : interaction.cur;
                const dist = Math.hypot(b.x - a.x, b.y - a.y);
                const k = Math.max(24, Math.min(150, dist * 0.45));
                const toward = (p: { x: number; y: number }, q: { x: number; y: number }) => {
                  const l = Math.hypot(q.x - p.x, q.y - p.y) || 1;
                  return [(q.x - p.x) / l, (q.y - p.y) / l];
                };
                const da = a.side ? WIRE_DIR[a.side] : toward(a, b);
                const db = snap ? WIRE_DIR[snap.side] : toward(b, a).map((v) => v * 0.6);
                const d = `M${a.x},${a.y} C${a.x + da[0] * k},${a.y + da[1] * k} ${b.x + db[0] * k},${b.y + db[1] * k} ${b.x},${b.y}`;
                const z = camera.zoom;
                return (
                  <g style={{ pointerEvents: "none" }}>
                    <path d={d} fill="none" stroke={MIRO_BLUE} strokeOpacity={0.14} strokeWidth={10} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                    <path
                      d={d}
                      fill="none"
                      stroke={MIRO_BLUE}
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                      className={snap ? undefined : "wb-wire"}
                    />
                    <circle cx={a.x} cy={a.y} r={4.5 / z} fill="#fff" stroke={MIRO_BLUE} strokeWidth={2} vectorEffect="non-scaling-stroke" />
                    <circle key={snap ? `${snap.id}${snap.side}` : "free"} cx={b.x} cy={b.y} r={(snap ? 7 : 5.5) / z} fill={MIRO_BLUE} className={snap ? "wb-wire-snap" : "wb-wire-dot"} />
                  </g>
                );
              })()}
            {interaction?.type === "draw" && (
              <path d={strokePath(interaction.points)} fill="none" stroke={penColor} strokeWidth={penMode === "highlighter" ? penWidth * HIGHLIGHT.scale : penWidth} strokeOpacity={interaction.snap ? 0.18 : penMode === "highlighter" ? HIGHLIGHT.opacity : 1} strokeLinecap="round" strokeLinejoin="round" />
            )}
            {interaction?.type === "draw" &&
              interaction.snap &&
              (interaction.snap.kind === "line" ? (
                <line className="wb-snap" x1={interaction.snap.a.x} y1={interaction.snap.a.y} x2={interaction.snap.b.x} y2={interaction.snap.b.y} stroke={penColor} strokeWidth={Math.max(2, Math.min(penWidth, 6))} strokeLinecap="round" />
              ) : (
                <g className="wb-snap" transform={`translate(${interaction.snap.x},${interaction.snap.y})`}>
                  <path d={shapePath(interaction.snap.kind, interaction.snap.w, interaction.snap.h)} fill="none" stroke={penColor} strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                </g>
              ))}
          </svg>

          <div data-leave className="pointer-events-none absolute left-0 top-0" style={{ zIndex: 2 }} />
          <div className="absolute left-0 top-0" style={{ zIndex: 2 }}>
            {boxes.map(renderBox)}
            {ghost && tool === "sticky" && !interaction && (
              <div
                className="pointer-events-none absolute rounded-[2px] opacity-60"
                style={{ left: ghost.x - 90, top: ghost.y - 90, width: 180, height: 180, background: stickyColor, zIndex: 1e6, boxShadow: "0 10px 14px -10px rgba(0,0,0,.30)" }}
              />
            )}
          </div>
        </div>

        {/* Screen-space overlays */}
        <div className="pointer-events-none absolute inset-0" style={{ zIndex: 5 }}>
          {/* remote selections */}
          {peers.map((peer) =>
            peer.selection.map((id) => {
              const el = byId.get(id);
              if (!el || !isBox(el)) return null;
              const a = toScreen(el.x, el.y);
              return (
                <div
                  key={peer.key + id}
                  className="absolute rounded-[4px]"
                  style={{ left: a.x - 3, top: a.y - 3, width: el.w * camera.zoom + 6, height: el.h * camera.zoom + 6, boxShadow: `0 0 0 2px ${peer.color}` }}
                />
              );
            })
          )}

          {/* guides */}
          {guides.v.map((gx) => (
            <div key={`v${gx}`} className="absolute top-0 bottom-0 w-px bg-[#F24726]" style={{ left: toScreen(gx, 0).x }} />
          ))}
          {guides.h.map((gy) => (
            <div key={`h${gy}`} className="absolute left-0 right-0 h-px bg-[#F24726]" style={{ top: toScreen(0, gy).y }} />
          ))}

          {/* every node you can connect to, while dragging a connector */}
          {(interaction?.type === "connect" || interaction?.type === "endpoint") &&
            elements
              .filter((e): e is BoxEl => isBox(e) && e.kind !== "draw" && e.kind !== "frame" && !(interaction.type === "connect" && e.id === interaction.from.id))
              .map((el) => {
                const a = toScreen(el.x, el.y);
                const w = el.w * camera.zoom;
                const h = el.h * camera.zoom;
                const hot = connectHover === el.id;
                return (
                  <div key={`ct-${el.id}`} className="absolute" style={{ left: a.x, top: a.y, width: w, height: h }}>
                    <div className={clsx("absolute -inset-1 rounded-[3px] border", hot ? "border-[#4262FF] bg-[#4262FF]/5" : "border-[#4262FF]/30")} />
                    {(["top", "right", "bottom", "left"] as Side[]).map((side) => {
                      const p = { top: [w / 2, 0], right: [w, h / 2], bottom: [w / 2, h], left: [0, h / 2] }[side];
                      return <span key={side} className={clsx("absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-[#4262FF]", snap?.id === el.id && snap.side === side ? "h-4 w-4 bg-[#4262FF] ring-4 ring-[#4262FF]/25" : hot ? "h-2.5 w-2.5 bg-white" : "h-2 w-2 bg-white")} style={{ left: p[0], top: p[1] }} />;
                    })}
                  </div>
                );
              })}

          {/* connection target */}
          {connectHover && (() => {
            const el = byId.get(connectHover);
            if (!el || !isBox(el)) return null;
            const a = toScreen(el.x, el.y);
            return <div className="absolute rounded-[3px] ring-2 ring-[#4262FF]" style={{ left: a.x - 2, top: a.y - 2, width: el.w * camera.zoom + 4, height: el.h * camera.zoom + 4 }} />;
          })()}

          {/* marquee / create preview */}
          {(interaction?.type === "marquee" || (interaction?.type === "create" && (interaction.tool === "shape" || interaction.tool === "frame"))) &&
            (() => {
              const a = toScreen(Math.min(interaction.start.x, interaction.cur.x), Math.min(interaction.start.y, interaction.cur.y));
              const w = Math.abs(interaction.cur.x - interaction.start.x) * camera.zoom;
              const h = Math.abs(interaction.cur.y - interaction.start.y) * camera.zoom;
              return <div className="absolute border border-[#4262FF] bg-[#4262FF]/[.08]" style={{ left: a.x, top: a.y, width: w, height: h }} />;
            })()}

          {/* selection box */}
          {selBounds && !editingId && interaction?.type !== "marquee" && !(single && single.kind === "connector") && (() => {
            const a = toScreen(selBounds.x, selBounds.y);
            const w = selBounds.w * camera.zoom;
            const h = selBounds.h * camera.zoom;
            const canResize = single && isBox(single) && single.kind !== "draw" && !single.locked;
            return (
              <div key={selection.join("|")} className="wb-sel absolute" style={{ left: a.x, top: a.y, width: w, height: h }}>
                <div className="absolute -inset-px rounded-[2px] ring-2 ring-[#4262FF]" />
                {selected.length > 1 &&
                  selected.filter(isBox).map((m) => {
                    const ma = toScreen(m.x, m.y);
                    return <div key={m.id} className="absolute ring-1 ring-[#4262FF]/60" style={{ left: ma.x - a.x, top: ma.y - a.y, width: m.w * camera.zoom, height: m.h * camera.zoom }} />;
                  })}
                {canResize &&
                  HANDLES.filter((hd) => hd.length === 2 || single?.kind !== "sticky").map((hd) => {
                    const corner = hd.length === 2;
                    const hw = corner ? 12 : hd === "n" || hd === "s" ? 18 : 6;
                    const hh = corner ? 12 : hd === "n" || hd === "s" ? 6 : 18;
                    const pos: React.CSSProperties = {
                      left: (hd.includes("w") ? 0 : hd.includes("e") ? w : w / 2) - hw / 2,
                      top: (hd.includes("n") ? 0 : hd.includes("s") ? h : h / 2) - hh / 2,
                      width: hw,
                      height: hh,
                      cursor: `${hd}-resize`,
                    };
                    return <div key={hd} data-handle={hd} className="pointer-events-auto absolute rounded-full border-[1.5px] border-[#4262FF] bg-white shadow-[0_1px_2px_rgba(0,0,0,.15)]" style={pos} />;
                  })}
                {single && isBox(single) && single.locked && (
                  <span className="absolute -top-7 left-0 flex items-center gap-1 rounded bg-white px-1.5 py-0.5 text-[11px] text-[#656B81] shadow"><Lock className="h-3 w-3" /> Locked</span>
                )}
              </div>
            );
          })()}

          {/* connector endpoints */}
          {single && single.kind === "connector" &&
            (() => {
              const pth = connectorPath(single, byId);
              return (["from", "to"] as const).map((end) => {
                const pt = toScreen(end === "from" ? pth.a.x : pth.b.x, end === "from" ? pth.a.y : pth.b.y);
                return (
                  <div
                    key={end}
                    data-endpoint={end}
                    data-owner={single.id}
                    className="pointer-events-auto absolute h-3 w-3 cursor-move rounded-full border-[1.5px] border-[#4262FF] bg-white shadow-[0_1px_2px_rgba(0,0,0,.15)]"
                    style={{ left: pt.x - 6, top: pt.y - 6 }}
                  />
                );
              });
            })()}

          {/* connection ports */}
          {elements.filter((e): e is BoxEl => isBox(e) && e.kind !== "draw" && e.kind !== "frame" && showPorts(e.id)).map((el) =>
            (["top", "right", "bottom", "left"] as Side[]).map((side) => {
              const a = anchor(el, side);
              const s = toScreen(a.x, a.y);
              const off = 16;
              const d = { top: [0, -off], right: [off, 0], bottom: [0, off], left: [-off, 0] }[side];
              return (
                <div
                  key={el.id + side}
                  data-port={side}
                  data-owner={el.id}
                  onPointerEnter={() => setHoverId(el.id)}
                  title="Click to add the next item here · drag to connect"
                  className="group pointer-events-auto absolute grid h-6 w-6 cursor-crosshair place-items-center"
                  style={{ left: s.x + d[0] - 12, top: s.y + d[1] - 12 }}
                >
                  <span className="grid h-3.5 w-3.5 place-items-center rounded-full border-[1.5px] border-[#4262FF] bg-white transition-all group-hover:h-5 group-hover:w-5 group-hover:bg-[#4262FF]">
                    <Plus className="hidden h-3 w-3 text-white group-hover:block" strokeWidth={3} />
                  </span>
                </div>
              );
            })
          )}

          {/* connector label editor */}
          {labelEdit && (
            <input
              key={labelEdit.id}
              autoFocus
              defaultValue={labelEdit.label || ""}
              placeholder="Type a label"
              onPointerDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLInputElement).blur();
              }}
              onBlur={(e) => {
                const v = e.target.value.trim();
                setLabelEditId(null);
                if (v !== (labelEdit.label || "")) saveLabel(labelEdit.id, v);
              }}
              className="pointer-events-auto absolute w-44 -translate-x-1/2 -translate-y-1/2 rounded-[3px] bg-white px-2 py-1 text-center text-[13px] text-[#1C1C1E] shadow-md outline-none ring-[1.5px] ring-[#4262FF]"
              style={{ left: labelEdit.at.x, top: labelEdit.at.y, outline: "none" }}
            />
          )}

          {/* remote cursors */}
          {peers
            .filter((p) => p.cursor)
            .map((peer) => {
              const s = toScreen(peer.cursor!.x, peer.cursor!.y);
              return (
                <div key={peer.key} className="absolute transition-transform duration-75 ease-linear" style={{ transform: `translate(${s.x}px, ${s.y}px)` }}>
                  <svg width="18" height="22" viewBox="0 0 18 22" className="-ml-0.5 -mt-0.5 drop-shadow">
                    <path d="M1 1 L1 17 L5.5 13 L8.5 20 L11.5 18.6 L8.6 12 L15 12 Z" fill={peer.color} stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
                  </svg>
                  <span className="ml-3.5 -mt-1 block whitespace-nowrap rounded-[4px] px-1.5 py-0.5 text-[12px] font-medium text-white shadow-sm" style={{ background: peer.color }}>
                    {peer.name.split(/\s+/)[0]}
                  </span>
                </div>
              );
            })}
        </div>
      </div>

      {/* ---------------- Floating UI ---------------- */}
      {/* Top-left: board header */}
      <div data-ui className={clsx("wb-from-top absolute left-3 top-3 z-20 flex h-12 items-center gap-0.5 px-1.5", PANEL)}>
        <button type="button" onClick={onBack} className={clsx(ICON_BTN, "h-9 w-9")} title={backLabel} aria-label={backLabel}>
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="mx-1 h-6 w-px bg-[#E9EAEF]" />
        <input
          value={name}
          size={Math.max(6, Math.min(name.length + 1, 34))}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            if (name.trim() && name !== meta.name) {
              onMetaChange({ ...meta, name });
              void save(elRef.current, name);
            }
          }}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          readOnly={readOnly}
          style={{ outline: "none" }}
          className="h-9 max-w-[min(40vw,320px)] truncate rounded-md bg-transparent px-2 text-[16px] font-semibold text-[#1C1C1E] outline-none hover:bg-[#F1F2F5] focus:bg-white focus:ring-[1.5px] focus:ring-[#4262FF]"
          aria-label="Board name"
        />
        <span
          className={clsx("grid h-9 w-9 place-items-center", saveState === "error" ? "text-[#F24726]" : "text-[#9A9DAA]")}
          title={saveState === "saving" ? "Saving…" : saveState === "error" ? "Not saved — retrying on next change" : "All changes saved"}
          aria-live="polite"
        >
          {saveState === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : saveState === "error" ? <CloudOff className="h-4 w-4" /> : <Cloud className="h-4 w-4" />}
        </span>
        <button type="button" onClick={exportJson} className={clsx(ICON_BTN, "h-9 w-9")} title="Export board (.json)" aria-label="Export board">
          <Download className="h-[18px] w-[18px]" />
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() => setFramesOpen((v) => !v)}
            aria-pressed={framesOpen}
            className={clsx(ICON_BTN, "h-9 w-auto gap-1 px-2", framesOpen && ACTIVE_BTN)}
            title="Frames"
            aria-label="Frames"
          >
            <span className="flex items-center gap-1">
              <FrameIcon className="h-[18px] w-[18px]" />
              <span className="text-[13px] tabular-nums">{frames.length}</span>
            </span>
          </button>
          {framesOpen && (
            <div data-scrollable className={clsx("absolute left-0 top-11 max-h-[60vh] w-64 overflow-y-auto p-1.5", POPOVER)}>
              <p className="px-2 pb-1 pt-1 text-[12px] font-semibold text-[#656B81]">Frames</p>
              {frames.length === 0 && <p className="px-2 pb-2 text-[13px] text-[#656B81]">No frames yet. Press F and drag on the board to add one.</p>}
              {[...frames]
                .sort((a, b) => a.y - b.y || a.x - b.x)
                .map((f, i) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      setFramesOpen(false);
                      setSelection([f.id]);
                      fitTo([f]);
                    }}
                    className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-[14px] hover:bg-[#F1F2F5]"
                  >
                    <span className="w-5 text-right text-[12px] tabular-nums text-[#9A9DAA]">{i + 1}</span>
                    <span className="truncate">{f.title || "Frame"}</span>
                  </button>
                ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setFocusMode((v) => !v)}
          aria-pressed={focusMode}
          title={focusMode ? "Exit full screen (Esc)" : "Full screen — hide the app's menus"}
          aria-label={focusMode ? "Exit full screen" : "Full screen"}
          className={clsx(ICON_BTN, "h-9 w-9", focusMode && ACTIVE_BTN)}
        >
          {focusMode ? <Minimize2 className="h-[18px] w-[18px]" /> : <Maximize2 className="h-[18px] w-[18px]" />}
        </button>
      </div>

      {/* Top-right: collaborators + share */}
      <div data-ui className="wb-from-top absolute right-3 top-3 z-20 flex items-center gap-2">
        {extraActions && <div className={clsx("flex h-12 items-center gap-1 px-1.5", PANEL)}>{extraActions}</div>}
        <div className={clsx("flex h-12 items-center gap-2 pl-2.5 pr-1.5", PANEL)}>
          <div className="flex -space-x-1.5">
            {peers.slice(0, 4).map((p) => (
              <span key={p.key} title={p.name} className="grid h-8 w-8 place-items-center rounded-full text-[12px] font-semibold text-white ring-2 ring-white" style={{ background: p.color }}>
                {initialsOf(p.name)}
              </span>
            ))}
            {peers.length > 4 && (
              <span className="grid h-8 w-8 place-items-center rounded-full bg-[#E9EAEF] text-[11px] font-semibold text-[#1C1C1E] ring-2 ring-white">+{peers.length - 4}</span>
            )}
            {rt.me && (
              <span title={`${rt.me.name} (you)${rt.connected ? "" : " — connecting"}`} className="relative grid h-8 w-8 place-items-center rounded-full text-[12px] font-semibold text-white ring-2 ring-white" style={{ background: rt.me.color }}>
                {initialsOf(rt.me.name)}
                <span className={clsx("absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white", rt.connected ? "bg-[#0CA789]" : "bg-[#C3C6D4]")} />
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(`${window.location.origin}/whiteboard?boardId=${meta.id}`);
              flash("Board link copied");
            }}
            className="flex h-9 items-center gap-1.5 rounded-md bg-[#4262FF] px-3.5 text-[14px] font-semibold text-white transition-colors hover:bg-[#3550E6]"
          >
            <UserPlus className="h-4 w-4" />
            Share
          </button>
        </div>
      </div>

      {readOnly && (
        <div data-ui className={clsx("absolute left-1/2 top-3 z-20 flex h-12 -translate-x-1/2 items-center gap-2 px-4 text-[14px] text-[#1C1C1E]", PANEL)}>
          <Lock className="h-4 w-4 text-[#656B81]" /> View only
        </div>
      )}

      {/* Toolbar: left, right or top; icons only or with labels (Toolbar layout menu) */}
      <div
        data-ui
        style={readOnly ? { display: "none" } : undefined}
        className={clsx(
          "absolute top-[72px] z-20 flex gap-2",
          tb.pos === "left" && "wb-from-left left-3 flex-col",
          tb.pos === "right" && "wb-from-right right-3 flex-col",
          tb.pos === "top" && "wb-from-top inset-x-0 mx-auto w-fit max-w-[calc(100%-24px)] flex-row flex-wrap justify-center"
        )}
      >
        <div className={clsx("flex gap-0.5 p-1", PANEL, tbVertical ? "flex-col" : "flex-row flex-wrap justify-center")}>
          {(
            [
              ["select", MousePointer2, "Select", "V", "Select"],
              ["hand", Hand, "Hand", "H", "Hand"],
              ["text", Type, "Text", "T", "Text"],
              ["sticky", StickyNote, "Sticky note", "N", "Sticky"],
              ["shape", Shapes, "Shapes", "S", "Shapes"],
              ["connector", MoveUpRight, "Connection line", "L", "Line"],
              ["pen", Pen, "Pen", "P", "Pen"],
              ["frame", FrameIcon, "Frame", "F", "Frame"],
            ] as [Tool, LucideIcon, string, string, string][]
          ).map(([t, Icon, label, key, short]) => {
            const flyout = (t === "sticky" && tool === "sticky") || (t === "shape" && shapeMenu) || (t === "pen" && (tool === "pen" || tool === "eraser"));
            const active = tool === t || (t === "pen" && tool === "eraser");
            return (
              <div key={t} className="group relative">
                <button
                  type="button"
                  aria-label={`${label} (${key})`}
                  aria-pressed={active}
                  onClick={() => {
                    setTool(t);
                    if (t !== "select" && t !== "hand") setSelection([]);
                    setLibraryOpen(false);
                    setShapeMenu(t === "shape" ? !shapeMenu || tool !== "shape" : false);
                  }}
                  className={toolBtn(active)}
                >
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                  {tbDetailed && <span className="text-[10.5px] font-medium leading-none">{short}</span>}
                </button>
                {!flyout && <Tip label={label} hint={key} side={tb.pos} />}
                {t === "sticky" && flyout && (
                  <div className={clsx("absolute w-[184px] p-3", flyPos, POPOVER)}>
                    <p className="mb-2 text-[12px] font-semibold text-[#656B81]">Sticky notes</p>
                    <div className="grid grid-cols-4 gap-2">
                      {STICKY_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setStickyColor(c)}
                          className={clsx("h-9 w-9 rounded-[2px] shadow-[0_1px_2px_rgba(0,0,0,.12),0_4px_6px_-4px_rgba(0,0,0,.3)] transition-transform hover:scale-110", stickyColor === c && "ring-2 ring-[#4262FF] ring-offset-2")}
                          style={{ background: c }}
                          aria-label={`Sticky colour ${c}`}
                        />
                      ))}
                    </div>
                    <p className="mt-3 text-[12px] text-[#9A9DAA]">Click the board to place it</p>
                  </div>
                )}
                {t === "shape" && flyout && (
                  <div className={clsx("absolute w-[232px] p-3", flyPos, POPOVER)}>
                    <p className="mb-2 text-[12px] font-semibold text-[#656B81]">Shapes</p>
                    <div className="grid grid-cols-4 gap-1">
                      {SHAPES.map((sh) => (
                        <button
                          key={sh.kind}
                          type="button"
                          title={sh.label}
                          aria-label={sh.label}
                          onClick={() => {
                            setShapeKind(sh.kind);
                            setTool("shape");
                            setShapeMenu(false);
                          }}
                          className={clsx("wb-btn grid h-10 w-10 place-items-center rounded-lg", shapeKind === sh.kind ? "bg-[#E6EAFF] ring-1 ring-[#4262FF]/40" : "hover:bg-[#F1F2F5]")}
                        >
                          <svg width="26" height="20" viewBox="-4 -4 118 88" className="overflow-visible transition-transform duration-200 hover:scale-110">
                            <path d={shapePath(sh.kind, 110, 80)} fill="#FFFFFF" stroke="#656B81" strokeWidth={6} strokeLinejoin="round" />
                          </svg>
                        </button>
                      ))}
                    </div>
                    <p className="mt-3 text-[12px] text-[#9A9DAA]">Click to place, or drag to size</p>
                  </div>
                )}
                {t === "pen" && flyout && (
                  <div className={clsx("absolute w-[184px] p-3", flyPos, POPOVER)}>
                    <div className="mb-3 grid grid-cols-3 gap-1">
                      {(
                        [
                          ["pen", Pen, "Pen"],
                          ["highlighter", Highlighter, "Highlighter"],
                          ["eraser", Eraser, "Eraser (E)"],
                        ] as const
                      ).map(([m, Icon, label]) => {
                        const on = m === "eraser" ? tool === "eraser" : tool === "pen" && penMode === m;
                        return (
                          <button
                            key={m}
                            type="button"
                            title={label}
                            aria-label={label}
                            aria-pressed={on}
                            onClick={() => {
                              if (m === "eraser") setTool("eraser");
                              else {
                                setPenMode(m);
                                setTool("pen");
                              }
                            }}
                            className={clsx("grid h-9 place-items-center rounded-md", on ? ACTIVE_BTN : "text-[#1C1C1E] hover:bg-[#F1F2F5]")}
                          >
                            <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                          </button>
                        );
                      })}
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {PEN_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setPenColor(c)}
                          className={clsx("h-7 w-7 rounded-full ring-1 ring-black/10", penColor === c && "ring-2 ring-[#4262FF] ring-offset-2")}
                          style={{ background: c }}
                          aria-label={`Pen colour ${c}`}
                        />
                      ))}
                    </div>
                    <div className="mt-3 flex gap-1">
                      {PEN_WIDTHS.map((w) => (
                        <button
                          key={w}
                          type="button"
                          onClick={() => setPenWidth(w)}
                          className={clsx("grid h-9 flex-1 place-items-center rounded-md", penWidth === w ? ACTIVE_BTN : "hover:bg-[#F1F2F5]")}
                          aria-label={`Thickness ${w}`}
                        >
                          <span
                            className="w-8 rounded-full"
                            style={{
                              height: penMode === "highlighter" ? Math.min(14, w * 2.5) : w,
                              background: penColor === "#FFFFFF" ? "#C3C6D4" : penColor,
                              opacity: penMode === "highlighter" ? HIGHLIGHT.opacity + 0.2 : 1,
                            }}
                          />
                        </button>
                      ))}
                    </div>
                    <label className="mt-3 flex cursor-pointer items-start gap-2 border-t border-[#E9EAEF] pt-3 text-[12px] leading-snug text-[#1C1C1E]">
                      <input type="checkbox" checked={pencilDraws} onChange={(e) => setPencilDraws(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#4262FF]" />
                      <span>
                        Apple Pencil draws
                        <span className="block text-[11px] text-[#656B81]">Fingers move and zoom the board</span>
                      </span>
                    </label>
                    <label className="mt-2 flex cursor-pointer items-start gap-2 text-[12px] leading-snug text-[#1C1C1E]">
                      <input type="checkbox" checked={tb.autoShapes} onChange={(e) => setTb({ autoShapes: e.target.checked })} className="mt-0.5 h-4 w-4 accent-[#4262FF]" />
                      <span>
                        Turn drawings into shapes
                        <span className="block text-[11px] text-[#656B81]">Or draw a shape and hold the pen still to snap it</span>
                      </span>
                    </label>
                  </div>
                )}
              </div>
            );
          })}
          <span className={clsx("bg-[#E9EAEF]", tbVertical ? "mx-2 my-0.5 h-px" : "mx-0.5 my-2 w-px self-stretch")} />
          <div className="group relative">
            <button
              type="button"
              aria-label="More blocks (B)"
              aria-pressed={libraryOpen}
              onClick={() => {
                setLibraryOpen((v) => !v);
                setShapeMenu(false);
                setTbMenu(false);
              }}
              className={toolBtn(libraryOpen)}
            >
              <SquarePlus className="h-5 w-5" strokeWidth={1.75} />
              {tbDetailed && <span className="text-[10.5px] font-medium leading-none">Blocks</span>}
            </button>
            {!libraryOpen && <Tip label="More blocks" hint="B" side={tb.pos} />}
          </div>
          <div className="group relative">
            <button
              type="button"
              aria-label="Toolbar layout"
              aria-pressed={tbMenu}
              onClick={() => {
                setTbMenu((v) => !v);
                setShapeMenu(false);
                setLibraryOpen(false);
              }}
              className={toolBtn(tbMenu)}
            >
              <SlidersHorizontal className="h-5 w-5" strokeWidth={1.75} />
              {tbDetailed && <span className="text-[10.5px] font-medium leading-none">Layout</span>}
            </button>
            {!tbMenu && <Tip label="Toolbar layout" side={tb.pos} />}
            {tbMenu && (
              <div className={clsx("absolute w-[232px] p-3", flyPos, POPOVER)}>
                <p className="mb-2 text-[12px] font-semibold text-[#656B81]">Toolbar position</p>
                <div className="grid grid-cols-3 gap-1">
                  {(
                    [
                      ["left", PanelLeft, "Left"],
                      ["top", PanelTop, "Top"],
                      ["right", PanelRight, "Right"],
                    ] as const
                  ).map(([pos, Icon, label]) => (
                    <button
                      key={pos}
                      type="button"
                      aria-pressed={tb.pos === pos}
                      onClick={() => setTb({ pos })}
                      className={clsx("flex h-14 flex-col items-center justify-center gap-1 rounded-md text-[12px]", tb.pos === pos ? ACTIVE_BTN : "text-[#1C1C1E] hover:bg-[#F1F2F5]")}
                    >
                      <Icon className="h-5 w-5" strokeWidth={1.75} />
                      {label}
                    </button>
                  ))}
                </div>
                <p className="mb-2 mt-3 text-[12px] font-semibold text-[#656B81]">Buttons</p>
                <div className="grid grid-cols-2 gap-1">
                  {(
                    [
                      ["compact", "Compact", "Icons only"],
                      ["detailed", "Detailed", "Icons and names"],
                    ] as const
                  ).map(([style, label, hint]) => (
                    <button
                      key={style}
                      type="button"
                      aria-pressed={tb.style === style}
                      onClick={() => setTb({ style })}
                      className={clsx("rounded-md px-2 py-2 text-left", tb.style === style ? ACTIVE_BTN : "text-[#1C1C1E] hover:bg-[#F1F2F5]")}
                    >
                      <span className="block text-[13px] font-medium">{label}</span>
                      <span className="block text-[11px] text-[#656B81]">{hint}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className={clsx("flex gap-0.5 p-1", PANEL, tbVertical ? "flex-col" : "flex-row")}>
          <div className="group relative">
            <button type="button" aria-label="Undo" onClick={undo} className={toolBtn(false)}>
              <Undo2 className="h-5 w-5" strokeWidth={1.75} />
              {tbDetailed && <span className="text-[10.5px] font-medium leading-none">Undo</span>}
            </button>
            <Tip label="Undo" hint="Ctrl+Z" side={tb.pos} />
          </div>
          <div className="group relative">
            <button type="button" aria-label="Redo" onClick={redo} className={toolBtn(false)}>
              <Redo2 className="h-5 w-5" strokeWidth={1.75} />
              {tbDetailed && <span className="text-[10.5px] font-medium leading-none">Redo</span>}
            </button>
            <Tip label="Redo" hint="Ctrl+Shift+Z" side={tb.pos} />
          </div>
        </div>
      </div>

      {/* Block library */}
      {libraryOpen && (
        <div
          data-ui
          data-scrollable
          className={clsx("absolute z-20 w-72 overflow-y-auto p-3", tb.pos === "top" && "inset-x-0 mx-auto", POPOVER)}
          style={{ ...libraryPos, maxHeight: `calc(100% - ${(libraryPos.top as number) + 24}px)` }}
        >
          <div className="mb-1 flex items-center justify-between">
            <p className="text-[14px] font-semibold text-[#1C1C1E]">Add to board</p>
            <button type="button" onClick={() => setLibraryOpen(false)} className="grid h-7 w-7 place-items-center rounded-md text-[#656B81] hover:bg-[#F1F2F5]" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mb-3 text-[12px] text-[#656B81]">Click to drop in the middle of the view, or drag onto the board.</p>
          {(["Data flow", "Shapes", "Notes"] as const).map((group) => (
            <div key={group} className="mb-3">
              <p className="mb-1.5 text-[12px] font-semibold text-[#656B81]">{group}</p>
              <div className={clsx("grid gap-1.5", group === "Data flow" ? "grid-cols-1" : "grid-cols-2")}>
                {BLOCKS.filter((b) => b.group === group).map((b) => {
                  const sample = b.make(0, 0, 0);
                  return (
                    <button
                      key={b.id}
                      type="button"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/x-wb-block", b.id);
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => addBlock(b.id)}
                      className="flex cursor-grab items-center gap-2.5 rounded-md border border-[#E9EAEF] p-2 text-left text-[13px] text-[#1C1C1E] hover:border-[#4262FF] hover:bg-[#F7F8FF] active:cursor-grabbing"
                    >
                      {sample.kind === "card" ? (
                        <span className="h-6 w-8 shrink-0 overflow-hidden rounded bg-white ring-1 ring-[#E9EAEF]">
                          <span className="block h-1" style={{ background: sample.accent }} />
                        </span>
                      ) : sample.kind === "shape" ? (
                        <svg width="30" height="22" viewBox={`0 0 ${sample.w} ${sample.h}`} className="shrink-0">
                          <path d={shapePath(sample.shape, sample.w, sample.h)} fill="#fff" stroke={sample.stroke} strokeWidth={10} />
                        </svg>
                      ) : sample.kind === "sticky" ? (
                        <span className="h-6 w-6 shrink-0 rounded-[2px] shadow-sm" style={{ background: sample.color }} />
                      ) : (
                        <Type className="h-5 w-5 shrink-0 text-[#656B81]" />
                      )}
                      <span className="truncate">{b.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Right-click menu */}
      {menu && (
        <div
          data-ui
          role="menu"
          className={clsx("absolute z-40 w-60 p-1.5 text-[14px]", POPOVER)}
          style={{ left: Math.min(menu.x, view.w - 252), top: Math.max(8, Math.min(menu.y, view.h - 380)) }}
          onPointerDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          {!menu.onElement && (
            <div className="mb-1 border-b border-[#E9EAEF] px-1 pb-2 pt-1">
              <p className="px-1 pb-1.5 text-[12px] font-semibold text-[#656B81]">Add here</p>
              <div className="grid grid-cols-5 gap-1">
                {SHAPES.map((sh) => (
                  <button
                    key={sh.kind}
                    type="button"
                    title={sh.label}
                    aria-label={`Add ${sh.label}`}
                    onClick={() => {
                      const z = maxZ() + 1;
                      const { w, h } = shapeSize(sh.kind);
                      const el: BoxEl = { id: uid(), kind: "shape", shape: sh.kind, x: menu.world.x - w / 2, y: menu.world.y - h / 2, w, h, z, text: "", ...SHAPE_LOOK, textColor: SHAPE_TEXT, fontSize: 16 };
                      setMenu(null);
                      commit([...elRef.current, el]);
                      setSelection([el.id]);
                      setEditingId(el.id);
                    }}
                    className="grid h-9 place-items-center rounded-md text-[#1C1C1E] hover:bg-[#E6EAFF] hover:text-[#4262FF]"
                  >
                    <svg width="22" height="16" viewBox="0 0 110 80">
                      <path d={shapePath(sh.kind, 110, 80)} fill="none" stroke="currentColor" strokeWidth={7} />
                    </svg>
                  </button>
                ))}
                <button type="button" title="Sticky note" aria-label="Add sticky note" onClick={() => { setMenu(null); addBlock("n-sticky", menu.world); }} className="grid h-9 place-items-center rounded-md hover:bg-[#E6EAFF]">
                  <span className="h-4 w-4 rounded-[1px] bg-[#FFF9B1] shadow-[0_1px_2px_rgba(0,0,0,.25)]" />
                </button>
                <button type="button" title="Process card" aria-label="Add process card" onClick={() => { setMenu(null); addBlock("process", menu.world); }} className="grid h-9 place-items-center rounded-md hover:bg-[#E6EAFF]">
                  <span className="h-4 w-5 overflow-hidden rounded-sm bg-white ring-1 ring-[#C3C6D4]"><span className="block h-1 bg-[#7C4DDB]" /></span>
                </button>
              </div>
            </div>
          )}
          {(menu.onElement
            ? ([
                ...(single && isBox(single) && single.kind !== "draw" && !single.locked ? [["edit", "Edit text", "Enter"]] : []),
                ...(single && single.kind === "connector" && !single.locked ? [["label", single.label ? "Edit line text" : "Add text to line", "Enter"]] : []),
                ["duplicate", "Duplicate", "Ctrl+D"],
                ["copy", "Copy", "Ctrl+C"],
                ...(selected.some((x) => x.kind === "draw" && !x.locked) ? [["convert", "Convert to shape", "Shift+S"]] : []),
                ...(grouping.canGroup ? [["group", "Group", "Ctrl+G"]] : []),
                ...(grouping.grouped ? [["ungroup", "Ungroup", "Ctrl+Shift+G"]] : []),
                ["connect", "Connect from here", "L"],
                ["front", "Bring to front", "PgUp"],
                ["back", "Send to back", "PgDn"],
                ["lock", selected.every((x) => x.locked) ? "Unlock" : "Lock", "Ctrl+Shift+L"],
                ["delete", "Delete", "Del"],
              ] as [MenuAction, string, string][])
            : ([
                ["paste", "Paste here", "Ctrl+V"],
                ["text", "Add text", "T"],
                ["blocks", "More blocks…", "B"],
                ["selectAll", "Select all", "Ctrl+A"],
                ["fit", "Zoom to fit", "Shift+1"],
              ] as [MenuAction, string, string][])
          ).map(([action, l, hint]) => {
            const disabled = action === "paste" && !hasClip;
            return (
              <button
                key={l}
                type="button"
                role="menuitem"
                disabled={disabled}
                onClick={() => {
                  setMenu(null);
                  runMenuAction(action, menu.world);
                }}
                className={clsx(
                  "flex h-9 w-full items-center justify-between rounded-md px-2.5 text-left disabled:opacity-40",
                  l === "Delete" ? "text-[#E0291B] hover:bg-[#FFEDEB]" : "text-[#1C1C1E] hover:bg-[#F1F2F5]",
                  l === "Delete" && "mt-1 border-t border-[#E9EAEF]"
                )}
              >
                <span className="flex items-center gap-2">
                  {l === "Paste here" && <ClipboardPaste className="h-4 w-4 text-[#656B81]" />}
                  {l}
                </span>
                <span className="text-[12px] text-[#9A9DAA]">{hint}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Contextual toolbar */}
      {selBounds && !interaction && !editingId && (
        <ContextBar
          key={selection.join("|")}
          x={toScreen(selBounds.x + selBounds.w / 2, 0).x}
          y={toScreen(0, selBounds.y).y}
          below={toScreen(0, selBounds.y + selBounds.h).y}
          containerW={view.w}
          containerH={view.h}
          insetL={tb.pos === "left" ? tbReserve : 12}
          insetR={tb.pos === "right" ? tbReserve : 12}
          safeTop={tb.pos === "top" ? 72 + tbPanel + 12 : 72}
          selected={selected}
          onUpdate={(fn) => update(selection, fn)}
          onFront={bringFront}
          onBack={sendBack}
          grouping={grouping}
          onGroup={groupSelection}
          onUngroup={ungroupSelection}
          onDuplicate={() => duplicate(selected)}
          onConvert={!readOnly && selected.some((x) => x.kind === "draw" && !x.locked) ? () => convertSelectionToShapes() : undefined}
          onEdit={
            single && isBox(single) && single.kind !== "draw" && !single.locked
              ? () => setEditingId(single.id)
              : single && single.kind === "connector" && !single.locked
                ? () => setLabelEditId(single.id)
                : undefined
          }
          onDelete={deleteSelection}
          onAlign={align}
        />
      )}

      {/* Bottom-right: minimap + zoom */}
      {showMap && <Minimap elements={elements} camera={camera} size={view} onJump={(x, y) => {
        const c = camRef.current;
        glideTo({ ...c, x: view.w / 2 - x * c.zoom, y: view.h / 2 - y * c.zoom });
      }} />}
      <div data-ui className="wb-from-bottom absolute bottom-3 right-3 z-20 flex items-center gap-2">
        <div className={clsx("flex h-10 items-center gap-0.5 px-1", PANEL)}>
          <button
            type="button"
            onClick={() => setShowMap((v) => !v)}
            aria-pressed={showMap}
            className={clsx(ICON_BTN, "h-8 w-8", showMap && ACTIVE_BTN)}
            title="Minimap"
            aria-label="Toggle minimap"
          >
            <MapIcon className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={() => {
              const r = rootRef.current?.getBoundingClientRect();
              const b = boundsOf(elRef.current, new Map(elRef.current.map((e) => [e.id, e])));
              if (!r || !b) return;
              const c = camRef.current;
              glideTo({ ...c, x: r.width / 2 - (b.x + b.w / 2) * c.zoom, y: r.height / 2 - (b.y + b.h / 2) * c.zoom });
            }}
            className={clsx(ICON_BTN, "h-8 w-8")}
            title="Re-center (keep zoom)"
            aria-label="Re-center"
          >
            <Crosshair className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </button>
          <button type="button" onClick={() => fitTo(elements)} className={clsx(ICON_BTN, "h-8 w-8")} title="Fit to screen (Shift+1)" aria-label="Fit to screen">
            <Maximize className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </button>
          <span className="mx-1 h-5 w-px bg-[#E9EAEF]" />
          <button type="button" onClick={() => zoomAt(1 / 1.2, undefined, undefined, true)} className={clsx(ICON_BTN, "h-8 w-8")} title="Zoom out (Ctrl −)" aria-label="Zoom out">
            <Minus className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setZoomMenu((v) => !v)}
              aria-pressed={zoomMenu}
              className={clsx("h-8 w-12 rounded-md text-center text-[13px] tabular-nums text-[#1C1C1E] hover:bg-[#F1F2F5]", zoomMenu && "bg-[#E6EAFF] text-[#4262FF]")}
              title="Zoom options"
            >
              {Math.round(camera.zoom * 100)}%
            </button>
            {zoomMenu && (
              <div className={clsx("absolute bottom-11 left-1/2 w-52 -translate-x-1/2 p-1.5 text-[14px]", POPOVER)}>
                {(
                  [
                    ["Zoom in", "Ctrl +", () => zoomAt(1.2, undefined, undefined, true)],
                    ["Zoom out", "Ctrl −", () => zoomAt(1 / 1.2, undefined, undefined, true)],
                    ["Zoom to fit", "Shift+1", () => fitTo(elements)],
                    ["Zoom to selection", "Shift+2", () => fitTo(selected.length ? selected : elements)],
                    ["50%", "", () => zoomTo(0.5)],
                    ["100%", "Shift+0", () => zoomTo(1)],
                    ["200%", "", () => zoomTo(2)],
                  ] as [string, string, () => void][]
                ).map(([label, hint, fn]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      setZoomMenu(false);
                      fn();
                    }}
                    className={clsx("flex h-8 w-full items-center justify-between rounded-md px-2.5 text-left hover:bg-[#F1F2F5]", label === "50%" && "mt-1 border-t border-[#E9EAEF]")}
                  >
                    {label}
                    <span className="text-[12px] text-[#9A9DAA]">{hint}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button type="button" onClick={() => zoomAt(1.2, undefined, undefined, true)} className={clsx(ICON_BTN, "h-8 w-8")} title="Zoom in (Ctrl +)" aria-label="Zoom in">
            <Plus className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </button>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setHelpOpen((v) => !v)}
            aria-pressed={helpOpen}
            className={clsx(PANEL, "grid h-10 w-10 place-items-center text-[#1C1C1E] hover:bg-[#F1F2F5]", helpOpen && "text-[#4262FF]")}
            title="Keyboard shortcuts"
            aria-label="Keyboard shortcuts"
          >
            <CircleHelp className="h-5 w-5" strokeWidth={1.75} />
          </button>
          {helpOpen && (
            <div data-scrollable className={clsx("absolute bottom-12 right-0 max-h-[60vh] w-72 overflow-y-auto p-3", POPOVER)}>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[14px] font-semibold text-[#1C1C1E]">Keyboard shortcuts</p>
                <button type="button" onClick={() => setHelpOpen(false)} className="grid h-7 w-7 place-items-center rounded-md text-[#656B81] hover:bg-[#F1F2F5]" aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {SHORTCUTS.map(([what, keys]) => (
                <div key={what} className="flex items-center justify-between py-1 text-[13px]">
                  <span className="text-[#1C1C1E]">{what}</span>
                  <span className="rounded bg-[#F1F2F5] px-1.5 py-0.5 text-[12px] text-[#656B81]">{keys}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Empty state */}
      {elements.length === 0 && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="text-center">
            <p className="text-[18px] font-semibold text-[#1C1C1E]">Double-click anywhere to add a sticky note</p>
            <p className="mt-1 text-[14px] text-[#656B81]">Or pick a tool on the left. Drag the blue dots on any item to connect it.</p>
          </div>
        </div>
      )}

      {toast && (
        <div className="absolute bottom-16 left-1/2 z-30 -translate-x-1/2 rounded-lg bg-[#1C1C1E] px-4 py-2.5 text-[14px] text-white shadow-lg">{toast}</div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
/** Dark tooltip to the right of a toolbar button (parent needs `group relative`). */
function Tip({ label, hint, side = "left" }: { label: string; hint?: string; side?: TbPos }) {
  return (
    <span
      className={clsx(
        "pointer-events-none absolute z-30 hidden items-center gap-2 whitespace-nowrap wb-tip rounded-md bg-[#1C1C1E] px-2 py-1.5 text-[12px] font-medium text-white shadow-lg group-hover:flex",
        side === "left" && "left-[calc(100%+8px)] top-1/2 -translate-y-1/2",
        side === "right" && "right-[calc(100%+8px)] top-1/2 -translate-y-1/2",
        side === "top" && "left-1/2 top-[calc(100%+8px)] -translate-x-1/2"
      )}
    >
      {label}
      {hint && <span className="text-[#A5A7B5]">{hint}</span>}
    </span>
  );
}

const FONT_SIZES = [10, 12, 14, 16, 18, 24, 32, 40, 48, 64, 80];
const FRAME_FILLS = ["#FFFFFF", "#F5F6F8", "#FFF9B1", "#D5F692", "#A6CCF5", "#FFCEE0", "#C6A2D2", "#1A1A1A"];

function ColorGrid({ colors, value, onPick, square }: { colors: string[]; value?: string; onPick: (c: string) => void; square?: boolean }) {
  return (
    <div className="grid w-max grid-cols-4 gap-2">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onPick(c)}
          aria-label={`Colour ${c}`}
          className={clsx(
            "h-7 w-7 ring-1 ring-inset ring-black/10 transition-transform hover:scale-110",
            square ? "rounded-[2px]" : "rounded-full",
            value?.toLowerCase() === c.toLowerCase() && "outline-2 outline-offset-2 outline-[#4262FF]"
          )}
          style={{ background: c }}
        />
      ))}
    </div>
  );
}

function Btn({ onClick, title, active, children }: { onClick: () => void; title: string; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={clsx("grid h-8 min-w-8 place-items-center rounded-md px-1.5 text-[#1C1C1E] transition-colors", active ? ACTIVE_BTN : "hover:bg-[#F1F2F5]")}
    >
      {children}
    </button>
  );
}

function ContextBar({
  x,
  y,
  below,
  containerW,
  containerH,
  insetL,
  insetR,
  safeTop,
  selected,
  onUpdate,
  onFront,
  onBack,
  onDuplicate,
  onConvert,
  onDelete,
  onAlign,
  onEdit,
  grouping,
  onGroup,
  onUngroup,
}: {
  grouping: { grouped: boolean; canGroup: boolean };
  onGroup: () => void;
  onUngroup: () => void;
  x: number;
  y: number;
  below: number;
  containerW: number;
  containerH: number;
  /** Room kept free for the toolbar on each side, and below the top bars. */
  insetL: number;
  insetR: number;
  safeTop: number;
  selected: El[];
  onUpdate: (fn: (el: El) => El) => void;
  onFront: () => void;
  onBack: () => void;
  onDuplicate: () => void;
  /** Shown when pen strokes are selected. */
  onConvert?: () => void;
  onDelete: () => void;
  onAlign: (m: "left" | "hcenter" | "top" | "right") => void;
  onEdit?: () => void;
}) {
  type Pop = "color" | "stroke" | "textColor" | "shape" | "size" | "route" | "align" | "more" | "textAlign";
  const [pop, setPop] = useState<Pop | null>(null);
  const kinds = new Set(selected.map((s) => s.kind));
  const only = kinds.size === 1 ? selected[0] : null;
  const locked = selected.every((s) => s.locked);
  const sep = <span className="mx-1 h-6 w-px bg-[#E9EAEF]" />;
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  const sig = selected.map((e) => e.id + e.kind).join("|");
  useLayoutEffect(() => {
    const nw = ref.current?.offsetWidth || 0;
    setW((old) => (Math.abs(old - nw) > 1 ? nw : old));
  }, [sig, containerW, locked]);

  // Miro places the toolbar just above the selection, flips it below when
  // there's no room, and docks it under the header when neither fits.
  const BAR_H = 44;
  const GAP = 30; // clears the connection dots above the selection
  const SAFE_TOP = safeTop;
  let top = y - GAP - BAR_H;
  if (top < SAFE_TOP) top = below + GAP;
  if (top + BAR_H > containerH - 60) top = SAFE_TOP;
  const left = clamp(x - w / 2, insetL, Math.max(insetL, containerW - w - insetR));
  const popUp = top > containerH / 2;

  const toggle = (p: Pop) => setPop((cur) => (cur === p ? null : p));
  const popCls = clsx("absolute left-1/2 z-40 -translate-x-1/2 p-3", POPOVER, popUp ? "bottom-full mb-2" : "top-full mt-2");

  const dot = (c: string, ring = false) => (
    <span
      className={clsx("block h-5 w-5 rounded-full", ring ? "border-[3px] bg-white" : "ring-1 ring-inset ring-black/15")}
      style={ring ? { borderColor: c } : { background: c }}
    />
  );
  const fontSize = only && (only.kind === "shape" || only.kind === "text") ? only.fontSize : null;
  const textual = only && (only.kind === "sticky" || only.kind === "shape" || only.kind === "text") ? only : null;
  const fmt = textual ? fmtOf(textual) : {};
  const setFmt = (patch: TextFmt) =>
    onUpdate((el) =>
      el.kind === "sticky" || el.kind === "shape" || el.kind === "text"
        ? ({ ...el, fmt: { ...fmtOf(el), ...patch }, ...(el.kind === "text" ? { bold: undefined } : {}) } as El)
        : el
    );

  return (
    <div
      ref={ref}
      data-ui
      className={clsx("wb-pop absolute z-30 flex min-h-11 flex-wrap items-center gap-0.5 px-1.5 py-0.5", PANEL)}
      style={{ left, top, maxWidth: Math.max(220, containerW - insetL - insetR), visibility: w ? "visible" : "hidden" }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {only?.kind === "sticky" && (
        <Trigger open={pop === "color"} onToggle={() => toggle("color")} popCls={popCls} title="Sticky colour" popover={<ColorGrid square colors={STICKY_COLORS} value={only.color} onPick={(c) => onUpdate((el) => (el.kind === "sticky" ? { ...el, color: c } : el))} />}>
          <span className="block h-5 w-5 rounded-[2px] shadow-[0_1px_2px_rgba(0,0,0,.25)]" style={{ background: only.color }} />
        </Trigger>
      )}
      {only?.kind === "sticky" && (
        <Trigger
          open={pop === "size"}
          onToggle={() => toggle("size")}
          popCls={popCls}
          title="Font size"
          popover={
            <div className="-m-1.5 flex w-20 flex-col">
              {[undefined, ...STICKY_SIZES].map((n) => (
                <button
                  key={n ?? "auto"}
                  type="button"
                  onClick={() => {
                    onUpdate((el) => (el.kind === "sticky" ? { ...el, fontSize: n } : el));
                    setPop(null);
                  }}
                  className={clsx("rounded-md px-3 py-1 text-left text-[13px] tabular-nums", n === only.fontSize ? "bg-[#E6EAFF] text-[#4262FF]" : "hover:bg-[#F1F2F5]")}
                >
                  {n ?? "Auto"}
                </button>
              ))}
            </div>
          }
        >
          <span className="flex items-center gap-1 px-0.5 text-[13px] tabular-nums">
            {only.fontSize ?? "Auto"}
            <ChevronDown className="h-3 w-3 text-[#656B81]" />
          </span>
        </Trigger>
      )}
      {only?.kind === "shape" && (
        <>
          <Trigger
            open={pop === "shape"}
            onToggle={() => toggle("shape")}
            popCls={popCls}
            title="Shape"
            popover={
              <div className="grid w-max grid-cols-4 gap-1">
                {SHAPES.map((sh) => (
                  <button
                    key={sh.kind}
                    type="button"
                    title={sh.label}
                    aria-label={sh.label}
                    onClick={() => {
                      onUpdate((el) => (el.kind === "shape" ? { ...el, shape: sh.kind } : el));
                      setPop(null);
                    }}
                    className={clsx("grid h-9 w-9 place-items-center rounded-md", only.shape === sh.kind ? ACTIVE_BTN : "text-[#1C1C1E] hover:bg-[#F1F2F5]")}
                  >
                    <svg width="22" height="16" viewBox="0 0 110 80">
                      <path d={shapePath(sh.kind, 110, 80)} fill="none" stroke="currentColor" strokeWidth={7} />
                    </svg>
                  </button>
                ))}
              </div>
            }
          >
            <span className="flex items-center gap-0.5">
              <svg width="20" height="15" viewBox="0 0 110 80">
                <path d={shapePath(only.shape, 110, 80)} fill="none" stroke="currentColor" strokeWidth={8} />
              </svg>
              <ChevronDown className="h-3 w-3 text-[#656B81]" />
            </span>
          </Trigger>
          {sep}
        </>
      )}
      {fontSize !== null && (
        <>
          <Trigger
            open={pop === "size"}
            onToggle={() => toggle("size")}
            popCls={popCls}
            title="Font size"
            popover={
              <div className="-m-1.5 flex w-20 flex-col">
                {FONT_SIZES.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      onUpdate((el) => (el.kind === "shape" || el.kind === "text" ? { ...el, fontSize: n } : el));
                      setPop(null);
                    }}
                    className={clsx("rounded-md px-3 py-1 text-left text-[13px] tabular-nums", n === fontSize ? "bg-[#E6EAFF] text-[#4262FF]" : "hover:bg-[#F1F2F5]")}
                  >
                    {n}
                  </button>
                ))}
              </div>
            }
          >
            <span className="flex items-center gap-1 px-0.5 text-[13px] tabular-nums">
              {fontSize}
              <ChevronDown className="h-3 w-3 text-[#656B81]" />
            </span>
          </Trigger>
          <Trigger
            open={pop === "textColor"}
            onToggle={() => toggle("textColor")}
            popCls={popCls}
            title="Text colour"
            popover={
              <ColorGrid
                colors={MIRO_COLORS}
                value={only?.kind === "text" ? only.color : only?.kind === "shape" ? only.textColor : undefined}
                onPick={(c) => onUpdate((el) => (el.kind === "text" ? { ...el, color: c } : el.kind === "shape" ? { ...el, textColor: c } : el))}
              />
            }
          >
            <span className="flex flex-col items-center leading-none">
              <span className="text-[15px] font-semibold">A</span>
              <span className="mt-0.5 h-[3px] w-4 rounded-full ring-1 ring-black/10" style={{ background: only?.kind === "text" ? only.color : only?.kind === "shape" ? only.textColor : INK }} />
            </span>
          </Trigger>
        </>
      )}
      {textual && (
        <>
          {sep}
          <Btn title="Bold (whole item)" active={fmt.bold} onClick={() => setFmt({ bold: !fmt.bold })}>
            <span className="text-[15px] font-bold">B</span>
          </Btn>
          <Btn title="Italic" active={fmt.italic} onClick={() => setFmt({ italic: !fmt.italic })}>
            <span className="font-serif text-[15px] italic">I</span>
          </Btn>
          <Btn title="Underline" active={fmt.underline} onClick={() => setFmt({ underline: !fmt.underline })}>
            <span className="text-[15px] underline">U</span>
          </Btn>
          <Btn title="Strikethrough" active={fmt.strike} onClick={() => setFmt({ strike: !fmt.strike })}>
            <span className="text-[15px] line-through">S</span>
          </Btn>
          <Trigger
            open={pop === "textAlign"}
            onToggle={() => toggle("textAlign")}
            popCls={popCls}
            title="Text alignment"
            popover={
              <div className="-m-1.5 flex gap-0.5">
                {(
                  [
                    ["left", AlignLeft],
                    ["center", AlignCenter],
                    ["right", AlignRight],
                  ] as const
                ).map(([a, Icon]) => (
                  <Btn
                    key={a}
                    title={`Align ${a}`}
                    active={(fmt.align || (textual.kind === "text" ? "left" : "center")) === a}
                    onClick={() => {
                      setFmt({ align: a });
                      setPop(null);
                    }}
                  >
                    <Icon className="h-4 w-4" />
                  </Btn>
                ))}
              </div>
            }
          >
            {(() => {
              const a = fmt.align || (textual.kind === "text" ? "left" : "center");
              const Icon = a === "left" ? AlignLeft : a === "right" ? AlignRight : AlignCenter;
              return <Icon className="h-4 w-4" />;
            })()}
          </Trigger>
        </>
      )}
      {only?.kind === "shape" && (
        <>
          {sep}
          <Trigger
            open={pop === "color"}
            onToggle={() => toggle("color")}
            popCls={popCls}
            title="Fill colour"
            popover={<ColorGrid colors={MIRO_COLORS} value={only.fill} onPick={(c) => onUpdate((el) => (el.kind === "shape" ? { ...el, fill: c, textColor: readableOn(c) } : el))} />}
          >
            {dot(only.fill)}
          </Trigger>
          <Trigger open={pop === "stroke"} onToggle={() => toggle("stroke")} popCls={popCls} title="Border colour" popover={<ColorGrid colors={MIRO_COLORS} value={only.stroke} onPick={(c) => onUpdate((el) => (el.kind === "shape" ? { ...el, stroke: c } : el))} />}>
            {dot(only.stroke, true)}
          </Trigger>
        </>
      )}
      {only?.kind === "card" && (
        <Trigger open={pop === "color"} onToggle={() => toggle("color")} popCls={popCls} title="Accent colour" popover={<ColorGrid colors={MIRO_COLORS} value={only.accent} onPick={(c) => onUpdate((el) => (el.kind === "card" ? { ...el, accent: c } : el))} />}>
          {dot(only.accent)}
        </Trigger>
      )}
      {only?.kind === "frame" && (
        <Trigger open={pop === "color"} onToggle={() => toggle("color")} popCls={popCls} title="Frame colour" popover={<ColorGrid square colors={FRAME_FILLS} value={only.fill} onPick={(c) => onUpdate((el) => (el.kind === "frame" ? { ...el, fill: c } : el))} />}>
          <span className="block h-5 w-5 rounded-[3px] ring-1 ring-inset ring-black/15" style={{ background: only.fill }} />
        </Trigger>
      )}
      {only?.kind === "draw" && (
        <>
          <Trigger open={pop === "color"} onToggle={() => toggle("color")} popCls={popCls} title="Pen colour" popover={<ColorGrid colors={MIRO_COLORS} value={only.stroke} onPick={(c) => onUpdate((el) => (el.kind === "draw" ? { ...el, stroke: c } : el))} />}>
            {dot(only.stroke)}
          </Trigger>
          {PEN_WIDTHS.map((pw) => (
            <Btn key={pw} title={`Thickness ${pw}`} active={only.width === pw} onClick={() => onUpdate((el) => (el.kind === "draw" ? { ...el, width: pw } : el))}>
              <span className="w-5 rounded-full bg-current" style={{ height: pw }} />
            </Btn>
          ))}
        </>
      )}
      {only?.kind === "connector" && (
        <>
          <Trigger
            open={pop === "route"}
            onToggle={() => toggle("route")}
            popCls={popCls}
            title="Line type"
            popover={
              <div className="-m-1.5 flex w-36 flex-col">
                {(["curve", "elbow", "straight"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      onUpdate((el) => (el.kind === "connector" ? { ...el, route: r } : el));
                      setPop(null);
                    }}
                    className={clsx("flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px]", only.route === r ? "bg-[#E6EAFF] text-[#4262FF]" : "hover:bg-[#F1F2F5]")}
                  >
                    <RouteIcon route={r} />
                    {r === "curve" ? "Curved" : r === "elbow" ? "Elbowed" : "Straight"}
                  </button>
                ))}
              </div>
            }
          >
            <span className="flex items-center gap-0.5">
              <RouteIcon route={only.route} />
              <ChevronDown className="h-3 w-3 text-[#656B81]" />
            </span>
          </Trigger>
          {sep}
          <Btn title="Arrow at start" active={only.arrowStart} onClick={() => onUpdate((el) => (el.kind === "connector" ? { ...el, arrowStart: !el.arrowStart } : el))}>
            <ArrowLeft className="h-4 w-4" />
          </Btn>
          <Btn title="Arrow at end" active={only.arrowEnd} onClick={() => onUpdate((el) => (el.kind === "connector" ? { ...el, arrowEnd: !el.arrowEnd } : el))}>
            <ArrowRight className="h-4 w-4" />
          </Btn>
          <Btn title="Dashed line" active={only.dashed} onClick={() => onUpdate((el) => (el.kind === "connector" ? { ...el, dashed: !el.dashed } : el))}>
            <svg width="18" height="4" viewBox="0 0 18 4">
              <path d="M1 2H17" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" strokeLinecap="round" />
            </svg>
          </Btn>
          <Btn title="Line thickness" onClick={() => onUpdate((el) => (el.kind === "connector" ? { ...el, width: el.width >= 6 ? 1 : el.width >= 4 ? 6 : el.width >= 2 ? 4 : 2 } : el))}>
            <span className="flex w-5 items-center">
              <span className="w-full rounded-full bg-current" style={{ height: Math.max(1, Math.min(6, only.width)) }} />
            </span>
          </Btn>
          {sep}
          <Trigger open={pop === "color"} onToggle={() => toggle("color")} popCls={popCls} title="Line colour" popover={<ColorGrid colors={MIRO_COLORS} value={only.stroke} onPick={(c) => onUpdate((el) => (el.kind === "connector" ? { ...el, stroke: c } : el))} />}>
            {dot(only.stroke)}
          </Trigger>
        </>
      )}
      {selected.length > 1 && (
        <Trigger
          open={pop === "align"}
          onToggle={() => toggle("align")}
          popCls={popCls}
          title="Align"
          popover={
            <div className="-m-1.5 flex w-40 flex-col">
              {(
                [
                  ["left", AlignStartVertical, "Align left"],
                  ["hcenter", AlignCenterHorizontal, "Align centres"],
                  ["right", AlignEndVertical, "Align right"],
                  ["top", AlignStartHorizontal, "Align top"],
                ] as const
              ).map(([m, Icon, label]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    onAlign(m);
                    setPop(null);
                  }}
                  className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] hover:bg-[#F1F2F5]"
                >
                  <Icon className="h-4 w-4 text-[#656B81]" />
                  {label}
                </button>
              ))}
            </div>
          }
        >
          <span className="flex items-center gap-0.5">
            <AlignStartVertical className="h-4 w-4" />
            <ChevronDown className="h-3 w-3 text-[#656B81]" />
          </span>
        </Trigger>
      )}
      {(only || selected.length > 1) && sep}
      {(grouping.canGroup || grouping.grouped) && (
        <Btn title={grouping.canGroup ? "Group (Ctrl+G)" : "Ungroup (Ctrl+Shift+G)"} onClick={grouping.canGroup ? onGroup : onUngroup}>
          {grouping.canGroup ? <Group className="h-4 w-4" /> : <Ungroup className="h-4 w-4" />}
        </Btn>
      )}
      {onEdit && (
        <Btn title={only?.kind === "connector" ? "Add or edit the line's text" : "Edit text (Enter)"} onClick={onEdit}>
          <Pencil className="h-4 w-4" />
        </Btn>
      )}
      {onConvert && (
        <button
          type="button"
          onClick={onConvert}
          title="Convert to shape (Shift+S) — becomes a shape with connection dots"
          className="wb-btn flex h-8 items-center gap-1.5 rounded-md bg-[#E6EAFF] px-2 text-[12.5px] font-medium text-[#4262FF] hover:bg-[#D9DFFF]"
        >
          <Shapes className="h-4 w-4" /> Convert to shape
        </button>
      )}
      <Btn title={locked ? "Unlock" : "Lock"} active={locked} onClick={() => onUpdate((el) => ({ ...el, locked: !locked }))}>
        {locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
      </Btn>
      <Trigger
        open={pop === "more"}
        onToggle={() => toggle("more")}
        popCls={popCls}
        title="More"
        popover={
          <div className="-m-1.5 flex w-52 flex-col text-[13px]">
            {(
              [
                [BringToFront, "Bring to front", "", onFront],
                [SendToBack, "Send to back", "", onBack],
                [Copy, "Duplicate", "Ctrl+D", onDuplicate],
                [Trash2, "Delete", "Del", onDelete],
              ] as const
            ).map(([Icon, label, hint, fn]) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  setPop(null);
                  fn();
                }}
                className={clsx(
                  "flex h-9 items-center justify-between rounded-md px-2.5 text-left",
                  label === "Delete" ? "mt-1 border-t border-[#E9EAEF] text-[#E0291B] hover:bg-[#FFEDEB]" : "hover:bg-[#F1F2F5]"
                )}
              >
                <span className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {label}
                </span>
                <span className="text-[12px] text-[#9A9DAA]">{hint}</span>
              </button>
            ))}
          </div>
        }
      >
        <Ellipsis className="h-4 w-4" />
      </Trigger>
    </div>
  );
}

function Trigger({
  open,
  onToggle,
  popCls,
  title,
  children,
  popover,
}: {
  open: boolean;
  onToggle: () => void;
  popCls: string;
  title: string;
  children: React.ReactNode;
  popover: React.ReactNode;
}) {
  return (
    <div className="relative">
      <Btn title={title} active={open} onClick={onToggle}>
        {children}
      </Btn>
      {open && <div className={popCls}>{popover}</div>}
    </div>
  );
}

function RouteIcon({ route }: { route: ConnectorEl["route"] }) {
  const d = route === "curve" ? "M2 14 C 9 14, 9 2, 16 2" : route === "elbow" ? "M2 14 H9 V2 H16" : "M2 14 L16 2";
  return (
    <svg width="18" height="16" viewBox="0 0 18 16" fill="none">
      <path d={d} stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Minimap({
  elements,
  camera,
  size,
  onJump,
}: {
  elements: El[];
  camera: Camera;
  size: { w: number; h: number };
  onJump: (x: number, y: number) => void;
}) {
  const W = 200;
  const H = 130;
  const boxes = elements.filter(isBox);
  if (!boxes.length) return null;
  const view = { x: -camera.x / camera.zoom, y: -camera.y / camera.zoom, w: size.w / camera.zoom, h: size.h / camera.zoom };
  const b = boundsOf(boxes, new Map())!;
  const all = {
    x: Math.min(b.x, view.x),
    y: Math.min(b.y, view.y),
    x2: Math.max(b.x + b.w, view.x + view.w),
    y2: Math.max(b.y + b.h, view.y + view.h),
  };
  const s = Math.min(W / (all.x2 - all.x), H / (all.y2 - all.y));
  const tx = (x: number) => (x - all.x) * s;
  const ty = (y: number) => (y - all.y) * s;
  return (
    <div
      data-ui
      className={clsx("absolute bottom-[60px] right-3 z-20 hidden overflow-hidden md:block", PANEL)}
      style={{ width: W, height: H }}
      onPointerDown={(e) => {
        const rr = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
        onJump((e.clientX - rr.left) / s + all.x, (e.clientY - rr.top) / s + all.y);
      }}
    >
      <svg width={W} height={H} className="cursor-pointer">
        {boxes.map((e) => (
          <rect
            key={e.id}
            x={tx(e.x)}
            y={ty(e.y)}
            width={Math.max(1.5, e.w * s)}
            height={Math.max(1.5, e.h * s)}
            rx={1}
            fill={e.kind === "sticky" ? e.color : e.kind === "frame" ? "#F2F2F2" : e.kind === "shape" ? e.stroke : e.kind === "card" ? e.accent : "#A5A7B5"}
            opacity={e.kind === "frame" ? 1 : 0.85}
          />
        ))}
        <rect x={tx(view.x)} y={ty(view.y)} width={view.w * s} height={view.h * s} fill="rgba(66,98,255,.08)" stroke={MIRO_BLUE} strokeWidth={1.5} rx={2} />
      </svg>
    </div>
  );
}
