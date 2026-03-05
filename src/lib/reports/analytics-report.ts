import { PDFDocument } from "pdf-lib";
import { createReportContext, embedImageIfPresent, saveReport } from "@/lib/reports/engine/core";
import {
  dataTable,
  footer,
  header,
  keyValueList,
  kpiRow,
  note,
  section,
} from "@/lib/reports/engine/composer";
import { applyReportPdfMetadata } from "@/lib/reports/pdf-metadata";

export type AnalyticsReportMode = "compliance" | "management";

export type AnalyticsReportInput = {
  reportStyleVersion: "v2" | "v3";
  workspaceName: string;
  brandName?: string;
  brandLogoImageBytes?: Uint8Array | null;
  receiptLogoPngBytes?: Uint8Array | null;
  brandLogoWidthPx?: number | null;
  generatedAtIso: string;
  mode: AnalyticsReportMode;
  rangeLabel: string;
  metrics: {
    total_documents_sent: number;
    acknowledgement_rate_percent: number;
    avg_time_to_ack_seconds: number | null;
    outstanding_acknowledgements: number;
  };
  byPriority: Array<{ priority: string; total: number; acknowledged: number }>;
  byLabel: Array<{ label: string; total: number }>;
  series: Array<{ date: string; sent: number; acknowledged: number }>;
  evidenceRows: Array<{
    document_title: string;
    document_public_id: string;
    recipient_name: string | null;
    recipient_email: string | null;
    acknowledged: boolean;
    submitted_at: string | null;
    method: string;
    max_scroll_percent: number | null;
    time_on_page_seconds: number | null;
    active_seconds: number | null;
    ip: string | null;
  }>;
  complianceDocuments?: Array<{
    document_title: string;
    document_public_id: string;
    created_at: string;
    priority: string;
    labels: string[];
    tags: Record<string, string>;
    acknowledged_count: number;
    pending_submission_count: number;
    outstanding: boolean;
    acknowledgements: Array<{
      recipient_name: string | null;
      recipient_email: string | null;
      submitted_at: string | null;
      method: string;
      max_scroll_percent: number | null;
      time_on_page_seconds: number | null;
      active_seconds: number | null;
      ip: string | null;
      user_agent: string | null;
    }>;
    pending_submissions: Array<{
      recipient_name: string | null;
      recipient_email: string | null;
      submitted_at: string | null;
      method: string;
      max_scroll_percent: number | null;
      time_on_page_seconds: number | null;
      active_seconds: number | null;
    }>;
  }>;
  stackReceipts?: Array<{
    stack_title: string;
    recipient_email: string;
    completed_at: string;
    total_documents: number;
    acknowledged_documents: number;
  }>;
};

const UTC_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

function fmtUtc(iso: string | null) {
  if (!iso) return "--";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "--";
  return `${UTC_FORMATTER.format(date).replace(",", "")} UTC`;
}

function fmtDurationLong(seconds: number | null) {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return "--";
  const safe = Math.max(0, Math.floor(seconds));
  const days = Math.floor(safe / 86400);
  const hours = Math.floor((safe % 86400) / 3600);
  return `${days}d ${hours}h`;
}

function fmtDurationShort(seconds: number | null) {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return "--";
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${minutes}m ${String(remainder).padStart(2, "0")}s`;
}

function fmtScroll(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  return `${Math.max(0, Math.min(100, Math.round(value)))}%`;
}

function normalizePriority(priority: string) {
  const clean = priority.trim().toLowerCase();
  return clean || "normal";
}

function recipientLabel(name: string | null, email: string | null) {
  const cleanName = name?.trim() ?? "";
  const cleanEmail = email?.trim() ?? "";
  if (cleanName && cleanEmail) return `${cleanName} <${cleanEmail}>`;
  if (cleanName) return cleanName;
  if (cleanEmail) return cleanEmail;
  return "Unknown recipient";
}

export async function buildAnalyticsReportPdf(input: AnalyticsReportInput): Promise<Uint8Array> {
  const isV3 = input.reportStyleVersion === "v3";

  const ctx = await createReportContext({
    styleVersion: input.reportStyleVersion,
    theme: {
      pageWidth: 841.89,
      pageHeight: 595.28,
      marginTop: isV3 ? 42 : 44,
      marginRight: isV3 ? 34 : 36,
      marginBottom: 34,
      marginLeft: isV3 ? 34 : 36,
      titleSize: isV3 ? 18.8 : 19.3,
    },
  });

  const receiptLogo = await embedImageIfPresent(ctx, input.receiptLogoPngBytes);
  const workspaceLogo = await embedImageIfPresent(ctx, input.brandLogoImageBytes);

  const generatedDate = new Date(input.generatedAtIso);
  const metadataDate = Number.isFinite(generatedDate.getTime()) ? generatedDate : new Date();
  const generatedLabel = fmtUtc(metadataDate.toISOString());

  const workspaceLabel = input.workspaceName.trim();
  const includeWorkspaceLabel =
    workspaceLabel.length > 0 &&
    workspaceLabel.toLowerCase() !== "receipt" &&
    workspaceLabel.toLowerCase() !== "workspace";

  const title =
    input.mode === "compliance"
      ? `${includeWorkspaceLabel ? `${workspaceLabel} ` : ""}Compliance Report`
      : `${includeWorkspaceLabel ? `${workspaceLabel} ` : ""}Management KPI Report`;

  header(ctx, {
    title,
    subtitle: input.rangeLabel,
    eyebrow: input.mode === "compliance" ? "COMPLIANCE / REGULATORY" : "MANAGEMENT / OPERATIONS",
    rightMeta: `Generated ${generatedLabel}`,
    logo: workspaceLogo ?? receiptLogo,
    logoWidthPx: input.brandLogoWidthPx,
    brandName: input.brandName ?? input.workspaceName,
    reportStyleVersion: input.reportStyleVersion,
  });

  section(ctx, "Summary");
  keyValueList(ctx, [
    { key: "Total documents sent", value: String(input.metrics.total_documents_sent) },
    { key: "Acknowledgement rate", value: `${input.metrics.acknowledgement_rate_percent}%` },
    { key: "Average time to acknowledgement", value: fmtDurationLong(input.metrics.avg_time_to_ack_seconds) },
    { key: "Outstanding acknowledgements", value: String(input.metrics.outstanding_acknowledgements) },
  ]);

  if (input.mode === "compliance") {
    note(ctx, "Regulatory scope: policy-tagged receipts only.", { muted: true, size: 9.1 });
  }

  ctx.cursor.y -= 7;
  kpiRow(
    ctx,
    [
      { label: "Total sent", value: String(input.metrics.total_documents_sent) },
      { label: "Ack rate", value: `${input.metrics.acknowledgement_rate_percent}%` },
      { label: "Avg time to ack", value: fmtDurationLong(input.metrics.avg_time_to_ack_seconds) },
      { label: "Outstanding", value: String(input.metrics.outstanding_acknowledgements) },
    ],
    { columns: 4 }
  );

  section(ctx, "Breakdown by Priority");
  dataTable(ctx, "analytics", {
    columns: [
      {
        key: "priority",
        header: "Priority",
        value: (row) => row.priority,
        minWidth: 150,
        semantic: "text",
      },
      {
        key: "acknowledged",
        header: "Acknowledged",
        value: (row) => row.acknowledged,
        minWidth: 160,
        semantic: "metric",
      },
      {
        key: "rate",
        header: "Rate",
        value: (row) => row.rate,
        mode: "fixed",
        width: 90,
        semantic: "metric",
      },
    ],
    rows: [...input.byPriority]
      .sort((a, b) => normalizePriority(a.priority).localeCompare(normalizePriority(b.priority)))
      .map((row) => ({
        priority: normalizePriority(row.priority),
        acknowledged: `${row.acknowledged}/${row.total}`,
        rate: row.total > 0 ? `${Math.round((row.acknowledged / row.total) * 100)}%` : "0%",
      })),
    repeatHeader: true,
  });

  section(ctx, "Top Labels and Tags");
  dataTable(ctx, "analytics", {
    columns: [
      {
        key: "label",
        header: "Label / Tag",
        value: (row) => row.label,
        minWidth: 310,
        maxLines: 2,
        semantic: "text",
      },
      {
        key: "total",
        header: "Documents",
        value: (row) => String(row.total),
        mode: "fixed",
        width: 100,
        semantic: "metric",
      },
    ],
    rows: [...input.byLabel]
      .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label))
      .slice(0, 24),
    repeatHeader: true,
    maxCellLines: 2,
  });

  section(ctx, "Daily Trend");
  dataTable(ctx, "analytics", {
    columns: [
      {
        key: "date",
        header: "Date",
        value: (row) => row.date,
        minWidth: 132,
        semantic: "identifier",
      },
      {
        key: "sent",
        header: "Sent",
        value: (row) => String(row.sent),
        mode: "fixed",
        width: 70,
        semantic: "metric",
      },
      {
        key: "acknowledged",
        header: "Acknowledged",
        value: (row) => String(row.acknowledged),
        mode: "fixed",
        width: 120,
        semantic: "metric",
      },
      {
        key: "rate",
        header: "Ack rate",
        value: (row) => (row.sent > 0 ? `${Math.round((row.acknowledged / row.sent) * 100)}%` : "0%"),
        mode: "fixed",
        width: 90,
        semantic: "metric",
      },
    ],
    rows: [...input.series].sort((a, b) => a.date.localeCompare(b.date)).slice(-30),
    repeatHeader: true,
  });

  if (input.mode === "compliance") {
    section(
      ctx,
      "Policy Document Evidence",
      "Each policy document includes acknowledgement evidence and outstanding submissions."
    );

    const documents = [...(input.complianceDocuments ?? [])].sort(
      (a, b) =>
        a.document_title.localeCompare(b.document_title) ||
        a.document_public_id.localeCompare(b.document_public_id)
    );

    if (documents.length === 0) {
      note(ctx, "No policy-tagged documents matched this date range.", { muted: true });
    }

    for (const document of documents) {
      ctx.ensureSpace(210);
      section(
        ctx,
        `${document.document_title} (${document.document_public_id || "No public ID"})`
      );
      keyValueList(ctx, [
        { key: "Created", value: fmtUtc(document.created_at) },
        { key: "Priority", value: normalizePriority(document.priority).toUpperCase() },
        { key: "Public ID", value: document.document_public_id || "--", valueFont: "mono" },
        { key: "Labels", value: document.labels.join(", ") || "--" },
        {
          key: "Tags",
          value:
            Object.entries(document.tags)
              .map(([key, value]) => `${key}:${value}`)
              .join(", ") || "--",
        },
        { key: "Acknowledged in range", value: String(document.acknowledged_count) },
        { key: "Pending submissions", value: String(document.pending_submission_count) },
        {
          key: "Outstanding acknowledgement",
          value: document.outstanding ? "YES (no acknowledged submissions in range)" : "NO",
        },
      ]);

      section(ctx, "Acknowledgements");
      const acknowledgements = [...document.acknowledgements].sort(
        (a, b) =>
          String(a.submitted_at ?? "").localeCompare(String(b.submitted_at ?? "")) ||
          recipientLabel(a.recipient_name, a.recipient_email).localeCompare(
            recipientLabel(b.recipient_name, b.recipient_email)
          )
      );

      if (acknowledgements.length === 0) {
        note(ctx, "No acknowledgements in selected range.", { muted: true, size: 8.9 });
      } else {
        dataTable(ctx, "evidence", {
          columns: [
            {
              key: "recipient",
              header: "Recipient",
              value: (row) => recipientLabel(row.recipient_name, row.recipient_email),
              minWidth: 175,
              maxLines: 2,
              semantic: "text",
            },
            {
              key: "when",
              header: "When",
              value: (row) => fmtUtc(row.submitted_at),
              minWidth: 132,
              semantic: "datetime",
            },
            {
              key: "method",
              header: "How",
              value: (row) => row.method,
              minWidth: 95,
              maxLines: 2,
              semantic: "text",
            },
            {
              key: "scroll",
              header: "Scroll",
              value: (row) => fmtScroll(row.max_scroll_percent),
              mode: "fixed",
              width: 64,
              semantic: "metric",
            },
            {
              key: "active",
              header: "Active",
              value: (row) => fmtDurationShort(row.active_seconds),
              mode: "fixed",
              width: 68,
              semantic: "metric",
            },
            {
              key: "page",
              header: "Time on page",
              value: (row) => fmtDurationShort(row.time_on_page_seconds),
              mode: "fixed",
              width: 88,
              semantic: "metric",
            },
            {
              key: "ip",
              header: "IP",
              value: (row) => row.ip ?? "--",
              minWidth: 76,
              semantic: "identifier",
            },
          ],
          rows: acknowledgements,
          repeatHeader: true,
          maxCellLines: 2,
        });
      }

      section(ctx, "Outstanding Acknowledgements / Pending Submissions");
      const pending = [...document.pending_submissions].sort(
        (a, b) =>
          String(a.submitted_at ?? "").localeCompare(String(b.submitted_at ?? "")) ||
          recipientLabel(a.recipient_name, a.recipient_email).localeCompare(
            recipientLabel(b.recipient_name, b.recipient_email)
          )
      );

      if (pending.length === 0) {
        note(ctx, "No pending submissions recorded in selected range.", { muted: true, size: 8.9 });
      } else {
        dataTable(ctx, "evidence", {
          columns: [
            {
              key: "recipient",
              header: "Recipient",
              value: (row) => recipientLabel(row.recipient_name, row.recipient_email),
              minWidth: 186,
              maxLines: 2,
              semantic: "text",
            },
            {
              key: "when",
              header: "When",
              value: (row) => fmtUtc(row.submitted_at),
              minWidth: 136,
              semantic: "datetime",
            },
            {
              key: "status",
              header: "Status",
              value: (row) => row.method,
              minWidth: 200,
              maxLines: 2,
              semantic: "text",
            },
            {
              key: "scroll",
              header: "Scroll",
              value: (row) => fmtScroll(row.max_scroll_percent),
              mode: "fixed",
              width: 64,
              semantic: "metric",
            },
            {
              key: "active",
              header: "Active",
              value: (row) => fmtDurationShort(row.active_seconds),
              mode: "fixed",
              width: 68,
              semantic: "metric",
            },
            {
              key: "page",
              header: "Time on page",
              value: (row) => fmtDurationShort(row.time_on_page_seconds),
              mode: "fixed",
              width: 88,
              semantic: "metric",
            },
          ],
          rows: pending,
          repeatHeader: true,
          maxCellLines: 2,
        });
      }
    }
  } else {
    section(ctx, "Acknowledgement Evidence");
    const managementRows = [...input.evidenceRows].sort(
      (a, b) =>
        String(a.document_title).localeCompare(String(b.document_title)) ||
        String(a.submitted_at ?? "").localeCompare(String(b.submitted_at ?? ""))
    );

    dataTable(ctx, "evidence", {
      columns: [
        {
          key: "document",
          header: "Document",
          value: (row) => `${row.document_title} (${row.document_public_id || "No public ID"})`,
          minWidth: 205,
          maxLines: 2,
          semantic: "text",
        },
        {
          key: "recipient",
          header: "Recipient",
          value: (row) => recipientLabel(row.recipient_name, row.recipient_email),
          minWidth: 150,
          maxLines: 2,
          semantic: "text",
        },
        {
          key: "method",
          header: "How",
          value: (row) => row.method,
          minWidth: 86,
          maxLines: 2,
          semantic: "text",
        },
        {
          key: "scroll",
          header: "Scroll",
          value: (row) => fmtScroll(row.max_scroll_percent),
          mode: "fixed",
          width: 60,
          semantic: "metric",
        },
        {
          key: "active",
          header: "Active",
          value: (row) => fmtDurationShort(row.active_seconds),
          mode: "fixed",
          width: 68,
          semantic: "metric",
        },
        {
          key: "page",
          header: "Time on page",
          value: (row) => fmtDurationShort(row.time_on_page_seconds),
          mode: "fixed",
          width: 88,
          semantic: "metric",
        },
        {
          key: "when",
          header: "Acknowledged at",
          value: (row) => fmtUtc(row.submitted_at),
          minWidth: 126,
          semantic: "datetime",
        },
      ],
      rows:
        managementRows.length > 0
          ? managementRows
          : [
              {
                document_title: "No acknowledgements available in selected range",
                document_public_id: "",
                recipient_name: null,
                recipient_email: null,
                acknowledged: false,
                submitted_at: null,
                method: "--",
                max_scroll_percent: null,
                time_on_page_seconds: null,
                active_seconds: null,
                ip: null,
              },
            ],
      repeatHeader: true,
      maxCellLines: 2,
    });
  }

  const stackReceipts = [...(input.stackReceipts ?? [])].sort(
    (a, b) =>
      String(b.completed_at ?? "").localeCompare(String(a.completed_at ?? "")) ||
      a.stack_title.localeCompare(b.stack_title)
  );

  if (stackReceipts.length > 0) {
    section(ctx, "Stack Acknowledgement Receipts");
    dataTable(ctx, "receipts", {
      columns: [
        {
          key: "stack",
          header: "Stack",
          value: (row) => row.stack_title,
          minWidth: 190,
          maxLines: 2,
          semantic: "text",
        },
        {
          key: "recipient",
          header: "Recipient",
          value: (row) => row.recipient_email,
          minWidth: 170,
          maxLines: 2,
          semantic: "text",
        },
        {
          key: "completed",
          header: "Completed",
          value: (row) => fmtUtc(row.completed_at),
          minWidth: 130,
          semantic: "datetime",
        },
        {
          key: "status",
          header: "Acknowledged",
          value: (row) => `${row.acknowledged_documents}/${row.total_documents}`,
          mode: "fixed",
          width: 92,
          semantic: "metric",
        },
      ],
      rows: stackReceipts,
      repeatHeader: true,
      maxCellLines: 2,
    });
  }

  footer(
    ctx,
    input.mode === "compliance" ? "Compliance Analytics Report" : "Management Analytics Report",
    {
      poweredByLogo: receiptLogo,
    }
  );

  applyReportPdfMetadata(ctx.pdf, {
    title: input.mode === "compliance" ? "Compliance Analytics Report" : "Management Analytics Report",
    subject:
      input.mode === "compliance"
        ? "Policy compliance and acknowledgement analytics export"
        : "Operational acknowledgement analytics export",
    generatedAt: metadataDate,
    keywords:
      input.mode === "compliance"
        ? ["analytics", "compliance", "policy", "acknowledgement", "audit"]
        : ["analytics", "management", "operations", "acknowledgement"],
  });

  return saveReport(ctx, process.env.PDF_DETERMINISTIC === "1");
}

export async function bytesToPdfDocument(bytes: Uint8Array): Promise<PDFDocument> {
  return PDFDocument.load(bytes);
}
