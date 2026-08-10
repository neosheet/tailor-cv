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
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { BUILT_IN_STAGE_CATEGORIES, STAGE_CATEGORY_LABEL } from "@/lib/stage-category"
import { validateStageTemplateName } from "@/lib/stage-templates"
import { useApplicationStore } from "@/lib/application-store"
import type { BuiltInStageCategory, DbStageTemplate } from "@/mocks/types"

/**
 * Rename (and re-categorize) a stage template. Unlike `RenameSkillCategoryDialog`
 * (name-only), this one edits both name and category in one dialog — a stage
 * template is always the pair, not just a label.
 *
 * No "used on N stages" copy here, deliberately: `stage_templates` is a pure
 * autocomplete-suggestion registry, never FK-referenced by `application_stages`
 * (that table's `name`/`category` are plain denormalized `text`, copied at
 * creation time). Editing a template never touches a stage already recorded on
 * an application, so there's nothing to report.
 */
export function RenameStageTemplateDialog({
  template,
  open,
  onCancel,
  onRename,
}: {
  template: DbStageTemplate
  open: boolean
  onCancel: () => void
  onRename: (name: string, category: BuiltInStageCategory) => void
}) {
  const store = useApplicationStore()
  const [name, setName] = React.useState(template.name)
  const [category, setCategory] = React.useState<BuiltInStageCategory>(
    template.category as BuiltInStageCategory
  )
  const problem = validateStageTemplateName(name, store.stageTemplates, {
    except: template.id,
  })

  function submit(event: React.FormEvent) {
    event.preventDefault()

    if (!problem) {
      onRename(name, category)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Rename stage template</DialogTitle>
            <DialogDescription>
              Stages already added to applications keep their own name and
              category exactly as recorded — this only changes what gets
              suggested going forward.
            </DialogDescription>
          </DialogHeader>

          <div className="my-4 flex flex-col gap-4">
            <Field data-invalid={problem ? true : undefined}>
              <FieldLabel htmlFor="rename-stage-template-name">Name</FieldLabel>
              <Input
                id="rename-stage-template-name"
                value={name}
                autoFocus
                onChange={(event) => setName(event.target.value)}
                aria-invalid={problem ? true : undefined}
              />
              {problem ? <FieldError>{problem}</FieldError> : null}
            </Field>

            <Field>
              <FieldLabel htmlFor="rename-stage-template-category">
                Category
              </FieldLabel>
              <Select
                items={BUILT_IN_STAGE_CATEGORIES.map((value) => ({
                  value,
                  label: STAGE_CATEGORY_LABEL[value],
                }))}
                value={category}
                onValueChange={(next) => setCategory(next as BuiltInStageCategory)}
              >
                <SelectTrigger id="rename-stage-template-category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {BUILT_IN_STAGE_CATEGORIES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {STAGE_CATEGORY_LABEL[value]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </div>

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
 * Confirm deleting one stage template. Plain confirmation, no conditional
 * in-use copy — unlike `DeleteSkillCategoryDialog`, there's nothing to check.
 * `stage_templates` isn't FK-referenced by `application_stages` (a recorded
 * stage's `name`/`category` are copied, plain `text`, at creation time), so
 * deleting a template can never orphan or change anything already recorded on
 * an application.
 */
export function DeleteStageTemplateDialog({
  template,
  open,
  onCancel,
  onDelete,
}: {
  template: DbStageTemplate
  open: boolean
  onCancel: () => void
  onDelete: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{template.name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This only removes it from the autocomplete list — stages already
            added to applications keep their name and category exactly as
            recorded.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onDelete}>
            Delete template
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
