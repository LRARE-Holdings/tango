import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  RECEIPT_LAUNCH_UNLOCK_COOKIE,
  isReceiptLaunchLive,
} from "@/lib/launch-access";

const MAINTENANCE_BYPASS_COOKIE = "receipt_maintenance_bypass";
const MAINTENANCE_BYPASS_QUERY = "maintenance_bypass";

function isMaintenanceMode() {
  return process.env.MAINTENANCE_MODE === "1";
}

function isStaticAssetPath(pathname: string) {
  if (pathname.startsWith("/_next/")) return true;
  if (pathname === "/favicon.ico") return true;
  if (pathname === "/robots.txt") return true;
  if (pathname === "/sitemap.xml") return true;
  return /\.[a-z0-9]+$/i.test(pathname);
}

function hasValidMaintenanceBypass(req: NextRequest) {
  return req.cookies.get(MAINTENANCE_BYPASS_COOKIE)?.value === "1";
}

function hasValidMaintenanceBypassToken(req: NextRequest) {
  const token = req.nextUrl.searchParams.get(MAINTENANCE_BYPASS_QUERY);
  const expected = process.env.MAINTENANCE_BYPASS_TOKEN;
  return Boolean(expected && token && token === expected);
}

function withMaintenanceBypassCookie(res: NextResponse) {
  res.cookies.set({
    name: MAINTENANCE_BYPASS_COOKIE,
    value: "1",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 4,
  });
  return res;
}

export async function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  if (isMaintenanceMode()) {
    if (isStaticAssetPath(pathname) || pathname.startsWith("/api/")) {
      return NextResponse.next();
    }

    if (hasValidMaintenanceBypassToken(req)) {
      const cleanUrl = req.nextUrl.clone();
      cleanUrl.searchParams.delete(MAINTENANCE_BYPASS_QUERY);
      return withMaintenanceBypassCookie(NextResponse.redirect(cleanUrl));
    }

    if (!hasValidMaintenanceBypass(req) && pathname !== "/maintenance") {
      const maintenanceUrl = req.nextUrl.clone();
      maintenanceUrl.pathname = "/maintenance";
      maintenanceUrl.search = "";
      return NextResponse.redirect(maintenanceUrl);
    }
  }

  if (!isReceiptLaunchLive() && (pathname === "/auth" || pathname === "/get-started")) {
    const hasLaunchAccess = req.cookies.get(RECEIPT_LAUNCH_UNLOCK_COOKIE)?.value === "1";
    if (!hasLaunchAccess) {
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = "/launch-access";
      redirectUrl.searchParams.set("next", `${pathname}${req.nextUrl.search}`);
      return NextResponse.redirect(redirectUrl);
    }
  }

  const res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protect /app routes
  if (!user && pathname.startsWith("/app")) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/auth";
    return NextResponse.redirect(redirectUrl);
  }

  return res;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
