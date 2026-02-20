-- Adds profile preference fields used by /app/account and /api/app/me.
-- Safe to run multiple times.
alter table public.profiles
  add column if not exists display_name text,
  add column if not exists marketing_opt_in boolean not null default false,
  add column if not exists default_ack_limit integer not null default 1,
  add column if not exists default_password_enabled boolean not null default false;

-- Enforce valid range for acknowledgement limit.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_default_ack_limit_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_default_ack_limit_check
      check (default_ack_limit between 1 and 50);
  end if;
end
$$;
