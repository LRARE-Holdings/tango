"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function CheckEmailPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [email, setEmail] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.auth.getUser();
      setEmail(data?.user?.email ?? null);
    }
    load();
  }, [supabase]);

  async function resend() {
    if (!email) return;

    setSending(true);
    setError(null);
    setSent(false);

    try {
      const siteUrl =
        process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
        window.location.origin;

      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: `${siteUrl}/auth/confirm`,
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
          <h1 className="text-2xl font-semibold tracking-tight">
            Check your email
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            We’ve sent you a verification link. You’ll need to confirm it before
            you can use Receipt.
          </p>
        </div>

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
          Back to login
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
      </div>
    </main>
  );
}