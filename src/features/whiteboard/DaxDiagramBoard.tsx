"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { BoardCanvas } from "./BoardCanvas";
import { useAccess } from "@/components/auth/LoginGate";
import { confirmDialog } from "@/components/feedback";
import { elementsFromDaxDiagram, normalizeElements, type El } from "./model";

type AstNode = Parameters<typeof elementsFromDaxDiagram>[0][number];

export function daxBoardId(itemId: string) {
  return `dax_${itemId}`;
}

/**
 * A measure's formula diagram, always shown in the Whiteboard module.
 * Each measure has one saved board (id dax_<itemId>, folder "DAX diagrams").
 * The first time it opens, it's generated from the formula; after that the
 * team's edited layout is kept. "Rebuild from formula" regenerates it.
 */
export function DaxDiagramBoard({
  item,
  seedNodes,
  buildNodes,
  onClose,
}: {
  item: { id: string; name: string; tableName: string; modelCode?: string };
  /** Layout to use the first time (e.g. a layout saved by the old diagram editor). */
  seedNodes?: AstNode[];
  /** Fresh parse of the formula, used for first open and "Rebuild". */
  buildNodes: () => AstNode[];
  onClose: () => void;
}) {
  const boardId = daxBoardId(item.id);
  const { can } = useAccess();
  const [initial, setInitial] = useState<El[] | null>(null);
  const [version, setVersion] = useState(0);
  const [isNew, setIsNew] = useState(false);
  const latest = useRef<El[]>([]);

  const meta = {
    id: boardId,
    name: `DAX: ${item.name}`,
    folder_id: "folder_dax_diagrams",
    folder_name: "DAX diagrams",
    description: `Formula diagram for [${item.name}] in ${item.tableName}${item.modelCode ? ` (${item.modelCode})` : ""}`,
  };

  async function persist(els: El[]) {
    await fetch("/api/whiteboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ board: { ...meta, nodes: els } }),
    });
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      let els: El[] | null = null;
      try {
        const res = await fetch(`/api/whiteboard?id=${encodeURIComponent(boardId)}`, { cache: "no-store" });
        const json = res.ok ? await res.json() : null;
        if (json?.board?.nodes?.length) els = normalizeElements(json.board.nodes);
      } catch {}
      const fresh = !els;
      if (!els) els = elementsFromDaxDiagram(seedNodes && seedNodes.length ? seedNodes : buildNodes());
      if (!alive) return;
      latest.current = els;
      setIsNew(fresh);
      setInitial(els);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);



  async function rebuild() {
    const ok = await confirmDialog({
      title: "Rebuild this diagram?",
      body: "It's redrawn from the current formula. Anything you moved or added on this diagram is replaced.",
      confirmLabel: "Rebuild",
      danger: true,
    });
    if (!ok) return;
    const els = elementsFromDaxDiagram(buildNodes());
    latest.current = els;
    await persist(els);
    setInitial(els);
    setVersion((v) => v + 1);
  }

  async function openFull() {
    await persist(latest.current);
    window.open(`/dax-diagrams?boardId=${encodeURIComponent(boardId)}`, "_blank");
  }

  return (
    <div className="fixed inset-0 z-[60] bg-ink/40 p-3 backdrop-blur-[2px] md:p-5">
      <div className="relative h-full w-full overflow-hidden rounded-2xl bg-white shadow-2xl">
        {!initial ? (
          <div className="grid h-full place-items-center text-sm text-slate-500">
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" /> Building the diagram
            </span>
          </div>
        ) : (
          <BoardCanvas
            key={version}
            readOnly={!can("whiteboard.edit")}
            meta={meta}
            initial={initial}
            onBack={onClose}
            backLabel="Close diagram (Esc)"
            onEscapeIdle={onClose}
            onMetaChange={() => {}}
            onChange={(els) => {
              latest.current = els;
              setIsNew(false);
            }}
            extraActions={
              <>
                {isNew && <span className="hidden text-xs text-slate-400 lg:inline">Generated from the formula — edit it and it saves as a board</span>}
                <button
                  type="button"
                  onClick={() => void rebuild()}
                  className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm text-slate-600 hover:bg-slate-100"
                  title="Regenerate from the current formula"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span className="hidden md:inline">Rebuild</span>
                </button>
                <button
                  type="button"
                  onClick={() => void openFull()}
                  className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm text-slate-600 hover:bg-slate-100"
                  title="Open in the Whiteboard page"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span className="hidden md:inline">Open in Whiteboard</span>
                </button>
              </>
            }
          />
        )}
      </div>
    </div>
  );
}
