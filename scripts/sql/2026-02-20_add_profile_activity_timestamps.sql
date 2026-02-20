-- Track user session activity for "while you were away" notifications.
-- Rollback: drop last_login_at and last_seen_at columns from profiles.
-- Safe to run multiple times.

alter table public.profiles
  add column if not exists last_login_at timestamptz,
  add column if not exists last_seen_at timestamptz;

