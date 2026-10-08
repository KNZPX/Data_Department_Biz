"use client";

// Settings → Organisation: hospitals and the CoE / SBU units in each.
// The Target planner and the EBO & OKR page are built on this.
import { useMemo, useState } from "react";
import { Building2, Check, GitFork, Grid3x3, List, Loader2, Plus, Save, ShieldAlert, Trash2 } from "lucide-react";
import { clsx } from "clsx";
import { useAccess } from "@/components/auth/LoginGate";
import { confirmDialog, promptDialog, toast } from "@/components/feedback";
import { TreeDiagram, type TreeNode } from "@/components/TreeDiagram";
import { OrgMatrix } from "@/components/OrgMatrix";
import { UNIT_GROUPS, slug, type OrgStructure, type OrgUnit } from "@/lib/orgStructure";
import { ORG_EVENT, useOrgStructure } from "@/lib/useOrgStructure";
import { useT } from "@/lib/i18n";

const GROUP_TONE: Record<string, string> = {
  CoE: "bg-blue-50 text-blue-700",
  SBU: "bg-violet-50 text-violet-700",
  "Hospital Focus": "bg-amber-50 text-amber-800",
  "Usual Business": "bg-slate-100 text-slate-600",
};

export function OrganisationTab() {
  const t = useT();
  const { isAdmin } = useAccess();
  const { org, meta, loaded } = useOrgStructure();
  const [draft, setDraft] = useState<OrgStructure | null>(null);
  const [view, setView] = useState<"matrix" | "list" | "diagram">("matrix");
  const [saving, setSaving] = useState(false);
  const cur = draft || org;
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(org);

  const edit = (f: (o: OrgStructure) => OrgStructure) => setDraft(f(structuredClone(cur)));
  const setUnit = (id: string, patch: Partial<OrgUnit>) => edit((o) => ({ ...o, units: o.units.map((u) => (u.id === id ? { ...u, ...patch } : u)) }));

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/team-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "org_structure", value: cur }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "The server didn't accept it");
      window.dispatchEvent(new Event(ORG_EVENT));
      setDraft(null);
      toast("Organisation saved", { body: "Planning pages use it from now on." });
    } catch (e) {
      toast.error("Couldn't save", { body: e instanceof Error ? e.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  async function addSite() {
    const code = await promptDialog({ title: "Add a hospital", label: "Short code (e.g. BPK)", placeholder: "BPK", confirmLabel: "Add" });
    if (!code) return;
    if (cur.sites.some((s) => s.code.toLowerCase() === code.toLowerCase())) return void toast.error(`${code} is already there`);
    edit((o) => ({ ...o, sites: [...o.sites, { code, name: code, fullName: code, color: "#0ea5e9", active: true }] }));
  }
  async function addUnit(group: string) {
    const name = await promptDialog({ title: `Add a ${group}`, label: "Name", placeholder: group === "SBU" ? "SBU Eye" : "CoE Spine", confirmLabel: "Add" });
    if (!name) return;
    let id = slug(name);
    while (cur.units.some((u) => u.id === id)) id += "-2";
    edit((o) => ({ ...o, units: [...o.units, { id, name, group, sites: o.sites.filter((s) => s.active).map((s) => s.code), active: true }] }));
  }
  async function removeUnit(u: OrgUnit) {
    const ok = await confirmDialog({
      title: `Remove ${u.name}?`,
      body: "Saved plans and OKRs keep their numbers, but new plans won't include it. You can also just switch it off.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (ok) edit((o) => ({ ...o, units: o.units.filter((x) => x.id !== u.id) }));
  }

  const tree: TreeNode = useMemo(
    () => ({
      id: "net",
      label: "Phuket network",
      sub: `${cur.sites.filter((s) => s.active).length} hospitals · ${cur.units.filter((u) => u.active).length} units`,
      children: cur.sites.map((s) => ({
        id: s.code,
        label: s.code,
        sub: s.name,
        color: s.color,
        muted: !s.active,
        children: UNIT_GROUPS.map((g) => {
          const list = cur.units.filter((u) => u.group === g && u.sites.includes(s.code));
          return list.length
            ? {
                id: `${s.code}-${g}`,
                label: g,
                sub: list.map((u) => u.name.replace(/^(CoE|SBU) /, "")).join(" · "),
                muted: list.every((u) => !u.active),
              }
            : null;
        }).filter(Boolean) as TreeNode[],
      })),
    }),
    [cur]
  );

  const groups = Array.from(new Set([...UNIT_GROUPS, ...cur.units.map((u) => u.group)]));
  const ro = !isAdmin;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-white px-5 py-4">
        <div>
          <h3 className="text-[15px] font-semibold text-slate-900">{t("Organisation")}</h3>
          <p className="text-[12.5px] text-slate-500">
            Hospitals and their CoE / SBU units. The Target planner and EBO &amp; OKR are built on this.
            {meta.saved && meta.updatedAt && (
              <span className="ml-1 text-slate-400">
                Last changed by {meta.updatedBy} · {new Date(meta.updatedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
              </span>
            )}
            {loaded && !meta.saved && <span className="ml-1 text-slate-400">Showing the structure from the 2027 planning file until someone saves.</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-slate-100 p-0.5">
            {(
              [
                ["matrix", Grid3x3, "By hospital"],
                ["list", List, "List"],
                ["diagram", GitFork, "Diagram"],
              ] as const
            ).map(([v, Icon, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={clsx("flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12.5px] font-medium", view === v ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => void save()}
              disabled={!dirty || saving}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
            </button>
          )}
        </div>
      </div>

      {ro && (
        <p className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-[12.5px] text-slate-600">
          <ShieldAlert className="h-4 w-4 text-slate-400" /> Only admins can change the organisation.
        </p>
      )}

      {view === "matrix" ? (
        <div className="rounded-xl border border-slate-200/80 bg-white">
          <p className="border-b border-slate-100 px-5 py-3 text-[12.5px] text-slate-500">Tick the hospitals each CoE / SBU runs in. Save, then use “Apply to this plan” on the Target page to bring an open plan in line.</p>
          <OrgMatrix value={cur} onChange={(o) => setDraft(o)} readOnly={ro} />
        </div>
      ) : view === "diagram" ? (
        <div className="rounded-xl border border-slate-200/80 bg-white p-5">
          <TreeDiagram root={tree} />
        </div>
      ) : (
        <>
          {/* Hospitals */}
          <div className="rounded-xl border border-slate-200/80 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <h4 className="flex items-center gap-2 text-[13.5px] font-semibold text-slate-900">
                <Building2 className="h-4 w-4 text-slate-400" /> Hospitals
              </h4>
              {!ro && (
                <button type="button" onClick={() => void addSite()} className="flex items-center gap-1 rounded-md px-2 py-1 text-[12.5px] font-medium text-blue-600 hover:bg-blue-50">
                  <Plus className="h-3.5 w-3.5" /> Add hospital
                </button>
              )}
            </div>
            <div className="divide-y divide-slate-100">
              {cur.sites.map((s, i) => (
                <div key={s.code} className={clsx("grid items-center gap-2 px-5 py-2.5 sm:grid-cols-[90px_1fr_1.6fr_auto_auto]", !s.active && "opacity-60")}>
                  <span className="flex items-center gap-2 font-mono text-[13px] font-semibold text-slate-900">
                    <input
                      type="color"
                      value={s.color}
                      disabled={ro}
                      onChange={(e) => edit((o) => ({ ...o, sites: o.sites.map((x, j) => (j === i ? { ...x, color: e.target.value } : x)) }))}
                      className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0"
                      aria-label={`${s.code} colour`}
                    />
                    {s.code}
                  </span>
                  <input
                    value={s.name}
                    readOnly={ro}
                    onChange={(e) => edit((o) => ({ ...o, sites: o.sites.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) }))}
                    className="h-8 rounded-md border border-slate-200 bg-white px-2 text-[13px] outline-none focus:border-blue-400"
                    aria-label="Short name"
                  />
                  <input
                    value={s.fullName}
                    readOnly={ro}
                    onChange={(e) => edit((o) => ({ ...o, sites: o.sites.map((x, j) => (j === i ? { ...x, fullName: e.target.value } : x)) }))}
                    className="h-8 rounded-md border border-slate-200 bg-white px-2 text-[13px] outline-none focus:border-blue-400"
                    aria-label="Full name"
                  />
                  <span className="text-[12px] text-slate-400">{cur.units.filter((u) => u.sites.includes(s.code)).length} units</span>
                  <Toggle on={s.active} disabled={ro} onChange={(v) => edit((o) => ({ ...o, sites: o.sites.map((x, j) => (j === i ? { ...x, active: v } : x)) }))} />
                </div>
              ))}
            </div>
          </div>

          {/* Units by group */}
          {groups.map((g) => {
            const list = cur.units.filter((u) => u.group === g);
            return (
              <div key={g} className="rounded-xl border border-slate-200/80 bg-white">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
                  <h4 className="flex items-center gap-2 text-[13.5px] font-semibold text-slate-900">
                    <span className={clsx("rounded px-1.5 py-px text-[11px] font-medium", GROUP_TONE[g] || "bg-slate-100 text-slate-600")}>{g}</span>
                    <span className="text-[12px] font-normal text-slate-400">{list.length}</span>
                  </h4>
                  {!ro && (
                    <button type="button" onClick={() => void addUnit(g)} className="flex items-center gap-1 rounded-md px-2 py-1 text-[12.5px] font-medium text-blue-600 hover:bg-blue-50">
                      <Plus className="h-3.5 w-3.5" /> Add {g}
                    </button>
                  )}
                </div>
                {list.length === 0 ? (
                  <p className="px-5 py-4 text-[12.5px] text-slate-400">None yet.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {list.map((u) => (
                      <div key={u.id} className={clsx("grid items-center gap-2 px-5 py-2.5 lg:grid-cols-[1.3fr_120px_1.6fr_1.2fr_auto_auto]", !u.active && "opacity-60")}>
                        <input
                          value={u.name}
                          readOnly={ro}
                          onChange={(e) => setUnit(u.id, { name: e.target.value })}
                          className="h-8 rounded-md border border-slate-200 bg-white px-2 text-[13px] font-medium outline-none focus:border-blue-400"
                          aria-label="Name"
                        />
                        <select
                          value={u.group}
                          disabled={ro}
                          onChange={(e) => setUnit(u.id, { group: e.target.value })}
                          className="h-8 rounded-md border border-slate-200 bg-white px-1.5 text-[12.5px] outline-none"
                          aria-label="Group"
                        >
                          {groups.map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </select>
                        <div className="flex flex-wrap gap-1">
                          {cur.sites.map((s) => {
                            const on = u.sites.includes(s.code);
                            return (
                              <button
                                key={s.code}
                                type="button"
                                disabled={ro}
                                onClick={() => setUnit(u.id, { sites: on ? u.sites.filter((c) => c !== s.code) : [...u.sites, s.code] })}
                                className={clsx("flex h-7 items-center gap-1 rounded-full border px-2 text-[11.5px] font-medium transition", on ? "border-transparent text-white" : "border-slate-200 text-slate-400")}
                                style={on ? { background: s.color } : undefined}
                                aria-pressed={on}
                              >
                                {on && <Check className="h-3 w-3" />}
                                {s.code.replace(" (Premium)", "")}
                              </button>
                            );
                          })}
                        </div>
                        <input
                          value={u.lead || ""}
                          readOnly={ro}
                          placeholder="Lead / owner"
                          onChange={(e) => setUnit(u.id, { lead: e.target.value })}
                          className="h-8 rounded-md border border-slate-200 bg-white px-2 text-[12.5px] outline-none placeholder:text-slate-400 focus:border-blue-400"
                          aria-label="Lead"
                        />
                        <Toggle on={u.active} disabled={ro} onChange={(v) => setUnit(u.id, { active: v })} />
                        {!ro ? (
                          <button type="button" onClick={() => void removeUnit(u)} className="grid h-8 w-8 place-items-center rounded-md text-slate-300 hover:bg-rose-50 hover:text-rose-600" aria-label={`Remove ${u.name}`}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : (
                          <span />
                        )}
                        <input
                          value={u.description || ""}
                          readOnly={ro}
                          placeholder="What this unit covers (optional)"
                          onChange={(e) => setUnit(u.id, { description: e.target.value })}
                          className="h-8 rounded-md border border-transparent bg-transparent px-2 text-[12px] text-slate-500 outline-none placeholder:text-slate-300 hover:border-slate-200 focus:border-blue-400 focus:bg-white lg:col-span-7"
                          aria-label="Description"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

export function Toggle({ on, onChange, disabled, label }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label || (on ? "On" : "Off")}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={clsx("relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200 disabled:cursor-not-allowed", on ? "bg-blue-600" : "bg-slate-300")}
      title={on ? "Active" : "Switched off"}
    >
      <span className={clsx("absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200", on ? "translate-x-[18px]" : "translate-x-0.5")} />
    </button>
  );
}
