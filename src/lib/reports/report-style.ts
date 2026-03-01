import { type ReportStyleVersion } from "@/lib/reports/engine/report-format";

function parseStyle(value: string | null | undefined): ReportStyleVersion | null {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "v2" || raw === "v3") return raw;
  return null;
}

export function getDefaultReportStyle(): ReportStyleVersion {
  return parseStyle(process.env.PDF_STYLE_DEFAULT) ?? "v3";
}

export function resolveReportStyleFromRequest(req: Request): ReportStyleVersion {
  try {
    const url = new URL(req.url);
    const queryStyle = parseStyle(url.searchParams.get("pdf_style"));
    if (queryStyle) return queryStyle;
  } catch {
    // fall through to default
  }
  return getDefaultReportStyle();
}
