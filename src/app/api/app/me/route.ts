import { NextResponse } from "next/server";
import { currentUtcMonthRange, getDocumentQuota, normalizeEffectivePlan } from "@/lib/document-limits";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { getWorkspaceEntitlementsForUser } from "@/lib/workspace-licensing";
import { getVerifiedMfaStatus, type MfaRequirementReason } from "@/lib/security/mfa-enforcement";
import { resolveWorkspaceIdentifier } from "@/lib/workspace-identifier";

export const dynamic = "force-dynamic";

function isUnauthorizedAuthError(error: { message?: string; code?: string } | null | undefined) {
  if (!error) return false;
  if (error.code === "PGRST301") return true;
  const msg = String(error.message ?? "").toLowerCase();
  return msg.includes("auth session missing") || msg.includes("invalid jwt") || msg.includes("jwt");
}

type EntitlementsRow = {
  plan: string | null;
  subscription_status: string | null;
  billing_interval: string | null;
  seats: number | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  is_paid: boolean | null;
};

type ProfileCoreRow = {
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  onboarding_completed: boolean | null;
  onboarding_completed_at: string | null;
  onboarding_answers: unknown;
  recommended_plan: string | null;
  primary_workspace_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type OptionalPrefs = {
  display_name: string | null;
  marketing_opt_in: boolean;
  default_ack_limit: number;
  default_password_enabled: boolean;
  profile_photo_path: string | null;
  profile_photo_updated_at: string | null;
  profile_photo_prompt_completed: boolean;
};

type DbErrorLike = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

function isMissingColumnError(error: DbErrorLike | null | undefined, column: string) {
  if (!error) return false;
  if (error.code === "42703") return true;

  const allText = [error.message, error.details, error.hint].filter(Boolean).join(" ").toLowerCase();
  if (!allText) return false;

  const col = column.toLowerCase();
  return (
    allText.includes("does not exist") &&
    (allText.includes(`profiles.${col}`) || allText.includes(`"${col}"`) || allText.includes(` ${col} `))
  );
}

function firstToken(value: unknown) {
  const clean = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!clean) return "";
  return clean.split(" ")[0] ?? "";
}

function displayNameFromUserMetadata(user: { user_metadata?: unknown; email?: string | null } | null | undefined) {
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const fromFirstName = firstToken(meta.first_name);
  if (fromFirstName) return fromFirstName;
  const fromFullName = firstToken(meta.full_name);
  if (fromFullName) return fromFullName;
  const fromName = firstToken(meta.name);
  if (fromName) return fromName;
  return firstToken(String(user?.email ?? "").split("@")[0] ?? "");
}

function normalizeProfilePhotoMode(value: unknown): "allow" | "disabled" | "company" {
  const normalized = String(value ?? "allow").trim().toLowerCase();
  if (normalized === "disabled" || normalized === "company") return normalized;
  return "allow";
}

async function readOptionalPrefs(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  userId: string
): Promise<{ prefs: OptionalPrefs; error: string | null }> {
  const prefs: OptionalPrefs = {
    display_name: null,
    marketing_opt_in: false,
    default_ack_limit: 1,
    default_password_enabled: false,
    profile_photo_path: null,
    profile_photo_updated_at: null,
    profile_photo_prompt_completed: true,
  };

  const columns = [
    "display_name",
    "marketing_opt_in",
    "default_ack_limit",
    "default_password_enabled",
    "profile_photo_path",
    "profile_photo_updated_at",
    "profile_photo_prompt_completed_at",
  ] as const;

  for (const col of columns) {
    const { data, error } = await supabase.from("profiles").select(col).eq("id", userId).maybeSingle();
    if (error) {
      if (isMissingColumnError(error as DbErrorLike, col)) continue;
      return { prefs, error: error.message };
    }

    const row = (data ?? {}) as Record<string, unknown>;
    if (col === "display_name") prefs.display_name = (row.display_name as string | null) ?? null;
    if (col === "marketing_opt_in") prefs.marketing_opt_in = Boolean(row.marketing_opt_in ?? false);
    if (col === "default_ack_limit") prefs.default_ack_limit = Number(row.default_ack_limit ?? 1);
    if (col === "default_password_enabled") {
      prefs.default_password_enabled = Boolean(row.default_password_enabled ?? false);
    }
    if (col === "profile_photo_path") {
      prefs.profile_photo_path = (row.profile_photo_path as string | null) ?? null;
    }
    if (col === "profile_photo_updated_at") {
      prefs.profile_photo_updated_at = (row.profile_photo_updated_at as string | null) ?? null;
    }
    if (col === "profile_photo_prompt_completed_at") {
      prefs.profile_photo_prompt_completed = Boolean(row.profile_photo_prompt_completed_at);
    }
  }

  return { prefs, error: null };
}

export async function GET(req: Request) {
  const supabase = await supabaseServer();

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) {
    return NextResponse.json(
      { error: isUnauthorizedAuthError(userErr) ? "Unauthorized" : userErr.message },
      { status: isUnauthorizedAuthError(userErr) ? 401 : 500 }
    );
  }
  if (!userRes.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = userRes.user.id;

  const { data: ent, error: entErr } = await supabase
    .from("profile_entitlements")
    .select(
      "plan, subscription_status, billing_interval, seats, current_period_end, cancel_at_period_end, is_paid"
    )
    .eq("id", userId)
    .maybeSingle();
  if (entErr) return NextResponse.json({ error: entErr.message }, { status: 500 });

  // Core profile columns only (stable across environments)
  const { data: prof, error: profErr } = await supabase
    .from("profiles")
    .select(
      "stripe_customer_id,stripe_subscription_id,onboarding_completed,onboarding_completed_at,onboarding_answers,recommended_plan,primary_workspace_id,created_at,updated_at"
    )
    .eq("id", userId)
    .maybeSingle();
  if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 });

  const { prefs, error: prefsErr } = await readOptionalPrefs(supabase, userId);
  if (prefsErr) return NextResponse.json({ error: prefsErr }, { status: 500 });
  const resolvedDisplayName = firstToken(prefs.display_name) || displayNameFromUserMetadata(userRes.user) || null;

  const entRow = (ent ?? null) as EntitlementsRow | null;
  const profRow = (prof ?? null) as ProfileCoreRow | null;
  const plan = normalizeEffectivePlan(entRow?.plan ?? "free");
  const primaryWorkspaceId = String(profRow?.primary_workspace_id ?? "").trim() || null;
  const admin = supabaseAdmin();
  let workspaceLicenseActive = false;
  let workspacePlan: string | null = null;
  let workspaceSeatLimit = 1;

  if (primaryWorkspaceId) {
    try {
      const wsEnt = await getWorkspaceEntitlementsForUser(admin, primaryWorkspaceId, userId);
      if (wsEnt && wsEnt.license_active) {
        workspaceLicenseActive = true;
        workspacePlan = wsEnt.plan;
        workspaceSeatLimit = wsEnt.seat_limit;
      }
    } catch {
      // Keep /me resilient: if workspace licensing read fails, continue with profile entitlements only.
    }
  }

  const displayPlan = workspaceLicenseActive && plan === "free" ? "licensed" : plan;
  const quotaPlan = workspaceLicenseActive
    ? normalizeEffectivePlan(workspacePlan ?? plan)
    : plan;
  const quotaSeatLimit = workspaceLicenseActive ? workspaceSeatLimit : (entRow?.seats ?? 1);
  const quota = getDocumentQuota(quotaPlan, quotaSeatLimit);

  let usageUsed = 0;
  if (quota.limit !== null) {
    let countQuery = supabase.from("documents").select("id", { count: "exact", head: true });
    if (quota.window === "monthly") {
      const { startIso, endIso } = currentUtcMonthRange();
      countQuery = countQuery.gte("created_at", startIso).lt("created_at", endIso);
    }

    if (quotaPlan === "team") {
      const workspaceId = String(profRow?.primary_workspace_id ?? "").trim();
      if (workspaceId) {
        countQuery = countQuery.eq("workspace_id", workspaceId);
      } else {
        countQuery = countQuery.eq("owner_id", userId);
      }
    } else {
      countQuery = countQuery.eq("owner_id", userId);
    }

    const { count, error: usageErr } = await countQuery;
    if (usageErr) return NextResponse.json({ error: usageErr.message }, { status: 500 });
    usageUsed = count ?? 0;
  }

  const usageLimit = quota.limit;
  const usageRemaining = usageLimit == null ? null : Math.max(0, usageLimit - usageUsed);
  const usagePercent =
    usageLimit == null || usageLimit <= 0 ? null : Math.min(100, Math.round((usageUsed / usageLimit) * 100));
  const usageNearLimit = usageLimit != null && usageUsed >= Math.floor(usageLimit * 0.8);
  const usageAtLimit = usageLimit != null && usageUsed >= usageLimit;

  let mfaEnabled = false;
  let mfaVerifiedFactorCount = 0;
  try {
    const status = await getVerifiedMfaStatus(supabase);
    mfaEnabled = status.enabled;
    mfaVerifiedFactorCount = status.verifiedFactorCount;
  } catch {
    // Keep /me resilient if MFA provider lookups are temporarily unavailable.
  }

  let workspacePolicyMfaRequired = false;
  if (primaryWorkspaceId && workspaceLicenseActive) {
    const mfaRes = await admin
      .from("workspaces")
      .select("mfa_required")
      .eq("id", primaryWorkspaceId)
      .maybeSingle();
    if (mfaRes.error && !isMissingColumnError(mfaRes.error as DbErrorLike, "mfa_required")) {
      return NextResponse.json({ error: mfaRes.error.message }, { status: 500 });
    }
    workspacePolicyMfaRequired = (mfaRes.data as { mfa_required?: unknown } | null)?.mfa_required === true;
  }

  const mfaRequiredReasons: MfaRequirementReason[] = [];
  if (workspacePolicyMfaRequired) mfaRequiredReasons.push("workspace_policy");
  const mfaRequired = mfaRequiredReasons.length > 0;

  const url = new URL(req.url);
  const workspaceIdentifierParam = String(url.searchParams.get("workspace_id") ?? "").trim();
  let activeWorkspaceId: string | null = null;
  if (workspaceIdentifierParam) {
    try {
      const resolved = await resolveWorkspaceIdentifier(workspaceIdentifierParam);
      activeWorkspaceId = resolved?.id ?? null;
    } catch {
      activeWorkspaceId = null;
    }
  } else {
    activeWorkspaceId = primaryWorkspaceId;
  }

  let activeWorkspacePhotoPolicy: "allow" | "disabled" | "company" | "none" = "none";
  let activeWorkspaceHasCompanyPhoto = false;
  if (activeWorkspaceId) {
    const memberRes = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", activeWorkspaceId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!memberRes.error && memberRes.data) {
      const workspaceRes = await supabase
        .from("workspaces")
        .select("member_profile_photo_mode,member_profile_photo_path")
        .eq("id", activeWorkspaceId)
        .maybeSingle();

      if (workspaceRes.error) {
        if (
          !isMissingColumnError(workspaceRes.error as DbErrorLike, "member_profile_photo_mode") &&
          !isMissingColumnError(workspaceRes.error as DbErrorLike, "member_profile_photo_path")
        ) {
          return NextResponse.json({ error: workspaceRes.error.message }, { status: 500 });
        }
      } else {
        activeWorkspacePhotoPolicy = normalizeProfilePhotoMode(
          (workspaceRes.data as { member_profile_photo_mode?: unknown } | null)?.member_profile_photo_mode
        );
        activeWorkspaceHasCompanyPhoto = Boolean(
          (workspaceRes.data as { member_profile_photo_path?: string | null } | null)?.member_profile_photo_path
        );
      }
    }
  }

  return NextResponse.json({
    id: userId,
    email: userRes.user.email ?? null,

    plan,
    display_plan: displayPlan,
    workspace_license_active: workspaceLicenseActive,
    workspace_plan: workspacePlan,
    subscription_status: entRow?.subscription_status ?? null,
    billing_interval: entRow?.billing_interval ?? null,
    seats: entRow?.seats ?? 1,
    current_period_end: entRow?.current_period_end ?? null,
    cancel_at_period_end: entRow?.cancel_at_period_end ?? false,
    is_paid: entRow?.is_paid ?? false,

    stripe_customer_id: profRow?.stripe_customer_id ?? null,
    stripe_subscription_id: profRow?.stripe_subscription_id ?? null,
    onboarding_completed: profRow?.onboarding_completed ?? false,
    onboarding_completed_at: profRow?.onboarding_completed_at ?? null,
    onboarding_answers: profRow?.onboarding_answers ?? null,
    recommended_plan: profRow?.recommended_plan ?? null,
    primary_workspace_id: profRow?.primary_workspace_id ?? null,
    created_at: profRow?.created_at ?? null,
    updated_at: profRow?.updated_at ?? null,

    display_name: resolvedDisplayName,
    marketing_opt_in: prefs.marketing_opt_in,
    default_ack_limit: prefs.default_ack_limit,
    default_password_enabled: prefs.default_password_enabled,
    has_profile_photo: Boolean(prefs.profile_photo_path),
    profile_photo_updated_at: prefs.profile_photo_updated_at,
    profile_photo_prompt_completed: prefs.profile_photo_prompt_completed,
    active_workspace_photo_policy: activeWorkspacePhotoPolicy,
    active_workspace_has_company_photo: activeWorkspaceHasCompanyPhoto,
    mfa_enabled: mfaEnabled,
    mfa_verified_factor_count: mfaVerifiedFactorCount,
    mfa_required: mfaRequired,
    mfa_required_reasons: mfaRequiredReasons,
    usage:
      displayPlan === "licensed"
        ? null
        : {
            used: usageUsed,
            limit: usageLimit,
            remaining: usageRemaining,
            percent: usagePercent,
            window: quota.window,
            near_limit: usageNearLimit,
            at_limit: usageAtLimit,
          },
  });
}
