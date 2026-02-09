-- Workspace settings foundation:
-- - public slug support (getreceipt.xyz/workspaces/<slug>)
-- - custom domain registration + DNS verification metadata

alter table public.workspaces
  add column if not exists slug text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'workspaces_slug_format_chk'
  ) then
    alter table public.workspaces
      add constraint workspaces_slug_format_chk
      check (
        slug is null
        or (
          char_length(slug) between 3 and 63
          and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
        )
      );
  end if;
end $$;

-- Backfill missing slugs with collision-safe candidates.
do $$
declare
  r record;
  base_slug text;
  candidate text;
  n integer;
begin
  for r in
    select id, name
    from public.workspaces
    where slug is null
    order by created_at nulls first, id
  loop
    base_slug := lower(
      regexp_replace(
        regexp_replace(
          regexp_replace(trim(coalesce(r.name, 'workspace')), '[^a-zA-Z0-9\s-]', '', 'g'),
          '\s+',
          '-',
          'g'
        ),
        '-+',
        '-',
        'g'
      )
    );

    base_slug := trim(both '-' from coalesce(base_slug, ''));
    if base_slug = '' then
      base_slug := 'workspace';
    end if;

    base_slug := left(base_slug, 63);
    candidate := base_slug;
    n := 2;

    while exists (
      select 1
      from public.workspaces w
      where w.id <> r.id
        and lower(w.slug) = lower(candidate)
    ) loop
      candidate := left(base_slug, greatest(1, 63 - length(n::text) - 1)) || '-' || n::text;
      n := n + 1;
    end loop;

    update public.workspaces
    set slug = candidate
    where id = r.id;
  end loop;
end $$;

alter table public.workspaces
  alter column slug set not null;

create unique index if not exists workspaces_slug_unique_idx
  on public.workspaces (lower(slug))
  where slug is not null;

create table if not exists public.workspace_domains (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  domain text not null,
  status text not null default 'pending'
    check (status in ('pending', 'verified', 'failed')),
  verification_method text not null default 'dns_txt',
  verification_record_name text not null,
  verification_record_type text not null default 'TXT',
  verification_record_value text not null,
  verified_at timestamptz null,
  created_by uuid null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists workspace_domains_domain_unique_idx
  on public.workspace_domains (lower(domain));

create index if not exists workspace_domains_workspace_idx
  on public.workspace_domains (workspace_id, created_at desc);

alter table public.workspace_domains enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'workspace_domains'
      and policyname = 'workspace_domains_select_member'
  ) then
    create policy workspace_domains_select_member
      on public.workspace_domains
      for select
      using (
        exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = workspace_domains.workspace_id
            and wm.user_id = auth.uid()
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'workspace_domains'
      and policyname = 'workspace_domains_insert_admin'
  ) then
    create policy workspace_domains_insert_admin
      on public.workspace_domains
      for insert
      with check (
        exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = workspace_domains.workspace_id
            and wm.user_id = auth.uid()
            and wm.role in ('owner', 'admin')
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'workspace_domains'
      and policyname = 'workspace_domains_update_admin'
  ) then
    create policy workspace_domains_update_admin
      on public.workspace_domains
      for update
      using (
        exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = workspace_domains.workspace_id
            and wm.user_id = auth.uid()
            and wm.role in ('owner', 'admin')
        )
      )
      with check (
        exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = workspace_domains.workspace_id
            and wm.user_id = auth.uid()
            and wm.role in ('owner', 'admin')
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'workspace_domains'
      and policyname = 'workspace_domains_delete_admin'
  ) then
    create policy workspace_domains_delete_admin
      on public.workspace_domains
      for delete
      using (
        exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = workspace_domains.workspace_id
            and wm.user_id = auth.uid()
            and wm.role in ('owner', 'admin')
        )
      );
  end if;
end $$;
