# 10 — Applications tracking

Builds on [spec 01](01-app-taxonomy.md)'s Applications section, [spec 03](03-cv-selection.md)'s
template-binding-belongs-to-the-application answer, and [spec 09](09-cv-export-import.md)'s
CV snapshot format, which this spec reuses directly for the freeze.

> **Amended by [plan 12](../plans/12-application-stage-timeline.md).** The flat
> `status`/`application_status_history` pair described below (fields, "Status"
> section, freeze mechanics, data model, data layer, UI) is replaced by a manually-set
> `global_status` plus a real per-application stage timeline (`application_stages`,
> with a `stage_templates` autocomplete registry) — the Timeline tab is now the
> history, not a derived status log. The freeze condition and "one honest record,
> written once" behavior are otherwise unchanged, just renamed. This amendment
> updates the sections below in place rather than forking a new spec.

## Why

Track job applications end to end: what was applied to, how, with which CV, and how
its status has moved over time — from before applying through to an outcome. This is
the first real version; fields are intentionally minimal and expected to grow.

## Fields

| Field | Type | Notes |
|---|---|---|
| Title | text, required | e.g. "Senior Engineer @ Acme" |
| URL | text (URL), optional | link to the job opportunity page |
| Vacancy detail | text, optional | pasted job description / notes |
| Apply via | text, optional | free text — an email address, a URL, "referral", whatever applies |
| CV | FK → `cvs`, optional | which CV was/will be sent |
| Global status | enum, required | manually set, see below — no longer derives from or drives the timeline |
| Stage timeline | `application_stages` rows, editable | the real history now; see "Stage timeline" below |

`Apply via` is deliberately free text, not a typed email/URL field — "referred by
Jane" is as valid an answer as an address, and validating format would reject that
for no benefit at this stage.

## Global status

```
draft, applied, in_progress, offered, rejected, withdrawn
```

As a **set**, not a fixed linear sequence — any status can move to any other status
(e.g. `in_progress` → `rejected`, or `applied` → `withdrawn`). `draft` is the only
distinguished one: it's the starting status, and it's the one the freeze rule below
keys off. `global_status` stays manually set, exactly like the original flat status —
stages (below) are informational/descriptive and deliberately don't auto-derive it
(e.g. a `failed` stage does not flip `global_status` to `rejected`); that derivation
was considered and rejected as too ambiguous to encode generically.

## Stage timeline

Per application, an ordered list of hiring-pipeline stages — Recruiter Screen →
Technical Interview → Onsite Loop → Offer Negotiation, etc. — each with its own
category, progress status (`not_started`/`invited`/`scheduled`/`submitted`/
`completed`/`under_review`/`passed`/`failed`/`skipped`), scheduled/completed dates,
notes, and interviewer names. This **is** the application's history now — there is no
separate status-log table. One level of sub-stages is allowed (e.g. "Onsite Loop"
containing "Round 1"/"Round 2"); a sub-stage cannot itself have children, enforced in
the `createStage` mutator, not just the UI.

Stage *names* autocomplete from a per-user `stage_templates` registry (managed in
Settings, same shape as the Tags/Skill Categories registries) but are **not**
FK-enforced against it — `application_stages.name`/`category` are plain denormalized
`text`, copied at creation time. Renaming or deleting a template never rewrites a
stage already recorded on an application; a recorded stage is a point-in-time
snapshot of one real step in a pipeline. Stage categories are a fixed, code-level list
of 11 values (`recruiter_screen`, `technical_interview`, `system_design`,
`behavioral`, `take_home_assignment`, `portfolio_review`, `performance_audition`,
`onsite_loop`, `executive_chat`, `offer_negotiation`, `custom`) — the DB column is
`text`, not a Postgres enum, so future values don't need a migration, but the shipped
UI only ever offers these 11.

`applications.current_stage_id` tracks a "quick UI highlight" — it defaults to the
most-recently-added top-level stage, but can be manually overridden ("Mark as
current"). It has no effect on `global_status` or the freeze.

## The freeze

**Decision, settling spec 01's open question #2 (single snapshot vs. history of
snapshots):** the CV snapshot freezes **once**, on the first transition away from
`draft`, and never changes again — including if status later moves back to `draft` or
through several more changes. "One honest record of what was actually sent," read
literally. A revised resend is a product question for later (a new application, or
an explicit "re-freeze" action) — not designed here.

Mechanically, on `setGlobalApplicationStatus(store, persona, inventory, applicationId, next, note?)`:

1. If `current.globalStatus === "draft"` and `next !== "draft"`:
   - Require `cv_id` to be set — you can't freeze nothing. The status Select in the
     UI disables every non-`draft` option until a CV is attached; the mutator also
     throws defensively.
   - Resolve the attached CV (`resolveCv`, same as the print page) and build a
     `CvSnapshotV1` (spec 09's `buildCvSnapshot`) from its *current* state.
   - Write it to `applications.cv_snapshot`.
2. Update `applications.global_status = next`.

There is no step 3 anymore — the old flow's "insert one `application_status_history`
row" is gone along with that table. The `note?` parameter is kept for call-site
signature parity but is now a no-op (nothing left to log it to).

`cv_id` itself is never cleared by freezing — it stays as a link back to "which saved
CV this came from" for display/navigation. What changes is that **rendering prefers
`cv_snapshot` over `cv_id` once it's set** (see Rendering).

The original CV keeps being freely editable and reusable on other applications —
freezing copies, it never locks the source (spec 01's "Sent CVs" resolution, restated
for this feature).

## Rendering the attached CV

New route `/applications/:id/cv`, mirroring `/cvs/:id/print`'s structure
(`ResumeRender` + the same download action), fed by:

```ts
function resolveApplicationCv(store, application):
  application.cvSnapshot
    ? { document: application.cvSnapshot.document, template: templateFromSnapshot(application.cvSnapshot), templateSettings: application.cvSnapshot.templateSettings }
    : application.cvId
      ? resolveCv(persona, inventory, application.cvId)
      : undefined
```

Before the freeze (`draft`), this always reflects the live CV — edit the CV, the
application's preview updates, matching spec 01's diagram. After the freeze, it's
fixed regardless of what happens to the live CV afterward.

## Data model

```sql
create type global_application_status as enum (
  'draft', 'applied', 'in_progress', 'offered', 'rejected', 'withdrawn'
);

create type stage_progress_status as enum (
  'not_started', 'invited', 'scheduled', 'submitted', 'completed', 'under_review',
  'passed', 'failed', 'skipped'
);

create table applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  source_url text,
  vacancy_detail text,
  apply_via text,
  cv_id uuid references cvs(id) on delete set null,
  global_status global_application_status not null default 'draft',
  current_stage_id uuid references application_stages(id) on delete set null,
  cv_snapshot jsonb, -- CvSnapshotV1, set once on first non-draft transition
  note text, -- private, same convention as inventory's `note`
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table stage_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  category text not null default 'custom', -- BuiltInStageCategory | string, plain text
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table application_stages (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  parent_stage_id uuid references application_stages(id) on delete cascade, -- one level only
  name text not null, -- denormalized, not FK'd to stage_templates
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
```

(`applications.current_stage_id` actually has to be added after `application_stages`
exists, since it references it — see the migration for the real column order.)

`cv_id on delete set null`: deleting the source CV after freezing doesn't touch the
already-frozen snapshot, only drops the "jump to the live CV" link — same pattern as
`cv_snapshot` staying independent. `application_stages.parent_stage_id on delete
cascade`: deleting a top-level stage removes its sub-stages with it.

The application no longer bootstraps any history row at creation — the stage
timeline correctly starts empty until the user adds the first real stage, rather than
implying a status log existed before tracking began.

RLS: same shape as every other user-owned table — direct `user_id` policy on
`applications` and `stage_templates`, reached-through-parent policy on
`application_stages` (spec 03's `cv_sections`-style pattern).

Indexes: `applications (user_id, global_status)` for the list/filter; `cv_id` for the
delete-set-null path already covered by the FK; `application_stages
(application_id, parent_stage_id, position)` for the timeline query.

## Data layer

`src/lib/application-store.tsx` (`ApplicationStoreProvider`/`useApplicationStore`),
mirroring `persona-store.tsx`'s shape — fetch-once-per-session, `applications` +
`applicationStages` + `stageTemplates` arrays, with matching setters. Mounted in
`App.tsx` nested inside `PersonaStoreProvider` (it needs `resolveCv` for the freeze).

`src/lib/application.ts`: selectors (`allApplications`, `findApplication`) and
mutators (`createApplication`, `updateApplication`, `deleteApplication`,
`setGlobalApplicationStatus` as above). `src/lib/application-stage.ts`:
`stagesForApplication` (the depth-1-nested `StageNode[]` selector) and mutators
`createStage`/`updateStage`/`deleteStage`/`setCurrentStage`. `src/lib/
stage-templates.ts`: registry CRUD (`listStageTemplates`, `createStageTemplate`,
`updateStageTemplate`, `deleteStageTemplate`, `validateStageTemplateName`), mirroring
`skill-categories.ts`'s shape.

## UI

- `/applications` (`applications.tsx`): a table — Title, Company, Deadline, Status
  (badge), URL, CV name, last updated — with a status filter and a **New
  Application** button opening a form dialog. Creating an application whose
  Company + URL match an existing one (active or archived) surfaces a
  non-blocking "similar applications found" dialog after the create succeeds —
  see `findSimilarApplications`.
- Row click opens a detail `Sheet` (also reachable full-page at
  `/applications/:id`), tabbed: **Job Detail** (editable fields, the Global Status
  `Select` — every option enabled once a CV is attached, a confirmation step the
  first time it leaves `draft`), **CV Preview** (inline `ResumeRender`, link to
  `/applications/:id/cv`), and **Timeline** — the stage list described above: a
  connected vertical list of stage cards (name, category, progress-status badge, a
  "Current" badge on `current_stage_id`, dated/noted/interviewer meta rows, nested
  sub-stages), an "Add stage" action, and per-stage Edit/Delete/Add-sub-stage/Mark-
  as-current. Stage names autocomplete from the `stage_templates` registry
  (Settings → Stage Templates tab), with an inline "create a new template" flow when
  nothing matches.
- Dashboard is untouched in this pass — spec 01 names it as the eventual home for a
  pipeline-at-a-glance view, but that's explicitly a follow-up.

## Decisions

- **Freeze once, never re-freeze** — see "The freeze" above. Settles spec 01's open
  question #2.
- **Global status is a flat enum, any-to-any transition** — not a state machine with
  disallowed edges. Real pipelines skip steps or bounce backward (rejected after
  interview, withdrawn from applied) constantly; enforcing edges would fight the
  common case for no real benefit at this stage.
- **The stage timeline replaces the flat status-history log, not alongside it**
  ([plan 12](../plans/12-application-stage-timeline.md)) — `application_stages` *is*
  the history now; there's no separate log table to keep in sync with it.
- **Stages stay manually set and don't derive `global_status`** — considered and
  explicitly rejected as too ambiguous to encode generically (plan 12).
- **Sub-stages capped at one level of nesting**, enforced in the `createStage`
  mutator, not just the UI (plan 12).
- **Stage categories are a fixed, code-level list of 11 values** including `custom`
  as the escape hatch — the DB column stays plain `text` for forward compatibility,
  but the shipped UI never writes an arbitrary string (plan 12).
- **Detail is a side panel, also reachable full-page** at `/applications/:id` — the
  full-page route was added once the tabbed Job Detail/CV Preview/Timeline layout
  needed more room than a drawer comfortably gives.

## Out of scope (explicitly deferred)

- Dashboard pipeline view.
- Reminders/follow-up dates.
- Multiple CVs or multiple snapshots per application (a resend/revision story).
- A real state machine over `global_status` (disallowed transitions, required fields
  per status).
- Attachments beyond the one CV (cover letters are in scope as of a later batch; see
  `docs/progress.md`).
- Any change to `cvs`/Persona beyond what spec 09 already introduces.
- Stage drag-and-drop reordering (positions are set at creation time only).
- Deriving `global_status` from stage outcomes.
