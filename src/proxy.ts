import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  getPrimaryWorkspaceMfaRequirementForUser,
  getVerifiedMfaStatus,
  getWorkspaceMfaRequirementForUser,
  workspaceIdentifierFromPath,
} from "@/lib/security/mfa-enforcement";

function applyNoStoreHeaders(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
}

export async function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const isPrivatePath =
    pathname.startsWith("/app") ||
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/d/") ||
    pathname.startsWith("/api/app");

  const res = NextResponse.next();

  if (
    pathname.startsWith("/app") ||
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/api/app") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/get-started") ||
    pathname.startsWith("/onboarding")
  ) {
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

    let mfaStatusLookupFailed = false;
    let primaryRequirementLookupFailed = false;
    let workspaceRequirementLookupFailed = false;

    const mfaStatus = await getVerifiedMfaStatus(supabase).catch((error: unknown) => {
      mfaStatusLookupFailed = true;
      console.error("MFA status lookup failed:", error);
      return { enabled: false, verifiedFactorCount: 0 };
    });

    const primaryWorkspaceRequirement = await getPrimaryWorkspaceMfaRequirementForUser({
      supabase,
      admin,
      userId: user.id,
    }).catch((error: unknown) => {
      primaryRequirementLookupFailed = true;
      console.error("Primary workspace MFA requirement lookup failed:", error);
      return { required: false, workspaceId: null };
    });

    const workspaceRequirement = workspaceIdentifier
      ? await getWorkspaceMfaRequirementForUser({ admin, userId: user.id, workspaceIdentifier }).catch(
          (error: unknown) => {
            workspaceRequirementLookupFailed = true;
            console.error("Workspace MFA requirement lookup failed:", error);
            return { required: false, workspaceId: null };
          }
        )
      : { required: false, workspaceId: null };

    const requiredByWorkspacePath = workspaceRequirement.required;
    const requiredByPrimaryWorkspace = primaryWorkspaceRequirement.required;
    const requirementLookupFailed = primaryRequirementLookupFailed || workspaceRequirementLookupFailed;
    const missingVerifiedMfa = mfaStatusLookupFailed || !mfaStatus.enabled;
    const mfaRequired = requirementLookupFailed || requiredByWorkspacePath || requiredByPrimaryWorkspace;
    if (mfaRequired && missingVerifiedMfa) {
      const unavailable = requirementLookupFailed || mfaStatusLookupFailed;
      if (isApiPath) {
        const denied = NextResponse.json(
          {
            error: unavailable
              ? "Multi-factor authentication policy could not be verified. Access is temporarily blocked."
              : "Multi-factor authentication is required by workspace policy. Complete MFA setup to continue.",
            code: unavailable ? "MFA_ENFORCEMENT_UNAVAILABLE" : "MFA_REQUIRED",
          },
          { status: 403 }
        );
        applyNoStoreHeaders(denied);
        return denied;
      }

      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = "/app/setup/mfa";
      redirectUrl.searchParams.set("mfa", "required");
      if (unavailable) {
        redirectUrl.searchParams.set("mfa_scope", "policy_check_unavailable");
      } else if (requiredByWorkspacePath && requiredByPrimaryWorkspace) {
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
      applyNoStoreHeaders(redirect);
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
  ],
};
