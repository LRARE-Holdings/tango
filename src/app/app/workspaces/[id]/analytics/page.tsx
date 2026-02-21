"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppHero, AppPage, AppPanel } from "@/components/app/page-layout";

type AnalyticsPayload = {
  workspace?: { id: string; name: string; slug: string | null };
  totals: {
    documents_sent: number;
    acknowledged_documents: number;
    acknowledgement_rate_percent: number;
    avg_time_to_ack_seconds: number | null;
    outstanding_acknowledgements: number;
  };
  series: Array<{ date: string; sent: number; acknowledged: number }>;
  by_priority: Array<{ priority: string; total: number; acknowledged: number }>;
  by_label: Array<{ label: string; total: number }>;
};

function fmtDuration(seconds: number | null) {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return "—";
  const s = Math.max(0, Math.floor(seconds));
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  return `${days}d ${hours}h`;
}

export default function WorkspaceAnalyticsPage() {
  const params = useParams<{ id?: string }>();
  const workspaceIdentifier = typeof params?.id === "string" ? params.id.trim() : "";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [exporting, setExporting] = useState<"" | "compliance" | "management">("");
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    let active = true;
    async function load() {
      if (!workspaceIdentifier) {
        setError("Invalid workspace.");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/app/workspaces/${encodeURIComponent(workspaceIdentifier)}/analytics`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error ?? "Failed to load analytics");
        if (!active) return;
        setData(json as AnalyticsPayload);
      } catch (e: unknown) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Failed to load analytics");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [workspaceIdentifier]);

  const latestSeries = useMemo(() => (data?.series ?? []).slice(-10), [data?.series]);

  async function exportReport(mode: "compliance" | "management") {
    if (!workspaceIdentifier || exporting) return;
    setExporting(mode);
    try {
      const res = await fetch(`/api/app/workspaces/${encodeURIComponent(workspaceIdentifier)}/analytics/report`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, from: `${fromDate}T00:00:00.000Z`, to: `${toDate}T23:59:59.999Z` }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error ?? "Failed to export report");
      }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${mode}-report.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to export report");
    } finally {
      setExporting("");
    }
  }

  return (
    <AppPage>
      <AppHero
        kicker="ANALYTICS"
        title="Analytics"
        description="Team/Enterprise compliance and management insights."
      />

      {loading ? <div className="app-subtle text-sm">Loading…</div> : null}
      {error ? <div className="app-error">{error}</div> : null}

      {!loading && !error && data ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="app-card p-4">
              <div className="app-subtle-2 text-xs">TOTAL SENT</div>
              <div className="mt-2 text-2xl font-semibold">{data.totals.documents_sent}</div>
            </div>
            <div className="app-card p-4">
              <div className="app-subtle-2 text-xs">ACK RATE</div>
              <div className="mt-2 text-2xl font-semibold">{data.totals.acknowledgement_rate_percent}%</div>
            </div>
            <div className="app-card p-4">
              <div className="app-subtle-2 text-xs">AVG TIME TO ACK</div>
              <div className="mt-2 text-2xl font-semibold">{fmtDuration(data.totals.avg_time_to_ack_seconds)}</div>
            </div>
            <div className="app-card p-4">
              <div className="app-subtle-2 text-xs">OUTSTANDING</div>
              <div className="mt-2 text-2xl font-semibold">{data.totals.outstanding_acknowledgements}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AppPanel title="Recent trend">
              <div className="mt-3 space-y-2">
                {latestSeries.map((row) => (
                  <div key={row.date} className="flex items-center justify-between text-sm">
                    <span>{row.date}</span>
                    <span className="app-subtle">
                      Sent {row.sent} · Ack {row.acknowledged}
                    </span>
                  </div>
                ))}
              </div>
            </AppPanel>
            <AppPanel title="By priority">
              <div className="mt-3 space-y-2">
                {data.by_priority.map((row) => (
                  <div key={row.priority} className="flex items-center justify-between text-sm">
                    <span>{row.priority}</span>
                    <span className="app-subtle">
                      {row.acknowledged}/{row.total} acknowledged
                    </span>
                  </div>
                ))}
              </div>
            </AppPanel>
          </div>

          <AppPanel title="Top labels and tags">
            <div className="mt-3 flex flex-wrap gap-2">
              {data.by_label.slice(0, 20).map((row) => (
                <span key={row.label} className="app-btn-chip">
                  {row.label} · {row.total}
                </span>
              ))}
            </div>
          </AppPanel>

          <AppPanel title="Audit-ready reports">
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="app-input"
              />
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="app-input"
              />
            </div>
            <div className="mt-3 flex gap-2 flex-wrap">
              <button
                type="button"
                disabled={Boolean(exporting)}
                onClick={() => void exportReport("compliance")}
                className="focus-ring app-btn-primary disabled:opacity-50"
              >
                {exporting === "compliance" ? "Generating…" : "Compliance report (PDF)"}
              </button>
              <button
                type="button"
                disabled={Boolean(exporting)}
                onClick={() => void exportReport("management")}
                className="focus-ring app-btn-secondary disabled:opacity-50"
              >
                {exporting === "management" ? "Generating…" : "Management KPI report (PDF)"}
              </button>
            </div>
          </AppPanel>
        </>
      ) : null}
    </AppPage>
  );
}
