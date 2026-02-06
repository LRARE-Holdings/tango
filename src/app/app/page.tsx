"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
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

type StatusFilter = "All" | "Pending" | "Acknowledged";
type SortKey = "Newest" | "Oldest" | "Most acknowledgements" | "Least acknowledgements";

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

function StatusPill({ status }: { status: DocItem["status"] }) {
  const style =
    status === "Acknowledged"
      ? { background: "var(--fg)", color: "var(--bg)", borderColor: "transparent" }
      : { background: "transparent", color: "var(--muted)", borderColor: "var(--border)" };

  return (
    <span
      className="inline-flex items-center rounded-full border px-3 py-1 text-xs tracking-wide"
      style={style as any}
    >
      {status.toUpperCase()}
    </span>
  );
}

function PrimaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="focus-ring inline-flex items-center justify-center rounded-full px-6 py-2.5 text-sm font-medium transition hover:opacity-90"
      style={{ background: "var(--fg)", color: "var(--bg)" }}
    >
      {children}
    </Link>
  );
}

function GhostLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="focus-ring inline-flex items-center justify-center rounded-full px-6 py-2.5 text-sm font-medium border transition hover:opacity-80"
      style={{ borderColor: "var(--border)", color: "var(--muted)" }}
    >
      {children}
    </Link>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const style = active
    ? { background: "var(--fg)", color: "var(--bg)", borderColor: "transparent" }
    : { background: "transparent", color: "var(--muted)", borderColor: "var(--border)" };

  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-ring inline-flex items-center rounded-full border px-3 py-2 text-xs hover:opacity-90"
      style={style as any}
    >
      {children}
    </button>
  );
}

export default function AppHome() {
  const toast = useToast();
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [meEmail, setMeEmail] = useState<string | null>(null);
  const [meLoading, setMeLoading] = useState(true);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocItem[]>([]);

  // Copy microstate
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copiedTimerRef = useRef<number | null>(null);

  // Filters
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [sortKey, setSortKey] = useState<SortKey>("Newest");

  useEffect(() => {
    async function loadMe() {
      setMeLoading(true);
      try {
        const res = await fetch("/api/app/me", { cache: "no-store" });
        if (!res.ok) {
          setMeEmail(null);
          return;
        }
        const json = await res.json();
        setMeEmail(json.email ?? null);
      } finally {
        setMeLoading(false);
      }
    }
    loadMe();
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/app/documents", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "Failed to load documents");
        setDocuments(json.documents ?? []);
      } catch (e: any) {
        setError(e?.message ?? "Something went wrong");
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

  const baseCounts = useMemo(() => {
    const acknowledged = documents.filter((d) => d.status === "Acknowledged").length;
    const pending = documents.filter((d) => d.status === "Pending").length;
    return { total: documents.length, acknowledged, pending };
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    const q = normalizeQuery(query);

    let list = documents;

    if (statusFilter !== "All") {
      list = list.filter((d) => d.status === statusFilter);
    }

    if (q) {
      list = list.filter((d) => {
        const hay = `${d.title ?? ""} ${d.publicId ?? ""}`.toLowerCase();
        // simple includes is fine for small lists; can upgrade later
        return hay.includes(q);
      });
    }

    const byCreatedAt = (a: DocItem, b: DocItem) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();

    const byAcks = (a: DocItem, b: DocItem) => a.acknowledgements - b.acknowledgements;

    list = [...list].sort((a, b) => {
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

    return list;
  }, [documents, query, statusFilter, sortKey]);

  const showingCounts = useMemo(() => {
    const acknowledged = filteredDocuments.filter((d) => d.status === "Acknowledged").length;
    const pending = filteredDocuments.filter((d) => d.status === "Pending").length;
    return { total: filteredDocuments.length, acknowledged, pending };
  }, [filteredDocuments]);

  function clearFilters() {
    setQuery("");
    setStatusFilter("All");
    setSortKey("Newest");
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/auth");
  }

  return (
    <div className="space-y-8">
      {/* Session */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="text-xs" style={{ color: "var(--muted)" }}>
          {meLoading ? "Loading session…" : meEmail ? `Signed in as ${meEmail}` : "Not signed in"}
        </div>

        <button
          type="button"
          onClick={signOut}
          className="focus-ring rounded-full border px-4 py-2 text-sm hover:opacity-80"
          style={{ borderColor: "var(--border)", color: "var(--muted)" }}
        >
          Sign out
        </button>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-6 flex-col md:flex-row">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Documents</h1>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
            Create a share link for a PDF and collect a Receipt Record when it’s acknowledged.
          </p>

          <div className="mt-3 text-xs" style={{ color: "var(--muted2)" }}>
            {baseCounts.total} total • {baseCounts.acknowledged} acknowledged • {baseCounts.pending} pending
            {(!loading && !error && baseCounts.total > 0) ? (
              <>
                {" "}
                • Showing <span style={{ color: "var(--fg)" }}>{showingCounts.total}</span>
              </>
            ) : null}
          </div>
        </div>

        <div className="flex gap-3">
          <PrimaryLink href="/app/new">Create receipt</PrimaryLink>
          <GhostLink href="/#how">How it works</GhostLink>
        </div>
      </div>

      {/* Controls */}
      {!loading && !error && documents.length > 0 && (
        <div
          className="rounded-3xl border p-4 md:p-5 space-y-4"
          style={{ borderColor: "var(--border)", background: "var(--card)" }}
        >
          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            {/* Search */}
            <div className="flex-1 flex items-center gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search title or public ID…"
                className="focus-ring w-full rounded-2xl border px-4 py-3 text-sm bg-transparent"
                style={{ borderColor: "var(--border)" }}
              />
              {query.trim() ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="focus-ring rounded-full border px-4 py-2 text-sm hover:opacity-80"
                  style={{ borderColor: "var(--border)", color: "var(--muted)" }}
                >
                  Clear
                </button>
              ) : null}
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2">
              <div className="text-xs" style={{ color: "var(--muted2)" }}>
                Sort
              </div>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="focus-ring rounded-2xl border px-4 py-3 text-sm bg-transparent"
                style={{ borderColor: "var(--border)", color: "var(--fg)" }}
              >
                <option value="Newest">Newest</option>
                <option value="Oldest">Oldest</option>
                <option value="Most acknowledgements">Most acknowledgements</option>
                <option value="Least acknowledgements">Least acknowledgements</option>
              </select>
            </div>
          </div>

          {/* Status filters */}
          <div className="flex flex-wrap gap-2">
            <FilterPill active={statusFilter === "All"} onClick={() => setStatusFilter("All")}>
              All ({baseCounts.total})
            </FilterPill>
            <FilterPill
              active={statusFilter === "Pending"}
              onClick={() => setStatusFilter("Pending")}
            >
              Pending ({baseCounts.pending})
            </FilterPill>
            <FilterPill
              active={statusFilter === "Acknowledged"}
              onClick={() => setStatusFilter("Acknowledged")}
            >
              Acknowledged ({baseCounts.acknowledged})
            </FilterPill>

            {(query.trim() || statusFilter !== "All" || sortKey !== "Newest") ? (
              <button
                type="button"
                onClick={clearFilters}
                className="focus-ring inline-flex items-center rounded-full border px-3 py-2 text-xs hover:opacity-80"
                style={{ borderColor: "var(--border)", color: "var(--muted)" }}
              >
                Clear filters
              </button>
            ) : null}
          </div>

          {/* Filter hint */}
          {(query.trim() || statusFilter !== "All") && (
            <div className="text-xs" style={{ color: "var(--muted2)" }}>
              Showing{" "}
              <span style={{ color: "var(--fg)" }}>{showingCounts.total}</span> results
              {statusFilter !== "All" ? (
                <>
                  {" "}
                  • status: <span style={{ color: "var(--fg)" }}>{statusFilter}</span>
                </>
              ) : null}
              {query.trim() ? (
                <>
                  {" "}
                  • query: <span style={{ color: "var(--fg)" }}>&ldquo;{query.trim()}&rdquo;</span>
                </>
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* States */}
      {loading && (
        <div className="text-sm" style={{ color: "var(--muted)" }}>
          Loading…
        </div>
      )}

      {error && (
        <div
          className="rounded-3xl border p-6"
          style={{ borderColor: "var(--border)", background: "var(--card)" }}
        >
          <div className="text-sm font-semibold">Couldn’t load documents</div>
          <div className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            {error}
          </div>
        </div>
      )}

      {!loading && !error && documents.length === 0 && (
        <div
          className="rounded-3xl border p-6 md:p-8"
          style={{ borderColor: "var(--border)", background: "var(--card)" }}
        >
          <div className="text-sm font-semibold">No documents yet</div>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
            Upload a PDF to generate a share link. When the recipient acknowledges it, Receipt produces a
            timestamped record you can keep on file.
          </p>
          <div className="mt-5 flex gap-3 flex-col sm:flex-row">
            <PrimaryLink href="/app/new">Create your first receipt</PrimaryLink>
            <GhostLink href="/">Back to home</GhostLink>
          </div>
        </div>
      )}

      {/* Filter empty state */}
      {!loading && !error && documents.length > 0 && filteredDocuments.length === 0 && (
        <div
          className="rounded-3xl border p-6 md:p-8"
          style={{ borderColor: "var(--border)", background: "var(--card)" }}
        >
          <div className="text-sm font-semibold">No matches</div>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
            Try a different search term or clear filters to see all documents.
          </p>
          <div className="mt-5 flex gap-3 flex-col sm:flex-row">
            <button
              type="button"
              onClick={clearFilters}
              className="focus-ring inline-flex items-center justify-center rounded-full px-6 py-2.5 text-sm font-medium transition hover:opacity-90"
              style={{ background: "var(--fg)", color: "var(--bg)" }}
            >
              Clear filters
            </button>
            <PrimaryLink href="/app/new">Create receipt</PrimaryLink>
          </div>
        </div>
      )}

      {/* List */}
      {!loading && !error && filteredDocuments.length > 0 && (
        <div className="space-y-3">
          {filteredDocuments.map((d) => (
            <div
              key={d.id}
              className="rounded-3xl border p-5 md:p-6"
              style={{ borderColor: "var(--border)", background: "var(--card)" }}
            >
              <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
                <div className="min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="text-sm font-semibold truncate">{d.title}</div>
                    <StatusPill status={d.status} />
                    <div className="text-xs" style={{ color: "var(--muted2)" }}>
                      {d.publicId}
                    </div>
                  </div>

                  <div className="mt-2 text-xs space-y-1" style={{ color: "var(--muted)" }}>
                    <div>Created: {formatDate(d.createdAt)}</div>
                    <div>
                      Acknowledgements:{" "}
                      <span style={{ color: "var(--fg)" }}>{d.acknowledgements}</span>
                      {d.latestAcknowledgedAt ? (
                        <>
                          {" "}
                          • Latest: {formatDate(d.latestAcknowledgedAt)}
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <Link
                    href={`/app/docs/${d.id}`}
                    className="focus-ring rounded-full border px-4 py-2 text-sm hover:opacity-80"
                    style={{ borderColor: "var(--border)", color: "var(--muted)" }}
                  >
                    View
                  </Link>

                  <Link
                    href={`/d/${d.publicId}`}
                    className="focus-ring rounded-full border px-4 py-2 text-sm hover:opacity-80"
                    style={{ borderColor: "var(--border)", color: "var(--muted)" }}
                  >
                    Open link
                  </Link>

                  <button
                    type="button"
                    className="focus-ring rounded-full border px-4 py-2 text-sm hover:opacity-80"
                    style={{ borderColor: "var(--border)", color: "var(--muted)" }}
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
      )}

      <div className="text-xs leading-relaxed" style={{ color: "var(--muted2)" }}>
        Receipt records access, review activity, and acknowledgement. It does not assess understanding
        and is not an e-signature product.
      </div>
    </div>
  );
}