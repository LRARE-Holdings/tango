# Receipt Manual QA Matrix

## Scope
- Product surfaces: marketing, auth, app, recipient `/d/*`.
- Browser baseline: latest Chrome, Safari, Edge, Firefox; mobile Safari + mobile Chrome.

## Gate A: Static checks
- [ ] `npm run lint` (warnings accepted, no errors).
- [ ] `npm run build` passes.

## Gate B: Smoke checks
- [ ] `BASE_URL=<preview-or-prod-url> npm run qa:smoke` passes.

## Gate C: Critical journeys

## Authentication
- [ ] Sign up / sign in works.
- [ ] Password reset flow works end-to-end.
- [ ] Invite-password flow works.
- [ ] New users see one-time profile photo onboarding step with upload + skip.

## App shell and navigation
- [ ] Sidebar replaces header navigation on app routes.
- [ ] Sidebar collapse/expand works and persists after reload.
- [ ] Mobile sidebar drawer opens/closes with backdrop + escape.
- [ ] Bottom-left account cluster shows avatar and opens account/settings/sign-out menu.

## Document creation and sharing
- [ ] `/app/new` uploads PDF successfully.
- [ ] `/app/new` uploads DOCX successfully.
- [ ] Share link copy works.
- [ ] Sharing tab email sends (with valid Resend config).

## Versioning
- [ ] New version upload accepts PDF.
- [ ] New version upload accepts DOCX.
- [ ] Decimal version labels work (e.g., `1.2`).
- [ ] Version history updates and current version indicator changes.
- [ ] Version notification popup and “Do not show again” behavior works.

## Recipient flow
- [ ] Public link opens and renders.
- [ ] Password-protected doc enforces access.
- [ ] Identity-required acknowledgement enforces name/email.
- [ ] Submission writes completion and updates owner dashboard counts.

## Workspace and ownership
- [ ] Owner/admin can open workspace docs dashboard.
- [ ] Member sees member-appropriate dashboard behavior.
- [ ] Cross-ownership save/update works.
- [ ] Branding settings allow Team/Enterprise admins to set member profile photo mode (`allow`, `disabled`, `company`).
- [ ] Company profile photo upload/remove works and enforces member avatar override when policy is `company`.

## Evidence and exports
- [ ] JSON evidence export works.
- [ ] PDF evidence export works.
- [ ] PDF layout uses portrait A4 consistently for v3 exports.
- [ ] Header logo alignment is stable (workspace logo and Receipt fallback).
- [ ] Table wrapping does not overlap or clip on long values.
- [ ] Footer is consistent across pages (label, powered-by mark, page counts).
- [ ] No orphan/widow text artifacts at page boundaries for long sections.

## Billing
- [ ] Custom checkout loads in-app for valid plan/billing query.
- [ ] Promotion code applies/removes in custom checkout.
- [ ] Checkout confirms and redirects to `/app/billing/success`.
- [ ] Portal opens for active subscriber.
- [ ] Portal deep links open for payment method update, subscription update, and cancellation.
- [ ] Webhook events update profile plan/status.

## Gate D: UAT signoff
- [ ] Owner/admin signoff captured.
- [ ] Member signoff captured.
- [ ] No P0/P1/P2 issues open.
