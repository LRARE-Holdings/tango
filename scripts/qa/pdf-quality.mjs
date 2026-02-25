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
const visualEnabled = process.env.PDF_VISUAL !== "0";
const visualRequired = process.env.PDF_VISUAL_REQUIRED === "1";

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
      "BASE_URL=https://www.getreceipt.co PDF_PATHS=/api/app/workspaces/<id>/analytics/report node scripts/qa/pdf-quality.mjs"
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

function commandExists(command) {
  const result = spawnSync("sh", ["-lc", `command -v ${command}`], { encoding: "utf8" });
  return result.status === 0 && String(result.stdout || "").trim().length > 0;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
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
  const message = "pdftoppm not found. Install poppler utils for visual quality checks.";
  if (visualRequired) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
  console.warn(`WARN: ${message} Continuing with structural-only quality checks.`);
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
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "receipt-pdf-quality-"));
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
      width: dims?.width ?? 0,
      height: dims?.height ?? 0,
      bytes: png.length,
    };
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}

async function inspectPdf(bytes) {
  const loadingTask = getDocument({ data: bytes });
  const pdf = await loadingTask.promise;
  let textLength = 0;

  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const text = await page.getTextContent();
    textLength += text.items
      .map((item) => ("str" in item ? String(item.str) : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim().length;
  }

  const parsed = await PDFDocument.load(bytes);
  const title = String(parsed.getTitle() || "").trim();
  const visual = await rasterizeFirstPage(bytes);

  return {
    pageCount: pdf.numPages,
    textLength,
    title,
    bytes: bytes.length,
    visualHash: visual?.hash ?? null,
    visualWidth: visual?.width ?? null,
    visualHeight: visual?.height ?? null,
    visualBytes: visual?.bytes ?? null,
  };
}

let failed = 0;

for (const target of targets) {
  try {
    console.log(`\nChecking ${target}`);
    const bytes = await fetchPdf(target);
    const details = await inspectPdf(bytes);

    if (details.pageCount < 1) {
      failed += 1;
      console.error("  FAIL: pageCount is 0.");
      continue;
    }
    if (details.textLength < 8) {
      failed += 1;
      console.error("  FAIL: extractable text too low.");
      continue;
    }
    if (!details.title) {
      failed += 1;
      console.error("  FAIL: metadata title missing.");
      continue;
    }
    if (details.bytes < 4096) {
      failed += 1;
      console.error("  FAIL: output PDF is unexpectedly small.");
      continue;
    }

    if (visualEnabled && popplerAvailable) {
      if (!details.visualHash || !details.visualWidth || !details.visualHeight) {
        failed += 1;
        console.error("  FAIL: first-page rasterization failed.");
        continue;
      }
      if (details.visualWidth < 400 || details.visualHeight < 400) {
        failed += 1;
        console.error("  FAIL: rasterized page dimensions are unexpectedly low.");
        continue;
      }
      if ((details.visualBytes ?? 0) < 1024) {
        failed += 1;
        console.error("  FAIL: rasterized page appears empty.");
        continue;
      }
    }

    const visualSummary =
      details.visualHash && details.visualWidth && details.visualHeight
        ? ` visualHash=${details.visualHash.slice(0, 12)} visual=${details.visualWidth}x${details.visualHeight}`
        : "";

    console.log(
      `  PASS: pages=${details.pageCount} textChars=${details.textLength} bytes=${details.bytes} title=${
        details.title
      }${visualSummary}`
    );
  } catch (error) {
    failed += 1;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`  FAIL: ${message}`);
  }
}

if (failed > 0) {
  console.error(`\nPDF quality check failed for ${failed} endpoint(s).`);
  process.exit(1);
}

console.log("\nPDF quality check passed.");

