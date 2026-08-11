# URL-synced dialog, drawer, and tab state

## What

Currently every open/close and active-tab state in the app (dialogs,
`AlertDialog`s, the one `Sheet` drawer, and top-level `Tabs`) lives in local
`React.useState`, uncontrolled `Tabs defaultValue`, or (for tabs) Radix's own
internal state. None of it is reflected in the URL. This means:

- Refreshing the page always resets to the default tab / no dialog open.
- Links can't be shared or bookmarked to a specific tab, or to "this dialog
  open for this record."
- Browser back/forward doesn't step through UI state (opening a dialog then
  hitting Back doesn't close it).

This spec covers moving that state into the URL (query params, since routes
like `/applications/:id` already own the path segment) using React Router's
`useSearchParams`, for every dialog, the drawer, and every top-level `Tabs`
surveyed across the app.

## Why

- Deep-linkable state: "here's the Kanban view of Applications," "here's this
  application's Timeline tab," "here's the edit dialog for CV X" all become
  shareable URLs.
- Predictable back/forward behavior — closing a dialog via Back matches user
  expectation once dialogs are common in the app.
- Refresh-safety: reloading mid-task (e.g. mid-edit-dialog) no longer silently
  discards where the user was, at least in terms of which panel/dialog was
  open (form contents are out of scope — see below).

## Scope (from codebase survey)

**Tabs** (currently uncontrolled `defaultValue`, becomes controlled `value` +
`onValueChange` backed by `?tab=`):
- `src/pages/applications.tsx` — `list | kanban | archive`
- `src/pages/cv.tsx` — `list | templates`
- `src/pages/settings.tsx` — `tags | skill-categories | stage-templates | general`
- `src/pages/inventory/basics.tsx` — dynamic per `POOLS` (e.g. `name | headline | summary | contact | location | social`)
- `src/components/applications/application-detail-view.tsx` — `job-detail | cv-preview | timeline` (rendered both inside the Sheet and the full `/applications/:id` page)
- `src/components/cv/persona-field-tree.tsx` (in `src/pages/cv-print.tsx`, route `/cvs/:cvId/print`) — `visibility|data | style | page | blocks`

**Drawer**
- `src/components/applications/application-detail-sheet.tsx` — the app's one
  content `Sheet`. Opened from a row/card click in
  `application-list-panel.tsx` and `application-kanban-panel.tsx`. Becomes
  `?applicationId=` on the `/applications` route (mirrors the existing full
  page at `/applications/:id`, which the sheet already links out to).

**Dialogs** (each keyed by the record id it targets, where applicable; pure
create/"new X" dialogs get a boolean-style param, e.g. `?new=application`):

- Applications: `ApplicationFormDialog` (create + edit, from list panel,
  kanban panel, and the full detail page independently),
  `ArchiveApplicationDialog`, `DeleteApplicationDialog`,
  `NewStageTemplateDialog`, `StageFormDialog` (edit stage / add sub-stage /
  edit sub-stage), stage delete `AlertDialog`, the "freeze CV?" confirmation
  `AlertDialog` in `application-detail-view.tsx`.
- Personas: `PersonaFormDialog` (create/edit/duplicate),
  `DeletePersonaDialog`, `CvFormDialog` (create-CV-from-persona),
  `PoolPickerDialog` (per inventory kind, from `persona-detail.tsx`).
- CV: `CvFormDialog` (create/edit/duplicate), `DeleteCvDialog`,
  `TemplateViewDialog`.
- Settings: rename/delete dialogs for skill categories, tags, and stage
  templates (`skill-category-dialogs.tsx`, `tag-dialogs.tsx`,
  `stage-template-dialogs.tsx`).
- Inventory: `ItemDialog` (add/edit, from `pool-panel.tsx`),
  `ItemDetailDialog`, `AddToPersonaDialog`, delete-item `AlertDialog`.

## Design

- Use React Router's `useSearchParams` directly (no new dependency — Router
  is already in place; no existing query-param convention exists yet, so
  this spec establishes it).
- **Query param naming**: one scheme applied consistently —
  - Tabs: `?tab=<value>` (scoped to the page's own URL, no collision since
    each page owns one `tab` param; `application-detail-view.tsx`'s nested
    tab uses the same `?tab=` since it's page-scoped per route).
  - Record-targeted dialogs/drawer: `?<entity>Id=<id>` (e.g.
    `?applicationId=`, `?editStageId=`) plus a discriminator where the same
    id could open more than one dialog (e.g. edit vs. delete) —
    `?dialog=edit&id=<id>` is preferred over one param per dialog type, to
    keep the param set from exploding. Exact param names finalized in the
    plan, but the pattern (`dialog` + `id`, `tab`) is fixed here.
  - Pure-create dialogs ("New Application", "New Persona", etc.): `?dialog=new`.
- Closing a dialog / navigating away removes its params from the URL rather
  than leaving stale `dialog=`/`id=` behind (use `setSearchParams` with the
  key deleted, not just hiding the dialog visually).
- Opening a dialog is an `history.pushState`-style navigation (back button
  closes it) *unless* it was itself opened by clicking Back to a state that
  had it open — standard `useSearchParams` behavior from React Router
  handles this by default (push on set, unless `{ replace: true }` is
  passed); replace is used for the *initial* sync (e.g. tab defaulting to
  `list` on first load) so it doesn't add a junk history entry.
- Two independent copies of the same dialog (e.g. `ApplicationFormDialog`
  wired separately in `application-list-panel.tsx`, `application-kanban-panel.tsx`,
  and `application-detail.tsx`) must resolve to **one** URL contract per
  route — i.e. list and kanban panels share the same `?dialog=edit&id=`
  reasoning since they're both rendered under `/applications`, while the
  detail page's own edit dialog uses the same params under `/applications/:id`.
- Multi-instance controlled state that isn't itself route-identifiable (e.g.
  which sub-stage's edit dialog is open, nested under a specific stage under
  a specific application) still goes in the URL, using compound params
  (e.g. `?dialog=editStage&stageId=`), not component-local state.

## Out of scope

- Form field contents (draft text typed into a dialog) are **not** persisted
  to the URL or on refresh — only whether the dialog is open and which
  record it targets.
- Nested nice-to-haves like scroll position or Kanban board scroll offset.
- Any change to the routes themselves (no new top-level pages) — this is
  additive query-param state on existing routes only.
- `src/components/inventory/item-dialog.tsx`'s internal `Tabs` (details vs.
  line-kind tabs) — nested inside an already non-URL-addressed dialog;
  becomes relevant once/if that dialog is URL-addressable, deferred to the
  plan's phase ordering rather than declared out of scope permanently.
