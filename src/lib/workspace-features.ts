import { supabaseAdmin } from "@/lib/supabase/admin";
import { resolveWorkspaceIdentifier } from "@/lib/workspace-identifier";
import { getWorkspaceEntitlementsForUser, type EffectivePlan } from "@/lib/workspace-licensing";

export type WorkspaceFeatureKey = "templates" | "contacts";

function normalizePlan(plan: unknown): EffectivePlan {
  const value = String(plan ?? "free").trim().toLowerCase();
  if (value === "personal" || value === "pro" || value === "team" || value === "enterprise") return value;
  return "free";
}

export function canAccessFeatureByPlan(plan: unknown, featureKey: WorkspaceFeatureKey): boolean {
  const normalized = normalizePlan(plan);
  if (featureKey === "templates" || featureKey === "contacts") {
    return normalized === "pro" || normalized === "team" || normalized === "enterprise";
  }
  return false;
}

export type WorkspaceFeatureAccess = {
  allowed: boolean;
  workspaceId: string | null;
  plan: EffectivePlan | null;
  reason: "not_found" | "forbidden" | "license_inactive" | "upgrade_required" | null;
};

export async function canAccessFeature(
  workspaceIdentifier: string,
  featureKey: WorkspaceFeatureKey,
  userId: string
): Promise<WorkspaceFeatureAccess> {
  const resolved = await resolveWorkspaceIdentifier(workspaceIdentifier);
  if (!resolved) {
    return {
      allowed: false,
      workspaceId: null,
      plan: null,
      reason: "not_found",
    };
  }

  const admin = supabaseAdmin();
  const entitlements = await getWorkspaceEntitlementsForUser(admin, resolved.id, userId);

  if (!entitlements) {
    return {
      allowed: false,
      workspaceId: resolved.id,
      plan: null,
      reason: "forbidden",
    };
  }

  if (!entitlements.license_active) {
    return {
      allowed: false,
      workspaceId: resolved.id,
      plan: entitlements.plan,
      reason: "license_inactive",
    };
  }

  if (!canAccessFeatureByPlan(entitlements.plan, featureKey)) {
    return {
      allowed: false,
      workspaceId: resolved.id,
      plan: entitlements.plan,
      reason: "upgrade_required",
    };
  }

  return {
    allowed: true,
    workspaceId: resolved.id,
    plan: entitlements.plan,
    reason: null,
  };
}
