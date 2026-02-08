"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Status = "loading" | "ok" | "error";

export default function BillingSuccessPage() {
  const router = useRouter();
  const params = useSearchParams();

  const sessionId = useMemo(() => params.get("session_id"), [params]);

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        // If you already have a route that can verify a checkout session,
        // call it here. If not, we just do a lightweight "refresh me".
        if (!sessionId) {
          if (alive) setStatus("ok");
          return;
        }

        // Optional: call a verify endpoint if you have one
        // const res = await fetch(`/api/billing/checkout/verify?session_id=${encodeURIComponent(sessionId)}`, { cache: "no-store" });

        // Refresh app state (plan/tier) so UI updates immediately after Stripe redirect.
        await fetch("/api/app/me", { cache: "no-store" }).catch(() => {});
        if (!alive) return;

        setStatus("ok");

        // Nice UX: after a moment, send them to the dashboard.
        window.setTimeout(() => {
          router.replace("/app");
        }, 1200);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "Could not confirm billing");
        setStatus("error");
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [router, sessionId]);

  return (
    <main className="min-h-[70vh] flex items-center justify-center px-6">
      <div
        className="w-full max-w-lg border p-6 md:p-8"
        style={{ borderColor: "var(--border)", background: "var(--card)", borderRadius: 12 }}
      >
        <div className="text-xs tracking-widest" style={{ color: "var(--muted2)" }}>
          BILLING
        </div>

        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {status === "loading" ? "Finalising…" : status === "ok" ? "You’re all set." : "Something went wrong."}
        </h1>

        <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
          {status === "loading"
            ? "Just confirming your subscription. One moment."
            : status === "ok"
              ? "Payment confirmed. Taking you back to your dashboard."
              : "We couldn’t confirm your purchase automatically. Your payment may still have gone through."}
        </p>

        {sessionId ? (
          <div className="mt-4 text-xs" style={{ color: "var(--muted2)" }}>
            Session: <span style={{ color: "var(--fg)" }}>{sessionId}</span>
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 text-sm" style={{ color: "#ff3b30" }}>
            {error}
          </div>
        ) : null}

        <div className="mt-6 flex gap-2 flex-wrap">
          <Link
            href="/app"
            className="focus-ring px-4 py-2 text-sm font-semibold hover:opacity-90"
            style={{ background: "var(--fg)", color: "var(--bg)", borderRadius: 10 }}
          >
            Go to dashboard
          </Link>
          <Link
            href="/app/account"
            className="focus-ring px-4 py-2 text-sm font-medium hover:opacity-80"
            style={{ border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 10 }}
          >
            Manage billing
          </Link>
        </div>
      </div>
    </main>
  );
}