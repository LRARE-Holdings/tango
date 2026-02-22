-- Workspace contacts, groups, templates, and searchable co-ownership support.
-- Safe to run multiple times.

create table if not exists public.workspace_contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  email text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contact_groups (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contact_group_members (
  workspace_id uuid not null,
  group_id uuid not null,
  contact_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (group_id, contact_id)
);

create table if not exists public.workspace_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text,
  settings jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete cascade,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Composite uniqueness supports same-workspace foreign keys on the join table.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'workspace_contacts_workspace_id_id_unique'
      and conrelid = 'public.workspace_contacts'::regclass
  ) then
    alter table public.workspace_contacts
      add constraint workspace_contacts_workspace_id_id_unique unique (workspace_id, id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'contact_groups_workspace_id_id_unique'
      and conrelid = 'public.contact_groups'::regclass
  ) then
    alter table public.contact_groups
      add constraint contact_groups_workspace_id_id_unique unique (workspace_id, id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'contact_group_members_workspace_group_fkey'
      and conrelid = 'public.contact_group_members'::regclass
  ) then
    alter table public.contact_group_members
      add constraint contact_group_members_workspace_group_fkey
      foreign key (workspace_id, group_id)
      references public.contact_groups(workspace_id, id)
      on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'contact_group_members_workspace_contact_fkey'
      and conrelid = 'public.contact_group_members'::regclass
  ) then
    alter table public.contact_group_members
      add constraint contact_group_members_workspace_contact_fkey
      foreign key (workspace_id, contact_id)
      references public.workspace_contacts(workspace_id, id)
      on delete cascade;
  end if;
end
$$;

create unique index if not exists workspace_contacts_workspace_email_ci_uidx
  on public.workspace_contacts (workspace_id, lower(email));

create index if not exists workspace_contacts_workspace_name_ci_idx
  on public.workspace_contacts (workspace_id, lower(name));

create unique index if not exists contact_groups_workspace_name_ci_uidx
  on public.contact_groups (workspace_id, lower(name));

create index if not exists contact_group_members_group_idx
  on public.contact_group_members (group_id);

create index if not exists contact_group_members_contact_idx
  on public.contact_group_members (contact_id);

create index if not exists contact_group_members_workspace_group_idx
  on public.contact_group_members (workspace_id, group_id);

create unique index if not exists workspace_templates_workspace_name_ci_uidx
  on public.workspace_templates (workspace_id, lower(name));

create index if not exists workspace_templates_workspace_updated_idx
  on public.workspace_templates (workspace_id, updated_at desc);

create index if not exists workspace_members_workspace_role_user_idx
  on public.workspace_members (workspace_id, role, user_id);

do $$
begin
  begin
    create extension if not exists pg_trgm;
  exception when insufficient_privilege then
    null;
  end;

  if exists (select 1 from pg_extension where extname = 'pg_trgm') then
    execute 'create index if not exists profiles_display_name_trgm_idx on public.profiles using gin (lower(display_name) gin_trgm_ops)';
  end if;
end
$$;

create or replace function public.workspace_plan_rank(plan_value text)
returns integer
language sql
immutable
as $$
  select case lower(coalesce(plan_value, 'free'))
    when 'free' then 0
    when 'personal' then 1
    when 'pro' then 2
    when 'team' then 3
    when 'enterprise' then 4
    else 0
  end;
$$;

create or replace function public.workspace_feature_enabled(p_workspace_id uuid, p_feature_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  feature_key text := lower(coalesce(p_feature_key, ''));
  workspace_plan text := 'free';
  billing_owner_id uuid;
begin
  select coalesce(w.billing_owner_user_id, w.created_by)
    into billing_owner_id
  from public.workspaces w
  where w.id = p_workspace_id;

  if billing_owner_id is not null then
    select coalesce(pe.plan, p.plan, 'free')
      into workspace_plan
    from public.profiles p
    left join public.profile_entitlements pe
      on pe.id = p.id
    where p.id = billing_owner_id;
  end if;

  if feature_key in ('contacts', 'templates') then
    return public.workspace_plan_rank(workspace_plan) >= public.workspace_plan_rank('pro');
  end if;

  return false;
end;
$$;

create or replace function public.search_workspace_co_owners(
  p_workspace_id uuid,
  p_q text,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  user_id uuid,
  email text,
  display_name text,
  role text,
  license_active boolean,
  hint text
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  search_query text := lower(trim(coalesce(p_q, '')));
  safe_limit integer := greatest(1, least(coalesce(p_limit, 20), 20));
  safe_offset integer := greatest(0, coalesce(p_offset, 0));
begin
  if auth.uid() is null then
    return;
  end if;

  if not exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = auth.uid()
  ) then
    return;
  end if;

  if length(search_query) < 2 then
    return;
  end if;

  return query
  select
    wm.user_id,
    au.email,
    p.display_name,
    wm.role::text,
    coalesce(wm.license_active, true) as license_active,
    case
      when coalesce(wm.license_active, true) = false then initcap(wm.role::text) || ' • License inactive'
      else initcap(wm.role::text) || ' • License active'
    end as hint
  from public.workspace_members wm
  left join public.profiles p
    on p.id = wm.user_id
  left join auth.users au
    on au.id = wm.user_id
  where wm.workspace_id = p_workspace_id
    and (
      lower(coalesce(p.display_name, '')) like '%' || search_query || '%'
      or lower(coalesce(au.email, '')) like '%' || search_query || '%'
      or cast(wm.user_id as text) like '%' || search_query || '%'
    )
  order by
    case wm.role
      when 'owner' then 0
      when 'admin' then 1
      else 2
    end,
    lower(coalesce(p.display_name, au.email, cast(wm.user_id as text))),
    wm.user_id
  limit safe_limit
  offset safe_offset;
end;
$$;

alter table public.workspace_contacts enable row level security;
alter table public.contact_groups enable row level security;
alter table public.contact_group_members enable row level security;
alter table public.workspace_templates enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'workspace_contacts' and policyname = 'workspace_contacts_member_select'
  ) then
    create policy workspace_contacts_member_select
      on public.workspace_contacts
      for select
      to authenticated
      using (
        public.workspace_feature_enabled(workspace_contacts.workspace_id, 'contacts')
        and exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = workspace_contacts.workspace_id
            and wm.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'workspace_contacts' and policyname = 'workspace_contacts_member_insert'
  ) then
    create policy workspace_contacts_member_insert
      on public.workspace_contacts
      for insert
      to authenticated
      with check (
        public.workspace_feature_enabled(workspace_contacts.workspace_id, 'contacts')
        and exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = workspace_contacts.workspace_id
            and wm.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'workspace_contacts' and policyname = 'workspace_contacts_member_update'
  ) then
    create policy workspace_contacts_member_update
      on public.workspace_contacts
      for update
      to authenticated
      using (
        public.workspace_feature_enabled(workspace_contacts.workspace_id, 'contacts')
        and exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = workspace_contacts.workspace_id
            and wm.user_id = auth.uid()
        )
      )
      with check (
        public.workspace_feature_enabled(workspace_contacts.workspace_id, 'contacts')
        and exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = workspace_contacts.workspace_id
            and wm.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'workspace_contacts' and policyname = 'workspace_contacts_member_delete'
  ) then
    create policy workspace_contacts_member_delete
      on public.workspace_contacts
      for delete
      to authenticated
      using (
        public.workspace_feature_enabled(workspace_contacts.workspace_id, 'contacts')
        and exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = workspace_contacts.workspace_id
            and wm.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'contact_groups' and policyname = 'contact_groups_member_select'
  ) then
    create policy contact_groups_member_select
      on public.contact_groups
      for select
      to authenticated
      using (
        public.workspace_feature_enabled(contact_groups.workspace_id, 'contacts')
        and exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = contact_groups.workspace_id
            and wm.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'contact_groups' and policyname = 'contact_groups_admin_manage'
  ) then
    create policy contact_groups_admin_manage
      on public.contact_groups
      for all
      to authenticated
      using (
        public.workspace_feature_enabled(contact_groups.workspace_id, 'contacts')
        and exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = contact_groups.workspace_id
            and wm.user_id = auth.uid()
            and wm.role in ('owner', 'admin')
        )
      )
      with check (
        public.workspace_feature_enabled(contact_groups.workspace_id, 'contacts')
        and exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = contact_groups.workspace_id
            and wm.user_id = auth.uid()
            and wm.role in ('owner', 'admin')
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'contact_group_members' and policyname = 'contact_group_members_member_select'
  ) then
    create policy contact_group_members_member_select
      on public.contact_group_members
      for select
      to authenticated
      using (
        public.workspace_feature_enabled(contact_group_members.workspace_id, 'contacts')
        and exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = contact_group_members.workspace_id
            and wm.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'contact_group_members' and policyname = 'contact_group_members_admin_manage'
  ) then
    create policy contact_group_members_admin_manage
      on public.contact_group_members
      for all
      to authenticated
      using (
        public.workspace_feature_enabled(contact_group_members.workspace_id, 'contacts')
        and exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = contact_group_members.workspace_id
            and wm.user_id = auth.uid()
            and wm.role in ('owner', 'admin')
        )
      )
      with check (
        public.workspace_feature_enabled(contact_group_members.workspace_id, 'contacts')
        and exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = contact_group_members.workspace_id
            and wm.user_id = auth.uid()
            and wm.role in ('owner', 'admin')
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'workspace_templates' and policyname = 'workspace_templates_member_select'
  ) then
    create policy workspace_templates_member_select
      on public.workspace_templates
      for select
      to authenticated
      using (
        public.workspace_feature_enabled(workspace_templates.workspace_id, 'templates')
        and exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = workspace_templates.workspace_id
            and wm.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'workspace_templates' and policyname = 'workspace_templates_admin_manage'
  ) then
    create policy workspace_templates_admin_manage
      on public.workspace_templates
      for all
      to authenticated
      using (
        public.workspace_feature_enabled(workspace_templates.workspace_id, 'templates')
        and exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = workspace_templates.workspace_id
            and wm.user_id = auth.uid()
            and wm.role in ('owner', 'admin')
        )
      )
      with check (
        public.workspace_feature_enabled(workspace_templates.workspace_id, 'templates')
        and exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = workspace_templates.workspace_id
            and wm.user_id = auth.uid()
            and wm.role in ('owner', 'admin')
        )
      );
  end if;
end
$$;

-- Backfill workspace contacts from historical workspace recipient activity.
do $$
begin
  if to_regclass('public.recipients') is not null and to_regclass('public.documents') is not null then
    with deduped_recipients as (
      select distinct on (d.workspace_id, lower(trim(r.email)))
        d.workspace_id,
        coalesce(nullif(trim(r.name), ''), split_part(lower(trim(r.email)), '@', 1)) as name,
        lower(trim(r.email)) as email,
        d.owner_id as created_by
      from public.recipients r
      join public.documents d
        on d.id = r.document_id
      where d.workspace_id is not null
        and trim(coalesce(r.email, '')) <> ''
      order by
        d.workspace_id,
        lower(trim(r.email)),
        (nullif(trim(r.name), '') is not null) desc,
        lower(coalesce(r.name, '')) desc
    )
    insert into public.workspace_contacts (workspace_id, name, email, created_by)
    select
      dr.workspace_id,
      dr.name,
      dr.email,
      dr.created_by
    from deduped_recipients dr
    where not exists (
      select 1
      from public.workspace_contacts wc
      where wc.workspace_id = dr.workspace_id
        and lower(wc.email) = dr.email
    )
    on conflict do nothing;
  end if;
end
$$;
