"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DOCUMENT_LIMITS } from "@/lib/document-limits";
type Billing = "monthly" | "annual";
const TRIAL_DAYS = { monthly: 7, annual: 14 } as const;
const ANNUAL_DISCOUNT = 0.15;
const DOC_LIMITS = DOCUMENT_LIMITS;
const PRICING = {
  personal: { monthly: 12 },
  pro: { monthly: 29 },
  team: { monthlyPerSeat: 24, annualPerSeat: 20 },
};
function formatGBP(amount: number) {
  return `£${amount.toFixed(0)}`;
}
function priceForBilling(monthly: number, billing: Billing) {
  if (billing === "monthly") return { amount: monthly, suffix: "/mo" };
  const annual = monthly * 12 * (1 - ANNUAL_DISCOUNT);
  return { amount: annual / 12, suffix: "/mo" }; // show effective monthly
}
function BillingToggle({
  billing,
  setBilling,
}: {
  billing: Billing;
  setBilling: (b: Billing) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-full border border-[var(--mk-border)] bg-[var(--mk-surface)] p-1 shadow-sm ">
      <button
        type="button"
        onClick={() => setBilling("monthly")}
        className={[
          "rounded-full px-4 py-2 text-sm font-semibold transition",
          billing === "monthly"
            ? "marketing-cta-primary"
            : "text-[var(--mk-muted)] hover:bg-[var(--mk-surface-soft)] ",
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
            : "text-[var(--mk-muted)] hover:bg-[var(--mk-surface-soft)] ",
        ].join(" ")}
      >
        Annual
        <span className="ml-1 rounded-md border border-[var(--mk-border)] bg-[var(--mk-surface)] px-2 py-0.5 text-[11px] font-semibold text-[var(--mk-muted)] ">
          save {Math.round(ANNUAL_DISCOUNT * 100)}%
        </span>
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
  return (
    <span className="text-xs font-medium text-[var(--mk-muted-2)] ">
      Not included
    </span>
  );
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
        "relative flex h-full flex-col rounded-3xl border bg-[var(--mk-surface)] p-6 shadow-sm ",
        highlight
          ? "border-[var(--mk-border-strong)] shadow-[var(--mk-shadow-md)]"
          : "border-[var(--mk-border)] ",
      ].join(" ")}
    >
      {highlight ? (
        <div className="marketing-accent-chip absolute -top-3 left-6 rounded-full px-3 py-1 text-xs font-semibold shadow-sm">
          Recommended
        </div>
      ) : null}
      <div>
        <div className="text-sm font-semibold text-[var(--mk-fg)]">{name}</div>
        <div className="mt-1 text-sm leading-relaxed text-[var(--mk-muted)]">
          {description}
        </div>
      </div>
      <div className="mt-5">
        <div className="text-3xl font-semibold tracking-tight text-[var(--mk-fg)]">
          {priceLine}
        </div>
        {finePrint ? (
          <div className="mt-2 text-xs leading-relaxed text-[var(--mk-muted)]">
            {finePrint}
          </div>
        ) : null}
      </div>
      <div className="mt-6 space-y-2">
        {bullets.map((b) => (
          <div key={b} className="flex gap-2 text-sm text-[var(--mk-muted)]">
            <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[var(--mk-muted-2)]" />
            <span className="leading-relaxed">{b}</span>
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
                : "border border-[var(--mk-border)] bg-[var(--mk-surface)] text-[var(--mk-fg)] hover:bg-[var(--mk-surface-soft)] ",
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
                : "border border-[var(--mk-border)] bg-[var(--mk-surface)] text-[var(--mk-fg)] hover:bg-[var(--mk-surface-soft)] ",
            ].join(" ")}
          >
            {ctaLabel}
          </a>
        )}
      </div>
    </div>
  );
}
export default function PricingPage() {
  const [billing, setBilling] = useState<Billing>("annual");
  const [seats, setSeats] = useState<number>(5);
  const [checkoutLoading, setCheckoutLoading] = useState<
    null | "personal" | "pro" | "team"
  >(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [authState, setAuthState] = useState<
    "unknown" | "signed_in" | "signed_out"
  >("unknown");
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
    loadAuthState();
    return () => {
      alive = false;
    };
  }, []);
  async function goCheckout(plan: "personal" | "pro" | "team") {
    setCheckoutError(null);
    if (authState === "signed_out") {
      setCheckoutError("Create an account first to choose a paid plan.");
      const next = `/pricing?plan=${encodeURIComponent(plan)}&billing=${encodeURIComponent(billing)}`;
      window.location.href = `/get-started?next=${encodeURIComponent(next)}`;
      return;
    }
    setCheckoutLoading(plan);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          plan,
          billing,
          seats: plan === "team" ? seats : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Checkout failed");
      if (!json?.url) throw new Error("No checkout URL returned");
      window.location.href = json.url;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Something went wrong";
      if (/unauthorized/i.test(message)) {
        const next = `/pricing?plan=${encodeURIComponent(plan)}&billing=${encodeURIComponent(billing)}`;
        setCheckoutError("Create an account first to choose a paid plan.");
        window.location.href = `/get-started?next=${encodeURIComponent(next)}`;
        return;
      }
      setCheckoutError(message);
      setCheckoutLoading(null);
    }
  }
  const personal = useMemo(
    () => priceForBilling(PRICING.personal.monthly, billing),
    [billing],
  );
  const pro = useMemo(
    () => priceForBilling(PRICING.pro.monthly, billing),
    [billing],
  );
  const team = useMemo(() => {
    const perSeat =
      billing === "monthly"
        ? PRICING.team.monthlyPerSeat
        : PRICING.team.annualPerSeat;
    return { total: perSeat * seats, suffix: "/mo" };
  }, [billing, seats]);
  const teamPerSeat = useMemo(() => {
    const amount =
      billing === "monthly"
        ? PRICING.team.monthlyPerSeat
        : PRICING.team.annualPerSeat;
    return { amount, note: "per seat / month" };
  }, [billing]);
  const annualNote =
    billing === "annual"
      ? "Billed annually. Prices shown as effective monthly."
      : "Billed monthly. Switch to annual to save.";
  const teamDocs =
    DOC_LIMITS.teamBasePerMonth + seats * DOC_LIMITS.teamExtraPerSeatPerMonth;
  return (
    <main className="min-h-screen bg-[var(--mk-bg)] text-[var(--mk-fg)]">
      {/* background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 marketing-glow" />
        <div className="absolute inset-0 " />
      </div>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-14 pb-8">
        <div className="max-w-2xl">
          <div className="text-xs font-semibold tracking-widest text-[var(--mk-muted)]">
            PRICING
          </div>
          <h1 className="marketing-hero mt-2 text-4xl sm:text-5xl">
            Simple pricing.<span className="text-[var(--mk-accent)]">{" "}Serious proof.</span>
          </h1>
          <p className="mt-4 text-base leading-relaxed text-[var(--mk-muted)]">
            Receipt records delivery, access, review activity, and
            acknowledgement, while staying intentionally neutral. Choose the
            tier that matches your volume and workflow.
          </p>
        </div>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <BillingToggle billing={billing} setBilling={setBilling} />
          <div className="flex flex-col items-start gap-1 text-xs text-[var(--mk-muted)] sm:items-end">
            <div>{annualNote}</div>
            <div className="inline-flex items-center gap-2">
              <span className="rounded-full border border-[var(--mk-border)] bg-[var(--mk-surface)] px-2 py-0.5 font-semibold text-[var(--mk-muted)] ">
                {billing === "annual"
                  ? `${TRIAL_DAYS.annual}-day free trial`
                  : `${TRIAL_DAYS.monthly}-day free trial`}
              </span>
              <span className="text-[var(--mk-muted)]">Cancel anytime.</span>
            </div>
          </div>
        </div>
        {checkoutError ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 ">
            <div>{checkoutError}</div>
            {authState === "signed_out" ? (
              <div className="mt-2">
                <Link
                  href="/get-started"
                  className="underline hover:opacity-80"
                >
                  Sign up
                </Link>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
      {/* Plans */}
      <section className="mx-auto max-w-6xl px-6 pb-12">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <PlanCard
            name="Free"
            description="For low-volume use and basic sharing."
            priceLine={
              <>
                £0
                <span className="text-base font-semibold text-[var(--mk-muted)]">
                  /mo
                </span>
              </>
            }
            ctaLabel="Start free"
            ctaHref="/get-started"
            bullets={[
              `${DOC_LIMITS.freeTotalPerUser} documents total per user`,
              "Link sharing",
              "Delivery + access record",
              "Review activity (time + scroll)",
              "Acknowledgement + timestamp",
              "Basic exports",
              "No passwords, no email sending",
            ]}
            finePrint="After 10 documents, upgrade to a paid plan to create more."
          />
          <PlanCard
            name="Personal"
            description="For solo professionals with self-managed workflows."
            priceLine={
              <>
                {formatGBP(personal.amount)}
                <span className="text-base font-semibold text-[var(--mk-muted)]">
                  {personal.suffix}
                </span>
              </>
            }
            ctaLabel={
              authState === "signed_out"
                ? "Sign up for Personal"
                : checkoutLoading === "personal"
                  ? "Redirecting…"
                  : "Choose Personal"
            }
            ctaOnClick={() => goCheckout("personal")}
            bullets={[
              `${DOC_LIMITS.personalPerMonth} documents per month`,
              "Password protection",
              "Send via email",
              "Configurable share options",
              "Standard exports",
            ]}
            finePrint={
              billing === "annual"
                ? `${TRIAL_DAYS.annual}-day free trial. Billed annually after trial ends. Resets monthly.`
                : `${TRIAL_DAYS.monthly}-day free trial. Billed monthly after trial ends. Resets monthly.`
            }
          />
          <PlanCard
            name="Pro"
            description="For frequent document workflows and higher volume."
            priceLine={
              <>
                {formatGBP(pro.amount)}
                <span className="text-base font-semibold text-[var(--mk-muted)]">
                  {pro.suffix}
                </span>
              </>
            }
            ctaLabel={
              authState === "signed_out"
                ? "Sign up for Pro"
                : checkoutLoading === "pro"
                  ? "Redirecting…"
                  : "Choose Pro"
            }
            ctaOnClick={() => goCheckout("pro")}
            highlight
            bullets={[
              `${DOC_LIMITS.proPerMonth} documents per month`,
              "Everything in Personal",
              "Saved recipients list",
              "Templates and defaults",
              "Audit-friendly exports",
              "Priority support",
            ]}
            finePrint={
              billing === "annual"
                ? `${TRIAL_DAYS.annual}-day free trial. Billed annually after trial ends.`
                : `${TRIAL_DAYS.monthly}-day free trial. Billed monthly after trial ends.`
            }
          />
          {/* Team (seat-based) */}
          <div className="flex h-full flex-col rounded-3xl border border-[var(--mk-border)] bg-[var(--mk-surface)] p-6 shadow-sm ">
            <div className="text-sm font-semibold text-[var(--mk-fg)]">
              Team
            </div>
            <div className="mt-1 text-sm leading-relaxed text-[var(--mk-muted)]">
              Seat-based pricing with governance, shared defaults, and scalable
              volume.
            </div>
            <div className="mt-5">
              <div className="text-3xl font-semibold tracking-tight text-[var(--mk-fg)]">
                {formatGBP(team.total)}
                <span className="text-base font-semibold text-[var(--mk-muted)]">
                  {team.suffix}
                </span>
              </div>
              <div className="mt-2 text-xs leading-relaxed text-[var(--mk-muted)]">
                <span className="font-semibold text-[var(--mk-muted)]">
                  {billing === "annual"
                    ? `${TRIAL_DAYS.annual}-day free trial`
                    : `${TRIAL_DAYS.monthly}-day free trial`}
                </span>
                •
                {billing === "annual"
                  ? "Billed annually after trial. "
                  : "Billed monthly after trial. "}
                {formatGBP(teamPerSeat.amount)} {teamPerSeat.note}.
              </div>
            </div>
            <div className="mt-6">
              <div className="flex items-center justify-between text-sm">
                <div className="font-semibold text-[var(--mk-fg)]">Seats</div>
                <div className="text-[var(--mk-muted)]">{seats}</div>
              </div>
              <input
                type="range"
                min={2}
                max={50}
                value={seats}
                onChange={(e) => setSeats(Number(e.target.value))}
                className="mt-3 w-full"
              />
              <div className="mt-1 text-xs text-[var(--mk-muted)]">
                Documents included: {teamDocs} per month (workspace)
              </div>
            </div>
            <div className="mt-6 space-y-2">
              {[
                "Everything in Pro",
                "Workspace and admin roles",
                "Shared defaults (sharing and branding)",
                "Team-level export controls",
                "Governance for multi-user workflows",
              ].map((b) => (
                <div
                  key={b}
                  className="flex gap-2 text-sm text-[var(--mk-muted)]"
                >
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[var(--mk-muted-2)]" />
                  <span className="leading-relaxed">{b}</span>
                </div>
              ))}
            </div>
            <div className="mt-auto pt-6">
              <button
                type="button"
                onClick={() => goCheckout("team")}
                disabled={checkoutLoading === "team"}
                className="inline-flex w-full items-center justify-center rounded-full marketing-cta-primary px-5 py-3 text-sm font-semibold shadow-sm transition disabled:opacity-60"
              >
                {authState === "signed_out"
                  ? "Sign up for Team"
                  : checkoutLoading === "team"
                    ? "Redirecting…"
                    : "Choose Team"}
              </button>
            </div>
          </div>
        </div>
        <div className="mt-4 text-xs leading-relaxed text-[var(--mk-muted)]">
          Free trial applies to paid plans only. Your trial starts today, and
          you will be charged when it ends unless you cancel in Stripe.
        </div>
        {/* Enterprise */}
        <div className="mt-6 rounded-3xl border border-[var(--mk-border)] bg-linear-to-b bg-[var(--mk-surface-alt)] p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <div className="text-lg font-semibold tracking-tight">
                Enterprise
              </div>
              <div className="mt-2 text-sm leading-relaxed text-[var(--mk-muted)]">
                Procurement support, bespoke terms, security review, and custom
                governance. We will scope and price this with you.
              </div>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <a
                href="/enterprise"
                className="inline-flex items-center justify-center rounded-full marketing-cta-primary px-6 py-3 text-sm font-semibold shadow-sm"
              >
                Contact sales
              </a>
              <a
                href="/get-started"
                className="inline-flex items-center justify-center rounded-full marketing-cta-secondary px-6 py-3 text-sm font-semibold text-[var(--mk-fg)] shadow-sm hover:bg-[var(--mk-surface-soft)] "
              >
                Try the product
              </a>
            </div>
          </div>
        </div>
      </section>
      {/* Comparison */}
      <section className="mx-auto max-w-6xl px-6 pb-14">
        <div className="max-w-2xl">
          <div className="text-xs font-semibold tracking-widest text-[var(--mk-muted)]">
            COMPARISON
          </div>
          <h2 className="marketing-serif mt-2 text-2xl sm:text-3xl">
            Compare plans
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--mk-muted)]">
            Clear limits and clear capabilities. Receipt records observable
            events and acknowledgement, not intent or understanding.
          </p>
        </div>
        <div className="mt-6 overflow-hidden rounded-3xl border border-[var(--mk-border)] bg-[var(--mk-surface)] shadow-sm ">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse">
              <thead>
                <tr className="bg-[var(--mk-surface-soft)] text-left text-xs font-semibold text-[var(--mk-muted)] ">
                  <th scope="col" className="px-4 py-4">
                    Feature
                  </th>
                  <th scope="col" className="px-4 py-4">
                    Free
                  </th>
                  <th scope="col" className="px-4 py-4">
                    Personal
                  </th>
                  <th scope="col" className="px-4 py-4">
                    Pro
                  </th>
                  <th scope="col" className="px-4 py-4">
                    Team
                  </th>
                </tr>
              </thead>
              <tbody className="text-sm">
                <tr className="border-t border-[var(--mk-border)] ">
                  <th
                    scope="row"
                    className="px-4 py-4 font-medium text-[var(--mk-fg)]"
                  >
                    Documents included
                    <div className="mt-1 text-xs font-normal text-[var(--mk-muted)]">
                      Paid plans reset monthly. Team scales with seats.
                      Enterprise is custom.
                    </div>
                  </th>
                  <td className="px-4 py-4 text-[var(--mk-muted)]">
                    {DOC_LIMITS.freeTotalPerUser} total
                  </td>
                  <td className="px-4 py-4 text-[var(--mk-muted)]">
                    {DOC_LIMITS.personalPerMonth}/mo
                  </td>
                  <td className="px-4 py-4 text-[var(--mk-muted)]">
                    {DOC_LIMITS.proPerMonth}/mo
                  </td>
                  <td className="px-4 py-4 text-[var(--mk-muted)]">
                    {DOC_LIMITS.teamBasePerMonth} +
                    {DOC_LIMITS.teamExtraPerSeatPerMonth}/seat/mo
                  </td>
                </tr>
                <tr className="border-t border-[var(--mk-border)] ">
                  <th
                    scope="row"
                    className="px-4 py-4 font-medium text-[var(--mk-fg)]"
                  >
                    Recipient needs an account
                  </th>
                  <td className="px-4 py-4 text-[var(--mk-muted)]">No</td>
                  <td className="px-4 py-4 text-[var(--mk-muted)]">No</td>
                  <td className="px-4 py-4 text-[var(--mk-muted)]">No</td>
                  <td className="px-4 py-4 text-[var(--mk-muted)]">No</td>
                </tr>
                <tr className="border-t border-[var(--mk-border)] ">
                  <th
                    scope="row"
                    className="px-4 py-4 font-medium text-[var(--mk-fg)]"
                  >
                    Delivery + access record
                  </th>
                  <td className="px-4 py-4">
                    <Tick />
                  </td>
                  <td className="px-4 py-4">
                    <Tick />
                  </td>
                  <td className="px-4 py-4">
                    <Tick />
                  </td>
                  <td className="px-4 py-4">
                    <Tick />
                  </td>
                </tr>
                <tr className="border-t border-[var(--mk-border)] ">
                  <th
                    scope="row"
                    className="px-4 py-4 font-medium text-[var(--mk-fg)]"
                  >
                    Review activity (time + scroll)
                  </th>
                  <td className="px-4 py-4">
                    <Tick />
                  </td>
                  <td className="px-4 py-4">
                    <Tick />
                  </td>
                  <td className="px-4 py-4">
                    <Tick />
                  </td>
                  <td className="px-4 py-4">
                    <Tick />
                  </td>
                </tr>
                <tr className="border-t border-[var(--mk-border)] ">
                  <th
                    scope="row"
                    className="px-4 py-4 font-medium text-[var(--mk-fg)]"
                  >
                    Acknowledgement + timestamp
                  </th>
                  <td className="px-4 py-4">
                    <Tick />
                  </td>
                  <td className="px-4 py-4">
                    <Tick />
                  </td>
                  <td className="px-4 py-4">
                    <Tick />
                  </td>
                  <td className="px-4 py-4">
                    <Tick />
                  </td>
                </tr>
                <tr className="border-t border-[var(--mk-border)] ">
                  <th
                    scope="row"
                    className="px-4 py-4 font-medium text-[var(--mk-fg)]"
                  >
                    Password protection
                  </th>
                  <td className="px-4 py-4">
                    <Dash />
                  </td>
                  <td className="px-4 py-4">
                    <Tick />
                  </td>
                  <td className="px-4 py-4">
                    <Tick />
                  </td>
                  <td className="px-4 py-4">
                    <Tick />
                  </td>
                </tr>
                <tr className="border-t border-[var(--mk-border)] ">
                  <th
                    scope="row"
                    className="px-4 py-4 font-medium text-[var(--mk-fg)]"
                  >
                    Send via email
                  </th>
                  <td className="px-4 py-4">
                    <Dash />
                  </td>
                  <td className="px-4 py-4">
                    <Tick />
                  </td>
                  <td className="px-4 py-4">
                    <Tick />
                  </td>
                  <td className="px-4 py-4">
                    <Tick />
                  </td>
                </tr>
                <tr className="border-t border-[var(--mk-border)] ">
                  <th
                    scope="row"
                    className="px-4 py-4 font-medium text-[var(--mk-fg)]"
                  >
                    Advanced share controls
                  </th>
                  <td className="px-4 py-4">
                    <Dash />
                  </td>
                  <td className="px-4 py-4">
                    <Tick />
                  </td>
                  <td className="px-4 py-4">
                    <Tick />
                  </td>
                  <td className="px-4 py-4">
                    <Tick />
                  </td>
                </tr>
                <tr className="border-t border-[var(--mk-border)] ">
                  <th
                    scope="row"
                    className="px-4 py-4 font-medium text-[var(--mk-fg)]"
                  >
                    Saved recipients
                  </th>
                  <td className="px-4 py-4">
                    <Dash />
                  </td>
                  <td className="px-4 py-4">
                    <Dash />
                  </td>
                  <td className="px-4 py-4">
                    <Tick />
                  </td>
                  <td className="px-4 py-4">
                    <Tick />
                  </td>
                </tr>
                <tr className="border-t border-[var(--mk-border)] ">
                  <th
                    scope="row"
                    className="px-4 py-4 font-medium text-[var(--mk-fg)]"
                  >
                    Templates and defaults
                  </th>
                  <td className="px-4 py-4">
                    <Dash />
                  </td>
                  <td className="px-4 py-4">
                    <Dash />
                  </td>
                  <td className="px-4 py-4">
                    <Tick />
                  </td>
                  <td className="px-4 py-4">
                    <Tick />
                  </td>
                </tr>
                <tr className="border-t border-[var(--mk-border)] ">
                  <th
                    scope="row"
                    className="px-4 py-4 font-medium text-[var(--mk-fg)]"
                  >
                    Team workspace and governance
                  </th>
                  <td className="px-4 py-4">
                    <Dash />
                  </td>
                  <td className="px-4 py-4">
                    <Dash />
                  </td>
                  <td className="px-4 py-4">
                    <Dash />
                  </td>
                  <td className="px-4 py-4">
                    <Tick />
                  </td>
                </tr>
                <tr className="border-t border-[var(--mk-border)] ">
                  <th
                    scope="row"
                    className="px-4 py-4 font-medium text-[var(--mk-fg)]"
                  >
                    Branding
                  </th>
                  <td className="px-4 py-4 text-[var(--mk-muted)]">
                    Default only
                  </td>
                  <td className="px-4 py-4 text-[var(--mk-muted)]">Default</td>
                  <td className="px-4 py-4 text-[var(--mk-muted)]">Default</td>
                  <td className="px-4 py-4 text-[var(--mk-muted)]">
                    Custom branding
                  </td>
                </tr>
                <tr className="border-t border-[var(--mk-border)] ">
                  <th
                    scope="row"
                    className="px-4 py-4 font-medium text-[var(--mk-fg)]"
                  >
                    Exports
                  </th>
                  <td className="px-4 py-4 text-[var(--mk-muted)]">Basic</td>
                  <td className="px-4 py-4 text-[var(--mk-muted)]">Standard</td>
                  <td className="px-4 py-4 text-[var(--mk-muted)]">Advanced</td>
                  <td className="px-4 py-4 text-[var(--mk-muted)]">
                    Advanced with admin controls
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div className="mt-4 text-xs leading-relaxed text-[var(--mk-muted)]">
          Limits above are included usage. If you need higher volume, add seats
          on Team or contact{" "}
          <a href="/enterprise" className="underline hover:opacity-80">
            Enterprise
          </a>
          .
        </div>
      </section>
    </main>
  );
}
