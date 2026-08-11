import * as React from "react"
import {
  FilePlus2Icon,
  FolderInputIcon,
  PlusIcon,
  TagsIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { SearchInput } from "@/components/search-input"
import { AddToPersonaDialog } from "@/components/inventory/add-to-persona-dialog"
import { BulkCategoryDialog } from "@/components/inventory/bulk-category-dialog"
import { BulkTagsDialog } from "@/components/inventory/bulk-tags-dialog"
import {
  CategoryFilter,
  UNCATEGORIZED,
} from "@/components/inventory/category-filter"
import { ItemDialog } from "@/components/inventory/item-dialog"
import { PoolTable, type PoolColumn } from "@/components/inventory/pool-table"
import { TagFilter } from "@/components/inventory/tag-filter"
import { useDialogSearchParams } from "@/hooks/use-dialog-search-params"
import { useSessionState } from "@/hooks/use-session-state"
import {
  byFavouriteThenPosition,
  deleteItem,
  toggleFavorite,
  type DbInventoryItem,
  type ItemKind,
} from "@/lib/inventory"
import { useInventoryStore } from "@/lib/inventory-store"

/**
 * Everything on a row that search should match, flattened to one lowercase
 * string. Built from the item's own fields rather than the rendered columns,
 * because a column's `cell` returns a ReactNode, not text — so this stays
 * correct whatever columns a pool chooses to show.
 */
function searchableText(item: DbInventoryItem): string {
  const detailValues = Object.values(item.details).filter(
    (value) => typeof value === "string" || typeof value === "number"
  )

  return [
    item.title,
    item.subtitle,
    item.summary,
    item.url,
    item.note,
    item.startDate,
    item.endDate,
    ...item.tags,
    ...detailValues,
  ]
    .filter((value) => value !== null && value !== undefined)
    .join(" ")
    .toLowerCase()
}

/**
 * Why the table is empty, naming whichever filters are responsible — an empty
 * pool and a filter that matched nothing look identical otherwise.
 */
function emptyMessage(
  query: string,
  tags: string[],
  /** Pre-formatted clause for the active category filter, e.g. `in “Frontend”`. */
  categoryClause: string | null
): string {
  const clauses = [
    tags.length > 0
      ? `carry ${tags.map((tag) => `“${tag}”`).join(" and ")}`
      : null,
    categoryClause,
  ].filter((clause): clause is string => clause !== null)

  if (query && clauses.length > 0) {
    return `No entries match “${query}” and ${clauses.join(" and ")}.`
  }

  if (clauses.length > 0) {
    return `No entries ${clauses.join(" and ")}.`
  }

  if (query) {
    return `No entries match “${query}”.`
  }

  return "No entries yet."
}

/**
 * One pool: its description, its toolbar, and its table.
 *
 * Owns the selection the table reads. Checkboxes are always visible; the bulk
 * action bar appears once anything is checked.
 */
export function PoolPanel({
  kind,
  label,
  description,
  columns,
  rows,
  formKind,
  onDataChanged,
  mode = "manage",
  selectionMode = "multiple",
  selected: controlledSelected,
  onSelectedChange,
  pinnedIds,
  dialogParamPrefix,
}: {
  /** Keys the persisted search and tag filter, so each pool keeps its own. */
  kind: ItemKind
  label: string
  /** Omitted on single-pool pages, where the page header already carries it. */
  description?: string
  columns: PoolColumn[]
  rows: DbInventoryItem[]
  /**
   * Which kind's add/edit form to use. Pools with no config leave it
   * undefined and keep the disabled Add/Edit/Delete controls.
   */
  formKind?: ItemKind
  /**
   * Called after a successful create/update/delete so the parent re-reads
   * `itemsOfKind()` and passes a fresh `rows` array — add/delete change the
   * array's length, which an internal counter alone can't reflect.
   */
  onDataChanged?: () => void
  /**
   * "pick" is the Persona section picker's popup: no bulk-action bar (bulk
   * semantics don't apply inside a picker), selection can be externally
   * controlled. Add/Edit/Delete stay wired exactly as in "manage", gated
   * only on `formKind` either way.
   */
  mode?: "manage" | "pick"
  /** "single" replaces the whole selection on each pick — pick-one Basics kinds. */
  selectionMode?: "multiple" | "single"
  /** Controlled selection, for the picker. Uncontrolled (internal state) when omitted. */
  selected?: ReadonlySet<string>
  onSelectedChange?: (next: ReadonlySet<string>) => void
  /**
   * Sort priority only — frozen at whatever was last saved, not the live
   * `selected` set. Checking a box shouldn't reshuffle the list out from
   * under the person mid-pick; the newly-picked rows earn their place at the
   * top the next time the picker opens, after a successful confirm.
   */
  pinnedIds?: ReadonlySet<string>
  /**
   * Namespaces this panel's own dialog/id URL params (`dialog`/`id` become
   * `{prefix}Dialog`/`{prefix}Id`) — required whenever the panel is mounted
   * inside another popup that also manages a `dialog=` param (e.g. the
   * Persona page's Pool Picker), so the panel's Add/Edit/Delete dialogs don't
   * clobber the outer popup's own open/close state.
   */
  dialogParamPrefix?: string
}) {
  const store = useInventoryStore()
  const [internalSelected, setInternalSelected] = React.useState<
    ReadonlySet<string>
  >(new Set())
  const selected = controlledSelected ?? internalSelected

  function updateSelected(next: ReadonlySet<string>) {
    if (onSelectedChange) {
      onSelectedChange(next)
    } else {
      setInternalSelected(next)
    }
  }

  // `AddToPersonaDialog` targets the panel's own multi-select (`selected`,
  // already local state below), not a single record id — so it only needs a
  // boolean-style dialog kind, with the row ids it acts on staying local
  // rather than crammed into the URL.
  const { dialog, get, open, close } = useDialogSearchParams(dialogParamPrefix)
  const dialogMode: "add" | "edit" = dialog === "edit" ? "edit" : "add"
  const dialogOpen = dialog === "new" || dialog === "edit"
  const dialogItem =
    dialog === "edit"
      ? rows.find((row) => row.id === get("id"))
      : undefined
  const deleteTarget =
    dialog === "delete"
      ? (rows.find((row) => row.id === get("id")) ?? null)
      : null
  const addToPersonaOpen = dialog === "add-to-persona"
  const bulkTagsOpen = dialog === "bulk-tags"
  const bulkCategoryOpen = dialog === "bulk-category"
  const bulkDeleteOpen = dialog === "bulk-delete"

  // Both filters outlive the page: leaving for a CV and coming back to find the
  // pool reset is the kind of small loss that makes people stop filtering.
  const [query, setQuery] = useSessionState(`pool:${kind}:search`, "")
  const [tagFilter, setTagFilter] = useSessionState<string[]>(
    `pool:${kind}:tags`,
    []
  )
  // Skills only — `null` means unfiltered.
  const [categoryFilter, setCategoryFilter] = useSessionState<string | null>(
    `pool:${kind}:category`,
    null
  )

  // `toggleFavorite` mutates the row in place, so the objects are already
  // correct — what goes stale is the *order*. Bumping this re-runs the sort.
  const [favouriteVersion, setFavouriteVersion] = React.useState(0)

  async function onToggleFavourite(id: string) {
    await toggleFavorite(store, id)
    setFavouriteVersion((version) => version + 1)
  }

  const visible = React.useMemo(() => {
    // In "pick" mode, previously-saved picks float to the top — ahead of
    // favourite. Sorted by `pinnedIds`, not the live `selected` set: checking
    // a box mid-session must not reshuffle the list out from under the
    // person picking. "manage" mode keeps the plain favourite-then-position
    // order untouched.
    const sortRows =
      mode === "pick" && pinnedIds
        ? (a: DbInventoryItem, b: DbInventoryItem) => {
            const pinnedDiff =
              Number(pinnedIds.has(b.id)) - Number(pinnedIds.has(a.id))
            return pinnedDiff !== 0 ? pinnedDiff : byFavouriteThenPosition(a, b)
          }
        : byFavouriteThenPosition

    const ordered = [...rows].sort(sortRows)
    const needle = query.trim().toLowerCase()

    return ordered
      .filter((row) => !needle || searchableText(row).includes(needle))
      .filter((row) => tagFilter.every((tag) => row.tags.includes(tag)))
      .filter((row) => {
        if (kind !== "skill" || categoryFilter === null) return true
        if (categoryFilter === UNCATEGORIZED) return row.categoryId === null
        return row.categoryId === categoryFilter
      })
    // favouriteVersion is the signal that an in-place mutation happened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, query, tagFilter, categoryFilter, favouriteVersion, mode, pinnedIds, kind])

  // Offered tags come from the rows that survive the current filters, so every
  // suggestion narrows the list instead of emptying it.
  const availableTags = React.useMemo(
    () => [...new Set(visible.flatMap((row) => row.tags))].sort(),
    [visible]
  )

  const categoryFilterClause =
    kind === "skill" && categoryFilter !== null
      ? categoryFilter === UNCATEGORIZED
        ? "are uncategorized"
        : `are in “${
            store.skillCategories.find(
              (category) => category.id === categoryFilter
            )?.name ?? ""
          }”`
      : null

  // Selection order matters for the "latest selected wins" pick-one rule —
  // `selected` is a `Set`, which iterates in insertion order.
  const selectedItems = React.useMemo(() => {
    const rowsById = new Map(rows.map((row) => [row.id, row]))
    return [...selected]
      .map((id) => rowsById.get(id))
      .filter((row): row is DbInventoryItem => row !== undefined)
  }, [selected, rows])

  // Select-all applies to what's on screen, so it never quietly selects rows
  // the current search has hidden.
  function toggleAll(checked: boolean) {
    updateSelected(checked ? new Set(visible.map((row) => row.id)) : new Set())
  }

  function toggleRow(id: string, checked: boolean) {
    if (selectionMode === "single") {
      updateSelected(checked ? new Set([id]) : new Set())
      return
    }

    const next = new Set(selected)
    if (checked) {
      next.add(id)
    } else {
      next.delete(id)
    }
    updateSelected(next)
  }

  return (
    <>
      {description ? (
        <p className="text-sm text-muted-foreground">{description}</p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <SearchInput
            value={query}
            onChange={setQuery}
            label={label.toLowerCase()}
          />
          <TagFilter
            value={tagFilter}
            onChange={setTagFilter}
            available={availableTags}
          />
          {kind === "skill" ? (
            <CategoryFilter
              value={categoryFilter}
              onChange={setCategoryFilter}
              categories={store.skillCategories}
            />
          ) : null}
        </div>

        <Button
          variant="default"
          size="icon-sm"
          disabled={!formKind}
          onClick={() => formKind && open("new")}
          aria-label={`Add ${label.toLowerCase()}`}
        >
          <PlusIcon />
        </Button>
      </div>

      <div className="shrink-0 overflow-hidden rounded-xl border">
        {mode === "manage" && selected.size > 0 ? (
          <BulkActions
            count={selected.size}
            onClear={() => updateSelected(new Set())}
            onAddToPersona={() => open("add-to-persona")}
            onAddTags={() => open("bulk-tags")}
            onAddToCategory={
              kind === "skill" ? () => open("bulk-category") : undefined
            }
            onBulkDelete={() => open("bulk-delete")}
          />
        ) : null}
        <PoolTable
          columns={columns}
          rows={visible}
          selected={selected}
          onToggleRow={toggleRow}
          onToggleAll={toggleAll}
          onToggleFavourite={onToggleFavourite}
          emptyMessage={emptyMessage(query, tagFilter, categoryFilterClause)}
          onEditRow={
            formKind ? (item) => open("edit", { id: item.id }) : undefined
          }
          onRequestDelete={
            formKind ? (item) => open("delete", { id: item.id }) : undefined
          }
          selectAllHidden={mode === "pick" && selectionMode === "single"}
          dialogParamPrefix={dialogParamPrefix}
        />
      </div>

      <AddToPersonaDialog
        kind={kind}
        items={selectedItems}
        open={addToPersonaOpen}
        onClose={() => close()}
        onAdded={() => updateSelected(new Set())}
      />

      <BulkTagsDialog
        items={selectedItems}
        open={bulkTagsOpen}
        onClose={() => close()}
        onApplied={() => {
          onDataChanged?.()
          updateSelected(new Set())
        }}
      />

      {kind === "skill" ? (
        <BulkCategoryDialog
          items={selectedItems}
          open={bulkCategoryOpen}
          onClose={() => close()}
          onApplied={() => {
            onDataChanged?.()
            updateSelected(new Set())
          }}
        />
      ) : null}

      {formKind ? (
        <ItemDialog
          kind={formKind}
          mode={dialogMode}
          item={dialogItem}
          open={dialogOpen}
          onOpenChange={(next) => !next && close(["id"])}
          onSaved={() => {
            onDataChanged?.()
            close(["id"])
          }}
        />
      ) : null}

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(next) => !next && close(["id"])}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleteTarget?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the entry from the pool. This can't be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => close(["id"])}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                if (!deleteTarget) return
                await deleteItem(store, deleteTarget.id)
                if (selected.has(deleteTarget.id)) {
                  const next = new Set(selected)
                  next.delete(deleteTarget.id)
                  updateSelected(next)
                }
                onDataChanged?.()
                close(["id"])
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={bulkDeleteOpen}
        onOpenChange={(next) => !next && close()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} entries?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes{" "}
              {selected.size === 1 ? "this entry" : "these entries"} from the
              pool. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => close()}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                await Promise.all(
                  selectedItems.map((item) => deleteItem(store, item.id))
                )
                updateSelected(new Set())
                onDataChanged?.()
                close()
              }}
            >
              Delete {selected.size} {selected.size === 1 ? "entry" : "entries"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/** Shown only once rows are selected. */
function BulkActions({
  count,
  onClear,
  onAddToPersona,
  onAddTags,
  onAddToCategory,
  onBulkDelete,
}: {
  count: number
  onClear: () => void
  onAddToPersona: () => void
  onAddTags: () => void
  /** Omitted on pools with no `categoryId` field — hides the Category button. */
  onAddToCategory?: () => void
  onBulkDelete: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b bg-muted/50 px-3 py-2">
      <span className="text-sm font-medium">{count} selected</span>
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={onClear}
        aria-label="Clear selection"
      >
        <XIcon />
      </Button>
      <div className="ml-auto flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={onAddTags}>
          <TagsIcon data-icon="inline-start" />
          Tags
        </Button>
        {onAddToCategory ? (
          <Button variant="outline" size="sm" onClick={onAddToCategory}>
            <FolderInputIcon data-icon="inline-start" />
            Category
          </Button>
        ) : null}
        <Button variant="outline" size="sm" onClick={onAddToPersona}>
          <FilePlus2Icon data-icon="inline-start" />
          Add to Persona
        </Button>
        <Button variant="destructive" size="sm" onClick={onBulkDelete}>
          <Trash2Icon data-icon="inline-start" />
          Delete
        </Button>
      </div>
    </div>
  )
}
