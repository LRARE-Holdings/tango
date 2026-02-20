-- Adds normalized priority and labels for dashboard Files/Analytics UX.
-- Rollback: drop constraint, then drop labels and priority columns.
-- Safe to run multiple times.

alter table public.documents
  add column if not exists priority text not null default 'normal',
  add column if not exists labels text[] not null default '{}'::text[];

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'documents_priority_check'
  ) then
    alter table public.documents
      add constraint documents_priority_check
      check (priority in ('low', 'normal', 'high'));
  end if;
end $$;

update public.documents
set priority = case
  when lower(priority) in ('low', 'normal', 'high') then lower(priority)
  else 'normal'
end
where priority is distinct from case
  when lower(priority) in ('low', 'normal', 'high') then lower(priority)
  else 'normal'
end;

