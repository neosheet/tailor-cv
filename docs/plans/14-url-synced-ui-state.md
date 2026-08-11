# Plan 14: URL-synced dialog, drawer, and tab state

Spec: `docs/specs/12-url-synced-ui-state.md`

## Phase 0: Documentation discovery (consolidated findings)

**Router**: `react-router` `^8.3.0` is already installed and wired in
`src/App.tsx` (`BrowserRouter`, `Routes`, routes for `/applications`,
`/applications/:id`, `/personas`, `/personas/:id`, `/cvs`,
`/cvs/:cvId/print`, `/settings`, `/inventory/*`).

**Allowed API** (confirmed against `node_modules/react-router/dist/development/index.d.ts`):
- `useSearchParams()` from `"react-router"` (same package as `BrowserRouter`
  etc. — no separate `react-router-dom` import; v7+ merged the packages).
  Signature: `const [searchParams, setSearchParams] = useSearchParams()`.
  - `searchParams` is a `URLSearchParams` — read with `.get(name)`.
  - `setSearchParams(nextInit, navigateOpts?)` — accepts a plain object, a
    `URLSearchParams`, or an updater function `(prev) => next`; pushes a new
    history entry by default, pass `{ replace: true }` to avoid that (used
    for filling in a default so first paint doesn't add a junk back-stack
    entry).
- No existing query-param convention in the codebase (`grep -rn
  "useSearchParams\|URLSearchParams" src` returns nothing before this plan).
  The only related precedent is `useSessionState` (`src/hooks/use-session-state.ts`)
  — a `sessionStorage`-backed `useState` wrapper, NOT URL-based. New hooks in
  Phase 1 follow its file location and JSDoc-comment style but are
  URL-backed instead.

**Anti-patterns to avoid**:
- Do not import from `react-router-dom` — it isn't a dependency; everything
  comes from `react-router`.
- Do not use `URLSearchParams` mutation methods (`.set`, `.delete`) directly
  on the `searchParams` object returned by the hook and expect it to
  re-render — always go through `setSearchParams`.
- Do not leave stale params in the URL when a dialog closes — always remove
  the key (via the updater-function form of `setSearchParams`), don't just
  set it to an empty string.

**Full inventory of components in scope** (file paths, current state shape,
and the target param scheme) — from the codebase survey, organized by the
phases below. Every dialog/tab currently uses a local `React.useState` (or,
for `Tabs`, an uncontrolled `defaultValue` with no explicit state at all).

## Phase 1: Shared hooks + Applications page tabs (reference implementation)

**What to implement**

1. `src/hooks/use-tab-search-param.ts` — new hook:
   ```ts
   export function useTabSearchParam(param: string, defaultValue: string): [string, (value: string) => void]
   ```
   - Reads `searchParams.get(param) ?? defaultValue`.
   - Setter calls `setSearchParams((prev) => { const next = new URLSearchParams(prev); next.set(param, value); return next }, { replace: value === /* current default-fill case */ false })` —
     concretely: normal tab switches push a history entry (so Back steps
     through tab history), but the *initial* fill-in (URL has no `tab` param
     yet, component mounts and needs to display `defaultValue`) must use
     `{ replace: true }` in a `useEffect` so loading `/applications` doesn't
     immediately create a spurious back-stack entry. Model this the same way
     React Router's own docs example handles "sync state to URL, default
     when absent" — set the default via `replace` on mount if the param is
     missing, do a normal (push) set on user-driven changes.
   - Return shape matches what shadcn `Tabs` needs directly: `value` and
     `onValueChange={setValue}`.

2. `src/hooks/use-dialog-search-params.ts` — new hook for the `?dialog=` +
   id-style params used everywhere else:
   ```ts
   export function useDialogSearchParams(): {
     dialog: string | null
     get: (param: string) => string | null
     open: (dialog: string, extra?: Record<string, string>) => void
     close: () => void
   }
   ```
   - `dialog` reads `searchParams.get("dialog")`.
   - `get(param)` reads any other param (e.g. `id`, `stageId`, `kind`).
   - `open(dialog, extra)` replaces the full param set with `{ dialog,
     ...extra }` (pushes a history entry — Back closes the dialog).
   - `close()` removes `dialog` and every other key this hook manages,
     leaving unrelated params (like `tab`) untouched — use the
     updater-function form of `setSearchParams` and delete only known keys,
     or simplest: delete `dialog` plus whatever extra keys the caller
     tracked. Keep the implementation simple: callers pass the exact key
     list to `close(keys: string[])` if needed, or each call site just
     re-derives its own dialog+id pair and calls a shared `closeDialog(searchParams, setSearchParams)`
     utility. Decide the exact shape while implementing — the contract that
     must hold is: closing always fully removes the dialog's params, never
     leaves `dialog=` orphaned.

3. Apply `useTabSearchParam` to `src/pages/applications.tsx`: replace
   `<Tabs defaultValue="list">` (uncontrolled) with `<Tabs value={tab}
   onValueChange={setTab}>` where `const [tab, setTab] =
   useTabSearchParam("tab", "list")`. Values stay `list | kanban | archive`.

**Verification**
- `npm run typecheck && npm run lint`.
- Manual: load `/applications`, confirm URL gains `?tab=list` via replace
  (no extra Back entry from initial load — Back from `/applications` should
  leave the app, not bounce between `tab=` states). Click Kanban → URL
  becomes `?tab=kanban`, Back → returns to `?tab=list` and the List view
  renders. Reload on `?tab=archive` → Archive tab is active on load.

## Phase 2: Applications detail Sheet + nested detail tabs

**What to implement**
- `src/components/applications/application-list-panel.tsx` and
  `application-kanban-panel.tsx`: replace local `selectedId: string | null`
  with `searchParams.get("applicationId")` / setter via `setSearchParams`
  (push on open from a row/card click, and removing the key on close —
  `Sheet`'s `onOpenChange={(next) => !next && onClose()}` already exists,
  wire `onClose` to strip the param). This becomes `/applications?applicationId=<id>`
  (coexisting with `?tab=`).
- `src/components/applications/application-detail-view.tsx`: its internal
  `Tabs defaultValue="job-detail"` (`job-detail | cv-preview | timeline`)
  becomes controlled via `useTabSearchParam`, but **use a distinct param
  name `detailTab`**, not `tab` — on `/applications` the page-level Tabs
  already owns `tab` for List/Kanban/Archive, and the Sheet layers on top of
  that same route, so reusing `tab` would collide. On `/applications/:id`
  (Phase 3's full page, no page-level tabs) `detailTab` still works and stays
  consistent between the two render sites (`variant="sheet"` and
  `variant="page"`).

**Verification**
- `npm run typecheck && npm run lint`.
- Manual: on `/applications`, click a row → URL gains `applicationId=` and
  the sheet opens; click the Timeline sub-tab → URL also gains
  `detailTab=timeline`; reload → sheet still open on Timeline; Back → sheet
  closes (or steps back through `detailTab` changes first, matching normal
  push-history behavior) without touching `tab=`.

## Phase 3: Applications remaining dialogs (form, archive, delete, stages)

**What to implement**, all via `useDialogSearchParams` from Phase 1:
- `ApplicationFormDialog` create → `?dialog=new` (list panel, kanban panel,
  and independently on `src/pages/application-detail.tsx`, which edits itself
  in place: `?dialog=edit`, no id needed since `:id` is already the route).
- `ApplicationFormDialog` edit from list/kanban → `?dialog=edit&id=<applicationId>`.
- `ArchiveApplicationDialog` → `?dialog=archive&id=<applicationId>`.
- `DeleteApplicationDialog` (`src/components/applications/delete-application-dialog.tsx`)
  — confirm during this phase whether it's actually rendered anywhere
  (Phase-0 survey flagged it as present but not clearly wired up); if unused,
  leave it unconverted and note that in `docs/progress.md` rather than wiring
  dead code.
- `NewStageTemplateDialog` → `?dialog=new-stage-template`.
- `StageFormDialog` (`src/components/applications/stage-form-dialog.tsx`,
  discriminated `mode: "edit" | "add"`) used from `stage-card.tsx`:
  - edit stage → `?dialog=edit-stage&stageId=<id>`
  - add sub-stage → `?dialog=add-substage&stageId=<parentStageId>`
  - edit sub-stage (in nested `SubStageRow`) → `?dialog=edit-substage&stageId=<subStageId>`
- Stage/sub-stage delete `AlertDialog` (`deleting` state in `stage-card.tsx`)
  → `?dialog=delete-stage&stageId=<id>`.
- `application-detail-view.tsx`'s "Freeze the attached CV?" confirmation
  (`pendingStatus: GlobalApplicationStatus | null`) → `?dialog=freeze-cv&status=<value>`.

All of these live under `/applications` (list/kanban) or `/applications/:id`
(full page + its own stage timeline) — no id collision since `dialog` is a
single param reused sequentially (only one dialog open at a time per route).

**Verification**
- `npm run typecheck && npm run lint`.
- Manual: open the New Application dialog, edit an existing one, archive one,
  add/edit a stage and a sub-stage on `/applications/:id`'s Timeline tab —
  confirm each produces the expected `?dialog=...` URL and Back closes it.

## Phase 4: Personas (page + detail)

**What to implement**
- `src/pages/personas.tsx`: convert `creating`, `formDialog: {mode, persona} | null`,
  `deleteTarget`, `createCvFor` to `useDialogSearchParams`:
  - create → `?dialog=new`
  - edit/duplicate → `?dialog=edit&id=<id>` / `?dialog=duplicate&id=<id>`
  - delete → `?dialog=delete&id=<id>`
  - create-CV-from-persona → `?dialog=new-cv&personaId=<id>`
- `src/pages/persona-detail.tsx` (route already has `:id`, so no id param
  needed for dialogs targeting the page's own persona):
  - `openKind: ItemKind | null` (`PoolPickerDialog`) → `?dialog=pool-picker&kind=<ItemKind>`
  - `formDialogMode: "edit" | "duplicate" | null` → `?dialog=edit` / `?dialog=duplicate`
  - `deleting: boolean` → `?dialog=delete`

**Verification**
- `npm run typecheck && npm run lint`.
- Manual: on `/personas`, open New/Edit/Duplicate/Delete and create-CV
  dialogs, confirm URL params; on a persona's detail page, open the pool
  picker for a couple of `ItemKind`s and the edit/delete dialogs.

## Phase 5: CV page

**What to implement**
- `src/pages/cv.tsx`: `Tabs defaultValue="list"` (`list | templates`) →
  `useTabSearchParam("tab", "list")`.
- `src/components/cv/cv-list-panel.tsx`: `formDialog: {mode, cv} | null`,
  `deleteTarget` → `?dialog=edit&id=` / `?dialog=duplicate&id=` /
  `?dialog=delete&id=`; the separate "New CV" trigger → `?dialog=new`.
  (`importError` stays local state — it's a transient alert, not
  open/close UI state, out of scope per the spec.)
- `src/components/cv/templates-panel.tsx`: `viewing: CvTemplate | null`
  (`TemplateViewDialog`) → `?dialog=view-template&id=<templateId>`.

**Verification**
- `npm run typecheck && npm run lint`.
- Manual: switch List/Templates tabs and reload on each; open new/edit/
  duplicate/delete CV dialogs and a template view dialog, confirm URL state
  and Back behavior.

## Phase 6: Settings page

**What to implement**
- `src/pages/settings.tsx`: `Tabs defaultValue="tags"`
  (`tags | skill-categories | stage-templates | general`) →
  `useTabSearchParam("tab", "tags")`.
- `src/components/settings/skill-categories-panel.tsx`: `renaming` /
  `deleting: SkillCategoryUsage | null` → `?dialog=rename-skill-category&id=`
  / `?dialog=delete-skill-category&id=`. Confirm during implementation what
  uniquely identifies a `SkillCategoryUsage` (id vs. name) by reading its
  type definition — use that field as the id.
- `src/components/settings/tags-panel.tsx`: `renaming: TagUsage | null` →
  `?dialog=rename-tag&id=`; `deleting: TagUsage[] | null` (bulk) →
  `?dialog=delete-tag&ids=<comma-separated>`.
- `src/components/settings/stage-templates-panel.tsx`: `renaming` /
  `deleting: DbStageTemplate | null` → `?dialog=rename-stage-template&id=`
  / `?dialog=delete-stage-template&id=`.

**Verification**
- `npm run typecheck && npm run lint`.
- Manual: switch all 4 settings tabs and reload on each; open rename/delete
  dialogs for a tag, a skill category, and a stage template.

## Phase 7: Inventory

**What to implement**
- `src/pages/inventory/basics.tsx`: `Tabs defaultValue="name"` (values from
  the page's own `POOLS` array — read it to confirm the exact value list)
  → `useTabSearchParam("tab", "name")`.
- `src/components/inventory/pool-panel.tsx` (shared by every inventory pool
  page, `basics` included): `dialog: {mode: "add"|"edit", item?} | null`
  (`ItemDialog`) → `?dialog=new` / `?dialog=edit&id=<itemId>`; `deleteTarget`
  → `?dialog=delete&id=<itemId>`; `addToPersonaOpen` (`AddToPersonaDialog`)
  → `?dialog=add-to-persona&id=<itemId>`.
- `src/components/inventory/item-detail-dialog.tsx`: confirm which panel(s)
  render it and convert its trigger the same way — `?dialog=view&id=<itemId>`.

Note: `src/components/inventory/item-dialog.tsx`'s *internal* `Tabs`
(`details` vs. dynamic line-kind tabs) stays out of scope per the spec —
it's nested inside a dialog that only exists while `?dialog=new|edit` is
already set, and isn't independently linkable in a way that matters yet.

**Verification**
- `npm run typecheck && npm run lint`.
- Manual: on `/inventory/basics`, switch tabs and reload on one; open
  add/edit/delete/add-to-persona dialogs for an item on any one pool page
  (pattern is shared across all inventory pages via `pool-panel.tsx`, so one
  page is representative — spot check one other pool page, e.g.
  `/inventory/skills`, to confirm the shared component picked up the change).

## Phase 8: CV print page tabs

**What to implement**
- `src/components/cv/persona-field-tree.tsx` (rendered from
  `src/pages/cv-print.tsx`, route `/cvs/:cvId/print`, and reused by
  `src/pages/application-cv-print.tsx` at `/applications/:id/cv`):
  `Tabs defaultValue={isFrozen ? "style" : "visibility"}` → `useTabSearchParam`.
  Values are `visibility` or `data` (mutually substituted based on
  `isFrozen` — keep that substitution logic, just source the controlled
  value from the hook instead of Radix's internal state) plus `style`,
  `page`, `blocks`. Default value passed to the hook must also depend on
  `isFrozen`, matching current behavior.

**Verification**
- `npm run typecheck && npm run lint`.
- Manual: open a CV print page, switch tabs, reload on `?tab=blocks`;
  repeat once for a frozen CV (via an application's attached CV) to confirm
  the `style`-default-when-frozen behavior still holds.

## Phase 9: Final verification + docs

**What to implement**
- Full-repo `npm run typecheck && npm run lint`.
- `grep -rn "React.useState" src/pages src/components/applications
  src/components/cv src/components/settings src/components/inventory
  src/components/persona` and confirm every remaining `useState` is for
  something intentionally out of scope (form field contents, transient
  alerts like `importError`, non-UI-state) — not a missed dialog/tab.
- One desktop screenshot of `/applications` (per CLAUDE.md's UI verification
  convention) plus a console-error check.
- Update `docs/progress.md` with a new row for this initiative, and note in
  `docs/specs/12-url-synced-ui-state.md` if `DeleteApplicationDialog` (Phase 3)
  or any other component turned out to be dead code and was left unconverted.
