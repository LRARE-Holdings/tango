import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || url.searchParams.get("redirect_to");
  const redirectTo = next && next.startsWith("/") ? next : "/app";
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

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const loginUrl = new URL("/auth", url.origin);
    loginUrl.searchParams.set("next", redirectTo);
    loginUrl.searchParams.set("error", error.message);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.redirect(new URL(redirectTo, url.origin));
}
