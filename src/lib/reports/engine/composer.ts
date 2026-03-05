import { degrees, rgb, type PDFImage } from "pdf-lib";
import { type ReportContext } from "@/lib/reports/engine/core";
import {
  drawKeyValueRow,
  drawMetricCards,
  drawParagraph,
  drawReportHeader,
  drawSectionHeading,
  finalizeFooters,
} from "@/lib/reports/engine/sections";
import { drawPresetTable, type ReportTablePreset, type TableSpec } from "@/lib/reports/engine/table";

export type ComposerHeaderArgs = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  rightMeta?: string;
  logo?: PDFImage | null;
  logoWidthPx?: number | null;
  brandName?: string;
  reportStyleVersion?: "v2" | "v3";
};

export type ComposerKeyValue = {
  key: string;
  value: string;
  valueFont?: "regular" | "bold" | "mono";
  labelWidth?: number;
};

export type ComposerFooterBranding = {
  poweredByLogo?: PDFImage | null;
};

export type WatermarkArgs = {
  enabled: boolean;
  receiptLogo?: PDFImage | null;
};

export function header(ctx: ReportContext, args: ComposerHeaderArgs) {
  drawReportHeader(ctx, args);
}

export function section(ctx: ReportContext, label: string, subtitle?: string) {
  drawSectionHeading(ctx, label, subtitle);
}

export function note(ctx: ReportContext, text: string, options?: { muted?: boolean; size?: number; maxWidth?: number }) {
  drawParagraph(ctx, text, options);
}

export function kpiRow(
  ctx: ReportContext,
  metrics: Array<{ label: string; value: string }>,
  options?: { columns?: number }
) {
  drawMetricCards(ctx, metrics, options);
}

export function keyValueList(ctx: ReportContext, rows: ComposerKeyValue[], options?: { gapAfter?: number }) {
  for (const row of rows) {
    drawKeyValueRow(ctx, row.key, row.value, {
      valueFont: row.valueFont,
      labelWidth: row.labelWidth,
    });
  }
  if (typeof options?.gapAfter === "number" && Number.isFinite(options.gapAfter)) {
    ctx.cursor.y -= options.gapAfter;
  }
}

export function metaGrid(ctx: ReportContext, rows: ComposerKeyValue[], options?: { gapAfter?: number }) {
  keyValueList(ctx, rows, options);
}

export function dataTable<T>(ctx: ReportContext, preset: ReportTablePreset, spec: TableSpec<T>) {
  drawPresetTable(ctx, preset, spec);
}

export function footer(ctx: ReportContext, label: string, branding?: ComposerFooterBranding) {
  finalizeFooters(ctx, label, branding);
}

export function watermark(ctx: ReportContext, args: WatermarkArgs) {
  if (!args.enabled) return;

  const text = "Generated record";
  const x = ctx.theme.pageWidth * 0.17;
  const y = ctx.theme.pageHeight * 0.34;
  const angle = degrees(ctx.theme.watermark.angleDeg);

  ctx.page.drawText(text, {
    x,
    y,
    size: ctx.theme.watermark.textSize,
    font: ctx.fonts.bold,
    color: rgb(0, 0, 0),
    opacity: ctx.theme.watermark.textOpacity,
    rotate: angle,
  });

  if (!args.receiptLogo) return;

  const targetHeight = 23;
  const scale = targetHeight / args.receiptLogo.height;
  const targetWidth = args.receiptLogo.width * scale;

  ctx.page.drawImage(args.receiptLogo, {
    x: x + ctx.fonts.bold.widthOfTextAtSize(text, ctx.theme.watermark.textSize) + 12,
    y: y + 7,
    width: targetWidth,
    height: targetHeight,
    opacity: ctx.theme.watermark.brandOpacity,
    rotate: angle,
  });
}
