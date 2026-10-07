// Turns a hand-drawn stroke (Apple Pencil, mouse) into a clean shape:
// rectangle, ellipse, triangle, diamond, or a straight line.
// Pure geometry, no DOM — the board calls it when a stroke is held or finished.

export type Pt = [number, number];
export type Recognized =
  | { kind: "rect" | "ellipse" | "triangle" | "diamond"; x: number; y: number; w: number; h: number }
  | { kind: "line"; a: { x: number; y: number }; b: { x: number; y: number } };

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function pathLength(pts: Pt[]) {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += dist(pts[i - 1], pts[i]);
  return l;
}

/** Evenly spaced copy of the stroke, so dense and sparse parts weigh the same. */
function resample(pts: Pt[], n: number): Pt[] {
  const total = pathLength(pts);
  if (total === 0) return [pts[0]];
  const step = total / (n - 1);
  const out: Pt[] = [pts[0]];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    let a = pts[i - 1];
    const b = pts[i];
    let d = dist(a, b);
    while (acc + d >= step && d > 0) {
      const t = (step - acc) / d;
      const q: Pt = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      out.push(q);
      a = q;
      d = dist(a, b);
      acc = 0;
    }
    acc += d;
  }
  while (out.length < n) out.push(pts[pts.length - 1]);
  return out.slice(0, n);
}

function segDist(p: Pt, a: Pt, b: Pt) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Ramer–Douglas–Peucker: the stroke's corners. */
function simplify(pts: Pt[], eps: number): Pt[] {
  if (pts.length < 3) return pts;
  let max = 0;
  let idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = segDist(pts[i], pts[0], pts[pts.length - 1]);
    if (d > max) {
      max = d;
      idx = i;
    }
  }
  if (max <= eps) return [pts[0], pts[pts.length - 1]];
  return [...simplify(pts.slice(0, idx + 1), eps).slice(0, -1), ...simplify(pts.slice(idx), eps)];
}

/** Corners of a closed stroke: simplify from the point farthest from the start, then merge near-duplicates. */
function corners(pts: Pt[], eps: number): Pt[] {
  let far = 0;
  for (let i = 1; i < pts.length; i++) if (dist(pts[i], pts[0]) > dist(pts[far], pts[0])) far = i;
  const loop = [...pts.slice(far), ...pts.slice(1, far + 1)];
  const c = simplify(loop, eps).slice(0, -1);
  // Drop corners that are almost straight (angle close to 180°).
  const out: Pt[] = [];
  for (let i = 0; i < c.length; i++) {
    const p = c[(i - 1 + c.length) % c.length];
    const q = c[i];
    const r = c[(i + 1) % c.length];
    const a1 = Math.atan2(p[1] - q[1], p[0] - q[0]);
    const a2 = Math.atan2(r[1] - q[1], r[0] - q[0]);
    let ang = Math.abs(a1 - a2);
    if (ang > Math.PI) ang = 2 * Math.PI - ang;
    if (ang < (160 * Math.PI) / 180) out.push(q);
  }
  return out;
}

export function recognizeShape(raw: Pt[]): Recognized | null {
  if (raw.length < 4) return null;
  const len = pathLength(raw);
  const xs = raw.map((p) => p[0]);
  const ys = raw.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const w = Math.max(...xs) - x;
  const h = Math.max(...ys) - y;
  const diag = Math.hypot(w, h);
  if (diag < 12) return null;
  const first = raw[0];
  const last = raw[raw.length - 1];

  // Straight line: the ends are almost as far apart as the stroke is long.
  if (dist(first, last) / len > 0.94) return { kind: "line", a: { x: first[0], y: first[1] }, b: { x: last[0], y: last[1] } };

  // Everything else has to come back near where it started.
  if (dist(first, last) > Math.max(0.22 * diag, 0.12 * len)) return null;
  if (Math.min(w, h) < 0.12 * Math.max(w, h)) return null;

  const pts = resample(raw, 96);
  const cx = x + w / 2;
  const cy = y + h / 2;

  // Ellipse fit: every point about one radius out from the centre.
  const ellErr = pts.reduce((s, p) => s + Math.abs(Math.hypot((p[0] - cx) / (w / 2), (p[1] - cy) / (h / 2)) - 1), 0) / pts.length;

  // Rectangle fit: every point close to the bounding box's edge.
  const rectErr =
    pts.reduce((s, p) => s + Math.min(Math.abs(p[0] - x), Math.abs(p[0] - x - w), Math.abs(p[1] - y), Math.abs(p[1] - y - h)), 0) / pts.length / diag;

  const c = corners(pts, 0.07 * diag);

  if (c.length === 3) return { kind: "triangle", x, y, w, h };
  if (c.length === 4) {
    // Corners near the box's corners → rectangle; near the middle of its sides → diamond.
    const boxCorners: Pt[] = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
    const mids: Pt[] = [[cx, y], [x + w, cy], [cx, y + h], [x, cy]];
    const toCorner = c.reduce((s, p) => s + Math.min(...boxCorners.map((b) => dist(p, b))), 0);
    const toMid = c.reduce((s, p) => s + Math.min(...mids.map((b) => dist(p, b))), 0);
    if (toMid < toCorner && toMid / 4 < 0.15 * diag) return { kind: "diamond", x, y, w, h };
    if (rectErr < 0.06) return { kind: "rect", x, y, w, h };
  }
  if (ellErr < 0.16 && c.length !== 3 && c.length !== 4) return { kind: "ellipse", x, y, w, h };
  if (ellErr < 0.1) return { kind: "ellipse", x, y, w, h };
  if (rectErr < 0.035) return { kind: "rect", x, y, w, h };
  return null;
}

/**
 * For "Convert to shape" on a stroke that's already on the board: the clean
 * shape if it's recognised, otherwise the closest fit — a closed stroke becomes
 * whichever of rectangle / ellipse it hugs better, an open one a straight line
 * between its ends. Only tiny strokes give null.
 */
export function fitShape(raw: Pt[]): Recognized | null {
  const r = recognizeShape(raw);
  if (r) return r;
  if (raw.length < 2) return null;
  const xs = raw.map((p) => p[0]);
  const ys = raw.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const w = Math.max(...xs) - x;
  const h = Math.max(...ys) - y;
  const diag = Math.hypot(w, h);
  if (diag < 12) return null;
  const first = raw[0];
  const last = raw[raw.length - 1];
  const len = pathLength(raw);
  const closed = dist(first, last) <= Math.max(0.35 * diag, 0.2 * len) && Math.min(w, h) >= 0.08 * Math.max(w, h);
  if (!closed) return { kind: "line", a: { x: first[0], y: first[1] }, b: { x: last[0], y: last[1] } };
  const pts = resample(raw, 96);
  const cx = x + w / 2;
  const cy = y + h / 2;
  // Both errors as an average distance (world units) from the candidate outline.
  const ell = pts.reduce((s, p) => s + Math.abs(Math.hypot((p[0] - cx) / (w / 2), (p[1] - cy) / (h / 2)) - 1) * Math.min(w, h) / 2, 0) / pts.length;
  const rect = pts.reduce((s, p) => s + Math.min(Math.abs(p[0] - x), Math.abs(p[0] - x - w), Math.abs(p[1] - y), Math.abs(p[1] - y - h)), 0) / pts.length;
  return { kind: ell < rect ? "ellipse" : "rect", x, y, w, h };
}
