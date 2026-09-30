"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlignCenterHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  BringToFront,
  Circle,
  Copy,
  Diamond,
  Download,
  Frame as FrameIcon,
  Hand,
  Hexagon,
  Link2,
  Lock,
  Maximize,
  Minus,
  MousePointer2,
  PenLine,
  Plus,
  Redo2,
  SendToBack,
  Spline,
  Square,
  StickyNote,
  Trash2,
  Triangle,
  Type,
  Undo2,
  Unlock,
  Waypoints,
  type LucideIcon,
} from "lucide-react";
import { clsx } from "clsx";
import {
  FILL_COLORS,
  INK_COLORS,
  STICKY_COLORS,
  anchor,
  boundsOf,
  connectorPath,
  contains,
  intersects,
  isBox,
  nearestSide,
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

const HANDLES: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
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
}: {
  meta: BoardMeta;
  initial: El[];
  onBack: () => void;
  onMetaChange: (m: BoardMeta) => void;
}) {
  const [elements, setElements] = useState<El[]>(initial);
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 1 });
  const [selection, setSelection] = useState<string[]>([]);
  const [tool, setTool] = useState<Tool>("select");
  const [shapeKind, setShapeKind] = useState<ShapeKind>("round");
  const [shapeMenu, setShapeMenu] = useState(false);
  const [stickyColor, setStickyColor] = useState(STICKY_COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [interaction, setInteraction] = useState<Interaction | null>(null);
  const [guides, setGuides] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] });
  const [spaceDown, setSpaceDown] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [name, setName] = useState(meta.name);
  const [toast, setToast] = useState<string | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const elRef = useRef(elements);
  const camRef = useRef(camera);
  const selRef = useRef(selection);
  const past = useRef<El[][]>([]);
  const future = useRef<El[][]>([]);
  const clipboard = useRef<El[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interRef = useRef<Interaction | null>(null);

  elRef.current = elements;
  camRef.current = camera;
  selRef.current = selection;
  interRef.current = interaction;

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
    saveTimer.current = setTimeout(() => void save(elRef.current), 900);
  }, [save]);

  useEffect(() => {
    const flush = () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        const body = JSON.stringify({
          board: { id: meta.id, name, folder_id: meta.folder_id, folder_name: meta.folder_name, description: meta.description, nodes: elRef.current },
        });
        navigator.sendBeacon?.("/api/whiteboard", new Blob([body], { type: "application/json" }));
      }
    };
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      flush();
    };
  }, [meta, name]);

  // ------------------------------------------------------------------- commit
  /** Apply a new element list: history, broadcast diff, autosave. */
  const commit = useCallback(
    (next: El[], opts: { from?: El[]; history?: boolean } = {}) => {
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
    },
    [rt, scheduleSave]
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
        return { id: uid(), kind: "shape", shape: shapeKind, ...r, z, text: "", fill: "#FFFFFF", stroke: "#1F5FD6", textColor: "#0E1B2E", fontSize: 16 };
      }
      case "text":
        return { id: uid(), kind: "text", x: at.x, y: at.y - 16, w: 260, h: 40, z, text: "", color: "#0E1B2E", fontSize: 22 };
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
        setSelection([]);
        setTool("select");
        setShapeMenu(false);
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
      } else if (k === "enter" && selRef.current.length === 1) {
        const el = elRef.current.find((x) => x.id === selRef.current[0]);
        if (el && isBox(el) && el.kind !== "draw" && !el.locked) {
          e.preventDefault();
          setEditingId(el.id);
        }
      } else if (!mod) {
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

  function onPointerDown(e: React.PointerEvent) {
    if (editingId) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-ui]")) return;
    setShapeMenu(false);
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
        const now = performance.now();
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
        const next = elRef.current.map((el) =>
          el.id === it.id && el.kind === "connector" ? { ...el, [it.end]: { x: p.x, y: p.y } } : el
        );
        elRef.current = next;
        setElements(next);
        break;
      }
      case "connect":
        setInteraction({ ...it, cur: p });
        break;
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
    if (!it) return;
    const p = toWorld(e.clientX, e.clientY);

    if (it.type === "move") {
      const movedAny = Math.abs(p.x - it.start.x) > 0.5 || Math.abs(p.y - it.start.y) > 0.5;
      if (movedAny) commit(elRef.current, { from: it.snapshot });
    } else if (it.type === "resize") {
      commit(elRef.current, { from: it.snapshot });
    } else if (it.type === "endpoint") {
      const hit = hitBoxAt(e.clientX, e.clientY);
      const next = elRef.current.map((el) =>
        el.id === it.id && el.kind === "connector"
          ? { ...el, [it.end]: hit ? { id: hit.id, side: nearestSide(hit, p), x: p.x, y: p.y } : { x: p.x, y: p.y } }
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
      const hit = hitBoxAt(e.clientX, e.clientY, src ? new Set([src.id]) : undefined);
      const dist = Math.hypot(p.x - it.from.x, p.y - it.from.y);
      if (dist < 12 && !hit) return;
      const additions: El[] = [];
      let toEp: ConnectorEl["to"] = { x: p.x, y: p.y };
      if (hit) {
        toEp = { id: hit.id, side: nearestSide(hit, it.from), x: p.x, y: p.y };
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
        stroke: "#4A5668",
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
        stroke: "#0E1B2E",
        width: 3,
      };
      commit([...elRef.current, el]);
    }
  }

  function onDoubleClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.closest("[data-ui]")) return;
    const host = target.closest("[data-box]") as HTMLElement | null;
    if (host) {
      const el = byId.get(host.dataset.box!);
      if (el && isBox(el) && el.kind !== "draw" && !el.locked) setEditingId(el.id);
      return;
    }
    const line = target.closest("[data-line]") as HTMLElement | null;
    if (line) {
      const cx = byId.get(line.dataset.line!) as ConnectorEl;
      const label = window.prompt("Label for this connector", cx.label || "");
      if (label !== null) update([cx.id], (x) => ({ ...(x as ConnectorEl), label: label || undefined }));
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
          className="h-full w-full p-4 text-slate-900 whitespace-pre-wrap break-words leading-snug"
          style={{
            background: el.color,
            fontSize: stickyFont(el.text),
            boxShadow: "0 1px 1px rgba(14,27,46,.06), 0 8px 18px -8px rgba(14,27,46,.28)",
          }}
        >
          {!editing && (el.text || <span className="text-slate-500/60">Type something</span>)}
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
    return (
      <div key={el.id} {...common} className={clsx("absolute", el.kind === "sticky" && "rounded-[3px]", isSel && "cursor-move")}>
        {inner}
        {editing && (
          <textarea
            autoFocus
            defaultValue={textOf(el)}
            onPointerDown={(e) => e.stopPropagation()}
            onBlur={(e) => {
              const v = e.target.value;
              setEditingId(null);
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
              "absolute inset-0 resize-none bg-transparent outline-none p-4 leading-snug",
              el.kind === "shape" && "text-center pt-[30%]",
              el.kind === "text" && "p-0 leading-tight",
              el.kind === "card" && "bg-white rounded-xl p-3 pt-4 text-[14px]"
            )}
            style={{
              fontSize: el.kind === "sticky" ? stickyFont(textOf(el)) : el.kind === "shape" || el.kind === "text" ? el.fontSize : undefined,
              color: el.kind === "text" ? el.color : el.kind === "shape" ? el.textColor : "#0E1B2E",
            }}
            placeholder="Type…"
          />
        )}
      </div>
    );
  }

  const showPorts = (id: string) =>
    (tool === "select" || tool === "connector") &&
    !interaction &&
    !editingId &&
    (hoverId === id || (selection.length === 1 && selection[0] === id));

  // ------------------------------------------------------------------ render
  const cursor =
    interaction?.type === "pan" ? "grabbing" : spaceDown || tool === "hand" ? "grab" : tool === "select" ? "default" : "crosshair";

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl bg-[#F7F8FA] ring-1 ring-slate-200/80 select-none">
      <div
        ref={rootRef}
        className="absolute inset-0 touch-none"
        style={{
          cursor,
          backgroundImage: `radial-gradient(circle, rgba(14,27,46,.16) ${Math.max(0.8, camera.zoom)}px, transparent ${Math.max(0.8, camera.zoom) + 0.4}px)`,
          backgroundSize: `${gridSize}px ${gridSize}px`,
          backgroundPosition: `${camera.x}px ${camera.y}px`,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => rt.sendCursor(null)}
        onDoubleClick={onDoubleClick}
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
              className="absolute rounded-md"
              style={{ left: f.x, top: f.y, width: f.w, height: f.h, background: f.fill, boxShadow: "0 0 0 1px rgba(14,27,46,.12), 0 6px 24px -16px rgba(14,27,46,.4)" }}
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
                  className="absolute left-0 -top-8 bg-white px-1 text-slate-700 outline-none ring-1 ring-blue-400 rounded"
                  style={{ fontSize: 14 / Math.max(camera.zoom, 0.4) }}
                />
              ) : (
                <span
                  className="absolute left-0 -top-7 whitespace-nowrap font-medium text-slate-600"
                  style={{ fontSize: 14 / Math.max(camera.zoom, 0.4), transformOrigin: "bottom left" }}
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
                {selection.includes(d.id) && <rect x={-4} y={-4} width={d.w + 8} height={d.h + 8} fill="none" stroke="#1F5FD6" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />}
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
                    stroke={sel ? "#1F5FD6" : c.stroke}
                    strokeWidth={c.width}
                    strokeDasharray={c.dashed ? "7 6" : undefined}
                    markerEnd={c.arrowEnd ? `url(#ah-${c.id})` : undefined}
                    markerStart={c.arrowStart ? `url(#ah-${c.id})` : undefined}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ pointerEvents: "none" }}
                  />
                  {c.label && (
                    <foreignObject x={pth.mid.x - 80} y={pth.mid.y - 14} width={160} height={28} style={{ overflow: "visible", pointerEvents: "none" }}>
                      <div className="flex justify-center">
                        <span className="rounded-md bg-white px-2 py-0.5 text-[12px] text-slate-700 ring-1 ring-slate-200">{c.label}</span>
                      </div>
                    </foreignObject>
                  )}
                </g>
              );
            })}
            {interaction?.type === "connect" && (
              <path
                d={`M${interaction.from.x},${interaction.from.y} L${interaction.cur.x},${interaction.cur.y}`}
                stroke="#1F5FD6"
                strokeWidth={2}
                strokeDasharray="6 5"
                fill="none"
                vectorEffect="non-scaling-stroke"
              />
            )}
            {interaction?.type === "draw" && (
              <polyline points={interaction.points.map((q) => q.join(",")).join(" ")} fill="none" stroke="#0E1B2E" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
            )}
          </svg>

          <div className="absolute left-0 top-0" style={{ zIndex: 2 }}>
            {boxes.map(renderBox)}
          </div>
        </div>

        {/* Screen-space overlays */}
        <div className="pointer-events-none absolute inset-0" style={{ zIndex: 5 }}>
          {/* remote selections */}
          {rt.peers.map((peer) =>
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
            <div key={`v${gx}`} className="absolute top-0 bottom-0 w-px bg-coral" style={{ left: toScreen(gx, 0).x }} />
          ))}
          {guides.h.map((gy) => (
            <div key={`h${gy}`} className="absolute left-0 right-0 h-px bg-coral" style={{ top: toScreen(0, gy).y }} />
          ))}

          {/* marquee / create preview */}
          {(interaction?.type === "marquee" || (interaction?.type === "create" && (interaction.tool === "shape" || interaction.tool === "frame"))) &&
            (() => {
              const a = toScreen(Math.min(interaction.start.x, interaction.cur.x), Math.min(interaction.start.y, interaction.cur.y));
              const w = Math.abs(interaction.cur.x - interaction.start.x) * camera.zoom;
              const h = Math.abs(interaction.cur.y - interaction.start.y) * camera.zoom;
              return <div className="absolute rounded-sm border border-blue-500 bg-blue-500/10" style={{ left: a.x, top: a.y, width: w, height: h }} />;
            })()}

          {/* selection box */}
          {selBounds && !editingId && interaction?.type !== "marquee" && !(single && single.kind === "connector") && (() => {
            const a = toScreen(selBounds.x, selBounds.y);
            const w = selBounds.w * camera.zoom;
            const h = selBounds.h * camera.zoom;
            const canResize = single && isBox(single) && single.kind !== "draw" && !single.locked;
            return (
              <div className="absolute" style={{ left: a.x, top: a.y, width: w, height: h }}>
                <div className="absolute -inset-[2px] rounded-[3px] ring-2 ring-blue-500" />
                {canResize &&
                  HANDLES.map((hd) => {
                    const pos: React.CSSProperties = {
                      left: hd.includes("w") ? -6 : hd.includes("e") ? w - 6 : w / 2 - 6,
                      top: hd.includes("n") ? -6 : hd.includes("s") ? h - 6 : h / 2 - 6,
                      cursor: `${hd}-resize`,
                    };
                    return <div key={hd} data-handle={hd} className="pointer-events-auto absolute h-3 w-3 rounded-full border-2 border-blue-500 bg-white" style={pos} />;
                  })}
                {single && isBox(single) && single.locked && (
                  <Lock className="absolute -right-6 -top-6 h-4 w-4 text-slate-500" />
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
                    className="pointer-events-auto absolute h-3.5 w-3.5 cursor-move rounded-full border-2 border-blue-500 bg-white"
                    style={{ left: pt.x - 7, top: pt.y - 7 }}
                  />
                );
              });
            })()}

          {/* connection ports */}
          {elements.filter((e): e is BoxEl => isBox(e) && e.kind !== "draw" && e.kind !== "frame" && showPorts(e.id)).map((el) =>
            (["top", "right", "bottom", "left"] as Side[]).map((side) => {
              const a = anchor(el, side);
              const s = toScreen(a.x, a.y);
              const off = 14;
              const d = { top: [0, -off], right: [off, 0], bottom: [0, off], left: [-off, 0] }[side];
              return (
                <div
                  key={el.id + side}
                  data-port={side}
                  data-owner={el.id}
                  onPointerEnter={() => setHoverId(el.id)}
                  title="Drag to connect"
                  className="pointer-events-auto absolute grid h-5 w-5 cursor-crosshair place-items-center rounded-full bg-white shadow ring-1 ring-blue-300 hover:scale-125 transition-transform"
                  style={{ left: s.x + d[0] - 10, top: s.y + d[1] - 10 }}
                >
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                </div>
              );
            })
          )}

          {/* remote cursors */}
          {rt.peers
            .filter((p) => p.cursor)
            .map((peer) => {
              const s = toScreen(peer.cursor!.x, peer.cursor!.y);
              return (
                <div key={peer.key} className="absolute transition-transform duration-75 ease-linear" style={{ transform: `translate(${s.x}px, ${s.y}px)` }}>
                  <svg width="18" height="22" viewBox="0 0 18 22" className="-ml-0.5 -mt-0.5 drop-shadow">
                    <path d="M1 1 L1 17 L5.5 13 L8.5 20 L11.5 18.6 L8.6 12 L15 12 Z" fill={peer.color} stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
                  </svg>
                  <span className="ml-3 -mt-1 block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium text-white" style={{ background: peer.color }}>
                    {peer.name.split(/\s+/)[0]}
                  </span>
                </div>
              );
            })}
        </div>
      </div>

      {/* ---------------- Floating UI ---------------- */}
      {/* Top-left: board identity */}
      <div data-ui className="absolute left-3 top-3 z-20 flex items-center gap-1 rounded-xl bg-white p-1 shadow-md ring-1 ring-slate-200/80">
        <button type="button" onClick={onBack} className="grid h-9 w-9 place-items-center rounded-lg text-slate-600 hover:bg-slate-100" title="All boards" aria-label="All boards">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            if (name.trim() && name !== meta.name) {
              onMetaChange({ ...meta, name });
              void save(elRef.current, name);
            }
          }}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className="w-[min(40vw,280px)] rounded-lg px-2 py-1.5 text-[15px] font-medium text-slate-900 outline-none hover:bg-slate-50 focus:bg-slate-50"
          aria-label="Board name"
        />
        <span className="px-2 text-xs text-slate-400 whitespace-nowrap">
          {saveState === "saving" ? "Saving…" : saveState === "error" ? "Not saved — retrying on next change" : "Saved"}
        </span>
      </div>

      {/* Top-right: people + share */}
      <div data-ui className="absolute right-3 top-3 z-20 flex items-center gap-2 rounded-xl bg-white p-1 pl-3 shadow-md ring-1 ring-slate-200/80">
        <div className="flex -space-x-2">
          {rt.me && (
            <span title={`${rt.me.name} (you)`} className="grid h-8 w-8 place-items-center rounded-full text-[11px] font-semibold text-white ring-2 ring-white" style={{ background: rt.me.color }}>
              {initialsOf(rt.me.name)}
            </span>
          )}
          {rt.peers.map((p) => (
            <span key={p.key} title={p.name} className="grid h-8 w-8 place-items-center rounded-full text-[11px] font-semibold text-white ring-2 ring-white" style={{ background: p.color }}>
              {initialsOf(p.name)}
            </span>
          ))}
        </div>
        <span className={clsx("h-2 w-2 rounded-full", rt.connected ? "bg-teal-live presence-dot" : "bg-slate-300")} title={rt.connected ? "Live" : "Connecting"} />
        <button type="button" onClick={exportJson} className="grid h-9 w-9 place-items-center rounded-lg text-slate-600 hover:bg-slate-100" title="Download board (.json)" aria-label="Download board">
          <Download className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(`${window.location.origin}/whiteboard?boardId=${meta.id}`);
            flash("Link copied — anyone on the team can open it");
          }}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Link2 className="h-4 w-4" />
          Share
        </button>
      </div>

      {/* Left: tool rail */}
      <div data-ui className="absolute left-3 top-1/2 z-20 -translate-y-1/2 flex flex-col gap-0.5 rounded-xl bg-white p-1 shadow-md ring-1 ring-slate-200/80">
        {(
          [
            ["select", MousePointer2, "Select (V)"],
            ["hand", Hand, "Pan (H or hold Space)"],
            ["sticky", StickyNote, "Sticky note (N)"],
            ["shape", Square, "Shape (S)"],
            ["text", Type, "Text (T)"],
            ["connector", Spline, "Connector (L)"],
            ["pen", PenLine, "Pen (P)"],
            ["frame", FrameIcon, "Frame (F)"],
          ] as [Tool, LucideIcon, string][]
        ).map(([t, Icon, label]) => (
          <div key={t} className="relative">
            <button
              type="button"
              title={label}
              aria-label={label}
              aria-pressed={tool === t}
              onClick={() => {
                setTool(t);
                setShapeMenu(t === "shape" ? !shapeMenu : false);
              }}
              className={clsx(
                "grid h-10 w-10 place-items-center rounded-lg transition",
                tool === t ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100"
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
            </button>
            {t === "sticky" && tool === "sticky" && (
              <div className="absolute left-12 top-0 flex gap-1 rounded-xl bg-white p-1.5 shadow-md ring-1 ring-slate-200">
                {STICKY_COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setStickyColor(c)} className={clsx("h-6 w-6 rounded ring-1 ring-black/10", stickyColor === c && "ring-2 ring-blue-500")} style={{ background: c }} aria-label="Sticky colour" />
                ))}
              </div>
            )}
            {t === "shape" && shapeMenu && (
              <div className="absolute left-12 top-0 grid grid-cols-4 gap-1 rounded-xl bg-white p-1.5 shadow-md ring-1 ring-slate-200">
                {SHAPES.map((s) => (
                  <button
                    key={s.kind}
                    type="button"
                    title={s.label}
                    onClick={() => {
                      setShapeKind(s.kind);
                      setTool("shape");
                      setShapeMenu(false);
                    }}
                    className={clsx("grid h-9 w-9 place-items-center rounded-lg", shapeKind === s.kind ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100")}
                  >
                    <s.icon className={clsx("h-4 w-4", s.kind === "round" && "rounded")} />
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        <div className="my-1 h-px bg-slate-100" />
        <button type="button" title="Undo (Ctrl+Z)" aria-label="Undo" onClick={undo} className="grid h-10 w-10 place-items-center rounded-lg text-slate-600 hover:bg-slate-100">
          <Undo2 className="h-[18px] w-[18px]" />
        </button>
        <button type="button" title="Redo (Ctrl+Shift+Z)" aria-label="Redo" onClick={redo} className="grid h-10 w-10 place-items-center rounded-lg text-slate-600 hover:bg-slate-100">
          <Redo2 className="h-[18px] w-[18px]" />
        </button>
      </div>

      {/* Contextual toolbar */}
      {selBounds && !interaction && !editingId && (
        <ContextBar
          x={clamp(toScreen(selBounds.x + selBounds.w / 2, 0).x, 180, (rootRef.current?.clientWidth || 800) - 180)}
          y={Math.max(64, toScreen(0, selBounds.y).y - 56)}
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
          onDelete={deleteSelection}
          onAlign={align}
        />
      )}

      {/* Bottom-right: minimap + zoom */}
      <Minimap elements={elements} camera={camera} rootRef={rootRef} onJump={(x, y) => {
        const r = rootRef.current!.getBoundingClientRect();
        setCamera((c) => ({ ...c, x: r.width / 2 - x * c.zoom, y: r.height / 2 - y * c.zoom }));
      }} />
      <div data-ui className="absolute bottom-3 right-3 z-20 flex items-center gap-0.5 rounded-xl bg-white p-1 shadow-md ring-1 ring-slate-200/80">
        <button type="button" onClick={() => zoomAt(1 / 1.2)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-600 hover:bg-slate-100" aria-label="Zoom out">
          <Minus className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => setCamera((c) => ({ ...c, zoom: 1 }))} className="w-14 rounded-lg py-1.5 text-center text-xs tabular-nums text-slate-700 hover:bg-slate-100" title="Reset to 100%">
          {Math.round(camera.zoom * 100)}%
        </button>
        <button type="button" onClick={() => zoomAt(1.2)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-600 hover:bg-slate-100" aria-label="Zoom in">
          <Plus className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => fitTo(elements)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-600 hover:bg-slate-100" title="Fit everything (Shift+1)" aria-label="Fit to content">
          <Maximize className="h-4 w-4" />
        </button>
      </div>

      {/* Empty state */}
      {elements.length === 0 && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="text-center">
            <p className="text-lg font-medium text-slate-700">Double-click anywhere to add a sticky note</p>
            <p className="mt-1 text-sm text-slate-500">Or pick a tool on the left. Drag the blue dots on any shape to connect it.</p>
          </div>
        </div>
      )}

      {toast && (
        <div className="absolute bottom-16 left-1/2 z-30 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-sm text-white shadow-lg">{toast}</div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
function Swatches({ colors, value, onPick, round }: { colors: string[]; value?: string; onPick: (c: string) => void; round?: boolean }) {
  return (
    <div className="flex gap-1">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onPick(c)}
          aria-label={`Colour ${c}`}
          className={clsx("h-6 w-6 ring-1 ring-black/10", round ? "rounded-full" : "rounded-md", value?.toLowerCase() === c.toLowerCase() && "ring-2 ring-blue-500 ring-offset-1")}
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
      className={clsx("grid h-8 min-w-8 place-items-center rounded-lg px-1.5 text-slate-600", active ? "bg-blue-50 text-blue-700" : "hover:bg-slate-100")}
    >
      {children}
    </button>
  );
}

function ContextBar({
  x,
  y,
  selected,
  onUpdate,
  onFront,
  onBack,
  onDuplicate,
  onDelete,
  onAlign,
}: {
  x: number;
  y: number;
  selected: El[];
  onUpdate: (fn: (el: El) => El) => void;
  onFront: () => void;
  onBack: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onAlign: (m: "left" | "hcenter" | "top" | "right") => void;
}) {
  const kinds = new Set(selected.map((s) => s.kind));
  const only = kinds.size === 1 ? selected[0] : null;
  const locked = selected.every((s) => s.locked);
  const sep = <span className="mx-1 h-5 w-px bg-slate-200" />;

  return (
    <div
      data-ui
      className="absolute z-30 flex -translate-x-1/2 items-center gap-0.5 rounded-xl bg-white p-1 shadow-lg ring-1 ring-slate-200"
      style={{ left: x, top: y }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {only?.kind === "sticky" && <Swatches colors={STICKY_COLORS} value={only.color} onPick={(c) => onUpdate((el) => (el.kind === "sticky" ? { ...el, color: c } : el))} />}
      {only?.kind === "shape" && (
        <>
          <select
            value={only.shape}
            onChange={(e) => onUpdate((el) => (el.kind === "shape" ? { ...el, shape: e.target.value as ShapeKind } : el))}
            className="h-8 rounded-lg border border-slate-200 bg-white px-1.5 text-xs"
            aria-label="Shape"
          >
            {SHAPES.map((s) => (
              <option key={s.kind} value={s.kind}>
                {s.label}
              </option>
            ))}
          </select>
          {sep}
          <Swatches colors={FILL_COLORS} value={only.fill} onPick={(c) => onUpdate((el) => (el.kind === "shape" ? { ...el, fill: c, textColor: c === "#0E1B2E" ? "#FFFFFF" : el.textColor } : el))} />
          {sep}
          <Swatches round colors={INK_COLORS.slice(0, 6)} value={only.stroke} onPick={(c) => onUpdate((el) => (el.kind === "shape" ? { ...el, stroke: c } : el))} />
          {sep}
          <Btn title="Smaller text" onClick={() => onUpdate((el) => (el.kind === "shape" ? { ...el, fontSize: Math.max(10, el.fontSize - 2) } : el))}>A−</Btn>
          <Btn title="Larger text" onClick={() => onUpdate((el) => (el.kind === "shape" ? { ...el, fontSize: Math.min(64, el.fontSize + 2) } : el))}>A+</Btn>
        </>
      )}
      {only?.kind === "text" && (
        <>
          <Swatches round colors={INK_COLORS.slice(0, 7)} value={only.color} onPick={(c) => onUpdate((el) => (el.kind === "text" ? { ...el, color: c } : el))} />
          {sep}
          <Btn title="Bold" active={only.bold} onClick={() => onUpdate((el) => (el.kind === "text" ? { ...el, bold: !el.bold } : el))}>
            <span className="font-bold">B</span>
          </Btn>
          <Btn title="Smaller" onClick={() => onUpdate((el) => (el.kind === "text" ? { ...el, fontSize: Math.max(10, el.fontSize - 2) } : el))}>A−</Btn>
          <Btn title="Larger" onClick={() => onUpdate((el) => (el.kind === "text" ? { ...el, fontSize: Math.min(120, el.fontSize + 4) } : el))}>A+</Btn>
        </>
      )}
      {only?.kind === "card" && <Swatches round colors={INK_COLORS.slice(0, 6)} value={only.accent} onPick={(c) => onUpdate((el) => (el.kind === "card" ? { ...el, accent: c } : el))} />}
      {only?.kind === "frame" && <Swatches colors={["#FFFFFF", "#F2F6FE", "#F1FBF8", "#FFF6F2", "#FBF6E6", "#F5F7FA"]} value={only.fill} onPick={(c) => onUpdate((el) => (el.kind === "frame" ? { ...el, fill: c } : el))} />}
      {only?.kind === "draw" && <Swatches round colors={INK_COLORS.slice(0, 7)} value={only.stroke} onPick={(c) => onUpdate((el) => (el.kind === "draw" ? { ...el, stroke: c } : el))} />}
      {only?.kind === "connector" && (
        <>
          {(["curve", "elbow", "straight"] as const).map((r) => (
            <Btn key={r} title={`${r[0].toUpperCase()}${r.slice(1)} line`} active={only.route === r} onClick={() => onUpdate((el) => (el.kind === "connector" ? { ...el, route: r } : el))}>
              <span className="text-xs">{r === "curve" ? "Curved" : r === "elbow" ? "Elbow" : "Straight"}</span>
            </Btn>
          ))}
          {sep}
          <Btn title="Arrow at start" active={only.arrowStart} onClick={() => onUpdate((el) => (el.kind === "connector" ? { ...el, arrowStart: !el.arrowStart } : el))}>
            <ArrowLeft className="h-4 w-4" />
          </Btn>
          <Btn title="Arrow at end" active={only.arrowEnd} onClick={() => onUpdate((el) => (el.kind === "connector" ? { ...el, arrowEnd: !el.arrowEnd } : el))}>
            <ArrowRight className="h-4 w-4" />
          </Btn>
          <Btn title="Dashed" active={only.dashed} onClick={() => onUpdate((el) => (el.kind === "connector" ? { ...el, dashed: !el.dashed } : el))}>
            <span className="text-xs tracking-widest">- -</span>
          </Btn>
          {sep}
          <Swatches round colors={INK_COLORS.slice(0, 6)} value={only.stroke} onPick={(c) => onUpdate((el) => (el.kind === "connector" ? { ...el, stroke: c } : el))} />
        </>
      )}
      {selected.length > 1 && (
        <>
          <Btn title="Align left" onClick={() => onAlign("left")}>
            <AlignStartVertical className="h-4 w-4" />
          </Btn>
          <Btn title="Align centres" onClick={() => onAlign("hcenter")}>
            <AlignCenterHorizontal className="h-4 w-4" />
          </Btn>
          <Btn title="Align right" onClick={() => onAlign("right")}>
            <AlignEndVertical className="h-4 w-4" />
          </Btn>
          <Btn title="Align top" onClick={() => onAlign("top")}>
            <AlignStartHorizontal className="h-4 w-4" />
          </Btn>
        </>
      )}
      {(only || selected.length > 1) && sep}
      <Btn title="Bring to front" onClick={onFront}>
        <BringToFront className="h-4 w-4" />
      </Btn>
      <Btn title="Send to back" onClick={onBack}>
        <SendToBack className="h-4 w-4" />
      </Btn>
      <Btn title={locked ? "Unlock" : "Lock"} active={locked} onClick={() => onUpdate((el) => ({ ...el, locked: !locked }))}>
        {locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
      </Btn>
      <Btn title="Duplicate (Ctrl+D)" onClick={onDuplicate}>
        <Copy className="h-4 w-4" />
      </Btn>
      <Btn title="Delete" onClick={onDelete}>
        <Trash2 className="h-4 w-4 text-coral" />
      </Btn>
    </div>
  );
}

function Minimap({
  elements,
  camera,
  rootRef,
  onJump,
}: {
  elements: El[];
  camera: Camera;
  rootRef: React.RefObject<HTMLDivElement | null>;
  onJump: (x: number, y: number) => void;
}) {
  const W = 200;
  const H = 130;
  const boxes = elements.filter(isBox);
  const r = rootRef.current?.getBoundingClientRect();
  if (!boxes.length || !r) return null;
  const view = { x: -camera.x / camera.zoom, y: -camera.y / camera.zoom, w: r.width / camera.zoom, h: r.height / camera.zoom };
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
      className="absolute bottom-16 right-3 z-20 hidden overflow-hidden rounded-xl bg-white/95 shadow-md ring-1 ring-slate-200/80 md:block"
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
            fill={e.kind === "sticky" ? e.color : e.kind === "frame" ? "#EDF1F6" : e.kind === "shape" ? e.stroke : e.kind === "card" ? e.accent : "#8E9AAB"}
            opacity={e.kind === "frame" ? 1 : 0.85}
          />
        ))}
        <rect x={tx(view.x)} y={ty(view.y)} width={view.w * s} height={view.h * s} fill="rgba(31,95,214,.08)" stroke="#1F5FD6" strokeWidth={1.5} rx={2} />
      </svg>
    </div>
  );
}
