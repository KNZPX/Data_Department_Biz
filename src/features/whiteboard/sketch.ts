// Excalidraw-style hand-drawn rendering for whiteboard shapes and lines.
// roughjs turns a clean SVG path into wobbly strokes and hatched fills; the
// result is cached per item so re-renders (pan, zoom, selection) cost nothing.
import rough from "roughjs";
import type { FillStyle, Sloppiness, StrokeStyle } from "./model";

const gen = rough.generator();

/** One SVG path of a hand-drawn item; `dash` is set on outline strokes of dashed / dotted items. */
export type RoughPath = { d: string; stroke: string; strokeWidth: number; fill?: string; dash?: string };

/** A stable seed from an item id, so its wobble doesn't change between renders or users. */
export function seedOf(id: string) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 2147483646) + 1;
}

/** Dash pattern for a stroke style at a stroke width (Excalidraw's proportions). */
export function dashFor(style: StrokeStyle | undefined, w: number): number[] | undefined {
  if (style === "dashed") return [8, 8 + w];
  if (style === "dotted") return [1.5, 6 + w];
  return undefined;
}

const cache = new Map<string, RoughPath[]>();
const CACHE_MAX = 2500;

function remember(key: string, make: () => RoughPath[]) {
  const hit = cache.get(key);
  if (hit) {
    // Refresh its place so busy items stay cached.
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const v = make();
  cache.set(key, v);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
  return v;
}

/** Whether a shape needs roughjs (a wobble or a hatched fill); otherwise a plain path draws it. */
export function needsRough(o: { rough?: Sloppiness; fillStyle?: FillStyle }) {
  return Boolean(o.rough) || (o.fillStyle !== undefined && o.fillStyle !== "solid");
}

/** A closed shape outline, hand-drawn. `fill` "transparent" (or empty) leaves it unfilled. */
export function roughShape(
  d: string,
  o: { seed: number; rough: Sloppiness; fill: string; fillStyle: FillStyle; stroke: string; strokeWidth: number; strokeStyle?: StrokeStyle }
): RoughPath[] {
  const key = `s|${d}|${o.seed}|${o.rough}|${o.fill}|${o.fillStyle}|${o.stroke}|${o.strokeWidth}|${o.strokeStyle || ""}`;
  return remember(key, () => {
    const filled = o.fill && o.fill !== "transparent" && o.fill !== "none";
    const common = { seed: o.seed, roughness: o.rough, bowing: 1, preserveVertices: o.rough < 2 };
    const out: RoughPath[] = [];
    if (filled) {
      // The fill on its own (a solid wobbly patch, or hatching lines in the fill colour).
      const fill = gen.path(d, { ...common, stroke: "none", fill: o.fill, fillStyle: o.fillStyle, fillWeight: Math.max(0.5, o.strokeWidth / 2), hachureGap: Math.max(4, o.strokeWidth * 4) });
      out.push(...gen.toPaths(fill).map((p) => ({ d: p.d, stroke: p.stroke, strokeWidth: p.strokeWidth, fill: p.fill })));
    }
    if (o.stroke && o.stroke !== "transparent" && o.stroke !== "none") {
      const dash = dashFor(o.strokeStyle, o.strokeWidth);
      const line = gen.path(d, { ...common, stroke: o.stroke, strokeWidth: o.strokeWidth, disableMultiStroke: Boolean(dash) });
      out.push(...gen.toPaths(line).map((p) => ({ d: p.d, stroke: p.stroke, strokeWidth: p.strokeWidth, fill: p.fill, dash: dash?.join(" ") })));
    }
    return out;
  });
}

/** An open line (a connector's path), hand-drawn. */
export function roughLine(d: string, o: { seed: number; rough: Sloppiness; stroke: string; width: number; style?: StrokeStyle }): RoughPath[] {
  const key = `l|${d}|${o.seed}|${o.rough}|${o.stroke}|${o.width}|${o.style || ""}`;
  return remember(key, () => {
    const dash = dashFor(o.style, o.width);
    const drawable = gen.path(d, { seed: o.seed, roughness: o.rough, bowing: 1, stroke: o.stroke, strokeWidth: o.width, disableMultiStroke: Boolean(dash), preserveVertices: true });
    return gen.toPaths(drawable).map((p) => ({ d: p.d, stroke: p.stroke, strokeWidth: p.strokeWidth, fill: p.fill, dash: dash?.join(" ") }));
  });
}
