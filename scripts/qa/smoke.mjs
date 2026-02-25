#!/usr/bin/env node

/**
 * Smoke tests for critical Receipt endpoints.
 *
 * Usage:
 *   node scripts/qa/smoke.mjs
 *   BASE_URL=https://www.getreceipt.co node scripts/qa/smoke.mjs
 * Optional:
 *   AUTH_COOKIE="sb-access-token=...; sb-refresh-token=..."
 */

import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const localBaseUrl = "http://127.0.0.1:3000";
const explicitBaseUrl = String(process.env.BASE_URL || "")
  .trim()
  .replace(/\/$/, "");
const baseUrl = explicitBaseUrl || localBaseUrl;
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const shouldManageLocalServer =
  !explicitBaseUrl || explicitBaseUrl === localBaseUrl || explicitBaseUrl === "http://localhost:3000";

let managedServer = null;

async function waitForServer(url, timeoutMs = 90_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url, { method: "GET", redirect: "manual" });
      if (res.status > 0) return;
    } catch {
      // keep polling
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Server did not become ready in ${timeoutMs}ms (${url})`);
}

function ensureBuildExists() {
  if (existsSync(".next/BUILD_ID")) return;
  console.log("No production build found; running `npm run build`...");
  const result = spawnSync(npmCommand, ["run", "build"], { stdio: "inherit", env: process.env });
  if (result.status !== 0) {
    throw new Error("Could not build project for local smoke test.");
  }
}

async function startManagedLocalServer() {
  ensureBuildExists();
  console.log(`Starting local server for smoke test at ${localBaseUrl}...`);
  managedServer = spawn(npmCommand, ["run", "start", "--", "--hostname", "127.0.0.1", "--port", "3000"], {
    stdio: "inherit",
    env: process.env,
  });
  await waitForServer(localBaseUrl);
}

function stopManagedLocalServer() {
  if (!managedServer) return;
  managedServer.kill("SIGTERM");
  managedServer = null;
}

const authCookie = process.env.AUTH_COOKIE || "";

const checks = [
  { name: "Marketing home", path: "/", expect: [200] },
  { name: "Pricing page", path: "/pricing", expect: [200] },
  { name: "Auth page", path: "/auth", expect: [200, 302, 307] },
  { name: "App shell (redirect or auth)", path: "/app", expect: [200, 302, 307, 401] },
  { name: "Public doc missing", path: "/api/public/not-a-real-id", expect: [404] },
  { name: "API me (auth-aware)", path: "/api/app/me", expect: [200, 401] },
  { name: "API documents list (auth-aware)", path: "/api/app/documents", expect: [200, 401] },
  { name: "Checkout session API", path: "/api/billing/checkout/session", expect: [405] },
  { name: "Billing portal (auth-aware)", path: "/api/billing/portal", expect: [401, 405] },
];

async function runCheck(check) {
  const headers = {};
  if (authCookie) headers.cookie = authCookie;

  const res = await fetch(`${baseUrl}${check.path}`, {
    method: "GET",
    headers,
    redirect: "manual",
  });

  const ok = check.expect.includes(res.status);
  return { ...check, status: res.status, ok };
}

const results = [];
try {
  if (shouldManageLocalServer) {
    await startManagedLocalServer();
  }

  for (const check of checks) {
    try {
      const result = await runCheck(check);
      results.push(result);
    } catch (error) {
      results.push({ ...check, status: "ERR", ok: false, error: String(error) });
    }
  }
} finally {
  stopManagedLocalServer();
}

const failed = results.filter((r) => !r.ok);

for (const r of results) {
  const icon = r.ok ? "PASS" : "FAIL";
  const details = r.error ? ` (${r.error})` : "";
  console.log(`${icon} ${r.name}: ${r.status}${details}`);
}

if (failed.length > 0) {
  console.error(`\nSmoke test failed: ${failed.length} check(s) did not match expected status codes.`);
  process.exit(1);
}

console.log("\nSmoke test passed.");
