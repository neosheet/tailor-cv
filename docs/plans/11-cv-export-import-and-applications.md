# 11 — CV export/import + Applications tracking

Implements [specs/09-cv-export-import.md](../specs/09-cv-export-import.md) (the
`CvSnapshotV1` format, export, import) and
[specs/10-applications-tracking.md](../specs/10-applications-tracking.md) (the
Applications page, built on top of it). Phases are ordered so every piece spec 10's
freeze logic depends on — the snapshot type, the `resolveCv` frozen-CV branch, the
`cvs` migration — lands before Applications touches it.

## Doc discovery (Phase 0)

**`cvs` table today** (`supabase/migrations/20260805193855_cv_schema.sql` +
`database.types.ts`, confirmed against the live schema since the personas-rename
migration in progress row 17 was applied live via MCP rather than a local file):
`persona_id: string` and `template_id: string` are both **required** (`Insert` type has
no `?`) — spec 09 needs both nullable, plus a new `snapshot jsonb` column.

**The template-lookup gap — the one real risk in this plan, found during doc
discovery, not assumed:** `ResumeRender` (`src/components/cv/resume-render.tsx:17-34`)
takes a `templateId: string`, not a `TemplateDefinition`. It hands that id straight to
`TemplateRender` (`src/components/cv/templates/index.tsx:20-43`), which does
`cvTemplates.find(c => c.id === templateId) ?? cvTemplates[0]` — **always** resolving
through the codebase's `cv-templates.ts` registry (`classic`/`two-column`/
`batch1-demo` today). A frozen/imported CV's inlined `TemplateDefinition` has no
guarantee its `id` matches a registered template — worse, an unrecognized id silently
falls back to `cvTemplates[0]` and renders the **wrong template** with no error. This
must be fixed before any snapshot rendering path is wired up, or Phase 4's "export a
CV, re-import it, render it" verification will silently render garbage. Phase 1 below
fixes this first, ahead of the DB work.

**`resolveCv`** (`src/lib/cv.ts:32-53`) already returns exactly the three values a
snapshot needs — `document`, `template` (a `CvTemplate`), and the caller separately has
`cv.templateSettings` — so `buildCvSnapshot` (Phase 1) has a ready-made input shape at
both call sites (`cv-print.tsx`, `cv-list-panel.tsx`).

**`TemplateDefinition`** (`cv-template-schema.ts:146-162`) already carries
`id`/`name`/`description`/`density`/`atsSafe`/`bestFor` alongside `page`/`styles`/
`blocks`/`root` — so a `CvTemplate` can be reconstructed from a bare
`TemplateDefinition` with no extra metadata needed:
`{ id: def.id, name: def.name, description: def.description, definition: def, density: def.density, atsSafe: def.atsSafe, bestFor: def.bestFor }`.
`templateDefinitionSchema`/`templateSettingsSchema` (`cv-template-schema.ts:323-350`)
already exist and validate exactly the `template`/`templateSettings` fields a snapshot
carries — reuse them directly in the new `CvSnapshotV1` zod schema, don't re-derive.

**`DbCv`** (`src/mocks/types.ts:204-217`) and `mapCvRow`
(`src/lib/persona-store.tsx:113-128`) need `personaId`/`templateId` widened to
`string | null` and a new `snapshot: CvSnapshotV1 | null` field/mapping.

**`CvFormFields`/`createCv`** (`cv.ts:59-93`) stay untouched — creating a *live* CV
still always requires a persona+template. Import gets its own new mutator
(`importCvSnapshot`), it does not go through `createCv`.

**`CvFormDialog`** (`src/components/cv/cv-form-dialog.tsx`) hardcodes Persona/Template
`Select`s as always-shown, always-required (`canSubmit` checks both). Needs a
`frozen?: boolean` mode that hides both selects and only submits name/note/tags — used
when editing an already-imported CV.

**`PersonaFieldTree`** (`src/components/cv/persona-field-tree.tsx`, referenced from
`cv-print.tsx:44`) — read its tab list before Phase 3; it takes a `cv: DbCv` prop
already (per Batch 3, progress row 20) and presumably renders a `Tabs` with Visibility/
Data/Style/Page/Block. Confirm exactly where to gate Visibility/Data off `cv.personaId
!== null` inside that file at execution time — not assumed here since the file wasn't
read in full during this planning pass.

**Applications**: `src/pages/applications.tsx` is a one-line `PlaceholderPage`
(`sections.applications` in `navigation.ts`), route already registered at
`/applications` in `App.tsx:82`. No `applications`/`application_status_history` tables
exist anywhere yet (confirmed — `grep` across `supabase/migrations/*.sql` for
`applications` returns nothing). `PersonaStoreProvider` (`persona-store.tsx:145-275`)
is the pattern to mirror exactly for the new `ApplicationStoreProvider` — same
fetch-once-per-session shape, same `mapXRow` functions, same `refetch`/`version` dance.

**Installed shadcn primitives already cover this plan's UI** — no new components to
add: `sheet.tsx` (Applications detail panel), `select.tsx`/`textarea.tsx`/`badge.tsx`
(status, vacancy detail, status badges), `table.tsx`/`dropdown-menu.tsx` (list, row
actions) — all already used by `cv-list-panel.tsx`/`item-dialog.tsx` in the exact
shapes needed here.

**Migration naming**: latest is `20260810090000_move_field_visibility_to_cvs.sql`.
New migrations in this plan continue the same `YYYYMMDDHHMMSS_name.sql` convention,
timestamps increasing.

## Locked-in decisions (from the specs, restated so execution doesn't re-litigate them)

- Import produces a **frozen, read-only-content** CV (`persona_id null`, `snapshot`
  set) — never a full Persona/Inventory reconstruction.
- A CV row is **live xor frozen**, enforced by a DB check constraint — never neither,
  never both.
- Frozen CVs stay **presentation-editable**: Style/Page/Block-instance tabs keep
  working (they only ever touch `cv.templateSettings`); Visibility/Data tabs (which
  need a Persona) are hidden.
- Application status is a **flat enum**, any-to-any transition, `draft` the only
  distinguished starting value.
- The CV snapshot on an application **freezes once**, on the first transition away
  from `draft`, and never re-freezes on later status changes.
- Leaving `draft` without a `cv_id` set is rejected (nothing to freeze).

## Phase 1 — Shared snapshot type + the template-lookup fix

The foundation both later halves depend on. No DB changes yet — pure TS/schema work,
verifiable in isolation.

1. **Fix the template-lookup gap** (doc discovery, above) before anything else needs
   it: widen `TemplateRender` (`templates/index.tsx`) and `ResumeRender`
   (`resume-render.tsx`) to accept an optional inline `definition?: TemplateDefinition`
   alongside the existing `templateId`. When `definition` is passed, render it
   directly — skip the `cvTemplates.find(...)` registry lookup entirely. When absent,
   behavior is byte-for-byte unchanged (existing registry-lookup path). Every existing
   call site (`template-card.tsx`, `template-view-dialog.tsx`, `cv-print.tsx`'s live
   path) passes no `definition` and is unaffected.
2. New `src/lib/cv-snapshot.ts`:
   - `CvSnapshotV1` type exactly as specced (`formatVersion: 1`, `exportedAt`, `name`,
     `note`, `tags`, `document: ResumeDocument`, `template: TemplateDefinition`,
     `templateSettings: TemplateSettings`).
   - `cvSnapshotV1Schema` (zod) — reuse `templateDefinitionSchema` and
     `templateSettingsSchema` from `cv-template-schema.ts` for the `template`/
     `templateSettings` fields; a plain object schema for the rest. A `ResumeDocument`
     zod schema doesn't exist yet — write one matching `persona.ts`'s type (or, if
     that proves heavy, validate `document` loosely as `z.unknown()` cast through the
     TS type at the boundary, since it's produced by our own `buildResumeDocument` on
     export and never hand-authored — decide based on how much the strict version
     actually costs once attempted; document whichever is chosen).
   - `buildCvSnapshot(cv: DbCv, document: ResumeDocument, template: CvTemplate): CvSnapshotV1`.
   - `parseCvSnapshot(input: unknown): CvSnapshotV1` — validates, rejects unknown
     `formatVersion` with a clear error message (mirrors
     `parseTemplateDefinition`'s error-join pattern in `cv-template-schema.ts:357-366`).
   - `templateFromSnapshot(snapshot: CvSnapshotV1): CvTemplate` — the trivial
     reconstruction from doc discovery above.
3. **Verification**: `npm run typecheck && npm run lint`. No runtime check yet — no UI
   calls any of this until Phase 4. Confirm by grep that `templates/index.tsx`'s
   fallback-to-`cvTemplates[0]` path is provably untouched when `definition` is
   omitted (read the diff, don't just trust the description).

## Phase 2 — `cvs` migration (snapshot columns)

1. New migration `supabase/migrations/<timestamp>_add_cv_snapshot.sql`:
   - `alter table cvs alter column persona_id drop not null;`
   - `alter table cvs alter column template_id drop not null;`
   - `alter table cvs add column snapshot jsonb;`
   - `alter table cvs add constraint cvs_live_xor_frozen check ((persona_id is not null and snapshot is null) or (persona_id is null and snapshot is not null));`
   - Apply via the Supabase MCP tool (`apply_migration`), per this session's
     established pattern (recent migrations applied live, not just written to disk) —
     confirm with the user before applying to the real project if that's still the
     expected flow, otherwise follow whatever the `supabase` skill's current guidance
     says for this repo.
2. Regenerate `database.types.ts` (`generate_typescript_types`).
3. Update `DbCv` (`mocks/types.ts:204-217`): `personaId: string | null`,
   `templateId: string | null`, add `snapshot: CvSnapshotV1 | null`.
4. Update `mapCvRow` (`persona-store.tsx:113-128`) for the new/changed columns —
   `snapshot: row.snapshot ? parseCvSnapshot(row.snapshot) : null` (parse on read, same
   discipline `parseTemplateDefinition` gets for template defs elsewhere).
5. **Verification**: `npm run typecheck` — this alone will surface every call site
   that assumed `cv.personaId`/`cv.templateId` are non-null (expect `cv-list-panel.tsx`,
   `cv.ts`'s `resolveCv`/duplicate/etc., `cv-form-dialog.tsx` callers to need
   follow-up — those are Phase 3's job, but let typecheck enumerate them here first
   rather than guessing the list).

## Phase 3 — `resolveCv` frozen branch + CV UI adapts to nullable persona/template

1. `resolveCv` (`cv.ts:32-53`): add the frozen branch from spec 09 — if `cv.snapshot`,
   return `{ cv, document: cv.snapshot.document, template: templateFromSnapshot(cv.snapshot) }`
   directly, skip the persona/inventory lookup entirely.
2. Fix every typecheck failure Phase 2 surfaced. Expected, from the current reads:
   - `cv-list-panel.tsx`: `persona?.name ?? "—"` etc. already null-safe by luck
     (optional chaining), but `findPersona(store, cv.personaId)` now takes
     `string | null` — confirm `findPersona`'s signature accepts that or guard before
     calling.
   - `CvFormDialog`: add the `frozen?: boolean` mode from doc discovery — hides
     Persona/Template `Select`s, `canSubmit` drops the `personaId`/`templateId`
     checks when frozen. `cv-list-panel.tsx`'s Edit menu item passes `frozen={cv.snapshot != null}`.
   - `PersonaFieldTree` (read in full at this point, not assumed): gate the
     Visibility/Data tabs behind `cv.personaId !== null` — hide or disable them for a
     frozen CV, per spec 09.
3. Give frozen CVs a visual marker in the list — a small "Imported" `Badge` next to
   the name in `cv-list-panel.tsx`, keyed off `cv.snapshot != null`.
4. **Verification**: `npm run typecheck && npm run lint && npm run build` all clean.
   No new frozen CVs exist yet (Phase 4 adds import), so this is a structural/type
   pass — confirm the *existing* live CVs still render correctly in the browser
   (`/cvs`, `/cvs/:id/print`) since this phase touched shared code paths.

## Phase 4 — Export / Import UI

1. **Export**: add an action that calls `buildCvSnapshot(cv, document, template)` (both
   already in scope at the call site via `resolveCv`'s return) and downloads
   `<slugified-name>.json` via `Blob`/`URL.createObjectURL` (no new dependency —
   confirm nothing like this exists yet with a quick grep for `createObjectURL` before
   writing it, in case a helper already exists elsewhere in the repo).
   - `cv-list-panel.tsx`: new "Export" item in each row's `DropdownMenu`.
   - `cv-print.tsx`: new "Export" `Button` next to the existing "Print" button in
     `CvResolved`.
2. **Import**: new `importCvSnapshot(store: PersonaStore, snapshot: CvSnapshotV1): Promise<DbCv>`
   in `cv.ts` — inserts a `cvs` row with `persona_id: null`, `template_id:
   snapshot.template.id`, `snapshot: snapshot as unknown as Json`,
   `template_settings: snapshot.templateSettings as unknown as Json`, `name`/`note`/
   `tags` from the snapshot. Mirrors `createCv`'s shape (`cv.ts:68-93`).
   - `cv-list-panel.tsx`: "Import" `Button` next to "New CV" — hidden `<input
     type="file" accept="application/json">`, `FileReader`/`.text()` → `JSON.parse` →
     `parseCvSnapshot` → `importCvSnapshot`. Parse/validation failures surface as a
     toast (check what toast primitive the repo already uses — `sonner` per other
     mutation error handling, confirm by grep before assuming).
3. **Verification, live in the browser** (this phase is exactly the round-trip spec 09
   exists for, so verify it as one, not just typecheck):
   - Export a real existing CV, confirm the downloaded JSON parses and has the
     expected shape (`formatVersion: 1`, non-empty `document.sections`, full `template`
     object with `styles`/`blocks`/`root`).
   - Import that same file back in. Confirm: new row appears in `/cvs` marked
     "Imported", clicking through to `/cvs/:id/print` renders **the same visual
     output** as the original (this is what Phase 1's `templates/index.tsx` fix
     exists to make true — if it renders wrong, that fix has a bug, not this phase).
   - Confirm Visibility/Data tabs are absent on the imported CV's detail page, Style/
     Page/Block tabs are present and a style override actually applies.
   - `npm run typecheck && npm run lint && npm run build` clean.

## Phase 5 — Applications data model

1. New migration `supabase/migrations/<timestamp>_add_applications.sql` — exactly the
   two tables + enum from spec 10 (`application_status` enum, `applications`,
   `application_status_history`), RLS policies (direct on `applications`,
   reached-through-parent on `application_status_history`, same shape as spec 03's
   `cv_sections` example), the two indexes named in the spec. Apply live, regenerate
   `database.types.ts`, same process as Phase 2.
2. New `src/mocks/types.ts` additions (or a dedicated spot — match wherever `DbCv`
   lives): `DbApplication`, `DbApplicationStatusHistory`, `ApplicationStatus` (the 7
   literal union, matching the SQL enum's exact values —
   `"draft"|"applied"|"interview_call"|"approved"|"rejected"|"archived"|"withdraw"`).
3. **Verification**: migration applies cleanly against the live project (check with
   `get_advisors` per the Supabase MCP instructions — zero new findings, matching this
   repo's established zero-advisor-findings bar from prior migrations), `database.types.ts`
   regenerated and typechecks.

## Phase 6 — Applications data layer

1. New `src/lib/application-store.tsx` — `ApplicationStoreProvider`/
   `useApplicationStore`, mirroring `persona-store.tsx:145-275` exactly: fetch
   `applications` + `application_status_history` once per session on `userId`/
   `version` change, `mapApplicationRow`/`mapApplicationStatusHistoryRow`, `refetch`.
   Mount it in `App.tsx`'s `RequireAuth`, nested inside `PersonaStoreProvider` (needs
   `resolveCv` for the freeze step) — `<InventoryStoreProvider><PersonaStoreProvider><ApplicationStoreProvider><AppLayout /></ApplicationStoreProvider></PersonaStoreProvider></InventoryStoreProvider>`.
2. New `src/lib/application.ts`:
   - Selectors: `allApplications`, `findApplication`, `applicationHistory(store, applicationId)`
     (sorted `changed_at` ascending or descending — pick one, document it, the UI's
     "newest first" requirement can reverse at render time instead if that's simpler).
   - `createApplication` — inserts the row (`status: "draft"`) **and** one initial
     `application_status_history` row (`status: "draft"`), per spec 10's "timeline
     always starts at a real point" rule. Two inserts — either sequential awaits or
     confirm whether Supabase's JS client supports a single RPC/transaction for this;
     default to sequential awaits (matches this codebase's existing style, e.g.
     `duplicateCv`/`createPersona`'s single-insert simplicity — nothing here currently
     wraps multi-table writes in a DB-side transaction) unless doc discovery at
     execution time finds a reason to.
   - `updateApplication` — patch title/source/vacancy detail/apply via/cv_id/note, same
     partial-patch shape as `updateCv` (`cv.ts:96-122`).
   - `deleteApplication` — plain delete; `application_status_history` cascades via FK.
   - `setApplicationStatus(store, applicationId, next: ApplicationStatus, note?: string)`:
     the freeze logic from spec 10 — throws if leaving `draft` with no `cv_id`; on
     first non-draft transition, calls `resolveCv` + `buildCvSnapshot` (from Phase 1)
     and writes `cv_snapshot`; always updates `status` and inserts one history row.
     **This is the phase where spec 09's foundation actually gets exercised by
     Applications** — if Phase 1–4 shipped a working export, this mutator is mostly
     wiring, not new logic.
3. **Verification**: `npm run typecheck && npm run lint`. No UI yet to click through —
   defer functional verification to Phase 7/8 where it's actually observable.

## Phase 7 — Applications page UI

1. `src/pages/applications.tsx` replaces the `PlaceholderPage` with a real page: table
   (Title, Status badge, Source, CV name via `findCv`, updated_at) + status filter +
   "New Application" button.
2. New `application-form-dialog.tsx` (mirrors `cv-form-dialog.tsx`'s shape): Title
   (required), Source (URL text), Vacancy detail (`Textarea`), Apply via (text), CV
   picker (`Select` over `allCvs`, optional).
3. New `application-detail-sheet.tsx`: `Sheet` opened on row click — editable fields
   (reuses the form dialog's fields inline or as a sub-component, avoid duplicating the
   field markup per this repo's "second occurrence is the extraction signal" rule),
   a Status `Select` (options disabled when `cv_id` is unset and current status is
   `draft`, matching the mutator's guard), a confirmation step (`AlertDialog`, same
   pattern as `DeleteCvDialog`) the first time status leaves `draft` — copy: "This
   freezes a copy of the attached CV as it looks right now. Later edits to the CV
   won't affect this application." — and the status history timeline (simple list,
   `Badge` per status + relative timestamp via whatever date-formatting the repo
   already uses elsewhere, e.g. `PartialDatePicker`/existing date display code —
   check before introducing a new date library).
4. New `delete-application-dialog.tsx`, copy of `delete-cv-dialog.tsx`'s shape.
5. **Verification, live in the browser**:
   - Create an application in `draft`, attach a CV, confirm the status `Select` is
     gated correctly before a CV is attached (create one with no CV first, confirm
     non-draft options are disabled/blocked).
   - Move it to `applied`, confirm the freeze-confirmation copy appears, confirm after
     confirming that `cv_snapshot` is populated (check via the detail Sheet or
     `execute_sql`) and the status history shows two entries (`draft`, `applied`).
   - Edit the *source* CV afterward, confirm the application's frozen preview (Phase 8)
     does **not** change, while a second application still in `draft` pointing at the
     same CV **does** reflect the edit.
   - Move status again (e.g. `applied` → `interview_call`), confirm `cv_snapshot`
     is unchanged (still the original freeze) and history now has three entries.
   - `npm run typecheck && npm run lint && npm run build` clean.

## Phase 8 — Frozen-CV render route for Applications

1. New route `/applications/:id/cv` (`App.tsx`) → new `application-cv-print.tsx`
   (or a thin wrapper reusing `cv-print.tsx`'s `CvResolved`/`ResumeRender` structure —
   prefer reuse over a parallel copy, per CLAUDE.md's extraction rule; assess at
   execution time whether `CvResolved` can be parameterized to accept either a
   `DbCv`+`resolveCv` pair or an application+its resolved document/template, rather
   than forking the whole component).
2. Resolution function per spec 10: prefer `application.cvSnapshot` when set, else
   `resolveCv` off `application.cvId` (live), else an empty/"no CV attached" state
   (reuse `CvUnresolved`'s pattern from `cv-print.tsx`).
3. Link to this route from the detail Sheet (Phase 7).
4. **Verification, live in the browser**: open the route for both a still-draft
   application (confirm it tracks live CV edits) and a frozen one (confirm it matches
   the export from Phase 4's verification step, byte-for-byte in rendered output) —
   this is the same "does the inline `TemplateDefinition` actually render correctly"
   check as Phase 4, now exercised through the Applications path instead of the CV
   import path, confirming Phase 1's fix generalizes.

## Final verification

- `npm run typecheck && npm run lint && npm run build` clean at the end, not just per
  phase.
- Full browser walkthrough: `/cvs` (export, import, imported-CV detail tabs),
  `/applications` (create, attach CV, move through 3+ statuses, view frozen render,
  confirm source CV independence), zero console errors throughout.
- Update `docs/progress.md` with one new row per this plan's completion, following the
  existing row format (initiative name, spec/plan links, status, a prose summary of
  what actually shipped vs. what this plan assumed) — per CLAUDE.md's "keep progress.md
  in sync with reality" rule.

## Out of scope (carried from both specs verbatim)

- Full editable Persona/Inventory reconstruction on import.
- Bulk export/import of multiple CVs.
- Un-freezing an imported CV back into a live Persona-backed one.
- Dashboard pipeline view for Applications.
- Reminders/follow-up dates, multiple CVs per application, a real status state
  machine, attachments beyond the one CV.
- Any change to the whole-Profile `resume.json` Import/Export utility page
  (`src/pages/inventory/import-export.tsx`) — unrelated existing placeholder.

## Open items to resolve at execution time (not blocking, flagged so they aren't missed)

- Whether `ResumeDocument` gets a real zod schema in Phase 1 or a looser boundary
  check — decide once attempted, don't guess the effort here.
- Exact tab-gating implementation in `PersonaFieldTree` (Phase 3) — file wasn't read
  in full during planning; read it before writing the gating logic.
- Toast/error-surfacing primitive for import parse failures (Phase 4) — confirm
  what's already used in this codebase rather than introducing a new one.
- Whether Supabase's client supports a single-transaction two-table insert for
  `createApplication` (Phase 6) — default to sequential awaits unless discovered
  otherwise.
