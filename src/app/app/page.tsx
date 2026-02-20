"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type HomePayload = {
  greeting: { text: string; first_name: string };
  recent_files: Array<{ id: string; title: string; public_id: string; at: string; source: "opened" | "created" }>;
  while_away: { acknowledged_count: number; documents_affected: number; latest_at: string | null; since: string | null };
  plan?: string | null;
  primary_workspace_id?: string | null;
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export default function AppHome() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<HomePayload | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/app/home", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error ?? "Failed to load home");
        if (!active) return;
        setData(json as HomePayload);
      } catch (e: unknown) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Failed to load home");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="app-content-card p-7">
        <div className="app-section-kicker">HOME</div>
        <h1 className="app-hero-title mt-3 text-4xl tracking-tight">
          {loading ? "Loading…" : `${data?.greeting?.text ?? "Hello"}, ${data?.greeting?.first_name ?? "there"}`}
        </h1>
        <p className="mt-3 max-w-2xl text-sm" style={{ color: "var(--muted)" }}>
          Keep your acknowledgement workflow moving with quick access to the latest Receipts.
        </p>
        <div className="mt-5 flex gap-2 flex-wrap">
          <Link
            href="/app/new"
            className="focus-ring px-4 py-2 text-sm font-semibold hover:opacity-90"
            style={{ background: "var(--fg)", color: "var(--bg)", borderRadius: 999 }}
          >
            Create new Receipt
          </Link>
          {data?.primary_workspace_id ? (
            <Link
              href={`/app/workspaces/${data.primary_workspace_id}/dashboard`}
              className="focus-ring px-4 py-2 text-sm hover:opacity-90"
              style={{ border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 999 }}
            >
              Open workspace dashboard
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="app-content-card p-5 lg:col-span-2">
          <div className="app-section-kicker">
            RECENT FILES
          </div>
          {loading ? <div className="mt-3 text-sm">Loading…</div> : null}
          {error ? <div className="mt-3 text-sm" style={{ color: "#b91c1c" }}>{error}</div> : null}
          {!loading && !error ? (
            <div className="mt-3 space-y-2">
              {(data?.recent_files ?? []).map((file) => (
                <Link
                  key={file.id}
                  href={`/app/docs/${file.id}`}
                  className="block rounded-xl border p-3 transition hover:-translate-y-0.5"
                  style={{ borderColor: "var(--border2)", background: "var(--card)", color: "var(--fg)" }}
                >
                  <div className="text-sm font-semibold">{file.title}</div>
                  <div className="mt-1 text-xs" style={{ color: "var(--muted2)" }}>
                    {file.source === "opened" ? "Last opened" : "Last created"} · {formatDate(file.at)}
                  </div>
                </Link>
              ))}
              {(data?.recent_files ?? []).length === 0 ? (
                <div className="text-sm" style={{ color: "var(--muted)" }}>
                  No files yet. Create your first Receipt to get started.
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="app-content-card p-5">
          <div className="app-section-kicker">
            WHILE YOU WERE AWAY
          </div>
          <div className="mt-3 text-2xl font-semibold tracking-tight">
            {data?.while_away?.acknowledged_count ?? 0}
          </div>
          <div className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            acknowledgements on {data?.while_away?.documents_affected ?? 0} documents
          </div>
          <div className="mt-3 text-xs" style={{ color: "var(--muted2)" }}>
            Since {formatDate(data?.while_away?.since ?? null)}
          </div>
          {data?.while_away?.latest_at ? (
            <div className="mt-1 text-xs" style={{ color: "var(--muted2)" }}>
              Latest at {formatDate(data.while_away.latest_at)}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
