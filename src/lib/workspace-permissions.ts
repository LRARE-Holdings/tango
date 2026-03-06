import type { EffectivePlan } from "@/lib/workspace-licensing";
import { canUseStackDeliveryByPlan, canViewComplianceAnalyticsByPlan } from "@/lib/plan-capabilities";

export type WorkspaceRole = "owner" | "admin" | "member";

export type WorkspaceMemberAccess = {
  role: WorkspaceRole;
  license_active: boolean;
  can_view_analytics?: boolean | null;
};

export const KEY_SETTINGS = [
  "profile",
  "notifications",
  "report_preferences",
] as const;

export function canAccessAdminSettings(role: WorkspaceRole | null | undefined) {
  return role === "owner" || role === "admin";
}

export function canAccessKeySettings(member: WorkspaceMemberAccess | null | undefined) {
  if (!member) return false;
  if (canAccessAdminSettings(member.role)) return true;
  return member.role === "member" && member.license_active;
}

export function canViewAnalytics(
  member: WorkspaceMemberAccess | null | undefined,
  plan: EffectivePlan | null | undefined
) {
  if (!member || !member.license_active) return false;
  if (!canViewComplianceAnalyticsByPlan(plan ?? "free")) return false;
  if (canAccessAdminSettings(member.role)) return true;
  return member.can_view_analytics === true;
}

export function canUseStackDelivery(
  member: WorkspaceMemberAccess | null | undefined,
  plan: EffectivePlan | null | undefined
) {
  if (!member || !member.license_active) return false;
  return canUseStackDeliveryByPlan(plan ?? "free");
}
