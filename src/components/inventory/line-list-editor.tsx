import * as React from "react"
import { ChevronDownIcon, ChevronUpIcon, PlusIcon, Trash2Icon } from "lucide-react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupInput,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import { NoteInput } from "@/components/inventory/note-input"
import { TagInput } from "@/components/inventory/tag-input"
import type { LineKind } from "@/lib/inventory"
import { cn } from "@/lib/utils"

/**
 * One row of a `LineListEditor` — a bullet/keyword plus its tags and note.
 *
 * `id` present means the row already exists in the DB, so a later save should
 * diff it against the original and `updateLine`/`deleteLine` as needed. `id`
 * absent means the row was added in this editing session and should
 * `createLine` on save. This component never makes that call itself — it's a
 * pure controlled list, the diffing is `ItemDialog`'s save handler's job.
 */
export type LineDraft = {
  id?: string
  content: string
  tags: string[]
  note: string | null
}

/**
 * Editable list for one `inventory_lines` `list_kind` (a job's highlights, a
 * skill's keywords, etc.) inside an entry's add/edit form.
 *
 * Purely controlled local state — every edit (content, reorder, delete, add,
 * tags, note) calls `onValueChange` with a new array; nothing here talks to
 * Supabase. The only state that lives outside `value` is which rows have
 * their "Tags & note" disclosure open, tracked by position since that's
 * ephemeral UI state, not part of the data being edited.
 */
export function LineListEditor({
  listKind,
  label,
  value,
  onValueChange,
  multiline = false,
  showLabel = true,
}: {
  listKind: LineKind
  label: string
  value: LineDraft[]
  onValueChange: (lines: LineDraft[]) => void
  /** Longer bullets (e.g. responsibilities) read easier as a wrapping textarea. */
  multiline?: boolean
  /** Off when a surrounding tab already names this list — the legend would only repeat it. */
  showLabel?: boolean
}) {
  const baseId = React.useId()
  const [openRows, setOpenRows] = React.useState<Set<number>>(new Set())

  function setRowOpen(index: number, open: boolean) {
    setOpenRows((prev) => {
      const next = new Set(prev)
      if (open) {
        next.add(index)
      } else {
        next.delete(index)
      }
      return next
    })
  }

  function updateRow(index: number, patch: Partial<LineDraft>) {
    onValueChange(
      value.map((row, i) => (i === index ? { ...row, ...patch } : row))
    )
  }

  function moveRow(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= value.length) {
      return
    }

    const next = [...value]
    ;[next[index], next[target]] = [next[target], next[index]]
    onValueChange(next)

    // Open state is tracked by position, so a swap must carry it along with
    // the rows that moved rather than leaving it pinned to the old slots.
    setOpenRows((prev) => {
      const next = new Set<number>()
      for (const i of prev) {
        if (i === index) next.add(target)
        else if (i === target) next.add(index)
        else next.add(i)
      }
      return next
    })
  }

  function deleteRow(index: number) {
    onValueChange(value.filter((_, i) => i !== index))

    // Shift every open-row position above the deleted one down by one so the
    // disclosure state stays attached to the rows that survive, not to
    // whatever happens to land at the same index afterward.
    setOpenRows((prev) => {
      const next = new Set<number>()
      for (const i of prev) {
        if (i === index) continue
        next.add(i > index ? i - 1 : i)
      }
      return next
    })
  }

  function addRow() {
    onValueChange([...value, { content: "", tags: [], note: null }])
  }

  return (
    <FieldSet data-list-kind={listKind}>
      {showLabel ? <FieldLegend variant="label">{label}</FieldLegend> : null}

      <FieldGroup className="gap-3">
        {value.map((row, index) => {
          const invalid = row.content.trim() === ""
          const contentId = `${baseId}-content-${index}`
          const isOpen = openRows.has(index)

          return (
            <div
              // Index is stable enough here: rows are reordered by swapping
              // (not dragged), and open-state/content edits are remapped
              // alongside it above.
              key={index}
              className="flex flex-col gap-1.5 rounded-lg border p-2"
            >
              <div className="flex items-start gap-1.5">
                <div className="flex flex-col gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    disabled={index === 0}
                    aria-label="Move up"
                    onClick={() => moveRow(index, -1)}
                  >
                    <ChevronUpIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    disabled={index === value.length - 1}
                    aria-label="Move down"
                    onClick={() => moveRow(index, 1)}
                  >
                    <ChevronDownIcon />
                  </Button>
                </div>

                <Field
                  className="flex-1"
                  data-invalid={invalid ? true : undefined}
                >
                  <FieldLabel htmlFor={contentId} className="sr-only">
                    {label}
                  </FieldLabel>
                  <InputGroup>
                    {multiline ? (
                      <InputGroupTextarea
                        id={contentId}
                        placeholder={label}
                        value={row.content}
                        aria-invalid={invalid ? true : undefined}
                        onChange={(event) =>
                          updateRow(index, { content: event.target.value })
                        }
                      />
                    ) : (
                      <InputGroupInput
                        id={contentId}
                        placeholder={label}
                        value={row.content}
                        aria-invalid={invalid ? true : undefined}
                        onChange={(event) =>
                          updateRow(index, { content: event.target.value })
                        }
                      />
                    )}
                  </InputGroup>
                </Field>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Delete row"
                  onClick={() => deleteRow(index)}
                >
                  <Trash2Icon />
                </Button>
              </div>

              <Collapsible
                open={isOpen}
                onOpenChange={(open) => setRowOpen(index, open)}
              >
                <CollapsibleTrigger className="flex items-center gap-1 self-start text-xs text-muted-foreground hover:text-foreground">
                  <ChevronDownIcon
                    className={cn(
                      "size-3.5 transition-transform",
                      isOpen && "rotate-180"
                    )}
                  />
                  Tags & note
                </CollapsibleTrigger>
                <CollapsibleContent className="flex flex-col gap-2 pt-2">
                  <TagInput
                    value={row.tags}
                    onValueChange={(tags) => updateRow(index, { tags })}
                  />
                  <NoteInput
                    value={row.note}
                    onValueChange={(note) => updateRow(index, { note })}
                  />
                </CollapsibleContent>
              </Collapsible>
            </div>
          )
        })}
      </FieldGroup>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={addRow}
      >
        <PlusIcon data-icon="inline-start" />
        Add
      </Button>
    </FieldSet>
  )
}
