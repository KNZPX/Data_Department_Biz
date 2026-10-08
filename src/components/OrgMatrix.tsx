"use client";

// CoE / SBU × hospital matrix: one row per unit, one tick box per hospital.
// Used in Settings → Organisation and on the Target page.
import { Check, Plus, Trash2 } from "lucide-react";
import { clsx } from "clsx";
import { confirmDialog, promptDialog, toast } from "@/components/feedback";
import { UNIT_GROUPS, slug, type OrgStructure, type OrgUnit } from "@/lib/orgStructure";

export const GROUP_TONE: Record<string, string> = {
  CoE: "bg-blue-50 text-blue-700",
  SBU: "bg-violet-50 text-violet-700",
  "Hospital Focus": "bg-amber-50 text-amber-800",
  "Usual Business": "bg-slate-100 text-slate-600",
};

const siteLabel = (code: string) => code.replace(" (Premium)", "");

export function OrgMatrix({ value, onChange, readOnly }: { value: OrgStructure; onChange: (o: OrgStructure) => void; readOnly?: boolean }) {
  const sites = value.sites.filter((s) => s.active);
  const groups = Array.from(new Set([...UNIT_GROUPS, ...value.units.map((u) => u.group)]));
  const edit = (f: (o: OrgStructure) => OrgStructure) => onChange(f(structuredClone(value)));
  const setUnit = (id: string, patch: Partial<OrgUnit>) => edit((o) => ({ ...o, units: o.units.map((u) => (u.id === id ? { ...u, ...patch } : u)) }));
  const toggle = (u: OrgUnit, code: string) => setUnit(u.id, { sites: u.sites.includes(code) ? u.sites.filter((c) => c !== code) : [...u.sites, code] });

  async function addUnit(group: string) {
    const name = await promptDialog({ title: `Add a ${group}`, label: "Name", placeholder: group === "SBU" ? "SBU Eye" : "CoE Spine", confirmLabel: "Add" });
    if (!name) return;
    if (value.units.some((u) => u.name.toLowerCase() === name.trim().toLowerCase())) return void toast.error(`${name} is already there`);
    let id = slug(name);
    while (value.units.some((u) => u.id === id)) id += "-2";
    edit((o) => ({ ...o, units: [...o.units, { id, name: name.trim(), group, sites: [], active: true }] }));
  }
  async function removeUnit(u: OrgUnit) {
    const ok = await confirmDialog({
      title: `Remove ${u.name}?`,
      body: "Saved plans keep their numbers, but new plans won't include it. You can also just switch it off.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (ok) edit((o) => ({ ...o, units: o.units.filter((x) => x.id !== u.id) }));
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-separate border-spacing-0 text-[13px]">
        <thead className="sticky top-0 z-10 bg-white">
          <tr className="text-left text-[11.5px] text-slate-500">
            <th className="border-b border-slate-200 px-3 py-2 font-medium">CoE / SBU</th>
            <th className="w-36 border-b border-slate-200 px-2 py-2 font-medium">Group</th>
            {sites.map((s) => (
              <th key={s.code} className="w-20 border-b border-slate-200 px-1 py-2 text-center font-medium">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                  <span className="font-semibold text-slate-800">{siteLabel(s.code)}</span>
                </span>
                <span className="block text-[10.5px] font-normal text-slate-400">{value.units.filter((u) => u.active && u.sites.includes(s.code)).length} units</span>
              </th>
            ))}
            <th className="w-16 border-b border-slate-200 px-2 py-2 text-center font-medium">Active</th>
            <th className="w-10 border-b border-slate-200" />
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => {
            const list = value.units.filter((u) => u.group === g);
            if (!list.length && readOnly) return null;
            return [
              <tr key={`g-${g}`}>
                <td colSpan={sites.length + 4} className="border-b border-slate-100 bg-slate-50/70 px-3 py-1.5">
                  <span className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className={clsx("rounded px-1.5 py-px text-[11px] font-semibold", GROUP_TONE[g] || "bg-slate-100 text-slate-600")}>{g}</span>
                      <span className="text-[11.5px] text-slate-400">{list.length}</span>
                    </span>
                    {!readOnly && (
                      <button type="button" onClick={() => void addUnit(g)} className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[12px] font-medium text-blue-600 hover:bg-blue-50">
                        <Plus className="h-3.5 w-3.5" /> Add {g}
                      </button>
                    )}
                  </span>
                </td>
              </tr>,
              ...list.map((u) => (
                <tr key={u.id} className={clsx("group", !u.active && "opacity-55")}>
                  <td className="border-b border-slate-100 px-2 py-1">
                    <input
                      value={u.name}
                      readOnly={readOnly}
                      onChange={(e) => setUnit(u.id, { name: e.target.value })}
                      aria-label="Unit name"
                      className="h-8 w-full min-w-[160px] rounded-md border border-transparent bg-transparent px-1.5 font-medium text-slate-900 outline-none hover:border-slate-200 focus:border-blue-400 focus:bg-white read-only:hover:border-transparent"
                    />
                  </td>
                  <td className="border-b border-slate-100 px-1 py-1">
                    <select
                      value={u.group}
                      disabled={readOnly}
                      onChange={(e) => setUnit(u.id, { group: e.target.value })}
                      aria-label={`${u.name} group`}
                      className="h-8 w-full rounded-md border border-transparent bg-transparent px-1 text-[12.5px] text-slate-600 outline-none hover:border-slate-200 disabled:hover:border-transparent"
                    >
                      {groups.map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </td>
                  {sites.map((s) => {
                    const on = u.sites.includes(s.code);
                    return (
                      <td key={s.code} className="border-b border-slate-100 px-1 py-1 text-center">
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={on}
                          aria-label={`${u.name} at ${siteLabel(s.code)}`}
                          disabled={readOnly}
                          onClick={() => toggle(u, s.code)}
                          className={clsx(
                            "mx-auto grid h-7 w-7 place-items-center rounded-md border-2 transition",
                            on ? "border-transparent text-white" : "border-slate-200 bg-white text-transparent",
                            !readOnly && (on ? "hover:brightness-110" : "hover:border-slate-400")
                          )}
                          style={on ? { background: s.color } : undefined}
                        >
                          <Check className="h-4 w-4" strokeWidth={3} />
                        </button>
                      </td>
                    );
                  })}
                  <td className="border-b border-slate-100 px-1 py-1 text-center">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={u.active}
                      aria-label={`${u.name} active`}
                      disabled={readOnly}
                      onClick={() => setUnit(u.id, { active: !u.active })}
                      className={clsx("relative mx-auto block h-5 w-9 rounded-full transition-colors disabled:cursor-not-allowed", u.active ? "bg-blue-600" : "bg-slate-300")}
                    >
                      <span className={clsx("absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform", u.active ? "translate-x-[18px]" : "translate-x-0.5")} />
                    </button>
                  </td>
                  <td className="border-b border-slate-100 px-1 py-1">
                    {!readOnly && (
                      <button type="button" onClick={() => void removeUnit(u)} aria-label={`Remove ${u.name}`} className="grid h-7 w-7 place-items-center rounded-md text-slate-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              )),
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}
