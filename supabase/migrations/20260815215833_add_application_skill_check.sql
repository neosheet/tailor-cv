-- Manual "missing skills" check against a job posting's required-skills list,
-- run from the Application detail page against the attached CV's resolved
-- skills. See docs/specs/14-missing-skills-check.md.
alter table public.applications
  add column required_skills_input text,
  add column missing_skills text[];
