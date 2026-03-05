import { type PDFImage } from "pdf-lib";
import {
  createReportContext,
  embedImageIfPresent,
  saveReport,
} from "@/lib/reports/engine/core";
import {
  dataTable,
  footer,
  header,
  keyValueList,
  kpiRow,
  note,
  section,
  watermark,
} from "@/lib/reports/engine/composer";
import { applyReportPdfMetadata } from "@/lib/reports/pdf-metadata";

export type DocumentEvidenceCompletion = {
  acknowledged: boolean;
  submitted_at: string | null;
  max_scroll_percent: number | null;
  time_on_page_seconds: number | null;
  active_seconds: number | null;
  ip: string | null;
  user_agent: string | null;
  recipient_name: string | null;
  recipient_email: string | null;
};

export type DocumentEvidenceReportInput = {
  reportStyleVersion: "v2" | "v3";
  generatedAtIso: string;
  watermarkEnabled: boolean;
  workspaceName: string;
  brandName: string;
  brandLogoPngBytes?: Uint8Array | null;
  receiptLogoPngBytes?: Uint8Array | null;
  brandLogoWidthPx?: number | null;
  document: {
    id: string;
    title: string;
    publicId: string;
    createdAt: string;
    sha256: string | null;
    publicUrl: string;
  };
  completions: DocumentEvidenceCompletion[];
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

function fmtDuration(seconds: number | null) {
  if (seconds == null || !Number.isFinite(seconds)) return "--";
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${String(r).padStart(2, "0")}s`;
}

function fmtScroll(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "--";
  return `${Math.max(0, Math.min(100, Math.round(value)))}%`;
}

function recipientLabel(row: DocumentEvidenceCompletion) {
  const name = row.recipient_name?.trim() ?? "";
  const email = row.recipient_email?.trim() ?? "";
  if (name && email) return `${name} <${email}>`;
  if (name) return name;
  if (email) return email;
  return "Recipient unavailable";
}

export async function buildDocumentEvidencePdf(input: DocumentEvidenceReportInput) {
  let receiptLogo: PDFImage | null = null;

  const ctx = await createReportContext({
    styleVersion: input.reportStyleVersion,
    onPageAdded: (nextCtx) => {
      watermark(nextCtx, { enabled: input.watermarkEnabled, receiptLogo });
    },
  });

  receiptLogo = await embedImageIfPresent(ctx, input.receiptLogoPngBytes);
  const workspaceLogo = await embedImageIfPresent(ctx, input.brandLogoPngBytes);
  watermark(ctx, { enabled: input.watermarkEnabled, receiptLogo });

  const generatedDate = new Date(input.generatedAtIso);
  const metadataDate = Number.isFinite(generatedDate.getTime()) ? generatedDate : new Date();
  const generatedLabel = fmtUtc(metadataDate.toISOString());
  const workspaceLabel = input.workspaceName.trim();
  const subtitle =
    workspaceLabel && workspaceLabel.toLowerCase() !== "receipt"
      ? `${workspaceLabel} delivery evidence and acknowledgement record.`
      : "Delivery evidence and acknowledgement record.";

  const completions = [...input.completions].sort(
    (a, b) =>
      String(b.submitted_at ?? "").localeCompare(String(a.submitted_at ?? "")) ||
      recipientLabel(a).localeCompare(recipientLabel(b))
  );

  const acknowledgementCount = completions.filter((row) => row.acknowledged).length;
  const latestAcknowledgement =
    completions.find((row) => row.acknowledged && row.submitted_at)?.submitted_at ?? null;

  header(ctx, {
    title: input.document.title,
    subtitle,
    eyebrow: "EVIDENCE RECORD",
    rightMeta: `Generated ${generatedLabel}`,
    logo: workspaceLogo ?? receiptLogo,
    logoWidthPx: input.brandLogoWidthPx,
    brandName: input.brandName,
    reportStyleVersion: input.reportStyleVersion,
  });

  kpiRow(
    ctx,
    [
      { label: "Status", value: acknowledgementCount > 0 ? "Acknowledged" : "Pending" },
      { label: "Acknowledgements", value: String(acknowledgementCount) },
      { label: "Latest acknowledgement", value: fmtUtc(latestAcknowledgement) },
    ],
    { columns: 3 }
  );

  section(ctx, "Document Details", "Reference and integrity fields");
  keyValueList(
    ctx,
    [
      { key: "Public link", value: input.document.publicUrl, valueFont: "mono" },
      { key: "Record ID", value: input.document.id, valueFont: "mono" },
      { key: "Public ID", value: input.document.publicId, valueFont: "mono" },
      { key: "Created", value: fmtUtc(input.document.createdAt) },
      { key: "Document hash (SHA-256)", value: input.document.sha256 ?? "--", valueFont: "mono" },
    ],
    { gapAfter: ctx.theme.sectionGap }
  );

  section(
    ctx,
    "Completion Evidence",
    `${completions.length} submission${completions.length === 1 ? "" : "s"}`
  );

  if (completions.length === 0) {
    note(ctx, "No completion events are recorded for this document yet.", { muted: true });
  } else {
    dataTable(ctx, "evidence", {
      columns: [
        {
          key: "recipient",
          header: "Recipient",
          value: (row) => recipientLabel(row),
          minWidth: 170,
          maxLines: 2,
          semantic: "text",
        },
        {
          key: "status",
          header: "Status",
          value: (row) => (row.acknowledged ? "Acknowledged" : "Not acknowledged"),
          mode: "fixed",
          width: 110,
          semantic: "status",
        },
        {
          key: "submitted",
          header: "Submitted",
          value: (row) => fmtUtc(row.submitted_at),
          minWidth: 124,
          semantic: "datetime",
        },
        {
          key: "scroll",
          header: "Scroll",
          value: (row) => fmtScroll(row.max_scroll_percent),
          mode: "fixed",
          width: 62,
          semantic: "metric",
        },
        {
          key: "active",
          header: "Active",
          value: (row) => fmtDuration(row.active_seconds),
          mode: "fixed",
          width: 70,
          semantic: "metric",
        },
        {
          key: "page",
          header: "Time on page",
          value: (row) => fmtDuration(row.time_on_page_seconds),
          mode: "fixed",
          width: 90,
          semantic: "metric",
        },
      ],
      rows: completions,
      repeatHeader: true,
      maxCellLines: 2,
    });

    section(ctx, "Technical Trace");
    dataTable(ctx, "evidence", {
      columns: [
        {
          key: "recipient",
          header: "Recipient",
          value: (row) => recipientLabel(row),
          minWidth: 170,
          maxLines: 2,
          semantic: "text",
        },
        {
          key: "ip",
          header: "IP address",
          value: (row) => row.ip ?? "--",
          minWidth: 88,
          semantic: "identifier",
        },
        {
          key: "userAgent",
          header: "User agent",
          value: (row) => row.user_agent ?? "--",
          minWidth: 300,
          maxLines: 2,
          semantic: "text",
        },
      ],
      rows: completions,
      repeatHeader: true,
      maxCellLines: 2,
    });
  }

  footer(ctx, "Document Evidence Report", {
    poweredByLogo: receiptLogo,
  });

  applyReportPdfMetadata(ctx.pdf, {
    title: "Document Evidence Record",
    subject: "Acknowledgement and delivery evidence export",
    generatedAt: metadataDate,
    keywords: ["evidence", "acknowledgement", "audit"],
  });

  return saveReport(ctx, process.env.PDF_DETERMINISTIC === "1");
}
