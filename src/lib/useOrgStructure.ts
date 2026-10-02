"use client";

import { useCallback, useEffect, useState } from "react";
import { defaultOrgStructure, normalizeOrg, type OrgStructure } from "./orgStructure";

export const ORG_EVENT = "org-structure-changed";

/** The team's sites and CoE / SBU units (falls back to the original planning file's structure). */
export function useOrgStructure() {
  const [org, setOrg] = useState<OrgStructure>(() => defaultOrgStructure());
  const [meta, setMeta] = useState<{ updatedBy: string | null; updatedAt: string | null; saved: boolean }>({ updatedBy: null, updatedAt: null, saved: false });
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/team-settings?key=org_structure", { cache: "no-store" }).catch(() => null);
    const j = r?.ok ? await r.json().catch(() => null) : null;
    if (j?.value) {
      setOrg(normalizeOrg(j.value));
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
          setOrg(normalizeOrg(j.value));
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

  return { org, meta, loaded, reload: load };
}
