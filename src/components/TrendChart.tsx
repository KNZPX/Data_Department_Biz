"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type Point = { key: string; added: number; removed: number; changed?: number; total: number };

function label(key: string) {
  if (key.length === 4) return key;
  if (key.length === 7) {
    const [y, m] = key.split("-");
    return `${new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-GB", { month: "short" })} ${y.slice(2)}`;
  }
  const d = new Date(`${key}T00:00:00`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/**
 * Running total as a line + area; items added (green, up) and removed (red, down)
 * as diverging bars along the bottom. Colours follow the team's convention:
 * increases green, decreases red.
 */
export function TrendChart({
  data,
  totalLabel,
  addedLabel = "Added",
  removedLabel = "Removed",
  changedLabel,
  height = 240,
}: {
  data: Point[];
  totalLabel: string;
  addedLabel?: string;
  removedLabel?: string;
  changedLabel?: string;
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pad = { l: 44, r: 12, t: 12, b: 26 };
  const innerW = w - pad.l - pad.r;
  const lineH = (height - pad.t - pad.b) * 0.62;
  const barH = (height - pad.t - pad.b) * 0.3;
  const barMid = pad.t + lineH + 10 + barH / 2;

  const m = useMemo(() => {
    const totals = data.map((d) => d.total);
    const minT = Math.min(...totals, 0);
    const maxT = Math.max(...totals, 1);
    const maxBar = Math.max(1, ...data.map((d) => Math.max(d.added, d.removed)));
    return { minT, maxT, maxBar };
  }, [data]);

  if (!data.length) return <div ref={ref} className="h-40" />;

  const step = innerW / Math.max(1, data.length);
  const x = (i: number) => pad.l + step * i + step / 2;
  const yT = (v: number) => pad.t + lineH - ((v - m.minT) / (m.maxT - m.minT || 1)) * lineH;
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i)},${yT(d.total)}`).join(" ");
  const area = `${line} L${x(data.length - 1)},${pad.t + lineH} L${x(0)},${pad.t + lineH} Z`;
  const bw = Math.max(2, Math.min(18, step * 0.55));
  const labelEvery = Math.ceil(data.length / Math.max(2, Math.floor(innerW / 70)));
  const ticks = [m.minT, (m.minT + m.maxT) / 2, m.maxT].map((v) => Math.round(v));
  const h = hover !== null ? data[hover] : null;

  return (
    <div ref={ref} className="relative w-full">
      <svg width={w} height={height} role="img" aria-label={`${totalLabel} trend`} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={w - pad.r} y1={yT(t)} y2={yT(t)} stroke="#EDF1F6" />
            <text x={pad.l - 8} y={yT(t) + 4} textAnchor="end" fontSize="11" fill="#8E9AAB">
              {t.toLocaleString()}
            </text>
          </g>
        ))}
        <path d={area} fill="var(--accent)" opacity={0.08} />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth={2.25} strokeLinejoin="round" />
        {data.length <= 60 && data.map((d, i) => <circle key={d.key} cx={x(i)} cy={yT(d.total)} r={hover === i ? 4.5 : 2.5} fill="var(--accent)" />)}

        <line x1={pad.l} x2={w - pad.r} y1={barMid} y2={barMid} stroke="#DDE3EB" />
        {data.map((d, i) => (
          <g key={`b${d.key}`}>
            {d.added > 0 && <rect x={x(i) - bw / 2} y={barMid - (d.added / m.maxBar) * (barH / 2)} width={bw} height={(d.added / m.maxBar) * (barH / 2)} rx={2} fill="#0E9F8E" />}
            {d.removed > 0 && <rect x={x(i) - bw / 2} y={barMid} width={bw} height={(d.removed / m.maxBar) * (barH / 2)} rx={2} fill="#E4572E" />}
          </g>
        ))}

        {data.map((d, i) =>
          i % labelEvery === 0 || i === data.length - 1 ? (
            <text key={`t${d.key}`} x={x(i)} y={height - 6} textAnchor="middle" fontSize="11" fill="#8E9AAB">
              {label(d.key)}
            </text>
          ) : null
        )}

        {data.map((d, i) => (
          <rect key={`h${d.key}`} x={x(i) - step / 2} y={pad.t} width={step} height={height - pad.t - pad.b} fill="transparent" onMouseEnter={() => setHover(i)} />
        ))}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={height - pad.b} stroke="#C3CCD8" strokeDasharray="3 3" pointerEvents="none" />}
      </svg>

      {h && (
        <div
          className="pointer-events-none absolute top-2 z-10 w-48 rounded-xl bg-white p-3 text-xs shadow-lg ring-1 ring-slate-200"
          style={{ left: Math.min(Math.max(0, x(hover!) - 96), w - 196) }}
        >
          <p className="mb-1.5 font-medium text-slate-900">{label(h.key)}</p>
          <p className="flex justify-between text-slate-600">
            {totalLabel} <span className="tabular-nums font-medium text-slate-900">{h.total.toLocaleString()}</span>
          </p>
          <p className="flex justify-between text-slate-600">
            {addedLabel} <span className="tabular-nums text-[#0B7F72]">▲ {h.added.toLocaleString()}</span>
          </p>
          <p className="flex justify-between text-slate-600">
            {removedLabel} <span className="tabular-nums text-coral">▼ {h.removed.toLocaleString()}</span>
          </p>
          {changedLabel && h.changed !== undefined && (
            <p className="flex justify-between text-slate-600">
              {changedLabel} <span className="tabular-nums text-slate-900">{h.changed.toLocaleString()}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
