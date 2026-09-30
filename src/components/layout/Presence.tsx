"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";

export type OnlineUser = { email: string; name: string; lastSeenAt: string };

// Deterministic, calm avatar colours so each teammate is recognisable.
const AVATAR_TONES = ["#1F5FD6", "#0E9F8E", "#7C4DDB", "#C2410C", "#0F766E", "#B4235B", "#4D6A1A", "#2E5B8A"];

export function toneFor(email: string) {
  let h = 0;
  for (let i = 0; i < email.length; i++) h = (h * 31 + email.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "?") + (parts[1]?.[0] || "")).toUpperCase();
}

/** Heartbeat every 60s; returns everyone active in the last 10 minutes. */
export function usePresence(intervalMs = 60_000) {
  const [users, setUsers] = useState<OnlineUser[]>([]);
  useEffect(() => {
    let alive = true;
    async function beat() {
      try {
        const res = await fetch("/api/presence", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (alive) setUsers(json.users || []);
      } catch {}
    }
    void beat();
    const t = setInterval(beat, intervalMs);
    const onFocus = () => void beat();
    window.addEventListener("focus", onFocus);
    return () => {
      alive = false;
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [intervalMs]);
  return users;
}

function minutesAgo(iso: string) {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m <= 1 ? "active now" : `active ${m} min ago`;
}

export function PresenceStack({ users, max = 5, dark = false }: { users: OnlineUser[]; max?: number; dark?: boolean }) {
  if (!users.length) return null;
  const shown = users.slice(0, max);
  const extra = users.length - shown.length;
  return (
    <div className="flex items-center -space-x-2" aria-label={`${users.length} people online`}>
      {shown.map((u) => (
        <span
          key={u.email}
          title={`${u.name} — ${minutesAgo(u.lastSeenAt)}`}
          className={clsx(
            "relative grid h-8 w-8 place-items-center rounded-full text-[11px] font-semibold text-white ring-2",
            dark ? "ring-ink" : "ring-white"
          )}
          style={{ backgroundColor: toneFor(u.email) }}
        >
          {initialsOf(u.name)}
          <span
            className={clsx(
              "presence-dot absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-teal-live ring-2",
              dark ? "ring-ink" : "ring-white"
            )}
          />
        </span>
      ))}
      {extra > 0 && (
        <span
          className={clsx(
            "grid h-8 w-8 place-items-center rounded-full text-[11px] font-semibold ring-2",
            dark ? "bg-white/10 text-slate-200 ring-ink" : "bg-slate-100 text-slate-600 ring-white"
          )}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}
