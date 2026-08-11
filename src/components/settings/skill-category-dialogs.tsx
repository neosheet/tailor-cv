import * as React from "react"

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
import {
  categoryUsageLabel,
  validateCategoryName,
  type SkillCategoryUsage,
} from "@/lib/skill-categories"
import { useInventoryStore } from "@/lib/inventory-store"

/**
 * Rename a skill category. Mirrors `RenameTagDialog` — same validation shape,
 * the category's own name is allowed through so reopening after a no-op edit
 * doesn't report it as a duplicate of itself.
 */
export function RenameSkillCategoryDialog({
  category,
  open,
  onCancel,
  onRename,
}: {
  category: SkillCategoryUsage
  open: boolean
  onCancel: () => void
  onRename: (name: string) => void
}) {
  const store = useInventoryStore()
  const [value, setValue] = React.useState(category.name)
  const problem = validateCategoryName(value, store.skillCategories, {
    except: category.id,
  })

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
            <DialogTitle>Rename category</DialogTitle>
            <DialogDescription>
              “{category.name}” is {categoryUsageLabel(category).toLowerCase()}.
              Renaming updates every one of them.
            </DialogDescription>
          </DialogHeader>

          <Field className="my-4" data-invalid={problem ? true : undefined}>
            <FieldLabel htmlFor="rename-category">New name</FieldLabel>
            <Input
              id="rename-category"
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
 * Confirm deleting one category. Allowed while in use, same reasoning as
 * `DeleteTagDialog` — the affected skills fall back to no category rather
 * than blocking the delete.
 */
export function DeleteSkillCategoryDialog({
  category,
  open,
  onCancel,
  onDelete,
}: {
  category: SkillCategoryUsage
  open: boolean
  onCancel: () => void
  onDelete: () => void
}) {
  const inUse = category.itemCount > 0

  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{category.name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            {inUse
              ? `It is on ${categoryUsageLabel(category).toLowerCase()}. Deleting leaves them uncategorized.`
              : "Nothing is categorized with it, so nothing else changes."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onDelete}>
            Delete category
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
