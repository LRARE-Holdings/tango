import { type PDFDocument } from "pdf-lib";

type ReportPdfMetadataInput = {
  title: string;
  subject: string;
  generatedAt: Date;
  keywords?: string[];
};

function sanitizeKeywords(input: string[] | undefined) {
  if (!input) return [];
  return input.map((value) => value.trim()).filter(Boolean);
}

export function applyReportPdfMetadata(pdf: PDFDocument, input: ReportPdfMetadataInput) {
  const generatedAt = Number.isFinite(input.generatedAt.getTime()) ? input.generatedAt : new Date();
  const keywords = sanitizeKeywords(input.keywords);

  pdf.setTitle(input.title, { showInWindowTitleBar: true });
  pdf.setSubject(input.subject);
  pdf.setAuthor("Receipt");
  pdf.setProducer("Receipt");
  pdf.setCreator("Receipt");
  pdf.setLanguage("en-US");
  if (keywords.length > 0) {
    pdf.setKeywords(keywords);
  }
  pdf.setCreationDate(generatedAt);
  pdf.setModificationDate(generatedAt);
}
