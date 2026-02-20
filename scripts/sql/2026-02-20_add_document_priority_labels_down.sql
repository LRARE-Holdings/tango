alter table public.documents
  drop constraint if exists documents_priority_check;

alter table public.documents
  drop column if exists labels,
  drop column if exists priority;

