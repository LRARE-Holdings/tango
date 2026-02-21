"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppHero, AppPage, AppPanel } from "@/components/app/page-layout";
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
    <AppPage>
      <AppHero
        kicker={data?.workspace?.name ?? "Workspace"}
        title={
          <>
            {data?.greeting?.text ?? "Hello"}, {data?.greeting?.first_name ?? "there"}
          </>
        }
        description="Your workspace pulse: recent activity, acknowledgements, and direct access to core areas."
        actions={
          <>
            <Link href="/app/new" className="focus-ring app-btn-primary">
              Create new Receipt
            </Link>
            <Link href={`/app/workspaces/${linkId}/documents`} className="focus-ring app-btn-secondary">
              Open Files
            </Link>
            {data?.viewer?.can_view_analytics ? (
              <Link href={`/app/workspaces/${linkId}/analytics`} className="focus-ring app-btn-secondary">
                Analytics
              </Link>
            ) : null}
          </>
        }
      />

      {error ? (
        <div className="app-error">{error}</div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <AppPanel title="Recent files" className="lg:col-span-2">
          <div className="mt-3 space-y-2">
            {(data?.recent_files ?? []).map((file) => (
                <Link
                  key={file.id}
                  href={`/app/docs/${file.id}`}
                  className="app-list-item p-3"
                >
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold">{file.title}</div>
                  <span className="app-btn-chip">
                    {String(file.priority ?? "normal")}
                  </span>
                </div>
                <div className="app-subtle-2 mt-1 text-xs">
                  {file.source === "opened" ? "Last opened" : "Last created"} · {formatDate(file.at)}
                </div>
              </Link>
            ))}
            {(data?.recent_files ?? []).length === 0 ? (
              <div className="app-empty">
                No files yet.
              </div>
            ) : null}
          </div>
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
        </AppPanel>
      </div>
    </AppPage>
  );
}
