"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { ChevronDown, FolderInput, LayoutGrid, List, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
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
          .map((e) => isBox(e) && <rect key={e.id} x={e.x} y={e.y} width={e.w} height={e.h} rx={6} fill={e.kind === "frame" ? e.fill : "#fff"} stroke="#E6E6E6" strokeWidth={2 / s} />)}
        {elements
          .filter((e) => e.kind === "connector")
          .map((e) => e.kind === "connector" && <path key={e.id} d={connectorPath(e, byId).d} fill="none" stroke="#1A1A1A" strokeWidth={1.5 / s} />)}
        {elements
          .filter((e) => isBox(e) && e.kind !== "frame")
          .map((e) => {
            if (!isBox(e)) return null;
            const fill = e.kind === "sticky" ? e.color : e.kind === "shape" ? e.fill : "#FFFFFF";
            const stroke = e.kind === "shape" ? e.stroke : e.kind === "card" ? e.accent : "none";
            if (e.kind === "text") return <rect key={e.id} x={e.x} y={e.y + e.h / 3} width={e.w * 0.8} height={e.h / 3} rx={2} fill="#C3C6D4" />;
            if (e.kind === "draw") return <polyline key={e.id} transform={`translate(${e.x},${e.y})`} points={e.points.map((q) => q.join(",")).join(" ")} fill="none" stroke={e.stroke} strokeWidth={2 / s} />;
            return (
              <rect key={e.id} x={e.x} y={e.y} width={e.w} height={e.h} rx={e.kind === "shape" && e.shape === "ellipse" ? e.h / 2 : 6} fill={fill} stroke={stroke} strokeWidth={2 / s} />
            );
          })}
      </g>
    </svg>
  );
}

type View = "grid" | "list";
const VIEW_KEY = "wb_gallery_view";

// Grid/list choice is a per-browser preference kept in localStorage.
const viewListeners = new Set<() => void>();
function subscribeView(fn: () => void) {
  viewListeners.add(fn);
  return () => viewListeners.delete(fn);
}
function readView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}
function setView(v: View) {
  try {
    localStorage.setItem(VIEW_KEY, v);
  } catch {}
  viewListeners.forEach((fn) => fn());
}

function BoardActions({
  board,
  onClose,
  onRename,
  onMove,
  onDelete,
  askFolder,
}: {
  board: GalleryBoard;
  onClose: () => void;
  onRename: (id: string, name: string) => void;
  onMove: (id: string, folder: { id: string; name: string }) => void;
  onDelete: (id: string) => void;
  askFolder: () => { id: string; name: string } | null;
}) {
  const item = "flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-left hover:bg-[#F1F2F5]";
  return (
    <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg bg-white p-1.5 text-[14px] text-[#1C1C1E] shadow-[0_0_0_1px_rgba(34,36,40,.06),0_6px_24px_rgba(34,36,40,.18)]">
      <button
        type="button"
        className={item}
        onClick={() => {
          onClose();
          const n = window.prompt("Rename board", board.name);
          if (n?.trim()) onRename(board.id, n.trim());
        }}
      >
        <Pencil className="h-4 w-4 text-[#656B81]" /> Rename
      </button>
      <button
        type="button"
        className={item}
        onClick={() => {
          onClose();
          const f = askFolder();
          if (f) onMove(board.id, f);
        }}
      >
        <FolderInput className="h-4 w-4 text-[#656B81]" /> Move to folder
      </button>
      <button
        type="button"
        className={clsx(item, "mt-1 border-t border-[#E9EAEF] text-[#E0291B] hover:bg-[#FFEDEB]")}
        onClick={() => {
          onClose();
          if (window.confirm(`Delete "${board.name}" for everyone? This can't be undone.`)) onDelete(board.id);
        }}
      >
        <Trash2 className="h-4 w-4" /> Delete
      </button>
    </div>
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
  canEdit = true,
}: {
  canEdit?: boolean;
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
  const [menu, setMenu] = useState<string | null>(null);
  const view = useSyncExternalStore(subscribeView, readView, () => "grid" as View);

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
  const target = activeFolder ? { id: activeFolder.id, name: activeFolder.name } : { id: "folder_general", name: "General Workflows" };

  function askFolder(): { id: string; name: string } | null {
    const name = window.prompt("Folder name", activeFolder?.name || "General Workflows");
    if (!name?.trim()) return null;
    const existing = folders.find((f) => f.name.toLowerCase() === name.trim().toLowerCase());
    return existing ? { id: existing.id, name: existing.name } : { id: `folder_${name.trim().toLowerCase().replace(/[^a-z0-9ก-๙]+/g, "_")}`, name: name.trim() };
  }

  const actions = (b: GalleryBoard) =>
    canEdit && (
      <div className="relative">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMenu(menu === b.id ? null : b.id);
          }}
          className="grid h-8 w-8 place-items-center rounded-md text-[#656B81] hover:bg-[#F1F2F5] hover:text-[#1C1C1E]"
          aria-label="Board actions"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
        {menu === b.id && <BoardActions board={b} onClose={() => setMenu(null)} onRename={onRename} onMove={onMove} onDelete={onDelete} askFolder={askFolder} />}
      </div>
    );

  return (
    <div className="h-full overflow-y-auto rounded-xl bg-white text-[#1C1C1E]" onClick={() => setMenu(null)}>
      <div className="mx-auto max-w-6xl px-4 pb-12 pt-6 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[24px] font-semibold tracking-tight">Boards</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9A9DAA]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by title"
              className="h-10 w-64 rounded-lg border border-[#E9EAEF] bg-white pl-9 pr-3 text-[14px] outline-none placeholder:text-[#9A9DAA] hover:border-[#C3C6D4] focus:border-[#4262FF] focus:ring-2 focus:ring-[#4262FF]/20"
            />
          </div>
        </div>

        {canEdit && (
          <section className="mt-6">
            <div className="flex gap-4 overflow-x-auto pb-2">
              <button
                type="button"
                onClick={() => onCreate(TEMPLATES[0], target)}
                className="group flex w-[168px] shrink-0 flex-col text-left"
              >
                <span className="grid h-[104px] w-full place-items-center rounded-lg bg-[#4262FF] text-white transition-colors group-hover:bg-[#3550E6]">
                  <Plus className="h-9 w-9" strokeWidth={1.5} />
                </span>
                <span className="mt-2 text-[14px] font-medium">New board</span>
              </button>
              {TEMPLATES.filter((t) => t.id !== "blank").map((t) => (
                <button key={t.id} type="button" onClick={() => onCreate(t, target)} className="group flex w-[168px] shrink-0 flex-col text-left" title={t.description}>
                  <span className="block h-[104px] w-full overflow-hidden rounded-lg bg-[#F2F2F2] ring-1 ring-inset ring-black/5 transition-shadow group-hover:ring-2 group-hover:ring-[#4262FF]">
                    <Thumb elements={t.build()} w={168} h={104} />
                  </span>
                  <span className="mt-2 truncate text-[14px] font-medium">{t.name}</span>
                </button>
              ))}
            </div>
            <p className="mt-1 text-[12px] text-[#656B81]">New boards are saved in {target.name}.</p>
          </section>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-[18px] font-semibold">{activeFolder?.name || "All boards"}</h3>
          <div className="flex items-center gap-2">
            <label className="relative">
              <span className="sr-only">Folder</span>
              <select
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
                className="h-9 appearance-none rounded-lg border border-[#E9EAEF] bg-white pl-3 pr-8 text-[14px] outline-none hover:border-[#C3C6D4] focus:border-[#4262FF]"
              >
                <option value="all">All folders ({boards.length})</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.count})
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#656B81]" />
            </label>
            <div className="flex rounded-lg border border-[#E9EAEF] p-0.5">
              {(
                [
                  ["grid", LayoutGrid, "Grid view"],
                  ["list", List, "List view"],
                ] as const
              ).map(([v, Icon, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  aria-pressed={view === v}
                  aria-label={label}
                  title={label}
                  className={clsx("grid h-8 w-8 place-items-center rounded-md", view === v ? "bg-[#E6EAFF] text-[#4262FF]" : "text-[#656B81] hover:bg-[#F1F2F5]")}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading && (
          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-52 animate-pulse rounded-lg bg-[#F2F2F2]" />
            ))}
          </div>
        )}
        {!loading && shown.length === 0 && (
          <div className="mt-4 rounded-lg border border-dashed border-[#C3C6D4] p-10 text-center">
            <p className="text-[15px] font-medium">{q ? "No boards match your search" : "No boards here yet"}</p>
            <p className="mt-1 text-[14px] text-[#656B81]">{canEdit ? "Start one from the row above." : "Boards your team creates will show up here."}</p>
          </div>
        )}

        {!loading && shown.length > 0 && view === "grid" && (
          <div className="mt-4 grid gap-x-5 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {shown.map((b) => (
              <div key={b.id} className="group">
                <button type="button" onClick={() => onOpen(b.id)} className="block w-full text-left">
                  <div className="aspect-[16/10] overflow-hidden rounded-lg bg-[#F2F2F2] ring-1 ring-inset ring-black/5 transition-shadow group-hover:ring-2 group-hover:ring-[#4262FF]">
                    <Thumb elements={b.elements} />
                  </div>
                </button>
                <div className="mt-2 flex items-start gap-1">
                  <button type="button" onClick={() => onOpen(b.id)} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-[14px] font-medium">{b.name}</p>
                    <p className="mt-0.5 truncate text-[12px] text-[#656B81]">
                      {b.folder_name} · {relTime(b.updated_at)}
                    </p>
                  </button>
                  {actions(b)}
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && shown.length > 0 && view === "list" && (
          <div className="mt-4">
            <div className="grid grid-cols-[minmax(0,1fr)_40px] gap-4 border-b border-[#E9EAEF] px-2 pb-2 text-[12px] font-medium text-[#656B81] md:grid-cols-[minmax(0,1fr)_200px_180px_40px]">
              <span>Name</span>
              <span className="hidden md:block">Folder</span>
              <span className="hidden md:block">Last modified</span>
              <span />
            </div>
            {shown.map((b) => (
              <div
                key={b.id}
                className="grid cursor-pointer grid-cols-[minmax(0,1fr)_40px] items-center gap-4 rounded-md px-2 py-2 hover:bg-[#F7F8FA] md:grid-cols-[minmax(0,1fr)_200px_180px_40px]"
                onClick={() => onOpen(b.id)}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="h-9 w-14 shrink-0 overflow-hidden rounded bg-[#F2F2F2] ring-1 ring-inset ring-black/5">
                    <Thumb elements={b.elements} w={112} h={72} />
                  </span>
                  <span className="truncate text-[14px] font-medium">{b.name}</span>
                </span>
                <span className="hidden truncate text-[13px] text-[#656B81] md:block">{b.folder_name}</span>
                <span className="hidden truncate text-[13px] text-[#656B81] md:block">{relTime(b.updated_at).replace(/^Edited /, "")}</span>
                <span onClick={(e) => e.stopPropagation()}>{actions(b)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
