// Pages and the modules inside them that an admin can grant per user.
// Shared by the server (enforcement) and the browser (hiding UI).

export type Role = "admin" | "member" | "guest";

export type ModuleDef = { id: string; label: string };
export type PageDef = { id: string; label: string; href: string; adminOnly?: boolean; modules: ModuleDef[] };

export const PAGES: PageDef[] = [
  {
    id: "home",
    label: "Home",
    href: "/",
    modules: [
      { id: "home.semantic", label: "Semantic model trend" },
      { id: "home.license", label: "License trend" },
      { id: "home.activity", label: "Recent activity" },
    ],
  },
  {
    id: "reports",
    label: "Power BI reports",
    href: "/reports",
    modules: [
      { id: "reports.sync", label: "Sync from Power BI" },
      { id: "reports.export", label: "Export to Excel" },
      { id: "reports.history", label: "Publish history" },
    ],
  },
  {
    id: "licenses",
    label: "Team & licenses",
    href: "/licenses",
    modules: [
      { id: "licenses.permissions", label: "Permission view" },
      { id: "licenses.edit", label: "Add / edit licenses and permissions" },
      { id: "licenses.export", label: "Export / import Excel" },
    ],
  },
  {
    id: "dax",
    label: "DAX dictionary",
    href: "/dax",
    modules: [
      { id: "dax.edit", label: "Edit definitions and custom DAX" },
      { id: "dax.import", label: "Update model from .bim" },
      { id: "dax.export", label: "Export dataset to Excel" },
      { id: "dax.generate", label: "Generate scripts for Power BI" },
      { id: "dax.diagram", label: "Formula diagrams" },
    ],
  },
  {
    id: "whiteboard",
    label: "Whiteboard",
    href: "/whiteboard",
    modules: [{ id: "whiteboard.edit", label: "Create and edit boards" }],
  },
  {
    id: "target-scenario",
    label: "Target scenario",
    href: "/target-scenario",
    modules: [{ id: "target.edit", label: "Save scenarios" }],
  },
  {
    id: "okr",
    label: "EBO & OKR",
    href: "/okr",
    modules: [
      { id: "ebo.edit", label: "Edit EBO plans" },
      { id: "okr.edit", label: "Edit OKRs" },
    ],
  },
  { id: "users", label: "People & access", href: "/users", adminOnly: true, modules: [] },
  { id: "changelog", label: "Activity log", href: "/changelog", modules: [] },
  { id: "settings", label: "Settings", href: "/settings", modules: [] },
];

export type Permissions = { pages?: string[]; modules?: string[] } | null;
export type Access = { role: Role; pages: string[]; modules: string[]; hidden?: string[] };

/**
 * Team-wide page policy set by admins in Settings → Pages & access:
 * pages switched off for everyone (admins included — Settings stays), and what each
 * role gets by default. People with their own permissions keep those.
 */
export type AccessPolicy = {
  hidden?: string[];
  roles?: Partial<Record<"member" | "guest", { pages: string[]; modules: string[] }>>;
};

const ALL_PAGES = PAGES.map((p) => p.id);
const ALL_MODULES = PAGES.flatMap((p) => p.modules.map((m) => m.id));

/** Role defaults, used when an admin hasn't set explicit permissions. */
export function defaultPermissions(role: Role): { pages: string[]; modules: string[] } {
  if (role === "admin") return { pages: ALL_PAGES, modules: ALL_MODULES };
  if (role === "guest")
    return { pages: ["home", "reports", "dax", "whiteboard"], modules: ["home.semantic", "home.license", "dax.export", "dax.diagram"] };
  return {
    pages: ALL_PAGES.filter((p) => p !== "users"),
    modules: ALL_MODULES.filter((m) => m !== "dax.import"),
  };
}

/** What a role gets by default: the admin's policy if set, else the built-in defaults. */
export function roleDefaults(role: Role, policy?: AccessPolicy | null) {
  if (role === "admin") return defaultPermissions("admin");
  const set = policy?.roles?.[role];
  return set ? { pages: set.pages.filter((p) => ALL_PAGES.includes(p)), modules: set.modules.filter((m) => ALL_MODULES.includes(m)) } : defaultPermissions(role);
}

export function resolveAccess(role: Role | string | null | undefined, perms: Permissions, policy?: AccessPolicy | null): Access {
  const r: Role = role === "admin" || role === "guest" ? role : "member";
  const hidden = (policy?.hidden || []).filter((p) => ALL_PAGES.includes(p) && p !== "settings");
  if (r === "admin") return { role: r, ...defaultPermissions("admin"), hidden };
  const d = roleDefaults(r, policy);
  const pages = (perms?.pages ?? d.pages).filter((p) => p !== "users" && !hidden.includes(p));
  const modules = perms?.modules ?? d.modules;
  return { role: r, pages, modules, hidden };
}

/**
 * Parts of one page that show another page's content. When that page is
 * switched off, they go too (e.g. the licence trend on Home).
 */
const RELATED: Record<string, string[]> = {
  "home.semantic": ["dax"],
  "home.license": ["licenses"],
  "home.activity": ["changelog"],
};

function pageOfModule(moduleId: string) {
  const p = moduleId.split(".")[0];
  return p === "target" ? "target-scenario" : p === "ebo" ? "okr" : p;
}

/** A page switched off for the team in Settings → Pages & access. */
export function isHidden(access: Access | null, pageId: string) {
  return pageId !== "settings" && Boolean(access?.hidden?.includes(pageId));
}

export function canPage(access: Access | null, pageId: string) {
  if (!access || isHidden(access, pageId)) return false;
  if (access.role === "admin") return true;
  return access.pages.includes(pageId);
}

export function canModule(access: Access | null, moduleId: string) {
  if (!access) return false;
  const page = pageOfModule(moduleId);
  if (isHidden(access, page) || (RELATED[moduleId] || []).some((p) => isHidden(access, p))) return false;
  if (access.role === "admin") return true;
  return access.pages.includes(page) && access.modules.includes(moduleId);
}

export function pageForPath(pathname: string): PageDef | undefined {
  if (pathname === "/") return PAGES[0];
  // DAX diagrams are part of the DAX dictionary, so they follow its access.
  const path = pathname === "/dax-diagrams" || pathname.startsWith("/dax-diagrams/") ? "/dax" : pathname === "/ebo" ? "/okr" : pathname;
  return PAGES.find((p) => p.href !== "/" && (path === p.href || path.startsWith(p.href + "/")));
}
