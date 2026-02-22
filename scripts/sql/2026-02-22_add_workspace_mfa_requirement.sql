-- Workspace security control: require MFA for licensed members.
-- Safe to run multiple times.

alter table public.workspaces
  add column if not exists mfa_required boolean not null default false;
