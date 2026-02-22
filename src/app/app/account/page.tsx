"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useToast } from "@/components/toast";

type MeResponse = {
  id?: string | null;
  email?: string | null;

  plan?: string | null; // "free" | "personal" | "pro" | "team"
  display_plan?: string | null; // e.g. "licensed" for workspace-licensed members
  display_name?: string | null;
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
  usage?: {
    used: number;
    limit: number | null;
    remaining: number | null;
    percent: number | null;
    window: "total" | "monthly" | "custom";
    near_limit: boolean;
    at_limit: boolean;
  } | null;
};

type UsageDoc = {
  id: string;
  createdAt: string;
  acknowledgements: number;
  status: "Acknowledged" | "Pending";
};

type AccountPatch = {
  // safe user-editable fields (store on profiles)
  display_name?: string | null;
  marketing_opt_in?: boolean | null;
  default_ack_limit?: number | null;
  default_password_enabled?: boolean | null;
};

type BillingPortalFlow = "default" | "payment_method_update" | "subscription_cancel" | "subscription_update";

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

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
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

function firstNameFromDisplayName(input: string | null | undefined) {
  const clean = String(input ?? "").trim().replace(/\s+/g, " ");
  if (!clean) return "";
  return clean.split(" ")[0] ?? "";
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

  const style: React.CSSProperties =
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
      style={{ ...style, borderRadius: 12 }}
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
  const supabase = supabaseBrowser();

  const [me, setMe] = useState<MeResponse | null>(null);
  const [meLoading, setMeLoading] = useState(true);
  const [meError, setMeError] = useState<string | null>(null);

  // Editable prefs – backed by your profiles row.
  // If these columns don’t exist yet, the PATCH call will fail; the UI will show a helpful toast.
  const [prefsLoading, setPrefsLoading] = useState(false);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [usageDocs, setUsageDocs] = useState<UsageDoc[]>([]);

  const [displayName, setDisplayName] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);

  // Defaults used on /app/new – your “templates and defaults” foundation
  const [defaultAckLimit, setDefaultAckLimit] = useState<number>(1);
  const [defaultPasswordEnabled, setDefaultPasswordEnabled] = useState(false);

  // Billing portal
  const [billingLoadingFlow, setBillingLoadingFlow] = useState<BillingPortalFlow | null>(null);

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

      const docsRes = await fetch("/api/app/documents", { cache: "no-store" });
      const docsJson = await docsRes.json().catch(() => null);
      if (docsRes.ok) {
        setUsageDocs(((docsJson?.documents ?? []) as Array<{
          id: string;
          createdAt: string;
          acknowledgements: number;
          status: "Acknowledged" | "Pending";
        }>).map((d) => ({
          id: d.id,
          createdAt: d.createdAt,
          acknowledgements: d.acknowledgements,
          status: d.status,
        })));
      } else {
        setUsageDocs([]);
      }

      // Hydrate editable fields (best-effort)
      setPrefsLoading(true);
      try {
        // If /api/app/me already returns these, use them.
        // If not, you can extend /api/app/me later.
        setDisplayName(String(m.display_name ?? ""));
        setMarketingOptIn(Boolean(m.marketing_opt_in ?? false));
        setDefaultAckLimit(Number(m.default_ack_limit ?? 1));
        setDefaultPasswordEnabled(Boolean(m.default_password_enabled ?? false));
      } finally {
        setPrefsLoading(false);
      }
    } catch (error: unknown) {
      if (!mountedRef.current) return;
      setMeError(errorMessage(error, "Something went wrong"));
    } finally {
      if (!mountedRef.current) return;
      setMeLoading(false);
    }
  }

  useEffect(() => {
    void loadMe();
  }, []);

  const email = me?.email ?? null;
  const firstName = useMemo(() => firstNameFromDisplayName(me?.display_name ?? null), [me?.display_name]);

  const plan = useMemo(() => planLabel(me?.display_plan ?? me?.plan ?? null), [me?.display_plan, me?.plan]);
  const isLicensedDisplayPlan = String(me?.display_plan ?? "").trim().toLowerCase() === "licensed";
  const interval = useMemo(() => intervalLabel(me?.billing_interval ?? null), [me?.billing_interval]);
  const status = me?.subscription_status ?? null;

  const renewal = me?.current_period_end ?? null;
  const cancelAtPeriodEnd = Boolean(me?.cancel_at_period_end);

  const seats = Number(me?.seats ?? 1);
  const isTeam = String(me?.plan ?? "").toLowerCase() === "team";
  const isPaid = String(me?.plan ?? "").toLowerCase() !== "free" && Boolean(status);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.replace("/auth");
  }

  async function openBillingPortal(flow: BillingPortalFlow = "default") {
    setBillingLoadingFlow(flow);
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(flow === "default" ? {} : { flow }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Could not open billing portal");
      if (!json?.url) throw new Error("No portal URL returned");
      window.location.href = json.url;
    } catch (error: unknown) {
      toast.error("Billing", errorMessage(error, "Something went wrong"));
      setBillingLoadingFlow(null);
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
    } catch (error: unknown) {
      toast.error("Settings", errorMessage(error, "Something went wrong"));
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
    } catch (error: unknown) {
      toast.error("Password", errorMessage(error, "Something went wrong"));
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
      window.location.replace("/");
    } catch (error: unknown) {
      toast.error("Delete", errorMessage(error, "Something went wrong"));
    } finally {
      setDeleteLoading(false);
    }
  }

  const workspaceId = me?.primary_workspace_id ?? null;
  const usage = me?.usage ?? null;
  const usagePercent = Math.max(0, Math.min(100, usage?.percent ?? 0));
  const usageTone = usage?.at_limit ? "#b91c1c" : usage?.near_limit ? "#c2410c" : "var(--fg)";
  const usageWindowLabel =
    usage?.window === "monthly" ? "this month" : usage?.window === "total" ? "lifetime" : "current cycle";

  const usageSnapshot = useMemo(() => {
    const now = Date.now();
    const windowMs = 1000 * 60 * 60 * 24 * 30;
    const recent = usageDocs.filter((d) => {
      const t = new Date(d.createdAt).getTime();
      return Number.isFinite(t) && now - t <= windowMs;
    });
    const recentAcks = recent.reduce((sum, d) => sum + Math.max(0, Number(d.acknowledgements || 0)), 0);
    const total = usageDocs.length;
    const acknowledged = usageDocs.filter((d) => d.status === "Acknowledged").length;
    const pending = usageDocs.filter((d) => d.status === "Pending").length;
    const pendingRate = total === 0 ? 0 : Math.round((pending / total) * 100);
    return {
      docsLast30Days: recent.length,
      acknowledgementsLast30Days: recentAcks,
      total,
      acknowledged,
      pending,
      pendingRate,
    };
  }, [usageDocs]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
            {firstName ? `${firstName}'s account` : "Account"}
          </h1>
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
      <div className="text-xs tracking-wide" style={{ color: "var(--muted)" }}>
        {meLoading ? "Loading account status…" : `Status: ${status ? statusLabel(status) : plan}`}
        {!meLoading ? ` · Plan: ${plan}` : ""}
        {isPaid ? ` · ${interval}` : ""}
        {isTeam ? ` · ${seats} seats` : ""}
        {renewal ? ` · ${cancelAtPeriodEnd ? "Cancels" : "Renews"} ${formatDate(renewal)}` : ""}
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
          <Button onClick={() => void openBillingPortal("default")} disabled={billingLoadingFlow !== null}>
            {billingLoadingFlow === "default" ? "Opening…" : "Manage billing"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => void openBillingPortal("payment_method_update")}
            disabled={billingLoadingFlow !== null}
          >
            {billingLoadingFlow === "payment_method_update" ? "Opening…" : "Update payment method"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => void openBillingPortal("subscription_update")}
            disabled={billingLoadingFlow !== null}
          >
            {billingLoadingFlow === "subscription_update" ? "Opening…" : "Change plan or seats"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => void openBillingPortal("subscription_cancel")}
            disabled={billingLoadingFlow !== null}
          >
            {billingLoadingFlow === "subscription_cancel" ? "Opening…" : "Cancel subscription"}
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

      {/* Usage */}
      {!isLicensedDisplayPlan ? (
      <Section
        title="Usage"
        subtitle="Your current usage and recent account activity snapshot."
      >
        <div
          className="border p-5"
          style={{ borderColor: "var(--border)", borderRadius: 12, background: "var(--card)" }}
        >
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>
              PLAN USAGE
            </div>
            <div className="text-xs font-semibold" style={{ color: usageTone }}>
              {plan.toUpperCase()}
            </div>
          </div>

          <div className="mt-2 text-sm" style={{ color: usageTone }}>
            {usage?.limit == null
              ? "Custom usage policy."
              : usage.at_limit
                ? `Limit reached: ${usage.used}/${usage.limit} receipts used ${usageWindowLabel}.`
                : usage.near_limit
                  ? `Near limit: ${usage.used}/${usage.limit} receipts used ${usageWindowLabel}.`
                  : `${usage.used}/${usage.limit} receipts used ${usageWindowLabel}.`}
          </div>

          <div className="mt-3 h-2.5 w-full overflow-hidden" style={{ background: "var(--card2)", borderRadius: 999 }}>
            <div
              style={{
                width: `${usagePercent}%`,
                background: usageTone,
                height: "100%",
                transition: "width 180ms ease",
              }}
            />
          </div>

          <div className="mt-2 text-xs" style={{ color: "var(--muted2)" }}>
            {usage?.limit == null
              ? "Usage is governed by your current plan policy."
              : usage.remaining === 0
                ? "No receipts remaining in this window."
                : `${usage.remaining} receipts remaining ${usageWindowLabel}.`}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="border p-4" style={{ borderColor: "var(--border)", borderRadius: 12, background: "var(--card)" }}>
            <div className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>DOCS (30 DAYS)</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight">{usageSnapshot.docsLast30Days}</div>
          </div>
          <div className="border p-4" style={{ borderColor: "var(--border)", borderRadius: 12, background: "var(--card)" }}>
            <div className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>ACKS (30 DAYS)</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight">{usageSnapshot.acknowledgementsLast30Days}</div>
          </div>
          <div className="border p-4" style={{ borderColor: "var(--border)", borderRadius: 12, background: "var(--card)" }}>
            <div className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>TOTAL DOCUMENTS</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight">{usageSnapshot.total}</div>
          </div>
          <div className="border p-4" style={{ borderColor: "var(--border)", borderRadius: 12, background: "var(--card)" }}>
            <div className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>PENDING RATE</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight">{usageSnapshot.pendingRate}%</div>
          </div>
        </div>
      </Section>
      ) : null}

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
          <Button onClick={() => void openBillingPortal("default")} disabled={billingLoadingFlow !== null}>
            {billingLoadingFlow === "default" ? "Opening…" : "Open customer portal"}
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
