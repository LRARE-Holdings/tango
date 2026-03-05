import { type ReportContext } from "@/lib/reports/engine/core";
import { drawTextBlock, measureTextBlockHeight, type ReportFontFamily } from "@/lib/reports/engine/text";

type WidthMode = "fixed" | "flex";
export type TableColumnSemantic = "text" | "identifier" | "metric" | "status" | "datetime";
export type ReportTablePreset = "default" | "evidence" | "analytics" | "receipts";

export type TableColumn<T> = {
  key: string;
  header: string;
  width?: number;
  minWidth?: number;
  mode?: WidthMode;
  align?: "left" | "right";
  maxLines?: number;
  font?: ReportFontFamily;
  semantic?: TableColumnSemantic;
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
  maxCellLines?: number;
  stripedRows?: boolean;
};

function tableDefaults(ctx: ReportContext, preset: ReportTablePreset) {
  const base = ctx.theme.tableDefaults;
  if (preset === "analytics") {
    return {
      fontSize: base.fontSize + 0.1,
      headerFontSize: base.headerFontSize + 0.1,
      lineHeight: base.lineHeight,
      cellPaddingX: base.cellPaddingX,
      cellPaddingY: base.cellPaddingY,
      maxCellLines: Math.max(2, base.maxCellLines),
      stripedRows: base.stripedRows,
    };
  }
  if (preset === "evidence" || preset === "receipts") {
    return {
      fontSize: base.fontSize,
      headerFontSize: base.headerFontSize,
      lineHeight: base.lineHeight,
      cellPaddingX: base.cellPaddingX,
      cellPaddingY: base.cellPaddingY,
      maxCellLines: Math.max(2, base.maxCellLines),
      stripedRows: base.stripedRows,
    };
  }
  return {
    fontSize: base.fontSize,
    headerFontSize: base.headerFontSize,
    lineHeight: base.lineHeight,
    cellPaddingX: base.cellPaddingX,
    cellPaddingY: base.cellPaddingY,
    maxCellLines: base.maxCellLines,
    stripedRows: base.stripedRows,
  };
}

function applySemanticDefaults<T>(columns: TableColumn<T>[]): TableColumn<T>[] {
  return columns.map((column) => {
    if (!column.semantic) return column;
    if (column.semantic === "identifier") {
      return { ...column, font: column.font ?? "mono" };
    }
    if (column.semantic === "metric") {
      return { ...column, align: column.align ?? "right" };
    }
    if (column.semantic === "status" || column.semantic === "datetime") {
      return { ...column, maxLines: column.maxLines ?? 1 };
    }
    return column;
  });
}

export function buildPresetTableSpec<T>(
  ctx: ReportContext,
  preset: ReportTablePreset,
  spec: TableSpec<T>
): TableSpec<T> {
  return {
    ...tableDefaults(ctx, preset),
    ...spec,
    columns: applySemanticDefaults(spec.columns),
  };
}

function resolveColumnWidths<T>(spec: TableSpec<T>, totalWidth: number) {
  if (spec.columns.length === 0) return [];
  const minWidths = spec.columns.map((column) => Math.max(26, column.minWidth ?? 26));
  const minTotal = minWidths.reduce((sum, width) => sum + width, 0);

  if (minTotal > totalWidth) {
    const scaled = minWidths.map((width) => (width / minTotal) * totalWidth);
    const consumed = scaled.reduce((sum, width) => sum + width, 0);
    scaled[scaled.length - 1] += totalWidth - consumed;
    return scaled;
  }

  const widths = [...minWidths];
  let remaining = totalWidth - minTotal;

  for (let i = 0; i < spec.columns.length; i += 1) {
    const column = spec.columns[i];
    const fixed = column.mode === "fixed" || typeof column.width === "number";
    if (!fixed) continue;
    const requested = Math.max(minWidths[i], column.width ?? minWidths[i]);
    const delta = Math.max(0, requested - minWidths[i]);
    const consume = Math.min(remaining, delta);
    widths[i] += consume;
    remaining -= consume;
  }

  const flexIndexes: number[] = [];
  for (let i = 0; i < spec.columns.length; i += 1) {
    const column = spec.columns[i];
    const fixed = column.mode === "fixed" || typeof column.width === "number";
    if (!fixed) flexIndexes.push(i);
  }

  if (remaining > 0 && flexIndexes.length > 0) {
    const each = remaining / flexIndexes.length;
    for (const index of flexIndexes) widths[index] += each;
  }

  const consumed = widths.reduce((sum, width) => sum + width, 0);
  widths[widths.length - 1] += totalWidth - consumed;
  return widths;
}

function drawHorizontalRule(ctx: ReportContext, x: number, y: number, width: number) {
  ctx.page.drawLine({
    start: { x, y },
    end: { x: x + width, y },
    thickness: 1,
    color: ctx.theme.colors.border,
  });
}

function drawHeader<T>(
  ctx: ReportContext,
  spec: TableSpec<T>,
  widths: number[],
  x: number,
  maxWidth: number,
  headerFontSize: number,
  lineHeight: number,
  cellPaddingX: number,
  cellPaddingY: number
) {
  const headerHeights = spec.columns.map((column, i) =>
    measureTextBlockHeight(ctx, {
      text: column.header,
      maxWidth: Math.max(8, widths[i] - cellPaddingX * 2),
      font: "bold",
      size: headerFontSize,
      lineHeight,
      maxLines: 2,
    })
  );

  const rowHeight = Math.max(...headerHeights) + cellPaddingY * 2;
  ctx.ensureSpace(rowHeight + 1);

  ctx.page.drawRectangle({
    x,
    y: ctx.cursor.y - rowHeight,
    width: maxWidth,
    height: rowHeight,
    color: ctx.theme.colors.panel,
    borderColor: ctx.theme.colors.strongBorder,
    borderWidth: 1,
  });

  let colX = x;
  for (let i = 0; i < spec.columns.length; i += 1) {
    drawTextBlock(ctx, {
      text: spec.columns[i].header,
      x: colX + cellPaddingX,
      y: ctx.cursor.y - cellPaddingY - headerFontSize,
      maxWidth: Math.max(8, widths[i] - cellPaddingX * 2),
      font: "bold",
      size: headerFontSize,
      lineHeight,
      maxLines: 2,
    });
    colX += widths[i];
  }

  ctx.cursor.y -= rowHeight;
  drawHorizontalRule(ctx, x, ctx.cursor.y, maxWidth);
}

export function drawTable<T>(ctx: ReportContext, spec: TableSpec<T>) {
  if (spec.columns.length === 0) return;

  const x = spec.x ?? ctx.cursor.minX;
  const maxWidth = spec.maxWidth ?? ctx.cursor.maxX - x;
  const fontSize = spec.fontSize ?? ctx.theme.tableDefaults.fontSize;
  const headerFontSize = spec.headerFontSize ?? ctx.theme.tableDefaults.headerFontSize;
  const lineHeight = Math.max(
    spec.lineHeight ?? ctx.theme.tableDefaults.lineHeight,
    fontSize * 1.25,
    headerFontSize * 1.2
  );
  const cellPaddingX = spec.cellPaddingX ?? ctx.theme.tableDefaults.cellPaddingX;
  const cellPaddingY = spec.cellPaddingY ?? ctx.theme.tableDefaults.cellPaddingY;
  const stripedRows = spec.stripedRows ?? ctx.theme.tableDefaults.stripedRows;
  const widths = resolveColumnWidths(spec, maxWidth);

  drawHeader(ctx, spec, widths, x, maxWidth, headerFontSize, lineHeight, cellPaddingX, cellPaddingY);

  for (let rowIndex = 0; rowIndex < spec.rows.length; rowIndex += 1) {
    const row = spec.rows[rowIndex];

    const cellHeights = spec.columns.map((column, i) => {
      const maxLines = column.maxLines ?? spec.maxCellLines;
      return measureTextBlockHeight(ctx, {
        text: column.value(row),
        maxWidth: Math.max(8, widths[i] - cellPaddingX * 2),
        font: column.font ?? "regular",
        size: fontSize,
        lineHeight,
        maxLines,
      });
    });

    const rowHeight = Math.max(...cellHeights) + cellPaddingY * 2;

    if (ctx.cursor.y - rowHeight < ctx.cursor.minY) {
      ctx.addPage();
      if (spec.repeatHeader !== false) {
        drawHeader(ctx, spec, widths, x, maxWidth, headerFontSize, lineHeight, cellPaddingX, cellPaddingY);
      }
    }

    if (stripedRows && rowIndex % 2 === 1) {
      ctx.page.drawRectangle({
        x,
        y: ctx.cursor.y - rowHeight,
        width: maxWidth,
        height: rowHeight,
        color: ctx.theme.colors.panelAlt,
      });
    }

    let colX = x;
    for (let i = 0; i < spec.columns.length; i += 1) {
      const column = spec.columns[i];
      const maxLines = column.maxLines ?? spec.maxCellLines;
      const cellText = column.value(row);
      let textX = colX + cellPaddingX;

      if (column.align === "right") {
        const font =
          column.font === "bold"
            ? ctx.fonts.bold
            : column.font === "mono"
              ? ctx.fonts.mono
              : ctx.fonts.regular;
        const textWidth = font.widthOfTextAtSize(cellText, fontSize);
        textX = colX + widths[i] - cellPaddingX - Math.min(textWidth, widths[i] - cellPaddingX * 2);
      }

      drawTextBlock(ctx, {
        text: cellText,
        x: textX,
        y: ctx.cursor.y - cellPaddingY - fontSize,
        maxWidth: Math.max(8, widths[i] - cellPaddingX * 2),
        font: column.font ?? "regular",
        size: fontSize,
        lineHeight,
        maxLines,
      });

      colX += widths[i];
    }

    ctx.cursor.y -= rowHeight;
    drawHorizontalRule(ctx, x, ctx.cursor.y, maxWidth);
  }

  ctx.cursor.y -= 9;
}

export function drawPresetTable<T>(ctx: ReportContext, preset: ReportTablePreset, spec: TableSpec<T>) {
  drawTable(ctx, buildPresetTableSpec(ctx, preset, spec));
}
