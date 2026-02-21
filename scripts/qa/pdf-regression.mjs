#!/usr/bin/env node

import crypto from "node:crypto";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const baseUrl = (process.env.BASE_URL || "").replace(/\/$/, "");
const authCookie = process.env.AUTH_COOKIE || "";
const runs = Math.max(2, Number(process.env.RUNS || 5));

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

  return {
    pageCount: pdf.numPages,
    textHash: crypto.createHash("sha256").update(pages.join("\n")).digest("hex"),
  };
}

let failed = 0;

for (const target of targets) {
  console.log(`\nChecking ${target}`);
  const results = [];
  for (let i = 0; i < runs; i += 1) {
    const bytes = await fetchPdf(target);
    const fingerprint = await extractFingerprint(bytes);
    results.push(fingerprint);
    console.log(`  run ${i + 1}: pages=${fingerprint.pageCount} textHash=${fingerprint.textHash.slice(0, 12)}`);
  }

  const baseline = results[0];
  const mismatches = results.filter(
    (row) => row.pageCount !== baseline.pageCount || row.textHash !== baseline.textHash
  );

  if (mismatches.length > 0) {
    failed += 1;
    console.error(`  FAIL: unstable PDF output detected across ${runs} runs.`);
    continue;
  }

  console.log(`  PASS: stable across ${runs} runs.`);
}

if (failed > 0) {
  console.error(`\nPDF regression check failed for ${failed} endpoint(s).`);
  process.exit(1);
}

console.log("\nPDF regression check passed.");
