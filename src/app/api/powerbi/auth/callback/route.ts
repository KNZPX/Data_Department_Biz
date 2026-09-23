import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/powerbiAuth";
import { saveOAuthTokens } from "@/lib/powerbiToken";

export const dynamic = "force-dynamic";

const VERIFIER_COOKIE = "pbi_oauth_verifier";
const STATE_COOKIE = "pbi_oauth_state";

function clearOAuthCookies(response: NextResponse) {
  response.cookies.delete(VERIFIER_COOKIE);
  response.cookies.delete(STATE_COOKIE);
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const origin = url.origin;

  function redirectWithError(message: string) {
    const target = new URL("/", origin);
    target.searchParams.set("powerbi_auth_error", message);
    const response = NextResponse.redirect(target);
    clearOAuthCookies(response);
    return response;
  }

  const azureError = url.searchParams.get("error_description") || url.searchParams.get("error");
  if (azureError) {
    return redirectWithError(azureError);
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = request.cookies.get(STATE_COOKIE)?.value;
  const verifier = request.cookies.get(VERIFIER_COOKIE)?.value;

  if (!code || !state || !verifier || !expectedState || state !== expectedState) {
    return redirectWithError("Sign-in didn't complete (missing or mismatched state) - please try again.");
  }

  try {
    const redirectUri = new URL("/api/powerbi/auth/callback", origin).toString();
    const tokens = await exchangeCodeForTokens({ code, codeVerifier: verifier, redirectUri });
    await saveOAuthTokens(tokens);
  } catch (error) {
    return redirectWithError(error instanceof Error ? error.message : "Failed to complete Microsoft sign-in.");
  }

  const response = NextResponse.redirect(new URL("/", origin));
  clearOAuthCookies(response);
  return response;
}
