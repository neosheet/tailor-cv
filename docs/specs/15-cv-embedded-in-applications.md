# 15 — CV embedded in Applications

Builds on [spec 06](06-persona-cv-split.md) (Persona/CV split), [spec 10](10-applications-tracking.md)
(Applications tracking, the freeze), [spec 09](09-cv-export-import.md) (CV snapshot/export format),
and [spec 13](13-save-as-new-template.md) (save-as-new-template). Supersedes the parts of those specs
that describe a standalone `cvs` table/page.

## Why

Today a CV is a separately saved (Persona, Template) pairing in the `cvs` table, managed on its own
`/cvs` page (CV List + Templates tabs), and an Application merely references one via `cv_id`,
freezing a copy into `applications.cv_snapshot` on first leaving `draft` (spec 10). In practice this
indirection buys nothing: a CV is really per-application state (spec 01's "Sent CVs" idea), and the
live data confirms it — CVs aren't meaningfully shared or reused across applications. This spec
collapses the standalone `cvs` table and page into the application itself: each application directly
owns which Persona + Template it uses and its own field-visibility/style/page/node overrides, edited
inline in the application detail view (a CV tab), the same way Settings panels edit in place — no
separate list, no separate "Edit CV" dialog to navigate to. The freeze mechanism (spec 10) keeps its
exact behavior, just re-sourced from the application's own fields instead of a referenced `cvs` row.

## Scope

- Remove the `/cvs` page and its routes (`cvs`, `cvs/:cvId/print`), `CvListPanel`, `CvFormDialog`,
  `DeleteCvDialog`, `CvPrintPage`, and the `cvs` nav entry.
- Remove the `cvs` table and `applications.cv_id`.
- Add CV-ownership fields directly to `applications`: `cv_persona_id`, `cv_template_id`,
  `cv_persona_settings` (jsonb, shape of today's `CvPersonaSettings`), `cv_template_settings` (jsonb,
  shape of today's `TemplateSettings`). `applications.cv_snapshot` is untouched — it already lives on
  `applications` and freezing behavior doesn't change.
- The application detail view's **"CV Preview" tab becomes a "CV" tab**: an editable pane mirroring
  today's `/cvs/:id/print` layout (`PersonaFieldTree` sidebar + `ResumeRender` preview), replacing the
  current read-only preview + "Open print view" link. Editing writes straight to the application's new
  fields — no dialog, no separate page. `/applications/:id/cv` (the dedicated print/export route)
  stays as today, resolving from those fields while live and from `cv_snapshot` once frozen.
- **Keep** the template system as-is: `cv_templates` table, built-in templates, "Save as new template".
  **Drop** the standalone Templates gallery page — template picking/saving happens inline from the new
  CV tab (a picker, not a browsable page). A future dedicated template-browsing surface (e.g. under
  Settings) is not part of this change.
- **Lazy setup**: a new application's CV tab starts empty (`cv_persona_id`/`cv_template_id` unset).
  Opening it prompts to pick a Persona + Template; once picked, it behaves like the always-attached
  case. The New/Edit Application dialog is untouched — no CV picker is added there.
- **Drop** entirely: CV Export, Import-from-file, Duplicate-CV, Favorite. These only made sense against
  a standalone CV list and have no equivalent once a CV is just application state.
- **Rework Import**: becomes "copy CV settings from another application" — pick a source application
  (must have a live, non-frozen CV of its own), which copies `cv_persona_id`, `cv_template_id`,
  `cv_persona_settings`, `cv_template_settings` onto the target application. Only settings/config are
  copied, never baked-in content — the resume keeps resolving live off whichever persona ends up set,
  exactly like today's live (non-frozen) `resolveCv` behavior.
- The freeze (spec 10) is unchanged in *behavior*: on the first transition away from `draft`,
  `buildCvSnapshot` runs off the application's own live `cv_persona_id`/`cv_template_id`/settings
  instead of a referenced `cvs` row, still written exactly once to `cv_snapshot`. The gate condition
  changes from "requires `cv_id`" to "requires `cv_persona_id` and `cv_template_id`". **Freezing never
  clears `cv_persona_id`/`cv_template_id`/`cv_persona_settings`/`cv_template_settings`** — same
  non-clearing pattern `cv_id` already follows today ("it stays as a link back to... which saved CV
  this came from"). This is what keeps the "Used in" tracking below working after an application
  freezes: the config columns remain a permanent record of which persona/template/settings produced
  that snapshot, even though the CV tab itself switches to a read-only `cv_snapshot` display once
  frozen.
- Persona detail's **"Used in CVs" card becomes "Used in Applications"**: `usedByCvs` (currently
  `allCvs(personaStore).filter(cv => cv.personaId === persona.id)`, linking to `/cvs/:id/print`)
  becomes a filter over `applications` on `cvPersonaId === persona.id`, linking to
  `/applications/:id`. Because freezing never clears `cv_persona_id` (previous bullet), this list
  correctly keeps including an application even after it's frozen — a persona that produced a
  now-frozen CV still shows as "used". `DeletePersonaDialog`'s `cvCount` prop/copy ("and the N CVs
  built from it") becomes an application count with matching copy.

## Data model changes

```sql
alter table applications
  add column cv_persona_id uuid references personas(id) on delete set null,
  add column cv_template_id text,
  add column cv_persona_settings jsonb not null default '{}',
  add column cv_template_settings jsonb not null default '{}';

alter table applications drop column cv_id;

drop table cvs;
```

`cv_template_id` mirrors `cvs.template_id`'s existing type/nullability — it can point at either a
built-in template id or a saved `cv_templates` row, exactly as `cvs.template_id` does today.

**No data-preserving migration is needed.** As of this spec, all 3 existing applications already have
`cv_snapshot` set (frozen); none are `draft` with a live dependency on `cv_id`/`cvs`. `cv_id` and
`cvs` can be dropped outright in the same migration that adds the new columns.

## Data layer changes

- `lib/cv.ts`'s selectors/mutators that target `cvs` — `resolveCv`, `setKindHidden`, `setFieldHidden`,
  `setItemHidden`, `setCvStyleProperty`/`resetCvStyleProperty`, `setCvPageProperty`/
  `resetCvPageProperty`, `setCvNodeOverride`/`resetCvNodeOverride` — move to `lib/application.ts`,
  retargeted at `applications`'s new columns and keyed by `applicationId` instead of `cvId`.
  `createCv`/`updateCv`/`duplicateCv`/`importCvSnapshot`/`deleteCv`/`toggleCvFavorite` are deleted
  outright (superseded by inline application editing, or dropped per Scope above). `lib/cv.ts` itself
  is deleted once only `saveAsNewTemplate` (template-system, kept) remains — that one function moves
  to wherever the template system's other helpers live (`lib/cv-templates.ts` or a home there).
- `resolveApplicationCv` (`lib/application.ts`): its "live" branch builds the document from
  `application.cvPersonaId`/`cvTemplateId`/`cvPersonaSettings` directly (`buildResumeDocument`)
  instead of calling `resolveCv(persona, inventory, application.cvId)`.
- `setGlobalApplicationStatus`'s freeze step resolves the same way before calling `buildCvSnapshot`.
- New mutator: `copyApplicationCvSettings(store, sourceApplicationId, targetApplicationId)` — the
  reworked Import. Only allowed when the source has a live (non-frozen) CV.
- `PersonaStoreProvider` drops `cvs` fetch/state entirely. `mapCvRow` is deleted.

## UI changes

- `application-detail-view.tsx`: "CV Preview" tab → "CV" tab. When `cv_persona_id` is unset, shows a
  Persona + Template picker (reusing the old `CvFormDialog`'s option-list patterns) instead of the
  current "No CV attached" empty state. Once set, renders `PersonaFieldTree` + `ResumeRender` side by
  side, retargeted at the application (mirrors `cv-print.tsx`'s `CvResolved`, minus its own header/
  print actions which stay on the dedicated `/applications/:id/cv` route). An "Import CV settings"
  action (the reworked Import) opens a picker over other live (non-frozen) applications.
- `PersonaFieldTree` (and the Style/Page/Block-settings surfaces reachable from it) is retargeted from
  its current `cv: DbCv` prop to whatever shape the new application-level mutators use — an
  `applicationId` plus the application's own `cvPersonaSettings`/`cvTemplateSettings`, no `DbCv`
  dependency left.
- `navigation.ts`: remove the `cvs` section entry.
- `docs/code-map.md`: updated in the same change for every file removed, moved, or repurposed above.

## Out of scope

- Any change to Persona itself, or to the Templates system's built-in template set.
- A dedicated UI for browsing/managing saved `cv_templates` beyond what's reachable inline from the CV
  tab — no gallery page in this pass.
- Any "unfreeze" or "re-edit after applying" affordance — a frozen application's CV tab stays a
  read-only display of `cv_snapshot`, same as today's post-freeze `resolveApplicationCv`, consistent
  with spec 10.
- Multiple CVs per application, or a resend/revision story — still explicitly deferred, per spec 10.
