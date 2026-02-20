import { PDFDocument } from "pdf-lib";
import { createReportDocument, drawHeader, drawKeyValueRow } from "@/lib/reports/layout";

export type AnalyticsReportMode = "compliance" | "management";

export type AnalyticsReportInput = {
  workspaceName: string;
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

function fmtDuration(seconds: number | null) {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return "—";
  const s = Math.max(0, Math.floor(seconds));
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  return `${days}d ${hours}h`;
}

export async function buildAnalyticsReportPdf(input: AnalyticsReportInput): Promise<Uint8Array> {
  const { pdf, page, font, fontBold, theme } = await createReportDocument();
  let currentPage = page;
  const pageHeight = page.getHeight();
  const ensureRoom = (need: number, heading?: string) => {
    if (y >= 70 + need) return;
    currentPage = pdf.addPage([595.28, 841.89]);
    y = pageHeight - theme.margin;
    if (heading) {
      currentPage.drawText(heading, { x: theme.margin, y, font: fontBold, size: 12 });
      y -= 16;
    }
  };
  let y = drawHeader({
    page: currentPage,
    fontBold,
    title:
      input.mode === "compliance"
        ? `${input.workspaceName} Compliance Report`
        : `${input.workspaceName} Management KPI Report`,
    subtitle: `Generated ${new Date(input.generatedAtIso).toUTCString()} · ${input.rangeLabel}`,
    theme,
  });

  y = drawKeyValueRow({
    page: currentPage,
    font,
    fontBold,
    y,
    key: "Total documents sent",
    value: String(input.metrics.total_documents_sent),
    theme,
  });
  y = drawKeyValueRow({
    page: currentPage,
    font,
    fontBold,
    y,
    key: "Acknowledgement rate",
    value: `${input.metrics.acknowledgement_rate_percent}%`,
    theme,
  });
  y = drawKeyValueRow({
    page: currentPage,
    font,
    fontBold,
    y,
    key: "Average time to acknowledgement",
    value: fmtDuration(input.metrics.avg_time_to_ack_seconds),
    theme,
  });
  y = drawKeyValueRow({
    page: currentPage,
    font,
    fontBold,
    y,
    key: "Outstanding acknowledgements",
    value: String(input.metrics.outstanding_acknowledgements),
    theme,
  });

  if (input.mode === "compliance") {
    y -= 6;
    currentPage.drawText("Regulatory scope: Policy-tagged receipts only.", {
      x: theme.margin,
      y,
      font: font,
      size: 10,
      color: theme.muted,
    });
    y -= 14;
  }

  y -= 16;
  currentPage.drawText("Breakdown by priority", { x: theme.margin, y, font: fontBold, size: 12 });
  y -= 18;
  for (const row of input.byPriority) {
    y = drawKeyValueRow({
      page: currentPage,
      font,
      fontBold,
      y,
      key: `${row.priority} priority`,
      value: `${row.acknowledged}/${row.total} acknowledged`,
      theme,
    });
  }

  y -= 16;
  currentPage.drawText("Top labels/tags", { x: theme.margin, y, font: fontBold, size: 12 });
  y -= 18;
  for (const row of input.byLabel.slice(0, 8)) {
    y = drawKeyValueRow({
      page: currentPage,
      font,
      fontBold,
      y,
      key: row.label,
      value: String(row.total),
      theme,
    });
  }

  y -= 16;
  currentPage.drawText("Daily trend (last 30 days)", { x: theme.margin, y, font: fontBold, size: 12 });
  y -= 18;
  for (const row of input.series.slice(-10)) {
    y = drawKeyValueRow({
      page: currentPage,
      font,
      fontBold,
      y,
      key: row.date,
      value: `Sent ${row.sent} · Ack ${row.acknowledged}`,
      theme,
    });
  }

  if (input.mode === "compliance") {
    y -= 16;
    currentPage.drawText("Policy document evidence", { x: theme.margin, y, font: fontBold, size: 12 });
    y -= 14;

    const docs = input.complianceDocuments ?? [];
    if (docs.length === 0) {
      currentPage.drawText("No policy-tagged documents matched this date range.", {
        x: theme.margin,
        y,
        font,
        size: 9.5,
        color: theme.muted,
      });
      y -= 12;
    }

    for (const doc of docs) {
      ensureRoom(88, "Policy document evidence (continued)");
      currentPage.drawText(`${doc.document_title} (${doc.document_public_id || "No public ID"})`, {
        x: theme.margin,
        y,
        font: fontBold,
        size: 10.5,
      });
      y -= 12;
      currentPage.drawText(
        `Created ${doc.created_at ? new Date(doc.created_at).toUTCString() : "—"} | Priority ${doc.priority.toUpperCase()} | Acknowledged ${doc.acknowledged_count} | Pending submissions ${doc.pending_submission_count}`,
        { x: theme.margin, y, font, size: 8.8, color: theme.muted }
      );
      y -= 11;
      const tagsLine = Object.entries(doc.tags)
        .map(([k, v]) => `${k}:${v}`)
        .join(", ");
      const labelsLine = doc.labels.join(", ");
      currentPage.drawText(`Labels: ${labelsLine || "—"} | Tags: ${tagsLine || "—"}`, {
        x: theme.margin,
        y,
        font,
        size: 8.4,
        color: theme.muted,
      });
      y -= 11;
      currentPage.drawText(
        doc.outstanding
          ? "Outstanding acknowledgement: YES (no acknowledged submissions recorded in range)"
          : "Outstanding acknowledgement: NO",
        { x: theme.margin, y, font: fontBold, size: 8.8 }
      );
      y -= 11;

      currentPage.drawText("Acknowledgements", { x: theme.margin, y, font: fontBold, size: 9 });
      y -= 10;
      if (doc.acknowledgements.length === 0) {
        currentPage.drawText("None in selected date range.", { x: theme.margin + 8, y, font, size: 8.4, color: theme.muted });
        y -= 10;
      } else {
        for (const ack of doc.acknowledgements) {
          ensureRoom(24, "Policy document evidence (continued)");
          const who = ack.recipient_name || ack.recipient_email || "Unknown recipient";
          const when = ack.submitted_at ? new Date(ack.submitted_at).toUTCString() : "—";
          currentPage.drawText(`• ${who} | ${when} | ${ack.method}`, { x: theme.margin + 8, y, font, size: 8.4 });
          y -= 9;
          currentPage.drawText(
            `  Scroll ${ack.max_scroll_percent ?? 0}% | Active ${fmtDuration(ack.active_seconds)} | Page ${fmtDuration(ack.time_on_page_seconds)} | IP ${ack.ip ?? "—"}`,
            { x: theme.margin + 8, y, font, size: 8.1, color: theme.muted }
          );
          y -= 9;
        }
      }

      currentPage.drawText("Outstanding acknowledgements / pending submissions", {
        x: theme.margin,
        y,
        font: fontBold,
        size: 9,
      });
      y -= 10;
      if (doc.pending_submissions.length === 0) {
        currentPage.drawText("None recorded.", { x: theme.margin + 8, y, font, size: 8.4, color: theme.muted });
        y -= 12;
      } else {
        for (const pending of doc.pending_submissions) {
          ensureRoom(16, "Policy document evidence (continued)");
          const who = pending.recipient_name || pending.recipient_email || "Unknown recipient";
          const when = pending.submitted_at ? new Date(pending.submitted_at).toUTCString() : "—";
          currentPage.drawText(`• ${who} | ${when} | ${pending.method}`, {
            x: theme.margin + 8,
            y,
            font,
            size: 8.4,
          });
          y -= 9;
        }
        y -= 3;
      }
      y -= 8;
    }
  } else {
    y -= 16;
    currentPage.drawText("Acknowledgement evidence", { x: theme.margin, y, font: fontBold, size: 12 });
    y -= 14;
    const evidenceHeader = "Document | Recipient | How | When";
    currentPage.drawText(evidenceHeader, { x: theme.margin, y, font: fontBold, size: 9.5 });
    y -= 12;

    for (const row of input.evidenceRows) {
      if (y < 70) {
        currentPage = pdf.addPage([595.28, 841.89]);
        y = pageHeight - theme.margin;
        currentPage.drawText("Acknowledgement evidence (continued)", {
          x: theme.margin,
          y,
          font: fontBold,
          size: 12,
        });
        y -= 14;
        currentPage.drawText(evidenceHeader, { x: theme.margin, y, font: fontBold, size: 9.5 });
        y -= 12;
      }
      const when = row.submitted_at ? new Date(row.submitted_at).toUTCString() : "—";
      const recipient = row.recipient_name || row.recipient_email || "Unknown recipient";
      const how = `${row.method}; scroll ${row.max_scroll_percent ?? 0}%; active ${fmtDuration(row.active_seconds)}`;
      const line = `${row.document_title} (${row.document_public_id}) | ${recipient} | ${how} | ${when}`;
      currentPage.drawText(line.slice(0, 180), { x: theme.margin, y, font, size: 8.5 });
      y -= 10;
    }
  }

  if ((input.stackReceipts ?? []).length > 0) {
    if (y < 90) {
      currentPage = pdf.addPage([595.28, 841.89]);
      y = pageHeight - theme.margin;
    }
    y -= 16;
    currentPage.drawText("Stack acknowledgement receipts", { x: theme.margin, y, font: fontBold, size: 12 });
    y -= 14;
    for (const row of input.stackReceipts ?? []) {
      ensureRoom(22, "Stack acknowledgement receipts (continued)");
      currentPage.drawText(
        `${row.stack_title} | ${row.recipient_email} | ${new Date(row.completed_at).toUTCString()}`,
        { x: theme.margin, y, font, size: 8.6 }
      );
      y -= 9;
      currentPage.drawText(
        `Acknowledged ${row.acknowledged_documents}/${row.total_documents} documents`,
        { x: theme.margin + 8, y, font, size: 8.1, color: theme.muted }
      );
      y -= 9;
    }
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

  pdf.setTitle(
    input.mode === "compliance" ? "Compliance Analytics Report" : "Management Analytics Report"
  );
  pdf.setProducer("Receipt");
  pdf.setCreator("Receipt");
  return pdf.save();
}

export async function bytesToPdfDocument(bytes: Uint8Array): Promise<PDFDocument> {
  return PDFDocument.load(bytes);
}
