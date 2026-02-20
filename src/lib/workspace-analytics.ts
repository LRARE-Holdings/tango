import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

type DocumentRow = {
  id: string;
  created_at: string;
  priority?: string | null;
  labels?: unknown;
  tags?: unknown;
};

export type WorkspaceAnalyticsSnapshot = {
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

function isMissingColumnError(error: { code?: string; message?: string } | null | undefined, column: string) {
  if (!error) return false;
  if (error.code === "42703") return true;
  return String(error.message ?? "").toLowerCase().includes(column.toLowerCase());
}

export async function getWorkspaceAnalyticsSnapshot(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  admin: ReturnType<typeof supabaseAdmin>,
  workspaceId: string
): Promise<WorkspaceAnalyticsSnapshot> {
  const docsWithMeta = await supabase
    .from("documents")
    .select("id,created_at,priority,labels,tags")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true })
    .limit(5000);
  let docsData = docsWithMeta.data as DocumentRow[] | null;
  let docsErr = docsWithMeta.error;
  if (
    docsErr &&
    (isMissingColumnError(docsErr, "priority") ||
      isMissingColumnError(docsErr, "labels") ||
      isMissingColumnError(docsErr, "tags"))
  ) {
    const fallback = await supabase
      .from("documents")
      .select("id,created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true })
      .limit(5000);
    docsData = (fallback.data ?? []).map((d) => ({ ...(d as DocumentRow), priority: "normal", labels: [], tags: {} }));
    docsErr = fallback.error;
  }
  if (docsErr) throw new Error(docsErr.message);
  const docs = docsData ?? [];

  const docIds = docs.map((d) => d.id);
  const completionsRes =
    docIds.length > 0
      ? await admin
          .from("completions")
          .select("document_id,acknowledged,submitted_at")
          .in("document_id", docIds)
          .order("submitted_at", { ascending: false })
      : { data: [], error: null as { message?: string } | null };
  if (completionsRes.error) throw new Error(completionsRes.error.message);
  const completions = (completionsRes.data ?? []) as Array<{
    document_id: string;
    acknowledged: boolean | null;
    submitted_at: string | null;
  }>;

  const ackByDoc = new Map<string, string[]>();
  for (const row of completions) {
    if (!row.acknowledged || !row.submitted_at) continue;
    const arr = ackByDoc.get(row.document_id) ?? [];
    arr.push(row.submitted_at);
    ackByDoc.set(row.document_id, arr);
  }

  let ackedDocs = 0;
  let totalAckSeconds = 0;
  let ackSecondsCount = 0;
  const byPriorityMap = new Map<string, { total: number; acknowledged: number }>();
  const byLabelMap = new Map<string, number>();
  const seriesMap = new Map<string, { sent: number; acknowledged: number }>();

  for (const doc of docs) {
    const priority = String(doc.priority ?? "normal").toLowerCase();
    const createdAt = new Date(doc.created_at);
    const day = Number.isNaN(createdAt.getTime())
      ? String(doc.created_at).slice(0, 10)
      : createdAt.toISOString().slice(0, 10);

    const priorityEntry = byPriorityMap.get(priority) ?? { total: 0, acknowledged: 0 };
    priorityEntry.total += 1;

    const series = seriesMap.get(day) ?? { sent: 0, acknowledged: 0 };
    series.sent += 1;

    const ackEvents = ackByDoc.get(doc.id) ?? [];
    if (ackEvents.length > 0) {
      ackedDocs += 1;
      priorityEntry.acknowledged += 1;
      series.acknowledged += 1;
      const firstAck = ackEvents
        .map((iso) => new Date(iso).getTime())
        .filter((n) => Number.isFinite(n))
        .sort((a, b) => a - b)[0];
      if (Number.isFinite(firstAck)) {
        const diffSeconds = Math.max(0, Math.round((firstAck - createdAt.getTime()) / 1000));
        totalAckSeconds += diffSeconds;
        ackSecondsCount += 1;
      }
    }

    for (const label of Array.isArray(doc.labels) ? doc.labels.map((x) => String(x).trim()).filter(Boolean) : []) {
      byLabelMap.set(label, (byLabelMap.get(label) ?? 0) + 1);
    }
    if (doc.tags && typeof doc.tags === "object" && !Array.isArray(doc.tags)) {
      for (const [k, v] of Object.entries(doc.tags as Record<string, unknown>)) {
        const value = String(v ?? "").trim();
        if (!value) continue;
        const tagLabel = `${k}:${value}`;
        byLabelMap.set(tagLabel, (byLabelMap.get(tagLabel) ?? 0) + 1);
      }
    }

    byPriorityMap.set(priority, priorityEntry);
    seriesMap.set(day, series);
  }

  const totalDocs = docs.length;
  const outstanding = Math.max(0, totalDocs - ackedDocs);
  const acknowledgementRate = totalDocs > 0 ? Math.round((ackedDocs / totalDocs) * 100) : 0;
  const avgTimeToAck = ackSecondsCount > 0 ? Math.round(totalAckSeconds / ackSecondsCount) : null;

  return {
    totals: {
      documents_sent: totalDocs,
      acknowledged_documents: ackedDocs,
      acknowledgement_rate_percent: acknowledgementRate,
      avg_time_to_ack_seconds: avgTimeToAck,
      outstanding_acknowledgements: outstanding,
    },
    series: Array.from(seriesMap.entries())
      .map(([date, values]) => ({ date, sent: values.sent, acknowledged: values.acknowledged }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    by_priority: Array.from(byPriorityMap.entries())
      .map(([priority, values]) => ({ priority, total: values.total, acknowledged: values.acknowledged }))
      .sort((a, b) => a.priority.localeCompare(b.priority)),
    by_label: Array.from(byLabelMap.entries())
      .map(([label, total]) => ({ label, total }))
      .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label)),
  };
}

