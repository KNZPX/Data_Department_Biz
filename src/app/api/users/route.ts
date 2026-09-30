import { NextRequest } from "next/server";
import { getSupabaseClient, getDbChangeLogs } from "@/lib/db";
import { adminRpc, getCurrentAccess, getOnlineUsers } from "@/lib/session";

export const dynamic = "force-dynamic";

// GET: people list (+ login/audit log for admins)
export async function GET(request: NextRequest) {
  const me = await getCurrentAccess();
  if (!me) return Response.json({ error: "Sign in first." }, { status: 401 });
  const includeLogs = request.nextUrl.searchParams.get("includeLogs") === "true";
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("app_users")
    .select("email, name, role, permissions, is_active, is_guest, username, login_count, last_login_at, created_at, created_by")
    .order("last_login_at", { ascending: false, nullsFirst: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const online = new Set((await getOnlineUsers(10)).map((u) => u.email.toLowerCase()));
  const users = (data || []).map((u) => ({ ...u, online: online.has(String(u.email).toLowerCase()) }));
  const isAdmin = me.access.role === "admin";
  const logs = includeLogs && isAdmin ? await getDbChangeLogs({ entityTable: "all", limit: 200 }) : [];
  return Response.json({ success: true, users: isAdmin ? users : users.map(({ permissions: _p, ...rest }) => rest), logs, totalUsers: users.length, me: { email: me.email, role: me.access.role } });
}

// POST { action, ... } — every write is checked for admin role inside the database.
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }
  try {
    switch (body.action) {
      case "create_guest":
        await adminRpc("admin_create_guest", {
          p_username: String(body.username || ""),
          p_name: String(body.name || ""),
          p_password: String(body.password || ""),
          p_permissions: body.permissions ?? null,
        });
        break;
      case "update_user":
        await adminRpc("admin_update_user", {
          p_email: String(body.email || ""),
          p_role: String(body.role || "member"),
          p_permissions: body.permissions ?? null,
          p_active: body.active !== false,
        });
        break;
      case "set_password":
        await adminRpc("admin_set_guest_password", { p_username: String(body.username || ""), p_password: String(body.password || "") });
        break;
      case "delete_user":
        await adminRpc("admin_delete_user", { p_email: String(body.email || "") });
        break;
      default:
        return Response.json({ error: "Unknown action." }, { status: 400 });
    }
    return Response.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: /admin/i.test(msg) ? 403 : 400 });
  }
}
