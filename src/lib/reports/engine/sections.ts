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
  reportStyleVersion?: "v2";
};

type FooterBrandingArgs = {
  poweredByBrand?: string;
  poweredByLogo?: PDFImage | null;
};

export function drawReportHeader(ctx: ReportContext, args: HeaderArgs) {
  const bandHeight = 84;
  const top = ctx.theme.pageHeight;

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
      y: top - 43,
      font: ctx.fonts.regular,
      size: ctx.theme.smallSize,
      color: ctx.theme.colors.subtle,
    });
  }

  const titleStartY = top - bandHeight - 26;
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

  let y = titleStartY - (ctx.theme.titleSize + 7);
  if (args.subtitle) {
    const h = measureTextBlockHeight(ctx, {
      text: args.subtitle,
      maxWidth: ctx.theme.pageWidth - ctx.theme.marginLeft - ctx.theme.marginRight,
      size: ctx.theme.bodySize,
      lineHeight: ctx.theme.bodySize + 3.2,
    });
    drawTextBlock(ctx, {
      text: args.subtitle,
      x: ctx.theme.marginLeft,
      y,
      maxWidth: ctx.theme.pageWidth - ctx.theme.marginLeft - ctx.theme.marginRight,
      size: ctx.theme.bodySize,
      lineHeight: ctx.theme.bodySize + 3.2,
      color: ctx.theme.colors.subtle,
    });
    y -= h;
  }

  ctx.page.drawLine({
    start: { x: ctx.theme.marginLeft, y: y - 4 },
    end: { x: ctx.theme.pageWidth - ctx.theme.marginRight, y: y - 4 },
    thickness: 1,
    color: ctx.theme.colors.strongBorder,
  });
  ctx.cursor.y = y - 18;
}

export function drawSectionHeading(ctx: ReportContext, label: string, subtitle?: string) {
  const subtitleHeight = subtitle
    ? measureTextBlockHeight(ctx, {
        text: subtitle,
        maxWidth: ctx.cursor.maxX - ctx.cursor.minX,
        size: ctx.theme.smallSize,
        lineHeight: ctx.theme.smallSize + 3.2,
      })
    : 0;
  const needed = 20 + subtitleHeight + 12;
  ctx.ensureSpace(needed);

  ctx.page.drawRectangle({
    x: ctx.cursor.minX,
    y: ctx.cursor.y - 13.5,
    width: 3.2,
    height: 13.5,
    color: ctx.theme.colors.accent,
  });

  drawTextBlock(ctx, {
    text: label,
    x: ctx.cursor.minX + 8,
    y: ctx.cursor.y,
    maxWidth: ctx.cursor.maxX - ctx.cursor.minX,
    font: "bold",
    size: ctx.theme.headingSize,
    lineHeight: ctx.theme.headingSize + 3.3,
  });
  ctx.cursor.y -= ctx.theme.headingSize + 6.4;

  if (subtitle) {
    const result = drawTextBlock(ctx, {
      text: subtitle,
      x: ctx.cursor.minX + 8,
      y: ctx.cursor.y,
      maxWidth: ctx.cursor.maxX - ctx.cursor.minX,
      size: ctx.theme.smallSize,
      lineHeight: ctx.theme.smallSize + 3.2,
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
  ctx.cursor.y -= 11;
}

export function drawParagraph(ctx: ReportContext, text: string, options?: { muted?: boolean; size?: number; maxWidth?: number }) {
  const size = options?.size ?? ctx.theme.bodySize;
  const lineHeight = Math.max(size + 2.2, ctx.theme.lineHeight);
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
  const labelWidth = options?.labelWidth ?? 180;
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
    font: "bold",
    lineHeight: ctx.theme.lineHeight,
    color: ctx.theme.colors.muted,
  });

  const valueResult = drawTextBlock(ctx, {
    text: value,
    x: ctx.cursor.minX + labelWidth,
    y: ctx.cursor.y,
    maxWidth: valueWidth,
    size: ctx.theme.bodySize,
    font: options?.valueFont ?? "regular",
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
  const cardHeight = 56;
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
      ctx.page.drawText(item.label, {
        x: x + 10,
        y: yTop - 18,
        font: ctx.fonts.bold,
        size: ctx.theme.smallSize,
        color: ctx.theme.colors.subtle,
      });
      drawTextBlock(ctx, {
        text: item.value,
        x: x + 10,
        y: yTop - 37,
        maxWidth: width - 20,
        font: "bold",
        size: ctx.theme.bodySize + 1,
        lineHeight: ctx.theme.bodySize + 2.2,
        maxLines: 2,
      });
      index += 1;
    }
  }
  ctx.cursor.y -= rows * (cardHeight + gap);
}

export function finalizeFooters(ctx: ReportContext, label: string, branding?: FooterBrandingArgs) {
  const poweredByBrand = (branding?.poweredByBrand ?? "Receipt").trim() || "Receipt";
  const pages = ctx.pdf.getPages();
  for (let i = 0; i < pages.length; i += 1) {
    const page = pages[i];
    const text = `Page ${i + 1} of ${pages.length}`;
    const width = ctx.fonts.regular.widthOfTextAtSize(text, ctx.theme.smallSize);
    page.drawRectangle({
      x: 0,
      y: 12,
      width: ctx.theme.pageWidth,
      height: 24,
      color: ctx.theme.colors.footerPanel,
    });
    page.drawLine({
      start: { x: ctx.theme.marginLeft, y: 36 },
      end: { x: ctx.theme.pageWidth - ctx.theme.marginRight, y: 36 },
      thickness: 1,
      color: ctx.theme.colors.border,
    });
    page.drawText(label, {
      x: ctx.theme.marginLeft,
      y: 22,
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
      y: 22,
      size: ctx.theme.smallSize,
      font: ctx.fonts.regular,
      color: ctx.theme.colors.subtle,
    });

    const brandX = groupX + poweredByPrefixWidth + poweredByGap;
    page.drawText(poweredByBrand, {
      x: brandX,
      y: 22,
      size: ctx.theme.smallSize,
      font: ctx.fonts.bold,
      color: ctx.theme.colors.subtle,
    });

    if (branding?.poweredByLogo) {
      page.drawImage(branding.poweredByLogo, {
        x: brandX + poweredByBrandWidth + poweredByGap,
        y: 21,
        width: logoWidth,
        height: logoHeight,
        opacity: 0.75,
      });
    }

    page.drawText(text, {
      x: ctx.theme.pageWidth - ctx.theme.marginRight - width,
      y: 22,
      size: ctx.theme.smallSize,
      font: ctx.fonts.regular,
      color: ctx.theme.colors.subtle,
    });
  }
}
