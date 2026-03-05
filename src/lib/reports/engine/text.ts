import { type PDFPageDrawTextOptions } from "pdf-lib";
import { type ReportContext } from "@/lib/reports/engine/core";
import { DEFAULT_REPORT_WORD_BREAKS } from "@/lib/reports/engine/theme";

export type ReportFontFamily = "regular" | "bold" | "mono";

export type TextBlockOptions = {
  text: string;
  x?: number;
  y?: number;
  maxWidth?: number;
  size?: number;
  bold?: boolean;
  font?: ReportFontFamily;
  color?: PDFPageDrawTextOptions["color"];
  lineHeight?: number;
  wordBreaks?: string[];
  maxLines?: number;
  truncateMode?: "ellipsis" | "clip";
  minLastLineChars?: number;
};

function pickFont(ctx: ReportContext, font: ReportFontFamily) {
  if (font === "bold") return ctx.fonts.bold;
  if (font === "mono") return ctx.fonts.mono;
  return ctx.fonts.regular;
}

function resolveFamily(font?: ReportFontFamily, bold?: boolean): ReportFontFamily {
  if (font) return font;
  return bold ? "bold" : "regular";
}

function splitTokenByWidth(
  token: string,
  maxWidth: number,
  measure: (value: string) => number
): string[] {
  if (!token) return [""];
  if (measure(token) <= maxWidth) return [token];
  const out: string[] = [];
  let cursor = "";
  for (const char of token) {
    const next = `${cursor}${char}`;
    if (measure(next) <= maxWidth || cursor.length === 0) {
      cursor = next;
    } else {
      out.push(cursor);
      cursor = char;
    }
  }
  if (cursor) out.push(cursor);
  return out.length > 0 ? out : [token];
}

function getTokens(input: string, breakChars: string[]) {
  const escaped = breakChars
    .filter((token) => token.length === 1 && !/\s/.test(token))
    .map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("");
  if (!escaped) return input.split(/(\s+)/).filter((token) => token.length > 0);
  const pattern = new RegExp(`([\\s${escaped}]+)`);
  return input.split(pattern).filter((token) => token.length > 0);
}

function truncateLastLine(
  lines: string[],
  maxWidth: number,
  measure: (value: string) => number,
  minLastLineChars: number
) {
  if (lines.length === 0) return lines;
  const out = [...lines];
  const ellipsis = "…";
  const i = out.length - 1;
  let last = out[i].trimEnd();

  while (last.length > 1 && measure(`${last}${ellipsis}`) > maxWidth) {
    last = last.slice(0, -1);
  }

  if (last.length < minLastLineChars && i > 0) {
    const previous = out[i - 1].trimEnd();
    const tokens = previous.split(/\s+/).filter(Boolean);
    while (tokens.length > 1 && last.length < minLastLineChars) {
      const moved = tokens.pop();
      if (!moved) break;
      last = `${moved} ${last}`.trim();
      while (last.length > 1 && measure(`${last}${ellipsis}`) > maxWidth) {
        last = last.slice(0, -1);
      }
    }
    out[i - 1] = tokens.join(" ").trimEnd() || " ";
  }

  out[i] = last ? `${last}${ellipsis}` : ellipsis;
  return out;
}

export function wrapTextToLines(
  ctx: ReportContext,
  text: string,
  maxWidth: number,
  size: number,
  font: ReportFontFamily | boolean = false,
  wordBreaks: string[] = DEFAULT_REPORT_WORD_BREAKS
) {
  const family = typeof font === "boolean" ? (font ? "bold" : "regular") : font;
  const resolvedFont = pickFont(ctx, family);
  if (maxWidth <= 1) return [String(text ?? "") || " "];

  const paragraphs = String(text ?? "").replace(/\r\n/g, "\n").split("\n");
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const tokens = getTokens(paragraph, wordBreaks);
    let line = "";

    for (const token of tokens) {
      const candidate = `${line}${token}`;
      if (resolvedFont.widthOfTextAtSize(candidate, size) <= maxWidth || line.length === 0) {
        line = candidate;
        continue;
      }

      const clean = token.trim();
      if (clean && resolvedFont.widthOfTextAtSize(clean, size) > maxWidth) {
        if (line.trim().length > 0) lines.push(line.trimEnd());
        const parts = splitTokenByWidth(clean, maxWidth, (value) =>
          resolvedFont.widthOfTextAtSize(value, size)
        );
        lines.push(...parts.slice(0, -1));
        line = parts.at(-1) ?? "";
      } else {
        if (line.trim().length > 0) lines.push(line.trimEnd());
        line = token.trimStart();
      }
    }

    lines.push(line.trimEnd() || " ");
  }

  return lines;
}

export function drawTextBlock(ctx: ReportContext, options: TextBlockOptions) {
  const x = options.x ?? ctx.cursor.x;
  const y = options.y ?? ctx.cursor.y;
  const maxWidth = options.maxWidth ?? ctx.cursor.maxX - x;
  const size = options.size ?? ctx.theme.bodySize;
  const lineHeight = options.lineHeight ?? Math.max(size + 2, ctx.theme.lineHeight);
  const family = resolveFamily(options.font, options.bold);
  const resolvedFont = pickFont(ctx, family);
  const wrapped = wrapTextToLines(
    ctx,
    options.text,
    maxWidth,
    size,
    family,
    options.wordBreaks ?? ctx.theme.wordBreaks
  );

  const maxLines = options.maxLines && options.maxLines > 0 ? options.maxLines : undefined;
  const lines = maxLines ? wrapped.slice(0, maxLines) : wrapped;

  if (maxLines && wrapped.length > maxLines && (options.truncateMode ?? "ellipsis") !== "clip") {
    const adjusted = truncateLastLine(
      lines,
      maxWidth,
      (value) => resolvedFont.widthOfTextAtSize(value, size),
      Math.max(1, options.minLastLineChars ?? 4)
    );
    lines.splice(0, lines.length, ...adjusted);
  }

  ctx.page.drawText(lines.join("\n"), {
    x,
    y,
    font: resolvedFont,
    size,
    color: options.color ?? ctx.theme.colors.text,
    lineHeight,
    maxWidth,
    wordBreaks: options.wordBreaks ?? ctx.theme.wordBreaks,
  });

  const consumedHeight = lines.length * lineHeight;
  return {
    lines,
    consumedHeight,
    nextY: y - consumedHeight,
  };
}

export function measureTextBlockHeight(
  ctx: ReportContext,
  options: Omit<TextBlockOptions, "x" | "y">
) {
  const x = ctx.cursor.x;
  const maxWidth = options.maxWidth ?? ctx.cursor.maxX - x;
  const size = options.size ?? ctx.theme.bodySize;
  const lineHeight = options.lineHeight ?? Math.max(size + 2, ctx.theme.lineHeight);
  const family = resolveFamily(options.font, options.bold);

  const lines = wrapTextToLines(
    ctx,
    options.text,
    maxWidth,
    size,
    family,
    options.wordBreaks ?? ctx.theme.wordBreaks
  );

  const maxLines = options.maxLines && options.maxLines > 0 ? options.maxLines : undefined;
  const visible = maxLines ? Math.min(maxLines, lines.length) : lines.length;
  return visible * lineHeight;
}
