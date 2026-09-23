"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  BadgeCheck,
  Briefcase,
  Building,
  Building2,
  Globe,
  Hash,
  Info,
  Key,
  Layers,
  Mail,
  Save,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
  User,
  UserCheck,
  X,
} from "lucide-react";
import { clsx } from "clsx";
import { Button, Field, Input, Modal, Panel, Select, Textarea } from "@/components/ui";
import {
  COMMON_HOSPITALS,
  COMMON_LICENSE_TYPES,
  normalizeLicense,
  type LicenseInput,
  type LicenseStatus,
  type PowerBiLicense,
} from "@/lib/licenseTypes";

type FormTab = "employee" | "org" | "license" | "security";

export function LicenseFormModal({
  editing,
  onSave,
  onDelete,
  onClose,
}: {
  editing: PowerBiLicense | null;
  onSave: (item: LicenseInput) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const isNew = !editing || !editing.id;
  const [activeTab, setActiveTab] = useState<FormTab>("employee");

  const [formData, setFormData] = useState<PowerBiLicense>(() => normalizeLicense(editing || {}));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function updateField<K extends keyof PowerBiLicense>(field: K, value: PowerBiLicense[K]) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  function updateSecurityGroup(field: keyof PowerBiLicense, checked: boolean) {
    setFormData((prev) => ({ ...prev, [field]: checked }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.display_name.trim() && !formData.name_th.trim()) {
      setActiveTab("employee");
      setError("Please provide a Display Name or Employee Name.");
      return;
    }
    if (!formData.ad_account.trim()) {
      setActiveTab("employee");
      setError("Please enter a valid AD Account or corporate email.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await onSave(normalizeLicense(formData));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save license record.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-900/50 p-3 backdrop-blur-xs sm:p-6 animate-in fade-in duration-150">
      <Panel className="my-auto w-full max-w-3xl rounded-3xl bg-white p-5 shadow-2xl border border-slate-200/90 sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 shadow-xs">
              <Key className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 sm:text-lg">
                {isNew ? "Add Power BI License Record" : "Edit Power BI License Record"}
              </h2>
              <p className="text-xs text-slate-500">
                {isNew
                  ? "Create new license entitlement with workspace permissions and security groups."
                  : "Update employee metadata, license entitlement tier, and workspace access."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="mt-3.5 flex gap-1.5 overflow-x-auto border-b border-slate-100 pb-2.5">
          {[
            { key: "employee", label: "1. Employee Details" },
            { key: "org", label: "2. Organization & Department" },
            { key: "license", label: "3. License Tier & Requester" },
            { key: "security", label: "4. Security Groups (10)" },
          ].map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key as FormTab)}
                className={clsx(
                  "rounded-full px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition",
                  active
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700 flex items-center gap-2">
              <span className="font-bold">Error:</span> {error}
            </div>
          ) : null}

          {/* Tab 1: Employee Info */}
          {activeTab === "employee" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Display Name"
                required
                hint="English display name shown across directory"
              >
                <Input
                  required
                  icon={User}
                  placeholder="e.g. Siwakorn Phuksapakdeewong"
                  value={formData.display_name}
                  onChange={(e) => updateField("display_name", e.target.value)}
                />
              </Field>
              <Field
                label="Full Name (TH / Alternate)"
                hint="Employee full name in local language"
              >
                <Input
                  icon={User}
                  placeholder="e.g. Siwakorn Phuksapakdeewong"
                  value={formData.name_th}
                  onChange={(e) => updateField("name_th", e.target.value)}
                />
              </Field>
              <Field
                label="AD Account (Email)"
                required
                hint="Corporate @bdms.co.th account for Power BI linking"
              >
                <Input
                  required
                  type="email"
                  icon={Mail}
                  placeholder="e.g. user.name@domain.com"
                  value={formData.ad_account}
                  onChange={(e) => updateField("ad_account", e.target.value)}
                />
              </Field>
              <Field
                label="Person ID"
                hint="Employee identification number from HRIS"
              >
                <Input
                  icon={Hash}
                  placeholder="e.g. 1002345"
                  value={formData.person_id}
                  onChange={(e) => updateField("person_id", e.target.value)}
                />
              </Field>
              <Field
                label="User ID"
                hint="Active Directory logon account ID"
              >
                <Input
                  icon={Tag}
                  placeholder="e.g. U1002345"
                  value={formData.user_id}
                  onChange={(e) => updateField("user_id", e.target.value)}
                />
              </Field>
              <Field
                label="Position Name (EN)"
                hint="Official job designation in organizational structure"
              >
                <Input
                  icon={Briefcase}
                  placeholder="e.g. Senior BI Specialist"
                  value={formData.position_en}
                  onChange={(e) => updateField("position_en", e.target.value)}
                />
              </Field>
              <Field
                label="Employee Class"
                hint="Employee classification e.g. Permanent or Monthly"
              >
                <Input
                  icon={BadgeCheck}
                  placeholder="e.g. Permanent / Monthly"
                  value={formData.employee_class}
                  onChange={(e) => updateField("employee_class", e.target.value)}
                />
              </Field>
              <Field
                label="Full-time / Part-time"
                hint="Employment tenure format"
              >
                <Input
                  icon={Activity}
                  placeholder="e.g. Full-time or Part-time"
                  value={formData.employment_type}
                  onChange={(e) => updateField("employment_type", e.target.value)}
                />
              </Field>
              <Field
                label="Type"
                hint="Workforce category e.g. Staff or Outsource"
              >
                <Input
                  icon={Layers}
                  placeholder="e.g. Staff / Outsource"
                  value={formData.user_type}
                  onChange={(e) => updateField("user_type", e.target.value)}
                />
              </Field>
            </div>
          ) : null}

          {/* Tab 2: Organization */}
          {activeTab === "org" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Site / Hospital Facility"
                hint="Primary operating site or campus facility"
              >
                <Select
                  value={formData.site}
                  onChange={(e) => updateField("site", e.target.value)}
                >
                  {COMMON_HOSPITALS.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Business Unit Code"
                hint="Business unit identifier code e.g. BPK, DBK, BSI"
              >
                <Input
                  icon={Building}
                  placeholder="e.g. BPK, DBK, BSI"
                  value={formData.business_unit_code}
                  onChange={(e) => updateField("business_unit_code", e.target.value)}
                />
              </Field>
              <Field
                label="Department Name (Local)"
                hint="Local department designation"
              >
                <Input
                  icon={Building2}
                  placeholder="e.g. Medical Informatics"
                  value={formData.department_name}
                  onChange={(e) => updateField("department_name", e.target.value)}
                />
              </Field>
              <Field
                label="Department Code"
                hint="Department cost center or HR code"
              >
                <Input
                  icon={Hash}
                  placeholder="e.g. 50201"
                  value={formData.department_code}
                  onChange={(e) => updateField("department_code", e.target.value)}
                />
              </Field>
              <Field
                label="Department Name (EN)"
                hint="Standard English department title"
              >
                <Input
                  icon={Globe}
                  placeholder="e.g. Medical Informatics"
                  value={formData.department_en}
                  onChange={(e) => updateField("department_en", e.target.value)}
                />
              </Field>
              <Field
                label="Dept Group"
                hint="Functional organizational division"
              >
                <Input
                  icon={Layers}
                  placeholder="e.g. Support, Clinical, Admin"
                  value={formData.dept_group}
                  onChange={(e) => updateField("dept_group", e.target.value)}
                />
              </Field>
              <Field
                label="HOD 3Site"
                hint="Whether supervising across all 3 network hospitals"
              >
                <Input
                  icon={UserCheck}
                  placeholder="e.g. Yes / No or supervisor name"
                  value={formData.hod_3site}
                  onChange={(e) => updateField("hod_3site", e.target.value)}
                />
              </Field>
            </div>
          ) : null}

          {/* Tab 3: License & Creator */}
          {activeTab === "license" ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="License Tier"
                  hint="Power BI license entitlement tier"
                >
                  <Select
                    value={formData.license_type}
                    onChange={(e) => updateField("license_type", e.target.value)}
                  >
                    {COMMON_LICENSE_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </Select>
                </Field>
                <Field
                  label="Entitlement Status"
                  hint="Current operational status of entitlement"
                >
                  <Select
                    value={formData.status}
                    onChange={(e) => updateField("status", e.target.value as LicenseStatus)}
                  >
                    <option value="active">Active (Operational)</option>
                    <option value="pending">Pending Approval</option>
                    <option value="revoked">Revoked</option>
                    <option value="inactive">Inactive</option>
                  </Select>
                </Field>
                <Field
                  label="Power BI Pro License"
                  hint="Designated dedicated Power BI Pro license"
                >
                  <Input
                    icon={Sparkles}
                    placeholder="e.g. Yes or No"
                    value={formData.pbi_pro_license}
                    onChange={(e) => updateField("pbi_pro_license", e.target.value)}
                  />
                </Field>
                <Field
                  label="Power BI Premium per Capacity"
                  hint="Capacity-based workspace access permissions"
                >
                  <Input
                    icon={ShieldCheck}
                    placeholder="e.g. Yes or No"
                    value={formData.pbi_premium_capacity}
                    onChange={(e) => updateField("pbi_premium_capacity", e.target.value)}
                  />
                </Field>
              </div>

              {/* Creator Metadata */}
              <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
                  <Info className="h-4 w-4 text-blue-600" />
                  <span>Requester & Creator Record Information</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field
                    label="Creator Person ID"
                    hint="Employee ID of requester / recorder"
                  >
                    <Input
                      icon={Hash}
                      placeholder="e.g. 1002345"
                      value={formData.creator_person_id}
                      onChange={(e) => updateField("creator_person_id", e.target.value)}
                    />
                  </Field>
                  <Field
                    label="Creator Name"
                    hint="Full name of requester / recorder"
                  >
                    <Input
                      icon={User}
                      placeholder="e.g. Siwakorn Phuksapakdeewong"
                      value={formData.creator_name_th}
                      onChange={(e) => updateField("creator_name_th", e.target.value)}
                    />
                  </Field>
                  <Field
                    label="Creator Position"
                    hint="Designation of requester / recorder"
                  >
                    <Input
                      icon={Briefcase}
                      placeholder="e.g. Senior BI Specialist"
                      value={formData.creator_position_en}
                      onChange={(e) => updateField("creator_position_en", e.target.value)}
                    />
                  </Field>
                </div>
              </div>

              <Field
                label="Business Purpose & Target Reports"
                hint="Specify dashboards, reports, or business justification for allocation"
              >
                <Textarea
                  rows={2}
                  placeholder="e.g. For Executive Dashboard, Bed Occupancy, Daily Financial Performance Reports..."
                  value={formData.purpose || ""}
                  onChange={(e) => updateField("purpose", e.target.value)}
                />
              </Field>
            </div>
          ) : null}

          {/* Tab 4: Security Groups */}
          {activeTab === "security" ? (
            <div className="space-y-4">
              {/* Phuket Groups */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                <div className="text-xs font-bold uppercase tracking-wider text-purple-700 mb-2 flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-purple-600" />
                  <span>Phuket Security Groups (5)</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    { key: "bpk_phuket_executive", label: "BPK BI Phuket Executive Group" },
                    { key: "bpk_phuket_marketing", label: "BPK BI Phuket Marketing Group" },
                    { key: "bpk_phuket_hod", label: "BPK BI Phuket HOD Group" },
                    { key: "bpk_phuket_stg", label: "BPK BI Phuket STG Group" },
                    { key: "bpk_phuket_admin", label: "BPK BI Phuket Admin Group" },
                  ].map((item) => {
                    const checked = Boolean(formData[item.key as keyof PowerBiLicense]);
                    return (
                      <label
                        key={item.key}
                        className={clsx(
                          "flex items-center gap-2.5 rounded-2xl border p-2.5 text-xs font-medium cursor-pointer transition",
                          checked
                            ? "border-purple-300 bg-purple-50 text-purple-900 shadow-xs"
                            : "border-slate-200 bg-slate-50/50 text-slate-700 hover:bg-slate-100"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => updateSecurityGroup(item.key as keyof PowerBiLicense, e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span>{item.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Site Groups */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                <div className="text-xs font-bold uppercase tracking-wider text-indigo-700 mb-2 flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Site Security Groups (5)</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    { key: "bpk_hod", label: "BPK BI HOD Group" },
                    { key: "bsi_hod", label: "BSI BI HOD Group" },
                    { key: "dbk_hod", label: "DBK BI HOD Group" },
                    { key: "bpk_quality", label: "BPK BI Quality Group" },
                    { key: "bsi_quality", label: "BSI BI Quality Group" },
                  ].map((item) => {
                    const checked = Boolean(formData[item.key as keyof PowerBiLicense]);
                    return (
                      <label
                        key={item.key}
                        className={clsx(
                          "flex items-center gap-2.5 rounded-2xl border p-2.5 text-xs font-medium cursor-pointer transition",
                          checked
                            ? "border-indigo-300 bg-indigo-50 text-indigo-900 shadow-xs"
                            : "border-slate-200 bg-slate-50/50 text-slate-700 hover:bg-slate-100"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => updateSecurityGroup(item.key as keyof PowerBiLicense, e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>{item.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}

          {/* Actions */}
          <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3.5">
            {!isNew && onDelete ? (
              <Button
                type="button"
                variant="ghost"
                className="text-rose-600 hover:bg-rose-50"
                onClick={async () => {
                  if (confirm("Are you sure you want to delete this license entitlement record?")) {
                    await onDelete(editing.id);
                    onClose();
                  }
                }}
              >
                <Trash2 className="h-4 w-4 text-rose-600" />
                <span>Delete Record</span>
              </Button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                variant="primary"
                className="shadow-xs hover:opacity-90 transition"
              >
                <Save className="h-4 w-4" />
                <span>{saving ? "Saving..." : isNew ? "Create Entitlement" : "Save Changes"}</span>
              </Button>
            </div>
          </div>
        </form>
      </Panel>
    </Modal>
  );
}
