-- Adds user-facing version labels (e.g. 1.2) to document_versions.
-- Safe to run multiple times.

alter table public.document_versions
  add column if not exists version_label text;

update public.document_versions
set version_label = version_number::text
where version_label is null or trim(version_label) = '';

create unique index if not exists document_versions_document_label_unique
  on public.document_versions (document_id, version_label);

