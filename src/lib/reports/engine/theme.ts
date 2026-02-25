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
  marginTop: 54,
  marginRight: 42,
  marginBottom: 42,
  marginLeft: 42,
  baseline: 4,
  gutter: 10,
  titleSize: 21,
  headingSize: 12.6,
  bodySize: 10.35,
  smallSize: 8.7,
  lineHeight: 14.6,
  wordBreaks: DEFAULT_REPORT_WORD_BREAKS,
  colors: {
    text: rgb(0.105, 0.12, 0.15),
    muted: rgb(0.275, 0.31, 0.36),
    subtle: rgb(0.45, 0.49, 0.56),
    border: rgb(0.84, 0.86, 0.9),
    strongBorder: rgb(0.73, 0.77, 0.82),
    panel: rgb(0.962, 0.971, 0.987),
    panelAlt: rgb(0.981, 0.986, 0.997),
    footerPanel: rgb(0.952, 0.964, 0.981),
    accent: rgb(0.082, 0.255, 0.525),
    white: rgb(1, 1, 1),
  },
};
