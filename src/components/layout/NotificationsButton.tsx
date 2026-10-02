"use client";

// "For you": mentions, comments and reviews on items you watch, formula changes.
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AtSign, CheckCircle2, FunctionSquare, Inbox, MessageSquare, X } from "lucide-react";
import { clsx } from "clsx";
import { useT } from "@/lib/i18n";
import { DAX_OPEN_EVENT } from "@/components/layout/CommandPalette";

type Note = { id: string; kind: string; title: string; body: string | null; link: string | null; actor: string | null; createdAt: string; readAt: string | null };

const ICON: Record<string, typeof Inbox> = { mention: AtSign, comment: MessageSquare, review: CheckCircle2, formula: FunctionSquare };

function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function NotificationsButton() {
  const t = useT();
  const router = useRouter();
  const [items, setItems] = useState<Note[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unread = items.filter((n) => !n.readAt).length;

  const load = useCallback(async () => {
    const res = await fetch("/api/notifications", { cache: "no-store" }).catch(() => null);
    if (res?.ok) setItems((await res.json()).items || []);
  }, []);

  useEffect(() => {
    let alive = true;
    const run = () => {
      if (alive && document.visibilityState === "visible") void load();
    };
    run();
    const timer = setInterval(run, 60_000);
    document.addEventListener("visibilitychange", run);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", run);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  async function markRead(ids: string[] | "all") {
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (ids === "all" || ids.includes(n.id) ? { ...n, readAt: n.readAt || now } : n)));
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ids === "all" ? { all: true } : { ids }),
    }).catch(() => {});
  }

  function go(n: Note) {
    setOpen(false);
    if (!n.readAt) void markRead([n.id]);
    if (!n.link) return;
    const url = new URL(n.link, window.location.origin);
    const item = url.searchParams.get("item");
    // Already on the dictionary: open the item in place.
    if (url.pathname === "/dax" && window.location.pathname === "/dax" && item) {
      window.dispatchEvent(new CustomEvent(DAX_OPEN_EVENT, { detail: { id: item } }));
      return;
    }
    router.push(n.link);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) void load();
        }}
        title={t("For you")}
        aria-label={`${t("For you")}${unread ? ` (${unread})` : ""}`}
        className={clsx("relative grid h-9 w-9 place-items-center rounded-lg transition", open ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900")}
      >
        <Inbox className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full border-2 border-white bg-rose-500 px-1 text-[9px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="pop-in absolute right-0 top-11 z-50 flex max-h-[480px] w-[min(92vw,380px)] flex-col rounded-xl border border-slate-200 bg-white shadow-[0_12px_32px_-8px_rgb(16_24_40/0.2)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h4 className="text-[13px] font-semibold text-slate-900">{t("For you")}</h4>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button type="button" onClick={() => void markRead("all")} className="rounded-md px-2 py-1 text-[12px] font-medium text-blue-600 hover:bg-blue-50">
                  {t("Mark all read")}
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-slate-100" aria-label={t("Close")}>
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {items.length === 0 && (
              <div className="px-4 py-8 text-center text-[12.5px] text-slate-400">
                {t("No notifications yet.")}
                <p className="mt-1 text-[11.5px]">Watch a measure, or get @mentioned in a comment.</p>
              </div>
            )}
            {items.map((n) => {
              const Icon = ICON[n.kind] || Inbox;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => go(n)}
                  className={clsx("flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition", n.readAt ? "hover:bg-slate-50" : "bg-blue-50/60 hover:bg-blue-50")}
                >
                  <span className={clsx("mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full", n.readAt ? "bg-slate-100 text-slate-500" : "bg-white text-blue-600 shadow-sm")}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className={clsx("line-clamp-2 text-[12.5px]", n.readAt ? "text-slate-700" : "font-medium text-slate-900")}>{n.title}</span>
                      <span className="ml-auto shrink-0 text-[11px] text-slate-400">{ago(n.createdAt)}</span>
                    </span>
                    {n.body && <span className="mt-0.5 line-clamp-2 block text-[12px] text-slate-500">{n.body}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
