import { PDFDocument } from "pdf-lib";
import { createReportContext, embedImageIfPresent, saveReport } from "@/lib/reports/engine/core";
import { drawTable } from "@/lib/reports/engine/table";
import {
  drawKeyValueRow,
  drawMetricCards,
  drawParagraph,
  drawReportHeader,
  drawSectionHeading,
  finalizeFooters,
} from "@/lib/reports/engine/sections";

export type AnalyticsReportMode = "compliance" | "management";

export type AnalyticsReportInput = {
  reportStyleVersion: "v2";
  workspaceName: string;
  brandName?: string;
  brandLogoImageBytes?: Uint8Array | null;
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

function fmtDurationLong(seconds: number | null) {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return "--";
  const s = Math.max(0, Math.floor(seconds));
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  return `${days}d ${hours}h`;
}

function fmtDurationShort(seconds: number | null) {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return "--";
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${String(r).padStart(2, "0")}s`;
}

function fmtUtc(iso: string | null) {
  if (!iso) return "--";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "--";
  return d.toUTCString();
}

function normalizePriority(value: string) {
  const clean = value.trim().toLowerCase();
  if (!clean) return "normal";
  return clean;
}

function fmtScroll(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  return `${Math.max(0, Math.min(100, Math.round(value)))}%`;
}

export async function buildAnalyticsReportPdf(input: AnalyticsReportInput): Promise<Uint8Array> {
  const ctx = await createReportContext();
  const workspaceLogo = await embedImageIfPresent(ctx, input.brandLogoImageBytes);
  const generatedDate = new Date(input.generatedAtIso);
  const metadataDate = Number.isFinite(generatedDate.getTime()) ? generatedDate : new Date();
  const generatedLabel = Number.isFinite(generatedDate.getTime())
    ? generatedDate.toUTCString()
    : new Date().toUTCString();

  drawReportHeader(ctx, {
    title:
      input.mode === "compliance"
        ? `${input.workspaceName} Compliance Report`
        : `${input.workspaceName} Management KPI Report`,
    subtitle: `${input.rangeLabel}`,
    eyebrow: input.mode === "compliance" ? "COMPLIANCE / REGULATORY" : "MANAGEMENT / OPERATIONS",
    rightMeta: `Generated ${generatedLabel}`,
    logo: workspaceLogo,
    logoWidthPx: input.brandLogoWidthPx,
    brandName: input.brandName ?? input.workspaceName,
    reportStyleVersion: input.reportStyleVersion,
  });

  drawSectionHeading(ctx, "Summary");
  drawKeyValueRow(ctx, "Total documents sent", String(input.metrics.total_documents_sent));
  drawKeyValueRow(ctx, "Acknowledgement rate", `${input.metrics.acknowledgement_rate_percent}%`);
  drawKeyValueRow(ctx, "Average time to acknowledgement", fmtDurationLong(input.metrics.avg_time_to_ack_seconds));
  drawKeyValueRow(ctx, "Outstanding acknowledgements", String(input.metrics.outstanding_acknowledgements));

  if (input.mode === "compliance") {
    drawParagraph(ctx, "Regulatory scope: policy-tagged receipts only.", { muted: true, size: 9.2 });
  }

  ctx.cursor.y -= 8;
  drawMetricCards(
    ctx,
    [
      { label: "TOTAL SENT", value: String(input.metrics.total_documents_sent) },
      { label: "ACK RATE", value: `${input.metrics.acknowledgement_rate_percent}%` },
      { label: "AVG TIME TO ACK", value: fmtDurationLong(input.metrics.avg_time_to_ack_seconds) },
      { label: "OUTSTANDING", value: String(input.metrics.outstanding_acknowledgements) },
    ],
    { columns: 4 }
  );

  drawSectionHeading(ctx, "Breakdown by priority");
  drawTable(ctx, {
    columns: [
      { key: "priority", header: "Priority", value: (row) => row.priority, minWidth: 120 },
      { key: "ack", header: "Acknowledged", value: (row) => row.ack, minWidth: 150 },
      { key: "rate", header: "Rate", value: (row) => row.rate, minWidth: 80, align: "right", mode: "fixed", width: 80 },
    ],
    rows: [...input.byPriority]
      .sort((a, b) => normalizePriority(a.priority).localeCompare(normalizePriority(b.priority)))
      .map((row) => ({
        priority: normalizePriority(row.priority),
        ack: `${row.acknowledged}/${row.total}`,
        rate: row.total > 0 ? `${Math.round((row.acknowledged / row.total) * 100)}%` : "0%",
      })),
    repeatHeader: true,
    fontSize: 9,
    headerFontSize: 9.2,
  });

  drawSectionHeading(ctx, "Top labels and tags");
  drawTable(ctx, {
    columns: [
      { key: "label", header: "Label / Tag", value: (row) => row.label, minWidth: 280, maxLines: 2 },
      { key: "total", header: "Documents", value: (row) => String(row.total), mode: "fixed", width: 90, align: "right" },
    ],
    rows: [...input.byLabel]
      .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label))
      .slice(0, 24),
    repeatHeader: true,
    fontSize: 9,
    headerFontSize: 9.2,
    maxCellLines: 2,
  });

  drawSectionHeading(ctx, "Daily trend");
  drawTable(ctx, {
    columns: [
      { key: "date", header: "Date", value: (row) => row.date, minWidth: 130, font: "mono" },
      { key: "sent", header: "Sent", value: (row) => String(row.sent), mode: "fixed", width: 65, align: "right" },
      {
        key: "ack",
        header: "Acknowledged",
        value: (row) => String(row.acknowledged),
        mode: "fixed",
        width: 110,
        align: "right",
      },
      {
        key: "rate",
        header: "Ack rate",
        value: (row) => (row.sent > 0 ? `${Math.round((row.acknowledged / row.sent) * 100)}%` : "0%"),
        mode: "fixed",
        width: 80,
        align: "right",
      },
    ],
    rows: [...input.series]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30),
    repeatHeader: true,
    fontSize: 8.8,
    headerFontSize: 9.1,
  });

  if (input.mode === "compliance") {
    drawSectionHeading(
      ctx,
      "Policy document evidence",
      "Each policy document includes acknowledgement evidence and outstanding submissions."
    );

    const docs = [...(input.complianceDocuments ?? [])].sort(
      (a, b) =>
        a.document_title.localeCompare(b.document_title) ||
        a.document_public_id.localeCompare(b.document_public_id)
    );

    if (docs.length === 0) {
      drawParagraph(ctx, "No policy-tagged documents matched this date range.", { muted: true });
    }

    for (const doc of docs) {
      ctx.ensureSpace(100);
      drawSectionHeading(ctx, `${doc.document_title} (${doc.document_public_id || "No public ID"})`);
      drawKeyValueRow(ctx, "Created", fmtUtc(doc.created_at));
      drawKeyValueRow(ctx, "Priority", normalizePriority(doc.priority).toUpperCase());
      drawKeyValueRow(ctx, "Public ID", doc.document_public_id || "--", { valueFont: "mono" });
      drawKeyValueRow(ctx, "Labels", doc.labels.join(", ") || "--");
      drawKeyValueRow(
        ctx,
        "Tags",
        Object.entries(doc.tags)
          .map(([k, v]) => `${k}:${v}`)
          .join(", ") || "--"
      );
      drawKeyValueRow(ctx, "Acknowledged in range", String(doc.acknowledged_count));
      drawKeyValueRow(ctx, "Pending submissions", String(doc.pending_submission_count));
      drawKeyValueRow(
        ctx,
        "Outstanding acknowledgement",
        doc.outstanding ? "YES (no acknowledged submissions in range)" : "NO"
      );

      drawSectionHeading(ctx, "Acknowledgements");
      const acknowledgements = [...doc.acknowledgements].sort(
        (a, b) =>
          (a.submitted_at ?? "").localeCompare(b.submitted_at ?? "") ||
          (a.recipient_email ?? "").localeCompare(b.recipient_email ?? "")
      );
      drawTable(ctx, {
        columns: [
          {
            key: "recipient",
            header: "Recipient",
            value: (row) => row.recipient_name || row.recipient_email || "Unknown recipient",
            minWidth: 140,
            maxLines: 2,
          },
          { key: "when", header: "When", value: (row) => fmtUtc(row.submitted_at), minWidth: 120 },
          { key: "method", header: "How", value: (row) => row.method, minWidth: 90, maxLines: 2 },
          {
            key: "metrics",
            header: "Metrics",
            value: (row) =>
              `Scroll ${fmtScroll(row.max_scroll_percent)} | Active ${fmtDurationShort(row.active_seconds)} | Page ${fmtDurationShort(
                row.time_on_page_seconds
              )}`,
            minWidth: 190,
            maxLines: 2,
          },
          { key: "ip", header: "IP", value: (row) => row.ip ?? "--", minWidth: 70, font: "mono" },
        ],
        rows:
          acknowledgements.length > 0
            ? acknowledgements
            : [
                {
                  recipient_name: null,
                  recipient_email: null,
                  submitted_at: null,
                  method: "No acknowledgements in selected range",
                  max_scroll_percent: null,
                  active_seconds: null,
                  time_on_page_seconds: null,
                  ip: null,
                  user_agent: null,
                },
              ],
        repeatHeader: true,
        fontSize: 8.2,
        headerFontSize: 8.4,
        lineHeight: 9.8,
        maxCellLines: 2,
      });

      drawSectionHeading(ctx, "Outstanding acknowledgements / pending submissions");
      const pending = [...doc.pending_submissions].sort(
        (a, b) =>
          (a.submitted_at ?? "").localeCompare(b.submitted_at ?? "") ||
          (a.recipient_email ?? "").localeCompare(b.recipient_email ?? "")
      );
      drawTable(ctx, {
        columns: [
          {
            key: "recipient",
            header: "Recipient",
            value: (row) => row.recipient_name || row.recipient_email || "Unknown recipient",
            minWidth: 150,
            maxLines: 2,
          },
          { key: "when", header: "When", value: (row) => fmtUtc(row.submitted_at), minWidth: 130 },
          { key: "method", header: "Status", value: (row) => row.method, minWidth: 170, maxLines: 2 },
          {
            key: "metrics",
            header: "Metrics",
            value: (row) =>
              `Scroll ${fmtScroll(row.max_scroll_percent)} | Active ${fmtDurationShort(row.active_seconds)} | Page ${fmtDurationShort(
                row.time_on_page_seconds
              )}`,
            minWidth: 190,
            maxLines: 2,
          },
        ],
        rows:
          pending.length > 0
            ? pending
            : [
                {
                  recipient_name: null,
                  recipient_email: null,
                  submitted_at: null,
                  method: "None recorded",
                  max_scroll_percent: null,
                  time_on_page_seconds: null,
                  active_seconds: null,
                },
              ],
        repeatHeader: true,
        fontSize: 8.2,
        headerFontSize: 8.4,
        maxCellLines: 2,
      });
    }
  } else {
    drawSectionHeading(ctx, "Acknowledgement evidence");
    const rows = [...input.evidenceRows].sort(
      (a, b) =>
        (a.document_title || "").localeCompare(b.document_title || "") ||
        (a.submitted_at ?? "").localeCompare(b.submitted_at ?? "")
    );
    drawTable(ctx, {
      columns: [
        {
          key: "document",
          header: "Document",
          value: (row) => `${row.document_title} (${row.document_public_id || "No public ID"})`,
          minWidth: 175,
          maxLines: 2,
        },
        {
          key: "recipient",
          header: "Recipient",
          value: (row) => row.recipient_name || row.recipient_email || "Unknown recipient",
          minWidth: 130,
          maxLines: 2,
        },
        { key: "how", header: "How", value: (row) => row.method, minWidth: 88, maxLines: 2 },
        {
          key: "metrics",
          header: "Engagement",
          value: (row) =>
            `Scroll ${fmtScroll(row.max_scroll_percent)} | Active ${fmtDurationShort(row.active_seconds)} | Page ${fmtDurationShort(
              row.time_on_page_seconds
            )}`,
          minWidth: 195,
          maxLines: 2,
        },
        { key: "when", header: "When", value: (row) => fmtUtc(row.submitted_at), minWidth: 130 },
      ],
      rows:
        rows.length > 0
          ? rows
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
      fontSize: 8.3,
      headerFontSize: 8.5,
      lineHeight: 9.9,
      maxCellLines: 2,
    });
  }

  const stackReceipts = [...(input.stackReceipts ?? [])].sort(
    (a, b) =>
      (b.completed_at ?? "").localeCompare(a.completed_at ?? "") ||
      a.stack_title.localeCompare(b.stack_title)
  );
  if (stackReceipts.length > 0) {
    drawSectionHeading(ctx, "Stack acknowledgement receipts");
    drawTable(ctx, {
      columns: [
        { key: "stack", header: "Stack", value: (row) => row.stack_title, minWidth: 180, maxLines: 2 },
        { key: "recipient", header: "Recipient", value: (row) => row.recipient_email, minWidth: 160, maxLines: 2 },
        { key: "completed", header: "Completed", value: (row) => fmtUtc(row.completed_at), minWidth: 130 },
        {
          key: "status",
          header: "Acknowledged",
          value: (row) => `${row.acknowledged_documents}/${row.total_documents}`,
          mode: "fixed",
          width: 82,
          align: "right",
        },
      ],
      rows: stackReceipts,
      repeatHeader: true,
      fontSize: 8.5,
      headerFontSize: 8.7,
      maxCellLines: 2,
    });
  }

  finalizeFooters(
    ctx,
    input.mode === "compliance" ? "Compliance Analytics Report" : "Management Analytics Report"
  );
  ctx.pdf.setTitle(
    input.mode === "compliance" ? "Compliance Analytics Report" : "Management Analytics Report"
  );
  ctx.pdf.setProducer("Receipt");
  ctx.pdf.setCreator("Receipt");
  ctx.pdf.setCreationDate(metadataDate);
  ctx.pdf.setModificationDate(metadataDate);
  return saveReport(ctx, process.env.PDF_DETERMINISTIC === "1");
}

export async function bytesToPdfDocument(bytes: Uint8Array): Promise<PDFDocument> {
  return PDFDocument.load(bytes);
}
