import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument, PDFPage, StandardFonts, type PDFFont, type PDFImage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { DEFAULT_REPORT_THEME, type ReportDocTheme } from "@/lib/reports/engine/theme";

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

export type RenderableBlock<TState = unknown> = {
  measure: (ctx: ReportContext, state?: TState) => number;
  render: (ctx: ReportContext, state?: TState) => void;
  split?: (ctx: ReportContext, state?: TState) => { first: TState; second: TState } | null;
};

export type ReportContext = {
  pdf: PDFDocument;
  page: PDFPage;
  theme: ReportDocTheme;
  fonts: ReportFonts;
  cursor: LayoutCursor;
  addPage: () => void;
  ensureSpace: (neededHeight: number) => void;
  remainingHeight: () => number;
};

type CreateReportContextOptions = {
  theme?: Partial<ReportDocTheme>;
  onPageAdded?: (ctx: ReportContext) => void;
};

const REPORT_REGULAR_CANDIDATES = [
  "public/fonts/reports/NotoSans-Regular.ttf",
  "public/fonts/reports/LiberationSans-Regular.ttf",
  "public/fonts/Inter-Regular.ttf",
  "public/fonts/Inter-Regular.otf",
  "public/fonts/InterVariable.ttf",
  "public/fonts/Inter-VariableFont_slnt,wght.ttf",
];

const REPORT_BOLD_CANDIDATES = [
  "public/fonts/reports/NotoSans-SemiBold.ttf",
  "public/fonts/reports/NotoSans-Bold.ttf",
  "public/fonts/reports/LiberationSans-Bold.ttf",
  "public/fonts/Inter-SemiBold.ttf",
  "public/fonts/Inter-Bold.ttf",
  "public/fonts/Inter-SemiBold.otf",
  "public/fonts/Inter-Bold.otf",
];

const REPORT_MONO_CANDIDATES = [
  "public/fonts/reports/NotoSansMono-Regular.ttf",
  "public/fonts/reports/LiberationMono-Regular.ttf",
];

async function readFirstExisting(paths: string[]): Promise<Uint8Array | null> {
  for (const rel of paths) {
    try {
      const file = await fs.readFile(path.join(process.cwd(), rel));
      return new Uint8Array(file);
    } catch {
      // try next
    }
  }
  return null;
}

async function embedFontBytes(
  pdf: PDFDocument,
  bytes: Uint8Array | null,
  fallback: PDFFont
): Promise<PDFFont> {
  if (!bytes || bytes.length === 0) return fallback;
  try {
    return await pdf.embedFont(bytes, { subset: true });
  } catch {
    return fallback;
  }
}

async function loadReportFonts(pdf: PDFDocument): Promise<ReportFonts> {
  const regularFallback = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFallback = await pdf.embedFont(StandardFonts.HelveticaBold);
  const monoFallback = await pdf.embedFont(StandardFonts.Courier);

  try {
    pdf.registerFontkit(fontkit);
    const [regularBytes, boldBytes, monoBytes] = await Promise.all([
      readFirstExisting(REPORT_REGULAR_CANDIDATES),
      readFirstExisting(REPORT_BOLD_CANDIDATES),
      readFirstExisting(REPORT_MONO_CANDIDATES),
    ]);

    const regular = await embedFontBytes(pdf, regularBytes, regularFallback);
    const bold = await embedFontBytes(pdf, boldBytes ?? regularBytes, boldFallback);
    const mono = await embedFontBytes(pdf, monoBytes, monoFallback);
    return { regular, bold, mono };
  } catch {
    return { regular: regularFallback, bold: boldFallback, mono: monoFallback };
  }
}

function mergeTheme(input?: Partial<ReportDocTheme>): ReportDocTheme {
  if (!input) return DEFAULT_REPORT_THEME;
  return {
    ...DEFAULT_REPORT_THEME,
    ...input,
    colors: {
      ...DEFAULT_REPORT_THEME.colors,
      ...(input.colors ?? {}),
    },
  };
}

export async function createReportContext(options?: CreateReportContextOptions): Promise<ReportContext> {
  const theme = mergeTheme(options?.theme);
  const pdf = await PDFDocument.create();
  pdf.defaultWordBreaks = theme.wordBreaks;
  const fonts = await loadReportFonts(pdf);

  const cursor: LayoutCursor = {
    x: theme.marginLeft,
    y: theme.pageHeight - theme.marginTop,
    minX: theme.marginLeft,
    maxX: theme.pageWidth - theme.marginRight,
    minY: theme.marginBottom,
    maxY: theme.pageHeight - theme.marginTop,
  };

  const context = {} as ReportContext;

  const addPage = () => {
    context.page = pdf.addPage([theme.pageWidth, theme.pageHeight]);
    cursor.x = cursor.minX;
    cursor.y = cursor.maxY;
    options?.onPageAdded?.(context);
  };

  const ensureSpace = (neededHeight: number) => {
    if (cursor.y - neededHeight < cursor.minY) {
      addPage();
    }
  };

  const remainingHeight = () => cursor.y - cursor.minY;

  context.pdf = pdf;
  context.page = pdf.addPage([theme.pageWidth, theme.pageHeight]);
  context.theme = theme;
  context.fonts = fonts;
  context.cursor = cursor;
  context.addPage = addPage;
  context.ensureSpace = ensureSpace;
  context.remainingHeight = remainingHeight;

  // Align first page behavior with later pages.
  options?.onPageAdded?.(context);

  return context;
}

export async function embedPngIfPresent(ctx: ReportContext, bytes: Uint8Array | null | undefined): Promise<PDFImage | null> {
  return embedImageIfPresent(ctx, bytes);
}

function detectImageType(bytes: Uint8Array): "png" | "jpg" | null {
  if (bytes.length >= 8) {
    const isPng =
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a;
    if (isPng) return "png";
  }
  if (bytes.length >= 3) {
    const isJpg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    if (isJpg) return "jpg";
  }
  return null;
}

export async function embedImageIfPresent(ctx: ReportContext, bytes: Uint8Array | null | undefined): Promise<PDFImage | null> {
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
