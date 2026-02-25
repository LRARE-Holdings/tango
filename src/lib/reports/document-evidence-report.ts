import { type PDFImage } from "pdf-lib";
import {
  createReportContext,
  embedImageIfPresent,
  saveReport,
  type ReportContext,
} from "@/lib/reports/engine/core";
import {
  footer,
  header,
  keyValueList,
  kpiRow,
  note,
  section,
  watermark,
} from "@/lib/reports/engine/composer";
import { measureTextBlockHeight } from "@/lib/reports/engine/text";

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
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "--";
  return `${UTC_FORMATTER.format(d).replace(",", "")} UTC`;
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

function estimateKeyValueHeight(ctx: ReportContext, key: string, value: string, labelWidth: number) {
  const lineHeight = Math.max(ctx.theme.lineHeight, ctx.theme.bodySize + 3.4);
  const valueWidth = Math.max(120, ctx.cursor.maxX - ctx.cursor.minX - labelWidth);
  const labelHeight = measureTextBlockHeight(ctx, {
    text: key,
    maxWidth: Math.max(72, labelWidth - 8),
    size: ctx.theme.bodySize,
    lineHeight,
    font: "bold",
  });
  const valueHeight = measureTextBlockHeight(ctx, {
    text: value,
    maxWidth: valueWidth,
    size: ctx.theme.bodySize,
    lineHeight,
  });
  return Math.max(labelHeight, valueHeight) + 6;
}

export async function buildDocumentEvidencePdf(input: DocumentEvidenceReportInput) {
  let receiptLogo: PDFImage | null = null;
  const ctx = await createReportContext({
    styleVersion: input.reportStyleVersion,
    onPageAdded: (pageCtx) => {
      watermark(pageCtx, { enabled: input.watermarkEnabled, receiptLogo, fallbackBrand: "Receipt" });
    },
  });

  receiptLogo = await embedImageIfPresent(ctx, input.receiptLogoPngBytes);
  const workspaceLogo = await embedImageIfPresent(ctx, input.brandLogoPngBytes);
  watermark(ctx, { enabled: input.watermarkEnabled, receiptLogo, fallbackBrand: "Receipt" });

  const generatedDate = new Date(input.generatedAtIso);
  const metadataDate = Number.isFinite(generatedDate.getTime()) ? generatedDate : new Date();
  const generatedLabel = fmtUtc(
    Number.isFinite(generatedDate.getTime()) ? generatedDate.toISOString() : new Date().toISOString()
  );
  const acknowledgements = input.completions.filter((row) => row.acknowledged).length;
  const latestAck =
    [...input.completions]
      .filter((row) => row.acknowledged && row.submitted_at)
      .sort((a, b) => String(b.submitted_at).localeCompare(String(a.submitted_at)))[0]?.submitted_at ?? null;

  header(ctx, {
    title: input.document.title,
    subtitle: `${input.workspaceName} delivery evidence and acknowledgement record.`,
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
      { label: "STATUS", value: acknowledgements > 0 ? "Acknowledged" : "Pending" },
      { label: "ACKNOWLEDGEMENTS", value: String(acknowledgements) },
      { label: "LATEST ACK", value: fmtUtc(latestAck) },
    ],
    { columns: 3 }
  );

  section(ctx, "Document details", "Reference and integrity fields");
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
    "Completions",
    `${input.completions.length} total submission${input.completions.length === 1 ? "" : "s"}`
  );

  const completions = [...input.completions].sort(
    (a, b) =>
      String(b.submitted_at ?? "").localeCompare(String(a.submitted_at ?? "")) ||
      String(a.recipient_email ?? "").localeCompare(String(b.recipient_email ?? ""))
  );

  if (completions.length === 0) {
    note(ctx, "No completions recorded yet.", { muted: true });
  }

  for (const completion of completions) {
    const recipientName = completion.recipient_name?.trim() || completion.recipient_email?.trim() || "Recipient";
    const recipientSecondary =
      completion.recipient_name && completion.recipient_email ? completion.recipient_email : null;
    const engagementValue = `Scroll ${fmtScroll(completion.max_scroll_percent)} | Active ${fmtDuration(
      completion.active_seconds
    )} | Time on page ${fmtDuration(completion.time_on_page_seconds)}`;

    const labelWidth = ctx.theme.keyValueLabelWidth;
    const openingRowsHeight =
      estimateKeyValueHeight(ctx, "Status", completion.acknowledged ? "Acknowledged" : "Not acknowledged", labelWidth) +
      estimateKeyValueHeight(ctx, "Submitted", fmtUtc(completion.submitted_at), labelWidth) +
      estimateKeyValueHeight(ctx, "Engagement", engagementValue, labelWidth);
    ctx.ensureSpace(openingRowsHeight + 28);

    section(ctx, recipientName, recipientSecondary ?? undefined);
    keyValueList(
      ctx,
      [
        { key: "Status", value: completion.acknowledged ? "Acknowledged" : "Not acknowledged" },
        { key: "Submitted", value: fmtUtc(completion.submitted_at) },
        { key: "Engagement", value: engagementValue },
        { key: "IP address", value: completion.ip ?? "--", valueFont: "mono" },
        { key: "User agent", value: completion.user_agent ?? "--" },
      ],
      { gapAfter: Math.max(5, ctx.theme.sectionGap - 2) }
    );
  }

  footer(ctx, "Receipt Evidence Document", {
    poweredByBrand: "Receipt",
    poweredByLogo: receiptLogo,
  });
  ctx.pdf.setTitle("Receipt Evidence Record");
  ctx.pdf.setProducer("Receipt");
  ctx.pdf.setCreator("Receipt");
  ctx.pdf.setCreationDate(metadataDate);
  ctx.pdf.setModificationDate(metadataDate);
  return saveReport(ctx, process.env.PDF_DETERMINISTIC === "1");
}

