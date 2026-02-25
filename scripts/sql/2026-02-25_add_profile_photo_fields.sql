-- Adds profile photo fields and one-time photo prompt tracking.
-- Safe to run multiple times.

alter table public.profiles
  add column if not exists profile_photo_path text,
  add column if not exists profile_photo_updated_at timestamptz,
  add column if not exists profile_photo_prompt_completed_at timestamptz;

-- Existing users should not be forced through new profile photo onboarding.
update public.profiles
set profile_photo_prompt_completed_at = now()
where profile_photo_prompt_completed_at is null;
