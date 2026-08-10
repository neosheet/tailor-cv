-- Applications gain a tags column, matching cvs.tags (free-form array, no
-- registry enforcement — same precedent as cvs.tags itself).
alter table public.applications
  add column tags text[] not null default '{}';
