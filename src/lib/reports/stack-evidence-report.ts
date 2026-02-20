import { createReportDocument, drawHeader, drawKeyValueRow } from "@/lib/reports/layout";

export type StackEvidenceDocument = {
  document_title: string;
  document_public_id: string;
  acknowledged: boolean;
  method: string | null;
  acknowledged_at: string | null;
  acknowledgement_data: Record<string, unknown>;
};

export type StackEvidenceReportInput = {
  workspaceName: string;
  generatedAtIso: string;
  receiptId: string;
  stackTitle: string;
  recipientName: string | null;
  recipientEmail: string;
  completedAt: string | null;
  totalDocuments: number;
  acknowledgedDocuments: number;
  documents: StackEvidenceDocument[];
};

function fmtDuration(seconds: unknown) {
  const raw = Number(seconds);
  if (!Number.isFinite(raw) || raw < 0) return "—";
  const s = Math.floor(raw);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${String(r).padStart(2, "0")}s`;
}

function fmtUtc(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toUTCString();
}

export async function buildStackEvidencePdf(input: StackEvidenceReportInput): Promise<Uint8Array> {
  const { pdf, page, font, fontBold, theme } = await createReportDocument();
  let currentPage = page;
  const pageHeight = page.getHeight();
  let y = drawHeader({
    page: currentPage,
    fontBold,
    title: `${input.stackTitle} Evidence Record`,
    subtitle: `Generated ${fmtUtc(input.generatedAtIso)} · ${input.workspaceName}`,
    theme,
  });

  const ensureRoom = (need: number, heading?: string) => {
    if (y >= 70 + need) return;
    currentPage = pdf.addPage([595.28, 841.89]);
    y = pageHeight - theme.margin;
    if (heading) {
      currentPage.drawText(heading, { x: theme.margin, y, font: fontBold, size: 12 });
      y -= 16;
    }
  };

  y = drawKeyValueRow({
    page: currentPage,
    font,
    fontBold,
    y,
    key: "Receipt reference",
    value: input.receiptId,
    theme,
  });
  y = drawKeyValueRow({
    page: currentPage,
    font,
    fontBold,
    y,
    key: "Recipient",
    value: input.recipientName ? `${input.recipientName} <${input.recipientEmail}>` : input.recipientEmail,
    theme,
  });
  y = drawKeyValueRow({
    page: currentPage,
    font,
    fontBold,
    y,
    key: "Completed at",
    value: fmtUtc(input.completedAt),
    theme,
  });
  y = drawKeyValueRow({
    page: currentPage,
    font,
    fontBold,
    y,
    key: "Acknowledgements",
    value: `${input.acknowledgedDocuments}/${input.totalDocuments}`,
    theme,
  });

  y -= 18;
  currentPage.drawText("Document-level acknowledgement evidence", {
    x: theme.margin,
    y,
    font: fontBold,
    size: 12,
  });
  y -= 14;

  for (const doc of input.documents) {
    ensureRoom(88, "Document-level acknowledgement evidence (continued)");
    const ackData = doc.acknowledgement_data ?? {};
    const scroll = Number(ackData.max_scroll_percent ?? 0);
    const scrollText = Number.isFinite(scroll) ? `${Math.max(0, Math.min(100, Math.floor(scroll)))}%` : "—";
    const active = ackData.active_seconds;
    const timeOnPage = ackData.time_on_page_seconds;
    const ip = String(ackData.ip ?? "—");

    currentPage.drawText(`${doc.document_title} (${doc.document_public_id || "No public ID"})`, {
      x: theme.margin,
      y,
      font: fontBold,
      size: 10.2,
    });
    y -= 11;
    currentPage.drawText(
      `Acknowledged: ${doc.acknowledged ? "Yes" : "No"} | Method: ${doc.method ?? "—"} | At: ${fmtUtc(doc.acknowledged_at)}`,
      { x: theme.margin, y, font, size: 8.7, color: theme.muted }
    );
    y -= 10;
    currentPage.drawText(
      `Scroll: ${scrollText} | Active: ${fmtDuration(active)} | Page time: ${fmtDuration(timeOnPage)} | IP: ${ip}`,
      { x: theme.margin, y, font, size: 8.5, color: theme.muted }
    );
    y -= 14;
  }

  const pages = pdf.getPages();
  for (let i = 0; i < pages.length; i += 1) {
    const p = pages[i];
    const label = `Page ${i + 1} of ${pages.length}`;
    p.drawText(label, {
      x: p.getWidth() - theme.margin - font.widthOfTextAtSize(label, 9),
      y: 20,
      size: 9,
      font,
    });
  }

  pdf.setTitle("Stack Evidence Record");
  pdf.setProducer("Receipt");
  pdf.setCreator("Receipt");
  return pdf.save();
}
