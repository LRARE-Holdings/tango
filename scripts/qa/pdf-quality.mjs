#!/usr/bin/env node

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { PDFDocument } from "pdf-lib";

const baseUrl = (process.env.BASE_URL || "").replace(/\/$/, "");
const authCookie = process.env.AUTH_COOKIE || "";

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
  ...pathList.map((path) => `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`),
];

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

  return {
    pageCount: pdf.numPages,
    textLength,
    title,
    bytes: bytes.length,
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

    console.log(
      `  PASS: pages=${details.pageCount} textChars=${details.textLength} bytes=${details.bytes} title=${details.title}`
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
