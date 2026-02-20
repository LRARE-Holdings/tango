-- Explicit analytics permission for licensed non-admin members.
-- Rollback: drop can_view_analytics from workspace_members.
-- Safe to run multiple times.

alter table public.workspace_members
  add column if not exists can_view_analytics boolean not null default false;

