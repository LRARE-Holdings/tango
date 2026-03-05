import { rgb } from "pdf-lib";
import {
  REPORT_FORMAT_WORD_BREAKS,
  type ReportFormat,
  type ReportStyleVersion,
} from "@/lib/reports/engine/report-format";

const SHARED_COLORS = {
  text: rgb(0.11, 0.12, 0.14),
  muted: rgb(0.28, 0.3, 0.34),
  subtle: rgb(0.43, 0.45, 0.5),
  border: rgb(0.82, 0.83, 0.86),
  strongBorder: rgb(0.7, 0.72, 0.76),
  panel: rgb(0.955, 0.957, 0.962),
  panelAlt: rgb(0.975, 0.976, 0.98),
  footerPanel: rgb(0.945, 0.948, 0.955),
  accent: rgb(0.2, 0.22, 0.25),
  white: rgb(1, 1, 1),
};

export const REPORT_FORMAT_V2: ReportFormat = {
  id: "v2",
  wordBreaks: REPORT_FORMAT_WORD_BREAKS,
  page: {
    width: 595.28,
    height: 841.89,
    marginTop: 52,
    marginRight: 38,
    marginBottom: 38,
    marginLeft: 38,
  },
  typography: {
    titleSize: 20.5,
    headingSize: 12.4,
    bodySize: 10.3,
    smallSize: 8.7,
    lineHeight: 14.3,
  },
  layout: {
    baseline: 4,
    gutter: 10,
    sectionGap: 9,
    keyValueLabelWidth: 176,
    headerBandHeight: 72,
    footerBandHeight: 22,
    metricCardMinHeight: 60,
    widowOrphanMinLines: 2,
  },
  tableDefaults: {
    fontSize: 8.8,
    headerFontSize: 9,
    lineHeight: 10.4,
    cellPaddingX: 5.6,
    cellPaddingY: 4,
    maxCellLines: 2,
    stripedRows: true,
  },
  watermark: {
    angleDeg: 31,
    textSize: 28,
    textOpacity: 0.03,
    brandOpacity: 0.08,
  },
  colors: SHARED_COLORS,
};

export const REPORT_FORMAT_V3: ReportFormat = {
  id: "v3",
  wordBreaks: REPORT_FORMAT_WORD_BREAKS,
  page: {
    width: 595.28,
    height: 841.89,
    marginTop: 48,
    marginRight: 34,
    marginBottom: 36,
    marginLeft: 34,
  },
  typography: {
    titleSize: 19.6,
    headingSize: 12.1,
    bodySize: 10.15,
    smallSize: 8.55,
    lineHeight: 14,
  },
  layout: {
    baseline: 4,
    gutter: 10,
    sectionGap: 8,
    keyValueLabelWidth: 170,
    headerBandHeight: 68,
    footerBandHeight: 22,
    metricCardMinHeight: 58,
    widowOrphanMinLines: 2,
  },
  tableDefaults: {
    fontSize: 8.7,
    headerFontSize: 8.9,
    lineHeight: 10.2,
    cellPaddingX: 5.2,
    cellPaddingY: 3.8,
    maxCellLines: 2,
    stripedRows: true,
  },
  watermark: {
    angleDeg: 31,
    textSize: 27,
    textOpacity: 0.028,
    brandOpacity: 0.07,
  },
  colors: SHARED_COLORS,
};

export function getReportFormat(styleVersion: ReportStyleVersion): ReportFormat {
  return styleVersion === "v3" ? REPORT_FORMAT_V3 : REPORT_FORMAT_V2;
}
