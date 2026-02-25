import { rgb } from "pdf-lib";
import {
  REPORT_FORMAT_WORD_BREAKS,
  type ReportFormat,
  type ReportStyleVersion,
} from "@/lib/reports/engine/report-format";

export const REPORT_FORMAT_V2: ReportFormat = {
  id: "v2",
  wordBreaks: REPORT_FORMAT_WORD_BREAKS,
  page: {
    width: 595.28,
    height: 841.89,
    marginTop: 54,
    marginRight: 42,
    marginBottom: 42,
    marginLeft: 42,
  },
  typography: {
    titleSize: 21,
    headingSize: 12.6,
    bodySize: 10.35,
    smallSize: 8.7,
    lineHeight: 14.6,
  },
  layout: {
    baseline: 4,
    gutter: 10,
    sectionGap: 9,
    keyValueLabelWidth: 180,
    headerBandHeight: 78,
    footerBandHeight: 24,
    metricCardMinHeight: 62,
    widowOrphanMinLines: 2,
  },
  tableDefaults: {
    fontSize: 8.8,
    headerFontSize: 9.1,
    lineHeight: 10.2,
    cellPaddingX: 6,
    cellPaddingY: 4,
    maxCellLines: 2,
    stripedRows: true,
  },
  watermark: {
    angleDeg: 31,
    textSize: 30,
    textOpacity: 0.045,
    brandOpacity: 0.09,
  },
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

export const REPORT_FORMAT_V3: ReportFormat = {
  id: "v3",
  wordBreaks: REPORT_FORMAT_WORD_BREAKS,
  page: {
    width: 595.28,
    height: 841.89,
    marginTop: 52,
    marginRight: 38,
    marginBottom: 40,
    marginLeft: 38,
  },
  typography: {
    titleSize: 20,
    headingSize: 12.2,
    bodySize: 10.2,
    smallSize: 8.6,
    lineHeight: 14.2,
  },
  layout: {
    baseline: 4,
    gutter: 10,
    sectionGap: 9,
    keyValueLabelWidth: 174,
    headerBandHeight: 74,
    footerBandHeight: 22,
    metricCardMinHeight: 60,
    widowOrphanMinLines: 2,
  },
  tableDefaults: {
    fontSize: 8.7,
    headerFontSize: 8.95,
    lineHeight: 10.1,
    cellPaddingX: 5.5,
    cellPaddingY: 4,
    maxCellLines: 2,
    stripedRows: true,
  },
  watermark: {
    angleDeg: 31,
    textSize: 29,
    textOpacity: 0.042,
    brandOpacity: 0.085,
  },
  colors: {
    text: rgb(0.1, 0.118, 0.145),
    muted: rgb(0.27, 0.302, 0.35),
    subtle: rgb(0.44, 0.475, 0.54),
    border: rgb(0.835, 0.855, 0.895),
    strongBorder: rgb(0.71, 0.75, 0.81),
    panel: rgb(0.958, 0.969, 0.986),
    panelAlt: rgb(0.979, 0.985, 0.996),
    footerPanel: rgb(0.949, 0.962, 0.979),
    accent: rgb(0.078, 0.243, 0.505),
    white: rgb(1, 1, 1),
  },
};

export function getReportFormat(styleVersion: ReportStyleVersion): ReportFormat {
  return styleVersion === "v3" ? REPORT_FORMAT_V3 : REPORT_FORMAT_V2;
}

