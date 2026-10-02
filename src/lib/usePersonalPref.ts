"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// One of the signed-in person's saved choices (e.g. which report workspaces they follow).
// Stored with their account via /api/me/preferences so it follows them to any computer,
// and mirrored in this browser so the page can paint it straight away next time.

function putPref(key: string, value: unknown) {
  return fetch("/api/me/preferences", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prefs: { [key]: value } }),
  }).catch(() => {});
}

/**
 * Returns [value, save]. value is undefined while loading and null when nothing is saved yet.
 * localKey: the browser-storage key this choice used to live under; an old value there is
 * moved to the person's account the first time.
 */
export function usePersonalPref<T>(key: string, localKey: string): [T | null | undefined, (value: T) => void] {
  const [value, setValue] = useState<T | null | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    const readLocal = (): T | null => {
      try {
        const raw = localStorage.getItem(localKey);
        return raw ? (JSON.parse(raw) as T) : null;
      } catch {
        return null;
      }
    };
    fetch("/api/me/preferences", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!alive) return;
        const saved = json?.prefs?.[key];
        if (saved !== undefined && saved !== null) return setValue(saved as T);
        const old = readLocal();
        setValue(old);
        if (json && old !== null) void putPref(key, old);
      })
      .catch(() => alive && setValue(readLocal()));
    return () => {
      alive = false;
    };
  }, [key, localKey]);

  const save = useCallback(
    (next: T) => {
      setValue(next);
      try {
        localStorage.setItem(localKey, JSON.stringify(next));
      } catch {}
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void putPref(key, next), 600);
    },
    [key, localKey]
  );

  return [value, save];
}
