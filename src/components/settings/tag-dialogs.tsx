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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { usageSentence } from "@/lib/tag-copy"
import { usageOfAny, validateTagName, type TagUsage } from "@/mocks/tags"

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
  const [value, setValue] = React.useState(tag.name)
  const problem = validateTagName(value, { except: tag.name })

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
  const batch = tags.length > 1
  // One tag can answer for itself; a batch has to be counted over distinct rows.
  const usage: TagUsage = batch
    ? { name: "", ...usageOfAny(tags.map((tag) => tag.name)) }
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
