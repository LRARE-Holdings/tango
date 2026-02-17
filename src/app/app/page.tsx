"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/toast";

type DocItem = {
  id: string;
  title: string;
  publicId: string;
  createdAt: string;
  acknowledgements: number;
  latestAcknowledgedAt: string | null;
  status: "Acknowledged" | "Pending";
};

type Plan = "free" | "personal" | "pro" | "team" | "enterprise";

type MeResponse = {
  plan?: string | null;
  display_plan?: string | null;
  workspace_license_active?: boolean | null;
  workspace_plan?: string | null;
  subscription_status?: string | null;
  billing_interval?: string | null;
  seats?: number | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean | null;
  is_paid?: boolean | null;
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

type WorkspaceDashboard = {
  scope?: "workspace" | "personal";
  viewer?: {
    role?: "owner" | "admin" | "member";
  };
  workspace?: {
    id: string;
    name: string;
    slug: string | null;
  };
  counts: {
    members: number;
    invites_pending: number;
    documents_total: number;
    documents_pending: number;
    documents_acknowledged: number;
    completions_total: number;
    acknowledgements_total: number;
  };
  averages: {
    max_scroll_percent: number | null;
    time_on_page_seconds: number | null;
    active_seconds: number | null;
  };
  activity: Array<{
    type: "document_created" | "completion_submitted";
    at: string;
    acknowledged?: boolean;
    document?: { title?: string; public_id?: string };
    recipient?: { name?: string | null; email?: string | null };
  }>;
};

type StatusFilter = "All" | "Pending" | "Acknowledged";
type SortKey = "Newest" | "Oldest" | "Most acknowledgements" | "Least acknowledgements";

function normalizePlan(input: string | null | undefined): Plan {
  const p = String(input ?? "")
    .trim()
    .toLowerCase();
  if (p === "personal" || p === "pro" || p === "team" || p === "enterprise") return p;
  return "free";
}

function planDisplayLabel(input: string | null | undefined) {
  const p = String(input ?? "").trim().toLowerCase();
  if (p === "licensed") return "LICENSED";
  if (p === "personal") return "PERSONAL";
  if (p === "pro") return "PRO";
  if (p === "team") return "TEAM";
  if (p === "enterprise") return "ENTERPRISE";
  return "FREE";
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi} UTC`;
}

function normalizeQuery(q: string) {
  return q.trim().toLowerCase().replace(/\s+/g, " ");
}

function formatPercent(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${Math.round(value)}%`;
}

function formatDuration(seconds: number | null | undefined) {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return "—";
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${String(rem).padStart(2, "0")}s`;
}

function StatusBadge({ status }: { status: DocItem["status"] }) {
  const style =
    status === "Acknowledged"
      ? { background: "var(--fg)", color: "var(--bg)" }
      : { background: "transparent", color: "var(--muted)", border: "1px solid var(--border)" };

  return (
    <span className="inline-flex items-center px-2.5 py-1 text-xs font-semibold" style={{ borderRadius: 10, ...style }}>
      {status}
    </span>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="border p-4" style={{ borderColor: "var(--border)", borderRadius: 12, background: "var(--card)" }}>
      <div className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
      {hint ? (
        <div className="mt-2 text-xs" style={{ color: "var(--muted2)" }}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}

export default function AppHome() {
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocItem[]>([]);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [workspaceAnalytics, setWorkspaceAnalytics] = useState<WorkspaceDashboard | null>(null);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [sortKey, setSortKey] = useState<SortKey>("Newest");

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copiedTimerRef = useRef<number | null>(null);

  const plan = normalizePlan(me?.plan);
  const planDisplay = planDisplayLabel(me?.display_plan ?? me?.plan);
  const personalPlus = plan !== "free";
  const proPlus = plan === "pro" || plan === "team" || plan === "enterprise";
  const workspacePlus = plan === "team" || plan === "enterprise";
  const primaryWorkspaceId = String(me?.primary_workspace_id ?? "").trim() || null;
  const mode = primaryWorkspaceId ? "WORKSPACE MODE" : "PERSONAL MODE";
  const usage = me?.usage ?? null;
  const usagePercent = Math.max(0, Math.min(100, usage?.percent ?? 0));
  const usageTone = usage?.at_limit ? "#b91c1c" : usage?.near_limit ? "#c2410c" : "var(--fg)";
  const workspaceViewerRole = workspaceAnalytics?.viewer?.role ?? null;
  const shouldShowUsageCard =
    !workspacePlus ||
    !primaryWorkspaceId ||
    workspaceViewerRole === "owner" ||
    workspaceViewerRole === "admin";

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      setWorkspaceAnalytics(null);

      try {
        const meRes = await fetch("/api/app/me", { cache: "no-store" });
        const meJson = meRes.ok ? ((await meRes.json()) as MeResponse) : null;
        setMe(meJson);

        const docsRes = await fetch("/api/app/documents", { cache: "no-store" });
        const docsJson = await docsRes.json().catch(() => null);
        if (!docsRes.ok) throw new Error(docsJson?.error ?? "Failed to load dashboard");
        setDocuments((docsJson?.documents ?? []) as DocItem[]);

        const p = normalizePlan(meJson?.plan);
        const wsId = String(meJson?.primary_workspace_id ?? "").trim();
        if ((p === "team" || p === "enterprise") && wsId) {
          const wsRes = await fetch(`/api/app/workspaces/${encodeURIComponent(wsId)}/dashboard?scope=workspace`, {
            cache: "no-store",
          });
          const wsJson = (await wsRes.json().catch(() => null)) as WorkspaceDashboard | { error?: string } | null;
          if (wsRes.ok) {
            setWorkspaceAnalytics(wsJson as WorkspaceDashboard);
          }
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
    };
  }, []);

  const counts = useMemo(() => {
    const acknowledged = documents.filter((d) => d.status === "Acknowledged").length;
    const pending = documents.filter((d) => d.status === "Pending").length;
    return { total: documents.length, acknowledged, pending };
  }, [documents]);

  const acknowledgementRate = useMemo(() => {
    if (counts.total === 0) return 0;
    return Math.round((counts.acknowledged / counts.total) * 100);
  }, [counts.acknowledged, counts.total]);

  const recentWindowStats = useMemo(() => {
    const now = Date.now();
    const windowMs = 1000 * 60 * 60 * 24 * 30;
    const recent = documents.filter((d) => {
      const t = new Date(d.createdAt).getTime();
      return Number.isFinite(t) && now - t <= windowMs;
    });
    const recentAcks = recent.reduce((sum, d) => sum + d.acknowledgements, 0);
    return {
      docsLast30Days: recent.length,
      acknowledgementsLast30Days: recentAcks,
    };
  }, [documents]);

  const topDocuments = useMemo(() => {
    return [...documents]
      .sort((a, b) => b.acknowledgements - a.acknowledgements)
      .slice(0, 5);
  }, [documents]);

  const filtered = useMemo(() => {
    const q = normalizeQuery(query);
    let list = documents;

    if (statusFilter !== "All") list = list.filter((d) => d.status === statusFilter);

    if (q) {
      list = list.filter((d) => {
        const hay = `${d.title ?? ""} ${d.publicId ?? ""}`.toLowerCase();
        return hay.includes(q);
      });
    }

    const byCreatedAt = (a: DocItem, b: DocItem) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    const byAcks = (a: DocItem, b: DocItem) => a.acknowledgements - b.acknowledgements;

    return [...list].sort((a, b) => {
      switch (sortKey) {
        case "Newest":
          return -byCreatedAt(a, b);
        case "Oldest":
          return byCreatedAt(a, b);
        case "Most acknowledgements":
          return -byAcks(a, b);
        case "Least acknowledgements":
          return byAcks(a, b);
        default:
          return 0;
      }
    });
  }, [documents, query, statusFilter, sortKey]);

  const planCapabilities = useMemo(() => {
    if (plan === "enterprise") return ["Workspace analytics", "Team management", "Advanced governance"];
    if (plan === "team") return ["Workspace analytics", "Seat management", "Team collaboration"];
    if (plan === "pro") return ["Templates", "Saved defaults", "Higher automation controls"];
    if (plan === "personal") return ["Email sending", "Password-protected links", "Identity requirement"];
    return ["Core document sharing", "Basic acknowledgement tracking", "Personal dashboard"];
  }, [plan]);

  function clear() {
    setQuery("");
    setStatusFilter("All");
    setSortKey("Newest");
  }

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <div className="text-xs font-semibold tracking-widest" style={{ color: "var(--muted2)" }}>
            DASHBOARD
          </div>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Account overview</h1>
            <span
              className="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide"
              style={{ borderColor: "var(--border)", color: "var(--muted)" }}
            >
              {mode}
            </span>
            <span
              className="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide"
              style={{ borderColor: "var(--border)", color: "var(--muted)" }}
            >
              {planDisplay}
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
            {workspacePlus
              ? "Workspace and account metrics in one place."
              : "Your account, entitlements, and document performance at a glance."}
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            href="/app/new"
            className="focus-ring px-3 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ background: "var(--fg)", color: "var(--bg)", borderRadius: 10 }}
          >
            Create receipt
          </Link>
          {workspacePlus && primaryWorkspaceId ? (
            <Link
              href={`/app/workspaces/${primaryWorkspaceId}/dashboard`}
              className="focus-ring px-3 py-2 text-sm font-medium transition-opacity hover:opacity-80"
              style={{ border: "1px solid var(--border)", borderRadius: 10, color: "var(--muted)" }}
            >
              Workspace dashboard
            </Link>
          ) : null}
        </div>
      </div>

      {!loading && !error ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <StatCard label="Plan" value={planDisplay} hint={me?.subscription_status ?? "No active subscription"} />
          <StatCard label="Documents" value={String(counts.total)} hint={`${counts.pending} pending • ${counts.acknowledged} acknowledged`} />
          <StatCard label="Acknowledgement Rate" value={`${acknowledgementRate}%`} hint="Acknowledged documents / total documents" />
          <StatCard
            label="Period End"
            value={formatDate(me?.current_period_end)}
            hint={me?.cancel_at_period_end ? "Cancels at period end" : "Renews automatically"}
          />
        </div>
      ) : null}

      {!loading && !error && shouldShowUsageCard ? (
        <div className="border p-5" style={{ borderColor: "var(--border)", borderRadius: 12, background: "var(--card)" }}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>
              PLAN USAGE
            </div>
              <div className="text-xs font-semibold" style={{ color: usageTone }}>
              {planDisplay}
              </div>
          </div>

          <div className="mt-2 text-sm" style={{ color: usageTone }}>
            {usage?.limit == null
              ? "Custom usage limit."
              : usage.at_limit
                ? `Limit reached: ${usage.used}/${usage.limit} receipts used.`
                : usage.near_limit
                  ? `Near limit: ${usage.used}/${usage.limit} receipts used.`
                  : `${usage.used}/${usage.limit} receipts used.`}
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
              ? "Usage is governed by your custom plan."
              : usage.remaining === 0
                ? "You are at your plan limit."
                : `${usage?.remaining ?? 0} receipts remaining.`}
          </div>
        </div>
      ) : null}

      {!loading && !error ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="border p-5" style={{ borderColor: "var(--border)", borderRadius: 12, background: "var(--card)" }}>
            <div className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>
              ENTITLEMENTS
            </div>
            <div className="mt-2 text-sm font-semibold">What your plan includes</div>
            <div className="mt-3 space-y-2 text-sm" style={{ color: "var(--muted)" }}>
              {planCapabilities.map((cap) => (
                <div key={cap}>• {cap}</div>
              ))}
            </div>
            <div className="mt-4 text-xs" style={{ color: "var(--muted2)" }}>
              Billing interval: {me?.billing_interval ?? "—"} • Seats: {String(me?.seats ?? 1)}
            </div>
            {!me?.is_paid ? (
              <div className="mt-4">
                <Link
                  href="/pricing"
                  className="focus-ring inline-flex items-center justify-center px-3 py-2 text-sm font-semibold"
                  style={{ border: "1px solid var(--border)", borderRadius: 10, color: "var(--muted)" }}
                >
                  Explore upgrades
                </Link>
              </div>
            ) : null}
          </div>

          <div className="border p-5" style={{ borderColor: "var(--border)", borderRadius: 12, background: "var(--card)" }}>
            <div className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>
              PERFORMANCE SNAPSHOT
            </div>
            <div className="mt-2 text-sm font-semibold">
              {personalPlus ? "Recent activity" : "Basic usage"}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm" style={{ color: "var(--muted)" }}>
              <div>Docs (30 days): {recentWindowStats.docsLast30Days}</div>
              <div>Acks (30 days): {recentWindowStats.acknowledgementsLast30Days}</div>
              <div>Total pending: {counts.pending}</div>
              <div>Total acknowledged: {counts.acknowledged}</div>
            </div>
            {personalPlus ? (
              <div className="mt-3 text-xs" style={{ color: "var(--muted2)" }}>
                Personal+ unlocks richer delivery controls and better follow-through tracking.
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {!loading && !error && proPlus ? (
        <div className="border p-5" style={{ borderColor: "var(--border)", borderRadius: 12, background: "var(--card)" }}>
          <div className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>
            PRO INSIGHTS
          </div>
          <div className="mt-2 text-sm font-semibold">Top documents by acknowledgements</div>
          <div className="mt-3 space-y-2">
            {topDocuments.length === 0 ? (
              <div className="text-sm" style={{ color: "var(--muted)" }}>
                No document activity yet.
              </div>
            ) : (
              topDocuments.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">{d.title}</span>
                  <span style={{ color: "var(--muted)" }}>{d.acknowledgements} acknowledgements</span>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      {!loading && !error && workspacePlus ? (
        <div className="border p-5" style={{ borderColor: "var(--border)", borderRadius: 12, background: "var(--card)" }}>
          <div className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>
            TEAM / ENTERPRISE ANALYTICS
          </div>
          {workspaceAnalytics ? (
            <>
              <div className="mt-2 text-sm font-semibold">
                {workspaceAnalytics.workspace?.name ?? "Workspace"} analytics
              </div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                <StatCard label="Members" value={String(workspaceAnalytics.counts.members)} hint={`${workspaceAnalytics.counts.invites_pending} invites pending`} />
                <StatCard label="Completions" value={String(workspaceAnalytics.counts.completions_total)} hint={`${workspaceAnalytics.counts.acknowledgements_total} acknowledgements`} />
                <StatCard label="Avg Scroll" value={formatPercent(workspaceAnalytics.averages.max_scroll_percent)} hint="Across recent completions" />
                <StatCard label="Avg Time On Page" value={formatDuration(workspaceAnalytics.averages.time_on_page_seconds)} hint={`Active: ${formatDuration(workspaceAnalytics.averages.active_seconds)}`} />
              </div>

              <div className="mt-4">
                <div className="text-sm font-semibold">Recent workspace activity</div>
                <div className="mt-2 space-y-2">
                  {(workspaceAnalytics.activity ?? []).slice(0, 5).map((item, idx) => (
                    <div key={`${item.type}-${item.at}-${idx}`} className="text-sm" style={{ color: "var(--muted)" }}>
                      {item.type === "document_created"
                        ? `Document created: ${item.document?.title ?? "Untitled"}`
                        : `Completion submitted: ${item.document?.title ?? "Untitled"}${item.acknowledged ? " (acknowledged)" : ""}`}{" "}
                      • {formatDate(item.at)}
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
              Select an active workspace to view team analytics.
            </div>
          )}
        </div>
      ) : null}

      {!loading && !error && documents.length > 0 && (
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex-1 flex items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title or public ID…"
              className="focus-ring w-full px-4 py-3 text-sm bg-transparent"
              style={{ border: "1px solid var(--border)", borderRadius: 10 }}
            />
            {(query.trim() || statusFilter !== "All" || sortKey !== "Newest") ? (
              <button
                type="button"
                onClick={clear}
                className="focus-ring px-3 py-3 text-sm transition-opacity hover:opacity-80"
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  color: "var(--muted)",
                  background: "transparent",
                  whiteSpace: "nowrap",
                }}
              >
                Reset
              </button>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="focus-ring px-3 py-3 text-sm bg-transparent"
              style={{ border: "1px solid var(--border)", borderRadius: 10 }}
            >
              <option value="All">All</option>
              <option value="Pending">Pending</option>
              <option value="Acknowledged">Acknowledged</option>
            </select>

            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="focus-ring px-3 py-3 text-sm bg-transparent"
              style={{ border: "1px solid var(--border)", borderRadius: 10 }}
            >
              <option value="Newest">Newest</option>
              <option value="Oldest">Oldest</option>
              <option value="Most acknowledgements">Most acknowledgements</option>
              <option value="Least acknowledgements">Least acknowledgements</option>
            </select>
          </div>
        </div>
      )}

      {loading && <div className="text-sm" style={{ color: "var(--muted)" }}>Loading…</div>}

      {error && (
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          <div className="text-sm font-semibold">Couldn’t load dashboard</div>
          <div className="mt-2 text-sm" style={{ color: "var(--muted)" }}>{error}</div>
        </div>
      )}

      {!loading && !error && documents.length === 0 && (
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          <div className="text-sm font-semibold">No documents yet</div>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
            Create your first receipt to generate a share link and start collecting records.
          </p>
          <div className="mt-5 flex gap-3 flex-wrap">
            <Link
              href="/app/new"
              className="focus-ring inline-flex items-center justify-center px-4 py-2 text-sm font-semibold"
              style={{ background: "var(--fg)", color: "var(--bg)", borderRadius: 10 }}
            >
              Create receipt
            </Link>
            <Link
              href="/"
              className="focus-ring inline-flex items-center justify-center px-4 py-2 text-sm font-semibold"
              style={{ border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 10 }}
            >
              Back to home
            </Link>
          </div>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div style={{ borderTop: "1px solid var(--border)" }}>
          <div className="space-y-0">
            {filtered.map((d) => (
              <div key={d.id} className="py-5" style={{ borderBottom: "1px solid var(--border)" }}>
                <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="text-sm font-semibold truncate">{d.title}</div>
                      <StatusBadge status={d.status} />
                      <div className="text-xs" style={{ color: "var(--muted2)" }}>
                        {d.publicId}
                      </div>
                    </div>

                    <div className="mt-2 text-xs space-y-1" style={{ color: "var(--muted)" }}>
                      <div>Created: {formatDate(d.createdAt)}</div>
                      <div>
                        Acknowledgements: <span style={{ color: "var(--fg)" }}>{d.acknowledgements}</span>
                        {d.latestAcknowledgedAt ? <> • Latest: {formatDate(d.latestAcknowledgedAt)}</> : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <Link
                      href={`/app/docs/${d.id}`}
                      className="focus-ring px-3 py-2 text-sm font-medium transition-opacity hover:opacity-80"
                      style={{ border: "1px solid var(--border)", borderRadius: 10, color: "var(--muted)" }}
                    >
                      View
                    </Link>

                    <Link
                      href={`/d/${d.publicId}`}
                      className="focus-ring px-3 py-2 text-sm font-medium transition-opacity hover:opacity-80"
                      style={{ border: "1px solid var(--border)", borderRadius: 10, color: "var(--muted)" }}
                    >
                      Open link
                    </Link>

                    <button
                      type="button"
                      className="focus-ring px-3 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
                      style={{ background: "var(--fg)", color: "var(--bg)", borderRadius: 10 }}
                      onClick={async () => {
                        const abs = `${window.location.origin}/d/${d.publicId}`;
                        try {
                          await navigator.clipboard.writeText(abs);
                          toast.success("Copied", "Share link copied to clipboard.");
                          setCopiedId(d.id);
                          if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
                          copiedTimerRef.current = window.setTimeout(() => setCopiedId(null), 1500);
                        } catch {
                          toast.error("Copy failed", "Your browser blocked clipboard access.");
                        }
                      }}
                    >
                      {copiedId === d.id ? "Copied" : "Copy link"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-xs leading-relaxed" style={{ color: "var(--muted2)" }}>
        Receipt records access, review activity, and acknowledgement. It does not assess understanding
        and is not an e-signature product.
      </div>
    </div>
  );
}
