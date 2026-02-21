"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppHero, AppPage, AppPanel } from "@/components/app/page-layout";

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
    <AppPage>
      <AppHero
        kicker="HOME"
        title={loading ? "Loading…" : `${data?.greeting?.text ?? "Hello"}, ${data?.greeting?.first_name ?? "there"}`}
        description="Keep your acknowledgement workflow moving with quick access to the latest Receipts."
        actions={
          <>
            <Link href="/app/new" className="focus-ring app-btn-primary">
              Create new Receipt
            </Link>
            {data?.primary_workspace_id ? (
              <Link
                href={`/app/workspaces/${data.primary_workspace_id}/dashboard`}
                className="focus-ring app-btn-secondary"
              >
                Open workspace dashboard
              </Link>
            ) : null}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <AppPanel title="Recent files" className="lg:col-span-2">
          {loading ? <div className="mt-3 text-sm">Loading…</div> : null}
          {error ? <div className="app-error mt-3">{error}</div> : null}
          {!loading && !error ? (
            <div className="mt-3 space-y-2">
              {(data?.recent_files ?? []).map((file) => (
                <Link
                  key={file.id}
                  href={`/app/docs/${file.id}`}
                  className="app-list-item p-3"
                >
                  <div className="text-sm font-semibold">{file.title}</div>
                  <div className="app-subtle-2 mt-1 text-xs">
                    {file.source === "opened" ? "Last opened" : "Last created"} · {formatDate(file.at)}
                  </div>
                </Link>
              ))}
              {(data?.recent_files ?? []).length === 0 ? (
                <div className="app-empty">
                  No files yet. Create your first Receipt to get started.
                </div>
              ) : null}
            </div>
          ) : null}
        </AppPanel>

        <AppPanel title="While you were away">
          <div className="mt-3 text-2xl font-semibold tracking-tight">
            {data?.while_away?.acknowledged_count ?? 0}
          </div>
          <div className="app-subtle mt-1 text-sm">
            acknowledgements on {data?.while_away?.documents_affected ?? 0} documents
          </div>
          <div className="app-subtle-2 mt-3 text-xs">
            Since {formatDate(data?.while_away?.since ?? null)}
          </div>
          {data?.while_away?.latest_at ? (
            <div className="app-subtle-2 mt-1 text-xs">
              Latest at {formatDate(data.while_away.latest_at)}
            </div>
          ) : null}
        </AppPanel>
      </div>
    </AppPage>
  );
}
