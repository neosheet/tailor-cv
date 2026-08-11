alter table public.cvs
  add column template_settings jsonb not null default '{}'::jsonb;
