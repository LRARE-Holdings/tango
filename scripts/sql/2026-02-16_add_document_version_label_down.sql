drop index if exists document_versions_document_label_unique;

alter table public.document_versions
  drop column if exists version_label;

