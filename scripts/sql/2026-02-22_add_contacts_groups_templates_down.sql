-- Rollback for contacts, groups, templates, and co-ownership search helpers.

drop index if exists public.profiles_display_name_trgm_idx;
drop index if exists public.workspace_members_workspace_role_user_idx;

drop function if exists public.search_workspace_co_owners(uuid, text, integer, integer);
drop function if exists public.workspace_feature_enabled(uuid, text);
drop function if exists public.workspace_plan_rank(text);

drop table if exists public.contact_group_members;
drop table if exists public.workspace_templates;
drop table if exists public.contact_groups;
drop table if exists public.workspace_contacts;
