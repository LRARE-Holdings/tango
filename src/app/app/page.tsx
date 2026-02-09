"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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

type MeResponse = {
  primary_workspace_id?: string | null;
};

type StatusFilter = "All" | "Pending" | "Acknowledged";
type SortKey =
  | "Newest"
  | "Oldest"
  | "Most acknowledgements"
  | "Least acknowledgements";

function formatDate(iso: string) {
  const d = new Date(iso);
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

function StatusBadge({ status }: { status: DocItem["status"] }) {
  const style: React.CSSProperties =
    status === "Acknowledged"
      ? { background: "var(--fg)", color: "var(--bg)" }
      : { background: "transparent", color: "var(--muted)", border: `1px solid var(--border)` };

  return (
    <span
      className="inline-flex items-center px-2.5 py-1 text-xs font-semibold"
      style={{ borderRadius: 10, ...style }}
    >
      {status}
    </span>
  );
}

export default function AppHome() {
  const router = useRouter();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocItem[]>([]);
  const [mode, setMode] = useState<"PERSONAL MODE" | "WORKSPACE MODE">("PERSONAL MODE");

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [sortKey, setSortKey] = useState<SortKey>("Newest");

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copiedTimerRef = useRef<number | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const meRes = await fetch("/api/app/me", { cache: "no-store" });
        const meJson = meRes.ok ? ((await meRes.json()) as MeResponse) : null;
        const primaryWorkspaceId =
          typeof meJson?.primary_workspace_id === "string" && meJson.primary_workspace_id.length > 0
            ? meJson.primary_workspace_id
            : null;

        if (primaryWorkspaceId) {
          setMode("WORKSPACE MODE");
          router.replace(`/app/workspaces/${primaryWorkspaceId}/dashboard`);
          return;
        }

        setMode("PERSONAL MODE");

        const docsRes = await fetch("/api/app/documents", { cache: "no-store" });
        const docsJson = await docsRes.json();
        if (!docsRes.ok) throw new Error(docsJson?.error ?? "Failed to load documents");
        setDocuments(docsJson.documents ?? []);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

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

    const byCreatedAt = (a: DocItem, b: DocItem) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
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

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <div className="text-xs font-semibold tracking-widest" style={{ color: "var(--muted2)" }}>
            DASHBOARD
          </div>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Documents</h1>
            <span
              className="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide"
              style={{ borderColor: "var(--border)", color: "var(--muted)" }}
            >
              {mode}
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
            Share a link. Keep the record. No drama.
          </p>
        </div>

        <div className="text-xs" style={{ color: "var(--muted2)" }}>
          {counts.total} total • {counts.pending} pending • {counts.acknowledged} acknowledged
        </div>
      </div>

      {/* Controls */}
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

      {/* States */}
      {loading && <div className="text-sm" style={{ color: "var(--muted)" }}>Loading…</div>}

      {error && (
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          <div className="text-sm font-semibold">Couldn’t load documents</div>
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

      {/* List */}
      {!loading && !error && filtered.length > 0 && (
        <div style={{ borderTop: "1px solid var(--border)" }}>
          <div className="space-y-0">
            {filtered.map((d) => (
              <div
                key={d.id}
                className="py-5"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
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
