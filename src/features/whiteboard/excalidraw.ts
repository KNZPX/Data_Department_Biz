// Excalidraw ⇄ whiteboard. Opens .excalidraw files (and Excalidraw's clipboard)
// as whiteboard items, and saves the board as a .excalidraw file that
// excalidraw.com opens. Pure functions; the few things that need a browser
// (sampling a curved outline, a picture's size) are passed in.
import {
  FONT_STACK,
  connectorPath,
  contains,
  isBox,
  nearestSide,
  readableOn,
  type BoxEl,
  type ConnectorEl,
  type DrawEl,
  type El,
  type FillStyle,
  type FontKind,
  type Head,
  type ImageEl,
  type ShapeEl,
  type Sloppiness,
  type StrokeStyle,
} from "./model";
import { seedOf } from "./sketch";

// ---- the bits of Excalidraw's format we read and write ------------------------------------------

type XBound = { id: string; type: "text" | "arrow" };
type XBinding = { elementId: string; focus: number; gap: number } | null;
export type XEl = {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle?: number;
  strokeColor?: string;
  backgroundColor?: string;
  fillStyle?: string;
  strokeWidth?: number;
  strokeStyle?: string;
  roughness?: number;
  opacity?: number;
  groupIds?: string[];
  frameId?: string | null;
  roundness?: { type: number } | null;
  seed?: number;
  isDeleted?: boolean;
  boundElements?: XBound[] | null;
  link?: string | null;
  locked?: boolean;
  // text
  text?: string;
  originalText?: string;
  fontSize?: number;
  fontFamily?: number;
  textAlign?: string;
  verticalAlign?: string;
  containerId?: string | null;
  // lines
  points?: [number, number][];
  startBinding?: XBinding;
  endBinding?: XBinding;
  startArrowhead?: string | null;
  endArrowhead?: string | null;
  elbowed?: boolean;
  // images / frames
  fileId?: string;
  crop?: { x: number; y: number; width: number; height: number; naturalWidth: number; naturalHeight: number } | null;
  name?: string | null;
  [k: string]: unknown;
};
export type XFile = { id: string; mimeType: string; dataURL: string; created?: number };
export type XScene = { type: string; version?: number; source?: string; elements: XEl[]; appState?: Record<string, unknown>; files?: Record<string, XFile> };

/** A parsed .excalidraw file or Excalidraw clipboard text, or null if it isn't one. */
export function parseExcalidraw(text: string): XScene | null {
  const t = text.trim();
  if (!t.startsWith("{")) return null;
  try {
    const j = JSON.parse(t) as XScene;
    if (!j || !Array.isArray(j.elements)) return null;
    if (j.type !== "excalidraw" && j.type !== "excalidraw/clipboard" && j.type !== "excalidrawlib") return null;
    return j;
  } catch {
    return null;
  }
}

const FONT_OF: Record<number, FontKind> = { 1: "hand", 5: "hand", 2: "normal", 6: "normal", 7: "normal", 3: "code", 8: "code" };
const FAMILY_OF: Record<FontKind, number> = { hand: 5, normal: 6, code: 8 };

const HEAD_IN: Record<string, Head> = {
  arrow: "open",
  triangle: "arrow",
  triangle_outline: "open",
  bar: "bar",
  dot: "circle",
  circle: "circle",
  circle_outline: "circle",
  diamond: "diamond",
  diamond_outline: "diamond",
  crowfoot_one: "bar",
  crowfoot_many: "open",
  crowfoot_one_or_many: "open",
};
const HEAD_OUT: Record<Head, string> = { arrow: "triangle", open: "arrow", circle: "dot", diamond: "diamond", bar: "bar" };

const sloppy = (n: number | undefined): Sloppiness | undefined => (n === 1 || n === 2 ? n : undefined);
const fillStyleIn = (s: string | undefined): FillStyle | undefined => (s === "hachure" || s === "cross-hatch" || s === "zigzag" || s === "dots" ? s : undefined);
const strokeStyleIn = (s: string | undefined): StrokeStyle | undefined => (s === "dashed" || s === "dotted" ? s : undefined);
const alphaIn = (o: number | undefined) => (o !== undefined && o < 100 ? Math.max(0.1, o / 100) : undefined);
const color = (c: string | undefined, fallback: string) => (c && c !== "" ? c : fallback);

// ---- Excalidraw → whiteboard ----------------------------------------------------------------------

export type ImportResult = { elements: El[]; skipped: number; rotated: number };

/**
 * Turn an Excalidraw scene into whiteboard items with fresh ids, z after `zFrom`.
 * `at` moves the scene's top-left corner there (for pasting at the pointer).
 */
export function fromExcalidraw(scene: XScene, opts: { zFrom: number; at?: { x: number; y: number }; newId: (prefix: string) => string }): ImportResult {
  const live = scene.elements.filter((e) => e && !e.isDeleted && typeof e.x === "number");
  const files = scene.files || {};
  const ids = new Map<string, string>();
  const groups = new Map<string, string>();
  for (const e of live) ids.set(e.id, opts.newId(e.type === "arrow" || e.type === "line" ? "cx" : e.type === "freedraw" ? "ink" : "el"));
  const gid = (e: XEl) => {
    const g = e.groupIds?.[e.groupIds.length - 1];
    if (!g) return undefined;
    if (!groups.has(g)) groups.set(g, opts.newId("grp"));
    return groups.get(g);
  };
  const byXId = new Map(live.map((e) => [e.id, e]));
  // Text that sits inside a box or on an arrow becomes that item's text.
  const boundText = new Map<string, XEl>();
  for (const e of live) if (e.type === "text" && e.containerId && byXId.has(e.containerId)) boundText.set(e.containerId, e);

  let z = opts.zFrom;
  let skipped = 0;
  let rotated = 0;
  const out: El[] = [];
  const boxes = new Map<string, BoxEl>();
  const pendingLines: XEl[] = [];

  for (const e of live) {
    if (e.angle && Math.abs(e.angle) > 0.001 && e.type !== "arrow" && e.type !== "line") rotated++;
    const base = { id: ids.get(e.id)!, x: e.x, y: e.y, w: Math.max(1, e.width), h: Math.max(1, e.height), z: ++z, groupId: gid(e), alpha: alphaIn(e.opacity), locked: e.locked || undefined, link: e.link || undefined };
    if (e.type === "rectangle" || e.type === "ellipse" || e.type === "diamond") {
      const t = boundText.get(e.id);
      const shape: ShapeEl = {
        ...base,
        kind: "shape",
        shape: e.type === "rectangle" ? (e.roundness ? "round" : "rect") : e.type,
        text: t ? (t.originalText ?? t.text ?? "") : "",
        fill: !e.backgroundColor || e.backgroundColor === "transparent" ? "transparent" : e.backgroundColor,
        stroke: color(e.strokeColor, "#1e1e1e"),
        textColor: t ? color(t.strokeColor, "#1e1e1e") : "#1e1e1e",
        fontSize: t?.fontSize ?? 20,
        fmt: t ? { font: FONT_OF[t.fontFamily ?? 5] ?? "hand", align: t.textAlign === "left" || t.textAlign === "right" ? t.textAlign : undefined } : undefined,
        rough: sloppy(e.roughness),
        fillStyle: fillStyleIn(e.fillStyle),
        strokeStyle: strokeStyleIn(e.strokeStyle),
        strokeWidth: e.strokeWidth ?? 2,
      };
      out.push(shape);
      boxes.set(e.id, shape);
    } else if (e.type === "text") {
      if (e.containerId && byXId.has(e.containerId)) continue;
      const el: BoxEl = {
        ...base,
        kind: "text",
        text: e.originalText ?? e.text ?? "",
        color: color(e.strokeColor, "#1e1e1e"),
        fontSize: e.fontSize ?? 20,
        fmt: { font: FONT_OF[e.fontFamily ?? 5] ?? "hand", align: e.textAlign === "center" || e.textAlign === "right" ? e.textAlign : undefined },
      };
      out.push(el);
      boxes.set(e.id, el);
    } else if (e.type === "freedraw") {
      out.push(polyline(e, base, false));
    } else if (e.type === "line" || e.type === "arrow") {
      pendingLines.push(e);
      z--;
    } else if (e.type === "image") {
      const f = e.fileId ? files[e.fileId] : undefined;
      if (!f?.dataURL) {
        skipped++;
        continue;
      }
      const c = e.crop;
      const img: ImageEl = {
        ...base,
        kind: "image",
        src: f.dataURL,
        crop: c && c.naturalWidth && c.naturalHeight ? { x: c.x / c.naturalWidth, y: c.y / c.naturalHeight, w: c.width / c.naturalWidth, h: c.height / c.naturalHeight } : undefined,
      };
      out.push(img);
      boxes.set(e.id, img);
    } else if (e.type === "frame" || e.type === "magicframe") {
      const fr: BoxEl = { ...base, kind: "frame", z: -1e6 + base.z, title: e.name || "Frame", fill: "transparent" };
      out.push(fr);
      boxes.set(e.id, fr);
    } else if (e.type === "embeddable" || e.type === "iframe") {
      const link = e.link || "";
      const card: BoxEl = { ...base, kind: "card", title: link.replace(/^https?:\/\//, "").split("/")[0] || "Embedded link", body: link, accent: "#4262FF", tag: "Link" };
      out.push(card);
      boxes.set(e.id, card);
    } else {
      skipped++;
    }
  }

  // Lines and arrows: bound or short ones become connectors (they follow their boxes);
  // free multi-point lines stay drawings so their shape is kept.
  for (const e of pendingLines) {
    const pts = (e.points?.length ? e.points : [[0, 0], [e.width, e.height]]).map(([px, py]) => ({ x: e.x + px, y: e.y + py }));
    const a = pts[0];
    const b = pts[pts.length - 1];
    const sb = e.startBinding?.elementId ? boxes.get(e.startBinding.elementId) : undefined;
    const eb = e.endBinding?.elementId ? boxes.get(e.endBinding.elementId) : undefined;
    const heads = e.startArrowhead || e.endArrowhead;
    const asLine = !sb && !eb && pts.length > 2 && !e.elbowed && (e.type === "line" || !heads);
    const base = { id: ids.get(e.id)!, x: e.x, y: e.y, w: Math.max(1, e.width), h: Math.max(1, e.height), z: ++z, groupId: gid(e), alpha: alphaIn(e.opacity), locked: e.locked || undefined };
    if (asLine) {
      out.push(polyline(e, base, true));
      continue;
    }
    const label = boundText.get(e.id);
    const cx: ConnectorEl = {
      id: base.id,
      kind: "connector",
      z: base.z,
      from: sb && isBox(sb) ? { id: sb.id, side: nearestSide(sb, a), x: a.x, y: a.y } : { x: a.x, y: a.y },
      to: eb && isBox(eb) ? { id: eb.id, side: nearestSide(eb, b), x: b.x, y: b.y } : { x: b.x, y: b.y },
      route: e.elbowed ? "elbow" : pts.length > 2 || e.roundness ? "curve" : "straight",
      stroke: color(e.strokeColor, "#1e1e1e"),
      width: Math.max(1, e.strokeWidth ?? 2),
      dashed: e.strokeStyle === "dashed" || undefined,
      dotted: e.strokeStyle === "dotted" || undefined,
      arrowStart: Boolean(e.startArrowhead),
      arrowEnd: Boolean(e.endArrowhead),
      headStart: e.startArrowhead ? (HEAD_IN[e.startArrowhead] ?? "arrow") : undefined,
      headEnd: e.endArrowhead ? (HEAD_IN[e.endArrowhead] ?? "arrow") : undefined,
      label: label ? (label.originalText ?? label.text) || undefined : undefined,
      rough: sloppy(e.roughness),
      alpha: alphaIn(e.opacity),
      locked: e.locked || undefined,
    };
    out.push(cx);
  }

  if (opts.at && out.length) {
    const boxesOnly = out.filter(isBox);
    const x0 = Math.min(...boxesOnly.map((b) => b.x), ...out.filter((c): c is ConnectorEl => c.kind === "connector").flatMap((c) => [c.from.x, c.to.x]));
    const y0 = Math.min(...boxesOnly.map((b) => b.y), ...out.filter((c): c is ConnectorEl => c.kind === "connector").flatMap((c) => [c.from.y, c.to.y]));
    const dx = opts.at.x - x0;
    const dy = opts.at.y - y0;
    for (const el of out) {
      if (el.kind === "connector") {
        el.from = { ...el.from, x: el.from.x + dx, y: el.from.y + dy };
        el.to = { ...el.to, x: el.to.x + dx, y: el.to.y + dy };
      } else {
        el.x += dx;
        el.y += dy;
      }
    }
  }
  return { elements: out, skipped, rotated };
}

/** A freedraw stroke or a free multi-point line as a whiteboard drawing. */
function polyline(e: XEl, base: { id: string; z: number; groupId?: string; alpha?: number; locked?: boolean }, line: boolean): DrawEl {
  const raw = (e.points?.length ? e.points : [[0, 0]]).map(([px, py]) => [e.x + px, e.y + py] as [number, number]);
  const xs = raw.map((p) => p[0]);
  const ys = raw.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const sw = e.strokeWidth ?? 2;
  return {
    id: base.id,
    kind: "draw",
    x,
    y,
    w: Math.max(1, Math.max(...xs) - x),
    h: Math.max(1, Math.max(...ys) - y),
    z: base.z,
    groupId: base.groupId,
    locked: base.locked,
    points: raw.map(([px, py]) => [Math.round((px - x) * 10) / 10, Math.round((py - y) * 10) / 10]),
    stroke: color(e.strokeColor, "#1e1e1e"),
    // Excalidraw's freehand strokes are fuller than their nominal width.
    width: line ? sw : Math.max(2, sw * 2),
    opacity: e.opacity !== undefined && e.opacity < 100 ? Math.max(0.1, e.opacity / 100) : undefined,
    ...(e.strokeStyle === "dashed" || e.strokeStyle === "dotted" ? { dash: e.strokeStyle } : {}),
  };
}

// ---- whiteboard → Excalidraw ------------------------------------------------------------------------

export type ExportHelpers = {
  /** The outline of a whiteboard shape at a size, as an SVG path. */
  shapePath: (kind: ShapeEl["shape"], w: number, h: number) => string;
  /** Points along an SVG path (needs a browser). */
  samplePath: (d: string, n: number) => { x: number; y: number }[];
  /** A picture's own size (needs a browser). */
  imageSize: (src: string) => Promise<{ w: number; h: number }>;
};

const NATIVE: Partial<Record<ShapeEl["shape"], string>> = { rect: "rectangle", round: "rectangle", ellipse: "ellipse", diamond: "diamond" };

function xBase(id: string, type: string, x: number, y: number, w: number, h: number, extra: Partial<XEl> = {}): XEl {
  return {
    id,
    type,
    x,
    y,
    width: w,
    height: h,
    angle: 0,
    strokeColor: "#1e1e1e",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 0,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: seedOf(id),
    version: 1,
    versionNonce: seedOf(id + "n"),
    isDeleted: false,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    ...extra,
  };
}

function xText(id: string, text: string, box: { x: number; y: number; w: number; h: number }, o: { color: string; size: number; font?: FontKind; align?: string; containerId?: string | null; vAlign?: string }): XEl {
  return xBase(id, "text", box.x, box.y, box.w, box.h, {
    strokeColor: o.color,
    text,
    originalText: text,
    fontSize: o.size,
    fontFamily: FAMILY_OF[o.font ?? "normal"],
    textAlign: o.align ?? (o.containerId ? "center" : "left"),
    verticalAlign: o.vAlign ?? (o.containerId ? "middle" : "top"),
    containerId: o.containerId ?? null,
    autoResize: !o.containerId,
    lineHeight: 1.25,
  });
}

const fontOfEl = (el: El): FontKind | undefined => ("fmt" in el && el.fmt?.font) || undefined;

/** The board (or some of it) as an Excalidraw scene. */
export async function toExcalidraw(els: El[], h: ExportHelpers): Promise<XScene> {
  const byId = new Map(els.map((e) => [e.id, e]));
  const out: XEl[] = [];
  const files: Record<string, XFile> = {};
  const boxOut = new Map<string, XEl>();
  const bindable = new Set<string>();
  const frames = els.filter((e): e is Extract<El, { kind: "frame" }> => e.kind === "frame");
  const frameOf = (el: BoxEl) => frames.find((f) => f.id !== el.id && contains(f, el))?.id ?? null;
  const groupIds = (el: El) => (isBox(el) && el.groupId ? [el.groupId] : []);
  const opacity = (el: El) => Math.round(((isBox(el) || el.kind === "connector" ? el.alpha : undefined) ?? 1) * 100);
  const bind = (boxId: string, b: XBound) => {
    const x = boxOut.get(boxId);
    if (x) x.boundElements = [...(x.boundElements || []), b];
  };

  for (const el of [...els].sort((a, b) => a.z - b.z)) {
    if (el.kind === "connector") continue;
    const common = { groupIds: groupIds(el), opacity: opacity(el), frameId: el.kind === "frame" ? null : frameOf(el), locked: Boolean(el.locked), link: el.link ?? null };
    if (el.kind === "shape") {
      const native = NATIVE[el.shape];
      const style = {
        strokeColor: el.stroke,
        backgroundColor: el.fill === "transparent" ? "transparent" : el.fill,
        fillStyle: el.fillStyle ?? "solid",
        strokeWidth: el.strokeWidth ?? 2,
        strokeStyle: el.strokeStyle ?? "solid",
        roughness: el.rough ?? 0,
      };
      if (native) {
        const x = xBase(el.id, native, el.x, el.y, el.w, el.h, { ...common, ...style, roundness: el.shape === "round" ? { type: 3 } : el.shape === "rect" ? null : { type: 2 } });
        out.push(x);
        boxOut.set(el.id, x);
        bindable.add(el.id);
        if (el.text) {
          const tid = `${el.id}_t`;
          out.push(xText(tid, el.text, { x: el.x + 8, y: el.y + 8, w: el.w - 16, h: el.h - 16 }, { color: el.textColor, size: el.fontSize, font: fontOfEl(el), align: el.fmt?.align ?? "center", containerId: el.id }));
          bind(el.id, { id: tid, type: "text" });
        }
      } else {
        // Shapes Excalidraw doesn't have become a closed line with the same outline.
        const pts = h.samplePath(h.shapePath(el.shape, el.w, el.h), 64);
        const points = pts.map((p) => [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10] as [number, number]);
        if (points.length) points.push([...points[0]] as [number, number]);
        out.push(xBase(el.id, "line", el.x, el.y, el.w, el.h, { ...common, ...style, points, polygon: true, lastCommittedPoint: null, startBinding: null, endBinding: null, startArrowhead: null, endArrowhead: null }));
        if (el.text) out.push(xText(`${el.id}_t`, el.text, { x: el.x + 12, y: el.y + el.h / 2 - el.fontSize * 0.7, w: el.w - 24, h: el.fontSize * 1.4 }, { color: el.textColor, size: el.fontSize, font: fontOfEl(el), align: "center", vAlign: "middle", ...common }));
      }
    } else if (el.kind === "sticky") {
      const x = xBase(el.id, "rectangle", el.x, el.y, el.w, el.h, { ...common, strokeColor: "transparent", backgroundColor: el.color, fillStyle: "solid", roughness: 0 });
      out.push(x);
      boxOut.set(el.id, x);
      bindable.add(el.id);
      if (el.text) {
        const tid = `${el.id}_t`;
        out.push(xText(tid, el.text, { x: el.x + 12, y: el.y + 12, w: el.w - 24, h: el.h - 24 }, { color: readableOn(el.color), size: el.fontSize ?? 20, font: fontOfEl(el), containerId: el.id }));
        bind(el.id, { id: tid, type: "text" });
      }
    } else if (el.kind === "text") {
      const x = xText(el.id, el.text, el, { color: el.color, size: el.fontSize, font: fontOfEl(el), align: el.fmt?.align ?? "left" });
      Object.assign(x, common);
      out.push(x);
      boxOut.set(el.id, x);
      bindable.add(el.id);
    } else if (el.kind === "card") {
      const x = xBase(el.id, "rectangle", el.x, el.y, el.w, el.h, { ...common, strokeColor: el.accent, backgroundColor: "#ffffff", roundness: { type: 3 } });
      out.push(x);
      boxOut.set(el.id, x);
      bindable.add(el.id);
      const body = [el.tag, el.title, el.body].filter(Boolean).join("\n");
      if (body) {
        const tid = `${el.id}_t`;
        out.push(xText(tid, body, { x: el.x + 10, y: el.y + 10, w: el.w - 20, h: el.h - 20 }, { color: "#1e1e1e", size: 16, containerId: el.id, align: "left", vAlign: "top" }));
        bind(el.id, { id: tid, type: "text" });
      }
    } else if (el.kind === "frame") {
      const x = xBase(el.id, "frame", el.x, el.y, el.w, el.h, { ...common, name: el.title || null, roughness: 0 });
      out.push(x);
      boxOut.set(el.id, x);
      bindable.add(el.id);
    } else if (el.kind === "draw") {
      const sw = el.opacity !== undefined && el.opacity < 1 ? 4 : el.width <= 2 ? 1 : el.width <= 4 ? 2 : 4;
      out.push(
        xBase(el.id, "freedraw", el.x, el.y, el.w, el.h, {
          ...common,
          strokeColor: el.stroke,
          strokeWidth: sw,
          strokeStyle: el.dash ?? "solid",
          opacity: Math.round((el.opacity ?? 1) * 100),
          points: el.points.map(([px, py]) => [px, py] as [number, number]),
          pressures: [],
          simulatePressure: true,
          lastCommittedPoint: null,
        })
      );
    } else if (el.kind === "image") {
      const fileId = `f${seedOf(el.src.slice(0, 2000) + el.src.length)}`;
      const mime = /^data:([^;,]+)/.exec(el.src)?.[1] || "image/png";
      files[fileId] = { id: fileId, mimeType: mime, dataURL: el.src, created: Date.now() };
      let crop: XEl["crop"] = null;
      if (el.crop) {
        const n = await h.imageSize(el.src).catch(() => null);
        if (n) crop = { x: el.crop.x * n.w, y: el.crop.y * n.h, width: el.crop.w * n.w, height: el.crop.h * n.h, naturalWidth: n.w, naturalHeight: n.h };
      }
      const x = xBase(el.id, "image", el.x, el.y, el.w, el.h, { ...common, fileId, status: "saved", scale: [1, 1], crop });
      out.push(x);
      boxOut.set(el.id, x);
      bindable.add(el.id);
    }
  }

  for (const c of els.filter((e): e is ConnectorEl => e.kind === "connector").sort((a, b) => a.z - b.z)) {
    const p = connectorPath(c, byId);
    let pts: { x: number; y: number }[];
    if (c.route === "straight") pts = [p.a, p.b];
    else if (c.route === "elbow") pts = [...p.d.matchAll(/[ML]\s*(-?[\d.]+),(-?[\d.]+)/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) }));
    else {
      // The curve through five points along the bezier.
      const n = [...p.d.matchAll(/-?[\d.]+/g)].map((m) => Number(m[0]));
      const [ax, ay, c1x, c1y, c2x, c2y, bx, by] = n;
      pts = [0, 0.25, 0.5, 0.75, 1].map((t) => {
        const u = 1 - t;
        return { x: u * u * u * ax + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * bx, y: u * u * u * ay + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * by };
      });
    }
    const x0 = pts[0].x;
    const y0 = pts[0].y;
    const xs = pts.map((q) => q.x);
    const ys = pts.map((q) => q.y);
    const heads = c.arrowStart || c.arrowEnd;
    const sId = c.from.id && bindable.has(c.from.id) ? c.from.id : null;
    const eId = c.to.id && bindable.has(c.to.id) ? c.to.id : null;
    const x = xBase(c.id, heads ? "arrow" : "line", x0, y0, Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), {
      strokeColor: c.stroke,
      strokeWidth: c.width,
      strokeStyle: c.dotted ? "dotted" : c.dashed ? "dashed" : "solid",
      roughness: c.rough ?? 0,
      opacity: Math.round((c.alpha ?? 1) * 100),
      roundness: c.route === "curve" ? { type: 2 } : null,
      points: pts.map((q) => [Math.round((q.x - x0) * 10) / 10, Math.round((q.y - y0) * 10) / 10] as [number, number]),
      lastCommittedPoint: null,
      startBinding: sId ? { elementId: sId, focus: 0, gap: 1 } : null,
      endBinding: eId ? { elementId: eId, focus: 0, gap: 1 } : null,
      startArrowhead: c.arrowStart ? HEAD_OUT[c.headStart ?? "arrow"] : null,
      endArrowhead: c.arrowEnd ? HEAD_OUT[c.headEnd ?? "arrow"] : null,
      elbowed: false,
      locked: Boolean(c.locked),
      link: c.link ?? null,
    });
    out.push(x);
    if (sId) bind(sId, { id: c.id, type: "arrow" });
    if (eId) bind(eId, { id: c.id, type: "arrow" });
    if (c.label) {
      const tid = `${c.id}_t`;
      out.push(xText(tid, c.label, { x: p.mid.x - 60, y: p.mid.y - 12, w: 120, h: 24 }, { color: c.stroke, size: 16, containerId: c.id }));
      x.boundElements = [{ id: tid, type: "text" }];
    }
  }
  return { type: "excalidraw", version: 2, source: "Biz-Analytic whiteboard", elements: out, appState: { viewBackgroundColor: "#ffffff", gridSize: 20 }, files };
}

/** The CSS font-family Excalidraw text uses on this board (for previews). */
export const fontCss = (f: FontKind) => FONT_STACK[f];
