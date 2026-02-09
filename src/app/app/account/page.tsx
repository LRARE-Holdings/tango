"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useToast } from "@/components/toast";

type MeResponse = {
  email?: string | null;
  plan?: string | null;
  tier?: string | null;
  status?: string | null; // e.g. active, trialing, past_due
  current_period_end?: string | null; // ISO or null (only if your /api/app/me returns it)
};

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "warn";
}) {
  const style =
    tone === "good"
      ? { background: "var(--fg)", color: "var(--bg)", borderColor: "transparent" }
      : tone === "warn"
        ? { background: "transparent", color: "var(--fg)", borderColor: "var(--border)" }
        : { background: "transparent", color: "var(--muted)", borderColor: "var(--border)" };

  return (
    <span
      className="inline-flex items-center rounded-full border px-3 py-1 text-xs tracking-wide"
      style={style as any}
    >
      {children}
    </span>
  );
}

function Button({
  children,
  onClick,
  disabled,
  variant = "primary",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "ghost" | "danger";
}) {
  const base =
    "focus-ring inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium transition disabled:opacity-50";
  const cls =
    variant === "primary"
      ? `${base} hover:opacity-90`
      : variant === "danger"
        ? `${base} border hover:opacity-80`
        : `${base} border hover:opacity-80`;

  const style =
    variant === "primary"
      ? { background: "var(--fg)", color: "var(--bg)", borderRadius: 9999 }
      : variant === "danger"
        ? { borderColor: "var(--border)", color: "var(--fg)", background: "transparent", borderRadius: 9999 }
        : { borderColor: "var(--border)", color: "var(--muted)", background: "transparent", borderRadius: 9999 };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cls}
      style={style as any}
    >
      {children}
    </button>
  );
}

function Card({
  title,
  subtitle,
  children,
  right,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <section
      className="border p-6 md:p-7"
      style={{
        borderColor: "var(--border)",
        background: "color-mix(in srgb, var(--bg) 92%, transparent)",
      }}
    >
      <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          {subtitle ? (
            <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
              {subtitle}
            </p>
          ) : null}
        </div>
        {right ? <div className="flex gap-2 flex-wrap">{right}</div> : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default function AccountPage() {
  const toast = useToast();
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [me, setMe] = useState<MeResponse | null>(null);
  const [meLoading, setMeLoading] = useState(true);
  const [meError, setMeError] = useState<string | null>(null);

  const [billingLoading, setBillingLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadMe() {
      setMeLoading(true);
      setMeError(null);
      try {
        const res = await fetch("/api/app/me", { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error ?? "Could not load account");
        if (!cancelled) setMe((json ?? null) as MeResponse);
      } catch (e: any) {
        if (!cancelled) setMeError(e?.message ?? "Something went wrong");
      } finally {
        if (!cancelled) setMeLoading(false);
      }
    }

    loadMe();
    return () => {
      cancelled = true;
    };
  }, []);

  const email = me?.email ?? null;
  const plan = me?.plan ?? me?.tier ?? "Free";
  const status = me?.status ?? null;
  const renewal = me?.current_period_end ?? null;

  const statusTone = useMemo(() => {
    if (!status) return "neutral" as const;
    if (status === "active" || status === "trialing") return "good" as const;
    if (status === "past_due" || status === "unpaid") return "warn" as const;
    return "neutral" as const;
  }, [status]);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/auth");
  }

  async function openBillingPortal() {
    setBillingLoading(true);
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Could not open billing portal");
      if (!json?.url) throw new Error("No portal URL returned");
      window.location.href = json.url;
    } catch (e: any) {
      const msg = e?.message ?? "Something went wrong";
      toast.error("Billing", msg);
      setBillingLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Account</h1>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
            Plan, billing, and session controls.
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Link
            href="/app"
            className="focus-ring inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium border transition hover:opacity-80"
            style={{ borderColor: "var(--border)", color: "var(--muted)", borderRadius: 9999 }}
          >
            Back to dashboard
          </Link>
          <Button variant="danger" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </div>

      {/* Overview */}
      <Card
        title="Overview"
        subtitle="This is what Receipt currently knows about your account."
        right={
          <>
            <Pill tone={statusTone}>{status ? status.toUpperCase() : "NO SUBSCRIPTION"}</Pill>
            <Pill>{plan}</Pill>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <div>
            <div className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>
              EMAIL
            </div>
            <div className="mt-1 text-sm font-semibold">
              {meLoading ? "Loading…" : email ?? ","}
            </div>
          </div>

          <div>
            <div className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>
              PLAN
            </div>
            <div className="mt-1 text-sm font-semibold">
              {meLoading ? "Loading…" : plan}
            </div>
            {renewal ? (
              <div className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
                Renews: {formatDate(renewal)}
              </div>
            ) : (
              <div className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
                Upgrade anytime.
              </div>
            )}
          </div>

          <div>
            <div className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>
              BILLING
            </div>

            <div className="mt-2 flex gap-2 flex-wrap">
              <Button onClick={openBillingPortal} disabled={billingLoading}>
                {billingLoading ? "Opening…" : "Manage billing"}
              </Button>
              <Link
                href="/pricing"
                className="focus-ring inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium border transition hover:opacity-80"
                style={{ borderColor: "var(--border)", color: "var(--muted)", borderRadius: 9999 }}
              >
                View pricing
              </Link>
            </div>

            <div className="mt-3 text-xs leading-relaxed" style={{ color: "var(--muted2)" }}>
              Billing is handled via Stripe’s secure customer portal.
            </div>
          </div>
        </div>

        {meError ? (
          <div className="mt-5 text-sm" style={{ color: "#ff3b30" }}>
            {meError}
          </div>
        ) : null}
      </Card>

      {/* Security */}
      <Card
        title="Security"
        subtitle="Keep your account tidy. More controls can live here later (2FA, SSO for Team/Enterprise, etc.)."
        right={
          <Link
            href="/auth"
            className="focus-ring inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium border transition hover:opacity-80"
            style={{ borderColor: "var(--border)", color: "var(--muted)", borderRadius: 9999 }}
          >
            Auth settings
          </Link>
        }
      >
        <div className="flex items-center justify-between gap-4 flex-col sm:flex-row">
          <div className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
            Want to change your password or update how you sign in? Use Auth settings.
          </div>
          <Button variant="danger" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </Card>

      {/* Help / footer note */}
      <div className="text-xs leading-relaxed" style={{ color: "var(--muted2)" }}>
        Receipt records access, review activity, and acknowledgement. It does not assess understanding
        and is not an e-signature product.
      </div>
    </div>
  );
}