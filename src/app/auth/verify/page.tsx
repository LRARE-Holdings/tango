"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

function safeNext(next: string | null) {
  return next && next.startsWith("/") ? next : "/app";
}

export default function VerifyEmailGatePage() {
  const router = useRouter();
  const sp = useSearchParams();
  const supabase = supabaseBrowser();

  const next = useMemo(() => safeNext(sp.get("next")), [sp]);
  const emailFromQuery = useMemo(() => sp.get("email") ?? "", [sp]);

  const [email, setEmail] = useState(emailFromQuery);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const siteUrl = useMemo(() => {
    return (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "") || window.location.origin;
  }, []);

  async function resend() {
    setError(null);
    setSent(false);

    const trimmed = email.trim();
    if (!trimmed) {
      setError("Enter your email address to resend the verification email.");
      return;
    }

    setSending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: trimmed,
        options: {
          // After verification click, user returns here to complete session
          emailRedirectTo: `${siteUrl}/auth/confirm?next=${encodeURIComponent(next)}`,
        },
      });

      if (error) throw error;
      setSent(true);
    } catch (e: any) {
      setError(e?.message ?? "Could not resend verification email.");
    } finally {
      setSending(false);
    }
  }

  function backToSignIn() {
    router.replace(`/auth?next=${encodeURIComponent(next)}`);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div
        className="w-full max-w-md rounded-3xl border p-6 shadow-sm md:p-8"
        style={{
          borderColor: "var(--border)",
          background: "color-mix(in srgb, var(--bg) 88%, transparent)",
        }}
      >
        <div className="space-y-2">
          <div className="text-xs font-semibold tracking-widest" style={{ color: "var(--muted2)" }}>
            VERIFY EMAIL
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">Check your inbox</h1>

          <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
            We’ve sent you a verification link. You must click it before you can access your
            workspace.
          </p>
        </div>

        <div className="mt-6 space-y-3">
          <div className="text-xs" style={{ color: "var(--muted2)" }}>
            EMAIL ADDRESS
          </div>

          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@firm.com"
            className="focus-ring w-full rounded-2xl border px-4 py-3 text-sm bg-transparent"
            style={{ borderColor: "var(--border)", color: "var(--fg)" }}
            autoComplete="email"
          />

          <button
            type="button"
            onClick={resend}
            disabled={sending}
            className="focus-ring w-full rounded-full px-6 py-2.5 text-sm font-medium transition hover:opacity-90 disabled:opacity-50"
            style={{ background: "var(--fg)", color: "var(--bg)" }}
          >
            {sending ? "Sending…" : "Resend verification email"}
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={backToSignIn}
              className="focus-ring w-full rounded-full border px-6 py-2.5 text-sm font-medium transition hover:opacity-80"
              style={{ borderColor: "var(--border)", color: "var(--fg)" }}
            >
              Back to sign in
            </button>
          </div>

          {sent && (
            <div className="text-sm" style={{ color: "var(--muted)" }}>
              Sent. Check your inbox (and spam).
            </div>
          )}

          {error && (
            <div className="text-sm" style={{ color: "#ff3b30" }}>
              {error}
            </div>
          )}

          <div className="mt-2 text-xs leading-relaxed" style={{ color: "var(--muted2)" }}>
            After you click the link, you’ll be redirected back to Receipt and taken straight into
            your workspace.
          </div>
        </div>
      </div>
    </main>
  );
}