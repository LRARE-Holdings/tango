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

create unique index if not exists workspaces_slug_unique_idx
  on public.workspaces (lower(slug))
  where slug is not null;

with prepared as (
  select
    id,
    lower(
      regexp_replace(
        regexp_replace(
          regexp_replace(trim(name), '[^a-zA-Z0-9\s-]', '', 'g'),
          '\s+',
          '-',
          'g'
        ),
        '-+',
        '-',
        'g'
      )
    ) as base_slug
  from public.workspaces
  where slug is null
),
ranked as (
  select
    id,
    case
      when base_slug is null or base_slug = '' then 'workspace'
      else trim(both '-' from base_slug)
    end as normalized_slug,
    row_number() over (partition by base_slug order by id) as rn
  from prepared
),
final_slugs as (
  select
    id,
    case
      when rn = 1 then left(normalized_slug, 63)
      else left(normalized_slug, 58) || '-' || rn::text
    end as slug_candidate
  from ranked
)
update public.workspaces w
set slug = f.slug_candidate
from final_slugs f
where w.id = f.id
  and w.slug is null;

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
