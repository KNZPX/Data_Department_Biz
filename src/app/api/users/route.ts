import { NextRequest } from "next/server";
import { getAppUsers, recordUserLogin, getDbChangeLogs } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeLogs = searchParams.get("includeLogs") === "true";

    const users = await getAppUsers();
    let loginLogs: any[] = [];
    if (includeLogs) {
      loginLogs = await getDbChangeLogs({ entityTable: "app_users", limit: 100 });
    }

    return Response.json({
      success: true,
      users,
      logs: loginLogs,
      totalUsers: users.length,
    });
  } catch (err) {
    console.error("Error fetching users:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to load users" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, userAgent } = body;

    if (!email) {
      return Response.json({ error: "Email is required" }, { status: 400 });
    }

    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "127.0.0.1";

    await recordUserLogin({
      email: email.trim(),
      name: name?.trim() || email.split("@")[0],
      userAgent: userAgent || request.headers.get("user-agent") || "",
      ip: clientIp,
    });

    return Response.json({ success: true, message: "Login recorded successfully" });
  } catch (err) {
    console.error("Error recording user login:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to record login" },
      { status: 500 }
    );
  }
}
