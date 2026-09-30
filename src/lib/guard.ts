// Server-side permission checks for API routes.
import { canModule, canPage } from "./access";
import { getCurrentAccess, type CurrentUser } from "./session";

export type Guarded = { user: CurrentUser; deny: null } | { user: null; deny: Response };

export async function requireModule(moduleId: string): Promise<Guarded> {
  const user = await getCurrentAccess();
  if (!user) return { user: null, deny: Response.json({ error: "Sign in first." }, { status: 401 }) };
  if (!canModule(user.access, moduleId)) {
    return { user: null, deny: Response.json({ error: "You don't have access to this. Ask an admin." }, { status: 403 }) };
  }
  return { user, deny: null };
}

export async function requirePage(pageId: string): Promise<Guarded> {
  const user = await getCurrentAccess();
  if (!user) return { user: null, deny: Response.json({ error: "Sign in first." }, { status: 401 }) };
  if (!canPage(user.access, pageId)) {
    return { user: null, deny: Response.json({ error: "You don't have access to this page." }, { status: 403 }) };
  }
  return { user, deny: null };
}
