"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { safeInternalPath } from "@/lib/safe-redirect";

type SupabaseAuthCompat = {
  exchangeCodeForSession?: (code: string) => Promise<{ error: Error | null }>;
  setSession?: (tokens: {
    access_token: string;
    refresh_token: string;
  }) => Promise<{ error: Error | null }>;
  getSession?: () => Promise<{ data: { session: unknown | null }; error: Error | null }>;
  updateUser: (attrs: { password: string }) => Promise<{ error: Error | null }>;
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function PasswordResetPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();
  const auth = supabase.auth as unknown as SupabaseAuthCompat;

  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [success, setSuccess] = useState(false);

  const passwordProblem = useMemo(() => {
    if (!password) return "Enter a new password.";
    if (password.length < 8) return "Use at least 8 characters.";
    if (password !== confirm) return "Passwords do not match.";
    return null;
  }, [password, confirm]);

  useEffect(() => {
    async function boot() {
      try {
        const url = new URL(window.location.href);

        const redirectTo = safeInternalPath(url.searchParams.get("next"), "/app");

        // 1) PKCE flow: /auth/reset?code=...
        const code = url.searchParams.get("code");
        if (code && typeof auth.exchangeCodeForSession === "function") {
          const { error } = await auth.exchangeCodeForSession(code);
          if (error) throw error;
          setReady(true);
          return;
        }

        // 2) Implicit flow: /auth/reset#access_token=...&refresh_token=...
        const hash = (window.location.hash || "").replace(/^#/, "");
        const hashParams = new URLSearchParams(hash);
        const access_token = hashParams.get("access_token");
        const refresh_token = hashParams.get("refresh_token");

        if (
          access_token &&
          refresh_token &&
          typeof auth.setSession === "function"
        ) {
          const { error } = await auth.setSession({
            access_token,
            refresh_token,
          });
          if (error) throw error;

          // remove sensitive tokens from URL
          window.history.replaceState({}, document.title, `${url.pathname}${url.search}`);
          setReady(true);
          return;
        }

        // 3) Fallback: if they already have a session, allow reset screen anyway
        if (typeof auth.getSession === "function") {
          const { data, error } = await auth.getSession();
          if (error) throw error;
          if (data?.session) {
            setReady(true);
            return;
          }
        }

        // If none of the above, this page was reached incorrectly
        setBootError("This reset link is invalid or has expired. Please request a new one.");
        setReady(false);

        // optional: bounce them back after a moment
        // setTimeout(() => router.replace("/auth"), 1500);

        // keep redirectTo referenced so lint doesn’t complain if you later use it
        void redirectTo;
      } catch (error: unknown) {
        setBootError(errorMessage(error, "Could not start password reset."));
        setReady(false);
      }
    }

    boot();
  }, [auth, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaveError(null);

    const problem = passwordProblem;
    if (problem) {
      setSaveError(problem);
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setSuccess(true);

      // Redirect after a short beat so the UI feels responsive
      setTimeout(() => {
        router.replace("/app");
      }, 800);
    } catch (error: unknown) {
      setSaveError(errorMessage(error, "Could not update password."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-10">
      <div
        className="w-full max-w-md space-y-6 border p-6 md:p-7"
        style={{ borderColor: "var(--border)", background: "var(--card)", borderRadius: 18 }}
      >
        <div>
          <h1 className="marketing-serif text-4xl tracking-tight">Reset password</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            Choose a new password for your account.
          </p>
        </div>

        {!ready && !bootError && (
          <div className="text-sm" style={{ color: "var(--muted)" }}>
            Preparing secure reset…
          </div>
        )}

        {bootError && (
          <div className="text-sm" style={{ color: "#ff3b30" }}>
            {bootError}
          </div>
        )}

        {ready && !bootError && (
          <form onSubmit={onSubmit} className="space-y-3">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
              className="focus-ring w-full rounded-2xl border px-4 py-3 text-sm bg-transparent"
              style={{ borderColor: "var(--border)" }}
              autoComplete="new-password"
              required
            />

            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm new password"
              className="focus-ring w-full rounded-2xl border px-4 py-3 text-sm bg-transparent"
              style={{ borderColor: "var(--border)" }}
              autoComplete="new-password"
              required
            />

            <button
              type="submit"
              disabled={saving}
              className="focus-ring w-full rounded-full px-6 py-2.5 text-sm font-medium transition hover:opacity-90 disabled:opacity-50"
              style={{ background: "var(--fg)", color: "var(--bg)" }}
            >
              {saving ? "Saving…" : success ? "Updated" : "Update password"}
            </button>

            {(saveError || passwordProblem) && !success && (
              <div className="text-sm" style={{ color: "#ff3b30" }}>
                {saveError || passwordProblem}
              </div>
            )}

            {success && (
              <div className="text-sm" style={{ color: "var(--muted)" }}>
                Password updated. Taking you back to the app…
              </div>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
