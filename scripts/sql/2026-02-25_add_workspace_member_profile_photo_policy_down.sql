alter table public.workspaces
  drop constraint if exists workspaces_member_profile_photo_mode_check,
  drop column if exists member_profile_photo_updated_at,
  drop column if exists member_profile_photo_path,
  drop column if exists member_profile_photo_mode;
