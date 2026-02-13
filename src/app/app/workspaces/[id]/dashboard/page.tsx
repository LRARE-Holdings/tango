"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { WorkspaceDashboardLoading } from "@/components/workspace-dashboard-loading";

type DashboardPayload = {
  workspace: {
    id: string;
    name: string;
    slug: string | null;
    created_at: string;
    brand_logo_updated_at: string | null;
  };
  viewer: {
    user_id: string;
    role: "owner" | "admin" | "member";
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
  pending: Array<{
    id: string;
    title: string;
    public_id: string;
    created_at: string;
    acknowledgements: number;
  }>;
  activity: Array<
    | {
        type: "document_created";
        at: string;
        document: { id: string; title: string; public_id: string };
      }
    | {
        type: "completion_submitted";
        at: string;
        acknowledged: boolean;
        document: { id: string; title: string; public_id: string };
        recipient: { name: string | null; email: string | null };
        metrics: {
          max_scroll_percent: number | null;
          time_on_page_seconds: number | null;
          active_seconds: number | null;
        };
      }
  >;
};

function fmtUtc(iso: string) {
  const d = new Date(iso);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi} UTC`;
}

function fmtDur(seconds: number | null) {
  if (seconds == null) return "—";
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${String(r).padStart(2, "0")}s`;
}

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div
      className="border p-4"
      style={{ borderColor: "var(--border)", background: "var(--card)", borderRadius: 12 }}
    >
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

export default function WorkspaceDashboardPage() {
  const params = useParams<{ id?: string }>();
  const workspaceId = typeof params?.id === "string" ? params.id : "";
  const workspaceIdentifier = useMemo(() => workspaceId.trim(), [workspaceId]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardPayload | null>(null);

  useEffect(() => {
    let alive = true;

    if (!workspaceIdentifier) {
      setData(null);
      setLoading(false);
      setError(workspaceId ? "Invalid workspace." : null);
      return () => {
        alive = false;
      };
    }

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/app/workspaces/${encodeURIComponent(workspaceIdentifier)}/dashboard`, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error ?? "Failed to load dashboard");
        if (!alive) return;
        setData(json as DashboardPayload);
      } catch (e: unknown) {
        if (alive) setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [workspaceIdentifier, workspaceId]);

  const logoSrc = useMemo(() => {
    const w = data?.workspace;
    if (!w) return null;
    return `/api/app/workspaces/${w.id}/branding/logo/view${
      w.brand_logo_updated_at ? `?v=${encodeURIComponent(w.brand_logo_updated_at)}` : ""
    }`;
  }, [data?.workspace]);

  const healthHint = useMemo(() => {
    if (!data) return "—";
    const total = data.counts.documents_total || 0;
    const pending = data.counts.documents_pending || 0;
    if (total === 0) return "Create your first receipt to start tracking activity.";
    const ratio = total > 0 ? 1 - pending / total : 0;
    if (ratio >= 0.8) return "Healthy: most documents have been acknowledged.";
    if (ratio >= 0.5) return "Mixed: a fair number are still pending.";
    return "Attention: many documents are pending acknowledgement.";
  }, [data]);

  const idForLinks = data?.workspace?.slug ?? workspaceIdentifier;
  const canManageSettings = data?.viewer?.role === "owner" || data?.viewer?.role === "admin";

  if (loading && !data && !error) {
    return <WorkspaceDashboardLoading />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            {logoSrc ? (
              <div
                className="shrink-0 border p-2"
                style={{ borderColor: "var(--border)", background: "var(--card)", borderRadius: 12 }}
              >
                <img
                  src={logoSrc}
                  alt={`${data?.workspace?.name ?? "Workspace"} logo`}
                  className="h-12 w-12 md:h-16 md:w-16"
                  style={{ objectFit: "contain" }}
                  onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
                />
              </div>
            ) : null}
            <div className="min-w-0">
              <h1 className={`font-semibold tracking-tight truncate ${logoSrc ? "text-lg md:text-xl" : "text-2xl md:text-3xl"}`}>
                {loading ? "Loading…" : data?.workspace?.name ?? "Workspace"}
              </h1>
              {logoSrc ? (
                <p className="mt-1 text-xs uppercase tracking-wide" style={{ color: "var(--muted2)" }}>
                  Workspace
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Link
            href={`/app/workspaces/${idForLinks}/documents`}
            className="focus-ring px-4 py-2 text-sm font-medium hover:opacity-80"
            style={{ border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 10 }}
          >
            Documents
          </Link>

          {canManageSettings ? (
            <Link
              href={`/app/workspaces/${idForLinks}/settings`}
              className="focus-ring px-4 py-2 text-sm font-medium hover:opacity-80"
              style={{ border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 10 }}
            >
              Settings
            </Link>
          ) : null}

          <Link
            href="/app/new"
            className="focus-ring px-4 py-2 text-sm font-semibold hover:opacity-90"
            style={{ background: "var(--fg)", color: "var(--bg)", borderRadius: 10 }}
          >
            Create receipt
          </Link>
        </div>
      </div>

      {loading && data && (
        <div className="text-sm" style={{ color: "var(--muted)" }}>
          Refreshing dashboard data…
        </div>
      )}

      {error && (
        <div
          className="border p-6"
          style={{ borderColor: "var(--border)", background: "var(--card)", borderRadius: 12 }}
        >
          <div className="text-sm font-semibold">Couldn’t load workspace dashboard</div>
          <div className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            {error}
          </div>
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Stat
              label="DOCUMENTS"
              value={data.counts.documents_total}
              hint={`${data.counts.documents_pending} pending`}
            />
            <Stat label="ACKNOWLEDGED" value={data.counts.documents_acknowledged} hint={healthHint} />
            <Stat label="TEAM" value={data.counts.members} hint={`${data.counts.invites_pending} invites pending`} />
            <Stat
              label="COMPLETIONS"
              value={data.counts.completions_total}
              hint={`${data.counts.acknowledgements_total} acknowledgements`}
            />
          </div>

          {/* Signal row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Stat
              label="AVG SCROLL"
              value={data.averages.max_scroll_percent == null ? "—" : `${Math.round(data.averages.max_scroll_percent)}%`}
              hint="Across recent completions"
            />
            <Stat label="AVG TIME ON PAGE" value={fmtDur(data.averages.time_on_page_seconds)} hint="Across recent completions" />
            <Stat label="AVG ACTIVE TIME" value={fmtDur(data.averages.active_seconds)} hint="Across recent completions" />
          </div>

          {/* Two-column: Pending + Activity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Pending */}
            <div className="border" style={{ borderColor: "var(--border)", borderRadius: 12, overflow: "hidden" }}>
              <div className="px-5 py-3 text-xs tracking-wide" style={{ background: "var(--card2)", color: "var(--muted2)" }}>
                PENDING ACKNOWLEDGEMENTS
              </div>

              {data.pending.length === 0 ? (
                <div className="px-5 py-5 text-sm" style={{ color: "var(--muted)" }}>
                  Nothing pending. That’s what we like to see.
                </div>
              ) : (
                <div>
                  {data.pending.map((d) => (
                    <div
                      key={d.id}
                      className="px-5 py-4 flex items-start justify-between gap-4"
                      style={{ borderTop: "1px solid var(--border2)" }}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{d.title}</div>
                        <div className="mt-1 text-xs" style={{ color: "var(--muted2)" }}>
                          Created {fmtUtc(d.created_at)}
                        </div>
                        <div className="mt-1 text-xs" style={{ color: "var(--muted2)" }}>
                          Link: /d/{d.public_id}
                        </div>
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        <Link
                          href={`/app/docs/${d.id}`}
                          className="focus-ring px-3 py-2 text-sm hover:opacity-80"
                          style={{ border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 10 }}
                        >
                          View
                        </Link>
                        <Link
                          href={`/d/${d.public_id}`}
                          className="focus-ring px-3 py-2 text-sm hover:opacity-80"
                          style={{ border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 10 }}
                        >
                          Open link
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Activity */}
            <div className="border" style={{ borderColor: "var(--border)", borderRadius: 12, overflow: "hidden" }}>
              <div className="px-5 py-3 text-xs tracking-wide" style={{ background: "var(--card2)", color: "var(--muted2)" }}>
                RECENT ACTIVITY
              </div>

              {data.activity.length === 0 ? (
                <div className="px-5 py-5 text-sm" style={{ color: "var(--muted)" }}>
                  No activity yet. Create a receipt to start tracking.
                </div>
              ) : (
                <div>
                  {data.activity.map((a, idx) => {
                    if (a.type === "document_created") {
                      return (
                        <div key={`${a.type}-${idx}`} className="px-5 py-4" style={{ borderTop: "1px solid var(--border2)" }}>
                          <div className="text-sm font-semibold">Document created</div>
                          <div className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                            {a.document.title}
                          </div>
                          <div className="mt-2 text-xs" style={{ color: "var(--muted2)" }}>
                            {fmtUtc(a.at)} • /d/{a.document.public_id}
                          </div>
                        </div>
                      );
                    }

                    const who = a.recipient.name?.trim() || a.recipient.email?.trim() || "Recipient";
                    return (
                      <div key={`${a.type}-${idx}`} className="px-5 py-4" style={{ borderTop: "1px solid var(--border2)" }}>
                        <div className="flex items-center justify-between gap-4">
                          <div className="text-sm font-semibold">{a.acknowledged ? "Acknowledged" : "Submitted"}</div>
                          <div className="text-xs" style={{ color: "var(--muted2)" }}>
                            {fmtUtc(a.at)}
                          </div>
                        </div>

                        <div className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                          {who} • {a.document.title}
                        </div>

                        <div className="mt-2 text-xs" style={{ color: "var(--muted2)" }}>
                          Scroll {a.metrics.max_scroll_percent == null ? "—" : `${a.metrics.max_scroll_percent}%`} • Time{" "}
                          {fmtDur(a.metrics.time_on_page_seconds)} • Active {fmtDur(a.metrics.active_seconds)}
                        </div>

                        <div className="mt-3 flex gap-2 flex-wrap">
                          <Link
                            href={`/app/docs/${a.document.id}`}
                            className="focus-ring px-3 py-2 text-sm hover:opacity-80"
                            style={{ border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 10 }}
                          >
                            View
                          </Link>
                          <Link
                            href={`/d/${a.document.public_id}`}
                            className="focus-ring px-3 py-2 text-sm hover:opacity-80"
                            style={{ border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 10 }}
                          >
                            Open link
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="text-xs leading-relaxed" style={{ color: "var(--muted2)" }}>
            Workspace dashboards show aggregate signals only. Receipt remains a neutral record (events + acknowledgement), not an e-signature product.
          </div>
        </>
      )}
    </div>
  );
}
