"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/toast";
import {
  ActionRow,
  ChecklistInline,
  EmptyStateSimple,
  InlineNotice,
  PageHeaderSimple,
  SectionDisclosure,
  StatusDotLabel,
} from "@/components/ui/calm-core";

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
  display_name?: string | null;
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

function firstNameFromDisplayName(input: string | null | undefined) {
  const clean = String(input ?? "").trim().replace(/\s+/g, " ");
  if (!clean) return "";
  return clean.split(" ")[0] ?? "";
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

function statusUi(status: DocItem["status"]) {
  if (status === "Acknowledged") return { tone: "good" as const, label: "Acknowledged" };
  return { tone: "warn" as const, label: "In progress" };
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
  const [checklistDismissed, setChecklistDismissed] = useState(false);
  const [openedRecordBefore, setOpenedRecordBefore] = useState(false);
  const copiedTimerRef = useRef<number | null>(null);

  const plan = normalizePlan(me?.plan);
  const firstName = firstNameFromDisplayName(me?.display_name);
  const proPlus = plan === "pro" || plan === "team" || plan === "enterprise";
  const workspacePlus = plan === "team" || plan === "enterprise";
  const primaryWorkspaceId = String(me?.primary_workspace_id ?? "").trim() || null;

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
    try {
      const v = window.localStorage.getItem("receipt:dashboard-checklist:dismissed") === "1";
      setChecklistDismissed(v);
      const opened = window.localStorage.getItem("receipt:dashboard-checklist:opened-record") === "1";
      setOpenedRecordBefore(opened);
    } catch {
      // ignore
    }
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
  const pendingRate = useMemo(() => {
    if (counts.total === 0) return 0;
    return Math.round((counts.pending / counts.total) * 100);
  }, [counts.pending, counts.total]);

  const topDocuments = useMemo(() => {
    return [...documents]
      .sort((a, b) => b.acknowledgements - a.acknowledgements)
      .slice(0, 5);
  }, [documents]);

  const usageLine = useMemo(() => {
    const u = me?.usage;
    if (!u || u.limit == null) return null;
    if (plan === "free") {
      return `${u.used} of ${u.limit} documents used in total.`;
    }
    return `${u.used} of ${u.limit} documents used this month.`;
  }, [me?.usage, plan]);

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

  function clear() {
    setQuery("");
    setStatusFilter("All");
    setSortKey("Newest");
  }

  function openRecord(id: string) {
    try {
      window.localStorage.setItem("receipt:dashboard-checklist:opened-record", "1");
      setOpenedRecordBefore(true);
    } catch {
      // ignore
    }
    window.location.href = `/app/docs/${id}`;
  }

  function dismissChecklist() {
    setChecklistDismissed(true);
    try {
      window.localStorage.setItem("receipt:dashboard-checklist:dismissed", "1");
    } catch {
      // ignore
    }
  }

  const checklistItems = useMemo(() => {
    const hasSent = documents.length > 0;
    return [
      { id: "upload", label: "Upload your first document", done: hasSent },
      { id: "send", label: "Send and share the record", done: hasSent },
      { id: "track", label: "Open a record and track progress", done: openedRecordBefore },
    ];
  }, [documents.length, openedRecordBefore]);

  return (
    <div className="space-y-6">
      <PageHeaderSimple
        eyebrow="DASHBOARD"
        title={firstName ? `${firstName}'s dashboard` : "Account overview"}
        subtitle="Send, track, and open records from one calm workspace."
        actions={
          <>
            <Link
              href="/app/new"
              className="focus-ring px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ background: "var(--fg)", color: "var(--bg)", borderRadius: 10 }}
            >
              Send document
            </Link>
            {workspacePlus && primaryWorkspaceId ? (
              <Link
                href={`/app/workspaces/${primaryWorkspaceId}/dashboard`}
                className="focus-ring px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
                style={{ border: "1px solid var(--border)", borderRadius: 10, color: "var(--muted)" }}
              >
                Workspace view
              </Link>
            ) : null}
          </>
        }
      />

      {usageLine ? (
        <div className="text-xs" style={{ color: "var(--muted2)" }}>
          <Link href="/app/account#usage" className="underline underline-offset-4">
            {usageLine}
          </Link>
        </div>
      ) : null}

      {!checklistDismissed && !loading && documents.length === 0 ? (
        <ChecklistInline
          title="Start here"
          items={checklistItems}
          onDismiss={dismissChecklist}
        />
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
        <EmptyStateSimple
          title="Something went wrong loading your dashboard"
          body="Try refreshing. If this keeps happening, contact support and we’ll help quickly."
          ctaHref="/app"
          ctaLabel="Refresh"
          hint={error}
        />
      )}

      {!loading && !error && documents.length === 0 && (
        <EmptyStateSimple
          title="No documents yet"
          body="Receipt records delivery, access, and acknowledgement — nothing more."
          ctaHref="/app/new"
          ctaLabel="Upload your first document"
          hint="You can send first, then refine settings later."
        />
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <StatCard label="Documents" value={String(counts.total)} hint="Total records in your feed" />
          <StatCard label="Acknowledged Rate" value={`${acknowledgementRate}%`} hint={`${counts.acknowledged} acknowledged`} />
          <StatCard label="Pending Rate" value={`${pendingRate}%`} hint={`${counts.pending} in progress`} />
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="border" style={{ borderColor: "var(--border)", borderRadius: 12 }}>
          <div className="space-y-0">
            {filtered.map((d) => (
              <div key={d.id} className="p-4 md:p-5 hover:opacity-95 transition-opacity" style={{ borderBottom: "1px solid var(--border)" }}>
                <button
                  type="button"
                  onClick={() => openRecord(d.id)}
                  className="focus-ring w-full text-left"
                  style={{ borderRadius: 10 }}
                >
                  <div className="flex items-start justify-between gap-3 flex-col md:flex-row">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{d.title}</div>
                      <div className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                        Sent {formatDate(d.createdAt)} • {d.acknowledgements} acknowledgement{d.acknowledgements === 1 ? "" : "s"}
                      </div>
                      <div className="mt-1 text-xs" style={{ color: "var(--muted2)" }}>
                        Record ID: {d.publicId}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusDotLabel {...statusUi(d.status)} />
                      <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                        Open record
                      </span>
                    </div>
                  </div>
                </button>
                <ActionRow>
                  <Link
                    href={`/d/${d.publicId}`}
                    className="focus-ring mt-3 inline-flex px-3 py-2 text-xs border hover:opacity-80"
                    style={{ borderColor: "var(--border)", borderRadius: 10, color: "var(--muted)" }}
                  >
                    Open recipient link
                  </Link>
                  <button
                    type="button"
                    className="focus-ring mt-3 inline-flex px-3 py-2 text-xs border hover:opacity-80"
                    style={{ borderColor: "var(--border)", borderRadius: 10, color: "var(--muted)" }}
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
                    {copiedId === d.id ? "Copied link" : "Copy link"}
                  </button>
                </ActionRow>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && !error && documents.length > 0 && filtered.length === 0 ? (
        <EmptyStateSimple
          title="No documents match your filters"
          body="Try a broader search or clear filters to view your records again."
          ctaLabel="Clear filters"
          onCtaClick={clear}
          hint="Nothing has been removed."
        />
      ) : null}

      {!loading && !error && (
        <SectionDisclosure
          title="Additional insights"
          summary="Expanded analytics and workspace-level detail."
        >
          {proPlus ? (
            <div className="border p-4" style={{ borderColor: "var(--border)", borderRadius: 10 }}>
              <div className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>PRO INSIGHTS</div>
              <div className="mt-2 text-sm font-semibold">Top documents by acknowledgements</div>
              <div className="mt-2 space-y-1 text-sm" style={{ color: "var(--muted)" }}>
                {topDocuments.length === 0 ? (
                  <div>No document activity yet.</div>
                ) : (
                  topDocuments.map((d) => (
                    <div key={d.id} className="flex items-center justify-between">
                      <span className="truncate">{d.title}</span>
                      <span>{d.acknowledgements} acknowledgements</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}
          {workspacePlus ? (
            <div className="mt-4 border p-4" style={{ borderColor: "var(--border)", borderRadius: 10 }}>
              <div className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>WORKSPACE ANALYTICS</div>
              {workspaceAnalytics ? (
                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                  <StatCard label="Members" value={String(workspaceAnalytics.counts.members)} hint={`${workspaceAnalytics.counts.invites_pending} invites pending`} />
                  <StatCard label="Completions" value={String(workspaceAnalytics.counts.completions_total)} hint={`${workspaceAnalytics.counts.acknowledgements_total} acknowledgements`} />
                  <StatCard label="Avg Scroll" value={formatPercent(workspaceAnalytics.averages.max_scroll_percent)} hint="Across recent completions" />
                  <StatCard label="Avg Time On Page" value={formatDuration(workspaceAnalytics.averages.time_on_page_seconds)} hint={`Active: ${formatDuration(workspaceAnalytics.averages.active_seconds)}`} />
                </div>
              ) : (
                <div className="mt-2 text-sm" style={{ color: "var(--muted)" }}>Select an active workspace to view analytics.</div>
              )}
            </div>
          ) : null}
        </SectionDisclosure>
      )}

      <InlineNotice>
        Receipt records access, review activity, and acknowledgement. It does not assess understanding
        and is not an e-signature product.
      </InlineNotice>
    </div>
  );
}
