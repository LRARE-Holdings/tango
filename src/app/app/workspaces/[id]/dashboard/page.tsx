"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { WorkspaceDashboardLoading } from "@/components/workspace-dashboard-loading";

type WorkspaceHomePayload = {
  workspace: { id: string; name: string; slug: string | null };
  viewer: { role: "owner" | "admin" | "member"; plan: string; can_view_analytics: boolean };
  greeting: { text: string; first_name: string };
  recent_files: Array<{
    id: string;
    title: string;
    public_id: string;
    at: string;
    source: "opened" | "created";
    priority?: string;
    labels?: string[];
  }>;
  while_away: { acknowledged_count: number; documents_affected: number; latest_at: string | null; since: string | null };
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export default function WorkspaceDashboardPage() {
  const params = useParams<{ id?: string }>();
  const workspaceIdentifier = typeof params?.id === "string" ? params.id.trim() : "";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<WorkspaceHomePayload | null>(null);

  useEffect(() => {
    let active = true;
    if (!workspaceIdentifier) {
      setLoading(false);
      setError("Invalid workspace.");
      return () => {
        active = false;
      };
    }
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/app/workspaces/${encodeURIComponent(workspaceIdentifier)}/home`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error ?? "Failed to load dashboard");
        if (!active) return;
        setData(json as WorkspaceHomePayload);
      } catch (e: unknown) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Failed to load dashboard");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [workspaceIdentifier]);

  if (loading && !data && !error) return <WorkspaceDashboardLoading />;

  const linkId = data?.workspace?.slug ?? workspaceIdentifier;

  return (
    <div className="space-y-6">
      <div className="app-content-card p-7">
        <div className="app-section-kicker">{data?.workspace?.name ?? "Workspace"}</div>
        <h1 className="app-hero-title mt-3 text-4xl tracking-tight">
          {data?.greeting?.text ?? "Hello"}, {data?.greeting?.first_name ?? "there"}
        </h1>
        <div className="mt-4 flex gap-2 flex-wrap">
          <Link
            href="/app/new"
            className="focus-ring px-4 py-2 text-sm font-semibold hover:opacity-90"
            style={{ background: "var(--fg)", color: "var(--bg)", borderRadius: 999 }}
          >
            Create new Receipt
          </Link>
          <Link
            href={`/app/workspaces/${linkId}/documents`}
            className="focus-ring px-4 py-2 text-sm hover:opacity-90"
            style={{ border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 999 }}
          >
            Open Files
          </Link>
          {data?.viewer?.can_view_analytics ? (
            <Link
              href={`/app/workspaces/${linkId}/analytics`}
              className="focus-ring px-4 py-2 text-sm hover:opacity-90"
              style={{ border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 999 }}
            >
              Analytics
            </Link>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border p-4 text-sm" style={{ borderColor: "var(--border)", color: "#b91c1c" }}>
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="app-content-card p-5 lg:col-span-2">
          <div className="app-section-kicker">
            RECENT FILES
          </div>
          <div className="mt-3 space-y-2">
            {(data?.recent_files ?? []).map((file) => (
                <Link
                  key={file.id}
                  href={`/app/docs/${file.id}`}
                  className="block rounded-xl border p-3 transition hover:-translate-y-0.5"
                  style={{ borderColor: "var(--border2)", background: "var(--card)", color: "var(--fg)" }}
                >
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold">{file.title}</div>
                  <span
                    className="inline-flex items-center px-2 py-0.5 text-[11px]"
                    style={{ borderRadius: 999, background: "var(--card2)", color: "var(--muted)" }}
                  >
                    {String(file.priority ?? "normal")}
                  </span>
                </div>
                <div className="mt-1 text-xs" style={{ color: "var(--muted2)" }}>
                  {file.source === "opened" ? "Last opened" : "Last created"} · {formatDate(file.at)}
                </div>
              </Link>
            ))}
            {(data?.recent_files ?? []).length === 0 ? (
              <div className="text-sm" style={{ color: "var(--muted)" }}>
                No files yet.
              </div>
            ) : null}
          </div>
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
        </section>
      </div>
    </div>
  );
}
