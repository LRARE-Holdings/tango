"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppHero, AppPage, AppPanel } from "@/components/app/page-layout";
import { WorkspaceDashboardLoading } from "@/components/workspace-dashboard-loading";
import type {
  DashboardActivityItem,
  DashboardAttentionItem,
  DashboardQuickAction,
  DashboardRecentFile,
  DashboardStats,
  DashboardWorkspaceUsage,
} from "@/lib/dashboard/types";

type WorkspaceHomePayload = {
  workspace: { id: string; name: string; slug: string | null };
  viewer: { role: "owner" | "admin" | "member"; plan: string; can_view_analytics: boolean };
  greeting: { text: string; first_name: string };
  while_away: { acknowledged_count: number; documents_affected: number; latest_at: string | null; since: string | null };
  stats?: DashboardStats;
  attention?: DashboardAttentionItem[];
  activity?: DashboardActivityItem[];
  quick_actions?: DashboardQuickAction[];
  recent_files?: DashboardRecentFile[];
  workspace_usage?: DashboardWorkspaceUsage | null;
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function fileStatusClass(status: string) {
  if (status === "complete") return "app-status-pill is-success";
  if (status === "sent") return "app-status-pill is-info";
  return "app-status-pill";
}

function attentionClass(status: string) {
  if (status === "closing") return "app-status-pill is-success";
  if (status === "new") return "app-status-pill is-info";
  return "app-status-pill is-danger";
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
  const stats = data?.stats;
  const attention = data?.attention ?? [];
  const recentFiles = data?.recent_files ?? [];
  const quickActions = data?.quick_actions ?? [];
  const activity = data?.activity ?? [];
  const recentActivity = activity.slice(0, 5);
  const usage = data?.workspace_usage;

  const statCards = [
    {
      label: "Active documents",
      value: stats?.active_documents ?? 0,
      sub: "being tracked",
    },
    {
      label: "Pending acknowledgements",
      value: stats?.pending_acknowledgements ?? 0,
      sub: "across workspace",
      tone: "info" as const,
    },
    {
      label: "Overdue",
      value: stats?.overdue_documents ?? 0,
      sub: "need follow-up",
      tone: "danger" as const,
    },
    {
      label: "Completed this week",
      value: stats?.completed_this_week ?? 0,
      sub: "acknowledgements",
    },
  ];

  return (
    <AppPage>
      <AppHero
        kicker={data?.workspace?.name ?? "WORKSPACE"}
        title={loading ? "Loading…" : `${data?.greeting?.text ?? "Hello"}, ${data?.greeting?.first_name ?? "there"}`}
        description="Workspace pulse: what needs follow-up now, what moved, and where to act fast."
      />

      {error ? <div className="app-error">{error}</div> : null}

      <section className="app-v2-stats-grid">
        {statCards.map((stat) => (
          <article key={stat.label} className={`app-v2-stat-card${stat.tone ? ` is-${stat.tone}` : ""}`}>
            <div className="app-v2-stat-label">{stat.label}</div>
            <div className="app-v2-stat-value">{stat.value}</div>
            <div className="app-v2-stat-sub">{stat.sub}</div>
          </article>
        ))}
      </section>

      <section className="app-v2-dashboard-grid">
        <div className="app-v2-dashboard-main">
          <AppPanel
            title="Needs attention"
            actions={
              <Link href={`/app/workspaces/${linkId}/documents`} className="focus-ring app-btn-secondary">
                View all
              </Link>
            }
          >
            <div className="space-y-2">
              {attention.map((item) => (
                <Link key={item.id} href={`/app/docs/${item.id}`} className="app-list-item p-4 app-v2-attention-item">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{item.name}</div>
                      <div className="app-subtle mt-1 text-xs">
                        {item.acknowledged}/{item.recipients} acknowledged · {item.last_activity_label}
                        {item.overdue > 0 ? <span className="ml-2 app-text-danger">{item.overdue} overdue</span> : null}
                      </div>
                    </div>
                    <span className={attentionClass(item.status)}>
                      {item.status === "attention" ? "Follow up" : item.status === "closing" ? "Almost done" : "Just sent"}
                    </span>
                  </div>
                </Link>
              ))}
              {attention.length === 0 ? <div className="app-empty">No documents need action right now.</div> : null}
            </div>
          </AppPanel>

          <AppPanel title="Recent files">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {recentFiles.map((file) => (
                <Link key={file.id} href={`/app/docs/${file.id}`} className="app-list-item p-4">
                  <div className="text-sm font-semibold truncate">{file.title}</div>
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <span className={fileStatusClass(file.status)}>{file.status}</span>
                    <span className="app-subtle-2">{formatDate(file.at)}</span>
                    {file.recipients > 0 ? <span className="app-subtle-2">· {file.recipients} recipients</span> : null}
                  </div>
                </Link>
              ))}
              {recentFiles.length === 0 ? <div className="app-empty md:col-span-2">No files yet.</div> : null}
            </div>
          </AppPanel>
        </div>

        <aside className="app-v2-dashboard-rail">
          <AppPanel title="Quick actions" className="app-v2-rail-panel">
            <div className="space-y-2">
              {quickActions.map((action) => (
                <Link
                  key={action.id}
                  href={action.href}
                  className={`focus-ring ${action.primary ? "app-btn-primary" : "app-btn-secondary"} w-full justify-start`}
                >
                  {action.label}
                </Link>
              ))}
            </div>
          </AppPanel>

          <AppPanel title="Recent activity" className="app-v2-rail-panel">
            <div className="app-v2-activity-feed">
              {recentActivity.map((row) => (
                <div key={row.id} className="app-v2-activity-row">
                  <span className={`app-v2-activity-dot is-${row.type}`} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-[var(--fg)]">
                      {row.event} <span className="app-subtle">{row.doc}</span>
                    </div>
                    <div className="app-subtle-2 text-[11px]">{row.time}</div>
                  </div>
                </div>
              ))}
              {activity.length === 0 ? <div className="app-empty">No recent activity.</div> : null}
            </div>
            {activity.length > 0 ? (
              <Link
                href={`/app/workspaces/${linkId}/activity`}
                className="focus-ring app-btn-secondary mt-3 w-full justify-center"
              >
                Show more
              </Link>
            ) : null}
          </AppPanel>

          <AppPanel title="Workspace" className="app-v2-rail-panel">
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="app-subtle">Documents used</span>
                <span className="app-mono text-xs">
                  {usage?.documents_used ?? 0}
                  {usage?.documents_limit ? ` / ${usage.documents_limit}` : ""}
                </span>
              </div>
              {typeof usage?.utilization_percent === "number" ? (
                <div className="app-v2-usage-track">
                  <div className="app-v2-usage-bar" style={{ width: `${Math.max(0, Math.min(100, usage.utilization_percent))}%` }} />
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-3">
                <span className="app-subtle">Team members</span>
                <span className="app-mono text-xs">{usage?.members ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="app-subtle">Plan</span>
                <span className="app-status-pill is-success">{String(usage?.plan ?? data?.viewer?.plan ?? "free")}</span>
              </div>
            </div>
          </AppPanel>
        </aside>
      </section>
    </AppPage>
  );
}
