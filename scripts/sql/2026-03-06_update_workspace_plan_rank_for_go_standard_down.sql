-- Revert workspace plan ranking to pre-Go/Standard mapping.
create or replace function public.workspace_plan_rank(plan_value text)
returns integer
language sql
stable
as $$
  select case lower(coalesce(plan_value, 'free'))
    when 'free' then 0
    when 'personal' then 1
    when 'pro' then 2
    when 'team' then 3
    when 'enterprise' then 4
    else 0
  end;
$$;
