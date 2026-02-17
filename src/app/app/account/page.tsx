"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useToast } from "@/components/toast";

type MeResponse = {
  id?: string | null;
  email?: string | null;

  plan?: string | null; // "free" | "personal" | "pro" | "team"
  display_plan?: string | null; // e.g. "licensed" for workspace-licensed members
  workspace_license_active?: boolean | null;
  workspace_plan?: string | null;
  billing_interval?: string | null; // "month" | "year" (Stripe interval)
  seats?: number | null;

  subscription_status?: string | null; // active, trialing, past_due, canceled, etc.
  current_period_end?: string | null; // timestamptz ISO
  cancel_at_period_end?: boolean | null;

  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;

  onboarding_completed?: boolean | null;
  onboarding_completed_at?: string | null;
  recommended_plan?: string | null;

  primary_workspace_id?: string | null;
};

type AccountPatch = {
  // safe user-editable fields (store on profiles)
  display_name?: string | null;
  marketing_opt_in?: boolean | null;
  default_ack_limit?: number | null;
  default_password_enabled?: boolean | null;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function statusLabel(status: string | null) {
  if (!status) return "No subscription";
  return status.replace(/_/g, " ");
}

function intervalLabel(interval: string | null) {
  if (interval === "month") return "Monthly";
  if (interval === "year") return "Annual";
  return "—";
}

function planLabel(plan: string | null | undefined) {
  if (!plan) return "Free";
  const p = String(plan).toLowerCase();
  if (p === "licensed") return "Licensed";
  if (p === "personal") return "Personal";
  if (p === "pro") return "Pro";
  if (p === "team") return "Team";
  if (p === "enterprise") return "Enterprise";
  return p.charAt(0).toUpperCase() + p.slice(1);
}

function toneForStatus(status: string | null) {
  const s = (status ?? "").toLowerCase();
  if (s === "active" || s === "trialing") return "good" as const;
  if (s === "past_due" || s === "unpaid") return "warn" as const;
  if (s === "canceled" || s === "incomplete" || s === "incomplete_expired") return "bad" as const;
  return "neutral" as const;
}

function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  const style =
    tone === "good"
      ? { background: "var(--fg)", color: "var(--bg)", borderColor: "transparent" }
      : tone === "warn"
        ? { background: "transparent", color: "var(--fg)", borderColor: "var(--border)" }
        : tone === "bad"
          ? { background: "transparent", color: "#ff3b30", borderColor: "color-mix(in srgb, #ff3b30 35%, var(--border))" }
          : { background: "transparent", color: "var(--muted)", borderColor: "var(--border)" };

  return (
    <span
      className="inline-flex items-center border px-3 py-1 text-xs tracking-wide"
      style={{ ...style, borderRadius: 9999 }}
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
      : `${base} border hover:opacity-80`;

  const style =
    variant === "primary"
      ? { background: "var(--fg)", color: "var(--bg)" }
      : variant === "danger"
        ? { borderColor: "var(--border)", color: "var(--fg)", background: "transparent" }
        : { borderColor: "var(--border)", color: "var(--muted)", background: "transparent" };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cls}
      style={{ ...(style as any), borderRadius: 12 }}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>
          {label}
        </div>
        {hint ? (
          <div className="text-xs" style={{ color: "var(--muted2)" }}>
            {hint}
          </div>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cx(
        "focus-ring w-full border px-4 py-3 text-sm bg-transparent",
        props.className
      )}
      style={{ borderColor: "var(--border)", borderRadius: 12 }}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cx("focus-ring w-full border px-4 py-3 text-sm bg-transparent", props.className)}
      style={{ borderColor: "var(--border)", borderRadius: 12, color: "var(--fg)" }}
    />
  );
}

function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={cx(
        "focus-ring w-full border px-4 py-3 text-left transition disabled:opacity-50",
        "hover:opacity-90"
      )}
      style={{ borderColor: "var(--border)", borderRadius: 12, background: "transparent" }}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-medium">{label}</div>
          {description ? (
            <div className="mt-1 text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
              {description}
            </div>
          ) : null}
        </div>
        <div
          aria-hidden
          className="shrink-0"
          style={{
            width: 44,
            height: 26,
            borderRadius: 9999,
            border: "1px solid var(--border)",
            background: checked ? "var(--fg)" : "transparent",
            position: "relative",
          }}
        >
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: 9999,
              background: checked ? "var(--bg)" : "var(--fg)",
              position: "absolute",
              top: 2,
              left: checked ? 22 : 2,
              transition: "left 180ms ease",
            }}
          />
        </div>
      </div>
    </button>
  );
}

function Section({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className="border p-6 md:p-7"
      style={{
        borderColor: "var(--border)",
        background: "color-mix(in srgb, var(--bg) 92%, transparent)",
        borderRadius: 16,
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
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Divider() {
  return <div style={{ borderTop: "1px solid var(--border)", marginTop: 18, marginBottom: 18 }} />;
}

export default function AccountPage() {
  const toast = useToast();
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [me, setMe] = useState<MeResponse | null>(null);
  const [meLoading, setMeLoading] = useState(true);
  const [meError, setMeError] = useState<string | null>(null);

  // Editable prefs – backed by your profiles row.
  // If these columns don’t exist yet, the PATCH call will fail; the UI will show a helpful toast.
  const [prefsLoading, setPrefsLoading] = useState(false);
  const [prefsSaving, setPrefsSaving] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);

  // Defaults used on /app/new – your “templates and defaults” foundation
  const [defaultAckLimit, setDefaultAckLimit] = useState<number>(1);
  const [defaultPasswordEnabled, setDefaultPasswordEnabled] = useState(false);

  // Billing portal
  const [billingLoading, setBillingLoading] = useState(false);

  // Security actions
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Danger zone
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState("");

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function loadMe() {
    setMeLoading(true);
    setMeError(null);
    try {
      const res = await fetch("/api/app/me", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Could not load account");
      if (!mountedRef.current) return;

      const m = (json ?? null) as MeResponse & Partial<AccountPatch>;
      setMe(m);

      // Hydrate editable fields (best-effort)
      setPrefsLoading(true);
      try {
        // If /api/app/me already returns these, use them.
        // If not, you can extend /api/app/me later.
        setDisplayName(String((m as any)?.display_name ?? ""));
        setMarketingOptIn(Boolean((m as any)?.marketing_opt_in ?? false));
        setDefaultAckLimit(Number((m as any)?.default_ack_limit ?? 1));
        setDefaultPasswordEnabled(Boolean((m as any)?.default_password_enabled ?? false));
      } finally {
        setPrefsLoading(false);
      }
    } catch (e: any) {
      if (!mountedRef.current) return;
      setMeError(e?.message ?? "Something went wrong");
    } finally {
      if (!mountedRef.current) return;
      setMeLoading(false);
    }
  }

  useEffect(() => {
    loadMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const email = me?.email ?? null;

  const plan = useMemo(() => planLabel(me?.display_plan ?? me?.plan ?? null), [me?.display_plan, me?.plan]);
  const interval = useMemo(() => intervalLabel(me?.billing_interval ?? null), [me?.billing_interval]);
  const status = me?.subscription_status ?? null;
  const statusTone = useMemo(() => toneForStatus(status), [status]);

  const renewal = me?.current_period_end ?? null;
  const cancelAtPeriodEnd = Boolean(me?.cancel_at_period_end);

  const seats = Number(me?.seats ?? 1);
  const isTeam = String(me?.plan ?? "").toLowerCase() === "team";
  const isPaid = String(me?.plan ?? "").toLowerCase() !== "free" && Boolean(status);

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
      toast.error("Billing", e?.message ?? "Something went wrong");
      setBillingLoading(false);
    }
  }

  async function savePreferences() {
    setPrefsSaving(true);
    try {
      const patch: AccountPatch = {
        display_name: displayName.trim() ? displayName.trim() : null,
        marketing_opt_in: Boolean(marketingOptIn),
        default_ack_limit: Math.max(1, Math.min(25, Number(defaultAckLimit) || 1)),
        default_password_enabled: Boolean(defaultPasswordEnabled),
      };

      const res = await fetch("/api/app/account", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Could not save settings");

      toast.success("Saved", "Your account settings have been updated.");
      await loadMe();
    } catch (e: any) {
      toast.error("Settings", e?.message ?? "Something went wrong");
      setPrefsSaving(false);
    } finally {
      setPrefsSaving(false);
    }
  }

  async function sendPasswordReset() {
    setPasswordLoading(true);
    try {
      const res = await fetch("/api/auth/password-reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Could not send reset email");
      toast.success("Email sent", "Check your inbox for the password reset link.");
    } catch (e: any) {
      toast.error("Password", e?.message ?? "Something went wrong");
    } finally {
      setPasswordLoading(false);
    }
  }

  async function deleteAccount() {
    if (confirmDelete !== "DELETE") {
      toast.error("Delete", 'Type "DELETE" to confirm.');
      return;
    }

    setDeleteLoading(true);
    try {
      const res = await fetch("/api/app/account", { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Could not delete account");
      toast.success("Deleted", "Your account has been deleted.");
      await supabase.auth.signOut();
      router.replace("/");
    } catch (e: any) {
      toast.error("Delete", e?.message ?? "Something went wrong");
    } finally {
      setDeleteLoading(false);
    }
  }

  const workspaceId = me?.primary_workspace_id ?? null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Account</h1>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
            Settings, billing, security, and workspace context — in one place.
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Link
            href="/app"
            className="focus-ring inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium border transition hover:opacity-80"
            style={{ borderColor: "var(--border)", color: "var(--muted)", borderRadius: 12 }}
          >
            Back to dashboard
          </Link>
          <Button variant="danger" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </div>

      {/* Quick status row */}
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={statusTone}>
          {meLoading ? "LOADING…" : status ? statusLabel(status).toUpperCase() : plan.toUpperCase()}
        </Pill>
        <Pill>{meLoading ? "—" : plan.toUpperCase()}</Pill>
        {isPaid ? <Pill>{interval.toUpperCase()}</Pill> : null}
        {isTeam ? <Pill>{`${seats} SEATS`}</Pill> : null}
        {renewal ? (
          <Pill tone={cancelAtPeriodEnd ? "warn" : "neutral"}>
            {cancelAtPeriodEnd ? "CANCELS" : "RENIEWS"} {formatDate(renewal).toUpperCase()}
          </Pill>
        ) : null}
      </div>

      {meError ? (
        <div className="border p-5" style={{ borderColor: "var(--border)", borderRadius: 16 }}>
          <div className="text-sm font-semibold">Couldn’t load account</div>
          <div className="mt-2 text-sm" style={{ color: "#ff3b30" }}>
            {meError}
          </div>
          <div className="mt-4">
            <Button onClick={loadMe}>Retry</Button>
          </div>
        </div>
      ) : null}

      {/* Overview */}
      <Section
        title="Overview"
        subtitle="The essentials: identity, subscription, and workspace."
        right={
          <div className="flex gap-2 flex-wrap">
            <Button onClick={loadMe} variant="ghost">
              Refresh
            </Button>
            <Link
              href="/pricing"
              className="focus-ring inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium border transition hover:opacity-80"
              style={{ borderColor: "var(--border)", color: "var(--muted)", borderRadius: 12 }}
            >
              View pricing
            </Link>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <div>
            <div className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>
              EMAIL
            </div>
            <div className="mt-1 text-sm font-semibold">{meLoading ? "Loading…" : email ?? "—"}</div>
            <div className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
              Used for sign-in and account notifications.
            </div>
          </div>

          <div>
            <div className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>
              SUBSCRIPTION
            </div>
            <div className="mt-1 text-sm font-semibold">
              {meLoading ? "Loading…" : `${plan}${isPaid ? ` · ${interval}` : ""}`}
            </div>
            <div className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
              Status: {meLoading ? "…" : status ? statusLabel(status) : "not subscribed"}
              {renewal ? (
                <>
                  {" "}
                  · {cancelAtPeriodEnd ? "Ends" : "Renews"} {formatDate(renewal)} at {formatTime(renewal)}
                </>
              ) : null}
            </div>
          </div>

          <div>
            <div className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>
              WORKSPACE
            </div>
            <div className="mt-1 text-sm font-semibold">{workspaceId ? "Team workspace" : "Personal workspace"}</div>
            <div className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
              {workspaceId ? (
                <>
                  Primary workspace set.{" "}
                  <Link className="underline underline-offset-4" href="/app/workspace">
                    Manage workspace
                  </Link>
                </>
              ) : (
                "Not in a team workspace."
              )}
            </div>
          </div>
        </div>

        <Divider />

        <div className="flex flex-wrap gap-2">
          <Button onClick={openBillingPortal} disabled={billingLoading}>
            {billingLoading ? "Opening…" : "Manage billing"}
          </Button>
          <Link
            href="/app"
            className="focus-ring inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium border transition hover:opacity-80"
            style={{ borderColor: "var(--border)", color: "var(--muted)", borderRadius: 12 }}
          >
            Back to dashboard
          </Link>
        </div>

        <div className="mt-3 text-xs leading-relaxed" style={{ color: "var(--muted2)" }}>
          Billing is handled via Stripe’s secure customer portal.
        </div>
      </Section>

      {/* Preferences */}
      <Section
        title="Preferences"
        subtitle="Controls that shape your default behaviour in Receipt."
        right={
          <div className="flex gap-2 flex-wrap">
            <Button onClick={savePreferences} disabled={prefsSaving || meLoading}>
              {prefsSaving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field label="Display name" hint="Shown in-app (optional)">
            <TextInput
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Alex"
              disabled={prefsLoading || meLoading}
            />
          </Field>

          <Field label="Default acknowledgement limit" hint="Used when creating new links">
            <Select
              value={String(defaultAckLimit)}
              onChange={(e) => setDefaultAckLimit(Number(e.target.value))}
              disabled={prefsLoading || meLoading}
            >
              {Array.from({ length: 10 }).map((_, i) => {
                const v = i + 1;
                return (
                  <option key={v} value={String(v)}>
                    {v === 1 ? "1 person (default)" : `${v} people`}
                  </option>
                );
              })}
            </Select>
            <div className="mt-2 text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
              When the limit is reached, the link can be marked closed (depending on your flow).
            </div>
          </Field>

          <div className="md:col-span-2 space-y-3">
            <Toggle
              checked={marketingOptIn}
              onChange={setMarketingOptIn}
              label="Product updates"
              description="Occasional updates about new features and improvements."
              disabled={prefsLoading || meLoading}
            />
            <Toggle
              checked={defaultPasswordEnabled}
              onChange={setDefaultPasswordEnabled}
              label="Default to password-protected links"
              description="If your plan supports it, new links will default to requiring a recipient password."
              disabled={prefsLoading || meLoading}
            />
          </div>
        </div>
      </Section>

      {/* Security */}
      <Section
        title="Security"
        subtitle="Control how you sign in. Keep it simple, keep it safe."
        right={
          <Link
            href="/auth"
            className="focus-ring inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium border transition hover:opacity-80"
            style={{ borderColor: "var(--border)", color: "var(--muted)", borderRadius: 12 }}
          >
            Auth settings
          </Link>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div
            className="border p-5"
            style={{ borderColor: "var(--border)", borderRadius: 16, background: "var(--card)" }}
          >
            <div className="text-sm font-semibold">Reset password</div>
            <div className="mt-2 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
              Send a password reset email to <span style={{ color: "var(--fg)" }}>{email ?? "your address"}</span>.
            </div>
            <div className="mt-4">
              <Button onClick={sendPasswordReset} disabled={passwordLoading || !email}>
                {passwordLoading ? "Sending…" : "Send reset email"}
              </Button>
            </div>
          </div>

          <div
            className="border p-5"
            style={{ borderColor: "var(--border)", borderRadius: 16, background: "var(--card)" }}
          >
            <div className="text-sm font-semibold">Session</div>
            <div className="mt-2 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
              If something feels off, sign out everywhere (via auth settings) or sign out now.
            </div>
            <div className="mt-4 flex gap-2 flex-wrap">
              <Button variant="ghost" onClick={signOut}>
                Sign out
              </Button>
              <Link
                href="/auth"
                className="focus-ring inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium border transition hover:opacity-80"
                style={{ borderColor: "var(--border)", color: "var(--muted)", borderRadius: 12 }}
              >
                Auth settings
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-4 text-xs leading-relaxed" style={{ color: "var(--muted2)" }}>
          Future: 2FA, passkeys, and SSO for Team/Enterprise.
        </div>
      </Section>

      {/* Billing details (diagnostics) */}
      <Section
        title="Billing details"
        subtitle="Useful diagnostics while you’re finishing Stripe + webhook wiring."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div
            className="border p-5"
            style={{ borderColor: "var(--border)", borderRadius: 16, background: "transparent" }}
          >
            <div className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>
              STRIPE CUSTOMER ID
            </div>
            <div className="mt-2 text-sm font-semibold break-all">
              {meLoading ? "Loading…" : me?.stripe_customer_id ?? "—"}
            </div>
            <div className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
              Set during checkout/webhook. If missing, check your checkout route metadata and webhook logs.
            </div>
          </div>

          <div
            className="border p-5"
            style={{ borderColor: "var(--border)", borderRadius: 16, background: "transparent" }}
          >
            <div className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>
              STRIPE SUBSCRIPTION ID
            </div>
            <div className="mt-2 text-sm font-semibold break-all">
              {meLoading ? "Loading…" : me?.stripe_subscription_id ?? "—"}
            </div>
            <div className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
              Updated on subscription lifecycle events.
            </div>
          </div>
        </div>

        <div className="mt-4 flex gap-2 flex-wrap">
          <Button onClick={openBillingPortal} disabled={billingLoading}>
            {billingLoading ? "Opening…" : "Open customer portal"}
          </Button>
          <Link
            href="/pricing"
            className="focus-ring inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium border transition hover:opacity-80"
            style={{ borderColor: "var(--border)", color: "var(--muted)", borderRadius: 12 }}
          >
            Pricing
          </Link>
        </div>
      </Section>

      {/* Danger zone */}
      <Section
        title="Danger zone"
        subtitle="Irreversible actions. Use with care."
      >
        <div
          className="border p-5"
          style={{
            borderColor: "color-mix(in srgb, #ff3b30 30%, var(--border))",
            borderRadius: 16,
            background: "transparent",
          }}
        >
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <div className="text-sm font-semibold">Delete account</div>
              <div className="mt-2 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
                This removes your profile and will revoke access to your workspace. For paid plans, cancel in Stripe
                first (or via the billing portal) to avoid confusion.
              </div>
              <div className="mt-3 text-xs" style={{ color: "var(--muted2)" }}>
                Type <span style={{ color: "var(--fg)" }}>DELETE</span> to enable the button.
              </div>
            </div>

            <div className="w-full md:w-90 space-y-3">
              <TextInput
                value={confirmDelete}
                onChange={(e) => setConfirmDelete(e.target.value)}
                placeholder='Type "DELETE"'
              />
              <Button
                variant="danger"
                onClick={deleteAccount}
                disabled={deleteLoading || confirmDelete !== "DELETE"}
              >
                {deleteLoading ? "Deleting…" : "Delete my account"}
              </Button>
            </div>
          </div>

          <div className="mt-3 text-xs leading-relaxed" style={{ color: "var(--muted2)" }}>
            This UI expects <code>/api/app/account</code> (DELETE). If you haven’t built it yet, disable this section
            or wire the route before enabling deletion.
          </div>
        </div>
      </Section>

      <div className="text-xs leading-relaxed" style={{ color: "var(--muted2)" }}>
        Receipt records access, review activity, and acknowledgement. It does not assess understanding and is not an
        e-signature product.
      </div>
    </div>
  );
}
