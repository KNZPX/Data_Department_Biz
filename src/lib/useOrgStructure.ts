"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { defaultOrgStructure, normalizeOrgStore, orgForYear, orgSourceYear, setOrgYear, type OrgStore, type OrgStructure } from "./orgStructure";

export const ORG_EVENT = "org-structure-changed";

/** The year the planning pages look at by default: next year. */
export const planningYear = () => new Date().getFullYear() + 1;

/**
 * The team's sites and CoE / SBU units for `year` (default: next year), falling
 * back to the original planning file's structure until someone saves one.
 */
export function useOrgStructure(year?: number) {
  const [store, setStore] = useState<OrgStore>(() => ({ ...defaultOrgStructure(), years: {} }));
  const [meta, setMeta] = useState<{ updatedBy: string | null; updatedAt: string | null; saved: boolean }>({ updatedBy: null, updatedAt: null, saved: false });
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/team-settings?key=org_structure", { cache: "no-store" }).catch(() => null);
    const j = r?.ok ? await r.json().catch(() => null) : null;
    if (j?.value) {
      setStore(normalizeOrgStore(j.value));
      setMeta({ updatedBy: j.updatedBy, updatedAt: j.updatedAt, saved: true });
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    let alive = true;
    fetch("/api/team-settings?key=org_structure", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive) return;
        if (j?.value) {
          setStore(normalizeOrgStore(j.value));
          setMeta({ updatedBy: j.updatedBy, updatedAt: j.updatedAt, saved: true });
        }
        setLoaded(true);
      })
      .catch(() => alive && setLoaded(true));
    const onChange = () => void load();
    window.addEventListener(ORG_EVENT, onChange);
    return () => {
      alive = false;
      window.removeEventListener(ORG_EVENT, onChange);
    };
  }, [load]);

  const y = year ?? planningYear();
  const org = useMemo(() => orgForYear(store, y), [store, y]);
  return { org, store, source: orgSourceYear(store, y), meta, loaded, reload: load };
}

/** Save `org` as `year`'s CoE / SBU list (admins only), on top of what's stored now. */
export async function saveOrgYear(year: number, org: OrgStructure) {
  const cur = await fetch("/api/team-settings?key=org_structure", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  const store = cur?.value ? normalizeOrgStore(cur.value) : { ...defaultOrgStructure(), years: {} };
  await putOrgStore(setOrgYear(store, year, org));
}

export async function putOrgStore(store: OrgStore) {
  const res = await fetch("/api/team-settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "org_structure", value: store }) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "The server didn't accept it");
  window.dispatchEvent(new Event(ORG_EVENT));
}
