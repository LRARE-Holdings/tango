"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

function isSafeNext(next: string | null) {
  return !!next && next.startsWith("/") && !next.startsWith("//");
}

export default function InvitePasswordPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [nextPath, setNextPath] = useState("/app");
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const passwordProblem = useMemo(() => {
    if (!password) return "Enter a password.";
    if (password.length < 8) return "Use at least 8 characters.";
    if (password !== confirm) return "Passwords do not match.";
    return null;
  }, [password, confirm]);

  useEffect(() => {
    async function boot() {
      try {
        const url = new URL(window.location.href);
        const nextRaw = url.searchParams.get("next");
        const safeNext = isSafeNext(nextRaw) ? nextRaw! : "/app";
        setNextPath(safeNext);

        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!data?.session) {
          router.replace(`/auth?next=${encodeURIComponent(safeNext)}&error=${encodeURIComponent("Please sign in to continue.")}`);
          return;
        }

        setReady(true);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Could not continue invite setup.";
        setBootError(message);
      }
    }

    boot();
  }, [router, supabase]);

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
      router.replace(nextPath);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Could not set password.";
      setSaveError(message);
      setSaving(false);
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
          <h1 className="marketing-serif text-4xl tracking-tight">Set your password</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            Create your password to complete workspace access.
          </p>
        </div>

        {!ready && !bootError && (
          <div className="text-sm" style={{ color: "var(--muted)" }}>
            Preparing your account…
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
              placeholder="Create password"
              className="focus-ring w-full rounded-2xl border px-4 py-3 text-sm bg-transparent"
              style={{ borderColor: "var(--border)" }}
              autoComplete="new-password"
              required
            />

            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm password"
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
              {saving ? "Saving…" : "Continue to workspace"}
            </button>

            {(saveError || passwordProblem) && (
              <div className="text-sm" style={{ color: "#ff3b30" }}>
                {saveError || passwordProblem}
              </div>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
