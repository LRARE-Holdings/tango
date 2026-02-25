# PDF Style System (v3)

## Overview
- PDF exports support two styles: `v2` and `v3`.
- `v3` standardizes all report exports on portrait A4 with shared typography, spacing, table, watermark, and footer tokens.
- Style can be selected per request with `?pdf_style=v3`.
- Default style is controlled by `PDF_STYLE_DEFAULT` (`v2` fallback).

## Engine Structure
- Format contract: `src/lib/reports/engine/report-format.ts`
- Presets: `src/lib/reports/engine/report-presets.ts`
- Theme mapping: `src/lib/reports/engine/theme.ts`
- Shared composer primitives: `src/lib/reports/engine/composer.ts`
- Table presets + semantic DSL: `src/lib/reports/engine/table.ts`

## Rendering Primitives
- `header`
- `metaGrid`
- `kpiRow`
- `section`
- `keyValueList`
- `dataTable`
- `note`
- `footer`
- `watermark`

## QA Gates
- Structural + deterministic checks: `scripts/qa/pdf-regression.mjs`
- Visual hash checks (first-page raster via `pdftoppm`): `scripts/qa/pdf-regression.mjs`
- Quality checks (text, metadata, raster presence): `scripts/qa/pdf-quality.mjs`

## Visual Regression Notes
- Install poppler (`pdftoppm`) to enable visual gates.
- Optional env:
  - `PDF_VISUAL=0` disables raster checks.
  - `PDF_VISUAL_REQUIRED=1` fails if `pdftoppm` is unavailable.
  - `PDF_BASELINE_FILE=/path/to/pdf-baseline.json` enables baseline comparison in regression script.
  - `PDF_UPDATE_BASELINE=1` writes/updates baseline fingerprints.

