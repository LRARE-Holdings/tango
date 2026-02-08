"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useToast } from "@/components/toast";

type MeResponse = {
  email?: string | null;
  plan?: string | null;
  // add more fields here later if your /api/app/me returns them
};

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="border-t pt-6"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {subtitle ? (
          <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
            {subtitle}
          </p>
        ) : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
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
  variant?: "primary" | "ghost";
}) {
  const base =
    "focus-ring inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium transition disabled:opacity-50";
  const cls =
    variant === "primary"
      ? `${base} hover:opacity-90`
      : `${base} border hover:opacity-80`;

  const style =
    variant === "primary"
      ? { background: "var(--fg)", color: "var(--bg)" }
      : { borderColor: "var(--border)", color: "var(--muted)", background: "transparent" };

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cls} style={style as any}>
      {children}
    </button>
  );
}

export default function AccountPage() {
  const toast = useToast();
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [me, setMe] = useState<MeResponse | null>(null);
  const [meLoading, setMeLoading] = useState(true);

  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMe() {
      setMeLoading(true);
      try {
        const res = await fetch("/api/app/me", { cache: "no-store" });
        if (!res.ok) {
          setMe(null);
          return;
        }
        const json = (await res.json()) as MeResponse;
        setMe(json ?? null);
      } finally {
        setMeLoading(false);
      }
    }
    loadMe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/auth");
  }

  async function openBillingPortal() {
    setBillingError(null);
    setBillingLoading(true);
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Could not open billing portal");
      if (!json?.url) throw new Error("No portal URL returned");
      window.location.href = json.url;
    } catch (e: any) {
      const msg = e?.message ?? "Something went wrong";
      setBillingError(msg);
      toast.error("Billing", msg);
      setBillingLoading(false);
    }
  }

  const email = me?.email ?? null;
  const plan = me?.plan ?? "Free";

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Account</h1>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
            Manage your plan, billing, and session.
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Link
            href="/app"
            className="focus-ring inline-flex items-center justify-center rounded-full border px-5 py-2.5 text-sm font-medium transition hover:opacity-80"
            style={{ borderColor: "var(--border)", color: "var(--muted)" }}
          >
            Back to dashboard
          </Link>
          <Button variant="ghost" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </div>

      {/* Overview card */}
      <div
        className="border p-6 md:p-7"
        style={{
          borderColor: "var(--border)",
          background: "color-mix(in srgb, var(--bg) 86%, var(--fg) 14%)",
        }}
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <div>
            <div className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>
              EMAIL
            </div>
            <div className="mt-1 text-sm font-semibold">
              {meLoading ? "Loading…" : email ?? "—"}
            </div>
          </div>

          <div>
            <div className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>
              PLAN
            </div>
            <div className="mt-1 text-sm font-semibold">{meLoading ? "Loading…" : plan}</div>
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
                className="focus-ring inline-flex items-center justify-center rounded-full border px-5 py-2.5 text-sm font-medium transition hover:opacity-80"
                style={{ borderColor: "var(--border)", color: "var(--muted)" }}
              >
                View pricing
              </Link>
            </div>

            {billingError ? (
              <div className="mt-3 text-sm" style={{ color: "#ff3b30" }}>
                {billingError}
              </div>
            ) : null}

            <div className="mt-3 text-xs leading-relaxed" style={{ color: "var(--muted2)" }}>
              Billing is handled via Stripe’s secure customer portal.
            </div>
          </div>
        </div>
      </div>

      {/* Settings sections */}
      <Section
        title="Security"
        subtitle="Keep your account tidy. More controls can live here later (2FA, SSO for Team/Enterprise, etc.)."
      >
        <div className="flex gap-2 flex-wrap">
          <Link
            href="/auth"
            className="focus-ring inline-flex items-center justify-center rounded-full border px-5 py-2.5 text-sm font-medium transition hover:opacity-80"
            style={{ borderColor: "var(--border)", color: "var(--muted)" }}
          >
            Auth settings
          </Link>
          <Button variant="ghost" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </Section>

      <div className="text-xs leading-relaxed" style={{ color: "var(--muted2)" }}>
        Receipt records access, review activity, and acknowledgement. It does not assess understanding and is not an
        e-signature product.
      </div>
    </div>
  );
}