-- Adds workspace-level member profile photo governance controls.
-- Safe to run multiple times.

alter table public.workspaces
  add column if not exists member_profile_photo_mode text not null default 'allow',
  add column if not exists member_profile_photo_path text,
  add column if not exists member_profile_photo_updated_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'workspaces_member_profile_photo_mode_check'
      and conrelid = 'public.workspaces'::regclass
  ) then
    alter table public.workspaces
      add constraint workspaces_member_profile_photo_mode_check
      check (member_profile_photo_mode in ('allow', 'disabled', 'company'));
  end if;
end
$$;
