-- Rollback for 2026-02-16_add_document_versioning_backbone.sql

alter table public.completions
  drop column if exists document_version_id;

drop index if exists document_versions_document_created_at_idx;
drop index if exists document_versions_document_version_unique;
drop table if exists public.document_versions;

alter table public.documents
  drop column if exists current_version_id,
  drop column if exists version_count,
  drop column if exists source_type,
  drop column if exists sync_mode,
  drop column if exists source_file_id,
  drop column if exists source_revision_id,
  drop column if exists source_url;

