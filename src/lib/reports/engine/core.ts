import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument, PDFPage, StandardFonts, type PDFFont, type PDFImage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { type ReportStyleVersion } from "@/lib/reports/engine/report-format";
import { getDefaultReportTheme, type ReportDocTheme } from "@/lib/reports/engine/theme";

export type ReportFonts = {
  regular: PDFFont;
  bold: PDFFont;
  mono: PDFFont;
};

export type LayoutCursor = {
  x: number;
  y: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export type ReportContext = {
  pdf: PDFDocument;
  page: PDFPage;
  theme: ReportDocTheme;
  fonts: ReportFonts;
  cursor: LayoutCursor;
  addPage: () => void;
  ensureSpace: (height: number) => void;
  remainingHeight: () => number;
};

type CreateReportContextOptions = {
  styleVersion?: ReportStyleVersion;
  theme?: Partial<ReportDocTheme>;
  onPageAdded?: (ctx: ReportContext) => void;
};

const REGULAR_FONTS = [
  "public/fonts/reports/NotoSans-Regular.ttf",
  "public/fonts/reports/LiberationSans-Regular.ttf",
  "public/fonts/Inter-Regular.ttf",
  "public/fonts/Inter-Regular.otf",
  "public/fonts/InterVariable.ttf",
  "public/fonts/Inter-VariableFont_slnt,wght.ttf",
];

const BOLD_FONTS = [
  "public/fonts/reports/NotoSans-SemiBold.ttf",
  "public/fonts/reports/NotoSans-Bold.ttf",
  "public/fonts/reports/LiberationSans-Bold.ttf",
  "public/fonts/Inter-SemiBold.ttf",
  "public/fonts/Inter-Bold.ttf",
  "public/fonts/Inter-SemiBold.otf",
  "public/fonts/Inter-Bold.otf",
];

const MONO_FONTS = [
  "public/fonts/reports/NotoSansMono-Regular.ttf",
  "public/fonts/reports/LiberationMono-Regular.ttf",
];

async function readFirstExisting(candidates: string[]): Promise<Uint8Array | null> {
  for (const candidate of candidates) {
    try {
      const file = await fs.readFile(path.join(process.cwd(), candidate));
      return new Uint8Array(file);
    } catch {
      // continue
    }
  }
  return null;
}

async function embedOrFallback(pdf: PDFDocument, bytes: Uint8Array | null, fallback: PDFFont) {
  if (!bytes || bytes.length === 0) return fallback;
  try {
    return await pdf.embedFont(bytes, { subset: true });
  } catch {
    return fallback;
  }
}

async function loadFonts(pdf: PDFDocument): Promise<ReportFonts> {
  const regularFallback = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFallback = await pdf.embedFont(StandardFonts.HelveticaBold);
  const monoFallback = await pdf.embedFont(StandardFonts.Courier);

  try {
    pdf.registerFontkit(fontkit);
    const [regularBytes, boldBytes, monoBytes] = await Promise.all([
      readFirstExisting(REGULAR_FONTS),
      readFirstExisting(BOLD_FONTS),
      readFirstExisting(MONO_FONTS),
    ]);

    const regular = await embedOrFallback(pdf, regularBytes, regularFallback);
    const bold = await embedOrFallback(pdf, boldBytes ?? regularBytes, boldFallback);
    const mono = await embedOrFallback(pdf, monoBytes, monoFallback);
    return { regular, bold, mono };
  } catch {
    return { regular: regularFallback, bold: boldFallback, mono: monoFallback };
  }
}

function mergeTheme(styleVersion: ReportStyleVersion, patch?: Partial<ReportDocTheme>): ReportDocTheme {
  const base = getDefaultReportTheme(styleVersion);
  if (!patch) return base;
  return {
    ...base,
    ...patch,
    wordBreaks: patch.wordBreaks ? [...patch.wordBreaks] : base.wordBreaks,
    tableDefaults: {
      ...base.tableDefaults,
      ...(patch.tableDefaults ?? {}),
    },
    watermark: {
      ...base.watermark,
      ...(patch.watermark ?? {}),
    },
    colors: {
      ...base.colors,
      ...(patch.colors ?? {}),
    },
  };
}

function paintPageBackground(page: PDFPage, theme: ReportDocTheme) {
  page.drawRectangle({
    x: 0,
    y: 0,
    width: theme.pageWidth,
    height: theme.pageHeight,
    color: theme.colors.white,
  });
}

export async function createReportContext(options?: CreateReportContextOptions): Promise<ReportContext> {
  const styleVersion = options?.styleVersion ?? "v2";
  const theme = mergeTheme(styleVersion, options?.theme);
  const pdf = await PDFDocument.create();
  pdf.defaultWordBreaks = theme.wordBreaks;
  const fonts = await loadFonts(pdf);

  const footerBandY = 12;
  const footerTopY = footerBandY + theme.footerBandHeight;
  const safeContentMinY = Math.max(theme.marginBottom, footerTopY + theme.baseline * 2);

  const cursor: LayoutCursor = {
    x: theme.marginLeft,
    y: theme.pageHeight - theme.marginTop,
    minX: theme.marginLeft,
    maxX: theme.pageWidth - theme.marginRight,
    minY: safeContentMinY,
    maxY: theme.pageHeight - theme.marginTop,
  };

  const ctx = {} as ReportContext;

  const addPage = () => {
    ctx.page = pdf.addPage([theme.pageWidth, theme.pageHeight]);
    paintPageBackground(ctx.page, theme);
    cursor.x = cursor.minX;
    cursor.y = cursor.maxY;
    options?.onPageAdded?.(ctx);
  };

  const ensureSpace = (height: number) => {
    if (cursor.y - height < cursor.minY) addPage();
  };

  const remainingHeight = () => cursor.y - cursor.minY;

  ctx.pdf = pdf;
  ctx.page = pdf.addPage([theme.pageWidth, theme.pageHeight]);
  paintPageBackground(ctx.page, theme);
  ctx.theme = theme;
  ctx.fonts = fonts;
  ctx.cursor = cursor;
  ctx.addPage = addPage;
  ctx.ensureSpace = ensureSpace;
  ctx.remainingHeight = remainingHeight;

  options?.onPageAdded?.(ctx);
  return ctx;
}

function detectImageType(bytes: Uint8Array): "png" | "jpg" | null {
  if (bytes.length >= 8) {
    const png =
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a;
    if (png) return "png";
  }
  if (bytes.length >= 3) {
    const jpg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    if (jpg) return "jpg";
  }
  return null;
}

export async function embedImageIfPresent(
  ctx: ReportContext,
  bytes: Uint8Array | null | undefined
): Promise<PDFImage | null> {
  if (!bytes || bytes.length === 0) return null;
  try {
    const type = detectImageType(bytes);
    if (type === "png") return await ctx.pdf.embedPng(bytes);
    if (type === "jpg") return await ctx.pdf.embedJpg(bytes);
    return null;
  } catch {
    return null;
  }
}

export async function embedPngIfPresent(
  ctx: ReportContext,
  bytes: Uint8Array | null | undefined
): Promise<PDFImage | null> {
  return embedImageIfPresent(ctx, bytes);
}

export async function saveReport(ctx: ReportContext, deterministic = false): Promise<Uint8Array> {
  if (deterministic) {
    return ctx.pdf.save({
      useObjectStreams: false,
      addDefaultPage: false,
      objectsPerTick: 50,
      updateFieldAppearances: false,
    });
  }
  return ctx.pdf.save();
}
