import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  RECEIPT_LAUNCH_UNLOCK_COOKIE,
  isReceiptLaunchLive,
} from "@/lib/launch-access";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  getPrimaryWorkspaceMfaRequirementForUser,
  getVerifiedMfaStatus,
  getWorkspaceMfaRequirementForUser,
  workspaceIdentifierFromPath,
} from "@/lib/security/mfa-enforcement";

export async function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const isPrivatePath =
    pathname.startsWith("/app") ||
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/d/") ||
    pathname.startsWith("/api/app");

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

  if (pathname.startsWith("/app") || pathname.startsWith("/checkout") || pathname.startsWith("/api/app")) {
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
  if (!user && (pathname.startsWith("/app") || pathname.startsWith("/checkout"))) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/auth";
    const redirect = NextResponse.redirect(redirectUrl);
    redirect.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    redirect.headers.set("Pragma", "no-cache");
    redirect.headers.set("Expires", "0");
    redirect.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    return redirect;
  }

  const isAccountPath = pathname === "/app/account" || pathname.startsWith("/app/account/");
  const isMfaSetupPath = pathname === "/app/setup/mfa" || pathname.startsWith("/app/setup/mfa/");
  const isApiPath = pathname.startsWith("/api/");
  const isAppApiPath = pathname.startsWith("/api/app");
  const isMfaBypassApiPath =
    pathname === "/api/app/me" || pathname === "/api/app/account" || pathname.startsWith("/api/app/account/");
  const shouldEvaluateMfa =
    Boolean(user) &&
    (pathname.startsWith("/app") || pathname.startsWith("/checkout") || isAppApiPath) &&
    !isAccountPath &&
    !isMfaSetupPath &&
    !(isAppApiPath && isMfaBypassApiPath);

  if (shouldEvaluateMfa && user) {
    const admin = supabaseAdmin();
    const workspaceIdentifier = workspaceIdentifierFromPath(pathname);

    const mfaStatus = await getVerifiedMfaStatus(supabase).catch((error: unknown) => {
      console.error("MFA status lookup failed:", error);
      // Fail open if the auth provider MFA status check fails.
      return { enabled: true, verifiedFactorCount: 0 };
    });

    const primaryWorkspaceRequirement = await getPrimaryWorkspaceMfaRequirementForUser({
      supabase,
      admin,
      userId: user.id,
    }).catch((error: unknown) => {
      console.error("Primary workspace MFA requirement lookup failed:", error);
      return { required: false, workspaceId: null };
    });

    const workspaceRequirement = workspaceIdentifier
      ? await getWorkspaceMfaRequirementForUser({ admin, userId: user.id, workspaceIdentifier }).catch(
          (error: unknown) => {
            console.error("Workspace MFA requirement lookup failed:", error);
            return { required: false, workspaceId: null };
          }
        )
      : { required: false, workspaceId: null };

    const requiredByWorkspacePath = workspaceRequirement.required;
    const requiredByPrimaryWorkspace = primaryWorkspaceRequirement.required;
    const mfaRequired = requiredByWorkspacePath || requiredByPrimaryWorkspace;
    if (mfaRequired && !mfaStatus.enabled) {
      if (isApiPath) {
        const denied = NextResponse.json(
          {
            error: "Multi-factor authentication is required by workspace policy. Complete MFA setup to continue.",
            code: "MFA_REQUIRED",
          },
          { status: 403 }
        );
        denied.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
        denied.headers.set("Pragma", "no-cache");
        denied.headers.set("Expires", "0");
        denied.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
        return denied;
      }

      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = "/app/setup/mfa";
      redirectUrl.searchParams.set("mfa", "required");
      if (requiredByWorkspacePath && requiredByPrimaryWorkspace) {
        if (
          workspaceRequirement.workspaceId &&
          primaryWorkspaceRequirement.workspaceId &&
          workspaceRequirement.workspaceId !== primaryWorkspaceRequirement.workspaceId
        ) {
          redirectUrl.searchParams.set("mfa_scope", "multiple_workspaces");
        } else {
          redirectUrl.searchParams.set("mfa_scope", "workspace");
        }
      } else if (requiredByWorkspacePath) {
        redirectUrl.searchParams.set("mfa_scope", "workspace");
      } else {
        redirectUrl.searchParams.set("mfa_scope", "primary_workspace");
      }
      redirectUrl.searchParams.set("next", `${pathname}${req.nextUrl.search}`);

      const redirect = NextResponse.redirect(redirectUrl);
      redirect.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
      redirect.headers.set("Pragma", "no-cache");
      redirect.headers.set("Expires", "0");
      redirect.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
      return redirect;
    }
  }

  return res;
}

export const config = {
  matcher: [
    "/app",
    "/app/:path*",
    "/checkout",
    "/checkout/:path*",
    "/auth",
    "/auth/:path*",
    "/get-started",
    "/get-started/:path*",
    "/onboarding",
    "/onboarding/:path*",
    "/api/app",
    "/api/app/:path*",
    "/d",
    "/d/:path*",
    "/launch-access",
    "/launch-access/:path*",
  ],
};
