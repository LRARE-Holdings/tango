import { type PDFPageDrawTextOptions } from "pdf-lib";
import { type ReportContext } from "@/lib/reports/engine/core";
import { DEFAULT_REPORT_WORD_BREAKS } from "@/lib/reports/engine/theme";

export type TextBlockOptions = {
  text: string;
  x?: number;
  y?: number;
  maxWidth?: number;
  size?: number;
  bold?: boolean;
  color?: PDFPageDrawTextOptions["color"];
  lineHeight?: number;
  wordBreaks?: string[];
  maxLines?: number;
  truncateMode?: "ellipsis" | "clip";
};

function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function splitOversizedToken(
  token: string,
  maxWidth: number,
  size: number,
  measure: (text: string, size: number) => number
) {
  const out: string[] = [];
  let chunk = "";
  for (const char of token) {
    const next = `${chunk}${char}`;
    if (measure(next, size) <= maxWidth || chunk.length === 0) {
      chunk = next;
      continue;
    }
    out.push(chunk);
    chunk = char;
  }
  if (chunk) out.push(chunk);
  return out;
}

export function wrapTextToLines(
  ctx: ReportContext,
  text: string,
  maxWidth: number,
  size: number,
  bold = false,
  wordBreaks: string[] = DEFAULT_REPORT_WORD_BREAKS
) {
  const font = bold ? ctx.fonts.bold : ctx.fonts.regular;
  const breakChars = wordBreaks
    .filter((token) => token.length === 1 && !/\s/.test(token))
    .map(escapeRegExp)
    .join("");
  const tokenPattern = new RegExp(`([\\s${breakChars}]+)`);

  const lines: string[] = [];
  const paragraphs = String(text ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n");

  for (const paragraph of paragraphs) {
    const tokens = paragraph.split(tokenPattern).filter((token) => token.length > 0);
    let line = "";

    for (const token of tokens) {
      const candidate = `${line}${token}`;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth || line.length === 0) {
        line = candidate;
        continue;
      }

      const cleanToken = token.trim();
      if (cleanToken && font.widthOfTextAtSize(cleanToken, size) > maxWidth) {
        const parts = splitOversizedToken(cleanToken, maxWidth, size, (value, fSize) =>
          font.widthOfTextAtSize(value, fSize)
        );
        if (line.trim().length > 0) lines.push(line.trimEnd());
        lines.push(...parts.slice(0, -1));
        line = parts.at(-1) ?? "";
      } else {
        if (line.trim().length > 0) lines.push(line.trimEnd());
        line = token.trimStart();
      }
    }

    lines.push(line.trimEnd());
  }

  return lines.map((line) => (line.length === 0 ? " " : line));
}

export function drawTextBlock(ctx: ReportContext, options: TextBlockOptions) {
  const x = options.x ?? ctx.cursor.x;
  const y = options.y ?? ctx.cursor.y;
  const maxWidth = options.maxWidth ?? ctx.cursor.maxX - x;
  const size = options.size ?? ctx.theme.bodySize;
  const lineHeight = options.lineHeight ?? Math.max(size + 2, ctx.theme.lineHeight);
  const bold = options.bold === true;
  const font = bold ? ctx.fonts.bold : ctx.fonts.regular;
  const wordBreaks = options.wordBreaks ?? ctx.theme.wordBreaks;

  const wrapped = wrapTextToLines(ctx, options.text, maxWidth, size, bold, wordBreaks);
  const maxLines = options.maxLines && options.maxLines > 0 ? options.maxLines : undefined;
  const lines = maxLines ? wrapped.slice(0, maxLines) : wrapped;

  if (maxLines && wrapped.length > maxLines && options.truncateMode !== "clip") {
    const ellipsis = "…";
    const lastIndex = lines.length - 1;
    let last = lines[lastIndex] ?? "";
    while (last.length > 1 && font.widthOfTextAtSize(`${last}${ellipsis}`, size) > maxWidth) {
      last = last.slice(0, -1);
    }
    lines[lastIndex] = `${last}${ellipsis}`;
  }

  const text = lines.join("\n");
  ctx.page.drawText(text, {
    x,
    y,
    font,
    size,
    color: options.color ?? ctx.theme.colors.text,
    lineHeight,
    maxWidth,
    wordBreaks,
  });

  const consumedHeight = lines.length * lineHeight;
  return {
    lines,
    consumedHeight,
    nextY: y - consumedHeight,
  };
}

export function measureTextBlockHeight(ctx: ReportContext, options: Omit<TextBlockOptions, "x" | "y">) {
  const x = ctx.cursor.x;
  const maxWidth = options.maxWidth ?? ctx.cursor.maxX - x;
  const size = options.size ?? ctx.theme.bodySize;
  const lineHeight = options.lineHeight ?? Math.max(size + 2, ctx.theme.lineHeight);
  const lines = wrapTextToLines(
    ctx,
    options.text,
    maxWidth,
    size,
    options.bold === true,
    options.wordBreaks ?? ctx.theme.wordBreaks
  );
  const maxLines = options.maxLines && options.maxLines > 0 ? options.maxLines : undefined;
  const lineCount = maxLines ? Math.min(lines.length, maxLines) : lines.length;
  return lineCount * lineHeight;
}
