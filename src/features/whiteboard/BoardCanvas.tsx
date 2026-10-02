"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AlignCenterHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  BringToFront,
  ChevronDown,
  ChevronLeft,
  Circle,
  CircleHelp,
  ClipboardPaste,
  Cloud,
  CloudOff,
  Copy,
  Crosshair,
  Diamond,
  Download,
  Ellipsis,
  Frame as FrameIcon,
  Hand,
  Hexagon,
  Loader2,
  Lock,
  Map as MapIcon,
  Maximize,
  Minus,
  MousePointer2,
  MoveUpRight,
  Pen,
  Pencil,
  Plus,
  Redo2,
  SendToBack,
  Shapes,
  Square,
  SquarePlus,
  StickyNote,
  Trash2,
  Triangle,
  Type,
  Undo2,
  Unlock,
  UserPlus,
  Waypoints,
  X,
  type LucideIcon,
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
  intersects,
  isBox,
  nearestSide,
  readableOn,
  uid,
  type BoardMeta,
  type BoxEl,
  type Camera,
  type ConnectorEl,
  type El,
  type Rect,
  type ShapeKind,
  type Side,
} from "./model";
import { useBoardRealtime, type Ops } from "./useRealtime";
import { initialsOf } from "@/components/layout/Presence";

type Tool = "select" | "hand" | "sticky" | "shape" | "text" | "frame" | "connector" | "pen";
type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

type Interaction =
  | { type: "pan"; sx: number; sy: number; cam: Camera }
  | { type: "move"; start: { x: number; y: number }; orig: Map<string, BoxEl>; ids: string[]; snapshot: El[]; lastSend: number }
  | { type: "marquee"; start: { x: number; y: number }; cur: { x: number; y: number }; additive: string[] }
  | { type: "resize"; id: string; handle: Handle; orig: BoxEl; start: { x: number; y: number }; snapshot: El[] }
  | { type: "connect"; from: { id?: string; side?: Side; x: number; y: number }; cur: { x: number; y: number } }
  | { type: "endpoint"; id: string; end: "from" | "to"; snapshot: El[] }
  | { type: "create"; tool: Tool; start: { x: number; y: number }; cur: { x: number; y: number } }
  | { type: "draw"; points: [number, number][] };

const SHAPES: { kind: ShapeKind; icon: LucideIcon; label: string }[] = [
  { kind: "rect", icon: Square, label: "Rectangle" },
  { kind: "round", icon: Square, label: "Rounded" },
  { kind: "ellipse", icon: Circle, label: "Ellipse" },
  { kind: "diamond", icon: Diamond, label: "Decision" },
  { kind: "triangle", icon: Triangle, label: "Triangle" },
  { kind: "hexagon", icon: Hexagon, label: "Hexagon" },
  { kind: "cylinder", icon: Waypoints, label: "Database" },
  { kind: "parallelogram", icon: ArrowLeftRight, label: "Input / output" },
];

type MenuAction =
  | "edit" | "label" | "duplicate" | "copy" | "connect" | "front" | "back" | "lock" | "delete"
  | "paste" | "text" | "blocks" | "selectAll" | "fit";

const HANDLES: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

// Miro look: grey canvas, floating white panels, #4262FF accent, near-black ink.
const INK = "#1A1A1A";
const PANEL = "rounded-lg bg-white shadow-[0_0_0_1px_rgba(34,36,40,.05),0_2px_8px_rgba(34,36,40,.14)]";
const POPOVER = "rounded-lg bg-white shadow-[0_0_0_1px_rgba(34,36,40,.06),0_6px_24px_rgba(34,36,40,.18)]";
const ICON_BTN = "grid h-10 w-10 place-items-center rounded-md text-[#1C1C1E] transition-colors hover:bg-[#F1F2F5]";
const ACTIVE_BTN = "bg-[#E6EAFF] text-[#4262FF] hover:bg-[#E6EAFF]";
const PEN_COLORS = ["#1A1A1A", "#F24726", "#FAC710", "#8FD14F", "#2D9BF0", "#652CB3", "#808080", "#FFFFFF"];
const PEN_WIDTHS = [2, 4, 8];
const SHORTCUTS: [string, string][] = [
  ["Select", "V"],
  ["Hand / pan", "H or hold Space"],
  ["Sticky note", "N"],
  ["Shape", "S"],
  ["Rectangle / Oval", "R / O"],
  ["Text", "T"],
  ["Connection line", "L"],
  ["Pen", "P"],
  ["Frame", "F"],
  ["More blocks", "B"],
  ["Edit selected", "Enter or type"],
  ["Duplicate", "Ctrl+D"],
  ["Copy / Paste", "Ctrl+C / Ctrl+V"],
  ["Undo / Redo", "Ctrl+Z / Ctrl+Shift+Z"],
  ["Zoom in / out", "Ctrl + / Ctrl −"],
  ["Zoom to fit", "Shift+1"],
  ["Nudge", "Arrows (Shift = 10px)"],
];
const MIN_ZOOM = 0.08;
const MAX_ZOOM = 4;

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function shapePath(kind: ShapeKind, w: number, h: number): string {
  switch (kind) {
    case "rect":
      return `M1,1 H${w - 1} V${h - 1} H1 Z`;
    case "round": {
      const r = Math.min(16, w / 4, h / 4);
      return `M${r},1 H${w - r} Q${w - 1},1 ${w - 1},${r} V${h - r} Q${w - 1},${h - 1} ${w - r},${h - 1} H${r} Q1,${h - 1} 1,${h - r} V${r} Q1,1 ${r},1 Z`;
    }
    case "ellipse":
      return `M${w / 2},1 A${w / 2 - 1},${h / 2 - 1} 0 1 1 ${w / 2 - 0.01},1 Z`;
    case "diamond":
      return `M${w / 2},1 L${w - 1},${h / 2} L${w / 2},${h - 1} L1,${h / 2} Z`;
    case "triangle":
      return `M${w / 2},1 L${w - 1},${h - 1} L1,${h - 1} Z`;
    case "hexagon": {
      const k = Math.min(w * 0.22, h / 2);
      return `M${k},1 H${w - k} L${w - 1},${h / 2} L${w - k},${h - 1} H${k} L1,${h / 2} Z`;
    }
    case "cylinder": {
      const e = Math.min(18, h / 5);
      return `M1,${e} A${w / 2 - 1},${e} 0 0 1 ${w - 1},${e} V${h - e} A${w / 2 - 1},${e} 0 0 1 1,${h - e} Z M1,${e} A${w / 2 - 1},${e} 0 0 0 ${w - 1},${e}`;
    }
    case "parallelogram": {
      const k = Math.min(w * 0.18, 40);
      return `M${k},1 H${w - 1} L${w - k},${h - 1} H1 Z`;
    }
  }
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
  const [shapeKind, setShapeKind] = useState<ShapeKind>("round");
  const [shapeMenu, setShapeMenu] = useState(false);
  const [stickyColor, setStickyColor] = useState(STICKY_COLORS[0]);
  const [penColor, setPenColor] = useState(INK);
  const [penWidth, setPenWidth] = useState(PEN_WIDTHS[0]);
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
    elRef.current = elements;
    camRef.current = camera;
    selRef.current = selection;
    interRef.current = interaction;
    openUi.current = Boolean(menu || libraryOpen || shapeMenu || helpOpen || tool !== "select");
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

  const zoomAt = useCallback((factor: number, sx?: number, sy?: number) => {
    const r = rootRef.current!.getBoundingClientRect();
    const px = sx ?? r.left + r.width / 2;
    const py = sy ?? r.top + r.height / 2;
    setCamera((c) => {
      const zoom = clamp(c.zoom * factor, MIN_ZOOM, MAX_ZOOM);
      const wx = (px - r.left - c.x) / c.zoom;
      const wy = (py - r.top - c.y) / c.zoom;
      return { zoom, x: px - r.left - wx * zoom, y: py - r.top - wy * zoom };
    });
  }, []);

  const fitTo = useCallback((els: El[]) => {
    const r = rootRef.current?.getBoundingClientRect();
    if (!r) return;
    const b = boundsOf(els, new Map(elRef.current.map((e) => [e.id, e])));
    if (!b) {
      setCamera({ x: r.width / 2, y: r.height / 2, zoom: 1 });
      return;
    }
    const pad = 120;
    const zoom = clamp(Math.min((r.width - pad) / Math.max(b.w, 1), (r.height - pad) / Math.max(b.h, 1)), MIN_ZOOM, 1.2);
    setCamera({ zoom, x: r.width / 2 - (b.x + b.w / 2) * zoom, y: r.height / 2 - (b.y + b.h / 2) * zoom });
  }, []);

  useEffect(() => {
    fitTo(initial);
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
        setCamera((c) => ({ ...c, x: c.x - e.deltaX, y: c.y - e.deltaY }));
      }
    }
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

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
        const r = size || { x: at.x - 100, y: at.y - 50, w: 200, h: 100 };
        return { id: uid(), kind: "shape", shape: shapeKind, ...r, z, text: "", fill: "#FFFFFF", stroke: INK, textColor: INK, fontSize: 16 };
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

  function duplicate(els: El[], offset = 24) {
    const map = new Map<string, string>();
    for (const e of els) map.set(e.id, uid(e.kind === "connector" ? "cx" : "el"));
    let z = maxZ();
    const clones: El[] = els.map((e) => {
      if (e.kind === "connector") {
        return {
          ...e,
          id: map.get(e.id)!,
          z: ++z,
          from: { ...e.from, id: e.from.id && map.get(e.from.id), x: e.from.x + offset, y: e.from.y + offset },
          to: { ...e.to, id: e.to.id && map.get(e.to.id), x: e.to.x + offset, y: e.to.y + offset },
        };
      }
      return { ...e, id: map.get(e.id)!, x: e.x + offset, y: e.y + offset, z: e.kind === "frame" ? e.z : ++z };
    });
    commit([...elRef.current, ...clones]);
    setSelection(clones.map((c) => c.id));
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
        clipboard.current = elRef.current.filter((x) => selRef.current.includes(x.id));
        setHasClip(clipboard.current.length > 0);
        if (clipboard.current.length) flash(`Copied ${clipboard.current.length}`);
      } else if (mod && k === "v") {
        if (clipboard.current.length) duplicate(clipboard.current, 40);
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
          escIdleRef.current?.();
          return;
        }
        setSelection([]);
        setTool("select");
        setShapeMenu(false);
        setMenu(null);
        setLibraryOpen(false);
        setHelpOpen(false);
      } else if (e.shiftKey && (k === "1" || k === "!")) {
        fitTo(elRef.current);
      } else if (mod && (k === "=" || k === "+")) {
        e.preventDefault();
        zoomAt(1.2);
      } else if (mod && k === "-") {
        e.preventDefault();
        zoomAt(1 / 1.2);
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
        const map: Record<string, Tool> = { v: "select", h: "hand", n: "sticky", s: "shape", r: "shape", t: "text", f: "frame", l: "connector", p: "pen" };
        if (map[k]) {
          setTool(map[k]);
          if (k === "r") setShapeKind("rect");
        }
        if (k === "o") {
          setTool("shape");
          setShapeKind("ellipse");
        }
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === "Space") setSpaceDown(false);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commit, fitTo, zoomAt, update]);

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
    if (e.button === 2) return;
    rootRef.current?.setPointerCapture(e.pointerId);
    const p = toWorld(e.clientX, e.clientY);

    if (e.button === 1 || spaceDown || tool === "hand") {
      setInteraction({ type: "pan", sx: e.clientX, sy: e.clientY, cam: camRef.current });
      return;
    }

    const port = target.closest("[data-port]") as HTMLElement | null;
    if (port) {
      const el = byId.get(port.dataset.owner!) as BoxEl;
      const side = port.dataset.port as Side;
      setInteraction({ type: "connect", from: { id: el.id, side, ...anchor(el, side) }, cur: p });
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
      setInteraction({ type: "create", tool, start: p, cur: p });
      return;
    }

    // select tool
    const boxHost = target.closest("[data-box]") as HTMLElement | null;
    const lineHost = target.closest("[data-line]") as HTMLElement | null;
    const hitId = boxHost?.dataset.box || lineHost?.dataset.line || null;
    if (hitId) {
      let ids = selection;
      if (e.shiftKey) {
        ids = selection.includes(hitId) ? selection.filter((i) => i !== hitId) : [...selection, hitId];
      } else if (!selection.includes(hitId)) {
        ids = [hitId];
      }
      setSelection(ids);
      const movable = ids.map((i) => byId.get(i)).filter((x): x is BoxEl => Boolean(x && isBox(x) && !x.locked));
      if (!movable.length) return;
      // Frames carry what's inside them.
      const carry = new Map<string, BoxEl>(movable.map((m) => [m.id, m]));
      for (const f of movable.filter((m) => m.kind === "frame")) {
        for (const el of elRef.current) if (isBox(el) && el.kind !== "frame" && !el.locked && contains(f, el)) carry.set(el.id, el);
      }
      setInteraction({ type: "move", start: p, orig: carry, ids: Array.from(carry.keys()), snapshot: elRef.current, lastSend: 0 });
      return;
    }
    setInteraction({ type: "marquee", start: p, cur: p, additive: e.shiftKey ? selection : [] });
    if (!e.shiftKey) setSelection([]);
  }

  function onPointerMove(e: React.PointerEvent) {
    const p = toWorld(e.clientX, e.clientY);
    rt.sendCursor(p);
    const it = interRef.current;
    if (!it) return;
    switch (it.type) {
      case "pan":
        setCamera({ ...it.cam, x: it.cam.x + e.clientX - it.sx, y: it.cam.y + e.clientY - it.sy });
        break;
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
      case "create":
        setInteraction({ ...it, cur: p });
        break;
      case "draw":
        setInteraction({ type: "draw", points: [...it.points, [p.x, p.y]] });
        break;
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    const it = interRef.current;
    setInteraction(null);
    setGuides({ v: [], h: [] });
    setConnectHover(null);
    const magnet = snapRef.current;
    snapRef.current = null;
    setSnap(null);
    if (!it) return;
    const p = toWorld(e.clientX, e.clientY);

    if (it.type === "move") {
      const movedAny = Math.abs(p.x - it.start.x) > 0.5 || Math.abs(p.y - it.start.y) > 0.5;
      if (movedAny) commit(elRef.current, { from: it.snapshot });
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
        setSelection(Array.from(new Set([...it.additive, ...hits])));
      }
    } else if (it.type === "connect") {
      const src = it.from.id ? (byId.get(it.from.id) as BoxEl | undefined) : undefined;
      const dist = Math.hypot(p.x - it.from.x, p.y - it.from.y);
      if (dist < 12 && !magnet) return;
      const additions: El[] = [];
      let toEp: ConnectorEl["to"] = { x: p.x, y: p.y };
      if (magnet) {
        toEp = { id: magnet.id, side: magnet.side, x: magnet.x, y: magnet.y };
      } else if (src && tool !== "connector") {
        // Miro-style: dragging a port into empty space creates a connected twin.
        const twin = { ...src, id: uid(), z: maxZ() + 1, x: p.x - src.w / 2, y: p.y - src.h / 2 } as BoxEl;
        if (twin.kind === "sticky" || twin.kind === "shape" || twin.kind === "text") (twin as { text: string }).text = "";
        if (twin.kind === "card") {
          twin.title = "";
          twin.body = "";
        }
        additions.push(twin);
        toEp = { id: twin.id, x: p.x, y: p.y };
        setTimeout(() => {
          setSelection([twin.id]);
          setEditingId(twin.id);
        }, 0);
      }
      const cx: ConnectorEl = {
        id: uid("cx"),
        kind: "connector",
        z: maxZ() + 1,
        from: it.from,
        to: toEp,
        route: "curve",
        stroke: INK,
        width: 2,
        arrowEnd: true,
        arrowStart: false,
      };
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
      if (it.points.length < 2) return;
      const xs = it.points.map((q) => q[0]);
      const ys = it.points.map((q) => q[1]);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      const el: El = {
        id: uid("ink"),
        kind: "draw",
        x,
        y,
        w: Math.max(...xs) - x || 1,
        h: Math.max(...ys) - y || 1,
        z: maxZ() + 1,
        points: it.points.map(([px, py]) => [Math.round((px - x) * 10) / 10, Math.round((py - y) * 10) / 10]),
        stroke: penColor,
        width: penWidth,
      };
      commit([...elRef.current, el]);
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
      case "front": {
        let z = maxZ();
        update(sel, (el) => (el.kind === "frame" ? el : { ...el, z: ++z }));
        break;
      }
      case "back":
        update(sel, (el) => (el.kind === "frame" ? el : { ...el, z: Math.max(1, minZ() + 1) }));
        break;
      case "lock": {
        const lock = !chosen.every((x) => x.locked);
        update(sel, (el) => ({ ...el, locked: lock }));
        break;
      }
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
    clipboard.current = elRef.current.filter((x) => selRef.current.includes(x.id));
    setHasClip(clipboard.current.length > 0);
    flash(`Copied ${clipboard.current.length}`);
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

  function onContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    const target = e.target as HTMLElement;
    if (target.closest("[data-ui]")) return;
    const host = (target.closest("[data-box]") || target.closest("[data-line]")) as HTMLElement | null;
    const id = host?.dataset.box || host?.dataset.line;
    if (id && !selRef.current.includes(id)) setSelection([id]);
    const r = rootRef.current!.getBoundingClientRect();
    setMenu({ x: e.clientX - r.left, y: e.clientY - r.top, world: toWorld(e.clientX, e.clientY), onElement: Boolean(id) });
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
      onPointerEnter: () => setHoverId(el.id),
      onPointerLeave: () => setHoverId((h) => (h === el.id ? null : h)),
      style: { left: el.x, top: el.y, width: el.w, height: el.h, zIndex: el.z } as React.CSSProperties,
    };
    let inner: React.ReactNode = null;
    if (el.kind === "sticky") {
      inner = (
        <div
          className="flex h-full w-full items-center justify-center p-4 text-center whitespace-pre-wrap break-words leading-snug"
          style={{
            background: el.color,
            color: readableOn(el.color),
            fontSize: stickyFont(el.text),
            boxShadow: "0 1px 2px rgba(0,0,0,.08), 0 10px 14px -10px rgba(0,0,0,.30)",
          }}
        >
          {!editing && el.text}
        </div>
      );
    } else if (el.kind === "shape") {
      inner = (
        <>
          <svg className="absolute inset-0 overflow-visible" width={el.w} height={el.h}>
            <path d={shapePath(el.shape, el.w, el.h)} fill={el.fill} stroke={el.stroke} strokeWidth={2} vectorEffect="non-scaling-stroke" />
          </svg>
          {!editing && (
            <div
              className="absolute inset-0 grid place-items-center px-4 text-center leading-snug whitespace-pre-wrap break-words"
              style={{ color: el.textColor, fontSize: el.fontSize, paddingTop: el.shape === "cylinder" ? 16 : undefined }}
            >
              {el.text}
            </div>
          )}
        </>
      );
    } else if (el.kind === "text") {
      inner = !editing ? (
        <div
          className="whitespace-pre-wrap break-words leading-tight"
          style={{ color: el.color, fontSize: el.fontSize, fontWeight: el.bold ? 600 : 400 }}
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
        {hovered && <div className="pointer-events-none absolute -inset-px rounded-[2px]" style={{ boxShadow: `0 0 0 ${1.5 / camera.zoom}px ${MIRO_BLUE}` }} />}
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
              if (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey))) (e.target as HTMLTextAreaElement).blur();
              e.stopPropagation();
            }}
            className={clsx(
              "resize-none bg-transparent outline-none caret-[#4262FF]",
              el.kind === "text" ? "absolute inset-0 p-0 leading-tight" : "max-h-full w-full overflow-hidden p-0 text-center leading-snug",
            )}
            style={{
              outline: "none",
              fontSize: el.kind === "sticky" ? stickyFont(textOf(el)) : el.kind === "shape" || el.kind === "text" ? el.fontSize : undefined,
              color: el.kind === "text" ? el.color : el.kind === "shape" ? el.textColor : el.kind === "sticky" ? readableOn(el.color) : INK,
            }}
          />
          </div>
        )}
      </div>
    );
  }

  const showPorts = (id: string) =>
    !readOnly &&
    (tool === "select" || tool === "connector") &&
    !interaction &&
    !editingId &&
    (hoverId === id || (selection.length === 1 && selection[0] === id));

  // ------------------------------------------------------------------ render
  const cursor =
    interaction?.type === "pan" ? "grabbing" : spaceDown || tool === "hand" ? "grab" : tool === "select" ? "default" : "crosshair";

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl bg-[#F2F2F2] text-[#1C1C1E] select-none">
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
        onPointerLeave={() => rt.sendCursor(null)}
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
          className="absolute left-0 top-0 origin-top-left"
          style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})` }}
        >
          {frames.map((f) => (
            <div
              key={f.id}
              data-box={f.id}
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
              <g key={d.id} transform={`translate(${d.x},${d.y})`}>
                <polyline
                  data-box={d.id}
                  points={d.points.map((q) => q.join(",")).join(" ")}
                  fill="none"
                  stroke={d.stroke}
                  strokeWidth={d.width}
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
                <g key={c.id}>
                  <path d={pth.d} data-line={c.id} fill="none" stroke="transparent" strokeWidth={14 / camera.zoom} style={{ pointerEvents: "stroke", cursor: "pointer" }} />
                  <path
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
            {interaction?.type === "connect" && (
              <path
                d={`M${interaction.from.x},${interaction.from.y} L${interaction.cur.x},${interaction.cur.y}`}
                stroke={MIRO_BLUE}
                strokeWidth={2}
                fill="none"
                vectorEffect="non-scaling-stroke"
              />
            )}
            {interaction?.type === "draw" && (
              <polyline points={interaction.points.map((q) => q.join(",")).join(" ")} fill="none" stroke={penColor} strokeWidth={penWidth} strokeLinecap="round" strokeLinejoin="round" />
            )}
          </svg>

          <div className="absolute left-0 top-0" style={{ zIndex: 2 }}>
            {boxes.map(renderBox)}
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
              <div className="absolute" style={{ left: a.x, top: a.y, width: w, height: h }}>
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
                  title="Drag to connect, or drag into empty space to add a connected copy"
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
      <div data-ui className={clsx("absolute left-3 top-3 z-20 flex h-12 items-center gap-0.5 px-1.5", PANEL)}>
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
      </div>

      {/* Top-right: collaborators + share */}
      <div data-ui className="absolute right-3 top-3 z-20 flex items-center gap-2">
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

      {/* Left: toolbar */}
      <div data-ui style={readOnly ? { display: "none" } : undefined} className="absolute left-3 top-[72px] z-20 flex flex-col gap-2">
        <div className={clsx("flex flex-col gap-0.5 p-1", PANEL)}>
          {(
            [
              ["select", MousePointer2, "Select", "V"],
              ["hand", Hand, "Hand", "H"],
              ["text", Type, "Text", "T"],
              ["sticky", StickyNote, "Sticky note", "N"],
              ["shape", Shapes, "Shapes", "S"],
              ["connector", MoveUpRight, "Connection line", "L"],
              ["pen", Pen, "Pen", "P"],
              ["frame", FrameIcon, "Frame", "F"],
            ] as [Tool, LucideIcon, string, string][]
          ).map(([t, Icon, label, key]) => {
            const flyout = (t === "sticky" && tool === "sticky") || (t === "shape" && shapeMenu) || (t === "pen" && tool === "pen");
            return (
              <div key={t} className="group relative">
                <button
                  type="button"
                  aria-label={`${label} (${key})`}
                  aria-pressed={tool === t}
                  onClick={() => {
                    setTool(t);
                    setLibraryOpen(false);
                    setShapeMenu(t === "shape" ? !shapeMenu || tool !== "shape" : false);
                  }}
                  className={clsx(ICON_BTN, tool === t && ACTIVE_BTN)}
                >
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </button>
                {!flyout && <Tip label={label} hint={key} />}
                {t === "sticky" && flyout && (
                  <div className={clsx("absolute left-[52px] top-0 w-[184px] p-3", POPOVER)}>
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
                  <div className={clsx("absolute left-[52px] top-0 w-[200px] p-3", POPOVER)}>
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
                          className={clsx("grid h-10 w-10 place-items-center rounded-md", shapeKind === sh.kind ? ACTIVE_BTN : "text-[#1C1C1E] hover:bg-[#F1F2F5]")}
                        >
                          <svg width="24" height="18" viewBox="0 0 110 80">
                            <path d={shapePath(sh.kind, 110, 80)} fill="none" stroke="currentColor" strokeWidth={7} />
                          </svg>
                        </button>
                      ))}
                    </div>
                    <p className="mt-3 text-[12px] text-[#9A9DAA]">Click to place, or drag to size</p>
                  </div>
                )}
                {t === "pen" && flyout && (
                  <div className={clsx("absolute left-[52px] top-0 w-[184px] p-3", POPOVER)}>
                    <p className="mb-2 text-[12px] font-semibold text-[#656B81]">Pen</p>
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
                          <span className="w-8 rounded-full" style={{ height: w, background: penColor === "#FFFFFF" ? "#C3C6D4" : penColor }} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <span className="mx-2 my-0.5 h-px bg-[#E9EAEF]" />
          <div className="group relative">
            <button
              type="button"
              aria-label="More blocks (B)"
              aria-pressed={libraryOpen}
              onClick={() => {
                setLibraryOpen((v) => !v);
                setShapeMenu(false);
              }}
              className={clsx(ICON_BTN, libraryOpen && ACTIVE_BTN)}
            >
              <SquarePlus className="h-5 w-5" strokeWidth={1.75} />
            </button>
            {!libraryOpen && <Tip label="More blocks" hint="B" />}
          </div>
        </div>
        <div className={clsx("flex flex-col gap-0.5 p-1", PANEL)}>
          <div className="group relative">
            <button type="button" aria-label="Undo" onClick={undo} className={ICON_BTN}>
              <Undo2 className="h-5 w-5" strokeWidth={1.75} />
            </button>
            <Tip label="Undo" hint="Ctrl+Z" />
          </div>
          <div className="group relative">
            <button type="button" aria-label="Redo" onClick={redo} className={ICON_BTN}>
              <Redo2 className="h-5 w-5" strokeWidth={1.75} />
            </button>
            <Tip label="Redo" hint="Ctrl+Shift+Z" />
          </div>
        </div>
      </div>

      {/* Block library */}
      {libraryOpen && (
        <div
          data-ui
          data-scrollable
          className={clsx("absolute left-[68px] top-[72px] z-20 max-h-[calc(100%-96px)] w-72 overflow-y-auto p-3", POPOVER)}
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
                      const w = sh.kind === "diamond" ? 180 : 200;
                      const h = sh.kind === "diamond" || sh.kind === "cylinder" ? 120 : 100;
                      const el: BoxEl = { id: uid(), kind: "shape", shape: sh.kind, x: menu.world.x - w / 2, y: menu.world.y - h / 2, w, h, z, text: "", fill: "#FFFFFF", stroke: INK, textColor: INK, fontSize: 16 };
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
                ["connect", "Connect from here", "L"],
                ["front", "Bring to front", ""],
                ["back", "Send to back", ""],
                ["lock", selected.every((x) => x.locked) ? "Unlock" : "Lock", ""],
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
          selected={selected}
          onUpdate={(fn) => update(selection, fn)}
          onFront={() => {
            let z = maxZ();
            update(selection, (el) => (el.kind === "frame" ? el : { ...el, z: ++z }));
          }}
          onBack={() => {
            let z = minZ();
            update(selection, (el) => (el.kind === "frame" ? { ...el, z: --z } : { ...el, z: Math.max(1, minZ() + 1) }));
          }}
          onDuplicate={() => duplicate(selected)}
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
        setCamera((c) => ({ ...c, x: view.w / 2 - x * c.zoom, y: view.h / 2 - y * c.zoom }));
      }} />}
      <div data-ui className="absolute bottom-3 right-3 z-20 flex items-center gap-2">
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
              setCamera((c) => ({ ...c, x: r.width / 2 - (b.x + b.w / 2) * c.zoom, y: r.height / 2 - (b.y + b.h / 2) * c.zoom }));
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
          <button type="button" onClick={() => zoomAt(1 / 1.2)} className={clsx(ICON_BTN, "h-8 w-8")} title="Zoom out (Ctrl −)" aria-label="Zoom out">
            <Minus className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </button>
          <button type="button" onClick={() => setCamera((c) => ({ ...c, zoom: 1 }))} className="h-8 w-12 rounded-md text-center text-[13px] tabular-nums text-[#1C1C1E] hover:bg-[#F1F2F5]" title="Reset to 100%">
            {Math.round(camera.zoom * 100)}%
          </button>
          <button type="button" onClick={() => zoomAt(1.2)} className={clsx(ICON_BTN, "h-8 w-8")} title="Zoom in (Ctrl +)" aria-label="Zoom in">
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
function Tip({ label, hint }: { label: string; hint?: string }) {
  return (
    <span className="pointer-events-none absolute left-[52px] top-1/2 z-30 hidden -translate-y-1/2 items-center gap-2 whitespace-nowrap rounded-md bg-[#1C1C1E] px-2 py-1.5 text-[12px] font-medium text-white shadow-lg group-hover:flex">
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
  selected,
  onUpdate,
  onFront,
  onBack,
  onDuplicate,
  onDelete,
  onAlign,
  onEdit,
}: {
  x: number;
  y: number;
  below: number;
  containerW: number;
  containerH: number;
  selected: El[];
  onUpdate: (fn: (el: El) => El) => void;
  onFront: () => void;
  onBack: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onAlign: (m: "left" | "hcenter" | "top" | "right") => void;
  onEdit?: () => void;
}) {
  type Pop = "color" | "stroke" | "textColor" | "shape" | "size" | "route" | "align" | "more";
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
  const SAFE_TOP = 72;
  let top = y - GAP - BAR_H;
  if (top < SAFE_TOP) top = below + GAP;
  if (top + BAR_H > containerH - 60) top = SAFE_TOP;
  const left = clamp(x - w / 2, 64, Math.max(64, containerW - w - 12));
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

  return (
    <div
      ref={ref}
      data-ui
      className={clsx("absolute z-30 flex h-11 items-center gap-0.5 px-1.5", PANEL)}
      style={{ left, top, visibility: w ? "visible" : "hidden" }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {only?.kind === "sticky" && (
        <Trigger open={pop === "color"} onToggle={() => toggle("color")} popCls={popCls} title="Sticky colour" popover={<ColorGrid square colors={STICKY_COLORS} value={only.color} onPick={(c) => onUpdate((el) => (el.kind === "sticky" ? { ...el, color: c } : el))} />}>
          <span className="block h-5 w-5 rounded-[2px] shadow-[0_1px_2px_rgba(0,0,0,.25)]" style={{ background: only.color }} />
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
          {only?.kind === "text" && (
            <Btn title="Bold" active={only.bold} onClick={() => onUpdate((el) => (el.kind === "text" ? { ...el, bold: !el.bold } : el))}>
              <span className="text-[15px] font-bold">B</span>
            </Btn>
          )}
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
      {onEdit && (
        <Btn title={only?.kind === "connector" ? "Add or edit the line's text" : "Edit text (Enter)"} onClick={onEdit}>
          <Pencil className="h-4 w-4" />
        </Btn>
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
