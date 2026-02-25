#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { PDFDocument } from "pdf-lib";

const baseUrl = (process.env.BASE_URL || "").replace(/\/$/, "");
const authCookie = process.env.AUTH_COOKIE || "";
const runs = Math.max(2, Number(process.env.RUNS || 5));
const visualEnabled = process.env.PDF_VISUAL !== "0";
const visualRequired = process.env.PDF_VISUAL_REQUIRED === "1";
const baselineFile = String(process.env.PDF_BASELINE_FILE || "").trim();
const updateBaseline = process.env.PDF_UPDATE_BASELINE === "1";

const pathList = String(process.env.PDF_PATHS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const explicitUrls = String(process.env.PDF_URLS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

if (!baseUrl && explicitUrls.length === 0) {
  console.error(
    "Missing input. Set either BASE_URL + PDF_PATHS or PDF_URLS.\n" +
      "Example:\n" +
      "BASE_URL=https://www.getreceipt.co PDF_PATHS=/api/app/workspaces/<id>/analytics/report node scripts/qa/pdf-regression.mjs"
  );
  process.exit(1);
}

if (!pathList.length && !explicitUrls.length) {
  console.error("No PDF endpoints provided. Set PDF_PATHS or PDF_URLS.");
  process.exit(1);
}

const targets = [
  ...explicitUrls,
  ...pathList.map((targetPath) => `${baseUrl}${targetPath.startsWith("/") ? targetPath : `/${targetPath}`}`),
];

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function commandExists(command) {
  const result = spawnSync("sh", ["-lc", `command -v ${command}`], { encoding: "utf8" });
  return result.status === 0 && String(result.stdout || "").trim().length > 0;
}

function pngDimensions(buffer) {
  if (buffer.length < 24) return null;
  if (
    buffer[0] !== 0x89 ||
    buffer[1] !== 0x50 ||
    buffer[2] !== 0x4e ||
    buffer[3] !== 0x47
  ) {
    return null;
  }
  const chunk = buffer.toString("ascii", 12, 16);
  if (chunk !== "IHDR") return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

const popplerAvailable = commandExists("pdftoppm");
if (visualEnabled && !popplerAvailable) {
  const message = "pdftoppm not found. Install poppler utils for visual regression checks.";
  if (visualRequired) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
  console.warn(`WARN: ${message} Continuing with structural-only regression checks.`);
}

async function fetchPdf(url) {
  const headers = {};
  if (authCookie) headers.cookie = authCookie;

  const res = await fetch(url, {
    method: "GET",
    redirect: "manual",
    headers,
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const contentType = String(res.headers.get("content-type") || "").toLowerCase();
  if (!contentType.includes("application/pdf")) {
    throw new Error(`Unexpected content-type: ${contentType || "missing"}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  return new Uint8Array(buffer);
}

async function rasterizeFirstPage(bytes) {
  if (!visualEnabled || !popplerAvailable) return null;
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "receipt-pdf-reg-"));
  const inputPath = path.join(tmp, "input.pdf");
  const outputPrefix = path.join(tmp, "page-1");
  const outputPath = `${outputPrefix}.png`;
  try {
    await fs.writeFile(inputPath, Buffer.from(bytes));
    const raster = spawnSync(
      "pdftoppm",
      ["-f", "1", "-singlefile", "-png", "-scale-to-x", "1240", "-scale-to-y", "-1", inputPath, outputPrefix],
      { encoding: "utf8" }
    );
    if (raster.status !== 0) {
      throw new Error(`pdftoppm failed: ${String(raster.stderr || raster.stdout || "").trim() || "unknown error"}`);
    }
    const png = await fs.readFile(outputPath);
    const dims = pngDimensions(png);
    return {
      hash: sha256(png),
      byteLength: png.length,
      width: dims?.width ?? 0,
      height: dims?.height ?? 0,
    };
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}

async function extractFingerprint(bytes) {
  const loadingTask = getDocument({ data: bytes });
  const pdf = await loadingTask.promise;
  const pages = [];

  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const text = await page.getTextContent();
    const line = text.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    pages.push(line);
  }

  const parsed = await PDFDocument.load(bytes);
  const title = String(parsed.getTitle() || "").trim();
  const visual = await rasterizeFirstPage(bytes);

  return {
    pageCount: pdf.numPages,
    textHash: sha256(pages.join("\n")),
    title,
    visualHash: visual?.hash ?? null,
    visualWidth: visual?.width ?? null,
    visualHeight: visual?.height ?? null,
    visualBytes: visual?.byteLength ?? null,
  };
}

async function loadBaseline() {
  if (!baselineFile) return {};
  try {
    const raw = await fs.readFile(baselineFile, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

let failed = 0;
const baseline = await loadBaseline();
const nextBaseline = { ...baseline };

for (const target of targets) {
  console.log(`\nChecking ${target}`);
  const results = [];
  for (let i = 0; i < runs; i += 1) {
    const bytes = await fetchPdf(target);
    const fingerprint = await extractFingerprint(bytes);
    results.push(fingerprint);
    const visualSummary =
      fingerprint.visualHash && fingerprint.visualWidth && fingerprint.visualHeight
        ? ` visualHash=${fingerprint.visualHash.slice(0, 12)} visual=${fingerprint.visualWidth}x${fingerprint.visualHeight}`
        : "";
    console.log(
      `  run ${i + 1}: pages=${fingerprint.pageCount} textHash=${fingerprint.textHash.slice(0, 12)} title=${
        fingerprint.title || "<missing>"
      }${visualSummary}`
    );
  }

  const baselineRun = results[0];
  const mismatches = results.filter(
    (row) =>
      row.pageCount !== baselineRun.pageCount ||
      row.textHash !== baselineRun.textHash ||
      row.title !== baselineRun.title ||
      row.visualHash !== baselineRun.visualHash ||
      row.visualWidth !== baselineRun.visualWidth ||
      row.visualHeight !== baselineRun.visualHeight
  );

  if (mismatches.length > 0) {
    failed += 1;
    console.error(`  FAIL: unstable PDF output detected across ${runs} runs.`);
    continue;
  }

  if (!baselineRun.title) {
    failed += 1;
    console.error("  FAIL: metadata title missing.");
    continue;
  }

  if (visualEnabled && popplerAvailable && (!baselineRun.visualHash || baselineRun.visualWidth === 0)) {
    failed += 1;
    console.error("  FAIL: visual fingerprint missing or invalid.");
    continue;
  }

  if (baselineFile && !updateBaseline && baseline[target]) {
    const expected = baseline[target];
    const drift =
      expected.pageCount !== baselineRun.pageCount ||
      expected.textHash !== baselineRun.textHash ||
      expected.title !== baselineRun.title ||
      expected.visualHash !== baselineRun.visualHash ||
      expected.visualWidth !== baselineRun.visualWidth ||
      expected.visualHeight !== baselineRun.visualHeight;
    if (drift) {
      failed += 1;
      console.error("  FAIL: differs from stored regression baseline.");
      continue;
    }
  }

  nextBaseline[target] = baselineRun;
  console.log(`  PASS: stable across ${runs} runs.`);
}

if (baselineFile && updateBaseline) {
  await fs.mkdir(path.dirname(baselineFile), { recursive: true });
  await fs.writeFile(baselineFile, JSON.stringify(nextBaseline, null, 2));
  console.log(`\nUpdated baseline file: ${baselineFile}`);
}

if (failed > 0) {
  console.error(`\nPDF regression check failed for ${failed} endpoint(s).`);
  process.exit(1);
}

console.log("\nPDF regression check passed.");

