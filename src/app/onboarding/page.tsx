"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type UsageIntent = "personal" | "professional" | "team" | "unsure";
type Frequency = "occasionally" | "weekly" | "daily" | "unsure";
type TeamSize = "solo" | "2-5" | "6-20" | "20+" | "unsure";

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

type Answers = {
  intent: UsageIntent | null;
  needs: NeedKey[];
  frequency: Frequency | null;
  teamSize: TeamSize | null;
  referralType:
    | "colleague"
    | "workplace"
    | "linkedin"
    | "twitter"
    | "google"
    | "other"
    | "unknown"
    | null;
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

  const progress = Math.round(((step + 1) / STEPS.length) * 100);

  const recommendation = useMemo(() => computeRecommendation(answers), [answers]);

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

    const body: any = {
      plan,
      billing,
    };

    // Only Team uses seats.
    if (plan === "team") body.seats = seats;

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
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong");
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
        // Needs can be empty , some users won’t know yet
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
            <h1 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight">
              Let’s set you up properly.
            </h1>
            <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
              A couple of quick questions , then we’ll recommend the right plan.
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
          style={{ borderColor: "var(--border)", background: "var(--card)" }}
        >
          <div className="flex items-start justify-between gap-6">
            <h2 className="text-lg font-semibold tracking-tight">{STEPS[step].title}</h2>
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
                    const active = answers.referralType === (x.k as any);
                    return (
                      <button
                        key={x.k}
                        type="button"
                        onClick={() =>
                          setAnswers((a) => ({
                            ...a,
                            referralType: x.k as any,
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
              <div className="space-y-5">
                <div className="border p-5" style={{ borderColor: "var(--border)", background: "var(--card2)" }}>
                  <div className="text-xs tracking-widest" style={{ color: "var(--muted2)" }}>
                    WE RECOMMEND
                  </div>
                  <div className="mt-2 text-3xl font-semibold tracking-tight">
                    {recommendation.plan.toUpperCase()}
                  </div>
                  <div className="mt-3 space-y-2">
                    {recommendation.why.slice(0, 3).map((w) => (
                      <div key={w} className="text-sm" style={{ color: "var(--muted)" }}>
                        • {w}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Billing choice (only for paid plans) */}
                {recommendation.plan !== "free" && recommendation.plan !== "enterprise" && (
                  <div className="border p-5" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <div className="text-sm font-semibold">Billing</div>
                        <div className="mt-1 text-xs" style={{ color: "var(--muted2)" }}>
                          {billing === "annual" ? "Includes a 14-day free trial." : "Includes a 7-day free trial."}{" "}
                          You can cancel anytime in Stripe.
                        </div>
                      </div>

                      <div className="inline-flex border" style={{ borderColor: "var(--border)" }}>
                        <button
                          type="button"
                          onClick={() => setBilling("monthly")}
                          className="px-4 py-2 text-sm font-semibold transition hover:opacity-90"
                          style={{
                            background: billing === "monthly" ? "var(--fg)" : "transparent",
                            color: billing === "monthly" ? "var(--bg)" : "var(--fg)",
                          }}
                        >
                          Monthly
                        </button>
                        <button
                          type="button"
                          onClick={() => setBilling("annual")}
                          className="px-4 py-2 text-sm font-semibold transition hover:opacity-90"
                          style={{
                            borderLeft: `1px solid var(--border)`,
                            background: billing === "annual" ? "var(--fg)" : "transparent",
                            color: billing === "annual" ? "var(--bg)" : "var(--fg)",
                          }}
                        >
                          Annual
                        </button>
                      </div>
                    </div>

                    {/* Seats (Team only) */}
                    {recommendation.plan === "team" && (
                      <div className="mt-5">
                        <div className="flex items-center justify-between text-sm">
                          <div className="font-semibold">Seats</div>
                          <div style={{ color: "var(--muted)" }}>{seats}</div>
                        </div>
                        <input
                          type="range"
                          min={2}
                          max={50}
                          value={seats}
                          onChange={(e) => setSeats(Number(e.target.value))}
                          className="mt-3 w-full"
                        />
                        <div className="mt-2 text-xs" style={{ color: "var(--muted2)" }}>
                          You’ll confirm seats and billing in Stripe checkout.
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-col md:flex-row gap-3">
                  <button
                    type="button"
                    onClick={onContinue}
                    disabled={submitting}
                    className="focus-ring px-6 py-3 text-sm font-semibold transition disabled:opacity-50"
                    style={{ background: "var(--fg)", color: "var(--bg)" }}
                  >
                    {submitting
                      ? "Redirecting…"
                      : recommendation.plan === "free"
                        ? "Continue"
                        : recommendation.plan === "enterprise"
                          ? "Contact sales"
                          : `Continue to ${billing === "annual" ? "annual" : "monthly"} checkout (${billing === "annual" ? "14" : "7"}-day trial)`}
                  </button>

                  <Link
                    href="/pricing"
                    className="focus-ring border px-6 py-3 text-sm font-semibold hover:opacity-80"
                    style={{ borderColor: "var(--border)", color: "var(--fg)" }}
                  >
                    View all plans
                  </Link>

                  {recommendation.plan !== "free" && recommendation.plan !== "enterprise" ? (
                    <button
                      type="button"
                      onClick={() => void chooseFreeForNow()}
                      disabled={submitting}
                      className="focus-ring border px-6 py-3 text-sm font-semibold hover:opacity-80 disabled:opacity-50"
                      style={{ borderColor: "var(--border)", color: "var(--muted)" }}
                    >
                      Use Free for now
                    </button>
                  ) : null}
                </div>

                <div className="text-xs leading-relaxed" style={{ color: "var(--muted2)" }}>
                  Trial starts today. We’ll charge after the trial ends unless you cancel. Prefer to explore first? Choose “Use Free for now” and upgrade anytime.
                </div>
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