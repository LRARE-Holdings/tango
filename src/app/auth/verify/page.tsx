"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

function getSafeNextFromUrl(href: string) {
  try {
    const url = new URL(href);
    const next = url.searchParams.get("next") || "/app";
    return next.startsWith("/") ? next : "/app";
  } catch {
    return "/app";
  }
}

export default function VerifyEmailPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [nextPath, setNextPath] = useState("/app");
  const [email, setEmail] = useState<string | null>(null);

  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Read params without useSearchParams (avoids Next build CSR bailout rule)
    const href = window.location.href;
    const url = new URL(href);

    setNextPath(getSafeNextFromUrl(href));

    const emailParam = url.searchParams.get("email");
    setEmail(emailParam ? decodeURIComponent(emailParam) : null);
  }, []);

  const subtitle = useMemo(() => {
    if (email) return `We sent a verification email to ${email}.`;
    return "We sent a verification email to your inbox.";
  }, [email]);

  async function iHaveVerified() {
    setChecking(true);
    setError(null);

    try {
      const { data, error: meErr } = await supabase.auth.getUser();
      if (meErr) throw meErr;

      // Supabase user object includes email_confirmed_at when confirmed
      const confirmedAt = (data?.user as any)?.email_confirmed_at as string | null;

      if (!confirmedAt) {
        setError("Still not verified — please check your inbox (and spam), then try again.");
        setChecking(false);
        return;
      }

      router.replace(nextPath);
    } catch (e: any) {
      setError(e?.message ?? "Could not check verification status.");
      setChecking(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-5">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Verify your email</h1>
          <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
            {subtitle} Click the link inside it to activate your account.
          </p>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={iHaveVerified}
            disabled={checking}
            className="focus-ring w-full rounded-full px-6 py-2.5 text-sm font-medium transition hover:opacity-90 disabled:opacity-50"
            style={{ background: "var(--fg)", color: "var(--bg)" }}
          >
            {checking ? "Checking…" : "I’ve verified"}
          </button>

          <Link
            href={`/auth?next=${encodeURIComponent(nextPath)}`}
            className="focus-ring inline-flex w-full items-center justify-center rounded-full border px-6 py-2.5 text-sm font-medium transition hover:opacity-80"
            style={{ borderColor: "var(--border)", color: "var(--muted)" }}
          >
            Back to sign in
          </Link>
        </div>

        {error && (
          <div className="text-sm" style={{ color: "#ff3b30" }}>
            {error}
          </div>
        )}

        <div className="text-xs leading-relaxed" style={{ color: "var(--muted2)" }}>
          Didn’t get it? Check spam/junk. If you used the wrong email, go back and sign up again.
        </div>
      </div>
    </main>
  );
}