import { type PDFImage } from "pdf-lib";
import { type ReportContext } from "@/lib/reports/engine/core";
import { drawTextBlock, measureTextBlockHeight, type ReportFontFamily } from "@/lib/reports/engine/text";

type HeaderArgs = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  rightMeta?: string;
  logo?: PDFImage | null;
  logoWidthPx?: number | null;
  brandName?: string;
  reportStyleVersion?: "v2" | "v3";
};

type FooterBrandingArgs = {
  poweredByBrand?: string;
  poweredByLogo?: PDFImage | null;
};

export function drawReportHeader(ctx: ReportContext, args: HeaderArgs) {
  const bandHeight = ctx.theme.headerBandHeight;
  const top = ctx.theme.pageHeight;
  const contentWidth = ctx.theme.pageWidth - ctx.theme.marginLeft - ctx.theme.marginRight;
  const titleLineHeight = ctx.theme.titleSize + 4;
  const subtitleLineHeight = ctx.theme.bodySize + 3.2;

  ctx.page.drawRectangle({
    x: 0,
    y: top - bandHeight,
    width: ctx.theme.pageWidth,
    height: bandHeight,
    color: ctx.theme.colors.panel,
  });
  ctx.page.drawRectangle({
    x: 0,
    y: top - bandHeight,
    width: 7,
    height: bandHeight,
    color: ctx.theme.colors.accent,
  });

  const logoX = ctx.theme.marginLeft;
  const logoTop = top - 21;
  if (args.logo) {
    const targetH = 19;
    const byHeightScale = targetH / args.logo.height;
    const widthByHeight = args.logo.width * byHeightScale;
    const preferredWidth = Math.max(48, Math.min(200, Math.floor(Number(args.logoWidthPx ?? widthByHeight))));
    const targetW = Math.min(widthByHeight, preferredWidth);
    const targetRenderH = targetW * (args.logo.height / args.logo.width);
    ctx.page.drawImage(args.logo, {
      x: logoX,
      y: logoTop - targetRenderH,
      width: targetW,
      height: targetRenderH,
    });
  } else if (args.brandName) {
    ctx.page.drawText(args.brandName, {
      x: logoX,
      y: logoTop - 12.5,
      font: ctx.fonts.bold,
      size: 12.2,
      color: ctx.theme.colors.accent,
    });
  }

  if (args.rightMeta) {
    const width = ctx.fonts.regular.widthOfTextAtSize(args.rightMeta, ctx.theme.smallSize);
    ctx.page.drawText(args.rightMeta, {
      x: ctx.theme.pageWidth - ctx.theme.marginRight - width,
      y: top - 41,
      font: ctx.fonts.regular,
      size: ctx.theme.smallSize,
      color: ctx.theme.colors.subtle,
    });
  }

  const titleStartY = top - bandHeight - (args.eyebrow ? 28 : 20);
  if (args.eyebrow) {
    ctx.page.drawText(args.eyebrow, {
      x: ctx.theme.marginLeft,
      y: titleStartY + 16,
      font: ctx.fonts.bold,
      size: ctx.theme.smallSize,
      color: ctx.theme.colors.accent,
    });
  }
  const titleResult = drawTextBlock(ctx, {
    text: args.title,
    x: ctx.theme.marginLeft,
    y: titleStartY,
    maxWidth: contentWidth,
    bold: true,
    size: ctx.theme.titleSize,
    lineHeight: titleLineHeight,
  });

  let y = titleResult.nextY - 7;
  if (args.subtitle) {
    const subtitleResult = drawTextBlock(ctx, {
      text: args.subtitle,
      x: ctx.theme.marginLeft,
      y,
      maxWidth: contentWidth,
      size: ctx.theme.bodySize,
      lineHeight: subtitleLineHeight,
      color: ctx.theme.colors.subtle,
    });
    y = subtitleResult.nextY;
  }

  ctx.page.drawLine({
    start: { x: ctx.theme.marginLeft, y: y - 4 },
    end: { x: ctx.theme.pageWidth - ctx.theme.marginRight, y: y - 4 },
    thickness: 1,
    color: ctx.theme.colors.strongBorder,
  });
  ctx.cursor.y = y - (ctx.theme.sectionGap + 9);
}

function ensureWidowOrphanHeadroom(ctx: ReportContext, lineHeight: number) {
  const minimum = Math.max(1, ctx.theme.widowOrphanMinLines) * lineHeight;
  if (ctx.remainingHeight() < minimum) {
    ctx.addPage();
  }
}

export function drawSectionHeading(ctx: ReportContext, label: string, subtitle?: string) {
  const labelX = ctx.cursor.minX + 8;
  const textWidth = ctx.cursor.maxX - labelX;
  const headingLineHeight = ctx.theme.headingSize + 3.3;
  const subtitleLineHeight = ctx.theme.smallSize + 3.2;
  const labelHeight = measureTextBlockHeight(ctx, {
    text: label,
    maxWidth: textWidth,
    size: ctx.theme.headingSize,
    lineHeight: headingLineHeight,
    font: "bold",
  });
  const subtitleHeight = subtitle
    ? measureTextBlockHeight(ctx, {
        text: subtitle,
        maxWidth: textWidth,
        size: ctx.theme.smallSize,
        lineHeight: subtitleLineHeight,
      })
    : 0;
  const needed = Math.max(13.5, labelHeight) + subtitleHeight + 16;
  ensureWidowOrphanHeadroom(ctx, Math.max(headingLineHeight, subtitleLineHeight));
  ctx.ensureSpace(needed);

  const accentHeight = Math.max(13.5, labelHeight);
  ctx.page.drawRectangle({
    x: ctx.cursor.minX,
    y: ctx.cursor.y - accentHeight + 2,
    width: 3.2,
    height: accentHeight,
    color: ctx.theme.colors.accent,
  });

  const labelResult = drawTextBlock(ctx, {
    text: label,
    x: labelX,
    y: ctx.cursor.y,
    maxWidth: textWidth,
    font: "bold",
    size: ctx.theme.headingSize,
    lineHeight: headingLineHeight,
  });
  ctx.cursor.y = labelResult.nextY - 2;

  if (subtitle) {
    const result = drawTextBlock(ctx, {
      text: subtitle,
      x: labelX,
      y: ctx.cursor.y,
      maxWidth: textWidth,
      size: ctx.theme.smallSize,
      lineHeight: subtitleLineHeight,
      color: ctx.theme.colors.subtle,
    });
    ctx.cursor.y = result.nextY - 2;
  }

  ctx.page.drawLine({
    start: { x: ctx.cursor.minX, y: ctx.cursor.y },
    end: { x: ctx.cursor.maxX, y: ctx.cursor.y },
    thickness: 1,
    color: ctx.theme.colors.border,
  });
  ctx.cursor.y -= ctx.theme.sectionGap + 2;
}

export function drawParagraph(ctx: ReportContext, text: string, options?: { muted?: boolean; size?: number; maxWidth?: number }) {
  const size = options?.size ?? ctx.theme.bodySize;
  const lineHeight = Math.max(size + 2.8, size * 1.26);
  const maxWidth = options?.maxWidth ?? ctx.cursor.maxX - ctx.cursor.minX;
  const needed = measureTextBlockHeight(ctx, {
    text,
    maxWidth,
    size,
    lineHeight,
  });
  ensureWidowOrphanHeadroom(ctx, lineHeight);
  ctx.ensureSpace(needed + 2);
  const result = drawTextBlock(ctx, {
    text,
    x: ctx.cursor.minX,
    y: ctx.cursor.y,
    maxWidth,
    size,
    lineHeight,
    color: options?.muted ? ctx.theme.colors.subtle : ctx.theme.colors.text,
  });
  ctx.cursor.y = result.nextY - 2;
}

export function drawKeyValueRow(
  ctx: ReportContext,
  key: string,
  value: string,
  options?: { valueFont?: ReportFontFamily; labelWidth?: number }
) {
  const labelWidth = options?.labelWidth ?? ctx.theme.keyValueLabelWidth;
  const valueWidth = Math.max(120, ctx.cursor.maxX - ctx.cursor.minX - labelWidth);
  const lineHeight = Math.max(ctx.theme.lineHeight, ctx.theme.bodySize + 3.4);
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
  const needed = Math.max(labelHeight, valueHeight) + 4;
  ensureWidowOrphanHeadroom(ctx, lineHeight);
  ctx.ensureSpace(needed + 2);

  const labelResult = drawTextBlock(ctx, {
    text: key,
    x: ctx.cursor.minX,
    y: ctx.cursor.y,
    maxWidth: labelWidth - 8,
    size: ctx.theme.bodySize,
    font: "bold",
    lineHeight,
    color: ctx.theme.colors.muted,
  });

  const valueResult = drawTextBlock(ctx, {
    text: value,
    x: ctx.cursor.minX + labelWidth,
    y: ctx.cursor.y,
    maxWidth: valueWidth,
    size: ctx.theme.bodySize,
    font: options?.valueFont ?? "regular",
    lineHeight,
  });

  ctx.cursor.y = Math.min(labelResult.nextY, valueResult.nextY) - 2;
}

export function drawMetricCards(
  ctx: ReportContext,
  metrics: Array<{ label: string; value: string }>,
  options?: { columns?: number }
) {
  if (metrics.length === 0) return;
  const columns = Math.max(1, Math.min(options?.columns ?? metrics.length, metrics.length));
  const gap = ctx.theme.gutter;
  const width = (ctx.cursor.maxX - ctx.cursor.minX - gap * (columns - 1)) / columns;
  const cardPadX = 10;
  const cardPadY = 10;
  const labelLineHeight = ctx.theme.smallSize + 2.4;
  const valueSize = ctx.theme.bodySize + 1;
  const valueLineHeight = valueSize + 2.4;
  const contentWidth = Math.max(36, width - cardPadX * 2);
  const measured = metrics.map((item) => {
    const labelHeight = measureTextBlockHeight(ctx, {
      text: item.label,
      maxWidth: contentWidth,
      size: ctx.theme.smallSize,
      lineHeight: labelLineHeight,
      font: "bold",
      maxLines: 2,
    });
    const valueHeight = measureTextBlockHeight(ctx, {
      text: item.value,
      maxWidth: contentWidth,
      size: valueSize,
      lineHeight: valueLineHeight,
      font: "bold",
      maxLines: 3,
    });
    return { labelHeight, valueHeight };
  });
  const rows = Math.ceil(metrics.length / columns);
  const rowHeights: number[] = [];
  for (let row = 0; row < rows; row += 1) {
    const start = row * columns;
    const end = Math.min(start + columns, metrics.length);
    const rowHeight = Math.max(
      ctx.theme.metricCardMinHeight,
      ...measured
        .slice(start, end)
        .map((item) => Math.ceil(item.labelHeight + item.valueHeight + cardPadY * 2 + 7))
    );
    rowHeights.push(rowHeight);
  }
  const totalHeight = rowHeights.reduce((sum, rowHeight) => sum + rowHeight, 0) + gap * (rows - 1);
  ctx.ensureSpace(totalHeight + 2);

  let index = 0;
  let yTop = ctx.cursor.y;
  for (let row = 0; row < rows; row += 1) {
    const cardHeight = rowHeights[row];
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
        borderColor: ctx.theme.colors.strongBorder,
        borderWidth: 1,
      });
      ctx.page.drawRectangle({
        x,
        y: yTop - 2.4,
        width,
        height: 2.4,
        color: ctx.theme.colors.accent,
      });
      const labelResult = drawTextBlock(ctx, {
        text: item.label,
        x: x + cardPadX,
        y: yTop - cardPadY - ctx.theme.smallSize,
        maxWidth: contentWidth,
        font: "bold",
        size: ctx.theme.smallSize,
        lineHeight: labelLineHeight,
        color: ctx.theme.colors.subtle,
        maxLines: 2,
      });
      drawTextBlock(ctx, {
        text: item.value,
        x: x + cardPadX,
        y: labelResult.nextY - 6,
        maxWidth: contentWidth,
        font: "bold",
        size: valueSize,
        lineHeight: valueLineHeight,
        maxLines: 3,
      });
      index += 1;
    }
    yTop -= cardHeight + gap;
  }
  ctx.cursor.y -= totalHeight;
}

export function finalizeFooters(ctx: ReportContext, label: string, branding?: FooterBrandingArgs) {
  const poweredByBrand = (branding?.poweredByBrand ?? "Receipt").trim() || "Receipt";
  const bandY = 12;
  const bandHeight = ctx.theme.footerBandHeight;
  const textY = bandY + Math.max(3.5, bandHeight - (ctx.theme.smallSize + 4.2));
  const topY = bandY + bandHeight;
  const pages = ctx.pdf.getPages();
  for (let i = 0; i < pages.length; i += 1) {
    const page = pages[i];
    const text = `Page ${i + 1} of ${pages.length}`;
    const width = ctx.fonts.regular.widthOfTextAtSize(text, ctx.theme.smallSize);
    page.drawRectangle({
      x: 0,
      y: bandY,
      width: ctx.theme.pageWidth,
      height: bandHeight,
      color: ctx.theme.colors.footerPanel,
    });
    page.drawLine({
      start: { x: ctx.theme.marginLeft, y: topY },
      end: { x: ctx.theme.pageWidth - ctx.theme.marginRight, y: topY },
      thickness: 1,
      color: ctx.theme.colors.border,
    });
    page.drawText(label, {
      x: ctx.theme.marginLeft,
      y: textY,
      size: ctx.theme.smallSize,
      font: ctx.fonts.regular,
      color: ctx.theme.colors.subtle,
    });

    const poweredByPrefix = "Powered by";
    const poweredByGap = 4;
    const poweredByPrefixWidth = ctx.fonts.regular.widthOfTextAtSize(poweredByPrefix, ctx.theme.smallSize);
    const poweredByBrandWidth = ctx.fonts.bold.widthOfTextAtSize(poweredByBrand, ctx.theme.smallSize);
    const logoHeight = 8;
    const logoScale = branding?.poweredByLogo ? logoHeight / branding.poweredByLogo.height : 0;
    const logoWidth = branding?.poweredByLogo ? branding.poweredByLogo.width * logoScale : 0;
    const groupWidth = poweredByPrefixWidth + poweredByGap + poweredByBrandWidth + (branding?.poweredByLogo ? poweredByGap + logoWidth : 0);
    const groupX = (ctx.theme.pageWidth - groupWidth) / 2;

    page.drawText(poweredByPrefix, {
      x: groupX,
      y: textY,
      size: ctx.theme.smallSize,
      font: ctx.fonts.regular,
      color: ctx.theme.colors.subtle,
    });

    const brandX = groupX + poweredByPrefixWidth + poweredByGap;
    page.drawText(poweredByBrand, {
      x: brandX,
      y: textY,
      size: ctx.theme.smallSize,
      font: ctx.fonts.bold,
      color: ctx.theme.colors.subtle,
    });

    if (branding?.poweredByLogo) {
      page.drawImage(branding.poweredByLogo, {
        x: brandX + poweredByBrandWidth + poweredByGap,
        y: textY - 1.1,
        width: logoWidth,
        height: logoHeight,
        opacity: 0.75,
      });
    }

    page.drawText(text, {
      x: ctx.theme.pageWidth - ctx.theme.marginRight - width,
      y: textY,
      size: ctx.theme.smallSize,
      font: ctx.fonts.regular,
      color: ctx.theme.colors.subtle,
    });
  }
}
