"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { BoardCanvas } from "./whiteboard/BoardCanvas";
import { BoardGallery, type GalleryBoard } from "./whiteboard/BoardGallery";
import { normalizeElements, uid, type BoardMeta, type Template } from "./whiteboard/model";
import { useAccess } from "@/components/auth/LoginGate";

// ---------------------------------------------------------------------------
// Legacy types, still used by the DAX page's "Open in whiteboard" export.
// Boards saved in this shape are converted to v2 elements when opened.
// ---------------------------------------------------------------------------
export type PortSide = "top" | "right" | "bottom" | "left";
export interface NodeConnection {
  targetId: string;
  fromSide?: PortSide;
  toSide?: PortSide;
  label?: string;
}
export type WhiteboardNodeType =
  | "sticky" | "process" | "decision" | "trigger" | "database" | "dax" | "value" | "text" | "cloud" | "queue" | "output";
export interface WhiteboardNode {
  id: string;
  type: WhiteboardNodeType;
  title: string;
  description: string;
  color?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  connections: NodeConnection[];
}
export interface WhiteboardBoard {
  id: string;
  name: string;
  folderId?: string;
  folderName?: string;
  description?: string;
  updatedAt: string;
  nodes: WhiteboardNode[];
}
export function getPortCoordinate(
  node: { x: number; y: number; width?: number; height?: number },
  side: PortSide = "right"
): { x: number; y: number } {
  const width = node.width || 230;
  const height = node.height || 100;
  switch (side) {
    case "top":
      return { x: node.x + width / 2, y: node.y };
    case "right":
      return { x: node.x + width, y: node.y + height / 2 };
    case "bottom":
      return { x: node.x + width / 2, y: node.y + height };
    case "left":
      return { x: node.x, y: node.y + height / 2 };
  }
}

type ApiBoard = { id: string; name: string; folder_id: string; folder_name: string; description?: string; nodes: unknown[]; updated_at?: string };

function toGallery(b: ApiBoard): GalleryBoard {
  return { ...b, elements: normalizeElements(b.nodes) };
}

async function saveBoard(b: GalleryBoard) {
  await fetch("/api/whiteboard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      board: { id: b.id, name: b.name, folder_id: b.folder_id, folder_name: b.folder_name, description: b.description, nodes: b.elements },
    }),
  });
}

export function WhiteboardPage() {
  const { can } = useAccess();
  const canEdit = can("whiteboard.edit");
  const [boards, setBoards] = useState<GalleryBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/whiteboard", { cache: "no-store" });
    const json = res.ok ? await res.json() : { boards: [] };
    return ((json.boards || []) as ApiBoard[]).map(toGallery);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const list = await load();
      const wanted = new URLSearchParams(window.location.search).get("boardId");
      // A board just exported from the DAX page may still be in flight — recover it from localStorage.
      if (wanted && !list.some((b) => b.id === wanted)) {
        try {
          const pending = JSON.parse(localStorage.getItem("powerbi_whiteboard_boards_v2") || "[]") as WhiteboardBoard[];
          const hit = pending.find((b) => b.id === wanted);
          if (hit) {
            const g: GalleryBoard = {
              id: hit.id,
              name: hit.name,
              folder_id: hit.folderId || "folder_general",
              folder_name: hit.folderName || "General Workflows",
              description: hit.description,
              updated_at: hit.updatedAt,
              elements: normalizeElements(hit.nodes),
            };
            list.unshift(g);
            void saveBoard(g);
          }
        } catch {}
      }
      if (!alive) return;
      setBoards(list);
      setLoading(false);
      if (wanted && list.some((b) => b.id === wanted)) setOpenId(wanted);
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  function open(id: string | null) {
    setOpenId(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("boardId", id);
    else url.searchParams.delete("boardId");
    window.history.replaceState(null, "", url.toString());
    if (!id) void load().then(setBoards);
  }

  async function create(t: Template, folder: { id: string; name: string }) {
    const b: GalleryBoard = {
      id: uid("board"),
      name: t.id === "blank" ? "Untitled board" : t.name,
      folder_id: folder.id,
      folder_name: folder.name,
      updated_at: new Date().toISOString(),
      elements: t.build(),
    };
    setBoards((prev) => [b, ...prev]);
    await saveBoard(b);
    open(b.id);
  }

  function patch(id: string, p: Partial<GalleryBoard>) {
    setBoards((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;
        const next = { ...b, ...p };
        void saveBoard(next);
        return next;
      })
    );
  }

  const board = openId ? boards.find((b) => b.id === openId) : null;

  if (loading && openId === null && new URLSearchParams(typeof window !== "undefined" ? window.location.search : "").get("boardId")) {
    return (
      <div className="grid h-full place-items-center text-sm text-slate-500">
        <span className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" /> Opening board
        </span>
      </div>
    );
  }

  if (board) {
    const meta: BoardMeta = {
      id: board.id,
      name: board.name,
      folder_id: board.folder_id,
      folder_name: board.folder_name,
      description: board.description,
    };
    return (
      <BoardCanvas
        key={board.id}
        readOnly={!canEdit}
        meta={meta}
        initial={board.elements}
        onBack={() => open(null)}
        onMetaChange={(m) => setBoards((prev) => prev.map((b) => (b.id === m.id ? { ...b, name: m.name } : b)))}
      />
    );
  }

  return (
    <BoardGallery
      canEdit={canEdit}
      boards={boards}
      loading={loading}
      onOpen={open}
      onCreate={create}
      onRename={(id, name) => patch(id, { name })}
      onMove={(id, f) => patch(id, { folder_id: f.id, folder_name: f.name })}
      onDelete={async (id) => {
        setBoards((prev) => prev.filter((b) => b.id !== id));
        await fetch(`/api/whiteboard?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      }}
    />
  );
}
