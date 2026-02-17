-- Rollback workspace seat licensing backbone.

alter table public.workspace_invites
  drop column if exists activation_blocked_reason;

alter table public.workspace_members
  drop column if exists license_revoked_by,
  drop column if exists license_revoked_at,
  drop column if exists license_assigned_by,
  drop column if exists license_assigned_at,
  drop column if exists license_active;

alter table public.workspaces
  drop column if exists billing_owner_user_id;
