"use client";

import { useRef } from "react";
import { clsx } from "clsx";
import { appZoom } from "@/lib/zoom";

/**
 * A thin drag handle on the edge of a pane. Dragging changes the pane's width
 * live (onResize) and reports the final width once (onCommit) so it can be
 * remembered. Double-click goes back to the default. Arrow keys nudge it.
 */
export function ResizeHandle({
  width,
  min,
  max,
  edge,
  onResize,
  onCommit,
  onReset,
  label,
  className,
  fitParent,
}: {
  width: number;
  min: number;
  max: number;
  /** Which edge of the pane the handle sits on: dragging away from the pane makes it wider. */
  edge: "left" | "right";
  onResize: (w: number) => void;
  onCommit: (w: number) => void;
  onReset?: () => void;
  label: string;
  className?: string;
  /** Largest width that still fits, given the width of the pane's container (e.g. leave room for a list). */
  fitParent?: (containerWidth: number) => number;
}) {
  const start = useRef<{ x: number; w: number; max: number; z: number } | null>(null);
  const last = useRef(width);
  const clampW = (w: number, hi = max) => Math.round(Math.max(min, Math.min(hi, w)));
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={width}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      title={`${label} — drag to resize, double-click to reset`}
      onPointerDown={(e) => {
        e.preventDefault();
        const el = e.currentTarget as HTMLElement;
        el.setPointerCapture(e.pointerId);
        const container = el.parentElement?.parentElement;
        const hi = fitParent && container ? Math.max(min, Math.min(max, fitParent(container.clientWidth))) : max;
        const z = appZoom();
        const shown = (el.parentElement?.getBoundingClientRect().width ?? width * z) / z;
        start.current = { x: e.clientX, w: Math.min(width, shown), max: hi, z };
        last.current = width;
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
      }}
      onPointerMove={(e) => {
        if (!start.current) return;
        const dx = (e.clientX - start.current.x) / start.current.z;
        last.current = clampW(start.current.w + (edge === "left" ? -dx : dx), start.current.max);
        onResize(last.current);
      }}
      onPointerUp={() => {
        if (!start.current) return;
        start.current = null;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        onCommit(last.current);
      }}
      onDoubleClick={onReset}
      onKeyDown={(e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        const step = e.shiftKey ? 48 : 16;
        const grow = (e.key === "ArrowLeft") === (edge === "left");
        const w = clampW(width + (grow ? step : -step));
        onResize(w);
        onCommit(w);
      }}
      className={clsx(
        "group absolute inset-y-0 z-10 hidden w-2 cursor-col-resize touch-none outline-none lg:block",
        edge === "left" ? "-left-1" : "-right-1",
        className
      )}
    >
      <span className="absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 rounded-full bg-transparent transition-colors group-hover:bg-blue-400 group-focus-visible:bg-blue-500 group-active:bg-blue-600" />
    </div>
  );
}
