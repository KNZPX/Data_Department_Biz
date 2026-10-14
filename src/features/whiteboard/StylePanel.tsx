"use client";

// Excalidraw's properties, for whatever is selected: how hand-drawn it looks
// (sloppiness), fill style, stroke width and style, font and opacity. Each
// choice also becomes the default for new items, like Excalidraw.
import { clsx } from "clsx";
import { fmtOf, type El, type FillStyle, type FontKind, type Sloppiness, type StrokeStyle, FONT_STACK } from "./model";
import { ACTIVE_BTN } from "./ui";

/** The style new shapes, lines and text start with. */
export type CurStyle = { rough: Sloppiness; fillStyle: FillStyle; strokeStyle: StrokeStyle; strokeWidth?: number; font: FontKind };
export const DEFAULT_STYLE: CurStyle = { rough: 0, fillStyle: "solid", strokeStyle: "solid", font: "normal" };
export const SKETCH_STYLE: CurStyle = { rough: 1, fillStyle: "hachure", strokeStyle: "solid", strokeWidth: 2, font: "hand" };

const textual = (e: El) => e.kind === "sticky" || e.kind === "shape" || e.kind === "text";
const stroked = (e: El) => e.kind === "shape" || e.kind === "connector";

export function StylePanel({ selected, onUpdate, onDefaults }: { selected: El[]; onUpdate: (fn: (el: El) => El) => void; onDefaults: (patch: Partial<CurStyle>) => void }) {
  const shapes = selected.filter((e) => e.kind === "shape");
  const lines = selected.filter((e) => e.kind === "connector");
  const texts = selected.filter(textual);
  const first = selected[0];
  const rough: Sloppiness = (first && (first.kind === "shape" || first.kind === "connector") ? first.rough : 0) ?? 0;
  const fillStyle: FillStyle = (shapes[0]?.kind === "shape" && shapes[0].fillStyle) || "solid";
  const noFill = shapes[0]?.kind === "shape" && shapes[0].fill === "transparent";
  const strokeStyle: StrokeStyle =
    first?.kind === "shape" ? (first.strokeStyle ?? "solid") : first?.kind === "connector" ? (first.dotted ? "dotted" : first.dashed ? "dashed" : "solid") : "solid";
  const width = first?.kind === "shape" ? first.strokeWidth : first?.kind === "connector" ? first.width : undefined;
  const font: FontKind = (texts[0] && fmtOf(texts[0]).font) || "normal";
  const alpha = Math.round(((first && "alpha" in first ? first.alpha : undefined) ?? 1) * 100);

  const set = (fn: (el: El) => El, defaults?: Partial<CurStyle>) => {
    onUpdate(fn);
    if (defaults) onDefaults(defaults);
  };
  const btn = (on: boolean) => clsx("grid h-9 w-9 place-items-center rounded-md transition", on ? ACTIVE_BTN : "text-[#1C1C1E] hover:bg-[#F1F2F5]");

  return (
    <div className="w-[236px] space-y-3 text-[12px]">
      {(shapes.length > 0 || lines.length > 0) && (
        <Row label="Look">
          {(
            [
              [0, "Clean", "M3 13 C 8 13, 12 5, 21 5"],
              [1, "Hand-drawn", "M3 13 C 7 12, 9 6, 13 8 S 18 5, 21 5"],
              [2, "Sketchy", "M3 13 C 5 9, 8 14, 10 8 S 14 11, 16 6 S 20 7, 21 4"],
            ] as [Sloppiness, string, string][]
          ).map(([v, label, d]) => (
            <button
              key={v}
              type="button"
              title={label}
              aria-label={label}
              aria-pressed={rough === v}
              className={btn(rough === v)}
              onClick={() => set((el) => (el.kind === "shape" || el.kind === "connector" ? { ...el, rough: v || undefined } : el), { rough: v })}
            >
              <svg width="24" height="18" viewBox="0 0 24 18" fill="none">
                <path d={d} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                {v === 2 && <path d="M3 14.5 C 8 13, 13 7, 21 6.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity=".6" />}
              </svg>
            </button>
          ))}
        </Row>
      )}
      {shapes.length > 0 && (
        <Row label="Fill">
          {(
            [
              ["solid", "Solid"],
              ["hachure", "Hatched"],
              ["cross-hatch", "Cross-hatched"],
              ["dots", "Dots"],
            ] as [FillStyle, string][]
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              title={label}
              aria-label={label}
              aria-pressed={!noFill && fillStyle === v}
              className={btn(!noFill && fillStyle === v)}
              onClick={() => set((el) => (el.kind === "shape" ? { ...el, fillStyle: v === "solid" ? undefined : v, fill: el.fill === "transparent" ? "#FFFFFF" : el.fill } : el), { fillStyle: v })}
            >
              <FillIcon kind={v} />
            </button>
          ))}
          <button
            type="button"
            title="No fill"
            aria-label="No fill"
            aria-pressed={noFill}
            className={btn(noFill)}
            onClick={() => set((el) => (el.kind === "shape" ? { ...el, fill: noFill ? "#FFFFFF" : "transparent" } : el))}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <rect x="2.5" y="2.5" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M3 15 15 3" stroke="#F24726" strokeWidth="1.5" />
            </svg>
          </button>
        </Row>
      )}
      {(shapes.length > 0 || lines.length > 0) && (
        <>
          <Row label="Stroke">
            {(
              [
                [1, "Thin"],
                [2, "Bold"],
                [4, "Extra bold"],
              ] as [number, string][]
            ).map(([w, label]) => (
              <button
                key={w}
                type="button"
                title={label}
                aria-label={label}
                aria-pressed={width === w}
                className={btn(width === w)}
                onClick={() => set((el) => (el.kind === "shape" ? { ...el, strokeWidth: w } : el.kind === "connector" ? { ...el, width: w } : el), { strokeWidth: w })}
              >
                <span className="block w-5 rounded-full bg-current" style={{ height: w === 1 ? 1.5 : w === 2 ? 3 : 5 }} />
              </button>
            ))}
            <span className="mx-0.5 h-6 w-px bg-[#E9EAEF]" />
            {(
              [
                ["solid", "Solid", undefined],
                ["dashed", "Dashed", "5 4"],
                ["dotted", "Dotted", "1.5 3.5"],
              ] as [StrokeStyle, string, string | undefined][]
            ).map(([v, label, dash]) => (
              <button
                key={v}
                type="button"
                title={label}
                aria-label={label}
                aria-pressed={strokeStyle === v}
                className={btn(strokeStyle === v)}
                onClick={() =>
                  set(
                    (el) =>
                      el.kind === "shape"
                        ? { ...el, strokeStyle: v === "solid" ? undefined : v }
                        : el.kind === "connector"
                          ? { ...el, dashed: v === "dashed" || undefined, dotted: v === "dotted" || undefined }
                          : el,
                    { strokeStyle: v }
                  )
                }
              >
                <svg width="20" height="8" viewBox="0 0 20 8" fill="none">
                  <path d="M1 4H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray={dash} />
                </svg>
              </button>
            ))}
          </Row>
        </>
      )}
      {texts.length > 0 && (
        <Row label="Font">
          {(
            [
              ["hand", "Hand-drawn"],
              ["normal", "Normal"],
              ["code", "Code"],
            ] as [FontKind, string][]
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              title={label}
              aria-label={`${label} font`}
              aria-pressed={font === v}
              className={clsx(btn(font === v), "w-auto px-2.5 text-[14px]")}
              style={{ fontFamily: FONT_STACK[v] }}
              onClick={() => set((el) => (textual(el) ? ({ ...el, fmt: { ...fmtOf(el), font: v === "normal" ? undefined : v } } as El) : el), { font: v })}
            >
              Aa
            </button>
          ))}
        </Row>
      )}
      <div>
        <p className="mb-1 flex justify-between font-semibold text-[#656B81]">
          Opacity <span className="font-normal tabular-nums">{alpha}%</span>
        </p>
        <input
          type="range"
          min={10}
          max={100}
          step={10}
          value={alpha}
          onChange={(e) => {
            const a = Number(e.target.value) / 100;
            onUpdate((el) => (el.kind === "draw" ? el : ({ ...el, alpha: a >= 1 ? undefined : a } as El)));
          }}
          className="w-full accent-[#4262FF]"
          aria-label="Opacity"
        />
      </div>
      {selected.some(stroked) && <p className="text-[11px] leading-snug text-[#9A9DAA]">New items use these settings too.</p>}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 font-semibold text-[#656B81]">{label}</p>
      <div className="flex flex-wrap items-center gap-0.5">{children}</div>
    </div>
  );
}

function FillIcon({ kind }: { kind: FillStyle }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <defs>
        <clipPath id={`fi-${kind}`}>
          <rect x="2.5" y="2.5" width="13" height="13" rx="2" />
        </clipPath>
      </defs>
      {kind === "solid" && <rect x="2.5" y="2.5" width="13" height="13" rx="2" fill="currentColor" opacity=".35" />}
      <g clipPath={`url(#fi-${kind})`} stroke="currentColor" strokeWidth="1.1">
        {(kind === "hachure" || kind === "cross-hatch") && [0, 4, 8, 12, 16, 20].map((o) => <path key={o} d={`M${o - 4} 18 L${o + 10} 0`} />)}
        {kind === "cross-hatch" && [0, 4, 8, 12, 16, 20].map((o) => <path key={`x${o}`} d={`M${o - 6} 0 L${o + 8} 18`} />)}
        {kind === "dots" && [4.5, 9, 13.5].flatMap((x) => [4.5, 9, 13.5].map((y) => <circle key={`${x}${y}`} cx={x} cy={y} r=".9" fill="currentColor" stroke="none" />))}
      </g>
      <rect x="2.5" y="2.5" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
