# 11 — Applications: search/filter, sub-navigation, archive

Source: `docs/user-request/application.md`

## What

The Applications page gets three additions:

1. **Search + filters** on the applications list, brought in line with the
   pattern already used on Inventory pool pages: keyword search (title +
   vacancy description) plus the existing global-status filter plus a new
   tag filter.
2. **Sub-navigation** with three views: **Applications list** (current
   table), **Kanban** (view-only board grouped by global status), and
   **Archive** (same table view, archived items only).
3. **Archive replaces delete** as the row action. Archiving hides an item
   from the list and Kanban views; it only shows up under Archive, where it
   can be restored.

## Why

The applications list has grown past a flat table — with real usage,
finding a specific application by keyword or tag matters, and a kanban
view gives an at-a-glance read of the pipeline. Hard-deleting an
application loses the CV snapshot and stage history for no reason; archive
is reversible and keeps the data.

## Search + filters

- Reuse `SearchInput` + `TagFilter` + `useSessionState`, exactly as
  `pool-panel.tsx` does it (client-side filtering, `sessionStorage`-backed
  so filters survive navigation but not across sessions).
- Search matches `title` and `vacancyDetail`. `vacancyDetail` is rich HTML
  (Quill) — strip tags before matching (a small `stripHtml` helper) so
  search matches visible text, not markup.
- Tag filter: same AND-of-selected-tags behavior as Inventory, `available`
  tags computed from the currently visible (post-search, post-status)
  rows.
- Status filter: keep the existing `Select` as-is.
- Toolbar layout matches `pool-panel.tsx`: search + tag filter grouped on
  the left, status filter alongside them, add button on the right.
- Filters apply within whichever view is active (list or archive); Kanban
  is view-only and does not carry the search/tag filters (status is
  already the grouping axis there).

## Sub-navigation

- Follow the existing in-page `Tabs` pattern used by `cv.tsx` and
  `settings.tsx` (`TabsList variant="line"`, plain `defaultValue` state,
  not routed/URL-synced — consistent with those two precedents).
- Three tabs on `applications.tsx`: **Applications list**, **Kanban**,
  **Archive**.
- No new routes; `/applications` stays a single route.

## Kanban view

- View-only, no drag-drop.
- Columns = `GLOBAL_APPLICATION_STATUSES` order (draft, applied,
  in_progress, offered, rejected, withdrawn).
- Card shows: Title, Company, Position, latest update (`updatedAt`,
  relative or short date — match the list view's date formatting).
- Click a card → opens the same `ApplicationDetailSheet` used by the list.
- Excludes archived applications.
- Built from `Card`/`Item` primitives (no kanban/dnd library exists in the
  app and none is needed for a view-only board).

## Archive

- New nullable `archived_at timestamptz` column on `applications` (soft
  delete via timestamp, not a boolean — captures *when*, matches Postgres
  best-practice for reversible soft-delete over a plain flag). No change
  to the `global_application_status` enum — archive is orthogonal to
  pipeline status.
- List and Kanban views: `WHERE archived_at IS NULL` (client-side filter
  on the already-fetched store data, same as today).
- Archive view: `WHERE archived_at IS NOT NULL`, otherwise identical table
  UI to the list view (same columns, same search/status/tag filters).
- Row actions:
  - **List/Kanban context**: `Edit` stays; `Delete` is replaced by
    `Archive` (sets `archived_at = now()`), confirmed via a repurposed
    version of the existing `DeleteApplicationDialog` copy ("Archive this
    application?").
  - **Archive context**: `Edit` stays; the destructive action becomes
    `Restore` (sets `archived_at = null`), no confirmation dialog needed
    since it's non-destructive.
- The existing hard-delete `deleteApplication` mutator is no longer wired
  to any UI action but is left in place (unused code is fine to keep here
  since it's a plausible future "empty archive" action, not a designed
  requirement of this spec — skip building that action now).

## Out of scope

- Drag-and-drop in Kanban.
- URL-synced/deep-linkable sub-nav tabs.
- A dedicated "permanently delete from archive" action.
- Enforcing application tags against the shared Inventory tag registry
  (already loose today, not part of this request).
