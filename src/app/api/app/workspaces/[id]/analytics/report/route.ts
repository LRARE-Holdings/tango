import { NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/workspace-access";
import { getWorkspaceEntitlementsForUser } from "@/lib/workspace-licensing";
import { canViewAnalytics } from "@/lib/workspace-permissions";
import { getWorkspaceAnalyticsSnapshot } from "@/lib/workspace-analytics";
import { buildAnalyticsReportPdf } from "@/lib/reports/analytics-report";

type Body = { mode?: "compliance" | "management" };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DocumentRow = {
  id: string;
  title?: string | null;
  public_id?: string | null;
  created_at?: string | null;
  priority?: string | null;
  labels?: unknown;
  tags?: unknown;
};

type CompletionRow = {
  document_id: string;
  recipient_id?: string | null;
  acknowledged?: boolean | null;
  submitted_at?: string | null;
  max_scroll_percent?: number | null;
  time_on_page_seconds?: number | null;
  active_seconds?: number | null;
  ip?: string | null;
  user_agent?: string | null;
};

function parseLabels(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.map((x) => String(x).trim()).filter(Boolean);
}

function parseTags(input: unknown): Record<string, string> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    const key = String(k).trim();
    const value = String(v ?? "").trim();
    if (!key || !value) continue;
    out[key] = value;
  }
  return out;
}

function isMissingTableError(error: { code?: string; message?: string } | null | undefined, table: string) {
  if (!error) return false;
  if (error.code === "42P01") return true;
  return String(error.message ?? "").toLowerCase().includes(table.toLowerCase());
}

function isPolicyTagged(doc: DocumentRow) {
  const labels = parseLabels(doc.labels).map((x) => x.toLowerCase());
  if (labels.includes("policy")) return true;
  const tagValues = Object.values(parseTags(doc.tags)).map((x) => x.toLowerCase());
  return tagValues.includes("policy");
}

function buildSeriesAndMetrics(docs: DocumentRow[], completions: CompletionRow[]) {
  const docIds = new Set(docs.map((d) => String(d.id)));
  const ackByDoc = new Map<string, CompletionRow[]>();
  const byPriority = new Map<string, { total: number; acknowledged: number }>();
  const byLabel = new Map<string, number>();
  const series = new Map<string, { sent: number; acknowledged: number }>();
  let ackedDocs = 0;
  let totalAckSeconds = 0;
  let ackSecondsCount = 0;

  for (const c of completions) {
    if (!docIds.has(String(c.document_id))) continue;
    const list = ackByDoc.get(String(c.document_id)) ?? [];
    list.push(c);
    ackByDoc.set(String(c.document_id), list);
  }

  for (const doc of docs) {
    const docId = String(doc.id);
    const createdAt = new Date(String(doc.created_at ?? ""));
    const createdAtMs = createdAt.getTime();
    const day = Number.isFinite(createdAtMs)
      ? createdAt.toISOString().slice(0, 10)
      : String(doc.created_at ?? "").slice(0, 10) || "unknown";
    const priority = String(doc.priority ?? "normal").toLowerCase();
    const p = byPriority.get(priority) ?? { total: 0, acknowledged: 0 };
    p.total += 1;
    byPriority.set(priority, p);

    const s = series.get(day) ?? { sent: 0, acknowledged: 0 };
    s.sent += 1;
    series.set(day, s);

    const rows = (ackByDoc.get(docId) ?? []).filter((r) => r.acknowledged === true && r.submitted_at);
    if (rows.length > 0) {
      ackedDocs += 1;
      p.acknowledged += 1;
      s.acknowledged += 1;
      const firstAckMs = rows
        .map((r) => new Date(String(r.submitted_at)).getTime())
        .filter((n) => Number.isFinite(n))
        .sort((a, b) => a - b)[0];
      if (Number.isFinite(firstAckMs) && Number.isFinite(createdAtMs)) {
        totalAckSeconds += Math.max(0, Math.round((firstAckMs - createdAtMs) / 1000));
        ackSecondsCount += 1;
      }
    }

    for (const label of parseLabels(doc.labels)) {
      byLabel.set(label, (byLabel.get(label) ?? 0) + 1);
    }
    for (const [k, v] of Object.entries(parseTags(doc.tags))) {
      const key = `${k}:${v}`;
      byLabel.set(key, (byLabel.get(key) ?? 0) + 1);
    }
  }

  const totalDocs = docs.length;
  const acknowledgementRate = totalDocs > 0 ? Math.round((ackedDocs / totalDocs) * 100) : 0;
  return {
    metrics: {
      total_documents_sent: totalDocs,
      acknowledgement_rate_percent: acknowledgementRate,
      avg_time_to_ack_seconds: ackSecondsCount > 0 ? Math.round(totalAckSeconds / ackSecondsCount) : null,
      outstanding_acknowledgements: Math.max(0, totalDocs - ackedDocs),
    },
    byPriority: Array.from(byPriority.entries())
      .map(([priority, values]) => ({ priority, total: values.total, acknowledged: values.acknowledged }))
      .sort((a, b) => a.priority.localeCompare(b.priority)),
    byLabel: Array.from(byLabel.entries())
      .map(([label, total]) => ({ label, total }))
      .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label)),
    series: Array.from(series.entries())
      .map(([date, values]) => ({ date, sent: values.sent, acknowledged: values.acknowledged }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id: workspaceIdentifier } = (await ctx.params) as { id: string };
    const access = await requireWorkspaceMember(workspaceIdentifier);
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
    const { supabase, admin, userId, workspaceId, membership } = access;

    const ent = await getWorkspaceEntitlementsForUser(admin, workspaceId, userId);
    if (!ent) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!canViewAnalytics(membership, ent.plan)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json().catch(() => null)) as (Body & { from?: string; to?: string }) | null;
    const mode = body?.mode === "management" ? "management" : "compliance";
    const toDate = body?.to ? new Date(body.to) : new Date();
    const fromDate = body?.from ? new Date(body.from) : new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    const fromIso = Number.isNaN(fromDate.getTime())
      ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      : fromDate.toISOString();
    const toIso = Number.isNaN(toDate.getTime()) ? new Date().toISOString() : toDate.toISOString();

    const workspaceRes = await supabase
      .from("workspaces")
      .select("name,brand_logo_path,brand_logo_width_px")
      .eq("id", workspaceId)
      .maybeSingle();
    if (workspaceRes.error) return NextResponse.json({ error: workspaceRes.error.message }, { status: 500 });
    const workspace = workspaceRes.data as {
      name?: string | null;
      brand_logo_path?: string | null;
      brand_logo_width_px?: number | null;
    } | null;
    const workspaceName = String(workspace?.name ?? "Workspace");
    let brandLogoImageBytes: Uint8Array | null = null;
    let brandLogoWidthPx: number | null = null;
    if (workspace?.brand_logo_path) {
      const logoDownload = await admin.storage.from("workspace-branding").download(workspace.brand_logo_path);
      if (!logoDownload.error && logoDownload.data) {
        try {
          brandLogoImageBytes = new Uint8Array(await logoDownload.data.arrayBuffer());
        } catch {
          brandLogoImageBytes = null;
        }
      }
    }
    if (typeof workspace?.brand_logo_width_px === "number" && Number.isFinite(workspace.brand_logo_width_px)) {
      brandLogoWidthPx = Math.max(48, Math.min(320, Math.floor(workspace.brand_logo_width_px)));
    }

    const snapshot = await getWorkspaceAnalyticsSnapshot(supabase, admin, workspaceId);
    const docsRes = await supabase
      .from("documents")
      .select("id,title,public_id,created_at,priority,labels,tags")
      .eq("workspace_id", workspaceId)
      .limit(5000);
    if (docsRes.error) return NextResponse.json({ error: docsRes.error.message }, { status: 500 });
    const docs = (docsRes.data ?? []) as DocumentRow[];
    const docIds = docs.map((d) => String((d as { id: string }).id));

    const completionsRes =
      docIds.length > 0
        ? await admin
            .from("completions")
            .select(
              "document_id,recipient_id,acknowledged,submitted_at,max_scroll_percent,time_on_page_seconds,active_seconds,ip,user_agent"
            )
            .in("document_id", docIds)
            .gte("submitted_at", fromIso)
            .lte("submitted_at", toIso)
            .order("submitted_at", { ascending: false })
            .limit(3000)
        : { data: [], error: null as { message?: string } | null };
    if (completionsRes.error) return NextResponse.json({ error: completionsRes.error.message }, { status: 500 });

    const completions = (completionsRes.data ?? []) as CompletionRow[];
    const recipientIds = Array.from(
      new Set(completions.map((c) => String((c as { recipient_id?: string | null }).recipient_id ?? "")).filter(Boolean))
    );
    const recipientsRes =
      recipientIds.length > 0
        ? await admin.from("recipients").select("id,name,email").in("id", recipientIds)
        : { data: [], error: null as { message?: string } | null };
    if (recipientsRes.error) return NextResponse.json({ error: recipientsRes.error.message }, { status: 500 });
    const recipientsById = new Map(
      (recipientsRes.data ?? []).map((r) => [String((r as { id: string }).id), r as { name?: string | null; email?: string | null }])
    );
    const docsById = new Map(
      docs.map((d) => [
        String((d as { id: string }).id),
        {
          title: String((d as { title?: string }).title ?? "Untitled"),
          public_id: String((d as { public_id?: string }).public_id ?? ""),
        },
      ])
    );
    const evidenceRows = completions.filter((row) => row.acknowledged === true).map((row) => {
      const doc = docsById.get(String(row.document_id)) ?? { title: "Untitled", public_id: "" };
      const recipient = recipientsById.get(String(row.recipient_id ?? "")) ?? { name: null, email: null };
      return {
        document_title: doc.title,
        document_public_id: doc.public_id,
        recipient_name: recipient.name ?? null,
        recipient_email: recipient.email ?? null,
        acknowledged: row.acknowledged === true,
        submitted_at: row.submitted_at ?? null,
        method: "Public link acknowledgement",
        max_scroll_percent: row.max_scroll_percent ?? null,
        time_on_page_seconds: row.time_on_page_seconds ?? null,
        active_seconds: row.active_seconds ?? null,
        ip: row.ip ?? null,
      };
    });

    const policyDocs = docs.filter((d) => isPolicyTagged(d));
    const complianceDocIds = new Set(
      policyDocs
        .filter((d) => {
          const createdMs = new Date(String(d.created_at ?? "")).getTime();
          if (Number.isFinite(createdMs) && createdMs >= new Date(fromIso).getTime() && createdMs <= new Date(toIso).getTime()) {
            return true;
          }
          return completions.some(
            (c) =>
              String(c.document_id) === String(d.id) &&
              typeof c.submitted_at === "string" &&
              c.submitted_at >= fromIso &&
              c.submitted_at <= toIso
          );
        })
        .map((d) => String(d.id))
    );
    const scopedPolicyDocs = policyDocs.filter((d) => complianceDocIds.has(String(d.id)));
    const scopedPolicyCompletions = completions.filter((c) => complianceDocIds.has(String(c.document_id)));
    const complianceSnapshot = buildSeriesAndMetrics(scopedPolicyDocs, scopedPolicyCompletions);
    const complianceDocuments = scopedPolicyDocs
      .map((doc) => {
        const rows = scopedPolicyCompletions
          .filter((c) => String(c.document_id) === String(doc.id))
          .sort(
            (a, b) =>
              new Date(String(b.submitted_at ?? 0)).getTime() - new Date(String(a.submitted_at ?? 0)).getTime()
          );
        const acknowledgedRows = rows.filter((r) => r.acknowledged === true);
        const pendingRows = rows.filter((r) => r.acknowledged !== true);
        return {
          document_title: String(doc.title ?? "Untitled"),
          document_public_id: String(doc.public_id ?? ""),
          created_at: String(doc.created_at ?? ""),
          priority: String(doc.priority ?? "normal").toLowerCase(),
          labels: parseLabels(doc.labels),
          tags: parseTags(doc.tags),
          acknowledged_count: acknowledgedRows.length,
          pending_submission_count: pendingRows.length,
          outstanding: acknowledgedRows.length === 0,
          acknowledgements: acknowledgedRows.map((row) => {
            const recipient = recipientsById.get(String(row.recipient_id ?? "")) ?? { name: null, email: null };
            return {
              recipient_name: recipient.name ?? null,
              recipient_email: recipient.email ?? null,
              submitted_at: row.submitted_at ?? null,
              method: "Public link acknowledgement",
              max_scroll_percent: row.max_scroll_percent ?? null,
              time_on_page_seconds: row.time_on_page_seconds ?? null,
              active_seconds: row.active_seconds ?? null,
              ip: row.ip ?? null,
              user_agent: row.user_agent ?? null,
            };
          }),
          pending_submissions: pendingRows.map((row) => {
            const recipient = recipientsById.get(String(row.recipient_id ?? "")) ?? { name: null, email: null };
            return {
              recipient_name: recipient.name ?? null,
              recipient_email: recipient.email ?? null,
              submitted_at: row.submitted_at ?? null,
              method: "Opened but not acknowledged",
              max_scroll_percent: row.max_scroll_percent ?? null,
              time_on_page_seconds: row.time_on_page_seconds ?? null,
              active_seconds: row.active_seconds ?? null,
            };
          }),
        };
      })
      .sort((a, b) => a.document_title.localeCompare(b.document_title));

    const generatedAtIso = new Date().toISOString();
    let stackReceipts: Array<{
      stack_title: string;
      recipient_email: string;
      completed_at: string;
      total_documents: number;
      acknowledged_documents: number;
    }> = [];
    const stackReceiptsRes = await admin
      .from("stack_acknowledgement_receipts")
      .select("completed_at,summary")
      .eq("workspace_id", workspaceId)
      .gte("completed_at", fromIso)
      .lte("completed_at", toIso)
      .order("completed_at", { ascending: false })
      .limit(200);
    if (stackReceiptsRes.error && !isMissingTableError(stackReceiptsRes.error, "stack_acknowledgement_receipts")) {
      return NextResponse.json({ error: stackReceiptsRes.error.message }, { status: 500 });
    }
    if (!stackReceiptsRes.error) {
      stackReceipts = (stackReceiptsRes.data ?? [])
        .map((row) => {
          const summary = ((row as { summary?: unknown }).summary ?? {}) as Record<string, unknown>;
          return {
            stack_title: String(summary.stack_title ?? "Stack delivery"),
            recipient_email: String(summary.recipient_email ?? ""),
            completed_at: String((row as { completed_at?: string }).completed_at ?? ""),
            total_documents: Number(summary.total_documents ?? 0),
            acknowledged_documents: Number(summary.acknowledged_documents ?? 0),
          };
        })
        .filter((row) => row.completed_at);
    }

    const bytes = await buildAnalyticsReportPdf({
      reportStyleVersion: "v2",
      workspaceName,
      brandName: workspaceName,
      brandLogoImageBytes,
      brandLogoWidthPx,
      generatedAtIso,
      mode,
      rangeLabel: `${fromIso.slice(0, 10)} to ${toIso.slice(0, 10)}`,
      metrics:
        mode === "compliance"
          ? complianceSnapshot.metrics
          : {
              total_documents_sent: snapshot.totals.documents_sent,
              acknowledgement_rate_percent: snapshot.totals.acknowledgement_rate_percent,
              avg_time_to_ack_seconds: snapshot.totals.avg_time_to_ack_seconds,
              outstanding_acknowledgements: snapshot.totals.outstanding_acknowledgements,
            },
      byPriority: mode === "compliance" ? complianceSnapshot.byPriority : snapshot.by_priority,
      byLabel: mode === "compliance" ? complianceSnapshot.byLabel : snapshot.by_label,
      series: mode === "compliance" ? complianceSnapshot.series : snapshot.series,
      evidenceRows,
      complianceDocuments: mode === "compliance" ? complianceDocuments : [],
      stackReceipts,
    });

    const fileBase = mode === "compliance" ? "compliance-report" : "management-report";
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "cache-control": "no-store",
        "content-disposition": `attachment; filename=\"${fileBase}-${workspaceId}.pdf\"`,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
