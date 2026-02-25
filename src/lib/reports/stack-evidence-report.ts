import { createReportContext, embedImageIfPresent, saveReport } from "@/lib/reports/engine/core";
import {
  dataTable,
  footer,
  header,
  keyValueList,
  kpiRow,
  section,
} from "@/lib/reports/engine/composer";

export type StackEvidenceDocument = {
  document_title: string;
  document_public_id: string;
  acknowledged: boolean;
  method: string | null;
  acknowledged_at: string | null;
  acknowledgement_data: Record<string, unknown>;
};

export type StackEvidenceReportInput = {
  reportStyleVersion: "v2" | "v3";
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
  const generatedLabel = fmtUtc(
    Number.isFinite(generatedDate.getTime()) ? generatedDate.toISOString() : new Date().toISOString()
  );

  header(ctx, {
    title: `${input.stackTitle} Evidence Record`,
    subtitle: `${input.workspaceName} stack acknowledgement audit export.`,
    eyebrow: "STACK ACKNOWLEDGEMENT EVIDENCE",
    rightMeta: `Generated ${generatedLabel}`,
    logo: workspaceLogo ?? receiptLogo,
    logoWidthPx: input.brandLogoWidthPx,
    brandName: input.brandName ?? input.workspaceName,
    reportStyleVersion: input.reportStyleVersion,
  });

  kpiRow(
    ctx,
    [
      { label: "STACK STATUS", value: input.acknowledgedDocuments >= input.totalDocuments ? "Complete" : "Partial" },
      { label: "DOCUMENTS", value: String(input.totalDocuments) },
      { label: "ACKNOWLEDGED", value: `${input.acknowledgedDocuments}/${input.totalDocuments}` },
    ],
    { columns: 3 }
  );

  section(ctx, "Receipt summary");
  keyValueList(
    ctx,
    [
      { key: "Receipt reference", value: input.receiptId, valueFont: "mono" },
      {
        key: "Recipient",
        value: input.recipientName ? `${input.recipientName} <${input.recipientEmail}>` : input.recipientEmail,
      },
      { key: "Completed at", value: fmtUtc(input.completedAt) },
    ],
    { gapAfter: Math.max(6, ctx.theme.sectionGap - 1) }
  );

  section(
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
      const engagement = `Scroll ${
        Number.isFinite(scroll) ? `${Math.max(0, Math.min(100, Math.floor(scroll)))}%` : "--"
      } | Active ${fmtDuration(ackData.active_seconds)} | Page ${fmtDuration(ackData.time_on_page_seconds)}`;
      const method = doc.method ?? "--";
      const ip = String(ackData.ip ?? "--");
      return {
        title: doc.document_title,
        id: doc.document_public_id || "No public ID",
        status: doc.acknowledged ? "Acknowledged" : "Pending",
        method,
        at: fmtUtc(doc.acknowledged_at),
        engagement,
        ip,
        details: `${method} | ${engagement} | IP ${ip}`,
      };
    });

  if (input.reportStyleVersion === "v3") {
    dataTable(ctx, "evidence", {
      columns: [
        { key: "title", header: "Document", value: (row) => row.title, minWidth: 195, maxLines: 2, semantic: "text" },
        { key: "id", header: "Public ID", value: (row) => row.id, minWidth: 84, semantic: "identifier" },
        { key: "status", header: "Status", value: (row) => row.status, mode: "fixed", width: 76, semantic: "status" },
        { key: "at", header: "Acknowledged at", value: (row) => row.at, minWidth: 112, semantic: "datetime" },
        { key: "details", header: "Evidence details", value: (row) => row.details, minWidth: 175, maxLines: 3, semantic: "text" },
      ],
      rows,
      repeatHeader: true,
      maxCellLines: 3,
    });
  } else {
    dataTable(ctx, "evidence", {
      columns: [
        { key: "title", header: "Document", value: (row) => row.title, minWidth: 180, maxLines: 2, semantic: "text" },
        { key: "id", header: "Public ID", value: (row) => row.id, minWidth: 86, semantic: "identifier" },
        { key: "status", header: "Status", value: (row) => row.status, mode: "fixed", width: 74, semantic: "status" },
        { key: "method", header: "Method", value: (row) => row.method, minWidth: 88, maxLines: 2, semantic: "text" },
        { key: "at", header: "Acknowledged at", value: (row) => row.at, minWidth: 118, semantic: "datetime" },
        { key: "engagement", header: "Engagement", value: (row) => row.engagement, minWidth: 125, maxLines: 2, semantic: "text" },
        { key: "ip", header: "IP", value: (row) => row.ip, minWidth: 66, semantic: "identifier" },
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
  }

  footer(ctx, "Stack Evidence Document", {
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

