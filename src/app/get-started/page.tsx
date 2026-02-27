"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { safeInternalPath } from "@/lib/safe-redirect";
import { TurnstileWidget, type TurnstileWidgetHandle } from "@/components/security/turnstile-widget";
import { useRef } from "react";

function getSafeNextFromHref(href: string) {
  try {
    const url = new URL(href);
    return safeInternalPath(url.searchParams.get("next"), "/onboarding");
  } catch {
    return "/onboarding";
  }
}

function getSiteUrl() {
  const raw = (process.env.NEXT_PUBLIC_APP_URL || "").trim();
  return raw ? raw.replace(/\/$/, "") : window.location.origin;
}

function normalizeFirstName(input: string) {
  const clean = input.trim().replace(/\s+/g, " ");
  if (!clean) return "";
  return (clean.split(" ")[0] ?? "").slice(0, 80);
}
const MIN_PASSWORD_LENGTH = 8;

export default function GetStartedPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [firstNameInput, setFirstNameInput] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nextPath, setNextPath] = useState("/onboarding");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileWidgetHandle | null>(null);
  const captchaEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

  useEffect(() => {
    setNextPath(getSafeNextFromHref(window.location.href));
  }, []);

  const firstName = useMemo(() => normalizeFirstName(firstNameInput), [firstNameInput]);

  async function signUpWithEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (captchaEnabled && !captchaToken) {
        throw new Error("Please complete the security check.");
      }
      if (!firstName) throw new Error("Enter your first name to continue.");
      if (password.length < MIN_PASSWORD_LENGTH) {
        throw new Error(`Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`);
      }

      const siteUrl = getSiteUrl();
      const confirmUrl = `${siteUrl}/auth/confirm?next=${encodeURIComponent(nextPath)}&first_name=${encodeURIComponent(firstName)}`;

      const { error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          captchaToken: captchaToken ?? undefined,
          emailRedirectTo: confirmUrl,
          data: {
            full_name: firstName,
            first_name: firstName,
          },
        },
      });
      if (signUpErr) throw signUpErr;

      router.replace(
        `/auth/check-email?next=${encodeURIComponent(nextPath)}&email=${encodeURIComponent(email)}&first_name=${encodeURIComponent(firstName)}`
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not create account");
      if (captchaEnabled) turnstileRef.current?.reset();
    } finally {
      setLoading(false);
    }
  }

  async function signUpWithGoogle() {
    setLoading(true);
    setError(null);
    try {
      if (captchaEnabled && !captchaToken) {
        throw new Error("Please complete the security check.");
      }
      if (!firstName) throw new Error("Add your first name before continuing with Google.");
      const siteUrl = getSiteUrl();
      const redirectTo = `${siteUrl}/auth/confirm?next=${encodeURIComponent(nextPath)}&first_name=${encodeURIComponent(firstName)}`;
      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: captchaToken ? { captcha_token: captchaToken } : undefined,
        },
      });
      if (oauthErr) throw oauthErr;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not start Google sign-up");
      if (captchaEnabled) turnstileRef.current?.reset();
      setLoading(false);
    }
  }

  return (
    <main className="app-entry-shell min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md space-y-6">
        <div>
          <div className="text-xs font-semibold tracking-widest" style={{ color: "var(--muted2)" }}>
            GET STARTED
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Create your account</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            We will use your first name in your dashboard and across your workspace.
          </p>
        </div>

        <form onSubmit={signUpWithEmail} className="space-y-3">
          <label htmlFor="get-started-first-name" className="sr-only">
            First name
          </label>
          <input
            id="get-started-first-name"
            type="text"
            required
            value={firstNameInput}
            onChange={(e) => setFirstNameInput(e.target.value)}
            placeholder="First name"
            className="focus-ring w-full rounded-2xl border px-4 py-3 text-sm bg-transparent"
            style={{ borderColor: "var(--border)" }}
          />
          <label htmlFor="get-started-email" className="sr-only">
            Email address
          </label>
          <input
            id="get-started-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="focus-ring w-full rounded-2xl border px-4 py-3 text-sm bg-transparent"
            style={{ borderColor: "var(--border)" }}
          />
          <label htmlFor="get-started-password" className="sr-only">
            Password
          </label>
          <input
            id="get-started-password"
            type="password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={`Password (min ${MIN_PASSWORD_LENGTH} characters)`}
            className="focus-ring w-full rounded-2xl border px-4 py-3 text-sm bg-transparent"
            style={{ borderColor: "var(--border)" }}
            autoComplete="new-password"
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
            {loading ? "Working…" : "Create account"}
          </button>
        </form>

        <button
          type="button"
          onClick={signUpWithGoogle}
          disabled={loading || (captchaEnabled && !captchaToken)}
          className="focus-ring w-full rounded-full border px-4 py-2.5 text-sm font-medium transition hover:opacity-90 disabled:opacity-50"
          style={{ borderColor: "var(--border)", color: "var(--fg)" }}
        >
          Continue with Google
        </button>

        {error ? (
          <div className="text-sm" style={{ color: "#ff3b30" }}>
            {error}
          </div>
        ) : null}

        <div className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
          By creating an account, you agree to our{" "}
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

        <div className="text-xs" style={{ color: "var(--muted)" }}>
          Already have an account?{" "}
          <Link href={`/auth?next=${encodeURIComponent(nextPath)}`} className="underline underline-offset-4 hover:opacity-80">
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
