"use client";

import { useMemo, useState } from "react";
import { DOCUMENT_LIMITS } from "@/lib/document-limits";

type Billing = "monthly" | "annual";


const TRIAL_DAYS = {
  monthly: 7,
  annual: 14,
} as const;
const ANNUAL_DISCOUNT = 0.15;

const DOC_LIMITS = DOCUMENT_LIMITS;

const PRICING = {
  personal: { monthly: 12 },
  pro: { monthly: 29 },
  team: { monthlyPerSeat: 24 },
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
    <div className="inline-flex items-center rounded-full border border-zinc-200 bg-white p-1 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <button
        type="button"
        onClick={() => setBilling("monthly")}
        className={[
          "rounded-full px-4 py-2 text-sm font-semibold transition",
          billing === "monthly"
            ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950"
            : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900",
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
            ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950"
            : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900",
        ].join(" ")}
      >
        Annual{" "}
        <span className="ml-1 rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
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
      className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-950"
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
    <span className="text-xs font-medium text-zinc-400 dark:text-zinc-600">
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
        "relative flex h-full flex-col rounded-3xl border bg-white p-6 shadow-sm dark:bg-zinc-950",
        highlight
          ? "border-zinc-900 shadow-lg dark:border-white"
          : "border-zinc-200 dark:border-zinc-800",
      ].join(" ")}
    >
      {highlight ? (
        <div className="absolute -top-3 left-6 rounded-full bg-zinc-900 px-3 py-1 text-xs font-semibold text-white shadow-sm dark:bg-white dark:text-zinc-950">
          Recommended
        </div>
      ) : null}

      <div>
        <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {name}
        </div>
        <div className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          {description}
        </div>
      </div>

      <div className="mt-5">
        <div className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          {priceLine}
        </div>
        {finePrint ? (
          <div className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-500">
            {finePrint}
          </div>
        ) : null}
      </div>

      <div className="mt-6 space-y-2">
        {bullets.map((b) => (
          <div
            key={b}
            className="flex gap-2 text-sm text-zinc-700 dark:text-zinc-300"
          >
            <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-zinc-400 dark:bg-zinc-600" />
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
            ? "bg-zinc-900 text-white hover:opacity-90 dark:bg-white dark:text-zinc-950"
            : "border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900/50",
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
            ? "bg-zinc-900 text-white hover:opacity-90 dark:bg-white dark:text-zinc-950"
            : "border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900/50",
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
  const [checkoutLoading, setCheckoutLoading] = useState<null | "personal" | "pro" | "team">(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  async function goCheckout(plan: "personal" | "pro" | "team") {
    setCheckoutError(null);
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
    } catch (e: any) {
      setCheckoutError(e?.message ?? "Something went wrong");
      setCheckoutLoading(null);
    }
  }

  const personal = useMemo(
    () => priceForBilling(PRICING.personal.monthly, billing),
    [billing]
  );
  const pro = useMemo(
    () => priceForBilling(PRICING.pro.monthly, billing),
    [billing]
  );

  const team = useMemo(() => {
    const perSeat = PRICING.team.monthlyPerSeat;
    const monthlyTotal = perSeat * seats;
    if (billing === "monthly") return { total: monthlyTotal, suffix: "/mo" };
    const annualTotal = monthlyTotal * 12 * (1 - ANNUAL_DISCOUNT);
    return { total: annualTotal / 12, suffix: "/mo" };
  }, [billing, seats]);

  const teamPerSeat = useMemo(() => {
    const m = PRICING.team.monthlyPerSeat;
    if (billing === "monthly") return { amount: m, note: "per seat / month" };
    const effective = m * (1 - ANNUAL_DISCOUNT);
    return { amount: effective, note: "per seat / month" };
  }, [billing]);

  const annualNote =
    billing === "annual"
      ? "Billed annually. Prices shown as effective monthly."
      : "Billed monthly. Switch to annual to save.";

  const teamDocs =
    DOC_LIMITS.teamBasePerMonth + seats * DOC_LIMITS.teamExtraPerSeatPerMonth;

  return (
    <main className="min-h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_20%_-10%,rgba(0,0,0,0.06),transparent_55%)] dark:bg-[radial-gradient(1200px_circle_at_20%_-10%,rgba(255,255,255,0.08),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_90%_0%,rgba(0,0,0,0.04),transparent_55%)] dark:bg-[radial-gradient(900px_circle_at_90%_0%,rgba(255,255,255,0.06),transparent_55%)]" />
      </div>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-14 pb-8">
        <div className="max-w-2xl">
          <div className="text-xs font-semibold tracking-widest text-zinc-500 dark:text-zinc-500">
            PRICING
          </div>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
            Simple pricing. Serious proof.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
            Receipt records delivery, access, review activity, and acknowledgement, while staying
            intentionally neutral. Choose the tier that matches your volume and workflow.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <BillingToggle billing={billing} setBilling={setBilling} />

          <div className="flex flex-col items-start gap-1 text-xs text-zinc-500 dark:text-zinc-500 sm:items-end">
            <div>{annualNote}</div>
            <div className="inline-flex items-center gap-2">
              <span className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 font-semibold text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                {billing === "annual" ? `${TRIAL_DAYS.annual}-day free trial` : `${TRIAL_DAYS.monthly}-day free trial`}
              </span>
              <span className="text-zinc-500 dark:text-zinc-500">Cancel anytime.</span>
            </div>
          </div>
        </div>
        {checkoutError ? (
          <div className="mt-3 text-sm text-red-600 dark:text-red-400">
            {checkoutError}
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
                £0{" "}
                <span className="text-base font-semibold text-zinc-500 dark:text-zinc-500">
                  /mo
                </span>
              </>
            }
            ctaLabel="Start free"
            ctaHref="/app"
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
                {formatGBP(personal.amount)}{" "}
                <span className="text-base font-semibold text-zinc-500 dark:text-zinc-500">
                  {personal.suffix}
                </span>
              </>
            }
            ctaLabel={checkoutLoading === "personal" ? "Redirecting…" : "Choose Personal"}
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
                {formatGBP(pro.amount)}{" "}
                <span className="text-base font-semibold text-zinc-500 dark:text-zinc-500">
                  {pro.suffix}
                </span>
              </>
            }
            ctaLabel={checkoutLoading === "pro" ? "Redirecting…" : "Choose Pro"}
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
          <div className="flex h-full flex-col rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Team
            </div>
            <div className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Seat-based pricing with governance, shared defaults, and scalable volume.
            </div>

            <div className="mt-5">
              <div className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                {formatGBP(team.total)}{" "}
                <span className="text-base font-semibold text-zinc-500 dark:text-zinc-500">
                  {team.suffix}
                </span>
              </div>
            <div className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-500">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                {billing === "annual" ? `${TRIAL_DAYS.annual}-day free trial` : `${TRIAL_DAYS.monthly}-day free trial`}
              </span>
              {" "}
              • {billing === "annual" ? "Billed annually after trial. " : "Billed monthly after trial. "}
              {formatGBP(teamPerSeat.amount)} {teamPerSeat.note}.
            </div>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between text-sm">
                <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                  Seats
                </div>
                <div className="text-zinc-600 dark:text-zinc-400">{seats}</div>
              </div>
              <input
                type="range"
                min={2}
                max={50}
                value={seats}
                onChange={(e) => setSeats(Number(e.target.value))}
                className="mt-3 w-full"
              />
              <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
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
                  className="flex gap-2 text-sm text-zinc-700 dark:text-zinc-300"
                >
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-zinc-400 dark:bg-zinc-600" />
                  <span className="leading-relaxed">{b}</span>
                </div>
              ))}
            </div>

            <div className="mt-auto pt-6">
              <button
                type="button"
                onClick={() => goCheckout("team")}
                disabled={checkoutLoading === "team"}
                className="inline-flex w-full items-center justify-center rounded-full bg-zinc-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60 dark:bg-white dark:text-zinc-950"
              >
                {checkoutLoading === "team" ? "Redirecting…" : "Choose Team"}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 text-xs leading-relaxed text-zinc-500 dark:text-zinc-500">
          Free trial applies to paid plans only. Your trial starts today, and you will be charged
          when it ends unless you cancel in Stripe.
        </div>

        {/* Enterprise */}
        <div className="mt-6 rounded-3xl border border-zinc-200 bg-linear-to-b from-white to-zinc-50 p-6 shadow-sm dark:border-zinc-800 dark:from-zinc-950 dark:to-zinc-900/30 md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <div className="text-lg font-semibold tracking-tight">Enterprise</div>
              <div className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Procurement support, bespoke terms, security review, and custom governance. We will
                scope and price this with you.
              </div>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <a
                href="/enterprise"
                className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90 dark:bg-white dark:text-zinc-950"
              >
                Contact sales
              </a>
              <a
                href="/app"
                className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white px-6 py-3 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900/50"
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
          <div className="text-xs font-semibold tracking-widest text-zinc-500 dark:text-zinc-500">
            COMPARISON
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Compare plans
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            Clear limits and clear capabilities. Receipt records observable events and
            acknowledgement, not intent or understanding.
          </p>
        </div>

        <div className="mt-6 overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="overflow-x-auto">
            <table className="w-full min-w-215 border-collapse">
              <thead>
                <tr className="bg-zinc-50 text-left text-xs font-semibold text-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300">
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
                <tr className="border-t border-zinc-200 dark:border-zinc-800">
                  <th
                    scope="row"
                    className="px-4 py-4 font-medium text-zinc-900 dark:text-zinc-100"
                  >
                    Documents included
                    <div className="mt-1 text-xs font-normal text-zinc-500 dark:text-zinc-500">
                      Paid plans reset monthly. Team scales with seats. Enterprise is custom.
                    </div>
                  </th>
                  <td className="px-4 py-4 text-zinc-700 dark:text-zinc-300">
                    {DOC_LIMITS.freeTotalPerUser} total
                  </td>
                  <td className="px-4 py-4 text-zinc-700 dark:text-zinc-300">
                    {DOC_LIMITS.personalPerMonth}/mo
                  </td>
                  <td className="px-4 py-4 text-zinc-700 dark:text-zinc-300">
                    {DOC_LIMITS.proPerMonth}/mo
                  </td>
                  <td className="px-4 py-4 text-zinc-700 dark:text-zinc-300">
                    {DOC_LIMITS.teamBasePerMonth} + {DOC_LIMITS.teamExtraPerSeatPerMonth}/seat/mo
                  </td>
                </tr>

                <tr className="border-t border-zinc-200 dark:border-zinc-800">
                  <th scope="row" className="px-4 py-4 font-medium text-zinc-900 dark:text-zinc-100">
                    Recipient needs an account
                  </th>
                  <td className="px-4 py-4 text-zinc-700 dark:text-zinc-300">No</td>
                  <td className="px-4 py-4 text-zinc-700 dark:text-zinc-300">No</td>
                  <td className="px-4 py-4 text-zinc-700 dark:text-zinc-300">No</td>
                  <td className="px-4 py-4 text-zinc-700 dark:text-zinc-300">No</td>
                </tr>

                <tr className="border-t border-zinc-200 dark:border-zinc-800">
                  <th scope="row" className="px-4 py-4 font-medium text-zinc-900 dark:text-zinc-100">
                    Delivery + access record
                  </th>
                  <td className="px-4 py-4"><Tick /></td>
                  <td className="px-4 py-4"><Tick /></td>
                  <td className="px-4 py-4"><Tick /></td>
                  <td className="px-4 py-4"><Tick /></td>
                </tr>

                <tr className="border-t border-zinc-200 dark:border-zinc-800">
                  <th scope="row" className="px-4 py-4 font-medium text-zinc-900 dark:text-zinc-100">
                    Review activity (time + scroll)
                  </th>
                  <td className="px-4 py-4"><Tick /></td>
                  <td className="px-4 py-4"><Tick /></td>
                  <td className="px-4 py-4"><Tick /></td>
                  <td className="px-4 py-4"><Tick /></td>
                </tr>

                <tr className="border-t border-zinc-200 dark:border-zinc-800">
                  <th scope="row" className="px-4 py-4 font-medium text-zinc-900 dark:text-zinc-100">
                    Acknowledgement + timestamp
                  </th>
                  <td className="px-4 py-4"><Tick /></td>
                  <td className="px-4 py-4"><Tick /></td>
                  <td className="px-4 py-4"><Tick /></td>
                  <td className="px-4 py-4"><Tick /></td>
                </tr>

                <tr className="border-t border-zinc-200 dark:border-zinc-800">
                  <th scope="row" className="px-4 py-4 font-medium text-zinc-900 dark:text-zinc-100">
                    Password protection
                  </th>
                  <td className="px-4 py-4"><Dash /></td>
                  <td className="px-4 py-4"><Tick /></td>
                  <td className="px-4 py-4"><Tick /></td>
                  <td className="px-4 py-4"><Tick /></td>
                </tr>

                <tr className="border-t border-zinc-200 dark:border-zinc-800">
                  <th scope="row" className="px-4 py-4 font-medium text-zinc-900 dark:text-zinc-100">
                    Send via email
                  </th>
                  <td className="px-4 py-4"><Dash /></td>
                  <td className="px-4 py-4"><Tick /></td>
                  <td className="px-4 py-4"><Tick /></td>
                  <td className="px-4 py-4"><Tick /></td>
                </tr>

                <tr className="border-t border-zinc-200 dark:border-zinc-800">
                  <th scope="row" className="px-4 py-4 font-medium text-zinc-900 dark:text-zinc-100">
                    Advanced share controls
                  </th>
                  <td className="px-4 py-4"><Dash /></td>
                  <td className="px-4 py-4"><Tick /></td>
                  <td className="px-4 py-4"><Tick /></td>
                  <td className="px-4 py-4"><Tick /></td>
                </tr>

                <tr className="border-t border-zinc-200 dark:border-zinc-800">
                  <th scope="row" className="px-4 py-4 font-medium text-zinc-900 dark:text-zinc-100">
                    Saved recipients
                  </th>
                  <td className="px-4 py-4"><Dash /></td>
                  <td className="px-4 py-4"><Dash /></td>
                  <td className="px-4 py-4"><Tick /></td>
                  <td className="px-4 py-4"><Tick /></td>
                </tr>

                <tr className="border-t border-zinc-200 dark:border-zinc-800">
                  <th scope="row" className="px-4 py-4 font-medium text-zinc-900 dark:text-zinc-100">
                    Templates and defaults
                  </th>
                  <td className="px-4 py-4"><Dash /></td>
                  <td className="px-4 py-4"><Dash /></td>
                  <td className="px-4 py-4"><Tick /></td>
                  <td className="px-4 py-4"><Tick /></td>
                </tr>

                <tr className="border-t border-zinc-200 dark:border-zinc-800">
                  <th scope="row" className="px-4 py-4 font-medium text-zinc-900 dark:text-zinc-100">
                    Team workspace and governance
                  </th>
                  <td className="px-4 py-4"><Dash /></td>
                  <td className="px-4 py-4"><Dash /></td>
                  <td className="px-4 py-4"><Dash /></td>
                  <td className="px-4 py-4"><Tick /></td>
                </tr>

                <tr className="border-t border-zinc-200 dark:border-zinc-800">
                  <th scope="row" className="px-4 py-4 font-medium text-zinc-900 dark:text-zinc-100">
                    Branding
                  </th>
                  <td className="px-4 py-4 text-zinc-700 dark:text-zinc-300">
                    Default only
                  </td>
                  <td className="px-4 py-4 text-zinc-700 dark:text-zinc-300">
                    Default
                  </td>
                  <td className="px-4 py-4 text-zinc-700 dark:text-zinc-300">
                    Default
                  </td>
                  <td className="px-4 py-4 text-zinc-700 dark:text-zinc-300">
                    Custom branding
                  </td>
                </tr>

                <tr className="border-t border-zinc-200 dark:border-zinc-800">
                  <th scope="row" className="px-4 py-4 font-medium text-zinc-900 dark:text-zinc-100">
                    Exports
                  </th>
                  <td className="px-4 py-4 text-zinc-700 dark:text-zinc-300">
                    Basic
                  </td>
                  <td className="px-4 py-4 text-zinc-700 dark:text-zinc-300">
                    Standard
                  </td>
                  <td className="px-4 py-4 text-zinc-700 dark:text-zinc-300">
                    Advanced
                  </td>
                  <td className="px-4 py-4 text-zinc-700 dark:text-zinc-300">
                    Advanced with admin controls
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 text-xs leading-relaxed text-zinc-500 dark:text-zinc-500">
          Limits above are included usage. If you need higher volume, add seats on Team or contact{" "}
          <a href="/enterprise" className="underline hover:opacity-80">
            Enterprise
          </a>
          .
        </div>
      </section>
    </main>
  );
}
