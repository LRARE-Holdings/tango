-- Shared responsibility mapping for workspace documents.
-- Safe to run multiple times.

create table if not exists public.document_responsibilities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  coverage_role text not null default 'shared',
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now()
);

create unique index if not exists document_responsibilities_document_user_unique
  on public.document_responsibilities (document_id, user_id);

create index if not exists document_responsibilities_workspace_user_idx
  on public.document_responsibilities (workspace_id, user_id);

create index if not exists document_responsibilities_document_idx
  on public.document_responsibilities (document_id);
