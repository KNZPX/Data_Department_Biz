"use client";

// Which saved Target scenario the EBO & OKR page measures each CoE / SBU against,
// and what that plan says for every unit (target, base year, prior year, per hospital).
// The choice is per person and per year; it defaults to the latest scenario for the year.
import { useEffect, useMemo, useState } from "react";
import { usePersonalPref } from "./usePersonalPref";
import { planFromSaved, savedPlanYear, unitNumbers, type SavedTargetSnapshot, type UnitNumbers } from "./targetPlanBase";

export type TargetScenario = { id: string; name: string; updated_at: string; created_by?: string | null; snapshot: SavedTargetSnapshot };

export function useTargetLink(year: number, preferId: string | null = null) {
  const [scenarios, setScenarios] = useState<TargetScenario[] | null>(null);
  const [pref, setPref] = usePersonalPref<Record<string, string>>("ebo_target_link", "ebo_target_link");

  useEffect(() => {
    fetch("/api/target-scenario?only=scenarios", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setScenarios(j?.scenarios || []))
      .catch(() => setScenarios([]));
  }, []);

  const yearScenarios = useMemo(
    () => (scenarios || []).filter((s) => savedPlanYear(s.snapshot) === year).sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at)),
    [scenarios, year]
  );
  const pick = [preferId, pref?.[String(year)]].find((id) => id && yearScenarios.some((s) => s.id === id));
  const linkedId = pick || yearScenarios[0]?.id || null;
  const linked = useMemo(() => {
    const s = yearScenarios.find((x) => x.id === linkedId);
    if (!s) return null;
    try {
      return { scenario: s, numbers: unitNumbers(planFromSaved(s.snapshot)) as Record<string, UnitNumbers> };
    } catch {
      return null;
    }
  }, [yearScenarios, linkedId]);

  return {
    loading: scenarios === null,
    yearScenarios,
    linkedId,
    linked,
    choose: (id: string) => setPref({ ...(pref || {}), [String(year)]: id }),
  };
}
