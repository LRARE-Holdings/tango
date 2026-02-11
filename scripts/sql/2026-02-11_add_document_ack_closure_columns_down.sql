-- Rollback for acknowledgement-closure columns.

alter table public.documents
  drop constraint if exists documents_max_acknowledgers_positive_when_enabled;

alter table public.documents
  drop column if exists closed_at,
  drop column if exists max_acknowledgers,
  drop column if exists max_acknowledgers_enabled;

drop index if exists public.completions_document_ack_idx;

