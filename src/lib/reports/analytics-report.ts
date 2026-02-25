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
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "--";
  return `${UTC_FORMATTER.format(d).replace(",", "")} UTC`;
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
  const ctx = await createReportContext({
    styleVersion: input.reportStyleVersion,
    theme:
      input.reportStyleVersion === "v2"
        ? {
            pageWidth: 841.89,
            pageHeight: 595.28,
            marginTop: 46,
            marginRight: 38,
            marginBottom: 36,
            marginLeft: 38,
            titleSize: 19.5,
          }
        : undefined,
  });
  const receiptLogo = await embedImageIfPresent(ctx, input.receiptLogoPngBytes);
  const workspaceLogo = await embedImageIfPresent(ctx, input.brandLogoImageBytes);
  const generatedDate = new Date(input.generatedAtIso);
  const metadataDate = Number.isFinite(generatedDate.getTime()) ? generatedDate : new Date();
  const generatedLabel = fmtUtc(Number.isFinite(generatedDate.getTime()) ? generatedDate.toISOString() : new Date().toISOString());

  header(ctx, {
    title:
      input.mode === "compliance"
        ? `${input.workspaceName} Compliance Report`
        : `${input.workspaceName} Management KPI Report`,
    subtitle: `${input.rangeLabel}`,
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
    note(ctx, "Regulatory scope: policy-tagged receipts only.", { muted: true, size: 9.2 });
  }

  ctx.cursor.y -= 8;
  kpiRow(
    ctx,
    [
      { label: "TOTAL SENT", value: String(input.metrics.total_documents_sent) },
      { label: "ACK RATE", value: `${input.metrics.acknowledgement_rate_percent}%` },
      { label: "AVG TIME TO ACK", value: fmtDurationLong(input.metrics.avg_time_to_ack_seconds) },
      { label: "OUTSTANDING", value: String(input.metrics.outstanding_acknowledgements) },
    ],
    { columns: 4 }
  );

  section(ctx, "Breakdown by priority");
  dataTable(ctx, "analytics", {
    columns: [
      { key: "priority", header: "Priority", value: (row) => row.priority, minWidth: 120, semantic: "text" },
      { key: "ack", header: "Acknowledged", value: (row) => row.ack, minWidth: 150, semantic: "metric" },
      { key: "rate", header: "Rate", value: (row) => row.rate, minWidth: 80, align: "right", mode: "fixed", width: 80, semantic: "metric" },
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

  section(ctx, "Top labels and tags");
  dataTable(ctx, "analytics", {
    columns: [
      { key: "label", header: "Label / Tag", value: (row) => row.label, minWidth: 280, maxLines: 2, semantic: "text" },
      {
        key: "total",
        header: "Documents",
        value: (row) => String(row.total),
        mode: "fixed",
        width: 90,
        align: "right",
        semantic: "metric",
      },
    ],
    rows: [...input.byLabel]
      .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label))
      .slice(0, 24),
    repeatHeader: true,
    fontSize: 9,
    headerFontSize: 9.2,
    maxCellLines: 2,
  });

  section(ctx, "Daily trend");
  dataTable(ctx, "analytics", {
    columns: [
      { key: "date", header: "Date", value: (row) => row.date, minWidth: 130, semantic: "identifier" },
      { key: "sent", header: "Sent", value: (row) => String(row.sent), mode: "fixed", width: 65, align: "right", semantic: "metric" },
      {
        key: "ack",
        header: "Acknowledged",
        value: (row) => String(row.acknowledged),
        mode: "fixed",
        width: 110,
        align: "right",
        semantic: "metric",
      },
      {
        key: "rate",
        header: "Ack rate",
        value: (row) => (row.sent > 0 ? `${Math.round((row.acknowledged / row.sent) * 100)}%` : "0%"),
        mode: "fixed",
        width: 80,
        align: "right",
        semantic: "metric",
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
    section(
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
      note(ctx, "No policy-tagged documents matched this date range.", { muted: true });
    }

    for (const doc of docs) {
      ctx.ensureSpace(100);
      section(ctx, `${doc.document_title} (${doc.document_public_id || "No public ID"})`);
      keyValueList(ctx, [
        { key: "Created", value: fmtUtc(doc.created_at) },
        { key: "Priority", value: normalizePriority(doc.priority).toUpperCase() },
        { key: "Public ID", value: doc.document_public_id || "--", valueFont: "mono" },
        { key: "Labels", value: doc.labels.join(", ") || "--" },
        {
          key: "Tags",
          value:
            Object.entries(doc.tags)
              .map(([k, v]) => `${k}:${v}`)
              .join(", ") || "--",
        },
        { key: "Acknowledged in range", value: String(doc.acknowledged_count) },
        { key: "Pending submissions", value: String(doc.pending_submission_count) },
        {
          key: "Outstanding acknowledgement",
          value: doc.outstanding ? "YES (no acknowledged submissions in range)" : "NO",
        },
      ]);

      section(ctx, "Acknowledgements");
      const acknowledgements = [...doc.acknowledgements].sort(
        (a, b) =>
          (a.submitted_at ?? "").localeCompare(b.submitted_at ?? "") ||
          (a.recipient_email ?? "").localeCompare(b.recipient_email ?? "")
      );
      dataTable(ctx, "evidence", {
        columns: [
          {
            key: "recipient",
            header: "Recipient",
            value: (row) => row.recipient_name || row.recipient_email || "Unknown recipient",
            minWidth: 170,
            maxLines: 2,
            semantic: "text",
          },
          { key: "when", header: "When", value: (row) => fmtUtc(row.submitted_at), minWidth: 132, semantic: "datetime" },
          { key: "method", header: "How", value: (row) => row.method, minWidth: 90, maxLines: 2, semantic: "text" },
          {
            key: "scroll",
            header: "Scroll",
            value: (row) => fmtScroll(row.max_scroll_percent),
            mode: "fixed",
            width: 58,
            align: "right",
            semantic: "metric",
          },
          {
            key: "active",
            header: "Active",
            value: (row) => fmtDurationShort(row.active_seconds),
            mode: "fixed",
            width: 62,
            align: "right",
            semantic: "metric",
          },
          {
            key: "page",
            header: "Page",
            value: (row) => fmtDurationShort(row.time_on_page_seconds),
            mode: "fixed",
            width: 62,
            align: "right",
            semantic: "metric",
          },
          { key: "ip", header: "IP", value: (row) => row.ip ?? "--", minWidth: 76, semantic: "identifier" },
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
        fontSize: 8.45,
        headerFontSize: 8.75,
        lineHeight: 10.2,
        maxCellLines: 2,
      });

      section(ctx, "Outstanding acknowledgements / pending submissions");
      const pending = [...doc.pending_submissions].sort(
        (a, b) =>
          (a.submitted_at ?? "").localeCompare(b.submitted_at ?? "") ||
          (a.recipient_email ?? "").localeCompare(b.recipient_email ?? "")
      );
      dataTable(ctx, "evidence", {
        columns: [
          {
            key: "recipient",
            header: "Recipient",
            value: (row) => row.recipient_name || row.recipient_email || "Unknown recipient",
            minWidth: 180,
            maxLines: 2,
            semantic: "text",
          },
          { key: "when", header: "When", value: (row) => fmtUtc(row.submitted_at), minWidth: 136, semantic: "datetime" },
          { key: "method", header: "Status", value: (row) => row.method, minWidth: 190, maxLines: 2, semantic: "text" },
          {
            key: "scroll",
            header: "Scroll",
            value: (row) => fmtScroll(row.max_scroll_percent),
            mode: "fixed",
            width: 58,
            align: "right",
            semantic: "metric",
          },
          {
            key: "active",
            header: "Active",
            value: (row) => fmtDurationShort(row.active_seconds),
            mode: "fixed",
            width: 62,
            align: "right",
            semantic: "metric",
          },
          {
            key: "page",
            header: "Page",
            value: (row) => fmtDurationShort(row.time_on_page_seconds),
            mode: "fixed",
            width: 62,
            align: "right",
            semantic: "metric",
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
        fontSize: 8.45,
        headerFontSize: 8.75,
        lineHeight: 10.2,
        maxCellLines: 2,
      });
    }
  } else {
    section(ctx, "Acknowledgement evidence");
    const rows = [...input.evidenceRows].sort(
      (a, b) =>
        (a.document_title || "").localeCompare(b.document_title || "") ||
        (a.submitted_at ?? "").localeCompare(b.submitted_at ?? "")
    );
    dataTable(ctx, "evidence", {
      columns: [
        {
          key: "document",
          header: "Document",
          value: (row) => `${row.document_title} (${row.document_public_id || "No public ID"})`,
          minWidth: 190,
          maxLines: 2,
          semantic: "text",
        },
        {
          key: "recipient",
          header: "Recipient",
          value: (row) => row.recipient_name || row.recipient_email || "Unknown recipient",
          minWidth: 140,
          maxLines: 2,
          semantic: "text",
        },
        { key: "how", header: "How", value: (row) => row.method, minWidth: 86, maxLines: 2, semantic: "text" },
        {
          key: "scroll",
          header: "Scroll",
          value: (row) => fmtScroll(row.max_scroll_percent),
          mode: "fixed",
          width: 52,
          align: "right",
          semantic: "metric",
        },
        {
          key: "active",
          header: "Active",
          value: (row) => fmtDurationShort(row.active_seconds),
          mode: "fixed",
          width: 56,
          align: "right",
          semantic: "metric",
        },
        {
          key: "page",
          header: "Page",
          value: (row) => fmtDurationShort(row.time_on_page_seconds),
          mode: "fixed",
          width: 56,
          align: "right",
          semantic: "metric",
        },
        { key: "when", header: "Ack at", value: (row) => fmtUtc(row.submitted_at), minWidth: 122, semantic: "datetime" },
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
      fontSize: 8.45,
      headerFontSize: 8.75,
      lineHeight: 10.2,
      maxCellLines: 2,
    });
  }

  const stackReceipts = [...(input.stackReceipts ?? [])].sort(
    (a, b) =>
      (b.completed_at ?? "").localeCompare(a.completed_at ?? "") ||
      a.stack_title.localeCompare(b.stack_title)
  );
  if (stackReceipts.length > 0) {
    section(ctx, "Stack acknowledgement receipts");
    dataTable(ctx, "receipts", {
      columns: [
        { key: "stack", header: "Stack", value: (row) => row.stack_title, minWidth: 180, maxLines: 2, semantic: "text" },
        { key: "recipient", header: "Recipient", value: (row) => row.recipient_email, minWidth: 160, maxLines: 2, semantic: "text" },
        { key: "completed", header: "Completed", value: (row) => fmtUtc(row.completed_at), minWidth: 130, semantic: "datetime" },
        {
          key: "status",
          header: "Acknowledged",
          value: (row) => `${row.acknowledged_documents}/${row.total_documents}`,
          mode: "fixed",
          width: 82,
          align: "right",
          semantic: "metric",
        },
      ],
      rows: stackReceipts,
      repeatHeader: true,
      fontSize: 8.5,
      headerFontSize: 8.7,
      maxCellLines: 2,
    });
  }

  footer(
    ctx,
    input.mode === "compliance" ? "Compliance Analytics Report" : "Management Analytics Report",
    {
      poweredByBrand: "Receipt",
      poweredByLogo: receiptLogo,
    }
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
