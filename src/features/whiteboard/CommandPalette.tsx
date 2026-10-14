"use client";

// Ctrl+/ (or Ctrl+Shift+P): type to find any whiteboard tool or action, like
// Excalidraw's command palette. ↑ ↓ to move, Enter to run, Esc to close.
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { clsx } from "clsx";
import { DIALOG } from "./ui";

export type Command = {
  id: string;
  label: string;
  group: string;
  shortcut?: string;
  /** Extra words people might type (Thai included). */
  keywords?: string;
  /** Shows a tick (for on/off settings). */
  checked?: boolean;
  disabled?: boolean;
  run: () => void;
};

export function CommandPalette({ commands, onClose }: { commands: Command[]; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [at, setAt] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return commands.filter((c) => !c.disabled && words.every((w) => `${c.label} ${c.group} ${c.keywords || ""} ${c.shortcut || ""}`.toLowerCase().includes(w)));
  }, [q, commands]);
  const cur = Math.min(at, Math.max(0, shown.length - 1));

  useEffect(() => {
    listRef.current?.querySelector(`[data-i="${cur}"]`)?.scrollIntoView({ block: "nearest" });
  }, [cur]);

  function pick(c: Command | undefined) {
    if (!c) return;
    onClose();
    // After the palette is gone, so the action's own UI can take focus.
    requestAnimationFrame(() => c.run());
  }

  return (
    <div data-ui className="fixed inset-0 z-[90] flex items-start justify-center bg-[#1C1C1E]/25 p-4 pt-[12vh]" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Command palette" className={clsx(DIALOG, "max-w-[560px]")}>
        <label className="flex items-center gap-2.5 border-b border-[#E9EAEF] px-4">
          <Search className="h-4 w-4 shrink-0 text-[#9A9DAA]" />
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setAt(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setAt((cur + 1) % Math.max(1, shown.length));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setAt((cur - 1 + shown.length) % Math.max(1, shown.length));
              } else if (e.key === "Enter") {
                e.preventDefault();
                pick(shown[cur]);
              } else if (e.key === "Escape") {
                e.preventDefault();
                onClose();
              }
              e.stopPropagation();
            }}
            placeholder="Search tools and actions…"
            style={{ outline: "none" }}
            className="h-12 w-full bg-transparent text-[15px] text-[#1C1C1E] outline-none placeholder:text-[#9A9DAA]"
            aria-label="Search commands"
          />
        </label>
        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-1.5" role="listbox">
          {shown.length === 0 && <p className="px-3 py-6 text-center text-[13px] text-[#9A9DAA]">Nothing matches “{q}”.</p>}
          {shown.map((c, i) => {
            const head = i === 0 || shown[i - 1].group !== c.group ? c.group : null;
            return (
              <Fragment key={c.id}>
                {head && <p className="px-3 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9A9DAA]">{head}</p>}
                <button
                  type="button"
                  role="option"
                  aria-selected={i === cur}
                  data-i={i}
                  onPointerMove={() => i !== cur && setAt(i)}
                  onClick={() => pick(c)}
                  className={clsx("flex h-9 w-full items-center gap-2 rounded-md px-3 text-left text-[13.5px]", i === cur ? "bg-[#E6EAFF] text-[#1C1C1E]" : "text-[#1C1C1E]")}
                >
                  <span className="flex-1 truncate">{c.label}</span>
                  {c.checked !== undefined && <span className={clsx("text-[12px] font-medium", c.checked ? "text-[#4262FF]" : "text-[#C3C6D4]")}>{c.checked ? "On" : "Off"}</span>}
                  {c.shortcut && <kbd className="rounded bg-[#F1F2F5] px-1.5 py-0.5 font-sans text-[11.5px] text-[#656B81]">{c.shortcut}</kbd>}
                </button>
              </Fragment>
            );
          })}
        </div>
        <p className="border-t border-[#E9EAEF] px-4 py-2 text-[11.5px] text-[#9A9DAA]">↑ ↓ to move · Enter to run · Esc to close</p>
      </div>
    </div>
  );
}
