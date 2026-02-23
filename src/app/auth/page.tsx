"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { safeInternalPath } from "@/lib/safe-redirect";
import { TurnstileWidget, type TurnstileWidgetHandle } from "@/components/security/turnstile-widget";
import { useRef } from "react";

type Mode = "signin" | "signup";
const MIN_PASSWORD_LENGTH = 8;

function getSafeNextFromHref(href: string) {
  try {
    const url = new URL(href);
    return safeInternalPath(url.searchParams.get("next"), "/app");
  } catch {
    return "/app";
  }
}

function getSiteUrl() {
  const raw = (process.env.NEXT_PUBLIC_APP_URL || "").trim();
  const base = raw ? raw.replace(/\/$/, "") : window.location.origin;
  return base;
}

function hardRedirect(path: string) {
  window.location.replace(path);
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function normalizeFirstName(input: string) {
  const clean = input.trim().replace(/\s+/g, " ");
  if (!clean) return "";
  return (clean.split(" ")[0] ?? "").slice(0, 80);
}

export default function AuthPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [mode, setMode] = useState<Mode>("signin");
  const [firstNameInput, setFirstNameInput] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [nextPath, setNextPath] = useState("/app");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentReset, setSentReset] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileWidgetHandle | null>(null);
  const captchaEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

  useEffect(() => {
    // Avoid `useSearchParams()` to keep builds stable.
    const href = window.location.href;
    setNextPath(getSafeNextFromHref(href));
    try {
      const url = new URL(href);
      const authError = url.searchParams.get("error");
      if (authError) setError(authError);
    } catch {
      // ignore
    }
  }, []);

  const title = useMemo(
    () => (mode === "signin" ? "Sign in" : "Create your account"),
    [mode]
  );

  const subtitle = useMemo(
    () =>
      mode === "signin"
        ? "Sign in with email and password."
        : "Create an account to start using Receipt. We’ll use your first name in-app.",
    [mode]
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSentReset(false);

    try {
      if (captchaEnabled && !captchaToken) {
        throw new Error("Please complete the security check.");
      }

      if (mode === "signin") {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email,
          password,
          options: { captchaToken: captchaToken ?? undefined },
        });
        if (signInErr) throw signInErr;
        hardRedirect(nextPath);
        return;
      }

      // signup
      const siteUrl = getSiteUrl();
      const firstName = normalizeFirstName(firstNameInput);
      if (!firstName) {
        throw new Error("Enter your first name to continue.");
      }
      if (password.length < MIN_PASSWORD_LENGTH) {
        throw new Error(`Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`);
      }

      const { error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          captchaToken: captchaToken ?? undefined,
          // After email confirmation, Supabase can send the user here.
          // (If confirmations are disabled, the user will be immediately authenticated anyway.)
          emailRedirectTo: `${siteUrl}/auth/confirm?next=${encodeURIComponent(nextPath)}&first_name=${encodeURIComponent(firstName)}`,
          data: {
            first_name: firstName,
            full_name: firstName,
          },
        },
      });
      if (signUpErr) throw signUpErr;

      // Gate new users on verification using the simple holding page.
      router.replace(
        `/auth/check-email?next=${encodeURIComponent(nextPath)}&email=${encodeURIComponent(email)}&first_name=${encodeURIComponent(firstName)}`
      );
    } catch (error: unknown) {
      setError(errorMessage(error, "Could not continue"));
      if (captchaEnabled) turnstileRef.current?.reset();
    } finally {
      setLoading(false);
    }
  }

  async function signInWithGoogle() {
    setLoading(true);
    setError(null);
    try {
      if (captchaEnabled && !captchaToken) {
        throw new Error("Please complete the security check.");
      }
      const siteUrl = getSiteUrl();
      const firstName = normalizeFirstName(firstNameInput);
      if (mode === "signup" && !firstName) {
        throw new Error("Enter your first name before continuing with Google.");
      }

      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${siteUrl}/auth/confirm?next=${encodeURIComponent(nextPath)}${
            firstName ? `&first_name=${encodeURIComponent(firstName)}` : ""
          }`,
          captchaToken: captchaToken ?? undefined,
        },
      });
      if (oauthErr) throw oauthErr;
      // browser redirects away
    } catch (error: unknown) {
      setError(errorMessage(error, "Could not start Google sign-in"));
      if (captchaEnabled) turnstileRef.current?.reset();
      setLoading(false);
    }
  }

  async function forgotPassword() {
    setLoading(true);
    setError(null);
    setSentReset(false);

    try {
      const res = await fetch("/api/auth/password-reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          captchaToken,
          turnstileToken: captchaToken,
          cf_turnstile_response: captchaToken,
        }),
      });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(json?.error || "Could not send reset email.");

      setSentReset(true);
    } catch (error: unknown) {
      setError(errorMessage(error, "Could not send reset email."));
      if (captchaEnabled) turnstileRef.current?.reset();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-10">
      <div
        className="relative w-full max-w-md space-y-6 border p-6 md:p-7"
        style={{ borderColor: "var(--border)", background: "var(--card)", borderRadius: 18 }}
      >
        <Link
          href="/"
          aria-label="Exit authentication"
          className="focus-ring absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full border text-lg leading-none transition hover:opacity-85"
          style={{ borderColor: "var(--border)", color: "var(--muted)", background: "var(--card2)" }}
        >
          ×
        </Link>
        <div>
          <h1 className="marketing-serif text-4xl tracking-tight">{title}</h1>
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
          {mode === "signup" ? (
            <>
              <label htmlFor="auth-first-name" className="sr-only">
                First name
              </label>
              <input
                id="auth-first-name"
                type="text"
                required
                value={firstNameInput}
                onChange={(e) => setFirstNameInput(e.target.value)}
                placeholder="First name"
                className="focus-ring w-full rounded-2xl border px-4 py-3 text-sm bg-transparent"
                style={{ borderColor: "var(--border)" }}
              />
            </>
          ) : null}

          <label htmlFor="auth-email" className="sr-only">
            Email address
          </label>
          <input
            id="auth-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@firm.com"
            className="focus-ring w-full rounded-2xl border px-4 py-3 text-sm bg-transparent"
            style={{ borderColor: "var(--border)" }}
          />

          <label htmlFor="auth-password" className="sr-only">
            Password
          </label>
          <input
            id="auth-password"
            type="password"
            required
            minLength={mode === "signup" ? MIN_PASSWORD_LENGTH : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "signup" ? "Password (min 8 characters)" : "Password"}
            className="focus-ring w-full rounded-2xl border px-4 py-3 text-sm bg-transparent"
            style={{ borderColor: "var(--border)" }}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />

          <TurnstileWidget
            ref={turnstileRef}
            onTokenChange={setCaptchaToken}
            className="pt-1"
            action="auth"
          />

          <button
            type="submit"
            disabled={loading || (captchaEnabled && !captchaToken)}
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
            disabled={loading || !email || (captchaEnabled && !captchaToken)}
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

        <div className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
          By continuing, you agree to our{" "}
          <Link href="/terms" className="underline underline-offset-4 hover:opacity-80">
            Terms of Service
          </Link>
          ,{" "}
          <Link href="/privacy" className="underline underline-offset-4 hover:opacity-80">
            Privacy Policy
          </Link>
          , and{" "}
          <Link href="/dpa" className="underline underline-offset-4 hover:opacity-80">
            DPA
          </Link>
          , and{" "}
          <Link href="/data-retention" className="underline underline-offset-4 hover:opacity-80">
            Data Retention Policy
          </Link>
          .
        </div>
      </div>
    </main>
  );
}
