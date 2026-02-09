"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";

export default function PublicDocAccessPage({
  params,
}: {
  params: Promise<{ publicId: string }> | { publicId: string };
}) {
  const { publicId } = use(params as Promise<{ publicId: string }>);

  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [title, setTitle] = useState("Document");
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    async function check() {
      setChecking(true);
      setError(null);
      try {
        const res = await fetch(`/api/public/${publicId}/access`, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error ?? "Unable to load access");
        if (!alive) return;

        setTitle(json?.title ?? "Document");
        setRequiresPassword(Boolean(json?.requires_password));

        if (json?.access_granted || !json?.requires_password) {
          window.location.replace(`/d/${publicId}`);
          return;
        }
      } catch (e: unknown) {
        if (alive) setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        if (alive) {
          setChecking(false);
          setLoading(false);
        }
      }
    }
    check();
    return () => {
      alive = false;
    };
  }, [publicId]);

  async function unlock() {
    setChecking(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/${publicId}/access`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Incorrect password");
      window.location.replace(`/d/${publicId}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setChecking(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen px-6 py-10">
        <div className="mx-auto max-w-3xl">
          <div className="text-sm" style={{ color: "var(--muted)" }}>
            Loading…
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-xl">
        <div
          className="rounded-3xl border p-6 md:p-8"
          style={{ borderColor: "var(--border)", background: "var(--card)" }}
        >
          <div className="text-xs font-semibold tracking-widest" style={{ color: "var(--muted2)" }}>
            PROTECTED LINK
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
            {requiresPassword
              ? "Enter the password provided by the sender to view this document."
              : "This link does not require a password."}
          </p>

          {requiresPassword ? (
            <div className="mt-5 space-y-3">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="focus-ring w-full rounded-2xl border px-4 py-3 text-sm bg-transparent"
                style={{ borderColor: "var(--border)" }}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={unlock}
                disabled={checking || !password.trim()}
                className="focus-ring rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
                style={{ background: "var(--fg)", color: "var(--bg)" }}
              >
                {checking ? "Checking…" : "Continue to document"}
              </button>
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 text-sm" style={{ color: "#ff3b30" }}>
              {error}
            </div>
          ) : null}

          <div className="mt-6">
            <Link
              href="/"
              className="focus-ring inline-flex rounded-full border px-4 py-2 text-sm hover:opacity-80"
              style={{ borderColor: "var(--border)", color: "var(--muted)" }}
            >
              Back to home
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
