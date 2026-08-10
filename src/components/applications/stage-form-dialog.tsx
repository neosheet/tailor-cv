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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DeadlineDatePicker } from "@/components/applications/deadline-date-picker"
import { InterviewerNamesInput } from "@/components/applications/interviewer-names-input"
import { StageNameInput } from "@/components/applications/stage-name-input"
import { NoteInput } from "@/components/inventory/note-input"
import { useApplicationStore } from "@/lib/application-store"
import { createStage, updateStage } from "@/lib/application-stage"
import { BUILT_IN_STAGE_CATEGORIES, STAGE_CATEGORY_LABEL } from "@/lib/stage-category"
import {
  STAGE_PROGRESS_STATUSES,
  STAGE_PROGRESS_STATUS_LABEL,
} from "@/lib/stage-progress-status"
import type {
  BuiltInStageCategory,
  DbApplication,
  DbApplicationStage,
  StageProgressStatus,
} from "@/mocks/types"

/** Category has no built-in "unset" state to fall back to, unlike deadline/notes — `custom` is the DB column's own default. */
const DEFAULT_CATEGORY: BuiltInStageCategory = "custom"

type StageFormDialogProps =
  | {
      mode: "add"
      application: DbApplication
      parentStageId: string | null
      open: boolean
      onOpenChange: (open: boolean) => void
      onSaved: () => void
    }
  | {
      mode: "edit"
      stage: DbApplicationStage
      open: boolean
      onOpenChange: (open: boolean) => void
      onSaved: () => void
    }

const categoryOptions = BUILT_IN_STAGE_CATEGORIES.map((value) => ({
  value,
  label: STAGE_CATEGORY_LABEL[value],
}))

const statusOptions = STAGE_PROGRESS_STATUSES.map((value) => ({
  value,
  label: STAGE_PROGRESS_STATUS_LABEL[value],
}))

/**
 * Add/Edit dialog for one stage in an application's Timeline tab. Two modes,
 * distinguished by `mode` — Add creates a new top-level or sub-stage (per
 * `parentStageId`) on `application`; Edit patches an existing `stage` in
 * place. A stage's parent is immutable after creation (no move-to-a-
 * different-parent feature in this plan), so Edit mode carries no
 * `parentStageId`/`application` props at all.
 */
export function StageFormDialog(props: StageFormDialogProps) {
  const { mode, open, onOpenChange, onSaved } = props
  const store = useApplicationStore()

  const initial =
    mode === "edit"
      ? {
          name: props.stage.name,
          category: (props.stage.category as BuiltInStageCategory) ?? DEFAULT_CATEGORY,
          status: props.stage.status,
          scheduledAt: props.stage.scheduledAt,
          completedAt: props.stage.completedAt,
          notes: props.stage.notes,
          interviewerNames: props.stage.interviewerNames,
        }
      : {
          name: "",
          category: DEFAULT_CATEGORY,
          status: "not_started" as StageProgressStatus,
          scheduledAt: null as string | null,
          completedAt: null as string | null,
          notes: null as string | null,
          interviewerNames: [] as string[],
        }

  const [name, setName] = React.useState(initial.name)
  const [category, setCategory] = React.useState<BuiltInStageCategory | string>(
    initial.category
  )
  const [status, setStatus] = React.useState<StageProgressStatus>(initial.status)
  const [scheduledAt, setScheduledAt] = React.useState(initial.scheduledAt)
  const [completedAt, setCompletedAt] = React.useState(initial.completedAt)
  const [notes, setNotes] = React.useState(initial.notes)
  const [interviewerNames, setInterviewerNames] = React.useState(
    initial.interviewerNames
  )
  const [saving, setSaving] = React.useState(false)

  // Reseeded only on the open transition, adjusted during render — same
  // pattern as `ApplicationFormDialog`'s `wasOpen`. Re-reads `initial` fresh
  // each render, so reopening Edit for a *different* stage (or Add after a
  // previous save) starts from the right values instead of stale state.
  const [wasOpen, setWasOpen] = React.useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setName(initial.name)
      setCategory(initial.category)
      setStatus(initial.status)
      setScheduledAt(initial.scheduledAt)
      setCompletedAt(initial.completedAt)
      setNotes(initial.notes)
      setInterviewerNames(initial.interviewerNames)
    }
  }

  const canSubmit = name.trim() !== ""

  async function handleSubmit() {
    const trimmed = name.trim()
    if (!trimmed) return

    setSaving(true)
    try {
      if (mode === "add") {
        await createStage(store, props.application.id, {
          parentStageId: props.parentStageId,
          name: trimmed,
          category,
          status,
          scheduledAt,
          completedAt,
          notes,
          interviewerNames,
        })
      } else {
        await updateStage(store, props.stage.id, {
          name: trimmed,
          category,
          status,
          scheduledAt,
          completedAt,
          notes,
          interviewerNames,
        })
      }
      onSaved()
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  const title =
    mode === "edit"
      ? "Edit stage"
      : props.parentStageId
        ? "Add sub-stage"
        : "Add stage"

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4 pt-2 -mb-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="stage-name">Name</FieldLabel>
              <StageNameInput
                id="stage-name"
                value={name}
                onValueChange={setName}
                onCategoryHint={setCategory}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="stage-category">Category</FieldLabel>
                <Select
                  items={categoryOptions}
                  value={category}
                  onValueChange={(next) => setCategory(next as BuiltInStageCategory)}
                >
                  <SelectTrigger id="stage-category" className="w-full">
                    <SelectValue />
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
              <Field>
                <FieldLabel htmlFor="stage-status">Status</FieldLabel>
                <Select
                  items={statusOptions}
                  value={status}
                  onValueChange={(next) => setStatus(next as StageProgressStatus)}
                >
                  <SelectTrigger id="stage-status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {statusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="stage-scheduled-at">Scheduled</FieldLabel>
                <DeadlineDatePicker
                  id="stage-scheduled-at"
                  label="Scheduled"
                  value={scheduledAt}
                  onValueChange={setScheduledAt}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="stage-completed-at">Completed</FieldLabel>
                <DeadlineDatePicker
                  id="stage-completed-at"
                  label="Completed"
                  value={completedAt}
                  onValueChange={setCompletedAt}
                />
              </Field>
            </div>
            <NoteInput value={notes} onValueChange={setNotes} />
            <InterviewerNamesInput
              value={interviewerNames}
              onValueChange={setInterviewerNames}
            />
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
            {saving ? "Saving…" : mode === "add" ? "Add stage" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
