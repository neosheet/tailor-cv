alter table public.cvs add column persona_settings jsonb not null default '{}'::jsonb;

update cvs set persona_settings = jsonb_build_object('fieldVisibility', p.field_visibility)
from personas p
where p.id = cvs.persona_id and p.field_visibility <> '{}'::jsonb;

alter table public.personas drop column field_visibility;
