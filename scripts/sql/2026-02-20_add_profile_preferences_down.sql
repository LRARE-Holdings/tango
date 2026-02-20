-- Rollback: remove profile preference fields and range constraint.
alter table public.profiles
  drop constraint if exists profiles_default_ack_limit_check,
  drop column if exists default_password_enabled,
  drop column if exists default_ack_limit,
  drop column if exists marketing_opt_in,
  drop column if exists display_name;
