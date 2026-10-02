"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, Columns, CornerDownLeft, FunctionSquare, LayoutGrid, Loader2, Search, Sparkles, type LucideIcon } from "lucide-react";
import { clsx } from "clsx";

// Ctrl K: one box to jump to a page, open a measure or column, or search reports.

export type PaletteLink = { href: string; label: string; hint: string; icon: LucideIcon };

type Hit = { id: string; name: string; tableName: string; type: string; modelCode: string; businessDefinition?: string; isCustom?: boolean };

type Row =
  | { kind: "page"; key: string; label: string; hint: string; icon: LucideIcon; href: string }
  | { kind: "item"; key: string; hit: Hit }
  | { kind: "search"; key: string; label: string; hint: string; icon: LucideIcon; href: string };

/** The DAX page listens for this to open an item without a reload. */
export const DAX_OPEN_EVENT = "dax:open-item";

export function CommandPalette({ open, onClose, pages, canDax, canReports }: { open: boolean; onClose: () => void; pages: PaletteLink[]; canDax: boolean; canReports: boolean }) {
  if (!open) return null;
  return <Palette onClose={onClose} pages={pages} canDax={canDax} canReports={canReports} />;
}

function Palette({ onClose, pages, canDax, canReports }: { onClose: () => void; pages: PaletteLink[]; canDax: boolean; canReports: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const query = q.trim();

  // Measures and columns across every model, a moment after typing stops.
  useEffect(() => {
    if (!canDax || query.length < 2) return;
    const ctl = new AbortController();
    const t = setTimeout(() => {
      setLoading(true);
      fetch(`/api/powerbi/dax?model=ALL&limit=8&q=${encodeURIComponent(query)}`, { signal: ctl.signal })
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((j) => setHits(j.items || []))
        .catch(() => {})
        .finally(() => !ctl.signal.aborted && setLoading(false));
    }, 180);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [query, canDax]);

  const rows = useMemo<Row[]>(() => {
    const lower = query.toLowerCase();
    const pageRows: Row[] = pages
      .filter((p) => !lower || p.label.toLowerCase().includes(lower) || p.hint.toLowerCase().includes(lower))
      .map((p) => ({ kind: "page", key: `page:${p.href}`, label: p.label, hint: p.hint, icon: p.icon, href: p.href }));
    if (!query) return pageRows;
    const itemRows: Row[] = query.length >= 2 ? hits.map((h) => ({ kind: "item", key: `item:${h.id}`, hit: h })) : [];
    const searchRows: Row[] = [];
    if (canDax)
      searchRows.push({ kind: "search", key: "s:dax", label: `Search the DAX dictionary for “${query}”`, hint: "Every model", icon: FunctionSquare, href: `/dax?model=ALL&q=${encodeURIComponent(query)}` });
    if (canReports)
      searchRows.push({ kind: "search", key: "s:rep", label: `Search Power BI reports for “${query}”`, hint: "Report catalog", icon: LayoutGrid, href: `/reports?q=${encodeURIComponent(query)}` });
    return [...itemRows, ...pageRows.slice(0, 4), ...searchRows];
  }, [pages, query, hits, canDax, canReports]);

  const current = Math.min(active, Math.max(rows.length - 1, 0));

  useEffect(() => {
    listRef.current?.querySelector(`[data-row="${current}"]`)?.scrollIntoView({ block: "nearest" });
  }, [current]);

  function go(row: Row) {
    onClose();
    if (row.kind === "item") {
      const { id, modelCode } = row.hit;
      if (pathname.startsWith("/dax")) window.dispatchEvent(new CustomEvent(DAX_OPEN_EVENT, { detail: { id, modelCode } }));
      else router.push(`/dax?model=${encodeURIComponent(modelCode)}&item=${encodeURIComponent(id)}`);
      return;
    }
    // Same page with new search terms: reload it so it reads them.
    if (row.kind === "search" && pathname === row.href.split("?")[0]) window.location.assign(row.href);
    else router.push(row.href);
  }

  const groups: { title: string; kind: Row["kind"] }[] = [
    { title: "Measures and columns", kind: "item" },
    { title: query ? "Pages" : "Go to", kind: "page" },
    { title: "Search everywhere", kind: "search" },
  ];

  return (
    <div className="fade-enter fixed inset-0 z-[80] flex items-start justify-center bg-slate-900/30 p-3 pt-[12vh] backdrop-blur-[2px]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Search and jump" className="pop-in flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center gap-2.5 border-b border-slate-100 px-4">
          {loading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-600" /> : <Search className="h-4 w-4 shrink-0 text-slate-400" />}
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
              if (e.target.value.trim().length < 2) setHits([]);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive(Math.min(current + 1, rows.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive(Math.max(current - 1, 0));
              } else if (e.key === "Enter" && rows[current]) {
                e.preventDefault();
                go(rows[current]);
              } else if (e.key === "Escape") {
                onClose();
              }
            }}
            placeholder={canDax ? "Jump to a page, a measure, a report…" : "Jump to a page or a report…"}
            aria-label="Search"
            className="no-focus-outline h-12 min-w-0 flex-1 bg-transparent text-[15px] text-slate-900 outline-none placeholder:text-slate-400"
          />
          <kbd className="rounded border border-slate-200 px-1.5 py-px text-[10.5px] text-slate-400">Esc</kbd>
        </div>

        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {rows.length === 0 && (
            <p className="px-3 py-8 text-center text-[13px] text-slate-400">{loading ? "Searching…" : "Nothing matches. Try another word."}</p>
          )}
          {groups.map((g) => {
            const groupRows = rows.filter((r) => r.kind === g.kind);
            if (!groupRows.length) return null;
            return (
              <div key={g.kind} className="mb-1">
                <p className="px-2.5 pb-1 pt-2 text-[11px] font-medium uppercase tracking-[0.06em] text-slate-400">{g.title}</p>
                {groupRows.map((row) => {
                  const i = rows.indexOf(row);
                  const on = i === current;
                  const Icon: LucideIcon = row.kind === "item" ? (row.hit.type === "Measure" || row.hit.isCustom ? (row.hit.isCustom ? Sparkles : FunctionSquare) : Columns) : row.icon;
                  return (
                    <button
                      key={row.key}
                      type="button"
                      data-row={i}
                      onMouseMove={() => active !== i && setActive(i)}
                      onClick={() => go(row)}
                      className={clsx("flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors", on ? "bg-blue-50" : "hover:bg-slate-50")}
                    >
                      <span className={clsx("grid h-8 w-8 shrink-0 place-items-center rounded-md", on ? "bg-white text-blue-600 shadow-sm" : "bg-slate-100 text-slate-500")}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        {row.kind === "item" ? (
                          <>
                            <span className="block truncate font-mono text-[13px] font-medium text-slate-900">{row.hit.name}</span>
                            <span className="block truncate text-[12px] text-slate-500">
                              {row.hit.modelCode} · {row.hit.tableName}
                              {row.hit.businessDefinition ? ` — ${row.hit.businessDefinition}` : ""}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="block truncate text-[13.5px] font-medium text-slate-900">{row.label}</span>
                            <span className="block truncate text-[12px] text-slate-500">{row.hint}</span>
                          </>
                        )}
                      </span>
                      {on ? <CornerDownLeft className="h-4 w-4 shrink-0 text-blue-500" /> : <ArrowRight className="h-4 w-4 shrink-0 text-transparent" />}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-4 border-t border-slate-100 bg-slate-50/70 px-4 py-2 text-[11.5px] text-slate-400">
          <span>
            <kbd className="font-sans">↑↓</kbd> move
          </span>
          <span>
            <kbd className="font-sans">Enter</kbd> open
          </span>
          <span className="ml-auto">Opens from anywhere with Ctrl K</span>
        </div>
      </div>
    </div>
  );
}
