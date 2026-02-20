alter table public.profiles
  drop column if exists last_seen_at,
  drop column if exists last_login_at;

