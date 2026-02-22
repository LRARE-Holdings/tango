#!/usr/bin/env node

/**
 * Smoke tests for critical Receipt endpoints.
 *
 * Usage:
 *   BASE_URL=https://www.getreceipt.co node scripts/qa/smoke.mjs
 * Optional:
 *   AUTH_COOKIE="sb-access-token=...; sb-refresh-token=..."
 */

const baseUrl = (process.env.BASE_URL || "").replace(/\/$/, "");

if (!baseUrl) {
  console.error("Missing BASE_URL. Example: BASE_URL=https://www.getreceipt.co");
  process.exit(1);
}

const authCookie = process.env.AUTH_COOKIE || "";

const checks = [
  { name: "Marketing home", path: "/", expect: [200] },
  { name: "Pricing page", path: "/pricing", expect: [200] },
  { name: "Auth page", path: "/auth", expect: [200, 302, 307] },
  { name: "App shell (redirect or auth)", path: "/app", expect: [200, 302, 307, 401] },
  { name: "Public doc missing", path: "/api/public/not-a-real-id", expect: [404] },
  { name: "API me (auth-aware)", path: "/api/app/me", expect: [200, 401, 500] },
  { name: "API documents list (auth-aware)", path: "/api/app/documents", expect: [200, 401, 500] },
  { name: "Checkout session API", path: "/api/billing/checkout/session", expect: [405] },
  { name: "Billing portal (auth-aware)", path: "/api/billing/portal", expect: [200, 401, 405, 500] },
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
for (const check of checks) {
  try {
    const result = await runCheck(check);
    results.push(result);
  } catch (error) {
    results.push({ ...check, status: "ERR", ok: false, error: String(error) });
  }
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
