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
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_PERSONAL_MONTHLY",
  "STRIPE_PRICE_PERSONAL_ANNUAL",
  "STRIPE_PRICE_PRO_MONTHLY",
  "STRIPE_PRICE_PRO_ANNUAL",
  "STRIPE_PRICE_TEAM_MONTHLY",
  "STRIPE_PRICE_TEAM_ANNUAL",
];

const missing = required.filter((key) => !process.env[key] || String(process.env[key]).trim().length === 0);

if (missing.length > 0) {
  console.error("Missing required environment variables:");
  for (const key of missing) console.error(`- ${key}`);
  process.exit(1);
}

console.log(`Environment verification passed (${required.length} required vars).`);

