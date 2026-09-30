"use client";

import { useMemo, useState } from "react";
import { FolderInput, MoreHorizontal, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { clsx } from "clsx";
import { TEMPLATES, boundsOf, connectorPath, isBox, type El, type Template } from "./model";

export type GalleryBoard = {
  id: string;
  name: string;
  folder_id: string;
  folder_name: string;
  description?: string;
  updated_at?: string;
  elements: El[];
};

function relTime(iso?: string) {
  if (!iso) return "";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "Edited just now";
  if (m < 60) return `Edited ${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `Edited ${h} h ago`;
  return `Edited ${new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
}

export function Thumb({ elements, w = 320, h = 180 }: { elements: El[]; w?: number; h?: number }) {
  const byId = new Map(elements.map((e) => [e.id, e]));
  const b = boundsOf(elements, byId);
  if (!b) return <div className="h-full w-full" />;
  const pad = 16;
  const s = Math.min((w - pad * 2) / Math.max(b.w, 1), (h - pad * 2) / Math.max(b.h, 1), 0.6);
  const ox = (w - b.w * s) / 2 - b.x * s;
  const oy = (h - b.h * s) / 2 - b.y * s;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" aria-hidden>
      <g transform={`translate(${ox},${oy}) scale(${s})`}>
        {elements
          .filter((e) => e.kind === "frame")
          .map((e) => isBox(e) && <rect key={e.id} x={e.x} y={e.y} width={e.w} height={e.h} rx={6} fill={e.kind === "frame" ? e.fill : "#fff"} stroke="#DDE3EB" strokeWidth={2 / s} />)}
        {elements
          .filter((e) => e.kind === "connector")
          .map((e) => e.kind === "connector" && <path key={e.id} d={connectorPath(e, byId).d} fill="none" stroke="#8E9AAB" strokeWidth={1.5 / s} />)}
        {elements
          .filter((e) => isBox(e) && e.kind !== "frame")
          .map((e) => {
            if (!isBox(e)) return null;
            const fill = e.kind === "sticky" ? e.color : e.kind === "shape" ? e.fill : "#FFFFFF";
            const stroke = e.kind === "shape" ? e.stroke : e.kind === "card" ? e.accent : "none";
            if (e.kind === "text") return <rect key={e.id} x={e.x} y={e.y + e.h / 3} width={e.w * 0.8} height={e.h / 3} rx={2} fill="#C3CCD8" />;
            if (e.kind === "draw") return <polyline key={e.id} transform={`translate(${e.x},${e.y})`} points={e.points.map((q) => q.join(",")).join(" ")} fill="none" stroke={e.stroke} strokeWidth={2 / s} />;
            return (
              <rect key={e.id} x={e.x} y={e.y} width={e.w} height={e.h} rx={e.kind === "shape" && e.shape === "ellipse" ? e.h / 2 : 6} fill={fill} stroke={stroke} strokeWidth={2 / s} />
            );
          })}
      </g>
    </svg>
  );
}

export function BoardGallery({
  boards,
  loading,
  onOpen,
  onCreate,
  onRename,
  onMove,
  onDelete,
}: {
  boards: GalleryBoard[];
  loading: boolean;
  onOpen: (id: string) => void;
  onCreate: (template: Template, folder: { id: string; name: string }) => void;
  onRename: (id: string, name: string) => void;
  onMove: (id: string, folder: { id: string; name: string }) => void;
  onDelete: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [folder, setFolder] = useState<string>("all");
  const [picker, setPicker] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);

  const folders = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    for (const b of boards) {
      const f = map.get(b.folder_id) || { id: b.folder_id, name: b.folder_name, count: 0 };
      f.count++;
      map.set(b.folder_id, f);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [boards]);

  const shown = boards.filter(
    (b) => (folder === "all" || b.folder_id === folder) && (!q.trim() || b.name.toLowerCase().includes(q.toLowerCase()))
  );
  const activeFolder = folders.find((f) => f.id === folder);

  function askFolder(): { id: string; name: string } | null {
    const name = window.prompt("Folder name", activeFolder?.name || "General Workflows");
    if (!name?.trim()) return null;
    const existing = folders.find((f) => f.name.toLowerCase() === name.trim().toLowerCase());
    return existing ? { id: existing.id, name: existing.name } : { id: `folder_${name.trim().toLowerCase().replace(/[^a-z0-9ก-๙]+/g, "_")}`, name: name.trim() };
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl pb-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-[30px] font-semibold tracking-tight text-slate-900">Boards</h2>
            <p className="mt-1 text-[15px] text-slate-500">Sketch data flows, run retros and plan dashboards together — changes show up live for everyone on the board.</p>
          </div>
          <button
            type="button"
            onClick={() => setPicker(true)}
            className="inline-flex items-center gap-2 self-start rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            New board
          </button>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Find a board"
              className="w-60 rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-400"
            />
          </div>
          {[{ id: "all", name: "All boards", count: boards.length }, ...folders].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFolder(f.id)}
              className={clsx(
                "rounded-xl px-3 py-2 text-sm transition",
                folder === f.id ? "bg-ink text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-slate-300"
              )}
            >
              {f.name} <span className={folder === f.id ? "text-slate-400" : "text-slate-400"}>{f.count}</span>
            </button>
          ))}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loading && [0, 1, 2].map((i) => <div key={i} className="h-60 animate-pulse rounded-2xl bg-white ring-1 ring-slate-200" />)}
          {!loading && shown.length === 0 && (
            <button type="button" onClick={() => setPicker(true)} className="col-span-full rounded-2xl border border-dashed border-slate-300 p-10 text-center hover:border-blue-400">
              <p className="text-[15px] font-medium text-slate-900">No boards here yet</p>
              <p className="mt-1 text-sm text-slate-500">Start one from a template.</p>
            </button>
          )}
          {shown.map((b) => (
            <div key={b.id} className="group relative overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/80 transition hover:ring-blue-300">
              <button type="button" onClick={() => onOpen(b.id)} className="block w-full text-left">
                <div className="h-44 border-b border-slate-100 bg-[radial-gradient(circle,rgba(14,27,46,.10)_1px,transparent_1.4px)] [background-size:16px_16px]">
                  <Thumb elements={b.elements} />
                </div>
                <div className="p-4 pr-12">
                  <p className="truncate text-[15px] font-medium text-slate-900">{b.name}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {b.folder_name}, {relTime(b.updated_at)}
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setMenu(menu === b.id ? null : b.id)}
                className="absolute bottom-4 right-3 grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Board actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {menu === b.id && (
                <div className="absolute bottom-14 right-3 z-10 w-44 rounded-xl bg-white p-1 text-sm shadow-lg ring-1 ring-slate-200">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-slate-50"
                    onClick={() => {
                      setMenu(null);
                      const n = window.prompt("Rename board", b.name);
                      if (n?.trim()) onRename(b.id, n.trim());
                    }}
                  >
                    <Pencil className="h-4 w-4 text-slate-400" /> Rename
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-slate-50"
                    onClick={() => {
                      setMenu(null);
                      const f = askFolder();
                      if (f) onMove(b.id, f);
                    }}
                  >
                    <FolderInput className="h-4 w-4 text-slate-400" /> Move to folder
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-coral hover:bg-coral/10"
                    onClick={() => {
                      setMenu(null);
                      if (window.confirm(`Delete "${b.name}" for everyone? This can't be undone.`)) onDelete(b.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" /> Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {picker && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 backdrop-blur-[2px]" onClick={() => setPicker(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="tpl-title" className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h3 id="tpl-title" className="text-lg font-semibold text-slate-900">New board</h3>
                <p className="text-sm text-slate-500">Saved in {activeFolder?.name || "General Workflows"}</p>
              </div>
              <button type="button" onClick={() => setPicker(false)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {TEMPLATES.map((t) => {
                const preview = t.build();
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setPicker(false);
                      onCreate(t, activeFolder ? { id: activeFolder.id, name: activeFolder.name } : { id: "folder_general", name: "General Workflows" });
                    }}
                    className="overflow-hidden rounded-xl text-left ring-1 ring-slate-200 transition hover:ring-blue-400"
                  >
                    <div className="h-28 bg-slate-50">
                      {preview.length ? <Thumb elements={preview} w={260} h={112} /> : <div className="grid h-full place-items-center text-slate-300"><Plus className="h-6 w-6" /></div>}
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-medium text-slate-900">{t.name}</p>
                      <p className="text-xs text-slate-500">{t.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
