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
    subtle: ReturnType<typeof rgb>;
    border: ReturnType<typeof rgb>;
    strongBorder: ReturnType<typeof rgb>;
    panel: ReturnType<typeof rgb>;
    panelAlt: ReturnType<typeof rgb>;
    footerPanel: ReturnType<typeof rgb>;
    accent: ReturnType<typeof rgb>;
    white: ReturnType<typeof rgb>;
  };
};

export const DEFAULT_REPORT_WORD_BREAKS = [" ", "/", "-", "_", "|", ":"];

export const DEFAULT_REPORT_THEME: ReportDocTheme = {
  pageWidth: 595.28,
  pageHeight: 841.89,
  marginTop: 56,
  marginRight: 44,
  marginBottom: 44,
  marginLeft: 44,
  baseline: 4,
  gutter: 12,
  titleSize: 21,
  headingSize: 12.5,
  bodySize: 10.2,
  smallSize: 8.6,
  lineHeight: 14.4,
  wordBreaks: DEFAULT_REPORT_WORD_BREAKS,
  colors: {
    text: rgb(0.1, 0.11, 0.13),
    muted: rgb(0.28, 0.31, 0.35),
    subtle: rgb(0.46, 0.5, 0.56),
    border: rgb(0.84, 0.86, 0.89),
    strongBorder: rgb(0.74, 0.77, 0.81),
    panel: rgb(0.965, 0.972, 0.985),
    panelAlt: rgb(0.984, 0.988, 0.996),
    footerPanel: rgb(0.955, 0.965, 0.98),
    accent: rgb(0.08, 0.27, 0.54),
    white: rgb(1, 1, 1),
  },
};
