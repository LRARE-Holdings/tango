"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Status = "loading" | "ok" | "error";
type MeSummary = {
  plan?: string | null;
  subscription_status?: string | null;
  primary_workspace_id?: string | null;
};

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function parseInviteEmails(value: string) {
  const list = value
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set(list));
}

function isEligibleTeamCustomer(me: MeSummary | null) {
  if (!me) return false;
  const plan = String(me.plan ?? "").toLowerCase();
  const subscriptionStatus = String(me.subscription_status ?? "").toLowerCase();
  return plan === "team" && (subscriptionStatus === "active" || subscriptionStatus === "trialing");
}

export default function BillingSuccessPage() {
  const router = useRouter();
  const params = useSearchParams();

  const sessionId = useMemo(() => params.get("session_id"), [params]);

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<MeSummary | null>(null);
  const [workspaceIdentifier, setWorkspaceIdentifier] = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState("");
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [inviteInput, setInviteInput] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let redirectTimer: number | null = null;

    async function run() {
      try {
        if (sessionId) {
          // Refresh app state (plan/tier) so UI updates immediately after Stripe redirect.
          await fetch("/api/app/me", { cache: "no-store" }).catch(() => {});
        }

        const meRes = await fetch("/api/app/me", { cache: "no-store" });
        const meJson = meRes.ok ? ((await meRes.json()) as MeSummary) : null;
        if (!alive) return;

        setMe(meJson);
        setWorkspaceIdentifier(
          typeof meJson?.primary_workspace_id === "string" && meJson.primary_workspace_id.length > 0
            ? meJson.primary_workspace_id
            : null
        );
        setStatus("ok");

        if (!isEligibleTeamCustomer(meJson)) {
          redirectTimer = window.setTimeout(() => {
            router.replace("/app");
          }, 1200);
        }
      } catch (e: unknown) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Could not confirm billing");
        setStatus("error");
      }
    }

    run();
    return () => {
      alive = false;
      if (redirectTimer) window.clearTimeout(redirectTimer);
    };
  }, [router, sessionId]);

  const teamOnboarding = isEligibleTeamCustomer(me);

  async function createWorkspace() {
    setInviteMsg(null);
    setError(null);

    if (!workspaceName.trim()) {
      setError("Workspace name is required.");
      return;
    }

    setCreatingWorkspace(true);
    try {
      const res = await fetch("/api/app/workspaces", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: workspaceName.trim() }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to create workspace");

      const id = json?.workspace?.id;
      const slug = json?.workspace?.slug;
      const identifier = typeof slug === "string" && slug.trim().length > 0 ? slug : id;
      if (!identifier) throw new Error("No workspace returned");

      setWorkspaceIdentifier(identifier);
      setInviteMsg("Workspace created. You can now send invites.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not create workspace");
    } finally {
      setCreatingWorkspace(false);
    }
  }

  async function sendInvites() {
    setInviteMsg(null);
    setError(null);

    if (!workspaceIdentifier) {
      setError("Create a workspace first.");
      return;
    }

    const emails = parseInviteEmails(inviteInput);
    if (emails.length === 0) {
      setError("Enter at least one email, separated by commas.");
      return;
    }

    const invalid = emails.filter((x) => !isEmail(x));
    if (invalid.length > 0) {
      setError("Enter valid emails separated by commas.");
      return;
    }

    setInviting(true);
    try {
      const results = await Promise.all(
        emails.map(async (email) => {
          const res = await fetch(`/api/app/workspaces/${encodeURIComponent(workspaceIdentifier)}/invite`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email, role: "member" }),
          });
          const json = await res.json().catch(() => null);
          return {
            email,
            ok: res.ok,
            error: json?.error ?? "Invite failed",
          };
        })
      );

      const failed = results.filter((r) => !r.ok);
      const sent = results.length - failed.length;

      if (failed.length > 0) {
        setError(
          `${sent} sent, ${failed.length} failed. ${failed
            .slice(0, 2)
            .map((f) => `${f.email}: ${f.error}`)
            .join(" ")}`
        );
      } else {
        setInviteMsg(sent === 1 ? "Invite sent." : `${sent} invites sent.`);
        setInviteInput("");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not send invites");
    } finally {
      setInviting(false);
    }
  }

  function continueToApp() {
    if (workspaceIdentifier) {
      router.replace(`/app/workspaces/${workspaceIdentifier}/members`);
      return;
    }
    router.replace("/app/workspaces/new");
  }

  return (
    <main className="min-h-[70vh] flex items-center justify-center px-6">
      <div
        className="w-full max-w-lg border p-6 md:p-8"
        style={{ borderColor: "var(--border)", background: "var(--card)", borderRadius: 12 }}
      >
        <div className="text-xs tracking-widest" style={{ color: "var(--muted2)" }}>
          BILLING
        </div>

        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {status === "loading"
            ? "Finalising…"
            : status === "ok"
              ? teamOnboarding
                ? "Invite your team"
                : "You’re all set."
              : "Something went wrong."}
        </h1>

        <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
          {status === "loading"
            ? "Just confirming your subscription. One moment."
            : status === "ok" && !teamOnboarding
              ? "Payment confirmed. Taking you back to your dashboard."
              : status === "ok"
                ? "Your Team plan is active (or trialing). Invite teammates with comma-separated emails."
                : "We couldn’t confirm your purchase automatically. Your payment may still have gone through."}
        </p>

        {sessionId ? (
          <div className="mt-4 text-xs" style={{ color: "var(--muted2)" }}>
            Session: <span style={{ color: "var(--fg)" }}>{sessionId}</span>
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 text-sm" style={{ color: "#ff3b30" }}>
            {error}
          </div>
        ) : null}

        {teamOnboarding && status === "ok" ? (
          <div className="mt-6 space-y-4">
            {!workspaceIdentifier ? (
              <div className="border p-4" style={{ borderColor: "var(--border)", borderRadius: 10 }}>
                <label className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>
                  WORKSPACE NAME
                </label>
                <input
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder="e.g. Acme Legal"
                  className="mt-2 w-full border px-3 py-2.5 text-sm bg-transparent focus-ring"
                  style={{ borderColor: "var(--border)", borderRadius: 10 }}
                />
                <button
                  type="button"
                  onClick={() => void createWorkspace()}
                  disabled={creatingWorkspace || !workspaceName.trim()}
                  className="mt-3 focus-ring px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
                  style={{ background: "var(--fg)", color: "var(--bg)", borderRadius: 10 }}
                >
                  {creatingWorkspace ? "Creating…" : "Create workspace"}
                </button>
              </div>
            ) : (
              <div className="text-xs" style={{ color: "var(--muted2)" }}>
                Workspace ready: <span style={{ color: "var(--fg)" }}>{workspaceIdentifier}</span>
              </div>
            )}

            <div>
              <label className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>
                TEAM EMAILS (COMMA-SEPARATED)
              </label>
              <textarea
                value={inviteInput}
                onChange={(e) => setInviteInput(e.target.value)}
                placeholder="sam@company.com, jordan@company.com"
                rows={4}
                className="mt-2 w-full border px-3 py-2.5 text-sm bg-transparent focus-ring resize-y"
                style={{ borderColor: "var(--border)", borderRadius: 10 }}
              />
            </div>

            {inviteMsg ? (
              <div className="text-sm" style={{ color: "var(--muted)" }}>
                {inviteMsg}
              </div>
            ) : null}

            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => void sendInvites()}
                disabled={inviting || !workspaceIdentifier}
                className="focus-ring px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
                style={{ background: "var(--fg)", color: "var(--bg)", borderRadius: 10 }}
              >
                {inviting ? "Sending…" : "Send invites"}
              </button>
              <button
                type="button"
                onClick={continueToApp}
                className="focus-ring px-4 py-2 text-sm font-medium hover:opacity-80"
                style={{ border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 10 }}
              >
                Continue
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-6 flex gap-2 flex-wrap">
            <Link
              href="/app"
              className="focus-ring px-4 py-2 text-sm font-semibold hover:opacity-90"
              style={{ background: "var(--fg)", color: "var(--bg)", borderRadius: 10 }}
            >
              Go to dashboard
            </Link>
            <Link
              href="/app/account"
              className="focus-ring px-4 py-2 text-sm font-medium hover:opacity-80"
              style={{ border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 10 }}
            >
              Manage billing
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
