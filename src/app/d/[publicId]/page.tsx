"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useRef, useState } from "react";

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

function Stat({ label, value }: { label: string; value: string }) {
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

type PdfjsModule = typeof import("pdfjs-dist");

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase());
}

export default function PublicDocPage({
  params,
}: {
  params: Promise<{ publicId: string }> | { publicId: string };
}) {
  const { publicId } = use(params as any) as { publicId: string };

  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState<string>("Document");
  const [signedUrl, setSignedUrl] = useState<string>("");
  const [requireRecipientIdentity, setRequireRecipientIdentity] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startedAtRef = useRef<number>(Date.now());

  // Viewer + telemetry
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const bottomSentinelRef = useRef<HTMLDivElement | null>(null);

  const [rendering, setRendering] = useState(false);
  const [maxScroll, setMaxScroll] = useState(0); // percent 0..100
  const [reachedBottom, setReachedBottom] = useState(false);

  // Active time tracking
  const [activeSeconds, setActiveSeconds] = useState(0);
  const lastActivityAtRef = useRef<number>(Date.now());
  const activeIntervalRef = useRef<number | null>(null);
  const isPageVisibleRef = useRef(true);

  // Form
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

  // Mark user activity
  function markActivity() {
    lastActivityAtRef.current = Date.now();
  }
  // Active time tracking effect
  useEffect(() => {
    if (!signedUrl || submitted) return;

    // Reset for this viewing session
    setActiveSeconds(0);
    lastActivityAtRef.current = Date.now();
    isPageVisibleRef.current = document.visibilityState === "visible";

    const viewer = viewerRef.current;

    const onVisibility = () => {
      isPageVisibleRef.current = document.visibilityState === "visible";
      if (isPageVisibleRef.current) markActivity();
    };

    const onKey = () => markActivity();
    const onPointer = () => markActivity();
    const onTouch = () => markActivity();
    const onViewerScroll = () => markActivity();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("keydown", onKey, { passive: true });
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("mousedown", onPointer, { passive: true });
    window.addEventListener("touchstart", onTouch, { passive: true });
    window.addEventListener("wheel", onPointer, { passive: true });

    if (viewer) viewer.addEventListener("scroll", onViewerScroll, { passive: true });

    // Count active seconds when the tab is visible AND activity happened recently.
    // “Recently” = within the last 5 seconds.
    activeIntervalRef.current = window.setInterval(() => {
      const now = Date.now();
      const recentlyActive = now - lastActivityAtRef.current <= 5000;

      if (isPageVisibleRef.current && recentlyActive) {
        setActiveSeconds((s) => s + 1);
      }
    }, 1000);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("touchstart", onTouch);
      window.removeEventListener("wheel", onPointer);
      if (viewer) viewer.removeEventListener("scroll", onViewerScroll);

      if (activeIntervalRef.current) {
        window.clearInterval(activeIntervalRef.current);
        activeIntervalRef.current = null;
      }
    };
  }, [signedUrl, submitted]);

  // Load public doc metadata + signed URL
  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/public/${publicId}`, { cache: "no-store" });
        const json = await res.json();

        if (res.status === 403 && json?.requires_password) {
          window.location.replace(`/d/${publicId}/access`);
          return;
        }

        if (!res.ok) throw new Error(json?.error ?? "Not found");

        setTitle(json.document?.title ?? "Document");
        setRequireRecipientIdentity(Boolean(json.document?.require_recipient_identity));
        setSignedUrl(json.signedUrl ?? "");
      } catch (e: any) {
        setError(e?.message ?? "Something went wrong");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [publicId]);

  // Track scroll on the *viewer container*, not window
  useEffect(() => {
    const el = viewerRef.current;
    if (!el) return;

    let raf = 0;

    const onScroll = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const max = Math.max(1, el.scrollHeight - el.clientHeight);
        const pct = Math.round(Math.min(1, Math.max(0, el.scrollTop / max)) * 100);
        setMaxScroll((prev) => Math.max(prev, pct));
      });
    };

    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      el.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [signedUrl]);

  const identityValid = useMemo(() => {
    if (!requireRecipientIdentity) return true;
    if (!name.trim() || !email.trim()) return false;
    return isEmail(email);
  }, [requireRecipientIdentity, name, email]);

  // Sentinel-based bottom detection (more robust than math alone)
  useEffect(() => {
    const root = viewerRef.current;
    const target = bottomSentinelRef.current;
    if (!root || !target) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setReachedBottom(true);
      },
      { root, threshold: 0.9 }
    );

    io.observe(target);
    return () => io.disconnect();
  }, [signedUrl]);

  // Render PDF into canvases using pdfjs (so we can measure scroll correctly)
  useEffect(() => {
    let cancelled = false;

    async function renderPdf() {
      if (!signedUrl) return;
      const host = canvasHostRef.current;
      const viewer = viewerRef.current;
      if (!host || !viewer) return;

      setRendering(true);
      setReachedBottom(false);
      setMaxScroll(0);

      // Clear previous canvases
      host.innerHTML = "";

      try {
        // Lazy-load pdfjs only on this page
        const pdfjs: PdfjsModule = await import("pdfjs-dist");

        // Worker setup (uses bundler-resolved URL)
        // @ts-ignore - pdfjs-dist typing varies by version
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url
        ).toString();

        const loadingTask = pdfjs.getDocument(signedUrl);
        const pdf = await loadingTask.promise;

        // Measure available width for responsive scaling
        const maxWidth = Math.max(320, Math.min(900, viewer.clientWidth - 48)); // account for padding

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          if (cancelled) return;

          const page = await pdf.getPage(pageNum);

          // Base viewport at scale 1
          const baseViewport = page.getViewport({ scale: 1 });
          const scale = maxWidth / baseViewport.width;
          const viewport = page.getViewport({ scale });

          const wrap = document.createElement("div");
          wrap.style.padding = "16px 24px";
          wrap.style.display = "flex";
          wrap.style.justifyContent = "center";

          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");

          // High-DPI crispness
          const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
          canvas.width = Math.floor(viewport.width * dpr);
          canvas.height = Math.floor(viewport.height * dpr);
          canvas.style.width = `${Math.floor(viewport.width)}px`;
          canvas.style.height = `${Math.floor(viewport.height)}px`;
          canvas.style.borderRadius = "24px";
          canvas.style.boxShadow = "0 1px 0 rgba(0,0,0,0.02)";
          canvas.style.border = "1px solid var(--border)";
          canvas.style.background = "white"; // keeps pages legible in dark mode

          wrap.appendChild(canvas);
          host.appendChild(wrap);

          if (!ctx) continue;

          const renderContext = {
            canvasContext: ctx,
            viewport: viewport.clone({ scale: scale * dpr }),
          };

          await page.render(renderContext as any).promise;
        }

        // Trigger an initial scroll compute after render
        if (!cancelled && viewerRef.current) {
          const el = viewerRef.current;
          const max = Math.max(1, el.scrollHeight - el.clientHeight);
          const pct = Math.round(Math.min(1, Math.max(0, el.scrollTop / max)) * 100);
          setMaxScroll((prev) => Math.max(prev, pct));
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(
            e?.message ??
              "Could not render this PDF. If this persists, ask the sender to re-upload."
          );
        }
      } finally {
        if (!cancelled) setRendering(false);
      }
    }

    renderPdf();

    return () => {
      cancelled = true;
    };
  }, [signedUrl]);

  async function submit() {
    if (!identityValid) {
      setError("Name and a valid email are required for this document.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const seconds = Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000));

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
          active_seconds: activeSeconds,
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
            <h1 className="mt-1 text-xl sm:text-2xl font-semibold tracking-tight">{title}</h1>


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
              Max scroll: {maxScroll}%{reachedBottom ? " • Reached end" : ""}
            </div>
          </div>

          {/* Viewer (scroll container we control) */}
          <div
            ref={viewerRef}
            className="relative h-[70vh] overflow-y-auto"
            style={{ background: "var(--card)" }}
          >
            {rendering ? (
              <div className="px-6 py-6 text-sm" style={{ color: "var(--muted)" }}>
                Rendering…
              </div>
            ) : null}

            <div ref={canvasHostRef} />

            {/* bottom sentinel */}
            <div ref={bottomSentinelRef} className="h-2" />
          </div>
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
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
                  By submitting, you confirm you have reviewed this document. Receipt records
                  timestamps and review activity (time and scroll depth), and the network address
                  (IP) used to access this page. It does not assess understanding and is not an
                  e-signature product.
                </p>
              </div>

              <div className="text-xs space-y-1" style={{ color: "var(--muted)" }}>
                <div>
                  Scroll depth: <span style={{ color: "var(--fg)" }}>{maxScroll}%</span>
                </div>
                <div>
                  Time on page:{" "}
                  <span style={{ color: "var(--fg)" }}>recorded on submit</span>
                </div>
                <div>
                  Active time:{" "}
                  <span style={{ color: "var(--fg)" }}>{activeSeconds}s</span>
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={requireRecipientIdentity ? "Your name (required)" : "Your name (optional)"}
                className="focus-ring rounded-2xl border px-4 py-3 text-sm bg-transparent"
                style={{ borderColor: "var(--border)" }}
              />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={requireRecipientIdentity ? "Your email (required)" : "Your email (optional)"}
                className="focus-ring rounded-2xl border px-4 py-3 text-sm bg-transparent"
                style={{ borderColor: "var(--border)" }}
              />
            </div>
            {requireRecipientIdentity && !identityValid ? (
              <div className="mt-3 text-xs" style={{ color: "#ff3b30" }}>
                Name and a valid email are required for this acknowledgement.
              </div>
            ) : null}

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
                disabled={!ack || submitting || rendering || !identityValid}
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

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
              <Stat label="Scroll depth" value={`${maxScroll}%`} />
              <Stat label="Time on page" value={timeOnPageFinal} />
              <Stat label="Active time" value={`${activeSeconds}s`} />
              <Stat label="Acknowledged" value="Yes" />
            </div>
          </div>
        )}

        {/* Footer note */}
        <div className="text-xs leading-relaxed" style={{ color: "var(--muted2)" }}>
          Receipt records access, review activity, acknowledgement, and the network address (IP)
          used to access this page. It does not assess understanding and is not an e-signature
          product.
        </div>
      </div>
    </main>
  );
}
