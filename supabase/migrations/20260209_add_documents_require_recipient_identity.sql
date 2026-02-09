-- Adds per-document requirement for recipient identity (name + email) at acknowledgement.
-- Safe to run multiple times.

alter table public.documents
  add column if not exists require_recipient_identity boolean not null default false;

create index if not exists documents_require_recipient_identity_idx
  on public.documents (require_recipient_identity);

