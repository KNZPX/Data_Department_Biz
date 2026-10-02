"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Download, FileUp, KeyRound, Loader2, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { clsx } from "clsx";
import { Modal } from "@/components/ui";
import { LicenseFormModal } from "@/components/LicenseFormModal";
import { LicenseImportModal } from "@/components/LicenseImportModal";
import { batchImportLicenses, deleteLicense, getLicenses, saveLicense } from "@/lib/apiLicenses";
import type { LicenseInput, PowerBiLicense } from "@/lib/licenseTypes";
import { useAccess } from "@/components/auth/LoginGate";

type Grant = {
  id: string;
  email: string;
  resource_type: "workspace" | "dataset" | "report";
  resource_id: string;
  resource_name: string | null;
  workspace_id: string | null;
  workspace_name: string | null;
  permission: string;
  granted_by: string | null;
  updated_at: string;
};
type Resources = {
  workspaces: { id: string; name: string; reports: number }[];
  reports: { id: string; name: string; workspace_id: string; workspace_name: string }[];
  datasets: { id: string; name: string }[];
};

const TYPE_LABEL = { workspace: "Workspace", dataset: "Dataset", report: "Report" } as const;
const LEVEL_TONE: Record<string, string> = {
  Admin: "bg-blue-50 text-blue-700",
  Owner: "bg-blue-50 text-blue-700",
  Member: "bg-blue-100 text-blue-800",
  Write: "bg-blue-100 text-blue-800",
  Edit: "bg-blue-100 text-blue-800",
  Contributor: "bg-teal-live/15 text-teal-800",
  Build: "bg-teal-live/15 text-teal-800",
  Reshare: "bg-teal-live/15 text-teal-800",
  Viewer: "bg-slate-100 text-slate-700",
  Read: "bg-slate-100 text-slate-700",
};

function statusOf(l: PowerBiLicense): { label: string; tone: string } {
  if (l.status === "revoked") return { label: "Revoked", tone: "bg-coral/10 text-coral" };
  if ((l.license_type || "").toLowerCase().includes("cancel")) return { label: "Cancelled", tone: "bg-slate-100 text-slate-500" };
  if (l.status === "pending") return { label: "Pending", tone: "bg-amber-100 text-amber-800" };
  if (l.status === "inactive") return { label: "Inactive", tone: "bg-slate-100 text-slate-500" };
  return { label: "Active", tone: "bg-teal-live/15 text-teal-800" };
}

function licenseShort(t: string) {
  const s = (t || "").toLowerCase();
  if (s.includes("pro")) return "Pro";
  if (s.includes("premium")) return "Premium";
  if (s.includes("cancel")) return "Cancelled";
  return t || "";
}

function fmtDate(iso?: string | null) {
  return iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
}

// ---------------------------------------------------------------------------
function PermissionDialog({
  license,
  resources,
  canEdit,
  onClose,
  onChanged,
}: {
  license: PowerBiLicense;
  resources: Resources | null;
  canEdit: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [grants, setGrants] = useState<Grant[]>([]);
  const [levels, setLevels] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<Grant["resource_type"]>("workspace");
  const [ws, setWs] = useState("");
  const [res, setRes] = useState("");
  const [level, setLevel] = useState("Viewer");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const r = await fetch(`/api/licenses/permissions?email=${encodeURIComponent(license.email)}`, { cache: "no-store" });
    const j = await r.json();
    setGrants(j.permissions || []);
    setLevels(j.levels || {});
    setLoading(false);
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [license.email]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLevel((levels[type] || ["Viewer"])[0]);
    setRes("");
  }, [type, levels]);

  const reportsInWs = resources?.reports.filter((r) => !ws || r.workspace_id === ws) || [];

  async function add() {
    setError(null);
    let payload: Partial<Grant> & { permission: string };
    if (type === "workspace") {
      const w = resources?.workspaces.find((x) => x.id === ws);
      if (!w) return setError("Choose a workspace.");
      payload = { resource_type: "workspace", resource_id: w.id, resource_name: w.name, workspace_id: w.id, workspace_name: w.name, permission: level };
    } else if (type === "report") {
      const r = resources?.reports.find((x) => x.id === res);
      if (!r) return setError("Choose a report.");
      payload = { resource_type: "report", resource_id: r.id, resource_name: r.name, workspace_id: r.workspace_id, workspace_name: r.workspace_name, permission: level };
    } else {
      const d = resources?.datasets.find((x) => x.id === res);
      if (!d) return setError("Choose a dataset.");
      const w = resources?.workspaces.find((x) => x.id === ws);
      payload = { resource_type: "dataset", resource_id: d.id, resource_name: d.name, workspace_id: w?.id || null, workspace_name: w?.name || null, permission: level };
    }
    const r = await fetch("/api/licenses/permissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "upsert", email: license.email, ...payload }),
    });
    const j = await r.json();
    if (!r.ok) return setError(j.error || "Couldn't save.");
    await load();
    onChanged();
  }

  async function remove(id: string) {
    await fetch("/api/licenses/permissions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id }) });
    await load();
    onChanged();
  }

  const grouped = (["workspace", "dataset", "report"] as const).map((t) => ({ t, list: grants.filter((g) => g.resource_type === t) }));

  return (
    <Modal className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 backdrop-blur-[2px]">
      <div role="dialog" aria-modal="true" className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <p className="text-lg font-semibold text-slate-900">Permissions for {license.first_name || license.name}</p>
            <p className="text-sm text-slate-500">
              {license.email}, {licenseShort(license.license_type)} license
            </p>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {canEdit && (
          <div className="border-b border-slate-100 bg-slate-50/70 px-6 py-4">
            <p className="mb-2 text-sm font-medium text-slate-800">Give access</p>
            <div className="flex flex-wrap items-center gap-2">
              <select value={type} onChange={(e) => setType(e.target.value as Grant["resource_type"])} className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm">
                <option value="workspace">Workspace</option>
                <option value="dataset">Dataset</option>
                <option value="report">Report</option>
              </select>
              <select value={ws} onChange={(e) => { setWs(e.target.value); setRes(""); }} className="w-56 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm">
                <option value="">{type === "workspace" ? "Choose workspace" : "Any workspace"}</option>
                {resources?.workspaces.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
              {type !== "workspace" && (
                <select value={res} onChange={(e) => setRes(e.target.value)} className="w-64 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm">
                  <option value="">{type === "report" ? `Choose report (${reportsInWs.length})` : "Choose dataset"}</option>
                  {(type === "report" ? reportsInWs : resources?.datasets || []).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              )}
              <select value={level} onChange={(e) => setLevel(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm">
                {(levels[type] || []).map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
              <button type="button" onClick={() => void add()} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-700">
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>
            {error && <p className="mt-2 text-sm text-coral">{error}</p>}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {loading && <Loader2 className="mx-auto my-8 h-5 w-5 animate-spin text-slate-400" />}
          {!loading && grants.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No workspace, dataset or report access recorded yet.</p>}
          {grouped.map(
            ({ t, list }) =>
              list.length > 0 && (
                <div key={t} className="mb-5">
                  <p className="mb-2 text-sm font-medium text-slate-900">
                    {TYPE_LABEL[t]}s <span className="text-slate-400">{list.length}</span>
                  </p>
                  <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
                    {list.map((g) => (
                      <li key={g.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-slate-900">{g.resource_name || g.resource_id}</p>
                          {t !== "workspace" && g.workspace_name && <p className="truncate text-xs text-slate-500">{g.workspace_name}</p>}
                        </div>
                        <span className={clsx("rounded-md px-2 py-0.5 text-xs", LEVEL_TONE[g.permission] || "bg-slate-100")}>{g.permission}</span>
                        {canEdit && (
                          <button type="button" onClick={() => void remove(g.id)} className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-coral/10 hover:text-coral" aria-label="Remove access">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )
          )}
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
export function LicensesPage() {
  const { can } = useAccess();
  const canEdit = can("licenses.edit");
  const [view, setView] = useState<"list" | "permissions">("list");
  const [licenses, setLicenses] = useState<PowerBiLicense[]>([]);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [resources, setResources] = useState<Resources | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [site, setSite] = useState("All");
  const [type, setType] = useState("All");
  const [status, setStatus] = useState("All");
  const [permFor, setPermFor] = useState<PowerBiLicense | null>(null);
  const [editing, setEditing] = useState<PowerBiLicense | null | "new">(null);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [permQ, setPermQ] = useState("");

  async function loadAll() {
    const [ls, pr, rs] = await Promise.all([
      getLicenses(),
      fetch("/api/licenses/permissions", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
      fetch("/api/licenses/resources", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
    ]);
    setLicenses(ls);
    setGrants(pr.permissions || []);
    setResources(rs);
    setLoading(false);
  }
  useEffect(() => {
    void loadAll();
  }, []);

  const grantCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of grants) m.set(g.email.toLowerCase(), (m.get(g.email.toLowerCase()) || 0) + 1);
    return m;
  }, [grants]);

  const sites = useMemo(() => Array.from(new Set(licenses.map((l) => l.site || l.hospital).filter(Boolean))).sort(), [licenses]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return licenses
      .filter((l) => site === "All" || (l.site || l.hospital) === site)
      .filter((l) => type === "All" || licenseShort(l.license_type) === type)
      .filter((l) => status === "All" || statusOf(l).label === status)
      .filter((l) => !needle || `${l.email} ${l.name} ${l.display_name} ${l.name_th} ${l.position_en} ${l.position}`.toLowerCase().includes(needle))
      .sort((a, b) => (a.email || "").localeCompare(b.email || ""));
  }, [licenses, q, site, type, status]);

  async function exportExcel() {
    setExporting(true);
    try {
      const res = await fetch("/api/licenses/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ licenses: rows }) });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `Power_BI_Licenses_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
    } finally {
      setExporting(false);
    }
  }

  // Permission view: workspace → its grants (workspace-level, datasets, reports)
  const tree = useMemo(() => {
    const needle = permQ.trim().toLowerCase();
    const filtered = grants.filter((g) => !needle || `${g.email} ${g.resource_name} ${g.workspace_name}`.toLowerCase().includes(needle));
    const byWs = new Map<string, { name: string; grants: Grant[] }>();
    for (const g of filtered) {
      const key = g.workspace_id || `__none_${g.resource_type}`;
      const name = g.workspace_name || (g.resource_type === "dataset" ? "Datasets (no workspace)" : "Other");
      const e = byWs.get(key) || { name, grants: [] };
      e.grants.push(g);
      byWs.set(key, e);
    }
    return Array.from(byWs.entries()).sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [grants, permQ]);

  const nameOf = (email: string) => {
    const l = licenses.find((x) => x.email?.toLowerCase() === email.toLowerCase());
    return l ? `${l.first_name || ""} ${l.last_name || ""}`.trim() || l.name : "";
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center gap-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200/80">
        <div role="tablist" className="flex rounded-xl bg-slate-100 p-1">
          {(
            [
              ["list", "License list", licenses.length],
              ["permissions", "Permission view", grants.length],
            ] as const
          ).map(([id, label, n]) =>
            id === "permissions" && !can("licenses.permissions") ? null : (
              <button
                key={id}
                role="tab"
                aria-selected={view === id}
                type="button"
                onClick={() => setView(id)}
                className={clsx("rounded-lg px-3.5 py-1.5 text-sm", view === id ? "bg-white font-medium text-slate-900 shadow-sm" : "text-slate-600")}
              >
                {label} <span className="text-slate-400">{n}</span>
              </button>
            )
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {can("licenses.export") && (
            <>
              <button type="button" onClick={() => void exportExcel()} disabled={exporting} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
                <Download className="h-4 w-4" /> {exporting ? "Exporting…" : "Export"}
              </button>
              {canEdit && (
                <button type="button" onClick={() => setImportOpen(true)} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
                  <FileUp className="h-4 w-4" /> Import
                </button>
              )}
            </>
          )}
          {canEdit && (
            <button type="button" onClick={() => setEditing("new")} className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-700">
              <Plus className="h-4 w-4" /> Add license
            </button>
          )}
        </div>
      </div>

      {view === "list" ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/80">
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-100 p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search email, name, position" className="w-72 rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-400" />
            </div>
            {[
              ["Site", site, setSite, ["All", ...sites]],
              ["License", type, setType, ["All", "Pro", "Premium", "Cancelled"]],
              ["Status", status, setStatus, ["All", "Active", "Pending", "Revoked", "Cancelled", "Inactive"]],
            ].map(([label, value, set, opts]) => (
              <label key={label as string} className="flex items-center gap-1.5 text-xs text-slate-500">
                {label as string}
                <select value={value as string} onChange={(e) => (set as (v: string) => void)(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800">
                  {(opts as string[]).map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </label>
            ))}
            <span className="ml-auto text-xs text-slate-500">
              {rows.length} of {licenses.length}
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                  {["#", "Email", "Name", "Surname", "Position", "Site", "License type", "Status", "Date approved", ""].map((h) => (
                    <th key={h} className="px-3 py-2.5 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && (
                  <tr>
                    <td colSpan={10} className="py-12 text-center">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" />
                    </td>
                  </tr>
                )}
                {rows.map((l, i) => {
                  const st = statusOf(l);
                  const n = grantCount.get((l.email || "").toLowerCase()) || 0;
                  return (
                    <tr key={l.id} className="hover:bg-slate-50/70">
                      <td className="px-3 py-2 tabular-nums text-slate-400">{i + 1}</td>
                      <td className="px-3 py-2 text-slate-800">{l.email}</td>
                      <td className="px-3 py-2 text-slate-900">{l.first_name || l.name}</td>
                      <td className="px-3 py-2 text-slate-900">{l.last_name || ""}</td>
                      <td className="max-w-[220px] truncate px-3 py-2 text-slate-600" title={l.position_en || l.position || ""}>
                        {l.position_en || l.position || ""}
                      </td>
                      <td className="px-3 py-2 text-slate-600">{l.site || l.hospital}</td>
                      <td className="px-3 py-2 text-slate-600">{licenseShort(l.license_type)}</td>
                      <td className="px-3 py-2">
                        <span className={clsx("rounded-md px-2 py-0.5 text-xs", st.tone)}>{st.label}</span>
                      </td>
                      <td className="px-3 py-2 tabular-nums text-slate-600">{fmtDate(l.approved_at)}</td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1">
                          <button type="button" onClick={() => setPermFor(l)} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50">
                            <KeyRound className="h-3.5 w-3.5" /> Permissions{n ? ` (${n})` : ""}
                          </button>
                          {canEdit && (
                            <button type="button" onClick={() => setEditing(l)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100" aria-label="Edit license">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/80">
          <div className="flex shrink-0 items-center gap-2 border-b border-slate-100 p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={permQ} onChange={(e) => setPermQ(e.target.value)} placeholder="Search workspace, report or email" className="w-80 rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-400" />
            </div>
            <button type="button" className="text-xs text-blue-700 hover:underline" onClick={() => setOpen(Object.fromEntries(tree.map(([k]) => [k, true])))}>
              Expand all
            </button>
            <button type="button" className="text-xs text-blue-700 hover:underline" onClick={() => setOpen({})}>
              Collapse all
            </button>
            <span className="ml-auto text-xs text-slate-500">
              {grants.length} grants across {tree.length} workspaces
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {tree.length === 0 && (
              <p className="p-10 text-center text-sm text-slate-500">
                No permissions recorded yet. Open a person in the License list and use <span className="font-medium">Permissions</span> to add some.
              </p>
            )}
            <table className="w-full min-w-[900px] text-sm">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                  <th className="px-3 py-2.5 font-medium">Workspace / item</th>
                  <th className="px-3 py-2.5 font-medium">Type</th>
                  <th className="px-3 py-2.5 font-medium">Email</th>
                  <th className="px-3 py-2.5 font-medium">Name</th>
                  <th className="px-3 py-2.5 font-medium">Permission</th>
                  <th className="px-3 py-2.5 font-medium">Granted by</th>
                </tr>
              </thead>
              {tree.map(([key, w]) => {
                const isOpen = open[key] ?? tree.length <= 3;
                const people = new Set(w.grants.map((g) => g.email)).size;
                const items = [...w.grants].sort((a, b) => a.resource_type.localeCompare(b.resource_type) || (a.resource_name || "").localeCompare(b.resource_name || "") || a.email.localeCompare(b.email));
                return (
                  <tbody key={key} className="border-b border-slate-100">
                    <tr className="cursor-pointer bg-slate-50/80 hover:bg-slate-100/70" onClick={() => setOpen({ ...open, [key]: !isOpen })}>
                      <td colSpan={6} className="px-3 py-2.5">
                        <span className="flex items-center gap-2 font-medium text-slate-900">
                          {isOpen ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                          {w.name}
                          <span className="font-normal text-slate-500">
                            {people} people, {w.grants.length} grants
                          </span>
                        </span>
                      </td>
                    </tr>
                    {isOpen &&
                      items.map((g) => (
                        <tr key={g.id} className="hover:bg-slate-50/60">
                          <td className="px-3 py-2 pl-9 text-slate-800">{g.resource_type === "workspace" ? "Whole workspace" : g.resource_name}</td>
                          <td className="px-3 py-2 text-slate-500">{TYPE_LABEL[g.resource_type]}</td>
                          <td className="px-3 py-2 text-slate-800">{g.email}</td>
                          <td className="px-3 py-2 text-slate-600">{nameOf(g.email)}</td>
                          <td className="px-3 py-2">
                            <span className={clsx("rounded-md px-2 py-0.5 text-xs", LEVEL_TONE[g.permission] || "bg-slate-100")}>{g.permission}</span>
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-500">
                            {g.granted_by} {fmtDate(g.updated_at)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                );
              })}
            </table>
          </div>
        </div>
      )}

      {permFor && (
        <PermissionDialog
          license={permFor}
          resources={resources}
          canEdit={canEdit}
          onClose={() => setPermFor(null)}
          onChanged={() => void fetch("/api/licenses/permissions", { cache: "no-store" }).then((r) => r.json()).then((j) => setGrants(j.permissions || []))}
        />
      )}
      {editing && (
        <LicenseFormModal
          editing={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={async (item: LicenseInput) => {
            await saveLicense(item);
            setEditing(null);
            await loadAll();
          }}
          onDelete={async (id: string) => {
            await deleteLicense(id);
            setEditing(null);
            await loadAll();
          }}
        />
      )}
      {importOpen && (
        <LicenseImportModal
          onClose={() => setImportOpen(false)}
          onImport={async (rows2: LicenseInput[]) => {
            await batchImportLicenses(rows2);
            await loadAll();
          }}
        />
      )}
    </div>
  );
}
