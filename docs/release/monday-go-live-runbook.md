# Monday Go-Live Runbook (February 23, 2026)

## 1) Pre-release gating (Preview/Staging)
- Run: `npm run release:verify-env`
- Run: `BASE_URL=<preview-url> npm run qa:full`
- Run: `BASE_URL=<preview-url> npm run test:e2e`
- Run: `BASE_URL=<preview-url> npm run test:security`
- Confirm no Critical/High findings remain.

## 2) Dedicated QA billing validation (Live config)
- Use a dedicated internal QA account/workspace only.
- Execute:
- Checkout session creation for each targeted plan path.
- Billing portal open and return flow.
- Webhook validation with invalid signature (must return `400`).
- Post-validation cleanup:
- Cancel active QA subscription(s).
- Confirm no customer workspace records were touched.

## 3) Production deployment checklist
- Deploy production build.
- Validate headers/CSP on `/`, `/auth`, `/app`, and one public `/d/*` route.
- Validate debug endpoints are disabled (`/api/debug/me`, `/api/sentry-example-api` => `404`).
- Validate public abuse controls:
- Missing captcha rejected on public mutation endpoints.
- Rate-limit behavior returns `429` + `Retry-After`.

## 4) First-hour monitoring
- Watch Sentry error volume and new issue rate.
- Watch API 5xx rate and route-level spikes.
- Watch webhook failures and email send failures.
- Watch auth failures and sudden 401/403 spikes.

## 5) Rollback triggers
- Any unresolved Critical issue in auth, billing, or acknowledgement flow.
- Sustained elevated 5xx rate on core customer endpoints.
- Broken checkout or webhook mapping.
- Inability to complete public acknowledgement on valid flows.

## 6) Rollback procedure
- Revert to last known good deployment.
- Re-run `qa:smoke` and targeted security checks.
- Open incident channel and assign owner for fix-forward.

