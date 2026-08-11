# 12 — Application stage timeline

Implements [docs/user-request/timeline.md](../user-request/timeline.md). Per that
request: **this plan is self-contained** — the executing session will not have this
planning session's conversation. Every decision below is final, not a suggestion to
re-litigate. Read this whole file before touching code.

Per the user-request doc's header instruction — "prioritize this request above the
existing spec" — this plan **replaces** part of what
[specs/10-applications-tracking.md](../specs/10-applications-tracking.md) shipped
(the flat `application_status`/`application_status_history` pair). Phase 8 below
updates spec 10 in place afterward so it stops documenting the removed shape. Do not
skip Phase 8.

## Why (context a fresh session needs)

Applications already has three tabs on its detail view (Job Detail / CV Preview /
Timeline — `src/components/applications/application-detail-view.tsx`). Timeline is
currently a literal placeholder:

```tsx
<TabsContent value="timeline" className="pt-4">
  <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
    Timeline coming soon.
  </div>
</TabsContent>
```

The user wants this tab to show the real hiring pipeline for one application — a
vertical list of stages (Recruiter Screen → Technical Interview → Onsite Loop → Offer
Negotiation, etc.), each individually dated and statused, with stage *names*
autocompleted from a per-user registry managed in Settings (same shape as the
existing Tags/Skill Categories registries).

## Locked-in decisions (resolved via `AskUserQuestion` before this plan was written — do not re-ask)

1. **The new stage timeline replaces the existing flat status system**, it does not
   sit alongside it. `applications.status` (7-value `application_status` enum) and
   `application_status_history` are both removed. A new `applications.global_status`
   (6-value `global_application_status` enum) takes over the Job Detail tab's Status
   `Select` and the freeze-trigger logic, keeping the exact same "leaves `draft`"
   condition, just renamed. The Timeline tab's stage list *is* the history now — no
   separate log table.
2. **`global_status` stays manually set**, exactly like today's dropdown. Stages are
   informational/descriptive, not wired to auto-derive it. Do not add derivation
   rules (e.g. "a `failed` stage flips `global_status` to `rejected`") — this was
   explicitly rejected as too ambiguous to encode generically.
3. **Sub-stages are in scope**, but capped at **one level of nesting**. A top-level
   stage (e.g. "Onsite Loop") may contain child stages (e.g. "Round 1", "Round 2");
   a child stage may not itself have children. This is enforced in the mutator
   (Phase 3), not just the UI — reject `createStage` calls that would create depth-2.
4. **Stage template categories are a fixed, code-level list of 11 values**
   (`BuiltInStageCategory`, verbatim from the request's draft type, `'custom'`
   included as the 11th). The DB column is `text`, not a Postgres enum, so future
   values don't need a migration — but the UI (`Select`s in this plan) only ever
   offers these 11. No free-text "type your own category" control — picking
   `custom` is how an out-of-list stage gets categorized. This is a deliberate scope
   trim: the type stays open (`BuiltInStageCategory | string`) for forward
   compatibility (e.g. future CSV import), but nothing in this plan's UI writes an
   arbitrary string.

## Current-state summary (read before writing code — confirmed live against the real Supabase project `artmbeeadepxggbvfkdr`, not assumed)

- **`applications` table** (`supabase/migrations/20260810130000_add_applications.sql`
  + 3 later migrations adding job fields/tags/cover_letter): has a `status
  application_status not null default 'draft'` column, enum values `draft / applied /
  interview_call / approved / rejected / archived / withdraw`. Only **one real row**
  exists in production right now, `status = 'draft'` (confirmed via `execute_sql`) —
  the backfill in Phase 1 is low-risk.
- **`application_status_history` table**: one row per status change, `status
  application_status not null`, `changed_at timestamptz`, `note text`. Written by
  `createApplication` (bootstrap `draft` row) and `setApplicationStatus` in
  `src/lib/application.ts`. Read by `src/lib/application-store.tsx`'s
  `ApplicationStoreProvider` and `applicationHistory()` in `application.ts` — that
  selector is currently unused by any component (the Timeline tab never rendered
  it). Being deleted wholesale in Phase 1.
- **The freeze mechanism** (`setApplicationStatus`, `application.ts`): on the
  transition `current.status === 'draft' && next !== 'draft'`, resolves the attached
  CV and writes a `CvSnapshotV1` to `applications.cv_snapshot`, once, never again.
  This logic is untouched in shape — only the enum/column name changes (`status` →
  `global_status`, `ApplicationStatus` → `GlobalApplicationStatus`). The
  history-table insert inside it is deleted (no table to write to anymore).
- **`STATUS_LABEL`/`APPLICATION_STATUSES`** (`src/lib/application-status.ts`) back
  three call sites: `application-detail-view.tsx`'s `StatusSelectField`,
  `application-list-panel.tsx`'s status column + filter `Select`, and
  `src/pages/application-detail.tsx`'s header badge. All three need the renamed
  exports, values, and labels — see Phase 4.
- **Reference patterns already in the codebase, reuse these exactly**:
  - `src/components/settings/skill-categories-panel.tsx` +
    `skill-category-dialogs.tsx` + `src/lib/skill-categories.ts` — the registry
    CRUD shape (add inline at the top, table below, rename/delete dialogs) for the
    new Stage Templates Settings tab. One difference: skill categories are a single
    text field; stage templates need name **and** category, so the inline "Add"
    row needs two controls, not one.
  - `src/components/inventory/skill-link-input.tsx` (`SkillLinkInput`) — the
    "autocomplete a name; Enter with no match opens a small creation form" pattern
    the request explicitly points at ("see add skill in work experience as your
    reference"). Structurally this plan's `StageNameInput` is closer to this than
    to `TagInput` (`src/components/inventory/tag-input.tsx`), because a stage
    template needs a second field (category) captured at creation time — `TagInput`
    silently registers on Enter with no second field, which doesn't fit.
  - `src/components/applications/deadline-date-picker.tsx` (`DeadlineDatePicker`) —
    single full-day `yyyy-MM-dd` field, `Popover` + `Calendar`. Reused directly for
    the stage form's Scheduled/Completed date fields (Phase 5 adds an optional
    `label` prop so its sr-only `FieldLabel` text isn't hardcoded to "Deadline").
  - `src/components/inventory/note-input.tsx` (`NoteInput`) — reused as-is for a
    stage's `notes` field, no changes needed.
  - `src/components/ui/combobox.tsx` — has both a chips variant (`ComboboxChips`,
    used by `TagInput`/`SkillLinkInput`, for multi-value fields) and a plain
    `ComboboxInput` (single value, no chips) — use the latter for `StageNameInput`
    since a stage has exactly one name, not a list.
- **shadcn registry check** (per `CLAUDE.md`'s "always check shadcn before hand-
  building" rule, done during planning so this doesn't get skipped at execution
  time): `npx shadcn@latest search @shadcn -q timeline` and `-q stepper` both return
  **no results** in the one configured registry (`@shadcn`; `components.json` has
  `"registries": {}`, no community registries added). There is no existing
  vertical-steps/timeline primitive to install. Phase 6 composes `Card` + `Badge` +
  `DropdownMenu` (all already installed) by hand — this is the exhausted-registry
  fallback CLAUDE.md allows, not a shortcut around it. If a project registry gets
  added before this plan executes, re-check first.

## Data model

### New types (`src/mocks/types.ts`)

Replace the existing `ApplicationStatus` type and `DbApplicationStatusHistory` type,
and the `status` field on `DbApplication`, with:

```ts
export type GlobalApplicationStatus =
  | "draft"
  | "applied"
  | "in_progress"
  | "offered"
  | "rejected"
  | "withdrawn"

export type StageProgressStatus =
  | "not_started"
  | "invited"
  | "scheduled"
  | "submitted"
  | "completed"
  | "under_review"
  | "passed"
  | "failed"
  | "skipped"

export type BuiltInStageCategory =
  | "recruiter_screen"
  | "technical_interview"
  | "system_design"
  | "behavioral"
  | "take_home_assignment"
  | "portfolio_review"
  | "performance_audition"
  | "onsite_loop"
  | "executive_chat"
  | "offer_negotiation"
  | "custom"

export type DbStageTemplate = DbTimestamps & {
  id: string
  userId: string
  name: string
  category: BuiltInStageCategory | string
}

export type DbApplicationStage = DbTimestamps & {
  id: string
  applicationId: string
  parentStageId: string | null
  name: string
  category: BuiltInStageCategory | string
  status: StageProgressStatus
  position: number
  scheduledAt: string | null
  completedAt: string | null
  notes: string | null
  interviewerNames: string[]
}
```

`DbApplication` changes: remove `status: ApplicationStatus`, add `globalStatus:
GlobalApplicationStatus` and `currentStageId: string | null`.

### Migration (new file, apply live via Supabase MCP against project
`artmbeeadepxggbvfkdr`, and keep the local `.sql` file — that's the established
convention, e.g. row 17/18 of `docs/progress.md`)

`supabase/migrations/20260811020000_add_application_stage_timeline.sql` (latest
existing migration is `20260811010000_add_application_cover_letter.sql` — keep the
timestamp convention increasing):

```sql
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
```

After applying, regenerate `src/lib/database.types.ts` (Supabase MCP
`generate_typescript_types`, or the `supabase` skill's usual flow) and confirm
`get_advisors` shows no new findings beyond the pre-existing ones already noted in
`docs/progress.md` (leaked-password-protection warning, `auth_rls_initplan`).

## Phase 1 — Database migration

1. Write and apply the migration above exactly as specified (`stage_templates`
   before `application_stages` — the latter has no FK to the former, order doesn't
   matter functionally, but keep this order for readability). Verify live: `select
   global_status from applications` returns `'draft'` for the one existing row,
   `application_status_history` and `application_status` (the type) are both gone.
2. Regenerate `database.types.ts`.

## Phase 2 — Types & data layer

1. `src/mocks/types.ts`: apply the type changes under "Data model" above.
2. `src/lib/application-store.tsx`:
   - `ApplicationData`: replace `applicationStatusHistory: DbApplicationStatusHistory[]`
     with `applicationStages: DbApplicationStage[]` and add `stageTemplates:
     DbStageTemplate[]`.
   - `ApplicationStore`: replace `setApplicationStatusHistory` with
     `setApplicationStages` and add `setStageTemplates` (same `React.Dispatch<
     React.SetStateAction<...>>` shape as every other setter here).
   - `mapApplicationRow`: replace `status: row.status` with `globalStatus:
     row.global_status`, add `currentStageId: row.current_stage_id`.
   - Delete `mapApplicationStatusHistoryRow` and `fetchByApplicationIds`. Add
     `mapApplicationStageRow(row: Tables<"application_stages">):
     DbApplicationStage` (straightforward snake→camel mapping, `interviewerNames:
     row.interviewer_names`) and `mapStageTemplateRow(row:
     Tables<"stage_templates">): DbStageTemplate`.
   - `ApplicationStoreProvider`'s load effect: after fetching `applications`, fetch
     `application_stages` scoped to the same `applicationIds` (mirror the deleted
     `fetchByApplicationIds`'s shape but querying `application_stages`, ordered by
     `position`) and, separately, `stage_templates` scoped to `user_id = userId`
     (ordered by `name` — this is a user-wide registry, not scoped to any one
     application, same shape as how `inventory-store.tsx` fetches `tags`/
     `skill_categories`). Set both into state; wire both dispatchers into the
     provider's memoized `value`.
3. New `src/lib/stage-templates.ts` — mirrors `src/lib/skill-categories.ts`
   structurally (read that file first for the exact CRUD/validation shape), minus
   the usage-count concept (stage templates are **not** FK-enforced anywhere — see
   the note in Phase 4 for why):
   - `listStageTemplates(data): DbStageTemplate[]` — sorted by `name`.
   - `validateStageTemplateName(name: string, registry: DbStageTemplate[], opts?: {
     except?: string }): string | null` — same shape as
     `validateCategoryName`/`validateTagName` (empty → error, duplicate
     case-insensitive → error, self-exempt via `except` for rename).
   - `createStageTemplate(store: ApplicationStore, name: string, category:
     BuiltInStageCategory): Promise<DbStageTemplate>` — insert, map, push into
     `store.setStageTemplates`.
   - `updateStageTemplate(store, id: string, patch: { name?: string; category?:
     BuiltInStageCategory }): Promise<DbStageTemplate>` — single combined
     update/rename mutator (no need for two separate functions — the Settings panel
     only ever edits one row at a time via one dialog).
   - `deleteStageTemplate(store, id: string): Promise<void>` — plain delete, no
     cascade/orphan concern to explain in a confirmation dialog (see Phase 4).
4. New `src/lib/application-stage.ts`:
   - `export type StageNode = DbApplicationStage & { subStages: DbApplicationStage[] }`
     (subStages themselves are never further nested — one level, per the locked-in
     decision).
   - `stagesForApplication(data: ApplicationData, applicationId: string):
     StageNode[]` — filter `applicationStages` where `applicationId` matches and
     `parentStageId === null`, sort by `position`; for each, attach its children
     (`applicationStages` where `parentStageId === stage.id`, sorted by
     `position`) as `subStages`.
   - `createStage(store: ApplicationStore, applicationId: string, fields: {
     parentStageId: string | null; name: string; category: BuiltInStageCategory;
     status?: StageProgressStatus; scheduledAt?: string | null; completedAt?:
     string | null; notes?: string | null; interviewerNames?: string[] }):
     Promise<DbApplicationStage>`:
     - If `fields.parentStageId` is set, look it up in `store.applicationStages`
       and throw if that stage's own `parentStageId` is not `null` ("Sub-stages
       can't have their own sub-stages.") — this is the depth-1 enforcement point.
     - `position` = `1 + max(position among siblings sharing the same
       applicationId/parentStageId, or -1 if none)`.
     - Insert into `application_stages`, map, append to `store.setApplicationStages`.
     - If `fields.parentStageId === null` (a new top-level stage), also update
       `applications.current_stage_id` to the new stage's id (one more `supabase
       .from("applications").update(...)` call) and reflect it in
       `store.setApplications`. This is the "quick UI highlight" default the
       request's schema comment describes — newest top-level stage becomes current
       automatically. Sub-stage creation does not touch `current_stage_id`.
   - `updateStage(store, stageId: string, patch: Partial<...same fields as
     createStage minus parentStageId/applicationId...>): Promise<DbApplicationStage>`
     — patch-style update mirroring `updateApplication`'s `!== undefined` spread
     pattern, no reordering support in this plan (no drag-and-drop was requested).
   - `deleteStage(store, stageId: string): Promise<void>` — delete the row (DB
     cascade removes any children automatically); if the deleted stage was the
     application's `current_stage_id`, clear it to `null` (update both DB and
     `store.setApplications`); update `store.setApplicationStages` to drop the
     deleted stage and any children (cascade happened server-side, but the local
     store needs the same filter applied client-side since there's no realtime
     subscription here).
   - `setCurrentStage(store: ApplicationStore, applicationId: string, stageId:
     string | null): Promise<void>` — the manual "Mark as current" override,
     plain single-column update + local state sync.
5. Rewrite `src/lib/application-status.ts` in place (same file, new content — it's
   still "the label file for the application's overall status enum", just a
   different enum now):

   ```ts
   import type { GlobalApplicationStatus } from "@/mocks/types"

   export const GLOBAL_STATUS_LABEL: Record<GlobalApplicationStatus, string> = {
     draft: "Draft",
     applied: "Applied",
     in_progress: "In Progress",
     offered: "Offered",
     rejected: "Rejected",
     withdrawn: "Withdrawn",
   }

   export const GLOBAL_APPLICATION_STATUSES: GlobalApplicationStatus[] = [
     "draft",
     "applied",
     "in_progress",
     "offered",
     "rejected",
     "withdrawn",
   ]
   ```
6. New `src/lib/stage-category.ts`:

   ```ts
   import type { BuiltInStageCategory } from "@/mocks/types"

   export const BUILT_IN_STAGE_CATEGORIES: BuiltInStageCategory[] = [
     "recruiter_screen",
     "technical_interview",
     "system_design",
     "behavioral",
     "take_home_assignment",
     "portfolio_review",
     "performance_audition",
     "onsite_loop",
     "executive_chat",
     "offer_negotiation",
     "custom",
   ]

   export const STAGE_CATEGORY_LABEL: Record<BuiltInStageCategory, string> = {
     recruiter_screen: "Recruiter Screen",
     technical_interview: "Technical Interview",
     system_design: "System Design",
     behavioral: "Behavioral",
     take_home_assignment: "Take-Home Assignment",
     portfolio_review: "Portfolio Review",
     performance_audition: "Performance Audition",
     onsite_loop: "Onsite Loop",
     executive_chat: "Executive Chat",
     offer_negotiation: "Offer Negotiation",
     custom: "Custom",
   }

   /**
    * `category` is `BuiltInStageCategory | string` end-to-end (the DB column is
    * plain `text`) — falls back to the raw value for anything outside the fixed
    * 11 this app's own UI ever writes (e.g. hand-edited data).
    */
   export function stageCategoryLabel(category: string): string {
     return STAGE_CATEGORY_LABEL[category as BuiltInStageCategory] ?? category
   }
   ```
7. New `src/lib/stage-progress-status.ts`:

   ```ts
   import type { StageProgressStatus } from "@/mocks/types"

   export const STAGE_PROGRESS_STATUSES: StageProgressStatus[] = [
     "not_started",
     "invited",
     "scheduled",
     "submitted",
     "under_review",
     "completed",
     "passed",
     "failed",
     "skipped",
   ]

   export const STAGE_PROGRESS_STATUS_LABEL: Record<StageProgressStatus, string> = {
     not_started: "Not Started",
     invited: "Invited",
     scheduled: "Scheduled",
     submitted: "Submitted",
     completed: "Completed",
     under_review: "Under Review",
     passed: "Passed",
     failed: "Failed",
     skipped: "Skipped",
   }

   /** Keeps status color-coding to existing `Badge` variants — no raw colors. */
   export const STAGE_STATUS_BADGE_VARIANT: Record<
     StageProgressStatus,
     "default" | "secondary" | "destructive" | "outline"
   > = {
     not_started: "outline",
     invited: "secondary",
     scheduled: "secondary",
     submitted: "secondary",
     under_review: "secondary",
     completed: "secondary",
     passed: "default",
     failed: "destructive",
     skipped: "outline",
   }
   ```
8. `src/lib/application.ts`:
   - Delete `applicationHistory()` (dead selector, no call sites — confirmed via
     grep during planning).
   - Rename `setApplicationStatus` → `setGlobalApplicationStatus`; same signature
     shape (`store, persona, inventory, applicationId, next: GlobalApplicationStatus,
     note?`) except: (a) reads/writes `global_status` instead of `status`; (b) the
     freeze condition becomes `current.globalStatus === "draft" && next !== "draft"`;
     (c) **delete the entire `application_status_history` insert block** at the end
     (the table is gone) — the function now does exactly one `applications` update
     and returns. Update its doc comment to match (drop the "inserting one
     status-history row" line).
   - `createApplication`: change the insert payload's `status: "draft"` to
     `global_status: "draft"`, and **delete the subsequent
     `application_status_history` bootstrap insert** — the function is now a single
     insert + map + `store.setApplications` append, no second table touched. Its
     doc comment currently says "inserts its first status-history row... so the
     timeline always starts at a real point" — that reasoning no longer applies
     (the timeline is now `stages`, which correctly starts empty until the user adds
     the first one); rewrite the comment to say so plainly rather than leaving stale
     text.
   - `ApplicationFormFields`/`updateApplication`: unaffected (neither field is
     `status`-related).

## Phase 3 — Rename existing call sites

Mechanical rename, `status`→`globalStatus`, `ApplicationStatus`→
`GlobalApplicationStatus`, `APPLICATION_STATUSES`→`GLOBAL_APPLICATION_STATUSES`,
`STATUS_LABEL`→`GLOBAL_STATUS_LABEL`, `setApplicationStatus`→
`setGlobalApplicationStatus`, across:

- `src/components/applications/application-detail-view.tsx` — `StatusSelectField`,
  its `onStatusChange`/`handleStatusChange` typing, the freeze-confirmation
  condition (`application.status === "draft"` → `application.globalStatus ===
  "draft"`), and the `Badge` showing `STATUS_LABEL[application.status]` (both the
  sheet-variant header badge and the CV Preview tab's label, if any reference it —
  re-check the whole file for `.status`, not just the grepped lines, since a rename
  this size is easy to under-scope).
- `src/components/applications/application-list-panel.tsx` — `statusFilter` state
  type, `filterOptions`, the `.filter(...)` predicate, the status column `Badge`.
- `src/pages/application-detail.tsx` — the header `Badge`.
- `src/components/applications/delete-application-dialog.tsx` — its doc comment
  mentions "application_status_history" by name; update the wording (the table it
  references is gone, cascading application_stages instead).

After this phase, `npm run typecheck` should surface any remaining `ApplicationStatus`/
`status` references as compile errors — use that as a checklist rather than trusting
grep alone.

## Phase 4 — Settings: Stage Templates registry

Read `src/components/settings/skill-categories-panel.tsx` and
`skill-category-dialogs.tsx` in full first — this phase mirrors their shape almost
exactly, with two differences: (1) "Add" needs a category `Select` alongside the name
`Input`, and (2) **no usage-count column or orphan-warning copy** in the delete
dialog — `stage_templates` is a pure autocomplete-suggestion registry, never
FK-referenced by `application_stages.name` (which is a plain denormalized `text`
column, copied at creation time, not a foreign key). This is a deliberate,
documented simplification versus Tags (which *are* enforced via
`assert_tags_registered()`): a recorded stage is a point-in-time snapshot of one
step in a real hiring pipeline — retroactively renaming or deleting the *template*
must never rewrite an application's actual history. State this reasoning in the new
files' doc comments so it isn't mistaken for an oversight later.

1. New `src/components/settings/stage-templates-panel.tsx`
   (`StageTemplatesPanel`): `SearchInput` (reuse the existing shared component) +
   name filter, an inline add row (`InputGroup` name field + category `Select`
   sourced from `BUILT_IN_STAGE_CATEGORIES`/`STAGE_CATEGORY_LABEL` + "Add template"
   `Button`, disabled while `validateStageTemplateName` reports a problem — mirror
   `AddCategoryField`'s shape), and a `Table` (Name / Category / Actions columns,
   no "Used on" column). Empty state via `Empty` (icon: reuse `WrenchIcon` or pick
   something more fitting like `ListChecksIcon` from `lucide-react` — either is
   fine, just don't leave it un-set).
2. New `src/components/settings/stage-template-dialogs.tsx`: `RenameStageTemplateDialog`
   (name + category, both editable — one dialog handles both, unlike
   `RenameSkillCategoryDialog` which only has a name) and `DeleteStageTemplateDialog`
   (plain "Delete “{name}”? This only removes it from the autocomplete list —
   stages already added to applications keep their name/category exactly as
   recorded." — no conditional in-use copy, since there's nothing to check).
3. `src/pages/settings.tsx`: add a `TabsTrigger`/`TabsContent` for `"stage-templates"`
   between `"skill-categories"` and `"general"` (keep `"tags"` as `defaultValue` —
   unchanged rationale, it's still the tab that does something first).

## Phase 5 — Add/Edit Stage form

1. `src/components/applications/deadline-date-picker.tsx`: add an optional `label?:
   string` prop (default `"Deadline"`), used for the `FieldLabel`'s (currently
   hardcoded) text and the `aria-label`s. No other behavior change — this keeps it a
   single reusable date-picker used by both the application deadline field and this
   plan's Scheduled/Completed stage fields. Update its doc comment: it's no longer
   `Application.deadline`-specific.
2. New `src/components/applications/interviewer-names-input.tsx`
   (`InterviewerNamesInput`): a plain free-text chip list, **not** registry-backed
   (no suggestions, nothing to search) — so it's a small hand-composed
   `Field`/`InputGroup`/`Input` + `Badge` chips component rather than a `Combobox`
   usage (the `Combobox` primitives all exist to manage a *suggestion list*, which
   doesn't apply here). Enter or comma commits the current input text as a new chip
   (trimmed, de-duplicated case-insensitively); Backspace on an empty input pops the
   last chip; each chip renders as a `Badge` with an inline `X` remove button (`size-3`
   `XIcon`, same visual weight as `ComboboxChip`'s remove affordance). Controlled:
   `value: string[]`, `onValueChange: (names: string[]) => void`.
3. New `src/components/applications/new-stage-template-dialog.tsx`
   (`NewStageTemplateDialog`): small `Dialog`, two fields — name `Input` (prefilled
   from what the user typed, editable) and category `Select`
   (`BUILT_IN_STAGE_CATEGORIES`, no default selection forcing a deliberate pick).
   On submit, calls `createStageTemplate` and returns the new `DbStageTemplate` via
   an `onCreated` callback. Mirrors `SkillLinkInput`'s embedded `ItemDialog` usage —
   opened by `StageNameInput` below, not from Settings.
4. New `src/components/applications/stage-name-input.tsx` (`StageNameInput`): single-
   value `Combobox` (not `multiple`) using the plain `ComboboxInput` (no chips) —
   read `src/components/ui/combobox.tsx` for its exact non-chips API before writing
   this. Suggestions: `listStageTemplates(store)` names, prefix-filtered (same
   `MAX_SUGGESTIONS = 5` convention as `TagInput`/`SkillLinkInput`), excluding exact
   case-insensitive matches already equal to the current value. Props: `value:
   string`, `onValueChange: (name: string) => void`, `onCategoryHint: (category:
   BuiltInStageCategory) => void` (fired when a suggestion is picked or a new
   template is created, so the parent form's Category `Select` can auto-fill —
   the user can still change it afterward, this is a convenience default, not a
   lock). Enter with no matching suggestion and non-empty input opens
   `NewStageTemplateDialog` (same trigger condition as `SkillLinkInput`'s
   `openCreateFromInput`); on create, calls both `onValueChange(newName)` and
   `onCategoryHint(newCategory)`.
5. New `src/components/applications/stage-form-dialog.tsx` (`StageFormDialog`):
   the Add/Edit Stage dialog, styled consistently with `ApplicationFormDialog`/
   `ItemDialog` (read one of those first for the `Dialog`/`Field`/`InputGroup`
   layout conventions this codebase uses). Two modes:
   - **Add**: props `application: DbApplication`, `parentStageId: string | null`
     (top-level vs. sub-stage of a specific stage), `open`, `onOpenChange`,
     `onSaved`.
   - **Edit**: props `stage: DbApplicationStage`, `open`, `onOpenChange`, `onSaved`
     (no `parentStageId`/`application` needed — those are immutable after
     creation; this plan has no "move a stage to a different parent" feature).

   Fields, in order: `StageNameInput` (name + category hint), Category `Select`
   (`BUILT_IN_STAGE_CATEGORIES`, receives `StageNameInput`'s hint as its value
   default but stays independently editable), Status `Select`
   (`STAGE_PROGRESS_STATUSES`/`STAGE_PROGRESS_STATUS_LABEL`, defaulting to
   `not_started` in Add mode), `DeadlineDatePicker` ×2 (`label="Scheduled"` /
   `label="Completed"`), `NoteInput` (maps to `notes`), `InterviewerNamesInput`
   (maps to `interviewerNames`). Submit calls `createStage`/`updateStage` from
   `src/lib/application-stage.ts` accordingly.

## Phase 6 — Timeline tab UI

1. New `src/components/applications/stage-card.tsx` (`StageCard`): renders one
   top-level `StageNode` (name from `stagesForApplication`'s `subStages`-augmented
   shape). Layout: `Card` containing —
   - Header row: stage name (medium weight), category `Badge` (`variant="outline"`,
     label via `stageCategoryLabel`), status `Badge` (variant via
     `STAGE_STATUS_BADGE_VARIANT`, label via `STAGE_PROGRESS_STATUS_LABEL`), a
     `Badge` reading "Current" (`variant="default"`) shown only when
     `application.currentStageId === stage.id`, and a `DropdownMenu` (`Ellipsis`
     trigger, matching `application-list-panel.tsx`'s row-action pattern) with
     items: Edit, Mark as current (hidden/disabled if already current), Add
     sub-stage, Delete (`variant="destructive"`-styled `DropdownMenuItem`, wrapped
     in an inline `AlertDialog` confirmation — same "confirm inline, no separate
     file" approach `application-detail-view.tsx` already uses for its own freeze
     dialog, since this is a single, simple confirmation).
   - Meta rows (only rendered when present, `text-sm text-muted-foreground`):
     Scheduled/Completed dates (`date-fns` `format(parseISO(...), "PP")`, matching
     `formatDeadline`'s existing convention), Notes (`whitespace-pre-wrap`),
     Interviewers (as a wrapped row of small `Badge`s, matching how Tags render
     elsewhere in this codebase).
   - If `stage.subStages.length > 0`: a nested, visually-indented list of compact
     sub-stage rows below the meta rows (name, category+status `Badge`s, a smaller
     `DropdownMenu` with only Edit/Delete — no "Add sub-stage", no "Mark as
     current" — enforcing the depth-1 rule visually as well as at the mutator
     level).
2. New `src/components/applications/timeline-tab.tsx` (`TimelineTab`): props
   `application: DbApplication`. Calls `useApplicationStore()` internally (matches
   how e.g. `SkillCategoriesPanel` calls `useInventoryStore()` itself rather than
   having it prop-drilled). Top: a "+ Add stage" `Button` opening `StageFormDialog`
   in Add mode with `parentStageId: null`. Below: `stagesForApplication(store,
   application.id)` mapped into a vertical connected list of `StageCard`s — compose
   the "connector line" with a wrapping `<ol>`/`<div>` using a `border-l-2
   border-border` on a fixed-width left rail plus a small dot per item (Tailwind
   utility composition, no new dependency — this is the "hand-compose from Card/
   Badge" fallback noted under shadcn registry check above). Empty state (no
   stages yet) via `Empty` — "No stages yet. Add the first stage to start tracking
   this application's pipeline."
3. `src/components/applications/application-detail-view.tsx`: replace the
   `TabsContent value="timeline"` placeholder `div` with `<TimelineTab
   application={application} />`.

## Phase 7 — Verification

1. `npm run typecheck && npm run lint` clean.
2. `npm run build` clean.
3. Browser check (per `CLAUDE.md`'s default: one desktop screenshot per changed
   page + a console-error check, nothing more elaborate):
   - Settings → Stage Templates tab: add a template (e.g. "Technical Interview" /
     Technical Interview category), confirm it round-trips (reload, still there),
     rename it, delete it.
   - An application's detail view → Timeline tab: add a top-level stage, add a
     sub-stage under it, edit one, delete one, confirm the "Current" badge follows
     the most-recently-added top-level stage, confirm `StageNameInput`'s
     autocomplete + inline-create-a-template flow both work end to end (typing an
     existing template's name suggests it; typing a new name and pressing Enter
     opens `NewStageTemplateDialog`, and saving it fills the name/category back into
     the still-open stage form).
   - Job Detail tab's Status `Select` still works with the renamed 6-value list, and
     the freeze-confirmation `AlertDialog` still fires on the same `draft →
     non-draft` transition as before.
   - Zero console errors throughout.

## Phase 8 — Docs (do not skip — explicitly requested)

1. Update [specs/10-applications-tracking.md](../specs/10-applications-tracking.md)
   in place (not forked — same treatment prior batches gave spec 07/08) to describe
   the new `global_status`/`application_stages`/`stage_templates` model instead of
   the removed `application_status`/`application_status_history` pair, and to
   mention the Timeline tab as shipped rather than a placeholder.
2. Add a new row to `docs/progress.md` for this initiative (`#25`), linking this
   plan and the amended spec 10, following the existing table's level of detail —
   summarize what was built, what was deliberately trimmed (fixed 11-category list,
   no drag-reorder, depth-1 sub-stages, manual `global_status`), and whether it was
   browser-verified.
