"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/toast";

type Recipient = {
  id: string;
  name: string | null;
  email: string | null;
};

type Completion = {
  id: string;
  acknowledged: boolean | null;
  max_scroll_percent: number | null;
  time_on_page_seconds: number | null;
  active_seconds: number | null;
  submitted_at: string | null;
  ip: string | null;
  user_agent: string | null;
  recipients?: Recipient | null;
};

type Doc = {
  id: string;
  title: string;
  publicId: string;
  createdAt: string;
  status: "Acknowledged" | "Pending";
  acknowledgements: number;
  latestAcknowledgedAt: string | null;
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi} UTC`;
}

function formatDuration(seconds: number | null) {
  if (seconds == null) return "—";
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${String(r).padStart(2, "0")}s`;
}

function StatusPill({ status }: { status: Doc["status"] }) {
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

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-3xl border p-6 md:p-8"
      style={{ borderColor: "var(--border)", background: "var(--card)" }}
    >
      {children}
    </div>
  );
}

export default function DocDetailPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const { id } = use(params as any) as { id: string };
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [doc, setDoc] = useState<Doc | null>(null);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copiedTimerRef = useRef<number | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/app/documents/${id}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "Failed to load document");
        setDoc(json.document);
        setCompletions(json.completions ?? []);
      } catch (e: any) {
        setError(e?.message ?? "Something went wrong");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const shareUrl = useMemo(() => {
    if (!doc) return null;
    return `/d/${doc.publicId}`;
  }, [doc]);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) {
        window.clearTimeout(copiedTimerRef.current);
      }
    };
  }, []);

  async function copyLink() {
    if (!shareUrl) return;
    const abs = `${window.location.origin}${shareUrl}`;
    try {
      await navigator.clipboard.writeText(abs);
      toast.success("Copied", "Share link copied to clipboard.");

      setCopiedId("share");
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = window.setTimeout(() => setCopiedId(null), 1500);
    } catch {
      toast.error("Copy failed", "Your browser blocked clipboard access.");
    }
  }

  async function downloadEvidence() {
    if (!doc) return;

    toast.info("Preparing JSON…");

    try {
      const res = await fetch(`/api/app/documents/${doc.id}/evidence`, {
        cache: "no-store",
      });

      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? "Failed to download evidence");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `receipt-record-${doc.id}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast.success("Downloaded", "JSON evidence saved.");
    } catch (e: any) {
      toast.error("Download failed", e?.message ?? "Could not download JSON evidence");
    }
  }

  async function downloadPdfEvidence() {
    if (!doc) return;

    toast.info("Preparing PDF…");

    try {
      const res = await fetch(`/api/app/documents/${doc.id}/evidence/pdf`, {
        cache: "no-store",
      });

      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? "Failed to download PDF");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `receipt-record-${doc.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast.success("Downloaded", "PDF evidence pack saved.");
    } catch (e: any) {
      toast.error("Download failed", e?.message ?? "Could not download PDF evidence pack");
    }
  }

  return (
    <div className="space-y-6">
      {/* Top row */}
      <div className="flex items-start justify-between gap-6 flex-col md:flex-row">
        <div>
          <div className="text-xs" style={{ color: "var(--muted2)" }}>
            DOCUMENT
          </div>
          <h1 className="mt-1 text-2xl md:text-3xl font-semibold tracking-tight">
            {doc?.title ?? "—"}
          </h1>

          {doc && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <StatusPill status={doc.status} />
              <div className="text-xs" style={{ color: "var(--muted)" }}>
                {doc.acknowledgements} acknowledgements
                {doc.latestAcknowledgedAt ? ` • latest ${formatDate(doc.latestAcknowledgedAt)}` : ""}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          <Link
            href="/app"
            className="focus-ring rounded-full border px-4 py-2 text-sm hover:opacity-80"
            style={{ borderColor: "var(--border)", color: "var(--muted)" }}
          >
            Back
          </Link>

          {shareUrl && (
            <>
              <Link
                href={shareUrl}
                className="focus-ring rounded-full border px-4 py-2 text-sm hover:opacity-80"
                style={{ borderColor: "var(--border)", color: "var(--muted)" }}
              >
                Open link
              </Link>
              <button
                type="button"
                onClick={copyLink}
                className="focus-ring rounded-full border px-4 py-2 text-sm hover:opacity-80"
                style={{ borderColor: "var(--border)", color: "var(--muted)" }}
              >
                {copiedId === "share" ? "Copied" : "Copy link"}
              </button>

              <button
                type="button"
                onClick={downloadPdfEvidence}
                className="focus-ring rounded-full border px-4 py-2 text-sm hover:opacity-80"
                style={{ borderColor: "var(--border)", color: "var(--muted)" }}
              >
                Download PDF
              </button>

              <button
                type="button"
                onClick={downloadEvidence}
                className="focus-ring rounded-full border px-4 py-2 text-sm hover:opacity-80"
                style={{ borderColor: "var(--border)", color: "var(--muted)" }}
              >
                Download JSON
              </button>
            </>
          )}
        </div>
      </div>

      {loading && (
        <div className="text-sm" style={{ color: "var(--muted)" }}>
          Loading…
        </div>
      )}

      {error && (
        <Card>
          <div className="text-sm font-semibold">Couldn’t load document</div>
          <div className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            {error}
          </div>
        </Card>
      )}

      {!loading && !error && doc && (
        <>
          {/* Meta */}
          <Card>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="text-xs" style={{ color: "var(--muted2)" }}>
                  CREATED
                </div>
                <div className="mt-1 text-sm font-medium">{formatDate(doc.createdAt)}</div>
              </div>

              <div>
                <div className="text-xs" style={{ color: "var(--muted2)" }}>
                  PUBLIC LINK
                </div>
                <div className="mt-1 text-sm font-medium underline underline-offset-4">
                  <Link href={shareUrl!}>{shareUrl}</Link>
                </div>
              </div>

              <div>
                <div className="text-xs" style={{ color: "var(--muted2)" }}>
                  STATUS
                </div>
                <div className="mt-1 text-sm font-medium">{doc.status}</div>
              </div>
            </div>

            <div className="mt-6 text-xs leading-relaxed" style={{ color: "var(--muted2)" }}>
              Receipt records access, review activity, and acknowledgement. It does not assess understanding
              and is not an e-signature product.
            </div>
          </Card>

          {/* Completions */}
          <div className="flex items-baseline justify-between">
            <div className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>
              COMPLETIONS
            </div>
            <div className="text-xs" style={{ color: "var(--muted2)" }}>
              {completions.length} total
            </div>
          </div>

          {completions.length === 0 ? (
            <Card>
              <div className="text-sm font-semibold">No acknowledgements yet</div>
              <div className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
                Share the link to collect a Receipt Record.
              </div>
            </Card>
          ) : (
            <div className="space-y-3">
              {completions.map((c) => {
                const who =
                  c.recipients?.name?.trim() ||
                  c.recipients?.email?.trim() ||
                  "Recipient";

                const emailLine =
                  c.recipients?.email && c.recipients?.name
                    ? c.recipients.email
                    : null;

                return (
                  <div
                    key={c.id}
                    className="rounded-3xl border p-5 md:p-6"
                    style={{ borderColor: "var(--border)", background: "var(--card)" }}
                  >
                    <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{who}</div>
                        {emailLine && (
                          <div className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                            {emailLine}
                          </div>
                        )}

                        <div className="mt-2 text-xs space-y-1" style={{ color: "var(--muted)" }}>
                          <div>Submitted: {formatDate(c.submitted_at)}</div>
                          <div>Acknowledged: {c.acknowledged ? "Yes" : "No"}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 w-full md:w-auto">
                        <div
                          className="rounded-2xl border p-4"
                          style={{ borderColor: "var(--border)", background: "var(--card2)" }}
                        >
                          <div className="text-xs" style={{ color: "var(--muted2)" }}>
                            Scroll
                          </div>
                          <div className="text-sm font-medium">
                            {c.max_scroll_percent == null ? "—" : `${c.max_scroll_percent}%`}
                          </div>
                        </div>

                        <div
                          className="rounded-2xl border p-4"
                          style={{ borderColor: "var(--border)", background: "var(--card2)" }}
                        >
                          <div className="text-xs" style={{ color: "var(--muted2)" }}>
                            Time
                          </div>
                          <div className="text-sm font-medium">
                            {formatDuration(c.time_on_page_seconds)}
                          </div>
                        </div>

                        <div
                          className="rounded-2xl border p-4"
                          style={{ borderColor: "var(--border)", background: "var(--card2)" }}
                        >
                          <div className="text-xs" style={{ color: "var(--muted2)" }}>
                            Active
                          </div>
                          <div className="text-sm font-medium">
                            {formatDuration(c.active_seconds)}
                          </div>
                        </div>

                        <div
                          className="rounded-2xl border p-4"
                          style={{ borderColor: "var(--border)", background: "var(--card2)" }}
                        >
                          <div className="text-xs" style={{ color: "var(--muted2)" }}>
                            IP
                          </div>
                          <div className="text-sm font-medium">
                            {c.ip ?? "—"}
                          </div>
                        </div>
                      </div>
                    </div>

                    <details className="mt-4">
                      <summary
                        className="cursor-pointer text-xs hover:opacity-80"
                        style={{ color: "var(--muted)" }}
                      >
                        Technical details
                      </summary>
                      <div
                        className="mt-2 rounded-2xl border p-4 text-xs leading-relaxed"
                        style={{ borderColor: "var(--border)", background: "transparent", color: "var(--muted)" }}
                      >
                        <div><span style={{ color: "var(--muted2)" }}>Completion ID:</span> {c.id}</div>
                        <div><span style={{ color: "var(--muted2)" }}>Active time:</span> {formatDuration(c.active_seconds)}</div>
                        <div><span style={{ color: "var(--muted2)" }}>IP:</span> {c.ip ?? "—"}</div>
                        <div><span style={{ color: "var(--muted2)" }}>User agent:</span> {c.user_agent ?? "—"}</div>
                      </div>
                    </details>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}