"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppHero, AppPage, AppPanel } from "@/components/app/page-layout";
import type { DashboardActivityItem } from "@/lib/dashboard/types";

type ActivityPayload = {
  activity?: DashboardActivityItem[];
};

export default function AppActivityPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ActivityPayload | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/app/home", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error ?? "Failed to load activity");
        if (!active) return;
        setData(json as ActivityPayload);
      } catch (e: unknown) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Failed to load activity");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  const activity = data?.activity ?? [];

  return (
    <AppPage>
      <AppHero
        kicker="DASHBOARD"
        title={loading ? "Loading…" : "Activity"}
        description="All recent events across your documents."
        actions={
          <Link href="/app" className="focus-ring app-btn-secondary">
            Back to dashboard
          </Link>
        }
      />

      {error ? <div className="app-error">{error}</div> : null}

      <AppPanel title="Recent activity">
        <div className="app-v2-activity-feed">
          {activity.map((row) => (
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
      </AppPanel>
    </AppPage>
  );
}
