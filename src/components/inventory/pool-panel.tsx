import * as React from "react"
import {
  FilePlus2Icon,
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
import { ItemDialog } from "@/components/inventory/item-dialog"
import { PoolTable, type PoolColumn } from "@/components/inventory/pool-table"
import { TagFilter } from "@/components/inventory/tag-filter"
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
function emptyMessage(query: string, tags: string[]): string {
  const tagList = tags.map((tag) => `“${tag}”`).join(" and ")

  if (query && tags.length > 0) {
    return `No entries match “${query}” and carry ${tagList}.`
  }

  if (tags.length > 0) {
    return `No entries carry ${tagList}.`
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

  const [dialog, setDialog] = React.useState<{
    mode: "add" | "edit"
    item?: DbInventoryItem
  } | null>(null)
  const [deleteTarget, setDeleteTarget] =
    React.useState<DbInventoryItem | null>(null)

  // Both filters outlive the page: leaving for a CV and coming back to find the
  // pool reset is the kind of small loss that makes people stop filtering.
  const [query, setQuery] = useSessionState(`pool:${kind}:search`, "")
  const [tagFilter, setTagFilter] = useSessionState<string[]>(
    `pool:${kind}:tags`,
    []
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
    // favouriteVersion is the signal that an in-place mutation happened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, query, tagFilter, favouriteVersion, mode, pinnedIds])

  // Offered tags come from the rows that survive the current filters, so every
  // suggestion narrows the list instead of emptying it.
  const availableTags = React.useMemo(
    () => [...new Set(visible.flatMap((row) => row.tags))].sort(),
    [visible]
  )

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
        </div>

        <Button
          variant="default"
          size="icon-sm"
          disabled={!formKind}
          onClick={() => formKind && setDialog({ mode: "add" })}
          aria-label={`Add ${label.toLowerCase()}`}
        >
          <PlusIcon />
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border">
        {mode === "manage" && selected.size > 0 ? (
          <BulkActions
            count={selected.size}
            onClear={() => updateSelected(new Set())}
          />
        ) : null}
        <PoolTable
          columns={columns}
          rows={visible}
          selected={selected}
          onToggleRow={toggleRow}
          onToggleAll={toggleAll}
          onToggleFavourite={onToggleFavourite}
          emptyMessage={emptyMessage(query, tagFilter)}
          onEditRow={
            formKind ? (item) => setDialog({ mode: "edit", item }) : undefined
          }
          onRequestDelete={
            formKind ? (item) => setDeleteTarget(item) : undefined
          }
          selectAllHidden={mode === "pick" && selectionMode === "single"}
        />
      </div>

      {formKind ? (
        <ItemDialog
          kind={formKind}
          mode={dialog?.mode ?? "add"}
          item={dialog?.item}
          open={dialog !== null}
          onOpenChange={(next) => !next && setDialog(null)}
          onSaved={() => {
            onDataChanged?.()
            setDialog(null)
          }}
        />
      ) : null}

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(next) => !next && setDeleteTarget(null)}
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
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>
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
                setDeleteTarget(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/**
 * Shown only once rows are selected. The three actions carry no handlers yet —
 * this is the bar's shape, not its behaviour.
 */
function BulkActions({
  count,
  onClear,
}: {
  count: number
  onClear: () => void
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
        <Button variant="outline" size="sm" disabled>
          <TagsIcon data-icon="inline-start" />
          Tags
        </Button>
        <Button variant="outline" size="sm" disabled>
          <FilePlus2Icon data-icon="inline-start" />
          Add to CV
        </Button>
        <Button variant="destructive" size="sm" disabled>
          <Trash2Icon data-icon="inline-start" />
          Delete
        </Button>
      </div>
    </div>
  )
}
