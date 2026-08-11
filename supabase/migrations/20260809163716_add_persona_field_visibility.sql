alter table public.personas
  add column field_visibility jsonb not null default '{}'::jsonb;
