"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import {
  ChevronDown,
  FolderInput,
  GitFork,
  LayoutGrid,
  LayoutTemplate,
  List,
  MoreHorizontal,
  Network,
  Pencil,
  Plus,
  Search,
  Shapes,
  StickyNote,
  Trash2,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { clsx } from "clsx";
import { TEMPLATES, boundsOf, connectorPath, isBox, type El, type Template } from "./model";
import { useAuth } from "@/components/auth/LoginGate";
import { confirmDialog, promptDialog } from "@/components/feedback";

export type GalleryBoard = {
  id: string;
  name: string;
  folder_id: string;
  folder_name: string;
  description?: string;
  updated_at?: string;
  created_at?: string;
  created_by?: string | null;
  updated_by?: string | null;
  elements: El[];
};

/** Miro-style day label: Today, Yesterday, or the date. */
function dayLabel(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((start(today) - start(d)) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(d.getFullYear() !== today.getFullYear() ? { year: "numeric" } : {}) });
}

// A recognisable icon + tint per board, like Miro's coloured board glyphs.
const GLYPHS: { icon: LucideIcon; bg: string; fg: string }[] = [
  { icon: Workflow, bg: "#E0F2FE", fg: "#0284C7" },
  { icon: StickyNote, bg: "#FEF9C3", fg: "#CA8A04" },
  { icon: Shapes, bg: "#EDE9FE", fg: "#7C3AED" },
  { icon: Network, bg: "#DCFCE7", fg: "#16A34A" },
  { icon: GitFork, bg: "#FFE4E6", fg: "#E11D48" },
  { icon: LayoutTemplate, bg: "#E0E7FF", fg: "#4F46E5" },
];
function glyphFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return GLYPHS[h % GLYPHS.length];
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
type Owner = "anyone" | "me" | "others";
type Sort = "modified" | "created" | "name";
const VIEW_KEY = "wb_gallery_view";

// Grid/list choice is a per-browser preference kept in localStorage.
const viewListeners = new Set<() => void>();
function subscribeView(fn: () => void) {
  viewListeners.add(fn);
  return () => viewListeners.delete(fn);
}
function readView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === "grid" ? "grid" : "list";
  } catch {
    return "list";
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
  askFolder: () => Promise<{ id: string; name: string } | null>;
}) {
  const item = "flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-left hover:bg-slate-100";
  return (
    <div className="pop-in absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-slate-200 bg-white p-1.5 text-[14px] text-slate-800 shadow-[0_12px_32px_-8px_rgb(16_24_40/0.2)]">
      <button
        type="button"
        className={item}
        onClick={async () => {
          onClose();
          const n = await promptDialog({ title: "Rename board", label: "Board name", defaultValue: board.name, confirmLabel: "Rename" });
          if (n && n !== board.name) onRename(board.id, n);
        }}
      >
        <Pencil className="h-4 w-4 text-slate-400" /> Rename
      </button>
      <button
        type="button"
        className={item}
        onClick={async () => {
          onClose();
          const f = await askFolder();
          if (f) onMove(board.id, f);
        }}
      >
        <FolderInput className="h-4 w-4 text-slate-400" /> Move to folder
      </button>
      <button
        type="button"
        className={clsx(item, "mt-1 border-t border-slate-100 text-rose-600 hover:bg-rose-50")}
        onClick={async () => {
          onClose();
          const ok = await confirmDialog({
            title: `Delete “${board.name}”?`,
            body: "It's deleted for everyone on the team. This can't be undone.",
            confirmLabel: "Delete board",
            danger: true,
          });
          if (ok) onDelete(board.id);
        }}
      >
        <Trash2 className="h-4 w-4" /> Delete
      </button>
    </div>
  );
}

function Dropdown<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: [T, string][]; label: string }) {
  return (
    <label className="relative">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-10 min-w-[160px] appearance-none rounded-md border border-slate-300 bg-white pl-3 pr-9 text-[14px] text-slate-800 outline-none transition hover:border-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
    </label>
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
  const { user } = useAuth();
  const me = (user?.name || "").toLowerCase();
  const [q, setQ] = useState("");
  const [folder, setFolder] = useState<string>("all");
  const [owner, setOwner] = useState<Owner>("anyone");
  const [sort, setSort] = useState<Sort>("modified");
  const [menu, setMenu] = useState<string | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(true);
  const view = useSyncExternalStore(subscribeView, readView, () => "list" as View);

  const folders = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    for (const b of boards) {
      const f = map.get(b.folder_id) || { id: b.folder_id, name: b.folder_name, count: 0 };
      f.count++;
      map.set(b.folder_id, f);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [boards]);

  const shown = boards
    .filter((b) => folder === "all" || b.folder_id === folder)
    .filter((b) => !q.trim() || b.name.toLowerCase().includes(q.toLowerCase()))
    .filter((b) => {
      if (owner === "anyone" || !me) return true;
      const mine = (b.created_by || "").toLowerCase() === me;
      return owner === "me" ? mine : !mine;
    })
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : (sort === "created" ? b.created_at || "" : b.updated_at || "").localeCompare(sort === "created" ? a.created_at || "" : a.updated_at || "")
    );
  const activeFolder = folders.find((f) => f.id === folder);
  const target = activeFolder ? { id: activeFolder.id, name: activeFolder.name } : { id: "folder_general", name: "General Workflows" };

  async function askFolder(): Promise<{ id: string; name: string } | null> {
    const name = await promptDialog({
      title: "Move to folder",
      body: folders.length ? `Existing folders: ${folders.map((f) => f.name).join(", ")}. Type a new name to create one.` : undefined,
      label: "Folder name",
      defaultValue: activeFolder?.name || "General Workflows",
      confirmLabel: "Move",
    });
    if (!name) return null;
    const existing = folders.find((f) => f.name.toLowerCase() === name.toLowerCase());
    return existing ? { id: existing.id, name: existing.name } : { id: `folder_${name.toLowerCase().replace(/[^a-z0-9ก-๙]+/g, "_")}`, name };
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
          className="grid h-8 w-8 place-items-center rounded-md text-slate-500 opacity-60 transition hover:bg-slate-100 hover:text-slate-900 group-hover:opacity-100"
          aria-label="Board actions"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
        {menu === b.id && <BoardActions board={b} onClose={() => setMenu(null)} onRename={onRename} onMove={onMove} onDelete={onDelete} askFolder={askFolder} />}
      </div>
    );

  return (
    <div className="h-full overflow-y-auto rounded-xl border border-slate-200/80 bg-white text-slate-900" onClick={() => setMenu(null)}>
      <div className="mx-auto max-w-6xl px-4 pb-12 pt-6 md:px-8">
        {canEdit && (
          <section className="rounded-xl bg-slate-100/80 px-5 pb-5 pt-4">
            <button type="button" onClick={() => setTemplatesOpen((v) => !v)} className="mb-3 flex items-center gap-1.5 text-[16px] text-slate-800">
              Templates for data &amp; analysis
              <ChevronDown className={clsx("h-4 w-4 transition-transform duration-300", !templatesOpen && "-rotate-90")} />
            </button>
            {templatesOpen && (
              <div className="stagger flex gap-4 overflow-x-auto pb-1">
                <button type="button" onClick={() => onCreate(TEMPLATES[0], target)} className="group flex w-[148px] shrink-0 flex-col text-left">
                  <span className="grid h-[92px] w-full place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition duration-200 group-hover:border-blue-400 group-hover:text-blue-600 group-hover:shadow-[0_6px_16px_-8px_rgb(16_24_40/0.25)]">
                    <Plus className="h-6 w-6 transition-transform duration-300 group-hover:rotate-90" strokeWidth={1.5} />
                  </span>
                  <span className="mt-2 text-[14px] text-slate-700">Blank board</span>
                </button>
                {TEMPLATES.filter((t) => t.id !== "blank").map((t) => (
                  <button key={t.id} type="button" onClick={() => onCreate(t, target)} className="group flex w-[148px] shrink-0 flex-col text-left" title={t.description}>
                    <span className="block h-[92px] w-full overflow-hidden rounded-lg border border-slate-200 bg-white transition duration-200 group-hover:-translate-y-0.5 group-hover:border-blue-400 group-hover:shadow-[0_6px_16px_-8px_rgb(16_24_40/0.25)]">
                      <Thumb elements={t.build()} w={148} h={92} />
                    </span>
                    <span className="mt-2 truncate text-[14px] text-slate-700">{t.name}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[24px] font-normal tracking-tight text-slate-900">{activeFolder ? activeFolder.name : "Boards in this team"}</h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by title"
                className="h-10 w-56 rounded-md border border-slate-300 bg-white pl-9 pr-3 text-[14px] outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={() => onCreate(TEMPLATES[0], target)}
                className="flex h-10 items-center gap-1.5 rounded-md bg-blue-600 px-4 text-[14px] font-medium text-white transition hover:bg-blue-700 active:scale-[0.98]"
              >
                <Plus className="h-4 w-4" /> Create new
              </button>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-2">
            <span className="text-[14px] text-slate-500">Filter by</span>
            <Dropdown
              label="Folder"
              value={folder}
              onChange={setFolder}
              options={[["all", "All boards"], ...folders.map((f) => [f.id, `${f.name} (${f.count})`] as [string, string])]}
            />
            <Dropdown
              label="Owner"
              value={owner}
              onChange={setOwner}
              options={[
                ["anyone", "Owned by anyone"],
                ["me", "Owned by me"],
                ["others", "Not owned by me"],
              ]}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[14px] text-slate-500">Sort by</span>
            <Dropdown
              label="Sort"
              value={sort}
              onChange={setSort}
              options={[
                ["modified", "Last modified"],
                ["created", "Date created"],
                ["name", "Name A–Z"],
              ]}
            />
          </div>
          <div className="ml-auto flex rounded-md border border-slate-200 p-0.5">
            {(
              [
                ["list", List, "List view"],
                ["grid", LayoutGrid, "Grid view"],
              ] as const
            ).map(([v, Icon, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                aria-label={label}
                title={label}
                className={clsx("grid h-8 w-8 place-items-center rounded transition", view === v ? "bg-blue-50 text-blue-600" : "text-slate-500 hover:bg-slate-100")}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div className="mt-6 space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-14 rounded-md" />
            ))}
          </div>
        )}
        {!loading && shown.length === 0 && (
          <div className="fade-enter mt-6 rounded-lg border border-dashed border-slate-300 p-10 text-center">
            <p className="text-[15px] font-medium">{q || owner !== "anyone" ? "No boards match these filters" : "No boards here yet"}</p>
            <p className="mt-1 text-[14px] text-slate-500">{canEdit ? "Start one from a template above." : "Boards your team creates will show up here."}</p>
          </div>
        )}

        {!loading && shown.length > 0 && view === "list" && (
          <div className="mt-6">
            <div className="grid grid-cols-[minmax(0,1fr)_40px] gap-4 px-2 pb-3 text-[14px] text-slate-600 md:grid-cols-[minmax(0,1fr)_180px_160px_180px_40px]">
              <span>Name</span>
              <span className="hidden md:block">Folder</span>
              <span className="hidden md:block">Last modified</span>
              <span className="hidden md:block">Owner</span>
              <span />
            </div>
            <div className="stagger">
              {shown.map((b) => {
                const g = glyphFor(b.id);
                return (
                  <div
                    key={b.id}
                    className="group grid cursor-pointer grid-cols-[minmax(0,1fr)_40px] items-center gap-4 rounded-md px-2 py-3 transition-colors hover:bg-slate-50 md:grid-cols-[minmax(0,1fr)_180px_160px_180px_40px]"
                    onClick={() => onOpen(b.id)}
                  >
                    <span className="flex min-w-0 items-center gap-3.5">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-transform duration-300 group-hover:scale-110" style={{ background: g.bg, color: g.fg }}>
                        <g.icon className="h-[18px] w-[18px]" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-semibold text-slate-900">{b.name}</span>
                        <span className="block truncate text-[12.5px] font-medium text-slate-500">
                          {b.updated_by ? `Modified by ${b.updated_by}, ${dayLabel(b.updated_at)}` : `Modified ${dayLabel(b.updated_at)}`}
                        </span>
                      </span>
                    </span>
                    <span className="hidden truncate text-[14px] text-slate-600 md:block">{b.folder_name}</span>
                    <span className="hidden text-[14px] text-slate-600 md:block">{dayLabel(b.updated_at)}</span>
                    <span className="hidden truncate text-[14px] text-slate-600 md:block">{b.created_by || "—"}</span>
                    <span onClick={(e) => e.stopPropagation()}>{actions(b)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!loading && shown.length > 0 && view === "grid" && (
          <div className="stagger mt-6 grid gap-x-5 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {shown.map((b) => (
              <div key={b.id} className="group">
                <button type="button" onClick={() => onOpen(b.id)} className="block w-full text-left">
                  <div className="aspect-[16/10] overflow-hidden rounded-lg border border-slate-200 bg-[#F2F2F2] transition duration-300 group-hover:-translate-y-0.5 group-hover:border-blue-400 group-hover:shadow-[0_10px_24px_-12px_rgb(16_24_40/0.3)]">
                    <Thumb elements={b.elements} />
                  </div>
                </button>
                <div className="mt-2 flex items-start gap-1">
                  <button type="button" onClick={() => onOpen(b.id)} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-[14px] font-semibold">{b.name}</p>
                    <p className="mt-0.5 truncate text-[12.5px] text-slate-500">
                      {b.updated_by ? `Modified by ${b.updated_by}, ${dayLabel(b.updated_at)}` : `Modified ${dayLabel(b.updated_at)}`}
                    </p>
                  </button>
                  {actions(b)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
