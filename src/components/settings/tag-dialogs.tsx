import * as React from "react"

import { Badge } from "@/components/ui/badge"
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
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { usageSentence } from "@/lib/tag-copy"
import {
  normaliseTagName,
  usageOfAny,
  validateTagName,
  type TagUsage,
} from "@/lib/tags"
import { useInventoryStore } from "@/lib/inventory-store"

/** Enough to pick from without turning the popup into a second list to read. */
const MAX_SUGGESTIONS = 5

/**
 * Rename a tag. Same validation as the add field, plus the tag's own name is
 * allowed through — otherwise reopening the dialog and pressing Rename would
 * report the tag as a duplicate of itself.
 */
export function RenameTagDialog({
  tag,
  open,
  onCancel,
  onRename,
}: {
  tag: TagUsage
  open: boolean
  onCancel: () => void
  onRename: (name: string) => void
}) {
  const store = useInventoryStore()
  const [value, setValue] = React.useState(tag.name)
  const problem = validateTagName(value, store.tags, { except: tag.name })

  function submit(event: React.FormEvent) {
    event.preventDefault()

    if (!problem) {
      onRename(value)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Rename tag</DialogTitle>
            <DialogDescription>
              “{tag.name}” is {usageSentence(tag)}. Renaming updates every one
              of them.
            </DialogDescription>
          </DialogHeader>

          <Field className="my-4" data-invalid={problem ? true : undefined}>
            <FieldLabel htmlFor="rename-tag">New name</FieldLabel>
            <Input
              id="rename-tag"
              value={value}
              autoFocus
              onChange={(event) => setValue(event.target.value)}
              aria-invalid={problem ? true : undefined}
            />
            {problem ? <FieldError>{problem}</FieldError> : null}
          </Field>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={Boolean(problem)}>
              Rename
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Merge a checked batch of tags into one — an existing tag (any tag in the
 * registry, including one of the tags being merged, so "these are duplicates,
 * keep this one" works) or a brand-new name typed in.
 *
 * The target field is a plain autocomplete, not a create-or-pick toggle: what
 * ends up in the box is what gets merged into, whether it was typed fresh or
 * picked from a suggestion. `mergeTags` itself decides whether that means
 * registering a new tag or landing on an existing one.
 */
export function MergeTagDialog({
  tags,
  open,
  onCancel,
  onMerge,
}: {
  tags: TagUsage[]
  open: boolean
  onCancel: () => void
  onMerge: (to: string) => void
}) {
  const store = useInventoryStore()
  const [value, setValue] = React.useState("")
  const fromNames = tags.map((tag) => tag.name)
  const usage: TagUsage = { name: "", ...usageOfAny(store, fromNames) }

  const normalised = normaliseTagName(value)
  const targetExists = store.tags.includes(normalised)
  // Landing on any existing tag is always fine, including one of the tags
  // being merged — only a genuinely new name has to pass the usual rules.
  const problem = targetExists ? null : validateTagName(value, store.tags)

  const suggestions = React.useMemo(
    () => store.tags.filter((tag) => tag.startsWith(normalised)).slice(0, MAX_SUGGESTIONS),
    [store.tags, normalised]
  )

  function submit(event: React.FormEvent) {
    event.preventDefault()

    if (!problem && normalised) {
      onMerge(value)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setValue("")
          onCancel()
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>
              {tags.length > 1 ? `Merge ${tags.length} tags` : `Merge “${fromNames[0]}”`}
            </DialogTitle>
            <DialogDescription>
              {usage.itemCount + usage.lineCount > 0
                ? `Between them they are ${usageSentence(usage)}. Merging moves all of it onto the tag below, then removes the old names.`
                : "Nothing is tagged with them yet — merging just replaces the names below."}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex flex-wrap gap-1">
            {tags.map((tag) => (
              <Badge key={tag.name} variant="secondary">
                {tag.name}
              </Badge>
            ))}
          </div>

          <DialogBody>
            <Field className="mt-4" data-invalid={value && problem ? true : undefined}>
              <FieldLabel htmlFor="merge-tag-target">Merge into</FieldLabel>
              <Combobox
                autoHighlight
                items={suggestions}
                filter={null}
                inputValue={value}
                onInputValueChange={setValue}
                onValueChange={(next: string | null) => {
                  if (next) setValue(next)
                }}
              >
                <ComboboxInput
                  id="merge-tag-target"
                  autoFocus
                  placeholder="Existing or new tag name…"
                  aria-label="Merge into"
                  aria-invalid={value && problem ? true : undefined}
                />
                <ComboboxContent>
                  <ComboboxEmpty>
                    Not in the registry yet — this will create a new tag.
                  </ComboboxEmpty>
                  <ComboboxList>
                    {(tag: string) => (
                      <ComboboxItem key={tag} value={tag}>
                        {tag}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
              {value && problem ? <FieldError>{problem}</FieldError> : null}
            </Field>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={Boolean(problem) || !normalised}>
              Merge
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Confirm deleting one tag or a checked batch of them — one dialog, because the
 * question and the consequence are the same either way.
 *
 * Deleting a tag that's in use is allowed on purpose: cleaning up a vocabulary
 * is the whole point, and making you untag every row first would be tedious
 * enough that nobody would. So the copy leads with what is about to lose it.
 */
export function DeleteTagDialog({
  tags,
  open,
  onCancel,
  onDelete,
}: {
  tags: TagUsage[]
  open: boolean
  onCancel: () => void
  onDelete: () => void
}) {
  const store = useInventoryStore()
  const batch = tags.length > 1
  // One tag can answer for itself; a batch has to be counted over distinct rows.
  const usage: TagUsage = batch
    ? { name: "", ...usageOfAny(store, tags.map((tag) => tag.name)) }
    : tags[0]
  const inUse = usage.itemCount + usage.lineCount > 0

  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {batch ? `Delete ${tags.length} tags?` : `Delete “${usage.name}”?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {inUse
              ? `${batch ? "Between them they are" : "It is"} ${usageSentence(usage)}. Deleting removes ${batch ? "them" : "it"} from all of them.`
              : `Nothing is tagged with ${batch ? "any of them" : "it"}, so nothing else changes.`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {batch ? (
          <div className="flex flex-wrap gap-1">
            {tags.map((tag) => (
              <Badge key={tag.name} variant="secondary">
                {tag.name}
              </Badge>
            ))}
          </div>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onDelete}>
            Delete {batch ? `${tags.length} tags` : "tag"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
