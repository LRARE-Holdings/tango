-- Workspace policy mode for Team/Enterprise workflow defaults.
-- Safe to run multiple times.

alter table public.workspaces
  add column if not exists policy_mode_enabled boolean not null default false;
