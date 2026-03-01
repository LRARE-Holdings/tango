import { type ReportContext } from "@/lib/reports/engine/core";
import { drawTextBlock, wrapTextToLines, type ReportFontFamily } from "@/lib/reports/engine/text";

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

function tablePresetDefaults(ctx: ReportContext, preset: ReportTablePreset): Pick<
  TableSpec<unknown>,
  "fontSize" | "headerFontSize" | "lineHeight" | "cellPaddingX" | "cellPaddingY" | "maxCellLines" | "stripedRows"
> {
  const base = ctx.theme.tableDefaults;
  if (preset === "evidence") {
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
  if (preset === "receipts") {
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
      return {
        ...column,
        font: column.font ?? "mono",
      };
    }
    if (column.semantic === "metric") {
      return {
        ...column,
        align: column.align ?? "right",
      };
    }
    if (column.semantic === "status") {
      return {
        ...column,
        maxLines: column.maxLines ?? 1,
      };
    }
    if (column.semantic === "datetime") {
      return {
        ...column,
        maxLines: column.maxLines ?? 1,
      };
    }
    return column;
  });
}

export function buildPresetTableSpec<T>(
  ctx: ReportContext,
  preset: ReportTablePreset,
  spec: TableSpec<T>
): TableSpec<T> {
  const defaults = tablePresetDefaults(ctx, preset);
  return {
    ...defaults,
    ...spec,
    columns: applySemanticDefaults(spec.columns),
  };
}

function resolveColumnWidths<T>(spec: TableSpec<T>, maxWidth: number) {
  const columns = spec.columns;
  if (columns.length === 0) return [];
  const minWidths = columns.map((col) => Math.max(24, col.minWidth ?? 24));
  const minTotal = minWidths.reduce((sum, value) => sum + value, 0);
  if (minTotal > maxWidth) {
    const scaled = minWidths.map((value) => (value / minTotal) * maxWidth);
    const total = scaled.reduce((sum, value) => sum + value, 0);
    scaled[scaled.length - 1] += maxWidth - total;
    return scaled;
  }

  const widths = [...minWidths];
  let remaining = maxWidth - minTotal;
  for (let i = 0; i < columns.length; i += 1) {
    const col = columns[i];
    const fixedWidth = col.mode === "fixed" || typeof col.width === "number";
    if (!fixedWidth) continue;
    const requested = Math.max(minWidths[i], col.width ?? minWidths[i]);
    const add = Math.max(0, requested - minWidths[i]);
    const consume = Math.min(add, remaining);
    widths[i] += consume;
    remaining -= consume;
  }

  const flexIndexes: number[] = [];
  for (let i = 0; i < columns.length; i += 1) {
    const col = columns[i];
    const fixedWidth = col.mode === "fixed" || typeof col.width === "number";
    if (!fixedWidth) flexIndexes.push(i);
  }

  if (remaining > 0 && flexIndexes.length > 0) {
    const each = remaining / flexIndexes.length;
    for (const index of flexIndexes) {
      widths[index] += each;
    }
    remaining = 0;
  }

  const total = widths.reduce((sum, w) => sum + w, 0);
  widths[widths.length - 1] += maxWidth - total;
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

function fontForCell(ctx: ReportContext, font: ReportFontFamily) {
  if (font === "bold") return ctx.fonts.bold;
  if (font === "mono") return ctx.fonts.mono;
  return ctx.fonts.regular;
}

export function drawTable<T>(ctx: ReportContext, spec: TableSpec<T>) {
  if (spec.columns.length === 0) return;
  const x = spec.x ?? ctx.cursor.minX;
  const maxWidth = spec.maxWidth ?? ctx.cursor.maxX - x;
  const fontSize = spec.fontSize ?? ctx.theme.tableDefaults.fontSize;
  const headerFontSize = spec.headerFontSize ?? ctx.theme.tableDefaults.headerFontSize ?? fontSize;
  const lineHeight = Math.max(
    spec.lineHeight ?? ctx.theme.tableDefaults.lineHeight,
    fontSize * 1.26,
    headerFontSize * 1.22
  );
  const cellPaddingX = spec.cellPaddingX ?? ctx.theme.tableDefaults.cellPaddingX;
  const cellPaddingY = spec.cellPaddingY ?? ctx.theme.tableDefaults.cellPaddingY;
  const stripedRows = spec.stripedRows ?? ctx.theme.tableDefaults.stripedRows;
  const widths = resolveColumnWidths(spec, maxWidth);

  const drawHeader = () => {
    const headerLines = spec.columns.map((col, i) =>
      wrapTextToLines(
        ctx,
        col.header,
        Math.max(8, widths[i] - cellPaddingX * 2),
        headerFontSize,
        "bold",
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
      });
      colX += widths[i];
    }
    ctx.cursor.y -= rowHeight;
    drawRowBorder(ctx, x, ctx.cursor.y, maxWidth);
  };

  drawHeader();

  for (let rowIndex = 0; rowIndex < spec.rows.length; rowIndex += 1) {
    const row = spec.rows[rowIndex];
    const cellLines = spec.columns.map((col, i) =>
      wrapTextToLines(
        ctx,
        col.value(row),
        Math.max(8, widths[i] - cellPaddingX * 2),
        fontSize,
        col.font ?? "regular",
        ctx.theme.wordBreaks
      )
    );
    const maxLines = Math.max(
      1,
      ...cellLines.map((lines, colIndex) => {
        const colMax = spec.columns[colIndex].maxLines ?? spec.maxCellLines;
        if (colMax && colMax > 0) return Math.min(lines.length, colMax);
        return lines.length;
      })
    );
    const rowHeight = maxLines * lineHeight + cellPaddingY * 2;

    if (ctx.cursor.y - rowHeight < ctx.cursor.minY) {
      ctx.addPage();
      if (spec.repeatHeader !== false) {
        drawHeader();
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
      const col = spec.columns[i];
      const lines = cellLines[i];
      const text = lines.join("\n");
      const family = col.font ?? "regular";
      const resolvedFont = fontForCell(ctx, family);
      const columnMaxLines = col.maxLines ?? spec.maxCellLines;
      const linesForWidth = columnMaxLines && columnMaxLines > 0 ? lines.slice(0, columnMaxLines) : lines;
      let textX = colX + cellPaddingX;
      if (col.align === "right") {
        const maxLineWidth = Math.max(0, ...linesForWidth.map((line) => resolvedFont.widthOfTextAtSize(line, fontSize)));
        textX = colX + widths[i] - cellPaddingX - maxLineWidth;
      }

      drawTextBlock(ctx, {
        text,
        x: textX,
        y: ctx.cursor.y - cellPaddingY - fontSize,
        maxWidth: Math.max(8, widths[i] - cellPaddingX * 2),
        font: family,
        size: fontSize,
        lineHeight,
        maxLines: columnMaxLines,
      });

      colX += widths[i];
    }

    ctx.cursor.y -= rowHeight;
    drawRowBorder(ctx, x, ctx.cursor.y, maxWidth);
  }

  ctx.cursor.y -= 10;
}

export function drawPresetTable<T>(ctx: ReportContext, preset: ReportTablePreset, spec: TableSpec<T>) {
  drawTable(ctx, buildPresetTableSpec(ctx, preset, spec));
}
