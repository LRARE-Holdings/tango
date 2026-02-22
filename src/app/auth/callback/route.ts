import { NextResponse } from "next/server";
import { safeInternalPath } from "@/lib/safe-redirect";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || url.searchParams.get("redirect_to");
  const firstName = (url.searchParams.get("first_name") || "").trim();
  const redirectTo = safeInternalPath(next, "/app");
  const authError = url.searchParams.get("error_description") || url.searchParams.get("error");

  if (authError) {
    const loginUrl = new URL("/auth", url.origin);
    loginUrl.searchParams.set("next", redirectTo);
    loginUrl.searchParams.set("error", authError);
    return NextResponse.redirect(loginUrl);
  }

  if (!code) {
    const loginUrl = new URL("/auth", url.origin);
    loginUrl.searchParams.set("next", redirectTo);
    loginUrl.searchParams.set("error", "Missing auth code.");
    return NextResponse.redirect(loginUrl);
  }

  // OAuth PKCE is initiated in the browser, so exchange the code in /auth/confirm
  // to ensure the verifier is read from the same client-side cookie storage.
  const confirmUrl = new URL("/auth/confirm", url.origin);
  confirmUrl.searchParams.set("code", code);
  confirmUrl.searchParams.set("next", redirectTo);
  if (firstName) {
    confirmUrl.searchParams.set("first_name", firstName);
  }

  return NextResponse.redirect(confirmUrl);
}
