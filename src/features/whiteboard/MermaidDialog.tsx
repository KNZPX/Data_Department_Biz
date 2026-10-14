"use client";

// Text to diagram: paste a Mermaid flowchart and get shapes and lines on the
// board (Excalidraw's "Mermaid to Excalidraw"). A live preview shows the layout.
import { useEffect, useMemo, useState } from "react";
import { Wand2, X } from "lucide-react";
import { clsx } from "clsx";
import { connectorPath, type El, type ShapeKind } from "./model";
import { mermaidToElements } from "./mermaid";
import { DIALOG } from "./ui";

const SAMPLE = `flowchart TD
  A([ผู้ป่วยมาถึง]) --> B{มีนัดหมาย?}
  B -->|มี| C[ลงทะเบียน]
  B -->|ไม่มี| D[คิว Walk-in]
  C & D --> E((พบแพทย์))
  E --> F[(บันทึก HIS)]
  E -.->|นัดครั้งต่อไป| A`;

export function MermaidDialog({ shapePath, onInsert, onClose }: { shapePath: (k: ShapeKind, w: number, h: number) => string; onInsert: (src: string) => void; onClose: () => void }) {
  const [src, setSrc] = useState(SAMPLE);
  const preview = useMemo(() => {
    let n = 0;
    return mermaidToElements(src, {
      at: { x: 0, y: 0 },
      zFrom: 0,
      newId: (p) => `${p}${++n}`,
      shape: (s) => ({ ...s, fill: "#FFFFFF", stroke: "#1C1C1E", textColor: "#1C1C1E", fontSize: 14 }),
      line: (c, o) => ({ ...c, stroke: "#656B81", width: o.thick ? 3 : 1.5 }),
    });
  }, [src]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div data-ui className="fixed inset-0 z-[90] grid place-items-center bg-[#1C1C1E]/30 p-4" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="wb-mermaid-title" className={clsx(DIALOG, "max-w-[1000px]")}>
        <div className="flex items-center justify-between border-b border-[#E9EAEF] px-5 py-3.5">
          <div>
            <h2 id="wb-mermaid-title" className="text-[16px] font-semibold text-[#1C1C1E]">
              Text to diagram
            </h2>
            <p className="text-[12.5px] text-[#656B81]">Paste a Mermaid flowchart (from ChatGPT, Claude, GitHub…). It becomes shapes and lines you can edit.</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-[#656B81] hover:bg-[#F1F2F5]" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-5 md:grid-cols-2">
          <div className="flex min-h-[300px] flex-col">
            <textarea
              value={src}
              onChange={(e) => setSrc(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !preview.error) onInsert(src);
              }}
              spellCheck={false}
              style={{ outline: "none" }}
              className="min-h-[300px] flex-1 resize-none rounded-lg border border-[#E0E2E8] bg-[#FAFAFB] p-3 font-mono text-[13px] leading-relaxed text-[#1C1C1E] outline-none focus:border-[#4262FF] focus:bg-white"
              aria-label="Mermaid flowchart"
            />
            <p className="mt-2 text-[11.5px] leading-snug text-[#9A9DAA]">
              Shapes: A[box] A(round) A([pill]) A{"{"}decision{"}"} A((circle)) A[(database)] A{"{{"}hexagon{"}}"} · Links: --&gt; --- -.-&gt; ==&gt; with |label| · subgraph … end
            </p>
          </div>
          <div className="flex min-h-[300px] flex-col overflow-hidden rounded-lg border border-[#E9EAEF] bg-[#F7F7F8]">
            {preview.error ? (
              <p className="m-auto max-w-[80%] text-center text-[13px] text-[#C22B12]">{preview.error}</p>
            ) : (
              <Preview elements={preview.elements} shapePath={shapePath} />
            )}
            <p className="border-t border-[#E9EAEF] bg-white px-3 py-1.5 text-[12px] text-[#656B81]">{preview.error ? "—" : `${preview.nodes} shapes · ${preview.edges} lines`}</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[#E9EAEF] px-5 py-3">
          <button type="button" onClick={onClose} className="h-9 rounded-lg px-3 text-[13.5px] font-medium text-[#656B81] hover:bg-[#F1F2F5]">
            Cancel
          </button>
          <button
            type="button"
            disabled={Boolean(preview.error)}
            onClick={() => onInsert(src)}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-[#4262FF] px-4 text-[13.5px] font-semibold text-white hover:bg-[#3550E6] disabled:opacity-50"
          >
            <Wand2 className="h-4 w-4" /> Insert <span className="font-normal opacity-70">Ctrl+Enter</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function Preview({ elements, shapePath }: { elements: El[]; shapePath: (k: ShapeKind, w: number, h: number) => string }) {
  const byId = new Map(elements.map((e) => [e.id, e]));
  const boxes = elements.filter((e) => e.kind !== "connector") as Extract<El, { x: number }>[];
  if (!boxes.length) return null;
  const x0 = Math.min(...boxes.map((b) => b.x)) - 20;
  const y0 = Math.min(...boxes.map((b) => b.y)) - 20;
  const x1 = Math.max(...boxes.map((b) => b.x + b.w)) + 20;
  const y1 = Math.max(...boxes.map((b) => b.y + b.h)) + 20;
  return (
    <svg viewBox={`${x0} ${y0} ${x1 - x0} ${y1 - y0}`} className="h-full max-h-[440px] w-full flex-1" role="img" aria-label="Diagram preview">
      <defs>
        <marker id="mm-head" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#656B81" />
        </marker>
      </defs>
      {elements.map((e) =>
        e.kind === "frame" ? (
          <g key={e.id}>
            <rect x={e.x} y={e.y} width={e.w} height={e.h} rx={6} fill="#EEF0F5" stroke="#D5D8E0" />
            <text x={e.x + 8} y={e.y - 6} fontSize={12} fill="#656B81">
              {e.title}
            </text>
          </g>
        ) : null
      )}
      {elements.map((e) => {
        if (e.kind !== "connector") return null;
        const p = connectorPath(e, byId);
        return (
          <g key={e.id}>
            <path d={p.d} fill="none" stroke="#656B81" strokeWidth={e.width} strokeDasharray={e.dashed ? "6 5" : undefined} markerEnd={e.arrowEnd ? "url(#mm-head)" : undefined} markerStart={e.arrowStart ? "url(#mm-head)" : undefined} />
            {e.label && (
              <text x={p.mid.x} y={p.mid.y} fontSize={12} textAnchor="middle" dominantBaseline="middle" fill="#1C1C1E" paintOrder="stroke" stroke="#F7F7F8" strokeWidth={4}>
                {e.label}
              </text>
            )}
          </g>
        );
      })}
      {elements.map((e) =>
        e.kind === "shape" ? (
          <g key={e.id} transform={`translate(${e.x},${e.y})`}>
            <path d={shapePath(e.shape, e.w, e.h)} fill="#FFFFFF" stroke="#1C1C1E" strokeWidth={1.5} />
            {e.text.split("\n").map((line, i, all) => (
              <text key={i} x={e.w / 2} y={e.h / 2 + (i - (all.length - 1) / 2) * 17} fontSize={14} textAnchor="middle" dominantBaseline="middle" fill="#1C1C1E">
                {line}
              </text>
            ))}
          </g>
        ) : null
      )}
    </svg>
  );
}
