alter table public.profiles
  drop column if exists profile_photo_prompt_completed_at,
  drop column if exists profile_photo_updated_at,
  drop column if exists profile_photo_path;
