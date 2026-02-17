-- Workspace seat licensing backbone.
-- Safe to run multiple times.

alter table public.workspaces
  add column if not exists billing_owner_user_id uuid;

update public.workspaces
set billing_owner_user_id = created_by
where billing_owner_user_id is null;

alter table public.workspace_members
  add column if not exists license_active boolean not null default true,
  add column if not exists license_assigned_at timestamptz,
  add column if not exists license_assigned_by uuid,
  add column if not exists license_revoked_at timestamptz,
  add column if not exists license_revoked_by uuid;

update public.workspace_members
set
  license_active = true,
  license_assigned_at = coalesce(license_assigned_at, joined_at, now())
where license_active is null
   or license_assigned_at is null;

alter table public.workspace_invites
  add column if not exists activation_blocked_reason text;
