-- Structured job metadata on applications: company, position, location, job
-- type, working type, and an application deadline — additive alongside the
-- existing free-text `title`.

create type application_job_type as enum ('full_time', 'freelance', 'contract');
create type application_work_type as enum ('remote', 'hybrid', 'on_site');

alter table public.applications
  add column company text,
  add column position text,
  add column location text,
  add column job_type application_job_type,
  add column work_type application_work_type,
  add column deadline date;
