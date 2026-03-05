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
  value: string,
  maxWidth: number,
  measure: (text: string) => number
) {
  const text = value.trim();
  if (!text) return "";
  if (measure(text) <= maxWidth) return text;
  if (maxWidth <= 4) return "";

  const ellipsis = "…";
  let current = text;
  while (current.length > 1 && measure(`${current}${ellipsis}`) > maxWidth) {
    current = current.slice(0, -1);
  }
  return current ? `${current}${ellipsis}` : ellipsis;
}

export function drawReportHeader(ctx: ReportContext, args: HeaderArgs) {
  const top = ctx.theme.pageHeight;
  const bandHeight = ctx.theme.headerBandHeight;
  const contentWidth = ctx.theme.pageWidth - ctx.theme.marginLeft - ctx.theme.marginRight;

  ctx.page.drawRectangle({
    x: 0,
    y: top - bandHeight,
    width: ctx.theme.pageWidth,
    height: bandHeight,
    color: ctx.theme.colors.panel,
  });

  const metaText = args.rightMeta?.trim() ?? "";
  const metaWidth = metaText
    ? ctx.fonts.regular.widthOfTextAtSize(metaText, ctx.theme.smallSize)
    : 0;
  const metaX = ctx.theme.pageWidth - ctx.theme.marginRight - metaWidth;

  const brandLeft = ctx.theme.marginLeft;
  const brandTop = top - 18;
  const brandMaxWidth = Math.max(24, metaX - brandLeft - 14);

  if (args.logo) {
    const targetHeight = 17.5;
    const scale = targetHeight / args.logo.height;
    const naturalWidth = args.logo.width * scale;
    const configuredWidth = Math.max(
      40,
      Math.min(190, Math.floor(Number(args.logoWidthPx ?? naturalWidth)))
    );
    const targetWidth = Math.max(24, Math.min(configuredWidth, naturalWidth, brandMaxWidth));
    const renderHeight = targetWidth * (args.logo.height / args.logo.width);
    ctx.page.drawImage(args.logo, {
      x: brandLeft,
      y: brandTop - renderHeight,
      width: targetWidth,
      height: renderHeight,
    });
  } else if (args.brandName && args.brandName.trim().toLowerCase() !== "receipt") {
    const brandText = truncateToWidth(
      args.brandName,
      brandMaxWidth,
      (text) => ctx.fonts.bold.widthOfTextAtSize(text, 11.8)
    );
    if (brandText) {
      ctx.page.drawText(brandText, {
        x: brandLeft,
        y: brandTop - 11.4,
        font: ctx.fonts.bold,
        size: 11.8,
        color: ctx.theme.colors.accent,
      });
    }
  }

  if (metaText) {
    const safeMeta = truncateToWidth(
      metaText,
      Math.max(24, ctx.theme.pageWidth - (ctx.theme.marginRight + ctx.theme.marginLeft + 130)),
      (text) => ctx.fonts.regular.widthOfTextAtSize(text, ctx.theme.smallSize)
    );
    if (safeMeta) {
      const safeWidth = ctx.fonts.regular.widthOfTextAtSize(safeMeta, ctx.theme.smallSize);
      ctx.page.drawText(safeMeta, {
        x: ctx.theme.pageWidth - ctx.theme.marginRight - safeWidth,
        y: top - 37,
        font: ctx.fonts.regular,
        size: ctx.theme.smallSize,
        color: ctx.theme.colors.subtle,
      });
    }
  }

  const headingStartY = top - bandHeight - (args.eyebrow ? 26 : 20);
  if (args.eyebrow) {
    drawTextBlock(ctx, {
      text: args.eyebrow,
      x: ctx.theme.marginLeft,
      y: headingStartY + 15,
      maxWidth: contentWidth,
      font: "bold",
      size: ctx.theme.smallSize,
      lineHeight: ctx.theme.smallSize + 2.2,
      color: ctx.theme.colors.subtle,
      maxLines: 1,
    });
  }

  const titleResult = drawTextBlock(ctx, {
    text: args.title,
    x: ctx.theme.marginLeft,
    y: headingStartY,
    maxWidth: contentWidth,
    font: "bold",
    size: ctx.theme.titleSize,
    lineHeight: ctx.theme.titleSize + 3.8,
  });

  let y = titleResult.nextY - 5;
  if (args.subtitle) {
    const subtitleResult = drawTextBlock(ctx, {
      text: args.subtitle,
      x: ctx.theme.marginLeft,
      y,
      maxWidth: contentWidth,
      size: ctx.theme.bodySize,
      lineHeight: ctx.theme.bodySize + 3,
      color: ctx.theme.colors.subtle,
    });
    y = subtitleResult.nextY;
  }

  const dividerY = y - 4;
  ctx.page.drawLine({
    start: { x: ctx.theme.marginLeft, y: dividerY },
    end: { x: ctx.theme.pageWidth - ctx.theme.marginRight, y: dividerY },
    thickness: 1,
    color: ctx.theme.colors.strongBorder,
  });

  ctx.cursor.y = dividerY - (ctx.theme.sectionGap + 6);
}

function ensureWidowOrphanHeadroom(ctx: ReportContext, lineHeight: number) {
  const minLines = Math.max(1, ctx.theme.widowOrphanMinLines);
  if (ctx.remainingHeight() < minLines * lineHeight) {
    ctx.addPage();
  }
}

export function drawSectionHeading(ctx: ReportContext, label: string, subtitle?: string) {
  const contentX = ctx.cursor.minX + 10;
  const contentWidth = ctx.cursor.maxX - contentX - 6;
  const headingLineHeight = ctx.theme.headingSize + 3;
  const subtitleLineHeight = ctx.theme.smallSize + 3;

  const labelHeight = measureTextBlockHeight(ctx, {
    text: label,
    maxWidth: contentWidth,
    size: ctx.theme.headingSize,
    lineHeight: headingLineHeight,
    font: "bold",
  });

  const subtitleHeight = subtitle
    ? measureTextBlockHeight(ctx, {
        text: subtitle,
        maxWidth: contentWidth,
        size: ctx.theme.smallSize,
        lineHeight: subtitleLineHeight,
      })
    : 0;

  const boxPaddingTop = 6;
  const boxPaddingBottom = 5;
  const boxHeight = labelHeight + subtitleHeight + boxPaddingTop + boxPaddingBottom + (subtitle ? 1 : 0);

  ensureWidowOrphanHeadroom(ctx, Math.max(headingLineHeight, subtitleLineHeight));
  ctx.ensureSpace(boxHeight + 6);

  const top = ctx.cursor.y;
  const bottom = top - boxHeight;

  ctx.page.drawRectangle({
    x: ctx.cursor.minX,
    y: bottom,
    width: ctx.cursor.maxX - ctx.cursor.minX,
    height: boxHeight,
    color: ctx.theme.colors.panelAlt,
  });

  ctx.page.drawRectangle({
    x: ctx.cursor.minX,
    y: bottom + 3,
    width: 2.6,
    height: Math.max(8, boxHeight - 6),
    color: ctx.theme.colors.accent,
  });

  const labelResult = drawTextBlock(ctx, {
    text: label,
    x: contentX,
    y: top - boxPaddingTop - ctx.theme.headingSize,
    maxWidth: contentWidth,
    font: "bold",
    size: ctx.theme.headingSize,
    lineHeight: headingLineHeight,
  });

  if (subtitle) {
    drawTextBlock(ctx, {
      text: subtitle,
      x: contentX,
      y: labelResult.nextY - 1,
      maxWidth: contentWidth,
      size: ctx.theme.smallSize,
      lineHeight: subtitleLineHeight,
      color: ctx.theme.colors.subtle,
    });
  }

  const dividerY = bottom;
  ctx.page.drawLine({
    start: { x: ctx.cursor.minX, y: dividerY },
    end: { x: ctx.cursor.maxX, y: dividerY },
    thickness: 1,
    color: ctx.theme.colors.border,
  });

  ctx.cursor.y = dividerY - ctx.theme.sectionGap;
}

export function drawParagraph(
  ctx: ReportContext,
  text: string,
  options?: { muted?: boolean; size?: number; maxWidth?: number }
) {
  const size = options?.size ?? ctx.theme.bodySize;
  const lineHeight = Math.max(size + 2.6, size * 1.24);
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
  const lineHeight = Math.max(ctx.theme.lineHeight, ctx.theme.bodySize + 3.2);

  const keyHeight = measureTextBlockHeight(ctx, {
    text: key,
    maxWidth: Math.max(70, labelWidth - 10),
    font: "bold",
    size: ctx.theme.bodySize,
    lineHeight,
  });

  const valueHeight = measureTextBlockHeight(ctx, {
    text: value,
    maxWidth: valueWidth,
    size: ctx.theme.bodySize,
    lineHeight,
    font: options?.valueFont ?? "regular",
  });

  const needed = Math.max(keyHeight, valueHeight) + 4;
  ensureWidowOrphanHeadroom(ctx, lineHeight);
  ctx.ensureSpace(needed + 2);

  const keyResult = drawTextBlock(ctx, {
    text: key,
    x: ctx.cursor.minX,
    y: ctx.cursor.y,
    maxWidth: labelWidth - 10,
    font: "bold",
    size: ctx.theme.bodySize,
    lineHeight,
    color: ctx.theme.colors.muted,
  });

  const valueResult = drawTextBlock(ctx, {
    text: value,
    x: ctx.cursor.minX + labelWidth,
    y: ctx.cursor.y,
    maxWidth: valueWidth,
    font: options?.valueFont ?? "regular",
    size: ctx.theme.bodySize,
    lineHeight,
  });

  ctx.cursor.y = Math.min(keyResult.nextY, valueResult.nextY) - 2;
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
  const labelLineHeight = ctx.theme.smallSize + 2.2;
  const valueSize = ctx.theme.bodySize + 0.8;
  const valueLineHeight = valueSize + 2.4;
  const padX = 10;
  const padY = 9;
  const contentWidth = Math.max(36, width - padX * 2);

  const measured = metrics.map((metric) => {
    const labelHeight = measureTextBlockHeight(ctx, {
      text: metric.label,
      maxWidth: contentWidth,
      size: ctx.theme.smallSize,
      lineHeight: labelLineHeight,
      font: "bold",
      maxLines: 2,
    });
    const valueHeight = measureTextBlockHeight(ctx, {
      text: metric.value,
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
        .map((item) => Math.ceil(item.labelHeight + item.valueHeight + padY * 2 + 5))
    );
    rowHeights.push(rowHeight);
  }

  const totalHeight = rowHeights.reduce((sum, h) => sum + h, 0) + gap * (rows - 1);
  ctx.ensureSpace(totalHeight + 2);

  let index = 0;
  let rowTop = ctx.cursor.y;
  for (let row = 0; row < rows; row += 1) {
    const rowHeight = rowHeights[row];
    for (let col = 0; col < columns; col += 1) {
      if (index >= metrics.length) break;
      const metric = metrics[index];
      const x = ctx.cursor.minX + col * (width + gap);

      ctx.page.drawRectangle({
        x,
        y: rowTop - rowHeight,
        width,
        height: rowHeight,
        color: ctx.theme.colors.white,
        borderColor: ctx.theme.colors.strongBorder,
        borderWidth: 1,
      });
      ctx.page.drawRectangle({
        x,
        y: rowTop - 2.2,
        width,
        height: 2.2,
        color: ctx.theme.colors.accent,
      });

      const labelResult = drawTextBlock(ctx, {
        text: metric.label,
        x: x + padX,
        y: rowTop - padY - ctx.theme.smallSize,
        maxWidth: contentWidth,
        font: "bold",
        size: ctx.theme.smallSize,
        lineHeight: labelLineHeight,
        maxLines: 2,
        color: ctx.theme.colors.subtle,
      });

      drawTextBlock(ctx, {
        text: metric.value,
        x: x + padX,
        y: labelResult.nextY - 4,
        maxWidth: contentWidth,
        font: "bold",
        size: valueSize,
        lineHeight: valueLineHeight,
        maxLines: 3,
      });

      index += 1;
    }
    rowTop -= rowHeight + gap;
  }

  ctx.cursor.y -= totalHeight;
}

export function finalizeFooters(ctx: ReportContext, label: string, branding?: FooterBrandingArgs) {
  const footerBandY = 12;
  const footerBandHeight = ctx.theme.footerBandHeight;
  const textY = footerBandY + Math.max(3.4, footerBandHeight - (ctx.theme.smallSize + 4));
  const footerTopY = footerBandY + footerBandHeight;
  const safeLabel = label.trim();
  const pages = ctx.pdf.getPages();

  for (let i = 0; i < pages.length; i += 1) {
    const page = pages[i];
    const pageCounter = `Page ${i + 1} of ${pages.length}`;
    const pageCounterWidth = ctx.fonts.regular.widthOfTextAtSize(pageCounter, ctx.theme.smallSize);
    const pageCounterX = ctx.theme.pageWidth - ctx.theme.marginRight - pageCounterWidth;

    const logoHeight = 8;
    const logoScale = branding?.poweredByLogo ? logoHeight / branding.poweredByLogo.height : 0;
    const logoWidth = branding?.poweredByLogo ? branding.poweredByLogo.width * logoScale : 0;
    const logoX = branding?.poweredByLogo ? (ctx.theme.pageWidth - logoWidth) / 2 : 0;

    const leftLimitX = branding?.poweredByLogo ? logoX - 12 : ctx.theme.pageWidth / 2;
    const labelMaxX = Math.max(ctx.theme.marginLeft, Math.min(leftLimitX, pageCounterX - 12));
    const labelMaxWidth = Math.max(24, labelMaxX - ctx.theme.marginLeft);
    const labelText = truncateToWidth(
      safeLabel,
      labelMaxWidth,
      (text) => ctx.fonts.regular.widthOfTextAtSize(text, ctx.theme.smallSize)
    );

    page.drawRectangle({
      x: 0,
      y: footerBandY,
      width: ctx.theme.pageWidth,
      height: footerBandHeight,
      color: ctx.theme.colors.footerPanel,
    });
    page.drawLine({
      start: { x: ctx.theme.marginLeft, y: footerTopY },
      end: { x: ctx.theme.pageWidth - ctx.theme.marginRight, y: footerTopY },
      thickness: 1,
      color: ctx.theme.colors.border,
    });

    if (labelText) {
      page.drawText(labelText, {
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
        opacity: 0.78,
      });
    }

    page.drawText(pageCounter, {
      x: pageCounterX,
      y: textY,
      size: ctx.theme.smallSize,
      font: ctx.fonts.regular,
      color: ctx.theme.colors.subtle,
    });
  }
}
