"use client";

// Settings → Pages & access: every page (and the features inside it) as a tree,
// switch pages on or off for the team, and choose what each role gets.
// New people always join as Member; admins change roles in People & access.
import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, GitFork, Info, List, Loader2, RotateCcw, Save, ShieldAlert, ShieldCheck } from "lucide-react";
import { clsx } from "clsx";
import { useAccess, useAuth } from "@/components/auth/LoginGate";
import { toast } from "@/components/feedback";
import { TreeDiagram, type TreeNode } from "@/components/TreeDiagram";
import { NAV_GROUPS } from "@/components/layout/AppShell";
import { PAGES, defaultPermissions, roleDefaults, type AccessPolicy } from "@/lib/access";
import { useT } from "@/lib/i18n";
import { Toggle } from "./OrganisationTab";

type RoleKey = "member" | "guest";
const ROLES: { id: RoleKey; label: string; hint: string }[] = [
  { id: "member", label: "Member", hint: "Everyone who signs in starts here" },
  { id: "guest", label: "Guest", hint: "Username / password accounts made by an admin" },
];
const LOCKED = new Set(["settings"]); // always reachable so people can change their own look

function buildPolicy(p: AccessPolicy | null): Required<AccessPolicy> {
  return {
    hidden: p?.hidden || [],
    roles: {
      member: roleDefaults("member", p),
      guest: roleDefaults("guest", p),
    },
  };
}

export function PagesTab() {
  const t = useT();
  const { refreshAuth } = useAuth();
  const { isAdmin } = useAccess();
  const [saved, setSaved] = useState<Required<AccessPolicy>>(() => buildPolicy(null));
  const [draft, setDraft] = useState<Required<AccessPolicy> | null>(null);
  const [meta, setMeta] = useState<{ updatedBy: string | null; updatedAt: string | null }>({ updatedBy: null, updatedAt: null });
  const [view, setView] = useState<"list" | "diagram">("list");
  const [saving, setSaving] = useState(false);
  const cur = draft || saved;
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(saved);
  const ro = !isAdmin;

  useEffect(() => {
    fetch("/api/team-settings?key=access_policy", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j) return;
        setSaved(buildPolicy(j.value || null));
        setMeta({ updatedBy: j.updatedBy, updatedAt: j.updatedAt });
      })
      .catch(() => {});
  }, []);

  const pagesByHref = useMemo(() => new Map(PAGES.map((p) => [p.href, p])), []);
  const groups = NAV_GROUPS.map((g) => ({ title: g.title, pages: g.items.map((i) => ({ nav: i, page: pagesByHref.get(i.href) })).filter((x) => x.page) }));

  const edit = (f: (p: Required<AccessPolicy>) => void) => {
    const next = structuredClone(cur);
    f(next);
    setDraft(next);
  };
  const has = (role: RoleKey, pageId: string) => !!cur.roles[role]?.pages.includes(pageId);
  const hasMod = (role: RoleKey, modId: string) => !!cur.roles[role]?.modules.includes(modId);
  function togglePage(role: RoleKey, pageId: string) {
    edit((p) => {
      const r = p.roles[role]!;
      r.pages = r.pages.includes(pageId) ? r.pages.filter((x) => x !== pageId) : [...r.pages, pageId];
    });
  }
  function toggleMod(role: RoleKey, modId: string) {
    edit((p) => {
      const r = p.roles[role]!;
      r.modules = r.modules.includes(modId) ? r.modules.filter((x) => x !== modId) : [...r.modules, modId];
    });
  }
  function toggleHidden(pageId: string) {
    edit((p) => {
      p.hidden = p.hidden.includes(pageId) ? p.hidden.filter((x) => x !== pageId) : [...p.hidden, pageId];
    });
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/team-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "access_policy", value: cur }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "The server didn't accept it");
      setSaved(cur);
      setDraft(null);
      setMeta({ updatedBy: json.updatedBy, updatedAt: json.updatedAt });
      // Re-read my own access so the menu and this page change right away.
      void refreshAuth();
      toast("Page access saved", { body: "Your menu updates now; others see it the next time a page loads." });
    } catch (e) {
      toast.error("Couldn't save", { body: e instanceof Error ? e.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  const roleChips = (pageId: string) => (
    <span className="flex flex-wrap justify-center gap-1">
      <span className="rounded bg-slate-900 px-1.5 text-[10px] font-medium text-white">Admin</span>
      {ROLES.filter((r) => has(r.id, pageId)).map((r) => (
        <span key={r.id} className={clsx("rounded px-1.5 text-[10px] font-medium", r.id === "member" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-800")}>
          {r.label}
        </span>
      ))}
    </span>
  );

  const tree: TreeNode = {
    id: "portal",
    label: "Biz-Analytic portal",
    sub: `${PAGES.length - cur.hidden.length} of ${PAGES.length} pages on`,
    children: groups.map((g) => ({
      id: g.title,
      label: t(g.title),
      children: g.pages.map(({ nav, page }) => ({
        id: page!.id,
        label: t(nav.label),
        muted: cur.hidden.includes(page!.id),
        badge: cur.hidden.includes(page!.id) ? <span className="rounded bg-slate-100 px-1.5 text-[10px] text-slate-500">Off for everyone</span> : roleChips(page!.id),
        onClick: ro || LOCKED.has(page!.id) ? undefined : () => toggleHidden(page!.id),
        children: page!.modules.map((m) => ({ id: m.id, label: m.label, sub: ROLES.filter((r) => hasMod(r.id, m.id)).map((r) => r.label).join(" · ") || "Admins only" })),
      })),
    })),
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-white px-5 py-4">
        <div>
          <h3 className="text-[15px] font-semibold text-slate-900">{t("Pages & access")}</h3>
          <p className="text-[12.5px] text-slate-500">
            Turn pages on or off for the team and choose what each role can open.
            {meta.updatedAt && (
              <span className="ml-1 text-slate-400">
                Last changed by {meta.updatedBy} · {new Date(meta.updatedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-slate-100 p-0.5">
            {(
              [
                ["list", List, "Tree"],
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
            <>
              <button
                type="button"
                onClick={() => setDraft({ hidden: [], roles: { member: defaultPermissions("member"), guest: defaultPermissions("guest") } })}
                className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-[13px] font-medium text-slate-600 hover:bg-slate-50"
                title="Back to the built-in defaults (not saved until you press Save)"
              >
                <RotateCcw className="h-4 w-4" /> Defaults
              </button>
              {dirty && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[12px] font-medium text-amber-700 ring-1 ring-amber-200">Not saved yet</span>}
              <button
                type="button"
                onClick={() => void save()}
                disabled={!dirty || saving}
                className="flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-[12.5px]">
        <p className="flex items-center gap-2 rounded-lg bg-blue-50/70 px-3 py-2 text-blue-900">
          <Info className="h-4 w-4 text-blue-600" /> Everyone who signs in joins as <span className="font-semibold">Member</span>. Make someone an admin or give them their own access in People &amp; access.
        </p>
        {ro && (
          <p className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-slate-600">
            <ShieldAlert className="h-4 w-4 text-slate-400" /> Only admins can change this.
          </p>
        )}
      </div>

      {view === "diagram" ? (
        <div className="rounded-xl border border-slate-200/80 bg-white p-5">
          <TreeDiagram root={tree} />
          {!ro && <p className="mt-2 text-center text-[12px] text-slate-400">Click a page to switch it on or off for everyone.</p>}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white">
          <table className="w-full min-w-[680px] border-separate border-spacing-0 text-[13px]">
            <thead>
              <tr className="text-[11.5px] text-slate-500">
                <th className="border-b border-slate-200 px-5 py-2.5 text-left font-medium">Page / feature</th>
                <th className="w-[110px] border-b border-slate-200 px-3 py-2.5 text-center font-medium">On for team</th>
                <th className="w-[90px] border-b border-slate-200 px-3 py-2.5 text-center font-medium">
                  <span className="inline-flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5" /> Admin
                  </span>
                </th>
                {ROLES.map((r) => (
                  <th key={r.id} className="w-[100px] border-b border-slate-200 px-3 py-2.5 text-center font-medium" title={r.hint}>
                    {r.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <GroupRows key={g.title} title={t(g.title)}>
                  {g.pages.map(({ nav, page }) => {
                    const off = cur.hidden.includes(page!.id);
                    const Icon = nav.icon;
                    return (
                      <PageRows key={page!.id}>
                        <tr className={clsx("hover:bg-slate-50/70", off && "opacity-55")}>
                          <td className="border-b border-slate-100 px-5 py-2">
                            <span className="flex items-center gap-2.5">
                              <span className="relative flex w-4 justify-center self-stretch">
                                <span className="absolute inset-y-[-8px] left-1/2 w-px bg-slate-200" />
                              </span>
                              <span className="grid h-7 w-7 place-items-center rounded-md bg-slate-100 text-slate-600">
                                <Icon className="h-4 w-4" />
                              </span>
                              <span>
                                <span className="block font-medium text-slate-900">{t(nav.label)}</span>
                                <span className="block text-[11.5px] text-slate-400">{nav.href}</span>
                              </span>
                            </span>
                          </td>
                          <td className="border-b border-slate-100 px-3 py-2 text-center">
                            {LOCKED.has(page!.id) ? (
                              <span className="text-[11.5px] text-slate-400">Always on</span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5">
                                {off ? <EyeOff className="h-3.5 w-3.5 text-slate-400" /> : <Eye className="h-3.5 w-3.5 text-blue-600" />}
                                <Toggle on={!off} disabled={ro} onChange={() => toggleHidden(page!.id)} label={`${nav.label} on for the team`} />
                              </span>
                            )}
                          </td>
                          <td className="border-b border-slate-100 px-3 py-2 text-center">
                            <Check on />
                          </td>
                          {ROLES.map((r) => (
                            <td key={r.id} className="border-b border-slate-100 px-3 py-2 text-center">
                              {page!.adminOnly ? (
                                <span className="text-[11.5px] text-slate-400">Admins only</span>
                              ) : (
                                <Check on={has(r.id, page!.id)} disabled={ro || off || LOCKED.has(page!.id)} onClick={() => togglePage(r.id, page!.id)} label={`${r.label} can open ${nav.label}`} />
                              )}
                            </td>
                          ))}
                        </tr>
                        {page!.modules.map((m, i) => (
                          <tr key={m.id} className={clsx("hover:bg-slate-50/70", off && "opacity-55")}>
                            <td className="border-b border-slate-100 py-1.5 pl-5 pr-5">
                              <span className="flex items-center gap-2.5">
                                <span className="relative flex w-4 justify-center self-stretch">
                                  <span className="absolute inset-y-[-6px] left-1/2 w-px bg-slate-200" />
                                </span>
                                <span className="relative ml-3 flex items-center gap-2 text-[12.5px] text-slate-600">
                                  <span className={clsx("absolute -left-3 top-1/2 h-px w-2.5 bg-slate-300", i === page!.modules.length - 1 && "")} />
                                  {m.label}
                                </span>
                              </span>
                            </td>
                            <td className="border-b border-slate-100" />
                            <td className="border-b border-slate-100 px-3 py-1.5 text-center">
                              <Check on small />
                            </td>
                            {ROLES.map((r) => (
                              <td key={r.id} className="border-b border-slate-100 px-3 py-1.5 text-center">
                                <Check small on={hasMod(r.id, m.id)} disabled={ro || off || !has(r.id, page!.id)} onClick={() => toggleMod(r.id, m.id)} label={`${r.label}: ${m.label}`} />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </PageRows>
                    );
                  })}
                </GroupRows>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function GroupRows({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <tr>
        <td colSpan={5} className="border-b border-slate-100 bg-slate-50/80 px-5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
          {title}
        </td>
      </tr>
      {children}
    </>
  );
}
function PageRows({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function Check({ on, disabled, onClick, small, label }: { on: boolean; disabled?: boolean; onClick?: () => void; small?: boolean; label?: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      aria-label={label}
      disabled={disabled || !onClick}
      onClick={onClick}
      className={clsx(
        "inline-grid place-items-center rounded-md border transition",
        small ? "h-5 w-5" : "h-6 w-6",
        on ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white text-transparent",
        onClick && !disabled && "hover:border-blue-400",
        (disabled || !onClick) && "cursor-default opacity-70"
      )}
    >
      <svg viewBox="0 0 16 16" className={small ? "h-3 w-3" : "h-3.5 w-3.5"} fill="none" stroke="currentColor" strokeWidth={2.4}>
        <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
