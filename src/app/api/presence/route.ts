import { getOnlineUsers, readSessionSecret, touchSession } from "@/lib/session";

export const dynamic = "force-dynamic";

// Heartbeat + "who is working right now". Returns names only, never tokens.
export async function GET() {
  try {
    const secret = await readSessionSecret();
    if (!secret) return Response.json({ users: [] }, { status: 401 });
    await touchSession(secret);
    const users = await getOnlineUsers(10);
    return Response.json({ users });
  } catch (err) {
    return Response.json({ users: [], error: err instanceof Error ? err.message : "presence failed" }, { status: 500 });
  }
}
