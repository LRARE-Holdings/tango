alter table public.workspaces
  drop constraint if exists workspaces_brand_logo_width_px_check,
  drop column if exists brand_logo_width_px;
