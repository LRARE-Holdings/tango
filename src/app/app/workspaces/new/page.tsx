"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

export default function NewWorkspacePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/app/workspaces", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to create workspace");
      const id = json?.workspace?.id;
      if (!id) throw new Error("No workspace returned");
      router.replace(`/app/workspaces/${id}`);
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Create workspace</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            Team/Enterprise only. One workspace = shared members + shared branding.
          </p>
        </div>

        <Link
          href="/app/workspaces"
          className="focus-ring px-4 py-2 text-sm font-medium hover:opacity-80"
          style={{ border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 10 }}
        >
          Back
        </Link>
      </div>

      <div className="border p-6" style={{ borderColor: "var(--border)", background: "var(--card)", borderRadius: 12 }}>
        <label className="text-xs tracking-wide" style={{ color: "var(--muted2)" }}>
          NAME
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Acme Legal"
          className="mt-2 w-full border px-4 py-3 text-sm bg-transparent focus-ring"
          style={{ borderColor: "var(--border)", borderRadius: 10 }}
        />

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={create}
            disabled={loading || !name.trim()}
            className="focus-ring px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
            style={{ background: "var(--fg)", color: "var(--bg)", borderRadius: 10 }}
          >
            {loading ? "Creating…" : "Create"}
          </button>
          {error && (
            <div className="text-sm" style={{ color: "#ff3b30" }}>
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}