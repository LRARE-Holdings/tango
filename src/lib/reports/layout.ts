import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from "pdf-lib";

export type ReportTheme = {
  margin: number;
  lineHeight: number;
  titleSize: number;
  bodySize: number;
  muted: ReturnType<typeof rgb>;
};

export async function createReportDocument() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([595.28, 841.89]); // A4
  const theme: ReportTheme = {
    margin: 44,
    lineHeight: 16,
    titleSize: 20,
    bodySize: 10.5,
    muted: rgb(0.42, 0.42, 0.42),
  };
  return { pdf, page, font, fontBold, theme };
}

export function drawHeader(args: {
  page: PDFPage;
  fontBold: PDFFont;
  title: string;
  subtitle: string;
  theme: ReportTheme;
}) {
  const { page, fontBold, title, subtitle, theme } = args;
  const topY = page.getHeight() - theme.margin;
  page.drawText(title, { x: theme.margin, y: topY, font: fontBold, size: theme.titleSize });
  page.drawText(subtitle, {
    x: theme.margin,
    y: topY - 18,
    font: fontBold,
    size: theme.bodySize,
    color: theme.muted,
  });
  return topY - 40;
}

export function drawKeyValueRow(args: {
  page: PDFPage;
  font: PDFFont;
  fontBold: PDFFont;
  y: number;
  key: string;
  value: string;
  theme: ReportTheme;
}) {
  const { page, font, fontBold, y, key, value, theme } = args;
  page.drawText(key, { x: theme.margin, y, font, size: theme.bodySize, color: theme.muted });
  page.drawText(value, { x: theme.margin + 220, y, font: fontBold, size: theme.bodySize });
  return y - theme.lineHeight;
}

