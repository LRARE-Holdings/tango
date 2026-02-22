"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type UsageIntent = "personal" | "professional" | "team" | "unsure";
type Frequency = "occasionally" | "weekly" | "daily" | "unsure";
type TeamSize = "solo" | "2-5" | "6-20" | "20+" | "unsure";
type ReferralType =
  | "colleague"
  | "workplace"
  | "linkedin"
  | "twitter"
  | "google"
  | "other"
  | "unknown";

type NeedKey =
  | "prove_opened"
  | "acknowledgement"
  | "limit_acknowledgements"
  | "send_email"
  | "passwords"
  | "audit_records"
  | "team_sharing"
  | "templates_defaults";

type RecommendedPlan = "free" | "personal" | "pro" | "team" | "enterprise";
type Billing = "monthly" | "annual";
const CHECKOUT_MODE = String(process.env.NEXT_PUBLIC_STRIPE_CHECKOUT_MODE ?? "custom")
  .trim()
  .toLowerCase() === "hosted"
  ? "hosted"
  : "custom";
const ONBOARDING_STATE_KEY = "receipt:onboarding:state:v1";
const TRIAL_DAYS: Record<Billing, number> = { monthly: 7, annual: 14 };

const INTENT_LABEL: Record<UsageIntent, string> = {
  personal: "Personal usage",
  professional: "Professional usage",
  team: "Team usage",
  unsure: "Intent not decided",
};

const FREQUENCY_LABEL: Record<Frequency, string> = {
  occasionally: "Occasional cadence",
  weekly: "Weekly cadence",
  daily: "Daily cadence",
  unsure: "Cadence not decided",
};

const TEAM_SIZE_LABEL: Record<TeamSize, string> = {
  solo: "Solo access",
  "2-5": "Small team (2-5)",
  "6-20": "Growing team (6-20)",
  "20+": "Large team (20+)",
  unsure: "Team size not decided",
};

const NEED_LABEL: Record<NeedKey, string> = {
  prove_opened: "Proof of opened docs",
  acknowledgement: "Acknowledgement capture",
  limit_acknowledgements: "Controlled acknowledgements",
  send_email: "Email sending",
  passwords: "Password-protected links",
  audit_records: "Audit-ready records",
  team_sharing: "Team sharing",
  templates_defaults: "Templates and defaults",
};

const PLAN_BRAND: Record<
  RecommendedPlan,
  {
    title: string;
    strap: string;
    summary: string;
    accent: string;
    accentSoft: string;
  }
> = {
  free: {
    title: "Free",
    strap: "Lean start",
    summary: "Best when you want to validate your workflow first and upgrade later.",
    accent: "#5f6673",
    accentSoft: "rgba(95, 102, 115, 0.16)",
  },
  personal: {
    title: "Personal",
    strap: "Individual power",
    summary: "Built for solo workflows that still need stronger delivery and sharing controls.",
    accent: "#1f8f5f",
    accentSoft: "rgba(31, 143, 95, 0.14)",
  },
  pro: {
    title: "Pro",
    strap: "Operator mode",
    summary: "Designed for frequent professional work with cleaner controls and defaults.",
    accent: "#0b66d4",
    accentSoft: "rgba(11, 102, 212, 0.14)",
  },
  team: {
    title: "Team",
    strap: "Shared operating model",
    summary: "The right fit for multi-seat access, shared workflows, and central control.",
    accent: "#ca6d1d",
    accentSoft: "rgba(202, 109, 29, 0.16)",
  },
  enterprise: {
    title: "Enterprise",
    strap: "Governance first",
    summary: "For procurement, policy controls, and organization-wide governance requirements.",
    accent: "#1f2937",
    accentSoft: "rgba(31, 41, 55, 0.14)",
  },
};

type Answers = {
  intent: UsageIntent | null;
  needs: NeedKey[];
  frequency: Frequency | null;
  teamSize: TeamSize | null;
  referralType: ReferralType | null;
  referralDetail: string; // optional free text
};

const STEPS = [
  { key: "intent", title: "How will you use Receipt?" },
  { key: "needs", title: "What do you need it to do?" },
  { key: "frequency", title: "How often will you use it?" },
  { key: "team", title: "Will anyone else need access?" },
  { key: "referral", title: "How did you hear about us?" },
  { key: "result", title: "Recommended plan" },
] as const;

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function computeRecommendation(a: Answers): {
  plan: RecommendedPlan;
  why: string[];
} {
  const needs = new Set(a.needs);

  const wantsTeam =
    a.intent === "team" ||
    a.teamSize === "2-5" ||
    a.teamSize === "6-20" ||
    a.teamSize === "20+" ||
    needs.has("team_sharing");

  const wantsProFeatures =
    needs.has("templates_defaults") ||
    needs.has("limit_acknowledgements") ||
    needs.has("audit_records");

  const wantsPersonalFeatures = needs.has("passwords") || needs.has("send_email");

  const frequent = a.frequency === "weekly" || a.frequency === "daily";

  // Opinionated mapping:
  if (wantsTeam) {
    return {
      plan: "team",
      why: [
        "Multiple seats and shared access",
        "Team-friendly controls and shared defaults",
        "Designed for organisations (not just one-off sending)",
      ],
    };
  }

  if (a.intent === "professional" && (frequent || wantsProFeatures)) {
    return {
      plan: "pro",
      why: [
        "Best for regular professional use",
        "Includes higher-volume workflows + stronger defaults",
        "Keeps output clean and audit-ready",
      ],
    };
  }

  if (wantsPersonalFeatures || a.intent === "personal") {
    return {
      plan: "personal",
      why: [
        "Ideal for individual use with extra sharing controls",
        "Adds passwords and email sending",
        "A clean upgrade without team complexity",
      ],
    };
  }

  // Default: Free
  return {
    plan: "free",
    why: [
      "Perfect to try Receipt with light usage",
      "Includes delivery + access + acknowledgement basics",
      "Upgrade only when you need advanced sharing",
    ],
  };
}

async function saveOnboarding(payload: {
  answers: Answers;
  recommended_plan: RecommendedPlan;
}) {
  // Optional API route below (recommended)
  const res = await fetch("/api/app/onboarding", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.error ?? "Failed to save onboarding");
  }
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function OnboardingPage() {
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [billing, setBilling] = useState<Billing>("annual");
  const [seats, setSeats] = useState<number>(5);

  const [answers, setAnswers] = useState<Answers>({
    intent: null,
    needs: [],
    frequency: null,
    teamSize: null,
    referralType: null,
    referralDetail: "",
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("step") !== "result") return;

    try {
      const raw = window.sessionStorage.getItem(ONBOARDING_STATE_KEY);
      if (!raw) {
        setStep(STEPS.length - 1);
        return;
      }

      const parsed = JSON.parse(raw) as Partial<{
        step: number;
        billing: Billing;
        seats: number;
        answers: Answers;
      }>;

      if (parsed.answers && typeof parsed.answers === "object") {
        setAnswers(parsed.answers);
      }

      if (parsed.billing === "monthly" || parsed.billing === "annual") {
        setBilling(parsed.billing);
      }

      if (typeof parsed.seats === "number" && Number.isFinite(parsed.seats)) {
        setSeats(Math.max(2, Math.min(50, Math.floor(parsed.seats))));
      }

      setStep(STEPS.length - 1);
    } catch {
      setStep(STEPS.length - 1);
    }
  }, []);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        ONBOARDING_STATE_KEY,
        JSON.stringify({
          step,
          billing,
          seats,
          answers,
        })
      );
    } catch {
      // ignore storage write errors
    }
  }, [answers, billing, seats, step]);

  const progress = Math.round(((step + 1) / STEPS.length) * 100);
  const recommendation = useMemo(() => computeRecommendation(answers), [answers]);
  const recommendationBrand = PLAN_BRAND[recommendation.plan];
  const paidRecommendation =
    recommendation.plan !== "free" && recommendation.plan !== "enterprise";
  const decisionSignals = [
    answers.intent ? INTENT_LABEL[answers.intent] : null,
    answers.frequency ? FREQUENCY_LABEL[answers.frequency] : null,
    answers.teamSize ? TEAM_SIZE_LABEL[answers.teamSize] : null,
  ].filter(Boolean) as string[];
  const requestedNeeds = answers.needs.slice(0, 4).map((need) => NEED_LABEL[need]);

  function next() {
    setError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function back() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  function require<T>(value: T | null, msg: string) {
    if (value == null) {
      setError(msg);
      return false;
    }
    return true;
  }

  function toggleNeed(need: NeedKey) {
    setAnswers((a) => {
      const has = a.needs.includes(need);
      return { ...a, needs: has ? a.needs.filter((n) => n !== need) : [...a.needs, need] };
    });
  }

  async function startCheckout(plan: RecommendedPlan) {
    // Free goes straight in.
    if (plan === "free") {
      router.replace("/app");
      return;
    }

    // Enterprise routes to contact.
    if (plan === "enterprise") {
      router.replace("/enterprise");
      return;
    }

    const body: { plan: RecommendedPlan; billing: Billing; seats?: number } = {
      plan,
      billing,
    };

    // Only Team uses seats.
    if (plan === "team") body.seats = seats;

    if (CHECKOUT_MODE === "custom") {
      try {
        window.sessionStorage.setItem(
          ONBOARDING_STATE_KEY,
          JSON.stringify({
            step: STEPS.length - 1,
            billing,
            seats,
            answers,
          })
        );
      } catch {
        // ignore storage write errors
      }

      const params = new URLSearchParams({
        plan,
        billing,
        source: "onboarding",
        return_to: "/onboarding?step=result",
      });
      if (plan === "team") params.set("seats", String(seats));
      router.replace(`/checkout?${params.toString()}`);
      return;
    }

    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.error ?? "Could not start checkout");
    if (!json?.url) throw new Error("No checkout URL returned");

    window.location.href = json.url;
  }

  async function finish(planOverride?: RecommendedPlan) {
    setSubmitting(true);
    setError(null);
    try {
      const selectedPlan = planOverride ?? recommendation.plan;

      await saveOnboarding({
        answers,
        // Store what the user actually chose (override if they picked free)
        recommended_plan: selectedPlan,
      });

      // After onboarding, send them into the correct purchase flow.
      await startCheckout(selectedPlan);
    } catch (error: unknown) {
      setError(errorMessage(error, "Something went wrong"));
    } finally {
      setSubmitting(false);
    }
  }

  async function chooseFreeForNow() {
    await finish("free");
  }

  // Validation per step
  function onContinue() {
    switch (STEPS[step].key) {
      case "intent":
        if (!require(answers.intent, "Select one option to continue.")) return;
        next();
        return;

      case "needs":
        // Needs can be empty, some users won’t know yet
        next();
        return;

      case "frequency":
        if (!require(answers.frequency, "Select one option to continue.")) return;
        next();
        return;

      case "team":
        if (!require(answers.teamSize, "Select one option to continue.")) return;
        next();
        return;

      case "referral":
        // referral can be empty
        next();
        return;

      case "result":
        void finish();
        return;

      default:
        next();
        return;
    }
  }

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto w-full max-w-2xl">
        {/* Top */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs tracking-widest" style={{ color: "var(--muted2)" }}>
              ONBOARDING
            </div>
            <h1 className="marketing-serif mt-2 text-4xl md:text-5xl tracking-tight">
              Let’s set you up properly.
            </h1>
            <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
              A couple of quick questions, then we’ll recommend the right plan.
            </p>
          </div>
        </div>

        {/* Progress */}
        <div className="mt-8">
          <div className="flex items-center justify-between text-xs" style={{ color: "var(--muted2)" }}>
            <span>
              Step {step + 1} of {STEPS.length}
            </span>
            <span>{progress}%</span>
          </div>
          <div
            className="mt-2 h-2 w-full overflow-hidden rounded-full"
            style={{ background: "var(--card2)" }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progress}%`, background: "var(--fg)" }}
            />
          </div>
        </div>

        {/* Card */}
        <div
          className="mt-8 border p-6 md:p-8"
          style={{ borderColor: "var(--border)", background: "var(--card)", borderRadius: 18 }}
        >
          <div className="flex items-start justify-between gap-6">
            <h2 className="marketing-serif text-3xl tracking-tight">{STEPS[step].title}</h2>
            <div className="text-xs" style={{ color: "var(--muted2)" }}>
              {STEPS[step].key !== "result" ? "In Progress" : "Done"}
            </div>
          </div>

          {/* Step content */}
          <div className="mt-5">
            {STEPS[step].key === "intent" && (
              <div className="grid grid-cols-1 gap-2">
                {[
                  { k: "personal", t: "Personal documents", d: "Occasional, self-managed use." },
                  { k: "professional", t: "Professional use", d: "Clients, matters, contracts." },
                  { k: "team", t: "Team / organisation", d: "Multiple people need access." },
                  { k: "unsure", t: "Not sure yet", d: "Recommend something safe to start." },
                ].map((x) => (
                  <button
                    key={x.k}
                    type="button"
                    onClick={() => setAnswers((a) => ({ ...a, intent: x.k as UsageIntent }))}
                    className={cx(
                      "w-full border px-4 py-4 text-left transition hover:opacity-90"
                    )}
                    style={{
                      borderColor: "var(--border)",
                      background: answers.intent === x.k ? "var(--fg)" : "transparent",
                      color: answers.intent === x.k ? "var(--bg)" : "var(--fg)",
                    }}
                  >
                    <div className="font-semibold">{x.t}</div>
                    <div className="mt-1 text-sm" style={{ color: answers.intent === x.k ? "rgba(234,234,234,0.8)" : "var(--muted)" }}>
                      {x.d}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {STEPS[step].key === "needs" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {[
                  { k: "prove_opened", t: "Prove it was opened" },
                  { k: "acknowledgement", t: "Get an acknowledgement" },
                  { k: "limit_acknowledgements", t: "Limit who can acknowledge" },
                  { k: "send_email", t: "Send by email" },
                  { k: "passwords", t: "Password-protect links" },
                  { k: "audit_records", t: "Audit-ready records" },
                  { k: "templates_defaults", t: "Templates + defaults" },
                  { k: "team_sharing", t: "Share as a team" },
                ].map((x) => {
                  const active = answers.needs.includes(x.k as NeedKey);
                  return (
                    <button
                      key={x.k}
                      type="button"
                      onClick={() => toggleNeed(x.k as NeedKey)}
                      className="border px-4 py-4 text-left transition hover:opacity-90"
                      style={{
                        borderColor: "var(--border)",
                        background: active ? "var(--fg)" : "transparent",
                        color: active ? "var(--bg)" : "var(--fg)",
                      }}
                    >
                      <div className="font-semibold">{x.t}</div>
                      <div className="mt-1 text-xs" style={{ color: active ? "rgba(234,234,234,0.8)" : "var(--muted2)" }}>
                        {active ? "Selected" : "Optional"}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {STEPS[step].key === "frequency" && (
              <div className="grid grid-cols-1 gap-2">
                {[
                  { k: "occasionally", t: "Occasionally", d: "A few times a month." },
                  { k: "weekly", t: "Regularly", d: "Most weeks." },
                  { k: "daily", t: "Frequently", d: "Most days." },
                  { k: "unsure", t: "Not sure yet", d: "Hard to estimate." },
                ].map((x) => (
                  <button
                    key={x.k}
                    type="button"
                    onClick={() => setAnswers((a) => ({ ...a, frequency: x.k as Frequency }))}
                    className="w-full border px-4 py-4 text-left transition hover:opacity-90"
                    style={{
                      borderColor: "var(--border)",
                      background: answers.frequency === x.k ? "var(--fg)" : "transparent",
                      color: answers.frequency === x.k ? "var(--bg)" : "var(--fg)",
                    }}
                  >
                    <div className="font-semibold">{x.t}</div>
                    <div className="mt-1 text-sm" style={{ color: answers.frequency === x.k ? "rgba(234,234,234,0.8)" : "var(--muted)" }}>
                      {x.d}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {STEPS[step].key === "team" && (
              <div className="grid grid-cols-1 gap-2">
                {[
                  { k: "solo", t: "Just me" },
                  { k: "2-5", t: "2–5 people" },
                  { k: "6-20", t: "6–20 people" },
                  { k: "20+", t: "More than 20" },
                  { k: "unsure", t: "Not yet" },
                ].map((x) => (
                  <button
                    key={x.k}
                    type="button"
                    onClick={() => setAnswers((a) => ({ ...a, teamSize: x.k as TeamSize }))}
                    className="w-full border px-4 py-4 text-left transition hover:opacity-90"
                    style={{
                      borderColor: "var(--border)",
                      background: answers.teamSize === x.k ? "var(--fg)" : "transparent",
                      color: answers.teamSize === x.k ? "var(--bg)" : "var(--fg)",
                    }}
                  >
                    <div className="font-semibold">{x.t}</div>
                  </button>
                ))}
              </div>
            )}

            {STEPS[step].key === "referral" && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {[
                    { k: "colleague", t: "Colleague / friend" },
                    { k: "workplace", t: "Workplace" },
                    { k: "linkedin", t: "LinkedIn" },
                    { k: "twitter", t: "Twitter/X" },
                    { k: "google", t: "Google" },
                    { k: "other", t: "Other" },
                    { k: "unknown", t: "Prefer not to say" },
                  ].map((x) => {
                    const referralType = x.k as ReferralType;
                    const active = answers.referralType === referralType;
                    return (
                      <button
                        key={x.k}
                        type="button"
                        onClick={() =>
                          setAnswers((a) => ({
                            ...a,
                            referralType,
                            referralDetail: x.k === "other" ? a.referralDetail : "",
                          }))
                        }
                        className="border px-4 py-4 text-left transition hover:opacity-90"
                        style={{
                          borderColor: "var(--border)",
                          background: active ? "var(--fg)" : "transparent",
                          color: active ? "var(--bg)" : "var(--fg)",
                        }}
                      >
                        <div className="font-semibold">{x.t}</div>
                      </button>
                    );
                  })}
                </div>

                {answers.referralType === "other" && (
                  <div>
                    <label className="text-xs" style={{ color: "var(--muted2)" }}>
                      OPTIONAL DETAIL
                    </label>
                    <input
                      value={answers.referralDetail}
                      onChange={(e) => setAnswers((a) => ({ ...a, referralDetail: e.target.value }))}
                      placeholder="e.g. newsletter, community, event…"
                      className="mt-2 w-full border px-4 py-3 text-sm bg-transparent focus-ring"
                      style={{ borderColor: "var(--border)" }}
                    />
                  </div>
                )}

                <div className="text-xs" style={{ color: "var(--muted2)" }}>
                  We use this to improve onboarding and (later) support referrals.
                </div>
              </div>
            )}

            {STEPS[step].key === "result" && (
              <div className="space-y-6">
                <div
                  className="relative overflow-hidden border p-6 md:p-7"
                  style={{
                    borderColor: recommendationBrand.accent,
                    background:
                      `radial-gradient(1200px 380px at -20% -60%, ${recommendationBrand.accentSoft} 0%, transparent 58%),` +
                      "linear-gradient(145deg, var(--card2), var(--card))",
                    borderRadius: 18,
                  }}
                >
                  <div
                    className="absolute right-5 top-5 rounded-full border px-3 py-1 text-[11px] font-semibold tracking-wide"
                    style={{
                      borderColor: recommendationBrand.accent,
                      color: recommendationBrand.accent,
                      background: recommendationBrand.accentSoft,
                    }}
                  >
                    RECOMMENDED PLAN
                  </div>

                  <div className="max-w-2xl">
                    <div className="text-xs font-semibold tracking-[0.18em] uppercase" style={{ color: recommendationBrand.accent }}>
                      {recommendationBrand.strap}
                    </div>
                    <div className="mt-2 text-4xl font-semibold tracking-tight">{recommendationBrand.title}</div>
                    <div className="mt-2 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
                      {recommendationBrand.summary}
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
                    {recommendation.why.slice(0, 3).map((why, index) => (
                      <div
                        key={why}
                        className="rounded-xl border p-3"
                        style={{ borderColor: "var(--border)", background: "rgba(255, 255, 255, 0.04)" }}
                      >
                        <div className="text-[11px] tracking-[0.16em] uppercase" style={{ color: "var(--muted2)" }}>
                          Reason {index + 1}
                        </div>
                        <div className="mt-1 text-sm leading-snug">{why}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border p-5" style={{ borderColor: "var(--border)", background: "var(--card2)", borderRadius: 14 }}>
                  <div className="text-xs tracking-[0.16em] uppercase" style={{ color: "var(--muted2)" }}>
                    Decision signals
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {decisionSignals.length ? (
                      decisionSignals.map((signal) => (
                        <span
                          key={signal}
                          className="rounded-full border px-3 py-1.5 text-xs font-semibold"
                          style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--muted)" }}
                        >
                          {signal}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm" style={{ color: "var(--muted)" }}>
                        No key signals selected yet. You can still continue.
                      </span>
                    )}
                  </div>

                  {requestedNeeds.length > 0 ? (
                    <>
                      <div className="mt-4 text-xs tracking-[0.16em] uppercase" style={{ color: "var(--muted2)" }}>
                        Requested capabilities
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {requestedNeeds.map((need) => (
                          <span
                            key={need}
                            className="rounded-full px-3 py-1.5 text-xs font-semibold"
                            style={{ background: recommendationBrand.accentSoft, color: recommendationBrand.accent }}
                          >
                            {need}
                          </span>
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>

                {paidRecommendation && (
                  <div className="border p-5" style={{ borderColor: "var(--border)", background: "var(--card)", borderRadius: 14 }}>
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <div className="text-sm font-semibold">Billing cadence</div>
                        <div className="mt-1 text-xs leading-relaxed" style={{ color: "var(--muted2)" }}>
                          {billing === "annual"
                            ? "Annual checkout includes a 14-day trial."
                            : "Monthly checkout includes a 7-day trial."}{" "}
                          Cancel anytime from Stripe.
                        </div>
                      </div>
                      <div
                        className="rounded-full border px-3 py-1 text-xs font-semibold"
                        style={{
                          borderColor: recommendationBrand.accent,
                          color: recommendationBrand.accent,
                          background: recommendationBrand.accentSoft,
                        }}
                      >
                        {TRIAL_DAYS[billing]}-day trial
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setBilling("monthly")}
                        className="rounded-xl border px-4 py-3 text-left transition hover:opacity-90"
                        style={{
                          borderColor: billing === "monthly" ? recommendationBrand.accent : "var(--border)",
                          background: billing === "monthly" ? recommendationBrand.accentSoft : "transparent",
                        }}
                      >
                        <div className="text-sm font-semibold">Monthly</div>
                        <div className="mt-0.5 text-xs" style={{ color: "var(--muted2)" }}>
                          7-day trial
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setBilling("annual")}
                        className="rounded-xl border px-4 py-3 text-left transition hover:opacity-90"
                        style={{
                          borderColor: billing === "annual" ? recommendationBrand.accent : "var(--border)",
                          background: billing === "annual" ? recommendationBrand.accentSoft : "transparent",
                        }}
                      >
                        <div className="text-sm font-semibold">Annual</div>
                        <div className="mt-0.5 text-xs" style={{ color: "var(--muted2)" }}>
                          14-day trial
                        </div>
                      </button>
                    </div>

                    {recommendation.plan === "team" && (
                      <div className="mt-5 border-t pt-5" style={{ borderColor: "var(--border)" }}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold">Team seats</div>
                            <div className="text-xs" style={{ color: "var(--muted2)" }}>
                              Start with your expected active members.
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSeats((s) => Math.max(2, s - 1))}
                              className="h-8 w-8 rounded-full border text-sm"
                              style={{ borderColor: "var(--border)" }}
                              aria-label="Decrease seats"
                            >
                              -
                            </button>
                            <div className="min-w-12 text-center text-sm font-semibold">{seats}</div>
                            <button
                              type="button"
                              onClick={() => setSeats((s) => Math.min(50, s + 1))}
                              className="h-8 w-8 rounded-full border text-sm"
                              style={{ borderColor: "var(--border)" }}
                              aria-label="Increase seats"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <input
                          type="range"
                          min={2}
                          max={50}
                          value={seats}
                          onChange={(e) => setSeats(Number(e.target.value))}
                          className="mt-3 w-full accent-[var(--fg)]"
                        />
                        <div className="mt-2 flex items-center justify-between text-[11px]" style={{ color: "var(--muted2)" }}>
                          <span>2 seats</span>
                          <span>50 seats</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <button
                    type="button"
                    onClick={onContinue}
                    disabled={submitting}
                    className="focus-ring rounded-xl px-6 py-3 text-sm font-semibold transition disabled:opacity-50 md:col-span-2"
                    style={{ background: "var(--fg)", color: "var(--bg)" }}
                  >
                    {submitting
                      ? "Redirecting..."
                      : recommendation.plan === "free"
                        ? "Continue with Free"
                        : recommendation.plan === "enterprise"
                          ? "Contact sales"
                          : `Continue to ${billing} checkout (${TRIAL_DAYS[billing]}-day trial)`}
                  </button>

                  <Link
                    href="/pricing"
                    className="focus-ring rounded-xl border px-6 py-3 text-center text-sm font-semibold hover:opacity-80"
                    style={{ borderColor: "var(--border)", color: "var(--fg)" }}
                  >
                    View all plans
                  </Link>

                  {paidRecommendation ? (
                    <button
                      type="button"
                      onClick={() => void chooseFreeForNow()}
                      disabled={submitting}
                      className="focus-ring rounded-xl border px-6 py-3 text-sm font-semibold hover:opacity-80 disabled:opacity-50 md:col-span-3"
                      style={{ borderColor: "var(--border)", color: "var(--muted)" }}
                    >
                      Use Free for now
                    </button>
                  ) : null}
                </div>

                {paidRecommendation ? (
                  <div className="text-xs leading-relaxed" style={{ color: "var(--muted2)" }}>
                    Trial starts today. You will be charged when the trial ends unless you cancel in Stripe.
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* Footer controls */}
          {STEPS[step].key !== "result" && (
            <div className="mt-8 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={back}
                disabled={step === 0 || submitting}
                className="focus-ring border px-4 py-2 text-sm hover:opacity-80 disabled:opacity-50"
                style={{ borderColor: "var(--border)", color: "var(--fg)" }}
              >
                Back
              </button>

              <button
                type="button"
                onClick={onContinue}
                disabled={submitting}
                className="focus-ring px-5 py-2.5 text-sm font-semibold transition disabled:opacity-50"
                style={{ background: "var(--fg)", color: "var(--bg)" }}
              >
                Continue
              </button>
            </div>
          )}

          {error && (
            <div className="mt-4 text-sm" style={{ color: "#ff3b30" }}>
              {error}
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
