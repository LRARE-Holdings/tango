"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type DocItem = {
  id: string;
  title: string;
  publicId: string;
  createdAt: string;
  acknowledgements: number;
  latestAcknowledgedAt: string | null;
  status: "Acknowledged" | "Pending";
};

function formatDate(iso: string) {
  // Keep it simple & stable (no locale mismatch issues)
  const d = new Date(iso);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi} UTC`;
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

export default function AppHome() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocItem[]>([]);

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

  const counts = useMemo(() => {
    const acknowledged = documents.filter((d) => d.status === "Acknowledged").length;
    return { total: documents.length, acknowledged };
  }, [documents]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-6 flex-col md:flex-row">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Documents</h1>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
            Create a share link for a PDF and collect a Receipt Record when it’s acknowledged.
          </p>
          <div className="mt-3 text-xs" style={{ color: "var(--muted2)" }}>
            {counts.total} total • {counts.acknowledged} acknowledged
          </div>
        </div>

        <div className="flex gap-3">
          <PrimaryLink href="/app/new">Create receipt</PrimaryLink>
          <GhostLink href="/#how">How it works</GhostLink>
        </div>
      </div>

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
            Upload a PDF to generate a share link. When the recipient acknowledges it, Receipt produces
            a timestamped record you can keep on file.
          </p>
          <div className="mt-5 flex gap-3 flex-col sm:flex-row">
            <PrimaryLink href="/app/new">Create your first receipt</PrimaryLink>
            <GhostLink href="/">Back to home</GhostLink>
          </div>
        </div>
      )}

      {/* List */}
      {!loading && !error && documents.length > 0 && (
        <div className="space-y-3">
          {documents.map((d) => (
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
                      await navigator.clipboard.writeText(abs);
                    }}
                  >
                    Copy link
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