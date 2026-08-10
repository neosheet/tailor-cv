-- Replaces the flat application_status/application_status_history pair with a
-- richer stage timeline. See docs/plans/12-application-stage-timeline.md.

create type global_application_status as enum (
  'draft',
  'applied',
  'in_progress',
  'offered',
  'rejected',
  'withdrawn'
);

create type stage_progress_status as enum (
  'not_started',
  'invited',
  'scheduled',
  'submitted',
  'completed',
  'under_review',
  'passed',
  'failed',
  'skipped'
);

alter table applications add column global_status global_application_status;

update applications set global_status = (case status
  when 'draft' then 'draft'
  when 'applied' then 'applied'
  when 'interview_call' then 'in_progress'
  when 'approved' then 'offered'
  when 'rejected' then 'rejected'
  when 'archived' then 'withdrawn'
  when 'withdraw' then 'withdrawn'
end)::global_application_status;

alter table applications alter column global_status set not null;
alter table applications alter column global_status set default 'draft';

drop table application_status_history;

-- Drops the applications_user_id_status_idx index automatically along with the column.
alter table applications drop column status;
drop type application_status;

create index on applications (user_id, global_status);

create table stage_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  category text not null default 'custom',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table stage_templates enable row level security;

create policy "own stage templates" on stage_templates
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger touch before update on stage_templates
  for each row execute function touch_updated_at();

create table application_stages (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  parent_stage_id uuid references application_stages(id) on delete cascade,
  name text not null,
  category text not null default 'custom',
  status stage_progress_status not null default 'not_started',
  position integer not null default 0,
  scheduled_at timestamptz,
  completed_at timestamptz,
  notes text,
  interviewer_names text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table application_stages enable row level security;

create policy "own application stages" on application_stages
  for all to authenticated using (
    exists (
      select 1 from applications a
      where a.id = application_stages.application_id
        and a.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from applications a
      where a.id = application_stages.application_id
        and a.user_id = auth.uid()
    )
  );

create trigger touch before update on application_stages
  for each row execute function touch_updated_at();

create index on application_stages (application_id, parent_stage_id, position);

alter table applications
  add column current_stage_id uuid references application_stages(id) on delete set null;
