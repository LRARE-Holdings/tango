"use client";

import Link from "next/link";
import Image from "next/image";
import { use, useEffect, useRef, useState } from "react";
import { PoweredByReceipt } from "@/components/public/powered-by-receipt";
import { TurnstileWidget, type TurnstileWidgetHandle } from "@/components/security/turnstile-widget";

export default function PublicDocAccessPage({
  params,
}: {
  params: Promise<{ publicId: string }> | { publicId: string };
}) {
  const { publicId } = use(params as Promise<{ publicId: string }>);

  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [title, setTitle] = useState("Document");
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileWidgetHandle | null>(null);
  const captchaEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

  useEffect(() => {
    let alive = true;
    async function check() {
      setChecking(true);
      setError(null);
      try {
        const res = await fetch(`/api/public/${publicId}/access`, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error ?? "Unable to load access");
        if (!alive) return;

        setTitle(json?.title ?? "Document");
        setRequiresPassword(Boolean(json?.requires_password));

        if (json?.access_granted || !json?.requires_password) {
          window.location.replace(`/d/${publicId}`);
          return;
        }
      } catch (e: unknown) {
        if (alive) setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        if (alive) {
          setChecking(false);
          setLoading(false);
        }
      }
    }
    check();
    return () => {
      alive = false;
    };
  }, [publicId]);

  async function unlock() {
    setChecking(true);
    setError(null);
    try {
      if (captchaEnabled && !captchaToken) {
        throw new Error("Please complete the security check.");
      }
      const res = await fetch(`/api/public/${publicId}/access`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          password,
          captchaToken,
          turnstileToken: captchaToken,
          cf_turnstile_response: captchaToken,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Incorrect password");
      window.location.replace(`/d/${publicId}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      if (captchaEnabled) turnstileRef.current?.reset();
    } finally {
      setChecking(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <div className="app-content-card rounded-[22px] p-6 text-sm md:p-8" style={{ color: "var(--muted)" }}>
            Loading protected delivery…
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 md:py-10">
      <div className="mx-auto max-w-4xl">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="focus-ring inline-flex items-center gap-2 rounded-full border px-3 py-1.5 app-chip text-xs font-semibold">
            <Image src="/receipt-logo.svg" alt="Receipt" width={90} height={35} className="h-3.5 w-auto" />
            <span>Secure access</span>
          </Link>
          <div className="app-chip px-3 py-1 text-xs font-semibold">/d/ protected link</div>
        </header>

        <div className="app-content-card rounded-[24px] p-6 md:p-8">
          <div className="app-section-kicker">PROTECTED LINK</div>
          <h1 className="app-hero-title mt-2 text-3xl sm:text-4xl">{title}</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed app-subtle">
            {requiresPassword
              ? "Enter the password provided by the sender to view this document."
              : "This link does not require a password."}
          </p>

          {requiresPassword ? (
            <div className="mt-5 space-y-3">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="app-input focus-ring rounded-xl px-4 py-3"
                autoComplete="current-password"
              />
              <TurnstileWidget
                ref={turnstileRef}
                onTokenChange={setCaptchaToken}
                action="public_access"
              />
              <button
                type="button"
                onClick={unlock}
                disabled={checking || !password.trim() || (captchaEnabled && !captchaToken)}
                className="focus-ring app-btn-primary disabled:opacity-50"
              >
                {checking ? "Checking…" : "Continue to document"}
              </button>
            </div>
          ) : null}

          {error ? (
            <div className="app-error mt-4">{error}</div>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/"
              className="focus-ring app-btn-secondary"
            >
              Back to home
            </Link>
            <PoweredByReceipt />
          </div>
        </div>
      </div>
    </main>
  );
}
