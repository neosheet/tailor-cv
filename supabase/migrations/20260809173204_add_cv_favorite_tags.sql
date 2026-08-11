alter table public.cvs
  add column favorite boolean not null default false,
  add column tags text[] not null default '{}';
