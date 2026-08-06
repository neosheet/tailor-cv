import * as React from "react"
import {
  EyeIcon,
  MoreHorizontalIcon,
  PencilIcon,
  StarIcon,
  Trash2Icon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { ItemDetailDialog } from "@/components/inventory/item-detail-dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useInventoryStore } from "@/lib/inventory-store"
import type { InventoryStore } from "@/lib/inventory-store"
import type { DbInventoryItem } from "@/lib/inventory"

/** What a cell can do to its own row. Passed to every `cell` renderer. */
export type PoolCellActions = {
  openDetail: () => void
  /** Same dialog, scrolled to the Used-in-CVs section. */
  openUsage: () => void
}

export type PoolColumn = {
  header: string
  /**
   * `store` is the fetched inventory store — passed through so a column's
   * `cell` (a plain callback, not a component, so it can't call
   * `useInventoryStore()` itself) can still read selectors like `linesOf`
   * that need the store's data. `PoolTable` calls the hook once and threads
   * the result into every cell call.
   */
  cell: (
    item: DbInventoryItem,
    actions: PoolCellActions,
    store: InventoryStore
  ) => React.ReactNode
  /** Applied to both the header and the cells, for width and alignment. */
  className?: string
}

/**
 * One pool rendered as a table. Columns differ per pool, so they're passed in
 * rather than switched on `kind` here.
 *
 * Selection is controlled by `PoolPanel`.
 */
export function PoolTable({
  columns,
  rows,
  selected,
  onToggleRow,
  onToggleAll,
  onToggleFavourite,
  emptyMessage = "No entries yet.",
  onEditRow,
  onRequestDelete,
}: {
  columns: PoolColumn[]
  rows: DbInventoryItem[]
  selected: ReadonlySet<string>
  onToggleRow: (id: string, checked: boolean) => void
  onToggleAll: (checked: boolean) => void
  onToggleFavourite: (id: string) => void
  emptyMessage?: string
  /** Present only for pools with a form config; absent leaves Edit disabled. */
  onEditRow?: (item: DbInventoryItem) => void
  /** Present only for pools with a form config; absent leaves Delete disabled. */
  onRequestDelete?: (item: DbInventoryItem) => void
}) {
  const store = useInventoryStore()
  const allSelected =
    rows.length > 0 && rows.every((row) => selected.has(row.id))
  // Checkbox + configured columns + favourite + actions.
  const columnCount = columns.length + 3

  // One dialog for the whole table rather than one per row.
  const [detail, setDetail] = React.useState<{
    item: DbInventoryItem
    focusUsage: boolean
  } | null>(null)

  const actionsFor = (item: DbInventoryItem): PoolCellActions => ({
    openDetail: () => setDetail({ item, focusUsage: false }),
    openUsage: () => setDetail({ item, focusUsage: true }),
  })

  // Closes the detail dialog before handing off to the edit form, so the two
  // never stack when Edit is triggered from inside the detail view.
  const handleEditRow = onEditRow
    ? (item: DbInventoryItem) => {
        setDetail(null)
        onEditRow(item)
      }
    : undefined

  // Same close-before-handoff pattern as `handleEditRow`, so Delete triggered
  // from inside the detail view doesn't leave it open behind the confirm dialog.
  const handleRequestDelete = onRequestDelete
    ? (item: DbInventoryItem) => {
        setDetail(null)
        onRequestDelete(item)
      }
    : undefined

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-0">
              <Checkbox
                checked={allSelected}
                onCheckedChange={onToggleAll}
                aria-label="Select all rows"
              />
            </TableHead>
            {columns.map((column) => (
              <TableHead key={column.header} className={column.className}>
                {column.header}
              </TableHead>
            ))}
            <TableHead className="w-0">
              <span className="sr-only">Favourite</span>
            </TableHead>
            <TableHead className="w-0">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columnCount}
                className="h-24 text-center text-muted-foreground"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : null}
          {rows.map((item) => (
            <TableRow
              key={item.id}
              data-state={selected.has(item.id) && "selected"}
            >
              <TableCell className="align-top">
                <Checkbox
                  checked={selected.has(item.id)}
                  onCheckedChange={(checked) => onToggleRow(item.id, checked)}
                  aria-label={`Select ${item.title}`}
                />
              </TableCell>
              {columns.map((column, index) => (
                <TableCell
                  key={column.header}
                  // The first column identifies the row, so it carries the weight.
                  className={cellClassName(column.className, index === 0)}
                >
                  {index === 0 ? (
                    // The identifying column doubles as the way into the row.
                    // h-auto/p-0 strip the button's own box so it sits in the
                    // cell as text rather than as a control.
                    <Button
                      variant="link"
                      className="h-auto justify-start p-0 font-medium"
                      onClick={() => setDetail({ item, focusUsage: false })}
                    >
                      {column.cell(item, actionsFor(item), store)}
                    </Button>
                  ) : (
                    column.cell(item, actionsFor(item), store)
                  )}
                </TableCell>
              ))}
              <TableCell className="align-top">
                <FavouriteToggle
                  item={item}
                  onToggle={() => onToggleFavourite(item.id)}
                />
              </TableCell>
              <TableCell className="align-top">
                <RowActions
                  item={item}
                  label={item.title}
                  onViewDetail={() => setDetail({ item, focusUsage: false })}
                  onEditRow={onEditRow}
                  onRequestDelete={onRequestDelete}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <ItemDetailDialog
        item={detail?.item ?? null}
        focusUsage={detail?.focusUsage ?? false}
        onClose={() => setDetail(null)}
        onEditRow={handleEditRow}
        onRequestDelete={handleRequestDelete}
      />
    </>
  )
}

/**
 * Toggles an entry's favourite flag, which re-sorts it to the top of its pool.
 *
 * A real control, so a real button. Unfavourited rows show a faint hollow star
 * rather than nothing, because an empty cell gives you nothing to aim at.
 */
function FavouriteToggle({
  item,
  onToggle,
}: {
  item: DbInventoryItem
  onToggle: () => void
}) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={onToggle}
      aria-pressed={item.favorite}
      aria-label={
        item.favorite
          ? `Remove ${item.title} from favourites`
          : `Add ${item.title} to favourites`
      }
    >
      {/* Filled rather than coloured: the palette is monochrome, and a lone gold
          star would be the only colour in the app. */}
      <StarIcon
        className={
          item.favorite
            ? "fill-current"
            : "text-muted-foreground/40 group-hover/button:text-muted-foreground"
        }
      />
    </Button>
  )
}

/** Menu items sit a step down from the default text-sm, icons scaled to match. */
const ACTION_ITEM = "text-xs [&_svg:not([class*='size-'])]:size-3.5"

/**
 * Per-row actions. A menu rather than three inline buttons, because these tables
 * already run wide and icon buttons would add a column's worth to every row.
 *
 * View detail is always live. Edit and delete are only wired for pools that
 * pass a form config (Basics, today) — everywhere else they stay disabled.
 */
function RowActions({
  item,
  label,
  onViewDetail,
  onEditRow,
  onRequestDelete,
}: {
  item: DbInventoryItem
  label: string
  onViewDetail: () => void
  onEditRow?: (item: DbInventoryItem) => void
  onRequestDelete?: (item: DbInventoryItem) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Actions for ${label}`}
          />
        }
      >
        <MoreHorizontalIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        <DropdownMenuGroup>
          <DropdownMenuItem className={ACTION_ITEM} onClick={onViewDetail}>
            <EyeIcon />
            View detail
          </DropdownMenuItem>
          <DropdownMenuItem
            className={ACTION_ITEM}
            disabled={!onEditRow}
            onClick={() => onEditRow?.(item)}
          >
            <PencilIcon />
            Edit
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            className={ACTION_ITEM}
            variant="destructive"
            disabled={!onRequestDelete}
            onClick={() => onRequestDelete?.(item)}
          >
            <Trash2Icon />
            Delete
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * `whitespace-normal` overrides TableCell's default nowrap — summaries and notes
 * are long enough to force horizontal scroll on every pool otherwise.
 */
function cellClassName(className: string | undefined, isFirst: boolean) {
  return [
    className,
    "align-top",
    // The first column identifies the row: short, bold, and never wrapped.
    isFirst ? "font-medium whitespace-nowrap" : "whitespace-normal",
  ]
    .filter(Boolean)
    .join(" ")
}

export function TagsCell({ tags }: { tags: string[] }) {
  if (tags.length === 0) {
    return <span className="text-muted-foreground">—</span>
  }

  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <Badge key={tag} variant="secondary">
          {tag}
        </Badge>
      ))}
    </div>
  )
}

/** Private annotation. Muted, because it is never part of the CV. */
export function NoteCell({ note }: { note: string | null }) {
  if (!note) {
    return <span className="text-muted-foreground">—</span>
  }

  return <span className="text-muted-foreground">{note}</span>
}

/** A value that may be missing, so empty never renders as a blank cell. */
export function ValueCell({ value }: { value: string | null }) {
  if (!value) {
    return <span className="text-muted-foreground">—</span>
  }

  return <span>{value}</span>
}
