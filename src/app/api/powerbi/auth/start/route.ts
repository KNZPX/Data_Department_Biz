import { NextRequest, NextResponse } from "next/server";
import { buildAuthorizeUrl, codeChallengeFromVerifier, generateCodeVerifier, generateState } from "@/lib/powerbiAuth";

export const dynamic = "force-dynamic";

const VERIFIER_COOKIE = "pbi_oauth_verifier";
const STATE_COOKIE = "pbi_oauth_state";
const COOKIE_MAX_AGE_SECONDS = 600;

export async function GET(request: NextRequest) {
  try {
    const redirectUri = process.env.AZURE_REDIRECT_URI || new URL("/api/powerbi/auth/callback", request.nextUrl.origin).toString();
    const verifier = generateCodeVerifier();
    const state = generateState();
    const challenge = codeChallengeFromVerifier(verifier);

    const authorizeUrl = buildAuthorizeUrl({ redirectUri, state, codeChallenge: challenge });

    const response = NextResponse.redirect(authorizeUrl);
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: COOKIE_MAX_AGE_SECONDS,
    };
    response.cookies.set(VERIFIER_COOKIE, verifier, cookieOptions);
    response.cookies.set(STATE_COOKIE, state, cookieOptions);
    return response;
  } catch (error) {
    const target = new URL("/", request.nextUrl.origin);
    target.searchParams.set("powerbi_auth_error", error instanceof Error ? error.message : "Couldn't start Microsoft sign-in.");
    return NextResponse.redirect(target);
  }
}
