"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { safeInternalPath } from "@/lib/safe-redirect";

function getSiteUrl() {
  const raw = (process.env.NEXT_PUBLIC_APP_URL || "").trim();
  return raw ? raw.replace(/\/$/, "") : window.location.origin;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function CheckEmailPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [email, setEmail] = useState<string | null>(null);
  const [nextPath, setNextPath] = useState("/app");
  const [firstName, setFirstName] = useState("");

  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const url = new URL(window.location.href);
        const qpEmail = url.searchParams.get("email");
        const qpNext = url.searchParams.get("next");
        const qpFirstName = url.searchParams.get("first_name");

        if (!cancelled) {
          setEmail(qpEmail || null);
          setNextPath(safeInternalPath(qpNext, "/app"));
          setFirstName((qpFirstName || "").trim());
        }

        // Fallback: if no email passed, try authed user (often null for unverified signups)
        if (!qpEmail) {
          const { data } = await supabase.auth.getUser();
          if (!cancelled) setEmail(data?.user?.email ?? null);
        }
      } catch {
        // ignore
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function resend() {
    if (!email) {
      setError("Missing email address. Go back and enter it again.");
      return;
    }

    setSending(true);
    setSent(false);
    setError(null);

    try {
      const siteUrl = getSiteUrl();
      const emailRedirectTo = `${siteUrl}/auth/confirm?next=${encodeURIComponent(nextPath)}${
        firstName ? `&first_name=${encodeURIComponent(firstName)}` : ""
      }`;

      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo },
      });

      if (error) throw error;
      setSent(true);
    } catch (error: unknown) {
      setError(errorMessage(error, "Could not resend email"));
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-10">
      <div className="relative w-full max-w-md border p-6 md:p-7" style={{ borderColor: "var(--border)", background: "var(--card)", borderRadius: 18 }}>
        <Link
          href="/"
          aria-label="Exit authentication"
          className="focus-ring absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full border text-lg leading-none transition hover:opacity-85"
          style={{ borderColor: "var(--border)", color: "var(--muted)", background: "var(--card2)" }}
        >
          ×
        </Link>
        <div className="space-y-3">
          <div
            className="text-xs font-semibold tracking-widest"
            style={{ color: "var(--muted2)" }}
          >
            VERIFY YOUR EMAIL
          </div>
          <h1 className="marketing-serif text-4xl tracking-tight">
            Check your inbox
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
            We’ve sent a verification link to confirm your account.
          </p>
        </div>

        <div className="mt-6 border p-5" style={{ borderColor: "var(--border)", background: "var(--bg)", borderRadius: 14 }}>
          <div className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>
            EMAIL
          </div>
          <div className="mt-1 text-sm font-semibold">{email ?? "Not available"}</div>

          <div className="mt-3 text-xs leading-relaxed" style={{ color: "var(--muted2)" }}>
            If you can’t see it, check spam, some corporate filters are aggressive.
          </div>

          <div className="mt-5 flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={resend}
              disabled={sending}
              className="focus-ring inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium transition hover:opacity-90 disabled:opacity-50"
              style={{ background: "var(--fg)", color: "var(--bg)" }}
            >
              {sending ? "Sending…" : "Resend email"}
            </button>

            <Link
              href={`/auth?next=${encodeURIComponent(nextPath)}`}
              className="focus-ring inline-flex items-center justify-center border px-5 py-2.5 text-sm font-medium transition hover:opacity-80"
              style={{ borderColor: "var(--border)", color: "var(--muted)" }}
            >
              Back to sign in
            </Link>
          </div>

          {sent && (
            <div className="mt-3 text-sm" style={{ color: "var(--muted)" }}>
              Sent. Check your inbox.
            </div>
          )}

          {error && (
            <div className="mt-3 text-sm" style={{ color: "#ff3b30" }}>
              {error}
            </div>
          )}
        </div>

        <div className="mt-6 text-xs" style={{ color: "var(--muted2)" }}>
          Already verified?{" "}
          <button
            className="underline underline-offset-4 hover:opacity-80"
            type="button"
            onClick={() => router.replace(nextPath)}
          >
            Continue
          </button>
        </div>
      </div>
    </main>
  );
}
