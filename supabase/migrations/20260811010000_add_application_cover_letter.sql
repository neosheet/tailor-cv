-- Cover letter field on applications: same rich-text HTML shape as
-- `vacancy_detail`, authored via the Quill editor.

alter table public.applications
  add column cover_letter text;
