-- Versioning backbone for unified upload/cloud document sources.
-- Safe to run multiple times.

alter table public.documents
  add column if not exists current_version_id uuid,
  add column if not exists version_count integer not null default 1,
  add column if not exists source_type text,
  add column if not exists sync_mode text,
  add column if not exists source_file_id text,
  add column if not exists source_revision_id text,
  add column if not exists source_url text;

create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  version_number integer not null,
  source_type text not null default 'upload',
  source_file_id text,
  source_revision_id text,
  file_path text not null,
  sha256 text not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  superseded_at timestamptz
);

create unique index if not exists document_versions_document_version_unique
  on public.document_versions (document_id, version_number);

create index if not exists document_versions_document_created_at_idx
  on public.document_versions (document_id, created_at desc);

alter table public.completions
  add column if not exists document_version_id uuid references public.document_versions(id) on delete set null;

-- Backfill document_versions v1 rows for existing documents that don't yet have one.
insert into public.document_versions (document_id, version_number, source_type, file_path, sha256, created_by, created_at)
select
  d.id,
  1,
  coalesce(nullif(d.source_type, ''), 'upload'),
  d.file_path,
  coalesce(nullif(d.sha256, ''), md5(d.id::text)),
  d.owner_id,
  d.created_at
from public.documents d
where not exists (
  select 1
  from public.document_versions v
  where v.document_id = d.id
);

-- Point documents to the newest version row.
update public.documents d
set
  current_version_id = latest.id,
  version_count = latest.version_number
from (
  select distinct on (document_id) document_id, id, version_number
  from public.document_versions
  order by document_id, version_number desc
) latest
where latest.document_id = d.id
  and (d.current_version_id is null or d.current_version_id <> latest.id);

-- Backfill completions to current version when empty.
update public.completions c
set document_version_id = d.current_version_id
from public.documents d
where c.document_id = d.id
  and c.document_version_id is null
  and d.current_version_id is not null;

