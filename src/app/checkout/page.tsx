"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import { CheckoutProvider, PaymentElement, useCheckout } from "@stripe/react-stripe-js/checkout";
import { isSafeInternalPath } from "@/lib/safe-redirect";
import { TermsOfServiceContent } from "@/components/legal/terms-of-service-content";

type CheckoutPlan = "personal" | "pro" | "team";
type Billing = "monthly" | "annual";
type CheckoutSource = "onboarding" | "pricing" | "custom_checkout";

type CheckoutSessionResponse = {
  checkoutSessionId: string;
  clientSecret: string;
  publishableKey: string;
};

type QueryPayload = {
  plan: CheckoutPlan;
  billing: Billing;
  seats?: number;
  source: CheckoutSource;
  returnTo: string;
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

function sourceLabel(source: CheckoutSource) {
  if (source === "onboarding") return "From Recommended Plan";
  if (source === "pricing") return "From Pricing";
  return "From Receipt";
}

function defaultReturnTo() {
  return "/onboarding?step=result";
}

function parseQuery(searchParams: URLSearchParams): { value: QueryPayload | null; error: string | null } {
  const planRaw = String(searchParams.get("plan") ?? "").trim().toLowerCase();
  const billingRaw = String(searchParams.get("billing") ?? "").trim().toLowerCase();
  const sourceRaw = String(searchParams.get("source") ?? "").trim().toLowerCase();
  const returnToRaw = searchParams.get("return_to");

  if (planRaw !== "personal" && planRaw !== "pro" && planRaw !== "team") {
    return { value: null, error: "Invalid plan in checkout request." };
  }

  if (billingRaw !== "monthly" && billingRaw !== "annual") {
    return { value: null, error: "Invalid billing cadence in checkout request." };
  }

  const source: CheckoutSource =
    sourceRaw === "onboarding" || sourceRaw === "pricing" ? sourceRaw : "custom_checkout";
  const returnTo = isSafeInternalPath(returnToRaw) ? returnToRaw : defaultReturnTo();

  const query: QueryPayload = {
    plan: planRaw,
    billing: billingRaw,
    source,
    returnTo,
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
  source,
  onExit,
  onOpenTerms,
}: {
  sessionId: string;
  plan: CheckoutPlan;
  billing: Billing;
  seats: number;
  source: CheckoutSource;
  onExit: () => void;
  onOpenTerms: () => void;
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
      const result = await checkoutState.checkout.confirm();

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
      <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--card2)" }}>
        <div className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>
          SUBSCRIPTION SUMMARY
        </div>
        <div className="mt-2 text-sm font-medium">
          {planLabel(plan)} · {billingLabel(billing)}
          {plan === "team" ? ` · ${seats} seats` : ""}
        </div>
        <div className="mt-1 text-xs" style={{ color: "var(--muted2)" }}>
          {sourceLabel(source)}
        </div>
      </div>

      <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)" }}>
        <PaymentElement options={{ layout: "tabs" }} />
      </div>

      <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--card2)" }}>
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
            style={{ background: "var(--fg)", color: "var(--bg)", borderRadius: 999 }}
          >
            {promoBusy ? "Applying…" : "Apply"}
          </button>
          <button
            type="button"
            onClick={() => void removePromoCode()}
            disabled={promoBusy || checkoutState.type !== "success" || !discountApplied}
            className="focus-ring border px-4 py-2 text-sm font-semibold disabled:opacity-50"
            style={{ borderColor: "var(--border)", borderRadius: 999, color: "var(--muted)" }}
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
          style={{ background: "var(--fg)", color: "var(--bg)", borderRadius: 999 }}
        >
          {submitting ? "Confirming…" : "Confirm subscription"}
        </button>

        <button
          type="button"
          onClick={onExit}
          className="focus-ring inline-flex items-center justify-center border px-5 py-2.5 text-sm font-medium hover:opacity-80"
          style={{ borderColor: "var(--border)", borderRadius: 999, color: "var(--muted)" }}
        >
          Exit checkout
        </button>
      </div>

      <div
        className="rounded-2xl border p-3 text-xs leading-relaxed"
        style={{ borderColor: "var(--border)", background: "var(--card2)", color: "var(--muted)" }}
      >
        By confirming, you agree to Receipt&apos;s{" "}
        <button
          type="button"
          onClick={onOpenTerms}
          className="focus-ring underline underline-offset-2"
          style={{ color: "var(--fg)" }}
        >
          Terms of Service
        </button>
        . Billing is provided by Stripe and encrypted in transit. We do not store payment card details.
      </div>
    </form>
  );
}

export default function BillingCheckoutPage() {
  const router = useRouter();

  const [query, setQuery] = useState<QueryPayload | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [session, setSession] = useState<CheckoutSessionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [termsOpen, setTermsOpen] = useState(false);

  useEffect(() => {
    const parsed = parseQuery(new URLSearchParams(window.location.search));
    setQuery(parsed.value);
    setQueryError(parsed.error);
  }, []);

  const fallbackTarget = useMemo(() => {
    if (query?.returnTo) return query.returnTo;
    return "/onboarding?step=result";
  }, [query?.returnTo]);

  function exitCheckout() {
    router.replace(fallbackTarget);
  }

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
        const body = {
          plan: query.plan,
          billing: query.billing,
          source: query.source,
          seats: query.seats,
        };
        const res = await fetch("/api/billing/checkout/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = (await res.json().catch(() => null)) as CheckoutSessionResponse & { error?: string };
        if (!res.ok) {
          throw new Error(json?.error ?? "Could not initialize checkout.");
        }
        if (!json?.clientSecret || !json?.publishableKey || !json?.checkoutSessionId) {
          throw new Error("Incomplete checkout session response.");
        }
        if (cancelled) return;
        setSession({
          checkoutSessionId: json.checkoutSessionId,
          clientSecret: json.clientSecret,
          publishableKey: json.publishableKey,
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
          theme: "stripe" as const,
          labels: "floating" as const,
        },
      },
    };
  }, [session?.clientSecret]);

  return (
    <main className="app-entry-shell relative min-h-screen overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
      <style>{`
        .checkout-logo { height: 30px; width: auto; display: block; }
        html.dark .checkout-logo { filter: invert(1) hue-rotate(180deg); }
      `}</style>
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(900px circle at -10% -20%, rgba(11,102,212,0.12), transparent 56%)," +
              "radial-gradient(800px circle at 110% -10%, rgba(202,109,29,0.12), transparent 52%)," +
              "linear-gradient(180deg, color-mix(in srgb, var(--card) 98%, var(--bg)) 0%, var(--bg) 100%)",
          }}
        />
      </div>

      <section className="relative mx-auto w-full max-w-6xl">
        <div
          className="overflow-hidden border p-5 shadow-sm md:p-7"
          style={{ borderColor: "var(--border)", background: "var(--card)", borderRadius: 20 }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Image src="/receipt-logo.svg" alt="Receipt" width={104} height={26} className="checkout-logo" priority />
              <div className="h-6 w-px" style={{ background: "var(--border)" }} />
              <div className="text-xs font-semibold tracking-[0.16em]" style={{ color: "var(--muted2)" }}>
                SECURE CHECKOUT
              </div>
            </div>
            <button
              type="button"
              onClick={exitCheckout}
              className="focus-ring inline-flex items-center justify-center rounded-full border px-4 py-2 text-xs font-semibold tracking-wide hover:opacity-85"
              style={{ borderColor: "var(--border)", color: "var(--muted)", background: "var(--card2)" }}
            >
              Exit checkout
            </button>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <aside
              className="border p-5 md:p-6"
              style={{ borderColor: "var(--border)", background: "var(--card2)", borderRadius: 16 }}
            >
              <div className="text-xs tracking-[0.16em]" style={{ color: "var(--muted2)" }}>
                RECEIPT BILLING
              </div>
              <h1 className="mt-3 marketing-serif text-4xl leading-none tracking-tight">Complete payment</h1>

              {query ? (
                <div className="mt-5 rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
                  <div className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>
                    CHOSEN PLAN
                  </div>
                  <div className="mt-2 text-base font-semibold">
                    {planLabel(query.plan)} · {billingLabel(query.billing)}
                    {query.plan === "team" ? ` · ${query.seats ?? 2} seats` : ""}
                  </div>
                  <div className="mt-1 text-xs" style={{ color: "var(--muted2)" }}>
                    {sourceLabel(query.source)}
                  </div>
                </div>
              ) : null}

              <div className="mt-5 text-xs leading-relaxed" style={{ color: "var(--muted2)" }}>
                Need to revise your choice first? Exit checkout to return to your previous recommendation screen.
              </div>
              <div className="mt-4">
                <Link
                  href={fallbackTarget}
                  className="focus-ring inline-flex items-center justify-center rounded-full border px-4 py-2 text-xs font-semibold tracking-wide hover:opacity-85"
                  style={{ borderColor: "var(--border)", color: "var(--muted)" }}
                >
                  Return without paying
                </Link>
              </div>
            </aside>

            <div
              className="border p-5 md:p-6"
              style={{ borderColor: "var(--border)", background: "var(--card)", borderRadius: 16 }}
            >
              {queryError ? (
                <div className="text-sm" style={{ color: "#ff3b30" }}>
                  {queryError}
                </div>
              ) : null}

              {error ? (
                <div className="text-sm" style={{ color: "#ff3b30" }}>
                  {error}
                </div>
              ) : null}

              {loading ? (
                <div className="text-sm" style={{ color: "var(--muted)" }}>
                  Preparing checkout…
                </div>
              ) : null}

              {!loading && session && query && stripePromise && checkoutOptions ? (
                <CheckoutProvider stripe={stripePromise} options={checkoutOptions}>
                  <CheckoutForm
                    sessionId={session.checkoutSessionId}
                    plan={query.plan}
                    billing={query.billing}
                    seats={query.plan === "team" ? query.seats ?? 2 : 1}
                    source={query.source}
                    onExit={exitCheckout}
                    onOpenTerms={() => setTermsOpen(true)}
                  />
                </CheckoutProvider>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {termsOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close terms popup"
            className="absolute inset-0"
            style={{ background: "rgba(0,0,0,0.55)" }}
            onClick={() => setTermsOpen(false)}
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="checkout-terms-title"
            className="relative z-[91] w-full max-w-4xl overflow-hidden border"
            style={{ borderColor: "var(--border)", background: "var(--card)", borderRadius: 18 }}
          >
            <div
              className="flex items-center justify-between border-b px-5 py-4"
              style={{ borderColor: "var(--border)", background: "var(--card2)" }}
            >
              <h2 id="checkout-terms-title" className="text-sm font-semibold">
                Terms of Service
              </h2>
              <button
                type="button"
                onClick={() => setTermsOpen(false)}
                className="focus-ring inline-flex h-8 w-8 items-center justify-center rounded-full border text-lg leading-none hover:opacity-85"
                style={{ borderColor: "var(--border)", color: "var(--muted)", background: "var(--card)" }}
              >
                ×
              </button>
            </div>

            <div className="max-h-[72vh] overflow-y-auto px-5 py-4">
              <div className="marketing-shell bg-transparent">
                <TermsOfServiceContent />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
