# Receipt Go-Live Checklist

## 1) Vercel environment verification (Production scope)
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `NEXT_PUBLIC_APP_URL`
- [ ] `RECEIPT_PUBLIC_ACCESS_SECRET`
- [ ] `RECEIPT_LAUNCH_PASSWORD`
- [ ] `RECEIPT_LAUNCH_AT` (optional override, valid ISO datetime)
- [ ] `RESEND_API_KEY`
- [ ] `RECEIPT_FROM_EMAIL`
- [ ] `TURNSTILE_SECRET_KEY`
- [ ] `ENABLE_DEBUG_ENDPOINTS=false`
- [ ] `NEXT_PUBLIC_SENTRY_DSN`
- [ ] `SENTRY_DSN`
- [ ] `STRIPE_SECRET_KEY`
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- [ ] `NEXT_PUBLIC_STRIPE_CHECKOUT_MODE` (`custom` or `hosted`, recommended `custom`)
- [ ] `STRIPE_WEBHOOK_SECRET`
- [ ] `STRIPE_PRICE_PERSONAL_MONTHLY`
- [ ] `STRIPE_PRICE_PERSONAL_ANNUAL`
- [ ] `STRIPE_PRICE_PRO_MONTHLY`
- [ ] `STRIPE_PRICE_PRO_ANNUAL`
- [ ] `STRIPE_PRICE_TEAM_MONTHLY`
- [ ] `STRIPE_PRICE_TEAM_ANNUAL`
- [ ] `UPSTASH_REDIS_REST_URL` (production)
- [ ] `UPSTASH_REDIS_REST_TOKEN` (production)
- [ ] Sentry org/project/auth vars required for release + sourcemap upload

Run:
- `npm run release:verify-env`

## 2) Database readiness
- [ ] All production migrations applied (`scripts/sql/*`).
- [ ] Versioning tables/columns exist and backfills verified.
- [ ] Responsibility tables/permissions verified.

## 3) Third-party readiness
- [ ] Resend sender domain verified.
- [ ] Stripe webhook endpoint configured and signing secret matches.
- [ ] Sentry release creation + sourcemap upload succeeds in production build.

## 4) Deployment readiness
- [ ] Preview deployment tested with QA matrix.
- [ ] `npm run qa:full` passes.
- [ ] `npm run test:e2e` passes.
- [ ] `npm run test:security` passes.
- [ ] `npm run qa:gate` passes.
- [ ] No open P0/P1 defects.

## 5) Launch and immediate validation
- [ ] Deploy to production.
- [ ] Validate: auth, create PDF/DOCX, share email, recipient sign, version upload, export JSON/PDF, checkout.
- [ ] Monitor first 24h for:
  - [ ] Sentry errors
  - [ ] API 5xx rates
  - [ ] Email failure rates
  - [ ] Billing webhook failures

## 6) Ownership
- [ ] Launch owner on-call assigned.
- [ ] Incident escalation channel confirmed.
- [ ] Roll-forward hotfix owner assigned.
