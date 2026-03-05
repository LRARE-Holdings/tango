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
  poweredByLogo?: PDFImage | null;
};

function truncateToWidth(
  text: string,
  maxWidth: number,
  measure: (value: string) => number
) {
  const source = text.trim();
  if (!source) return "";
  if (measure(source) <= maxWidth) return source;
  if (maxWidth <= 4) return "";

  const ellipsis = "…";
  let trimmed = source;
  while (trimmed.length > 1 && measure(`${trimmed}${ellipsis}`) > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return trimmed ? `${trimmed}${ellipsis}` : ellipsis;
}

export function drawReportHeader(ctx: ReportContext, args: HeaderArgs) {
  const bandHeight = ctx.theme.headerBandHeight;
  const top = ctx.theme.pageHeight;
  const contentWidth = ctx.theme.pageWidth - ctx.theme.marginLeft - ctx.theme.marginRight;
  const titleLineHeight = ctx.theme.titleSize + 4;
  const subtitleLineHeight = ctx.theme.bodySize + 3.2;
  const rightMeta = args.rightMeta?.trim() ?? "";
  const rightMetaWidth = rightMeta
    ? ctx.fonts.regular.widthOfTextAtSize(rightMeta, ctx.theme.smallSize)
    : 0;
  const rightMetaGap = rightMeta ? 16 : 0;
  const rightMetaX = ctx.theme.pageWidth - ctx.theme.marginRight - rightMetaWidth;

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
  const maxHeaderBrandWidth = Math.max(24, rightMetaX - rightMetaGap - logoX);
  if (args.logo) {
    const targetH = 19;
    const byHeightScale = targetH / args.logo.height;
    const widthByHeight = args.logo.width * byHeightScale;
    const preferredWidth = Math.max(48, Math.min(200, Math.floor(Number(args.logoWidthPx ?? widthByHeight))));
    const targetW = Math.max(24, Math.min(widthByHeight, preferredWidth, maxHeaderBrandWidth));
    const targetRenderH = targetW * (args.logo.height / args.logo.width);
    ctx.page.drawImage(args.logo, {
      x: logoX,
      y: logoTop - targetRenderH,
      width: targetW,
      height: targetRenderH,
    });
  } else if (args.brandName && args.brandName.trim().toLowerCase() !== "receipt") {
    const brandText = truncateToWidth(
      args.brandName.trim(),
      maxHeaderBrandWidth,
      (value) => ctx.fonts.bold.widthOfTextAtSize(value, 12.2)
    );
    if (brandText) {
      ctx.page.drawText(brandText, {
        x: logoX,
        y: logoTop - 12.5,
        font: ctx.fonts.bold,
        size: 12.2,
        color: ctx.theme.colors.accent,
      });
    }
  }

  if (rightMeta) {
    const metaText = truncateToWidth(
      rightMeta,
      Math.max(24, ctx.theme.pageWidth - ctx.theme.marginRight - (logoX + 120)),
      (value) => ctx.fonts.regular.widthOfTextAtSize(value, ctx.theme.smallSize)
    );
    if (metaText) {
      const width = ctx.fonts.regular.widthOfTextAtSize(metaText, ctx.theme.smallSize);
      ctx.page.drawText(metaText, {
        x: ctx.theme.pageWidth - ctx.theme.marginRight - width,
        y: top - 41,
        font: ctx.fonts.regular,
        size: ctx.theme.smallSize,
        color: ctx.theme.colors.subtle,
      });
    }
  }

  const titleStartY = top - bandHeight - (args.eyebrow ? 28 : 20);
  if (args.eyebrow) {
    ctx.page.drawText(args.eyebrow, {
      x: logoX,
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

  const headingStartY = ctx.cursor.y;
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

  const headingEndY = ctx.cursor.y;
  const headingGlyphHeight = ctx.fonts.bold.heightAtSize(ctx.theme.headingSize, { descender: false });
  const accentTop = headingStartY + Math.max(4, headingGlyphHeight * 0.85);
  const accentBottom = headingEndY + Math.max(1.4, ctx.theme.baseline * 0.35);
  const accentHeight = Math.max(13.5, accentTop - accentBottom);
  ctx.page.drawRectangle({
    x: ctx.cursor.minX,
    y: accentBottom,
    width: 3.2,
    height: accentHeight,
    color: ctx.theme.colors.accent,
  });

  const dividerY = ctx.cursor.y - 2;
  ctx.page.drawLine({
    start: { x: ctx.cursor.minX, y: dividerY },
    end: { x: ctx.cursor.maxX, y: dividerY },
    thickness: 1,
    color: ctx.theme.colors.border,
  });
  ctx.cursor.y = dividerY - (ctx.theme.sectionGap + 2);
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
  const bandY = 12;
  const bandHeight = ctx.theme.footerBandHeight;
  const textY = bandY + Math.max(3.5, bandHeight - (ctx.theme.smallSize + 4.2));
  const topY = bandY + bandHeight;
  const footerLabel = label.trim();
  const pages = ctx.pdf.getPages();
  for (let i = 0; i < pages.length; i += 1) {
    const page = pages[i];
    const pageText = `Page ${i + 1} of ${pages.length}`;
    const pageTextWidth = ctx.fonts.regular.widthOfTextAtSize(pageText, ctx.theme.smallSize);
    const pageTextX = ctx.theme.pageWidth - ctx.theme.marginRight - pageTextWidth;
    const logoHeight = 8;
    const logoScale = branding?.poweredByLogo ? logoHeight / branding.poweredByLogo.height : 0;
    const logoWidth = branding?.poweredByLogo ? branding.poweredByLogo.width * logoScale : 0;
    const logoX = branding?.poweredByLogo ? (ctx.theme.pageWidth - logoWidth) / 2 : 0;
    const centerLeftBound = branding?.poweredByLogo ? logoX - 12 : ctx.theme.pageWidth / 2;
    const leftMaxX = Math.max(ctx.theme.marginLeft, Math.min(centerLeftBound, pageTextX - 12));
    const leftMaxWidth = Math.max(24, leftMaxX - ctx.theme.marginLeft);
    const safeLabel = truncateToWidth(
      footerLabel,
      leftMaxWidth,
      (value) => ctx.fonts.regular.widthOfTextAtSize(value, ctx.theme.smallSize)
    );

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
    if (safeLabel) {
      page.drawText(safeLabel, {
        x: ctx.theme.marginLeft,
        y: textY,
        size: ctx.theme.smallSize,
        font: ctx.fonts.regular,
        color: ctx.theme.colors.subtle,
      });
    }

    if (branding?.poweredByLogo) {
      page.drawImage(branding.poweredByLogo, {
        x: logoX,
        y: textY - 1.1,
        width: logoWidth,
        height: logoHeight,
        opacity: 0.75,
      });
    }

    page.drawText(pageText, {
      x: pageTextX,
      y: textY,
      size: ctx.theme.smallSize,
      font: ctx.fonts.regular,
      color: ctx.theme.colors.subtle,
    });
  }
}
