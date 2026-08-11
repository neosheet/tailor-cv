# 13 — Applications: search/filter, sub-navigation, archive

Spec: `docs/specs/11-applications-search-nav-archive.md`
Source request: `docs/user-request/application.md`

## Phase 0 — Documentation discovery (consolidated)

Existing patterns to copy from, with exact locations:

- **Search box**: `SearchInput` — `src/components/search-input.tsx`. Props
  `value`, `onChange`, `label`, optional `className`. Renders
  `InputGroup`/`InputGroupInput` with a leading `SearchIcon` and a
  conditional clear button.
- **Tag filter**: `TagFilter` — `src/components/inventory/tag-filter.tsx`.
  Props `value: string[]`, `onChange`, `available: string[]`. Generic, no
  Inventory coupling — import directly, no copy needed.
- **Persisted filter state**: `useSessionState<T>(key, initial)` —
  `src/hooks/use-session-state.ts`. `sessionStorage`-backed, namespaced
  `tailor-cv:`.
- **Reference wiring of both together**: `PoolPanel` —
  `src/components/inventory/pool-panel.tsx` lines 166-212, 250-262. Key
  points to copy:
  - `useSessionState(`pool:${kind}:search`, "")` / `...:tags`, [])`
    pattern → use `applications:list:search` / `applications:archive:search`
    etc. (separate keys per tab so List and Archive filters don't collide).
  - `searchableText(item)` (lines 42-61) → write an applications equivalent
    covering `title` + stripped `vacancyDetail`.
  - `availableTags` memo (lines 209-212): `[...new Set(visible.flatMap(row
    => row.tags))].sort()`, computed from post-filter rows.
  - `emptyMessage(query, tags)` (lines 67-83) → adapt copy for
    applications.
  - Toolbar JSX shape (lines 250-262): `flex flex-1 flex-wrap items-center
    gap-2` wrapping `SearchInput` then `TagFilter`.
- **HTML stripping**: `isEmptyHtml` in `src/lib/quill-html.ts` uses
  `html.replace(/<[^>]*>/g, "")`. Reuse the same regex approach for a new
  `stripHtml(html)` export in that file (don't duplicate the regex inline).
- **Current list panel** (to be modified in place):
  `src/components/applications/application-list-panel.tsx` — full file
  already read; status filter (lines 57-59, 75-78, 83-100), table (lines
  108-186), row actions dropdown (lines 152-181), create/edit dialogs
  (188-223), delete wiring (231-239).
- **Tabs sub-nav precedent**: `src/pages/cv.tsx` — `Tabs defaultValue="list"`
  / `TabsList variant="line"` / `TabsTrigger` / `TabsContent`, each tab a
  self-contained panel component. Copy this shape into
  `src/pages/applications.tsx`.
- **Delete confirm dialog to repurpose**:
  `src/components/applications/delete-application-dialog.tsx` — `AlertDialog`
  shape to copy for an `ArchiveApplicationDialog`.
- **Data layer**: `src/lib/application.ts` — `allApplications`,
  `findApplication`, `createApplication`, `updateApplication`,
  `deleteApplication` (kept, unused by UI after this change),
  `ApplicationFormFields`. `src/lib/application-store.tsx` —
  `mapApplicationRow` (lines 41-65), `ApplicationData`/`ApplicationStore`
  shape.
- **Type to extend**: `DbApplication` — `src/mocks/types.ts` lines 306-326.
- **Status labels/order**: `GLOBAL_APPLICATION_STATUSES`,
  `GLOBAL_STATUS_LABEL` — `src/lib/application-status.ts`.
- **Migration precedent**: latest migration
  `supabase/migrations/20260811020000_add_application_stage_timeline.sql`
  for naming convention (`YYYYMMDDHHMMSS_description.sql`) and the
  `alter table applications add column ...` shape used by earlier
  additive migrations (e.g. `20260811010000_add_application_cover_letter.sql`).
- **Generated types**: `src/lib/database.types.ts` — `applications.Row`
  block (lines ~80-103) must gain `archived_at: string | null` after the
  migration; regenerate rather than hand-edit if a codegen command exists,
  otherwise hand-add matching the existing style (confirm with the
  `supabase` skill before hand-editing).
- **Card primitive for Kanban**: `src/components/ui/card.tsx`
  (`Card`/`CardHeader`/`CardTitle`), `src/components/ui/item.tsx` — plain
  building blocks, no kanban/dnd library in the app (confirmed via
  `package.json` — none present) and none needed since Kanban is view-only.
- **Detail sheet reuse**: `ApplicationDetailSheet` — props `application`,
  `onClose`, `onEdit` (used at `application-list-panel.tsx` lines 225-229)
  — reuse as-is from Kanban.

Anti-patterns to avoid: don't add a `dnd-kit`/drag-drop dependency (spec
says view-only); don't touch `global_application_status` enum (archive is
orthogonal); don't build a URL-routed sub-nav (no precedent, spec says
follow the plain-`Tabs` pattern instead).

## Phase 1 — Migration: add `archived_at`

Add `supabase/migrations/<timestamp>_add_application_archived_at.sql`:

```sql
alter table applications add column archived_at timestamptz;
create index on applications (user_id, archived_at);
```

Apply it (via the `supabase` skill's guidance — local CLI or MCP
`apply_migration` per `CLAUDE.md`/MCP instructions), then regenerate
`src/lib/database.types.ts` so `applications.Row`/`Insert`/`Update` gain
`archived_at`.

**Verify**: `applications.Row.archived_at` appears in
`database.types.ts`; `npm run typecheck` still passes at this point (no
other code references it yet).

## Phase 2 — Data layer: archive/restore

In `src/mocks/types.ts`, add `archivedAt: string | null` to `DbApplication`
(after `tags`, matching the column order convention already used).

In `src/lib/application-store.tsx`, add `archivedAt: row.archived_at` to
`mapApplicationRow`.

In `src/lib/application.ts`, add two mutators next to `deleteApplication`,
same shape (direct `supabase.from("applications").update(...)`, then patch
`store.setApplications`):

```ts
export async function archiveApplication(store: ApplicationStore, applicationId: string): Promise<DbApplication> {
  const { data, error } = await supabase
    .from("applications")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", applicationId)
    .select()
    .single()
  if (error) throw error
  const updated = mapApplicationRow(data)
  store.setApplications((current) => current.map((a) => (a.id === applicationId ? updated : a)))
  return updated
}

export async function restoreApplication(store: ApplicationStore, applicationId: string): Promise<DbApplication> {
  const { data, error } = await supabase
    .from("applications")
    .update({ archived_at: null })
    .eq("id", applicationId)
    .select()
    .single()
  if (error) throw error
  const updated = mapApplicationRow(data)
  store.setApplications((current) => current.map((a) => (a.id === applicationId ? updated : a)))
  return updated
}
```

Leave `deleteApplication` in place, unused by UI (per spec: plausible
future use, not part of this request).

Add `stripHtml(html: string): string` to `src/lib/quill-html.ts`:
```ts
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ")
}
```
(Use a space, not empty string, so words on either side of a stripped tag
like `<p>` don't get glued together in search matching.)

**Verify**: `npm run typecheck` passes; no UI wired yet.

## Phase 3 — Search + tag + status filter in the list/archive table

Rework `src/components/applications/application-list-panel.tsx` to accept
an `archived?: boolean` prop (default `false`) so the same component
serves both the "Applications list" and "Archive" tabs:

- Filter base rows by `application.archivedAt === null` (list) vs `!==
  null` (archive), *before* applying status/search/tag filters.
- Add `query`/`tagFilter` via `useSessionState`, keyed
  `` `applications:${archived ? "archive" : "list"}:search` `` /
  `...:tags`, mirroring `pool-panel.tsx` lines 166-171.
- Add `applicationSearchableText(application)` (new helper, colocated in
  this file or `application.ts` — prefer `application.ts` alongside the
  other pure selectors): `[title, stripHtml(vacancyDetail ?? "")].join("
  ").toLowerCase()`.
- Add `availableTags` memo from post-filter rows, same as
  `pool-panel.tsx` lines 209-212.
- Toolbar: keep the existing status `Select`, add `SearchInput` (`label=
  "applications"`) and `TagFilter` to its left, matching
  `pool-panel.tsx`'s `flex flex-1 flex-wrap items-center gap-2` grouping.
  Hide the "New Application" button when `archived` is true (archive is a
  read/restore view, not a place to create from).
- Empty state: reuse/adapt `emptyMessage(query, tags)` from
  `pool-panel.tsx`, plus an archive-specific base message ("No archived
  applications." vs "No applications yet.").

**Verify**: on `/applications`, typing a title keyword filters the table;
adding a tag filter narrows it further; status filter still works
alongside them; `npm run typecheck` and `npm run lint` pass.

## Phase 4 — Row actions: Archive replaces Delete, Restore in Archive view

- Add `src/components/applications/archive-application-dialog.tsx`,
  copied from `delete-application-dialog.tsx`'s shape: title "Archive this
  application?", description "It will be hidden from the applications list
  until restored from Archive.", confirm button label "Archive" (not
  destructive-styled red, since it's reversible — use `variant="default"`
  or `"secondary"` on `AlertDialogAction` instead of `"destructive"`).
- In `application-list-panel.tsx`'s row actions dropdown (current lines
  152-181):
  - When `archived` is false: replace the `Delete` `DropdownMenuItem`
    (`Trash2Icon`, `variant="destructive"`) with an `Archive` item
    (`ArchiveIcon` from `lucide-react`, no destructive variant) calling
    `setArchiveTarget(application)`, wired to the new
    `ArchiveApplicationDialog` calling `archiveApplication(store,
    id)`.
  - When `archived` is true: replace it with a `Restore` item
    (`ArchiveRestoreIcon`) that calls `restoreApplication(store, id)`
    directly on click — no confirmation dialog (non-destructive, per
    spec).
  - `Edit` stays in both cases.
- Remove the now-unused `DeleteApplicationDialog` import/usage from
  `application-list-panel.tsx` (leave the component file itself — mirrors
  the "keep `deleteApplication` unused" decision in Phase 2, it's a small
  presentational component that costs nothing to keep for a possible
  future hard-delete action, but must not be wired to any control now that
  the request removed it from the UI).

**Verify**: clicking Archive on a list row moves it out of the list;
clicking Restore on an archived row moves it back; `npm run typecheck`
and `npm run lint` pass.

## Phase 5 — Kanban view

New `src/components/applications/application-kanban-panel.tsx`:

- Reads `useApplicationStore()`, filters `archivedAt === null`.
- Groups by `GLOBAL_APPLICATION_STATUSES` order into columns (`flex gap-4
  overflow-x-auto`, each column a `flex flex-col gap-2` with a header
  showing `GLOBAL_STATUS_LABEL[status]` and the column's count).
- Each application renders as a `Card`
  (`Card`/`CardHeader`/`CardTitle`/plain content div) showing Title,
  Company, Position, and updated date (same `new
  Date(application.updatedAt).toLocaleString()` formatting as the list
  table) — the whole card is a clickable button (`onClick` → local
  `selectedId` state) opening `ApplicationDetailSheet` with `onEdit`
  wired to a local `editTarget` + `ApplicationFormDialog`, mirroring
  `application-list-panel.tsx`'s own selection/edit wiring so Kanban is
  fully self-contained like `CvListPanel`/`TemplatesPanel` are on the CV
  page.
- No search/tag/status filter UI on this tab — status is already the
  grouping axis, and the spec explicitly scopes Kanban to view-only.

**Verify**: Kanban shows one column per status with the right
applications in each; clicking a card opens the same detail sheet as the
list; `npm run typecheck` and `npm run lint` pass.

## Phase 6 — Sub-navigation

Rewrite `src/pages/applications.tsx` following `src/pages/cv.tsx`'s exact
shape:

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/layout/page-header"
import { ApplicationListPanel } from "@/components/applications/application-list-panel"
import { ApplicationKanbanPanel } from "@/components/applications/application-kanban-panel"
import { sections } from "@/lib/navigation"

export function ApplicationsPage() {
  const page = sections.applications

  return (
    <>
      <PageHeader title={page.title} description={page.description} />

      <Tabs defaultValue="list" className="gap-4">
        <TabsList variant="line">
          <TabsTrigger value="list">Applications List</TabsTrigger>
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
          <TabsTrigger value="archive">Archive</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <ApplicationListPanel />
        </TabsContent>
        <TabsContent value="kanban">
          <ApplicationKanbanPanel />
        </TabsContent>
        <TabsContent value="archive">
          <ApplicationListPanel archived />
        </TabsContent>
      </Tabs>
    </>
  )
}
```

No `App.tsx` route changes — `/applications` stays a single route per the
spec.

**Verify**: `/applications` shows three tabs; each renders the right
panel; no console errors; `npm run typecheck` and `npm run lint` pass.

## Phase 7 — Final verification

1. `npm run typecheck` and `npm run lint` — both clean.
2. Manual pass through the running app (skip visual/screenshot check per
   the source request's explicit "skip visual check"):
   - Create an application, confirm it appears in List and the correct
     Kanban column.
   - Search by a title keyword, by a tag, by status — confirm each
     narrows the table and that the empty-state message matches which
     filter(s) are active.
   - Archive it from List → confirm it disappears from List and Kanban,
     appears in Archive.
   - Restore it from Archive → confirm it reappears in List/Kanban.
3. Update `docs/progress.md` to record this plan's completion, per
   `CLAUDE.md`'s workflow ("keep progress.md in sync with reality").
4. Per `docs/user-request/application.md`'s own trailing instruction, once
   done: replace the first line of that file with the single word `DONE`.
