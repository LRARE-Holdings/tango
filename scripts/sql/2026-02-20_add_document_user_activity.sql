-- Per-user recent file access log for dashboard recents.
-- Rollback: drop table document_user_activity.
-- Safe to run multiple times.

create table if not exists public.document_user_activity (
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  last_action text not null default 'opened',
  last_opened_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, document_id)
);

create index if not exists document_user_activity_user_opened_idx
  on public.document_user_activity (user_id, last_opened_at desc);

alter table public.document_user_activity enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'document_user_activity'
      and policyname = 'document_user_activity_select_own'
  ) then
    create policy document_user_activity_select_own
      on public.document_user_activity
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'document_user_activity'
      and policyname = 'document_user_activity_insert_own'
  ) then
    create policy document_user_activity_insert_own
      on public.document_user_activity
      for insert
      to authenticated
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'document_user_activity'
      and policyname = 'document_user_activity_update_own'
  ) then
    create policy document_user_activity_update_own
      on public.document_user_activity
      for update
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

