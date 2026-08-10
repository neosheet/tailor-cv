-- Applications tracking (spec 10). A CV attached to an application stays
-- live while the application is in `draft`; once status moves away from
-- `draft`, a frozen copy of the resolved CV (a CvSnapshotV1) is written to
-- `cv_snapshot` and never touched again on later status changes.

create type application_status as enum (
  'draft',
  'applied',
  'interview_call',
  'approved',
  'rejected',
  'archived',
  'withdraw'
);

create table applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  source_url text,
  vacancy_detail text,
  apply_via text,
  cv_id uuid references cvs(id) on delete set null,
  status application_status not null default 'draft',
  cv_snapshot jsonb,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table application_status_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  status application_status not null,
  changed_at timestamptz not null default now(),
  note text
);

create trigger touch before update on applications
  for each row execute function touch_updated_at();

alter table applications enable row level security;
alter table application_status_history enable row level security;

create policy "own applications" on applications
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own application status history" on application_status_history
  for all to authenticated using (
    exists (
      select 1 from applications a
      where a.id = application_status_history.application_id
        and a.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from applications a
      where a.id = application_status_history.application_id
        and a.user_id = auth.uid()
    )
  );

create index on applications (user_id, status);
create index on application_status_history (application_id, changed_at);
