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

## Evidence and exports
- [ ] JSON evidence export works.
- [ ] PDF evidence export works.

## Billing
- [ ] Checkout starts with valid plan.
- [ ] Portal opens for active subscriber.
- [ ] Webhook events update profile plan/status.

## Gate D: UAT signoff
- [ ] Owner/admin signoff captured.
- [ ] Member signoff captured.
- [ ] No P0/P1 issues open.

