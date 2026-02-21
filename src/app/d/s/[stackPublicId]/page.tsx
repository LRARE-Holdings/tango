"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { TurnstileWidget, type TurnstileWidgetHandle } from "@/components/security/turnstile-widget";

type StackDocument = {
  id: string;
  title: string;
  public_id: string;
  required: boolean;
  priority: string;
  labels: string[];
  acknowledged: boolean;
  acknowledged_at: string | null;
};

type StackPayload = {
  stack: {
    id: string;
    public_id: string;
    title: string;
    workspace_name: string;
    required_total: number;
    required_acknowledged: number;
  };
  recipient: {
    id: string;
    recipient_email: string;
    recipient_name: string | null;
    completed_at: string | null;
  } | null;
  documents: StackDocument[];
};

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim().toLowerCase());
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toUTCString() : "—";
}

export default function PublicStackPage({
  params,
}: {
  params: Promise<{ stackPublicId: string }> | { stackPublicId: string };
}) {
  const { stackPublicId } = use(params as Promise<{ stackPublicId: string }>);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [data, setData] = useState<StackPayload | null>(null);
  const startedAtRef = useRef<number>(Date.now());
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileWidgetHandle | null>(null);
  const captchaEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

  const canLoadWithIdentity = useMemo(() => isEmail(email), [email]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const suffix = canLoadWithIdentity ? `?recipient_email=${encodeURIComponent(email.trim().toLowerCase())}` : "";
      const res = await fetch(`/api/public/stacks/${encodeURIComponent(stackPublicId)}${suffix}`, { cache: "no-store" });
      const json = (await res.json()) as StackPayload & { error?: string };
      if (!res.ok) throw new Error(json?.error ?? "Could not load stack.");
      setData(json);
      if (json.recipient?.recipient_name && !name) setName(json.recipient.recipient_name);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stackPublicId]);

  async function acknowledgeDocument(docPublicId: string) {
    if (!isEmail(email)) {
      setError("Enter a valid email to continue.");
      return;
    }
    if (captchaEnabled && !captchaToken) {
      setError("Please complete the security check.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const seconds = Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000));
      const res = await fetch(`/api/public/stacks/${encodeURIComponent(stackPublicId)}/submit-document`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          document_public_id: docPublicId,
          name: name.trim() || null,
          email: email.trim().toLowerCase(),
          acknowledged: true,
          max_scroll_percent: 100,
          time_on_page_seconds: seconds,
          active_seconds: seconds,
          captchaToken,
          turnstileToken: captchaToken,
          cf_turnstile_response: captchaToken,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json?.error ?? "Failed to record acknowledgement.");
      setSuccess("Acknowledgement recorded.");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed.");
      if (captchaEnabled) turnstileRef.current?.reset();
    } finally {
      setSaving(false);
    }
  }

  async function finalizeStack() {
    if (!isEmail(email)) {
      setError("Enter a valid email to finalize.");
      return;
    }
    if (captchaEnabled && !captchaToken) {
      setError("Please complete the security check.");
      return;
    }
    setFinalizing(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/public/stacks/${encodeURIComponent(stackPublicId)}/finalize`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          captchaToken,
          turnstileToken: captchaToken,
          cf_turnstile_response: captchaToken,
        }),
      });
      const json = (await res.json()) as { error?: string; receipt_id?: string };
      if (!res.ok) throw new Error(json?.error ?? "Could not finalize stack.");
      setSuccess(`Stack acknowledgement receipt generated (${json.receipt_id ?? "ok"}).`);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed.");
      if (captchaEnabled) turnstileRef.current?.reset();
    } finally {
      setFinalizing(false);
    }
  }

  const requiredOutstanding = useMemo(() => {
    if (!data) return 0;
    return data.documents.filter((doc) => doc.required && !doc.acknowledged).length;
  }, [data]);

  return (
    <main className="min-h-screen" style={{ background: "var(--bg)", color: "var(--fg)" }}>
      <div className="mx-auto max-w-4xl px-4 py-8 md:py-10">
        <div className="rounded-3xl border p-6 md:p-8" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          {loading ? <div className="text-sm">Loading stack…</div> : null}
          {!loading && data ? (
            <>
              <div className="text-xs font-semibold tracking-[0.18em]" style={{ color: "var(--muted2)" }}>
                STACK DELIVERY
              </div>
              <h1 className="mt-2 text-3xl md:text-4xl app-hero-title">{data.stack.title}</h1>
              <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
                {data.stack.workspace_name} sent this document stack. Acknowledge each required document to complete.
              </p>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your name"
                  className="focus-ring w-full rounded-xl border bg-transparent px-4 py-3 text-sm"
                  style={{ borderColor: "var(--border)" }}
                />
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@company.com"
                  className="focus-ring w-full rounded-xl border bg-transparent px-4 py-3 text-sm"
                  style={{ borderColor: "var(--border)" }}
                />
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs" style={{ color: "var(--muted2)" }}>
                <span>Required: {data.stack.required_acknowledged}/{data.stack.required_total}</span>
                <button
                  type="button"
                  onClick={() => void load()}
                  className="focus-ring rounded-full border px-3 py-1 font-semibold"
                  style={{ borderColor: "var(--border)", color: "var(--muted)" }}
                >
                  Refresh
                </button>
              </div>

              <div className="mt-6 space-y-3">
                {data.documents.map((doc) => (
                  <section
                    key={doc.id}
                    className="rounded-2xl border p-4"
                    style={{ borderColor: "var(--border)", background: "var(--card2)" }}
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="text-sm font-semibold">{doc.title}</div>
                        <div className="mt-1 text-xs" style={{ color: "var(--muted2)" }}>
                          {doc.required ? "Required" : "Optional"} • Priority {doc.priority}
                          {doc.acknowledged_at ? ` • Acknowledged ${formatDate(doc.acknowledged_at)}` : ""}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/d/${doc.public_id}`}
                          target="_blank"
                          className="focus-ring rounded-full border px-3 py-1.5 text-xs font-semibold"
                          style={{ borderColor: "var(--border)", color: "var(--muted)" }}
                        >
                          Open document
                        </Link>
                        <button
                          type="button"
                          disabled={saving || doc.acknowledged}
                          onClick={() => void acknowledgeDocument(doc.public_id)}
                          className="focus-ring rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                          style={{
                            background: doc.acknowledged ? "var(--card)" : "var(--fg)",
                            color: doc.acknowledged ? "var(--muted2)" : "var(--bg)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          {doc.acknowledged ? "Acknowledged" : "Acknowledge"}
                        </button>
                      </div>
                    </div>
                  </section>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <TurnstileWidget ref={turnstileRef} onTokenChange={setCaptchaToken} action="public_stack" />
                <button
                  type="button"
                  onClick={() => void finalizeStack()}
                  disabled={finalizing || requiredOutstanding > 0 || (captchaEnabled && !captchaToken)}
                  className="focus-ring rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50"
                  style={{ background: "var(--fg)", color: "var(--bg)" }}
                >
                  {finalizing ? "Finalizing…" : "Finalize stack acknowledgement"}
                </button>
                {requiredOutstanding > 0 ? (
                  <div className="self-center text-xs" style={{ color: "var(--muted2)" }}>
                    {requiredOutstanding} required document{requiredOutstanding === 1 ? "" : "s"} remaining.
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
          {error ? <p className="mt-4 text-sm" style={{ color: "#ef4444" }}>{error}</p> : null}
          {success ? <p className="mt-4 text-sm" style={{ color: "#16a34a" }}>{success}</p> : null}
        </div>
      </div>
    </main>
  );
}
