-- Adds enforceable acknowledgement-closure columns to documents.
-- Safe to run multiple times.

alter table public.documents
  add column if not exists max_acknowledgers_enabled boolean not null default false,
  add column if not exists max_acknowledgers integer,
  add column if not exists closed_at timestamptz;

-- Keep values sane when configured.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'documents_max_acknowledgers_positive_when_enabled'
  ) then
    alter table public.documents
      add constraint documents_max_acknowledgers_positive_when_enabled
      check (
        (max_acknowledgers_enabled = false)
        or (max_acknowledgers is not null and max_acknowledgers >= 1)
      );
  end if;
end $$;

-- Helpful for closure checks: count acknowledged completions by document.
create index if not exists completions_document_ack_idx
  on public.completions (document_id, acknowledged);

