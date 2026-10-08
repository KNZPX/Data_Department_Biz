"use client";

// EBO & OKR on one page: the EBO tab (each CoE / SBU's key products in three
// horizons, against its target) and the OKR tab (objectives, key results and
// initiatives). Both share the year and the open unit, so switching tabs keeps
// your place; objectives tagged with a horizon show up on the EBO tab, and the
// OKR tab shows the unit's EBO gap to its target.
import { useEffect, useState } from "react";
import { Flag, Rocket } from "lucide-react";
import { clsx } from "clsx";
import { EboPage } from "./EboPage";
import { OkrPage } from "./OkrPage";

type Tab = "ebo" | "okr";

export function EboOkrPage() {
  const [tab, setTab] = useState<Tab>("ebo");
  const [year, setYear] = useState(() => new Date().getFullYear() + 1);
  const [unitName, setUnitName] = useState<string | null>(null);
  const [scenario, setScenario] = useState<string | null>(null);

  // Links such as /okr?tab=ebo&year=2027&unit=CoE%20Trauma&scenario=… open straight there.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const y = parseInt(q.get("year") || "", 10);
    /* eslint-disable react-hooks/set-state-in-effect */
    if (q.get("tab") === "okr" || q.get("tab") === "ebo") setTab(q.get("tab") as Tab);
    if (Number.isFinite(y)) setYear(y);
    if (q.get("unit")) setUnitName(q.get("unit"));
    if (q.get("scenario")) setScenario(q.get("scenario"));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Keep the address in step, so the page can be shared or reloaded as it is.
  useEffect(() => {
    const q = new URLSearchParams();
    q.set("tab", tab);
    q.set("year", String(year));
    if (unitName) q.set("unit", unitName);
    if (scenario) q.set("scenario", scenario);
    window.history.replaceState(window.history.state, "", `${window.location.pathname}?${q.toString()}`);
  }, [tab, year, unitName, scenario]);

  const tabs = (
    <div role="tablist" aria-label="EBO or OKR" className="flex rounded-lg bg-slate-100 p-0.5 text-[13px]">
      {(
        [
          ["ebo", Rocket, "EBO"],
          ["okr", Flag, "OKR"],
        ] as const
      ).map(([id, Icon, label]) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={tab === id}
          onClick={() => setTab(id)}
          className={clsx("flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold transition", tab === id ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-900")}
        >
          <Icon className="h-4 w-4" /> {label}
        </button>
      ))}
    </div>
  );

  const shared = {
    year,
    setYear: (f: (y: number) => number) => setYear(f),
    unitName,
    setUnitName,
    tabs,
    preferScenario: scenario,
  };
  return tab === "ebo" ? <EboPage {...shared} onOtherTab={() => setTab("okr")} /> : <OkrPage {...shared} onOtherTab={() => setTab("ebo")} />;
}
