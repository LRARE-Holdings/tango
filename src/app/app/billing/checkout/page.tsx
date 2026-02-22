"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import { CheckoutProvider, PaymentElement, useCheckout } from "@stripe/react-stripe-js/checkout";

type CheckoutPlan = "personal" | "pro" | "team";
type Billing = "monthly" | "annual";

type CheckoutSessionResponse = {
  checkoutSessionId: string;
  clientSecret: string;
  returnUrl: string;
  publishableKey: string;
};

type QueryPayload = {
  plan: CheckoutPlan;
  billing: Billing;
  seats?: number;
  source?: string;
};

function planLabel(plan: CheckoutPlan) {
  if (plan === "personal") return "Personal";
  if (plan === "pro") return "Pro";
  return "Team";
}

function billingLabel(billing: Billing) {
  return billing === "annual" ? "Annual" : "Monthly";
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function parseQuery(searchParams: URLSearchParams): { value: QueryPayload | null; error: string | null } {
  const planRaw = String(searchParams.get("plan") ?? "").trim().toLowerCase();
  const billingRaw = String(searchParams.get("billing") ?? "").trim().toLowerCase();
  const sourceRaw = String(searchParams.get("source") ?? "").trim().toLowerCase();

  if (planRaw !== "personal" && planRaw !== "pro" && planRaw !== "team") {
    return { value: null, error: "Invalid plan in checkout request." };
  }

  if (billingRaw !== "monthly" && billingRaw !== "annual") {
    return { value: null, error: "Invalid billing cadence in checkout request." };
  }

  const query: QueryPayload = {
    plan: planRaw,
    billing: billingRaw,
    source: sourceRaw ? sourceRaw.slice(0, 64) : "custom_checkout",
  };

  if (planRaw === "team") {
    const seatsRaw = Number(searchParams.get("seats"));
    const seats = Number.isFinite(seatsRaw) ? Math.max(2, Math.min(500, Math.floor(seatsRaw))) : 2;
    query.seats = seats;
  }

  return { value: query, error: null };
}

function CheckoutForm({
  sessionId,
  plan,
  billing,
  seats,
  returnUrl,
}: {
  sessionId: string;
  plan: CheckoutPlan;
  billing: Billing;
  seats: number;
  returnUrl: string;
}) {
  const checkoutState = useCheckout();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoMsg, setPromoMsg] = useState<string | null>(null);

  async function applyPromoCode() {
    if (checkoutState.type !== "success") return;

    const code = promoCode.trim();
    if (!code) {
      setPromoMsg("Enter a promotion code.");
      return;
    }

    setPromoBusy(true);
    setPromoMsg(null);
    try {
      const result = await checkoutState.checkout.applyPromotionCode(code);
      if (result.type === "error") {
        setPromoMsg(result.error.message || "Could not apply that code.");
      } else {
        setPromoMsg("Promotion code applied.");
      }
    } catch (error: unknown) {
      setPromoMsg(errorMessage(error, "Could not apply that code."));
    } finally {
      setPromoBusy(false);
    }
  }

  async function removePromoCode() {
    if (checkoutState.type !== "success") return;
    setPromoBusy(true);
    setPromoMsg(null);
    try {
      const result = await checkoutState.checkout.removePromotionCode();
      if (result.type === "error") {
        setPromoMsg(result.error.message || "Could not remove promotion code.");
      } else {
        setPromoMsg("Promotion code removed.");
      }
    } catch (error: unknown) {
      setPromoMsg(errorMessage(error, "Could not remove promotion code."));
    } finally {
      setPromoBusy(false);
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setPromoMsg(null);

    if (checkoutState.type !== "success") {
      setSubmitError("Checkout is still loading. Try again in a moment.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await checkoutState.checkout.confirm({
        returnUrl,
        redirect: "if_required",
      });

      if (result.type === "error") {
        setSubmitError(result.error.message || "Payment could not be confirmed.");
        return;
      }

      const confirmedSessionId = result.session.id || sessionId;
      window.location.href = `/app/billing/success?session_id=${encodeURIComponent(confirmedSessionId)}`;
    } catch (error: unknown) {
      setSubmitError(errorMessage(error, "Payment could not be confirmed."));
    } finally {
      setSubmitting(false);
    }
  }

  const discountApplied =
    checkoutState.type === "success" &&
    Array.isArray(checkoutState.checkout.discountAmounts) &&
    checkoutState.checkout.discountAmounts.length > 0;

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="border p-4" style={{ borderColor: "var(--border)", borderRadius: 12, background: "var(--card)" }}>
        <div className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>
          PLAN SUMMARY
        </div>
        <div className="mt-2 text-sm">
          {planLabel(plan)} · {billingLabel(billing)}
          {plan === "team" ? ` · ${seats} seats` : ""}
        </div>
      </div>

      <div className="border p-4" style={{ borderColor: "var(--border)", borderRadius: 12 }}>
        <PaymentElement options={{ layout: "tabs" }} />
      </div>

      <div className="border p-4" style={{ borderColor: "var(--border)", borderRadius: 12, background: "var(--card)" }}>
        <label className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>
          PROMOTION CODE
        </label>
        <div className="mt-2 flex gap-2 flex-col md:flex-row">
          <input
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value)}
            placeholder="Enter code"
            className="focus-ring w-full border px-3 py-2 text-sm bg-transparent"
            style={{ borderColor: "var(--border)", borderRadius: 10 }}
          />
          <button
            type="button"
            onClick={() => void applyPromoCode()}
            disabled={promoBusy || checkoutState.type !== "success"}
            className="focus-ring px-4 py-2 text-sm font-semibold disabled:opacity-50"
            style={{ background: "var(--fg)", color: "var(--bg)", borderRadius: 10 }}
          >
            {promoBusy ? "Applying…" : "Apply"}
          </button>
          <button
            type="button"
            onClick={() => void removePromoCode()}
            disabled={promoBusy || checkoutState.type !== "success" || !discountApplied}
            className="focus-ring border px-4 py-2 text-sm font-semibold disabled:opacity-50"
            style={{ borderColor: "var(--border)", borderRadius: 10, color: "var(--muted)" }}
          >
            Remove
          </button>
        </div>
        {promoMsg ? (
          <div className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
            {promoMsg}
          </div>
        ) : null}
      </div>

      {submitError ? (
        <div className="text-sm" style={{ color: "#ff3b30" }}>
          {submitError}
        </div>
      ) : null}

      <div className="flex gap-2 flex-wrap">
        <button
          type="submit"
          disabled={submitting || checkoutState.type !== "success"}
          className="focus-ring px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
          style={{ background: "var(--fg)", color: "var(--bg)", borderRadius: 10 }}
        >
          {submitting ? "Confirming…" : "Confirm subscription"}
        </button>

        <Link
          href="/pricing"
          className="focus-ring inline-flex items-center justify-center border px-5 py-2.5 text-sm font-medium hover:opacity-80"
          style={{ borderColor: "var(--border)", borderRadius: 10, color: "var(--muted)" }}
        >
          Back to pricing
        </Link>
      </div>
    </form>
  );
}

export default function BillingCheckoutPage() {
  const searchParams = useSearchParams();

  const [query, setQuery] = useState<QueryPayload | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [session, setSession] = useState<CheckoutSessionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const parsed = parseQuery(searchParams);
    setQuery(parsed.value);
    setQueryError(parsed.error);
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      if (!query || queryError) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      setSession(null);

      try {
        const res = await fetch("/api/billing/checkout/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(query),
        });
        const json = (await res.json().catch(() => null)) as CheckoutSessionResponse & { error?: string };
        if (!res.ok) {
          throw new Error(json?.error ?? "Could not initialize checkout.");
        }
        if (!json?.clientSecret || !json?.publishableKey || !json?.checkoutSessionId || !json?.returnUrl) {
          throw new Error("Incomplete checkout session response.");
        }
        if (cancelled) return;
        setSession({
          checkoutSessionId: json.checkoutSessionId,
          clientSecret: json.clientSecret,
          publishableKey: json.publishableKey,
          returnUrl: json.returnUrl,
        });
      } catch (e: unknown) {
        if (!cancelled) setError(errorMessage(e, "Could not initialize checkout."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadSession();
    return () => {
      cancelled = true;
    };
  }, [query, queryError]);

  const stripePromise = useMemo(() => {
    if (!session?.publishableKey) return null;
    return loadStripe(session.publishableKey);
  }, [session?.publishableKey]);

  const checkoutOptions = useMemo(() => {
    if (!session?.clientSecret) return null;
    return {
      clientSecret: session.clientSecret,
      elementsOptions: {
        appearance: {
          theme: "night" as const,
          labels: "floating" as const,
        },
      },
    };
  }, [session?.clientSecret]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-8 md:py-10">
      <section
        className="border p-6 md:p-7"
        style={{ borderColor: "var(--border)", background: "var(--card)", borderRadius: 14 }}
      >
        <div className="text-xs tracking-widest" style={{ color: "var(--muted2)" }}>
          BILLING
        </div>
        <h1 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight">Secure checkout</h1>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
          Complete payment without leaving Receipt. Subscription management remains in Stripe&apos;s hosted customer portal.
        </p>

        {queryError ? (
          <div className="mt-4 text-sm" style={{ color: "#ff3b30" }}>
            {queryError}
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 text-sm" style={{ color: "#ff3b30" }}>
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-6 text-sm" style={{ color: "var(--muted)" }}>
            Preparing checkout…
          </div>
        ) : null}

        {!loading && session && query && stripePromise && checkoutOptions ? (
          <div className="mt-6">
            <CheckoutProvider stripe={stripePromise} options={checkoutOptions}>
              <CheckoutForm
                sessionId={session.checkoutSessionId}
                plan={query.plan}
                billing={query.billing}
                seats={query.plan === "team" ? query.seats ?? 2 : 1}
                returnUrl={session.returnUrl}
              />
            </CheckoutProvider>
          </div>
        ) : null}
      </section>
    </main>
  );
}
