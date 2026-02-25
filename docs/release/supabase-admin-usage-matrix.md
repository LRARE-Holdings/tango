# Supabase Service-Role Usage Matrix

## Scope
This matrix tracks current `supabaseAdmin()` usage and whether each call is required (privileged/system) or a candidate for migration to session-scoped clients + RLS.

## Classification
- `Required`: privileged/system operation where service role is expected.
- `Candidate`: user-scoped read/write that should move to session client once RLS policies exist.
- `Mixed`: endpoint contains both required and candidate calls.

## Current high-priority surfaces
| Surface | Current usage | Classification | Action |
| --- | --- | --- | --- |
| `src/app/api/billing/webhook/route.ts` | Stripe webhook upserts + reconciliation | Required | Keep service role; verify least-privilege writes only. |
| `src/app/api/public/[publicId]/route.ts` | Public doc lookup + signed URL generation | Required | Keep service role for public signed URL flow. |
| `src/app/api/public/[publicId]/submit/route.ts` | Public acknowledgement writes | Required | Keep service role for unauthenticated public completion writes. |
| `src/app/api/app/documents/route.ts` | Authenticated doc list + completions aggregation | Mixed | Move completions read to session client after RLS policy for `completions` by workspace membership. |
| `src/app/api/app/home/route.ts` | Dashboard reads for user/workspace | Mixed | Reduce service-role reads to only non-RLS-safe aggregates. |
| `src/lib/workspace-analytics.ts` | Documents via session, completions via admin | Mixed | Add RLS for completions, then remove admin client from analytics path. |
| `src/app/api/app/workspaces/[id]/documents/route.ts` | Workspace document and aggregate reads | Mixed | Convert per-user reads to session client + role checks; reserve admin for cross-user aggregate fallback only. |
| `src/app/api/app/workspaces/[id]/dashboard/route.ts` | Workspace dashboard aggregates | Mixed | Migrate user-scope reads to session client after policy additions. |
| `src/app/api/app/workspaces/[id]/members/[userId]/route.ts` | Membership administration | Required | Keep service role for admin mutations; continue role checks before writes. |
| `src/app/api/app/workspaces/[id]/licenses/**` | License assignment and entitlement mutations | Required | Keep service role for licensing writes and audit trails. |

## Completed in this hardening pass
- Standardized auth failure handling to avoid leaking provider internals on `getUser()` failures.
- Reduced unauthenticated `500` behavior on protected routes to deterministic `401`.
- Added typed Supabase client wiring (`src/types/supabase.ts`, `src/lib/supabase/*`).

## Follow-up migration sequence
1. Add/verify RLS on `completions` and workspace-scoped aggregate tables.
2. Migrate `documents/home/dashboard` user-scope reads from admin client to session client.
3. Keep service-role usage only for webhooks, unauthenticated public workflows, and explicit admin mutations.
