import * as React from "react"

import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { DeleteConfirmDialogShell, RenameDialogShell } from "@/components/settings/entity-dialog-shells"
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
    <RenameDialogShell
      open={open}
      onCancel={onCancel}
      onSubmit={submit}
      title="Rename category"
      description={
        <>
          “{category.name}” is {categoryUsageLabel(category).toLowerCase()}.
          Renaming updates every one of them.
        </>
      }
      submitDisabled={Boolean(problem)}
    >
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
    </RenameDialogShell>
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
    <DeleteConfirmDialogShell
      open={open}
      onCancel={onCancel}
      onDelete={onDelete}
      title={`Delete “${category.name}”?`}
      description={
        inUse
          ? `It is on ${categoryUsageLabel(category).toLowerCase()}. Deleting leaves them uncategorized.`
          : "Nothing is categorized with it, so nothing else changes."
      }
      actionLabel="Delete category"
    />
  )
}
