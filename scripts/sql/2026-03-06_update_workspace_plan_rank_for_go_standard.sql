-- Extend plan ranking for new Go/Standard tiers while keeping legacy Personal compatibility.
create or replace function public.workspace_plan_rank(plan_value text)
returns integer
language sql
stable
as $$
  select case lower(coalesce(plan_value, 'free'))
    when 'free' then 0
    when 'go' then 1
    when 'personal' then 1
    when 'pro' then 2
    when 'team' then 3
    when 'standard' then 4
    when 'enterprise' then 5
    else 0
  end;
$$;
