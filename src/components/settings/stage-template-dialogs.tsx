import * as React from "react"

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
import { DeleteConfirmDialogShell, RenameDialogShell } from "@/components/settings/entity-dialog-shells"
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
    <RenameDialogShell
      open={open}
      onCancel={onCancel}
      onSubmit={submit}
      title="Rename stage template"
      description="Stages already added to applications keep their own name and category exactly as recorded — this only changes what gets suggested going forward."
      submitDisabled={Boolean(problem)}
    >
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
    </RenameDialogShell>
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
    <DeleteConfirmDialogShell
      open={open}
      onCancel={onCancel}
      onDelete={onDelete}
      title={`Delete “${template.name}”?`}
      description="This only removes it from the autocomplete list — stages already added to applications keep their name and category exactly as recorded."
      actionLabel="Delete template"
    />
  )
}
