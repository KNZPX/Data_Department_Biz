"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Check,
  Download,
  Eye,
  FileSpreadsheet,
  FolderKanban,
  Globe,
  Lock,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { clsx } from "clsx";
import { Button, EmptyState, Input, Modal, Panel, Select, StatCard } from "@/components/ui";
import { LicenseFormModal } from "@/components/LicenseFormModal";
import { LicenseImportModal } from "@/components/LicenseImportModal";
import {
  COMMON_HOSPITALS,
  COMMON_LICENSE_TYPES,
  POWER_BI_32_COLUMNS,
  SECURITY_GROUPS_LIST,
  getAccessibleWorkspaces,
  getGrantedPermissions,
  type ColumnGroupKey,
  type LicenseInput,
  type PowerBiLicense,
} from "@/lib/licenseTypes";
import { batchImportLicenses, deleteLicense, getLicenses, saveLicense } from "@/lib/apiLicenses";

export function LicensesPage() {
  const [licenses, setLicenses] = useState<PowerBiLicense[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [hospitalFilter, setHospitalFilter] = useState("All");
  const [licenseTypeFilter, setLicenseTypeFilter] = useState("All");
  const [activeGroup, setActiveGroup] = useState<ColumnGroupKey>("overview");
  const [pageViewMode, setPageViewMode] = useState<"table" | "permissions">("table");
  const [permGroupBy, setPermGroupBy] = useState<"department" | "site" | "workspace">("department");

  const [formOpen, setFormOpen] = useState(false);
  const [editingLicense, setEditingLicense] = useState<PowerBiLicense | null>(null);
  const [detailLicense, setDetailLicense] = useState<PowerBiLicense | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const data = await getLicenses();
      setLicenses(data);
    } catch (err) {
      console.error("Failed to load licenses:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(input: LicenseInput) {
    const saved = await saveLicense(input);
    setLicenses((prev) => {
      const idx = prev.findIndex((l) => l.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
  }

  async function handleDelete(id: string) {
    await deleteLicense(id);
    setLicenses((prev) => prev.filter((l) => l.id !== id));
  }

  async function handleBatchImport(rows: LicenseInput[]) {
    await batchImportLicenses(rows);
    await loadData();
  }

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch("/api/licenses/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenses: filteredLicenses }),
      });
      if (!res.ok) throw new Error("Failed to export Excel file");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `2026_List_Power_BI_License_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to export");
    } finally {
      setExporting(false);
    }
  }

  const filteredLicenses = useMemo(() => {
    return licenses.filter((item) => {
      if (hospitalFilter !== "All" && item.hospital !== hospitalFilter && item.site !== hospitalFilter) {
        return false;
      }
      if (licenseTypeFilter !== "All" && item.license_type !== licenseTypeFilter) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          item.name_th.toLowerCase().includes(q) ||
          item.display_name.toLowerCase().includes(q) ||
          item.email.toLowerCase().includes(q) ||
          item.ad_account.toLowerCase().includes(q) ||
          item.department_name.toLowerCase().includes(q) ||
          item.department_en.toLowerCase().includes(q) ||
          item.person_id.toLowerCase().includes(q) ||
          item.user_id.toLowerCase().includes(q) ||
          item.position_en.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [licenses, hospitalFilter, licenseTypeFilter, search]);

  const stats = useMemo(() => {
    const total = licenses.length;
    const active = licenses.filter((l) => l.status === "active").length;
    const capacityUsers = licenses.filter(
      (l) => l.pbi_premium_capacity && !l.pbi_premium_capacity.toLowerCase().includes("no")
    ).length;
    const proUsers = licenses.filter(
      (l) => l.pbi_pro_license && !l.pbi_pro_license.toLowerCase().includes("no")
    ).length;
    const phuketSecGroupUsers = licenses.filter(
      (l) => l.bpk_phuket_executive || l.bpk_phuket_marketing || l.bpk_phuket_hod || l.bpk_phuket_stg || l.bpk_phuket_admin
    ).length;

    return { total, active, capacityUsers, proUsers, phuketSecGroupUsers };
  }, [licenses]);

  const activeColumns = useMemo(() => {
    if (activeGroup === "all") return POWER_BI_32_COLUMNS;
    if (activeGroup === "org") return POWER_BI_32_COLUMNS.filter((c) => c.category === "General");
    if (activeGroup === "creator") return POWER_BI_32_COLUMNS.filter((c) => c.category === "Creator");
    if (activeGroup === "license") return POWER_BI_32_COLUMNS.filter((c) => c.category === "Capacity");
    if (activeGroup === "security") return POWER_BI_32_COLUMNS.filter((c) => c.category === "Phuket" || c.category === "Site");
    return [
      { key: "site", header: "Site" },
      { key: "display_name", header: "Display Name" },
      { key: "name_th", header: "Name (TH)" },
      { key: "ad_account", header: "AD Account" },
      { key: "department_name", header: "Department" },
      { key: "position_en", header: "Position" },
      { key: "license_type", header: "License Type" },
      { key: "status", header: "Status" },
    ];
  }, [activeGroup]);

  return (
    <div className="h-full overflow-y-auto pr-1 space-y-6 pb-12">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total License Holders" value={stats.total} icon={Users} tone="gold" />
        <StatCard label="Active Licenses" value={stats.active} icon={UserCheck} tone="emerald" />
        <StatCard label="Premium Capacity Users" value={stats.capacityUsers} icon={ShieldCheck} tone="gold" />
        <StatCard label="With Security Groups" value={stats.phuketSecGroupUsers} icon={Lock} tone="default" />
      </div>

      {/* Main Filter & Action Toolbar */}
      <Panel className="p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* View Mode Toggle: Table vs Permissions */}
          <div className="inline-flex rounded-full bg-slate-100 p-1 border border-slate-200">
            <button
              type="button"
              onClick={() => setPageViewMode("table")}
              className={clsx(
                "rounded-full px-4 py-1.5 text-xs font-bold transition",
                pageViewMode === "table" ? "bg-[#2563EB] text-white shadow-xs" : "text-slate-600 hover:text-[#2563EB]"
              )}
            >
              License Table (32 Columns)
            </button>
            <button
              type="button"
              onClick={() => setPageViewMode("permissions")}
              className={clsx(
                "rounded-full px-4 py-1.5 text-xs font-bold transition",
                pageViewMode === "permissions" ? "bg-[#2563EB] text-white shadow-xs" : "text-slate-600 hover:text-[#2563EB]"
              )}
            >
              Permission Matrix Analysis
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              dense
              onClick={() => setImportOpen(true)}
            >
              <Upload className="h-3.5 w-3.5 text-[#2563EB]" />
              <span>Import Excel</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              dense
              onClick={handleExport}
              disabled={exporting || filteredLicenses.length === 0}
            >
              <Download className="h-3.5 w-3.5 text-emerald-600" />
              <span>Export 32 Columns</span>
            </Button>
            <Button
              type="button"
              variant="primary"
              dense
              onClick={() => {
                setEditingLicense(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add User</span>
            </Button>
          </div>
        </div>

        {/* Search & Dropdown Filters */}
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <Input
              icon={Search}
              clearable
              onClear={() => setSearch("")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, AD account, email, department, person ID..."
            />
          </div>
          <div>
            <Select value={hospitalFilter} onChange={(e) => setHospitalFilter(e.target.value)}>
              <option value="All">All Business Sites / Branches</option>
              {COMMON_HOSPITALS.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Select value={licenseTypeFilter} onChange={(e) => setLicenseTypeFilter(e.target.value)}>
              <option value="All">All License Types</option>
              {COMMON_LICENSE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* 32-Column Category Selector (Only in table mode) */}
        {pageViewMode === "table" ? (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3 text-xs">
            <span className="font-semibold text-slate-500 mr-1">Column Groups:</span>
            {[
              { key: "overview", label: "Overview" },
              { key: "all", label: "All 32 Columns" },
              { key: "org", label: "1. Profile (General)" },
              { key: "creator", label: "2. Requestor (Creator)" },
              { key: "license", label: "3. License & Capacity" },
              { key: "security", label: "4. Security Groups" },
            ].map((g) => (
              <button
                key={g.key}
                type="button"
                onClick={() => setActiveGroup(g.key as ColumnGroupKey)}
                className={clsx(
                  "rounded-full px-3 py-1 font-semibold transition border",
                  activeGroup === g.key
                    ? "bg-[#2563EB] text-white border-[#2563EB] shadow-xs"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-[#2563EB]/10 hover:text-[#2563EB]"
                )}
              >
                {g.label}
              </button>
            ))}
          </div>
        ) : null}
      </Panel>

      {/* Main Content Area */}
      {loading ? (
        <div className="grid place-items-center py-16 text-slate-400">
          <p className="text-sm font-medium">Loading Power BI License dataset...</p>
        </div>
      ) : filteredLicenses.length === 0 ? (
        <EmptyState>
          <p className="text-base font-semibold text-slate-800">No license records match your criteria</p>
          <p className="mt-1 text-xs text-slate-500">Click &quot;Import Excel&quot; or &quot;Add User&quot; to manage licenses</p>
        </EmptyState>
      ) : pageViewMode === "table" ? (
        /* Table View */
        <div className="overflow-x-auto rounded-3xl border border-slate-200/90 bg-white shadow-xs">
          <table className="table table-zebra table-xs w-full text-left">
            <thead className="bg-slate-50 text-[#2563EB] font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-3 whitespace-nowrap">#</th>
                {activeColumns.map((col) => (
                  <th key={String(col.key)} className="py-3 px-3 whitespace-nowrap">
                    {col.header}
                  </th>
                ))}
                <th className="py-3 px-3 text-right whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLicenses.map((row, idx) => (
                <tr key={row.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                  {activeColumns.map((col) => {
                    const val = row[col.key as keyof PowerBiLicense];
                    const isBool = typeof val === "boolean";
                    return (
                      <td key={String(col.key)} className="py-2.5 px-3 whitespace-nowrap">
                        {isBool ? (
                          val ? (
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                              <Check className="h-3 w-3" />
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )
                        ) : col.key === "status" ? (
                          <span
                            className={clsx(
                              "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                              val === "active"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            )}
                          >
                            {String(val || "active")}
                          </span>
                        ) : col.key === "license_type" ? (
                          <span className="rounded-full bg-[#2563EB]/10 px-2 py-0.5 text-[11px] font-bold text-[#2563EB] border border-[#2563EB]/20">
                            {String(val || "-")}
                          </span>
                        ) : (
                          <span className="text-slate-800">{String(val || "-")}</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="py-2.5 px-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingLicense(row);
                          setFormOpen(true);
                        }}
                        className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        title="Edit license"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete license for ${row.display_name}?`)) {
                            void handleDelete(row.id);
                          }
                        }}
                        className="rounded-full p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        title="Delete user"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Permission Matrix View */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredLicenses.map((lic) => {
            const perms = getGrantedPermissions(lic);
            const workspaces = getAccessibleWorkspaces(lic);
            return (
              <Panel key={lic.id} className="p-4 sm:p-5 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="rounded-full bg-[#2563EB] text-white px-2 py-0.2 font-mono text-[10px] font-bold shadow-2xs">
                          {lic.site || "PKT"}
                        </span>
                        <h4 className="text-sm font-bold text-slate-900">{lic.display_name}</h4>
                      </div>
                      <p className="text-xs text-slate-500">{lic.department_name || lic.department_en}</p>
                    </div>
                    <span className="rounded-full bg-[#2563EB]/10 px-2 py-0.5 text-[10px] font-bold text-[#2563EB] border border-[#2563EB]/20">
                      {lic.license_type}
                    </span>
                  </div>

                  {/* Permissions Chips */}
                  <div className="mt-3 space-y-1.5">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Assigned Security Groups:</span>
                    <div className="flex flex-wrap gap-1">
                      {perms.length > 0 ? (
                        perms.map((p) => (
                          <span
                            key={p.code}
                            className={clsx(
                              "rounded-full px-2 py-0.5 text-[10px] font-bold border",
                              p.tone
                            )}
                          >
                            {p.label}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400 italic">No specific security groups</span>
                      )}
                    </div>
                  </div>

                  {/* Workspaces accessible */}
                  <div className="mt-3 space-y-1.5">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Accessible Workspaces:</span>
                    <div className="flex flex-wrap gap-1">
                      {workspaces.map((w) => (
                        <span
                          key={w}
                          className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700"
                        >
                          {w}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-400">
                  <span className="font-mono">{lic.ad_account}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingLicense(lic);
                      setFormOpen(true);
                    }}
                    className="text-xs font-semibold text-[#2563EB] hover:underline"
                  >
                    Edit
                  </button>
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      {/* Form Modal */}
      {formOpen ? (
        <LicenseFormModal
          editing={editingLicense}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setFormOpen(false)}
        />
      ) : null}

      {/* Import Modal */}
      {importOpen ? (
        <LicenseImportModal
          onImport={handleBatchImport}
          onClose={() => setImportOpen(false)}
        />
      ) : null}
    </div>
  );
}
