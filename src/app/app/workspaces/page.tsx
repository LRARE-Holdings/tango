"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Workspace = {
  id: string;
  name: string;
  slug?: string | null;
  created_at: string;
  brand_logo_updated_at?: string | null;
  my_role?: "owner" | "admin" | "member";
};

export default function WorkspacesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/app/workspaces", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error ?? "Failed to load workspaces");
        if (!alive) return;
        setWorkspaces(json?.workspaces ?? []);
      } catch (e: unknown) {
        if (alive) setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, []);

  const hasAny = workspaces.length > 0;

  const cards = useMemo(() => {
    return workspaces.map((w) => {
      const identifier = w.slug ?? w.id;
      const logoSrc = `/api/app/workspaces/${w.id}/branding/logo/view${
        w.brand_logo_updated_at ? `?v=${encodeURIComponent(w.brand_logo_updated_at)}` : ""
      }`;

      return (
        <div
          key={w.id}
          className="border p-5"
          style={{ borderColor: "var(--border)", background: "var(--card)", borderRadius: 12 }}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{w.name}</div>
              <div className="mt-1 text-xs truncate" style={{ color: "var(--muted2)" }}>
                {w.id}
              </div>
            </div>
            <img
              src={logoSrc}
              alt=""
              className="h-8 w-8"
              style={{ objectFit: "contain" }}
              onError={(e) => {
                // hide broken logo
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          </div>

          <div className="mt-4 flex gap-2">
            <Link
              href={`/app/workspaces/${identifier}/dashboard`}
              className="focus-ring px-4 py-2 text-sm font-semibold hover:opacity-80"
              style={{
                background: "var(--fg)",
                color: "var(--bg)",
                borderRadius: 10,
              }}
            >
              Open
            </Link>

            <Link
              href={`/app/workspaces/${identifier}/members`}
              className="focus-ring px-4 py-2 text-sm font-medium hover:opacity-80"
              style={{
                border: "1px solid var(--border)",
                color: "var(--muted)",
                borderRadius: 10,
              }}
            >
              Members
            </Link>

            <Link
              href={`/app/workspaces/${identifier}/branding`}
              className="focus-ring px-4 py-2 text-sm font-medium hover:opacity-80"
              style={{
                border: "1px solid var(--border)",
                color: "var(--muted)",
                borderRadius: 10,
              }}
            >
              Branding
            </Link>

            {(w.my_role === "owner" || w.my_role === "admin") ? (
              <Link
                href={`/app/workspaces/${identifier}/settings`}
                className="focus-ring px-4 py-2 text-sm font-medium hover:opacity-80"
                style={{
                  border: "1px solid var(--border)",
                  color: "var(--muted)",
                  borderRadius: 10,
                }}
              >
                Settings
              </Link>
            ) : null}
          </div>
        </div>
      );
    });
  }, [workspaces]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Workspace</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            Members, invites, and branding for Team/Enterprise.
          </p>
        </div>

        <Link
          href="/app/workspaces/new"
          className="focus-ring px-4 py-2 text-sm font-semibold hover:opacity-80"
          style={{ background: "var(--fg)", color: "var(--bg)", borderRadius: 10 }}
        >
          Create workspace
        </Link>
      </div>

      {loading && (
        <div className="text-sm" style={{ color: "var(--muted)" }}>
          Loading…
        </div>
      )}

      {error && (
        <div className="border p-5" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          <div className="text-sm font-semibold">Couldn’t load workspaces</div>
          <div className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            {error}
          </div>
        </div>
      )}

      {!loading && !error && !hasAny && (
        <div className="border p-6" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          <div className="text-sm font-semibold">No workspace yet</div>
          <div className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            Workspaces are available on Team/Enterprise. Create one to invite members and add a logo.
          </div>
          <div className="mt-4">
            <Link
              href="/pricing"
              className="focus-ring px-4 py-2 text-sm font-semibold hover:opacity-80"
              style={{ border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 10 }}
            >
              View plans
            </Link>
          </div>
        </div>
      )}

      {!loading && !error && hasAny && <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{cards}</div>}
    </div>
  );
}
