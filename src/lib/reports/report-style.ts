import { type ReportStyleVersion } from "@/lib/reports/engine/report-format";

function normalizeStyle(input: string | null | undefined): ReportStyleVersion | null {
  const value = String(input ?? "").trim().toLowerCase();
  if (value === "v2" || value === "v3") return value;
  return null;
}

export function getDefaultReportStyle(): ReportStyleVersion {
  return normalizeStyle(process.env.PDF_STYLE_DEFAULT) ?? "v3";
}

export function resolveReportStyleFromRequest(req: Request): ReportStyleVersion {
  try {
    const url = new URL(req.url);
    const explicit = normalizeStyle(url.searchParams.get("pdf_style"));
    if (explicit) return explicit;
  } catch {
    // Ignore URL parse failures and use default style.
  }
  return getDefaultReportStyle();
}
