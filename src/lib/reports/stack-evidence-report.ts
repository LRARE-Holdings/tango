import { createReportContext, embedImageIfPresent, saveReport } from "@/lib/reports/engine/core";
import {
  dataTable,
  footer,
  header,
  keyValueList,
  kpiRow,
  section,
} from "@/lib/reports/engine/composer";
import { applyReportPdfMetadata } from "@/lib/reports/pdf-metadata";

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

function fmtDuration(rawSeconds: unknown) {
  const seconds = Number(rawSeconds);
  if (!Number.isFinite(seconds) || seconds < 0) return "--";
  const safe = Math.floor(seconds);
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${minutes}m ${String(remainder).padStart(2, "0")}s`;
}

function recipientLabel(name: string | null, email: string) {
  const cleanName = name?.trim() ?? "";
  const cleanEmail = email.trim();
  if (cleanName) return `${cleanName} <${cleanEmail}>`;
  return cleanEmail;
}

export async function buildStackEvidencePdf(input: StackEvidenceReportInput): Promise<Uint8Array> {
  const ctx = await createReportContext({
    styleVersion: input.reportStyleVersion,
    theme: {
      pageWidth: 841.89,
      pageHeight: 595.28,
      marginTop: input.reportStyleVersion === "v3" ? 42 : 44,
      marginRight: input.reportStyleVersion === "v3" ? 34 : 36,
      marginBottom: 34,
      marginLeft: input.reportStyleVersion === "v3" ? 34 : 36,
      titleSize: input.reportStyleVersion === "v3" ? 18.8 : 19.3,
    },
  });

  const receiptLogo = await embedImageIfPresent(ctx, input.receiptLogoPngBytes);
  const workspaceLogo = await embedImageIfPresent(ctx, input.brandLogoImageBytes);

  const generatedDate = new Date(input.generatedAtIso);
  const metadataDate = Number.isFinite(generatedDate.getTime()) ? generatedDate : new Date();
  const generatedLabel = fmtUtc(metadataDate.toISOString());

  const workspaceLabel = input.workspaceName.trim();
  const subtitle =
    workspaceLabel && workspaceLabel.toLowerCase() !== "receipt"
      ? `${workspaceLabel} stack acknowledgement audit export.`
      : "Stack acknowledgement audit export.";

  header(ctx, {
    title: `${input.stackTitle} Evidence Record`,
    subtitle,
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
      {
        label: "Stack status",
        value: input.acknowledgedDocuments >= input.totalDocuments ? "Complete" : "Partial",
      },
      { label: "Documents", value: String(input.totalDocuments) },
      { label: "Acknowledged", value: `${input.acknowledgedDocuments}/${input.totalDocuments}` },
    ],
    { columns: 3 }
  );

  section(ctx, "Delivery Summary");
  keyValueList(
    ctx,
    [
      { key: "Evidence reference", value: input.receiptId, valueFont: "mono" },
      { key: "Recipient", value: recipientLabel(input.recipientName, input.recipientEmail) },
      { key: "Completed at", value: fmtUtc(input.completedAt) },
    ],
    { gapAfter: Math.max(6, ctx.theme.sectionGap - 1) }
  );

  section(ctx, "Document Evidence", "Each document remains independently acknowledged and auditable.");

  const rows = [...input.documents]
    .sort(
      (a, b) =>
        a.document_title.localeCompare(b.document_title) ||
        a.document_public_id.localeCompare(b.document_public_id)
    )
    .map((document) => {
      const evidence = document.acknowledgement_data ?? {};
      const scroll = Number(evidence.max_scroll_percent ?? 0);
      const scrollLabel = Number.isFinite(scroll)
        ? `${Math.max(0, Math.min(100, Math.floor(scroll)))}%`
        : "--";

      return {
        title: document.document_title,
        id: document.document_public_id || "No public ID",
        status: document.acknowledged ? "Acknowledged" : "Pending",
        method: document.method ?? "--",
        acknowledgedAt: fmtUtc(document.acknowledged_at),
        scroll: scrollLabel,
        active: fmtDuration(evidence.active_seconds),
        page: fmtDuration(evidence.time_on_page_seconds),
        ip: String(evidence.ip ?? "--"),
      };
    });

  dataTable(ctx, "evidence", {
    columns: [
      {
        key: "title",
        header: "Document",
        value: (row) => row.title,
        minWidth: 185,
        maxLines: 2,
        semantic: "text",
      },
      {
        key: "id",
        header: "Public ID",
        value: (row) => row.id,
        minWidth: 82,
        semantic: "identifier",
      },
      {
        key: "status",
        header: "Status",
        value: (row) => row.status,
        mode: "fixed",
        width: 80,
        semantic: "status",
      },
      {
        key: "method",
        header: "Method",
        value: (row) => row.method,
        minWidth: 90,
        maxLines: 2,
        semantic: "text",
      },
      {
        key: "acknowledgedAt",
        header: "Acknowledged at",
        value: (row) => row.acknowledgedAt,
        minWidth: 115,
        semantic: "datetime",
      },
      {
        key: "scroll",
        header: "Scroll",
        value: (row) => row.scroll,
        mode: "fixed",
        width: 58,
        semantic: "metric",
      },
      {
        key: "active",
        header: "Active",
        value: (row) => row.active,
        mode: "fixed",
        width: 70,
        semantic: "metric",
      },
      {
        key: "page",
        header: "Time on page",
        value: (row) => row.page,
        mode: "fixed",
        width: 90,
        semantic: "metric",
      },
      {
        key: "ip",
        header: "IP",
        value: (row) => row.ip,
        minWidth: 74,
        semantic: "identifier",
      },
    ],
    rows,
    repeatHeader: true,
    maxCellLines: 2,
  });

  footer(ctx, "Stack Evidence Report", {
    poweredByLogo: receiptLogo,
  });

  applyReportPdfMetadata(ctx.pdf, {
    title: "Stack Evidence Record",
    subject: "Stack acknowledgement evidence export",
    generatedAt: metadataDate,
    keywords: ["stack", "evidence", "acknowledgement", "audit"],
  });

  return saveReport(ctx, process.env.PDF_DETERMINISTIC === "1");
}
