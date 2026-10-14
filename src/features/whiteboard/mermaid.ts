// Mermaid flowchart → whiteboard diagram (Excalidraw's "Mermaid to Excalidraw").
// Reads the flowchart part of Mermaid (graph / flowchart, node shapes, links
// with labels, chains, A & B, subgraphs) and lays it out in layers: each node
// sits one layer after the nodes that point to it, and the order inside a
// layer follows its neighbours so lines cross as little as possible.
import { facingSide, type ConnectorEl, type El, type FrameEl, type ShapeEl, type ShapeKind } from "./model";

type Dir = "TB" | "BT" | "LR" | "RL";
type Node = { id: string; text: string; shape: ShapeKind; order: number; groups: string[] };
type Edge = { from: string; to: string; label?: string; dotted: boolean; thick: boolean; head: "arrow" | "circle" | "bar" | null; tail: "arrow" | "circle" | "bar" | null };
type Group = { id: string; title: string; parent: string | null };

export type MermaidResult = { elements: El[]; nodes: number; edges: number; error?: string };

// Longest openers first so "([" wins over "(".
const SHAPES: [string, string, ShapeKind][] = [
  ["(((", ")))", "ellipse"],
  ["([", "])", "pill"],
  ["[[", "]]", "rect"],
  ["[(", ")]", "cylinder"],
  ["((", "))", "ellipse"],
  ["{{", "}}", "hexagon"],
  ["[/", "/]", "parallelogram"],
  ["[\\", "\\]", "parallelogram"],
  ["[/", "\\]", "parallelogram"],
  ["[\\", "/]", "parallelogram"],
  ["[", "]", "rect"],
  ["(", ")", "round"],
  ["{", "}", "diamond"],
  [">", "]", "chevron"],
];

const ID = /^[\p{L}\p{N}_][\p{L}\p{N}_:.]*/u;
// Link operators: -->, ---, -.->, -.-, ==>, ===, --o, --x, ~~~, with optional < at the start and longer dashes.
const OP = /^(<|o|x)?(-{2,}>|-{3,}|-{2,}o|-{2,}x|={2,}>|={3,}|-\.+->|-\.+-|~{3,})/;
// "-- text -->" style links with the label in the middle.
const OP_LABEL = /^(<)?(--|==|-\.)\s*([^>|]+?)\s*(-{2,}>|-{3,}|={2,}>|={3,}|\.-+>|\.-+)/;

const clean = (t: string) =>
  t
    .trim()
    .replace(/^"([\s\S]*)"$/, "$1")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .trim();

export function parseMermaid(src: string) {
  const lines = src
    .replace(/%%.*$/gm, "")
    .split(/\r?\n/)
    .flatMap((l) => l.split(";"))
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return { error: "Paste a Mermaid flowchart, e.g. “flowchart TD” then “A[Start] --> B{OK?}”." } as const;
  const head = /^(graph|flowchart)\b\s*(TD|TB|BT|LR|RL)?/i.exec(lines[0]);
  if (!head) return { error: "Only Mermaid flowcharts are supported (starting with “graph” or “flowchart”)." } as const;
  let dir: Dir = (head[2]?.toUpperCase().replace("TD", "TB") as Dir) || "TB";
  const nodes = new Map<string, Node>();
  const edges: Edge[] = [];
  const groups = new Map<string, Group>();
  const stack: string[] = [];
  let order = 0;

  const touch = (id: string, text?: string, shape?: ShapeKind) => {
    let n = nodes.get(id);
    if (!n) {
      n = { id, text: id, shape: "rect", order: order++, groups: [...stack] };
      nodes.set(id, n);
    }
    // Naming a node inside a subgraph puts it there, even if it was defined earlier.
    for (const g of stack) if (!n.groups.includes(g)) n.groups.push(g);
    if (text !== undefined) n.text = text;
    if (shape) n.shape = shape;
    return n;
  };

  for (const raw of lines.slice(1)) {
    const sub = /^subgraph\s+(.+)$/i.exec(raw);
    if (sub) {
      // subgraph id [Title] | subgraph "Title" | subgraph Title words
      const m = /^([\p{L}\p{N}_]+)\s*\[(.+)\]$/u.exec(sub[1].trim());
      const id = m ? m[1] : `sg${groups.size}`;
      groups.set(id, { id, title: clean(m ? m[2] : sub[1]), parent: stack[stack.length - 1] ?? null });
      stack.push(id);
      continue;
    }
    if (/^end$/i.test(raw)) {
      stack.pop();
      continue;
    }
    const d = /^direction\s+(TB|TD|BT|LR|RL)$/i.exec(raw);
    if (d) {
      if (!stack.length) dir = d[1].toUpperCase().replace("TD", "TB") as Dir;
      continue;
    }
    if (/^(classDef|class|style|linkStyle|click|accTitle|accDescr|title)\b/i.test(raw)) continue;

    // node (& node)* (link node (& node)*)*
    let s = raw;
    const readNode = (): string | null => {
      s = s.trimStart();
      const m = ID.exec(s);
      if (!m) return null;
      const id = m[0];
      s = s.slice(id.length);
      for (const [open, close, shape] of SHAPES) {
        if (!s.startsWith(open)) continue;
        // Quoted text may hold brackets: A["a [b] c"].
        const q = s.slice(open.length).trimStart();
        const quoted = q.startsWith('"') ? q.indexOf('"', 1) : -1;
        const from = quoted > 0 ? s.length - q.length + quoted + 1 : open.length;
        const end = s.indexOf(close, from);
        if (end < 0) continue;
        touch(id, clean(s.slice(open.length, end)), shape);
        s = s.slice(end + close.length);
        return id;
      }
      // "@{ shape: ..., label: ... }" (newer syntax): keep the label.
      const at = /^@\{([^}]*)\}/.exec(s);
      if (at) {
        const label = /label:\s*"([^"]*)"/.exec(at[1])?.[1];
        touch(id, label !== undefined ? clean(label) : undefined);
        s = s.slice(at[0].length);
        return id;
      }
      touch(id);
      return id;
    };
    const readGroup = (): string[] => {
      const ids: string[] = [];
      const first = readNode();
      if (!first) return ids;
      ids.push(first);
      for (;;) {
        const amp = /^\s*&\s*/.exec(s);
        if (!amp) break;
        s = s.slice(amp[0].length);
        const next = readNode();
        if (!next) break;
        ids.push(next);
      }
      return ids;
    };
    let left = readGroup();
    if (!left.length) continue;
    for (;;) {
      s = s.trimStart();
      let label: string | undefined;
      let op: string;
      let start = "";
      const mo = OP.exec(s);
      const ml = mo ? null : OP_LABEL.exec(s);
      if (mo) {
        start = mo[1] || "";
        op = mo[2];
        s = s.slice(mo[0].length).trimStart();
        const pipe = /^\|([^|]*)\|/.exec(s);
        if (pipe) {
          label = clean(pipe[1]) || undefined;
          s = s.slice(pipe[0].length);
        }
      } else if (ml) {
        start = ml[1] || "";
        label = clean(ml[3]) || undefined;
        op = ml[2] + ml[4];
        s = s.slice(ml[0].length);
      } else break;
      const right = readGroup();
      if (!right.length) break;
      const end = op.endsWith(">") ? "arrow" : op.endsWith("o") ? "circle" : op.endsWith("x") ? "bar" : null;
      const tail = start === "<" ? "arrow" : start === "o" ? "circle" : start === "x" ? "bar" : null;
      for (const a of left)
        for (const b of right)
          edges.push({ from: a, to: b, label, dotted: op.includes("."), thick: op.includes("="), head: op.startsWith("~") ? null : end, tail });
      left = right;
    }
  }
  if (!nodes.size) return { error: "No nodes found. Check the flowchart syntax, e.g. A[Start] --> B[End]." } as const;
  return { dir, nodes: [...nodes.values()], edges, groups: [...groups.values()] } as const;
}

/** Size a node so its text fits. */
function sizeOf(n: Node) {
  const lines = n.text.split("\n");
  const longest = Math.max(...lines.map((l) => l.length));
  let w = Math.min(280, Math.max(120, longest * 9 + 44));
  let h = Math.max(64, lines.length * 22 + 30);
  if (n.shape === "diamond") {
    w *= 1.3;
    h *= 1.5;
  } else if (n.shape === "ellipse") {
    w *= 1.12;
    h *= 1.2;
  } else if (n.shape === "hexagon" || n.shape === "parallelogram" || n.shape === "chevron") w *= 1.18;
  else if (n.shape === "cylinder") h *= 1.25;
  return { w: Math.round(w), h: Math.round(h) };
}

/**
 * Build the diagram. `make` styles the new items (colours, hand-drawn look),
 * `newId` gives fresh ids; the diagram's top-left lands at `at`.
 */
export function mermaidToElements(
  src: string,
  opts: { at: { x: number; y: number }; zFrom: number; newId: (prefix: string) => string; shape: (s: Omit<ShapeEl, "fill" | "stroke" | "textColor" | "fontSize">) => ShapeEl; line: (c: Omit<ConnectorEl, "stroke" | "width">, o: { thick: boolean }) => ConnectorEl }
): MermaidResult {
  const parsed = parseMermaid(src);
  if ("error" in parsed) return { elements: [], nodes: 0, edges: 0, error: parsed.error };
  const { dir, nodes, edges, groups } = parsed;

  // 1. Layers: drop the links that close a loop, then each node goes one layer after its parents.
  const out = new Map<string, string[]>();
  for (const n of nodes) out.set(n.id, []);
  for (const e of edges) if (e.from !== e.to) out.get(e.from)!.push(e.to);
  const state = new Map<string, 0 | 1 | 2>();
  const back = new Set<string>();
  const visit = (id: string) => {
    state.set(id, 1);
    for (const t of out.get(id)!) {
      if (state.get(t) === 1) back.add(`${id}>${t}`);
      else if (!state.get(t)) visit(t);
    }
    state.set(id, 2);
  };
  for (const n of [...nodes].sort((a, b) => a.order - b.order)) if (!state.get(n.id)) visit(n.id);
  const forward = edges.filter((e) => e.from !== e.to && !back.has(`${e.from}>${e.to}`));
  const rank = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  for (let pass = 0; pass < nodes.length; pass++) {
    let moved = false;
    for (const e of forward) {
      const r = rank.get(e.from)! + 1;
      if (r > rank.get(e.to)!) {
        rank.set(e.to, r);
        moved = true;
      }
    }
    if (!moved) break;
  }
  const layers: Node[][] = [];
  for (const n of [...nodes].sort((a, b) => a.order - b.order)) (layers[rank.get(n.id)!] ||= []).push(n);

  // 2. Order inside each layer by the average position of neighbours (a few sweeps both ways).
  const pos = new Map<string, number>();
  const index = () => layers.forEach((l) => l.forEach((n, i) => pos.set(n.id, i)));
  index();
  const parents = (id: string) => forward.filter((e) => e.to === id).map((e) => e.from);
  const children = (id: string) => forward.filter((e) => e.from === id).map((e) => e.to);
  const avg = (ids: string[], fb: number) => (ids.length ? ids.reduce((a, i) => a + pos.get(i)!, 0) / ids.length : fb);
  for (let sweep = 0; sweep < 4; sweep++) {
    const down = sweep % 2 === 0;
    const seq = down ? layers.slice(1) : layers.slice(0, -1).reverse();
    for (const l of seq) {
      l.sort((a, b) => avg(down ? parents(a.id) : children(a.id), pos.get(a.id)!) - avg(down ? parents(b.id) : children(b.id), pos.get(b.id)!));
      l.forEach((n, i) => pos.set(n.id, i));
    }
  }

  // 3. Coordinates: layers along the flow, nodes side by side across it, each layer centred.
  const horizontal = dir === "LR" || dir === "RL";
  const sizes = new Map(nodes.map((n) => [n.id, sizeOf(n)]));
  const GAP_FLOW = 90;
  const GAP_SIDE = 60;
  const thick = layers.map((l) => Math.max(...l.map((n) => (horizontal ? sizes.get(n.id)!.w : sizes.get(n.id)!.h))));
  const spans = layers.map((l) => l.reduce((a, n) => a + (horizontal ? sizes.get(n.id)!.h : sizes.get(n.id)!.w), 0) + GAP_SIDE * (l.length - 1));
  const widest = Math.max(...spans);
  const place = new Map<string, { x: number; y: number; w: number; h: number }>();
  let flow = 0;
  const order = dir === "BT" || dir === "RL" ? [...layers.keys()].reverse() : [...layers.keys()];
  for (const li of order) {
    const l = layers[li];
    let side = (widest - spans[li]) / 2;
    for (const n of l) {
      const s = sizes.get(n.id)!;
      const along = flow + (thick[li] - (horizontal ? s.w : s.h)) / 2;
      place.set(n.id, horizontal ? { x: along, y: side, w: s.w, h: s.h } : { x: side, y: along, w: s.w, h: s.h });
      side += (horizontal ? s.h : s.w) + GAP_SIDE;
    }
    flow += thick[li] + GAP_FLOW;
  }

  // 4. Items. Subgraphs become frames around their nodes.
  let z = opts.zFrom;
  const ids = new Map(nodes.map((n) => [n.id, opts.newId("el")]));
  const shift = (r: { x: number; y: number; w: number; h: number }) => ({ x: Math.round(opts.at.x + r.x), y: Math.round(opts.at.y + r.y), w: r.w, h: r.h });
  const elements: El[] = [];
  const PAD = 28;
  for (const g of groups) {
    const members = nodes.filter((n) => n.groups.includes(g.id));
    if (!members.length) continue;
    const rs = members.map((n) => place.get(n.id)!);
    const depth = (id: string | null): number => (id ? 1 + depth(groups.find((x) => x.id === id)?.parent ?? null) : 0);
    const pad = PAD + 14 * (3 - Math.min(3, depth(g.id)));
    const x = Math.min(...rs.map((r) => r.x)) - pad;
    const y = Math.min(...rs.map((r) => r.y)) - pad;
    const fr: FrameEl = { id: opts.newId("fr"), kind: "frame", ...shift({ x, y, w: Math.max(...rs.map((r) => r.x + r.w)) + pad - x, h: Math.max(...rs.map((r) => r.y + r.h)) + pad - y }), z: -1e6 + depth(g.id), title: g.title, fill: "#F5F6F8" };
    elements.push(fr);
  }
  for (const n of nodes) elements.push(opts.shape({ id: ids.get(n.id)!, kind: "shape", shape: n.shape, ...shift(place.get(n.id)!), z: ++z, text: n.text }));
  const rect = (id: string) => shift(place.get(id)!);
  for (const e of edges) {
    const a = rect(e.from);
    const b = rect(e.to);
    // Links that loop back (or stay in a layer) go round the outside instead of cutting through.
    const loop = e.from === e.to || rank.get(e.to)! <= rank.get(e.from)!;
    const outer = horizontal ? "bottom" : "right";
    const sa = loop ? outer : facingSide(a, b);
    const sb = loop ? outer : facingSide(b, a);
    elements.push(
      opts.line({
        id: opts.newId("cx"),
        kind: "connector",
        z: ++z,
        from: { id: ids.get(e.from)!, side: sa, x: 0, y: 0 },
        to: { id: ids.get(e.to)!, side: sb, x: 0, y: 0 },
        route: "curve",
        dashed: e.dotted || undefined,
        arrowEnd: Boolean(e.head),
        arrowStart: Boolean(e.tail),
        headEnd: e.head ?? undefined,
        headStart: e.tail ?? undefined,
        label: e.label,
      },
      { thick: e.thick }
      )
    );
  }
  return { elements, nodes: nodes.length, edges: edges.length };
}
