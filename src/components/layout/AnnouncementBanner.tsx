"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ArrowUpRight, Megaphone, X } from "lucide-react";
import { clsx } from "clsx";

// A short notice for the whole team, set by an admin in Settings → Team announcement.
// Everyone sees the same message; each person can hide it until it changes.

export type Announcement = {
  active: boolean;
  message: string;
  tone?: "info" | "warning";
  link?: string;
  linkLabel?: string;
};

export type AnnouncementRecord = { value: Announcement | null; updatedBy: string | null; updatedAt: string | null };

const HIDDEN_KEY = "announcement:hidden";
export const ANNOUNCEMENT_EVENT = "team-announcement-changed";

export function AnnouncementBanner() {
  const [rec, setRec] = useState<AnnouncementRecord | null>(null);
  // Nothing renders until the message loads, so reading storage up front can't cause a hydration mismatch.
  const [hiddenAt, setHiddenAt] = useState<string | null>(() => {
    try {
      return typeof window === "undefined" ? null : localStorage.getItem(HIDDEN_KEY);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/team-settings?key=announcement", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => alive && j && setRec(j))
        .catch(() => {});
    void load();
    // Pick up a new message without a reload: when the tab comes back, every few minutes,
    // and straight away when an admin saves one in this browser.
    const onFocus = () => document.visibilityState === "visible" && void load();
    const onChanged = (e: Event) => setRec((e as CustomEvent<AnnouncementRecord>).detail);
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener(ANNOUNCEMENT_EVENT, onChanged);
    const t = setInterval(load, 5 * 60 * 1000);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener(ANNOUNCEMENT_EVENT, onChanged);
      clearInterval(t);
    };
  }, []);

  const a = rec?.value;
  if (!a?.active || !a.message?.trim()) return null;
  if (hiddenAt && rec?.updatedAt && hiddenAt === rec.updatedAt) return null;

  const warning = a.tone === "warning";
  const Icon = warning ? AlertTriangle : Megaphone;
  const safeLink = a.link && /^(https?:\/\/|\/)/.test(a.link) ? a.link : null;

  return (
    <div
      role="status"
      className={clsx(
        "fade-enter flex shrink-0 items-start gap-2.5 border-b px-3 py-2 text-[13px] md:items-center md:px-5",
        warning ? "border-amber-200 bg-amber-50 text-amber-900" : "border-blue-100 bg-blue-50 text-blue-900"
      )}
    >
      <Icon className={clsx("mt-0.5 h-4 w-4 shrink-0 md:mt-0", warning ? "text-amber-600" : "text-blue-600")} />
      <p className="min-w-0 flex-1 leading-snug">
        <span className="font-medium">{a.message}</span>
        {rec?.updatedBy && <span className={clsx("ml-2 text-[12px]", warning ? "text-amber-700/80" : "text-blue-700/70")}>— {rec.updatedBy}</span>}
      </p>
      {safeLink && (
        <a
          href={safeLink}
          target={safeLink.startsWith("/") ? undefined : "_blank"}
          rel="noreferrer"
          className={clsx("flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-[12.5px] font-medium", warning ? "hover:bg-amber-100" : "hover:bg-blue-100")}
        >
          {a.linkLabel || "Open"} <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      )}
      <button
        type="button"
        onClick={() => {
          const at = rec?.updatedAt || "";
          setHiddenAt(at);
          try {
            localStorage.setItem(HIDDEN_KEY, at);
          } catch {}
        }}
        className={clsx("grid h-6 w-6 shrink-0 place-items-center rounded-md", warning ? "hover:bg-amber-100" : "hover:bg-blue-100")}
        aria-label="Hide until there's a new announcement"
        title="Hide until there's a new announcement"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
