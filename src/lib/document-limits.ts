export const DOCUMENT_LIMITS = {
  freeTotalPerUser: 10,
  personalPerMonth: 100,
  proPerMonth: 500,
  teamBasePerMonth: 1000,
  teamExtraPerSeatPerMonth: 200,
} as const;

export type EffectivePlan = "free" | "personal" | "pro" | "team" | "enterprise";

export type DocumentQuota = {
  limit: number | null;
  window: "total" | "monthly" | "custom";
};

export function normalizeEffectivePlan(v: unknown): EffectivePlan {
  const p = String(v ?? "free").trim().toLowerCase();
  if (p === "personal" || p === "pro" || p === "team" || p === "enterprise") return p;
  return "free";
}

export function getDocumentQuota(planInput: unknown, seatsInput?: unknown): DocumentQuota {
  const plan = normalizeEffectivePlan(planInput);
  const seats = Math.max(1, Math.floor(Number(seatsInput) || 1));

  if (plan === "free") {
    return { limit: DOCUMENT_LIMITS.freeTotalPerUser, window: "total" };
  }
  if (plan === "personal") {
    return { limit: DOCUMENT_LIMITS.personalPerMonth, window: "monthly" };
  }
  if (plan === "pro") {
    return { limit: DOCUMENT_LIMITS.proPerMonth, window: "monthly" };
  }
  if (plan === "team") {
    return {
      limit: DOCUMENT_LIMITS.teamBasePerMonth + seats * DOCUMENT_LIMITS.teamExtraPerSeatPerMonth,
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
