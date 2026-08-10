-- CV export/import (spec 09): a `cvs` row is either live (backed by a
-- Persona + Template) or frozen (a self-contained CvSnapshotV1 blob),
-- never neither, never both.

alter table cvs alter column persona_id drop not null;
alter table cvs alter column template_id drop not null;

alter table cvs add column snapshot jsonb;

alter table cvs add constraint cvs_live_xor_frozen check (
  (persona_id is not null and snapshot is null) or
  (persona_id is null and snapshot is not null)
);
