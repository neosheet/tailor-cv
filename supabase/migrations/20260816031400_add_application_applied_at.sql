-- Dashboard "applications applied each day" heatmap needs a per-day timestamp
-- of when an application actually left draft. Nothing existing captures that:
-- application_status_history was dropped in 20260811020000, and global_status
-- alone can't tell you when a transition happened. Stamped once by
-- setGlobalApplicationStatus at the same freeze moment the CV snapshot is
-- captured (first transition away from draft) — see src/lib/application.ts.
alter table public.applications
  add column applied_at timestamptz;
