import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  RECEIPT_LAUNCH_UNLOCK_COOKIE,
  isReceiptLaunchLive,
} from "@/lib/launch-access";

export async function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const isPrivatePath =
    pathname.startsWith("/app") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/d/");

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

  if (pathname.startsWith("/app")) {
    // Prevent browser/proxy caches from serving authenticated app shells after logout.
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    res.headers.set("Pragma", "no-cache");
    res.headers.set("Expires", "0");
  }

  if (isPrivatePath) {
    res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }

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
    const redirect = NextResponse.redirect(redirectUrl);
    redirect.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    redirect.headers.set("Pragma", "no-cache");
    redirect.headers.set("Expires", "0");
    redirect.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    return redirect;
  }

  return res;
}

export const config = {
  matcher: ["/app/:path*", "/auth", "/get-started"],
};
