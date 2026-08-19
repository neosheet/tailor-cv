# 17 — CV embedded in Applications

Spec: [specs/15-cv-embedded-in-applications.md](../specs/15-cv-embedded-in-applications.md)

## Why (context a fresh session needs)

A CV is currently a standalone `cvs` table row (Persona + Template + field-visibility +
style/page/node overrides), managed on its own `/cvs` page, referenced by an
`applications.cv_id` FK and frozen into `applications.cv_snapshot` on first leaving
`draft`. This plan collapses that indirection: each application directly owns its own
CV config (persona, template, overrides) as four new columns on `applications`, edited
inline in the application detail view's new "CV" tab — no separate page, no separate
list, no dialog-driven "Edit CV" flow. The freeze mechanism is unchanged in behavior,
just re-sourced from the application's own columns.

## Locked-in decisions (from the spec — do not re-open)

- Keep the template system (`cv_templates` table, built-ins, "Save as new template");
  drop the standalone Templates gallery page. Template picking/saving happens inline
  from the CV tab.
- **Lazy setup**: a new application's CV tab starts empty; opening it prompts for a
  Persona + Template. The New/Edit Application dialog does **not** get a CV picker
  added — see the correction below, it currently *has* one to remove.
- Drop entirely: CV Export, Import-from-file, Duplicate-CV, Favorite.
- **Rework Import** → "copy CV settings from another application": pick a source
  application with a live (non-frozen) CV; copies `cv_persona_id`, `cv_template_id`,
  `cv_persona_settings`, `cv_template_settings` onto the target. Settings only — the
  document itself always resolves live from whichever persona ends up set.
- **Freezing never clears** `cv_persona_id`/`cv_template_id`/`cv_persona_settings`/
  `cv_template_settings` — same non-clearing pattern `cv_id` already follows today.
  This is what keeps "Used in Applications" (below) correct after a freeze.
- Persona detail's "Used in CVs" card → "Used in Applications", filtered on
  `applications.cvPersonaId === persona.id`, linking to `/applications/:id`.
- No data-preserving migration needed — live data confirms (queried directly, see
  below) all 3 existing applications are already frozen; none depend on a live
  `cv_id`. Drop `cv_id`/`cvs` outright in the same migration that adds the new columns.

### Corrections found during planning (spec assumptions that don't hold — resolved here, not re-asking)

1. **`application-form-dialog.tsx` is NOT untouched** — it currently has a live "CV"
   picker field (`cvId`/`cvOptions`/`NO_CV` sentinel, lines cited below). Since CV
   setup is lazy (inside the new CV tab, not at creation) and there's no more list of
   existing CVs to pick from, this field is removed outright in Phase 4.
2. **`personas.tsx` has its own "New CV" flow** (imports `createCv`, `CvFormDialog`,
   `cvTemplates`, likely a "New CV" button/dialog wired to the Personas list) that
   isn't mentioned in the spec. Since `cvs`/`createCv`/`CvFormDialog` are all being
   deleted, this flow is removed in Phase 6 — there's no "create a standalone CV"
   concept left anywhere in the app.
3. **`buildCvSnapshot`'s `name`/`note`/`tags` params have no source once `cvs.name`
   is gone.** Decision: the freeze step (Phase 3) passes `name: application.title`,
   `note: null`, `tags: []` — an application's own `note`/`tags` fields are unrelated
   metadata, not the CV's.
4. **`ResolvedApplicationCv`'s `live` variant currently carries `cv: DbCv`** — once
   `DbCv` is gone, drop that field entirely rather than replacing it; every call site
   already has the `application` it passed in to `resolveApplicationCv`, so nothing
   needs the redundant copy.
5. **Frozen-detection in `persona-field-tree.tsx` currently reads `cv.personaId ===
   null`** (true only for file-imported CVs, a concept also being dropped). The
   equivalent post-migration signal is `application.cvSnapshot !== null` — freezing is
   the only way a CV becomes read-only now.

## Current-state summary (confirmed via direct file reads + live schema query)

### Live schema (queried directly against project `artmbeeadepxggbvfkdr` via
`mcp__claude_ai_Supabase__list_tables` — local migration history is incomplete for
`cvs`/`personas`, so this is ground truth, not the migrations folder)

- `cvs`: `id, user_id, persona_id (nullable), template_id (nullable text), name, note,
  created_at, updated_at, template_settings (jsonb default {}), favorite (bool),
  tags (text[]), persona_settings (jsonb default {}), snapshot (jsonb, nullable)`.
  FKs: `cvs_persona_id_fkey → personas(id)`, `cvs_user_id_fkey → profiles(id)`,
  `applications_cv_id_fkey → cvs(id)` (the one to drop first). 2 rows.
- `applications`: has `cv_id (uuid, nullable)` and `cv_snapshot (jsonb, nullable)`
  among its ~26 columns; `applications_cv_id_fkey → cvs(id)`. 3 rows, all with both
  `cv_id` and `cv_snapshot` set (i.e. already frozen).
- `cv_templates`: unaffected, kept as-is. 0 rows currently.
- `personas`: unaffected, kept as-is.

### `src/components/cv/persona-field-tree.tsx` (1064 lines, full read)

- Exported `PersonaFieldTree({ cv, template }: PersonaFieldTreeProps)` — L959-993.
  Props today: `cv: DbCv`, `template: CvTemplate`.
- All 9 `lib/cv.ts` mutators are called, **always passing only `cv.id`** (never the
  object): `setKindHidden` L280, `setFieldHidden` L300-306, `setItemHidden` L419,
  `setCvStyleProperty` L749/L761, `resetCvStyleProperty` L751, `setCvPageProperty`
  L815, `resetCvPageProperty` L816, `setCvNodeOverride` L933/L947,
  `resetCvNodeOverride` L932/L937/L949. `saveAsNewTemplate(personaStore, cv, template,
  fields)` at L1058 is the one call passing the **whole `cv` object** — only reads
  `cv.templateSettings` inside `lib/cv.ts`'s implementation (see below).
- Reads of `cv.templateSettings`: L691, L781, L877, L1000-1002 (`hasOverrides`).
- Reads of `cv.personaSettings.fieldVisibility`: L326, L400.
- Reads of `cv.personaId`: L317/320, L464/467, and L994 (`isFrozen = cv.personaId ===
  null` — gates the Visibility/Data tabs and the default tab; **replace with
  `application.cvSnapshot !== null`**, correction #5 above).
- Reads of `cv.id`: only as the `cvId` string arg to the 8 direct mutators.
- Migration: swap `cv: DbCv` → `application: DbApplication` (has `.id`,
  `.cvTemplateSettings`, `.cvPersonaSettings`, `.cvPersonaId`, `.cvSnapshot`, all
  needed). Rename `cv.id`→`application.id` at all 8 call sites, prop-thread
  `applicationId` down through the same sub-components that currently take `cv`
  (`KindRow`/`ItemRow`/`StyleTab`/`PageTab`/`BlockTab` — exact names per the file).

### Reusable, template-agnostic (no `DbCv`/`cvs` dependency — confirmed via grep, no changes needed)

- `save-as-new-template-dialog.tsx` — props `open, onOpenChange, onSubmit: (fields:
  {name, description}) => Promise<void>` (L23-31). No `cv` reference.
- `template-view-dialog.tsx` — props `template: CvTemplate | null, document:
  ResumeDocument, onClose` (L14-23).
- `template-card.tsx` — props `template: CvTemplate, document: ResumeDocument, onView`
  (L31-40).
- `templates-panel.tsx` is the **only** page-specific glue wiring these three together
  for the standalone gallery (builds `document` from a locally-picked `personaId`, not
  tied to any `cv`) — this is the file to delete; the other three survive untouched
  and get reused directly from the new CV tab.

### `src/components/cv/cv-form-dialog.tsx` (216 lines) — picker pattern to copy, not import

- Persona `<Select>` block: **L145-165**. Template `<Select>` block: **L166-186**. Both
  wrapped together in `{frozen ? null : (<>...</>)}` (L143-188) — this exact JSX
  (L145-186) is the copy-ready snippet for the CV tab's lazy-setup prompt. Name/note/
  tags fields (L122-142, L191-197) are separate and are **not** needed — the new
  applications-embedded CV has no name/note/tags of its own.
- The whole file becomes orphaned once `createCv`/`duplicateCv`/`updateCv`(for `cvs`)
  and `personas.tsx`'s New CV flow are gone — delete it in Phase 6, after Phase 4 has
  already copied the picker JSX inline.

### `src/lib/cv-snapshot.ts` (92 lines, full read)

- `buildCvSnapshot(cv: DbCv, document: ResumeDocument, template: CvTemplate):
  CvSnapshotV1` (L46-61) reads only `cv.name`, `cv.note`, `cv.tags`,
  `cv.templateSettings` — **not** `cv.id`/`cv.personaId`/`cv.personaSettings`. Relax
  the param type to `{ name: string; note: string | null; tags: string[];
  templateSettings: TemplateSettings }` (a `Pick`-style inline type) — no other
  restructuring needed. Freeze call site passes the synthetic object per correction #3.
- `CvSnapshotV1` shape (L17-26): `formatVersion, exportedAt, name, note, tags,
  document, template: TemplateDefinition, templateSettings`. `templateFromSnapshot`
  (L81-91) builds a `CvTemplate` from `snapshot.template` alone — untouched.
- `cv-template-core.ts`/`cv-template-bake.ts`: grepped for `DbCv`/`cv:` — zero
  matches in either. Neither depends on the `cvs` table shape.

### `src/lib/application-store.tsx` (235 lines, full read)

- `ApplicationData` (L18-22): `{ applications, applicationStages, stageTemplates }`.
- `mapApplicationRow` (L38-66) maps every column 1:1, including `cvId: row.cv_id`
  (L53) — replace with the 4 new field mappings.
- Fetch query (L148-153): plain `select("*")` — no query change needed, only
  `mapApplicationRow` + types.

### `src/lib/persona-store.tsx` (308 lines, full read)

- `PersonaData` (L51-58) has `cvs: DbCv[]` and `cvTemplates: DbCvTemplate[]` — delete
  the former, keep the latter.
- `mapCvRow` (L115-131) — delete entirely.
- Fetch `Promise.all` (L204-228): `supabase.from("cvs").select("*")...` leg (L218-222)
  to delete; `cv_templates` leg (L223-227) stays.
- `cvsResult` error check (L233) and `setCvs(...)` hydration (L242) — delete;
  `cvTemplatesResult` (L234/243) stays. `useState<DbCv[]>` (L175) — delete.
- Header comment block (L20-31) explains the "one combined store" rationale for
  bundling `cvs` with personas — rewrite once `cvs` is gone.
- Prune imports: `DbCv` (L14), `parseCvSnapshot` (L10, only used at L127 — confirm no
  other use before removing).

### `src/mocks/types.ts` (381 lines, full read)

- `FieldVisibility` (L70-75) / `CvPersonaSettings` (L78-80) — types survive, just
  relocate onto `applications`. Doc comment at L66 says "Lives on `cvs.persona_
  settings`, not `personas`" — update to `applications.cv_persona_settings`.
- `DbCv` (L211-226) — delete entirely.
- `DbCvTemplate` (L233-240) — unaffected.
- `DbApplication` (L320-347) — has `cvId: string | null` (L334) to remove, `cvSnapshot`
  (L337) to keep, and 4 new fields to add: `cvPersonaId: string | null, cvTemplateId:
  string | null, cvPersonaSettings: CvPersonaSettings, cvTemplateSettings:
  TemplateSettings`.

### `src/lib/application.ts` (437 lines, full read earlier in this session)

- `allApplications`/`findApplication` already exist (L31-40) — no new export needed
  for the "Used in Applications" filter.
- `ApplicationFormFields` (L178-195): add `cvPersonaId?: string | null, cvTemplateId?:
  string | null`. `cvPersonaSettings`/`cvTemplateSettings` are **not** general form
  fields — they're only ever touched by the dedicated field-visibility/style/page/node
  mutators (moved from `lib/cv.ts`, Phase 3), same separation `cvs` already had.
- `createApplication` (L203-239): insert the 2 new scalar fields (persona/template
  id), default settings columns start `{}` via the DB column default — no insert-time
  value needed. `updateApplication` (L242-283): add conditional patches for the 2
  scalar fields, same pattern as every other field there.
- `resolveApplicationCv` (L81-103) and `setGlobalApplicationStatus` (L370-436) both
  branch on `application.cvId`/`current.cvId` (L95, L392, L403) and call
  `resolveCv(persona, inventory, application.cvId)` (L96, L403) — full rewrite, not a
  rename: the resolution path changes from "look up a `cvs` row" to "build the
  document directly from `application.cvPersonaId`/`cvTemplateId`/`cvPersonaSettings`".

### Migration filename/RLS/index conventions (from `supabase/migrations/`, 19 files)

- Filename: `YYYYMMDDHHMMSS_snake_case_description.sql` — exact timestamp is whatever
  `apply_migration` stamps, don't hardcode one.
- Additive columns: plain `alter table public.<table> add column ...`, doc-comment
  header referencing the spec (see `20260816031400_add_application_applied_at.sql`).
- RLS: `create policy "own <noun>" on <table> for all to authenticated using
  (auth.uid() = user_id) with check (auth.uid() = user_id)` for own-user tables — not
  needed here, `applications`' existing policy already covers the new columns; `cvs`'
  own policy is dropped along with the table itself.
- No explicit index was ever added for `applications.cv_id` (spec 10: "already covered
  by the FK") — same precedent applies to `cv_persona_id`; the "Used in Applications"
  list filters the already-fetched in-memory `applications` array client-side (same as
  today's `usedByCvs`), not a DB query, so no new index is needed.

### Other exact touchpoints (file:line)

- `src/lib/navigation.ts`: `sections.cvs` entry at **L266-277** (path `/cvs`, title
  "CV", icon `FileTextIcon` — icon import stays, also used by
  `inventoryPages.importExport`). `allPages` (L315-318) spreads `Object.values
  (sections)` — deleting the `cvs` key alone removes it from breadcrumbs/lookup.
- `src/App.tsx`: routes to delete — **L85** (`cvs` → `CvPage`), **L86** (`cvs/:cvId/
  print` → `CvPrintPage`). Imports to remove: **L7** (`CvPage`), **L8**
  (`CvPrintPage`). `applications/:id/cv` (**L89**, `ApplicationCvPrintPage`) stays
  untouched. Provider nesting: `RequireAuth` (L34-54) wraps `InventoryStoreProvider >
  PersonaStoreProvider > ApplicationStoreProvider > AppLayout` — `useApplicationStore`
  is available on every route, including `persona-detail.tsx`.
- `src/components/persona/delete-persona-dialog.tsx` (49 lines, full): prop `cvCount?:
  number` (L24-25), copy (L33-38): `"This permanently removes the Persona" +
  (cvCount ? \` and the ${cvCount} CV${cvCount === 1 ? "" : "s"} built from it\` : "
  and any CVs built from it") + ". This can't be undone."`. Rename prop to
  `applicationCount`, update copy to "applications using it" / "any applications
  using it".
- `src/pages/persona-detail.tsx`: `usedByCvs` at **L132-134**
  (`allCvs(personaStore).filter((cv) => cv.personaId === persona.id)`). "Used in CVs"
  Card JSX: **L358-394** (empty-state copy "Not saved into any CV yet." at L363-366;
  `ItemGroup` mapping links to `` /cvs/${cv.id}/print `` at L378, shows template name
  via raw `cvTemplates.find(...)` at L370-372/384-386 — **use `findTemplate` instead**,
  same precedent plan 28 already set at other call sites, since a saved custom
  template wouldn't be found by the raw built-in array). `cvCount={usedByCvs.length}`
  call site: **L441-449**. Imports to drop: `cvTemplates` (L55), `allCvs` from
  `@/lib/cv` (L56). Imports to add: `useApplicationStore`, `allApplications` (from
  `@/lib/application`), `findTemplate` (from `@/lib/cv-templates`, if not already
  imported for something else on this page — check).
- `src/components/applications/application-form-dialog.tsx`: CV field to delete —
  state `cvId`/`setCvId` (L105), sentinel `NO_CV = "none"` (L35), prop `cvOptions:
  {value, label}[]` (L91), `Field`/`Select` block labeled "CV" (**L329-349**),
  submitted as `cvId: cvId === NO_CV ? null : cvId` in `onSubmit` (L167). Every other
  field (Title, Company, Position, Location, Deadline, Job type, Working type, URL,
  Vacancy detail, Cover letter, Apply via, Note/Tags) is untouched. The `cvOptions`
  prop and whatever passes it in from the parent (`applications.tsx` or wherever the
  dialog is instantiated) also needs its call site cleaned up — check when editing.
- `personas.tsx`: imports `createCv`, `CvFormDialog`, `cvTemplates` (L30, L34, L35 per
  grep) and renders its own `DeletePersonaDialog` (L270-278) **without** a `cvCount`
  prop (pre-existing inconsistency, out of scope — leave as-is, don't add
  `applicationCount` there either). Read the file in full during Phase 6 to find the
  exact "New CV" button/dialog JSX (not captured by the fact-gathering pass) and
  remove it and its state/handlers cleanly.
- Grep hit inventory for the final sweep (Phase 6), not all covered above:
  `from "@/lib/cv"` also in `application-list-panel.tsx:61`, `application-kanban-
  panel.tsx:12`, `application-detail-view.tsx:42`, `pages/application-detail.tsx:23`.
  `allCvs(` also in `application-kanban-panel.tsx:36`, `application-list-panel.tsx:133`,
  `pages/application-detail.tsx:65`. `findCv(` also in `application-list-panel.tsx:144`,
  `application-detail-view.tsx:314`. `resolveCv(` in `pages/cv-print.tsx:164` (whole
  file deleted) — confirm no other survivors after Phases 3-4.

## Data model

### Migration (apply via `mcp__claude_ai_Supabase__apply_migration` against project
`artmbeeadepxggbvfkdr` — consult the `supabase` skill for current best practice before
running; this is DDL + a table drop, treat as the risky step it is)

```sql
-- CV ownership moves from a standalone `cvs` table onto the application that owns
-- it. See docs/specs/15-cv-embedded-in-applications.md.
alter table public.applications
  add column cv_persona_id uuid references public.personas(id) on delete set null,
  add column cv_template_id text,
  add column cv_persona_settings jsonb not null default '{}'::jsonb,
  add column cv_template_settings jsonb not null default '{}'::jsonb;

alter table public.applications drop column cv_id;

drop table public.cvs;
```

Column order: drop `cv_id` (and its FK to `cvs`) *before* dropping `cvs` itself, so no
`cascade` is needed. No RLS/index changes — see conventions above.

### Type regeneration

After the migration lands, regenerate `src/lib/database.types.ts` via
`mcp__claude_ai_Supabase__generate_typescript_types` (no local npm script exists for
this — confirmed via `package.json`). Never hand-edit this file.

## Phase 1 — Database migration

1. Read the `supabase` skill for current migration best practices.
2. Apply the migration above via `apply_migration`.
3. Regenerate `database.types.ts` via `generate_typescript_types`.
4. Run `mcp__claude_ai_Supabase__get_advisors` (type `security`) — confirm no new
   findings beyond the pre-existing leaked-password-protection warning.

**Verify:** `list_tables` on `applications` shows the 4 new columns and no `cv_id`;
`cvs` is gone from the table list.

## Phase 2 — Types & store layer

1. `src/mocks/types.ts`: delete `DbCv`; on `DbApplication` remove `cvId`, add
   `cvPersonaId: string | null, cvTemplateId: string | null, cvPersonaSettings:
   CvPersonaSettings, cvTemplateSettings: TemplateSettings`; update `FieldVisibility`'s
   doc comment to reference `applications.cv_persona_settings`.
2. `src/lib/application-store.tsx`: `mapApplicationRow` — drop `cvId: row.cv_id`, add
   the 4 new mappings (`cv_persona_id`, `cv_template_id`, `cv_persona_settings as
   CvPersonaSettings`, `cv_template_settings as TemplateSettings`, matching the
   existing `(row.x ?? {}) as unknown as T` cast pattern used elsewhere in this file
   for jsonb columns).
3. `src/lib/persona-store.tsx`: remove `cvs` from `PersonaData`, `setCvs` from
   `PersonaStore`, the `cvs` fetch leg + error check + hydration, `mapCvRow`, the
   `DbCv`/`parseCvSnapshot` imports (confirm `parseCvSnapshot` has no other use
   first), and rewrite the header comment's "combined store" rationale.

**Verify:** `npm run typecheck` will still fail here (data layer not yet updated) —
that's expected; don't chase every error yet, just confirm these specific edits landed.

## Phase 3 — Data layer mutators (`lib/application.ts`)

1. Move the 9 mutators from `lib/cv.ts` into `lib/application.ts`, retargeted:
   `cvId: string` param → `applicationId: string`; `findCv(store, cvId)` →
   `findApplication(store, applicationId)`; the Supabase update targets
   `.from("applications").update({ cv_persona_settings: next })` /
   `.update({ cv_template_settings: next })` instead of `cvs`. Keep each mutator's
   internal shallow-merge logic identical (`setKindHidden`, `setFieldHidden`,
   `setItemHidden`, `setCvStyleProperty`/`resetCvStyleProperty`,
   `setCvPageProperty`/`resetCvPageProperty`, `setCvNodeOverride`/
   `resetCvNodeOverride`) — only the target table/store/id changes.
2. Add `setApplicationCvBase(store, applicationId, personaId, templateId)` — the
   lazy-setup mutator, a thin wrapper over `updateApplication` with `cvPersonaId`/
   `cvTemplateId` patched (settings columns keep their `{}` default).
3. Add `copyApplicationCvSettings(store, sourceApplicationId, targetApplicationId)` —
   the reworked Import. Look up the source via `findApplication`; throw if it has no
   `cvPersonaId`/`cvTemplateId` set, or if `source.cvSnapshot !== null` (frozen — not a
   valid source, per spec). Otherwise `updateApplication(store, targetApplicationId,
   { cvPersonaId: source.cvPersonaId, cvTemplateId: source.cvTemplateId,
   cvPersonaSettings: source.cvPersonaSettings, cvTemplateSettings:
   source.cvTemplateSettings })`.
4. Move `saveAsNewTemplate` from `lib/cv.ts`, signature `(store, application:
   DbApplication, base: CvTemplate, fields) => Promise<DbCvTemplate>`, reading
   `application.cvTemplateSettings` instead of `cv.templateSettings` — body otherwise
   unchanged (`bakeTemplateSettings(base.definition, application.cvTemplateSettings)`).
5. Rewrite `ResolvedApplicationCv`: drop the `cv`/`application` field from the `live`
   variant (correction #4) — `{ kind: "live"; document: ResumeDocument; template:
   CvTemplate }`. Rewrite `resolveApplicationCv`'s live branch:
   ```ts
   if (application.cvPersonaId && application.cvTemplateId) {
     const document = buildResumeDocument(
       persona, inventory, application.cvPersonaId,
       application.cvPersonaSettings.fieldVisibility ?? {}
     )
     const template = findTemplate(application.cvTemplateId, persona.cvTemplates) ?? cvTemplates[0]
     return { kind: "live", document, template }
   }
   ```
6. Rewrite `setGlobalApplicationStatus`'s freeze step: gate on `!current.cvPersonaId ||
   !current.cvTemplateId` (was `!current.cvId`); build the document/template the same
   way as step 5; call `buildCvSnapshot({ name: current.title, note: null, tags: [],
   templateSettings: current.cvTemplateSettings }, document, template)` (correction
   #3) instead of `resolveCv(...)`.
7. `src/lib/cv-snapshot.ts`: relax `buildCvSnapshot`'s `cv` param type per the Current-
   state section above.
8. Delete `src/lib/cv.ts` entirely once nothing imports from it anymore (re-check with
   a grep before deleting — Phase 4/6 still reference it until their edits land, so
   this file may need to survive until Phase 6's final sweep in practice; use
   judgment, note in the commit which phase actually removed it).

**Verify:** every former `lib/cv.ts` mutator call site (`persona-field-tree.tsx`) will
be broken until Phase 4 — expected. `resolveApplicationCv`/`setGlobalApplicationStatus`
should compile cleanly on their own once `application.ts`'s new fields exist (Phase 2).

## Phase 4 — CV tab UI in application detail

1. `persona-field-tree.tsx`: swap the `cv: DbCv` prop for `application: DbApplication`
   throughout (component + every sub-component listed in the Current-state section).
   Update all 8 direct-mutator call sites (`cv.id` → `application.id`), the
   `saveAsNewTemplate` call, and every read of `cv.templateSettings`/
   `cv.personaSettings`/`cv.personaId` to the `application.cvTemplateSettings`/
   `cvPersonaSettings`/`cvPersonaId` equivalents. Replace the `isFrozen = cv.personaId
   === null` check with `application.cvSnapshot !== null` (correction #5).
2. New small component for the lazy-setup empty state (e.g.
   `application-cv-setup.tsx` in `src/components/applications/`): the Persona +
   Template `<Select>` pair copied from `cv-form-dialog.tsx` L145-186, submitting via
   `setApplicationCvBase`.
3. `application-detail-view.tsx`: rename the "CV Preview" tab to "CV". Replace its
   content:
   - `application.cvPersonaId` unset → render the new setup component.
   - `application.cvSnapshot` set (frozen) → keep today's read-only block (`ResumeRender`
     only, no editing UI — a frozen CV stays a read-only display of `cv_snapshot`, per
     the spec's out-of-scope note).
   - otherwise (live, unfrozen) → `PersonaFieldTree` (now taking `application`) beside
     `ResumeRender`, mirroring `cv-print.tsx`'s `CvResolved` layout minus its own
     header/print/export actions (those stay on `/applications/:id/cv`).
   - Add an "Import CV settings" action opening a picker `Dialog` over other
     applications where `cvPersonaId` is set and `cvSnapshot` is null, calling
     `copyApplicationCvSettings`.
4. `JobDetailTab` (`application-detail-view.tsx`): remove the `cv: DbCv | undefined`
   prop, the `findCv`-based `const cv = ...` line (L314), and the `import { findCv }
   from "@/lib/cv"` line. Replace `<DetailField label="CV">{cv?.name ?? "—"}</DetailField>`
   with a value derived from `resolvedCv` (e.g. `` `${resolvedCv.document.personaName}
   — ${resolvedCv.template.name}` `` or "—" when unset).
5. `application-form-dialog.tsx`: delete the CV field entirely (state, sentinel, prop,
   the `Field`/`Select` block at L329-349, the `cvId` line in `onSubmit`) — correction
   #1. Update whatever parent passes `cvOptions` into this dialog to stop doing so.
6. `application-list-panel.tsx` / `application-kanban-panel.tsx`: remove `allCvs`/
   `findCv`/`from "@/lib/cv"` usage (exact lines in Current-state section above); read
   each file's actual CV-display cell/column at those lines during this phase (not
   fully captured by fact-gathering) and replace with a persona-name lookup
   (`findPersona(personaStore, application.cvPersonaId)`) or drop the column if it's
   not load-bearing — use judgment, it's a minor display detail.

**Verify:** `npm run typecheck` should be much closer to clean now — remaining errors
should only be in the files Phase 6 hasn't touched yet (`cv.tsx`, `cv-print.tsx`,
`cv-list-panel.tsx`, `cv-form-dialog.tsx`, `delete-cv-dialog.tsx`, `templates-panel.tsx`,
`personas.tsx`'s New CV flow, `navigation.ts`, `App.tsx`).

## Phase 5 — Persona detail "Used in Applications" + delete-persona dialog

1. `delete-persona-dialog.tsx`: rename `cvCount` → `applicationCount`, update copy per
   Current-state section.
2. `persona-detail.tsx`: replace `usedByCvs` with `usedByApplications =
   allApplications(applicationStore).filter((a) => a.cvPersonaId === persona.id)`
   (needs `useApplicationStore()` — already available on this route, see App.tsx
   provider nesting above). Update the Card: title "Used in CVs" → "Used in
   Applications", empty copy "Not saved into any CV yet." → "Not used by any
   application yet.", `ItemGroup` mapping renders `application.title`, links to
   `` /applications/${application.id} ``, shows template name via
   `findTemplate(application.cvTemplateId ?? "", store.cvTemplates)` instead of raw
   `cvTemplates.find`. Swap imports: drop `allCvs`/`cvTemplates`, add
   `allApplications`, `useApplicationStore`, `findTemplate`. Update the
   `cvCount={usedByCvs.length}` call site to `applicationCount={usedByApplications.length}`.
3. Leave `personas.tsx`'s own `DeletePersonaDialog` usage untouched (pre-existing gap,
   out of scope — do not add `applicationCount` there either, matching today's
   inconsistency rather than fixing an unrelated pre-existing issue mid-migration).

**Verify:** persona-detail's Card reads "Used in Applications" and links resolve.

## Phase 6 — Remove the standalone CV page, nav entry, and `personas.tsx`'s New CV flow

1. Delete: `src/pages/cv.tsx`, `src/pages/cv-print.tsx`,
   `src/components/cv/cv-list-panel.tsx`, `src/components/cv/cv-form-dialog.tsx`,
   `src/components/cv/delete-cv-dialog.tsx`, `src/components/cv/templates-panel.tsx`,
   `src/lib/cv.ts` (if not already removed in Phase 3).
2. `App.tsx`: remove the `cvs`/`cvs/:cvId/print` routes and the `CvPage`/`CvPrintPage`
   imports (L7, L8, L85, L86). Leave `applications/:id/cv` untouched.
3. `navigation.ts`: remove the `sections.cvs` entry (L266-277). Keep the `FileTextIcon`
   import (still used by `inventoryPages.importExport`).
4. `app-sidebar.tsx`: remove the `<SectionMenuItem page={sections.cvs} />` line.
5. `dashboard.tsx`: read the `href={sections.cvs.path}` context (not fully captured by
   fact-gathering — likely one nav/stat card) and remove or repoint that card; use
   judgment based on what's actually there.
6. `personas.tsx`: read the file in full, remove the "New CV" button/dialog and its
   `createCv`/`CvFormDialog`/`cvTemplates` imports and associated state/handlers.
7. Final repo-wide grep sweep for: `from "@/lib/cv"`, `DbCv`, `allCvs(`, `findCv(`,
   `resolveCv(`, `CvFormDialog`, `CvListPanel`, `DeleteCvDialog`, `CvPrintPage`,
   `"/cvs"` / `` `/cvs/ ``. Resolve every hit — should be zero when done.

**Verify:** `npm run typecheck && npm run lint` clean. `npm run build` succeeds.

## Phase 7 — `docs/code-map.md` update

Update in the same change as the file moves above (per `CLAUDE.md`'s "keep it in
sync" rule):
- Remove the `cv.tsx`/`cv-print.tsx` page row and the `cv-list-panel.tsx`/
  `cv-form-dialog.tsx`/`delete-cv-dialog.tsx`/`templates-panel.tsx` component rows.
- Remove the `lib/cv.ts` row; note in `lib/application.ts`'s row that it now also owns
  the field-visibility/style/page/node mutators (formerly `cv.ts`) and
  `saveAsNewTemplate`.
- Update `persona-field-tree.tsx`'s row to describe it as application-facing, not
  CV-facing.
- Add a row for the new lazy-setup component from Phase 4 step 2.
- Update `lib/persona.ts`/`lib/persona-store.tsx` rows to drop CV mentions.
- Update `lib/cv-snapshot.ts`'s row if its description named `DbCv` specifically.

## Phase 8 — Verification

1. `npm run typecheck && npm run lint && npm run build` — all clean.
2. Re-run Phase 6's grep sweep as a final gate — zero hits.
3. `mcp__claude_ai_Supabase__get_advisors` (type `security`) once more post-migration
   — no new findings.
4. No live browser check unless the user asks for one, per `CLAUDE.md`'s default
   (this change isn't purely visual/theming, but the CV tab's new editable layout is
   substantial enough that a check may be worth explicitly offering when this plan is
   executed — flag it, don't assume).
5. Update `docs/progress.md` with a new row for this initiative (spec 15 / plan 17),
   status reflecting what actually shipped.
