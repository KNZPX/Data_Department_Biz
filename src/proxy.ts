import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Every API call must come from a signed-in browser session. Only the sign-in
// endpoints themselves are public. (Deep validation of the session happens in
// the route handlers; this is the cheap first gate.)
const PUBLIC_API = ["/api/powerbi/auth/", "/api/powerbi/token"];

export function proxy(request: NextRequest) {
  const enforce = process.env.NODE_ENV === "production" || process.env.VERCEL;
  if (!enforce) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (PUBLIC_API.some((p) => pathname.startsWith(p))) return NextResponse.next();

  if (!request.cookies.get("biz_sid")?.value) {
    return NextResponse.json({ error: "Sign in to use this portal." }, { status: 401 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
