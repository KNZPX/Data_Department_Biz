// Whiteboard v2 model: a Miro-style infinite canvas of elements.
// Stored in whiteboard_boards.nodes as an array of elements (each has `kind`).
// Boards saved by the old whiteboard (and DAX "open in whiteboard" exports)
// store legacy nodes with `type` + `connections`; they're converted on load.

export type Side = "top" | "right" | "bottom" | "left";
export type ShapeKind = "rect" | "round" | "ellipse" | "diamond" | "triangle" | "hexagon" | "cylinder" | "parallelogram";

type Base = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  locked?: boolean;
  /** Items sharing a groupId select and move together (Ctrl+G). */
  groupId?: string;
};

/** Whole-item text formatting (Miro's B / I / U / S and alignment). */
export type TextFmt = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  align?: "left" | "center" | "right";
};

/** Sticky font size: undefined = auto-fit to the text, like Miro's "Auto". */
export type StickyEl = Base & { kind: "sticky"; text: string; color: string; fontSize?: number; fmt?: TextFmt };
export type ShapeEl = Base & {
  kind: "shape";
  shape: ShapeKind;
  text: string;
  fill: string;
  stroke: string;
  textColor: string;
  fontSize: number;
  fmt?: TextFmt;
};
/** `bold` is the pre-`fmt` field; fmtOf() reads either. */
export type TextEl = Base & { kind: "text"; text: string; color: string; fontSize: number; bold?: boolean; fmt?: TextFmt };
export type CardEl = Base & { kind: "card"; title: string; body: string; accent: string; tag?: string };
export type FrameEl = Base & { kind: "frame"; title: string; fill: string };
/** opacity < 1 = highlighter stroke. */
export type DrawEl = Base & { kind: "draw"; points: [number, number][]; stroke: string; width: number; opacity?: number };

export type Endpoint = { id?: string; side?: Side; x: number; y: number };
export type ConnectorEl = {
  id: string;
  kind: "connector";
  z: number;
  from: Endpoint;
  to: Endpoint;
  route: "curve" | "elbow" | "straight";
  stroke: string;
  width: number;
  dashed?: boolean;
  arrowEnd: boolean;
  arrowStart: boolean;
  label?: string;
  locked?: boolean;
};

export type BoxEl = StickyEl | ShapeEl | TextEl | CardEl | FrameEl | DrawEl;
export type El = BoxEl | ConnectorEl;

export type Camera = { x: number; y: number; zoom: number };

export type BoardMeta = {
  id: string;
  name: string;
  folder_id: string;
  folder_name: string;
  description?: string;
  updated_at?: string;
};

// ---------------------------------------------------------------------------
// Palettes
// ---------------------------------------------------------------------------
// Miro's sticky-note colours, in the order its picker shows them.
export const STICKY_COLORS = [
  "#FFF9B1", "#F5D128", "#FF9D48", "#D5F692",
  "#C9DF56", "#93D275", "#67C6C0", "#FFCEE0",
  "#EA94BB", "#C6A2D2", "#F0939D", "#A6CCF5",
  "#6CD8FA", "#9EA9FF", "#F5F6F8", "#1A1A1A",
];
// Miro's 16-colour palette for shape fill, border, text and lines.
export const MIRO_COLORS = [
  "#FFFFFF", "#FEF445", "#FAC710", "#F24726",
  "#E6E6E6", "#CEE741", "#8FD14F", "#DA0063",
  "#808080", "#12CDD4", "#0CA789", "#9510AC",
  "#1A1A1A", "#2D9BF0", "#414BB2", "#652CB3",
];
export const INK_COLORS = MIRO_COLORS;
export const FILL_COLORS = MIRO_COLORS;
export const MIRO_BLUE = "#4262FF";

/** Dark text on light fills, white text on dark ones. */
export function readableOn(hex: string) {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "#1A1A1A";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.5 ? "#FFFFFF" : "#1A1A1A";
}

export function uid(prefix = "el") {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function isBox(el: El): el is BoxEl {
  return el.kind !== "connector";
}

export function fmtOf(el: El): TextFmt {
  if (el.kind === "text") return { bold: el.bold, ...el.fmt };
  if (el.kind === "sticky" || el.kind === "shape") return el.fmt || {};
  return {};
}

/** CSS for an item's whole-text formatting. */
export function fmtStyle(f: TextFmt): { fontWeight?: number; fontStyle?: string; textDecoration?: string; textAlign?: "left" | "center" | "right" } {
  const deco = [f.underline && "underline", f.strike && "line-through"].filter(Boolean).join(" ");
  return {
    fontWeight: f.bold ? 700 : undefined,
    fontStyle: f.italic ? "italic" : undefined,
    textDecoration: deco || undefined,
    textAlign: f.align,
  };
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------
export type Rect = { x: number; y: number; w: number; h: number };

export function anchor(b: Rect, side: Side): { x: number; y: number } {
  switch (side) {
    case "top":
      return { x: b.x + b.w / 2, y: b.y };
    case "right":
      return { x: b.x + b.w, y: b.y + b.h / 2 };
    case "bottom":
      return { x: b.x + b.w / 2, y: b.y + b.h };
    case "left":
      return { x: b.x, y: b.y + b.h / 2 };
  }
}

export function nearestSide(b: Rect, p: { x: number; y: number }): Side {
  const sides: Side[] = ["top", "right", "bottom", "left"];
  let best: Side = "right";
  let bd = Infinity;
  for (const s of sides) {
    const a = anchor(b, s);
    const d = (a.x - p.x) ** 2 + (a.y - p.y) ** 2;
    if (d < bd) {
      bd = d;
      best = s;
    }
  }
  return best;
}

/** Side facing another box — used when a connector is attached without an explicit side. */
export function facingSide(from: Rect, to: Rect): Side {
  const dx = to.x + to.w / 2 - (from.x + from.w / 2);
  const dy = to.y + to.h / 2 - (from.y + from.h / 2);
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "bottom" : "top";
}

const DIR: Record<Side, [number, number]> = { top: [0, -1], right: [1, 0], bottom: [0, 1], left: [-1, 0] };

export function resolveEndpoint(ep: Endpoint, other: Endpoint, byId: Map<string, El>) {
  const el = ep.id ? byId.get(ep.id) : undefined;
  if (el && isBox(el)) {
    const otherEl = other.id ? byId.get(other.id) : undefined;
    const side =
      ep.side ||
      (otherEl && isBox(otherEl) ? facingSide(el, otherEl) : nearestSide(el, { x: other.x, y: other.y }));
    return { ...anchor(el, side), side };
  }
  return { x: ep.x, y: ep.y, side: ep.side };
}

export function connectorPath(
  c: ConnectorEl,
  byId: Map<string, El>
): { d: string; a: { x: number; y: number }; b: { x: number; y: number }; mid: { x: number; y: number }; endAngle: number; startAngle: number } {
  const a = resolveEndpoint(c.from, c.to, byId);
  const b = resolveEndpoint(c.to, c.from, byId);
  const dist = Math.hypot(b.x - a.x, b.y - a.y);

  if (c.route === "straight") {
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    return { d: `M${a.x},${a.y} L${b.x},${b.y}`, a, b, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, endAngle: ang, startAngle: ang + Math.PI };
  }

  if (c.route === "curve") {
    const k = Math.max(40, Math.min(160, dist * 0.45));
    const da = a.side ? DIR[a.side] : [Math.sign(b.x - a.x) || 1, 0];
    const db = b.side ? DIR[b.side] : [Math.sign(a.x - b.x) || -1, 0];
    const c1 = { x: a.x + da[0] * k, y: a.y + da[1] * k };
    const c2 = { x: b.x + db[0] * k, y: b.y + db[1] * k };
    const mid = {
      x: 0.125 * a.x + 0.375 * c1.x + 0.375 * c2.x + 0.125 * b.x,
      y: 0.125 * a.y + 0.375 * c1.y + 0.375 * c2.y + 0.125 * b.y,
    };
    return {
      d: `M${a.x},${a.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${b.x},${b.y}`,
      a,
      b,
      mid,
      endAngle: Math.atan2(b.y - c2.y, b.x - c2.x),
      startAngle: Math.atan2(a.y - c1.y, a.x - c1.x),
    };
  }

  // Elbow: leave each box perpendicular to its side, then meet in the middle.
  const stub = 24;
  const da = a.side ? DIR[a.side] : [1, 0];
  const db = b.side ? DIR[b.side] : [-1, 0];
  const p1 = { x: a.x + da[0] * stub, y: a.y + da[1] * stub };
  const p2 = { x: b.x + db[0] * stub, y: b.y + db[1] * stub };
  const horizontalFirst = da[0] !== 0;
  const pts: { x: number; y: number }[] = [a, p1];
  if (horizontalFirst) {
    const mx = (p1.x + p2.x) / 2;
    if (db[0] !== 0) pts.push({ x: mx, y: p1.y }, { x: mx, y: p2.y });
    else pts.push({ x: p2.x, y: p1.y });
  } else {
    const my = (p1.y + p2.y) / 2;
    if (db[1] !== 0) pts.push({ x: p1.x, y: my }, { x: p2.x, y: my });
    else pts.push({ x: p1.x, y: p2.y });
  }
  pts.push(p2, b);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");
  const midIdx = Math.floor(pts.length / 2);
  const mid = { x: (pts[midIdx - 1].x + pts[midIdx].x) / 2, y: (pts[midIdx - 1].y + pts[midIdx].y) / 2 };
  return {
    d,
    a,
    b,
    mid,
    endAngle: Math.atan2(b.y - p2.y, b.x - p2.x),
    startAngle: Math.atan2(a.y - p1.y, a.x - p1.x),
  };
}

export function boundsOf(els: El[], byId: Map<string, El>): Rect | null {
  let x1 = Infinity,
    y1 = Infinity,
    x2 = -Infinity,
    y2 = -Infinity;
  for (const el of els) {
    if (isBox(el)) {
      x1 = Math.min(x1, el.x);
      y1 = Math.min(y1, el.y);
      x2 = Math.max(x2, el.x + el.w);
      y2 = Math.max(y2, el.y + el.h);
    } else {
      const p = connectorPath(el, byId);
      x1 = Math.min(x1, p.a.x, p.b.x);
      y1 = Math.min(y1, p.a.y, p.b.y);
      x2 = Math.max(x2, p.a.x, p.b.x);
      y2 = Math.max(y2, p.a.y, p.b.y);
    }
  }
  if (!isFinite(x1)) return null;
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

export function intersects(a: Rect, b: Rect) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function contains(outer: Rect, inner: Rect) {
  return inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;
}

// ---------------------------------------------------------------------------
// Legacy conversion
// ---------------------------------------------------------------------------
type LegacyNode = {
  id: string;
  type: string;
  title: string;
  description?: string;
  color?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  connections?: { targetId: string; fromSide?: Side; toSide?: Side; label?: string }[];
};

const LEGACY_SHAPE: Record<string, ShapeKind> = {
  decision: "diamond",
  database: "cylinder",
  cloud: "round",
  queue: "parallelogram",
  trigger: "round",
};

export function normalizeElements(raw: unknown): El[] {
  if (!Array.isArray(raw)) return [];
  if (raw.length === 0) return [];
  if (raw.every((r) => r && typeof r === "object" && "kind" in r)) return raw as El[];

  const out: El[] = [];
  let z = 1;
  for (const n of raw as LegacyNode[]) {
    if (!n || typeof n !== "object") continue;
    if ("kind" in (n as object)) {
      out.push(n as unknown as El);
      continue;
    }
    const base = { id: n.id, x: n.x || 0, y: n.y || 0, w: n.width || 230, h: n.height || 100, z: z++ };
    const accent = n.color || "#1F5FD6";
    if (n.type === "sticky") {
      out.push({ ...base, kind: "sticky", text: [n.title, n.description].filter(Boolean).join("\n"), color: accent.length === 7 && parseInt(accent.slice(1, 3), 16) > 200 ? accent : "#FFF9B1" });
    } else if (n.type === "text") {
      out.push({ ...base, kind: "text", text: n.title || n.description || "", color: "#0E1B2E", fontSize: 18 });
    } else if (LEGACY_SHAPE[n.type] && !n.description) {
      out.push({
        ...base,
        kind: "shape",
        shape: LEGACY_SHAPE[n.type],
        text: n.title,
        fill: "#FFFFFF",
        stroke: accent,
        textColor: "#0E1B2E",
        fontSize: 14,
      });
    } else {
      out.push({ ...base, kind: "card", title: n.title || "", body: n.description || "", accent, tag: n.type });
    }
  }
  for (const n of raw as LegacyNode[]) {
    for (const c of n.connections || []) {
      out.push({
        id: `cx_${n.id}_${c.targetId}`,
        kind: "connector",
        z: 0,
        from: { id: n.id, side: c.fromSide, x: 0, y: 0 },
        to: { id: c.targetId, side: c.toSide, x: 0, y: 0 },
        route: "curve",
        stroke: "#637083",
        width: 2,
        arrowEnd: true,
        arrowStart: false,
        label: c.label,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------
export type Template = { id: string; name: string; description: string; build: () => El[] };

function sticky(x: number, y: number, text: string, color = STICKY_COLORS[0]): StickyEl {
  return { id: uid(), kind: "sticky", x, y, w: 180, h: 180, z: 10, text, color };
}
function frame(x: number, y: number, w: number, h: number, title: string, fill = "#FFFFFF"): FrameEl {
  return { id: uid("fr"), kind: "frame", x, y, w, h, z: 0, title, fill };
}
function box(x: number, y: number, text: string, shape: ShapeKind = "round", stroke = "#1F5FD6", w = 200, h = 90): ShapeEl {
  return { id: uid(), kind: "shape", shape, x, y, w, h, z: 10, text, fill: "#FFFFFF", stroke, textColor: "#0E1B2E", fontSize: 15 };
}
function link(a: string, b: string): ConnectorEl {
  return {
    id: uid("cx"),
    kind: "connector",
    z: 5,
    from: { id: a, x: 0, y: 0 },
    to: { id: b, x: 0, y: 0 },
    route: "elbow",
    stroke: "#637083",
    width: 2,
    arrowEnd: true,
    arrowStart: false,
  };
}

export const TEMPLATES: Template[] = [
  { id: "blank", name: "Blank board", description: "Start from an empty canvas", build: () => [] },
  {
    id: "retro",
    name: "Retrospective",
    description: "What went well, what to improve, actions",
    build: () => [
      frame(0, 0, 440, 620, "Went well", "#F1FBF8"),
      frame(480, 0, 440, 620, "To improve", "#FFF6F2"),
      frame(960, 0, 440, 620, "Actions", "#F2F6FE"),
      sticky(40, 70, "Dashboard shipped on time", STICKY_COLORS[3]),
      sticky(520, 70, "Refresh failed twice", STICKY_COLORS[7]),
      sticky(1000, 70, "Add refresh alert", STICKY_COLORS[11]),
    ],
  },
  {
    id: "flow",
    name: "Data flow",
    description: "Source to model to report, ready to edit",
    build: () => {
      const s = box(0, 60, "HIS / Data warehouse", "cylinder", "#637083", 200, 110);
      const m = box(300, 70, "Power Query (M)", "round", "#0E9F8E");
      const d = box(600, 70, "Semantic model PKT-D01", "round", "#1F5FD6");
      const r = box(900, 70, "Report / Dashboard", "round", "#7C4DDB");
      return [s, m, d, r, link(s.id, m.id), link(m.id, d.id), link(d.id, r.id)];
    },
  },
  {
    id: "kanban",
    name: "Kanban",
    description: "To do, doing, done",
    build: () => [
      frame(0, 0, 360, 700, "To do", "#F5F7FA"),
      frame(400, 0, 360, 700, "Doing", "#F5F7FA"),
      frame(800, 0, 360, 700, "Done", "#F5F7FA"),
      sticky(90, 70, "New request", STICKY_COLORS[0]),
      sticky(490, 70, "In progress", STICKY_COLORS[11]),
      sticky(890, 70, "Delivered", STICKY_COLORS[3]),
    ],
  },
  {
    id: "brainstorm",
    name: "Brainstorm",
    description: "One question in the middle, ideas around it",
    build: () => {
      const c = box(0, 0, "What should the next dashboard answer?", "ellipse", "#1F5FD6", 320, 160);
      const ideas = [
        sticky(-360, -260, "Idea"),
        sticky(460, -260, "Idea", STICKY_COLORS[9]),
        sticky(-360, 260, "Idea", STICKY_COLORS[11]),
        sticky(460, 260, "Idea", STICKY_COLORS[3]),
      ];
      return [c, ...ideas, ...ideas.map((i) => ({ ...link(c.id, i.id), route: "curve" as const, arrowEnd: false }))];
    },
  },
];

// ---------------------------------------------------------------------------
// Block library (the node types of the old whiteboard, plus shapes)
// ---------------------------------------------------------------------------
export type BlockDef = {
  id: string;
  label: string;
  group: "Data flow" | "Shapes" | "Notes";
  make: (x: number, y: number, z: number) => BoxEl;
};

function cardBlock(id: string, label: string, accent: string, title: string, body: string): BlockDef {
  return {
    id,
    label,
    group: "Data flow",
    make: (x, y, z) => ({ id: uid(), kind: "card", x: x - 115, y: y - 50, w: 230, h: 100, z, title, body, accent, tag: label.toLowerCase() }),
  };
}
function shapeBlock(id: string, label: string, shape: ShapeKind, stroke: string, w = 200, h = 100): BlockDef {
  return {
    id,
    label,
    group: "Shapes",
    make: (x, y, z) => ({ id: uid(), kind: "shape", shape, x: x - w / 2, y: y - h / 2, w, h, z, text: "", fill: "#FFFFFF", stroke, textColor: "#0E1B2E", fontSize: 16 }),
  };
}

export const BLOCKS: BlockDef[] = [
  cardBlock("process", "Process", "#7C4DDB", "Process step", "What happens here"),
  cardBlock("decision", "Decision", "#D99A00", "Decision?", "Yes / No branches"),
  cardBlock("trigger", "Trigger", "#1F5FD6", "Trigger", "What starts the flow"),
  cardBlock("database", "Table", "#0E9F8E", "fact_table", "Source table or view"),
  cardBlock("dax", "DAX measure", "#4F46E5", "[measure_name]", "CALCULATE( ... )"),
  cardBlock("value", "KPI value", "#0E9F8E", "42.5", "Metric and its target"),
  cardBlock("cloud", "Service", "#2E5B8A", "Power BI service", "Workspace, dataflow or API"),
  cardBlock("queue", "Queue", "#637083", "Refresh queue", "Scheduled or batch step"),
  cardBlock("output", "Report", "#E4572E", "Report / dashboard", "Who uses it"),
  shapeBlock("s-rect", "Rectangle", "rect", "#1F5FD6"),
  shapeBlock("s-round", "Rounded", "round", "#1F5FD6"),
  shapeBlock("s-ellipse", "Ellipse", "ellipse", "#0E9F8E"),
  shapeBlock("s-diamond", "Decision", "diamond", "#D99A00", 180, 120),
  shapeBlock("s-triangle", "Triangle", "triangle", "#7C4DDB", 160, 130),
  shapeBlock("s-hex", "Hexagon", "hexagon", "#2E5B8A"),
  shapeBlock("s-cyl", "Database", "cylinder", "#637083", 180, 120),
  shapeBlock("s-para", "Input / output", "parallelogram", "#E4572E"),
  {
    id: "n-sticky",
    label: "Sticky note",
    group: "Notes",
    make: (x, y, z) => ({ id: uid(), kind: "sticky", x: x - 90, y: y - 90, w: 180, h: 180, z, text: "", color: STICKY_COLORS[0] }),
  },
  {
    id: "n-text",
    label: "Text",
    group: "Notes",
    make: (x, y, z) => ({ id: uid(), kind: "text", x: x - 130, y: y - 20, w: 260, h: 40, z, text: "", color: "#0E1B2E", fontSize: 22 }),
  },
  {
    id: "n-heading",
    label: "Heading",
    group: "Notes",
    make: (x, y, z) => ({ id: uid(), kind: "text", x: x - 200, y: y - 30, w: 400, h: 60, z, text: "", color: "#0E1B2E", fontSize: 40, bold: true }),
  },
];

/** DAX formula diagram nodes (from the DAX page parser) → whiteboard elements. */
export function elementsFromDaxDiagram(
  nodes: {
    id: string;
    title: string;
    category: string;
    role: string;
    detail: string;
    codeSnippet?: string;
    color?: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
    connections: { targetId: string; fromSide?: string; toSide?: string; label?: string }[];
  }[]
): El[] {
  const out: El[] = [];
  let z = 10;
  for (const n of nodes) {
    const shape: ShapeKind | null = n.category === "switch" ? "diamond" : n.category === "source" ? "cylinder" : null;
    const base = { id: n.id, x: n.x, y: n.y, w: n.width || 230, h: n.height || 100, z: z++ };
    if (shape) {
      out.push({ ...base, kind: "shape", shape, text: n.title, fill: "#FFFFFF", stroke: n.color || "#637083", textColor: "#0E1B2E", fontSize: 14, h: Math.max(base.h, 110) });
    } else {
      out.push({
        ...base,
        kind: "card",
        title: n.title,
        body: [n.detail, n.codeSnippet].filter(Boolean).join("\n"),
        accent: n.color || "#1F5FD6",
        tag: n.role,
      });
    }
  }
  for (const n of nodes) {
    for (const c of n.connections) {
      out.push({
        id: `cx_${n.id}_${c.targetId}`,
        kind: "connector",
        z: 5,
        from: { id: n.id, side: c.fromSide as Side | undefined, x: 0, y: 0 },
        to: { id: c.targetId, side: c.toSide as Side | undefined, x: 0, y: 0 },
        route: "curve",
        stroke: "#637083",
        width: 2,
        arrowEnd: true,
        arrowStart: false,
        label: c.label,
      });
    }
  }
  return out;
}
