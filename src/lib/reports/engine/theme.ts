import { rgb } from "pdf-lib";

export type ReportDocTheme = {
  pageWidth: number;
  pageHeight: number;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  baseline: number;
  gutter: number;
  titleSize: number;
  headingSize: number;
  bodySize: number;
  smallSize: number;
  lineHeight: number;
  wordBreaks: string[];
  colors: {
    text: ReturnType<typeof rgb>;
    muted: ReturnType<typeof rgb>;
    border: ReturnType<typeof rgb>;
    panel: ReturnType<typeof rgb>;
    accent: ReturnType<typeof rgb>;
    white: ReturnType<typeof rgb>;
  };
};

export const DEFAULT_REPORT_WORD_BREAKS = [" ", "/", "-", "_", "|", ":"];

export const DEFAULT_REPORT_THEME: ReportDocTheme = {
  pageWidth: 595.28,
  pageHeight: 841.89,
  marginTop: 52,
  marginRight: 44,
  marginBottom: 44,
  marginLeft: 44,
  baseline: 4,
  gutter: 10,
  titleSize: 20,
  headingSize: 12,
  bodySize: 10.5,
  smallSize: 8.8,
  lineHeight: 14,
  wordBreaks: DEFAULT_REPORT_WORD_BREAKS,
  colors: {
    text: rgb(0.08, 0.1, 0.14),
    muted: rgb(0.36, 0.4, 0.46),
    border: rgb(0.87, 0.89, 0.92),
    panel: rgb(0.965, 0.972, 0.985),
    accent: rgb(0.09, 0.25, 0.49),
    white: rgb(1, 1, 1),
  },
};
