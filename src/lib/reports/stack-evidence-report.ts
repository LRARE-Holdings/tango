import { createReportContext, embedImageIfPresent, saveReport } from "@/lib/reports/engine/core";
import { drawTable } from "@/lib/reports/engine/table";
import {
  drawKeyValueRow,
  drawMetricCards,
  drawReportHeader,
  drawSectionHeading,
  finalizeFooters,
} from "@/lib/reports/engine/sections";

export type StackEvidenceDocument = {
  document_title: string;
  document_public_id: string;
  acknowledged: boolean;
  method: string | null;
  acknowledged_at: string | null;
  acknowledgement_data: Record<string, unknown>;
};

export type StackEvidenceReportInput = {
  reportStyleVersion: "v2";
  workspaceName: string;
  generatedAtIso: string;
  receiptId: string;
  stackTitle: string;
  recipientName: string | null;
  recipientEmail: string;
  completedAt: string | null;
  totalDocuments: number;
  acknowledgedDocuments: number;
  brandName?: string;
  brandLogoImageBytes?: Uint8Array | null;
  receiptLogoPngBytes?: Uint8Array | null;
  brandLogoWidthPx?: number | null;
  documents: StackEvidenceDocument[];
};

function fmtDuration(seconds: unknown) {
  const raw = Number(seconds);
  if (!Number.isFinite(raw) || raw < 0) return "--";
  const s = Math.floor(raw);
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

export async function buildStackEvidencePdf(input: StackEvidenceReportInput): Promise<Uint8Array> {
  const ctx = await createReportContext({
    theme: {
      pageWidth: 841.89,
      pageHeight: 595.28,
      marginTop: 46,
      marginRight: 38,
      marginBottom: 36,
      marginLeft: 38,
      titleSize: 19.5,
    },
  });
  const receiptLogo = await embedImageIfPresent(ctx, input.receiptLogoPngBytes);
  const workspaceLogo = await embedImageIfPresent(ctx, input.brandLogoImageBytes);
  const generatedDate = new Date(input.generatedAtIso);
  const metadataDate = Number.isFinite(generatedDate.getTime()) ? generatedDate : new Date();
  const generatedLabel = fmtUtc(Number.isFinite(generatedDate.getTime()) ? generatedDate.toISOString() : new Date().toISOString());

  drawReportHeader(ctx, {
    title: `${input.stackTitle} Evidence Record`,
    subtitle: `${input.workspaceName} stack acknowledgement audit export.`,
    eyebrow: "STACK ACKNOWLEDGEMENT EVIDENCE",
    rightMeta: `Generated ${generatedLabel}`,
    logo: workspaceLogo ?? receiptLogo,
    logoWidthPx: input.brandLogoWidthPx,
    brandName: input.brandName ?? input.workspaceName,
    reportStyleVersion: input.reportStyleVersion,
  });

  drawMetricCards(
    ctx,
    [
      { label: "STACK STATUS", value: input.acknowledgedDocuments >= input.totalDocuments ? "Complete" : "Partial" },
      { label: "DOCUMENTS", value: String(input.totalDocuments) },
      { label: "ACKNOWLEDGED", value: `${input.acknowledgedDocuments}/${input.totalDocuments}` },
    ],
    { columns: 3 }
  );

  drawSectionHeading(ctx, "Receipt summary");
  drawKeyValueRow(ctx, "Receipt reference", input.receiptId, { valueFont: "mono" });
  drawKeyValueRow(
    ctx,
    "Recipient",
    input.recipientName ? `${input.recipientName} <${input.recipientEmail}>` : input.recipientEmail
  );
  drawKeyValueRow(ctx, "Completed at", fmtUtc(input.completedAt));
  ctx.cursor.y -= 8;

  drawSectionHeading(
    ctx,
    "Document-level evidence",
    "Each document remains independently acknowledged and auditable."
  );

  const rows = [...input.documents]
    .sort(
      (a, b) =>
        a.document_title.localeCompare(b.document_title) ||
        a.document_public_id.localeCompare(b.document_public_id)
    )
    .map((doc) => {
      const ackData = doc.acknowledgement_data ?? {};
      const scroll = Number(ackData.max_scroll_percent ?? 0);
      return {
        title: doc.document_title,
        id: doc.document_public_id || "No public ID",
        status: doc.acknowledged ? "Acknowledged" : "Pending",
        method: doc.method ?? "--",
        at: fmtUtc(doc.acknowledged_at),
        engagement: `Scroll ${
          Number.isFinite(scroll) ? `${Math.max(0, Math.min(100, Math.floor(scroll)))}%` : "--"
        } | Active ${fmtDuration(ackData.active_seconds)} | Page ${fmtDuration(ackData.time_on_page_seconds)}`,
        ip: String(ackData.ip ?? "--"),
      };
    });

  drawTable(ctx, {
    columns: [
      { key: "title", header: "Document", value: (row) => row.title, minWidth: 180, maxLines: 2 },
      { key: "id", header: "Public ID", value: (row) => row.id, minWidth: 86, font: "mono" },
      { key: "status", header: "Status", value: (row) => row.status, mode: "fixed", width: 74 },
      { key: "method", header: "Method", value: (row) => row.method, minWidth: 88, maxLines: 2 },
      { key: "at", header: "Acknowledged at", value: (row) => row.at, minWidth: 118 },
      { key: "engagement", header: "Engagement", value: (row) => row.engagement, minWidth: 125, maxLines: 2 },
      { key: "ip", header: "IP", value: (row) => row.ip, minWidth: 66, font: "mono" },
    ],
    rows,
    repeatHeader: true,
    fontSize: 8.6,
    headerFontSize: 8.85,
    lineHeight: 10.2,
    cellPaddingY: 4,
    cellPaddingX: 5,
    maxCellLines: 2,
    stripedRows: true,
  });

  finalizeFooters(ctx, "Stack Evidence Document", {
    poweredByBrand: "Receipt",
    poweredByLogo: receiptLogo,
  });
  ctx.pdf.setTitle("Stack Evidence Record");
  ctx.pdf.setProducer("Receipt");
  ctx.pdf.setCreator("Receipt");
  ctx.pdf.setCreationDate(metadataDate);
  ctx.pdf.setModificationDate(metadataDate);
  return saveReport(ctx, process.env.PDF_DETERMINISTIC === "1");
}
