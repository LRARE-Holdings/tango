# Receipt Automated Test Data Contract

## Purpose
- Define the env-driven seeded data required for Playwright `test:e2e` and `test:security` in preview and production-safe QA runs.

## Required baseline env
- `BASE_URL`
- `ENABLE_DEBUG_ENDPOINTS`

## Public flow contract env
- `PUBLIC_DOC_ID`
- `PUBLIC_DOC_WRONG_PASSWORD`
- `TURNSTILE_TEST_TOKEN`
- `PUBLIC_STACK_ID`
- `PUBLIC_STACK_RECIPIENT_EMAIL`

## Workspace role matrix contract env
- `WORKSPACE_IDENTIFIER`
- `WORKSPACE_OWNER_COOKIE`
- `WORKSPACE_MEMBER_COOKIE`

## Optional stress test env
- `ENABLE_RATE_LIMIT_STRESS_TEST=true`

## Notes
- Leave optional env values unset to skip corresponding tests.
- Use dedicated non-customer documents and stack links for security tests.
- Never use production customer cookies in CI.
