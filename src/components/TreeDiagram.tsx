"use client";

// Top-down hierarchy diagram (org-chart style) drawn with CSS connectors.
import { clsx } from "clsx";
import type { ReactNode } from "react";

export type TreeNode = {
  id: string;
  label: string;
  sub?: string;
  color?: string;
  muted?: boolean;
  badge?: ReactNode;
  children?: TreeNode[];
  onClick?: () => void;
};

function Node({ n }: { n: TreeNode }) {
  return (
    <li>
      <button
        type="button"
        onClick={n.onClick}
        disabled={!n.onClick}
        className={clsx(
          "pop-in relative inline-flex min-w-[120px] max-w-[200px] flex-col items-center rounded-lg border bg-white px-3 py-2 text-center shadow-[0_1px_2px_rgb(16_24_40/0.06)] transition",
          n.onClick && "hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md",
          n.muted ? "border-dashed border-slate-300 opacity-60" : "border-slate-200"
        )}
        style={n.color ? { borderTop: `3px solid ${n.color}` } : undefined}
      >
        <span className="text-[12.5px] font-semibold leading-tight text-slate-900">{n.label}</span>
        {n.sub && <span className="mt-0.5 text-[11px] leading-tight text-slate-500">{n.sub}</span>}
        {n.badge && <span className="mt-1">{n.badge}</span>}
      </button>
      {n.children && n.children.length > 0 && (
        <ul>
          {n.children.map((c) => (
            <Node key={c.id} n={c} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function TreeDiagram({ root, className }: { root: TreeNode; className?: string }) {
  return (
    <div className={clsx("overflow-x-auto pb-2", className)}>
      <ul className="org-tree mx-auto w-max min-w-full">
        <Node n={root} />
      </ul>
    </div>
  );
}
