"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center rounded-full border px-3 py-1 text-xs tracking-wide"
      style={{ borderColor: "var(--border)", color: "var(--muted)" }}
    >
      {children}
    </span>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      className="rounded-2xl border p-4"
      style={{ borderColor: "var(--border)", background: "var(--card2)" }}
    >
      <div className="text-xs" style={{ color: "var(--muted2)" }}>
        {label}
      </div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}

export default function PublicDocPage({
  params,
}: {
  params: Promise<{ publicId: string }> | { publicId: string };
}) {
  // ✅ Next.js 16.1+ can pass params as a Promise in Client Components
  const { publicId } = use(params as any) as { publicId: string };

  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState<string>("Document");
  const [signedUrl, setSignedUrl] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const startedAtRef = useRef<number>(Date.now());
  const [maxScroll, setMaxScroll] = useState(0);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [ack, setAck] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // We only reveal the final time-on-page after submission (keeps the UI calm)
  const timeOnPageFinal = useMemo(() => {
    const seconds = Math.floor((Date.now() - startedAtRef.current) / 1000);
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${String(s).padStart(2, "0")}s`;
  }, [submitted]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/public/${publicId}`, { cache: "no-store" });
        const json = await res.json();

        if (!res.ok) throw new Error(json?.error ?? "Not found");

        setTitle(json.document?.title ?? "Document");
        setSignedUrl(json.signedUrl ?? "");
      } catch (e: any) {
        setError(e?.message ?? "Something went wrong");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [publicId]);

  useEffect(() => {
    function onScroll() {
      const doc = document.documentElement;
      const scrollTop = doc.scrollTop;
      const scrollHeight = doc.scrollHeight - doc.clientHeight;
      const pct =
        scrollHeight > 0 ? Math.round((scrollTop / scrollHeight) * 100) : 0;
      setMaxScroll((prev) => Math.max(prev, pct));
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  async function submit() {
    setSubmitting(true);
    setError(null);

    const seconds = Math.max(
      0,
      Math.round((Date.now() - startedAtRef.current) / 1000)
    );

    try {
      const res = await fetch(`/api/public/${publicId}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || null,
          email: email.trim() || null,
          acknowledged: true,
          max_scroll_percent: maxScroll,
          time_on_page_seconds: seconds,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Submit failed");

      setSubmitted(true);
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen px-6 py-10">
        <div className="mx-auto max-w-3xl">
          <div className="text-sm" style={{ color: "var(--muted)" }}>
            Loading…
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen px-6 py-10">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="text-xl font-semibold">Receipt</div>
          <div className="text-sm" style={{ color: "var(--muted)" }}>
            {error}
          </div>
          <Link
            href="/"
            className="focus-ring inline-flex rounded-full border px-4 py-2 text-sm hover:opacity-80"
            style={{ borderColor: "var(--border)", color: "var(--muted)" }}
          >
            Back to home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <header className="flex items-start justify-between gap-4 flex-col sm:flex-row">
          <div>
            <div className="text-xs" style={{ color: "var(--muted2)" }}>
              RECEIPT
            </div>
            <h1 className="mt-1 text-xl sm:text-2xl font-semibold tracking-tight">
              {title}
            </h1>

            <div className="mt-3 flex flex-wrap gap-2">
              <Chip>No accounts</Chip>
              <Chip>No AI analysis</Chip>
              <Chip>Neutral record</Chip>
            </div>
          </div>

          <Link
            href="/"
            className="focus-ring inline-flex rounded-full border px-4 py-2 text-sm hover:opacity-80"
            style={{ borderColor: "var(--border)", color: "var(--muted)" }}
          >
            What is Receipt?
          </Link>
        </header>

        {/* Document */}
        <div
          className="rounded-3xl border overflow-hidden"
          style={{ borderColor: "var(--border)", background: "var(--card)" }}
        >
          <div
            className="px-5 py-4 border-b flex items-center justify-between gap-4"
            style={{ borderColor: "var(--border)" }}
          >
            <div className="text-sm font-semibold">Document</div>
            <div className="text-xs" style={{ color: "var(--muted)" }}>
              Max scroll: {maxScroll}%
            </div>
          </div>

          {/* Fast MVP: iframe (signed URL) */}
          <iframe title="Document" src={signedUrl} className="w-full h-[70vh]" />
        </div>

        {/* Acknowledge */}
        {!submitted ? (
          <div
            className="rounded-3xl border p-6 md:p-8"
            style={{ borderColor: "var(--border)", background: "var(--card)" }}
          >
            <div className="flex items-start justify-between gap-6 flex-col md:flex-row">
              <div className="max-w-2xl">
                <div className="text-sm font-semibold">Acknowledge review</div>
                <p
                  className="mt-2 text-sm leading-relaxed"
                  style={{ color: "var(--muted)" }}
                >
                  By submitting, you confirm you have reviewed this document.
                  Receipt records timestamps and review activity (time and scroll
                  depth). It does not assess understanding and is not an
                  e-signature product.
                </p>
              </div>

              <div className="text-xs space-y-1" style={{ color: "var(--muted)" }}>
                <div>
                  Scroll depth:{" "}
                  <span style={{ color: "var(--fg)" }}>{maxScroll}%</span>
                </div>
                <div>
                  Time on page:{" "}
                  <span style={{ color: "var(--fg)" }}>recorded on submit</span>
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name (optional)"
                className="focus-ring rounded-2xl border px-4 py-3 text-sm bg-transparent"
                style={{ borderColor: "var(--border)" }}
              />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email (optional)"
                className="focus-ring rounded-2xl border px-4 py-3 text-sm bg-transparent"
                style={{ borderColor: "var(--border)" }}
              />
            </div>

            <div className="mt-4 flex items-start gap-3">
              <input
                id="ack"
                type="checkbox"
                checked={ack}
                onChange={(e) => setAck(e.target.checked)}
                className="mt-1"
              />
              <label htmlFor="ack" className="text-sm leading-relaxed">
                I confirm I have reviewed this document.
              </label>
            </div>

            <div className="mt-5 flex flex-col sm:flex-row gap-3">
              <button
                className="focus-ring rounded-full px-6 py-2.5 text-sm font-medium transition hover:opacity-90 disabled:opacity-50"
                style={{ background: "var(--fg)", color: "var(--bg)" }}
                disabled={!ack || submitting}
                onClick={submit}
              >
                {submitting ? "Submitting…" : "Submit acknowledgement"}
              </button>

              <Link
                href="/"
                className="focus-ring inline-flex items-center justify-center rounded-full px-6 py-2.5 text-sm font-medium border transition hover:opacity-80"
                style={{ borderColor: "var(--border)", color: "var(--muted)" }}
              >
                Back
              </Link>
            </div>

            {error && (
              <div className="mt-4 text-sm" style={{ color: "#ff3b30" }}>
                {error}
              </div>
            )}
          </div>
        ) : (
          <div
            className="rounded-3xl border p-6 md:p-8"
            style={{ borderColor: "var(--border)", background: "var(--card)" }}
          >
            <div className="text-sm font-semibold">Submitted</div>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
              Thank you. Your acknowledgement has been recorded.
            </p>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Stat label="Scroll depth" value={`${maxScroll}%`} />
              <Stat label="Time on page" value={timeOnPageFinal} />
              <Stat label="Acknowledged" value="Yes" />
            </div>
          </div>
        )}

        {/* Footer note */}
        <div className="text-xs leading-relaxed" style={{ color: "var(--muted2)" }}>
          Receipt records access, review activity, and acknowledgement. It does not
          assess understanding and is not an e-signature product.
        </div>
      </div>
    </main>
  );
}