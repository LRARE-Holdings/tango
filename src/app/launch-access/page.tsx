"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRef } from "react";
import { TurnstileWidget, type TurnstileWidgetHandle } from "@/components/security/turnstile-widget";

function getSafeNextFromHref(href: string) {
  try {
    const url = new URL(href);
    const next = url.searchParams.get("next") || "/auth";
    return next.startsWith("/") ? next : "/auth";
  } catch {
    return "/auth";
  }
}

export default function LaunchAccessPage() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextPath, setNextPath] = useState("/auth");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileWidgetHandle | null>(null);
  const captchaEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

  useEffect(() => {
    setNextPath(getSafeNextFromHref(window.location.href));
  }, []);

  const nextLabel = useMemo(
    () => (nextPath.startsWith("/get-started") ? "sign-up" : "auth"),
    [nextPath]
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (captchaEnabled && !captchaToken) {
        throw new Error("Please complete the security check.");
      }
      const res = await fetch("/api/launch-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password,
          captchaToken,
          turnstileToken: captchaToken,
          cf_turnstile_response: captchaToken,
        }),
      });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(json?.error || "Could not unlock access.");
      window.location.replace(nextPath);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not unlock access.");
      if (captchaEnabled) turnstileRef.current?.reset();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md space-y-6">
        <div>
          <div className="text-xs font-semibold tracking-widest" style={{ color: "var(--muted2)" }}>
            EARLY ACCESS
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Receipt launches Monday, February 23, 2026</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            Enter the access password to continue to {nextLabel} before launch day.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Access password"
            className="focus-ring w-full rounded-2xl border px-4 py-3 text-sm bg-transparent"
            style={{ borderColor: "var(--border)" }}
          />
          <TurnstileWidget ref={turnstileRef} onTokenChange={setCaptchaToken} action="launch_access" />
          <button
            type="submit"
            disabled={loading || (captchaEnabled && !captchaToken)}
            className="focus-ring w-full rounded-full px-6 py-2.5 text-sm font-medium transition hover:opacity-90 disabled:opacity-50"
            style={{ background: "var(--fg)", color: "var(--bg)" }}
          >
            {loading ? "Checking…" : "Continue"}
          </button>
        </form>

        {error ? (
          <div className="text-sm" style={{ color: "#ff3b30" }}>
            {error}
          </div>
        ) : null}
      </div>
    </main>
  );
}
