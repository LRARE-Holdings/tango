"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Mode = "signin" | "signup";

export default function AuthPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentReset, setSentReset] = useState(false);

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
        router.replace("/app");
        return;
      }

      // signup
      const { error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // optional: after email confirm, Supabase can send user here
          emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin}/auth/callback`,
        },
      });
      if (signUpErr) throw signUpErr;

      // You can either:
      // - send them to /app immediately if you have "Confirm email" disabled
      // - or show a “check your inbox” screen if confirm email is enabled
      router.replace("/app");
    } catch (e: any) {
      setError(e?.message ?? "Could not sign in");
    } finally {
      setLoading(false);
    }
  }

  async function signInWithGoogle() {
    setLoading(true);
    setError(null);
    try {
      const siteUrl =
        (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "") ||
        window.location.origin;

      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${siteUrl}/auth/callback`,
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
      const siteUrl =
        (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "") ||
        window.location.origin;

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
          <h1 className="text-2xl font-semibold tracking-tight">
            {mode === "signin" ? "Sign in" : "Create your account"}
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            {mode === "signin"
              ? "Sign in with email and password."
              : "Create an account to start using Receipt."}
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