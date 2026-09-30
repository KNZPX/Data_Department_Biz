import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

// Public Supabase URL + anon key for the browser's Realtime channel (whiteboard
// cursors and live edits). The anon key is already public; this endpoint only
// adds the signed-in user's identity for presence.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sign in first." }, { status: 401 });
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "https://wwnzwsjquostxfpjerla.supabase.co";
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3bnp3c2pxdW9zdHhmcGplcmxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxMzYxOTgsImV4cCI6MjEwNTcxMjE5OH0.j_M4ShyvxrqN8o_RCAP4IMFjBOVpdiL69_YkkfJsR7I";
  return Response.json({ url, key, user });
}
