"use client";

import Link from "next/link";
import Image from "next/image";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { PoweredByReceipt } from "@/components/public/powered-by-receipt";
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
    <main className="min-h-screen px-4 py-8 sm:px-6 md:py-10">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="focus-ring inline-flex items-center gap-2 rounded-full border px-3 py-1.5 app-chip text-xs font-semibold"
          >
            <Image src="/receipt-logo.svg" alt="Receipt" width={90} height={35} className="h-3.5 w-auto" />
            <span>Stack acknowledgement</span>
          </Link>
          <div className="app-chip px-3 py-1 text-xs font-semibold">{data?.stack.workspace_name ?? "Receipt"}</div>
        </header>

        <section className="app-content-card rounded-[24px] p-6 md:p-8">
          {loading ? <div className="text-sm app-subtle">Loading stack…</div> : null}
          {!loading && data ? (
            <>
              <div className="app-section-kicker">STACK DELIVERY</div>
              <h1 className="mt-2 text-3xl app-hero-title md:text-4xl">{data.stack.title}</h1>
              <p className="mt-2 text-sm app-subtle">
                {data.stack.workspace_name} sent this document stack. Acknowledge each required document to complete.
              </p>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your name"
                  className="app-input focus-ring rounded-xl px-4 py-3"
                />
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@company.com"
                  className="app-input focus-ring rounded-xl px-4 py-3"
                />
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs app-subtle-2">
                <span>
                  Required: {data.stack.required_acknowledged}/{data.stack.required_total}
                </span>
                <button type="button" onClick={() => void load()} className="focus-ring app-btn-secondary px-3 py-1 text-xs font-semibold">
                  Refresh
                </button>
              </div>

              <div className="mt-6 space-y-3">
                {data.documents.map((doc) => (
                  <section key={doc.id} className="app-card-soft rounded-2xl p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="text-sm font-semibold">{doc.title}</div>
                        <div className="mt-1 text-xs app-subtle-2">
                          {doc.required ? "Required" : "Optional"} • Priority {doc.priority}
                          {doc.acknowledged_at ? ` • Acknowledged ${formatDate(doc.acknowledged_at)}` : ""}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/d/${doc.public_id}`} target="_blank" className="focus-ring app-btn-secondary px-3 py-1.5 text-xs font-semibold">
                          Open document
                        </Link>
                        <button
                          type="button"
                          disabled={saving || doc.acknowledged}
                          onClick={() => void acknowledgeDocument(doc.public_id)}
                          className="focus-ring rounded-full border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                          style={{
                            background: doc.acknowledged ? "color-mix(in srgb, var(--card) 92%, transparent)" : "var(--fg)",
                            color: doc.acknowledged ? "var(--muted2)" : "var(--bg)",
                            borderColor: "var(--border)",
                          }}
                        >
                          {doc.acknowledged ? "Acknowledged" : "Acknowledge"}
                        </button>
                      </div>
                    </div>
                  </section>
                ))}
              </div>

              <p className="mt-4 text-xs leading-relaxed app-subtle">
                By clicking acknowledge you agree to our{" "}
                <Link href="/terms" target="_blank" className="underline underline-offset-4 hover:opacity-80">
                  terms of service
                </Link>
                ,{" "}
                <Link href="/privacy" target="_blank" className="underline underline-offset-4 hover:opacity-80">
                  privacy policy
                </Link>
                {" "}and our{" "}
                <Link href="/dpa" target="_blank" className="underline underline-offset-4 hover:opacity-80">
                  DPA
                </Link>
                .
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <TurnstileWidget ref={turnstileRef} onTokenChange={setCaptchaToken} action="public_stack" />
                <button
                  type="button"
                  onClick={() => void finalizeStack()}
                  disabled={finalizing || requiredOutstanding > 0 || (captchaEnabled && !captchaToken)}
                  className="focus-ring app-btn-primary disabled:opacity-50"
                >
                  {finalizing ? "Finalizing…" : "Finalize stack acknowledgement"}
                </button>
                {requiredOutstanding > 0 ? (
                  <div className="self-center text-xs app-subtle-2">
                    {requiredOutstanding} required document{requiredOutstanding === 1 ? "" : "s"} remaining.
                  </div>
                ) : null}
                <PoweredByReceipt className="ml-auto" />
              </div>
            </>
          ) : null}
          {error ? <p className="app-error mt-4">{error}</p> : null}
          {success ? (
            <div
              className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: "color-mix(in srgb, #15803d 38%, var(--border))", background: "color-mix(in srgb, #16a34a 10%, var(--card))" }}
            >
              <span style={{ color: "color-mix(in srgb, #166534 84%, var(--fg))" }}>{success}</span>
              <PoweredByReceipt />
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
