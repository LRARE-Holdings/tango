import { type PDFImage } from "pdf-lib";
import { type ReportContext } from "@/lib/reports/engine/core";
import { drawTextBlock, measureTextBlockHeight } from "@/lib/reports/engine/text";

type HeaderArgs = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  rightMeta?: string;
  logo?: PDFImage | null;
  brandName?: string;
};

export function drawReportHeader(ctx: ReportContext, args: HeaderArgs) {
  const bandHeight = 72;
  const top = ctx.theme.pageHeight;

  ctx.page.drawRectangle({
    x: 0,
    y: top - bandHeight,
    width: ctx.theme.pageWidth,
    height: bandHeight,
    color: ctx.theme.colors.panel,
  });

  const logoX = ctx.theme.marginLeft;
  const logoTop = top - 18;
  if (args.logo) {
    const targetH = 18;
    const scale = targetH / args.logo.height;
    const targetW = args.logo.width * scale;
    ctx.page.drawImage(args.logo, {
      x: logoX,
      y: logoTop - targetH,
      width: targetW,
      height: targetH,
    });
  } else if (args.brandName) {
    ctx.page.drawText(args.brandName, {
      x: logoX,
      y: logoTop - 12,
      font: ctx.fonts.bold,
      size: 12,
      color: ctx.theme.colors.text,
    });
  }

  if (args.rightMeta) {
    const width = ctx.fonts.regular.widthOfTextAtSize(args.rightMeta, ctx.theme.smallSize);
    ctx.page.drawText(args.rightMeta, {
      x: ctx.theme.pageWidth - ctx.theme.marginRight - width,
      y: top - 44,
      font: ctx.fonts.regular,
      size: ctx.theme.smallSize,
      color: ctx.theme.colors.muted,
    });
  }

  const titleStartY = top - bandHeight - 24;
  if (args.eyebrow) {
    ctx.page.drawText(args.eyebrow, {
      x: ctx.theme.marginLeft,
      y: titleStartY + 18,
      font: ctx.fonts.bold,
      size: ctx.theme.smallSize,
      color: ctx.theme.colors.accent,
    });
  }
  drawTextBlock(ctx, {
    text: args.title,
    x: ctx.theme.marginLeft,
    y: titleStartY,
    maxWidth: ctx.theme.pageWidth - ctx.theme.marginLeft - ctx.theme.marginRight,
    bold: true,
    size: ctx.theme.titleSize,
    lineHeight: ctx.theme.titleSize + 4,
  });

  let y = titleStartY - (ctx.theme.titleSize + 6);
  if (args.subtitle) {
    const h = measureTextBlockHeight(ctx, {
      text: args.subtitle,
      maxWidth: ctx.theme.pageWidth - ctx.theme.marginLeft - ctx.theme.marginRight,
      size: ctx.theme.bodySize,
      lineHeight: ctx.theme.bodySize + 3,
    });
    drawTextBlock(ctx, {
      text: args.subtitle,
      x: ctx.theme.marginLeft,
      y,
      maxWidth: ctx.theme.pageWidth - ctx.theme.marginLeft - ctx.theme.marginRight,
      size: ctx.theme.bodySize,
      lineHeight: ctx.theme.bodySize + 3,
      color: ctx.theme.colors.muted,
    });
    y -= h;
  }

  ctx.page.drawLine({
    start: { x: ctx.theme.marginLeft, y: y - 4 },
    end: { x: ctx.theme.pageWidth - ctx.theme.marginRight, y: y - 4 },
    thickness: 1,
    color: ctx.theme.colors.border,
  });
  ctx.cursor.y = y - 16;
}

export function drawSectionHeading(ctx: ReportContext, label: string, subtitle?: string) {
  const subtitleHeight = subtitle
    ? measureTextBlockHeight(ctx, {
        text: subtitle,
        maxWidth: ctx.cursor.maxX - ctx.cursor.minX,
        size: ctx.theme.smallSize,
        lineHeight: ctx.theme.smallSize + 3,
      })
    : 0;
  const needed = 18 + subtitleHeight + 10;
  ctx.ensureSpace(needed);

  drawTextBlock(ctx, {
    text: label,
    x: ctx.cursor.minX,
    y: ctx.cursor.y,
    maxWidth: ctx.cursor.maxX - ctx.cursor.minX,
    bold: true,
    size: ctx.theme.headingSize,
    lineHeight: ctx.theme.headingSize + 3,
  });
  ctx.cursor.y -= ctx.theme.headingSize + 6;

  if (subtitle) {
    const result = drawTextBlock(ctx, {
      text: subtitle,
      x: ctx.cursor.minX,
      y: ctx.cursor.y,
      maxWidth: ctx.cursor.maxX - ctx.cursor.minX,
      size: ctx.theme.smallSize,
      lineHeight: ctx.theme.smallSize + 3,
      color: ctx.theme.colors.muted,
    });
    ctx.cursor.y = result.nextY - 2;
  }

  ctx.page.drawLine({
    start: { x: ctx.cursor.minX, y: ctx.cursor.y },
    end: { x: ctx.cursor.maxX, y: ctx.cursor.y },
    thickness: 1,
    color: ctx.theme.colors.border,
  });
  ctx.cursor.y -= 10;
}

export function drawParagraph(ctx: ReportContext, text: string, options?: { muted?: boolean; size?: number; maxWidth?: number }) {
  const size = options?.size ?? ctx.theme.bodySize;
  const lineHeight = Math.max(size + 2, ctx.theme.lineHeight);
  const maxWidth = options?.maxWidth ?? ctx.cursor.maxX - ctx.cursor.minX;
  const needed = measureTextBlockHeight(ctx, {
    text,
    maxWidth,
    size,
    lineHeight,
  });
  ctx.ensureSpace(needed + 2);
  const result = drawTextBlock(ctx, {
    text,
    x: ctx.cursor.minX,
    y: ctx.cursor.y,
    maxWidth,
    size,
    lineHeight,
    color: options?.muted ? ctx.theme.colors.muted : ctx.theme.colors.text,
  });
  ctx.cursor.y = result.nextY - 2;
}

export function drawKeyValueRow(ctx: ReportContext, key: string, value: string) {
  const labelWidth = 190;
  const valueWidth = Math.max(120, ctx.cursor.maxX - ctx.cursor.minX - labelWidth);
  const valueHeight = measureTextBlockHeight(ctx, {
    text: value,
    maxWidth: valueWidth,
    size: ctx.theme.bodySize,
    lineHeight: ctx.theme.lineHeight,
  });
  const needed = Math.max(ctx.theme.lineHeight, valueHeight) + 4;
  ctx.ensureSpace(needed + 2);

  drawTextBlock(ctx, {
    text: key,
    x: ctx.cursor.minX,
    y: ctx.cursor.y,
    maxWidth: labelWidth - 8,
    size: ctx.theme.bodySize,
    bold: true,
    lineHeight: ctx.theme.lineHeight,
    color: ctx.theme.colors.muted,
  });

  const valueResult = drawTextBlock(ctx, {
    text: value,
    x: ctx.cursor.minX + labelWidth,
    y: ctx.cursor.y,
    maxWidth: valueWidth,
    size: ctx.theme.bodySize,
    bold: false,
    lineHeight: ctx.theme.lineHeight,
  });

  ctx.cursor.y = Math.min(ctx.cursor.y - needed, valueResult.nextY - 2);
}

export function drawMetricCards(
  ctx: ReportContext,
  metrics: Array<{ label: string; value: string }>,
  options?: { columns?: number }
) {
  const columns = Math.max(1, Math.min(options?.columns ?? metrics.length, metrics.length));
  const gap = ctx.theme.gutter;
  const width = (ctx.cursor.maxX - ctx.cursor.minX - gap * (columns - 1)) / columns;
  const cardHeight = 52;
  const rows = Math.ceil(metrics.length / columns);
  ctx.ensureSpace(rows * (cardHeight + gap));

  let index = 0;
  for (let row = 0; row < rows; row += 1) {
    const yTop = ctx.cursor.y - row * (cardHeight + gap);
    for (let col = 0; col < columns; col += 1) {
      if (index >= metrics.length) break;
      const item = metrics[index];
      const x = ctx.cursor.minX + col * (width + gap);
      ctx.page.drawRectangle({
        x,
        y: yTop - cardHeight,
        width,
        height: cardHeight,
        color: ctx.theme.colors.white,
        borderColor: ctx.theme.colors.border,
        borderWidth: 1,
      });
      ctx.page.drawText(item.label, {
        x: x + 10,
        y: yTop - 15,
        font: ctx.fonts.bold,
        size: ctx.theme.smallSize,
        color: ctx.theme.colors.muted,
      });
      drawTextBlock(ctx, {
        text: item.value,
        x: x + 10,
        y: yTop - 34,
        maxWidth: width - 20,
        bold: true,
        size: ctx.theme.bodySize + 1,
        lineHeight: ctx.theme.bodySize + 2,
      });
      index += 1;
    }
  }
  ctx.cursor.y -= rows * (cardHeight + gap);
}

export function finalizeFooters(ctx: ReportContext, label: string) {
  const pages = ctx.pdf.getPages();
  for (let i = 0; i < pages.length; i += 1) {
    const page = pages[i];
    const text = `Page ${i + 1} of ${pages.length}`;
    const width = ctx.fonts.regular.widthOfTextAtSize(text, ctx.theme.smallSize);
    page.drawLine({
      start: { x: ctx.theme.marginLeft, y: 34 },
      end: { x: ctx.theme.pageWidth - ctx.theme.marginRight, y: 34 },
      thickness: 1,
      color: ctx.theme.colors.border,
    });
    page.drawText(label, {
      x: ctx.theme.marginLeft,
      y: 21,
      size: ctx.theme.smallSize,
      font: ctx.fonts.regular,
      color: ctx.theme.colors.muted,
    });
    page.drawText(text, {
      x: ctx.theme.pageWidth - ctx.theme.marginRight - width,
      y: 21,
      size: ctx.theme.smallSize,
      font: ctx.fonts.regular,
      color: ctx.theme.colors.muted,
    });
  }
}
