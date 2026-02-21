import { type ReportContext } from "@/lib/reports/engine/core";
import { drawTextBlock, wrapTextToLines } from "@/lib/reports/engine/text";

type WidthMode = "fixed" | "flex";

export type TableColumn<T> = {
  key: string;
  header: string;
  width?: number;
  minWidth?: number;
  mode?: WidthMode;
  align?: "left" | "right";
  value: (row: T) => string;
};

export type TableSpec<T> = {
  columns: TableColumn<T>[];
  rows: T[];
  x?: number;
  maxWidth?: number;
  fontSize?: number;
  headerFontSize?: number;
  lineHeight?: number;
  cellPaddingX?: number;
  cellPaddingY?: number;
  repeatHeader?: boolean;
};

function resolveColumnWidths<T>(spec: TableSpec<T>, maxWidth: number) {
  const columns = spec.columns;
  const widths = new Array<number>(columns.length).fill(0);
  let fixedTotal = 0;
  let flexCount = 0;

  for (let i = 0; i < columns.length; i += 1) {
    const col = columns[i];
    if (col.mode === "fixed" || typeof col.width === "number") {
      widths[i] = Math.max(col.minWidth ?? 24, col.width ?? 24);
      fixedTotal += widths[i];
      continue;
    }
    flexCount += 1;
  }

  const remaining = Math.max(0, maxWidth - fixedTotal);
  const eachFlex = flexCount > 0 ? remaining / flexCount : 0;

  for (let i = 0; i < columns.length; i += 1) {
    if (widths[i] > 0) continue;
    widths[i] = Math.max(columns[i].minWidth ?? 24, eachFlex);
  }

  const total = widths.reduce((sum, w) => sum + w, 0);
  if (total > maxWidth) {
    const ratio = maxWidth / total;
    for (let i = 0; i < widths.length; i += 1) {
      widths[i] = Math.max(columns[i].minWidth ?? 24, widths[i] * ratio);
    }
  }
  return widths;
}

function drawRowBorder(ctx: ReportContext, x: number, y: number, width: number) {
  ctx.page.drawLine({
    start: { x, y },
    end: { x: x + width, y },
    thickness: 1,
    color: ctx.theme.colors.border,
  });
}

export function drawTable<T>(ctx: ReportContext, spec: TableSpec<T>) {
  const x = spec.x ?? ctx.cursor.minX;
  const maxWidth = spec.maxWidth ?? ctx.cursor.maxX - x;
  const fontSize = spec.fontSize ?? ctx.theme.smallSize;
  const headerFontSize = spec.headerFontSize ?? fontSize;
  const lineHeight = spec.lineHeight ?? Math.max(fontSize + 2, ctx.theme.lineHeight - 2);
  const cellPaddingX = spec.cellPaddingX ?? 6;
  const cellPaddingY = spec.cellPaddingY ?? 4;
  const widths = resolveColumnWidths(spec, maxWidth);

  const drawHeader = () => {
    const headerLines = spec.columns.map((col, i) =>
      wrapTextToLines(
        ctx,
        col.header,
        Math.max(8, widths[i] - cellPaddingX * 2),
        headerFontSize,
        true,
        ctx.theme.wordBreaks
      )
    );
    const maxLines = Math.max(1, ...headerLines.map((lines) => lines.length));
    const rowHeight = maxLines * lineHeight + cellPaddingY * 2;
    ctx.ensureSpace(rowHeight + 1);

    ctx.page.drawRectangle({
      x,
      y: ctx.cursor.y - rowHeight,
      width: maxWidth,
      height: rowHeight,
      color: ctx.theme.colors.panel,
      borderColor: ctx.theme.colors.border,
      borderWidth: 1,
    });

    let colX = x;
    for (let i = 0; i < spec.columns.length; i += 1) {
      drawTextBlock(ctx, {
        text: spec.columns[i].header,
        x: colX + cellPaddingX,
        y: ctx.cursor.y - cellPaddingY - headerFontSize,
        maxWidth: Math.max(8, widths[i] - cellPaddingX * 2),
        bold: true,
        size: headerFontSize,
        lineHeight,
      });
      colX += widths[i];
    }
    ctx.cursor.y -= rowHeight;
    drawRowBorder(ctx, x, ctx.cursor.y, maxWidth);
  };

  drawHeader();

  for (const row of spec.rows) {
    const cellLines = spec.columns.map((col, i) =>
      wrapTextToLines(
        ctx,
        col.value(row),
        Math.max(8, widths[i] - cellPaddingX * 2),
        fontSize,
        false,
        ctx.theme.wordBreaks
      )
    );
    const maxLines = Math.max(1, ...cellLines.map((lines) => lines.length));
    const rowHeight = maxLines * lineHeight + cellPaddingY * 2;

    if (ctx.cursor.y - rowHeight < ctx.cursor.minY) {
      ctx.addPage();
      if (spec.repeatHeader !== false) {
        drawHeader();
      }
    }

    let colX = x;
    for (let i = 0; i < spec.columns.length; i += 1) {
      const col = spec.columns[i];
      const lines = cellLines[i];
      const text = lines.join("\n");
      let textX = colX + cellPaddingX;
      if (col.align === "right") {
        const maxLineWidth = Math.max(
          0,
          ...lines.map((line) => ctx.fonts.regular.widthOfTextAtSize(line, fontSize))
        );
        textX = colX + widths[i] - cellPaddingX - maxLineWidth;
      }

      drawTextBlock(ctx, {
        text,
        x: textX,
        y: ctx.cursor.y - cellPaddingY - fontSize,
        maxWidth: Math.max(8, widths[i] - cellPaddingX * 2),
        size: fontSize,
        lineHeight,
      });

      colX += widths[i];
    }

    ctx.cursor.y -= rowHeight;
    drawRowBorder(ctx, x, ctx.cursor.y, maxWidth);
  }

  ctx.cursor.y -= 6;
}
