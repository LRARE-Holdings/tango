"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type UsagePayload = {
  usage?: {
    plan: "free" | "personal" | "pro" | "team" | "enterprise";
    count_by: "user" | "workspace";
    used: number;
    limit: number | null;
    remaining: number | null;
    percent: number | null;
    window: "total" | "monthly" | "custom";
    near_limit: boolean;
    at_limit: boolean;
  };
  counts?: {
    documents_total: number;
    documents_pending: number;
    documents_acknowledged: number;
  };
};

type EffectivePlan = "free" | "personal" | "pro" | "team" | "enterprise";

function planLabel(plan: EffectivePlan) {
  if (plan === "free") return "Free";
  if (plan === "personal") return "Personal";
  if (plan === "pro") return "Pro";
  if (plan === "team") return "Team";
  return "Enterprise";
}

export default function WorkspaceUsageSettingsPage() {
  const params = useParams<{ id?: string }>();
  const workspaceIdentifier = typeof params?.id === "string" ? params.id.trim() : "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<UsagePayload | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      if (!workspaceIdentifier) {
        setError("Invalid workspace.");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/app/workspaces/${encodeURIComponent(workspaceIdentifier)}/dashboard?scope=workspace`,
          { cache: "no-store" }
        );
        const json = (await res.json().catch(() => null)) as UsagePayload | { error?: string } | null;
        if (!res.ok) throw new Error((json as { error?: string } | null)?.error ?? "Failed to load usage");
        if (!alive) return;
        setData(json as UsagePayload);
      } catch (e: unknown) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Failed to load usage");
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [workspaceIdentifier]);

  const usage = data?.usage ?? null;
  const percent = Math.max(0, Math.min(100, usage?.percent ?? 0));
  const tone = usage?.at_limit ? "#b91c1c" : usage?.near_limit ? "#c2410c" : "var(--fg)";
  const windowLabel = usage?.window === "monthly" ? "this month" : usage?.window === "total" ? "lifetime" : "current cycle";
  const scopeLabel = usage?.count_by === "workspace" ? "workspace" : "account";

  const summary = useMemo(() => {
    if (!usage) return "Loading usage…";
    if (usage.limit == null) return `${planLabel(usage.plan)} plan (${scopeLabel}) has a custom usage policy.`;
    if (usage.at_limit) return `Limit reached: ${usage.used}/${usage.limit} receipts used ${windowLabel}.`;
    if (usage.near_limit) return `Near limit: ${usage.used}/${usage.limit} receipts used ${windowLabel}.`;
    return `${usage.used}/${usage.limit} receipts used ${windowLabel}.`;
  }, [scopeLabel, usage, windowLabel]);

  return (
    <div className="space-y-5">
      <section
        className="border p-6 md:p-7"
        style={{ borderColor: "var(--border)", background: "var(--card)", borderRadius: 16 }}
      >
        <div className="text-xs font-semibold tracking-widest" style={{ color: "var(--muted2)" }}>
          USAGE
        </div>
        <h2 className="mt-2 text-lg font-semibold">Plan boundaries and consumption</h2>
        <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
          Admin-only usage visibility. Members do not see plan boundaries in the dashboard.
        </p>

        {loading ? (
          <div className="mt-4 text-sm" style={{ color: "var(--muted)" }}>
            Loading usage…
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 text-sm" style={{ color: "#b91c1c" }}>
            {error}
          </div>
        ) : null}

        {!loading && !error ? (
          <>
            <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="text-sm font-semibold" style={{ color: tone }}>
                {summary}
              </div>
              <div className="text-xs font-semibold" style={{ color: tone }}>
                {usage ? `${planLabel(usage.plan)} plan` : "—"}
              </div>
            </div>

            <div className="mt-3 h-2.5 w-full overflow-hidden" style={{ background: "var(--card2)", borderRadius: 999 }}>
              <div
                style={{
                  width: `${percent}%`,
                  background: tone,
                  height: "100%",
                  transition: "width 180ms ease",
                }}
              />
            </div>

            <div className="mt-2 text-xs" style={{ color: "var(--muted2)" }}>
              {usage?.limit == null
                ? "Usage is governed by a custom plan policy."
                : usage.remaining === 0
                  ? "No receipts remaining in the current window."
                  : `${usage.remaining} receipts remaining ${windowLabel}.`}
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
