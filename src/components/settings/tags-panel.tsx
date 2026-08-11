import * as React from "react"
import { PencilIcon, PlusIcon, TagsIcon, Trash2Icon, XIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Field, FieldError } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { SearchInput } from "@/components/search-input"
import {
  DeleteTagDialog,
  RenameTagDialog,
} from "@/components/settings/tag-dialogs"
import { usageLabel } from "@/lib/tag-copy"
import {
  createTag,
  deleteTag,
  listTags,
  renameTag,
  validateTagName,
} from "@/lib/tags"
import { useInventoryStore } from "@/lib/inventory-store"
import { useDialogSearchParams } from "@/hooks/use-dialog-search-params"

/**
 * The tag registry — every tag, what it's on, and the three things you can do
 * to one.
 *
 * `listTags(store)` is computed fresh on every render straight from the
 * store — the store's own state updates (via its `setTags`/`setItems`/
 * `setLines`) are what re-renders this component, so there's no separate
 * local copy to keep in sync the way the mocks version needed.
 */
export function TagsPanel() {
  const store = useInventoryStore()
  const tags = listTags(store)
  const [query, setQuery] = React.useState("")

  // Which rows a dialog is open for. One dialog for the table, not one per row.
  const { dialog, get, open, close } = useDialogSearchParams()
  const renaming =
    dialog === "rename-tag"
      ? (tags.find((tag) => tag.name === get("id")) ?? null)
      : null
  const deleting =
    dialog === "delete-tag"
      ? (() => {
          const ids = get("ids")?.split(",") ?? []
          const names = new Set(ids)
          const matched = tags.filter((tag) => names.has(tag.name))
          return matched.length > 0 ? matched : null
        })()
      : null

  const [selected, setSelected] = React.useState<ReadonlySet<string>>(new Set())

  const needle = query.trim().toLowerCase()
  const visible = needle
    ? tags.filter((tag) => tag.name.includes(needle))
    : tags

  const allSelected =
    visible.length > 0 && visible.every((tag) => selected.has(tag.name))

  // Select-all covers what's on screen, so it never quietly checks tags the
  // current search has hidden.
  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(visible.map((tag) => tag.name)) : new Set())
  }

  function toggleRow(name: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current)

      if (checked) {
        next.add(name)
      } else {
        next.delete(name)
      }

      return next
    })
  }

  async function applyDelete(names: string[]) {
    for (const name of names) {
      await deleteTag(store, name)
    }

    setSelected(new Set())
    close(["ids"])
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        The vocabulary you tag entries and bullet points with. Tagging is what
        turns “find the relevant material” into a filter while you build a CV —
        these names are yours alone and never appear on a CV.
      </p>

      <div className="flex flex-wrap items-start justify-between gap-2">
        <SearchInput value={query} onChange={setQuery} label="tags" />
        <AddTagField
          registry={store.tags}
          onAdd={async (name) => {
            await createTag(store, name)
          }}
        />
      </div>

      {tags.length === 0 ? (
        <Empty className="min-h-48 flex-none border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TagsIcon />
            </EmptyMedia>
            <EmptyTitle>No tags yet</EmptyTitle>
            <EmptyDescription>
              Add one above, then apply it to the entries and bullet points it
              describes.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          {selected.size > 0 ? (
            <BulkActions
              count={selected.size}
              onClear={() => setSelected(new Set())}
              onDelete={() =>
                open("delete-tag", { ids: Array.from(selected).join(",") })
              }
            />
          ) : null}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-0">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Select all tags"
                  />
                </TableHead>
                <TableHead>Tag</TableHead>
                <TableHead>Used on</TableHead>
                <TableHead className="w-0">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No tags match “{query}”.
                  </TableCell>
                </TableRow>
              ) : null}
              {visible.map((tag) => (
                <TableRow
                  key={tag.name}
                  data-state={selected.has(tag.name) && "selected"}
                >
                  <TableCell>
                    <Checkbox
                      checked={selected.has(tag.name)}
                      onCheckedChange={(checked) =>
                        toggleRow(tag.name, checked)
                      }
                      aria-label={`Select ${tag.name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{tag.name}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {usageLabel(tag)}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => open("rename-tag", { id: tag.name })}
                        aria-label={`Rename ${tag.name}`}
                      >
                        <PencilIcon />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => open("delete-tag", { ids: tag.name })}
                        aria-label={`Delete ${tag.name}`}
                      >
                        <Trash2Icon />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {renaming ? (
        <RenameTagDialog
          // Remounts per tag, so the field always opens on the current name.
          key={renaming.name}
          tag={renaming}
          open
          onCancel={() => close(["id"])}
          onRename={async (name) => {
            await renameTag(store, renaming.name, name)
            close(["id"])
          }}
        />
      ) : null}

      {deleting ? (
        <DeleteTagDialog
          tags={deleting}
          open
          onCancel={() => close(["ids"])}
          onDelete={() => applyDelete(deleting.map((tag) => tag.name))}
        />
      ) : null}
    </div>
  )
}

/**
 * Shown once tags are checked. Delete is the only bulk action that makes sense
 * here — renaming several tags to one name is a merge, and merging is not
 * something this screen does.
 */
function BulkActions({
  count,
  onClear,
  onDelete,
}: {
  count: number
  onClear: () => void
  onDelete: () => void
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
      <div className="ml-auto">
        <Button variant="destructive" size="sm" onClick={onDelete}>
          <Trash2Icon data-icon="inline-start" />
          Delete
        </Button>
      </div>
    </div>
  )
}

/**
 * Adding a tag is one text field, so it's inline rather than behind a dialog.
 *
 * The error only appears once you've typed something — an empty box is not yet
 * a mistake, and colouring it red before the first keystroke would say it is.
 */
function AddTagField({
  registry,
  onAdd,
}: {
  registry: string[]
  onAdd: (name: string) => void
}) {
  const [value, setValue] = React.useState("")
  const problem = validateTagName(value, registry)
  const showProblem = value.trim().length > 0 && problem !== null

  function submit(event: React.FormEvent) {
    event.preventDefault()

    if (!problem) {
      onAdd(value)
      setValue("")
    }
  }

  return (
    <form onSubmit={submit}>
      <Field
        className="w-full sm:w-auto"
        data-invalid={showProblem ? true : undefined}
      >
        <div className="flex items-center gap-2">
          <InputGroup className="w-full sm:w-56">
            <InputGroupAddon>
              <TagsIcon />
            </InputGroupAddon>
            <InputGroupInput
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="New tag…"
              aria-label="New tag name"
              aria-invalid={showProblem ? true : undefined}
            />
          </InputGroup>
          <Button type="submit" variant="outline" disabled={Boolean(problem)}>
            <PlusIcon data-icon="inline-start" />
            Add tag
          </Button>
        </div>
        {showProblem ? <FieldError>{problem}</FieldError> : null}
      </Field>
    </form>
  )
}
