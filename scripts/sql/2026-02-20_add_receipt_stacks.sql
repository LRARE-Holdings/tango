-- Receipt stacks for file organization.
-- Private by default, shareable with selected workspace members.
-- Rollback: drop receipt_stack_shares, receipt_stack_items, receipt_stacks in reverse order.
-- Safe to run multiple times.

create table if not exists public.receipt_stacks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.receipt_stack_items (
  stack_id uuid not null references public.receipt_stacks(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  added_by uuid references auth.users(id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (stack_id, document_id)
);

create table if not exists public.receipt_stack_shares (
  stack_id uuid not null references public.receipt_stacks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (stack_id, user_id)
);

create index if not exists receipt_stacks_workspace_owner_idx
  on public.receipt_stacks (workspace_id, owner_user_id, created_at desc);
create index if not exists receipt_stack_items_document_idx
  on public.receipt_stack_items (document_id);
create index if not exists receipt_stack_shares_user_idx
  on public.receipt_stack_shares (user_id);

alter table public.receipt_stacks enable row level security;
alter table public.receipt_stack_items enable row level security;
alter table public.receipt_stack_shares enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'receipt_stacks'
      and policyname = 'receipt_stacks_select_access'
  ) then
    create policy receipt_stacks_select_access
      on public.receipt_stacks
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = receipt_stacks.workspace_id
            and wm.user_id = auth.uid()
        )
        and (
          receipt_stacks.owner_user_id = auth.uid()
          or exists (
            select 1
            from public.receipt_stack_shares rss
            where rss.stack_id = receipt_stacks.id
              and rss.user_id = auth.uid()
          )
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'receipt_stacks'
      and policyname = 'receipt_stacks_insert_owner'
  ) then
    create policy receipt_stacks_insert_owner
      on public.receipt_stacks
      for insert
      to authenticated
      with check (
        owner_user_id = auth.uid()
        and exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = receipt_stacks.workspace_id
            and wm.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'receipt_stacks'
      and policyname = 'receipt_stacks_update_owner'
  ) then
    create policy receipt_stacks_update_owner
      on public.receipt_stacks
      for update
      to authenticated
      using (owner_user_id = auth.uid())
      with check (owner_user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'receipt_stacks'
      and policyname = 'receipt_stacks_delete_owner'
  ) then
    create policy receipt_stacks_delete_owner
      on public.receipt_stacks
      for delete
      to authenticated
      using (owner_user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'receipt_stack_items'
      and policyname = 'receipt_stack_items_select_access'
  ) then
    create policy receipt_stack_items_select_access
      on public.receipt_stack_items
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.receipt_stacks rs
          where rs.id = receipt_stack_items.stack_id
            and (
              rs.owner_user_id = auth.uid()
              or exists (
                select 1
                from public.receipt_stack_shares rss
                where rss.stack_id = rs.id
                  and rss.user_id = auth.uid()
              )
            )
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'receipt_stack_items'
      and policyname = 'receipt_stack_items_manage_owner'
  ) then
    create policy receipt_stack_items_manage_owner
      on public.receipt_stack_items
      for all
      to authenticated
      using (
        exists (
          select 1
          from public.receipt_stacks rs
          where rs.id = receipt_stack_items.stack_id
            and rs.owner_user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1
          from public.receipt_stacks rs
          where rs.id = receipt_stack_items.stack_id
            and rs.owner_user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'receipt_stack_shares'
      and policyname = 'receipt_stack_shares_select_owner_or_self'
  ) then
    create policy receipt_stack_shares_select_owner_or_self
      on public.receipt_stack_shares
      for select
      to authenticated
      using (
        user_id = auth.uid()
        or exists (
          select 1
          from public.receipt_stacks rs
          where rs.id = receipt_stack_shares.stack_id
            and rs.owner_user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'receipt_stack_shares'
      and policyname = 'receipt_stack_shares_manage_owner'
  ) then
    create policy receipt_stack_shares_manage_owner
      on public.receipt_stack_shares
      for all
      to authenticated
      using (
        exists (
          select 1
          from public.receipt_stacks rs
          where rs.id = receipt_stack_shares.stack_id
            and rs.owner_user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1
          from public.receipt_stacks rs
          where rs.id = receipt_stack_shares.stack_id
            and rs.owner_user_id = auth.uid()
        )
      );
  end if;
end $$;

