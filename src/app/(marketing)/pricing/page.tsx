"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DOCUMENT_LIMITS } from "@/lib/document-limits";

type Billing = "monthly" | "annual";
type PaidPlan = "go" | "pro" | "team" | "standard";

const CHECKOUT_MODE = String(process.env.NEXT_PUBLIC_STRIPE_CHECKOUT_MODE ?? "custom")
  .trim()
  .toLowerCase() === "hosted"
  ? "hosted"
  : "custom";

const TRIAL_DAYS = { monthly: 7, annual: 14 } as const;

const PRICING = {
  go: { monthly: 8, annual: 5 },
  pro: { monthly: 29, annual: 24 },
  team: { monthlyPerSeat: 12, annualPerSeat: 10 },
  standard: { monthlyPerSeat: 25, annualPerSeat: 20 },
} as const;

function formatGBP(amount: number) {
  return `£${amount.toFixed(0)}`;
}

function BillingToggle({
  billing,
  setBilling,
}: {
  billing: Billing;
  setBilling: (value: Billing) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-full border border-[var(--mk-border)] bg-[var(--mk-surface)] p-1 shadow-sm">
      <button
        type="button"
        onClick={() => setBilling("monthly")}
        className={[
          "rounded-full px-4 py-2 text-sm font-semibold transition",
          billing === "monthly"
            ? "marketing-cta-primary"
            : "text-[var(--mk-muted)] hover:bg-[var(--mk-surface-soft)]",
        ].join(" ")}
      >
        Monthly
      </button>
      <button
        type="button"
        onClick={() => setBilling("annual")}
        className={[
          "rounded-full px-4 py-2 text-sm font-semibold transition",
          billing === "annual"
            ? "marketing-cta-primary"
            : "text-[var(--mk-muted)] hover:bg-[var(--mk-surface-soft)]",
        ].join(" ")}
      >
        Annual
      </button>
    </div>
  );
}

function Tick() {
  return (
    <span
      aria-label="Included"
      className="marketing-accent-chip inline-flex h-5 w-5 items-center justify-center rounded-full"
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
        <path
          fillRule="evenodd"
          d="M16.704 5.29a1 1 0 010 1.42l-7.25 7.25a1 1 0 01-1.42 0l-3.25-3.25a1 1 0 011.42-1.42l2.54 2.54 6.54-6.54a1 1 0 011.42 0z"
          clipRule="evenodd"
        />
      </svg>
    </span>
  );
}

function Dash() {
  return <span className="text-xs font-medium text-[var(--mk-muted-2)]">Not included</span>;
}

function PlanCard({
  name,
  description,
  priceLine,
  ctaLabel,
  ctaHref,
  ctaOnClick,
  highlight,
  bullets,
  finePrint,
}: {
  name: string;
  description: string;
  priceLine: React.ReactNode;
  ctaLabel: string;
  ctaHref?: string;
  ctaOnClick?: () => void;
  highlight?: boolean;
  bullets: string[];
  finePrint?: string;
}) {
  return (
    <div
      className={[
        "relative flex h-full flex-col rounded-3xl border bg-[var(--mk-surface)] p-6 shadow-sm",
        highlight
          ? "border-[var(--mk-border-strong)] shadow-[var(--mk-shadow-md)]"
          : "border-[var(--mk-border)]",
      ].join(" ")}
    >
      {highlight ? (
        <div className="marketing-accent-chip absolute -top-3 left-6 rounded-full px-3 py-1 text-xs font-semibold shadow-sm">
          Recommended
        </div>
      ) : null}
      <div>
        <div className="text-sm font-semibold text-[var(--mk-fg)]">{name}</div>
        <div className="mt-1 text-sm leading-relaxed text-[var(--mk-muted)]">{description}</div>
      </div>
      <div className="mt-5">
        <div className="text-3xl font-semibold tracking-tight text-[var(--mk-fg)]">{priceLine}</div>
        {finePrint ? <div className="mt-2 text-xs leading-relaxed text-[var(--mk-muted)]">{finePrint}</div> : null}
      </div>
      <div className="mt-6 space-y-2">
        {bullets.map((bullet) => (
          <div key={bullet} className="flex gap-2 text-sm text-[var(--mk-muted)]">
            <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[var(--mk-muted-2)]" />
            <span className="leading-relaxed">{bullet}</span>
          </div>
        ))}
      </div>
      <div className="mt-auto pt-6">
        {ctaOnClick ? (
          <button
            type="button"
            onClick={ctaOnClick}
            className={[
              "inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-semibold shadow-sm transition",
              highlight
                ? "marketing-cta-primary"
                : "border border-[var(--mk-border)] bg-[var(--mk-surface)] text-[var(--mk-fg)] hover:bg-[var(--mk-surface-soft)]",
            ].join(" ")}
          >
            {ctaLabel}
          </button>
        ) : (
          <a
            href={ctaHref}
            className={[
              "inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-semibold shadow-sm transition",
              highlight
                ? "marketing-cta-primary"
                : "border border-[var(--mk-border)] bg-[var(--mk-surface)] text-[var(--mk-fg)] hover:bg-[var(--mk-surface-soft)]",
            ].join(" ")}
          >
            {ctaLabel}
          </a>
        )}
      </div>
    </div>
  );
}

function priceLabel(amount: number) {
  return (
    <>
      {formatGBP(amount)}
      <span className="text-base font-semibold text-[var(--mk-muted)]">/mo</span>
    </>
  );
}

function planCtaLabel({
  authState,
  loading,
  planLabel,
}: {
  authState: "unknown" | "signed_in" | "signed_out";
  loading: boolean;
  planLabel: string;
}) {
  if (authState === "signed_out") return `Sign up for ${planLabel}`;
  if (loading) return "Redirecting…";
  return `Choose ${planLabel}`;
}

export default function PricingPage() {
  const [billing, setBilling] = useState<Billing>("annual");
  const [teamSeats, setTeamSeats] = useState(5);
  const [standardSeats, setStandardSeats] = useState(5);
  const [checkoutLoading, setCheckoutLoading] = useState<null | PaidPlan>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [authState, setAuthState] = useState<"unknown" | "signed_in" | "signed_out">("unknown");

  useEffect(() => {
    let alive = true;
    async function loadAuthState() {
      try {
        const res = await fetch("/api/app/me", { cache: "no-store" });
        if (!alive) return;
        setAuthState(res.ok ? "signed_in" : "signed_out");
      } catch {
        if (!alive) return;
        setAuthState("signed_out");
      }
    }
    void loadAuthState();
    return () => {
      alive = false;
    };
  }, []);

  async function goCheckout(plan: PaidPlan, seats?: number) {
    setCheckoutError(null);

    if (authState === "signed_out") {
      setCheckoutError("Create an account first to choose a paid plan.");
      const next = `/pricing?plan=${encodeURIComponent(plan)}&billing=${encodeURIComponent(billing)}`;
      window.location.href = `/get-started?next=${encodeURIComponent(next)}`;
      return;
    }

    setCheckoutLoading(plan);
    try {
      if (CHECKOUT_MODE === "custom") {
        const params = new URLSearchParams({
          plan,
          billing,
          source: "pricing",
          return_to: "/pricing",
        });
        if ((plan === "team" || plan === "standard") && seats) params.set("seats", String(seats));
        window.location.href = `/checkout?${params.toString()}`;
        return;
      }

      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          plan,
          billing,
          seats: plan === "team" || plan === "standard" ? seats : undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Checkout failed");
      if (!json?.url) throw new Error("No checkout URL returned");
      window.location.href = json.url;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Something went wrong";
      setCheckoutError(message);
      setCheckoutLoading(null);
    }
  }

  const goPrice = billing === "monthly" ? PRICING.go.monthly : PRICING.go.annual;
  const proPrice = billing === "monthly" ? PRICING.pro.monthly : PRICING.pro.annual;
  const teamPricePerSeat = billing === "monthly" ? PRICING.team.monthlyPerSeat : PRICING.team.annualPerSeat;
  const standardPricePerSeat = billing === "monthly" ? PRICING.standard.monthlyPerSeat : PRICING.standard.annualPerSeat;

  const teamPriceTotal = useMemo(() => teamPricePerSeat * teamSeats, [teamPricePerSeat, teamSeats]);
  const standardPriceTotal = useMemo(
    () => standardPricePerSeat * standardSeats,
    [standardPricePerSeat, standardSeats]
  );

  const standardDocs = DOCUMENT_LIMITS.standardPerSeatPerMonth * standardSeats;

  return (
    <main className="min-h-screen bg-[var(--mk-bg)] text-[var(--mk-fg)]">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 marketing-glow" />
      </div>

      <section className="mx-auto max-w-6xl px-6 pb-8 pt-14">
        <div className="max-w-2xl">
          <div className="text-xs font-semibold tracking-widest text-[var(--mk-muted)]">PRICING</div>
          <h1 className="marketing-hero mt-2 text-4xl sm:text-5xl">
            Personal and business plans.<span className="text-[var(--mk-accent)]"> Clear limits.</span>
          </h1>
          <p className="mt-4 text-base leading-relaxed text-[var(--mk-muted)]">
            Receipt records delivery, access, review activity, and acknowledgement. Choose the plan that
            matches your volume and controls.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <BillingToggle billing={billing} setBilling={setBilling} />
          <div className="text-xs text-[var(--mk-muted)]">
            {billing === "annual"
              ? "Billed annually. Prices shown as effective monthly."
              : "Billed monthly."}{" "}
            Paid plans include a {TRIAL_DAYS[billing]}-day trial.
          </div>
        </div>

        {checkoutError ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <div>{checkoutError}</div>
            {authState === "signed_out" ? (
              <div className="mt-2">
                <Link href="/get-started" className="underline hover:opacity-80">
                  Sign up
                </Link>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-12">
        <div className="mb-4 text-xs font-semibold tracking-widest text-[var(--mk-muted)]">PERSONAL PLANS</div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <PlanCard
            name="Free"
            description="Free forever for low-volume, self-managed sharing."
            priceLine={priceLabel(0)}
            ctaLabel="Start free"
            ctaHref="/get-started"
            bullets={[
              `${DOCUMENT_LIMITS.freeTotalPerUser} documents total cap`,
              "Delivery + access record",
              "Review activity + acknowledgement",
              "No password protection",
              "No email sending",
            ]}
            finePrint="After 10 documents, upgrade to continue creating new receipts."
          />

          <PlanCard
            name="Go"
            description="For individuals who need stronger share controls without inbox sending."
            priceLine={priceLabel(goPrice)}
            ctaLabel={planCtaLabel({ authState, loading: checkoutLoading === "go", planLabel: "Go" })}
            ctaOnClick={() => void goCheckout("go")}
            bullets={[
              `${DOCUMENT_LIMITS.goPerMonth} documents per month`,
              "Password protection",
              "No email sending",
            ]}
            finePrint={
              billing === "annual"
                ? "£5/mo effective, billed annually."
                : "£8/mo billed monthly."
            }
          />

          <PlanCard
            name="Pro"
            description="Keep as-is for higher volume and advanced personal workflows."
            priceLine={priceLabel(proPrice)}
            ctaLabel={planCtaLabel({ authState, loading: checkoutLoading === "pro", planLabel: "Pro" })}
            ctaOnClick={() => void goCheckout("pro")}
            highlight
            bullets={[
              `${DOCUMENT_LIMITS.proPerMonth} documents per month`,
              "Everything in Go",
              "Email sending",
              "Templates and defaults",
              "Saved recipients",
            ]}
            finePrint="Pro features and limits remain unchanged."
          />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-12">
        <div className="mb-4 text-xs font-semibold tracking-widest text-[var(--mk-muted)]">BUSINESS PLANS</div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="flex h-full flex-col rounded-3xl border border-[var(--mk-border)] bg-[var(--mk-surface)] p-6 shadow-sm">
            <div className="text-sm font-semibold text-[var(--mk-fg)]">Team</div>
            <div className="mt-1 text-sm leading-relaxed text-[var(--mk-muted)]">
              Entry business tier with seat pricing and shared templates/contacts.
            </div>
            <div className="mt-5 text-3xl font-semibold tracking-tight text-[var(--mk-fg)]">
              {formatGBP(teamPriceTotal)}
              <span className="text-base font-semibold text-[var(--mk-muted)]">/mo</span>
            </div>
            <div className="mt-2 text-xs text-[var(--mk-muted)]">
              {formatGBP(teamPricePerSeat)} per seat / month ({billing === "annual" ? "billed annually" : "billed monthly"})
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between text-sm">
                <div className="font-semibold text-[var(--mk-fg)]">Seats</div>
                <div className="text-[var(--mk-muted)]">{teamSeats}</div>
              </div>
              <input
                type="range"
                min={2}
                max={50}
                value={teamSeats}
                onChange={(event) => setTeamSeats(Number(event.target.value))}
                className="mt-3 w-full"
              />
            </div>

            <div className="mt-6 space-y-2 text-sm text-[var(--mk-muted)]">
              {["100 documents per month", "Password protection", "No email sending", "Templates", "Contacts", "No department groups"].map(
                (bullet) => (
                  <div key={bullet} className="flex gap-2">
                    <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[var(--mk-muted-2)]" />
                    <span>{bullet}</span>
                  </div>
                )
              )}
            </div>

            <div className="mt-auto pt-6">
              <button
                type="button"
                onClick={() => void goCheckout("team", teamSeats)}
                className="inline-flex w-full items-center justify-center rounded-full marketing-cta-primary px-5 py-3 text-sm font-semibold shadow-sm transition"
              >
                {planCtaLabel({ authState, loading: checkoutLoading === "team", planLabel: "Team" })}
              </button>
            </div>
          </div>

          <div className="flex h-full flex-col rounded-3xl border border-[var(--mk-border-strong)] bg-[var(--mk-surface)] p-6 shadow-[var(--mk-shadow-md)]">
            <div className="marketing-accent-chip absolute hidden rounded-full px-3 py-1 text-xs font-semibold shadow-sm lg:inline-flex">
              Popular business
            </div>
            <div className="text-sm font-semibold text-[var(--mk-fg)]">Standard</div>
            <div className="mt-1 text-sm leading-relaxed text-[var(--mk-muted)]">
              For teams that need compliance reporting, department groups, and bulk sends.
            </div>
            <div className="mt-5 text-3xl font-semibold tracking-tight text-[var(--mk-fg)]">
              {formatGBP(standardPriceTotal)}
              <span className="text-base font-semibold text-[var(--mk-muted)]">/mo</span>
            </div>
            <div className="mt-2 text-xs text-[var(--mk-muted)]">
              {formatGBP(standardPricePerSeat)} per seat / month ({billing === "annual" ? "billed annually" : "billed monthly"})
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between text-sm">
                <div className="font-semibold text-[var(--mk-fg)]">Seats</div>
                <div className="text-[var(--mk-muted)]">{standardSeats}</div>
              </div>
              <input
                type="range"
                min={2}
                max={100}
                value={standardSeats}
                onChange={(event) => setStandardSeats(Number(event.target.value))}
                className="mt-3 w-full"
              />
              <div className="mt-1 text-xs text-[var(--mk-muted)]">Documents included: {standardDocs} per month</div>
            </div>

            <div className="mt-6 space-y-2 text-sm text-[var(--mk-muted)]">
              {[
                "250 documents per seat per month",
                "Compliance reporting",
                "Department groups",
                "Bulk sends",
                "Priority support",
                "Advanced exports",
              ].map((bullet) => (
                <div key={bullet} className="flex gap-2">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[var(--mk-muted-2)]" />
                  <span>{bullet}</span>
                </div>
              ))}
            </div>

            <div className="mt-auto pt-6">
              <button
                type="button"
                onClick={() => void goCheckout("standard", standardSeats)}
                className="inline-flex w-full items-center justify-center rounded-full marketing-cta-primary px-5 py-3 text-sm font-semibold shadow-sm transition"
              >
                {planCtaLabel({ authState, loading: checkoutLoading === "standard", planLabel: "Standard" })}
              </button>
            </div>
          </div>

          <PlanCard
            name="Enterprise"
            description="Enterprise remains custom-scoped and custom-priced."
            priceLine={<span>Custom</span>}
            ctaLabel="Contact sales"
            ctaHref="/enterprise"
            bullets={[
              "Custom volume and security review",
              "Procurement and legal support",
              "Contractual controls",
            ]}
            finePrint="Enterprise: as-is."
          />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-14">
        <div className="max-w-2xl">
          <div className="text-xs font-semibold tracking-widest text-[var(--mk-muted)]">COMPARISON</div>
          <h2 className="marketing-serif mt-2 text-2xl sm:text-3xl">Feature comparison</h2>
        </div>

        <div className="mt-6 overflow-hidden rounded-3xl border border-[var(--mk-border)] bg-[var(--mk-surface)] shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse">
              <thead>
                <tr className="bg-[var(--mk-surface-soft)] text-left text-xs font-semibold text-[var(--mk-muted)]">
                  <th className="px-4 py-4">Feature</th>
                  <th className="px-4 py-4">Free</th>
                  <th className="px-4 py-4">Go</th>
                  <th className="px-4 py-4">Pro</th>
                  <th className="px-4 py-4">Team</th>
                  <th className="px-4 py-4">Standard</th>
                  <th className="px-4 py-4">Enterprise</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                <tr className="border-t border-[var(--mk-border)]">
                  <th className="px-4 py-4 font-medium text-[var(--mk-fg)]">Documents included</th>
                  <td className="px-4 py-4 text-[var(--mk-muted)]">10 total</td>
                  <td className="px-4 py-4 text-[var(--mk-muted)]">50/mo</td>
                  <td className="px-4 py-4 text-[var(--mk-muted)]">500/mo</td>
                  <td className="px-4 py-4 text-[var(--mk-muted)]">100/mo</td>
                  <td className="px-4 py-4 text-[var(--mk-muted)]">250/seat/mo</td>
                  <td className="px-4 py-4 text-[var(--mk-muted)]">Custom</td>
                </tr>
                <tr className="border-t border-[var(--mk-border)]">
                  <th className="px-4 py-4 font-medium text-[var(--mk-fg)]">Password protection</th>
                  <td className="px-4 py-4"><Dash /></td>
                  <td className="px-4 py-4"><Tick /></td>
                  <td className="px-4 py-4"><Tick /></td>
                  <td className="px-4 py-4"><Tick /></td>
                  <td className="px-4 py-4"><Tick /></td>
                  <td className="px-4 py-4"><Tick /></td>
                </tr>
                <tr className="border-t border-[var(--mk-border)]">
                  <th className="px-4 py-4 font-medium text-[var(--mk-fg)]">Email sending</th>
                  <td className="px-4 py-4"><Dash /></td>
                  <td className="px-4 py-4"><Dash /></td>
                  <td className="px-4 py-4"><Tick /></td>
                  <td className="px-4 py-4"><Dash /></td>
                  <td className="px-4 py-4"><Tick /></td>
                  <td className="px-4 py-4"><Tick /></td>
                </tr>
                <tr className="border-t border-[var(--mk-border)]">
                  <th className="px-4 py-4 font-medium text-[var(--mk-fg)]">Templates + contacts</th>
                  <td className="px-4 py-4"><Dash /></td>
                  <td className="px-4 py-4"><Dash /></td>
                  <td className="px-4 py-4"><Tick /></td>
                  <td className="px-4 py-4"><Tick /></td>
                  <td className="px-4 py-4"><Tick /></td>
                  <td className="px-4 py-4"><Tick /></td>
                </tr>
                <tr className="border-t border-[var(--mk-border)]">
                  <th className="px-4 py-4 font-medium text-[var(--mk-fg)]">Department groups</th>
                  <td className="px-4 py-4"><Dash /></td>
                  <td className="px-4 py-4"><Dash /></td>
                  <td className="px-4 py-4"><Dash /></td>
                  <td className="px-4 py-4"><Dash /></td>
                  <td className="px-4 py-4"><Tick /></td>
                  <td className="px-4 py-4"><Tick /></td>
                </tr>
                <tr className="border-t border-[var(--mk-border)]">
                  <th className="px-4 py-4 font-medium text-[var(--mk-fg)]">Compliance reporting</th>
                  <td className="px-4 py-4"><Dash /></td>
                  <td className="px-4 py-4"><Dash /></td>
                  <td className="px-4 py-4"><Dash /></td>
                  <td className="px-4 py-4"><Dash /></td>
                  <td className="px-4 py-4"><Tick /></td>
                  <td className="px-4 py-4"><Tick /></td>
                </tr>
                <tr className="border-t border-[var(--mk-border)]">
                  <th className="px-4 py-4 font-medium text-[var(--mk-fg)]">Bulk sends</th>
                  <td className="px-4 py-4"><Dash /></td>
                  <td className="px-4 py-4"><Dash /></td>
                  <td className="px-4 py-4"><Dash /></td>
                  <td className="px-4 py-4"><Dash /></td>
                  <td className="px-4 py-4"><Tick /></td>
                  <td className="px-4 py-4"><Tick /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}
