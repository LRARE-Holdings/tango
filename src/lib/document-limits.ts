import { isSeatBasedPlan, normalizeEffectivePlan, type EffectivePlan } from "@/lib/plan-capabilities";

export const DOCUMENT_LIMITS = {
  freeTotalPerUser: 10,
  goPerMonth: 50,
  proPerMonth: 500,
  teamPerMonth: 100,
  standardPerSeatPerMonth: 250,
} as const;

export type DocumentQuota = {
  limit: number | null;
  window: "total" | "monthly" | "custom";
};

export { type EffectivePlan, normalizeEffectivePlan };

export function getDocumentQuota(planInput: unknown, seatsInput?: unknown): DocumentQuota {
  const plan = normalizeEffectivePlan(planInput);
  const seats = Math.max(1, Math.floor(Number(seatsInput) || 1));

  if (plan === "free") {
    return { limit: DOCUMENT_LIMITS.freeTotalPerUser, window: "total" };
  }
  if (plan === "go") {
    return { limit: DOCUMENT_LIMITS.goPerMonth, window: "monthly" };
  }
  if (plan === "pro") {
    return { limit: DOCUMENT_LIMITS.proPerMonth, window: "monthly" };
  }
  if (plan === "team") {
    return { limit: DOCUMENT_LIMITS.teamPerMonth, window: "monthly" };
  }
  if (plan === "standard") {
    return {
      limit: DOCUMENT_LIMITS.standardPerSeatPerMonth * (isSeatBasedPlan(plan) ? seats : 1),
      window: "monthly",
    };
  }
  return { limit: null, window: "custom" };
}

export function currentUtcMonthRange(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}
