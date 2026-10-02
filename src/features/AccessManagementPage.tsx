"use client";

import { useEffect, useMemo, useState } from "react";
import { KeyRound, Loader2, Plus, Search, ShieldCheck, Trash2, UserPlus, X } from "lucide-react";
import { clsx } from "clsx";
import { Modal } from "@/components/ui";
import { confirmDialog } from "@/components/feedback";
import { useAccess, useAuth } from "@/components/auth/LoginGate";
import { PAGES, defaultPermissions, resolveAccess, type Permissions, type Role } from "@/lib/access";
import { initialsOf, toneFor } from "@/components/layout/Presence";

type UserRow = {
  email: string;
  name: string;
  role: Role;
  permissions: Permissions;
  is_active: boolean;
  is_guest: boolean;
  username: string | null;
  login_count: number;
  last_login_at: string | null;
  created_by: string | null;
  online?: boolean;
};

function rel(iso: string | null) {
  if (!iso) return "Never";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function randomPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const a = new Uint32Array(12);
  crypto.getRandomValues(a);
  return Array.from(a, (n) => chars[n % chars.length]).join("");
}

const ROLE_HELP: Record<Role, string> = {
  admin: "Everything, including People & access",
  member: "Signed in with Microsoft; pages you choose",
  guest: "Username and password; pages you choose",
};

async function post(body: Record<string, unknown>) {
  const res = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
}

function AccessEditor({
  role,
  value,
  onChange,
}: {
  role: Role;
  value: { pages: string[]; modules: string[] };
  onChange: (v: { pages: string[]; modules: string[] }) => void;
}) {
  if (role === "admin") return <p className="text-sm text-slate-500">Admins can open every page and use every module.</p>;
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  return (
    <div className="space-y-2">
      {PAGES.filter((p) => !p.adminOnly).map((p) => {
        const on = value.pages.includes(p.id);
        return (
          <div key={p.id} className={clsx("rounded-xl p-3 ring-1", on ? "ring-blue-200 bg-blue-50/40" : "ring-slate-200")}>
            <label className="flex items-center gap-2.5 text-sm font-medium text-slate-900">
              <input type="checkbox" className="h-4 w-4 accent-blue-600" checked={on} onChange={() => onChange({ ...value, pages: toggle(value.pages, p.id) })} />
              {p.label}
            </label>
            {p.modules.length > 0 && (
              <div className={clsx("mt-2 grid gap-1.5 pl-6 sm:grid-cols-2", !on && "opacity-40")}>
                {p.modules.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 text-[13px] text-slate-600">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 accent-blue-600"
                      disabled={!on}
                      checked={value.modules.includes(m.id)}
                      onChange={() => onChange({ ...value, modules: toggle(value.modules, m.id) })}
                    />
                    {m.label}
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function AccessManagementPage() {
  const { user } = useAuth();
  const { isAdmin } = useAccess();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [draftRole, setDraftRole] = useState<Role>("member");
  const [draftPerms, setDraftPerms] = useState<{ pages: string[]; modules: string[] }>({ pages: [], modules: [] });
  const [draftActive, setDraftActive] = useState(true);
  const [adding, setAdding] = useState(false);
  const [guest, setGuest] = useState({ username: "", name: "", password: randomPassword() });
  const [guestPerms, setGuestPerms] = useState(defaultPermissions("guest"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/users", { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    setUsers(json.users || []);
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, []);

  const shown = useMemo(
    () => users.filter((u) => !q.trim() || `${u.name} ${u.email} ${u.username || ""}`.toLowerCase().includes(q.toLowerCase())),
    [users, q]
  );

  function openEdit(u: UserRow) {
    setEditing(u);
    setDraftRole(u.role);
    const a = resolveAccess(u.role, u.permissions);
    setDraftPerms({ pages: a.pages, modules: a.modules });
    setDraftActive(u.is_active);
    setError(null);
  }

  async function saveEdit() {
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      await post({ action: "update_user", email: editing.email, role: draftRole, permissions: draftRole === "admin" ? null : draftPerms, active: draftActive });
      setEditing(null);
      setNotice(`Saved access for ${editing.name}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function createGuest() {
    setBusy(true);
    setError(null);
    try {
      await post({ action: "create_guest", ...guest, permissions: guestPerms });
      setAdding(false);
      setNotice(`Guest "${guest.username}" created. Share the password privately — it isn't shown again.`);
      setGuest({ username: "", name: "", password: randomPassword() });
      setGuestPerms(defaultPermissions("guest"));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(u: UserRow) {
    const pw = randomPassword();
    const ok = await confirmDialog({
      title: `Set a new password for ${u.username}?`,
      body: `New password: ${pw}\n\nIt's copied to your clipboard when you confirm. Send it to them privately — it won't be shown again.`,
      confirmLabel: "Set password",
    });
    if (!ok) return;
    try {
      await post({ action: "set_password", username: u.username, password: pw });
      void navigator.clipboard?.writeText(pw);
      setNotice(`New password set for ${u.username} and copied to your clipboard.`);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e));
    }
  }

  async function remove(u: UserRow) {
    const ok = await confirmDialog({
      title: `Remove ${u.name}?`,
      body: "They're signed out straight away and can't sign in again until someone adds them back.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    try {
      await post({ action: "delete_user", email: u.email });
      await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e));
    }
  }

  if (!isAdmin) {
    return <div className="grid h-full place-items-center text-sm text-slate-500">Only admins can manage people and access.</div>;
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl pb-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-[28px] font-semibold tracking-tight text-slate-900">People &amp; access</h2>
            <p className="mt-1 max-w-2xl text-[15px] text-slate-500">
              Everyone who has signed in, plus guest accounts. Choose which pages each person can open and which tools inside those pages they can use.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setAdding(true);
              setError(null);
            }}
            className="inline-flex items-center gap-2 self-start rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            <UserPlus className="h-4 w-4" /> Add guest
          </button>
        </div>

        {notice && (
          <div className="mt-4 flex items-start justify-between gap-3 rounded-xl bg-teal-live/10 px-4 py-3 text-sm text-slate-800">
            {notice}
            <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">
              <X className="h-4 w-4 text-slate-400" />
            </button>
          </div>
        )}

        <div className="mt-6 flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a person" className="w-72 rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-400" />
          </div>
          <p className="text-sm text-slate-500">
            {users.length} people, {users.filter((u) => u.online).length} online now
          </p>
        </div>

        <div className="mt-4 overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200/80">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                <th className="px-4 py-3 font-medium">Person</th>
                <th className="px-4 py-3 font-medium">Sign-in</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Can open</th>
                <th className="px-4 py-3 font-medium">Last seen</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              )}
              {shown.map((u) => {
                const a = resolveAccess(u.role, u.permissions);
                const pageLabels = u.role === "admin" ? ["Everything"] : PAGES.filter((p) => a.pages.includes(p.id)).map((p) => p.label);
                return (
                  <tr key={u.email} className={clsx(!u.is_active && "opacity-50")}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold text-white" style={{ background: toneFor(u.email) }}>
                          {initialsOf(u.name)}
                          {u.online && <span className="presence-dot absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-teal-live ring-2 ring-white" />}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900">
                            {u.name}
                            {u.email === user?.email?.toLowerCase() && <span className="font-normal text-slate-400"> (you)</span>}
                          </p>
                          <p className="truncate text-xs text-slate-500">{u.is_guest ? `username: ${u.username}` : u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{u.is_guest ? "Guest password" : "Microsoft 365"}</td>
                    <td className="px-4 py-3">
                      <span className={clsx("rounded-md px-2 py-0.5 text-xs", u.role === "admin" ? "bg-blue-50 text-blue-700" : u.role === "guest" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700")}>
                        {u.role === "admin" ? "Admin" : u.role === "guest" ? "Guest" : "Member"}
                      </span>
                      {!u.is_active && <span className="ml-2 text-xs text-coral">Turned off</span>}
                    </td>
                    <td className="max-w-[280px] px-4 py-3 text-xs text-slate-600">
                      <span className="line-clamp-2">{pageLabels.join(", ") || "Nothing"}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {rel(u.last_login_at)}
                      <span className="block text-slate-400">{u.login_count || 0} sign-ins</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button type="button" onClick={() => openEdit(u)} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50">
                          <ShieldCheck className="h-3.5 w-3.5" /> Access
                        </button>
                        {u.is_guest && (
                          <button type="button" onClick={() => void resetPassword(u)} title="Set a new password" className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100">
                            <KeyRound className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {u.email !== user?.email?.toLowerCase() && (
                          <button type="button" onClick={() => void remove(u)} title="Delete" className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-coral/10 hover:text-coral">
                            <Trash2 className="h-3.5 w-3.5" />
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
        <p className="mt-3 text-xs text-slate-400">
          People signing in with Microsoft for the first time get the Member defaults. Turning someone off signs them out everywhere.
        </p>
      </div>

      {editing && (
        <Modal className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 backdrop-blur-[2px]">
          <div role="dialog" aria-modal="true" className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-slate-100 px-6 py-4">
              <p className="text-lg font-semibold text-slate-900">Access for {editing.name}</p>
              <p className="text-sm text-slate-500">{editing.is_guest ? `Guest ${editing.username}` : editing.email}</p>
            </div>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <div className="grid grid-cols-3 gap-2">
                {(["admin", "member", "guest"] as Role[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      setDraftRole(r);
                      if (r !== "admin" && draftRole === "admin") setDraftPerms(defaultPermissions(r));
                    }}
                    className={clsx("rounded-xl p-3 text-left ring-1", draftRole === r ? "ring-2 ring-blue-500 bg-blue-50/40" : "ring-slate-200 hover:ring-slate-300")}
                  >
                    <p className="text-sm font-medium capitalize text-slate-900">{r}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{ROLE_HELP[r]}</p>
                  </button>
                ))}
              </div>
              <AccessEditor role={draftRole} value={draftPerms} onChange={setDraftPerms} />
              <label className="flex items-center gap-2.5 text-sm text-slate-700">
                <input type="checkbox" className="h-4 w-4 accent-blue-600" checked={draftActive} onChange={(e) => setDraftActive(e.target.checked)} />
                Account is on (turning it off signs them out)
              </label>
              {error && <p className="text-sm text-coral">{error}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
              <button type="button" onClick={() => setEditing(null)} className="rounded-xl px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
                Cancel
              </button>
              <button type="button" disabled={busy} onClick={() => void saveEdit()} className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {busy ? "Saving…" : "Save access"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {adding && (
        <Modal className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 backdrop-blur-[2px]">
          <div role="dialog" aria-modal="true" className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-slate-100 px-6 py-4">
              <p className="text-lg font-semibold text-slate-900">Add a guest account</p>
              <p className="text-sm text-slate-500">For people without a hospital Microsoft account. They sign in with a username and password.</p>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-[13px] text-slate-600">
                  Username
                  <input value={guest.username} onChange={(e) => setGuest({ ...guest, username: e.target.value.toLowerCase() })} placeholder="e.g. vendor.pbi" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
                </label>
                <label className="text-[13px] text-slate-600">
                  Display name
                  <input value={guest.name} onChange={(e) => setGuest({ ...guest, name: e.target.value })} placeholder="Name shown in the portal" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
                </label>
              </div>
              <label className="block text-[13px] text-slate-600">
                Password
                <div className="mt-1 flex gap-2">
                  <input value={guest.password} onChange={(e) => setGuest({ ...guest, password: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm outline-none focus:border-blue-500" />
                  <button type="button" onClick={() => setGuest({ ...guest, password: randomPassword() })} className="shrink-0 rounded-lg px-3 text-sm text-blue-700 hover:bg-blue-50">
                    New
                  </button>
                  <button type="button" onClick={() => void navigator.clipboard?.writeText(guest.password)} className="shrink-0 rounded-lg px-3 text-sm text-blue-700 hover:bg-blue-50">
                    Copy
                  </button>
                </div>
                <span className="mt-1 block text-xs text-slate-400">At least 8 characters. Stored encrypted — copy it now to send to the guest.</span>
              </label>
              <div>
                <p className="mb-2 text-sm font-medium text-slate-900">What can they open?</p>
                <AccessEditor role="guest" value={guestPerms} onChange={setGuestPerms} />
              </div>
              {error && <p className="text-sm text-coral">{error}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
              <button type="button" onClick={() => setAdding(false)} className="rounded-xl px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || guest.username.length < 3 || guest.password.length < 8}
                onClick={() => void createGuest()}
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                {busy ? "Creating…" : "Create guest"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
