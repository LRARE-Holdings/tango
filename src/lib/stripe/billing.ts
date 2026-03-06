export type Billing = "monthly" | "annual";
export type CheckoutPlan = "go" | "pro" | "team" | "standard";
export type CheckoutMode = "custom" | "hosted";
export type BillingPortalFlow = "default" | "payment_method_update" | "subscription_cancel" | "subscription_update";
type CheckoutPaymentMethodType = "card" | "revolut_pay";

const REVOLUT_PAY_SUPPORTED_CURRENCIES = new Set(["eur", "gbp", "ron", "huf", "pln", "dkk"]);

export function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

export function checkoutMode(): CheckoutMode {
  const value = String(process.env.NEXT_PUBLIC_STRIPE_CHECKOUT_MODE ?? "custom")
    .trim()
    .toLowerCase();
  return value === "hosted" ? "hosted" : "custom";
}

export function isCustomCheckoutEnabled() {
  return checkoutMode() === "custom";
}

export function priceEnvKey(plan: CheckoutPlan, billing: Billing) {
  return `STRIPE_PRICE_${plan.toUpperCase()}_${billing.toUpperCase()}`;
}

export function normalizeCheckoutPlan(x: unknown): CheckoutPlan {
  const value = String(x ?? "").trim().toLowerCase();
  if (value === "personal") return "go";
  if (value === "go" || value === "pro" || value === "team" || value === "standard") return value;
  throw new Error("Invalid plan");
}

export function assertBilling(x: unknown): asserts x is Billing {
  if (x !== "monthly" && x !== "annual") {
    throw new Error("Invalid billing");
  }
}

export function normalizeSeats(plan: CheckoutPlan, seatsRaw: unknown) {
  if (plan !== "team" && plan !== "standard") return 1;
  const raw = Number(seatsRaw);
  if (!Number.isFinite(raw)) return 2;
  return Math.max(2, Math.min(500, Math.floor(raw)));
}

export function siteBaseUrl() {
  const raw = requireEnv("NEXT_PUBLIC_APP_URL");
  try {
    const parsed = new URL(raw);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    throw new Error("NEXT_PUBLIC_APP_URL must be a valid URL");
  }
}

export function checkoutSuccessReturnUrl(baseUrl: string) {
  return `${baseUrl}/app/billing/success?session_id={CHECKOUT_SESSION_ID}`;
}

export function checkoutCancelUrl(baseUrl: string) {
  return `${baseUrl}/pricing`;
}

export function checkoutPaymentMethodTypes(currency: string | null | undefined): CheckoutPaymentMethodType[] {
  const normalizedCurrency = String(currency ?? "")
    .trim()
    .toLowerCase();

  if (REVOLUT_PAY_SUPPORTED_CURRENCIES.has(normalizedCurrency)) {
    return ["card", "revolut_pay"];
  }

  return ["card"];
}

export function parseBillingPortalFlow(input: unknown): BillingPortalFlow {
  const flow = String(input ?? "default").trim().toLowerCase();
  if (flow === "payment_method_update") return "payment_method_update";
  if (flow === "subscription_cancel") return "subscription_cancel";
  if (flow === "subscription_update") return "subscription_update";
  return "default";
}
