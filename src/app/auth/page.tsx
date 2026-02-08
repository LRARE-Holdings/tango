"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Mode = "signin" | "signup";

function getSafeNextFromHref(href: string) {
  try {
    const url = new URL(href);
    const next = url.searchParams.get("next") || "/app";
    return next.startsWith("/") ? next : "/app";
  } catch {
    return "/app";
  }
}

function getSiteUrl() {
  const raw = (process.env.NEXT_PUBLIC_APP_URL || "").trim();
  const base = raw ? raw.replace(/\/$/, "") : window.location.origin;
  return base;
}

export default function AuthPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [nextPath, setNextPath] = useState("/app");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentReset, setSentReset] = useState(false);

  useEffect(() => {
    // Avoid `useSearchParams()` to keep builds stable.
    setNextPath(getSafeNextFromHref(window.location.href));
  }, []);

  const title = useMemo(
    () => (mode === "signin" ? "Sign in" : "Create your account"),
    [mode]
  );

  const subtitle = useMemo(
    () =>
      mode === "signin"
        ? "Sign in with email and password."
        : "Create an account to start using Receipt.",
    [mode]
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSentReset(false);

    try {
      if (mode === "signin") {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInErr) throw signInErr;
        router.replace(nextPath);
        return;
      }

      // signup
      const siteUrl = getSiteUrl();

      const { error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // After email confirmation, Supabase can send the user here.
          // (If confirmations are disabled, the user will be immediately authenticated anyway.)
          emailRedirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        },
      });
      if (signUpErr) throw signUpErr;

      // Gate new users on verification using the simple holding page.
      router.replace(
        `/auth/check-email?next=${encodeURIComponent(nextPath)}&email=${encodeURIComponent(email)}`
      );
    } catch (e: any) {
      setError(e?.message ?? "Could not continue");
    } finally {
      setLoading(false);
    }
  }

  async function signInWithGoogle() {
    setLoading(true);
    setError(null);
    try {
      const siteUrl = getSiteUrl();

      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        },
      });
      if (oauthErr) throw oauthErr;
      // browser redirects away
    } catch (e: any) {
      setError(e?.message ?? "Could not start Google sign-in");
      setLoading(false);
    }
  }

  async function forgotPassword() {
    setLoading(true);
    setError(null);
    setSentReset(false);

    try {
      const siteUrl = getSiteUrl();

      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${siteUrl}/auth/reset`,
      });
      if (resetErr) throw resetErr;

      setSentReset(true);
    } catch (e: any) {
      setError(e?.message ?? "Could not send reset email");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            {subtitle}
          </p>
        </div>

        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={loading}
          className="focus-ring w-full rounded-full border px-4 py-2.5 text-sm font-medium transition hover:opacity-90 disabled:opacity-50"
          style={{ borderColor: "var(--border)", color: "var(--fg)" }}
        >
          Continue with Google
        </button>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1" style={{ background: "var(--border)" }} />
          <div className="text-xs" style={{ color: "var(--muted2)" }}>
            OR
          </div>
          <div className="h-px flex-1" style={{ background: "var(--border)" }} />
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@firm.com"
            className="focus-ring w-full rounded-2xl border px-4 py-3 text-sm bg-transparent"
            style={{ borderColor: "var(--border)" }}
          />

          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="focus-ring w-full rounded-2xl border px-4 py-3 text-sm bg-transparent"
            style={{ borderColor: "var(--border)" }}
          />

          <button
            type="submit"
            disabled={loading}
            className="focus-ring w-full rounded-full px-6 py-2.5 text-sm font-medium transition hover:opacity-90 disabled:opacity-50"
            style={{ background: "var(--fg)", color: "var(--bg)" }}
          >
            {loading ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div className="flex items-center justify-between text-xs" style={{ color: "var(--muted)" }}>
          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="underline underline-offset-4 hover:opacity-80"
            disabled={loading}
          >
            {mode === "signin" ? "Create an account" : "Already have an account?"}
          </button>

          <button
            type="button"
            onClick={forgotPassword}
            className="underline underline-offset-4 hover:opacity-80"
            disabled={loading || !email}
            title={!email ? "Enter your email first" : "Send reset email"}
          >
            Forgot password
          </button>
        </div>

        {sentReset && (
          <div className="text-sm" style={{ color: "var(--muted)" }}>
            Password reset email sent.
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