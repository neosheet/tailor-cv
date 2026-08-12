-- User-saved, standalone TemplateDefinitions produced by "Save as new
-- template" (docs/specs/13-save-as-new-template.md). Each row is a complete,
-- self-contained TemplateDefinition (schemaVersion 2) — never a delta on top
-- of a built-in template — matching every built-in's own self-containment
-- rule (docs/specs/07-cv-template-pdf-format.md).

create table cv_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  description text not null default '',
  schema_version integer not null,
  definition jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger touch before update on cv_templates
  for each row execute function touch_updated_at();

alter table cv_templates enable row level security;

create policy "own cv_templates" on cv_templates
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index on cv_templates (user_id);
