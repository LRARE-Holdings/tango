#!/usr/bin/env node

/**
 * Verifies required environment variables for go-live.
 * Intended for CI/Vercel preflight.
 */

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_APP_URL",
  "RECEIPT_PUBLIC_ACCESS_SECRET",
  "RESEND_API_KEY",
  "RECEIPT_FROM_EMAIL",
  "TURNSTILE_SECRET_KEY",
  "ENABLE_DEBUG_ENDPOINTS",
  "NEXT_PUBLIC_SENTRY_DSN",
  "SENTRY_DSN",
  "STRIPE_SECRET_KEY",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_PERSONAL_MONTHLY",
  "STRIPE_PRICE_PERSONAL_ANNUAL",
  "STRIPE_PRICE_PRO_MONTHLY",
  "STRIPE_PRICE_PRO_ANNUAL",
  "STRIPE_PRICE_TEAM_MONTHLY",
  "STRIPE_PRICE_TEAM_ANNUAL",
];

const requiredInProduction = [
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
];

const missing = required.filter((key) => !process.env[key] || String(process.env[key]).trim().length === 0);

const isProduction =
  String(process.env.NODE_ENV || "").toLowerCase() === "production" ||
  String(process.env.VERCEL_ENV || "").toLowerCase() === "production";

if (isProduction) {
  for (const key of requiredInProduction) {
    if (!process.env[key] || String(process.env[key]).trim().length === 0) {
      missing.push(key);
    }
  }
}

if (missing.length > 0) {
  console.error("Missing required environment variables:");
  for (const key of [...new Set(missing)]) console.error(`- ${key}`);
  process.exit(1);
}

const debugEnabled = String(process.env.ENABLE_DEBUG_ENDPOINTS || "")
  .trim()
  .toLowerCase();
if (isProduction && (debugEnabled === "1" || debugEnabled === "true" || debugEnabled === "yes" || debugEnabled === "on")) {
  console.error("ENABLE_DEBUG_ENDPOINTS must be false in production.");
  process.exit(1);
}

const checkoutMode = String(process.env.NEXT_PUBLIC_STRIPE_CHECKOUT_MODE || "custom")
  .trim()
  .toLowerCase();
if (checkoutMode !== "custom" && checkoutMode !== "hosted") {
  console.error("NEXT_PUBLIC_STRIPE_CHECKOUT_MODE must be either 'custom' or 'hosted'.");
  process.exit(1);
}

console.log(
  `Environment verification passed (${required.length + (isProduction ? requiredInProduction.length : 0)} required vars checked).`
);
