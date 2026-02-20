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

function extractFirstName(fullName: string) {
  const clean = fullName.trim().replace(/\s+/g, " ");
  if (!clean) return "";
  return clean.split(" ")[0] ?? "";
}

export default function GetStartedPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [fullName, setFullName] = useState("");
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

  const firstName = useMemo(() => extractFirstName(fullName), [fullName]);

  async function signUpWithEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (captchaEnabled && !captchaToken) {
        throw new Error("Please complete the security check.");
      }
      const name = fullName.trim();
      if (!name) throw new Error("Enter your full name to continue.");
      if (!firstName) throw new Error("Enter your full name to continue.");

      const siteUrl = getSiteUrl();
      const confirmUrl = `${siteUrl}/auth/confirm?next=${encodeURIComponent(nextPath)}&first_name=${encodeURIComponent(firstName)}`;

      const { error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          captchaToken: captchaToken ?? undefined,
          emailRedirectTo: confirmUrl,
          data: {
            full_name: name,
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
      const redirectTo = `${siteUrl}/auth/callback?next=${encodeURIComponent(nextPath)}&first_name=${encodeURIComponent(firstName)}`;
      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, captchaToken: captchaToken ?? undefined },
      });
      if (oauthErr) throw oauthErr;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not start Google sign-up");
      if (captchaEnabled) turnstileRef.current?.reset();
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
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
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Full name"
            className="focus-ring w-full rounded-2xl border px-4 py-3 text-sm bg-transparent"
            style={{ borderColor: "var(--border)" }}
          />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="focus-ring w-full rounded-2xl border px-4 py-3 text-sm bg-transparent"
            style={{ borderColor: "var(--border)" }}
          />
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min 8 characters)"
            className="focus-ring w-full rounded-2xl border px-4 py-3 text-sm bg-transparent"
            style={{ borderColor: "var(--border)" }}
          />

          <TurnstileWidget
            ref={turnstileRef}
            onTokenChange={setCaptchaToken}
            className="pt-1"
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
