export type EffectivePlan = "free" | "go" | "pro" | "team" | "standard" | "enterprise";

export function normalizeEffectivePlan(value: unknown): EffectivePlan {
  const plan = String(value ?? "free").trim().toLowerCase();
  if (plan === "personal") return "go";
  if (plan === "go" || plan === "pro" || plan === "team" || plan === "standard" || plan === "enterprise") {
    return plan;
  }
  return "free";
}

export function isPaidPlan(plan: unknown) {
  return normalizeEffectivePlan(plan) !== "free";
}

export function isWorkspacePlan(plan: unknown) {
  const normalized = normalizeEffectivePlan(plan);
  return normalized === "team" || normalized === "standard" || normalized === "enterprise";
}

export function isSeatBasedPlan(plan: unknown) {
  const normalized = normalizeEffectivePlan(plan);
  return normalized === "team" || normalized === "standard";
}

export function canUsePasswords(plan: unknown) {
  const normalized = normalizeEffectivePlan(plan);
  return normalized !== "free";
}

export function canSendEmails(plan: unknown) {
  const normalized = normalizeEffectivePlan(plan);
  return normalized === "pro" || normalized === "standard" || normalized === "enterprise";
}

export function canAccessTemplates(plan: unknown) {
  const normalized = normalizeEffectivePlan(plan);
  return normalized === "pro" || normalized === "team" || normalized === "standard" || normalized === "enterprise";
}

export function canAccessContacts(plan: unknown) {
  const normalized = normalizeEffectivePlan(plan);
  return normalized === "pro" || normalized === "team" || normalized === "standard" || normalized === "enterprise";
}

export function canAccessDepartmentGroups(plan: unknown) {
  const normalized = normalizeEffectivePlan(plan);
  return normalized === "standard" || normalized === "enterprise";
}

export function canUseStackDeliveryByPlan(plan: unknown) {
  const normalized = normalizeEffectivePlan(plan);
  return normalized === "pro" || normalized === "standard" || normalized === "enterprise";
}

export function canViewComplianceAnalyticsByPlan(plan: unknown) {
  const normalized = normalizeEffectivePlan(plan);
  return normalized === "standard" || normalized === "enterprise";
}

export function planLabel(plan: unknown) {
  const normalized = normalizeEffectivePlan(plan);
  if (normalized === "free") return "Free";
  if (normalized === "go") return "Go";
  if (normalized === "pro") return "Pro";
  if (normalized === "team") return "Team";
  if (normalized === "standard") return "Standard";
  return "Enterprise";
}
