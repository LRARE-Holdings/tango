alter table public.documents
  drop column if exists tags;

alter table public.workspaces
  drop column if exists document_tag_fields;

