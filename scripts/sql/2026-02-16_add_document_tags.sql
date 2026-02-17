-- Workspace-configurable document tags.
-- Safe to run multiple times.

alter table public.workspaces
  add column if not exists document_tag_fields jsonb not null default '[]'::jsonb;

alter table public.documents
  add column if not exists tags jsonb not null default '{}'::jsonb;

