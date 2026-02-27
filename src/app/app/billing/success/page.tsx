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

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>
      {children}
    </label>
  );
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
          // Fallback sync for cases where webhook delivery is delayed or misconfigured.
          await fetch("/api/billing/sync-session", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ sessionId }),
          }).catch(() => null);
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
    <main className="app-entry-shell space-y-6 py-2 md:py-4">
      <section
        className="mx-auto max-w-3xl border p-6 md:p-7"
        style={{ borderColor: "var(--border)", background: "var(--card)", borderRadius: 14 }}
      >
        <div className="text-xs tracking-widest" style={{ color: "var(--muted2)" }}>
          BILLING
        </div>
        <h1 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight">
          {status === "loading"
            ? "Finalising subscription"
            : status === "ok"
              ? teamOnboarding
                ? "Set up your team workspace"
                : "Subscription confirmed"
              : "Could not confirm subscription"}
        </h1>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
          {status === "loading"
            ? "We are confirming your plan and syncing account access."
            : status === "ok" && !teamOnboarding
              ? "Payment is confirmed. You can continue to your dashboard."
              : status === "ok"
                ? "Create your workspace, then invite your team members. You can skip invites and do that later."
                : "Please refresh this page or check billing in account settings."}
        </p>
        {sessionId ? (
          <div className="mt-3 text-xs break-all" style={{ color: "var(--muted2)" }}>
            Session: <span style={{ color: "var(--fg)" }}>{sessionId}</span>
          </div>
        ) : null}
      </section>

      {error ? (
        <section
          className="mx-auto max-w-3xl border p-4 text-sm"
          style={{ borderColor: "rgba(255,59,48,0.35)", background: "var(--card)", borderRadius: 12, color: "#ff3b30" }}
        >
          {error}
        </section>
      ) : null}

      {teamOnboarding && status === "ok" ? (
        <section
          className="mx-auto max-w-3xl border p-6 md:p-7 space-y-5"
          style={{ borderColor: "var(--border)", background: "var(--card)", borderRadius: 14 }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            <div style={{ color: workspaceIdentifier ? "var(--muted2)" : "var(--fg)" }}>
              1. Create workspace
            </div>
            <div style={{ color: workspaceIdentifier ? "var(--fg)" : "var(--muted2)" }}>
              2. Invite members
            </div>
          </div>

          {!workspaceIdentifier ? (
            <div
              className="border p-4 md:p-5"
              style={{ borderColor: "var(--border)", background: "transparent", borderRadius: 12 }}
            >
              <FieldLabel>WORKSPACE NAME</FieldLabel>
              <input
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder="e.g. Acme Legal"
                className="mt-2 w-full border px-3 py-2.5 text-sm bg-transparent focus-ring"
                style={{ borderColor: "var(--border)", borderRadius: 10 }}
              />
              <div className="mt-2 text-xs" style={{ color: "var(--muted2)" }}>
                This becomes your shared team space for members, documents, and settings.
              </div>
              <button
                type="button"
                onClick={() => void createWorkspace()}
                disabled={creatingWorkspace || !workspaceName.trim()}
                className="mt-4 focus-ring px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
                style={{ background: "var(--fg)", color: "var(--bg)", borderRadius: 10 }}
              >
                {creatingWorkspace ? "Creating…" : "Create workspace"}
              </button>
            </div>
          ) : (
            <div
              className="border p-3 text-sm"
              style={{ borderColor: "var(--border)", background: "transparent", borderRadius: 10, color: "var(--muted)" }}
            >
              Workspace ready: <span style={{ color: "var(--fg)" }}>{workspaceIdentifier}</span>
            </div>
          )}

          <div>
            <FieldLabel>TEAM EMAILS (COMMA-SEPARATED)</FieldLabel>
            <textarea
              value={inviteInput}
              onChange={(e) => setInviteInput(e.target.value)}
              placeholder="sam@company.com, jordan@company.com"
              rows={4}
              className="mt-2 w-full border px-3 py-2.5 text-sm bg-transparent focus-ring resize-y"
              style={{ borderColor: "var(--border)", borderRadius: 10 }}
            />
            <div className="mt-2 text-xs" style={{ color: "var(--muted2)" }}>
              Each invite sends a secure access email. You can add or remove members later.
            </div>
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
        </section>
      ) : (
        <section
          className="border p-6 md:p-7"
          style={{ borderColor: "var(--border)", background: "var(--card)", borderRadius: 14 }}
        >
          <div className="flex gap-2 flex-wrap">
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
        </section>
      )}
    </main>
  );
}
