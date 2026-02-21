-- Adds adjustable workspace logo width in pixels for Team/Enterprise branding.
-- Rollback: drop brand_logo_width_px from workspaces.

alter table public.workspaces
  add column if not exists brand_logo_width_px integer not null default 104;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'workspaces_brand_logo_width_px_check'
      and conrelid = 'public.workspaces'::regclass
  ) then
    alter table public.workspaces
      add constraint workspaces_brand_logo_width_px_check
      check (brand_logo_width_px between 48 and 320);
  end if;
end
$$;
