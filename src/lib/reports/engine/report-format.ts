import { rgb } from "pdf-lib";

export type ReportStyleVersion = "v2" | "v3";

export type ReportColor = ReturnType<typeof rgb>;

export type ReportFormat = {
  id: ReportStyleVersion;
  wordBreaks: string[];
  page: {
    width: number;
    height: number;
    marginTop: number;
    marginRight: number;
    marginBottom: number;
    marginLeft: number;
  };
  typography: {
    titleSize: number;
    headingSize: number;
    bodySize: number;
    smallSize: number;
    lineHeight: number;
  };
  layout: {
    baseline: number;
    gutter: number;
    sectionGap: number;
    keyValueLabelWidth: number;
    headerBandHeight: number;
    footerBandHeight: number;
    metricCardMinHeight: number;
    widowOrphanMinLines: number;
  };
  tableDefaults: {
    fontSize: number;
    headerFontSize: number;
    lineHeight: number;
    cellPaddingX: number;
    cellPaddingY: number;
    maxCellLines: number;
    stripedRows: boolean;
  };
  watermark: {
    angleDeg: number;
    textSize: number;
    textOpacity: number;
    brandOpacity: number;
  };
  colors: {
    text: ReportColor;
    muted: ReportColor;
    subtle: ReportColor;
    border: ReportColor;
    strongBorder: ReportColor;
    panel: ReportColor;
    panelAlt: ReportColor;
    footerPanel: ReportColor;
    accent: ReportColor;
    white: ReportColor;
  };
};

export const REPORT_FORMAT_WORD_BREAKS = [" ", "/", "-", "_", "|", ":"];

