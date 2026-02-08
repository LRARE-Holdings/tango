"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

function isSafeNext(next: string | null) {
  return !!next && next.startsWith("/") && !next.startsWith("//");
}

export default function VerifyEmailPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [nextPath, setNextPath] = useState("/app");

  const [email, setEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setChecking(true);
      setError(null);

      // Read ?next= safely without useSearchParams (avoids Next build CSR bailout rules)
      try {
        const url = new URL(window.location.href);
        const raw = url.searchParams.get("next");
        const safe = isSafeNext(raw) ? (raw as string) : "/app";
        if (!cancelled) setNextPath(safe);

        const { data, error } = await supabase.auth.getUser();
        if (cancelled) return;

        if (error) {
          setError(error.message);
          setChecking(false);
          return;
        }

        const user = data?.user;
        if (!user) {
          router.replace(`/auth?next=${encodeURIComponent(safe)}`);
          return;
        }

        setEmail(user.email ?? null);

        // If confirmed already, continue
        const confirmed = Boolean((user as any)?.email_confirmed_at || (user as any)?.confirmed_at);
        if (confirmed) {
          router.replace(safe);
          return;
        }

        setChecking(false);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Could not load verification state");
          setChecking(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [router, supabase]);

  async function resend() {
    if (!email) return;
    setSending(true);
    setError(null);
    setSent(false);

    try {
      const siteUrl =
        (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "") || window.location.origin;

      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          // Where Supabase sends them after clicking verification:
          emailRedirectTo: `${siteUrl}/auth/confirm?next=${encodeURIComponent(nextPath)}`,
        },
      });

      if (error) throw error;
      setSent(true);
    } catch (e: any) {
      setError(e?.message ?? "Could not resend email");
    } finally {
      setSending(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/auth");
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Verify your email</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            We’ve sent a verification link to your email. You’ll need to confirm it before you can
            use Receipt.
          </p>
        </div>

        {checking ? (
          <div className="text-sm" style={{ color: "var(--muted)" }}>
            Checking…
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-sm" style={{ color: "var(--muted)" }}>
              Email: <span style={{ color: "var(--fg)" }}>{email ?? "—"}</span>
            </div>

            <button
              type="button"
              onClick={resend}
              disabled={sending || !email}
              className="focus-ring w-full rounded-full px-6 py-2.5 text-sm font-medium transition hover:opacity-90 disabled:opacity-50"
              style={{ background: "var(--fg)", color: "var(--bg)" }}
            >
              {sending ? "Sending…" : "Resend verification email"}
            </button>

            <button
              type="button"
              onClick={signOut}
              className="focus-ring w-full rounded-full border px-6 py-2.5 text-sm font-medium transition hover:opacity-80"
              style={{ borderColor: "var(--border)", color: "var(--fg)" }}
            >
              Sign out
            </button>

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

            <div className="text-xs leading-relaxed" style={{ color: "var(--muted2)" }}>
              After you click the link, you’ll be redirected back to Receipt automatically.
            </div>
          </div>
        )}
      </div>
    </main>
  );
}