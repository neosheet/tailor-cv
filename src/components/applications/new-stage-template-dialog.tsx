import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useApplicationStore } from "@/lib/application-store"
import { BUILT_IN_STAGE_CATEGORIES, STAGE_CATEGORY_LABEL } from "@/lib/stage-category"
import { createStageTemplate, validateStageTemplateName } from "@/lib/stage-templates"
import type { BuiltInStageCategory, DbStageTemplate } from "@/mocks/types"

const categoryOptions = BUILT_IN_STAGE_CATEGORIES.map((value) => ({
  value,
  label: STAGE_CATEGORY_LABEL[value],
}))

/**
 * Small creation dialog opened from `StageNameInput` when Enter is pressed
 * with no matching template suggestion — mirrors `SkillLinkInput`'s embedded
 * `ItemDialog` usage, but the "record" here is a stage template (name +
 * category), not a full inventory item. Category starts unset rather than
 * defaulting to the first option, forcing a deliberate pick.
 */
export function NewStageTemplateDialog({
  initialName,
  open,
  onOpenChange,
  onCreated,
}: {
  initialName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (template: DbStageTemplate) => void
}) {
  const store = useApplicationStore()
  const [name, setName] = React.useState(initialName)
  const [category, setCategory] = React.useState<BuiltInStageCategory | undefined>(
    undefined
  )
  const [saving, setSaving] = React.useState(false)

  // Reseeded only on the open transition, adjusted during render — same
  // pattern as `ApplicationFormDialog`'s `wasOpen`.
  const [wasOpen, setWasOpen] = React.useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setName(initialName)
      setCategory(undefined)
    }
  }

  const problem = validateStageTemplateName(name, store.stageTemplates)
  const canSubmit = !problem && category !== undefined

  async function handleSubmit() {
    if (!canSubmit || category === undefined) return

    setSaving(true)
    try {
      const template = await createStageTemplate(store, name, category)
      onCreated(template)
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New stage template</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4 pt-2 -mb-4">
          <FieldGroup>
            <Field data-invalid={problem ? true : undefined}>
              <FieldLabel htmlFor="new-stage-template-name">Name</FieldLabel>
              <Input
                id="new-stage-template-name"
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                aria-invalid={problem ? true : undefined}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleSubmit()
                }}
              />
              {problem ? <FieldError>{problem}</FieldError> : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="new-stage-template-category">Category</FieldLabel>
              <Select
                items={categoryOptions}
                value={category}
                onValueChange={(next) => setCategory(next as BuiltInStageCategory)}
              >
                <SelectTrigger id="new-stage-template-category" className="w-full">
                  <SelectValue placeholder="Select a category…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {categoryOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
        </DialogBody>
        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button size="sm" disabled={saving || !canSubmit} onClick={handleSubmit}>
            {saving ? "Creating…" : "Create template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
