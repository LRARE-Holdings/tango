import { type ReportFormat, type ReportStyleVersion } from "@/lib/reports/engine/report-format";
import { getReportFormat } from "@/lib/reports/engine/report-presets";

export type ReportDocTheme = {
  styleVersion: ReportStyleVersion;
  formatId: string;
  pageWidth: number;
  pageHeight: number;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  baseline: number;
  gutter: number;
  sectionGap: number;
  keyValueLabelWidth: number;
  headerBandHeight: number;
  footerBandHeight: number;
  metricCardMinHeight: number;
  widowOrphanMinLines: number;
  titleSize: number;
  headingSize: number;
  bodySize: number;
  smallSize: number;
  lineHeight: number;
  wordBreaks: string[];
  tableDefaults: ReportFormat["tableDefaults"];
  watermark: ReportFormat["watermark"];
  colors: ReportFormat["colors"];
};

export function themeFromFormat(format: ReportFormat): ReportDocTheme {
  return {
    styleVersion: format.id,
    formatId: format.id,
    pageWidth: format.page.width,
    pageHeight: format.page.height,
    marginTop: format.page.marginTop,
    marginRight: format.page.marginRight,
    marginBottom: format.page.marginBottom,
    marginLeft: format.page.marginLeft,
    baseline: format.layout.baseline,
    gutter: format.layout.gutter,
    sectionGap: format.layout.sectionGap,
    keyValueLabelWidth: format.layout.keyValueLabelWidth,
    headerBandHeight: format.layout.headerBandHeight,
    footerBandHeight: format.layout.footerBandHeight,
    metricCardMinHeight: format.layout.metricCardMinHeight,
    widowOrphanMinLines: format.layout.widowOrphanMinLines,
    titleSize: format.typography.titleSize,
    headingSize: format.typography.headingSize,
    bodySize: format.typography.bodySize,
    smallSize: format.typography.smallSize,
    lineHeight: format.typography.lineHeight,
    wordBreaks: [...format.wordBreaks],
    tableDefaults: { ...format.tableDefaults },
    watermark: { ...format.watermark },
    colors: { ...format.colors },
  };
}

export function getDefaultReportTheme(styleVersion: ReportStyleVersion = "v2"): ReportDocTheme {
  return themeFromFormat(getReportFormat(styleVersion));
}

export const DEFAULT_REPORT_THEME = getDefaultReportTheme("v2");
export const DEFAULT_REPORT_WORD_BREAKS = [...DEFAULT_REPORT_THEME.wordBreaks];

