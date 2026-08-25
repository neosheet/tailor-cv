import { PencilIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export type RegistryTableColumn<T> = {
  header: string
  className?: string
  render: (item: T) => React.ReactNode
}

/**
 * The search-filtered table + hover rename/delete actions shared by the
 * settings registry panels (Skill Categories, Stage Templates) — header,
 * "no matches" row, and the actions cell only. Each caller supplies its own
 * columns, key/label accessors, and rename/delete handlers; the panel itself
 * still owns the search box, the "registry is empty" state, and the
 * rename/delete dialogs.
 *
 * `TagsPanel` isn't a caller here — its checkbox column, bulk-selection bar,
 * and merge flow don't compose cleanly with this shape, and forcing them in
 * would cost more generic-component ceremony than it'd save. It keeps its
 * own bespoke table.
 */
export function RegistryTable<T>({
  items,
  query,
  itemNounPlural,
  columns,
  getRowKey,
  getRowLabel,
  onRename,
  onDelete,
}: {
  items: T[]
  query: string
  itemNounPlural: string
  columns: RegistryTableColumn<T>[]
  getRowKey: (item: T) => string
  getRowLabel: (item: T) => string
  onRename: (item: T) => void
  onDelete: (item: T) => void
}) {
  return (
    <div className="overflow-hidden rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column.header} className={column.className}>
                {column.header}
              </TableHead>
            ))}
            <TableHead className="w-0">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length + 1}
                className="h-24 text-center text-muted-foreground"
              >
                No {itemNounPlural} match “{query}”.
              </TableCell>
            </TableRow>
          ) : null}
          {items.map((item) => {
            const label = getRowLabel(item)
            return (
              <TableRow key={getRowKey(item)}>
                {columns.map((column) => (
                  <TableCell key={column.header} className={column.className}>
                    {column.render(item)}
                  </TableCell>
                ))}
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onRename(item)}
                      aria-label={`Rename ${label}`}
                    >
                      <PencilIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onDelete(item)}
                      aria-label={`Delete ${label}`}
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
